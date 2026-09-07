import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedAdmin,
  getAuditServiceClient,
  hasLotteryPermission,
  writeLotteryAuditSafe,
} from "@/lib/lottery/audit-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_STATUSES = new Set([
  "draft",
  "confirmed",
  "available_for_draw",
  "allocated",
  "claimed",
  "fulfilled",
  "unclaimed",
  "withdrawn",
]);

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function optionalText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function optionalMoney(value: unknown): number | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined;
}

function valuesEqual(previous: unknown, next: unknown) {
  if (previous == null && next == null) return true;
  if (typeof next === "number") return Number(previous) === next;
  return previous === next;
}

export async function GET() {
  try {
    const admin = await getAuthenticatedAdmin();

    if (!admin) {
      return response({ ok: false, error: "Unauthorized." }, 401);
    }

    if (!hasLotteryPermission(admin, "lottery:view")) {
      return response(
        { ok: false, error: "You do not have permission to view prizes." },
        403,
      );
    }

    const db = getAuditServiceClient();
    const { data: prizes, error: prizeError } = await db
      .from("lottery_prizes")
      .select(`
        id,
        lottery_id,
        name,
        description,
        image_url,
        quantity,
        declared_value,
        is_donated,
        donor_name,
        sponsor_name,
        display_order,
        eligibility_restrictions,
        fulfilment_requirements,
        fulfilment_notes,
        status,
        allocated_winner_id,
        allocated_at,
        claimed_at,
        fulfilled_at,
        unclaimed_at,
        withdrawn_at,
        created_at,
        updated_at
      `)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (prizeError) {
      console.error("Prize load error:", prizeError);
      return response(
        {
          ok: false,
          error: "Unable to load prizes.",
          supabaseCode: prizeError.code,
          supabaseDetails: prizeError.details,
          supabaseHint: prizeError.hint,
        },
        500,
      );
    }

    const rows = prizes || [];
    const lotteryIds = [...new Set(rows.map((item) => item.lottery_id))];
    const winnerIds = [
      ...new Set(rows.map((item) => item.allocated_winner_id).filter(Boolean)),
    ] as string[];

    const [lotteriesResult, winnersResult] = await Promise.all([
      lotteryIds.length
        ? db.from("lotteries").select("id,title,slug").in("id", lotteryIds)
        : Promise.resolve({ data: [], error: null }),
      winnerIds.length
        ? db
            .from("lottery_winners")
            .select("id,winner_name,winner_email,claimed")
            .in("id", winnerIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (lotteriesResult.error || winnersResult.error) {
      return response(
        { ok: false, error: "Unable to load complete prize data." },
        500,
      );
    }

    const lotteries = new Map(
      (lotteriesResult.data || []).map((item) => [item.id, item]),
    );
    const winners = new Map(
      (winnersResult.data || []).map((item) => [item.id, item]),
    );

    const items = rows.map((prize) => {
      const lottery = lotteries.get(prize.lottery_id);
      const winner = prize.allocated_winner_id
        ? winners.get(prize.allocated_winner_id)
        : null;

      return {
        ...prize,
        declared_value:
          prize.declared_value === null ? null : Number(prize.declared_value),
        lottery_title: lottery?.title || "Unknown lottery",
        lottery_slug: lottery?.slug || "",
        winner_name: winner?.winner_name || null,
        winner_email: winner?.winner_email || null,
        winner_claimed: winner?.claimed ?? null,
      };
    });

    return response({ ok: true, items });
  } catch (error) {
    console.error("Prize API GET error:", error);
    return response({ ok: false, error: "Unable to load prizes." }, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAuthenticatedAdmin();

    if (!admin) {
      return response({ ok: false, error: "Unauthorized." }, 401);
    }

    if (!hasLotteryPermission(admin, "lottery:view")) {
      return response(
        { ok: false, error: "You do not have permission to create prizes." },
        403,
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return response({ ok: false, error: "The request body is not valid JSON." }, 400);
    }

    const lotteryId = String(body.lottery_id || "").trim();
    const name = String(body.name || "").trim();
    const quantity = Number(body.quantity ?? 1);
    const status = String(body.status || "draft");
    const declaredValue = optionalMoney(body.declared_value);
    const displayOrder = Number(body.display_order ?? 0);

    if (!isValidUuid(lotteryId)) {
      return response({ ok: false, error: "A valid lottery is required." }, 400);
    }

    if (!name) {
      return response({ ok: false, error: "Prize name is required." }, 400);
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return response(
        { ok: false, error: "Quantity must be a whole number above 0." },
        400,
      );
    }

    if (declaredValue === undefined) {
      return response({ ok: false, error: "Declared value is invalid." }, 400);
    }

    if (!Number.isInteger(displayOrder) || displayOrder < 0) {
      return response(
        { ok: false, error: "Display order must be 0 or a positive whole number." },
        400,
      );
    }

    if (!ALLOWED_STATUSES.has(status)) {
      return response({ ok: false, error: "Invalid prize status." }, 400);
    }

    const db = getAuditServiceClient();
    const { data: lottery, error: lotteryError } = await db
      .from("lotteries")
      .select("id,title")
      .eq("id", lotteryId)
      .maybeSingle();

    if (lotteryError || !lottery) {
      return response({ ok: false, error: "Lottery not found." }, 404);
    }

    const { data: created, error: createError } = await db
      .from("lottery_prizes")
      .insert({
        lottery_id: lotteryId,
        name,
        description: optionalText(body.description),
        image_url: optionalText(body.image_url),
        quantity,
        declared_value: declaredValue,
        is_donated: Boolean(body.is_donated),
        donor_name: optionalText(body.donor_name),
        sponsor_name: optionalText(body.sponsor_name),
        display_order: displayOrder,
        eligibility_restrictions: optionalText(body.eligibility_restrictions),
        fulfilment_requirements: optionalText(body.fulfilment_requirements),
        fulfilment_notes: optionalText(body.fulfilment_notes),
        status,
      })
      .select("*")
      .single();

    if (createError) {
      console.error("Prize create error:", createError);
      return response(
        { ok: false, error: "Unable to create prize.", code: createError.code },
        500,
      );
    }

    await writeLotteryAuditSafe({
      admin,
      actionCode: "prize.created",
      actionLabel: "Prize created",
      actionGroup: "prize",
      riskLevel: "medium",
      entityType: "prize",
      entityId: created.id,
      reason: `Prize "${created.name}" was added to lottery "${lottery.title}".`,
    });

    return response({ ok: true, item: created }, 201);
  } catch (error) {
    console.error("Prize API POST error:", error);
    return response({ ok: false, error: "Unable to create prize." }, 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await getAuthenticatedAdmin();

    if (!admin) {
      return response({ ok: false, error: "Unauthorized." }, 401);
    }

    if (!hasLotteryPermission(admin, "lottery:view")) {
      return response(
        { ok: false, error: "You do not have permission to update prizes." },
        403,
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return response({ ok: false, error: "The request body is not valid JSON." }, 400);
    }

    const id = String(body.id || "").trim();
    if (!isValidUuid(id)) {
      return response({ ok: false, error: "A valid prize ID is required." }, 400);
    }

    const db = getAuditServiceClient();
    const { data: existing, error: lookupError } = await db
      .from("lottery_prizes")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (lookupError) {
      return response({ ok: false, error: "Unable to load the prize." }, 500);
    }

    if (!existing) {
      return response({ ok: false, error: "Prize not found." }, 404);
    }

    const proposed: Record<string, unknown> = {};

    if ("lottery_id" in body) {
      const lotteryId = String(body.lottery_id || "").trim();
      if (!isValidUuid(lotteryId)) {
        return response({ ok: false, error: "A valid lottery is required." }, 400);
      }

      const { data: targetLottery, error: targetLotteryError } = await db
        .from("lotteries")
        .select("id")
        .eq("id", lotteryId)
        .maybeSingle();

      if (targetLotteryError || !targetLottery) {
        return response({ ok: false, error: "Lottery not found." }, 404);
      }

      proposed.lottery_id = lotteryId;
    }

    if ("name" in body) {
      const name = String(body.name || "").trim();
      if (!name) return response({ ok: false, error: "Prize name is required." }, 400);
      proposed.name = name;
    }

    const textFields = [
      "description",
      "image_url",
      "donor_name",
      "sponsor_name",
      "eligibility_restrictions",
      "fulfilment_requirements",
      "fulfilment_notes",
    ] as const;

    for (const field of textFields) {
      if (field in body) proposed[field] = optionalText(body[field]);
    }

    if ("quantity" in body) {
      const quantity = Number(body.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        return response(
          { ok: false, error: "Quantity must be a whole number above 0." },
          400,
        );
      }
      proposed.quantity = quantity;
    }

    if ("declared_value" in body) {
      const declaredValue = optionalMoney(body.declared_value);
      if (declaredValue === undefined) {
        return response({ ok: false, error: "Declared value is invalid." }, 400);
      }
      proposed.declared_value = declaredValue;
    }

    if ("is_donated" in body) proposed.is_donated = Boolean(body.is_donated);

    if ("display_order" in body) {
      const displayOrder = Number(body.display_order);
      if (!Number.isInteger(displayOrder) || displayOrder < 0) {
        return response(
          { ok: false, error: "Display order must be 0 or a positive whole number." },
          400,
        );
      }
      proposed.display_order = displayOrder;
    }

    let nextStatus = String(existing.status);
    if ("status" in body) {
      nextStatus = String(body.status);
      if (!ALLOWED_STATUSES.has(nextStatus)) {
        return response({ ok: false, error: "Invalid prize status." }, 400);
      }
      proposed.status = nextStatus;
    }

    const update = Object.fromEntries(
      Object.entries(proposed).filter(
        ([field, value]) => !valuesEqual(existing[field], value),
      ),
    ) as Record<string, unknown>;

    const statusChanged =
      "status" in update && String(existing.status) !== nextStatus;

    if (statusChanged) {
      const now = new Date().toISOString();
      if (nextStatus === "claimed") update.claimed_at = now;
      if (nextStatus === "fulfilled") update.fulfilled_at = now;
      if (nextStatus === "unclaimed") update.unclaimed_at = now;
      if (nextStatus === "withdrawn") update.withdrawn_at = now;
    }

    if (Object.keys(update).length === 0) {
      return response({ ok: false, error: "No prize changes were provided." }, 400);
    }

    update.updated_at = new Date().toISOString();

    const { data: updated, error: updateError } = await db
      .from("lottery_prizes")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      console.error("Prize update error:", updateError);
      return response(
        { ok: false, error: "Unable to update prize.", code: updateError.code },
        500,
      );
    }

    const { data: lottery } = await db
      .from("lotteries")
      .select("title")
      .eq("id", updated.lottery_id)
      .maybeSingle();

    await writeLotteryAuditSafe({
      admin,
      actionCode: statusChanged
        ? `prize.status.${nextStatus}`
        : "prize.updated",
      actionLabel: statusChanged
        ? `Prize status changed to ${nextStatus}`
        : "Prize updated",
      actionGroup: "prize",
      riskLevel:
        statusChanged && ["allocated", "claimed", "fulfilled", "withdrawn"].includes(nextStatus)
          ? "high"
          : "medium",
      entityType: "prize",
      entityId: updated.id,
      reason: statusChanged
        ? `Prize "${updated.name}" for lottery "${lottery?.title || "Unknown lottery"}" changed from ${existing.status} to ${nextStatus}.`
        : `Prize "${updated.name}" for lottery "${lottery?.title || "Unknown lottery"}" was updated.`,
    });

    return response({ ok: true, item: updated });
  } catch (error) {
    console.error("Prize API PATCH error:", error);
    return response({ ok: false, error: "Unable to update prize." }, 500);
  }
}
