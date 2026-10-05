"use client";

import { useEffect, useRef, useState } from "react";
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

type LotteryStatus =
  | "scheduled"
  | "live"
  | "paused"
  | "sales_closed"
  | "draw_ready"
  | "completed";
type LiveDrawData = {
  lottery: {
    title: string;
    slug: string;
    draw_at: string | null;
    status: LotteryStatus;
    show_in_public_directory: true;
    allow_page_before_sales: boolean;
    sales_open_at: string | null;
    results_publish_at: string | null;
  };
  draw: {
    status: "not_started" | "live" | "paused" | "completed";
    broadcast_mode: "facebook_live" | "in_person" | "results_only";
    facebook_live_url: string | null;
    public_message: string | null;
    started_at: string | null;
    ended_at: string | null;
  };
};
type PublishedResult = {
  id: string;
  display_order: number | null;
  prize_label: string;
  winner_display_label: string;
  published_at: string;
};
const PUBLIC_STATUSES = new Set([
  "scheduled",
  "live",
  "paused",
  "sales_closed",
  "draw_ready",
  "completed",
]);
const POLL_MS = 15000;
const PAGE_SIZE = 20;
const SAFE_ERROR = "The draw centre is unavailable. Please try again shortly.";
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid response");
  return value as Record<string, unknown>;
}
function timestamp(value: unknown): number | null {
  if (
    typeof value !== "string" ||
    value.length > 50 ||
    !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  )
    return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function date(value: unknown): string | null {
  return typeof value === "string" && timestamp(value) !== null ? value : null;
}
function text(value: unknown, max: number): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > max ||
    /[\u0000-\u001f\u007f]/.test(value)
  )
    throw new Error("Invalid label");
  return value.trim();
}
function safeFacebookUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      ![
        "facebook.com",
        "www.facebook.com",
        "m.facebook.com",
        "web.facebook.com",
        "fb.watch",
      ].includes(url.hostname)
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
// The public API must enforce these rules before returning any lottery data.
function parseLiveDraw(
  value: unknown,
  slug: string,
  now: number,
): LiveDrawData {
  const response = object(value);
  if (response.ok !== true) throw new Error("Unavailable");
  const lottery = object(response.lottery),
    draw = object(response.draw);
  if (
    lottery.slug !== slug ||
    lottery.show_in_public_directory !== true ||
    !PUBLIC_STATUSES.has(String(lottery.status))
  )
    throw new Error("Not public");
  const opens = timestamp(lottery.sales_open_at);
  if (
    (lottery.status === "scheduled" || lottery.status === "live") &&
    (opens === null || opens > now) &&
    lottery.allow_page_before_sales !== true
  )
    throw new Error("Pre-sale page disabled");
  if (
    !["not_started", "live", "paused", "completed"].includes(
      String(draw.status),
    ) ||
    !["facebook_live", "in_person", "results_only"].includes(
      String(draw.broadcast_mode),
    )
  )
    throw new Error("Invalid draw");
  return {
    lottery: {
      title: text(lottery.title, 300),
      slug,
      status: lottery.status as LotteryStatus,
      show_in_public_directory: true,
      allow_page_before_sales: lottery.allow_page_before_sales === true,
      sales_open_at: date(lottery.sales_open_at),
      draw_at: date(lottery.draw_at),
      results_publish_at: date(lottery.results_publish_at),
    },
    draw: {
      status: draw.status as LiveDrawData["draw"]["status"],
      broadcast_mode:
        draw.broadcast_mode as LiveDrawData["draw"]["broadcast_mode"],
      facebook_live_url: safeFacebookUrl(draw.facebook_live_url),
      public_message:
        draw.public_message == null || draw.public_message === ""
          ? null
          : text(draw.public_message, 2000),
      started_at: date(draw.started_at),
      ended_at: date(draw.ended_at),
    },
  };
}
function canShowResults(data: LiveDrawData, now: number): boolean {
  const publishes = timestamp(data.lottery.results_publish_at);
  return (
    data.lottery.status === "completed" &&
    data.draw.status === "completed" &&
    publishes !== null &&
    publishes <= now
  );
}
function parseResults(value: unknown, now: number): PublishedResult[] {
  const response = object(value);
  if (
    response.ok !== true ||
    !Array.isArray(response.results) ||
    response.results.length > 1000
  )
    throw new Error("Invalid results");
  const ids = new Set<string>();
  return response.results
    .flatMap((value: unknown) => {
      const r = object(value);
      const published = timestamp(r.published_at);
      // A row lacking a publication timestamp is never treated as published.
      if (published === null || published > now) return [];
      const id = text(r.id, 200);
      if (ids.has(id)) throw new Error("Duplicate result");
      ids.add(id);
      return [
        {
          id,
          display_order:
            typeof r.display_order === "number" &&
            Number.isSafeInteger(r.display_order) &&
            r.display_order > 0
              ? r.display_order
              : null,
          prize_label: text(r.prize_label, 300),
          winner_display_label: text(r.winner_display_label, 300),
          published_at: r.published_at as string,
        },
      ];
    })
    .sort(
      (a, b) =>
        (a.display_order ?? Number.MAX_SAFE_INTEGER) -
          (b.display_order ?? Number.MAX_SAFE_INTEGER) ||
        a.id.localeCompare(b.id),
    );
}
async function readJson(response: Response): Promise<unknown> {
  if (
    !response.ok ||
    !/application\/(?:json|[a-z0-9.+-]+\+json)(?:\s*;|$)/i.test(
      response.headers.get("content-type") || "",
    ) ||
    !response.body
  )
    throw new Error("Unavailable");
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let bytes = 0,
    body = "";
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 2 * 1024 * 1024) {
        await reader.cancel();
        throw new Error("Response too large");
      }
      body += decoder.decode(part.value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}
