"use client";

import { useEffect, useMemo, useState } from "react";
import ExcelJS from "exceljs";
import {
  Activity,
  AlertTriangle,
  Bug,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clipboard,
  Clock3,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Mail,
  RefreshCcw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

type MoneyAuditLog = {
  id: string;
  created_at: string;
  action: string;
  transaction_id: string | null;
  transaction_title: string | null;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  before_data: any;
  after_data: any;
  changed_fields: any;
  metadata: any;
};

type SortMode = "newest" | "oldest" | "action" | "transaction";

const actionOptions = [
  { value: "all", label: "All actions" },
  { value: "create", label: "Created" },
  { value: "edit", label: "Edited" },
  { value: "delete", label: "Hidden" },
  { value: "delete_year", label: "Deleted year" },
  { value: "delete_all", label: "Deleted all" },
  { value: "restore", label: "Restored" },
  { value: "mark_paid_back", label: "Marked paid back" },
  { value: "mark_not_paid_back", label: "Marked not paid back" },
];

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";

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

function formatExcelDate(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date;
}

function formatDateOnly(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}

function isHiddenAuditLog(log: MoneyAuditLog) {
  const action = String(log.action || "").toLowerCase().trim();

  if (action !== "delete") return false;

  const route = String(log.metadata?.route || "").toLowerCase();
  const source = String(log.metadata?.source || "").toLowerCase();

  const isMoneyTransactionRoute =
    route.includes("/api/admin/money/transactions") ||
    route.includes("/admin/money/transactions");

  const isPermanentDelete =
    route.includes("/permanent") ||
    log.metadata?.permanentDelete === true ||
    log.metadata?.permanent_delete === true;

  const hasSoftDeleteFlag =
    log.metadata?.softDelete === true ||
    log.metadata?.soft_delete === true ||
    log.after_data?.deleted_at ||
    log.after_data?.deleted_by ||
    log.changed_fields?.deleted_at ||
    log.changed_fields?.deleted_by;

  if (isPermanentDelete) return false;

  return (
    source === "money_tracker" ||
    isMoneyTransactionRoute ||
    hasSoftDeleteFlag
  );
}

function actionLabel(action: string, log?: MoneyAuditLog) {
  if (log && isHiddenAuditLog(log)) return "Hidden";

  if (action === "create") return "Created";
  if (action === "edit") return "Edited";
  if (action === "delete") return "Deleted";
  if (action === "delete_year") return "Deleted Year";
  if (action === "delete_all") return "Deleted All";
  if (action === "restore") return "Restored";
  if (action === "mark_paid_back") return "Marked Paid Back";
  if (action === "mark_not_paid_back") return "Marked Not Paid Back";

  return action.replaceAll("_", " ");
}

function actionClass(action: string, log?: MoneyAuditLog) {
  if (log && isHiddenAuditLog(log)) {
    return "bg-orange-500/15 text-orange-200 ring-orange-300/20";
  }

  if (action === "create") {
    return "bg-emerald-500/15 text-emerald-200 ring-emerald-300/20";
  }

  if (action === "edit") {
    return "bg-sky-500/15 text-sky-200 ring-sky-300/20";
  }

  if (action === "delete" || action === "delete_year" || action === "delete_all") {
    return "bg-red-500/15 text-red-200 ring-red-300/20";
  }

  if (action === "restore") {
    return "bg-purple-500/15 text-purple-200 ring-purple-300/20";
  }

  if (action === "mark_paid_back") {
    return "bg-emerald-500/15 text-emerald-200 ring-emerald-300/20";
  }

  if (action === "mark_not_paid_back") {
    return "bg-orange-500/15 text-orange-200 ring-orange-300/20";
  }

  return "bg-white/10 text-white ring-white/10";
}

function actionExcelColour(action: string, log?: MoneyAuditLog) {
  if (log && isHiddenAuditLog(log)) return "FFEA580C";

  if (action === "create") return "FF047857";
  if (action === "edit") return "FF0284C7";
  if (action === "delete" || action === "delete_year" || action === "delete_all") {
    return "FFB91C1C";
  }
  if (action === "restore") return "FF7C3AED";
  if (action === "mark_paid_back") return "FF059669";
  if (action === "mark_not_paid_back") return "FFEA580C";
  return "FF374151";
}

function actionIcon(action: string, log?: MoneyAuditLog) {
  if (log && isHiddenAuditLog(log)) return Eye;

  if (action === "create") return CheckCircle2;
  if (action === "edit") return FileText;
  if (action === "delete" || action === "delete_year" || action === "delete_all") {
    return Trash2;
  }
  if (action === "restore") return RotateCcw;
  if (action === "mark_paid_back") return CheckCircle2;
  if (action === "mark_not_paid_back") return AlertTriangle;

  return Activity;
}

function getChangedFieldNames(changedFields: any) {
  if (!changedFields || typeof changedFields !== "object") return [];
  return Object.keys(changedFields);
}

function cleanFieldName(name: string) {
  return name
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function shortValue(value: any) {
  if (value === null || value === undefined || value === "") return "—";

  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function nameFromEmail(email: string | null | undefined) {
  if (!email) return "";

  const username = email.split("@")[0] || "";

  return username
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function getActorDisplayName(log: MoneyAuditLog) {
  return log.actor_name || nameFromEmail(log.actor_email) || "Unknown user";
}

function getSourceLabel(log: MoneyAuditLog) {
  const source = log.metadata?.source;
  const route = log.metadata?.route;

  if (source === "money_tracker") return "Money Tracker";
  if (source) return String(source).replaceAll("_", " ");
  if (route) return String(route);

  return "—";
}

function getTransactionTitle(log: MoneyAuditLog) {
  return (
    log.transaction_title ||
    log.after_data?.title ||
    log.before_data?.title ||
    "Untitled transaction"
  );
}

function safeJson(value: any) {
  if (value === null || value === undefined) return "";

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function copyToClipboard(value: string) {
  return navigator.clipboard.writeText(value);
}

async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();

  const blob = new Blob([buffer as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function setThinBorder(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: "thin", color: { argb: "FFE5E7EB" } },
    left: { style: "thin", color: { argb: "FFE5E7EB" } },
    bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
    right: { style: "thin", color: { argb: "FFE5E7EB" } },
  };
}

function styleTitleCell(cell: ExcelJS.Cell) {
  cell.font = {
    bold: true,
    size: 20,
    color: { argb: "FFFFFFFF" },
  };

  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF111827" },
  };

  cell.alignment = {
    horizontal: "center",
    vertical: "middle",
  };
}

function styleSubtitleCell(cell: ExcelJS.Cell) {
  cell.font = {
    bold: true,
    size: 11,
    color: { argb: "FF374151" },
  };

  cell.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };
}

function styleSectionCell(cell: ExcelJS.Cell, colour = "FF7C3AED") {
  cell.font = {
    bold: true,
    size: 13,
    color: { argb: "FFFFFFFF" },
  };

  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: colour },
  };

  cell.alignment = {
    horizontal: "left",
    vertical: "middle",
  };
}

function styleHeaderRow(row: ExcelJS.Row, colour = "FF111827") {
  row.eachCell((cell) => {
    cell.font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
    };

    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: colour },
    };

    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };

    setThinBorder(cell);
  });

  row.height = 26;
}

function styleBodyRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.alignment = {
      vertical: "top",
      wrapText: true,
    };

    setThinBorder(cell);
  });
}

function addMergedTitle(
  worksheet: ExcelJS.Worksheet,
  text: string,
  fromCell: string,
  toCell: string
) {
  worksheet.mergeCells(`${fromCell}:${toCell}`);
  const cell = worksheet.getCell(fromCell);
  cell.value = text;
  styleTitleCell(cell);
}

function addMergedSubtitle(
  worksheet: ExcelJS.Worksheet,
  text: string,
  fromCell: string,
  toCell: string
) {
  worksheet.mergeCells(`${fromCell}:${toCell}`);
  const cell = worksheet.getCell(fromCell);
  cell.value = text;
  styleSubtitleCell(cell);
}

function addMergedSection(
  worksheet: ExcelJS.Worksheet,
  text: string,
  fromCell: string,
  toCell: string,
  colour = "FF7C3AED"
) {
  worksheet.mergeCells(`${fromCell}:${toCell}`);
  const cell = worksheet.getCell(fromCell);
  cell.value = text;
  styleSectionCell(cell, colour);
}

function styleActionCell(cell: ExcelJS.Cell, action: string, log?: MoneyAuditLog) {
  cell.font = {
    bold: true,
    color: { argb: "FFFFFFFF" },
  };

  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: actionExcelColour(action, log) },
  };

  cell.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };
}

function styleMutedCell(cell: ExcelJS.Cell) {
  cell.font = {
    color: { argb: "FF6B7280" },
  };
}

function styleSuccessCell(cell: ExcelJS.Cell) {
  cell.font = {
    bold: true,
    color: { argb: "FF166534" },
  };

  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFDCFCE7" },
  };
}

function styleDangerCell(cell: ExcelJS.Cell) {
  cell.font = {
    bold: true,
    color: { argb: "FF991B1B" },
  };

  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFEE2E2" },
  };
}

