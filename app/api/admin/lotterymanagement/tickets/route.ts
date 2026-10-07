import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedAdmin, getAuditServiceClient, hasLotteryPermission } from "@/lib/lottery/audit-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";


const READ_STATUSES = new Set(["reserved", "issued", "void", "refunded", "winner"]);
const PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;
const RELATED_PAGE_SIZE = 250;
const MAX_RELATED_ROWS = 20_000;

type Ticket = {
  id: string; lottery_id: string; order_id: string | null; ticket_number: string;
  status: string; issued_at: string | null; void_reason: string | null;
  voided_at: string | null; refunded_at: string | null; winner_at: string | null;
  status_reason: string | null; created_at: string; updated_at: string | null;
};
type Lottery = { id: string; title: string; slug: string };
type Order = {
  id: string; lottery_id: string; payment_status: string;
  order_reference?: string | null; purchaser_name?: string | null; purchaser_email?: string | null;
};
type TicketEvent = {
  id: string; ticket_id: string; event_type: string; previous_status: string | null;
  new_status: string | null; reason: string | null; created_at: string;
};

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: {
    "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
    "X-Content-Type-Options": "nosniff", "Vary": "Cookie, Authorization",
  } });
}
function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function integer(value: string | null, fallback: number, max: number) {
  if (value === null) return fallback;
  if (!/^[1-9]\d*$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n <= max ? n : null;
}
function boundedRead<T>(operation: PromiseLike<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error("Ticket read timed out."));
    if (signal.aborted) { abort(); return; }
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(operation).then(
      value => { signal.removeEventListener("abort", abort); resolve(value); },
      error => { signal.removeEventListener("abort", abort); reject(error); },
    );
  });
}
async function authorize(permission: string, signal: AbortSignal) {
  const client = await createClient();
  const { data: { user }, error } = await boundedRead(client.auth.getUser(), signal);
  if (error || !user) return { ok: false as const, status: 401, error: "Unauthorized." };
  const db = getAuditServiceClient();
  const lookup = await db.from("admin_users").select("id,supabase_user_id,role,is_active,is_main_admin")
    .eq("supabase_user_id", user.id).eq("is_active", true).abortSignal(signal).maybeSingle();
  if (lookup.error) throw new Error("Administrator verification unavailable.");
  const verified = lookup.data;
  if (!verified || verified.supabase_user_id !== user.id || verified.is_active !== true ||
      (verified.role !== "main_admin" && verified.is_main_admin !== true)) {
    return { ok: false as const, status: 403, error: "An active main administrator account is required." };
  }
  const admin = await boundedRead(getAuthenticatedAdmin(), signal);
  if (!admin || admin.id !== verified.id || !hasLotteryPermission(admin, permission as any)) {
    return { ok: false as const, status: 403, error: "You do not have permission to perform this ticket action." };
  }
  return { ok: true as const, db, canViewPurchasers: hasLotteryPermission(admin, "lottery:orders:view" as any) };
}

type Db = ReturnType<typeof getAuditServiceClient>;
async function relatedRows<T>(db: Db, table: string, columns: string, filter: string, ids: string[], signal: AbortSignal): Promise<T[]> {
  if (!ids.length) return [];
  const rows: T[] = [];
  const seen = new Set<string>();
  let total: number | null = null;
  while (total === null || rows.length < total) {
    const result = await db.from(table).select(columns, { count: "exact" }).in(filter, ids)
      .order("id", { ascending: true }).range(rows.length, rows.length + RELATED_PAGE_SIZE - 1).abortSignal(signal);
    if (result.error || !result.data || result.count === null || !Number.isSafeInteger(result.count) ||
        result.count < 0 || result.count > MAX_RELATED_ROWS || (total !== null && total !== result.count)) {
      throw new Error("Complete ticket supporting data unavailable or changed.");
    }
    total = result.count;
    if (!result.data.length && rows.length < total) throw new Error("Ticket supporting data was truncated.");
    for (const row of result.data as unknown as Array<{ id: string }>) {
      if (!row.id || seen.has(row.id)) throw new Error("Ticket supporting data contains duplicate rows.");
      seen.add(row.id);
    }
    rows.push(...result.data as unknown as T[]);
    if (rows.length > total) throw new Error("Ticket supporting data changed while loading.");
  }
  return rows;
}

