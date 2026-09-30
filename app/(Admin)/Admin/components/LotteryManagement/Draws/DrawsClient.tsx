"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createPortal } from "react-dom";

import LiveDrawSettingsPanel from "./LiveDrawSettingsPanel";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Eye,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Trophy,
  X,
} from "lucide-react";

type DrawStatus =
  | "upcoming"
  | "not_ready"
  | "ready"
  | "running"
  | "completed"
  | "blocked"
  | "under_review"
  | "redraw_requested"
  | "superseded";

type LotteryDrawListItem = {
  id: string;

  title: string;

  slug: string;

  internal_reference: string | null;

  lottery_status: string;

  draw_at: string | null;

  sales_close_at: string | null;

  paid_orders: number;

  eligible_tickets: number;

  excluded_tickets: number;

  prizes_available: number;

  draw_status: DrawStatus;

  latest_draw_id: string | null;
};

type DrawsResponse = {
  ok?: boolean;

  items?: LotteryDrawListItem[];

  summary?: {
    ready: number;

    upcoming: number;

    completed: number;

    blocked: number;
  };

  error?: string;

  message?: string;
};

type ReadinessCheck = {
  key: string;

  label: string;

  ok: boolean;

  detail?: string | null;
};

type ReadinessResponse = {
  ok?: boolean;

  lottery: {
    id: string;

    title: string;

    internal_reference: string | null;

    draw_at: string | null;

    sales_close_at: string | null;
  };

  metrics: {
    paid_orders: number;

    eligible_tickets: number;

    excluded_tickets: number;

    prizes_available: number;
  };

  ready: boolean;

  checks: ReadinessCheck[];

  error?: string;

  message?: string;
};

type DrawResult = {
  ok?: boolean;

  draw: {
    id: string;

    completed_at: string;

    eligible_ticket_count: number;

    snapshot_hash: string;
  };

  winners: Array<{
    prize_id: string;

    prize_name: string;

    ticket_id: string;

    ticket_number: string;

    winner_status: string;
  }>;

  error?: string;

  message?: string;

  code?: string;

  request_id?: string;

  details?: unknown;
};

type DrawErrorDiagnostics = { requestId?: string };

type FilterStatus = "all" | "ready" | "upcoming" | "completed" | "review";

type SortMode = "draw_date" | "sales_close" | "title" | "tickets";

const DRAW_LIST_ROUTE = "/api/admin/lotterymanagement/draws";

