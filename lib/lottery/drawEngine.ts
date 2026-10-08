import "server-only";
import { createHash, randomInt } from "node:crypto";
import { lotteryAdminDb, requireLotteryPermission, type LotteryAdmin } from "./adminAuth";

type DrawReadinessCheck = {
  key: string;
  label: string;
  ok: boolean;
  detail?: string | null;
};

type SnapshotTicket = {
  ticket_id: string;
  lottery_id: string;
  order_id: string;
  ticket_number: string;
};
type SnapshotPrize = {
  id: string;
  name: string;
  display_order: number | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const READ_TIMEOUT_MS = 10_000;
const MAX_POOL_SIZE = 100_000;

function failure(message: string, status: number, code: string) {
  return Object.assign(new Error(message), { status, code });
}

function validateLotteryId(id: string) {
  if (typeof id !== "string" || !UUID.test(id)) {
    throw failure("A valid lottery ID is required.", 400, "INVALID_LOTTERY_ID");
  }
}

function reached(value: unknown, now: number): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= now;
}

function exactCount(result: { count: number | null; error: unknown }): number {
  if (result.error || !Number.isSafeInteger(result.count) || (result.count ?? -1) < 0) {
    throw failure("The draw readiness checks could not be completed.", 503, "DRAW_READINESS_UNAVAILABLE");
  }
  return result.count as number;
}


export async function getDrawReadiness(lotteryId: string) {
  validateLotteryId(lotteryId);
  await requireLotteryPermission("lottery:view");
  return readReadiness(lotteryId);
}

async function readReadiness(lotteryId: string) {
  try {
    const db = lotteryAdminDb();
    const signal = AbortSignal.timeout(READ_TIMEOUT_MS);
    const { data: lottery, error: lotteryError } = await db
      .from("lotteries")
      .select("id,title,slug,internal_reference,status,sales_close_at,draw_at,compliance_approved_at")
      .eq("id", lotteryId)
      .maybeSingle();
    if (lotteryError) throw failure("The draw readiness checks could not be completed.", 503, "DRAW_READINESS_UNAVAILABLE");
    if (!lottery || lottery.id !== lotteryId) throw failure("Lottery not found.", 404, "LOTTERY_NOT_FOUND");

    const [paidResult, candidateResult, issuedResult, totalResult, prizeResult, warningResult, completedResult] = await Promise.all([
      db.from("lottery_orders").select("id", { count: "exact", head: true })
        .eq("lottery_id", lotteryId).eq("payment_status", "paid"),
      db.from("lottery_tickets")
        .select("id,lottery_orders!inner(id)", { count: "exact", head: true })
        .eq("lottery_id", lotteryId).eq("status", "issued")
        .eq("lottery_orders.lottery_id", lotteryId)
        .eq("lottery_orders.payment_status", "paid"),
      db.from("lottery_tickets").select("id", { count: "exact", head: true })
        .eq("lottery_id", lotteryId).eq("status", "issued"),
      db.from("lottery_tickets").select("id", { count: "exact", head: true })
        .eq("lottery_id", lotteryId),
      db.from("lottery_prizes").select("id", { count: "exact", head: true })
        .eq("lottery_id", lotteryId).eq("status", "available_for_draw"),
      db.from("lottery_integrity_warnings").select("id", { count: "exact", head: true })
        .eq("lottery_id", lotteryId).eq("resolved", false),
      db.from("lottery_draws").select("id", { count: "exact", head: true })
        .eq("lottery_id", lotteryId).eq("status", "completed"),
    ]);
    const paidOrders = exactCount(paidResult);
    const candidateTickets = exactCount(candidateResult);
    const issuedTickets = exactCount(issuedResult);
    const totalTickets = exactCount(totalResult);
    const prizes = exactCount(prizeResult);
    const warnings = exactCount(warningResult);
    const completed = exactCount(completedResult);
    if (candidateTickets > issuedTickets || issuedTickets > totalTickets) throw failure("The ticket counts are inconsistent.", 503, "DRAW_READINESS_UNAVAILABLE");

    const now = Date.now();
    const checks: DrawReadinessCheck[] = [
      { key: "sales_closed", label: "Sales are closed", ok: ["sales_closed", "draw_ready"].includes(lottery.status) && reached(lottery.sales_close_at, now), detail: "Both a closed lifecycle state and a valid elapsed sales closing time are required." },
      { key: "draw_due", label: "The configured draw time has arrived", ok: reached(lottery.draw_at, now) },
      { key: "not_cancelled", label: "Lottery is in an allowed draw state", ok: ["sales_closed", "draw_ready"].includes(lottery.status) },
      { key: "compliance", label: "A compliance approval timestamp is recorded", ok: reached(lottery.compliance_approved_at, now), detail: "Lifecycle status is not proof of approval. The approval record/profile still needs transaction-level verification." },
      { key: "integrity", label: "No unresolved integrity warnings", ok: warnings === 0, detail: `${warnings} unresolved warning(s).` },
      { key: "paid_orders", label: "Paid orders exist", ok: paidOrders > 0, detail: `${paidOrders} paid order(s).` },
      { key: "eligible_tickets", label: "Paid-order ticket candidates exist", ok: candidateTickets > 0 && candidateTickets <= MAX_POOL_SIZE, detail: `${candidateTickets} issued ticket(s) linked to paid orders in this lottery. Final eligibility is not yet verified.` },
      { key: "ticket_order_integrity", label: "All issued tickets have paid orders in this lottery", ok: candidateTickets === issuedTickets },
      { key: "prizes", label: "Prizes are available", ok: prizes > 0, detail: `${prizes} available prize(s).` },
      { key: "prize_ticket_capacity", label: "There are enough ticket candidates for every prize", ok: prizes <= candidateTickets },
      { key: "not_completed", label: "No completed draw exists", ok: completed === 0 },
      { key: "secure_transaction", label: "Secure draw transaction has been verified", ok: false, detail: "Drawing is unavailable until the database functions, recent MFA, eligible snapshot, concurrency locks and atomic audit are reviewed and tested." },
    ];
    return {
      lottery,
      metrics: {
        paid_orders: paidOrders,
        eligible_tickets: candidateTickets,
        excluded_tickets: totalTickets - candidateTickets,
        prizes_available: prizes,
        issued_tickets: issuedTickets,
      },
      eligibility_verified: false,
      execution_available: false,
      checks,
      ready: checks.every(check => check.ok),
    };
  } catch (error) {
    if (error instanceof Error && "code" in error &&
        ["DRAW_READINESS_UNAVAILABLE", "LOTTERY_NOT_FOUND"].includes(String(error.code))) throw error;
    throw failure("The draw readiness checks could not be completed.", 503, "DRAW_READINESS_UNAVAILABLE");
  }
}

