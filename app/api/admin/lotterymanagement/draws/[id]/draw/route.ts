import { NextRequest, NextResponse } from "next/server";
import { createHash, randomInt, randomUUID } from "node:crypto";
import { lotteryAdminDb, requireLotteryPermission } from "@/lib/lottery/adminAuth";
import { getAuthenticatedAdmin } from "@/lib/lottery/audit-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Context = { params: Promise<{ id: string }> };
type Entry = { ticket_id: string; order_id: string; ticket_number: string };
type Prize = { id: string; name: string; quantity: number };
type Allocation = { prize_id: string; ticket_id: string; order_id: string };
type Db = ReturnType<typeof lotteryAdminDb>;

class DrawError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "X-Content-Type-Options": "nosniff",
  } });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function uuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function failQuery(error: unknown, requestId: string, label: string) {
  if (!error) return;
  console.error(`[${requestId}] ${label}`, error);
  throw new DrawError("A required draw check could not be completed.", 503, "DRAW_CHECK_UNAVAILABLE");
}

async function readEntries(db: Db, drawId: string, expected: number): Promise<Entry[]> {
  if (!Number.isSafeInteger(expected) || expected <= 0 || expected > 100_000) {
    throw new DrawError("The frozen ticket count is invalid or exceeds this route's supported limit.", 409, "INVALID_SNAPSHOT_COUNT");
  }
  const entries: Entry[] = [];
  const seen = new Set<string>();
  for (let offset = 0; offset < expected; offset += 500) {
    const { data, error } = await db.from("lottery_draw_entries")
      .select("ticket_id,order_id,ticket_number")
      .eq("draw_id", drawId).order("ticket_id", { ascending: true })
      .range(offset, Math.min(offset + 499, expected - 1));
    if (error) throw error;
    const page = data ?? [];
    if (page.length !== Math.min(500, expected - offset)) {
      throw new DrawError("The frozen ticket pool is incomplete.", 409, "SNAPSHOT_INCOMPLETE");
    }
    for (const entry of page) {
      if (!uuid(entry.ticket_id) || !uuid(entry.order_id) ||
          typeof entry.ticket_number !== "string" || !entry.ticket_number ||
          seen.has(entry.ticket_id)) {
        throw new DrawError("The frozen ticket pool could not be validated.", 409, "SNAPSHOT_INVALID");
      }
      seen.add(entry.ticket_id);
      entries.push(entry);
    }
  }
  return entries;
}

// Uniform selection without replacement. The request never supplies winners.
function selectWinners(entries: Entry[], prizes: Prize[]) {
  if (prizes.length > entries.length) {
    throw new DrawError("There are more prizes than eligible tickets. Each ticket may win only once.", 409, "INSUFFICIENT_TICKETS");
  }
  const pool = [...entries];
  return prizes.map((prize) => {
    const position = randomInt(pool.length);
    const entry = pool[position];
    pool[position] = pool[pool.length - 1];
    pool.pop();
    return { prize, entry };
  });
}