export async function GET(request: NextRequest) {
  const requestId = randomUUID();
  try {
    const signal = AbortSignal.timeout(20_000);
    const auth = await authorize("lottery:view", signal);
    if (!auth.ok) return response({ ok: false, error: auth.error, request_id: requestId }, auth.status);
    const { db, canViewPurchasers } = auth;
    const params = request.nextUrl.searchParams;
    const page = integer(params.get("page"), 1, 10_000);
    const pageSize = integer(params.get("pageSize") ?? params.get("limit"), PAGE_SIZE, MAX_PAGE_SIZE);
    const lotteryId = params.get("lottery_id"), orderId = params.get("order_id"), ticketId = params.get("ticket_id");
    const status = params.get("status");
    if (page === null || pageSize === null || [lotteryId, orderId, ticketId].some(id => id !== null && !isUuid(id)) ||
        (status !== null && !READ_STATUSES.has(status))) {
      return response({ ok: false, error: "Invalid pagination, ticket filter or ID.", request_id: requestId }, 400);
    }
    let query = db.from("lottery_tickets").select(
      "id,lottery_id,order_id,ticket_number,status,issued_at,void_reason,voided_at,refunded_at,winner_at,status_reason,created_at,updated_at",
      { count: "exact" },
    );
    if (lotteryId !== null) query = query.eq("lottery_id", lotteryId);
    if (orderId !== null) query = query.eq("order_id", orderId);
    if (ticketId !== null) query = query.eq("id", ticketId);
    if (status !== null) query = query.eq("status", status);
    const result = await query.order("created_at", { ascending: false }).order("id", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1).abortSignal(signal);
    if (result.error || !result.data || result.count === null || !Number.isSafeInteger(result.count) || result.count < 0 ||
        result.data.length !== Math.min(pageSize, Math.max(0, result.count - (page - 1) * pageSize))) {
      throw new Error("Ticket page unavailable or truncated.");
    }
    const tickets = result.data as unknown as Ticket[];
    const lotteryIds = [...new Set(tickets.map(ticket => ticket.lottery_id))];
    const orderIds = [...new Set(tickets.map(ticket => ticket.order_id).filter((id): id is string => id !== null))];
    const ticketIds = tickets.map(ticket => ticket.id);
    const orderColumns = canViewPurchasers
      ? "id,lottery_id,payment_status,order_reference,purchaser_name,purchaser_email"
      : "id,lottery_id,payment_status";
    const [lotteryRows, orderRows, events] = await Promise.all([
      relatedRows<Lottery>(db, "lotteries", "id,title,slug", "id", lotteryIds, signal),
      relatedRows<Order>(db, "lottery_orders", orderColumns, "id", orderIds, signal),
      relatedRows<TicketEvent>(db, "lottery_ticket_events", "id,ticket_id,event_type,previous_status,new_status,reason,created_at", "ticket_id", ticketIds, signal),
    ]);
    const lotteries = new Map(lotteryRows.map(row => [row.id, row]));
    const orders = new Map(orderRows.map(row => [row.id, row]));
    const eventsByTicket = new Map<string, TicketEvent[]>();
    for (const event of events) {
      if (!ticketIds.includes(event.ticket_id)) throw new Error("Ticket event linkage is invalid.");
      const list = eventsByTicket.get(event.ticket_id) ?? [];
      list.push(event); eventsByTicket.set(event.ticket_id, list);
    }
    const items = tickets.map(ticket => {
      const lottery = lotteries.get(ticket.lottery_id);
      const order = ticket.order_id ? orders.get(ticket.order_id) : null;
      if (!lottery || (ticket.order_id && (!order || order.lottery_id !== ticket.lottery_id))) {
        throw new Error("Ticket lottery/order linkage is invalid.");
      }
      return {
        ...ticket,
        lottery_title: lottery.title, lottery_slug: lottery.slug,
        order_reference: canViewPurchasers ? order?.order_reference ?? null : null,
        purchaser_name: canViewPurchasers ? order?.purchaser_name ?? null : null,
        purchaser_email: canViewPurchasers ? order?.purchaser_email ?? null : null,
        payment_status: order?.payment_status ?? null,
        payment_reference: null,
        order_recorded_paid: order ? order.payment_status === "paid" : null,
        is_payment_valid: null, is_draw_eligible: null,
        eligibility_verification: "not_verified_by_ticket_register",
        events: [...(eventsByTicket.get(ticket.id) ?? [])]
          .sort((a, b) => b.created_at.localeCompare(a.created_at)),
      };
    });
    return response({
      ok: true, items, page, pageSize, total: result.count,
      total_pages: Math.ceil(result.count / pageSize), has_more: page * pageSize < result.count,
      purchaser_details_available: canViewPurchasers, mutations_available: false,
      snapshot_consistent: false,
    });
  } catch (error) {
    console.error(`[${requestId}] Lottery tickets read failed:`, error);
    return response({ ok: false, error: "Unable to load complete ticket records. Refresh and try again.", request_id: requestId }, 503);
  }
}

export async function PATCH(request: NextRequest) {
  const requestId = randomUUID();
  try {
    const auth = await authorize("lottery:tickets:manage", AbortSignal.timeout(10_000));
    if (!auth.ok) return response({ ok: false, error: auth.error, request_id: requestId }, auth.status);
    const origin = request.headers.get("origin"), fetchSite = request.headers.get("sec-fetch-site");
    if (!origin || origin !== request.nextUrl.origin || (fetchSite && fetchSite !== "same-origin")) {
      return response({ ok: false, error: "A same-origin request is required.", request_id: requestId }, 403);
    }
    return response({
      ok: false, code: "TICKET_TRANSACTION_SERVICE_UNAVAILABLE",
      error: "Ticket corrections are unavailable until the audited database transaction service is configured. Winner status is controlled by the draw workflow.",
      request_id: requestId,
    }, 503);
  } catch (error) {
    console.error(`[${requestId}] Lottery ticket action rejected:`, error);
    return response({ ok: false, error: "The ticket action is unavailable.", request_id: requestId }, 503);
  }
}
