import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedAdmin, getAuditServiceClient, hasLotteryPermission } from "@/lib/lottery/audit-server";
import type { LotteryPermission } from "@/lib/lottery/audit-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;
const RELATED_PAGE_SIZE = 250;
const MAX_RELATED_ROWS = 20_000;
const WINNER_COLUMNS = "id,lottery_id,draw_id,prize_id,ticket_id,order_id,status,selected_at,contacted_at,eligibility_confirmed_at,claimed_at,fulfilled_at,unclaimed_at,disqualified_at,replaced_at,collection_delivery_date,fulfilment_method,fulfilment_notes,internal_notes,public_display_mode,public_display_consent,public_results_published_at,replacement_winner_id,original_winner_id,created_at,updated_at";
type WinnerRow = {
  id: string;
  lottery_id: string;
  draw_id: string;
  prize_id: string;
  ticket_id: string;
  order_id: string | null;
  status: string;
  selected_at: string;
  contacted_at: string | null;
  eligibility_confirmed_at: string | null;
  claimed_at: string | null;
  fulfilled_at: string | null;
  unclaimed_at: string | null;
  disqualified_at: string | null;
  replaced_at: string | null;
  collection_delivery_date: string | null;
  fulfilment_method: string | null;
  fulfilment_notes: string | null;
  internal_notes: string | null;
  public_display_mode: string | null;
  public_display_consent: boolean;
  public_results_published_at: string | null;
  replacement_winner_id: string | null;
  original_winner_id: string | null;
  created_at: string;
  updated_at: string;
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
    const abort = () => reject(new Error("Winner read timed out."));
    if (signal.aborted) { abort(); return; }
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(operation).then(
      value => { signal.removeEventListener("abort", abort); resolve(value); },
      error => { signal.removeEventListener("abort", abort); reject(error); },
    );
  });
}
async function authorize(permission: LotteryPermission, signal: AbortSignal) {
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
  if (!admin || admin.id !== verified.id || !hasLotteryPermission(admin, permission)) {
    return { ok: false as const, status: 403, error: "You do not have permission to perform this winner action." };
  }
  return { ok: true as const, db };
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
      throw new Error("Complete winner supporting data unavailable or changed.");
    }
    total = result.count;
    if (!result.data.length && rows.length < total) throw new Error("Winner supporting data was truncated.");
    for (const row of result.data as unknown as Array<{ id: string }>) {
      if (!row.id || seen.has(row.id)) throw new Error("Winner supporting data contains duplicate rows.");
      seen.add(row.id);
    }
    rows.push(...result.data as unknown as T[]);
    if (rows.length > total) throw new Error("Winner supporting data changed while loading.");
  }
  return rows;
}

type Lottery = { id: string; title: string; slug: string };
type Prize = { id: string; lottery_id: string; name: string; declared_value: string | number | null };
type Ticket = { id: string; lottery_id: string; order_id: string | null; ticket_number: string };
type Order = { id: string; lottery_id: string; order_reference: string; purchaser_name: string | null; purchaser_email: string | null; purchaser_phone: string | null };
type Attempt = { id: string; winner_id: string; method: string; outcome: string; notes: string | null; attempted_at: string; admin_name: string | null };

function money(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) return null;
  const pennies = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(pennies) ? pennies / 100 : null;
}

