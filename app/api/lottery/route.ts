import { isPublicLottery } from "@/lib/lottery/public-visibility";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PUBLIC_STATUSES = ["scheduled", "live", "sales_closed", "draw_ready", "completed"] as const;
const MAX_DIRECTORY_ROWS = 500;
const COLUMNS = "title,slug,short_summary,hero_image_url,status,ticket_price,ticket_price_pence,currency,publication_at,results_publish_at,sales_open_at,sales_close_at,draw_at,show_in_public_directory,allow_page_before_sales,is_featured,is_active";

type DirectoryRow = {
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
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function publicDirectoryVisible(row: DirectoryRow, now: number) {
  return isPublicLottery(row, now);
}

function pricePence(row: DirectoryRow): number | null {
  if (row.ticket_price_pence !== null && row.ticket_price_pence !== undefined) {
    const value = row.ticket_price_pence;
    if (typeof value !== "number" && typeof value !== "string") return null;
    if (!/^\d+$/.test(String(value))) return null;
    const pence = Number(value);
    return Number.isSafeInteger(pence) && pence > 0 ? pence : null;
  }
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

export async function GET() {
  const requestId = randomUUID();
  try {
    const now = Date.now();
    const { data, error, count } = await supabaseAdmin.from("lotteries")
      .select(COLUMNS, { count: "exact" })
      .eq("is_active", true).eq("show_in_public_directory", true)
      .in("status", [...PUBLIC_STATUSES])
      .order("is_featured", { ascending: false, nullsFirst: false })
      .order("draw_at", { ascending: true, nullsFirst: false })
      .order("slug", { ascending: true })
      .range(0, MAX_DIRECTORY_ROWS - 1).abortSignal(AbortSignal.timeout(10_000));
    if (error || !data || count === null || !Number.isSafeInteger(count) || count < 0 ||
        count > MAX_DIRECTORY_ROWS || data.length !== count) {
      console.error(`[${requestId}] Public directory query failed or incomplete:`, error);
      return response({ ok: false, code: "PUBLIC_LOTTERY_DIRECTORY_UNAVAILABLE", error: "Could not load the lottery directory. Please try again.", request_id: requestId }, 503);
    }

    const seen = new Set<string>();
    const lotteries = [];
    for (const row of data as unknown as DirectoryRow[]) {
      if (!publicDirectoryVisible(row, now)) continue;
      const pence = pricePence(row);
      if (pence === null || row.currency !== "GBP" || typeof row.title !== "string" || !row.title.trim() ||
          row.title.length > 300 || typeof row.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug) || row.slug.length > 150) continue;
      if (seen.has(row.slug)) throw new Error("Public directory slug is not unique.");
      seen.add(row.slug);
      lotteries.push({
        title: row.title.trim(), slug: row.slug,
        short_summary: typeof row.short_summary === "string" ? row.short_summary.slice(0, 2000) : null,
        hero_image_url: imageUrl(row.hero_image_url), status: row.status,
        ticket_price_pence: pence, currency: "GBP",
        sales_open_at: row.sales_open_at, sales_close_at: row.sales_close_at, draw_at: row.draw_at,
        show_in_public_directory: true, is_featured: row.is_featured === true,
      });
    }
    return response({ ok: true, count: lotteries.length, lotteries, generated_at: new Date(now).toISOString() });
  } catch (error) {
    console.error(`[${requestId}] Public directory failed:`, error);
    return response({ ok: false, code: "PUBLIC_LOTTERY_DIRECTORY_UNAVAILABLE", error: "Could not load the lottery directory. Please try again.", request_id: requestId }, 503);
  }
}
