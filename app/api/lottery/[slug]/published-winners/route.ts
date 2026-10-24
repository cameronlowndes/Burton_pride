import { isPublicLottery } from "@/lib/lottery/public-visibility";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { lotteryAdminDb } from "@/lib/lottery/adminAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PublicDisplayMode = "full_name" | "first_name" | "ticket_number";
type WinnerRow = {
  id: string;
  lottery_id: string;
  prize_id: string;
  ticket_id: string;
  order_id: string | null;
  status: string;
  public_display_mode: PublicDisplayMode;
  public_display_consent: boolean;
  public_results_published_at: string;
};
type PrizeRow = { id: string; lottery_id: string; name: string };
type TicketRow = { id: string; lottery_id: string; order_id: string | null; ticket_number: string };
type OrderRow = { id: string; lottery_id: string; purchaser_name: string | null };

const PUBLIC_STATUSES = new Set([
  "scheduled", "live", "sales_closed", "draw_ready", "completed",
]);
const WINNER_STATUSES = new Set([
  "selected", "contact_pending", "contacted", "eligibility_confirmed", "claimed", "fulfilled",
]);
const DISPLAY_MODES: PublicDisplayMode[] = ["full_name", "first_name", "ticket_number"];
const MAX_RESULTS = 500;
const QUERY_TIMEOUT_MS = 8_000;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function reached(value: unknown, now: number): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= now;
}

function completeRows<T>(result: {
  data: T[] | null;
  error: unknown;
  count: number | null;
}): T[] {
  if (
    result.error || !Array.isArray(result.data) ||
    !Number.isSafeInteger(result.count) || result.count !== result.data.length ||
    result.data.length > MAX_RESULTS
  ) throw new Error("Results lookup failed or was incomplete.");
  return result.data;
}

function publicLabel(mode: PublicDisplayMode, name: string | null, ticket: string): string {
  if (mode === "ticket_number") {
    if (typeof ticket !== "string" || !ticket.trim()) throw new Error("Missing ticket label.");
    return `Ticket ${ticket.trim()}`;
  }
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) return "Winner";
  return mode === "first_name" ? trimmed.split(/\s+/)[0] : trimmed;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const requestId = randomUUID();
  try {
    // Next.js decodes route parameters; avoid double decoding malformed input.
    const { slug: rawSlug } = await params;
    const slug = typeof rawSlug === "string" ? rawSlug.trim().toLowerCase() : "";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 160) {
      return json({ ok: false, error: "Lottery not found." }, 404);
    }

    const supabase = lotteryAdminDb();
    const { data: lottery, error: lotteryError } = await supabase
      .from("lotteries")
      .select("id,status,show_in_public_directory,allow_page_before_sales,results_publish_at,is_active,publication_at,sales_open_at,sales_close_at,draw_at")
      .eq("slug", slug)
      .eq("show_in_public_directory", true)
      .in("status", [...PUBLIC_STATUSES])
      .maybeSingle();

    if (lotteryError) throw new Error("Lottery lookup failed.");
    if (
      !lottery || !isPublicLottery(lottery) || lottery.show_in_public_directory !== true ||
      !PUBLIC_STATUSES.has(lottery.status) ||
      (lottery.status === "scheduled" && lottery.allow_page_before_sales !== true)
    ) return json({ ok: false, error: "Lottery not found." }, 404);

    const now = Date.now();
    if (lottery.status !== "completed" || !reached(lottery.results_publish_at, now)) {
      return json({ ok: true, results: [] });
    }

    const winnersResult = await supabase
      .from("lottery_winners")
      .select("id,lottery_id,prize_id,ticket_id,order_id,status,public_display_mode,public_display_consent,public_results_published_at", { count: "exact" })
      .eq("lottery_id", lottery.id)
      .eq("public_display_consent", true)
      .in("public_display_mode", DISPLAY_MODES)
      .in("status", [...WINNER_STATUSES])
      .lte("public_results_published_at", new Date(now).toISOString())
      .order("public_results_published_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(MAX_RESULTS)
      .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS));
    const rows = completeRows(winnersResult) as WinnerRow[];
    for (const row of rows) {
      if (
        row.lottery_id !== lottery.id || row.public_display_consent !== true ||
        !DISPLAY_MODES.includes(row.public_display_mode) || !WINNER_STATUSES.has(row.status) ||
        !reached(row.public_results_published_at, now) ||
        typeof row.prize_id !== "string" || !row.prize_id ||
        typeof row.ticket_id !== "string" || !row.ticket_id ||
        (row.order_id !== null && (typeof row.order_id !== "string" || !row.order_id))
      ) throw new Error("Invalid published winner.");
    }
    if (!rows.length) return json({ ok: true, results: [] });

    const prizeIds = [...new Set(rows.map((row) => row.prize_id))];
    const ticketIds = [...new Set(rows.map((row) => row.ticket_id))];
    const needsNames = rows.some((row) => row.public_display_mode !== "ticket_number");
    const orderIds = [...new Set(rows
      .map((row) => row.order_id)
      .filter((id): id is string => typeof id === "string"))];

    const [prizesResult, ticketsResult, ordersResult] = await Promise.all([
      supabase.from("lottery_prizes")
        .select("id,lottery_id,name", { count: "exact" })
        .eq("lottery_id", lottery.id).in("id", prizeIds).limit(MAX_RESULTS)
        .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS)),
      supabase.from("lottery_tickets")
        .select("id,lottery_id,order_id,ticket_number", { count: "exact" })
        .eq("lottery_id", lottery.id).in("id", ticketIds).limit(MAX_RESULTS)
        .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS)),
      orderIds.length
        ? supabase.from("lottery_orders")
          .select(needsNames ? "id,lottery_id,purchaser_name" : "id,lottery_id", { count: "exact" })
          .eq("lottery_id", lottery.id).in("id", orderIds).limit(MAX_RESULTS)
          .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
        : Promise.resolve({ data: [], count: 0, error: null }),
    ]);

    const prizes = new Map((completeRows(prizesResult) as PrizeRow[]).map((row) => [row.id, row]));
    const tickets = new Map((completeRows(ticketsResult) as TicketRow[]).map((row) => [row.id, row]));
    const orders = new Map((completeRows(ordersResult) as unknown as OrderRow[]).map((row) => [row.id, row]));
    const results = rows.map((winner, index) => {
      const prize = prizes.get(winner.prize_id);
      const ticket = tickets.get(winner.ticket_id);
      const order = winner.order_id ? orders.get(winner.order_id) : undefined;
      if (
        !prize || prize.lottery_id !== lottery.id || typeof prize.name !== "string" ||
        !ticket || ticket.lottery_id !== lottery.id || ticket.order_id !== winner.order_id ||
        (winner.order_id !== null &&
          (!order || order.lottery_id !== lottery.id))
      ) throw new Error("Published winner relationship mismatch.");

      return {
        display_order: index + 1,
        prize_label: prize.name,
        winner_display_label: publicLabel(winner.public_display_mode, order?.purchaser_name ?? null, ticket.ticket_number),
        published_at: winner.public_results_published_at,
      };
    });
    return json({ ok: true, results });
  } catch {
    console.error(`[${requestId}] Public published winners lookup failed.`);
    return json({
      ok: false,
      error: "The published results are unavailable.",
      request_id: requestId,
    }, 503);
  }
}