export async function GET(request: NextRequest) {
  const requestId = randomUUID();
  try {
    const signal = AbortSignal.timeout(20_000);
    const auth = await authorize("lottery:winners:manage", signal);
    if (!auth.ok) return response({ ok: false, error: auth.error, request_id: requestId }, auth.status);
    const { db } = auth;
    const params = request.nextUrl.searchParams;
    const page = integer(params.get("page"), 1, 10_000);
    const pageSize = integer(params.get("pageSize") ?? params.get("limit"), PAGE_SIZE, MAX_PAGE_SIZE);
    const lotteryId = params.get("lottery_id"), winnerId = params.get("winner_id");
    if (page === null || pageSize === null || [lotteryId, winnerId].some(id => id !== null && !isUuid(id))) {
      return response({ ok: false, error: "Invalid pagination or lottery/winner ID.", request_id: requestId }, 400);
    }
    let query = db.from("lottery_winners").select(WINNER_COLUMNS, { count: "exact" });
    if (lotteryId !== null) query = query.eq("lottery_id", lotteryId);
    if (winnerId !== null) query = query.eq("id", winnerId);
    const result = await query.order("selected_at", { ascending: false }).order("id", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1).abortSignal(signal);
    if (result.error || !result.data || result.count === null || !Number.isSafeInteger(result.count) || result.count < 0 ||
        result.data.length !== Math.min(pageSize, Math.max(0, result.count - (page - 1) * pageSize))) {
      throw new Error("Winner listing unavailable or truncated.");
    }
    const rows = result.data as unknown as WinnerRow[];
    const lotteryIds = [...new Set(rows.map(row => row.lottery_id))];
    const prizeIds = [...new Set(rows.map(row => row.prize_id))];
    const ticketIds = [...new Set(rows.map(row => row.ticket_id))];
    const orderIds = [...new Set(rows.map(row => row.order_id).filter((id): id is string => id !== null))];
    const winnerIds = rows.map(row => row.id);
    const [lotteryRows, prizeRows, ticketRows, orderRows, attempts] = await Promise.all([
      relatedRows<Lottery>(db, "lotteries", "id,title,slug", "id", lotteryIds, signal),
      relatedRows<Prize>(db, "lottery_prizes", "id,lottery_id,name,declared_value", "id", prizeIds, signal),
      relatedRows<Ticket>(db, "lottery_tickets", "id,lottery_id,order_id,ticket_number", "id", ticketIds, signal),
      relatedRows<Order>(db, "lottery_orders", "id,lottery_id,order_reference,purchaser_name,purchaser_email,purchaser_phone", "id", orderIds, signal),
      relatedRows<Attempt>(db, "lottery_winner_contact_attempts", "id,winner_id,method,outcome,notes,attempted_at,admin_name", "winner_id", winnerIds, signal),
    ]);
    const lotteries = new Map(lotteryRows.map(row => [row.id, row]));
    const prizes = new Map(prizeRows.map(row => [row.id, row]));
    const tickets = new Map(ticketRows.map(row => [row.id, row]));
    const orders = new Map(orderRows.map(row => [row.id, row]));
    const attemptsByWinner = new Map<string, Attempt[]>();
    const selectedIds = new Set(winnerIds);
    for (const attempt of attempts) {
      if (!selectedIds.has(attempt.winner_id)) throw new Error("Winner contact history linkage is invalid.");
      const list = attemptsByWinner.get(attempt.winner_id) ?? [];
      list.push(attempt); attemptsByWinner.set(attempt.winner_id, list);
    }
    const items = rows.map(winner => {
      const lottery = lotteries.get(winner.lottery_id);
      const prize = prizes.get(winner.prize_id);
      const ticket = tickets.get(winner.ticket_id);
      const order = winner.order_id ? orders.get(winner.order_id) : null;
      if (!lottery || !prize || !ticket || prize.lottery_id !== winner.lottery_id || ticket.lottery_id !== winner.lottery_id ||
          (winner.order_id && (!order || order.lottery_id !== winner.lottery_id || ticket.order_id !== winner.order_id))) {
        throw new Error("Winner lottery/prize/ticket/order linkage is invalid.");
      }
      return {
        ...winner,
        lottery_title: lottery.title, lottery_slug: lottery.slug,
        draw_reference: null,
        prize_name: prize.name, prize_value: money(prize.declared_value),
        prize_value_basis: "recorded_declared_value_not_verified_award_value",
        ticket_number: ticket.ticket_number,
        order_reference: order?.order_reference ?? null,
        entrant_name: order?.purchaser_name ?? null,
        entrant_email: order?.purchaser_email ?? null,
        entrant_phone: order?.purchaser_phone ?? null,
        public_display_mode: winner.public_display_mode ?? null,
        public_display_consent: winner.public_display_consent === true,
        public_results_published_at: winner.public_results_published_at ?? null,
        publication_verified: false, draw_provenance_verified: false,
        order_link_present: winner.order_id !== null,
        contact_attempts: [...(attemptsByWinner.get(winner.id) ?? [])]
          .sort((a, b) => b.attempted_at.localeCompare(a.attempted_at)),
        contact_history_available: true,
      };
    });
    return response({
      ok: true, items, page, pageSize, total: result.count,
      total_pages: Math.ceil(result.count / pageSize), has_more: page * pageSize < result.count,
      snapshot_consistent: false,
    });
  } catch (error) {
    console.error(`[${requestId}] Lottery winners read failed:`, error);
    return response({ ok: false, error: "Could not load complete winner records and contact history. Refresh and try again.", request_id: requestId }, 503);
  }
}
