import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import {
  getAuthenticatedAdmin,
  getAuditServiceClient,
  hasLotteryPermission,
} from "@/lib/lottery/audit-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 25;
const BATCH_SIZE = 250;
const MAX_RELATED_ROWS = 20_000;
const REPORT_CURRENCY = "GBP";

type Lottery = {
  id: string; title: string; slug: string; status: string; lottery_type: string;
  created_at: string; sales_open_at: string | null; sales_close_at: string | null;
  draw_at: string | null;
};
type Order = { id: string; lottery_id: string; total_amount: string | number | null; currency: string | null; payment_status: string };
type Ticket = { id: string; lottery_id: string; status: string };
type Refund = { id: string; lottery_id: string; amount: string | number | null; currency: string | null; status: string };
type Winner = { id: string; lottery_id: string; status: string };
type Warning = { id: string; lottery_id: string };
type Prize = { id: string; lottery_id: string; declared_value: string | number | null; quantity: number; is_donated: boolean; status: string };

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Vary": "Cookie, Authorization",
    },
  });
}

function integer(value: string | null, fallback: number, max: number) {
  if (value === null) return fallback;
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= max ? parsed : null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function pennies(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) return null;
  const amount = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(amount) ? amount : null;
}

function sumAmounts<T>(rows: T[], value: (row: T) => unknown, currency: (row: T) => unknown) {
  let total = 0;
  for (const row of rows) {
    const amount = pennies(value(row));
    const denomination = currency(row);
    if (amount === null || typeof denomination !== "string" ||
        denomination.toUpperCase() !== REPORT_CURRENCY || !Number.isSafeInteger(total + amount)) return null;
    total += amount;
  }
  return total / 100;
}

function declaredPrizeValue(prizes: Prize[]) {
  let total = 0;
  for (const prize of prizes) {
    const value = pennies(prize.declared_value);
    if (value === null || !Number.isSafeInteger(prize.quantity) || prize.quantity < 1 ||
        !Number.isSafeInteger(total + value)) return null;
    total += value;
  }
  return total / 100;
}

async function authorize(signal: AbortSignal) {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: "Unauthorized." };
  const db = getAuditServiceClient();
  const lookup = await db.from("admin_users")
    .select("id,supabase_user_id,role,is_active,is_main_admin")
    .eq("supabase_user_id", user.id).eq("is_active", true).abortSignal(signal).maybeSingle();
  if (lookup.error) throw new Error("Administrator lookup unavailable.");
  const verified = lookup.data;
  if (!verified || verified.supabase_user_id !== user.id || verified.is_active !== true ||
      (verified.role !== "main_admin" && verified.is_main_admin !== true)) {
    return { ok: false as const, status: 403, error: "An active main administrator account is required." };
  }
  const admin = await getAuthenticatedAdmin();
  if (!admin || admin.id !== verified.id || !hasLotteryPermission(admin, "lottery:finance:view")) {
    return { ok: false as const, status: 403, error: "You do not have permission to view lottery reports." };
  }
  return { ok: true as const, db };
}

type Db = ReturnType<typeof getAuditServiceClient>;
async function readRows<T>(db: Db, table: string, columns: string, lotteryIds: string[], signal: AbortSignal): Promise<T[]> {
  if (!lotteryIds.length) return [];
  const rows: T[] = [];
  let count: number | null = null;
  while (count === null || rows.length < count) {
    const result = await db.from(table).select(columns, { count: "exact" })
      .in("lottery_id", lotteryIds).order("id", { ascending: true })
      .range(rows.length, rows.length + BATCH_SIZE - 1).abortSignal(signal);
    if (result.error || !result.data || result.count === null ||
        !Number.isSafeInteger(result.count) || result.count < 0 || result.count > MAX_RELATED_ROWS ||
        (count !== null && result.count !== count)) {
      throw new Error("Report relation unavailable, too large or changed while loading.");
    }
    count = result.count;
    if (!result.data.length && rows.length < count) throw new Error("Report relation was truncated.");
    rows.push(...result.data as unknown as T[]);
    if (rows.length > count) throw new Error("Report relation changed while loading.");
  }
  return rows;
}

function group<T extends { lottery_id: string }>(rows: T[]) {
  const result = new Map<string, T[]>();
  for (const row of rows) {
    const list = result.get(row.lottery_id) ?? [];
    list.push(row);
    result.set(row.lottery_id, list);
  }
  return result;
}