function makeSummaryRows(logs: MoneyAuditLog[]) {
  const hidden = logs.filter((log) => isHiddenAuditLog(log)).length;
  const deleted = logs.filter(
    (log) =>
      !isHiddenAuditLog(log) &&
      (log.action === "delete" ||
        log.action === "delete_year" ||
        log.action === "delete_all")
  ).length;

  return [
    {
      label: "Total logs",
      value: logs.length,
      notes: "Total audit logs in this export.",
    },
    {
      label: "Created",
      value: logs.filter((log) => log.action === "create").length,
      notes: "Transactions or records created.",
    },
    {
      label: "Edited",
      value: logs.filter((log) => log.action === "edit").length,
      notes: "Transactions or records edited.",
    },
    {
      label: "Hidden",
      value: hidden,
      notes: "Single money tracker transactions soft-deleted and hidden.",
    },
    {
      label: "Deleted",
      value: deleted,
      notes: "Permanent, selected-year, or full delete actions.",
    },
    {
      label: "Restored",
      value: logs.filter((log) => log.action === "restore").length,
      notes: "Restored transaction records.",
    },
    {
      label: "Paid back changes",
      value: logs.filter(
        (log) =>
          log.action === "mark_paid_back" ||
          log.action === "mark_not_paid_back"
      ).length,
      notes: "Personal funds repayment status changes.",
    },
    {
      label: "Unique users",
      value: new Set(
        logs
          .map((log) => log.actor_email || log.actor_user_id || getActorDisplayName(log))
          .filter(Boolean)
      ).size,
      notes: "Unique actors based on email, user ID, or display name.",
    },
  ];
}

