import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PUBLIC_STATUSES = new Set([
  "scheduled", "live", "sales_closed", "draw_ready", "completed",
]);
const DRAW_STATUSES = new Set(["not_started", "live", "paused", "completed"]);
const BROADCAST_MODES = new Set(["facebook_live", "in_person", "results_only"]);
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

function facebookUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2_048) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" || url.username || url.password || url.port ||
      !["facebook.com", "www.facebook.com", "m.facebook.com", "fb.watch"].includes(host)
    ) return null;
    return url.href;
  } catch {
    return null;
  }
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const requestId = randomUUID();
  try {
    // Next.js already decodes route parameters. Do not decode them a second time.
    const { slug: rawSlug } = await context.params;
    const slug = typeof rawSlug === "string" ? rawSlug.trim().toLowerCase() : "";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 160) {
      return json({ ok: false, error: "Lottery not found." }, 404);
    }

    const { data: lottery, error: lotteryError } = await supabaseAdmin
      .from("lotteries")
      .select("id,title,slug,status,draw_at,show_in_public_directory,allow_page_before_sales,results_publish_at")
      .eq("slug", slug)
      .eq("show_in_public_directory", true)
      .in("status", [...PUBLIC_STATUSES])
      .maybeSingle();

    if (lotteryError) throw new Error("Lottery lookup failed.");
    if (
      !lottery || lottery.show_in_public_directory !== true ||
      !PUBLIC_STATUSES.has(lottery.status) ||
      (lottery.status === "scheduled" && lottery.allow_page_before_sales !== true)
    ) {
      return json({ ok: false, error: "Lottery not found." }, 404);
    }

    const now = Date.now();
    // Fail closed when the publication time is missing or malformed.
    const resultsVisible = lottery.status === "completed" &&
      reached(lottery.results_publish_at, now);

    const { data: liveDraw, error: liveDrawError } = await supabaseAdmin
      .from("lottery_live_draws")
      .select("status,broadcast_mode,facebook_live_url,public_message,started_at,ended_at")
      .eq("lottery_id", lottery.id)
      .maybeSingle();
    if (liveDrawError) throw new Error("Live draw lookup failed.");
    if (liveDraw && (
      !DRAW_STATUSES.has(liveDraw.status) ||
      !BROADCAST_MODES.has(liveDraw.broadcast_mode)
    )) throw new Error("Invalid live draw configuration.");

    let results: Array<{
      display_order: number;
      prize_label: string;
      winner_display_label: string;
      published_at: string;
    }> = [];

    if (resultsVisible) {
      const result = await supabaseAdmin
        .from("lottery_live_draw_public_results")
        .select("display_order,prize_label,winner_display_label,published_at", { count: "exact" })
        .eq("lottery_id", lottery.id)
        .eq("is_published", true)
        .lte("published_at", new Date(now).toISOString())
        .order("display_order", { ascending: true })
        .limit(MAX_RESULTS);

      if (
        result.error || !Array.isArray(result.data) ||
        !Number.isSafeInteger(result.count) || result.count !== result.data.length ||
        result.data.length > MAX_RESULTS
      ) throw new Error("Public results are unavailable or incomplete.");

      results = result.data.map((row) => {
        if (
          !Number.isSafeInteger(row.display_order) ||
          typeof row.prize_label !== "string" ||
          typeof row.winner_display_label !== "string" ||
          !reached(row.published_at, now)
        ) throw new Error("Invalid public result.");
        return {
          display_order: row.display_order,
          prize_label: row.prize_label,
          winner_display_label: row.winner_display_label,
          published_at: row.published_at,
        };
      });
    }

    return json({
      ok: true,
      lottery: {
        title: lottery.title,
        slug: lottery.slug,
        status: lottery.status,
        draw_at: lottery.draw_at,
        show_in_public_directory: true,
        allow_page_before_sales: lottery.allow_page_before_sales === true,
        results_publish_at: lottery.results_publish_at,
      },
      draw: {
        status: liveDraw?.status ?? "not_started",
        broadcast_mode: liveDraw?.broadcast_mode ?? "in_person",
        facebook_live_url: liveDraw?.broadcast_mode === "facebook_live"
          ? facebookUrl(liveDraw.facebook_live_url) : null,
        public_message: liveDraw?.public_message ?? null,
        started_at: liveDraw?.started_at ?? null,
        ended_at: liveDraw?.ended_at ?? null,
      },
      results_visible: resultsVisible,
      results,
    });
  } catch {
    console.error(`[${requestId}] Public live draw lookup failed.`);
    return json({
      ok: false,
      error: "The live draw is unavailable at the moment.",
      request_id: requestId,
    }, 503);
  }
}