export async function POST(request: NextRequest, context: Context) {
  const requestId = `DRAW-${randomUUID()}`;
  let db: Db | null = null;
  let drawId: string | null = null;
  let completionSubmitted = false;

  try {
    // Cookie-authenticated browser requests must originate from this site.
    if (request.headers.get("origin") !== new URL(request.url).origin) {
      throw new DrawError("This draw request must originate from this site.", 403, "INVALID_ORIGIN");
    }
    if (request.headers.get("sec-fetch-site") === "cross-site") {
      throw new DrawError("Cross-site draw requests are not allowed.", 403, "INVALID_ORIGIN");
    }
    await requireLotteryPermission("lottery:draw");
    const admin: unknown = await getAuthenticatedAdmin();
    if (!isRecord(admin) || !uuid(admin.id)) {
      throw new DrawError("Your administrator identity could not be verified.", 401, "ADMIN_IDENTITY_UNAVAILABLE");
    }
    const adminEmail = typeof admin.email === "string" ? admin.email : null;
    const adminName = typeof admin.name === "string" ? admin.name : null;

    const { id } = await context.params;
    if (!uuid(id)) throw new DrawError("The lottery ID is invalid.", 400, "INVALID_LOTTERY_ID");
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      throw new DrawError("Send this request as JSON.", 415, "INVALID_CONTENT_TYPE");
    }
    // Bound the request body before parsing it.
    const reader = request.body?.getReader();
    if (!reader) throw new DrawError("Confirmation is required.", 400, "CONFIRMATION_REQUIRED");
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        length += part.value.byteLength;
        if (length > 4096) {
          await reader.cancel();
          throw new DrawError("The request body is too large.", 413, "REQUEST_TOO_LARGE");
        }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    let body: unknown;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new DrawError("The request contains invalid JSON.", 400, "INVALID_JSON");
    }
    if (!isRecord(body) || body.confirmed !== true || Object.keys(body).some((key) => key !== "confirmed")) {
      throw new DrawError("Confirm the draw before submitting it.", 400, "CONFIRMATION_REQUIRED");
    }

    db = lotteryAdminDb();
    const lotteryResult = await db.from("lotteries")
      .select("id,status,sales_close_at,draw_at,compliance_approved")
      .eq("id", id).maybeSingle();
    failQuery(lotteryResult.error, requestId, "Lottery lookup failed");
    const lottery = lotteryResult.data;
    if (!lottery) throw new DrawError("Lottery not found.", 404, "LOTTERY_NOT_FOUND");
    if (!["sales_closed", "draw_ready"].includes(lottery.status)) {
      throw new DrawError("Sales must be closed before drawing.", 409, "SALES_NOT_CLOSED");
    }
    for (const [label, value] of [["Sales closing", lottery.sales_close_at], ["Draw", lottery.draw_at]]) {
      const time = value ? Date.parse(value) : NaN;
      if (!Number.isFinite(time) || time > Date.now()) {
        throw new DrawError(`${label} time must be set and reached before drawing.`, 409, "DRAW_TIME_BLOCKED");
      }
    }
    if (lottery.compliance_approved !== true) {
      throw new DrawError("This lottery requires compliance approval before drawing.", 409, "COMPLIANCE_NOT_APPROVED");
    }

    const [draws, existingWinners, warnings, prizeResult] = await Promise.all([
      db.from("lottery_draws").select("id,status,completed_at").eq("lottery_id", id),
      db.from("lottery_winners").select("id", { count: "exact", head: true }).eq("lottery_id", id),
      db.from("lottery_integrity_warnings").select("id", { count: "exact", head: true }).eq("lottery_id", id).eq("resolved", false),
      db.from("lottery_prizes").select("id,name,quantity,status").eq("lottery_id", id)
        .in("status", ["confirmed", "available_for_draw"])
        .order("display_order", { ascending: true }).order("id", { ascending: true }),
    ]);
    for (const result of [draws, existingWinners, warnings, prizeResult]) {
      failQuery(result.error, requestId, "Draw prerequisite lookup failed");
    }
    if (existingWinners.count === null || warnings.count === null) {
      throw new DrawError("Draw prerequisite counts are unavailable.", 503, "DRAW_CHECK_UNAVAILABLE");
    }
    // A failed record is retained. Any other existing state requires review.
    if ((draws.data ?? []).some((draw) => draw.status !== "failed" || draw.completed_at) || existingWinners.count > 0) {
      throw new DrawError("An active/completed draw or existing winners require review. This route does not perform redraws.", 409, "EXISTING_DRAW_BLOCKED");
    }
    if (warnings.count > 0) {
      throw new DrawError("Resolve the integrity warnings before drawing.", 409, "INTEGRITY_WARNINGS");
    }
    const prizes: Prize[] = prizeResult.data ?? [];
    if (!prizes.length || prizes.length > 1000) {
      throw new DrawError("Between 1 and 1,000 available prizes are required.", 409, "INVALID_PRIZE_COUNT");
    }
    if (prizes.some((prize) => prize.quantity !== 1)) {
      throw new DrawError("This route supports one winner per prize record. Split prizes with multiple quantities into individual prize records first.", 409, "MULTIPLE_PRIZE_QUANTITY");
    }

    const actor = { p_admin_id: admin.id, p_admin_email: adminEmail, p_admin_name: adminName };
    const begun = await db.rpc("lottery_begin_draw", { p_lottery_id: id, ...actor });
    if (begun.error) {
      console.error(`[${requestId}] Begin draw failed`, begun.error);
      throw new DrawError("The database could not start the draw. Check the audit log and database configuration before retrying.", 409, "DRAW_START_FAILED");
    }
    const begunData: unknown = begun.data;
    const begunRow = Array.isArray(begunData) ? begunData[0] : null;
    if (!isRecord(begunRow) || !uuid(begunRow.draw_id)) {
      throw new DrawError("The draw start outcome is uncertain. Review the draw records before retrying.", 503, "DRAW_OUTCOME_UNCERTAIN");
    }
    drawId = begunRow.draw_id;
    const snapshot = await db.from("lottery_draws").select("eligible_ticket_count")
      .eq("id", drawId).single();
    if (snapshot.error) throw snapshot.error;
    const entries = await readEntries(db, drawId, snapshot.data.eligible_ticket_count);
    const snapshotHash = createHash("sha256").update(JSON.stringify(entries)).digest("hex");
    const selected = selectWinners(entries, prizes);
    const allocations: Allocation[] = selected.map(({ prize, entry }) => ({
      prize_id: prize.id, ticket_id: entry.ticket_id, order_id: entry.order_id,
    }));

    // Once completion has been submitted, never mark the draw failed on an
    // ambiguous transport result. Completion may already have committed.
    completionSubmitted = true;
    const completed = await db.rpc("lottery_complete_draw", {
      p_draw_id: drawId, p_snapshot_hash: snapshotHash,
      p_allocations: allocations, ...actor,
    });
    if (completed.error) {
      console.error(`[${requestId}] Complete draw failed`, completed.error);
      throw new DrawError("The completion outcome requires review. Do not submit another draw; inspect this draw and its audit log.", 503, "DRAW_OUTCOME_UNCERTAIN");
    }
    const completedData: unknown = completed.data;
    const completedRow = Array.isArray(completedData) ? completedData[0] : null;
    if (!isRecord(completedRow) || typeof completedRow.completed_at !== "string" || !Number.isFinite(Date.parse(completedRow.completed_at))) {
      throw new DrawError("The completion response could not be verified. Review the draw and winners before further action.", 503, "DRAW_OUTCOME_UNCERTAIN");
    }
    return json({
      ok: true, request_id: requestId,
      draw: { id: drawId, completed_at: completedRow.completed_at,
        eligible_ticket_count: entries.length, snapshot_hash: snapshotHash },
      winners: selected.map(({ prize, entry }) => ({
        prize_id: prize.id, prize_name: prize.name, ticket_id: entry.ticket_id,
        ticket_number: entry.ticket_number, winner_status: "contact_pending",
      })),
    });
  } catch (error) {
    if (db && drawId && !completionSubmitted) {
      try {
        const failed = await db.rpc("lottery_fail_draw", {
          p_draw_id: drawId, p_reason: `Preparation failed. Request reference: ${requestId}`,
        });
        if (failed.error) console.error(`[${requestId}] Failed-state update failed`, failed.error);
      } catch (failure) {
        console.error(`[${requestId}] Failed-state update unavailable`, failure);
      }
    }
    console.error(`[${requestId}] Draw request failed`, error);
    const helperStatus = isRecord(error) ? Number(error.status) : 500;
    const status = error instanceof DrawError ? error.status
      : Number.isInteger(helperStatus) && helperStatus >= 400 && helperStatus <= 599 ? helperStatus : 500;
    return json({ ok: false, request_id: requestId, draw_id: drawId,
      code: error instanceof DrawError ? error.code : "DRAW_REQUEST_FAILED",
      error: error instanceof DrawError ? error.message
        : status === 401 ? "Sign in before requesting a draw."
        : status === 403 ? "You do not have permission to request this draw."
        : "The draw request could not be completed. Review draw records before further action.",
    }, status);
  }
}
