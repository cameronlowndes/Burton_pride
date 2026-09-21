"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CircleDot,
  Clock3,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";

type LiveDrawResponse = {
  ok: boolean;
  error?: string;
  lottery?: { title: string; slug: string; draw_at: string | null };
  draw?: {
    status: "not_started" | "live" | "paused" | "completed";
    broadcast_mode: "facebook_live" | "in_person" | "results_only";
    facebook_live_url: string | null;
    public_message: string | null;
    started_at: string | null;
    ended_at: string | null;
  };
};

type PublishedWinnersResponse = {
  ok: boolean;
  error?: string;
  results?: Array<{
    id: string;
    display_order: number;
    prize_label: string;
    winner_display_label: string;
    published_at: string | null;
  }>;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "To be confirmed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "To be confirmed";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(date);
}

function facebookEmbedUrl(url: string) {
  return "https://www.facebook.com/plugins/video.php?href=" +
    encodeURIComponent(url) +
    "&show_text=false&width=1280";
}

function getCountdownParts(drawAt: string | null | undefined, now: number) {
  if (!drawAt) return null;
  const difference = new Date(drawAt).getTime() - now;
  if (!Number.isFinite(difference) || difference <= 0) return null;

  const seconds = Math.floor(difference / 1_000);
  return {
    days: Math.floor(seconds / 86_400),
    hours: Math.floor((seconds % 86_400) / 3_600),
    minutes: Math.floor((seconds % 3_600) / 60),
    seconds: seconds % 60,
  };
}

function statusMessage(data: LiveDrawResponse | null) {
  if (data?.draw?.status === "live" && data.draw.broadcast_mode === "facebook_live") return "Watch the draw live on Facebook";
  if (data?.draw?.status === "live" && data.draw.broadcast_mode === "in_person") return "The draw is happening now — winners will appear as they are confirmed";
  if (data?.draw?.status === "live") return "The draw is happening now — results will appear here shortly";
  if (data?.draw?.status === "paused") return "The draw is temporarily paused";
  if (data?.draw?.status === "completed") return "The draw has finished";
  return "The draw has not started yet";
}

