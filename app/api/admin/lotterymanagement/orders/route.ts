import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Orders security remediation — production readiness review C2/C3/C7, I3/I5.
 * Main admins have full lottery access; other roles are deliberately denied
 * until a verified granular permission resolver is supplied. No cookie/email
 * fallback is used. GET must never reconcile payments or write audit rows.
 *
 * PATCH is deliberately unavailable. Re-enable it only after implementing and
 * testing database transactions for edits + lottery_audit_logs, and payment /
 * ticket finalisation + entries/events/audit/notification outbox. Those must
 * enforce locks, capacity, per-lottery number uniqueness, draw/refund/lifecycle
 * restrictions, reasons and idempotency. Stripe reconciliation and a signed
 * webhook must share that finaliser, checking metadata, amount, currency,
 * livemode and account. Require dedicated action permissions, recent verified
 * MFA, same-origin requests, stale-version checks and persistent rate limits.
 * Do not restore row-by-row writes, compensating deletes or direct emails.
 */

const PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;
const RELATED_PAGE_SIZE = 250;
const MAX_RELATED_ROWS = 20_000;

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Vary": "Cookie, Authorization",
    },
  });
}

async function requireOrderAdmin(signal: AbortSignal) {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: "Unauthorized." };

  const result = await supabaseAdmin.from("admin_users")
    .select("id,supabase_user_id,role,is_active,is_main_admin")
    .eq("supabase_user_id", user.id).eq("is_active", true)
    .abortSignal(signal).maybeSingle();
  if (result.error) throw new Error("Administrator lookup failed.");
  const admin = result.data;
  if (!admin || admin.supabase_user_id !== user.id || admin.is_active !== true ||
      (admin.role !== "main_admin" && admin.is_main_admin !== true)) {
    return { ok: false as const, status: 403, error: "An active main administrator account is required to access lottery orders." };
  }
  return { ok: true as const };
}

function positiveInteger(value: string | null, fallback: number, max: number) {
  if (value === null) return fallback;
  if (!/^[1-9]\d*$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number <= max ? number : null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

// Decimal pounds -> integer pence. Never silently turn invalid money into zero.
function pence(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) return null;
  const amount = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(amount) ? amount : null;
}

type Order = {
  id: string; lottery_id: string; order_reference: string;
  purchaser_name: string | null; purchaser_email: string | null;
  purchaser_phone: string | null; quantity: number;
  total_amount: string | number | null; currency: string;
  payment_status: string; payment_reference: string | null;
  eligibility_accepted: boolean; terms_version: string | null;
  privacy_notice_version: string | null; marketing_opt_in: boolean;
  created_at: string; updated_at: string | null; paid_at: string | null;
};
type Lottery = { id: string; title: string; slug: string };
type Ticket = { id: string; order_id: string; ticket_number: string; status: string; issued_at: string | null };
type Refund = { id: string; order_id: string; amount: string | number | null; currency: string; status: string; reason: string | null; requested_at: string | null; completed_at: string | null };
type Acceptance = { id: string; order_id: string; acceptance_type: string; version: string | null; accepted: boolean; accepted_at: string | null };
type Notification = { id: string; order_id: string; notification_type: string; status: string; sent_at: string | null; failed_at: string | null; created_at: string };
type Entry = { id: string; order_id: string };
type Winner = { id: string; entry_id: string | null; lottery_id: string };

/** Read every related row or fail; a PostgREST row cap must not falsify counts. */
async function readRelated<T>(table: string, columns: string, filter: string, ids: string[], signal: AbortSignal): Promise<T[]> {
  if (!ids.length) return [];
  const rows: T[] = [];
  let total: number | null = null;
  while (total === null || rows.length < total) {
    const result = await supabaseAdmin.from(table).select(columns, { count: "exact" })
      .in(filter, ids).order("id", { ascending: true })
      .range(rows.length, rows.length + RELATED_PAGE_SIZE - 1).abortSignal(signal);
    if (result.error || result.count === null || !result.data ||
        !Number.isSafeInteger(result.count) || result.count < 0 || result.count > MAX_RELATED_ROWS ||
        (total !== null && total !== result.count)) {
      throw new Error("Related order history is unavailable or changed during loading.");
    }
    total = result.count;
    const page = result.data as unknown as T[];
    if (!page.length && rows.length < total) throw new Error("Order history was truncated.");
    rows.push(...page);
    if (rows.length > total) throw new Error("Order history changed during loading.");
  }
  return rows;
}

function groupByOrder<T extends { order_id: string }>(rows: T[]) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.order_id) ?? [];
    list.push(row);
    map.set(row.order_id, list);
  }
  return map;
}

