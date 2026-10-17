"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
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

import LiveDrawSettingsPanel from "./LiveDrawSettingsPanel";

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
  latest_draw_status?: string | null;
  previous_failed_draw_safe?: boolean;
};

type DrawSummary = {
  ready: number;
  upcoming: number;
  completed: number;
  blocked: number;
};

type DrawsResponse = {
  ok?: boolean;
  items?: LotteryDrawListItem[];
  summary?: DrawSummary;
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
  previous_failed_draw_safe?: boolean;
  previous_failed_draw_id?: string | null;
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
  requestId?: string;
};

type FilterStatus =
  | "all"
  | "ready"
  | "upcoming"
  | "completed"
  | "review";

type SortMode =
  | "draw_date"
  | "sales_close"
  | "title"
  | "tickets";

const DRAW_LIST_ROUTE = "/api/admin/lotterymanagement/draws";
const READINESS_MAX_AGE_MS = 60_000;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

const DRAW_STATUSES: DrawStatus[] = [
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

const BUTTON_CLASS =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/15 px-4 py-3 text-sm font-bold text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 disabled:cursor-not-allowed disabled:opacity-40";

function drawReadinessRoute(id: string) {
  return `${DRAW_LIST_ROUTE}/${encodeURIComponent(id)}/draw-readiness`;
}

function runDrawRoute(id: string) {
  return `${DRAW_LIST_ROUTE}/${encodeURIComponent(id)}/draw`;
}

// Requires a server route that verifies the signed-in Main Admin, their own
// password, recent 2FA, permissions and an auditable, narrowly scoped override.
// A successful override must never itself select winners or bypass draw safety.
function drawOverrideRoute(id: string) {
  return `${DRAW_LIST_ROUTE}/${encodeURIComponent(id)}/draw-override`;
}

function isOverrideResult(value: unknown, lotteryId: string): boolean {
  return record(value) && value.ok === true &&
    value.lottery_id === lotteryId && text(value.override_id);
}

function canRequestOverride(item: LotteryDrawListItem): boolean {
  return ["blocked", "under_review"].includes(item.draw_status) &&
    !item.latest_draw_id;
}

function canRetryFailedDraw(item: LotteryDrawListItem, readiness: ReadinessResponse | null): boolean {
  return Boolean(item.latest_draw_id && item.latest_draw_status === "failed" &&
    item.previous_failed_draw_safe === true && readiness?.previous_failed_draw_safe === true &&
    readiness.previous_failed_draw_id === item.latest_draw_id);
}

function drawServerMessage(value: unknown): string | null {
  if (!record(value) || typeof value.code !== "string") return null;
  const messages: Record<string, string> = {
    SALES_NOT_CLOSED: "Close ticket sales and set the lottery status to sales_closed or draw_ready.",
    DRAW_TIME_BLOCKED: "Set valid sales closing and draw times, and wait until both times have been reached.",
    COMPLIANCE_NOT_APPROVED: "This lottery needs compliance approval before the draw can run.",
    NO_PAID_ORDERS: "No paid, non-refunded orders are available.",
    NO_ELIGIBLE_TICKETS: "No issued, non-refunded tickets on paid, non-refunded orders are available.",
    INTEGRITY_WARNINGS: "Unresolved integrity warnings must be reviewed before drawing.",
    EXISTING_DRAW_BLOCKED: "An active or completed draw, or existing winners, require review. Use the separate redraw process when appropriate.",
    MULTIPLE_PRIZE_QUANTITY: "Each available prize record must have quantity 1. Split multi-quantity prizes into separate records.",
    INVALID_PRIZE_COUNT: "Check that 1–1,000 confirmed or available prize records exist, then refresh the checks.",
    INSUFFICIENT_TICKETS: "There must be at least one different eligible ticket for each prize.",
    INVALID_SNAPSHOT_COUNT: "The frozen ticket count is invalid or exceeds the supported limit of 100,000.",
    SNAPSHOT_INCOMPLETE: "The frozen ticket pool is incomplete. Review this failed draw and its audit log.",
    SNAPSHOT_INVALID: "The frozen ticket pool could not be validated. Review the draw records and audit log.",
    DRAW_CHECK_UNAVAILABLE: "A required database check is unavailable. Check the server logs using the request reference.",
    DRAW_START_FAILED: "The database could not start the draw. Check the audit log and database configuration using the request reference.",
    ADMIN_IDENTITY_UNAVAILABLE: "Your administrator identity could not be verified. Sign in again.",
    INVALID_ORIGIN: "The draw request must come from this website.",
  };
  return messages[value.code] ?? null;
}

function record(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function text(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= 2048
  );
}

function nullableText(value: unknown) {
  return value === null || text(value);
}

function count(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
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
    value.items.length > 10_000
  ) {
    return false;
  }

  const ids = new Set<string>();

  if (
    !value.items.every((item) => {
      if (
        !record(item) ||
        !text(item.id) ||
        ids.has(item.id)
      ) {
        return false;
      }

      ids.add(item.id);

      return (
        text(item.title) &&
        text(item.slug) &&
        nullableText(item.internal_reference) &&
        text(item.lottery_status) &&
        nullableDate(item.draw_at) &&
        nullableDate(item.sales_close_at) &&
        metrics(item) &&
        DRAW_STATUSES.includes(item.draw_status as DrawStatus) &&
        nullableText(item.latest_draw_id) &&
        (item.latest_draw_status === undefined || nullableText(item.latest_draw_status)) &&
        (item.previous_failed_draw_safe === undefined || typeof item.previous_failed_draw_safe === "boolean")
      );
    })
  ) {
    return false;
  }

  if (value.summary === undefined) return true;
  if (!record(value.summary)) return false;

  const summary = value.summary;

  return ["ready", "upcoming", "completed", "blocked"].every(
    (key) => count(summary[key]),
  );
}

