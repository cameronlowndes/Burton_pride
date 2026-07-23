"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Filter,
  Loader2,
  RefreshCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import {
  exportAuditWorkbook,
  type AuditExportRow,
} from "./exportAuditWorkbook";

type AuditStatus =
  | "success"
  | "failed"
  | "blocked"
  | "warning"
  | "pending"
  | "cancelled";

type AuditRisk =
  | "low"
  | "medium"
  | "high"
  | "critical";

type AuditLog = AuditExportRow & {
  id: string;
  occurred_at: string;
  action_category: string;
  status: AuditStatus;
  risk_level: AuditRisk;

  admin_id?: string | null;
  permission_key?: string | null;

  record_id?: string | null;

  stock_item_id?: string | null;
  stock_item_name?: string | null;
  stock_item_sku?: string | null;

  location_id?: string | null;
  location_name?: string | null;

  movement_id?: string | null;
  movement_type?: string | null;

  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;

  correlation_id?: string | null;
  session_id?: string | null;
  page_path?: string | null;
  duration_ms?: number | null;

  ip_address?: string | null;
  user_agent?: string | null;
  device_type?: string | null;
  browser_name?: string | null;
  operating_system?: string | null;

  error_details?: string | null;
  error_hint?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
};

type Summary = {
  totalActions: number;
  successful: number;
  failed: number;
  blocked: number;
  activeAdmins: number;
  highRisk: number;
};

type FilterAdmin = {
  admin_id?: string | null;
  admin_name?: string | null;
  admin_email?: string | null;
};

type FilterAction = {
  action_key: string;
  action_label: string;
};

