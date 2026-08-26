import { NextRequest, NextResponse } from "next/server";
import {
  lotteryAdminDb,
  requireLotteryPermission,
} from "@/lib/lottery/adminAuth";

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

function cleanNullableString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireLotteryPermission("lottery:winners:manage");
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Winner ID is required.",
        },
        { status: 400 },
      );
    }

    const body = await request.json();

    const status =
      typeof body?.status === "string" ? body.status : null;

    const publicDisplayMode =
      typeof body?.public_display_mode === "string"
        ? body.public_display_mode
        : null;

    if (status && !ALLOWED_STATUSES.has(status)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid winner status.",
        },
        { status: 400 },
      );
    }

    if (
      publicDisplayMode &&
      !ALLOWED_PUBLIC_DISPLAY.has(publicDisplayMode)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid public winner display setting.",
        },
        { status: 400 },
      );
    }

    const supabase = lotteryAdminDb();

    const { data: existing, error: existingError } = await supabase
      .from("lottery_winners")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (existingError) {
      console.error("Winner lookup error:", existingError);

      return NextResponse.json(
        {
          ok: false,
          error: "Could not load winner record.",
        },
        { status: 500 },
      );
    }

    if (!existing) {
      return NextResponse.json(
        {
          ok: false,
          error: "Winner not found.",
        },
        { status: 404 },
      );
    }

    const now = new Date().toISOString();

    const update: Record<string, unknown> = {
      updated_at: now,
    };

    if (status) {
      update.status = status;

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

      if (
        ["claimed", "fulfilled"].includes(status) &&
        !existing.claimed_at
      ) {
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

    if (publicDisplayMode) {
      update.public_display_mode = publicDisplayMode;
    }

    if ("fulfilment_method" in body) {
      update.fulfilment_method = cleanNullableString(
        body.fulfilment_method,
      );
    }

    if ("fulfilment_notes" in body) {
      update.fulfilment_notes = cleanNullableString(
        body.fulfilment_notes,
      );
    }

    if ("internal_notes" in body) {
      update.internal_notes = cleanNullableString(
        body.internal_notes,
      );
    }

    if ("collection_delivery_date" in body) {
      const value = body.collection_delivery_date;

      if (value === null || value === "") {
        update.collection_delivery_date = null;
      } else {
        const parsed = new Date(value);

        if (Number.isNaN(parsed.getTime())) {
          return NextResponse.json(
            {
              ok: false,
              error: "Invalid collection or delivery date.",
            },
            { status: 400 },
          );
        }

        update.collection_delivery_date = parsed.toISOString();
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from("lottery_winners")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      console.error("Winner PATCH update error:", updateError);

      return NextResponse.json(
        {
          ok: false,
          error: "Could not update winner.",
        },
        { status: 500 },
      );
    }

    const contactAttempt = body?.contact_attempt;

    if (
      contactAttempt &&
      typeof contactAttempt === "object" &&
      typeof contactAttempt.outcome === "string" &&
      contactAttempt.outcome.trim()
    ) {
      const method =
        typeof contactAttempt.method === "string" &&
        ["email", "phone", "other"].includes(contactAttempt.method)
          ? contactAttempt.method
          : "other";

      const { error: contactError } = await supabase
        .from("lottery_winner_contact_attempts")
        .insert({
          winner_id: id,
          method,
          outcome: contactAttempt.outcome.trim(),
          notes: cleanNullableString(contactAttempt.notes),
          attempted_at: now,
          admin_id: admin?.id ?? null,
          admin_name: admin?.name ?? admin?.email ?? "Admin",
        });

      if (contactError) {
        console.error("Winner contact attempt insert error:", contactError);

        return NextResponse.json(
          {
            ok: false,
            error:
              "Winner was updated, but the contact attempt could not be recorded.",
          },
          { status: 500 },
        );
      }
    }

    // Best-effort audit logging: do not expose audit failures to the browser,
    // but keep them visible in server logs.
    const { error: auditError } = await supabase
      .from("lottery_audit_logs")
      .insert({
        lottery_id: existing.lottery_id,
        entity_type: "winner",
        entity_id: id,
        action_code: "winner.updated",
        action_label: "Winner record updated",
        admin_id: admin?.id ?? null,
        admin_email: admin?.email ?? null,
        admin_name: admin?.name ?? null,
        before_data: existing,
        after_data: updated,
        created_at: now,
      });

    if (auditError) {
      console.warn("Winner audit log insert warning:", auditError);
    }

    return NextResponse.json(
      {
        ok: true,
        item: updated,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error: any) {
    const message =
      typeof error?.message === "string" ? error.message : "";

    if (
      message.toLowerCase().includes("unauthor") ||
      message.toLowerCase().includes("permission")
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "You do not have permission to manage winners.",
        },
        { status: 403 },
      );
    }

    console.error("Winner PATCH unexpected error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Could not update winner.",
      },
      { status: 500 },
    );
  }
}