export default function LiveDrawClient({ slug }: { slug: string }) {
  const [data, setData] = useState<LiveDrawResponse | null>(null);
  const [publishedResults, setPublishedResults] = useState<
    NonNullable<PublishedWinnersResponse["results"]>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  async function load(manual = false) {
    if (manual) setRefreshing(true);

    try {
      const response = await fetch(
        "/api/lottery/" + encodeURIComponent(slug) + "/live-draw",
        { cache: "no-store" },
      );
      const contentType = response.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        throw new Error("The live draw is not available yet. Please try again shortly.");
      }

      const next = (await response.json()) as LiveDrawResponse;
      if (!response.ok || !next.ok) {
        throw new Error(next.error || "Unable to load the live draw.");
      }

      const resultsResponse = await fetch(
        "/api/lottery/" + encodeURIComponent(slug) + "/published-winners",
        { cache: "no-store" },
      );
      const results = (await resultsResponse.json()) as PublishedWinnersResponse;

      if (!resultsResponse.ok || !results.ok) {
        throw new Error(results.error || "Unable to load published winners.");
      }

      setData(next);
      setPublishedResults(results.results || []);
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load the live draw.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(interval);
  }, [slug]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  const draw = data?.draw;
  const isLive = draw?.status === "live";
  const isComplete = draw?.status === "completed";
  const title = data?.lottery?.title || "Lottery draw";
  const message = draw?.public_message || statusMessage(data);
  const countdown = getCountdownParts(data?.lottery?.draw_at, now);
  const videoUrl = draw?.facebook_live_url;

  const countdownItems = useMemo(() => {
    if (!countdown) return [];
    return [
      [countdown.days, "Days"],
      [countdown.hours, "Hours"],
      [countdown.minutes, "Minutes"],
      [countdown.seconds, "Seconds"],
    ];
  }, [countdown]);

  const statusClass =
    isLive
      ? "border-pink-300/30 bg-pink-500/15 text-pink-100"
      : isComplete
        ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
        : "border-white/10 bg-black/20 text-white/65";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07060d] px-4 pb-14 pt-24 text-white sm:px-6 sm:pt-28 lg:px-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[42rem] bg-[radial-gradient(ellipse_at_top,rgba(126,34,206,0.28),transparent_62%)]" />
      <div className="pointer-events-none absolute left-[-9rem] top-[30rem] h-96 w-96 rounded-full bg-fuchsia-600/10 blur-[110px]" />
      <div className="pointer-events-none absolute right-[-8rem] top-64 h-[28rem] w-[28rem] rounded-full bg-blue-600/10 blur-[120px]" />

      <div className="relative mx-auto w-full max-w-[1440px]">
        <header className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#151022]/90 p-6 shadow-[0_30px_100px_rgba(49,9,93,0.32)] backdrop-blur-xl sm:p-9 lg:p-10">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-[52%] bg-[radial-gradient(circle_at_top_right,rgba(217,70,239,0.32),transparent_62%)]" />
          <div className="pointer-events-none absolute bottom-0 left-[36%] h-px w-2/3 bg-gradient-to-r from-transparent via-fuchsia-300/60 to-transparent" />

          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-200/20 bg-black/20 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-fuchsia-100">
                <CircleDot className={"h-4 w-4 " + (isLive ? "animate-pulse text-pink-300" : "text-fuchsia-200")} />
                {isLive ? "Live draw" : isComplete ? "Draw complete" : "Burton Pride lottery"}
              </div>

              <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                {title}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/75 sm:text-lg">
                {message}
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <div className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-4 py-2 text-sm text-white/70">
                  <Clock3 className="h-4 w-4 shrink-0 text-fuchsia-200" />
                  <span>Draw time</span>
                  <strong className="font-bold text-white">
                    {formatDate(data?.lottery?.draw_at)}
                  </strong>
                </div>

                <div className={"inline-flex min-h-11 items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-bold " + statusClass}>
                  <CircleDot className={"h-4 w-4 " + (isLive ? "animate-pulse" : "")} />
                  {isLive ? "Draw happening now" : isComplete ? "Results finalised" : "Awaiting draw"}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-5 py-3 text-sm font-black text-white transition hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#151022] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={"h-4 w-4 " + (refreshing ? "animate-spin" : "")} />
              {refreshing ? "Refreshing" : "Refresh"}
            </button>
          </div>

          {countdownItems.length > 0 && !isLive && !isComplete && (
            <div className="relative mt-8 grid max-w-2xl grid-cols-4 gap-2 sm:gap-3">
              {countdownItems.map(([value, label]) => (
                <div key={String(label)} className="rounded-2xl border border-white/10 bg-black/25 px-2 py-3 text-center shadow-lg sm:px-4 sm:py-4">
                  <div className="text-2xl font-black tabular-nums text-white sm:text-4xl">
                    {String(value).padStart(2, "0")}
                  </div>
                  <div className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-fuchsia-100/75">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </header>

        {loading ? (
          <div className="flex min-h-80 flex-col items-center justify-center gap-4" role="status">
            <Loader2 className="h-9 w-9 animate-spin text-fuchsia-300" />
            <p className="text-sm font-bold text-white/60">Loading the draw centre…</p>
          </div>
        ) : error ? (
          <section className="mt-7 rounded-[2rem] border border-red-300/25 bg-red-500/10 p-6 text-red-50 sm:p-8" role="alert">
            <p className="text-lg font-black">Unable to load the live draw</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-red-100/80">{error}</p>
            <button
              type="button"
              onClick={() => void load(true)}
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-red-900 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-red-950"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          </section>
        ) : (
          <div className="mt-7 grid gap-7 xl:grid-cols-[minmax(0,1.4fr)_minmax(400px,0.9fr)]">
            <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#12111c]/95 shadow-[0_24px_70px_rgba(0,0,0,0.26)]">
              {isLive && draw?.broadcast_mode === "facebook_live" && videoUrl ? (
                <div className="aspect-video bg-black">
                  <iframe
                    title={title + " live on Facebook"}
                    src={facebookEmbedUrl(videoUrl)}
                    className="h-full w-full border-0"
                    allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="relative flex min-h-[420px] flex-col items-center justify-center overflow-hidden px-8 py-16 text-center sm:min-h-[500px]">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(192,38,211,0.28),transparent_48%),linear-gradient(135deg,rgba(255,255,255,0.035),transparent_42%)]" />
                  <div className="pointer-events-none absolute -right-20 top-12 h-64 w-64 rounded-full border border-fuchsia-200/10" />
                  <div className="pointer-events-none absolute -bottom-24 -left-20 h-72 w-72 rounded-full border border-blue-200/10" />

                  <div className="relative flex h-20 w-20 items-center justify-center rounded-[1.7rem] border border-fuchsia-100/25 bg-fuchsia-400/10 text-fuchsia-100 shadow-[0_0_45px_rgba(217,70,239,0.25)]">
                    {isLive ? <Sparkles className="h-10 w-10" /> : <CalendarDays className="h-10 w-10" />}
                  </div>
                  <p className="relative mt-7 text-xs font-black uppercase tracking-[0.18em] text-fuchsia-200">
                    Live draw centre
                  </p>
                  <h2 className="relative mt-3 max-w-3xl text-3xl font-black leading-tight text-white sm:text-4xl">
                    {statusMessage(data)}
                  </h2>
                  <p className="relative mt-4 max-w-xl text-sm leading-7 text-white/60 sm:text-base">
                    {isLive
                      ? "Keep this page open while Burton Pride completes the draw. Verified results will appear beside the draw centre."
                      : "This page refreshes automatically. Come back here when the draw begins to follow the results."}
                  </p>
                </div>
              )}

              <div className="flex items-start gap-3 border-t border-white/10 bg-black/20 p-5 text-sm leading-6 text-white/65 sm:p-6">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-fuchsia-200" />
                <p>Results appear only after Burton Pride has checked and published them. This page refreshes automatically every 15 seconds.</p>
              </div>
            </section>

            <aside className="rounded-[2rem] border border-white/10 bg-[#12111c]/95 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.26)] sm:p-7 xl:sticky xl:top-24 xl:self-start">
              <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-gradient-to-br from-yellow-300 to-amber-500 p-3 text-black shadow-[0_0_30px_rgba(250,204,21,0.22)]">
                    <Trophy className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.15em] text-yellow-200">Draw results</p>
                    <h2 className="text-2xl font-black text-white">Winners</h2>
                  </div>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-black text-white/70">
                  {publishedResults.length} published
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {publishedResults.length ? (
                  publishedResults.map((result, index) => (
                    <article
                      key={result.id}
                      className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-fuchsia-200/30 hover:bg-white/[0.045]"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500/15 text-sm font-black text-fuchsia-100 ring-1 ring-inset ring-fuchsia-200/10">
                        {result.display_order || index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-[0.1em] text-fuchsia-200">
                          {result.prize_label}
                        </p>
                        <p className="mt-1 truncate text-base font-black text-white sm:text-lg">
                          {result.winner_display_label}
                        </p>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 px-5 py-10 text-center">
                    <Trophy className="mx-auto h-8 w-8 text-white/20" />
                    <p className="mt-4 font-black text-white/80">No results published yet</p>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/55">
                      Winners will appear here after each result has been checked and approved for publication.
                    </p>
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