function drawReadinessRoute(id: string) {
  return `${DRAW_LIST_ROUTE}/${encodeURIComponent(id)}/draw-readiness`;
}
function runDrawRoute(id: string) {
  return `${DRAW_LIST_ROUTE}/${encodeURIComponent(id)}/draw`;
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function text(value: unknown): value is string {
  return (
    typeof value === "string" && value.trim().length > 0 && value.length <= 2048
  );
}
function nullableText(value: unknown) {
  return value === null || text(value);
}
function count(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}
function date(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}
function nullableDate(value: unknown) {
  return value === null || date(value);
}
function metrics(value: unknown) {
  return (
    record(value) &&
    [
      "paid_orders",
      "eligible_tickets",
      "excluded_tickets",
      "prizes_available",
    ].every((key) => count(value[key]))
  );
}
function isDrawsResponse(
  value: unknown,
): value is DrawsResponse & { items: LotteryDrawListItem[] } {
  if (
    !record(value) ||
    value.ok === false ||
    !Array.isArray(value.items) ||
    value.items.length > 10000
  )
    return false;
  const statuses = [
    "upcoming",
    "not_ready",
    "ready",
    "running",
    "completed",
    "blocked",
    "under_review",
    "redraw_requested",
    "superseded",
  ];
  const ids = new Set();
  if (
    !value.items.every((item) => {
      if (!record(item) || !text(item.id) || ids.has(item.id)) return false;
      ids.add(item.id);
      return (
        text(item.title) &&
        text(item.slug) &&
        nullableText(item.internal_reference) &&
        text(item.lottery_status) &&
        nullableDate(item.draw_at) &&
        nullableDate(item.sales_close_at) &&
        metrics(item) &&
        statuses.includes(String(item.draw_status)) &&
        nullableText(item.latest_draw_id)
      );
    })
  )
    return false;
  return (
    value.summary === undefined ||
    (record(value.summary) &&
      ["ready", "upcoming", "completed", "blocked"].every((key) =>
        count((value.summary as Record<string, unknown>)[key]),
      ))
  );
}
function isReadinessResponse(value: unknown): value is ReadinessResponse {
  if (
    !record(value) ||
    value.ok === false ||
    !record(value.lottery) ||
    !metrics(value.metrics) ||
    typeof value.ready !== "boolean" ||
    !Array.isArray(value.checks) ||
    value.checks.length > 100
  )
    return false;
  const lottery = value.lottery;
  const keys = new Set();
  return (
    text(lottery.id) &&
    text(lottery.title) &&
    nullableText(lottery.internal_reference) &&
    nullableDate(lottery.draw_at) &&
    nullableDate(lottery.sales_close_at) &&
    value.checks.every((check) => {
      if (!record(check) || !text(check.key) || keys.has(check.key))
        return false;
      keys.add(check.key);
      // Check descriptions may contain backend diagnostics; render only approved labels below.
      return (
        text(check.label) &&
        typeof check.ok === "boolean" &&
        (check.detail === undefined || nullableText(check.detail))
      );
    })
  );
}
function canRunDraw(
  item: LotteryDrawListItem,
  readiness: ReadinessResponse | null,
  now = Date.now(),
) {
  return Boolean(
    readiness &&
    readiness.lottery.id === item.id &&
    readiness.ready === true &&
    readiness.checks.length > 0 &&
    readiness.checks.every((check) => check.ok === true) &&
    readiness.metrics.paid_orders > 0 &&
    readiness.metrics.eligible_tickets > 0 &&
    readiness.metrics.prizes_available > 0 &&
    readiness.lottery.draw_at &&
    Date.parse(readiness.lottery.draw_at) <= now &&
    readiness.lottery.sales_close_at &&
    Date.parse(readiness.lottery.sales_close_at) <= now &&
    ["sales_closed", "draw_ready"].includes(item.lottery_status) &&
    item.draw_status === "ready" &&
    !item.latest_draw_id,
  );
}
function isDrawResult(value: unknown): value is DrawResult {
  if (
    !record(value) ||
    value.ok === false ||
    !record(value.draw) ||
    !Array.isArray(value.winners) ||
    value.winners.length === 0 ||
    value.winners.length > 10000
  )
    return false;
  const draw = value.draw;
  return (
    text(draw.id) &&
    date(draw.completed_at) &&
    count(draw.eligible_ticket_count) &&
    draw.eligible_ticket_count > 0 &&
    typeof draw.snapshot_hash === "string" &&
    /^[a-f0-9]{64}$/i.test(draw.snapshot_hash) &&
    value.winners.every(
      (winner) =>
        record(winner) &&
        [
          "prize_id",
          "prize_name",
          "ticket_id",
          "ticket_number",
          "winner_status",
        ].every((key) => text(winner[key])),
    )
  );
}
function requestId(value: unknown): string | undefined {
  return record(value) &&
    typeof value.request_id === "string" &&
    /^[a-zA-Z0-9_-]{8,80}$/.test(value.request_id)
    ? value.request_id
    : undefined;
}
function publicCheck(check: ReadinessCheck): string {
  const labels: Record<string, string> = {
    sales_closed: "Sales closed",
    draw_time: "Draw time reached",
    eligible_tickets: "Eligible ticket pool",
    prizes_ready: "Prize readiness",
    no_existing_draw: "Existing draw check",
    compliance: "Compliance check",
    integrity_warnings: "Integrity warning check",
  };
  return labels[check.key] || "Server readiness check";
}
// Keep the timeout active through body consumption and bound response memory.
async function requestJson(
  url: string,
  init: RequestInit = {},
  signal?: AbortSignal,
): Promise<{ response: Response; data: unknown }> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, init.method === "POST" ? 60000 : 15000);
  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    });
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Response unavailable");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 4 * 1024 * 1024) {
          await reader.cancel();
          throw new Error("Response too large");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return {
      response,
      data: JSON.parse(new TextDecoder().decode(body)) as unknown,
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";
  if (!date(value)) return "Unavailable";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",

    timeStyle: "short",

    timeZone: "Europe/London",
  }).format(new Date(value));
}