export default function MoneyAuditLogsPage() {
  const [logs, setLogs] = useState<MoneyAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAction, setSelectedAction] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedLog, setSelectedLog] = useState<MoneyAuditLog | null>(null);
  const [copied, setCopied] = useState(false);
  const [showRawData, setShowRawData] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [errorDetails, setErrorDetails] = useState<any>(null);

  async function loadLogs() {
    try {
      setLoading(true);
      setError("");
      setErrorDetails(null);

      const params = new URLSearchParams();
      params.set("limit", "500");

      if (selectedAction !== "all") {
        params.set("action", selectedAction);
      }

      const res = await fetch(`/api/admin/money/audit-logs?${params.toString()}`, {
        cache: "no-store",
      });

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

      setLogs(data.logs || []);
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
      setErrorDetails(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAction]);

  const filteredLogs = useMemo(() => {
    let rows = [...logs];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();

      rows = rows.filter((log) => {
        return (
          log.action?.toLowerCase().includes(q) ||
          actionLabel(log.action, log).toLowerCase().includes(q) ||
          getTransactionTitle(log).toLowerCase().includes(q) ||
          log.transaction_id?.toLowerCase().includes(q) ||
          getActorDisplayName(log).toLowerCase().includes(q) ||
          log.actor_email?.toLowerCase().includes(q) ||
          JSON.stringify(log.changed_fields || {}).toLowerCase().includes(q) ||
          JSON.stringify(log.metadata || {}).toLowerCase().includes(q) ||
          JSON.stringify(log.before_data || {}).toLowerCase().includes(q) ||
          JSON.stringify(log.after_data || {}).toLowerCase().includes(q)
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
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }

      if (sortMode === "oldest") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }

      if (sortMode === "action") {
        return actionLabel(a.action, a).localeCompare(actionLabel(b.action, b));
      }

      if (sortMode === "transaction") {
        return getTransactionTitle(a).localeCompare(getTransactionTitle(b));
      }

      return 0;
    });

    return rows;
  }, [logs, searchTerm, dateFrom, dateTo, sortMode]);

  const stats = useMemo(() => {
    const hidden = logs.filter((log) => isHiddenAuditLog(log)).length;

    const deleted = logs.filter(
      (log) =>
        !isHiddenAuditLog(log) &&
        (log.action === "delete" ||
          log.action === "delete_year" ||
          log.action === "delete_all")
    ).length;

    return {
      total: logs.length,
      visible: filteredLogs.length,
      created: logs.filter((log) => log.action === "create").length,
      edited: logs.filter((log) => log.action === "edit").length,
      hidden,
      deleted,
      restored: logs.filter((log) => log.action === "restore").length,
      paidBack: logs.filter(
        (log) =>
          log.action === "mark_paid_back" ||
          log.action === "mark_not_paid_back"
      ).length,
      uniqueUsers: new Set(
        logs
          .map((log) => log.actor_email || log.actor_user_id || getActorDisplayName(log))
          .filter(Boolean)
      ).size,
    };
  }, [logs, filteredLogs.length]);

  const latestLog = filteredLogs[0] || null;

  function clearFilters() {
    setSearchTerm("");
    setSelectedAction("all");
    setDateFrom("");
    setDateTo("");
    setSortMode("newest");
  }

  async function exportFormattedExcel() {
    try {
      setExporting(true);
      setError("");
      setErrorDetails(null);

      const workbook = new ExcelJS.Workbook();
      const now = new Date();
      const fileDate = now.toISOString().slice(0, 10);

      workbook.creator = "Burton Pride C.I.C";
      workbook.created = now;
      workbook.modified = now;
      workbook.subject = "Money audit logs";
      workbook.title = "Burton Pride Money Audit Logs";
      workbook.company = "Burton Pride C.I.C";

      const summarySheet = workbook.addWorksheet("Summary", {
        views: [{ state: "frozen", ySplit: 6 }],
        pageSetup: {
          paperSize: 9,
          orientation: "landscape",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
        },
      });

      summarySheet.properties.defaultRowHeight = 22;
      summarySheet.columns = [
        { key: "label", width: 32 },
        { key: "value", width: 18 },
        { key: "notes", width: 78 },
      ];

      addMergedTitle(summarySheet, "Burton Pride C.I.C - Money Audit Logs", "A1", "C1");
      addMergedSubtitle(
        summarySheet,
        `Formatted Excel report generated ${now.toLocaleString("en-GB")} | Showing ${filteredLogs.length} of ${logs.length} loaded logs`,
        "A2",
        "C2"
      );

      summarySheet.addRow([]);
      addMergedSection(summarySheet, "Export Summary", "A4", "C4", "FF7C3AED");

      const summaryHeader = summarySheet.addRow(["Item", "Value", "Notes"]);
      styleHeaderRow(summaryHeader, "FF111827");

      makeSummaryRows(filteredLogs).forEach((item) => {
        const row = summarySheet.addRow([item.label, item.value, item.notes]);
        styleBodyRow(row);
        row.getCell(1).font = { bold: true };
        row.getCell(2).font = { bold: true, color: { argb: "FF111827" } };
        row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
      });

      summarySheet.addRow([]);
      addMergedSection(summarySheet, "Filters Used", "A15", "C15", "FF4F46E5");

      const filterHeader = summarySheet.addRow(["Filter", "Value", "Notes"]);
      styleHeaderRow(filterHeader, "FF111827");

      const filterRows = [
        ["Action", selectedAction === "all" ? "All actions" : actionOptions.find((item) => item.value === selectedAction)?.label || actionLabel(selectedAction), "Action filter selected on page."],
        ["Search", searchTerm || "No search", "Text search applied before export."],
        ["Date from", dateFrom || "No start date", "Start date filter."],
        ["Date to", dateTo || "No end date", "End date filter."],
        ["Sort", sortMode, "Sort mode applied before export."],
      ];

      filterRows.forEach((item) => {
        const row = summarySheet.addRow(item);
        styleBodyRow(row);
        row.getCell(1).font = { bold: true };
      });

      summarySheet.addRow([]);
      addMergedSection(summarySheet, "Action Breakdown", "A23", "C23", "FF9333EA");

      const actionBreakdownHeader = summarySheet.addRow(["Action", "Count", "Notes"]);
      styleHeaderRow(actionBreakdownHeader, "FF111827");

      const actionBreakdownRows = [
        {
          label: "Created",
          count: filteredLogs.filter((log) => log.action === "create").length,
          notes: "Count of created audit logs.",
        },
        {
          label: "Edited",
          count: filteredLogs.filter((log) => log.action === "edit").length,
          notes: "Count of edited audit logs.",
        },
        {
          label: "Hidden",
          count: filteredLogs.filter((log) => isHiddenAuditLog(log)).length,
          notes: "Count of hidden soft-delete audit logs.",
        },
        {
          label: "Deleted Year",
          count: filteredLogs.filter((log) => log.action === "delete_year").length,
          notes: "Count of selected-year delete audit logs.",
        },
        {
          label: "Deleted All",
          count: filteredLogs.filter((log) => log.action === "delete_all").length,
          notes: "Count of delete-all audit logs.",
        },
        {
          label: "Restored",
          count: filteredLogs.filter((log) => log.action === "restore").length,
          notes: "Count of restored audit logs.",
        },
        {
          label: "Marked Paid Back",
          count: filteredLogs.filter((log) => log.action === "mark_paid_back").length,
          notes: "Count of marked paid back logs.",
        },
        {
          label: "Marked Not Paid Back",
          count: filteredLogs.filter((log) => log.action === "mark_not_paid_back").length,
          notes: "Count of marked not paid back logs.",
        },
      ];

      actionBreakdownRows.forEach((item) => {
        const row = summarySheet.addRow([
          item.label,
          item.count,
          item.notes,
        ]);
        styleBodyRow(row);
        row.getCell(1).font = { bold: true };
        row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
        row.getCell(2).font = { bold: true };
      });

      const logsSheet = workbook.addWorksheet("Audit Logs", {
        views: [{ state: "frozen", ySplit: 5 }],
        pageSetup: {
          paperSize: 9,
          orientation: "landscape",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
        },
      });

      logsSheet.properties.defaultRowHeight = 28;

      logsSheet.columns = [
        { key: "createdAt", width: 22 },
        { key: "action", width: 22 },
        { key: "transactionTitle", width: 34 },
        { key: "transactionId", width: 38 },
        { key: "actorName", width: 26 },
        { key: "actorEmail", width: 34 },
        { key: "actorUserId", width: 34 },
        { key: "changedFields", width: 46 },
        { key: "changedCount", width: 14 },
        { key: "source", width: 22 },
        { key: "route", width: 44 },
        { key: "logId", width: 38 },
      ];

      addMergedTitle(logsSheet, "Burton Pride C.I.C - Audit Logs", "A1", "L1");
      addMergedSubtitle(
        logsSheet,
        `Formatted export | Generated ${now.toLocaleString("en-GB")} | Rows: ${filteredLogs.length}`,
        "A2",
        "L2"
      );

      logsSheet.addRow([]);

      const auditHeader = logsSheet.addRow([
        "When",
        "Action",
        "Transaction",
        "Transaction ID",
        "Who",
        "Email",
        "User ID",
        "Changed Fields",
        "Changed Count",
        "Source",
        "Route",
        "Log ID",
      ]);

      styleHeaderRow(auditHeader, "FF111827");

      if (filteredLogs.length === 0) {
        const emptyRow = logsSheet.addRow(["No audit logs found for the current filters."]);
        styleBodyRow(emptyRow);
      } else {
        filteredLogs.forEach((log) => {
          const changedNames = getChangedFieldNames(log.changed_fields);
          const row = logsSheet.addRow({
            createdAt: formatExcelDate(log.created_at),
            action: actionLabel(log.action, log),
            transactionTitle: getTransactionTitle(log),
            transactionId: log.transaction_id || "",
            actorName: getActorDisplayName(log),
            actorEmail: log.actor_email || "",
            actorUserId: log.actor_user_id || "",
            changedFields: changedNames.map(cleanFieldName).join(", "),
            changedCount: changedNames.length,
            source: getSourceLabel(log),
            route: log.metadata?.route || "",
            logId: log.id,
          });

          styleBodyRow(row);

          row.getCell("createdAt").numFmt = "dd mmm yyyy, hh:mm";
          styleActionCell(row.getCell("action"), log.action, log);

          row.getCell("transactionTitle").font = { bold: true };
          row.getCell("actorName").font = { bold: true };
          row.getCell("changedCount").alignment = {
            horizontal: "center",
            vertical: "middle",
          };
          row.getCell("changedCount").font = { bold: true };

          if (!log.actor_email) styleMutedCell(row.getCell("actorEmail"));
          if (!log.actor_user_id) styleMutedCell(row.getCell("actorUserId"));
          if (changedNames.length === 0) styleMutedCell(row.getCell("changedFields"));
        });
      }

      logsSheet.autoFilter = {
        from: "A4",
        to: "L4",
      };

      const changedSheet = workbook.addWorksheet("Changed Fields", {
        views: [{ state: "frozen", ySplit: 5 }],
        pageSetup: {
          paperSize: 9,
          orientation: "landscape",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
        },
      });

      changedSheet.properties.defaultRowHeight = 32;

      changedSheet.columns = [
        { key: "createdAt", width: 22 },
        { key: "action", width: 22 },
        { key: "transactionTitle", width: 34 },
        { key: "actorName", width: 26 },
        { key: "field", width: 26 },
        { key: "before", width: 55 },
        { key: "after", width: 55 },
        { key: "logId", width: 38 },
      ];

      addMergedTitle(changedSheet, "Burton Pride C.I.C - Changed Fields", "A1", "H1");
      addMergedSubtitle(
        changedSheet,
        "One row per changed field, with before and after values.",
        "A2",
        "H2"
      );

      changedSheet.addRow([]);

      const changedHeader = changedSheet.addRow([
        "When",
        "Action",
        "Transaction",
        "Who",
        "Field",
        "Before",
        "After",
        "Log ID",
      ]);

      styleHeaderRow(changedHeader, "FF111827");

      let changedFieldRowCount = 0;

      filteredLogs.forEach((log) => {
        const changed = log.changed_fields || {};
        const entries = Object.entries(changed);

        entries.forEach(([field, value]: [string, any]) => {
          changedFieldRowCount += 1;

          const row = changedSheet.addRow({
            createdAt: formatExcelDate(log.created_at),
            action: actionLabel(log.action, log),
            transactionTitle: getTransactionTitle(log),
            actorName: getActorDisplayName(log),
            field: cleanFieldName(field),
            before: shortValue(value?.before),
            after: shortValue(value?.after),
            logId: log.id,
          });

          styleBodyRow(row);
          row.getCell("createdAt").numFmt = "dd mmm yyyy, hh:mm";
          styleActionCell(row.getCell("action"), log.action, log);
          row.getCell("transactionTitle").font = { bold: true };
          row.getCell("actorName").font = { bold: true };
          row.getCell("field").font = { bold: true };
          styleDangerCell(row.getCell("before"));
          styleSuccessCell(row.getCell("after"));
        });
      });

      if (changedFieldRowCount === 0) {
        const emptyRow = changedSheet.addRow(["No changed field rows found for the current filters."]);
        styleBodyRow(emptyRow);
      }

      changedSheet.autoFilter = {
        from: "A4",
        to: "H4",
      };

      const usersSheet = workbook.addWorksheet("Users", {
        views: [{ state: "frozen", ySplit: 5 }],
        pageSetup: {
          paperSize: 9,
          orientation: "landscape",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
        },
      });

      usersSheet.properties.defaultRowHeight = 24;

      usersSheet.columns = [
        { key: "name", width: 30 },
        { key: "email", width: 36 },
        { key: "userId", width: 40 },
        { key: "total", width: 14 },
        { key: "created", width: 14 },
        { key: "edited", width: 14 },
        { key: "hidden", width: 14 },
        { key: "deleted", width: 14 },
        { key: "paidBack", width: 18 },
        { key: "latest", width: 24 },
      ];

      addMergedTitle(usersSheet, "Burton Pride C.I.C - Audit Users", "A1", "J1");
      addMergedSubtitle(
        usersSheet,
        "Summary by user / actor.",
        "A2",
        "J2"
      );

      usersSheet.addRow([]);

      const usersHeader = usersSheet.addRow([
        "Name",
        "Email",
        "User ID",
        "Total Actions",
        "Created",
        "Edited",
        "Hidden",
        "Deleted",
        "Paid Back Changes",
        "Latest Action",
      ]);

      styleHeaderRow(usersHeader, "FF111827");

      const userMap = new Map<
        string,
        {
          name: string;
          email: string;
          userId: string;
          logs: MoneyAuditLog[];
        }
      >();

      filteredLogs.forEach((log) => {
        const key =
          log.actor_email ||
          log.actor_user_id ||
          getActorDisplayName(log) ||
          "Unknown user";

        const existing = userMap.get(key);

        if (existing) {
          existing.logs.push(log);
        } else {
          userMap.set(key, {
            name: getActorDisplayName(log),
            email: log.actor_email || "",
            userId: log.actor_user_id || "",
            logs: [log],
          });
        }
      });

      Array.from(userMap.values())
        .sort((a, b) => b.logs.length - a.logs.length)
        .forEach((user) => {
          const userLogs = user.logs;
          const latest = [...userLogs].sort(
            (a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0];

          const row = usersSheet.addRow({
            name: user.name,
            email: user.email,
            userId: user.userId,
            total: userLogs.length,
            created: userLogs.filter((log) => log.action === "create").length,
            edited: userLogs.filter((log) => log.action === "edit").length,
            hidden: userLogs.filter((log) => isHiddenAuditLog(log)).length,
            deleted: userLogs.filter(
              (log) =>
                !isHiddenAuditLog(log) &&
                (log.action === "delete" ||
                  log.action === "delete_year" ||
                  log.action === "delete_all")
            ).length,
            paidBack: userLogs.filter(
              (log) =>
                log.action === "mark_paid_back" ||
                log.action === "mark_not_paid_back"
            ).length,
            latest: formatExcelDate(latest?.created_at),
          });

          styleBodyRow(row);
          row.getCell("name").font = { bold: true };
          row.getCell("latest").numFmt = "dd mmm yyyy, hh:mm";

          ["total", "created", "edited", "hidden", "deleted", "paidBack"].forEach((key) => {
            row.getCell(key).alignment = {
              horizontal: "center",
              vertical: "middle",
            };
            row.getCell(key).font = { bold: true };
          });
        });

      usersSheet.autoFilter = {
        from: "A4",
        to: "J4",
      };

      const rawSheet = workbook.addWorksheet("Raw JSON", {
        views: [{ state: "frozen", ySplit: 5 }],
        pageSetup: {
          paperSize: 9,
          orientation: "landscape",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
        },
      });

      rawSheet.properties.defaultRowHeight = 45;

      rawSheet.columns = [
        { key: "createdAt", width: 22 },
        { key: "action", width: 22 },
        { key: "transactionTitle", width: 34 },
        { key: "actorName", width: 26 },
        { key: "beforeData", width: 70 },
        { key: "afterData", width: 70 },
        { key: "changedFields", width: 70 },
        { key: "metadata", width: 70 },
        { key: "logId", width: 38 },
      ];

      addMergedTitle(rawSheet, "Burton Pride C.I.C - Audit Raw JSON", "A1", "I1");
      addMergedSubtitle(
        rawSheet,
        "Full raw audit log data for checking details.",
        "A2",
        "I2"
      );

      rawSheet.addRow([]);

      const rawHeader = rawSheet.addRow([
        "When",
        "Action",
        "Transaction",
        "Who",
        "Before Data",
        "After Data",
        "Changed Fields",
        "Metadata",
        "Log ID",
      ]);

      styleHeaderRow(rawHeader, "FF111827");

      filteredLogs.forEach((log) => {
        const row = rawSheet.addRow({
          createdAt: formatExcelDate(log.created_at),
          action: actionLabel(log.action, log),
          transactionTitle: getTransactionTitle(log),
          actorName: getActorDisplayName(log),
          beforeData: safeJson(log.before_data),
          afterData: safeJson(log.after_data),
          changedFields: safeJson(log.changed_fields),
          metadata: safeJson(log.metadata),
          logId: log.id,
        });

        styleBodyRow(row);
        row.getCell("createdAt").numFmt = "dd mmm yyyy, hh:mm";
        styleActionCell(row.getCell("action"), log.action, log);
        row.getCell("transactionTitle").font = { bold: true };
        row.getCell("actorName").font = { bold: true };
      });

      rawSheet.autoFilter = {
        from: "A4",
        to: "I4",
      };

      [summarySheet, logsSheet, changedSheet, usersSheet, rawSheet].forEach((sheet) => {
        sheet.eachRow((row) => {
          row.eachCell((cell) => {
            cell.alignment = {
              ...cell.alignment,
              vertical: cell.alignment?.vertical || "top",
              wrapText: true,
            };
          });
        });
      });

      await downloadWorkbook(
        workbook,
        `burton-pride-money-audit-logs-${fileDate}.xlsx`
      );
    } catch (err: any) {
      setError(err?.message || "Failed to export formatted Excel file");
      setErrorDetails(err);
    } finally {
      setExporting(false);
    }
  }

  async function copySelectedLog() {
    if (!selectedLog) return;

    await copyToClipboard(JSON.stringify(selectedLog, null, 2));
    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 1600);
  }

  return (
    <main className="min-h-screen w-full overflow-x-auto bg-[#070716] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1700px] min-w-0 space-y-6">
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur">
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
                  View every money tracker action, including creates, edits,
                  hidden soft-deleted transactions, selected-year deletes, delete
                  all actions, and personal funds paid-back changes.
                </p>

                {latestLog && (
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-white/50">
                    <Clock3 className="h-4 w-4" />
                    Latest visible log:{" "}
                    <span className="font-bold text-white">
                      {formatDateTime(latestLog.created_at)}
                    </span>
                    <span className="text-white/30">•</span>
                    <span>{actionLabel(latestLog.action, latestLog)}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={exportFormattedExcel}
                  disabled={filteredLogs.length === 0 || exporting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500/15 px-4 py-3 text-sm font-bold text-emerald-200 ring-1 ring-emerald-300/20 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  {exporting ? "Exporting..." : "Export Excel"}
                </button>

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

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
          <StatCard label="Total Logs" value={stats.total} tone="white" />
          <StatCard label="Showing" value={stats.visible} tone="purple" />
          <StatCard label="Created" value={stats.created} tone="emerald" />
          <StatCard label="Edited" value={stats.edited} tone="sky" />
          <StatCard label="Hidden" value={stats.hidden} tone="orange" />
          <StatCard label="Deleted" value={stats.deleted} tone="red" />
          <StatCard label="Paid Back" value={stats.paidBack} tone="pink" />
          <StatCard label="Users" value={stats.uniqueUsers} tone="white" />
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-4 flex flex-col gap-3 2xl:flex-row 2xl:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />

              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by transaction, user, email, action, changed field, route, or raw data..."
                className="w-full rounded-2xl bg-black/30 py-3 pl-11 pr-4 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/40 focus:ring-purple-300/40"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:w-[860px]">
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
                  Sort by transaction
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
            </div>
          </div>

          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
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
              onClick={clearFilters}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white/75 ring-1 ring-white/10 hover:bg-white/20"
            >
              <X className="h-4 w-4" />
              Clear filters
            </button>
          </div>

          <div className="mb-4 rounded-2xl bg-black/20 px-4 py-3 text-sm text-white/60">
            Showing <strong className="text-white">{filteredLogs.length}</strong>{" "}
            audit log{filteredLogs.length === 1 ? "" : "s"} from{" "}
            <strong className="text-white">{logs.length}</strong> loaded.
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
              <div className="hidden max-w-full overflow-x-auto overflow-y-hidden rounded-2xl border border-white/10 xl:block">
                <table className="w-full min-w-[1250px] text-sm">
                  <thead className="bg-white/10 text-white/60">
                    <tr>
                      <th className="p-3 text-left">When</th>
                      <th className="p-3 text-left">Action</th>
                      <th className="p-3 text-left">Transaction</th>
                      <th className="p-3 text-left">Who</th>
                      <th className="p-3 text-left">Changed Fields</th>
                      <th className="p-3 text-left">Source</th>
                      <th className="sticky right-0 bg-[#242435] p-3 text-right backdrop-blur">
                        View
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredLogs.map((log) => {
                      const changedNames = getChangedFieldNames(log.changed_fields);
                      const source = getSourceLabel(log);
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
                                log
                              )}`}
                            >
                              <ActionIcon className="h-3.5 w-3.5" />
                              {actionLabel(log.action, log)}
                            </span>
                          </td>

                          <td className="max-w-[280px] p-3">
                            <p className="break-words font-bold text-white">
                              {getTransactionTitle(log)}
                            </p>

                            {log.transaction_id && (
                              <p className="mt-1 break-all text-xs text-white/35">
                                {log.transaction_id}
                              </p>
                            )}
                          </td>

                          <td className="max-w-[260px] p-3">
                            <p className="flex items-center gap-2 break-words font-semibold text-white/90">
                              <UserRound className="h-4 w-4 text-white/35" />
                              {getActorDisplayName(log)}
                            </p>

                            {log.actor_email && (
                              <p className="mt-1 flex items-center gap-2 break-words text-xs text-white/45">
                                <Mail className="h-3.5 w-3.5 text-white/30" />
                                {log.actor_email}
                              </p>
                            )}
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
                {filteredLogs.map((log) => {
                  const ActionIcon = actionIcon(log.action, log);
                  const changedNames = getChangedFieldNames(log.changed_fields);

                  return (
                    <article
                      key={log.id}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <span
                          className={`inline-flex items-center gap-2 rounded-2xl px-3 py-1 text-xs font-bold ring-1 ${actionClass(
                            log.action,
                            log
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
                        {getTransactionTitle(log)}
                      </h3>

                      <p className="mt-1 text-xs text-white/45">
                        {formatDateTime(log.created_at)}
                      </p>

                      <div className="mt-3 rounded-xl bg-white/5 p-3">
                        <p className="text-sm font-bold">
                          {getActorDisplayName(log)}
                        </p>
                        <p className="mt-1 break-words text-xs text-white/45">
                          {log.actor_email || "No email saved"}
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
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>

      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-7xl overflow-hidden rounded-3xl border border-white/10 bg-[#070716] text-white shadow-2xl">
            <div className="border-b border-white/10 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div
                    className={`mb-3 inline-flex items-center gap-2 rounded-2xl px-3 py-1 text-xs font-bold ring-1 ${actionClass(
                      selectedLog.action,
                      selectedLog
                    )}`}
                  >
                    {(() => {
                      const Icon = actionIcon(selectedLog.action, selectedLog);
                      return <Icon className="h-3.5 w-3.5" />;
                    })()}
                    {actionLabel(selectedLog.action, selectedLog)}
                  </div>

                  <h2 className="break-words text-2xl font-black">
                    {getTransactionTitle(selectedLog)}
                  </h2>

                  <p className="mt-1 text-sm text-white/50">
                    {formatDateTime(selectedLog.created_at)}
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={copySelectedLog}
                    className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white/80 hover:bg-white/20"
                  >
                    <Clipboard className="h-4 w-4" />
                    {copied ? "Copied" : "Copy JSON"}
                  </button>

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
              <div className="grid gap-4 lg:grid-cols-3">
                <InfoCard
                  label="Who did it"
                  title={getActorDisplayName(selectedLog)}
                  subtitle={selectedLog.actor_email || "No email saved"}
                  extra={selectedLog.actor_user_id || ""}
                  icon={<UserRound className="h-5 w-5" />}
                />

                <InfoCard
                  label="Transaction"
                  title={getTransactionTitle(selectedLog)}
                  subtitle={selectedLog.transaction_id || "No transaction ID"}
                  icon={<FileText className="h-5 w-5" />}
                />

                <InfoCard
                  label="Source"
                  title={getSourceLabel(selectedLog)}
                  subtitle={selectedLog.metadata?.route || "No route saved"}
                  icon={<Activity className="h-5 w-5" />}
                />
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-sky-200" />
                    <h3 className="font-bold">Changed Fields</h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowRawData((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white/75 hover:bg-white/20"
                  >
                    <ChevronDown className="h-4 w-4" />
                    {showRawData ? "Hide raw data" : "Show raw data"}
                  </button>
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
                            <tr key={field} className="border-t border-white/10">
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
                          )
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

              {showRawData && (
                <>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <RawDataCard title="Before Data" data={selectedLog.before_data} />
                    <RawDataCard title="After Data" data={selectedLog.after_data} />
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

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "white" | "purple" | "emerald" | "sky" | "red" | "orange" | "pink";
}) {
  const classes = {
    white: "bg-white/[0.04] ring-white/10 text-white",
    purple: "bg-purple-500/10 ring-purple-300/10 text-purple-100",
    emerald: "bg-emerald-500/10 ring-emerald-300/10 text-emerald-100",
    sky: "bg-sky-500/10 ring-sky-300/10 text-sky-100",
    red: "bg-red-500/10 ring-red-300/10 text-red-100",
    orange: "bg-orange-500/10 ring-orange-300/10 text-orange-100",
    pink: "bg-pink-500/10 ring-pink-300/10 text-pink-100",
  };

  return (
    <div className={`rounded-3xl p-5 ring-1 ${classes[tone]}`}>
      <p className="text-sm opacity-75">{label}</p>
      <p className="mt-1 text-3xl font-black">{value}</p>
    </div>
  );
}

function InfoCard({
  label,
  title,
  subtitle,
  extra,
  icon,
}: {
  label: string;
  title: string;
  subtitle?: string;
  extra?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-3 flex items-center gap-2 text-white/40">
        {icon}
        <p className="text-xs font-bold uppercase tracking-wide">{label}</p>
      </div>

      <p className="break-words text-lg font-bold">{title || "—"}</p>

      {subtitle && (
        <p className="mt-1 break-words text-sm text-white/50">{subtitle}</p>
      )}

      {extra && <p className="mt-3 break-all text-xs text-white/35">{extra}</p>}
    </div>
  );
}

function RawDataCard({
  title,
  data,
  className = "",
}: {
  title: string;
  data: any;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-black/20 p-4 ${className}`}>
      <h3 className="mb-3 font-bold">{title}</h3>

      <pre className="max-h-96 overflow-auto rounded-xl bg-black/40 p-4 text-xs text-white/70">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}