export function selectSecureDrawAllocations(
  lotteryId: string,
  tickets: readonly SnapshotTicket[],
  prizes: readonly SnapshotPrize[],
) {
  validateLotteryId(lotteryId);
  const ids = new Set<string>();
  const numbers = new Set<string>();
  const prizeIds = new Set<string>();
  if (!tickets.length || tickets.length > MAX_POOL_SIZE || !prizes.length || prizes.length > tickets.length) {
    throw failure("The snapshot or prize list is invalid.", 409, "DRAW_POOL_INTEGRITY_FAILED");
  }
  for (const ticket of tickets) {
    if (!UUID.test(ticket.ticket_id) || !UUID.test(ticket.order_id) || ticket.lottery_id !== lotteryId ||
        typeof ticket.ticket_number !== "string" || !ticket.ticket_number.trim() || ticket.ticket_number !== ticket.ticket_number.trim() || ticket.ticket_number.length > 160 ||
        ids.has(ticket.ticket_id.toLowerCase()) || numbers.has(ticket.ticket_number)) {
      throw failure("The snapshot or prize list is invalid.", 409, "DRAW_POOL_INTEGRITY_FAILED");
    }
    ids.add(ticket.ticket_id.toLowerCase()); numbers.add(ticket.ticket_number);
  }
  for (const prize of prizes) {
    if (!UUID.test(prize.id) || typeof prize.name !== "string" || !prize.name.trim() ||
        (prize.display_order !== null && !Number.isSafeInteger(prize.display_order)) || prizeIds.has(prize.id.toLowerCase())) {
      throw failure("The snapshot or prize list is invalid.", 409, "DRAW_POOL_INTEGRITY_FAILED");
    }
    prizeIds.add(prize.id.toLowerCase());
  }
  const pool = tickets.map(t => ({ ...t, ticket_id: t.ticket_id.toLowerCase(), lottery_id: t.lottery_id.toLowerCase(), order_id: t.order_id.toLowerCase() }))
    .sort((a, b) => a.ticket_id < b.ticket_id ? -1 : a.ticket_id > b.ticket_id ? 1 : 0);
  const orderedPrizes = [...prizes].sort((a, b) => {
    if (a.display_order === null && b.display_order !== null) return 1;
    if (b.display_order === null && a.display_order !== null) return -1;
    const order = (a.display_order ?? 0) - (b.display_order ?? 0);
    return order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  });

  const snapshotHash = createHash("sha256")
    .update(JSON.stringify(pool.map(t => [t.ticket_id, t.lottery_id, t.order_id, t.ticket_number])))
    .digest("hex");
  const indexes = pool.map((_, index) => index);
  for (let i = indexes.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
  }
  const allocations = orderedPrizes.map((prize, index) => {
    const ticket = pool[indexes[index]];
    return { prize_id: prize.id, ticket_id: ticket.ticket_id, ticket_number: ticket.ticket_number, order_id: ticket.order_id };
  });
  return { snapshotHash, allocations };
}
export async function executeSecureDraw(lotteryId: string, admin: LotteryAdmin): Promise<{
  draw: { id: string; completed_at: string; eligible_ticket_count: number; snapshot_hash: string };
  winners: Array<{ prize_id: string; prize_name: string; ticket_id: string; ticket_number: string; winner_status: string }>;
}> {
  validateLotteryId(lotteryId);
  const verified = await requireLotteryPermission("lottery:draw");
  if (!admin || admin.id !== verified.id) {
    throw failure("You do not have permission to execute this draw.", 403, "DRAW_ACTOR_MISMATCH");
  }
  throw failure(
    "Drawing is unavailable until the secure database transaction and recent MFA controls have been verified.",
    503,
    "DRAW_TRANSACTION_UNVERIFIED",
  );
}
