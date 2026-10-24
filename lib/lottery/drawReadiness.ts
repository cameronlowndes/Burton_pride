import "server-only";
import type { lotteryAdminDb } from "@/lib/lottery/adminAuth";

type Db = ReturnType<typeof lotteryAdminDb>;
export type DrawCheck = { key: string; label: string; ok: boolean; detail: string; code: string };
export type DrawLottery = {
  id: string; title: string; slug: string; internal_reference: string | null;
  status: string; draw_at: string | null; sales_close_at: string | null;
  compliance_approved: boolean | null;
};
type DrawRecord = { id: string; status: string | null; completed_at: string | null };

export class DrawReadinessError extends Error {
  constructor(readonly check: string, readonly databaseError: unknown) {
    super("A required draw check could not be completed.");
    this.name = "DrawReadinessError";
  }
}

function exactCount(result: { count: number | null; error: unknown }, label: string): number {
  if (result.error || !Number.isSafeInteger(result.count) || (result.count ?? -1) < 0) {
    throw new DrawReadinessError(label, result.error ?? "Exact count unavailable");
  }
  return result.count as number;
}

function timestamp(value: string | null): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

// Matches the verified lottery_begin_draw ticket snapshot predicate. This
// read-only summary is advisory; the RPC rechecks under database row locks.
export async function loadDrawReadiness(db: Db, lotteryId: string) {
  const lotteryResult = await db.from("lotteries")
    .select("id,title,slug,internal_reference,status,draw_at,sales_close_at,compliance_approved")
    .eq("id", lotteryId).maybeSingle();
  if (lotteryResult.error) throw new DrawReadinessError("lottery", lotteryResult.error);
  if (!lotteryResult.data) return null;
  const lottery = lotteryResult.data as DrawLottery;

  const [paid, eligible, allTickets, prizes, invalidQuantities, warnings, blocking, latest, winners] = await Promise.all([
    db.from("lottery_orders").select("id", { count: "exact", head: true })
      .eq("lottery_id", lotteryId).eq("payment_status", "paid").is("refunded_at", null),
    db.from("lottery_tickets")
      .select("id,lottery_orders!lottery_tickets_order_id_fkey!inner(id)", { count: "exact", head: true })
      .eq("lottery_id", lotteryId).eq("status", "issued").is("refunded_at", null)
      .eq("lottery_orders.lottery_id", lotteryId).eq("lottery_orders.payment_status", "paid")
      .is("lottery_orders.refunded_at", null),
    db.from("lottery_tickets").select("id", { count: "exact", head: true }).eq("lottery_id", lotteryId),
    db.from("lottery_prizes").select("id", { count: "exact", head: true })
      .eq("lottery_id", lotteryId).in("status", ["confirmed", "available_for_draw"]),
    db.from("lottery_prizes").select("id", { count: "exact", head: true })
      .eq("lottery_id", lotteryId).in("status", ["confirmed", "available_for_draw"])
      .or("quantity.neq.1,quantity.is.null"),
    db.from("lottery_integrity_warnings").select("id", { count: "exact", head: true })
      .eq("lottery_id", lotteryId).eq("resolved", false),
    // Inspect every prior draw, not just the newest one. Unknown states block.
    db.from("lottery_draws").select("id,status,completed_at", { count: "exact" })
      .eq("lottery_id", lotteryId)
      .or("status.neq.failed,status.is.null,completed_at.not.is.null")
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1),
    db.from("lottery_draws").select("id,status,completed_at")
      .eq("lottery_id", lotteryId).order("created_at", { ascending: false })
      .order("id", { ascending: false }).limit(1),
    db.from("lottery_winners").select("id", { count: "exact", head: true }).eq("lottery_id", lotteryId),
  ]);

  const paidCount = exactCount(paid, "paid orders");
  const eligibleCount = exactCount(eligible, "eligible tickets");
  const totalCount = exactCount(allTickets, "all tickets");
  const prizeCount = exactCount(prizes, "available prizes");
  const invalidQuantityCount = exactCount(invalidQuantities, "prize quantities");
  const warningCount = exactCount(warnings, "unresolved warnings");
  const blockingCount = exactCount(blocking, "previous draws");
  const winnerCount = exactCount(winners, "existing winners");
  if (latest.error) throw new DrawReadinessError("latest draw", latest.error);
  if (eligibleCount > totalCount) throw new DrawReadinessError("ticket counts", "Counts changed during checks; refresh");

  const latestDraw = (latest.data?.[0] ?? null) as DrawRecord | null;
  const blockingDraw = (blocking.data?.[0] ?? null) as DrawRecord | null;
  if (blockingCount > 0 && !blockingDraw) throw new DrawReadinessError("previous draws", "Draw state unavailable");
  const now = Date.now();
  const salesTime = timestamp(lottery.sales_close_at);
  const drawTime = timestamp(lottery.draw_at);
  const previousFailedDrawSafe = Boolean(latestDraw && latestDraw.status === "failed" &&
    !latestDraw.completed_at && blockingCount === 0 && winnerCount === 0);

  const checks: DrawCheck[] = [
    { key: "lottery_state", label: "Lottery status allows a draw", code: "SALES_NOT_CLOSED",
      ok: ["sales_closed", "draw_ready"].includes(lottery.status),
      detail: `Lottery status: ${lottery.status}. It must be sales_closed or draw_ready.` },
    { key: "sales_closed", label: "Sales closing time reached", code: "DRAW_TIME_BLOCKED",
      ok: salesTime !== null && salesTime <= now, detail: "A valid sales closing date must be set and reached." },
    { key: "draw_time", label: "Draw time reached", code: "DRAW_TIME_BLOCKED",
      ok: drawTime !== null && drawTime <= now, detail: "A valid draw date must be set and reached." },
    { key: "compliance", label: "Compliance approved", code: "COMPLIANCE_NOT_APPROVED",
      ok: lottery.compliance_approved === true, detail: "Compliance approval is required before drawing." },
    { key: "paid_orders", label: "Paid orders available", code: "NO_PAID_ORDERS",
      ok: paidCount > 0, detail: `${paidCount} paid, non-refunded order(s).` },
    { key: "eligible_tickets", label: "Eligible paid tickets available", code: "NO_ELIGIBLE_TICKETS",
      ok: eligibleCount > 0, detail: `${eligibleCount} issued, non-refunded ticket(s) on paid, non-refunded orders.` },
    { key: "snapshot_limit", label: "Ticket pool within supported limit", code: "INVALID_SNAPSHOT_COUNT",
      ok: eligibleCount <= 100_000, detail: "This draw route supports at most 100,000 eligible tickets." },
    { key: "prizes_available", label: "Available prizes", code: "INVALID_PRIZE_COUNT",
      ok: prizeCount >= 1 && prizeCount <= 1000, detail: `${prizeCount} confirmed or available prize record(s); 1–1,000 required.` },
    { key: "prize_quantities", label: "One winner per prize record", code: "MULTIPLE_PRIZE_QUANTITY",
      ok: invalidQuantityCount === 0, detail: "Each available prize record must have quantity 1." },
    { key: "tickets_for_prizes", label: "Enough tickets for all prizes", code: "INSUFFICIENT_TICKETS",
      ok: eligibleCount >= prizeCount, detail: "Each prize needs a different eligible ticket." },
    { key: "integrity_warnings", label: "No unresolved integrity warnings", code: "INTEGRITY_WARNINGS",
      ok: warningCount === 0, detail: `${warningCount} unresolved integrity warning(s).` },
    { key: "no_existing_draw", label: "No active or completed draw", code: "EXISTING_DRAW_BLOCKED",
      ok: blockingCount === 0, detail: blockingCount > 0 ? "A prior draw requires review."
        : previousFailedDrawSafe ? "Only failed, uncompleted attempts exist and no winners were found." : "No blocking prior draw was found." },
    { key: "no_existing_winners", label: "No existing winners", code: "EXISTING_DRAW_BLOCKED",
      ok: winnerCount === 0, detail: `${winnerCount} existing winner record(s).` },
  ];

  const blockReasons = checks.filter((check) => !check.ok).map((check) => ({
    code: check.code, message: check.detail,
  }));
  const completed = Boolean((blockingDraw && (blockingDraw.status === "completed" || blockingDraw.completed_at)) ||
    (latestDraw && (latestDraw.status === "completed" || latestDraw.completed_at)));
  const running = blockingDraw?.status === "running";
  const onlyDates = blockReasons.length > 0 && blockReasons.every((reason) => reason.code === "DRAW_TIME_BLOCKED");
  const drawStatus = completed ? "completed" : running ? "running"
    : lottery.status === "under_review" || warningCount > 0 ? "under_review"
    : blockReasons.length === 0 ? "ready" : onlyDates ? "upcoming" : "blocked";

  return {
    lottery, checks, ready: checks.every((check) => check.ok),
    metrics: { paid_orders: paidCount, eligible_tickets: eligibleCount,
      excluded_tickets: totalCount - eligibleCount, prizes_available: prizeCount },
    draw_status: drawStatus, latest_draw_id: latestDraw?.id ?? null,
    latest_draw_status: latestDraw?.status ?? null,
    previous_failed_draw_safe: previousFailedDrawSafe,
    previous_failed_draw_id: previousFailedDrawSafe ? latestDraw!.id : null,
    unresolved_warnings: warningCount, block_reasons: blockReasons,
  };
}
