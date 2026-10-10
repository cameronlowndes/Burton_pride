"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type LotteryAuditLog = {
  id: string;
  created_at: string;
  action_code: string;
  action_label: string;
  action_group?: string | null;
  risk_level?: string | null;
  admin_name?: string | null;
  admin_email?: string | null;
  admin_id?: string | null;
  lottery_title?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  reason?: string | null;
  device_context?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  before_data?: Record<string, unknown> | null;
  after_data?: Record<string, unknown> | null;
};

type LotteryAuditResponse = {
  logs: LotteryAuditLog[];
  total: number;
  summary: {
    total: number;
    highRisk: number;
    denied: number;
    exports: number;
    draws: number;
  };
};

type Filters = {
  search: string;
  group: string;
  risk: string;
  from: string;
  to: string;
};

const API_ROUTE = "/api/admin/lotterymanagement/audit-logs";
const PAGE_SIZE = 25;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_EXPORT_BYTES = 10 * 1024 * 1024;
const EMPTY_FILTERS: Filters = {
  search: "",
  group: "",
  risk: "",
  from: "",
  to: "",
};
type SortField = "created_at" | "action_group" | "action_label" | "risk_level";

const groups = [
  "lottery",
  "ticket",
  "payment",
  "prize",
  "draw",
  "winner",
  "compliance",
  "security",
  "export",
];

