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
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

function facebookEmbedUrl(url: string) {
  return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&width=1280`;
}

function getCountdownParts(drawAt: string | null | undefined, now: number) {
  if (!drawAt) return null;

  const difference = new Date(drawAt).getTime() - now;
  if (!Number.isFinite(difference) || difference <= 0) return null;

  const totalSeconds = Math.floor(difference / 1000);
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
  };
}

export default function LiveDrawClient({ slug }: { slug: string }) {
  const [data, setData] = useState<LiveDrawResponse | null>(null);
  const [publishedResults, setPublishedResults] = useState<
    NonNullable<PublishedWinnersResponse["results"]>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  async function load() {
    try {
      const response = await fetch(`/api/lottery/${encodeURIComponent(slug)}/live-draw`, {
        cache: "no-store",
      });
      const contentType = response.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        throw new Error("The live draw is not available yet. Please try again shortly.");
      }

      const next = (await response.json()) as LiveDrawResponse;

      if (!response.ok || !next.ok) {
        throw new Error(next.error || "Unable to load the live draw.");
      }

      const publishedResponse = await fetch(
        `/api/lottery/${encodeURIComponent(slug)}/published-winners`,
        { cache: "no-store" },
      );
      const published = (await publishedResponse.json()) as PublishedWinnersResponse;

      if (!publishedResponse.ok || !published.ok) {
        throw new Error(published.error || "Unable to load published winners.");
      }

      setData(next);
      setPublishedResults(published.results || []);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load the live draw.");
    } finally {
      setLoading(false);
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

  const isLive = data?.draw?.status === "live";
  const videoUrl = data?.draw?.facebook_live_url;
  const title = data?.lottery?.title || "Lottery draw";
  const countdown = getCountdownParts(data?.lottery?.draw_at, now);

  const statusCopy = useMemo(() => {
    if (isLive && data?.draw?.broadcast_mode === "facebook_live") return "Watch the draw live on Facebook";
    if (isLive && data?.draw?.broadcast_mode === "in_person") return "The draw is happening now — winners will appear here as they are confirmed";
    if (isLive) return "The draw is happening now — results will appear here shortly";
    if (data?.draw?.status === "paused") return "The draw is temporarily paused";
    if (data?.draw?.status === "completed") return "The draw has finished";
    return "The draw has not started yet";
  }, [data?.draw?.status, isLive]);

  return (
    <main className="relative min-h-screen overflow-hidden px-4 pb-14 pt-24 text-white sm:px-6 sm:pt-28 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[38rem] bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.2),transparent_65%)]" />
      <div className="relative mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-[2rem] border border-fuchsia-300/20 bg-gradient-to-br from-fuchsia-600/30 via-purple-700/25 to-blue-700/25 p-6 shadow-[0_28px_80px_rgba(88,28,135,0.25)] sm:p-10">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-pink-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-60 w-60 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/25 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em]">
                <CircleDot className={`h-4 w-4 ${isLive ? "animate-pulse text-red-300" : "text-white/70"}`} />
                {isLive ? "Live draw" : "Burton Pride lottery"}
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">{title}</h1>
              <p className="mt-3 text-base text-white/75 sm:text-lg">{data?.draw?.public_message || statusCopy}</p>
              <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white/75">
                <Clock3 className="h-4 w-4 text-fuchsia-200" />
                Draw time: <strong className="font-bold text-white">{formatDate(data?.lottery?.draw_at)}</strong>
              </div>

              {countdown && !isLive && data?.draw?.status !== "completed" ? (
                <div className="mt-6 grid max-w-xl grid-cols-4 gap-2 sm:gap-3">
                  {[
                    [countdown.days, "Days"],
                    [countdown.hours, "Hours"],
                    [countdown.minutes, "Minutes"],
                    [countdown.seconds, "Seconds"],
                  ].map(([value, label]) => (
                    <div key={label} className="rounded-2xl border border-white/15 bg-black/25 px-2 py-3 text-center shadow-lg backdrop-blur-sm sm:px-3">
                      <div className="text-2xl font-black tabular-nums text-white sm:text-3xl">{String(value).padStart(2, "0")}</div>
                      <div className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-fuchsia-100/80">{label}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`mt-6 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${isLive ? "border-red-300/30 bg-red-500/15 text-red-100" : "border-white/15 bg-black/20 text-white/70"}`}>
                  <CircleDot className={`h-4 w-4 ${isLive ? "animate-pulse" : ""}`} />
                  {isLive ? "Draw happening now" : data?.draw?.status === "completed" ? "Draw completed" : "Draw time will be announced soon"}
                </div>
              )}
            </div>
            <button onClick={() => void load()} className="relative inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-sm font-bold transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-fuchsia-300/70">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-80 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-fuchsia-300" /></div>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-500/10 p-5 text-red-100">{error}</div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.65fr_0.85fr]">
            <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#12131d]/95 shadow-2xl">
              {isLive && data?.draw?.broadcast_mode === "facebook_live" && videoUrl ? (
                <div className="aspect-video bg-black">
                  <iframe title={`${title} live on Facebook`} src={facebookEmbedUrl(videoUrl)} className="h-full w-full border-0" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowFullScreen />
                </div>
              ) : (
                <div className="relative flex aspect-video flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(192,38,211,0.32),transparent_55%)] p-8 text-center">
                  <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.025)_50%,transparent_100%)]" />
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-3xl border border-fuchsia-200/30 bg-fuchsia-500/15 text-fuchsia-100 shadow-[0_0_32px_rgba(217,70,239,0.24)]">
                    {isLive ? <Sparkles className="h-8 w-8" /> : <CalendarDays className="h-8 w-8" />}
                  </div>
                  <p className="relative mt-5 text-xs font-black uppercase tracking-[0.16em] text-fuchsia-200">Live draw centre</p>
                  <h2 className="relative mt-2 text-2xl font-black sm:text-3xl">{statusCopy}</h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-white/60">
                    {isLive
                      ? "This page refreshes automatically while Burton Pride runs the draw."
                      : "This page refreshes automatically. Please return here when the draw begins."}
                  </p>
                </div>
              )}
              <div className="flex items-start gap-3 border-t border-white/10 bg-black/15 p-5 text-sm leading-6 text-white/65">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-fuchsia-200" />
                <p>Results appear here only after Burton Pride has checked and published them. This page refreshes automatically every 15 seconds.</p>
              </div>
            </section>

            <aside className="rounded-[2rem] border border-white/10 bg-[#12131d]/95 p-6 shadow-xl lg:sticky lg:top-24 lg:self-start">
              <div className="flex items-center gap-3"><div className="rounded-2xl bg-gradient-to-br from-yellow-300 to-yellow-500 p-3 text-black shadow-[0_0_24px_rgba(250,204,21,0.22)]"><Trophy className="h-5 w-5" /></div><div><p className="text-xs font-black uppercase tracking-[0.14em] text-yellow-200">Draw results</p><h2 className="text-xl font-black">Winners</h2></div></div>
              <div className="mt-6 space-y-3">
                {publishedResults.length ? publishedResults.map((result, index) => (
                  <div key={result.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-fuchsia-300/30 hover:bg-white/[0.04]"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500/15 text-xs font-black text-fuchsia-100">{index + 1}</div><div><p className="text-xs font-bold uppercase tracking-wide text-fuchsia-200">{result.prize_label}</p><p className="mt-1 text-base font-black">{result.winner_display_label}</p></div></div>
                )) : <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm leading-6 text-white/60"><Trophy className="mb-3 h-5 w-5 text-white/25" />Winners will appear here after their result has been verified and published.</div>}
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}