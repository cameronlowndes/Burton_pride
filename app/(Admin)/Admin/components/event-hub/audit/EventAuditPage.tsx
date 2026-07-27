"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  BookmarkPlus,
  CheckCircle2,
  Download,
  Filter,
  Loader2,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";

import EventAuditDetailsDrawer from "./EventAuditDetailsDrawer";
import EventAuditFiltersPanel from "./EventAuditFiltersPanel";
import EventAuditSummaryCards from "./EventAuditSummaryCards";
import EventAuditTable from "./EventAuditTable";
import type {
  EventAuditAdminOption,
  EventAuditEventOption,
  AuditLogRow,
  AuditPermissions,
  AuditSummary,
  AuditSavedView,
} from "./client-types";

const API = "/api/admin/burton-pride-event-hub/audit-log";

type FilterValues = {
  area: string;
  admin_id: string;
  action: string;
  status: string;
  risk: string;
  record_type: string;
  date_from: string;
  date_to: string;
  security_only: string;
  review_only: string;
};

const EMPTY_PERMISSIONS: AuditPermissions = {
  viewAuditLog: false,
  viewAllEvents: false,
  viewSecurityEvents: false,
  viewSensitiveChanges: false,
  addNotes: false,
  manageAlerts: false,
  restoreRecords: false,
  exportAuditLog: false,
  manageSavedViews: false,
  deleteSavedViews: false,
  viewConfidentialNotes: false,
  manageAuditSettings: false,
};