function formatDate(value: string) {
  if (!Number.isFinite(Date.parse(value))) return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

function groupLabel(value: string | null | undefined) {
  return value?.trim() || "Legacy / unclassified";
}

function riskLabel(value: string | null | undefined) {
  return ["low", "medium", "high", "critical"].includes(value ?? "")
    ? value!
    : "Not recorded / unknown";
}

function riskClasses(risk: string | null | undefined) {
  if (risk === "critical")
    return "border-red-500/40 bg-red-500/10 text-red-200";
  if (risk === "high")
    return "border-orange-500/40 bg-orange-500/10 text-orange-200";
  if (risk === "medium")
    return "border-amber-500/40 bg-amber-500/10 text-amber-100";
  if (risk === "low")
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
  return "border-slate-400/30 bg-slate-400/10 text-slate-200";
}

function prettyJson(value: unknown) {
  if (value == null) return "No data recorded";
  const seen = new WeakSet<object>();
  const redact = (input: unknown, depth: number): unknown => {
    if (depth > 8) return "[Depth limit]";
    if (!input || typeof input !== "object") return input;
    if (seen.has(input)) return "[Circular reference]";
    seen.add(input);
    if (Array.isArray(input))
      return input.slice(0, 100).map((item) => redact(item, depth + 1));
    return Object.fromEntries(
      Object.entries(input)
        .slice(0, 100)
        .map(([key, val]) => [
          key,
          /password|passwd|secret|token|authorization|cookie|apikey|privatekey/i.test(
            key.replace(/[^a-z0-9]/gi, ""),
          )
            ? "[Redacted]"
            : redact(val, depth + 1),
        ]),
    );
  };
  try {
    const text =
      JSON.stringify(redact(value, 0), null, 2) ?? "No data recorded";
    return text.length > 20_000
      ? text.slice(0, 20_000) + "\n[Display truncated]"
      : text;
  } catch {
    return "[Data cannot be displayed]";
  }
}

function filterError(filters: Filters) {
  for (const value of [filters.from, filters.to]) {
    if (
      value &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isFinite(Date.parse(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value)
    ) {
      return "Enter a valid date.";
    }
  }
  if (filters.from && filters.to && filters.from > filters.to)
    return "From must be on or before To.";
  return "";
}

async function readBoundedBody(response: Response, maximum: number) {
  if (!response.body) throw new Error("Empty response.");
  if (Number(response.headers.get("Content-Length")) > maximum) {
    await response.body.cancel();
    throw new Error(
      "Response exceeds the safe download limit. Narrow your filters.",
    );
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw new Error(
          "Response exceeds the safe download limit. Narrow your filters.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return new Blob(chunks as BlobPart[]);
}

function readAuditResponse(value: unknown): LotteryAuditResponse {
  if (!value || typeof value !== "object")
    throw new Error("Invalid audit response.");
  const body = value as Record<string, unknown>;
  if (
    !Array.isArray(body.logs) ||
    body.logs.length > PAGE_SIZE ||
    Number(body.total) < body.logs.length ||
    !Number.isSafeInteger(body.total) ||
    Number(body.total) < 0 ||
    !body.summary ||
    typeof body.summary !== "object"
  )
    throw new Error("Invalid audit response.");
  const summary = body.summary as Record<string, unknown>;
  if (
    !["total", "highRisk", "denied", "exports", "draws"].every(
      (key) => Number.isSafeInteger(summary[key]) && Number(summary[key]) >= 0,
    )
  )
    throw new Error("Invalid audit summary.");
  const ids = new Set<string>();
  for (const record of body.logs) {
    if (!record || typeof record !== "object")
      throw new Error("Invalid audit record.");
    const log = record as Record<string, unknown>;
    if (
      !["id", "created_at", "action_code", "action_label"].every(
        (key) => typeof log[key] === "string",
      ) ||
      !log.id ||
      ids.has(log.id as string) ||
      ![
        "action_group",
        "risk_level",
        "admin_name",
        "admin_email",
        "admin_id",
        "lottery_title",
        "entity_type",
        "entity_id",
        "reason",
        "ip_address",
      ].every((key) => log[key] == null || typeof log[key] === "string")
    ) {
      throw new Error("Invalid audit record.");
    }
    ids.add(log.id as string);
  }
  return value as LotteryAuditResponse;
}

export default function AuditLogsClient() {
  const [filters, setFilters] = useState<Filters>({ ...EMPTY_FILTERS });
  const [applied, setApplied] = useState(filters);
  const [data, setData] = useState<LotteryAuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortField>("created_at");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<LotteryAuditLog | null>(null);

  const [filterMessage, setFilterMessage] = useState("");
  const [exporting, setExporting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const exportRef = useRef<AbortController | null>(null);
  const exportBusyRef = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const fromRef = useRef<HTMLInputElement>(null);

  const params = useMemo(() => {
    const p = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      sort,
      direction,
    });
    Object.entries(applied).forEach(([k, v]) => v && p.set(k, v));
    return p;
  }, [applied, page, sort, direction]);

  const load = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    setLoading(true);
    setError("");
    setData(null);
    setSelected(null);
    try {
      const res = await fetch(`${API_ROUTE}?${params}`, {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });
      if (res.status === 401 || res.status === 403) {
        throw new Error(
          "Your session has expired or you do not have permission to view audit logs.",
        );
      }
      if (!res.ok) throw new Error("Unable to load audit logs. Try Refresh.");
      const body = readAuditResponse(
        JSON.parse(
          await (await readBoundedBody(res, MAX_RESPONSE_BYTES)).text(),
        ),
      );
      if (requestRef.current !== controller || controller.signal.aborted)
        return;
      const lastPage = Math.max(1, Math.ceil(body.total / PAGE_SIZE));
      if (page > lastPage) {
        setPage(lastPage);
        return;
      }
      setData(body);
    } catch (e) {
      if (requestRef.current !== controller) return;
      setData(null);
      setSelected(null);
      setError(
        controller.signal.aborted
          ? "Loading timed out. Try Refresh."
          : e instanceof Error && e.message.startsWith("Your session")
            ? e.message
            : "Unable to load audit logs. Try Refresh or narrow your filters. If this continues, ask an administrator to check the response.",
      );
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === controller) setLoading(false);
    }
  }, [params, page]);

  useEffect(() => {
    void load();
    return () => {
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [load]);
  useEffect(() => {
    setMounted(true);
    return () => {
      exportRef.current?.abort();
      exportRef.current = null;
    };
  }, []);
  useEffect(() => {
    if (selected && dialogRef.current && !dialogRef.current.open)
      dialogRef.current.showModal();
  }, [selected, mounted]);

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    if (exportBusyRef.current) return;
    const message = filterError(filters);
    setFilterMessage(message);
    if (message) {
      fromRef.current?.focus();
      return;
    }
    setPage(1);
    setApplied({ ...filters, search: filters.search.trim() });
  };

  const clearFilters = () => {
    const empty = { ...EMPTY_FILTERS };
    setFilterMessage("");
    searchRef.current?.focus();
    setFilters(empty);
    setApplied(empty);
    setPage(1);
  };

  const changeSort = (field: SortField) => {
    if (sort === field) setDirection(direction === "asc" ? "desc" : "asc");
    else {
      setSort(field);
      setDirection("desc");
    }
    setPage(1);
  };

  const exportCsv = async () => {
    if (loading || exportBusyRef.current || !data?.total) return;
    exportBusyRef.current = true;
    setExporting(true);
    setError("");
    const controller = new AbortController();
    exportRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 60_000);
    let downloadUrl: string | null = null;
    try {
      const p = new URLSearchParams({ sort, direction });
      Object.entries(applied).forEach(
        ([key, value]) => value && p.set(key, value),
      );
      const res = await fetch(`${API_ROUTE}/export?${p}`, {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });
      if (res.status === 401 || res.status === 403) {
        requestRef.current?.abort();
        requestRef.current = null;
        setData(null);
        setSelected(null);
        setLoading(false);
        throw new Error(
          "Your session has expired or you do not have permission to export audit logs.",
        );
      }
      if (!res.ok)
        throw new Error(
          "The CSV export could not be prepared. Narrow your filters or ask an administrator to check export access and audit logging.",
        );
      const contentType = res.headers
        .get("Content-Type")
        ?.split(";")[0]
        .trim()
        .toLowerCase();
      if (contentType !== "text/csv" && contentType !== "application/csv")
        throw new Error("The server did not return a CSV file.");
      const body = await readBoundedBody(res, MAX_EXPORT_BYTES);
      if (controller.signal.aborted || exportRef.current !== controller) return;
      downloadUrl = URL.createObjectURL(
        new Blob([body], { type: "text/csv;charset=utf-8" }),
      );
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `lottery-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (e) {
      if (exportRef.current === controller)
        setError(
          controller.signal.aborted
            ? "Export timed out. Narrow your filters and try again."
            : e instanceof Error
              ? e.message
              : "The CSV export could not be downloaded.",
        );
    } finally {
      window.clearTimeout(timeout);
      if (downloadUrl) {
        const url = downloadUrl;
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      exportBusyRef.current = false;
      if (exportRef.current === controller) {
        exportRef.current = null;
        setExporting(false);
      }
    }
  };

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
  const sortState = (field: SortField): "ascending" | "descending" | "none" =>
    sort === field
      ? direction === "asc"
        ? "ascending"
        : "descending"
      : "none";

  return (
    <main className="min-h-screen w-full bg-[#08070d] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 top-12 h-96 w-96 rounded-full bg-fuchsia-600/10 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-[28rem] w-[28rem] rounded-full bg-violet-600/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-none px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-300">
              Lottery Management <span className="text-white/30">/</span> Audit
              Logs
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Audit Logs
            </h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-white/60 sm:text-base">
              Recorded history of security-sensitive and outcome-changing
              lottery actions, including draws, ticket changes, payments,
              compliance changes, exports and denied access attempts.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading || exporting}
              className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-fuchsia-400 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold hover:bg-white/10"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void exportCsv()}
              disabled={loading || exporting || !data?.total}
              aria-describedby="audit-export-help"
              className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-fuchsia-400 rounded-xl bg-fuchsia-600 px-4 py-2.5 text-sm font-semibold shadow-lg shadow-fuchsia-950/30 hover:bg-fuchsia-500"
            >
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
          </div>
        </header>

        <p id="audit-export-help" className="mb-4 text-sm text-white/60">
          CSV exports use the applied filters across all matching pages. Narrow
          your filters for downloads above 10 MB.
        </p>
        <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {[
            ["Total records", data?.summary?.total ?? 0],
            ["High / critical", data?.summary?.highRisk ?? 0],
            ["Denied access", data?.summary?.denied ?? 0],
            ["Exports", data?.summary?.exports ?? 0],
            ["Draw activity", data?.summary?.draws ?? 0],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 backdrop-blur-sm"
            >
              <div className="text-xs font-medium uppercase tracking-wide text-white/45">
                {label}
              </div>
              <div className="mt-2 text-2xl font-bold">{value}</div>
            </div>
          ))}
        </section>

        <form
          noValidate
          onSubmit={applyFilters}
          aria-describedby={filterMessage ? "audit-filter-error" : undefined}
          className="mb-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4 backdrop-blur-sm"
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(280px,2fr)_1fr_1fr_1fr_1fr_auto]">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-white/55">
                Search
              </span>
              <div className="relative">
                <input
                  ref={searchRef}
                  maxLength={200}
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, search: e.target.value }))
                  }
                  placeholder="Action, admin, lottery, entity ID..."
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/30 pl-3 pr-14 text-sm outline-none placeholder:text-white/25 focus:border-fuchsia-400/60 focus:ring-2 focus:ring-fuchsia-500/20"
                />
                {filters.search ? (
                  <button
                    type="button"
                    aria-label="Clear search"
                    disabled={exporting}
                    onClick={() => {
                      setFilters((f) => ({ ...f, search: "" }));
                      setApplied((f) => ({ ...f, search: "" }));
                      setPage(1);
                      searchRef.current?.focus();
                    }}
                    className="absolute right-1 top-1 min-h-9 min-w-9 rounded-lg px-2 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-fuchsia-400"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-white/55">
                Action group
              </span>
              <select
                value={filters.group}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, group: e.target.value }))
                }
                className="h-11 w-full rounded-xl border border-white/10 bg-[#111019] px-3 text-sm outline-none focus:border-fuchsia-400/60 focus-visible:ring-2 focus-visible:ring-fuchsia-400"
              >
                <option value="">All groups</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g[0].toUpperCase() + g.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-white/55">
                Risk
              </span>
              <select
                value={filters.risk}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, risk: e.target.value }))
                }
                className="h-11 w-full rounded-xl border border-white/10 bg-[#111019] px-3 text-sm outline-none focus:border-fuchsia-400/60 focus-visible:ring-2 focus-visible:ring-fuchsia-400"
              >
                <option value="">All risk</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-white/55">
                From
              </span>
              <input
                ref={fromRef}
                type="date"
                aria-invalid={Boolean(filterMessage)}
                aria-describedby={
                  filterMessage ? "audit-filter-error" : undefined
                }
                value={filters.from}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, from: e.target.value }))
                }
                className="h-11 w-full rounded-xl border border-white/10 bg-[#111019] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-white/55">
                To
              </span>
              <input
                type="date"
                aria-invalid={Boolean(filterMessage)}
                aria-describedby={
                  filterMessage ? "audit-filter-error" : undefined
                }
                value={filters.to}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, to: e.target.value }))
                }
                className="h-11 w-full rounded-xl border border-white/10 bg-[#111019] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400"
              />
            </label>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={exporting}
                className="h-11 rounded-xl bg-white px-4 text-sm font-bold text-black hover:bg-white/90"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={clearFilters}
                disabled={exporting}
                className="h-11 rounded-xl border border-white/10 px-3 text-sm hover:bg-white/5"
              >
                Clear
              </button>
            </div>
          </div>
          {filterMessage ? (
            <p
              id="audit-filter-error"
              role="alert"
              className="mt-3 text-sm text-red-200"
            >
              {filterMessage}
            </p>
          ) : null}
        </form>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100"
          >
            {error}
          </div>
        )}

        <section
          aria-busy={loading}
          className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] shadow-2xl shadow-black/20"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.04] text-xs uppercase tracking-wide text-white/45">
                <tr>
                  <th
                    scope="col"
                    aria-sort={sortState("created_at")}
                    className="px-4 py-3"
                  >
                    <button
                      type="button"
                      className="rounded px-1 py-2 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-fuchsia-400 disabled:opacity-40"
                      disabled={loading || exporting}
                      onClick={() => changeSort("created_at")}
                    >
                      Date / time ↕
                    </button>
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Admin
                  </th>
                  <th
                    scope="col"
                    aria-sort={sortState("action_group")}
                    className="px-4 py-3"
                  >
                    <button
                      type="button"
                      className="rounded px-1 py-2 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-fuchsia-400 disabled:opacity-40"
                      disabled={loading || exporting}
                      onClick={() => changeSort("action_group")}
                    >
                      Group ↕
                    </button>
                  </th>
                  <th
                    scope="col"
                    aria-sort={sortState("action_label")}
                    className="px-4 py-3"
                  >
                    <button
                      type="button"
                      className="rounded px-1 py-2 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-fuchsia-400 disabled:opacity-40"
                      disabled={loading || exporting}
                      onClick={() => changeSort("action_label")}
                    >
                      Action ↕
                    </button>
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Lottery / entity
                  </th>
                  <th
                    scope="col"
                    aria-sort={sortState("risk_level")}
                    className="px-4 py-3"
                  >
                    <button
                      type="button"
                      className="rounded px-1 py-2 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-fuchsia-400 disabled:opacity-40"
                      disabled={loading || exporting}
                      onClick={() => changeSort("risk_level")}
                    >
                      Risk ↕
                    </button>
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Reason
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-16 text-center text-white/65"
                    >
                      <span role="status">Loading audit history…</span>
                    </td>
                  </tr>
                ) : !data?.logs.length ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <div className="font-semibold">
                        {error
                          ? "Audit history unavailable"
                          : "No audit records found"}
                      </div>
                      <div className="mt-1 text-white/45">
                        {error
                          ? "Try Refresh after checking your session."
                          : "Try changing the filters."}
                      </div>
                    </td>
                  </tr>
                ) : (
                  data.logs.map((log) => (
                    <tr
                      key={log.id}
                      className="align-top hover:bg-white/[0.025]"
                    >
                      <td className="whitespace-nowrap px-4 py-4 text-white/70">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold">
                          {log.admin_name || "System / unknown"}
                        </div>
                        <div className="mt-1 text-xs text-white/40">
                          {log.admin_email ||
                            log.admin_id ||
                            "No admin snapshot"}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold capitalize">
                          {groupLabel(log.action_group)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold">{log.action_label}</div>
                        <div className="mt-1 font-mono text-[11px] text-white/35">
                          {log.action_code}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium">
                          {log.lottery_title || "—"}
                        </div>
                        <div className="mt-1 text-xs text-white/40">
                          {log.entity_type
                            ? `${log.entity_type}: ${log.entity_id || "—"}`
                            : "No entity recorded"}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-lg border px-2 py-1 text-xs font-bold uppercase ${riskClasses(log.risk_level)}`}
                        >
                          {riskLabel(log.risk_level)}
                        </span>
                      </td>
                      <td className="max-w-[260px] px-4 py-4 text-white/60">
                        <div className="line-clamp-2">{log.reason || "—"}</div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          aria-haspopup="dialog"
                          aria-label={`View audit details: ${log.action_label}`}
                          onClick={(event) => {
                            triggerRef.current = event.currentTarget;
                            setSelected(log);
                          }}
                          className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-fuchsia-400 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/10"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div role="status" className="text-sm text-white/65">
              Page {page} of {totalPages} · {data?.total ?? 0} records
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading || exporting}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-fuchsia-400 rounded-lg border border-white/10 px-3 py-2 text-sm disabled:opacity-30"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages || loading || exporting}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-fuchsia-400 rounded-lg border border-white/10 px-3 py-2 text-sm disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>

      {mounted && selected
        ? createPortal(
            <dialog
              ref={dialogRef}
              aria-labelledby="audit-detail-title"
              aria-describedby="audit-detail-description"
              onClose={() => {
                setSelected(null);
                if (triggerRef.current?.isConnected) triggerRef.current.focus();
              }}
              className="fixed left-1/2 top-1/2 m-0 max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-white/10 bg-[#0d0c13] p-0 text-white shadow-2xl backdrop:bg-black/75"
            >
              <div className="sticky top-0 z-10 flex items-start justify-between border-b border-white/10 bg-[#0d0c13]/95 p-5 backdrop-blur">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-fuchsia-300">
                    Audit record
                  </div>
                  <h2
                    id="audit-detail-title"
                    className="mt-1 text-xl font-bold"
                  >
                    {selected.action_label}
                  </h2>
                  <div className="mt-1 font-mono text-xs text-white/35">
                    {selected.id}
                  </div>
                </div>
                <button
                  type="button"
                  autoFocus
                  aria-label="Close audit details"
                  onClick={() => dialogRef.current?.close()}
                  className="cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-fuchsia-400 rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/10"
                >
                  Close
                </button>
              </div>
              <p
                id="audit-detail-description"
                className="px-5 pt-5 text-sm text-white/65"
              >
                Recorded action and changes. Common secret fields are redacted
                from the JSON preview.
              </p>
              <div className="grid gap-4 p-5 lg:grid-cols-2">
                <Info title="Recorded">
                  <p>{formatDate(selected.created_at)}</p>
                  <p className="mt-1 text-white/45">
                    Risk:{" "}
                    <span className="font-semibold uppercase">
                      {riskLabel(selected.risk_level)}
                    </span>
                  </p>
                </Info>
                <Info title="Administrator">
                  <p>{selected.admin_name || "System / unknown"}</p>
                  <p className="mt-1 text-white/45">
                    {selected.admin_email || selected.admin_id || "No snapshot"}
                  </p>
                </Info>
                <Info title="Action">
                  <p className="font-semibold">
                    {groupLabel(selected.action_group)}
                  </p>
                  <p className="mt-1 font-mono text-xs text-white/45">
                    {selected.action_code}
                  </p>
                </Info>
                <Info title="Affected record">
                  <p>{selected.lottery_title || "No lottery title snapshot"}</p>
                  <p className="mt-1 text-white/45">
                    {selected.entity_type || "entity"} ·{" "}
                    {selected.entity_id || "—"}
                  </p>
                </Info>
                <Info title="Reason" wide>
                  <p className="whitespace-pre-wrap">
                    {selected.reason || "No reason recorded."}
                  </p>
                </Info>
                <Info title="Request context">
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-white/55">
                    {prettyJson(selected.device_context)}
                  </pre>
                </Info>
                <Info title="Metadata">
                  <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-white/55">
                    {prettyJson(selected.metadata)}
                  </pre>
                </Info>
                <Info title="Before" wide>
                  <pre className="max-h-80 overflow-auto rounded-xl bg-black/30 p-3 text-xs text-white/65">
                    {prettyJson(selected.before_data)}
                  </pre>
                </Info>
                <Info title="After" wide>
                  <pre className="max-h-80 overflow-auto rounded-xl bg-black/30 p-3 text-xs text-white/65">
                    {prettyJson(selected.after_data)}
                  </pre>
                </Info>
              </div>
            </dialog>,
            document.body,
          )
        : null}
    </main>
  );
}

function Info({
  title,
  wide,
  children,
}: {
  title: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border border-white/10 bg-white/[0.025] p-4 ${wide ? "lg:col-span-2" : ""}`}
    >
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-white/40">
        {title}
      </h3>
      {children}
    </section>
  );
}