function formatDate(value: string | null | undefined) {
  if (timestamp(value) === null) return "To be confirmed";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value!));
}
function facebookEmbedUrl(url: string) {
  return (
    "https://www.facebook.com/plugins/video.php?href=" +
    encodeURIComponent(url) +
    "&show_text=false&width=1280"
  );
}
function getCountdownParts(drawAt: string | null | undefined, now: number) {
  const target = timestamp(drawAt);
  if (target === null || target <= now) return null;
  const seconds = Math.floor((target - now) / 1000);
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
}
function statusMessage(data: LiveDrawData | null) {
  if (
    data?.draw.status === "live" &&
    data.draw.broadcast_mode === "facebook_live"
  )
    return "Watch the draw live on Facebook";
  if (data?.draw.status === "live")
    return "The draw is happening now. Results will be shown after publication.";
  if (data?.draw.status === "paused") return "The draw is temporarily paused";
  if (data?.draw.status === "completed") return "The draw has finished";
  return "The draw has not started yet";
}

export default function LiveDrawClient({ slug }: { slug: string }) {
  const [data, setData] = useState<LiveDrawData | null>(null);
  const [publishedResults, setPublishedResults] = useState<PublishedResult[]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [page, setPage] = useState(1);
  const [consentedVideo, setConsentedVideo] = useState<string | null>(null);
  const reload = useRef<() => void>(() => {});
  useEffect(() => {
    let active = true,
      busy = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let requestTimeout: ReturnType<typeof setTimeout> | undefined;
    setData(null);
    setPublishedResults([]);
    setError(null);
    setResultsError(null);
    setLoading(true);
    setPage(1);
    setConsentedVideo(null);
    async function load() {
      if (!active || busy) return;
      clearTimeout(timer);
      busy = true;
      setRefreshing(true);
      controller = new AbortController();
      const signal = controller.signal;
      requestTimeout = setTimeout(() => controller?.abort(), 20000);
      try {
        if (!/^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/.test(slug) || slug.length > 200)
          throw new Error("Invalid slug");
        const base = "/api/lottery/" + encodeURIComponent(slug);
        const response = await fetch(base + "/live-draw", {
          cache: "no-store",
          signal,
        });
        const next = parseLiveDraw(await readJson(response), slug, Date.now());
        if (!active) return;
        setData(next);
        setError(null);
        setNow(Date.now());
        // Clear previously published names before checking the new snapshot.
        setPublishedResults([]);
        setResultsError(null);
        if (canShowResults(next, Date.now())) {
          try {
            const resultsResponse = await fetch(base + "/published-winners", {
              cache: "no-store",
              signal,
            });
            const results = parseResults(
              await readJson(resultsResponse),
              Date.now(),
            );
            if (active) setPublishedResults(results);
          } catch {
            if (active) {
              setPublishedResults([]);
              setResultsError(
                "Published results are unavailable. Please try again.",
              );
            }
          }
        }
      } catch {
        if (active) {
          setData(null);
          setPublishedResults([]);
          setResultsError(null);
          setConsentedVideo(null);
          setError(SAFE_ERROR);
        }
      } finally {
        clearTimeout(requestTimeout);
        busy = false;
        if (active) {
          setLoading(false);
          setRefreshing(false);
          timer = setTimeout(() => void load(), POLL_MS);
        }
      }
    }
    reload.current = () => void load();
    void load();
    return () => {
      active = false;
      clearTimeout(timer);
      clearTimeout(requestTimeout);
      controller?.abort();
      reload.current = () => {};
    };
  }, [slug]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  // Hide the old snapshot in the render that changes the slug, before effect cleanup.
  const current = data?.lottery.slug === slug ? data : null;
  const draw = current?.draw;
  const isLive = draw?.status === "live",
    isComplete = draw?.status === "completed";
  const title = current?.lottery.title || "Lottery draw";
  const message = current
    ? draw?.public_message || statusMessage(current)
    : loading
      ? "Loading the draw centre…"
      : "Draw information is unavailable";
  const countdown =
    draw?.status === "not_started"
      ? getCountdownParts(current?.lottery.draw_at, now)
      : null;
  const countdownItems: Array<[number, string]> = countdown
    ? [
        [countdown.days, "Days"],
        [countdown.hours, "Hours"],
        [countdown.minutes, "Minutes"],
        [countdown.seconds, "Seconds"],
      ]
    : [];
  const videoUrl =
    draw?.broadcast_mode === "facebook_live" ? draw.facebook_live_url : null;
  const resultsAllowed = current !== null && canShowResults(current, now);
  const results = resultsAllowed ? publishedResults : [];
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const shownResults = results.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const statusClass = isLive
    ? "border-pink-300/30 bg-pink-500/15 text-pink-100"
    : isComplete
      ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
      : "border-white/10 bg-black/20 text-white/65";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07060d] px-4 pb-14 pt-24 text-white sm:px-6 sm:pt-28 lg:px-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[42rem] bg-[radial-gradient(ellipse_at_top,rgba(126,34,206,0.28),transparent_62%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[-9rem] top-[30rem] h-96 w-96 rounded-full bg-fuchsia-600/10 blur-[110px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[-8rem] top-64 h-[28rem] w-[28rem] rounded-full bg-blue-600/10 blur-[120px]"
      />
      <div className="relative mx-auto w-full max-w-[1440px]">
        <header className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#151022]/90 p-6 shadow-[0_30px_100px_rgba(49,9,93,0.32)] backdrop-blur-xl sm:p-9 lg:p-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-[52%] bg-[radial-gradient(circle_at_top_right,rgba(217,70,239,0.32),transparent_62%)]"
          />
          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-200/20 bg-black/20 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-fuchsia-100">
                <CircleDot
                  aria-hidden="true"
                  className={
                    "h-4 w-4 " +
                    (isLive
                      ? "motion-safe:animate-pulse text-pink-300"
                      : "text-fuchsia-200")
                  }
                />
                {isLive
                  ? "Live draw"
                  : isComplete
                    ? "Draw complete"
                    : "Burton Pride lottery"}
              </div>
              <h1 className="mt-5 max-w-3xl break-words text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                {title}
              </h1>
              <p className="mt-4 max-w-2xl whitespace-pre-wrap break-words text-base leading-7 text-white/75 sm:text-lg">
                {message}
              </p>
              {current && (
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <div className="inline-flex min-h-11 flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-4 py-2 text-sm text-white/70">
                    <Clock3
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-fuchsia-200"
                    />
                    <span>Draw time (UK)</span>
                    <strong className="font-bold text-white">
                      {formatDate(current.lottery.draw_at)}
                    </strong>
                  </div>
                  <div
                    role="status"
                    className={
                      "inline-flex min-h-11 items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-bold " +
                      statusClass
                    }
                  >
                    <CircleDot
                      aria-hidden="true"
                      className={
                        "h-4 w-4 " + (isLive ? "motion-safe:animate-pulse" : "")
                      }
                    />
                    {isLive
                      ? "Draw happening now"
                      : isComplete
                        ? "Draw finished"
                        : draw?.status === "paused"
                          ? "Draw paused"
                          : "Awaiting draw"}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => reload.current()}
              disabled={refreshing || loading}
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-5 py-3 text-sm font-black text-white transition hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#151022] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                aria-hidden="true"
                className={
                  "h-4 w-4 " + (refreshing ? "motion-safe:animate-spin" : "")
                }
              />
              {refreshing ? "Refreshing" : "Refresh"}
            </button>
          </div>
          {countdownItems.length > 0 && (
            <div
              aria-label="Time until scheduled draw"
              className="relative mt-8 grid max-w-2xl grid-cols-4 gap-2 sm:gap-3"
            >
              {countdownItems.map(([value, label]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/10 bg-black/25 px-2 py-3 text-center shadow-lg sm:px-4 sm:py-4"
                >
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
          <div
            className="flex min-h-80 flex-col items-center justify-center gap-4"
            role="status"
          >
            <Loader2
              aria-hidden="true"
              className="h-9 w-9 motion-safe:animate-spin text-fuchsia-300"
            />
            <p className="text-sm font-bold text-white/60">
              Loading the draw centre…
            </p>
          </div>
        ) : error || !current ? (
          <section
            className="mt-7 rounded-[2rem] border border-red-300/25 bg-red-500/10 p-6 text-red-50 sm:p-8"
            role="alert"
          >
            <p className="text-lg font-black">Unable to load the live draw</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-red-100/80">
              {error || SAFE_ERROR}
            </p>
            <button
              type="button"
              onClick={() => reload.current()}
              disabled={refreshing}
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-red-900 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-red-950 disabled:opacity-60"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Try again
            </button>
          </section>
        ) : (
          <div className="mt-7 grid gap-7 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]">
            <section className="min-w-0 overflow-hidden rounded-[2rem] border border-white/10 bg-[#12111c]/95 shadow-[0_24px_70px_rgba(0,0,0,0.26)]">
              {isLive && videoUrl && consentedVideo === videoUrl ? (
                <div className="aspect-video bg-black">
                  <iframe
                    title={title + " live on Facebook"}
                    src={facebookEmbedUrl(videoUrl)}
                    className="h-full w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    sandbox="allow-scripts allow-same-origin allow-presentation"
                    allow="encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="relative flex min-h-[420px] flex-col items-center justify-center overflow-hidden px-6 py-16 text-center sm:min-h-[500px]">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(192,38,211,0.28),transparent_48%),linear-gradient(135deg,rgba(255,255,255,0.035),transparent_42%)]"
                  />
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-[1.7rem] border border-fuchsia-100/25 bg-fuchsia-400/10 text-fuchsia-100 shadow-[0_0_45px_rgba(217,70,239,0.25)]">
                    {isLive ? (
                      <Sparkles aria-hidden="true" className="h-10 w-10" />
                    ) : (
                      <CalendarDays aria-hidden="true" className="h-10 w-10" />
                    )}
                  </div>
                  <p className="relative mt-7 text-xs font-black uppercase tracking-[0.18em] text-fuchsia-200">
                    Live draw centre
                  </p>
                  <h2 className="relative mt-3 max-w-3xl text-3xl font-black leading-tight text-white sm:text-4xl">
                    {statusMessage(current)}
                  </h2>
                  <p className="relative mt-4 max-w-xl text-sm leading-7 text-white/65 sm:text-base">
                    {isComplete
                      ? "Published results are shown when the lottery is complete and its publication time has arrived."
                      : "This page checks for updates after each refresh. Results remain hidden until publication is available."}
                  </p>
                  {isLive && videoUrl && (
                    <div className="relative mt-6">
                      <p className="max-w-xl text-sm leading-6 text-white/70">
                        Loading the player connects to Facebook, which may use
                        cookies and receive your device information.
                      </p>
                      <button
                        type="button"
                        onClick={() => setConsentedVideo(videoUrl)}
                        className="mt-4 min-h-12 rounded-xl bg-fuchsia-200 px-5 py-3 font-black text-purple-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                      >
                        Load Facebook video
                      </button>
                      <a
                        href={videoUrl}
                        rel="noreferrer noopener"
                        className="ml-4 inline-flex min-h-12 items-center rounded-lg px-3 text-sm font-bold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
                      >
                        Watch on Facebook
                      </a>
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-start gap-3 border-t border-white/10 bg-black/20 p-5 text-sm leading-6 text-white/65 sm:p-6">
                <ShieldCheck
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-fuchsia-200"
                />
                <p>
                  This page shows published display labels supplied by Burton
                  Pride. It checks again 15 seconds after each refresh finishes.
                </p>
              </div>
            </section>
            <aside className="min-w-0 rounded-[2rem] border border-white/10 bg-[#12111c]/95 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.26)] sm:p-7 xl:sticky xl:top-24 xl:self-start">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-gradient-to-br from-yellow-300 to-amber-500 p-3 text-black shadow-[0_0_30px_rgba(250,204,21,0.22)]">
                    <Trophy aria-hidden="true" className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.15em] text-yellow-200">
                      Draw results
                    </p>
                    <h2 className="text-2xl font-black text-white">Winners</h2>
                  </div>
                </div>
                {!resultsError && (
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-black text-white/70">
                    {results.length} published results loaded
                  </span>
                )}
              </div>
              <div className="mt-5 space-y-3">
                {resultsError ? (
                  <p
                    role="alert"
                    className="rounded-2xl border border-red-300/25 bg-red-500/10 p-4 text-sm text-red-100"
                  >
                    {resultsError}
                  </p>
                ) : results.length ? (
                  shownResults.map((result, index) => (
                    <article
                      key={result.id}
                      className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-fuchsia-200/30 hover:bg-white/[0.045]"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500/15 text-sm font-black text-fuchsia-100 ring-1 ring-inset ring-fuchsia-200/10">
                        {result.display_order ??
                          (currentPage - 1) * PAGE_SIZE + index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="break-words text-xs font-black uppercase tracking-[0.1em] text-fuchsia-200">
                          {result.prize_label}
                        </p>
                        <p className="mt-1 break-words text-base font-black text-white sm:text-lg">
                          {result.winner_display_label}
                        </p>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 px-5 py-10 text-center">
                    <Trophy
                      aria-hidden="true"
                      className="mx-auto h-8 w-8 text-white/40"
                    />
                    <p className="mt-4 font-black text-white/80">
                      {refreshing && resultsAllowed
                        ? "Checking published results…"
                        : "No results available yet"}
                    </p>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/65">
                      Results are shown after lottery completion and the
                      scheduled publication time.
                    </p>
                  </div>
                )}
                {pageCount > 1 && (
                  <nav
                    aria-label="Published result pages"
                    className="flex flex-wrap items-center justify-between gap-3 pt-3 text-sm"
                  >
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => setPage(currentPage - 1)}
                      className="min-h-11 rounded-xl border border-white/20 px-3 font-bold disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
                    >
                      Previous results
                    </button>
                    <p role="status">
                      Page {currentPage} of {pageCount}
                    </p>
                    <button
                      type="button"
                      disabled={currentPage === pageCount}
                      onClick={() => setPage(currentPage + 1)}
                      className="min-h-11 rounded-xl border border-white/20 px-3 font-bold disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
                    >
                      Next results
                    </button>
                  </nav>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