function statusLabel(status: DrawStatus) {
  const labels: Record<DrawStatus, string> = {
    upcoming: "Upcoming",

    not_ready: "Not ready",

    ready: "Readiness reported",

    running: "Running",

    completed: "Completed",

    blocked: "Blocked",

    under_review: "Under review",

    redraw_requested: "Redraw requested",

    superseded: "Superseded",
  };

  return labels[status];
}

function statusClass(status: DrawStatus) {
  const map: Record<DrawStatus, string> = {
    upcoming: "border-amber-400/25 bg-amber-500/10 text-amber-200",

    not_ready: "border-white/15 bg-white/10 text-white/70",

    ready: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",

    running: "border-purple-400/25 bg-purple-500/10 text-purple-200",

    completed: "border-cyan-400/25 bg-cyan-500/10 text-cyan-200",

    blocked: "border-red-400/25 bg-red-500/10 text-red-200",

    under_review: "border-orange-400/25 bg-orange-500/10 text-orange-200",

    redraw_requested: "border-yellow-400/25 bg-yellow-500/10 text-yellow-200",

    superseded: "border-white/15 bg-white/10 text-white/60",
  };

  return map[status];
}

export default function DrawsClient() {
  const [items, setItems] = useState<LotteryDrawListItem[]>([]);

  const [summary, setSummary] = useState<
    Required<DrawsResponse>["summary"] | null
  >(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [errorDiagnostics, setErrorDiagnostics] =
    useState<DrawErrorDiagnostics | null>(null);

  const [search, setSearch] = useState("");

  const [status, setStatus] = useState<FilterStatus>("all");

  const [sort, setSort] = useState<SortMode>("draw_date");

  const [selected, setSelected] = useState<LotteryDrawListItem | null>(null);

  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);

  const [loadingReadiness, setLoadingReadiness] = useState(false);

  const [confirm, setConfirm] = useState(false);

  const [running, setRunning] = useState(false);

  const [result, setResult] = useState<DrawResult | null>(null);

  const listRequest = useRef<AbortController | null>(null);
  const readinessRequest = useRef<AbortController | null>(null);
  const runRequest = useRef<AbortController | null>(null);
  const drawInFlight = useRef(false);
  const attempted = useRef(new Set<string>());
  const readinessAt = useRef(0);
  const [attemptedHere, setAttemptedHere] = useState(false);

  const loadDraws = useCallback(async () => {
    listRequest.current?.abort();
    const controller = new AbortController();
    listRequest.current = controller;
    setLoading(true);
    setSummary(null);
    setError(null);
    try {
      const { response, data } = await requestJson(
        DRAW_LIST_ROUTE,
        {},
        controller.signal,
      );
      if (!response.ok || !isDrawsResponse(data))
        throw new Error("Invalid list");
      if (controller.signal.aborted) return;
      setItems(data.items);
      setSummary(
        data.summary || {
          ready: data.items.filter((x) => x.draw_status === "ready").length,
          upcoming: data.items.filter((x) =>
            ["upcoming", "not_ready"].includes(x.draw_status),
          ).length,
          completed: data.items.filter((x) => x.draw_status === "completed")
            .length,
          blocked: data.items.filter((x) =>
            ["blocked", "under_review", "redraw_requested"].includes(
              x.draw_status,
            ),
          ).length,
        },
      );
    } catch {
      if (!controller.signal.aborted) {
        setItems([]);
        setError(
          "Draw records are unavailable. Check your access and try refreshing.",
        );
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDraws();
    return () => {
      listRequest.current?.abort();
      readinessRequest.current?.abort();
      runRequest.current?.abort();
    };
  }, [loadDraws]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    const result = items.filter((item) => {
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.slug.toLowerCase().includes(q) ||
        (item.internal_reference || "").toLowerCase().includes(q);

      const matchesStatus =
        status === "all" ||
        (status === "ready" && item.draw_status === "ready") ||
        (status === "upcoming" &&
          ["upcoming", "not_ready"].includes(item.draw_status)) ||
        (status === "completed" && item.draw_status === "completed") ||
        (status === "review" &&
          ["blocked", "under_review", "redraw_requested"].includes(
            item.draw_status,
          ));

      return matchesSearch && matchesStatus;
    });

    return result.sort((a, b) => {
      switch (sort) {
        case "sales_close":
          return (
            +new Date(a.sales_close_at || "9999-12-31") -
            +new Date(b.sales_close_at || "9999-12-31")
          );

        case "title":
          return a.title.localeCompare(b.title);

        case "tickets":
          return b.eligible_tickets - a.eligible_tickets;

        default:
          return (
            +new Date(a.draw_at || "9999-12-31") -
            +new Date(b.draw_at || "9999-12-31")
          );
      }
    });
  }, [items, search, status, sort]);

  async function openDraw(item: LotteryDrawListItem) {
    readinessRequest.current?.abort();
    const controller = new AbortController();
    readinessRequest.current = controller;
    readinessAt.current = 0;
    setSelected(item);
    setReadiness(null);
    setResult(null);
    setConfirm(false);
    setAttemptedHere(attempted.current.has(item.id));
    setLoadingReadiness(true);
    setError(null);
    setErrorDiagnostics(null);
    try {
      const { response, data } = await requestJson(
        drawReadinessRoute(item.id),
        {},
        controller.signal,
      );
      if (
        !response.ok ||
        !isReadinessResponse(data) ||
        data.lottery.id !== item.id
      )
        throw new Error("Invalid readiness");
      if (controller.signal.aborted) return;
      readinessAt.current = Date.now();
      setReadiness(data);
    } catch {
      if (!controller.signal.aborted)
        setError(
          "Draw readiness is unavailable. No draw was submitted by this check.",
        );
    } finally {
      if (!controller.signal.aborted) setLoadingReadiness(false);
    }
  }

  async function runDraw() {
    if (
      !selected ||
      !confirm ||
      drawInFlight.current ||
      attempted.current.has(selected.id)
    )
      return;
    if (
      !canRunDraw(selected, readiness) ||
      Date.now() - readinessAt.current > 60000
    ) {
      setConfirm(false);
      setError(
        "Readiness is blocked or has expired. Close and reopen this draw to check again.",
      );
      return;
    }
    // Synchronous UI guard only. The server must enforce a single draw under a database lock.
    drawInFlight.current = true;
    setRunning(true);
    setConfirm(false);
    setError(null);
    setErrorDiagnostics(null);
    const controller = new AbortController();
    runRequest.current = controller;
    let submitted = false;
    try {
      // Settings may have changed since the modal opened. Refresh only the read;
      // a POST is never retried. These checks do not replace atomic server checks.
      const fresh = await requestJson(
        drawReadinessRoute(selected.id),
        {},
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (
        !fresh.response.ok ||
        !isReadinessResponse(fresh.data) ||
        !canRunDraw(selected, fresh.data)
      ) {
        setReadiness(null);
        setError(
          "The final readiness check failed. No draw was submitted. Review the server checks before further action.",
        );
        return;
      }
      setReadiness(fresh.data);
      attempted.current.add(selected.id);
      setAttemptedHere(true);
      submitted = true;
      const { response, data } = await requestJson(
        runDrawRoute(selected.id),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmed: true }),
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setErrorDiagnostics({ requestId: requestId(data) });
      if (!response.ok || !isDrawResult(data))
        throw new Error("Draw outcome unverified");
      setResult(data);
      // Do not clear the returned result or mistake a list refresh failure for a draw failure.
      void loadDraws();
    } catch {
      if (!controller.signal.aborted)
        setError(
          submitted
            ? "The draw outcome could not be verified. It may have completed. Check draw records, winners and the audit log before any further action. Another submission is blocked for this lottery in this screen session."
            : "The final readiness check is unavailable. No draw was submitted. Close and reopen the draw to check again.",
        );
    } finally {
      drawInFlight.current = false;
      if (!controller.signal.aborted) setRunning(false);
    }
  }

  return (
    <div className="w-full max-w-none space-y-6 px-0 py-4 md:py-6">
      {/* Header - same layout as Prizes */}

      <section className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
              <Trophy className="h-5 w-5 text-white" />
            </div>

            <div>
              <h1 className="text-2xl font-extrabold text-white">Draws</h1>

              <p className="mt-1 max-w-3xl text-sm leading-6 text-white/60">
                Request lottery draws, check eligible tickets, review draw
                readiness and see completed results.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"

              onClick={loadDraws}

              disabled={loading}

              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-4 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>
      </section>

      {/* Stats - same StatCard styling as Prizes */}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Readiness reported"
          value={summary ? String(summary.ready) : "Unavailable"}
        />

        <StatCard
          label="Upcoming"
          value={summary ? String(summary.upcoming) : "Unavailable"}
        />

        <StatCard
          label="Completed"
          value={summary ? String(summary.completed) : "Unavailable"}
        />

        <StatCard
          label="Blocked / review"

          value={summary ? String(summary.blocked) : "Unavailable"}
        />
      </section>

      {error && !selected ? (
        <DrawErrorPanel
          error={error}

          lottery={selected}

          readiness={readiness}

          diagnostics={errorDiagnostics}
        />
      ) : null}

      {/* Search & filters - same structure as Prizes */}

      <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
        <div className="mb-5 flex items-center gap-2">
          <Filter className="h-4 w-4 text-white/65" />

          <h2 className="text-lg font-bold text-white">Search & filters</h2>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />

            <input
              aria-label="Search draws"
              value={search}

              onChange={(event) => setSearch(event.target.value)}

              placeholder="Lottery, reference or slug..."

              className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/35"
            />
          </div>

          <Select
            label="Filter draw status"
            value={status}

            onChange={(value) => setStatus(value as FilterStatus)}
          >
            <option value="all">All draw statuses</option>

            <option value="ready">Ready to draw</option>

            <option value="upcoming">Upcoming</option>

            <option value="completed">Completed</option>

            <option value="review">Blocked / under review</option>
          </Select>

          <Select
            label="Sort draws"
            value={sort}

            onChange={(value) => setSort(value as SortMode)}
          >
            <option value="draw_date">Draw date</option>

            <option value="sales_close">Sales closing date</option>

            <option value="title">Lottery title A-Z</option>

            <option value="tickets">Most eligible tickets</option>
          </Select>
        </div>
      </section>

      {/* Draw register - same register card style as Prizes */}

      <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-white">Draw register</h2>

          <p className="mt-1 text-sm text-white/50">
            Showing {filtered.length} of {items.length} draw records
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-52 items-center justify-center text-white/65">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading draws...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
            <Trophy className="mx-auto h-8 w-8 text-white/30" />

            <h3 className="mt-3 font-bold text-white">No draws found</h3>

            <p className="mt-1 text-sm text-white/50">
              Change the selected filters or wait until a lottery is ready for
              its draw.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((item) => (
              <DrawRow
                key={item.id}

                item={item}

                onOpen={() => openDraw(item)}
              />
            ))}
          </div>
        )}
      </section>

      {selected ? (
        <DrawModal
          item={selected}

          readiness={readiness}

          loadingReadiness={loadingReadiness}

          result={result}

          attemptedHere={attemptedHere}
          error={error}
          diagnostics={errorDiagnostics}

          confirm={confirm}

          running={running}

          setConfirm={setConfirm}

          onRun={runDraw}

          onClose={() => {
            if (!running && !drawInFlight.current) {
              setSelected(null);

              setReadiness(null);

              setResult(null);

              setConfirm(false);

              readinessRequest.current?.abort();

              setErrorDiagnostics(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function DrawErrorPanel({
  error,
  diagnostics,
}: {
  error: string;
  lottery?: LotteryDrawListItem | null;
  readiness?: ReadinessResponse | null;
  diagnostics: DrawErrorDiagnostics | null;
}) {
  return (
    <section
      role="alert"
      className="mb-5 rounded-2xl border border-red-400/35 bg-red-500/10 p-5 text-red-50"
    >
      <h2 className="font-bold">Draw action needs review</h2>
      <p className="mt-2 text-sm leading-6">{error}</p>
      {diagnostics?.requestId ? (
        <p className="mt-3 break-all text-xs">
          Request reference: {diagnostics.requestId}
        </p>
      ) : null}
    </section>
  );
}

function StatCard({
  label,

  value,
}: {
  label: string;

  value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
      <div className="text-2xl font-black text-white">{value}</div>

      <div className="mt-1 text-sm text-white/55">{label}</div>
    </div>
  );
}

function Select({
  label,
  value,

  onChange,

  children,
}: {
  label: string;
  value: string;

  onChange: (value: string) => void;

  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}

        onChange={(event) => onChange(event.target.value)}

        className="w-full appearance-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 pr-10 text-sm text-white outline-none"
      >
        {children}
      </select>

      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
    </div>
  );
}

function DrawRow({
  item,

  onOpen,
}: {
  item: LotteryDrawListItem;

  onOpen: () => void;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 flex-1 gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <Trophy className="h-6 w-6 text-white/25" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-extrabold text-white">
                {item.title}
              </h3>

              <span
                className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClass(
                  item.draw_status,
                )}`}
              >
                {statusLabel(item.draw_status)}
              </span>

              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/55">
                {item.lottery_status.replaceAll("_", " ")}
              </span>
            </div>

            <p className="mt-2 text-sm font-semibold text-white/70">
              {item.internal_reference || item.slug}
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <Info
                label="Sales close"

                value={formatDate(item.sales_close_at)}
              />

              <Info
                label="Draw date"

                value={formatDate(item.draw_at)}
              />

              <Info
                label="Paid orders"

                value={String(item.paid_orders)}
              />

              <Info
                label="Eligible tickets"

                value={String(item.eligible_tickets)}
              />

              <Info
                label="Excluded tickets"

                value={String(item.excluded_tickets)}
              />

              <Info
                label="Prizes"

                value={String(item.prizes_available)}
              />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"

            onClick={onOpen}

            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-white hover:bg-white/10"
          >
            <Eye className="h-3.5 w-3.5" />

            {item.draw_status === "completed" ? "View draw" : "Open draw"}
          </button>
        </div>
      </div>
    </article>
  );
}

function Info({
  label,

  value,
}: {
  label: string;

  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wide text-white/35">
        {label}
      </div>

      <div className="mt-1 break-words text-xs font-bold text-white/75">
        {value}
      </div>
    </div>
  );
}

function DrawModal({
  item,

  readiness,

  loadingReadiness,

  result,

  attemptedHere,
  error,
  diagnostics,

  confirm,

  running,

  setConfirm,

  onRun,

  onClose,
}: {
  item: LotteryDrawListItem;

  readiness: ReadinessResponse | null;

  loadingReadiness: boolean;

  result: DrawResult | null;

  attemptedHere: boolean;
  error: string | null;
  diagnostics: DrawErrorDiagnostics | null;

  confirm: boolean;

  running: boolean;

  setConfirm: (value: boolean) => void;

  onRun: () => void;

  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    if (!mounted || !dialog.current) return;
    const element = dialog.current;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [mounted]);
  if (!mounted) return null;
  return createPortal(
    <dialog
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        if (!running) onClose();
      }}
      className="m-auto w-[calc(100%-1.5rem)] max-w-5xl bg-transparent p-0 text-white backdrop:bg-black/75 backdrop:backdrop-blur-sm"

      aria-labelledby="draw-details-title"
    >
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#15172a] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5 md:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>

            <div>
              <h2
                id="draw-details-title"

                className="text-xl font-extrabold text-white"
              >
                {item.title}
              </h2>

              <p className="mt-1 text-sm text-white/55">Draw controls</p>
            </div>
          </div>

          <button
            type="button"

            onClick={onClose}

            disabled={running}

            className="rounded-xl border border-white/10 p-2 text-white/70 hover:bg-white/10 disabled:opacity-40"

            aria-label="Close draw details"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 md:p-6">
          {error ? (
            <DrawErrorPanel error={error} diagnostics={diagnostics} />
          ) : null}
          {(attemptedHere || running) && !result ? (
            <p
              role="status"
              className="mb-5 rounded-2xl border border-amber-400/30 p-4 text-sm"
            >
              {running
                ? "Draw request in progress. Keep this screen open."
                : "A draw request has been sent for this lottery. Verify the server records and audit log; this screen will not submit it again."}
            </p>
          ) : null}
          {!running && !attemptedHere && !loadingReadiness && readiness ? (
            <div className="mb-6">
              <LiveDrawSettingsPanel lotteryId={item.id} />
            </div>
          ) : null}

          {loadingReadiness ? (
            <div className="flex min-h-52 items-center justify-center text-white/65">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Running pre-draw integrity checks...
            </div>
          ) : result ? (
            <DrawResultView result={result} />
          ) : readiness ? (
            <ReadinessView
              canRun={!attemptedHere && canRunDraw(item, readiness)}
              readiness={readiness}

              item={item}

              confirm={confirm}

              running={running}

              setConfirm={setConfirm}

              onRun={onRun}
            />
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
              <AlertTriangle className="mx-auto h-8 w-8 text-white/30" />

              <h3 className="mt-3 font-bold text-white">
                Draw information unavailable
              </h3>
            </div>
          )}
        </div>
      </div>
    </dialog>,
    document.body,
  );
}

function ReadinessView({
  canRun,
  readiness,

  item,

  confirm,

  running,

  setConfirm,

  onRun,
}: {
  canRun: boolean;
  readiness: ReadinessResponse;

  item: LotteryDrawListItem;

  confirm: boolean;

  running: boolean;

  setConfirm: (value: boolean) => void;

  onRun: () => void;
}) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DetailCard
          label="Paid orders"

          value={String(readiness.metrics.paid_orders)}
        />

        <DetailCard
          label="Eligible tickets"

          value={String(readiness.metrics.eligible_tickets)}
        />

        <DetailCard
          label="Excluded tickets"

          value={String(readiness.metrics.excluded_tickets)}
        />

        <DetailCard
          label="Available prizes"

          value={String(readiness.metrics.prizes_available)}
        />
      </div>

      <p className="mt-5 rounded-2xl border border-purple-400/25 bg-purple-500/10 p-4 text-sm leading-6 text-purple-100">
        These are reported readiness counts. The server must freeze and validate
        the paid, non-refunded ticket pool before selecting winners. Readiness
        counts do not establish final odds or compliance approval.
      </p>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Draw information">
          <DetailRows
            rows={[
              ["Sales close", formatDate(readiness.lottery.sales_close_at)],

              ["Draw date", formatDate(readiness.lottery.draw_at)],

              [
                "Reference",

                readiness.lottery.internal_reference ||
                  item.internal_reference ||
                  item.slug,
              ],

              ["Draw status", statusLabel(item.draw_status)],
            ]}
          />
        </Panel>

        <Panel title="Draw integrity">
          <div className="space-y-3">
            {readiness.checks.map((check) => (
              <IntegrityRow
                key={check.key}

                ok={check.ok}

                text={publicCheck(check)}
              />
            ))}
          </div>
        </Panel>
      </div>

      <div
        className={`mt-6 rounded-2xl border p-5 ${
          canRun
            ? "border-emerald-400/25 bg-emerald-500/10"
            : "border-red-400/25 bg-red-500/10"
        }`}
      >
        <div className="flex items-start gap-3">
          {canRun ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
          )}

          <div>
            <h3 className="font-bold text-white">
              {canRun ? "Draw is ready" : "Draw is currently blocked"}
            </h3>

            <p className="mt-1 text-sm text-white/60">
              {canRun
                ? "Reported checks and local date checks allow a request. The server must recheck permissions, recent 2FA, compliance, eligibility and draw locking."
                : "Check dates, lifecycle state, reported checks and existing draw records. A submitted draw cannot be requested again from this screen session."}
            </p>
          </div>
        </div>
      </div>

      {canRun && item.draw_status !== "completed" ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"

              disabled={running}
              checked={confirm}

              onChange={(event) => setConfirm(event.target.checked)}

              className="mt-1 h-4 w-4 rounded border-white/20 bg-black/20"
            />

            <span className="text-sm leading-6 text-white/70">
              I confirm sales are closed, the information above is correct and I
              am authorised to execute this draw.
            </span>
          </label>

          <div className="mt-5 flex justify-end">
            <button
              type="button"

              onClick={onRun}

              disabled={!confirm || running || !canRun}

              className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-black hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trophy className="h-4 w-4" />
              )}

              {running ? "Submitting draw..." : "Request draw"}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function DrawResultView({ result }: { result: DrawResult }) {
  return (
    <>
      <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />

          <div>
            <h3 className="font-bold text-white">Draw complete</h3>

            <p className="mt-1 text-sm text-white/60">
              The server returned a completed draw result. Check the audit log
              and stored snapshot to verify execution.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DetailCard label="Draw ID" value={result.draw.id} />

        <DetailCard
          label="Eligible tickets"

          value={String(result.draw.eligible_ticket_count)}
        />

        <DetailCard
          label="Completed"

          value={formatDate(result.draw.completed_at)}
        />

        <DetailCard
          label="Snapshot"

          value={result.draw.snapshot_hash}
        />
      </div>

      <section className="mt-6">
        <div className="mb-4 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-white/65" />

          <h3 className="text-lg font-bold text-white">Winning tickets</h3>
        </div>

        <div className="space-y-4">
          {result.winners.map((winner, index) => (
            <article
              key={`${winner.prize_id}-${winner.ticket_id}`}

              className="rounded-2xl border border-white/10 bg-black/20 p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-white/35">
                    Prize {index + 1}
                  </p>

                  <h4 className="mt-1 text-base font-extrabold text-white">
                    {winner.prize_name}
                  </h4>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Info
                    label="Winning ticket"

                    value={winner.ticket_number}
                  />

                  <Info
                    label="Winner status"

                    value={winner.winner_status.replaceAll("_", " ")}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <a
          href="/Admin/LotteryManagement/AuditLogs"

          className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-4 py-3 text-sm font-bold text-white hover:bg-white/10"
        >
          <ShieldCheck className="h-4 w-4" />
          View audit log
        </a>

        <a
          href="/Admin/LotteryManagement/Winners"

          className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-black hover:opacity-90"
        >
          <Trophy className="h-4 w-4" />
          Go to winners
        </a>
      </div>
    </>
  );
}

function DetailCard({
  label,

  value,
}: {
  label: string;

  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-white/35">
        {label}
      </div>

      <div className="mt-2 break-words text-sm font-bold text-white/80">
        {value}
      </div>
    </div>
  );
}

function Panel({
  title,

  children,
}: {
  title: string;

  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <h3 className="text-base font-extrabold text-white">{title}</h3>

      <div className="mt-4">{children}</div>
    </section>
  );
}

function DetailRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="divide-y divide-white/10">
      {rows.map(([label, value]) => (
        <div
          key={label}

          className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[150px_1fr]"
        >
          <div className="text-xs font-bold text-white/40">{label}</div>

          <div className="break-words text-sm text-white/75">{value}</div>
        </div>
      ))}
    </div>
  );
}

function IntegrityRow({
  ok,

  text,

  detail,
}: {
  ok: boolean;

  text: string;

  detail?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
      )}

      <div>
        <p className="text-sm font-semibold text-white/75">{text}</p>

        {detail ? (
          <p className="mt-1 text-xs leading-5 text-white/45">{detail}</p>
        ) : null}
      </div>
    </div>
  );
}
