import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type PrizeRow = { name: string; description: string | null; image_url: string | null; quantity: number; declared_value: unknown; sponsor_name: string | null; status: string; display_order: number };
type RouteContext = { params: Promise<{ slug: string }> };
const PUBLIC_STATUSES = ["scheduled", "live", "sales_closed", "draw_ready", "completed"] as const;
const MAX_PRIZES = 500;
const PUBLIC_PRIZE_STATUSES = ["confirmed", "available_for_draw", "allocated", "claimed", "fulfilled"];
const COLUMNS = "id,title,slug,short_summary,description,fundraising_purpose,hero_image_url,status,ticket_price,ticket_price_pence,currency,publication_at,sales_open_at,sales_close_at,draw_at,results_publish_at,minimum_age,max_tickets,show_in_public_directory,allow_page_before_sales,show_ticket_count,show_amount_raised,show_remaining_tickets,show_prize_values,countdown_enabled,geographic_eligibility,terms_version,privacy_notice_version,responsible_gambling_info,is_active";

/**
 * Public fields only. Internal IDs are used for joins but never serialized.
 * Visibility/timing mirrors the directory route; extract both predicates into
 * a shared server module when the complete project is available. Publication
 * timestamps are schedules, not proof of compliance approval or winner consent.
 * Purchase eligibility below is advisory. Checkout rechecks it; verified
 * compliance and atomic capacity reservations/fulfillment remain required.
 * Amount raised is unavailable pending a reconciled aggregate; never invent £0.
 * Text is plain data: clients must sanitize any rich HTML before rendering it.
 */
type DirectoryRow = {
  id: string;
  description: string | null;
  fundraising_purpose: string | null;
  minimum_age: number | null;
  max_tickets: number | null;
  show_ticket_count: boolean | null;
  show_remaining_tickets: boolean | null;
  show_amount_raised: boolean | null;
  show_prize_values: boolean | null;
  countdown_enabled: boolean | null;
  geographic_eligibility: string | null;
  responsible_gambling_info: string | null;
  terms_version: string | null;
  privacy_notice_version: string | null;
  title: string | null;
  slug: string | null;
  short_summary: string | null;
  hero_image_url: string | null;
  status: string;
  ticket_price: unknown;
  ticket_price_pence: unknown;
  currency: string | null;
  publication_at: string | null;
  results_publish_at: string | null;
  sales_open_at: string | null;
  sales_close_at: string | null;
  draw_at: string | null;
  show_in_public_directory: boolean | null;
  allow_page_before_sales: boolean | null;
  is_featured: boolean | null;
  is_active: boolean | null;
};

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: {
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
    "Surrogate-Control": "no-store", Pragma: "no-cache", Expires: "0",
    "X-Content-Type-Options": "nosniff",
  } });
}

function timestamp(value: unknown): number | null {
  // Require an explicit timezone; never interpret server-local dates.
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function publicDirectoryVisible(row: DirectoryRow, now: number) {
  if (row.is_active !== true || row.show_in_public_directory !== true ||
      !PUBLIC_STATUSES.some(status => status === row.status)) return false;
  const publication = timestamp(row.publication_at);
  if (publication === null || publication > now) return false;
  if (row.status === "completed") {
    const results = timestamp(row.results_publish_at);
    if (results === null || results > now) return false;
  }
  const open = timestamp(row.sales_open_at), close = timestamp(row.sales_close_at), draw = timestamp(row.draw_at);
  if (open === null || close === null || draw === null || close <= open || draw < close) return false;
  if (row.status === "scheduled" && now >= close) return false;
  if (row.status === "completed" && now < draw) return false;
  if (now < open && (row.status !== "scheduled" || row.allow_page_before_sales !== true)) return false;
  return true;
}

function pricePence(row: DirectoryRow): number | null {
  if (row.ticket_price_pence !== null && row.ticket_price_pence !== undefined) {
    const value = row.ticket_price_pence;
    if (typeof value !== "number" && typeof value !== "string") return null;
    if (!/^\d+$/.test(String(value))) return null;
    const pence = Number(value);
    return Number.isSafeInteger(pence) && pence > 0 ? pence : null;
  }
  // Exact legacy conversion only: never round fractional pennies or invent £0.
  if (typeof row.ticket_price !== "number" && typeof row.ticket_price !== "string") return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(row.ticket_price));
  if (!match) return null;
  const pence = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(pence) && pence > 0 ? pence : null;
}

function imageUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value || value.length > 2048) return null;
  if (/^\/(?!\/)/.test(value) && !/[\\\u0000-\u0020]/.test(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function text(value: unknown, max: number): string | null {
  return typeof value === "string" ? value.slice(0, max) : null;
}
function wholePositive(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}
function moneyPence(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) return null;
  const pence = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(pence) ? pence : null;
}
function notFound(requestId: string) {
  return response({ ok: false, code: "PUBLIC_LOTTERY_NOT_FOUND", error: "Lottery not found.", request_id: requestId }, 404);
}
export async function GET(_request: NextRequest, context: RouteContext) {
  const requestId = randomUUID();
  try {
    // App Router supplies decoded parameters. Never decode a second time.
    const { slug } = await context.params;
    if (typeof slug !== "string" || slug.length > 150 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return response({ ok: false, code: "PUBLIC_LOTTERY_INVALID_SLUG", error: "The lottery address is invalid.", request_id: requestId }, 400);
    }
    const signal = AbortSignal.timeout(10_000);
    const now = Date.now();
    const lookup = await supabaseAdmin.from("lotteries").select(COLUMNS)
      .eq("slug", slug).eq("is_active", true).eq("show_in_public_directory", true)
      .in("status", [...PUBLIC_STATUSES]).abortSignal(signal).maybeSingle();
    if (lookup.error) throw new Error("Public lottery lookup unavailable.");
    const lottery = lookup.data as unknown as DirectoryRow | null;
    if (!lottery || !publicDirectoryVisible(lottery, now)) return notFound(requestId);
    const ticketPrice = pricePence(lottery);
    if (lottery.slug !== slug || ticketPrice === null || lottery.currency !== "GBP" ||
        typeof lottery.title !== "string" || !lottery.title.trim() || lottery.title.length > 300) return notFound(requestId);

    const prizeResult = await supabaseAdmin.from("lottery_prizes")
      .select("name,description,image_url,quantity,declared_value,sponsor_name,status,display_order", { count: "exact" })
      .eq("lottery_id", lottery.id).in("status", PUBLIC_PRIZE_STATUSES)
      .order("display_order", { ascending: true }).order("id", { ascending: true })
      .range(0, MAX_PRIZES - 1).abortSignal(signal);
    if (prizeResult.error || !prizeResult.data || prizeResult.count === null ||
        !Number.isSafeInteger(prizeResult.count) || prizeResult.count < 0 ||
        prizeResult.count > MAX_PRIZES || prizeResult.data.length !== prizeResult.count) {
      throw new Error("Complete public prize data unavailable.");
    }
    const showValues = lottery.show_prize_values === true;
    const prizes = (prizeResult.data as unknown as PrizeRow[]).map(prize => {
      if (!PUBLIC_PRIZE_STATUSES.includes(prize.status) || typeof prize.name !== "string" ||
          !prize.name.trim() || prize.name.length > 300 || wholePositive(prize.quantity) === null) {
        throw new Error("Public prize data invalid.");
      }
      const value = showValues ? moneyPence(prize.declared_value) : null;
      return {
        name: prize.name.trim(), description: text(prize.description, 10000),
        image_url: imageUrl(prize.image_url), quantity: prize.quantity,
        declared_value: value === null ? null : value / 100,
        sponsor_name: text(prize.sponsor_name, 300), display_order: prize.display_order,
      };
    });

    const showTickets = lottery.show_ticket_count === true;
    const showRemaining = lottery.show_remaining_tickets === true;
    const maxTickets = wholePositive(lottery.max_tickets);
    let ticketCount: number | null = null;
    if (showTickets || showRemaining) {
      const result = await supabaseAdmin.from("lottery_tickets").select("id", { count: "exact", head: true })
        .eq("lottery_id", lottery.id).in("status", ["issued", "winner"]).abortSignal(signal);
      if (result.error || result.count === null || !Number.isSafeInteger(result.count) || result.count < 0 ||
          (maxTickets !== null && result.count > maxTickets)) throw new Error("Public ticket statistics unavailable.");
      ticketCount = result.count;
    }
    const openAt = timestamp(lottery.sales_open_at), closeAt = timestamp(lottery.sales_close_at);
    const canPurchase = lottery.status === "live" && openAt !== null && closeAt !== null && now >= openAt && now < closeAt &&
      ticketPrice > 0 && maxTickets !== null && wholePositive(lottery.minimum_age) !== null &&
      Boolean(lottery.terms_version) && Boolean(lottery.privacy_notice_version) &&
      (ticketCount === null || ticketCount < maxTickets);
    const remaining = showRemaining && maxTickets !== null && ticketCount !== null ? maxTickets - ticketCount : null;
    return response({ ok: true, lottery: {
      title: lottery.title.trim(), slug: lottery.slug,
      short_summary: text(lottery.short_summary, 2000), description: text(lottery.description, 30000),
      fundraising_purpose: text(lottery.fundraising_purpose, 10000), hero_image_url: imageUrl(lottery.hero_image_url),
      status: lottery.status, ticket_price_pence: ticketPrice, currency: "GBP",
      minimum_age: wholePositive(lottery.minimum_age), max_tickets: showRemaining ? maxTickets : null,
      publication_at: lottery.publication_at, sales_open_at: lottery.sales_open_at,
      sales_close_at: lottery.sales_close_at, draw_at: lottery.draw_at,
      results_publish_at: lottery.results_publish_at,
      geographic_eligibility: text(lottery.geographic_eligibility, 3000),
      responsible_gambling_info: text(lottery.responsible_gambling_info, 10000),
      terms_version: text(lottery.terms_version, 200), privacy_notice_version: text(lottery.privacy_notice_version, 200),
      show_ticket_count: showTickets, show_remaining_tickets: showRemaining,
      show_amount_raised: lottery.show_amount_raised === true, show_prize_values: showValues,
      countdown_enabled: lottery.countdown_enabled === true,
      tickets_issued: showTickets ? ticketCount : null, remaining_tickets: remaining,
      amount_raised_pence: null, amount_raised_available: false,
      can_purchase: canPurchase,
      sales_message: canPurchase ? "Tickets are available. Availability is checked again at checkout." : "This lottery is not currently accepting online purchases.",
      prizes,
    } });
  } catch (error) {
    console.error(`[${requestId}] Public lottery detail failed:`, error);
    return response({ ok: false, code: "PUBLIC_LOTTERY_UNAVAILABLE", error: "Unable to load this lottery. Please try again.", request_id: requestId }, 503);
  }
}
