"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import LiveDrawSettingsPanel from "./LiveDrawSettingsPanel";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Eye,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  TicketCheck,
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

type DrawErrorDiagnostics = {
  code?: string;
  requestId?: string;
  details?: unknown;
};

type FilterStatus = "all" | "ready" | "upcoming" | "completed" | "review";
type SortMode = "draw_date" | "sales_close" | "title" | "tickets";

const DRAW_LIST_ROUTE = "/api/admin/lotterymanagement/draws";

function drawReadinessRoute(id: string) {
  return `/api/admin/lotterymanagement/draws/${id}/draw-readiness`;
}

function runDrawRoute(id: string) {
  return `/api/admin/lotterymanagement/draws/${id}/draw`;
}

function apiErrorMessage(value: unknown, fallback: string) {
  if (typeof value === "string" && value.trim()) return value.trim();

  if (
    value &&
    typeof value === "object" &&
    "message" in value &&
    typeof value.message === "string" &&
    value.message.trim()
  ) {
    return value.message.trim();
  }

  return fallback;
}

function isReadinessResponse(value: unknown): value is ReadinessResponse {
  return Boolean(
    value &&
      typeof value === "object" &&
      "lottery" in value &&
      "metrics" in value &&
      "checks" in value &&
      Array.isArray(value.checks),
  );
}

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";

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
    ready: "Ready to draw",
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

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      response.status === 404
        ? "The Draws API route could not be found. Check the admin lottery draw API route."
        : "The Draws API returned an invalid response.",
    );
  }
}

