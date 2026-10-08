import "server-only";
import { randomInt } from "node:crypto";

export type LotteryTicket = {
  id: string;
  ticket_number: string;
  status: string;
  issued_at: string | null;
};

export type PaidLotteryOrder = {
  id: string;
  lottery_id: string;
  quantity: number;
  payment_status: string;
};

export type TicketLottery = {
  id: string;
  max_tickets: number | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Resource limit for this in-memory planner, not a compliance or purchase cap.
const MAX_PLANNING_CAPACITY = 100_000;

function failure(message: string, status: number, code: string) {
  return Object.assign(new Error(message), { status, code });
}

function validateCapacity(capacity: number | null): asserts capacity is number {
  if (typeof capacity !== "number" || !Number.isSafeInteger(capacity) || capacity < 1) {
    throw failure("The lottery capacity is invalid.", 409, "INVALID_LOTTERY_CAPACITY");
  }
}

/** Pure random planning utility; never issues or reserves tickets.
 * The caller must supply a complete, canonical used-number snapshot under a
 * database lock. This helper cannot establish that the snapshot is complete.
 * Formatting/prefixes belong to the reviewed lottery configuration and must
 * be applied consistently by the transaction that persists these numbers.
 */
export function planRandomTicketNumbers(
  usedNumbers: readonly number[],
  quantity: number,
  capacity: number,
): number[] {
  validateCapacity(capacity);
  if (capacity > MAX_PLANNING_CAPACITY || !Array.isArray(usedNumbers) || usedNumbers.length > capacity) {
    throw failure("The ticket-number snapshot exceeds the planner limit.", 409, "INVALID_TICKET_NUMBER_SNAPSHOT");
  }
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > capacity) {
    throw failure("A valid ticket quantity is required.", 400, "INVALID_TICKET_QUANTITY");
  }
  const used = new Set<number>();
  for (const number of usedNumbers) {
    // Do not silently ignore malformed, duplicate or out-of-range numbers.
    if (!Number.isSafeInteger(number) || number < 1 || number > capacity || used.has(number)) {
      throw failure("The ticket-number snapshot is invalid.", 409, "INVALID_TICKET_NUMBER_SNAPSHOT");
    }
    used.add(number);
  }
  const availableCount = capacity - used.size;
  if (quantity > availableCount) {
    throw failure("There are not enough ticket numbers available.", 409, "INSUFFICIENT_TICKET_CAPACITY");
  }

  const available: number[] = [];
  for (let number = 1; number <= capacity; number++) {
    if (!used.has(number)) available.push(number);
  }
  // Partial Fisher-Yates: each remaining number is equally likely at each pick.
  // A request gets distinct numbers without collision retry loops.
  for (let index = 0; index < quantity; index++) {
    const selected = randomInt(index, available.length);
    [available[index], available[selected]] = [available[selected], available[index]];
  }
  return available.slice(0, quantity);
}

/** Existing API retained for checkout/webhook/admin callers.
 *
 * No database writes occur until the replacement transaction is reviewed.
 * The supplied order/lottery objects are input hints, not payment authority.
 * There is no read-only "already issued" success fallback: ticket counts alone
 * cannot prove valid fulfillment, and a truncated result could hide shortages.
 *
 * Required integration: validate signed provider event/session IDs, amount and
 * currency; lock order, lottery and reserved capacity; re-read paid/non-refunded
 * order state; allocate exactly the requested quantity or none; atomically write
 * tickets, entries, ticket events, audit and notification outbox; enforce unique
 * provider event IDs and (lottery_id, ticket_number); return the same valid set
 * on replay. Webhook and reconciliation must use that same transaction.
 *
 * A database timeout has an uncertain commit outcome. Retry only with the same
 * idempotency identity; never compensate by blindly deleting/reissuing tickets.
 */
export async function issueTicketsForPaidOrder(
  order: PaidLotteryOrder,
  lottery: TicketLottery,
): Promise<LotteryTicket[]> {
  if (
    !order || !lottery || typeof order.id !== "string" || !UUID.test(order.id) ||
    typeof order.lottery_id !== "string" || !UUID.test(order.lottery_id) ||
    typeof lottery.id !== "string" || !UUID.test(lottery.id)
  ) throw failure("Valid order and lottery IDs are required.", 400, "INVALID_TICKET_ISSUANCE_INPUT");

  if (order.lottery_id.toLowerCase() !== lottery.id.toLowerCase()) {
    throw failure("The order does not belong to this lottery.", 409, "ORDER_LOTTERY_MISMATCH");
  }
  validateCapacity(lottery.max_tickets);
  if (!Number.isSafeInteger(order.quantity) || order.quantity < 1 || order.quantity > lottery.max_tickets) {
    throw failure("A valid ticket quantity is required.", 400, "INVALID_TICKET_QUANTITY");
  }
  if (order.payment_status !== "paid") {
    throw failure("Confirmed payment is required before issuing tickets.", 409, "PAYMENT_NOT_CONFIRMED");
  }

  // Even a caller-supplied "paid" value cannot enable issuance.
  throw failure(
    "Ticket issuance is unavailable until the atomic payment and ticket transaction has been verified.",
    503,
    "TICKET_ISSUANCE_TRANSACTION_UNVERIFIED",
  );
}
