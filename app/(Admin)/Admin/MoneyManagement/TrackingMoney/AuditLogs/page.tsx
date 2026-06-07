"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bug,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clipboard,
  Clock3,
  Database,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Mail,
  Layers3,
  Loader2,
  MessageSquare,
  RefreshCcw,
  RotateCcw,
  Search,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import type {
  AreaFilter,
  MoneyAuditLog,
  MoneyAuditRiskRule,
  RiskFilter,
  SortMode,
  YearFilter,
} from "@/lib/money/audit_logs/audit-log-types";
import {
  EASY_MODE_STORAGE_KEY,
  actionClass,
  actionIcon,
  actionLabel,
  actionOptions,
  cleanFieldName,
  copyToClipboard,
  formatDateOnly,
  formatDateTime,
  getActorDisplayName,
  getActorEmailDisplay,
  getActorUniqueKey,
  getActorUserIdDisplay,
  getAuditArea,
  getAuditComment,
  getAuditCommentUpdatedBy,
  getAuditMoneyDisplay,
  getChangedFieldNames,
  getRecordId,
  getRecordTitle,
  getRiskLevel,
  getSourceLabel,
  getYearOnly,
  isBudgetPlanningAuditLog,
  isCheckedAuditLog,
  isHiddenAuditLog,
  isRefundAuditLog,
  isSavingTargetAuditLog,
  isUncheckedAuditLog,
  isWebsiteGeneratedLog,
  riskClass,
  shortValue,
} from "@/lib/money/audit_logs/audit-log-utils";
import { InfoCard, RawDataCard, StatCard } from "../../../components/money/AduitLogs/AuditLogCards";
import AuditRiskRulesPanel from "../../../components/money/AduitLogs/AuditRiskRulesPanel";