function isReadinessResponse(
  value: unknown,
): value is ReadinessResponse {
  if (
    !record(value) ||
    value.ok === false ||
    !record(value.lottery) ||
    !metrics(value.metrics) ||
    typeof value.ready !== "boolean" ||
    (value.previous_failed_draw_safe !== undefined && typeof value.previous_failed_draw_safe !== "boolean") ||
    (value.previous_failed_draw_id !== undefined && !nullableText(value.previous_failed_draw_id)) ||
    !Array.isArray(value.checks) ||
    value.checks.length > 100
  ) {
    return false;
  }

  const lottery = value.lottery;
  const keys = new Set<string>();

  return (
    text(lottery.id) &&
    text(lottery.title) &&
    nullableText(lottery.internal_reference) &&
    nullableDate(lottery.draw_at) &&
    nullableDate(lottery.sales_close_at) &&
    value.checks.every((check) => {
      if (
        !record(check) ||
        !text(check.key) ||
        keys.has(check.key)
      ) {
        return false;
      }

      keys.add(check.key);

      return (
        text(check.label) &&
        typeof check.ok === "boolean" &&
        (check.detail === undefined ||
          nullableText(check.detail))
      );
    })
  );
}

function isDrawResult(value: unknown): value is DrawResult {
  if (
    !record(value) ||
    value.ok === false ||
    !record(value.draw) ||
    !Array.isArray(value.winners) ||
    value.winners.length === 0 ||
    value.winners.length > 10_000
  ) {
    return false;
  }

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
  return (
    record(value) &&
    typeof value.request_id === "string" &&
    /^[a-zA-Z0-9_-]{8,80}$/.test(value.request_id)
  )
    ? value.request_id
    : undefined;
}