export default function DrawsClient() {
  const [items, setItems] = useState<LotteryDrawListItem[]>([]);
  const [summary, setSummary] = useState({
    ready: 0,
    upcoming: 0,
    completed: 0,
    blocked: 0,
  });

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
  const [testMode, setTestMode] = useState(false);

  const loadDraws = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorDiagnostics(null);

    try {
      const response = await fetch(DRAW_LIST_ROUTE, {
        cache: "no-store",
        credentials: "include",
      });

      const data = await readJson<DrawsResponse>(response);

      if (!response.ok || data.ok === false) {
        throw new Error(
          data.error || data.message || "Failed to load draws.",
        );
      }

      const loadedItems = data.items || [];

      setItems(loadedItems);
      setSummary(
        data.summary || {
          ready: loadedItems.filter((x) => x.draw_status === "ready").length,
          upcoming: loadedItems.filter((x) =>
            ["upcoming", "not_ready"].includes(x.draw_status),
          ).length,
          completed: loadedItems.filter((x) => x.draw_status === "completed")
            .length,
          blocked: loadedItems.filter((x) =>
            ["blocked", "under_review", "redraw_requested"].includes(
              x.draw_status,
            ),
          ).length,
        },
      );
    } catch (err: any) {
      setError(err?.message || "Failed to load draws.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDraws();
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

  function startFullFeatureTest() {
    const now = new Date();
    const salesClose = new Date(now.getTime() - 60 * 60 * 1000);
    const drawDate = new Date(now.getTime() + 5 * 60 * 1000);

    const demoItem: LotteryDrawListItem = {
      id: "__draw_test__",
      title: "Test Lottery Draw",
      slug: "test-lottery-draw",
      internal_reference: "TEST-DRAW-001",
      lottery_status: "draw_ready",
      draw_at: drawDate.toISOString(),
      sales_close_at: salesClose.toISOString(),
      paid_orders: 24,
      eligible_tickets: 120,
      excluded_tickets: 3,
      prizes_available: 3,
      draw_status: "ready",
      latest_draw_id: null,
    };

    const demoReadiness: ReadinessResponse = {
      ok: true,
      lottery: {
        id: demoItem.id,
        title: demoItem.title,
        internal_reference: demoItem.internal_reference,
        draw_at: demoItem.draw_at,
        sales_close_at: demoItem.sales_close_at,
      },
      metrics: {
        paid_orders: demoItem.paid_orders,
        eligible_tickets: demoItem.eligible_tickets,
        excluded_tickets: demoItem.excluded_tickets,
        prizes_available: demoItem.prizes_available,
      },
      ready: true,
      checks: [
        {
          key: "sales_closed",
          label: "Sales are closed",
          ok: true,
          detail: "Test sales window closed successfully.",
        },
        {
          key: "lottery_state",
          label: "Lottery is in a drawable state",
          ok: true,
          detail: "Test lottery is marked draw ready.",
        },
        {
          key: "payments",
          label: "All eligible orders are paid",
          ok: true,
          detail: "24 paid test orders found.",
        },
        {
          key: "tickets",
          label: "Eligible ticket pool is valid",
          ok: true,
          detail: "120 eligible test tickets; 3 excluded.",
        },
        {
          key: "prizes",
          label: "Prizes are available for allocation",
          ok: true,
          detail: "3 test prizes available.",
        },
        {
          key: "integrity",
          label: "No unresolved integrity warnings",
          ok: true,
          detail: "No test integrity warnings found.",
        },
        {
          key: "snapshot",
          label: "Eligible ticket snapshot can be created",
          ok: true,
          detail: "Test snapshot is ready to be frozen.",
        },
        {
          key: "permission",
          label: "Draw permission check passed",
          ok: true,
          detail: "Test mode simulates an authorised draw operator.",
        },
      ],
    };

    setError(null);
    setTestMode(true);
    setSelected(demoItem);
    setReadiness(demoReadiness);
    setResult(null);
    setConfirm(false);
    setLoadingReadiness(false);
  }

  async function openDraw(item: LotteryDrawListItem) {
    setTestMode(false);
    setSelected(item);
    setReadiness(null);
    setResult(null);
    setConfirm(false);
    setLoadingReadiness(true);
    setError(null);
    setErrorDiagnostics(null);

    try {
      const response = await fetch(drawReadinessRoute(item.id), {
        cache: "no-store",
        credentials: "include",
      });

      const data = await readJson<ReadinessResponse>(response);

      if (!response.ok || data.ok === false) {
        throw new Error(
          data.error ||
            data.message ||
            "Could not check draw readiness.",
        );
      }

      setReadiness(data);
    } catch (err: any) {
      setError(err?.message || "Could not check draw readiness.");
      setSelected(null);
    } finally {
      setLoadingReadiness(false);
    }
  }

  async function runDraw() {
    if (!selected || !readiness?.ready || !confirm || running) return;

    setRunning(true);
    setError(null);
    setErrorDiagnostics(null);

    if (testMode) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1200));

        const completedAt = new Date().toISOString();

        const demoResult: DrawResult = {
          ok: true,
          draw: {
            id: "TEST-DRAW-RESULT-001",
            completed_at: completedAt,
            eligible_ticket_count: 120,
            snapshot_hash:
              "test-only-7f6c5d4b3a2918171615141312111000abcdef1234567890",
          },
          winners: [
            {
              prize_id: "test-prize-1",
              prize_name: "Test Main Prize",
              ticket_id: "test-ticket-104",
              ticket_number: "BP-TEST-000104",
              winner_status: "contact_pending",
            },
            {
              prize_id: "test-prize-2",
              prize_name: "Test Second Prize",
              ticket_id: "test-ticket-057",
              ticket_number: "BP-TEST-000057",
              winner_status: "contact_pending",
            },
            {
              prize_id: "test-prize-3",
              prize_name: "Test Third Prize",
              ticket_id: "test-ticket-019",
              ticket_number: "BP-TEST-000019",
              winner_status: "contact_pending",
            },
          ],
        };

        setResult(demoResult);
      } finally {
        setRunning(false);
      }
      return;
    }

    try {
      const response = await fetch(runDrawRoute(selected.id), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmed: true,
        }),
      });

      const data = await readJson<DrawResult & Partial<ReadinessResponse>>(response);

      if (!response.ok || data.ok === false) {
        setErrorDiagnostics({
          code: data.code,
          requestId: data.request_id,
          details: data.details,
        });

        // The secure route repeats every pre-draw check immediately before it
        // freezes tickets. When it blocks a draw, show those exact checks.
        if (isReadinessResponse(data)) {
          setReadiness({
            ...data,
            ok: true,
          });
        } else if (response.status === 409) {
          // Older draw routes only return a short 409 message. Fetch the
          // read-only readiness result so the operator can see what to fix.
          try {
            const diagnosticResponse = await fetch(
              drawReadinessRoute(selected.id),
              { cache: "no-store", credentials: "include" },
            );
            const diagnostic = await readJson<ReadinessResponse>(
              diagnosticResponse,
            );

            if (diagnosticResponse.ok && isReadinessResponse(diagnostic)) {
              setReadiness(diagnostic);
            }
          } catch {
            // Keep the original draw error. The error panel gives safe next
            // steps even if the diagnostic request is unavailable.
          }
        }

        throw new Error(
          apiErrorMessage(
            data.error || data.message,
            "The draw could not be completed.",
          ),
        );
      }

      setResult(data);
      await loadDraws();
    } catch (err: any) {
      setError(err?.message || "The draw could not be completed.");
    } finally {
      setRunning(false);
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
              <h1 className="text-2xl font-extrabold text-white">
                Draws
              </h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-white/60">
                Run secure lottery draws, check eligible tickets, review draw
                readiness and see completed results.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={startFullFeatureTest}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-black hover:opacity-90"
            >
              <TicketCheck className="h-4 w-4" />
              Test full feature
            </button>

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
        <StatCard label="Draw ready" value={String(summary.ready)} />
        <StatCard label="Upcoming" value={String(summary.upcoming)} />
        <StatCard label="Completed" value={String(summary.completed)} />
        <StatCard
          label="Blocked / review"
          value={String(summary.blocked)}
        />
      </section>

      {error ? (
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
          <h2 className="text-lg font-bold text-white">
            Search &amp; filters
          </h2>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Lottery, reference or slug..."
              className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/35"
            />
          </div>

          <Select
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
          <h2 className="text-lg font-bold text-white">
            Draw register
          </h2>
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
            <h3 className="mt-3 font-bold text-white">
              No draws found
            </h3>
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
          testMode={testMode}
          confirm={confirm}
          running={running}
          setConfirm={setConfirm}
          onRun={runDraw}
          onClose={() => {
            if (!running) {
              setSelected(null);
              setReadiness(null);
              setResult(null);
              setConfirm(false);
              setTestMode(false);
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
  lottery,
  readiness,
  diagnostics,
}: {
  error: string;
  lottery: LotteryDrawListItem | null;
  readiness: ReadinessResponse | null;
  diagnostics: DrawErrorDiagnostics | null;
}) {
  const failedChecks = (readiness?.checks || []).filter((check) => !check.ok);
  const metrics = readiness?.metrics;
  const isBlockedDraw = /blocked|integrity|409|could not be completed/i.test(error);

  return (
    <section className="rounded-2xl border border-red-400/35 bg-red-500/10 p-5 text-red-50 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-300/25 bg-red-500/15 text-red-200">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-red-200">
            Draw action needed
          </p>
          <h2 className="mt-1 text-base font-extrabold text-white">
            {isBlockedDraw ? "The secure draw has been stopped safely" : "The draw could not be loaded"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-red-100/90">{error}</p>
        </div>
      </div>

      {lottery || metrics ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <ErrorMetric label="Lottery" value={lottery?.title || readiness?.lottery.title || "Not identified"} />
          <ErrorMetric label="Paid orders" value={String(metrics?.paid_orders ?? lottery?.paid_orders ?? 0)} />
          <ErrorMetric label="Eligible tickets" value={String(metrics?.eligible_tickets ?? lottery?.eligible_tickets ?? 0)} />
          <ErrorMetric label="Excluded tickets" value={String(metrics?.excluded_tickets ?? lottery?.excluded_tickets ?? 0)} />
          <ErrorMetric label="Prizes ready" value={String(metrics?.prizes_available ?? lottery?.prizes_available ?? 0)} />
        </div>
      ) : null}

      {failedChecks.length ? (
        <div className="mt-5 rounded-xl border border-red-300/15 bg-black/15 p-4">
          <h3 className="font-bold text-white">What needs fixing</h3>
          <ul className="mt-3 space-y-3">
            {failedChecks.map((check) => (
              <li key={check.key} className="rounded-lg border border-red-300/10 bg-red-950/15 px-3 py-2">
                <p className="text-sm font-bold text-red-100">{check.label}</p>
                {check.detail ? <p className="mt-1 text-xs leading-5 text-red-100/70">{check.detail}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : isBlockedDraw ? (
        <div className="mt-5 rounded-xl border border-red-300/15 bg-black/15 p-4 text-sm leading-6 text-red-100/80">
          <strong className="text-white">Next step:</strong> Open this draw to run the detailed readiness check. Confirm the lottery is in a drawable state, sales are closed, both ticket records are issued and eligible, all prizes are marked Ready for draw, and there are no integrity warnings.
        </div>
      ) : null}

      {diagnostics ? (
        <DrawDiagnosticDetails diagnostics={diagnostics} />
      ) : null}
    </section>
  );
}

function DrawDiagnosticDetails({
  diagnostics,
}: {
  diagnostics: DrawErrorDiagnostics;
}) {
  const details =
    diagnostics.details && typeof diagnostics.details === "object"
      ? (diagnostics.details as Record<string, unknown>)
      : null;

  const rows = [
    ["Error code", diagnostics.code],
    ["Request ID", diagnostics.requestId],
    ["Database code", details?.database_code],
    ["Database message", details?.database_message],
    ["Database hint", details?.database_hint],
    ["Database details", details?.database_details],
  ].filter(([, value]) => typeof value === "string" && value.trim()) as Array<
    [string, string]
  >;

  if (!rows.length) return null;

  return (
    <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-white/55">
        Technical details for the admin
      </p>
      <dl className="mt-3 space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-4">
            <dt className="text-xs font-bold text-white/55">{label}</dt>
            <dd className="break-words font-mono text-xs leading-5 text-white/85">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ErrorMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-red-300/15 bg-black/15 p-3">
      <p className="text-[10px] font-black uppercase tracking-wide text-red-100/55">{label}</p>
      <p className="mt-1 break-words text-sm font-extrabold text-white">{value}</p>
    </div>
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
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
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
  testMode,
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
  testMode: boolean;
  confirm: boolean;
  running: boolean;
  setConfirm: (value: boolean) => void;
  onRun: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm md:p-6"
      role="dialog"
      aria-modal="true"
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

              <p className="mt-1 text-sm text-white/55">
                Secure draw control
              </p>
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
          {testMode ? (
            <div className="mb-5 rounded-2xl border border-yellow-400/30 bg-yellow-500/10 p-4">
              <div className="flex items-start gap-3">
                <TicketCheck className="mt-0.5 h-5 w-5 shrink-0 text-yellow-200" />
                <div>
                  <h3 className="font-bold text-yellow-100">Test mode</h3>
                  <p className="mt-1 text-sm leading-6 text-yellow-100/70">
                    This is a safe demo. It does not call the real draw API, allocate real tickets,
                    create winners or write anything to Supabase.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {!testMode ? (
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
            <DrawResultView result={result} testMode={testMode} />
          ) : readiness ? (
            <ReadinessView
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
    </div>
  );
}

function ReadinessView({
  readiness,
  item,
  confirm,
  running,
  setConfirm,
  onRun,
}: {
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

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Draw information">
          <DetailRows
            rows={[
              [
                "Sales close",
                formatDate(readiness.lottery.sales_close_at),
              ],
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
                text={check.label}
                detail={check.detail || undefined}
              />
            ))}
          </div>
        </Panel>
      </div>

      <div
        className={`mt-6 rounded-2xl border p-5 ${
          readiness.ready
            ? "border-emerald-400/25 bg-emerald-500/10"
            : "border-red-400/25 bg-red-500/10"
        }`}
      >
        <div className="flex items-start gap-3">
          {readiness.ready ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
          )}

          <div>
            <h3 className="font-bold text-white">
              {readiness.ready
                ? "Draw is ready"
                : "Draw is currently blocked"}
            </h3>
            <p className="mt-1 text-sm text-white/60">
              {readiness.ready
                ? "All required pre-draw checks have passed."
                : "One or more required checks must be resolved before the draw can run."}
            </p>
          </div>
        </div>
      </div>

      {readiness.ready && item.draw_status !== "completed" ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(event) => setConfirm(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-white/20 bg-black/20"
            />

            <span className="text-sm leading-6 text-white/70">
              I confirm sales are closed, the information above is correct and
              I am authorised to execute this draw.
            </span>
          </label>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={onRun}
              disabled={!confirm || running}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-black hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trophy className="h-4 w-4" />
              )}

              {running ? "Running secure draw..." : "Run secure draw"}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function DrawResultView({
  result,
  testMode,
}: {
  result: DrawResult;
  testMode: boolean;
}) {
  return (
    <>
      <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />

          <div>
            <h3 className="font-bold text-white">
              Draw complete
            </h3>
            <p className="mt-1 text-sm text-white/60">
              {testMode
                ? "The full draw flow completed successfully in safe test mode. No real data was changed."
                : "The draw result has been securely stored."}
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
          <h3 className="text-lg font-bold text-white">
            Winning tickets
          </h3>
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
      <h3 className="text-base font-extrabold text-white">
        {title}
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function DetailRows({
  rows,
}: {
  rows: Array<[string, string]>;
}) {
  return (
    <div className="divide-y divide-white/10">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[150px_1fr]"
        >
          <div className="text-xs font-bold text-white/40">
            {label}
          </div>
          <div className="break-words text-sm text-white/75">
            {value}
          </div>
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
        <p className="text-sm font-semibold text-white/75">
          {text}
        </p>
        {detail ? (
          <p className="mt-1 text-xs leading-5 text-white/45">
            {detail}
          </p>
        ) : null}
      </div>
    </div>
  );
}
