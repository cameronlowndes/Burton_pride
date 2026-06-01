"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  History,
  Loader2,
  Printer,
  RefreshCcw,
  Search,
  ShieldAlert,
  XCircle,
} from "lucide-react";

type ExportLog = {
  id: string;
  created_at: string;

  action: "export" | "print" | string;
  export_key?: string | null;
  export_title?: string | null;
  export_type?: string | null;
  export_year?: number | null;

  route?: string | null;
  file_name?: string | null;
  status?: "started" | "success" | "failed" | string | null;

  actor_clerk_user_id?: string | null;
  actor_name?: string | null;
  actor_email?: string | null;

  metadata?: any;
  error_message?: string | null;
};

type ApiResponse = {
  ok: boolean;
  logs?: ExportLog[];
  error?: string;
};

const STATUS_OPTIONS = ["all", "started", "success", "failed"];
const ACTION_OPTIONS = ["all", "export", "print"];

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatText(value: string | null | undefined) {
  if (!value) return "-";

  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusStyles(status: string | null | undefined) {
  if (status === "success") {
    return {
      className: "border-emerald-300/25 bg-emerald-400/15 text-emerald-100",
      icon: CheckCircle2,
      label: "Success",
    };
  }

  if (status === "failed") {
    return {
      className: "border-red-300/25 bg-red-400/15 text-red-100",
      icon: XCircle,
      label: "Failed",
    };
  }

  return {
    className: "border-yellow-300/25 bg-yellow-400/15 text-yellow-100",
    icon: Clock,
    label: "Started",
  };
}

function actionStyles(action: string | null | undefined) {
  if (action === "print") {
    return {
      className: "border-blue-300/25 bg-blue-400/15 text-blue-100",
      icon: Printer,
      label: "Print",
    };
  }

  return {
    className: "border-emerald-300/25 bg-emerald-400/15 text-emerald-100",
    icon: Download,
    label: "Export",
  };
}

function JsonDetails({ title, value }: { title: string; value: any }) {
  if (!value) return null;

  return (
    <details className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
      <summary className="cursor-pointer text-xs font-black uppercase tracking-wide text-white/55">
        {title}
      </summary>

      <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/20 p-3 text-xs leading-5 text-white/75">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

export default function MoneyExportLogsPage() {
  const [logs, setLogs] = useState<ExportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [action, setAction] = useState("all");

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 12 }, (_, index) => current - 6 + index);
  }, []);

  const stats = useMemo(() => {
    const total = logs.length;
    const exports = logs.filter((item) => item.action === "export").length;
    const prints = logs.filter((item) => item.action === "print").length;
    const success = logs.filter((item) => item.status === "success").length;
    const failed = logs.filter((item) => item.status === "failed").length;
    const started = logs.filter((item) => item.status === "started").length;

    return {
      total,
      exports,
      prints,
      success,
      failed,
      started,
    };
  }, [logs]);

  async function loadLogs() {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();

      params.set("year", String(selectedYear));
      params.set("status", status);
      params.set("action", action);
      params.set("search", search.trim());
      params.set("limit", "1000");

      const res = await fetch(`/api/admin/money/export/logs?${params}`, {
        cache: "no-store",
      });

      const data = (await res.json().catch(() => ({}))) as ApiResponse;

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Could not load export logs.");
      }

      setLogs(data.logs || []);
    } catch (err: any) {
      setError(err?.message || "Could not load export logs.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, status, action]);

  function resetFilters() {
    setSearch("");
    setStatus("all");
    setAction("all");
  }

  function printLogsPage() {
    window.print();
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm;
          }

          html,
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }

          .export-logs-no-print {
            display: none !important;
          }

          .export-logs-print-page {
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
          }

          .export-logs-print-card {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            border: 1px solid #d4d4d8 !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
          }

          .export-logs-print-card * {
            color: #000000 !important;
          }

          .export-logs-print-card pre {
            max-height: none !important;
            overflow: visible !important;
            background: #f8fafc !important;
            border: 1px solid #d4d4d8 !important;
          }
        }
      `}</style>

      <main className="export-logs-print-page min-h-screen w-full bg-slate-950 px-4 py-8 text-white md:px-8">
        <div className="w-full max-w-none space-y-6">
          <section className="export-logs-print-card rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <Link
                  href="/Admin/MoneyManagement/TrackingMoney/Exports"
                  className="export-logs-no-print mb-4 inline-flex items-center gap-2 text-sm font-bold text-white/70 transition hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to The Exports Page
                </Link>

                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-200">
                    <History className="h-7 w-7" />
                  </div>

                  <div>
                    <h1 className="text-3xl font-black tracking-tight md:text-4xl">
                      Money Export Logs
                    </h1>

                    <p className="mt-2 max-w-5xl text-sm leading-6 text-white/60">
                      Tracks export downloads and print report actions from the
                      Money Export page.
                    </p>
                  </div>
                </div>
              </div>

              <div className="export-logs-no-print flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={loadLogs}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-white/90 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="h-4 w-4" />
                  )}
                  Refresh
                </button>

                <button
                  type="button"
                  onClick={printLogsPage}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
                >
                  <Printer className="h-4 w-4" />
                  Print logs
                </button>
              </div>
            </div>

            <div className="mt-6 grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                <div className="text-xs font-black uppercase tracking-wide text-white/45">
                  Total Logs
                </div>
                <div className="mt-2 text-2xl font-black">{stats.total}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                <div className="text-xs font-black uppercase tracking-wide text-white/45">
                  Exports
                </div>
                <div className="mt-2 text-2xl font-black">{stats.exports}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                <div className="text-xs font-black uppercase tracking-wide text-white/45">
                  Prints
                </div>
                <div className="mt-2 text-2xl font-black">{stats.prints}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                <div className="text-xs font-black uppercase tracking-wide text-white/45">
                  Success
                </div>
                <div className="mt-2 text-2xl font-black text-emerald-100">
                  {stats.success}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                <div className="text-xs font-black uppercase tracking-wide text-white/45">
                  Failed
                </div>
                <div className="mt-2 text-2xl font-black text-red-100">
                  {stats.failed}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                <div className="text-xs font-black uppercase tracking-wide text-white/45">
                  Started
                </div>
                <div className="mt-2 text-2xl font-black text-yellow-100">
                  {stats.started}
                </div>
              </div>
            </div>
          </section>

          <section className="export-logs-no-print rounded-[2rem] border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur-xl">
            <div className="grid w-full gap-4 lg:grid-cols-[180px_180px_180px_1fr_auto] lg:items-end">
              <label>
                <span className="mb-2 flex items-center gap-2 text-sm font-black">
                  <CalendarDays className="h-4 w-4 text-emerald-200" />
                  Year
                </span>

                <select
                  value={selectedYear}
                  onChange={(event) =>
                    setSelectedYear(Number(event.target.value))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none"
                >
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="mb-2 flex items-center gap-2 text-sm font-black">
                  <ShieldAlert className="h-4 w-4 text-yellow-200" />
                  Status
                </span>

                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none"
                >
                  {STATUS_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item === "all" ? "All statuses" : formatText(item)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="mb-2 flex items-center gap-2 text-sm font-black">
                  <FileText className="h-4 w-4 text-blue-200" />
                  Action
                </span>

                <select
                  value={action}
                  onChange={(event) => setAction(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none"
                >
                  {ACTION_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item === "all" ? "All actions" : formatText(item)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="mb-2 flex items-center gap-2 text-sm font-black">
                  <Search className="h-4 w-4 text-pink-200" />
                  Search
                </span>

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") loadLogs();
                  }}
                  placeholder="Search export title, route, file name, user..."
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-white/35"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={loadLogs}
                  disabled={loading}
                  className="rounded-2xl bg-emerald-300 px-4 py-3 text-sm font-black text-emerald-950 transition hover:bg-emerald-200 disabled:opacity-50"
                >
                  Search
                </button>

                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/15"
                >
                  Reset
                </button>
              </div>
            </div>
          </section>

          {error && (
            <section className="export-logs-print-card rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-red-100">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0" />

                <div>
                  <div className="font-black">Could not load export logs</div>
                  <p className="mt-1 text-sm">{error}</p>
                </div>
              </div>
            </section>
          )}

          <section className="export-logs-print-card rounded-[2rem] border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur-xl">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black">Logs</h2>
                <p className="mt-1 text-sm text-white/60">
                  Showing export and print records for {selectedYear}.
                </p>
              </div>

              <div className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-black text-white/70">
                {loading ? "Loading..." : `${logs.length} found`}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-10 text-white/70">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading export logs...
              </div>
            ) : logs.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-10 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                  <History className="h-6 w-6" />
                </div>

                <h3 className="mt-4 text-lg font-black">
                  No export logs found
                </h3>

                <p className="mt-2 text-sm text-white/60">
                  Once an admin downloads or prints an export, it will appear
                  here.
                </p>
              </div>
            ) : (
              <div className="grid w-full gap-4 2xl:grid-cols-2">
                {logs.map((log) => {
                  const statusInfo = statusStyles(log.status);
                  const StatusIcon = statusInfo.icon;

                  const actionInfo = actionStyles(log.action);
                  const ActionIcon = actionInfo.icon;

                  return (
                    <article
                      key={log.id}
                      className="export-logs-print-card rounded-3xl border border-white/10 bg-slate-950/45 p-5"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <span
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black ${actionInfo.className}`}
                            >
                              <ActionIcon className="h-3.5 w-3.5" />
                              {actionInfo.label}
                            </span>

                            <span
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black ${statusInfo.className}`}
                            >
                              <StatusIcon className="h-3.5 w-3.5" />
                              {statusInfo.label}
                            </span>
                          </div>

                          <h3 className="mt-3 text-lg font-black">
                            {log.export_title ||
                              formatText(log.export_key) ||
                              "Money export"}
                          </h3>

                          <p className="mt-1 text-sm text-white/60">
                            {formatDateTime(log.created_at)}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm">
                          <div className="font-black">
                            {log.actor_name || "Unknown user"}
                          </div>

                          <div className="text-white/60">
                            {log.actor_email || "No email saved"}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid w-full gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <div className="text-xs font-black uppercase tracking-wide text-white/40">
                            Export Key
                          </div>
                          <div className="mt-1 break-words text-sm font-bold">
                            {log.export_key || "-"}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <div className="text-xs font-black uppercase tracking-wide text-white/40">
                            Year
                          </div>
                          <div className="mt-1 text-sm font-bold">
                            {log.export_year || "-"}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <div className="text-xs font-black uppercase tracking-wide text-white/40">
                            Type
                          </div>
                          <div className="mt-1 text-sm font-bold">
                            {formatText(log.export_type || log.action)}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <div className="text-xs font-black uppercase tracking-wide text-white/40">
                            File
                          </div>
                          <div className="mt-1 break-words text-sm font-bold">
                            {log.file_name || "-"}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
                        <div className="text-xs font-black uppercase tracking-wide text-white/40">
                          Route
                        </div>
                        <div className="mt-1 break-all text-sm font-bold text-white/75">
                          {log.route || "-"}
                        </div>
                      </div>

                      {log.error_message && (
                        <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-red-100">
                          <div className="text-xs font-black uppercase tracking-wide text-red-100/60">
                            Error
                          </div>
                          <p className="mt-1 break-words text-sm font-bold">
                            {log.error_message}
                          </p>
                        </div>
                      )}

                      <div className="mt-4">
                        <JsonDetails title="Metadata" value={log.metadata} />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}