function title(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateTodayIso() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

function formatRefresh(value: string | null) {
  if (!value) return "Not refreshed yet";
  return new Date(value).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function currentFilterValues(params: URLSearchParams): FilterValues {
  return {
    area: params.get("area") || "",
    admin_id: params.get("admin_id") || "",
    action: params.get("action") || "",
    status: params.get("status") || "",
    risk: params.get("risk") || "",
    record_type: params.get("record_type") || "",
    date_from: params.get("date_from") || "",
    date_to: params.get("date_to") || "",
    security_only: params.get("security_only") || "",
    review_only: params.get("review_only") || "",
  };
}

function queryObject(params: URLSearchParams) {
  return Object.fromEntries(
    Array.from(params.entries()).filter(([key]) => key !== "audit_id"),
  );
}

export default function EventAuditPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryKey = searchParams.toString();

  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [permissions, setPermissions] = useState<AuditPermissions>(EMPTY_PERMISSIONS);
  const [events, setEvents] = useState<EventAuditEventOption[]>([]);
  const [admins, setAdmins] = useState<EventAuditAdminOption[]>([]);
  const [actions, setActions] = useState<Array<{ action: string; action_label: string }>>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [savedViews, setSavedViews] = useState<AuditSavedView[]>([]);
  const [canViewAllEvents, setCanViewAllEvents] = useState(false);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [liveUpdates, setLiveUpdates] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [searchDraft, setSearchDraft] = useState(searchParams.get("q") || "");
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState("");
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [savedViewName, setSavedViewName] = useState("");
  const [savingView, setSavingView] = useState(false);

  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = [25, 50, 100, 200].includes(Number(searchParams.get("page_size")))
    ? Number(searchParams.get("page_size"))
    : 50;
  const sortField = searchParams.get("sort") || "created_at";
  const sortDirection = searchParams.get("direction") === "asc" ? "asc" : "desc";
  const selectedAuditId = searchParams.get("audit_id");
  const eventSelectorValue = searchParams.get("event_id") || "current";
  const filterValues = useMemo(
    () => currentFilterValues(new URLSearchParams(queryKey)),
    [queryKey],
  );

  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 1,
  });

  const activeFilterEntries = useMemo(() => {
    const params = new URLSearchParams(queryKey);
    const ignored = new Set(["page", "page_size", "sort", "direction", "audit_id"]);
    return Array.from(params.entries()).filter(
      ([key, value]) => !ignored.has(key) && value && !(key === "event_id" && value === "current"),
    );
  }, [queryKey]);

  const updateParams = useCallback(
    (patch: Record<string, string | number | null | undefined>, replace = false) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, rawValue] of Object.entries(patch)) {
        let value = rawValue === null || rawValue === undefined ? "" : String(rawValue);
        if (key === "date_from" && value === "today") value = dateTodayIso();
        if (!value || (key === "event_id" && value === "current")) next.delete(key);
        else next.set(key, value);
      }
      const nextUrl = `${pathname}${next.toString() ? `?${next.toString()}` : ""}`;
      if (replace) router.replace(nextUrl, { scroll: false });
      else router.push(nextUrl, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const loadOptions = useCallback(async () => {
    try {
      const [filtersResponse, viewsResponse] = await Promise.all([
        fetch(`${API}/filters`, { cache: "no-store", credentials: "include" }),
        fetch(`${API}/saved-views`, { cache: "no-store", credentials: "include" }),
      ]);
      const filtersJson = await filtersResponse.json().catch(() => ({}));
      const viewsJson = await viewsResponse.json().catch(() => ({}));

      if (filtersResponse.ok && filtersJson.ok) {
        setEvents(filtersJson.events || []);
        setAdmins(filtersJson.admins || []);
        setActions(filtersJson.actions || []);
        setAreas(filtersJson.areas || []);
        setCanViewAllEvents(Boolean(filtersJson.canViewAllEvents));
      }
      if (viewsResponse.ok && viewsJson.ok) setSavedViews(viewsJson.views || []);
    } catch {
      // The main table remains usable when optional filter metadata fails.
    }
  }, []);

  const loadData = useCallback(async () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("audit_id");
    params.set("page", String(page));
    params.set("page_size", String(pageSize));
    params.set("sort", sortField);
    params.set("direction", sortDirection);

    setLoading(true);
    setSummaryLoading(true);
    setError("");

    try {
      const [logsResponse, summaryResponse] = await Promise.all([
        fetch(`${API}?${params.toString()}`, { cache: "no-store", credentials: "include" }),
        fetch(`${API}/summary?${params.toString()}`, { cache: "no-store", credentials: "include" }),
      ]);
      const logsJson = await logsResponse.json().catch(() => ({}));
      const summaryJson = await summaryResponse.json().catch(() => ({}));

      if (!logsResponse.ok || !logsJson.ok) {
        throw new Error(logsJson.error || "Failed to load Event Hub audit activity.");
      }

      setLogs(logsJson.logs || []);
      setPagination(logsJson.pagination || { page, pageSize, total: 0, totalPages: 1 });
      setPermissions({ ...EMPTY_PERMISSIONS, ...(logsJson.permissions || {}) });
      setLastRefreshed(logsJson.refreshedAt || new Date().toISOString());

      if (summaryResponse.ok && summaryJson.ok) {
        setSummary(summaryJson.summary || null);
      } else {
        setSummary(null);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Audit activity could not load.");
      setLogs([]);
    } finally {
      setLoading(false);
      setSummaryLoading(false);
    }
  }, [page, pageSize, searchParams, sortDirection, sortField]);

  useEffect(() => {
    setSearchDraft(searchParams.get("q") || "");
  }, [queryKey, searchParams]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    void loadData();
    // refreshNonce intentionally re-runs the same request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, refreshNonce]);

  useEffect(() => {
    if (!liveUpdates) return;
    const timer = window.setInterval(() => setRefreshNonce((value) => value + 1), 30_000);
    return () => window.clearInterval(timer);
  }, [liveUpdates]);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    updateParams({ q: searchDraft.trim(), page: 1 });
  }

  function applySummaryFilter(filter: Record<string, string>) {
    const patch: Record<string, string | number> = { ...filter, page: 1 };
    updateParams(patch);
  }

  function applyFilters(values: FilterValues) {
    updateParams({ ...values, page: 1 });
    setFiltersOpen(false);
  }

  function clearAllFilters() {
    const next = new URLSearchParams();
    next.set("page_size", String(pageSize));
    next.set("sort", sortField);
    next.set("direction", sortDirection);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function removeFilter(key: string) {
    updateParams({ [key]: null, page: 1 });
  }

  function changeSort(field: string) {
    updateParams({
      sort: field,
      direction: sortField === field && sortDirection === "desc" ? "asc" : "desc",
      page: 1,
    });
  }

  async function exportAudit() {
    setExporting(true);
    setNotice("");
    try {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("audit_id");
      const response = await fetch(`${API}/export`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters: queryObject(params) }),
      });
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error || "Audit export failed.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `burton-pride-event-audit-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice("The formatted Excel audit export has been created.");
      setRefreshNonce((value) => value + 1);
    } catch (exportError) {
      setNotice(exportError instanceof Error ? exportError.message : "Audit export failed.");
    } finally {
      setExporting(false);
    }
  }

  async function saveCurrentView() {
    if (savedViewName.trim().length < 2) {
      setNotice("Enter a saved-view name of at least two characters.");
      return;
    }
    setSavingView(true);
    try {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("audit_id");
      params.delete("page");
      const response = await fetch(`${API}/saved-views`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: savedViewName.trim(),
          filters: queryObject(params),
          sort_field: sortField,
          sort_direction: sortDirection,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.ok) throw new Error(json.error || "Failed to save view.");
      setSaveViewOpen(false);
      setSavedViewName("");
      setNotice("Audit view saved.");
      await loadOptions();
    } catch (saveError) {
      setNotice(saveError instanceof Error ? saveError.message : "Failed to save view.");
    } finally {
      setSavingView(false);
    }
  }

  function applySavedView(viewId: string) {
    const view = savedViews.find((item) => item.id === viewId);
    if (!view) return;
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(view.filters || {})) {
      if (value !== null && value !== undefined && String(value)) next.set(key, String(value));
    }
    next.set("sort", view.sort_field || "created_at");
    next.set("direction", view.sort_direction === "asc" ? "asc" : "desc");
    next.set("page", "1");
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="min-h-full w-full bg-[radial-gradient(circle_at_top_left,_rgba(236,72,153,0.16),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.12),_transparent_30%),linear-gradient(180deg,#100918_0%,#1b1128_48%,#0f172a_100%)] p-3 text-white sm:p-5 lg:p-6">
      <div className="w-full max-w-none space-y-5">
        <header className="rounded-[30px] border border-white/10 bg-white/[0.065] p-5 shadow-2xl backdrop-blur-xl sm:p-6">
          <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-start 2xl:justify-between">
            <div className="min-w-0">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-pink-300/20 bg-pink-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-pink-100">
                <ShieldCheck className="h-4 w-4" /> Burton Pride Event Hub
              </div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Event Hub Audit Log</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-white/60">
                Review administrative activity, record changes, failed actions and security events across Burton Pride Event Hub. Historical audit entries are append-only and cannot be silently edited.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold text-white/40">
                <span className="inline-flex items-center gap-1.5"><Activity className="h-4 w-4" /> Last refresh: {formatRefresh(lastRefreshed)}</span>
                {liveUpdates && <span className="inline-flex items-center gap-1.5 text-emerald-200"><Radio className="h-4 w-4 animate-pulse" /> Live refresh every 30 seconds</span>}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setLiveUpdates((value) => !value)} className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-black transition ${liveUpdates ? "border-emerald-300/30 bg-emerald-500/15 text-emerald-100" : "border-white/10 bg-white/[0.06] text-white/70 hover:bg-white/10"}`}>
                <Radio className="h-4 w-4" /> {liveUpdates ? "Live on" : "Live off"}
              </button>
              <button type="button" onClick={() => setRefreshNonce((value) => value + 1)} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm font-black text-white/75 hover:bg-white/10 disabled:opacity-50">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
              </button>
              {permissions.exportAuditLog && (
                <button type="button" onClick={() => void exportAudit()} disabled={exporting} className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3.5 py-2.5 text-sm font-black text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50">
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export XLSX
                </button>
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(210px,300px)_minmax(300px,1fr)_auto_auto]">
            <select value={eventSelectorValue} onChange={(event) => updateParams({ event_id: event.target.value, page: 1 })} className="min-h-12 rounded-xl border border-white/10 bg-black/25 px-3 text-sm font-black text-white outline-none focus:border-cyan-300/40" aria-label="Select event scope">
              <option value="current">Current active event</option>
              {canViewAllEvents && <option value="all">All events</option>}
              {canViewAllEvents && <option value="system">System-wide activity</option>}
              {events.map((event) => <option key={event.value} value={event.value}>{event.label}{event.year ? ` ${event.year}` : ""}{event.is_active ? " · Active" : event.is_archived ? " · Archived" : ""}</option>)}
            </select>

            <form onSubmit={submitSearch} className="flex min-w-0 overflow-hidden rounded-xl border border-white/10 bg-black/25 focus-within:border-cyan-300/40">
              <Search className="ml-3 mt-3.5 h-5 w-5 shrink-0 text-white/35" />
              <input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search actions, admins, records, request IDs…" className="min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold text-white outline-none placeholder:text-white/30" />
              {searchDraft && <button type="button" onClick={() => { setSearchDraft(""); updateParams({ q: null, page: 1 }); }} className="p-3 text-white/35 hover:text-white" aria-label="Clear search"><X className="h-4 w-4" /></button>}
              <button type="submit" className="border-l border-white/10 bg-cyan-300 px-4 text-sm font-black text-slate-950 hover:bg-cyan-200">Search</button>
            </form>

            <button type="button" onClick={() => setFiltersOpen(true)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm font-black text-white/75 hover:bg-white/10">
              <Filter className="h-4 w-4" /> Filters {activeFilterEntries.length > 0 && <span className="rounded-full bg-cyan-300 px-2 py-0.5 text-[10px] text-slate-950">{activeFilterEntries.length}</span>}
            </button>

            <div className="flex min-h-12 overflow-hidden rounded-xl border border-white/10 bg-white/[0.06]">
              <select defaultValue="" onChange={(event) => { applySavedView(event.target.value); event.currentTarget.value = ""; }} className="min-w-0 flex-1 bg-transparent px-3 text-sm font-black text-white outline-none" aria-label="Saved views">
                <option value="" className="bg-[#171020]">Saved views</option>
                {savedViews.map((view) => <option key={view.id} value={view.id} className="bg-[#171020]">{view.name}{view.is_shared ? " · Shared" : ""}</option>)}
              </select>
              <button type="button" onClick={() => setSaveViewOpen(true)} className="border-l border-white/10 px-3 text-white/65 hover:bg-white/10" aria-label="Save current view"><BookmarkPlus className="h-4 w-4" /></button>
            </div>
          </div>
        </header>

        {notice && (
          <div className="flex items-start justify-between gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-50" aria-live="polite">
            <span>{notice}</span><button onClick={() => setNotice("")} aria-label="Close notice"><X className="h-4 w-4" /></button>
          </div>
        )}

        {summary?.openAlerts && summary.openAlerts > 0 ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-red-300/25 bg-red-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-red-100" /><div><p className="font-black text-red-50">{summary.openAlerts} unresolved security alert{summary.openAlerts === 1 ? "" : "s"}</p><p className="mt-1 text-sm text-red-50/65">Review high-risk, critical or security-sensitive audit events.</p></div></div>
            <button type="button" onClick={() => applySummaryFilter({ security_only: "true" })} className="rounded-xl bg-red-100 px-4 py-2.5 text-sm font-black text-red-950">Review alerts</button>
          </div>
        ) : null}

        <EventAuditSummaryCards summary={summary} loading={summaryLoading} onApply={applySummaryFilter} />

        {activeFilterEntries.length > 0 && (
          <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] p-3">
            <SlidersHorizontal className="h-4 w-4 text-white/40" />
            {activeFilterEntries.map(([key, value]) => (
              <button key={`${key}-${value}`} type="button" onClick={() => removeFilter(key)} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-xs font-black text-white/65 hover:bg-white/10" title={`Remove ${key} filter`}>
                {title(key)}: {key === "admin_id" ? admins.find((admin) => admin.value === value)?.label || admins.find((admin) => admin.value === value)?.email || value : title(value)} <X className="h-3.5 w-3.5" />
              </button>
            ))}
            <button type="button" onClick={clearAllFilters} className="ml-auto rounded-lg px-3 py-1.5 text-xs font-black text-cyan-200 hover:bg-cyan-500/10">Clear filters</button>
          </section>
        )}

        <EventAuditTable
          logs={logs}
          events={events}
          loading={loading}
          error={error}
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          totalPages={pagination.totalPages}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={changeSort}
          onOpen={(id) => updateParams({ audit_id: id }, true)}
          onPage={(nextPage) => updateParams({ page: nextPage })}
          onPageSize={(nextPageSize) => updateParams({ page_size: nextPageSize, page: 1 })}
          onRetry={() => setRefreshNonce((value) => value + 1)}
        />
      </div>

      <EventAuditFiltersPanel open={filtersOpen} values={filterValues} areas={areas} admins={admins} actions={actions} canViewSecurity={permissions.viewSecurityEvents} onClose={() => setFiltersOpen(false)} onApply={applyFilters} />

      <EventAuditDetailsDrawer auditId={selectedAuditId} permissions={permissions} onClose={() => updateParams({ audit_id: null }, true)} onChanged={() => setRefreshNonce((value) => value + 1)} />

      {saveViewOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Save audit view">
          <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSaveViewOpen(false)} aria-label="Close save view" />
          <div className="relative w-full max-w-lg rounded-[28px] border border-white/10 bg-[#171020] p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-black">Save current audit view</h2><p className="mt-1 text-sm text-white/50">The event scope, search, filters and sorting will be saved for your admin account.</p></div><button onClick={() => setSaveViewOpen(false)} className="rounded-xl border border-white/10 p-2"><X className="h-4 w-4" /></button></div>
            <label className="mt-5 block"><span className="mb-2 block text-xs font-black text-white/55">View name</span><input autoFocus value={savedViewName} onChange={(event) => setSavedViewName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void saveCurrentView(); }} className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm font-semibold text-white outline-none focus:border-cyan-300/40" placeholder="For example: High-risk document changes" /></label>
            <div className="mt-5 flex justify-end gap-2"><button onClick={() => setSaveViewOpen(false)} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-black hover:bg-white/10">Cancel</button><button onClick={() => void saveCurrentView()} disabled={savingView} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 hover:bg-cyan-200 disabled:opacity-50">{savingView ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save view</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