export async function GET(request: NextRequest) {
  const requestId = randomUUID();
  try {
    const signal = AbortSignal.timeout(15_000);
    const auth = await requireOrderAdmin(signal);
    if (!auth.ok) return jsonResponse({ ok: false, error: auth.error, request_id: requestId }, auth.status);

    const params = request.nextUrl.searchParams;
    const page = positiveInteger(params.get("page"), 1, 10_000);
    const pageSize = positiveInteger(params.get("pageSize") ?? params.get("limit"), PAGE_SIZE, MAX_PAGE_SIZE);
    const lotteryId = params.get("lottery_id");
    const orderId = params.get("order_id");
    if (page === null || pageSize === null || (lotteryId !== null && !isUuid(lotteryId)) ||
        (orderId !== null && !isUuid(orderId))) {
      return jsonResponse({ ok: false, error: "Invalid pagination or order/lottery ID.", request_id: requestId }, 400);
    }
    let query = supabaseAdmin.from("lottery_orders").select(
      "id,lottery_id,order_reference,purchaser_name,purchaser_email,purchaser_phone,quantity,total_amount,currency,payment_status,payment_reference,eligibility_accepted,terms_version,privacy_notice_version,marketing_opt_in,created_at,updated_at,paid_at",
      { count: "exact" },
    );
    if (lotteryId !== null) query = query.eq("lottery_id", lotteryId);
    if (orderId !== null) query = query.eq("id", orderId);
    const result = await query.order("created_at", { ascending: false })
      .order("id", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1).abortSignal(signal);
    if (result.error || result.count === null || !result.data || !Number.isSafeInteger(result.count) || result.count < 0) {
      throw new Error("Order listing unavailable.");
    }
    const orders = result.data as unknown as Order[];
    const expected = Math.min(pageSize, Math.max(0, result.count - (page - 1) * pageSize));
    if (orders.length !== expected) throw new Error("Order listing was truncated or changed.");
    const orderIds = orders.map(order => order.id);
    const lotteryIds = [...new Set(orders.map(order => order.lottery_id))];
    const [lotteries, tickets, refunds, acceptances, notifications, entries] = await Promise.all([
      readRelated<Lottery>("lotteries", "id,title,slug", "id", lotteryIds, signal),
      readRelated<Ticket>("lottery_tickets", "id,order_id,ticket_number,status,issued_at", "order_id", orderIds, signal),
      readRelated<Refund>("lottery_refunds", "id,order_id,amount,currency,status,reason,requested_at,completed_at", "order_id", orderIds, signal),
      readRelated<Acceptance>("lottery_acceptances", "id,order_id,acceptance_type,version,accepted,accepted_at", "order_id", orderIds, signal),
      readRelated<Notification>("lottery_notifications", "id,order_id,notification_type,status,sent_at,failed_at,created_at", "order_id", orderIds, signal),
      readRelated<Entry>("lottery_entries", "id,order_id", "order_id", orderIds, signal),
    ]);
    const winners = await readRelated<Winner>("lottery_winners", "id,entry_id,lottery_id", "entry_id", entries.map(entry => entry.id), signal);
    const lotteryMap = new Map(lotteries.map(lottery => [lottery.id, lottery]));
    const ticketMap = groupByOrder(tickets);
    const refundMap = groupByOrder(refunds);
    const acceptanceMap = groupByOrder(acceptances);
    const notificationMap = groupByOrder(notifications);
    const entryMap = new Map(entries.map(entry => [entry.id, entry.order_id]));
    const orderMap = new Map(orders.map(order => [order.id, order]));
    const winnerCounts = new Map<string, number>();
    for (const winner of winners) {
      const id = winner.entry_id ? entryMap.get(winner.entry_id) : undefined;
      if (!id || orderMap.get(id)?.lottery_id !== winner.lottery_id) throw new Error("Winner linkage is invalid.");
      winnerCounts.set(id, (winnerCounts.get(id) ?? 0) + 1);
    }
    const items = orders.map(order => {
      const lottery = lotteryMap.get(order.lottery_id);
      if (!lottery) throw new Error("Order lottery linkage is unavailable.");
      const orderTickets = ticketMap.get(order.id) ?? [];
      const orderRefunds = refundMap.get(order.id) ?? [];
      let refundPence: number | null = 0;
      for (const refund of orderRefunds.filter(row => row.status === "completed")) {
        const amount = pence(refund.amount);
        if (amount === null || refund.currency.toUpperCase() !== order.currency.toUpperCase() ||
            refundPence === null || !Number.isSafeInteger(refundPence + amount)) {
          refundPence = null;
        } else refundPence += amount;
      }
      const totalPence = pence(order.total_amount);
      return {
        ...order,
        total_amount: totalPence === null ? null : totalPence / 100,
        is_paid: order.payment_status === "paid",
        lottery_title: lottery.title, lottery_slug: lottery.slug,
        ticket_count: orderTickets.length,
        // Display status count only — this does not establish draw eligibility.
        active_ticket_count: orderTickets.filter(ticket => ["issued", "winner"].includes(ticket.status)).length,
        winner_count: winnerCounts.get(order.id) ?? 0,
        refunded_amount: refundPence === null ? null : refundPence / 100,
        tickets: [...orderTickets].sort((a, b) => (a.issued_at ?? "").localeCompare(b.issued_at ?? ""))
          .map(({ id, ticket_number, status, issued_at }) => ({ id, ticket_number, status, issued_at })),
        acceptances: (acceptanceMap.get(order.id) ?? []).map(item => ({
          id: item.id, label: item.acceptance_type, status: item.accepted ? "Accepted" : "Not accepted",
          detail: item.version ? `Version ${item.version}` : null, created_at: item.accepted_at,
        })),
        refunds: orderRefunds.map(item => ({
          id: item.id, label: `${item.currency} refund`, status: item.status,
          amount: pence(item.amount) === null ? null : pence(item.amount)! / 100,
          detail: item.reason, created_at: item.completed_at ?? item.requested_at,
        })),
        notifications: (notificationMap.get(order.id) ?? []).map(item => ({
          id: item.id, label: item.notification_type, status: item.status, detail: null,
          created_at: item.sent_at ?? item.failed_at ?? item.created_at,
        })),
      };
    });
    return jsonResponse({
      ok: true, items, page, pageSize, total: result.count,
      total_pages: Math.ceil(result.count / pageSize), has_more: page * pageSize < result.count,
      mutations_available: false,
    });
  } catch (error) {
    console.error(`[${requestId}] Lottery orders read failed:`, error);
    return jsonResponse({ ok: false, error: "Unable to load complete lottery order history. Refresh and try again.", request_id: requestId }, 503);
  }
}

export async function PATCH(request: NextRequest) {
  const requestId = randomUUID();
  try {
    const auth = await requireOrderAdmin(AbortSignal.timeout(10_000));
    if (!auth.ok) return jsonResponse({ ok: false, error: auth.error, request_id: requestId }, auth.status);
    const origin = request.headers.get("origin");
    const fetchSite = request.headers.get("sec-fetch-site");
    if (!origin || origin !== request.nextUrl.origin || (fetchSite && fetchSite !== "same-origin")) {
      return jsonResponse({ ok: false, error: "A same-origin request is required.", request_id: requestId }, 403);
    }
    return jsonResponse({
      ok: false, code: "ORDER_TRANSACTION_SERVICE_UNAVAILABLE",
      error: "Order edits, manual payment confirmation and missing-ticket issuance are unavailable until the audited database transaction service is configured.",
      request_id: requestId,
    }, 503);
  } catch (error) {
    console.error(`[${requestId}] Lottery order action rejected:`, error);
    return jsonResponse({ ok: false, error: "The order action is unavailable.", request_id: requestId }, 503);
  }
}
