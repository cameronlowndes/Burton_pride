import { NextRequest, NextResponse } from "next/server";

import {
  lotteryAdminDb,
  requireLotteryPermission,
} from "@/lib/lottery/adminAuth";
import { writeLotteryAuditSafe } from "@/lib/lottery/audit-server";

export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = new Set([
  "selected",
  "contact_pending",
  "contacted",
  "eligibility_confirmed",
  "claimed",
  "fulfilled",
  "unclaimed",
  "disqualified",
  "replaced",
]);

const ALLOWED_PUBLIC_DISPLAY = new Set([
  "full_name",
  "first_name",
  "ticket_number",
  "none",
]);

const ALLOWED_CONTACT_METHODS = new Set(["email", "phone", "other"]);

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function cleanNullableString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function displayStatus(status: string) {
  return status.replaceAll("_", " ");
}

function statusRisk(status: string): "medium" | "high" | "critical" {
  if (["disqualified", "replaced"].includes(status)) return "critical";
  if (["claimed", "fulfilled", "unclaimed"].includes(status)) return "high";
  return "medium";
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireLotteryPermission("lottery:winners:manage");
    const { id } = await context.params;

    if (!id) {
      return response({ ok: false, error: "Winner ID is required." }, 400);
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return response({ ok: false, error: "A valid request body is required." }, 400);
    }

    const statusProvided = "status" in body;
    const status = statusProvided ? String(body.status ?? "").trim() : null;

    if (statusProvided && (!status || !ALLOWED_STATUSES.has(status))) {
      return response({ ok: false, error: "Invalid winner status." }, 400);
    }

    const publicDisplayProvided = "public_display_mode" in body;
    const publicDisplayMode = publicDisplayProvided
      ? String(body.public_display_mode ?? "").trim()
      : null;

    if (
      publicDisplayProvided &&
      (!publicDisplayMode || !ALLOWED_PUBLIC_DISPLAY.has(publicDisplayMode))
    ) {
      return response(
        { ok: false, error: "Invalid public winner display setting." },
        400,
      );
    }

    const contactAttemptProvided = "contact_attempt" in body;
    const contactAttempt = contactAttemptProvided ? body.contact_attempt : null;

    if (
      contactAttemptProvided &&
      (!contactAttempt ||
        typeof contactAttempt !== "object" ||
        Array.isArray(contactAttempt))
    ) {
      return response({ ok: false, error: "Invalid contact attempt." }, 400);
    }

    const contactOutcome = contactAttemptProvided
      ? cleanNullableString((contactAttempt as Record<string, unknown>).outcome)
      : null;

    if (contactAttemptProvided && !contactOutcome) {
      return response(
        { ok: false, error: "A contact attempt outcome is required." },
        400,
      );
    }

    const requestedContactMethod = contactAttemptProvided
      ? cleanNullableString((contactAttempt as Record<string, unknown>).method)
      : null;

    if (
      requestedContactMethod &&
      !ALLOWED_CONTACT_METHODS.has(requestedContactMethod)
    ) {
      return response({ ok: false, error: "Invalid contact method." }, 400);
    }

    const supabase = lotteryAdminDb();

    const { data: existing, error: existingError } = await supabase
      .from("lottery_winners")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (existingError) {
      console.error("Winner lookup error:", existingError);
      return response({ ok: false, error: "Could not load winner record." }, 500);
    }

    if (!existing) {
      return response({ ok: false, error: "Winner not found." }, 404);
    }

    const now = new Date().toISOString();
    const update: Record<string, unknown> = {};
    const changedFields: string[] = [];
    const previousStatus = String(existing.status);
    const statusChanged = Boolean(status && status !== previousStatus);

    if (statusChanged && status) {
      update.status = status;
      changedFields.push("status");

      if (
        ["contacted", "eligibility_confirmed", "claimed", "fulfilled"].includes(
          status,
        ) &&
        !existing.contacted_at
      ) {
        update.contacted_at = now;
      }

      if (
        ["eligibility_confirmed", "claimed", "fulfilled"].includes(status) &&
        !existing.eligibility_confirmed_at
      ) {
        update.eligibility_confirmed_at = now;
      }

      if (["claimed", "fulfilled"].includes(status) && !existing.claimed_at) {
        update.claimed_at = now;
      }

      if (status === "fulfilled" && !existing.fulfilled_at) {
        update.fulfilled_at = now;
      }

      if (status === "unclaimed" && !existing.unclaimed_at) {
        update.unclaimed_at = now;
      }

      if (status === "disqualified" && !existing.disqualified_at) {
        update.disqualified_at = now;
      }

      if (status === "replaced" && !existing.replaced_at) {
        update.replaced_at = now;
      }
    }

    if (
      publicDisplayProvided &&
      publicDisplayMode !== existing.public_display_mode
    ) {
      update.public_display_mode = publicDisplayMode;
      changedFields.push("public display setting");
    }

    const nullableFields = [
      "fulfilment_method",
      "fulfilment_notes",
      "internal_notes",
    ] as const;

    for (const field of nullableFields) {
      if (field in body) {
        const nextValue = cleanNullableString(body[field]);
        const currentValue = existing[field] ?? null;

        if (nextValue !== currentValue) {
          update[field] = nextValue;
          changedFields.push(field.replaceAll("_", " "));
        }
      }
    }

    if ("collection_delivery_date" in body) {
      const value = body.collection_delivery_date;
      let nextDate: string | null;

      if (value === null || value === "") {
        nextDate = null;
      } else {
        const parsed = new Date(String(value));

        if (Number.isNaN(parsed.getTime())) {
          return response(
            { ok: false, error: "Invalid collection or delivery date." },
            400,
          );
        }

        nextDate = parsed.toISOString();
      }

      const currentDate = existing.collection_delivery_date
        ? new Date(existing.collection_delivery_date).toISOString()
        : null;

      if (nextDate !== currentDate) {
        update.collection_delivery_date = nextDate;
        changedFields.push("collection or delivery date");
      }
    }

    const winnerChanged = changedFields.length > 0;

    if (!winnerChanged && !contactAttemptProvided) {
      return response(
        { ok: false, error: "No winner changes were supplied." },
        400,
      );
    }

    let updated = existing;

    if (winnerChanged) {
      update.updated_at = now;

      const { data, error: updateError } = await supabase
        .from("lottery_winners")
        .update(update)
        .eq("id", id)
        .select("*")
        .single();

      if (updateError) {
        console.error("Winner PATCH update error:", updateError);
        return response({ ok: false, error: "Could not update winner." }, 500);
      }

      updated = data;
    }

    const { data: lottery } = await supabase
      .from("lotteries")
      .select("title")
      .eq("id", existing.lottery_id)
      .maybeSingle();

    const lotteryTitle = lottery?.title ?? "Unknown lottery";

    if (winnerChanged) {
      await writeLotteryAuditSafe({
        admin,
        actionCode: statusChanged
          ? `winner.status.${status}`
          : "winner.updated",
        actionLabel: statusChanged
          ? `Winner status changed to ${displayStatus(status as string)}`
          : "Winner record updated",
        actionGroup: "winner",
        riskLevel: statusChanged ? statusRisk(status as string) : "medium",
        entityType: "winner",
        entityId: id,
        reason: statusChanged
          ? `Winner ${id} for lottery "${lotteryTitle}" changed from ${displayStatus(previousStatus)} to ${displayStatus(status as string)}${changedFields.length > 1 ? `. Other changes: ${changedFields.slice(1).join(", ")}.` : "."}`
          : `Winner ${id} for lottery "${lotteryTitle}" was updated. Changed: ${changedFields.join(", ")}.`,
      });
    }

    if (contactAttemptProvided && contactOutcome) {
      const contactMethod = requestedContactMethod ?? "other";

      const { error: contactError } = await supabase
        .from("lottery_winner_contact_attempts")
        .insert({
          winner_id: id,
          method: contactMethod,
          outcome: contactOutcome,
          notes: cleanNullableString(
            (contactAttempt as Record<string, unknown>).notes,
          ),
          attempted_at: now,
          admin_id: admin.id,
          admin_name: admin.name ?? admin.email ?? "Admin",
        });

      if (contactError) {
        console.error("Winner contact attempt insert error:", contactError);

        return response(
          {
            ok: false,
            error: winnerChanged
              ? "Winner was updated and audited, but the contact attempt could not be recorded."
              : "The contact attempt could not be recorded.",
          },
          500,
        );
      }

      await writeLotteryAuditSafe({
        admin,
        actionCode: "winner.contact.recorded",
        actionLabel: "Winner contact attempt recorded",
        actionGroup: "winner",
        riskLevel: "medium",
        entityType: "winner",
        entityId: id,
        reason: `${contactMethod} contact attempt recorded for winner ${id} in lottery "${lotteryTitle}". Outcome: ${contactOutcome}.`,
      });
    }

    return response({ ok: true, item: updated });
  } catch (error: unknown) {
    const status =
      typeof error === "object" && error && "status" in error
        ? Number((error as { status?: unknown }).status)
        : 500;

    if (status === 401) {
      return response({ ok: false, error: "You must be signed in." }, 401);
    }

    if (status === 403) {
      return response(
        { ok: false, error: "You do not have permission to manage winners." },
        403,
      );
    }

    console.error("Winner PATCH unexpected error:", error);
    return response({ ok: false, error: "Could not update winner." }, 500);
  }
}