type AuditResponse = {
  ok?: boolean;
  logs?: AuditLog[];
  summary?: Summary;
  filterOptions?: {
    admins?: FilterAdmin[];
    modules?: string[];
    actions?: FilterAction[];
  };
  pagination?: {
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  error?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

type Notice = {
  tone: "success" | "error" | "warning";
  title: string;
  message: string;
  technical?: string[];
};

const ENDPOINT =
  "/api/admin/stockmanagement/audit-logs";

const EMPTY_SUMMARY: Summary = {
  totalActions: 0,
  successful: 0,
  failed: 0,
  blocked: 0,
  activeAdmins: 0,
  highRisk: 0,
};

/**
 * Audit logs should describe meaningful changes or security events only.
 * These keys represent passive/read-only activity and must never appear in
 * this change audit page or its Excel exports.
 *
 * Important: the API routes that create audit records should also avoid
 * inserting these actions. This client-side safeguard prevents older records
 * from being displayed if they already exist in the database.
 */
const PASSIVE_ACTION_KEYS = new Set([
  "page_view",
  "page_opened",
  "view_page",
  "visited_page",
  "app_opened",
  "stock_control_opened",
  "audit_logs_viewed",
  "inventory_viewed",
  "locations_viewed",
  "settings_viewed",
  "dashboard_viewed",
  "list_viewed",
  "record_viewed",
  "details_viewed",
  "search",
  "filter_changed",
  "filters_changed",
  "refresh",
  "data_refreshed",
]);

const PASSIVE_HTTP_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isMeaningfulAuditLog(log: AuditLog) {
  const actionKey = clean(log.action_key).toLowerCase();
  const category = clean(log.action_category).toLowerCase();
  const method = clean(log.http_method).toUpperCase();

  if (PASSIVE_ACTION_KEYS.has(actionKey)) return false;

  if (
    actionKey.includes("page_view") ||
    actionKey.includes("page_open") ||
    actionKey.includes("page_visit") ||
    actionKey.endsWith("_viewed") ||
    actionKey.endsWith("_opened")
  ) {
    return false;
  }

  if (
    PASSIVE_HTTP_METHODS.has(method) &&
    ["view", "read", "navigation", "page", "session"].includes(category)
  ) {
    return false;
  }

  return true;
}

function buildSummary(logs: AuditLog[]): Summary {
  const activeAdmins = new Set(
    logs
      .map((log) => clean(log.admin_id || log.admin_email))
      .filter(Boolean),
  ).size;

  return {
    totalActions: logs.length,
    successful: logs.filter((log) => log.status === "success").length,
    failed: logs.filter((log) => log.status === "failed").length,
    blocked: logs.filter((log) => log.status === "blocked").length,
    activeAdmins,
    highRisk: logs.filter(
      (log) =>
        log.risk_level === "high" || log.risk_level === "critical",
    ).length,
  };
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not recorded";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

function asJson(value: unknown) {
  if (value === null || value === undefined) {
    return "Not recorded";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function dateRange(
  preset: string,
): { from: string; to: string } {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);

  if (preset === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (preset === "yesterday") {
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);
  } else if (preset === "7days") {
    start.setDate(start.getDate() - 7);
  } else if (preset === "30days") {
    start.setDate(start.getDate() - 30);
  } else if (preset === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else if (preset === "year") {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
  } else {
    return { from: "", to: "" };
  }

  return {
    from: start.toISOString(),
    to: end.toISOString(),
  };
}

export default function AuditLogsClient() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [summary, setSummary] =
    useState<Summary>(EMPTY_SUMMARY);
  const [admins, setAdmins] = useState<FilterAdmin[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [actions, setActions] = useState<FilterAction[]>([]);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [adminFilter, setAdminFilter] = useState("all");
  const [recordTypeFilter, setRecordTypeFilter] =
    useState("all");
  const [datePreset, setDatePreset] = useState("30days");
  const [sort, setSort] = useState("newest");
  const [showFilters, setShowFilters] = useState(true);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 50,
    totalRows: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const [details, setDetails] = useState<AuditLog | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setNotice(null);

    const range = dateRange(datePreset);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      sort,
      meaningfulOnly: "true",
    });

    if (search.trim()) params.set("search", search.trim());
    if (moduleFilter !== "all") {
      params.set("module", moduleFilter);
    }
    if (actionFilter !== "all") {
      params.set("action", actionFilter);
    }
    if (statusFilter !== "all") {
      params.set("status", statusFilter);
    }
    if (riskFilter !== "all") {
      params.set("risk", riskFilter);
    }
    if (adminFilter !== "all") {
      params.set("adminId", adminFilter);
    }
    if (recordTypeFilter !== "all") {
      params.set("recordType", recordTypeFilter);
    }
    if (range.from) params.set("dateFrom", range.from);
    if (range.to) params.set("dateTo", range.to);

    try {
      const response = await fetch(
        `${ENDPOINT}?${params.toString()}`,
        {
          method: "GET",
          cache: "no-store",
          credentials: "include",
          headers: { Accept: "application/json" },
        },
      );

      const rawText = await response.text();
      let data: AuditResponse | null = null;

      try {
        data = rawText
          ? (JSON.parse(rawText) as AuditResponse)
          : null;
      } catch {
        data = null;
      }

      if (!response.ok || !data?.ok) {
        setLogs([]);
        setSummary(EMPTY_SUMMARY);
        setNotice({
          tone: "error",
          title: "Audit logs could not be loaded",
          message:
            data?.error ||
            `The server returned HTTP ${response.status}.`,
          technical: [
            `Endpoint: ${ENDPOINT}`,
            `HTTP status: ${response.status} ${response.statusText}`,
            data?.code ? `Code: ${data.code}` : "",
            data?.details ? `Details: ${data.details}` : "",
            data?.hint ? `Hint: ${data.hint}` : "",
            !data && rawText
              ? `Response: ${rawText.slice(0, 700)}`
              : "",
          ].filter(Boolean),
        });
        return;
      }

      const meaningfulLogs = (Array.isArray(data.logs) ? data.logs : [])
        .filter(isMeaningfulAuditLog);

      setLogs(meaningfulLogs);
      setSummary(buildSummary(meaningfulLogs));
      setAdmins(data.filterOptions?.admins || []);
      setModules(data.filterOptions?.modules || []);
      setActions(data.filterOptions?.actions || []);
      setPagination(
        data.pagination || {
          page,
          pageSize,
          totalRows: 0,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      );
    } catch (caught) {
      setLogs([]);
      setSummary(EMPTY_SUMMARY);
      setNotice({
        tone: "error",
        title: "Audit logs could not be loaded",
        message:
          caught instanceof Error
            ? caught.message
            : "The browser could not connect to the audit API.",
      });
    } finally {
      setLoading(false);
    }
  }, [
    search,
    moduleFilter,
    actionFilter,
    statusFilter,
    riskFilter,
    adminFilter,
    recordTypeFilter,
    datePreset,
    sort,
    page,
    pageSize,
  ]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadLogs();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [loadLogs]);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    moduleFilter,
    actionFilter,
    statusFilter,
    riskFilter,
    adminFilter,
    recordTypeFilter,
    datePreset,
    sort,
    pageSize,
  ]);

  const selectedFilterCount = useMemo(
    () =>
      [
        moduleFilter,
        actionFilter,
        statusFilter,
        riskFilter,
        adminFilter,
        recordTypeFilter,
      ].filter((value) => value !== "all").length +
      (search.trim() ? 1 : 0),
    [
      moduleFilter,
      actionFilter,
      statusFilter,
      riskFilter,
      adminFilter,
      recordTypeFilter,
      search,
    ],
  );

  function clearFilters() {
    setSearch("");
    setModuleFilter("all");
    setActionFilter("all");
    setStatusFilter("all");
    setRiskFilter("all");
    setAdminFilter("all");
    setRecordTypeFilter("all");
    setDatePreset("30days");
    setSort("newest");
    setPage(1);
  }

  async function exportXlsx() {
    if (!logs.length || exporting) return;

    setExporting(true);
    setNotice(null);

    try {
      await exportAuditWorkbook({
        logs,
        generatedBy: null,
      });

      setNotice({
        tone: "success",
        title: "Audit Excel report created",
        message:
          "The current audit page was exported to a styled Excel workbook.",
      });
    } catch (caught) {
      setNotice({
        tone: "error",
        title: "Audit export failed",
        message:
          caught instanceof Error
            ? caught.message
            : "The Excel workbook could not be created.",
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="min-h-screen w-full bg-transparent px-3 py-5 text-white sm:px-5 lg:px-7">
      <div className="w-full">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/Admin/StockManagement"
            className="inline-flex items-center gap-2 text-sm font-black text-white/60 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Stock Control
          </Link>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadLogs()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-black disabled:opacity-50"
            >
              <RefreshCcw
                className={`h-4 w-4 ${
                  loading ? "animate-spin" : ""
                }`}
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => void exportXlsx()}
              disabled={!logs.length || exporting}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400 px-4 py-2.5 text-sm font-black text-emerald-950 disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {exporting ? "Creating Excel..." : "Export Excel"}
            </button>
          </div>
        </div>

        <header className="relative overflow-hidden rounded-[2rem] border border-purple-300/15 bg-[#271d3f] p-6 shadow-2xl sm:p-8">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-purple-400/15 blur-3xl" />
          <div className="absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-blue-400/10 blur-3xl" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-300/20 bg-purple-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-purple-100">
              <ShieldCheck className="h-4 w-4" />
              Burton Pride Stock Control
            </div>

            <h1 className="mt-4 text-3xl font-black sm:text-5xl">
              Audit Logs
            </h1>

            <p className="mt-4 max-w-4xl text-sm leading-7 text-white/60 sm:text-base">
              Review meaningful changes across Stock Management, including
              inventory updates, stock movements, location changes, exports,
              security checks and failed or blocked actions. Simply opening,
              searching or viewing a page is not recorded here.
            </p>
          </div>
        </header>

        {notice ? (
          <div className="mt-6">
            <NoticePanel
              notice={notice}
              onClose={() => setNotice(null)}
            />
          </div>
        ) : null}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <SummaryCard
            label="Total actions"
            value={summary.totalActions}
            icon={CalendarDays}
            tone="purple"
          />
          <SummaryCard
            label="Successful"
            value={summary.successful}
            icon={CheckCircle2}
            tone="green"
          />
          <SummaryCard
            label="Failed"
            value={summary.failed}
            icon={AlertTriangle}
            tone="red"
          />
          <SummaryCard
            label="Blocked"
            value={summary.blocked}
            icon={ShieldAlert}
            tone="amber"
          />
          <SummaryCard
            label="Admins active"
            value={summary.activeAdmins}
            icon={Users}
            tone="blue"
          />
          <SummaryCard
            label="High risk"
            value={summary.highRisk}
            icon={ShieldAlert}
            tone="red"
          />
        </section>

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.045] p-4 shadow-xl sm:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search admin, action, item, SKU, location, error code or endpoint..."
                className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm font-semibold outline-none placeholder:text-white/30"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowFilters((value) => !value)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black"
            >
              <Filter className="h-4 w-4" />
              Filters
              {selectedFilterCount > 0 ? (
                <span className="rounded-full bg-purple-400 px-2 py-0.5 text-[10px] text-purple-950">
                  {selectedFilterCount}
                </span>
              ) : null}
            </button>

            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-black"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="risk">Highest risk first</option>
              <option value="failed">Failed actions first</option>
              <option value="admin">Administrator name</option>
              <option value="action">Action name</option>
              <option value="module">Module</option>
            </select>
          </div>

          {showFilters ? (
            <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2 xl:grid-cols-4">
              <FilterSelect
                label="Date"
                value={datePreset}
                onChange={setDatePreset}
                options={[
                  ["today", "Today"],
                  ["yesterday", "Yesterday"],
                  ["7days", "Last 7 days"],
                  ["30days", "Last 30 days"],
                  ["month", "This month"],
                  ["year", "This year"],
                  ["all", "All time"],
                ]}
              />

              <FilterSelect
                label="Module"
                value={moduleFilter}
                onChange={setModuleFilter}
                options={[
                  ["all", "All modules"],
                  ...modules.map((value) => [value, value]),
                ]}
              />

              <FilterSelect
                label="Action"
                value={actionFilter}
                onChange={setActionFilter}
                options={[
                  ["all", "All actions"],
                  ...actions.map((item) => [
                    item.action_key,
                    item.action_label,
                  ]),
                ]}
              />

              <FilterSelect
                label="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  ["all", "All statuses"],
                  ["success", "Success"],
                  ["failed", "Failed"],
                  ["blocked", "Blocked"],
                  ["warning", "Warning"],
                  ["pending", "Pending"],
                  ["cancelled", "Cancelled"],
                ]}
              />

              <FilterSelect
                label="Risk"
                value={riskFilter}
                onChange={setRiskFilter}
                options={[
                  ["all", "All risk levels"],
                  ["low", "Low"],
                  ["medium", "Medium"],
                  ["high", "High"],
                  ["critical", "Critical"],
                ]}
              />

              <FilterSelect
                label="Administrator"
                value={adminFilter}
                onChange={setAdminFilter}
                options={[
                  ["all", "All administrators"],
                  ...admins.map((item) => [
                    clean(item.admin_id || item.admin_email),
                    clean(item.admin_name) ||
                      clean(item.admin_email) ||
                      "Unknown admin",
                  ]),
                ]}
              />

              <FilterSelect
                label="Record type"
                value={recordTypeFilter}
                onChange={setRecordTypeFilter}
                options={[
                  ["all", "All record types"],
                  ["stock_item", "Stock item"],
                  ["stock_location", "Stock location"],
                  ["movement", "Movement"],
                  ["supplier", "Supplier"],
                  ["purchase_order", "Purchase order"],
                  ["setting", "Setting"],
                  ["sidebar_item", "Sidebar item"],
                  ["report", "Report"],
                  ["admin_session", "Admin session"],
                ]}
              />

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black"
                >
                  <X className="h-4 w-4" />
                  Clear filters
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-xl">
          {loading ? (
            <div className="flex min-h-80 items-center justify-center">
              <div className="text-center">
                <Loader2 className="mx-auto h-9 w-9 animate-spin text-purple-200" />
                <p className="mt-4 font-black">
                  Loading audit activity...
                </p>
              </div>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex min-h-80 items-center justify-center p-8 text-center">
              <div>
                <ShieldCheck className="mx-auto h-12 w-12 text-white/30" />
                <h2 className="mt-4 text-xl font-black">
                  No audit activity found
                </h2>
                <p className="mt-2 text-sm text-white/50">
                  There are no meaningful Stock Management changes matching
                  the current filters. Page views and read-only activity are excluded.
                </p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-5 rounded-2xl bg-white px-5 py-3 text-sm font-black text-purple-700"
                >
                  Clear filters
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1280px] w-full border-collapse text-left">
                <thead className="border-b border-white/10 bg-black/20">
                  <tr className="text-xs font-black uppercase tracking-[0.12em] text-white/45">
                    <th className="px-5 py-4">Date and time</th>
                    <th className="px-5 py-4">Admin</th>
                    <th className="px-5 py-4">Action</th>
                    <th className="px-5 py-4">Module</th>
                    <th className="px-5 py-4">Record</th>
                    <th className="px-5 py-4">Description</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Risk</th>
                    <th className="px-5 py-4 text-right">
                      Details
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/8">
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="transition hover:bg-white/[0.035]"
                    >
                      <td className="px-5 py-4 align-top text-xs text-white/60">
                        {formatDate(log.occurred_at)}
                      </td>

                      <td className="px-5 py-4 align-top">
                        <p className="text-sm font-black">
                          {log.admin_name || "Unknown admin"}
                        </p>
                        <p className="mt-1 text-xs text-white/40">
                          {log.admin_email || "No email recorded"}
                        </p>
                      </td>

                      <td className="px-5 py-4 align-top">
                        <p className="text-sm font-black">
                          {log.action_label}
                        </p>
                        <p className="mt-1 text-xs text-white/35">
                          {log.action_key}
                        </p>
                      </td>

                      <td className="px-5 py-4 align-top text-sm text-white/65">
                        {log.module}
                      </td>

                      <td className="px-5 py-4 align-top">
                        <p className="text-sm font-bold">
                          {log.record_name ||
                            log.stock_item_name ||
                            log.location_name ||
                            "No record"}
                        </p>
                        <p className="mt-1 text-xs text-white/35">
                          {log.record_reference ||
                            log.stock_item_sku ||
                            log.record_type ||
                            ""}
                        </p>
                      </td>

                      <td className="max-w-sm px-5 py-4 align-top text-sm leading-6 text-white/60">
                        {log.description ||
                          log.reason ||
                          "No description recorded"}
                      </td>

                      <td className="px-5 py-4 align-top">
                        <StatusBadge status={log.status} />
                      </td>

                      <td className="px-5 py-4 align-top">
                        <RiskBadge risk={log.risk_level} />
                      </td>

                      <td className="px-5 py-4 text-right align-top">
                        <button
                          type="button"
                          onClick={() => setDetails(log)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] hover:bg-white/[0.1]"
                          aria-label={`View ${log.action_label}`}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-white/55">
            Page {pagination.page} of {pagination.totalPages} •{" "}
            {pagination.totalRows} total records
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={pageSize}
              onChange={(event) =>
                setPageSize(Number(event.target.value))
              }
              className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm font-black"
            >
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
              <option value={200}>200 per page</option>
            </select>

            <button
              type="button"
              onClick={() =>
                setPage((value) => Math.max(1, value - 1))
              }
              disabled={!pagination.hasPreviousPage}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-black disabled:opacity-35"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>

            <button
              type="button"
              onClick={() => setPage((value) => value + 1)}
              disabled={!pagination.hasNextPage}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-black disabled:opacity-35"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {details ? (
        <AuditDetailsModal
          log={details}
          onClose={() => setDetails(null)}
        />
      ) : null}
    </main>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: typeof ShieldCheck;
  tone: "purple" | "green" | "red" | "amber" | "blue";
}) {
  const className =
    tone === "green"
      ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
      : tone === "red"
        ? "border-red-300/20 bg-red-500/10 text-red-100"
        : tone === "amber"
          ? "border-amber-300/20 bg-amber-500/10 text-amber-100"
          : tone === "blue"
            ? "border-blue-300/20 bg-blue-500/10 text-blue-100"
            : "border-purple-300/20 bg-purple-500/10 text-purple-100";

  return (
    <article className={`rounded-[1.75rem] border p-5 ${className}`}>
      <Icon className="h-5 w-5" />
      <p className="mt-4 text-xs font-black uppercase tracking-[0.12em] opacity-65">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </article>
  );
}