function publicCheck(check: ReadinessCheck): string {
  const labels: Record<string, string> = {
    sales_closed: "Sales closed",
    draw_time: "Draw time reached",
    draw_time_reached: "Draw time reached",
    eligible_tickets: "Eligible ticket pool",
    prizes_ready: "Prize readiness",
    prizes_available: "Available prizes",
    no_existing_draw: "Existing draw check",
    compliance: "Compliance check",
    integrity_warnings: "Integrity warning check",
    paid_orders: "Paid orders",
    lottery_state: "Lottery status",
    snapshot_limit: "Supported ticket pool size",
    prize_quantities: "Prize quantities",
    tickets_for_prizes: "Enough tickets for all prizes",
    no_existing_winners: "Existing winners check",
  };

  if (labels[check.key]) return labels[check.key];

  // Avoid displaying arbitrary backend diagnostic text.
  if (/^[a-zA-Z0-9_]{1,80}$/.test(check.key)) {
    const label = check.key.replaceAll("_", " ");
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  return "Server readiness check";
}

function drawBlockReasons(
  item: LotteryDrawListItem,
  readiness: ReadinessResponse | null,
  now = Date.now(),
): string[] {
  const reasons: string[] = [];

  if (!readiness) {
    return ["Readiness has not been loaded."];
  }

  if (readiness.lottery.id !== item.id) {
    reasons.push("Readiness belongs to another lottery.");
  }

  if (!readiness.ready) {
    reasons.push("The server has not approved this draw as ready.");
  }

  if (readiness.checks.length === 0) {
    reasons.push("The server returned no readiness checks.");
  }

  for (const check of readiness.checks) {
    if (!check.ok) {
      reasons.push(`${publicCheck(check)} has not passed.`);
    }
  }

  if (readiness.metrics.paid_orders <= 0) {
    reasons.push("No paid orders were reported.");
  }

  if (readiness.metrics.eligible_tickets <= 0) {
    reasons.push("No eligible tickets were reported.");
  }

  if (readiness.metrics.prizes_available <= 0) {
    reasons.push("No prizes are available.");
  }

  const drawTime = readiness.lottery.draw_at
    ? Date.parse(readiness.lottery.draw_at)
    : NaN;

  if (!Number.isFinite(drawTime)) {
    reasons.push("A valid draw date is required.");
  } else if (drawTime > now) {
    reasons.push("The draw time has not been reached.");
  }

  const salesCloseTime = readiness.lottery.sales_close_at
    ? Date.parse(readiness.lottery.sales_close_at)
    : NaN;

  if (!Number.isFinite(salesCloseTime)) {
    reasons.push("A valid sales closing date is required.");
  } else if (salesCloseTime > now) {
    reasons.push("The sales closing time has not been reached.");
  }

  if (!["sales_closed", "draw_ready"].includes(item.lottery_status)) {
    reasons.push(
      `Lottery status is "${item.lottery_status}". It must be "sales_closed" or "draw_ready".`,
    );
  }

  if (item.draw_status !== "ready") {
    reasons.push(
      `Draw status is "${item.draw_status}", rather than "ready".`,
    );
  }

  if (item.latest_draw_id && !canRetryFailedDraw(item, readiness)) {
    reasons.push(
      `An existing draw (${item.latest_draw_id}) requires review.`,
    );
  }

  return reasons;
}

function canRunDraw(
  item: LotteryDrawListItem,
  readiness: ReadinessResponse | null,
  now = Date.now(),
) {
  return drawBlockReasons(item, readiness, now).length === 0;
}

async function requestJson(
  url: string,
  init: RequestInit = {},
  signal?: AbortSignal,
): Promise<{ response: Response; data: unknown }> {
  const controller = new AbortController();
  const abort = () => controller.abort();

  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort, { once: true });

  const timer = setTimeout(
    abort,
    init.method?.toUpperCase() === "POST" ? 60_000 : 15_000,
  );

  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    });

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Response unavailable.");

    const chunks: Uint8Array[] = [];
    let size = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        size += value.byteLength;

        if (size > MAX_RESPONSE_BYTES) {
          await reader.cancel();
          throw new Error("Response too large.");
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

async function fetchCurrentDrawItem(
  id: string,
  signal: AbortSignal,
): Promise<LotteryDrawListItem> {
  const { response, data } = await requestJson(
    DRAW_LIST_ROUTE,
    {},
    signal,
  );

  if (!response.ok || !isDrawsResponse(data)) {
    throw new Error("The current draw register could not be verified.");
  }

  const item = data.items.find((entry) => entry.id === id);

  if (!item) {
    throw new Error("This lottery is no longer in the draw register.");
  }

  return item;
}

function calculateSummary(items: LotteryDrawListItem[]): DrawSummary {
  return {
    ready: items.filter((item) => item.draw_status === "ready").length,
    upcoming: items.filter((item) =>
      ["upcoming", "not_ready"].includes(item.draw_status),
    ).length,
    completed: items.filter(
      (item) => item.draw_status === "completed",
    ).length,
    blocked: items.filter((item) =>
      ["blocked", "under_review", "redraw_requested"].includes(
        item.draw_status,
      ),
    ).length,
  };
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

function sortTimestamp(value: string | null) {
  return value ? Date.parse(value) : Number.POSITIVE_INFINITY;
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
  const classes: Record<DrawStatus, string> = {
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

  return classes[status];
}

export default function DrawsClient() {
  const [items, setItems] = useState<LotteryDrawListItem[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<FilterStatus>("all");
  const [sort, setSort] = useState<SortMode>("draw_date");

  const [selected, setSelected] = useState<LotteryDrawListItem | null>(
    null,
  );
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(
    null,
  );
  const [readinessCheckedAt, setReadinessCheckedAt] = useState(0);
  const [loadingReadiness, setLoadingReadiness] = useState(false);

  const [drawError, setDrawError] = useState<string | null>(null);
  const [errorDiagnostics, setErrorDiagnostics] =
    useState<DrawErrorDiagnostics | null>(null);

  const [confirm, setConfirm] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<DrawResult | null>(null);
  const [attemptedHere, setAttemptedHere] = useState(false);
  const [now, setNow] = useState(Date.now);

  const listRequest = useRef<AbortController | null>(null);
  const readinessRequest = useRef<AbortController | null>(null);
  const runRequest = useRef<AbortController | null>(null);
  const drawInFlight = useRef(false);
  const attempted = useRef(new Set<string>());
  const readinessAt = useRef(0);

  const summary = useMemo(
    () => (hasLoaded ? calculateSummary(items) : null),
    [hasLoaded, items],
  );

  const loadDraws = useCallback(async () => {
    listRequest.current?.abort();

    const controller = new AbortController();
    listRequest.current = controller;

    setLoading(true);
    setListError(null);

    try {
      const { response, data } = await requestJson(
        DRAW_LIST_ROUTE,
        {},
        controller.signal,
      );

      if (!response.ok || !isDrawsResponse(data)) {
        throw new Error("Invalid draw list.");
      }

      if (controller.signal.aborted) return;

      setItems(data.items);
      setHasLoaded(true);
    } catch {
      if (!controller.signal.aborted) {
        setListError(
          "The draw register could not be refreshed. Check your access and try again. Any previously loaded records may be out of date.",
        );
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
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

  useEffect(() => {
    if (!selected) return;

    const timer = setInterval(() => {
      setNow(Date.now());
    }, 5_000);

    return () => clearInterval(timer);
  }, [selected?.id]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    const matchingItems = items.filter((item) => {
      const matchesSearch =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.slug.toLowerCase().includes(query) ||
        (item.internal_reference || "").toLowerCase().includes(query);

      const matchesStatus =
        status === "all" ||
        (status === "ready" && item.draw_status === "ready") ||
        (status === "upcoming" &&
          ["upcoming", "not_ready"].includes(item.draw_status)) ||
        (status === "completed" &&
          item.draw_status === "completed") ||
        (status === "review" &&
          ["blocked", "under_review", "redraw_requested"].includes(
            item.draw_status,
          ));

      return matchesSearch && matchesStatus;
    });

    return matchingItems.sort((a, b) => {
      if (sort === "title") {
        return a.title.localeCompare(b.title, "en-GB");
      }

      if (sort === "tickets") {
        return b.eligible_tickets - a.eligible_tickets;
      }

      const first =
        sort === "sales_close"
          ? sortTimestamp(a.sales_close_at)
          : sortTimestamp(a.draw_at);

      const second =
        sort === "sales_close"
          ? sortTimestamp(b.sales_close_at)
          : sortTimestamp(b.draw_at);

      return first === second ? 0 : first < second ? -1 : 1;
    });
  }, [items, search, status, sort]);

  async function openDraw(item: LotteryDrawListItem) {
    if (drawInFlight.current) return;

    readinessRequest.current?.abort();

    const controller = new AbortController();
    readinessRequest.current = controller;

    readinessAt.current = 0;

    setSelected(item);
    setReadiness(null);
    setReadinessCheckedAt(0);
    setResult(null);
    setConfirm(false);
    setAttemptedHere(attempted.current.has(item.id));
    setLoadingReadiness(true);
    setDrawError(null);
    setErrorDiagnostics(null);
    setNow(Date.now());

    try {
      const currentItem = await fetchCurrentDrawItem(
        item.id,
        controller.signal,
      );

      if (controller.signal.aborted) return;

      setSelected(currentItem);

      setItems((previous) =>
        previous.map((entry) =>
          entry.id === currentItem.id ? currentItem : entry,
        ),
      );

      const { response, data } = await requestJson(
        drawReadinessRoute(item.id),
        {},
        controller.signal,
      );

      if (
        !response.ok ||
        !isReadinessResponse(data) ||
        data.lottery.id !== item.id
      ) {
        throw new Error("Invalid readiness response.");
      }

      if (controller.signal.aborted) return;

      const checkedAt = Date.now();

      readinessAt.current = checkedAt;
      setReadinessCheckedAt(checkedAt);
      setNow(checkedAt);
      setReadiness(data);
    } catch {
      if (!controller.signal.aborted) {
        setDrawError(
          "The current lottery record or readiness checks could not be verified. No draw was submitted by this check. Use Refresh checks to try again.",
        );
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoadingReadiness(false);
      }
    }
  }

  async function runDraw() {
    if (
      !selected ||
      !confirm ||
      drawInFlight.current ||
      attempted.current.has(selected.id)
    ) {
      return;
    }

    const initialReasons = drawBlockReasons(selected, readiness);

    if (initialReasons.length > 0) {
      setConfirm(false);
      setDrawError(initialReasons.join(" "));
      return;
    }

    if (
      readinessAt.current === 0 ||
      Date.now() - readinessAt.current > READINESS_MAX_AGE_MS
    ) {
      setConfirm(false);
      setDrawError(
        "Readiness has expired. Use Refresh checks before requesting this draw.",
      );
      return;
    }

    const lotteryId = selected.id;
    const controller = new AbortController();

    drawInFlight.current = true;
    runRequest.current = controller;

    setRunning(true);
    setConfirm(false);
    setDrawError(null);
    setErrorDiagnostics(null);

    let submitted = false;

    try {
      const currentItem = await fetchCurrentDrawItem(
        lotteryId,
        controller.signal,
      );

      if (controller.signal.aborted) return;

      setSelected(currentItem);

      setItems((previous) =>
        previous.map((entry) =>
          entry.id === currentItem.id ? currentItem : entry,
        ),
      );

      const fresh = await requestJson(
        drawReadinessRoute(lotteryId),
        {},
        controller.signal,
      );

      if (controller.signal.aborted) return;

      if (
        !fresh.response.ok ||
        !isReadinessResponse(fresh.data) ||
        fresh.data.lottery.id !== lotteryId
      ) {
        setReadiness(null);
        setReadinessCheckedAt(0);
        readinessAt.current = 0;

        setDrawError(
          "The final readiness check could not be verified. No draw was submitted.",
        );
        return;
      }

      const freshReadiness = fresh.data;
      const checkedAt = Date.now();

      readinessAt.current = checkedAt;

      setReadinessCheckedAt(checkedAt);
      setNow(checkedAt);
      setReadiness(freshReadiness);

      const reasons = drawBlockReasons(
        currentItem,
        freshReadiness,
        checkedAt,
      );

      if (reasons.length > 0) {
        setDrawError(`No draw was submitted. ${reasons.join(" ")}`);
        return;
      }

      // This UI guard does not replace the server's transactional lock.
      // A submitted POST is never automatically retried.
      attempted.current.add(lotteryId);
      setAttemptedHere(true);
      submitted = true;

      const { response, data } = await requestJson(
        runDrawRoute(lotteryId),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            confirmed: true,
          }),
        },
        controller.signal,
      );

      if (controller.signal.aborted) return;

      setErrorDiagnostics({
        requestId: requestId(data),
      });

      if (!response.ok || !isDrawResult(data)) {
        const message = drawServerMessage(data);
        if (message) {
          setDrawError(`${message} A draw request was submitted; check its records before another attempt. This screen will not submit it again.`);
          return;
        }
        throw new Error("Draw outcome unverified.");
      }

      setResult(data);

      // List errors have separate state and cannot overwrite this result.
      void loadDraws();
    } catch {
      if (!controller.signal.aborted) {
        setDrawError(
          submitted
            ? "The draw outcome could not be verified. It may have completed. Check the draw records, winners and audit log before any further action. Another submission is blocked in this screen session."
            : "The final lottery record or readiness check is unavailable. No draw was submitted. Use Refresh checks to try again.",
        );
      }
    } finally {
      drawInFlight.current = false;

      if (runRequest.current === controller) {
        runRequest.current = null;
      }

      if (!controller.signal.aborted) {
        setRunning(false);
      }
    }
  }

  function closeDraw() {
    if (running || drawInFlight.current) return;

    readinessRequest.current?.abort();
    readinessAt.current = 0;

    setSelected(null);
    setReadiness(null);
    setReadinessCheckedAt(0);
    setLoadingReadiness(false);
    setResult(null);
    setConfirm(false);
    setDrawError(null);
    setErrorDiagnostics(null);
  }

  return (
    <div className="w-full max-w-none space-y-6 px-0 py-4 md:py-6">
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
                Request lottery draws, check eligible tickets, review
                readiness and see completed results.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadDraws()}
            disabled={loading || running}
            className={BUTTON_CLASS}
          >
            <RefreshCw
              className={`h-4 w-4 ${
                loading ? "animate-spin motion-reduce:animate-none" : ""
              }`}
            />
            Refresh
          </button>
        </div>
      </section>

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

      {listError ? (
        <DrawErrorPanel
          title="Draw register unavailable"
          error={listError}
          diagnostics={null}
        />
      ) : null}

      <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
        <div className="mb-5 flex items-center gap-2">
          <Filter className="h-4 w-4 text-white/65" />
          <h2 className="text-lg font-bold text-white">
            Search & filters
          </h2>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />

            <input
              aria-label="Search draws"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Lottery, reference or slug..."
              className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-11 text-sm text-white outline-none placeholder:text-white/35 focus-visible:ring-2 focus-visible:ring-purple-300"
            />

            {search ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={(event) => {
                  setSearch("");
                  event.currentTarget.parentElement
                    ?.querySelector("input")
                    ?.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-lg p-2 text-white/65 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <Select
            label="Filter draw status"
            value={status}
            onChange={(value) => setStatus(value as FilterStatus)}
          >
            <option value="all">All draw statuses</option>
            <option value="ready">Readiness reported</option>
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
            <option value="title">Lottery title A–Z</option>
            <option value="tickets">Most eligible tickets</option>
          </Select>
        </div>
      </section>

      <section
        aria-busy={loading}
        className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl"
      >
        <div className="mb-4">
          <h2 className="text-lg font-bold text-white">
            Draw register
          </h2>
          <p className="mt-1 text-sm text-white/50">
            Showing {filtered.length} of {items.length} draw records
          </p>
        </div>

        {loading && !hasLoaded ? (
          <LoadingMessage text="Loading draws..." />
        ) : !hasLoaded ? (
          <EmptyMessage
            title="Draw register unavailable"
            message="Use Refresh to try loading the draw register again."
          />
        ) : filtered.length === 0 ? (
          <EmptyMessage
            title="No draws found"
            message="Change the selected filters or check that your lottery is included in the draw register."
          />
        ) : (
          <div className="space-y-4">
            {filtered.map((item) => (
              <DrawRow
                key={item.id}
                item={item}
                disabled={running}
                onOpen={() => void openDraw(item)}
              />
            ))}
          </div>
        )}
      </section>

      {selected ? (
        <DrawModal
          item={selected}
          readiness={readiness}
          readinessCheckedAt={readinessCheckedAt}
          now={now}
          loadingReadiness={loadingReadiness}
          result={result}
          attemptedHere={attemptedHere}
          error={drawError}
          diagnostics={errorDiagnostics}
          confirm={confirm}
          running={running}
          setConfirm={setConfirm}
          onRun={() => void runDraw()}
          onRefresh={() => void openDraw(selected)}
          onClose={closeDraw}
        />
      ) : null}
    </div>
  );
}

function DrawErrorPanel({
  title = "Draw action needs review",
  error,
  diagnostics,
}: {
  title?: string;
  error: string;
  diagnostics: DrawErrorDiagnostics | null;
}) {
  return (
    <section
      role="alert"
      className="rounded-2xl border border-red-400/35 bg-red-500/10 p-5 text-red-50"
    >
      <h2 className="font-bold">{title}</h2>
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
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full cursor-pointer appearance-none rounded-2xl border border-white/10 bg-[#15172a] px-4 py-3 pr-10 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
      >
        {children}
      </select>

      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
    </div>
  );
}

function DrawRow({
  item,
  disabled,
  onOpen,
}: {
  item: LotteryDrawListItem;
  disabled: boolean;
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
              <Info label="Draw date" value={formatDate(item.draw_at)} />
              <Info label="Paid orders" value={String(item.paid_orders)} />
              <Info
                label="Eligible tickets"
                value={String(item.eligible_tickets)}
              />
              <Info
                label="Excluded tickets"
                value={String(item.excluded_tickets)}
              />
              <Info label="Prizes" value={String(item.prizes_available)} />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpen}
          disabled={disabled}
          className={`${BUTTON_CLASS} shrink-0 rounded-xl px-3 py-2 text-xs`}
        >
          <Eye className="h-3.5 w-3.5" />
          {item.draw_status === "completed" ? "View draw" : "Open draw"}
        </button>
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
      <div className="text-[10px] font-bold uppercase tracking-wide text-white/40">
        {label}
      </div>
      <div className="mt-1 break-words text-xs font-bold text-white/80">
        {value}
      </div>
    </div>
  );
}

function LoadingMessage({ text }: { text: string }) {
  return (
    <div
      role="status"
      className="flex min-h-52 items-center justify-center text-white/70"
    >
      <Loader2 className="mr-2 h-5 w-5 animate-spin motion-reduce:animate-none" />
      {text}
    </div>
  );
}

function EmptyMessage({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
      <Trophy className="mx-auto h-8 w-8 text-white/30" />
      <h3 className="mt-3 font-bold text-white">{title}</h3>
      <p className="mt-1 text-sm text-white/60">{message}</p>
    </div>
  );
}

function DrawModal({
  item,
  readiness,
  readinessCheckedAt,
  now,
  loadingReadiness,
  result,
  attemptedHere,
  error,
  diagnostics,
  confirm,
  running,
  setConfirm,
  onRun,
  onRefresh,
  onClose,
}: {
  item: LotteryDrawListItem;
  readiness: ReadinessResponse | null;
  readinessCheckedAt: number;
  now: number;
  loadingReadiness: boolean;
  result: DrawResult | null;
  attemptedHere: boolean;
  error: string | null;
  diagnostics: DrawErrorDiagnostics | null;
  confirm: boolean;
  running: boolean;
  setConfirm: (value: boolean) => void;
  onRun: () => void;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(false);
  const [overriding, setOverriding] = useState(false);

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

    if (!element.open) {
      element.showModal();
    }

    return () => {
      if (element.open) element.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [mounted]);

  if (!mounted) return null;

  const blockReasons = drawBlockReasons(item, readiness, now);

  if (
    readiness &&
    (readinessCheckedAt === 0 ||
      now - readinessCheckedAt > READINESS_MAX_AGE_MS)
  ) {
    blockReasons.push(
      "Readiness has expired. Use Refresh checks before requesting this draw.",
    );
  }

  if (attemptedHere) {
    blockReasons.push(
      "A draw request has already been submitted during this screen session. Check the draw records, winners and audit log before further action.",
    );
  }

  const canRun =
    !running &&
    !overriding &&
    !attemptedHere &&
    !loadingReadiness &&
    canRunDraw(item, readiness, now) &&
    blockReasons.length === 0;

  return createPortal(
    <dialog
      ref={dialog}
      aria-labelledby="draw-details-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!running && !overriding) onClose();
      }}
      className="m-auto w-[calc(100%-1.5rem)] max-w-5xl bg-transparent p-0 text-white backdrop:bg-black/75 backdrop:backdrop-blur-sm"
    >
      <div className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#15172a] shadow-2xl">
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
              <p className="mt-1 text-sm text-white/60">
                Draw controls
              </p>
            </div>
          </div>

          <button
            type="button"
            autoFocus
            onClick={onClose}
            disabled={running || overriding}
            aria-label="Close draw details"
            className="cursor-pointer rounded-xl border border-white/10 p-2 text-white/75 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          aria-busy={loadingReadiness || running || overriding}
          className="overflow-y-auto p-5 md:p-6"
        >
          {error ? (
            <div className="mb-5">
              <DrawErrorPanel
                error={error}
                diagnostics={diagnostics}
              />
            </div>
          ) : null}

          {(attemptedHere || running) && !result ? (
            <p
              role="status"
              className="mb-5 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100"
            >
              {running
                ? "Checking or submitting the draw. Keep this screen open."
                : "A draw request has been sent. Verify the draw records, winners and audit log. This screen will not submit it again."}
            </p>
          ) : null}

          {!running && !attemptedHere && !result ? (
            <div className="mb-5 flex justify-end">
              <button
                type="button"
                onClick={onRefresh}
                disabled={loadingReadiness || overriding}
                className={BUTTON_CLASS}
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    loadingReadiness
                      ? "animate-spin motion-reduce:animate-none"
                      : ""
                  }`}
                />
                Refresh checks
              </button>
            </div>
          ) : null}

          {!running && !overriding &&
          !attemptedHere &&
          !loadingReadiness &&
          readiness &&
          !result ? (
            <div className="mb-6">
              <LiveDrawSettingsPanel lotteryId={item.id} />
              <p className="mt-3 text-xs leading-5 text-white/60">
                After saving settings, use Refresh checks before
                requesting the draw.
              </p>
            </div>
          ) : null}

          {loadingReadiness ? (
            <LoadingMessage text="Checking lottery status and draw readiness..." />
          ) : result ? (
            <DrawResultView result={result} />
          ) : readiness ? (
            <ReadinessView
              item={item}
              readiness={readiness}
              canRun={canRun}
              blockReasons={blockReasons}
              confirm={confirm}
              running={running}
              setConfirm={setConfirm}
              onRun={onRun}
            />
          ) : (
            <EmptyMessage
              title="Draw information unavailable"
              message="Use Refresh checks to load the current lottery status and readiness."
            />
          )}

          {readiness && !loadingReadiness && !running && !attemptedHere &&
          !result && readiness.lottery.id === item.id && canRequestOverride(item) ? (
            <MainAdminOverrideForm
              key={item.id}
              lotteryId={item.id}
              lotteryTitle={item.title}
              onBusyChange={setOverriding}
              onVerified={onRefresh}
            />
          ) : null}
        </div>
      </div>
    </dialog>,
    document.body,
  );
}

function MainAdminOverrideForm({
  lotteryId, lotteryTitle, onBusyChange, onVerified,
}: {
  lotteryId: string;
  lotteryTitle: string;
  onBusyChange: (busy: boolean) => void;
  onVerified: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | undefined>();
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const inFlight = useRef(false);
  const request = useRef<AbortController | null>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const toggleButton = useRef<HTMLButtonElement>(null);
  const restoreToggleFocus = useRef(false);

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (expanded) passwordInput.current?.focus();
    else if (restoreToggleFocus.current) {
      restoreToggleFocus.current = false;
      toggleButton.current?.focus();
    }
  }, [expanded]);

  function cancel() {
    if (inFlight.current) return;
    setPassword("");
    setReason("");
    setShowPassword(false);
    setConfirmed(false);
    setError(null);
    setReference(undefined);
    restoreToggleFocus.current = true;
    setExpanded(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || needsRefresh) return;
    if (!password || password.length > 1024 || reason.trim().length < 10 ||
        reason.trim().length > 1000 || !confirmed) {
      setError("Enter your Main Admin password, a reason of 10–1,000 characters and confirm the request.");
      return;
    }

    const controller = new AbortController();
    request.current = controller;
    inFlight.current = true;
    setBusy(true);
    onBusyChange(true);
    setError(null);
    setReference(undefined);
    let submitted = false;
    let verified = false;

    try {
      // Never persist, log or put the password in a URL. The server must use
      // its existing password-verification and distributed rate-limit helpers.
      const body = JSON.stringify({
        main_admin_password: password,
        reason: reason.trim(),
        confirmed: true,
      });
      setPassword("");
      setShowPassword(false);
      const idempotencyKey = crypto.randomUUID();
      submitted = true;
      const { response, data } = await requestJson(
        drawOverrideRoute(lotteryId),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body,
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setReference(requestId(data));

      if (response.status === 404 || response.status === 405 || response.status === 501) {
        setError("The Main Admin override service is not available. The server route must be connected before an override can be approved.");
        return;
      }
      if (response.status === 401 || response.status === 403) {
        setError("Override not authorised. Sign in as Main Admin, check your password and complete any required two-factor verification.");
        return;
      }
      if (response.status === 429) {
        setError("Too many attempts. Wait before trying again.");
        return;
      }
      if (response.status === 400 || response.status === 422) {
        setError("The override request was not accepted. Check your reason and refresh the draw checks.");
        return;
      }
      if (!response.ok || !isOverrideResult(data, lotteryId)) {
        setNeedsRefresh(true);
        setError("The override outcome could not be verified. Refresh the checks and review the audit log before making another request.");
        return;
      }

      // Only fresh server readiness can enable the existing draw flow. Never
      // set ready=true here, remove failed checks, or clear attempted-draw guards.
      verified = true;
      setReason("");
      setConfirmed(false);
      setExpanded(false);
    } catch {
      if (!controller.signal.aborted) {
        setNeedsRefresh(submitted);
        setError(submitted
          ? "The override outcome could not be verified. Refresh the checks and review the audit log before making another request."
          : "The request could not be prepared. Refresh the page and try again.");
      }
    } finally {
      inFlight.current = false;
      request.current = null;
      if (!controller.signal.aborted) {
        setPassword("");
        setShowPassword(false);
        setBusy(false);
        onBusyChange(false);
        if (verified) onVerified();
      }
    }
  }

  const fieldClass = "mt-2 w-full rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 disabled:opacity-50";

  return (
    <section className="mt-6 rounded-2xl border border-amber-400/35 bg-amber-500/10 p-5" aria-labelledby="main-admin-override-heading">
      <h3 id="main-admin-override-heading" className="font-bold text-amber-100">Main Admin override</h3>
      <p className="mt-2 text-sm leading-6 text-white/80">
        Request a reviewed override for this blocked draw. Your Main Admin password
        and a reason are required. The server decides which blockers can be cleared.
        Sales, ticket eligibility, integrity and duplicate-draw checks still apply.
      </p>
      <p className="mt-2 text-sm leading-6 text-white/70">Approving an override does not run the draw. Refresh the checks, then use the normal draw confirmation.</p>
      {!expanded ? (
        <button ref={toggleButton} type="button" onClick={() => setExpanded(true)} className={`${BUTTON_CLASS} mt-4`} aria-expanded={false} aria-controls="main-admin-override-form">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Request Main Admin override
        </button>
      ) : (
        <form id="main-admin-override-form" onSubmit={submit} className="mt-5 space-y-4" aria-busy={busy}>
          <div>
            <label htmlFor="main-admin-override-password" className="text-sm font-bold text-white">Main Admin password</label>
            <input ref={passwordInput} id="main-admin-override-password" name="main_admin_password" type={showPassword ? "text" : "password"}
              autoComplete="current-password" autoCapitalize="none" spellCheck={false} value={password}
              onChange={(event) => setPassword(event.target.value)} required maxLength={1024} disabled={busy || needsRefresh}
              aria-describedby="main-admin-password-help" className={fieldClass} />
            <p id="main-admin-password-help" className="mt-2 text-xs leading-5 text-white/70">Use the password for your own signed-in Main Admin account.</p>
            <button type="button" onClick={() => setShowPassword((value) => !value)} disabled={busy || needsRefresh} aria-controls="main-admin-override-password" aria-pressed={showPassword}
              className={`${BUTTON_CLASS} mt-2 px-3 py-2 text-xs`}>{showPassword ? "Hide password" : "Show password"}</button>
          </div>
          <div>
            <label htmlFor="main-admin-override-reason" className="text-sm font-bold text-white">Reason for the override</label>
            <textarea id="main-admin-override-reason" name="reason" value={reason} onChange={(event) => setReason(event.target.value)}
              required minLength={10} maxLength={1000} rows={3} disabled={busy || needsRefresh} className={`${fieldClass} resize-y`} aria-describedby="main-admin-reason-help" />
            <p id="main-admin-reason-help" className="mt-2 text-xs leading-5 text-white/70">Explain what you reviewed and why an override is appropriate (10–1,000 characters). Do not include passwords or entrant details.</p>
          </div>
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-white/80">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} required disabled={busy || needsRefresh}
              className="mt-1 h-4 w-4 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300" />
            <span>I have reviewed the block on “{lotteryTitle}” and authorise this override request to be recorded in the audit log.</span>
          </label>
          {error ? <div role="alert" className="rounded-xl border border-red-400/35 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
            <p>{error}</p>{reference ? <p className="mt-2 break-all text-xs">Request reference: {reference}</p> : null}
          </div> : null}
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={busy || needsRefresh || !password || reason.trim().length < 10 || !confirmed} className={BUTTON_CLASS}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" aria-hidden="true" />}
              {busy ? "Verifying override…" : "Verify password and request override"}
            </button>
            <button type="button" onClick={cancel} disabled={busy} className={BUTTON_CLASS}>Cancel</button>
            {needsRefresh ? <button type="button" onClick={onVerified} disabled={busy} className={BUTTON_CLASS}>Refresh checks</button> : null}
          </div>
        </form>
      )}
    </section>
  );
}

function ReadinessView({
  item,
  readiness,
  canRun,
  blockReasons,
  confirm,
  running,
  setConfirm,
  onRun,
}: {
  item: LotteryDrawListItem;
  readiness: ReadinessResponse;
  canRun: boolean;
  blockReasons: string[];
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
        These are reported readiness counts. The draw request will
        recheck eligibility and approval before selecting winners.
      </p>

      {canRetryFailedDraw(item, readiness) ? (
        <p className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
          The server confirmed that previous attempts failed without completion and no winners exist.
          Those records are retained. You can request a new draw when every readiness check passes.
        </p>
      ) : null}

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
              [
                "Lottery status",
                item.lottery_status.replaceAll("_", " "),
              ],
              ["Draw status", statusLabel(item.draw_status)],
              [
                "Server readiness",
                readiness.ready ? "Ready" : "Not ready",
              ],
              [
                "Existing draw",
                item.latest_draw_id || "No draw reported",
              ],
            ]}
          />
        </Panel>

        <Panel title="Draw integrity">
          {readiness.checks.length > 0 ? (
            <div className="space-y-3">
              {readiness.checks.map((check) => (
                <IntegrityRow
                  key={check.key}
                  ok={check.ok}
                  text={publicCheck(check)}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-red-200">
              No readiness checks were returned.
            </p>
          )}
        </Panel>
      </div>

      <div
        className={`mt-6 rounded-2xl border p-5 ${
          canRun
            ? "border-emerald-400/25 bg-emerald-500/10"
            : running
              ? "border-amber-400/25 bg-amber-500/10"
              : "border-red-400/25 bg-red-500/10"
        }`}
      >
        <div className="flex items-start gap-3">
          {running ? (
            <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-amber-300 motion-reduce:animate-none" />
          ) : canRun ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
          )}

          <div className="min-w-0">
            <h3 className="font-bold text-white">
              {running
                ? "Draw request in progress"
                : canRun
                  ? "Draw is ready"
                  : "Draw is currently blocked"}
            </h3>

            {running ? (
              <p className="mt-1 text-sm leading-6 text-white/75">
                Wait for the result. Another draw request cannot be
                submitted while this request is in progress.
              </p>
            ) : canRun ? (
              <p className="mt-1 text-sm leading-6 text-white/75">
                The checks allow you to request this draw. The server
                will validate it again before selecting winners.
              </p>
            ) : (
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-white/80">
                {blockReasons.map((reason, index) => (
                  <li
                    key={`${index}-${reason}`}
                    className="break-words"
                  >
                    {reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {canRun ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={confirm}
              disabled={running}
              onChange={(event) => setConfirm(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-white/20 bg-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
            />

            <span className="text-sm leading-6 text-white/80">
              I confirm sales are closed, the information above is
              correct and I am authorised to execute this draw.
            </span>
          </label>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={onRun}
              disabled={!confirm || running}
              className="inline-flex min-w-40 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-black hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trophy className="h-4 w-4" />
              Request draw
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
      <div
        role="status"
        className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-5"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />

          <div>
            <h3 className="font-bold text-white">Draw complete</h3>
            <p className="mt-1 text-sm leading-6 text-white/75">
              A completed draw result was returned. Review the winners
              and audit log below.
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
                  <p className="text-[10px] font-bold uppercase tracking-wide text-white/40">
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
          className={BUTTON_CLASS}
        >
          <ShieldCheck className="h-4 w-4" />
          View audit log
        </a>

        <a
          href="/Admin/LotteryManagement/Winners"
          className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-black hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
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
      <div className="text-xs font-bold uppercase tracking-wide text-white/40">
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
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <h3 className="text-base font-extrabold text-white">{title}</h3>
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
          <div className="text-xs font-bold text-white/50">
            {label}
          </div>
          <div className="break-words text-sm text-white/80">
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
}: {
  ok: boolean;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
      )}

      <div>
        <p className="text-sm font-semibold text-white/80">
          {text}
        </p>
        <p className="mt-1 text-xs text-white/60">
          {ok ? "Passed" : "Needs attention"}
        </p>
      </div>
    </div>
  );
}
