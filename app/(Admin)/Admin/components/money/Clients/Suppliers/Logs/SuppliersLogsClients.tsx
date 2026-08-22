"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  ClipboardList,
  Loader2,
  RefreshCcw,
  Search,
} from "lucide-react";

type SupplierLog = {
  id: string;
  created_at: string;
  supplier_id?: string | null;
  supplier_name?: string | null;
  action: string;
  action_label?: string | null;
  message?: string | null;
  actor_name?: string | null;
  actor_email?: string | null;
  old_data?: any;
  new_data?: any;
  details?: any;
};

const ACTION_OPTIONS = [
  { value: "all", label: "All actions" },
  { value: "created", label: "Created" },
  { value: "updated", label: "Updated" },
  { value: "archived", label: "Archived" },
  { value: "restored", label: "Restored" },
  { value: "permanently_deleted", label: "Permanently deleted" },
  { value: "manual_note", label: "Manual note" },
];

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function formatDateTime(value?: string | null) {
  if (!value) return "No date";

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

function actionStyle(action: string) {
  if (action === "created") {
    return "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20";
  }

  if (action === "updated") {
    return "bg-sky-500/15 text-sky-100 ring-sky-300/20";
  }

  if (action === "archived") {
    return "bg-amber-500/15 text-amber-100 ring-amber-300/20";
  }

  if (action === "restored") {
    return "bg-cyan-500/15 text-cyan-100 ring-cyan-300/20";
  }

  if (action === "permanently_deleted") {
    return "bg-red-500/15 text-red-100 ring-red-300/20";
  }

  return "bg-white/10 text-white/70 ring-white/10";
}

function actionLabel(log: SupplierLog) {
  if (log.action_label) return log.action_label;

  return log.action
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function prettyJson(value: any) {
  if (!value) return "";

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function SupplierLogsPage() {
  const [logs, setLogs] = useState<SupplierLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function loadLogs() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      params.set("limit", "500");

      if (searchTerm.trim()) {
        params.set("search", searchTerm.trim());
      }

      if (actionFilter !== "all") {
        params.set("action", actionFilter);
      }

      const response = await fetch(
        `/api/admin/money/suppliers/logs?${params.toString()}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.ok === false) {
        throw new Error(
          payload?.error ||
            payload?.details ||
            "Failed to load supplier logs.",
        );
      }

      setLogs(Array.isArray(payload?.logs) ? payload.logs : []);
    } catch (requestError: any) {
      setError(
        requestError?.message ||
          "Something went wrong while loading supplier logs.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter]);

  const filteredLogs = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    if (!search) return logs;

    return logs.filter((log) => {
      const haystack = [
        log.supplier_name,
        log.action,
        log.action_label,
        log.message,
        log.actor_name,
        log.actor_email,
      ]
        .map((item) => cleanText(item).toLowerCase())
        .join(" ");

      return haystack.includes(search);
    });
  }, [logs, searchTerm]);

  const counts = useMemo(() => {
    return {
      total: logs.length,
      created: logs.filter((log) => log.action === "created").length,
      updated: logs.filter((log) => log.action === "updated").length,
      archived: logs.filter((log) => log.action === "archived").length,
      restored: logs.filter((log) => log.action === "restored").length,
      deleted: logs.filter((log) => log.action === "permanently_deleted").length,
    };
  }, [logs]);

  return (
    <main className="min-h-screen w-full max-w-none overflow-x-auto bg-[#070716] px-1 py-5 text-white sm:px-2 lg:px-3">
      <div className="w-full max-w-none min-w-0 space-y-6">
        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <Link
                href="/Admin/MoneyManagement/TrackingMoney/Suppliers"
                className="mb-4 inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-bold text-white/75 hover:bg-white/20 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to suppliers
              </Link>

              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-100 ring-1 ring-sky-300/20">
                  <ClipboardList className="h-6 w-6" />
                </div>

                <div className="min-w-0">
                  <h1 className="break-words text-3xl font-black text-white">
                    Supplier Logs
                  </h1>

                  <p className="mt-2 max-w-4xl text-sm leading-6 text-white/60">
                    Track what has happened with suppliers and contacts:
                    created, edited, archived, restored and permanently deleted.
                    This helps you see which admin changed what and when.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={loadLogs}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/20 disabled:opacity-60"
            >
              <RefreshCcw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs font-black uppercase tracking-wide text-white/50">
              Logs showing
            </p>
            <p className="mt-2 text-3xl font-black text-white">
              {filteredLogs.length}
            </p>
          </div>

          <div className="rounded-3xl border border-emerald-300/20 bg-emerald-500/10 p-5">
            <p className="text-xs font-black uppercase tracking-wide text-emerald-100/80">
              Created
            </p>
            <p className="mt-2 text-3xl font-black text-white">
              {counts.created}
            </p>
          </div>

          <div className="rounded-3xl border border-sky-300/20 bg-sky-500/10 p-5">
            <p className="text-xs font-black uppercase tracking-wide text-sky-100/80">
              Updated
            </p>
            <p className="mt-2 text-3xl font-black text-white">
              {counts.updated}
            </p>
          </div>

          <div className="rounded-3xl border border-amber-300/20 bg-amber-500/10 p-5">
            <p className="text-xs font-black uppercase tracking-wide text-amber-100/80">
              Archived
            </p>
            <p className="mt-2 text-3xl font-black text-white">
              {counts.archived}
            </p>
          </div>

          <div className="rounded-3xl border border-cyan-300/20 bg-cyan-500/10 p-5">
            <p className="text-xs font-black uppercase tracking-wide text-cyan-100/80">
              Restored
            </p>
            <p className="mt-2 text-3xl font-black text-white">
              {counts.restored}
            </p>
          </div>

          <div className="rounded-3xl border border-red-300/20 bg-red-500/10 p-5">
            <p className="text-xs font-black uppercase tracking-wide text-red-100/80">
              Deleted
            </p>
            <p className="mt-2 text-3xl font-black text-white">
              {counts.deleted}
            </p>
          </div>
        </section>

        {error && (
          <div className="rounded-3xl border border-red-300/20 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>{error}</p>
            </div>
          </div>
        )}

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    loadLogs();
                  }
                }}
                placeholder="Search supplier, action, message, admin..."
                className="w-full rounded-2xl bg-black/20 py-3 pl-10 pr-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-sky-300/40"
              />
            </label>

            <select
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
              className="rounded-2xl bg-black/20 p-3 font-bold text-white outline-none ring-1 ring-white/10 focus:ring-sky-300/40"
            >
              {ACTION_OPTIONS.map((action) => (
                <option
                  key={action.value}
                  className="bg-[#070716] text-white"
                  value={action.value}
                >
                  {action.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={loadLogs}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 py-3 text-sm font-black text-white hover:bg-sky-400 disabled:opacity-60"
            >
              <Search className="h-4 w-4" />
              Search logs
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20">
          {loading ? (
            <div className="flex items-center justify-center gap-3 rounded-2xl bg-black/20 p-8 text-white/70">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading supplier logs...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
              <Building2 className="mx-auto h-10 w-10 text-white/30" />
              <h2 className="mt-4 text-xl font-black text-white">
                No supplier logs found
              </h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-white/55">
                Logs will appear here when suppliers are created, edited,
                archived, restored or permanently deleted.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => {
                const isExpanded = expandedId === log.id;

                return (
                  <article
                    key={log.id}
                    className="rounded-3xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${actionStyle(
                              log.action,
                            )}`}
                          >
                            {actionLabel(log)}
                          </span>

                          <h2 className="break-words text-lg font-black text-white">
                            {log.supplier_name || "Unknown supplier"}
                          </h2>
                        </div>

                        <p className="mt-2 text-sm leading-6 text-white/65">
                          {log.message || "No message saved for this log."}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/45">
                          <span className="rounded-full bg-white/5 px-3 py-1">
                            {formatDateTime(log.created_at)}
                          </span>

                          <span className="rounded-full bg-white/5 px-3 py-1">
                            By {log.actor_name || "Unknown"}
                          </span>

                          {log.actor_email && (
                            <span className="rounded-full bg-white/5 px-3 py-1">
                              {log.actor_email}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : log.id)
                        }
                        className="rounded-xl bg-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/20"
                      >
                        {isExpanded ? "Hide details" : "View details"}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 grid gap-3 lg:grid-cols-3">
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                          <p className="mb-2 text-xs font-black uppercase tracking-wide text-white/40">
                            Old data
                          </p>
                          <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-white/65">
                            {prettyJson(log.old_data) || "No old data"}
                          </pre>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                          <p className="mb-2 text-xs font-black uppercase tracking-wide text-white/40">
                            New data
                          </p>
                          <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-white/65">
                            {prettyJson(log.new_data) || "No new data"}
                          </pre>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                          <p className="mb-2 text-xs font-black uppercase tracking-wide text-white/40">
                            Details
                          </p>
                          <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-white/65">
                            {prettyJson(log.details) || "No extra details"}
                          </pre>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