export default function MoneyAuditLogsPage() {
  const [logs, setLogs] = useState<MoneyAuditLog[]>([]);
  const [riskRules, setRiskRules] = useState<MoneyAuditRiskRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAction, setSelectedAction] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [selectedYear, setSelectedYear] = useState<YearFilter>(
    () => String(new Date().getFullYear()),
  );
  const [selectedRisk, setSelectedRisk] = useState<RiskFilter>("all");
  const [selectedArea, setSelectedArea] = useState<AreaFilter>("all");
  const [selectedActor, setSelectedActor] = useState("all");
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedLog, setSelectedLog] = useState<MoneyAuditLog | null>(null);
  const [copied, setCopied] = useState(false);
  const [showRawData, setShowRawData] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [errorDetails, setErrorDetails] = useState<any>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const [commentSaveError, setCommentSaveError] = useState("");
  const [commentSaved, setCommentSaved] = useState(false);

  /**
   * Full Mode is the default.
   * Easy Mode only turns on after the user chooses it.
   */
  const [easyMode, setEasyMode] = useState(false);
  const [modeLoaded, setModeLoaded] = useState(false);

  useEffect(() => {
    try {
      const savedMode = window.localStorage.getItem(EASY_MODE_STORAGE_KEY);

      if (savedMode !== null) {
        setEasyMode(savedMode === "true");
      }
    } catch {
      // Keep Full Mode as the safe default if localStorage is unavailable.
    } finally {
      setModeLoaded(true);
    }
  }, []);

  function toggleEasyMode() {
    setEasyMode((previous) => {
      const next = !previous;

      try {
        window.localStorage.setItem(EASY_MODE_STORAGE_KEY, String(next));
      } catch {
        // The page still works if browser storage is blocked.
      }

      return next;
    });
  }

  async function loadRiskRules() {
    try {
      const res = await fetch("/api/admin/money/audit-risk-rules", {
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        setRiskRules(Array.isArray(data.rules) ? data.rules : []);
      }
    } catch {
      // Audit logs still load if custom risk rules are unavailable.
      setRiskRules([]);
    }
  }

  async function loadLogs() {
    try {
      setLoading(true);
      setError("");
      setErrorDetails(null);

      const params = new URLSearchParams();
      params.set("limit", "2000");

      if (selectedAction !== "all") {
        params.set(
          "action",
          (selectedAction === "checked" || selectedAction === "unchecked") ? "edit" : selectedAction,
        );
      }

      if (selectedYear !== "all") {
        params.set("year", selectedYear);
      }

      const res = await fetch(
        `/api/admin/money/audit-logs?${params.toString()}`,
        {
          cache: "no-store",
        },
      );

      const text = await res.text();

      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { rawResponse: text };
      }

      if (!res.ok || !data.ok) {
        throw {
          message: data.error || "Failed to load audit logs",
          details: data,
          status: res.status,
        };
      }

      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setLastRefreshed(new Date().toISOString());
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
      setErrorDetails(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRiskRules();
  }, []);

  // AuditRiskRulesPanel does not currently export prop types that TS can
  // recognize from here. Cast to any to allow passing a callback when rules
  // change so the page can reload risk rules. This avoids a TSX prop type
  // mismatch without changing the panel component.
  const AuditRiskRulesPanelAny = AuditRiskRulesPanel as any;

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAction, selectedYear]);

  useEffect(() => {
    setCommentDraft(selectedLog ? getAuditComment(selectedLog) : "");
    setCommentSaveError("");
    setCommentSaved(false);
  }, [selectedLog]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedAction,
    selectedYear,
    selectedRisk,
    selectedArea,
    selectedActor,
    searchTerm,
    dateFrom,
    dateTo,
    sortMode,
  ]);

  const filteredLogs = useMemo(() => {
    let rows = [...logs];

    if (selectedAction === "checked") {
      rows = rows.filter((log) => isCheckedAuditLog(log));
    }

    if (selectedAction === "unchecked") {
      rows = rows.filter((log) => isUncheckedAuditLog(log));
    }

    if (selectedAction === "edit") {
      rows = rows.filter(
        (log) =>
          log.action === "edit" &&
          !isCheckedAuditLog(log) &&
          !isUncheckedAuditLog(log),
      );
    }

    if (selectedYear !== "all") {
      rows = rows.filter((log) => getYearOnly(log.created_at) === selectedYear);
    }

    if (selectedRisk !== "all") {
      rows = rows.filter((log) => getRiskLevel(log, riskRules) === selectedRisk);
    }

    if (selectedArea !== "all") {
      rows = rows.filter((log) => getAuditArea(log) === selectedArea);
    }

    if (selectedActor !== "all") {
      rows = rows.filter((log) => getActorUniqueKey(log) === selectedActor);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();

      rows = rows.filter((log) => {
        return (
          log.action?.toLowerCase().includes(q) ||
          actionLabel(log.action, log).toLowerCase().includes(q) ||
          getRecordTitle(log).toLowerCase().includes(q) ||
          log.transaction_id?.toLowerCase().includes(q) ||
          getActorDisplayName(log).toLowerCase().includes(q) ||
          getActorEmailDisplay(log).toLowerCase().includes(q) ||
          getAuditArea(log).toLowerCase().includes(q) ||
          getRiskLevel(log, riskRules).toLowerCase().includes(q) ||
          getSourceLabel(log).toLowerCase().includes(q) ||
          getAuditComment(log).toLowerCase().includes(q) ||
          JSON.stringify(log.changed_fields || {})
            .toLowerCase()
            .includes(q) ||
          JSON.stringify(log.metadata || {})
            .toLowerCase()
            .includes(q) ||
          JSON.stringify(log.before_data || {})
            .toLowerCase()
            .includes(q) ||
          JSON.stringify(log.after_data || {})
            .toLowerCase()
            .includes(q)
        );
      });
    }

    if (dateFrom) {
      rows = rows.filter((log) => {
        const date = formatDateOnly(log.created_at);
        return date && date >= dateFrom;
      });
    }

    if (dateTo) {
      rows = rows.filter((log) => {
        const date = formatDateOnly(log.created_at);
        return date && date <= dateTo;
      });
    }

    rows.sort((a, b) => {
      if (sortMode === "newest") {
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }

      if (sortMode === "oldest") {
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      }

      if (sortMode === "action") {
        return actionLabel(a.action, a).localeCompare(actionLabel(b.action, b));
      }

      if (sortMode === "transaction") {
        return getRecordTitle(a).localeCompare(getRecordTitle(b));
      }

      return 0;
    });

    return rows;
  }, [
    logs,
    selectedAction,
    selectedYear,
    selectedRisk,
    selectedArea,
    selectedActor,
    searchTerm,
    dateFrom,
    dateTo,
    sortMode,
    riskRules,
  ]);

  const stats = useMemo(() => {
    const hidden = logs.filter((log) => isHiddenAuditLog(log)).length;

    const deleted = logs.filter(
      (log) =>
        !isHiddenAuditLog(log) &&
        (log.action === "delete" ||
          log.action === "delete_year" ||
          log.action === "delete_all" ||
          log.action === "refund_permanently_deleted"),
    ).length;

    return {
      total: logs.length,
      visible: filteredLogs.length,
      created: logs.filter((log) => log.action === "create").length,
      edited: logs.filter(
        (log) =>
          log.action === "edit" &&
          !isCheckedAuditLog(log) &&
          !isUncheckedAuditLog(log),
      ).length,
      checked: logs.filter((log) => isCheckedAuditLog(log)).length,
      unchecked: logs.filter((log) => isUncheckedAuditLog(log)).length,
      hidden,
      deleted,
      restored: logs.filter(
        (log) => log.action === "restore" || log.action === "refund_restore",
      ).length,
      refundLogs: logs.filter((log) => isRefundAuditLog(log)).length,
      refundsHidden: logs.filter((log) => log.action === "refund_hide").length,
      refundsDeleted: logs.filter(
        (log) => log.action === "refund_permanently_deleted",
      ).length,
      refundsRestored: logs.filter(
        (log) => log.action === "refund_restore",
      ).length,
      paidBack: logs.filter(
        (log) =>
          log.action === "mark_paid_back" ||
          log.action === "mark_not_paid_back",
      ).length,
      savingTargets: logs.filter((log) => isSavingTargetAuditLog(log)).length,
      budgetPlanning: logs.filter((log) => isBudgetPlanningAuditLog(log)).length,
      automated: logs.filter((log) => isWebsiteGeneratedLog(log)).length,
      highRisk: logs.filter((log) => getRiskLevel(log, riskRules) === "High").length,
      comments: logs.filter((log) => Boolean(getAuditComment(log))).length,
      uniqueUsers: new Set(
        logs
          .map(
            (log) =>
              getActorUniqueKey(log),
          )
          .filter(Boolean),
      ).size,
    };
  }, [logs, filteredLogs.length, riskRules]);

  const yearOptions = useMemo(() => {
    const years = new Set<string>();

    logs.forEach((log) => {
      const year = getYearOnly(log.created_at);
      if (year) years.add(year);
    });

    const currentYear = String(new Date().getFullYear());
    years.add(currentYear);
    years.add(String(Number(currentYear) + 1));
    years.add(String(Number(currentYear) - 1));

    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [logs]);

  const areaOptions = useMemo(() => {
    return Array.from(new Set(logs.map((log) => getAuditArea(log)).filter(Boolean))).sort();
  }, [logs]);

  const actorOptions = useMemo(() => {
    const map = new Map<string, { key: string; label: string; email: string }>();

    logs.forEach((log) => {
      const key = getActorUniqueKey(log);
      if (!key) return;

      if (!map.has(key)) {
        map.set(key, {
          key,
          label: getActorDisplayName(log),
          email: getActorEmailDisplay(log),
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [logs]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * pageSize;
  const pageEndIndex = pageStartIndex + pageSize;
  const visiblePageLogs = filteredLogs.slice(pageStartIndex, pageEndIndex);

  const latestLog = filteredLogs[0] || null;

  function clearFilters() {
    setSearchTerm("");
    setSelectedAction("all");
    setSelectedYear(String(new Date().getFullYear()));
    setSelectedRisk("all");
    setSelectedArea("all");
    setSelectedActor("all");
    setCurrentPage(1);
    setDateFrom("");
    setDateTo("");
    setSortMode("newest");
  }

  function setQuickDateRange(range: "today" | "7days" | "30days" | "year" | "clear") {
    const now = new Date();
    const yyyy = now.getFullYear();

    if (range === "clear") {
      setDateFrom("");
      setDateTo("");
      return;
    }

    if (range === "year") {
      const year = selectedYear === "all" ? String(yyyy) : selectedYear;
      setDateFrom(`${year}-01-01`);
      setDateTo(`${year}-12-31`);
      return;
    }

    const end = now.toISOString().slice(0, 10);
    const startDate = new Date(now);

    if (range === "today") {
      setDateFrom(end);
      setDateTo(end);
      return;
    }

    startDate.setDate(now.getDate() - (range === "7days" ? 7 : 30));
    setDateFrom(startDate.toISOString().slice(0, 10));
    setDateTo(end);
  }

  async function exportRawJson() {
    try {
      const blob = new Blob([JSON.stringify(filteredLogs, null, 2)], {
        type: "application/json",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `burton-pride-money-audit-logs-${selectedYear}-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || "Failed to export JSON file");
      setErrorDetails(err);
    }
  }

  async function exportFormattedExcel() {
    try {
      setExporting(true);
      setError("");
      setErrorDetails(null);

      const params = new URLSearchParams();

      if (selectedYear !== "all") {
        params.set("year", selectedYear);
      } else {
        params.set("year", String(new Date().getFullYear()));
      }

      const route = `/api/admin/money/export/audit-logs-export?${params.toString()}`;

      const response = await fetch(route, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        const text = await response.text();

        let data: any = {};

        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = {
            rawResponse: text,
          };
        }

        throw {
          message:
            data?.error ||
            data?.details?.message ||
            `Audit logs export failed with status ${response.status}`,
          details: {
            route,
            status: response.status,
            statusText: response.statusText,
            response: data,
          },
          status: response.status,
        };
      }

      const blob = await response.blob();

      if (!blob || blob.size === 0) {
        throw {
          message: "The audit logs export returned an empty file.",
          details: {
            route,
            year: selectedYear,
            expectedFile:
              "app/api/admin/money/export/audit-logs-export/route.ts",
          },
        };
      }

      const fileYear =
        selectedYear === "all" ? new Date().getFullYear() : selectedYear;

      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download = `burton-pride-money-audit-logs-${fileYear}-${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(objectUrl);
    } catch (err: any) {
      setError(err?.message || "Failed to export formatted Excel file");
      setErrorDetails(err);
    } finally {
      setExporting(false);
    }
  }

  function printAuditReport() {
    window.print();
  }

  async function copySelectedLog() {
    if (!selectedLog) return;

    await copyToClipboard(JSON.stringify(selectedLog, null, 2));
    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 1600);
  }

  async function saveSelectedLogComment() {
    if (!selectedLog || savingComment) return;

    try {
      setSavingComment(true);
      setCommentSaveError("");
      setCommentSaved(false);

      const comment = commentDraft.trim();
      const res = await fetch("/api/admin/money/audit-logs", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          logId: selectedLog.id,
          comment,
        }),
      });

      const text = await res.text();
      let data: any = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { rawResponse: text };
      }

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to save audit log comment");
      }

      const updatedLog: MoneyAuditLog = data.log || {
        ...selectedLog,
        admin_comment: comment || null,
        admin_comment_updated_at: new Date().toISOString(),
      };

      setLogs((currentLogs) =>
        currentLogs.map((log) =>
          log.id === updatedLog.id ? { ...log, ...updatedLog } : log,
        ),
      );
      setSelectedLog((currentLog) =>
        currentLog && currentLog.id === updatedLog.id
          ? { ...currentLog, ...updatedLog }
          : currentLog,
      );
      setCommentDraft(getAuditComment(updatedLog));
      setCommentSaved(true);

      setTimeout(() => {
        setCommentSaved(false);
      }, 2200);
    } catch (err: any) {
      setCommentSaveError(err?.message || "Failed to save audit log comment");
    } finally {
      setSavingComment(false);
    }
  }

  return (
    <main className="min-h-screen w-full max-w-none overflow-x-auto bg-[#070716] px-1 py-5 text-white sm:px-2 lg:px-3">
      <div className="w-full max-w-none min-w-0 space-y-6">
        <section className="w-full max-w-none overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur">
          <div className="relative p-6">
            <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-purple-500/20 blur-3xl" />
            <div className="absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-pink-500/10 blur-3xl" />

            <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-purple-500/15 px-4 py-2 text-xs font-bold text-purple-100 ring-1 ring-purple-300/20">
                  <ShieldCheck className="h-4 w-4" />
                  Money Tracker Audit Log
                </div>

                <h1 className="break-words text-3xl font-black tracking-tight sm:text-4xl">
                  Audit Logs
                </h1>

                <p className="mt-2 max-w-4xl text-sm leading-6 text-white/60">
                  {easyMode
                    ? "A simple view of the most important money tracker audit logs. Use Full Mode when you need advanced filters, detailed statistics, JSON export, or raw technical data."
                    : "View every money tracker action, including creates, edits, checks, hidden soft-deletes, saving target changes, budget tracker updates, restore actions, selected-year deletes, delete-all actions, refund tracker actions, permanent refund deletions, personal funds paid-back changes, and main-admin comments explaining why changes were made."}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-white/50">
                  <Clock3 className="h-4 w-4" />
                  {latestLog ? (
                    <>
                      Latest visible log:{" "}
                      <span className="font-bold text-white">
                        {formatDateTime(latestLog.created_at)}
                      </span>
                      <span className="text-white/30">•</span>
                      <span>{actionLabel(latestLog.action, latestLog)}</span>
                    </>
                  ) : (
                    <span>No visible logs loaded yet</span>
                  )}
                  {lastRefreshed && (
                    <>
                      <span className="text-white/30">•</span>
                      <span>
                        Last refreshed {formatDateTime(lastRefreshed)}
                      </span>
                      <span className="text-white/30">•</span>
                      <span>
                        Year view{" "}
                        <strong className="text-white">
                          {selectedYear === "all" ? "All years" : selectedYear}
                        </strong>
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={printAuditReport}
                  disabled={filteredLogs.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500/15 px-4 py-3 text-sm font-bold text-sky-200 ring-1 ring-sky-300/20 hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FileText className="h-4 w-4" />
                  Print Report
                </button>

                <button
                  type="button"
                  onClick={exportFormattedExcel}
                  disabled={filteredLogs.length === 0 || exporting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500/15 px-4 py-3 text-sm font-bold text-emerald-200 ring-1 ring-emerald-300/20 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  {exporting ? "Exporting..." : "Export Excel"}
                </button>

                {!easyMode && (
                  <button
                    type="button"
                    onClick={exportRawJson}
                    disabled={filteredLogs.length === 0}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-500/15 px-4 py-3 text-sm font-bold text-purple-200 ring-1 ring-purple-300/20 hover:bg-purple-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Clipboard className="h-4 w-4" />
                    Export JSON
                  </button>
                )}

                <button
                  type="button"
                  onClick={loadLogs}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/10 hover:bg-white/20 disabled:opacity-60"
                >
                  <RefreshCcw
                    className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {easyMode ? (
                  <Sparkles className="h-5 w-5 text-emerald-200" />
                ) : (
                  <Settings2 className="h-5 w-5 text-sky-200" />
                )}

                <h2 className="text-lg font-black text-white">
                  {easyMode ? "Easy Mode is on" : "Full Mode is on"}
                </h2>
              </div>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
                {easyMode
                  ? "Easy Mode keeps the audit log page focused on search, the main filters, and the audit records."
                  : "Full Mode shows advanced filters, detailed statistics, technical exports, and raw audit data."}
              </p>
            </div>

            <button
              type="button"
              onClick={toggleEasyMode}
              disabled={!modeLoaded}
              className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black ring-1 transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${
                easyMode
                  ? "bg-sky-500/15 text-sky-100 ring-sky-300/20 hover:bg-sky-500/25"
                  : "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20 hover:bg-emerald-500/25"
              }`}
            >
              {easyMode ? (
                <>
                  <Settings2 className="h-4 w-4" />
                  Show Full Mode
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Turn on Easy Mode
                </>
              )}
            </button>
          </div>
        </section>

        {error && (
          <section className="rounded-3xl border border-red-400/30 bg-red-500/10 p-5">
            <div className="flex items-center gap-2 font-bold text-red-100">
              <Bug className="h-5 w-5" />
              Error
            </div>

            <p className="mt-2 text-sm text-red-100">{error}</p>

            {errorDetails && (
              <pre className="mt-4 max-h-80 overflow-auto rounded-2xl bg-black/40 p-4 text-xs text-red-100">
                {JSON.stringify(errorDetails, null, 2)}
              </pre>
            )}
          </section>
        )}

        {!easyMode && (
          <>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          <StatCard label="Total Logs" value={stats.total} tone="white" />
          <StatCard label="Showing" value={stats.visible} tone="purple" />
          <StatCard label="High Risk" value={stats.highRisk} tone="red" />
          <StatCard label="Created" value={stats.created} tone="emerald" />
          <StatCard label="Edited" value={stats.edited} tone="sky" />
          <StatCard label="Checked" value={stats.checked} tone="cyan" />
          <StatCard label="Unchecked" value={stats.unchecked} tone="amber" />
          <StatCard label="Hidden" value={stats.hidden} tone="orange" />
          <StatCard label="Deleted" value={stats.deleted} tone="red" />
          <StatCard label="Saving Targets" value={stats.savingTargets} tone="sky" />
          <StatCard label="Budget Logs" value={stats.budgetPlanning} tone="purple" />
          <StatCard label="Paid Back" value={stats.paidBack} tone="pink" />
          <StatCard label="Refund Logs" value={stats.refundLogs} tone="cyan" />
          <StatCard
            label="Refunds Hidden"
            value={stats.refundsHidden}
            tone="orange"
          />
          <StatCard
            label="Refunds Deleted"
            value={stats.refundsDeleted}
            tone="red"
          />
          <StatCard
            label="Refunds Restored"
            value={stats.refundsRestored}
            tone="purple"
          />
          <StatCard label="Auto Website" value={stats.automated} tone="emerald" />
          <StatCard label="Comments" value={stats.comments} tone="amber" />
          <StatCard label="Users" value={stats.uniqueUsers} tone="white" />
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-red-300/20 bg-red-500/10 p-5">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-red-500/15 px-3 py-2 text-xs font-black uppercase tracking-wide text-red-100 ring-1 ring-red-300/20">
              <AlertTriangle className="h-4 w-4" />
              Risk watch
            </div>
            <p className="text-3xl font-black text-white">{stats.highRisk}</p>
            <p className="mt-2 text-sm leading-6 text-red-100/75">
              High-risk actions include deletes, permanent refund deletions,
              soft-deletes, delete-year and delete-all records.
            </p>
          </div>

          <div className="rounded-3xl border border-sky-300/20 bg-sky-500/10 p-5">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-sky-500/15 px-3 py-2 text-xs font-black uppercase tracking-wide text-sky-100 ring-1 ring-sky-300/20">
              <Target className="h-4 w-4" />
              Saving targets
            </div>
            <p className="text-3xl font-black text-white">{stats.savingTargets}</p>
            <p className="mt-2 text-sm leading-6 text-sky-100/75">
              Tracks created, updated, soft-deleted and restored saving target records.
            </p>
          </div>

          <div className="rounded-3xl border border-purple-300/20 bg-purple-500/10 p-5">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-purple-500/15 px-3 py-2 text-xs font-black uppercase tracking-wide text-purple-100 ring-1 ring-purple-300/20">
              <Database className="h-4 w-4" />
              Budget tracker
            </div>
            <p className="text-3xl font-black text-white">{stats.budgetPlanning}</p>
            <p className="mt-2 text-sm leading-6 text-purple-100/75">
              Tracks budget updates, budget item soft-deletes and restore actions.
            </p>
          </div>
        </section>
          </>
        )}

        {!easyMode && (
          <AuditRiskRulesPanelAny
            onRulesChanged={loadRiskRules}
          />
        )}

        <section className="w-full max-w-none rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-4 flex flex-col gap-3 2xl:flex-row 2xl:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />

              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by record, refund, transaction, user, email, action, comment, changed field, route, or raw data..."
                className="w-full rounded-2xl bg-black/30 py-3 pl-11 pr-4 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/40 focus:ring-purple-300/40"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 2xl:w-[1060px]">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value as YearFilter)}
                className="rounded-2xl bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none ring-1 ring-white/10 focus:ring-purple-300/40"
                title="Year"
              >
                <option className="bg-[#11111f] text-white" value="all">
                  All years
                </option>
                {yearOptions.map((year) => (
                  <option key={year} className="bg-[#11111f] text-white" value={year}>
                    {year}
                  </option>
                ))}
              </select>

              <select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
                className="rounded-2xl bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none ring-1 ring-white/10 focus:ring-purple-300/40"
              >
                {actionOptions.map((item) => (
                  <option
                    key={item.value}
                    className="bg-[#11111f] text-white"
                    value={item.value}
                  >
                    {item.label}
                  </option>
                ))}
              </select>

              {!easyMode && (
                <>
                  <select
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value as SortMode)}
                    className="rounded-2xl bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none ring-1 ring-white/10 focus:ring-purple-300/40"
                  >
                    <option className="bg-[#11111f] text-white" value="newest">
                      Newest first
                    </option>
                    <option className="bg-[#11111f] text-white" value="oldest">
                      Oldest first
                    </option>
                    <option className="bg-[#11111f] text-white" value="action">
                      Sort by action
                    </option>
                    <option className="bg-[#11111f] text-white" value="transaction">
                      Sort by record
                    </option>
                  </select>

                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="rounded-2xl bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none ring-1 ring-white/10 focus:ring-purple-300/40"
                    title="Date from"
                  />

                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="rounded-2xl bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none ring-1 ring-white/10 focus:ring-purple-300/40"
                    title="Date to"
                  />
                </>
              )}
            </div>
          </div>

          {!easyMode && (
            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value as RiskFilter)}
              className="rounded-2xl bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none ring-1 ring-white/10 focus:ring-purple-300/40"
            >
              <option className="bg-[#11111f] text-white" value="all">
                All risk levels
              </option>
              <option className="bg-[#11111f] text-white" value="High">
                High risk only
              </option>
              <option className="bg-[#11111f] text-white" value="Medium">
                Medium risk only
              </option>
              <option className="bg-[#11111f] text-white" value="Low">
                Low risk only
              </option>
            </select>

            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value as AreaFilter)}
              className="rounded-2xl bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none ring-1 ring-white/10 focus:ring-purple-300/40"
            >
              <option className="bg-[#11111f] text-white" value="all">
                All areas
              </option>
              {areaOptions.map((area) => (
                <option key={area} className="bg-[#11111f] text-white" value={area}>
                  {area}
                </option>
              ))}
            </select>

            <select
              value={selectedActor}
              onChange={(e) => setSelectedActor(e.target.value)}
              className="rounded-2xl bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none ring-1 ring-white/10 focus:ring-purple-300/40"
            >
              <option className="bg-[#11111f] text-white" value="all">
                All users / actors
              </option>
              {actorOptions.map((actor) => (
                <option key={actor.key} className="bg-[#11111f] text-white" value={actor.key}>
                  {actor.label}{actor.email ? ` — ${actor.email}` : ""}
                </option>
              ))}
            </select>

            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value) || 50)}
              className="rounded-2xl bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none ring-1 ring-white/10 focus:ring-purple-300/40"
            >
              <option className="bg-[#11111f] text-white" value={25}>
                25 per page
              </option>
              <option className="bg-[#11111f] text-white" value={50}>
                50 per page
              </option>
              <option className="bg-[#11111f] text-white" value={100}>
                100 per page
              </option>
              <option className="bg-[#11111f] text-white" value={250}>
                250 per page
              </option>
            </select>
            </div>
          )}

          {!easyMode ? (
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {yearOptions.slice(0, 4).map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => setSelectedYear(year)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ring-1 transition ${
                    selectedYear === year
                      ? "bg-purple-300 text-black ring-purple-200"
                      : "bg-purple-500/10 text-purple-100 ring-purple-300/20 hover:bg-purple-500/20"
                  }`}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  {year}
                </button>
              ))}

              {actionOptions.slice(0, 6).map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setSelectedAction(item.value)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ring-1 transition ${
                    selectedAction === item.value
                      ? "bg-white text-black ring-white"
                      : "bg-white/10 text-white/75 ring-white/10 hover:bg-white/20"
                  }`}
                >
                  <Filter className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setQuickDateRange("today")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white/75 ring-1 ring-white/10 hover:bg-white/20"
            >
              Today
            </button>

            <button
              type="button"
              onClick={() => setQuickDateRange("7days")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white/75 ring-1 ring-white/10 hover:bg-white/20"
            >
              Last 7 days
            </button>

            <button
              type="button"
              onClick={() => setQuickDateRange("30days")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white/75 ring-1 ring-white/10 hover:bg-white/20"
            >
              Last 30 days
            </button>

            <button
              type="button"
              onClick={() => setQuickDateRange("year")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white/75 ring-1 ring-white/10 hover:bg-white/20"
            >
              Whole year
            </button>

            <button
              type="button"
              onClick={() => setSelectedRisk("High")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-500/10 px-4 py-2 text-xs font-bold text-red-100 ring-1 ring-red-300/20 hover:bg-red-500/20"
            >
              <AlertTriangle className="h-4 w-4" />
              High risk
            </button>

            <button
              type="button"
              onClick={() => setSelectedArea("Saving Targets")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500/10 px-4 py-2 text-xs font-bold text-sky-100 ring-1 ring-sky-300/20 hover:bg-sky-500/20"
            >
              <Target className="h-4 w-4" />
              Saving targets
            </button>

            <button
              type="button"
              onClick={() => setSelectedArea("Budget Planning")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-500/10 px-4 py-2 text-xs font-bold text-purple-100 ring-1 ring-purple-300/20 hover:bg-purple-500/20"
            >
              <BarChart3 className="h-4 w-4" />
              Budget logs
            </button>

            <button
              type="button"
              onClick={() => setSelectedArea("Refund Tracker")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-100 ring-1 ring-cyan-300/20 hover:bg-cyan-500/20"
            >
              <RotateCcw className="h-4 w-4" />
              Refund logs
            </button>

            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white/75 ring-1 ring-white/10 hover:bg-white/20"
            >
              <X className="h-4 w-4" />
              Clear filters
            </button>
          </div>
          ) : (
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setQuickDateRange("today")}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white/75 ring-1 ring-white/10 hover:bg-white/20"
              >
                Today
              </button>

              <button
                type="button"
                onClick={() => setQuickDateRange("7days")}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white/75 ring-1 ring-white/10 hover:bg-white/20"
              >
                Last 7 days
              </button>

              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white/75 ring-1 ring-white/10 hover:bg-white/20"
              >
                <X className="h-4 w-4" />
                Clear filters
              </button>
            </div>
          )}

          <div className="mb-4 rounded-2xl bg-black/20 px-4 py-3 text-sm text-white/60">
            Showing{" "}
            <strong className="text-white">{filteredLogs.length}</strong> audit
            log{filteredLogs.length === 1 ? "" : "s"} from{" "}
            <strong className="text-white">{logs.length}</strong> loaded for{" "}
            <strong className="text-white">
              {selectedYear === "all" ? "all years" : selectedYear}
            </strong>.
            {filteredLogs.length > 0 && (
              <>
                {" "}
                Page <strong className="text-white">{safeCurrentPage}</strong> of{" "}
                <strong className="text-white">{totalPages}</strong>, showing rows{" "}
                <strong className="text-white">{pageStartIndex + 1}</strong>-
                <strong className="text-white">
                  {Math.min(pageEndIndex, filteredLogs.length)}
                </strong>.
              </>
            )}
          </div>

          {loading ? (
            <div className="rounded-2xl bg-black/20 p-5 text-sm text-white/60">
              Loading audit logs...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="rounded-2xl bg-black/20 p-8 text-center text-sm text-white/60">
              <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-orange-200" />
              No audit logs found for your current filters.
            </div>
          ) : (
            <>
              <div className="hidden w-full max-w-none overflow-x-auto overflow-y-hidden rounded-2xl border border-white/10 xl:block">
                <table className="w-full min-w-[1250px] text-sm">
                  <thead className="bg-white/10 text-white/60">
                    <tr>
                      <th className="p-3 text-left">When</th>
                      <th className="p-3 text-left">Action</th>
                      <th className="p-3 text-left">Record</th>
                      <th className="p-3 text-left">Amount</th>
                      <th className="p-3 text-left">Who</th>
                      <th className="p-3 text-left">Area</th>
                      <th className="p-3 text-left">Risk</th>
                      <th className="p-3 text-left">Changed Fields</th>
                      <th className="p-3 text-left">Comment</th>
                      <th className="p-3 text-left">Source</th>
                      <th className="sticky right-0 bg-[#242435] p-3 text-right backdrop-blur">
                        View
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {visiblePageLogs.map((log) => {
                      const changedNames = getChangedFieldNames(
                        log.changed_fields,
                      );
                      const source = getSourceLabel(log);
                      const risk = getRiskLevel(log, riskRules);
                      const amountDisplay = getAuditMoneyDisplay(log);
                      const ActionIcon = actionIcon(log.action, log);

                      return (
                        <tr key={log.id} className="border-t border-white/10">
                          <td className="whitespace-nowrap p-3 text-white/70">
                            <div className="flex items-center gap-2">
                              <CalendarDays className="h-4 w-4 text-white/30" />
                              {formatDateTime(log.created_at)}
                            </div>
                          </td>

                          <td className="p-3">
                            <span
                              className={`inline-flex items-center gap-2 rounded-2xl px-3 py-1 text-xs font-bold capitalize ring-1 ${actionClass(
                                log.action,
                                log,
                              )}`}
                            >
                              <ActionIcon className="h-3.5 w-3.5" />
                              {actionLabel(log.action, log)}
                            </span>
                          </td>

                          <td className="max-w-[280px] p-3">
                            <p className="break-words font-bold text-white">
                              {getRecordTitle(log)}
                            </p>

                            {getRecordId(log) && (
                              <p className="mt-1 break-all text-xs text-white/35">
                                {getRecordId(log)}
                              </p>
                            )}
                          </td>

                          <td className="whitespace-nowrap p-3">
                            <span className="inline-flex rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-100 ring-1 ring-emerald-300/20">
                              {amountDisplay}
                            </span>
                          </td>

                          <td className="max-w-[260px] p-3">
                            <p className="flex items-center gap-2 break-words font-semibold text-white/90">
                              <UserRound className="h-4 w-4 text-white/35" />
                              {getActorDisplayName(log)}
                            </p>

                            {getActorEmailDisplay(log) && (
                              <p className="mt-1 flex items-center gap-2 break-words text-xs text-white/45">
                                <Mail className="h-3.5 w-3.5 text-white/30" />
                                {getActorEmailDisplay(log)}
                              </p>
                            )}
                          </td>

                          <td className="max-w-[220px] p-3">
                            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold capitalize text-white/80 ring-1 ring-white/10">
                              <Layers3 className="h-3.5 w-3.5 text-white/45" />
                              {getAuditArea(log)}
                            </p>
                          </td>

                          <td className="p-3">
                            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black ring-1 ${riskClass(risk)}`}>
                              {risk}
                            </span>
                          </td>

                          <td className="max-w-[360px] p-3">
                            {changedNames.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {changedNames.slice(0, 5).map((name) => (
                                  <span
                                    key={name}
                                    className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/80 ring-1 ring-white/10"
                                  >
                                    {cleanFieldName(name)}
                                  </span>
                                ))}

                                {changedNames.length > 5 && (
                                  <span className="rounded-full bg-purple-500/15 px-3 py-1 text-xs font-bold text-purple-100 ring-1 ring-purple-300/20">
                                    +{changedNames.length - 5} more
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-white/35">—</span>
                            )}
                          </td>

                          <td className="max-w-[300px] p-3">
                            {getAuditComment(log) ? (
                              <div className="rounded-xl bg-amber-500/10 p-3 ring-1 ring-amber-300/15">
                                <p className="line-clamp-4 break-words text-xs leading-5 text-amber-50">
                                  {getAuditComment(log)}
                                </p>
                              </div>
                            ) : (
                              <span className="text-white/35">—</span>
                            )}
                          </td>

                          <td className="max-w-[240px] p-3">
                            <p className="break-words text-xs font-semibold text-white/60">
                              {source}
                            </p>
                            {log.metadata?.route && (
                              <p className="mt-1 line-clamp-2 break-words text-[11px] text-white/35">
                                {log.metadata.route}
                              </p>
                            )}
                          </td>

                          <td className="sticky right-0 bg-[#11111f] p-3 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedLog(log)}
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-500/15 px-3 py-2 text-xs font-bold text-purple-200 ring-1 ring-purple-300/20 hover:bg-purple-500/25"
                            >
                              <Eye className="h-4 w-4" />
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 xl:hidden">
                {visiblePageLogs.map((log) => {
                  const ActionIcon = actionIcon(log.action, log);
                  const changedNames = getChangedFieldNames(log.changed_fields);
                  const amountDisplay = getAuditMoneyDisplay(log);

                  return (
                    <article
                      key={log.id}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <span
                          className={`inline-flex items-center gap-2 rounded-2xl px-3 py-1 text-xs font-bold ring-1 ${actionClass(
                            log.action,
                            log,
                          )}`}
                        >
                          <ActionIcon className="h-3.5 w-3.5" />
                          {actionLabel(log.action, log)}
                        </span>

                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          className="rounded-xl bg-purple-500/15 px-3 py-2 text-xs font-bold text-purple-200 ring-1 ring-purple-300/20"
                        >
                          View
                        </button>
                      </div>

                      <h3 className="break-words font-bold">
                        {getRecordTitle(log)}
                      </h3>

                      <p className="mt-1 text-xs text-white/45">
                        {formatDateTime(log.created_at)}
                      </p>

                      <div className="mt-3 inline-flex rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-100 ring-1 ring-emerald-300/20">
                        Amount: {amountDisplay}
                      </div>

                      <div className="mt-3 rounded-xl bg-white/5 p-3">
                        <p className="text-sm font-bold">
                          {getActorDisplayName(log)}
                        </p>
                        <p className="mt-1 break-words text-xs text-white/45">
                          {getActorEmailDisplay(log) || "No email saved"}
                        </p>
                      </div>

                      {changedNames.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {changedNames.slice(0, 6).map((name) => (
                            <span
                              key={name}
                              className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/75"
                            >
                              {cleanFieldName(name)}
                            </span>
                          ))}
                        </div>
                      )}

                      {getAuditComment(log) && (
                        <div className="mt-3 rounded-xl bg-amber-500/10 p-3 ring-1 ring-amber-300/15">
                          <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-amber-100">
                            <MessageSquare className="h-3.5 w-3.5" />
                            Main admin comment
                          </div>
                          <p className="break-words text-sm leading-6 text-amber-50/90">
                            {getAuditComment(log)}
                          </p>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>

      <section className="audit-print-report hidden">
        <div className="audit-print-header">
          <div>
            <p className="audit-print-kicker">Burton Pride C.I.C</p>
            <h1>Money Tracker Audit Logs</h1>
            <p className="audit-print-subtitle">
              Printed {new Date().toLocaleString("en-GB")} • Showing{" "}
              {filteredLogs.length} of {logs.length} loaded audit logs
            </p>
          </div>
          <div className="audit-print-badge">Audit Report</div>
        </div>

        <div className="audit-print-filters">
          <span>
            <strong>Action:</strong>{" "}
            {selectedAction === "all"
              ? "All actions"
              : actionOptions.find((item) => item.value === selectedAction)
                  ?.label || actionLabel(selectedAction)}
          </span>
          <span>
            <strong>Search:</strong> {searchTerm || "No search"}
          </span>
          <span>
            <strong>Date from:</strong> {dateFrom || "No start date"}
          </span>
          <span>
            <strong>Date to:</strong> {dateTo || "No end date"}
          </span>
          <span>
            <strong>Sort:</strong> {sortMode}
          </span>
        </div>

        <div className="audit-print-stats">
          <div>
            <span>Total</span>
            <strong>{stats.total}</strong>
          </div>
          <div>
            <span>Showing</span>
            <strong>{stats.visible}</strong>
          </div>
          <div>
            <span>Created</span>
            <strong>{stats.created}</strong>
          </div>
          <div>
            <span>Checked</span>
            <strong>{stats.checked}</strong>
          </div>
          <div>
            <span>Unchecked</span>
            <strong>{stats.unchecked}</strong>
          </div>
          <div>
            <span>Edited</span>
            <strong>{stats.edited}</strong>
          </div>
          <div>
            <span>Hidden</span>
            <strong>{stats.hidden}</strong>
          </div>
          <div>
            <span>Deleted</span>
            <strong>{stats.deleted}</strong>
          </div>
          <div>
            <span>Paid Back</span>
            <strong>{stats.paidBack}</strong>
          </div>
          <div>
            <span>Refund Logs</span>
            <strong>{stats.refundLogs}</strong>
          </div>
          <div>
            <span>Refunds Deleted</span>
            <strong>{stats.refundsDeleted}</strong>
          </div>
          <div>
            <span>Users</span>
            <strong>{stats.uniqueUsers}</strong>
          </div>
        </div>

        <table className="audit-print-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Action</th>
              <th>Record</th>
              <th>Amount</th>
              <th>Who</th>
              <th>Changed Fields</th>
              <th>Main Admin Comment</th>
              <th>Source / Route</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  No audit logs found for the current filters.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const changedNames = getChangedFieldNames(log.changed_fields);

                return (
                  <tr key={`print-${log.id}`}>
                    <td>{formatDateTime(log.created_at)}</td>
                    <td>
                      <span className="audit-print-action">
                        {actionLabel(log.action, log)}
                      </span>
                    </td>
                    <td>
                      <strong>{getRecordTitle(log)}</strong>
                      {getRecordId(log) && (
                        <small>{getRecordId(log)}</small>
                      )}
                    </td>
                    <td>
                      <strong>{getAuditMoneyDisplay(log)}</strong>
                    </td>
                    <td>
                      <strong>{getActorDisplayName(log)}</strong>
                      {getActorEmailDisplay(log) && <small>{getActorEmailDisplay(log)}</small>}
                    </td>
                    <td>
                      {changedNames.length > 0
                        ? changedNames.map(cleanFieldName).join(", ")
                        : "—"}
                    </td>
                    <td>{getAuditComment(log) || "—"}</td>
                    <td>
                      <strong>{getSourceLabel(log)}</strong>
                      {log.metadata?.route && (
                        <small>{log.metadata.route}</small>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div className="audit-print-footer">
          This report is generated from the Burton Pride C.I.C money tracker
          audit logs.
        </div>
      </section>

      <style jsx global>{`
        @media screen {
          .audit-print-report {
            display: none !important;
          }
        }

        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm;
          }

          html,
          body {
            background: #ffffff !important;
            color: #111827 !important;
          }

          body * {
            visibility: hidden !important;
          }

          .audit-print-report,
          .audit-print-report * {
            visibility: visible !important;
          }

          .audit-print-report {
            display: block !important;
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            min-height: auto !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #111827 !important;
            font-family: Arial, Helvetica, sans-serif !important;
          }

          .audit-print-header {
            display: flex !important;
            align-items: flex-start !important;
            justify-content: space-between !important;
            gap: 16px !important;
            border-bottom: 3px solid #7c3aed !important;
            padding-bottom: 12px !important;
            margin-bottom: 12px !important;
          }

          .audit-print-kicker {
            margin: 0 0 3px !important;
            color: #7c3aed !important;
            font-size: 10px !important;
            font-weight: 800 !important;
            letter-spacing: 0.08em !important;
            text-transform: uppercase !important;
          }

          .audit-print-header h1 {
            margin: 0 !important;
            color: #111827 !important;
            font-size: 24px !important;
            line-height: 1.1 !important;
            font-weight: 900 !important;
          }

          .audit-print-subtitle {
            margin: 6px 0 0 !important;
            color: #4b5563 !important;
            font-size: 10px !important;
          }

          .audit-print-badge {
            border: 1px solid #c4b5fd !important;
            border-radius: 999px !important;
            background: #f5f3ff !important;
            color: #5b21b6 !important;
            padding: 7px 12px !important;
            font-size: 10px !important;
            font-weight: 900 !important;
            white-space: nowrap !important;
          }

          .audit-print-filters {
            display: grid !important;
            grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
            gap: 6px !important;
            margin-bottom: 10px !important;
          }

          .audit-print-filters span {
            border: 1px solid #e5e7eb !important;
            border-radius: 8px !important;
            background: #f9fafb !important;
            padding: 6px 8px !important;
            color: #374151 !important;
            font-size: 9px !important;
            overflow-wrap: anywhere !important;
          }

          .audit-print-stats {
            display: grid !important;
            grid-template-columns: repeat(10, minmax(0, 1fr)) !important;
            gap: 6px !important;
            margin-bottom: 12px !important;
          }

          .audit-print-stats div {
            border: 1px solid #e5e7eb !important;
            border-radius: 10px !important;
            background: #ffffff !important;
            padding: 7px 8px !important;
            break-inside: avoid !important;
          }

          .audit-print-stats span {
            display: block !important;
            color: #6b7280 !important;
            font-size: 8px !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.04em !important;
          }

          .audit-print-stats strong {
            display: block !important;
            margin-top: 2px !important;
            color: #111827 !important;
            font-size: 18px !important;
            line-height: 1 !important;
            font-weight: 900 !important;
          }

          .audit-print-table {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
            color: #111827 !important;
            font-size: 9px !important;
          }

          .audit-print-table thead {
            display: table-header-group !important;
          }

          .audit-print-table tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .audit-print-table th {
            border: 1px solid #d1d5db !important;
            background: #111827 !important;
            color: #ffffff !important;
            padding: 7px 6px !important;
            text-align: left !important;
            font-size: 9px !important;
            font-weight: 900 !important;
          }

          .audit-print-table td {
            border: 1px solid #e5e7eb !important;
            padding: 6px !important;
            vertical-align: top !important;
            color: #111827 !important;
            overflow-wrap: anywhere !important;
          }

          .audit-print-table tbody tr:nth-child(even) td {
            background: #f9fafb !important;
          }

          .audit-print-table th:nth-child(1),
          .audit-print-table td:nth-child(1) {
            width: 13% !important;
          }

          .audit-print-table th:nth-child(2),
          .audit-print-table td:nth-child(2) {
            width: 12% !important;
          }

          .audit-print-table th:nth-child(3),
          .audit-print-table td:nth-child(3) {
            width: 20% !important;
          }

          .audit-print-table th:nth-child(4),
          .audit-print-table td:nth-child(4) {
            width: 18% !important;
          }

          .audit-print-table th:nth-child(5),
          .audit-print-table td:nth-child(5) {
            width: 18% !important;
          }

          .audit-print-table th:nth-child(6),
          .audit-print-table td:nth-child(6) {
            width: 19% !important;
          }

          .audit-print-table strong {
            display: block !important;
            color: #111827 !important;
            font-weight: 900 !important;
          }

          .audit-print-table small {
            display: block !important;
            margin-top: 2px !important;
            color: #6b7280 !important;
            font-size: 8px !important;
            line-height: 1.25 !important;
          }

          .audit-print-action {
            display: inline-block !important;
            border: 1px solid #c4b5fd !important;
            border-radius: 999px !important;
            background: #f5f3ff !important;
            color: #4c1d95 !important;
            padding: 3px 7px !important;
            font-size: 8px !important;
            font-weight: 900 !important;
            white-space: nowrap !important;
          }

          .audit-print-footer {
            margin-top: 10px !important;
            border-top: 1px solid #e5e7eb !important;
            padding-top: 7px !important;
            color: #6b7280 !important;
            font-size: 9px !important;
          }

          .fixed {
            display: none !important;
          }
        }
      `}</style>

      {filteredLogs.length > pageSize && (
        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-white/60">
              Showing page{" "}
              <strong className="text-white">{safeCurrentPage}</strong> of{" "}
              <strong className="text-white">{totalPages}</strong>
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={safeCurrentPage <= 1}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white ring-1 ring-white/10 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                First
              </button>

              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={safeCurrentPage <= 1}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white ring-1 ring-white/10 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>

              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={safeCurrentPage >= totalPages}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white ring-1 ring-white/10 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>

              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={safeCurrentPage >= totalPages}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white ring-1 ring-white/10 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Last
              </button>
            </div>
          </div>
        </section>
      )}

      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-7xl overflow-hidden rounded-3xl border border-white/10 bg-[#070716] text-white shadow-2xl">
            <div className="border-b border-white/10 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div
                    className={`mb-3 inline-flex items-center gap-2 rounded-2xl px-3 py-1 text-xs font-bold ring-1 ${actionClass(
                      selectedLog.action,
                      selectedLog,
                    )}`}
                  >
                    {(() => {
                      const Icon = actionIcon(selectedLog.action, selectedLog);
                      return <Icon className="h-3.5 w-3.5" />;
                    })()}
                    {actionLabel(selectedLog.action, selectedLog)}
                  </div>

                  <h2 className="break-words text-2xl font-black">
                    {getRecordTitle(selectedLog)}
                  </h2>

                  <p className="mt-1 text-sm text-white/50">
                    {formatDateTime(selectedLog.created_at)}
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  {!easyMode && (
                    <button
                      type="button"
                      onClick={copySelectedLog}
                      className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white/80 hover:bg-white/20"
                    >
                      <Clipboard className="h-4 w-4" />
                      {copied ? "Copied" : "Copy JSON"}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedLog(null)}
                    className="rounded-xl bg-white/10 p-2 hover:bg-white/20"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="max-h-[78vh] overflow-auto p-5">
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                <InfoCard
                  label="Who did it"
                  title={getActorDisplayName(selectedLog)}
                  subtitle={getActorEmailDisplay(selectedLog) || "No email saved"}
                  extra={getActorUserIdDisplay(selectedLog)}
                  icon={<UserRound className="h-5 w-5" />}
                />

                <InfoCard
                  label="Record"
                  title={getRecordTitle(selectedLog)}
                  subtitle={getRecordId(selectedLog) || "No record ID saved"}
                  icon={<FileText className="h-5 w-5" />}
                />

                <InfoCard
                  label="Amount"
                  title={getAuditMoneyDisplay(selectedLog)}
                  subtitle="Money amount linked to this audit record"
                  icon={<FileSpreadsheet className="h-5 w-5" />}
                />

                <InfoCard
                  label="Source"
                  title={getSourceLabel(selectedLog)}
                  subtitle={selectedLog.metadata?.route || "No route saved"}
                  icon={<Activity className="h-5 w-5" />}
                />
              </div>

              <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-amber-100" />
                      <h3 className="font-black text-amber-50">Main Admin Comment</h3>
                    </div>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-50/70">
                      Add a clear explanation for why this record was changed, deleted, checked, restored, or imported. Saving an empty comment removes the existing comment.
                    </p>
                  </div>

                  {selectedLog.admin_comment_updated_at && (
                    <div className="rounded-xl bg-black/20 px-3 py-2 text-xs leading-5 text-amber-50/65 ring-1 ring-amber-300/10">
                      Last updated {formatDateTime(selectedLog.admin_comment_updated_at)}
                      <br />
                      by {getAuditCommentUpdatedBy(selectedLog)}
                    </div>
                  )}
                </div>

                <textarea
                  value={commentDraft}
                  onChange={(event) => {
                    setCommentDraft(event.target.value);
                    setCommentSaveError("");
                    setCommentSaved(false);
                  }}
                  rows={5}
                  maxLength={2000}
                  placeholder="Example: Hidden because this was entered twice, or checked against the bank statement on 30 May 2026."
                  className="mt-4 w-full resize-y rounded-2xl bg-black/30 p-4 text-sm leading-6 text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-amber-300/40"
                />

                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-amber-50/60">
                    {commentDraft.length}/2000 characters
                    {commentSaved && (
                      <span className="ml-3 font-bold text-emerald-200">Comment saved.</span>
                    )}
                    {commentSaveError && (
                      <span className="ml-3 font-bold text-red-200">{commentSaveError}</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    {commentDraft && (
                      <button
                        type="button"
                        onClick={() => setCommentDraft("")}
                        disabled={savingComment}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100 ring-1 ring-red-300/20 hover:bg-red-500/20 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Clear comment
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={saveSelectedLogComment}
                      disabled={savingComment}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 py-3 text-sm font-black text-black hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingComment ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      {savingComment ? "Saving..." : "Save Comment"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-sky-200" />
                    <h3 className="font-bold">Changed Fields</h3>
                  </div>

                  {!easyMode && (
                    <button
                      type="button"
                      onClick={() => setShowRawData((prev) => !prev)}
                      className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white/75 hover:bg-white/20"
                    >
                      <ChevronDown className="h-4 w-4" />
                      {showRawData ? "Hide raw data" : "Show raw data"}
                    </button>
                  )}
                </div>

                {selectedLog.changed_fields &&
                Object.keys(selectedLog.changed_fields).length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-white/10">
                    <table className="w-full min-w-[800px] text-sm">
                      <thead className="bg-white/10 text-white/60">
                        <tr>
                          <th className="p-3 text-left">Field</th>
                          <th className="p-3 text-left">Before</th>
                          <th className="p-3 text-left">After</th>
                        </tr>
                      </thead>

                      <tbody>
                        {Object.entries(selectedLog.changed_fields).map(
                          ([field, value]: [string, any]) => (
                            <tr
                              key={field}
                              className="border-t border-white/10"
                            >
                              <td className="p-3 font-bold text-white">
                                {cleanFieldName(field)}
                              </td>

                              <td className="max-w-[420px] p-3">
                                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-red-500/10 p-3 text-xs text-red-100 ring-1 ring-red-300/10">
                                  {shortValue(value?.before)}
                                </pre>
                              </td>

                              <td className="max-w-[420px] p-3">
                                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-100 ring-1 ring-emerald-300/10">
                                  {shortValue(value?.after)}
                                </pre>
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-xl bg-white/5 p-4 text-sm text-white/50">
                    No field changes saved for this action.
                  </div>
                )}
              </div>

              {!easyMode && showRawData && (
                <>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <RawDataCard
                      title="Before Data"
                      data={selectedLog.before_data}
                    />
                    <RawDataCard
                      title="After Data"
                      data={selectedLog.after_data}
                    />
                  </div>

                  <RawDataCard
                    title="Metadata"
                    data={selectedLog.metadata}
                    className="mt-4"
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