function StatusBadge({ status }: { status: AuditStatus }) {
  const className =
    status === "success"
      ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
      : status === "failed"
        ? "border-red-300/20 bg-red-500/10 text-red-100"
        : status === "blocked"
          ? "border-amber-300/20 bg-amber-500/10 text-amber-100"
          : "border-blue-300/20 bg-blue-500/10 text-blue-100";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${className}`}>
      {status}
    </span>
  );
}

function RiskBadge({ risk }: { risk: AuditRisk }) {
  const className =
    risk === "critical"
      ? "border-red-300/25 bg-red-500/15 text-red-100"
      : risk === "high"
        ? "border-orange-300/20 bg-orange-500/10 text-orange-100"
        : risk === "medium"
          ? "border-blue-300/20 bg-blue-500/10 text-blue-100"
          : "border-emerald-300/20 bg-emerald-500/10 text-emerald-100";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${className}`}>
      {risk}
    </span>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[][];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-white/40">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-black"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function NoticePanel({
  notice,
  onClose,
}: {
  notice: Notice;
  onClose: () => void;
}) {
  const className =
    notice.tone === "success"
      ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-50"
      : notice.tone === "warning"
        ? "border-amber-300/20 bg-amber-500/10 text-amber-50"
        : "border-red-300/20 bg-red-500/10 text-red-50";

  return (
    <div className={`rounded-2xl border p-4 ${className}`}>
      <div className="flex gap-3">
        {notice.tone === "success" ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        ) : (
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        )}

        <div className="min-w-0 flex-1">
          <p className="font-black">{notice.title}</p>
          <p className="mt-1 text-sm leading-6 opacity-85">
            {notice.message}
          </p>

          {notice.technical?.length ? (
            <details className="mt-3 rounded-xl bg-black/15 p-3">
              <summary className="cursor-pointer text-xs font-black">
                Technical details
              </summary>

              <div className="mt-3 space-y-1 text-xs font-mono">
                {notice.technical.map((line) => (
                  <p key={line} className="break-words">
                    {line}
                  </p>
                ))}
              </div>
            </details>
          ) : null}
        </div>

        <button type="button" onClick={onClose}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function AuditDetailsModal({
  log,
  onClose,
}: {
  log: AuditLog;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-details-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] border border-white/15 bg-[#111827] shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-[#111827]/95 p-6 backdrop-blur-xl">
          <div>
            <h2 id="audit-details-title" className="text-2xl font-black">
              {log.action_label}
            </h2>
            <p className="mt-1 text-sm text-white/50">
              {formatDate(log.occurred_at)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]"
            aria-label="Close audit details"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-6 p-6">
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={log.status} />
            <RiskBadge risk={log.risk_level} />
          </div>

          <DetailSection title="Main information">
            <Detail label="Action key" value={log.action_key} />
            <Detail label="Category" value={log.action_category} />
            <Detail label="Module" value={log.module} />
            <Detail label="Page" value={log.page_path} />
            <Detail label="API endpoint" value={log.api_endpoint} />
            <Detail label="HTTP method" value={log.http_method} />
            <Detail label="HTTP status" value={log.http_status} />
            <Detail label="Duration" value={
              log.duration_ms === null || log.duration_ms === undefined
                ? null
                : `${log.duration_ms} ms`
            } />
          </DetailSection>

          <DetailSection title="Administrator">
            <Detail label="Admin ID" value={log.admin_id} />
            <Detail label="Name" value={log.admin_name} />
            <Detail label="Email" value={log.admin_email} />
            <Detail label="Role" value={log.admin_role} />
            <Detail label="Permission" value={log.permission_key} />
            <Detail label="Session ID" value={log.session_id} />
          </DetailSection>

          <DetailSection title="Affected record">
            <Detail label="Record type" value={log.record_type} />
            <Detail label="Record ID" value={log.record_id} />
            <Detail label="Record name" value={log.record_name} />
            <Detail label="Reference" value={log.record_reference} />
            <Detail label="Item" value={log.stock_item_name} />
            <Detail label="SKU" value={log.stock_item_sku} />
            <Detail label="Location" value={log.location_name} />
            <Detail label="Movement type" value={log.movement_type} />
          </DetailSection>

          <DetailSection title="Quantity and movement">
            <Detail label="Before" value={log.quantity_before} />
            <Detail label="Change" value={log.quantity_change} />
            <Detail label="After" value={log.quantity_after} />
            <Detail label="Source" value={log.source_location_name} />
            <Detail label="Destination" value={log.destination_location_name} />
          </DetailSection>

          <div className="grid gap-4 lg:grid-cols-2">
            <JsonPanel title="Before" value={log.old_values} />
            <JsonPanel title="After" value={log.new_values} />
          </div>

          <DetailSection title="Request details">
            <Detail label="Request ID" value={log.request_id} />
            <Detail label="Correlation ID" value={log.correlation_id} />
            <Detail label="IP address" value={log.ip_address} />
            <Detail label="Device" value={log.device_type} />
            <Detail label="Browser" value={log.browser_name} />
            <Detail label="Operating system" value={log.operating_system} />
            <Detail label="User agent" value={log.user_agent} />
          </DetailSection>

          {log.error_message ||
          log.error_code ||
          log.error_details ||
          log.error_hint ? (
            <DetailSection title="Error information">
              <Detail label="Code" value={log.error_code} />
              <Detail label="Message" value={log.error_message} />
              <Detail label="Details" value={log.error_details} />
              <Detail label="Hint" value={log.error_hint} />
            </DetailSection>
          ) : null}

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-white/40">
              Description
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/70">
              {log.description || "No description recorded."}
            </p>

            {log.reason ? (
              <>
                <p className="mt-5 text-xs font-black uppercase tracking-[0.12em] text-white/40">
                  Reason
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/70">
                  {log.reason}
                </p>
              </>
            ) : null}

            {log.notes ? (
              <>
                <p className="mt-5 text-xs font-black uppercase tracking-[0.12em] text-white/40">
                  Notes
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/70">
                  {log.notes}
                </p>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <h3 className="font-black">{title}</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {children}
      </div>
    </section>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  const display =
    value === null ||
    value === undefined ||
    value === ""
      ? "Not recorded"
      : String(value);

  return (
    <div className="min-w-0">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-white/35">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-bold text-white/75">
        {display}
      </p>
    </div>
  );
}

function JsonPanel({
  title,
  value,
}: {
  title: string;
  value: unknown;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-white/40">
        {title}
      </p>
      <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-white/70">
        {asJson(value)}
      </pre>
    </div>
  );
}
