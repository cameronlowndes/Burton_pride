import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug: rawSlug } = await context.params;
  const slug = decodeURIComponent(rawSlug).trim().toLowerCase();

  if (!slug) {
    return NextResponse.json(
      { ok: false, error: "Lottery not found." },
      { status: 404 },
    );
  }

  const { data: lottery, error: lotteryError } = await supabaseAdmin
    .from("lotteries")
    .select("id,title,slug,status,draw_at")
    .eq("slug", slug)
    .maybeSingle();

  if (lotteryError || !lottery) {
    return NextResponse.json(
      { ok: false, error: "Lottery not found." },
      { status: 404 },
    );
  }

  const [liveDrawResult, resultsResult] = await Promise.all([
    supabaseAdmin
      .from("lottery_live_draws")
      .select("status,broadcast_mode,facebook_live_url,public_message,started_at,ended_at")
      .eq("lottery_id", lottery.id)
      .maybeSingle(),
    supabaseAdmin
      .from("lottery_live_draw_public_results")
      .select("id,display_order,prize_label,winner_display_label,published_at")
      .eq("lottery_id", lottery.id)
      .eq("is_published", true)
      .order("display_order", { ascending: true }),
  ]);

  if (liveDrawResult.error || resultsResult.error) {
    console.error("Public live draw lookup failed", {
      liveDrawError: liveDrawResult.error,
      resultsError: resultsResult.error,
    });

    return NextResponse.json(
      { ok: false, error: "The live draw is unavailable at the moment." },
      { status: 500 },
    );
  }

  const liveDraw = liveDrawResult.data;

  return NextResponse.json(
    {
      ok: true,
      lottery: {
        title: lottery.title,
        slug: lottery.slug,
        draw_at: lottery.draw_at,
      },
      draw: {
        status: liveDraw?.status ?? "not_started",
        broadcast_mode: liveDraw?.broadcast_mode ?? "in_person",
        facebook_live_url: liveDraw?.facebook_live_url ?? null,
        public_message: liveDraw?.public_message ?? null,
        started_at: liveDraw?.started_at ?? null,
        ended_at: liveDraw?.ended_at ?? null,
      },
      results: resultsResult.data ?? [],
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
