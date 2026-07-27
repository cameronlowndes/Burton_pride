"use client";

import { useRef } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileSearch,
  Loader2,
  MoreHorizontal,
} from "lucide-react";

import { EventAuditRiskBadge, EventAuditStatusBadge } from "./EventAuditBadges";
import type { AuditEventOption, AuditLogRow } from "./client-types";

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function title(value?: string | null) {
  return value?.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) ?? "";
}

function Source({ row }: { row: AuditLogRow }) {
  const source = [row.browser, row.operating_system, row.device_type].filter(Boolean).join(" · ");
  return <span>{source || "System"}</span>;
}

function EventName({ row, events }: { row: AuditLogRow; events: AuditEventOption[] }) {
  if (!row.event_id) return <span>System</span>;
  const event = events.find((item) => String(item.id) === String(row.event_id));
  return <span>{event ? `${event.event_name} ${event.event_year}` : row.event_id}</span>;
}

export default function EventAuditTable({
  logs,
  events,
  loading,
  error,
  page,
  pageSize,
  total,
  totalPages,
  sortField,
  sortDirection,
  onSort,
  onOpen,
  onPage,
  onPageSize,
  onRetry,
}: {
  logs: AuditLogRow[];
  events: AuditEventOption[];
  loading: boolean;
  error: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  sortField: string;
  sortDirection: "asc" | "desc";
  onSort: (field: string) => void;
  onOpen: (id: string) => void;
  onPage: (page: number) => void;
  onPageSize: (pageSize: number) => void;
  onRetry: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    const panel = scrollRef.current;
    if (!panel || panel.scrollWidth <= panel.clientWidth) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    panel.scrollLeft += event.deltaY;
    event.preventDefault();
  }

  function SortHeader({ field, children }: { field: string; children: React.ReactNode }) {
    const active = sortField === field;
    const Icon = active && sortDirection === "asc" ? ArrowUp : ArrowDown;
    return (
      <button type="button" onClick={() => onSort(field)} className="inline-flex items-center gap-1.5 whitespace-nowrap text-left font-black uppercase tracking-[0.1em] text-white/55 hover:text-white">
        {children}<Icon className={`h-3.5 w-3.5 ${active ? "opacity-100" : "opacity-25"}`} />
      </button>
    );
  }

  return (
    <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.055] shadow-2xl backdrop-blur-xl">
      <header className="flex flex-col gap-3 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div><h2 className="text-lg font-black">Audit activity</h2><p className="mt-1 text-xs text-white/45">{total.toLocaleString("en-GB")} matching event{total === 1 ? "" : "s"}</p></div>
        <div className="flex items-center gap-2 text-xs text-white/45"><MoreHorizontal className="h-4 w-4" /> Use the mouse wheel over the table to scroll sideways.</div>
      </header>

      {error ? (
        <div className="p-6 sm:p-10"><div className="mx-auto max-w-xl rounded-2xl border border-red-300/20 bg-red-500/10 p-5 text-center"><FileSearch className="mx-auto h-8 w-8 text-red-200" /><h3 className="mt-3 font-black text-red-50">Audit activity could not load</h3><p className="mt-2 text-sm text-red-50/70">{error}</p><button onClick={onRetry} className="mt-4 rounded-xl bg-red-100 px-4 py-2.5 text-sm font-black text-red-950">Try again</button></div></div>
      ) : loading ? (
        <div className="flex min-h-80 items-center justify-center gap-3 text-white/60"><Loader2 className="h-5 w-5 animate-spin" /> Loading audit activity…</div>
      ) : logs.length === 0 ? (
        <div className="p-10 text-center"><FileSearch className="mx-auto h-10 w-10 text-white/25" /><h3 className="mt-4 text-lg font-black">No audit events match this view</h3><p className="mt-2 text-sm text-white/45">Clear or change the active filters. New trusted server-side actions will appear here automatically.</p></div>
      ) : (
        <>
          <div ref={scrollRef} onWheel={handleWheel} className="max-w-full overflow-x-auto overscroll-x-contain" tabIndex={0} aria-label="Scrollable audit activity table">
            <table className="min-w-[1720px] w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-[#21172e] text-[10px]">
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3"><SortHeader field="created_at">Date and time</SortHeader></th>
                  <th className="px-4 py-3"><SortHeader field="admin_name">Admin</SortHeader></th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3"><SortHeader field="area">Area</SortHeader></th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Record</th>
                  <th className="px-4 py-3"><SortHeader field="status">Status</SortHeader></th>
                  <th className="px-4 py-3"><SortHeader field="risk_level">Risk</SortHeader></th>
                  <th className="px-4 py-3">Source</th>
                  <th className="sticky right-0 bg-[#21172e] px-4 py-3 text-right">Open</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((row) => (
                  <tr key={row.id} className="border-b border-white/[0.06] align-top transition hover:bg-white/[0.055] focus-within:bg-white/[0.055]">
                    <td className="whitespace-nowrap px-4 py-4 font-semibold text-white/75">{formatDate(row.created_at)}</td>
                    <td className="px-4 py-4"><p className="max-w-56 truncate font-black text-white/85">{row.admin_name || "System"}</p><p className="mt-1 max-w-56 truncate text-xs text-white/40">{row.admin_email || row.admin_role || "Automated action"}</p></td>
                    <td className="px-4 py-4"><p className="max-w-72 font-black text-white/90">{row.action_label}</p><p className="mt-1 max-w-72 break-all text-xs text-white/35">{row.action}</p></td>
                    <td className="px-4 py-4"><span className="rounded-lg bg-white/[0.07] px-2.5 py-1.5 text-xs font-black text-white/65">{title(row.area)}</span></td>
                    <td className="max-w-56 px-4 py-4 text-white/65"><EventName row={row} events={events} /></td>
                    <td className="px-4 py-4"><p className="max-w-72 truncate font-semibold text-white/75">{row.record_title || "No linked record"}</p><p className="mt-1 max-w-72 truncate text-xs text-white/35">{row.record_type || "General"}{row.record_id ? ` · ${row.record_id}` : ""}</p></td>
                    <td className="px-4 py-4"><EventAuditStatusBadge status={row.status} /></td>
                    <td className="px-4 py-4"><EventAuditRiskBadge risk={row.risk_level} /></td>
                    <td className="px-4 py-4 text-xs text-white/55"><Source row={row} />{row.ip_address && <p className="mt-1">{row.ip_address}</p>}</td>
                    <td className="sticky right-0 bg-[#191123] px-4 py-4 text-right"><button type="button" onClick={() => onOpen(row.id)} className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-3 py-2 text-xs font-black text-cyan-100 hover:bg-cyan-500/20"><Eye className="h-4 w-4" /> Details</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer className="flex flex-col gap-3 border-t border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-xs font-bold text-white/55">Rows per page<select value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))} className="rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-white"><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option><option value={200}>200</option></select></label>
            <div className="flex items-center justify-between gap-3 sm:justify-end"><p className="text-xs font-semibold text-white/45">Page {page.toLocaleString("en-GB")} of {totalPages.toLocaleString("en-GB")}</p><div className="flex gap-2"><button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} className="rounded-xl border border-white/10 p-2 hover:bg-white/10 disabled:opacity-30" aria-label="Previous page"><ChevronLeft className="h-5 w-5" /></button><button type="button" onClick={() => onPage(page + 1)} disabled={page >= totalPages} className="rounded-xl border border-white/10 p-2 hover:bg-white/10 disabled:opacity-30" aria-label="Next page"><ChevronRight className="h-5 w-5" /></button></div></div>
          </footer>
        </>
      )}
    </section>
  );
}