export async function GET(request: NextRequest) {
  const requestId = randomUUID();
  try {
    const signal = AbortSignal.timeout(20_000);
    const auth = await authorize(signal);
    if (!auth.ok) return response({ ok: false, error: auth.error, request_id: requestId }, auth.status);
    const { db } = auth;
    const params = request.nextUrl.searchParams;
    const page = integer(params.get("page"), 1, 10_000);
    const pageSize = integer(params.get("pageSize") ?? params.get("limit"), PAGE_SIZE, MAX_PAGE_SIZE);
    const lotteryId = params.get("lottery_id");
    if (page === null || pageSize === null || (lotteryId !== null && !isUuid(lotteryId))) {
      return response({ ok: false, error: "Invalid pagination or lottery ID.", request_id: requestId }, 400);
    }
    let query = db.from("lotteries").select(
      "id,title,slug,status,lottery_type,created_at,sales_open_at,sales_close_at,draw_at",
      { count: "exact" },
    );
    if (lotteryId !== null) query = query.eq("id", lotteryId);
    const result = await query.order("created_at", { ascending: false })
      .order("id", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1).abortSignal(signal);
    if (result.error || !result.data || result.count === null ||
        !Number.isSafeInteger(result.count) || result.count < 0 ||
        result.data.length !== Math.min(pageSize, Math.max(0, result.count - (page - 1) * pageSize))) {
      throw new Error("Lottery report page unavailable or truncated.");
    }
    const lotteries = result.data as unknown as Lottery[];
    const ids = lotteries.map(lottery => lottery.id);
    const [orders, tickets, refunds, prizes, winners, warnings] = await Promise.all([
      readRows<Order>(db, "lottery_orders", "id,lottery_id,total_amount,currency,payment_status", ids, signal),
      readRows<Ticket>(db, "lottery_tickets", "id,lottery_id,status", ids, signal),
      readRows<Refund>(db, "lottery_refunds", "id,lottery_id,amount,currency,status", ids, signal),
      readRows<Prize>(db, "lottery_prizes", "id,lottery_id,declared_value,quantity,is_donated,status", ids, signal),
      readRows<Winner>(db, "lottery_winners", "id,lottery_id,status", ids, signal),
      readRows<Warning>(db, "lottery_integrity_warnings", "id,lottery_id", ids, signal),
    ]);
    const orderMap = group(orders), ticketMap = group(tickets), refundMap = group(refunds);
    const prizeMap = group(prizes), winnerMap = group(winners), warningMap = group(warnings);
    const items = lotteries.map(lottery => {
      const orderRows = orderMap.get(lottery.id) ?? [];
      const paidOrders = orderRows.filter(order => order.payment_status === "paid");
      const completedRefunds = (refundMap.get(lottery.id) ?? []).filter(refund => refund.status === "completed");
      const prizeRows = prizeMap.get(lottery.id) ?? [];
      const winnerRows = winnerMap.get(lottery.id) ?? [];
      const currentPaidTotal = sumAmounts(paidOrders, order => order.total_amount, order => order.currency);
      return {
        lottery_id: lottery.id, lottery_title: lottery.title || "Untitled lottery",
        lottery_slug: lottery.slug, lottery_status: lottery.status, lottery_type: lottery.lottery_type,
        created_at: lottery.created_at, sales_open_at: lottery.sales_open_at,
        sales_close_at: lottery.sales_close_at, draw_at: lottery.draw_at,
        currency: REPORT_CURRENCY,
        gross_proceeds: null, tickets_sold: null, average_order_value: null,
        refunds: null, payment_fees: null, net_funds: null, prize_costs: null,
        good_cause_amount: null, unclaimed_prizes: null, compliance_warnings: null,
        paid_orders: paidOrders.length,
        winners: winnerRows.length,
        failed_payments: orderRows.filter(order => order.payment_status === "failed").length,
        disputed_payments: orderRows.filter(order => order.payment_status === "disputed").length,
        current_paid_order_total: currentPaidTotal,
        recorded_completed_refund_total: sumAmounts(completedRefunds, refund => refund.amount, refund => refund.currency),
        issued_ticket_records: (ticketMap.get(lottery.id) ?? []).filter(ticket => ["issued", "winner"].includes(ticket.status)).length,
        prize_records: prizeRows.length,
        recorded_purchased_prize_declared_value_sum: prizeRows.some(prize => typeof prize.is_donated !== "boolean")
          ? null : declaredPrizeValue(prizeRows.filter(prize => prize.is_donated === false)),
        unclaimed_winner_records: winnerRows.filter(winner => winner.status === "unclaimed").length,
        integrity_warning_records: (warningMap.get(lottery.id) ?? []).length,
        winner_count_basis: "all_winner_records_including_replaced_or_disqualified",
        financials_verified: false,
        report_basis: "current_database_records_not_reconciled_ledger",
      };
    });
    return response({
      ok: true, items, page, pageSize, total: result.count,
      total_pages: Math.ceil(result.count / pageSize), has_more: page * pageSize < result.count,
      generated_at: new Date().toISOString(), snapshot_consistent: false,
      limitations: [
        "Financial totals require a reconciled payment and expenditure ledger.",
        "Record counts do not establish sold or draw-eligible tickets, unclaimed prize quantities or unresolved warnings.",
        "Separate read queries do not provide a single database snapshot; exports must fetch all pages and preserve unavailable values.",
        "The declared-value sum adds recorded row values without treating them as costs or multiplying by quantity; the currency requires schema confirmation.",
      ],
    });
  } catch (error) {
    console.error(`[${requestId}] Lottery reports read failed:`, error);
    return response({ ok: false, error: "Unable to load complete lottery report data. Refresh and try again.", request_id: requestId }, 503);
  }
}
