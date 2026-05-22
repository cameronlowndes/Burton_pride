"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import ExcelJS from "exceljs";
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
  RefreshCcw,
  RotateCcw,
  Search,
  ShieldCheck,
  Target,
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
  created_by?: string | null;
  created_by_email?: string | null;
  created_by_user_id?: string | null;
  before_data: any;
  after_data: any;
  changed_fields: any;
  metadata: any;
};

type SortMode = "newest" | "oldest" | "action" | "transaction";
type YearFilter = "all" | string;
type RiskFilter = "all" | "High" | "Medium" | "Low";
type AreaFilter = "all" | string;

const actionOptions = [
  { value: "all", label: "All actions" },
  { value: "create", label: "Created" },
  { value: "edit", label: "Edited" },
  { value: "checked", label: "Checked" },
  { value: "unchecked", label: "Unchecked" },
  { value: "delete", label: "Hidden / deleted" },
  { value: "delete_year", label: "Deleted year" },
  { value: "delete_all", label: "Deleted all" },
  { value: "restore", label: "Restored" },
  { value: "budget_update", label: "Budget updated" },
  { value: "budget_item_soft_delete", label: "Budget item soft deleted" },
  { value: "budget_item_delete", label: "Budget item deleted" },
  { value: "budget_item_restore", label: "Budget item restored" },
  { value: "saving_target_create", label: "Saving target created" },
  { value: "saving_target_update", label: "Saving target updated" },
  { value: "saving_target_soft_delete", label: "Saving target soft deleted" },
  { value: "saving_target_delete", label: "Saving target deleted" },
  { value: "saving_target_restore", label: "Saving target restored" },
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

function getYearOnly(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return String(date.getFullYear());
}

function isHiddenAuditLog(log: MoneyAuditLog) {
  const action = String(log.action || "")
    .toLowerCase()
    .trim();

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
    source === "money_tracker" || isMoneyTransactionRoute || hasSoftDeleteFlag
  );
}

function isUncheckedAuditLog(log: MoneyAuditLog) {
  const action = String(log.action || "")
    .toLowerCase()
    .trim();

  if (action !== "edit") return false;

  const auditEvent = String(log.metadata?.audit_event || "").toLowerCase().trim();
  const route = String(log.metadata?.route || "").toLowerCase();
  const changedFields = log.changed_fields || {};

  const checkedAtChange = changedFields.checked_at;
  const checkedByChange = changedFields.checked_by;
  const afterCheckedAt = checkedAtChange?.after;
  const beforeCheckedAt = checkedAtChange?.before;

  const hasCheckedRoute =
    route.includes("/checked") ||
    route.includes("/check") ||
    route.includes("checked");

  const hasUncheckedMetadata =
    auditEvent === "unchecked" ||
    auditEvent === "uncheck" ||
    log.metadata?.unchecked === true ||
    Boolean(log.metadata?.unchecked_at);

  const hasUncheckedFields =
    Object.prototype.hasOwnProperty.call(changedFields, "checked_at") &&
    Boolean(beforeCheckedAt) &&
    (afterCheckedAt === null || afterCheckedAt === undefined || afterCheckedAt === "");

  const hasClearedCheckedBy =
    Object.prototype.hasOwnProperty.call(changedFields, "checked_by") &&
    Boolean(checkedByChange?.before) &&
    (checkedByChange?.after === null ||
      checkedByChange?.after === undefined ||
      checkedByChange?.after === "");

  return hasUncheckedMetadata || (hasCheckedRoute && (hasUncheckedFields || hasClearedCheckedBy));
}

function isCheckedAuditLog(log: MoneyAuditLog) {
  const action = String(log.action || "")
    .toLowerCase()
    .trim();

  if (action !== "edit") return false;
  if (isUncheckedAuditLog(log)) return false;

  const auditEvent = String(log.metadata?.audit_event || "").toLowerCase().trim();
  const metadataAction = String(log.metadata?.action || "").toLowerCase();
  const route = String(log.metadata?.route || "").toLowerCase();
  const changedFields = log.changed_fields || {};

  const checkedAtChange = changedFields.checked_at;
  const afterCheckedAt = checkedAtChange?.after;

  const hasCheckedRoute =
    route.includes("/checked") ||
    route.includes("/check") ||
    route.includes("checked");

  const hasCheckedMetadata =
    auditEvent === "checked" ||
    metadataAction.includes("checked") ||
    log.metadata?.checked === true ||
    log.metadata?.mark_checked === true ||
    Boolean(log.metadata?.checked_at);

  const hasCheckedFields =
    (Object.prototype.hasOwnProperty.call(changedFields, "checked_at") &&
      Boolean(afterCheckedAt)) ||
    (Object.prototype.hasOwnProperty.call(changedFields, "checked_by") &&
      Boolean(changedFields.checked_by?.after)) ||
    (Object.prototype.hasOwnProperty.call(changedFields, "checked") &&
      Boolean(changedFields.checked?.after)) ||
    Boolean(log.after_data?.checked_at) ||
    Boolean(log.after_data?.checked_by);

  return hasCheckedMetadata || (hasCheckedRoute && hasCheckedFields);
}


function isSavingTargetAuditLog(log: MoneyAuditLog) {
  const action = normaliseText(log.action);
  const area = normaliseText(log.metadata?.area);
  const source = normaliseText(log.metadata?.source);
  const title = normaliseText(getTransactionTitle(log));

  return (
    action.startsWith("saving_target") ||
    area.includes("saving") ||
    source.includes("saving_targets") ||
    source.includes("saving target") ||
    title.includes("saving target")
  );
}

function isBudgetPlanningAuditLog(log: MoneyAuditLog) {
  const action = normaliseText(log.action);
  const area = normaliseText(log.metadata?.area);
  const source = normaliseText(log.metadata?.source);
  const route = normaliseText(log.metadata?.route);
  const title = normaliseText(getTransactionTitle(log));

  return (
    action.startsWith("budget") ||
    area.includes("budget") ||
    source.includes("budget") ||
    route.includes("budget") ||
    title.includes("budget planning") ||
    title.includes("budget item")
  );
}

function isDeletedAreaAuditLog(log: MoneyAuditLog) {
  const area = normaliseText(log.metadata?.area);
  const source = normaliseText(log.metadata?.source);
  const route = normaliseText(log.metadata?.route);

  return (
    area.includes("deleted_items") ||
    source.includes("deleted_items") ||
    route.includes("deleted-items")
  );
}

function getAuditArea(log: MoneyAuditLog) {
  if (isSavingTargetAuditLog(log)) return "Saving Targets";
  if (isBudgetPlanningAuditLog(log)) return "Budget Planning";
  if (isDeletedAreaAuditLog(log)) return "Deleted Area";
  if (isWebsiteGeneratedLog(log)) return "Website / Stripe";
  if (normaliseText(log.metadata?.area)) {
    return String(log.metadata.area).replaceAll("_", " ");
  }
  if (normaliseText(log.metadata?.source)) {
    return String(log.metadata.source).replaceAll("_", " ");
  }
  return "Money Tracker";
}

function getRiskLevel(log: MoneyAuditLog) {
  const action = normaliseText(log.action);

  if (
    action.includes("delete_all") ||
    action.includes("delete_year") ||
    action.includes("soft_delete") ||
    action.includes("delete")
  ) {
    return "High";
  }

  if (
    action.includes("restore") ||
    action.includes("budget") ||
    action.includes("saving_target") ||
    action.includes("mark_paid_back") ||
    action.includes("mark_not_paid_back")
  ) {
    return "Medium";
  }

  if (isCheckedAuditLog(log) || isUncheckedAuditLog(log)) {
    return "Medium";
  }

  return "Low";
}

function riskClass(level: string) {
  if (level === "High") return "bg-red-500/15 text-red-100 ring-red-300/20";
  if (level === "Medium") return "bg-amber-500/15 text-amber-100 ring-amber-300/20";
  return "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20";
}

function actionLabel(action: string, log?: MoneyAuditLog) {
  if (log && isHiddenAuditLog(log)) return "Hidden";
  if (log && isUncheckedAuditLog(log)) return "Unchecked";
  if (log && isCheckedAuditLog(log)) return "Checked";

  const labels: Record<string, string> = {
    create: "Created",
    edit: "Edited",
    delete: "Deleted",
    delete_year: "Deleted Year",
    delete_all: "Deleted All",
    restore: "Restored",
    budget_update: "Budget Updated",
    budget_item_soft_delete: "Budget Item Hidden",
    budget_item_delete: "Budget Item Hidden",
    budget_item_restore: "Budget Item Restored",
    saving_target_create: "Saving Target Created",
    saving_target_update: "Saving Target Updated",
    saving_target_soft_delete: "Saving Target Hidden",
    saving_target_delete: "Saving Target Deleted",
    saving_target_restore: "Saving Target Restored",
    mark_paid_back: "Marked Paid Back",
    mark_not_paid_back: "Marked Not Paid Back",
  };

  return labels[action] || action.replaceAll("_", " ");
}


function actionClass(action: string, log?: MoneyAuditLog) {
  if (log && isHiddenAuditLog(log)) {
    return "bg-orange-500/15 text-orange-200 ring-orange-300/20";
  }

  if (log && isUncheckedAuditLog(log)) {
    return "bg-amber-500/15 text-amber-100 ring-amber-300/20";
  }

  if (log && isCheckedAuditLog(log)) {
    return "bg-cyan-500/15 text-cyan-100 ring-cyan-300/20";
  }

  if (action.includes("saving_target")) {
    if (action.includes("delete") || action.includes("soft_delete")) {
      return "bg-red-500/15 text-red-100 ring-red-300/20";
    }

    if (action.includes("restore")) {
      return "bg-purple-500/15 text-purple-100 ring-purple-300/20";
    }

    return "bg-sky-500/15 text-sky-100 ring-sky-300/20";
  }

  if (action.includes("budget")) {
    if (action.includes("delete") || action.includes("soft_delete")) {
      return "bg-red-500/15 text-red-100 ring-red-300/20";
    }

    if (action.includes("restore")) {
      return "bg-purple-500/15 text-purple-100 ring-purple-300/20";
    }

    return "bg-indigo-500/15 text-indigo-100 ring-indigo-300/20";
  }

  if (action === "create") {
    return "bg-emerald-500/15 text-emerald-200 ring-emerald-300/20";
  }

  if (action === "edit") {
    return "bg-sky-500/15 text-sky-200 ring-sky-300/20";
  }

  if (
    action === "delete" ||
    action === "delete_year" ||
    action === "delete_all"
  ) {
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
  if (log && isUncheckedAuditLog(log)) return "FFD97706";
  if (log && isCheckedAuditLog(log)) return "FF0891B2";

  if (action.includes("saving_target")) {
    if (action.includes("delete") || action.includes("soft_delete")) return "FFB91C1C";
    if (action.includes("restore")) return "FF7C3AED";
    return "FF0284C7";
  }

  if (action.includes("budget")) {
    if (action.includes("delete") || action.includes("soft_delete")) return "FFB91C1C";
    if (action.includes("restore")) return "FF7C3AED";
    return "FF4F46E5";
  }

  if (action === "create") return "FF047857";
  if (action === "edit") return "FF0284C7";
  if (
    action === "delete" ||
    action === "delete_year" ||
    action === "delete_all"
  ) {
    return "FFB91C1C";
  }
  if (action === "restore") return "FF7C3AED";
  if (action === "mark_paid_back") return "FF059669";
  if (action === "mark_not_paid_back") return "FFEA580C";
  return "FF374151";
}


function actionIcon(action: string, log?: MoneyAuditLog) {
  if (log && isHiddenAuditLog(log)) return Eye;
  if (log && isUncheckedAuditLog(log)) return RotateCcw;
  if (log && isCheckedAuditLog(log)) return ShieldCheck;

  if (action.includes("saving_target")) return Target;
  if (action.includes("budget")) return BarChart3;

  if (action === "create") return CheckCircle2;
  if (action === "edit") return FileText;
  if (
    action === "delete" ||
    action === "delete_year" ||
    action === "delete_all"
  ) {
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

function cleanLogValue(value: unknown) {
  const text = String(value || "").trim();
  return text || "";
}

function normaliseText(value: unknown) {
  return cleanLogValue(value).toLowerCase();
}

function isWebsiteGeneratedLog(log: MoneyAuditLog) {
  const source = normaliseText(log.metadata?.source);
  const route = normaliseText(log.metadata?.route);
  const createdFrom = normaliseText(log.metadata?.created_from);
  const auditEvent = normaliseText(log.metadata?.audit_event);
  const title = normaliseText(getTransactionTitle(log));

  return (
    source.includes("stripe donation sync") ||
    source.includes("stripe_sync") ||
    source.includes("sync_stripe") ||
    source.includes("website donation") ||
    source.includes("website_donation") ||
    source.includes("website_monthly_donation") ||
    source.includes("donation sync") ||
    route.includes("sync-stripe") ||
    route.includes("stripe") ||
    createdFrom.includes("sync-stripe") ||
    auditEvent.includes("stripe") ||
    (log.action === "create" && title.includes("donation"))
  );
}

function getMetadataValue(log: MoneyAuditLog, keys: string[]) {
  for (const key of keys) {
    const value = cleanLogValue(log.metadata?.[key]);

    if (value) return value;
  }

  return "";
}

function getActorDisplayName(log: MoneyAuditLog) {
  if (isWebsiteGeneratedLog(log)) {
    return "Website / Stripe Sync";
  }

  const directName =
    cleanLogValue(log.actor_name) ||
    cleanLogValue(log.created_by) ||
    getMetadataValue(log, [
      "actor_name",
      "created_by",
      "updated_by",
      "createdBy",
      "updatedBy",
      "admin_name",
      "user_name",
    ]);

  const directEmail =
    cleanLogValue(log.actor_email) ||
    cleanLogValue(log.created_by_email) ||
    getMetadataValue(log, [
      "actor_email",
      "created_by_email",
      "updated_by_email",
      "createdByEmail",
      "updatedByEmail",
      "admin_email",
      "user_email",
    ]);

  return directName || nameFromEmail(directEmail) || "Unknown user";
}

function getActorEmailDisplay(log: MoneyAuditLog) {
  if (isWebsiteGeneratedLog(log)) {
    return "Created automatically from the website / Stripe";
  }

  return (
    cleanLogValue(log.actor_email) ||
    cleanLogValue(log.created_by_email) ||
    getMetadataValue(log, [
      "actor_email",
      "created_by_email",
      "updated_by_email",
      "createdByEmail",
      "updatedByEmail",
      "admin_email",
      "user_email",
    ])
  );
}

function getActorUserIdDisplay(log: MoneyAuditLog) {
  if (isWebsiteGeneratedLog(log)) {
    return "website_automated_sync";
  }

  return (
    cleanLogValue(log.actor_user_id) ||
    cleanLogValue(log.created_by_user_id) ||
    getMetadataValue(log, [
      "actor_id",
      "created_by_user_id",
      "updated_by_user_id",
      "user_id",
      "admin_id",
    ])
  );
}

function getActorUniqueKey(log: MoneyAuditLog) {
  return (
    getActorEmailDisplay(log) ||
    getActorUserIdDisplay(log) ||
    getActorDisplayName(log)
  );
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

function styleSectionCell(cell: ExcelJS.Cell, colour = "FF334155") {
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
  toCell: string,
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
  toCell: string,
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
  colour = "FF7C3AED",
) {
  worksheet.mergeCells(`${fromCell}:${toCell}`);
  const cell = worksheet.getCell(fromCell);
  cell.value = text;
  styleSectionCell(cell, colour);
}

function styleActionCell(
  cell: ExcelJS.Cell,
  action: string,
  log?: MoneyAuditLog,
) {
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
        log.action === "delete_all"),
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
      value: logs.filter(
        (log) =>
          log.action === "edit" &&
          !isCheckedAuditLog(log) &&
          !isUncheckedAuditLog(log),
      ).length,
      notes: "Transactions or records edited.",
    },
    {
      label: "Checked",
      value: logs.filter((log) => isCheckedAuditLog(log)).length,
      notes: "Transactions marked as checked.",
    },
    {
      label: "Unchecked",
      value: logs.filter((log) => isUncheckedAuditLog(log)).length,
      notes: "Transactions where checked status was undone.",
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
          log.action === "mark_not_paid_back",
      ).length,
      notes: "Personal funds repayment status changes.",
    },
    {
      label: "Unique users",
      value: new Set(
        logs
          .map(
            (log) =>
              getActorUniqueKey(log),
          )
          .filter(Boolean),
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
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAction, selectedYear]);

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
      rows = rows.filter((log) => getRiskLevel(log) === selectedRisk);
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
          getTransactionTitle(log).toLowerCase().includes(q) ||
          log.transaction_id?.toLowerCase().includes(q) ||
          getActorDisplayName(log).toLowerCase().includes(q) ||
          getActorEmailDisplay(log).toLowerCase().includes(q) ||
          getAuditArea(log).toLowerCase().includes(q) ||
          getRiskLevel(log).toLowerCase().includes(q) ||
          getSourceLabel(log).toLowerCase().includes(q) ||
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
        return getTransactionTitle(a).localeCompare(getTransactionTitle(b));
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
  ]);

  const stats = useMemo(() => {
    const hidden = logs.filter((log) => isHiddenAuditLog(log)).length;

    const deleted = logs.filter(
      (log) =>
        !isHiddenAuditLog(log) &&
        (log.action === "delete" ||
          log.action === "delete_year" ||
          log.action === "delete_all"),
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
      restored: logs.filter((log) => log.action === "restore").length,
      paidBack: logs.filter(
        (log) =>
          log.action === "mark_paid_back" ||
          log.action === "mark_not_paid_back",
      ).length,
      savingTargets: logs.filter((log) => isSavingTargetAuditLog(log)).length,
      budgetPlanning: logs.filter((log) => isBudgetPlanningAuditLog(log)).length,
      automated: logs.filter((log) => isWebsiteGeneratedLog(log)).length,
      highRisk: logs.filter((log) => getRiskLevel(log) === "High").length,
      uniqueUsers: new Set(
        logs
          .map(
            (log) =>
              getActorUniqueKey(log),
          )
          .filter(Boolean),
      ).size,
    };
  }, [logs, filteredLogs.length]);

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

      const workbook = new ExcelJS.Workbook();
      const now = new Date();
      const fileDate = now.toISOString().slice(0, 10);

      workbook.creator = "Burton Pride C.I.C";
      workbook.created = now;
      workbook.modified = now;
      workbook.subject = "Money audit logs";
      workbook.title = "Burton Pride Money Audit Logs";
      workbook.company = "Burton Pride C.I.C";

      const summarySheet = workbook.addWorksheet("Print Report", {
        views: [{ showGridLines: false }],
        pageSetup: {
          paperSize: 9,
          orientation: "landscape",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          horizontalCentered: true,
          margins: {
            left: 0.25,
            right: 0.25,
            top: 0.35,
            bottom: 0.35,
            header: 0.15,
            footer: 0.15,
          },
        },
      });

      summarySheet.properties.defaultRowHeight = 21;
      summarySheet.columns = [
        { key: "a", width: 22 },
        { key: "b", width: 14 },
        { key: "c", width: 22 },
        { key: "d", width: 14 },
        { key: "e", width: 22 },
        { key: "f", width: 14 },
        { key: "g", width: 22 },
        { key: "h", width: 14 },
      ];

      for (let rowNumber = 1; rowNumber <= 44; rowNumber += 1) {
        const row = summarySheet.getRow(rowNumber);
        row.height = 21;
        for (let colNumber = 1; colNumber <= 8; colNumber += 1) {
          const cell = row.getCell(colNumber);
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFFFFF" },
          };
        }
      }

      summarySheet.mergeCells("A1:H1");
      summarySheet.getCell("A1").value = "Burton Pride C.I.C - Money Audit Report";
      summarySheet.getCell("A1").font = {
        bold: true,
        size: 24,
        color: { argb: "FFFFFFFF" },
      };
      summarySheet.getCell("A1").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF111827" },
      };
      summarySheet.getCell("A1").alignment = {
        horizontal: "center",
        vertical: "middle",
      };
      summarySheet.getRow(1).height = 34;

      summarySheet.mergeCells("A2:H2");
      summarySheet.getCell("A2").value = `Printed report version | Generated ${now.toLocaleString("en-GB")} | Year: ${selectedYear === "all" ? "All years" : selectedYear} | Showing ${filteredLogs.length} of ${logs.length} loaded logs`;
      summarySheet.getCell("A2").font = {
        bold: true,
        size: 11,
        color: { argb: "FF374151" },
      };
      summarySheet.getCell("A2").alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      summarySheet.getRow(2).height = 26;

      function styleCard(
        labelRange: string,
        valueRange: string,
        label: string,
        value: number,
        fillColour: string,
      ) {
        summarySheet.mergeCells(labelRange);
        summarySheet.mergeCells(valueRange);

        const labelCell = summarySheet.getCell(labelRange.split(":")[0]);
        const valueCell = summarySheet.getCell(valueRange.split(":")[0]);

        labelCell.value = label;
        labelCell.font = {
          bold: true,
          size: 10,
          color: { argb: "FF374151" },
        };
        labelCell.alignment = {
          horizontal: "left",
          vertical: "middle",
        };

        valueCell.value = value;
        valueCell.font = {
          bold: true,
          size: 22,
          color: { argb: "FF111827" },
        };
        valueCell.alignment = {
          horizontal: "left",
          vertical: "middle",
        };

        [labelCell, valueCell].forEach((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: fillColour },
          };
          cell.border = {
            top: { style: "thin", color: { argb: "FFCBD5E1" } },
            left: { style: "thin", color: { argb: "FFCBD5E1" } },
            bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
            right: { style: "thin", color: { argb: "FFCBD5E1" } },
          };
        });
      }

      styleCard("A4:B4", "A5:B6", "Total Logs", filteredLogs.length, "FFF8FAFC");
      styleCard("C4:D4", "C5:D6", "Created", filteredLogs.filter((log) => log.action === "create").length, "FFECFDF5");
      styleCard("E4:F4", "E5:F6", "Checked", filteredLogs.filter((log) => isCheckedAuditLog(log)).length, "FFEFF6FF");
      styleCard("G4:H4", "G5:H6", "Unchecked", filteredLogs.filter((log) => isUncheckedAuditLog(log)).length, "FFFFFBEB");
      styleCard("A8:B8", "A9:B10", "Edited", filteredLogs.filter((log) => log.action === "edit" && !isCheckedAuditLog(log) && !isUncheckedAuditLog(log)).length, "FFF0F9FF");
      styleCard("C8:D8", "C9:D10", "Hidden", filteredLogs.filter((log) => isHiddenAuditLog(log)).length, "FFFFF7ED");
      styleCard("E8:F8", "E9:F10", "Deleted", filteredLogs.filter((log) => !isHiddenAuditLog(log) && (log.action === "delete" || log.action === "delete_year" || log.action === "delete_all")).length, "FFFEF2F2");
      styleCard("G8:H8", "G9:H10", "Users", new Set(filteredLogs.map((log) => getActorUniqueKey(log)).filter(Boolean)).size, "FFF8FAFC");
      styleCard("A11:B11", "A12:B13", "Paid Back", filteredLogs.filter((log) => log.action === "mark_paid_back" || log.action === "mark_not_paid_back").length, "FFFDF2F8");

      addMergedSection(summarySheet, "Report Filters", "A15", "H15", "FF334155");
      const filterHeader = summarySheet.addRow([
        "Action",
        "Year",
        "Search",
        "Date From",
        "Date To",
        "Sort",
        "Loaded Logs",
        "Visible Logs",
      ]);
      styleHeaderRow(filterHeader, "FF111827");

      const filterValueRow = summarySheet.addRow([
        selectedAction === "all"
          ? "All actions"
          : actionOptions.find((item) => item.value === selectedAction)?.label ||
            actionLabel(selectedAction),
        selectedYear === "all" ? "All years" : selectedYear,
        searchTerm || "No search",
        dateFrom || "No start date",
        dateTo || "No end date",
        sortMode,
        logs.length,
        filteredLogs.length,
      ]);
      styleBodyRow(filterValueRow);
      filterValueRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FF111827" } };
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
      });

      addMergedSection(summarySheet, "Action Breakdown", "A20", "H20", "FF334155");
      const actionBreakdownHeader = summarySheet.addRow([
        "Action",
        "Count",
        "Notes",
        "Action",
        "Count",
        "Notes",
        "Action",
        "Count",
      ]);
      styleHeaderRow(actionBreakdownHeader, "FF111827");

      const actionBreakdownRows = [
        {
          label: "Created",
          count: filteredLogs.filter((log) => log.action === "create").length,
          notes: "Created records.",
        },
        {
          label: "Edited",
          count: filteredLogs.filter(
            (log) =>
          log.action === "edit" &&
          !isCheckedAuditLog(log) &&
          !isUncheckedAuditLog(log),
          ).length,
          notes: "Edited records.",
        },
        {
          label: "Checked",
          count: filteredLogs.filter((log) => isCheckedAuditLog(log)).length,
          notes: "Marked as checked.",
        },
        {
          label: "Unchecked",
          count: filteredLogs.filter((log) => isUncheckedAuditLog(log)).length,
          notes: "Checked status undone.",
        },
        {
          label: "Hidden",
          count: filteredLogs.filter((log) => isHiddenAuditLog(log)).length,
          notes: "Soft-deleted/hidden.",
        },
        {
          label: "Deleted Year",
          count: filteredLogs.filter((log) => log.action === "delete_year")
            .length,
          notes: "Year delete actions.",
        },
        {
          label: "Deleted All",
          count: filteredLogs.filter((log) => log.action === "delete_all")
            .length,
          notes: "Delete-all actions.",
        },
        {
          label: "Restored",
          count: filteredLogs.filter((log) => log.action === "restore").length,
          notes: "Restored records.",
        },
        {
          label: "Paid Back",
          count: filteredLogs.filter(
            (log) =>
              log.action === "mark_paid_back" ||
              log.action === "mark_not_paid_back",
          ).length,
          notes: "Repayment changes.",
        },
      ];

      for (let index = 0; index < actionBreakdownRows.length; index += 3) {
        const first = actionBreakdownRows[index];
        const second = actionBreakdownRows[index + 1];
        const third = actionBreakdownRows[index + 2];

        const row = summarySheet.addRow([
          first?.label || "",
          first?.count ?? "",
          first?.notes || "",
          second?.label || "",
          second?.count ?? "",
          second?.notes || "",
          third?.label || "",
          third?.count ?? "",
        ]);

        styleBodyRow(row);

        [1, 4, 7].forEach((cellNumber) => {
          row.getCell(cellNumber).font = { bold: true, color: { argb: "FF111827" } };
        });

        [2, 5, 8].forEach((cellNumber) => {
          row.getCell(cellNumber).font = { bold: true, color: { argb: "FF111827" } };
          row.getCell(cellNumber).alignment = {
            horizontal: "center",
            vertical: "middle",
          };
        });
      }

      addMergedSection(summarySheet, "Latest Audit Logs", "A27", "H27", "FF334155");
      const latestHeader = summarySheet.addRow([
        "When",
        "Action",
        "Transaction",
        "Who",
        "Changed Fields",
        "Source",
        "Route",
        "Log ID",
      ]);
      styleHeaderRow(latestHeader, "FF111827");

      filteredLogs.slice(0, 12).forEach((log) => {
        const changedNames = getChangedFieldNames(log.changed_fields);
        const row = summarySheet.addRow([
          formatExcelDate(log.created_at),
          actionLabel(log.action, log),
          getTransactionTitle(log),
          getActorDisplayName(log),
          changedNames.map(cleanFieldName).join(", ") || "—",
          getSourceLabel(log),
          log.metadata?.route || "",
          log.id,
        ]);

        styleBodyRow(row);
        row.getCell(1).numFmt = "dd mmm yyyy, hh:mm";
        styleActionCell(row.getCell(2), log.action, log);
        row.getCell(3).font = { bold: true, color: { argb: "FF111827" } };
        row.getCell(4).font = { bold: true, color: { argb: "FF111827" } };
      });

      summarySheet.pageSetup.printArea = "A1:H44";
      summarySheet.headerFooter.oddFooter = "&LPrinted by Burton Pride C.I.C&RPage &P of &N";

      const logsSheet = workbook.addWorksheet("Audit Logs", {
        views: [{ state: "frozen", ySplit: 5, showGridLines: false }],
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
        "L2",
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
        const emptyRow = logsSheet.addRow([
          "No audit logs found for the current filters.",
        ]);
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
            actorEmail: getActorEmailDisplay(log),
            actorUserId: getActorUserIdDisplay(log),
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

          if (!getActorEmailDisplay(log)) styleMutedCell(row.getCell("actorEmail"));
          if (!getActorUserIdDisplay(log)) styleMutedCell(row.getCell("actorUserId"));
          if (changedNames.length === 0)
            styleMutedCell(row.getCell("changedFields"));
        });
      }

      logsSheet.autoFilter = {
        from: "A4",
        to: "L4",
      };

      const changedSheet = workbook.addWorksheet("Changed Fields", {
        views: [{ state: "frozen", ySplit: 5, showGridLines: false }],
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

      addMergedTitle(
        changedSheet,
        "Burton Pride C.I.C - Changed Fields",
        "A1",
        "H1",
      );
      addMergedSubtitle(
        changedSheet,
        "One row per changed field, with before and after values.",
        "A2",
        "H2",
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
        const emptyRow = changedSheet.addRow([
          "No changed field rows found for the current filters.",
        ]);
        styleBodyRow(emptyRow);
      }

      changedSheet.autoFilter = {
        from: "A4",
        to: "H4",
      };

      const usersSheet = workbook.addWorksheet("Users", {
        views: [{ state: "frozen", ySplit: 5, showGridLines: false }],
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

      addMergedTitle(
        usersSheet,
        "Burton Pride C.I.C - Audit Users",
        "A1",
        "J1",
      );
      addMergedSubtitle(usersSheet, "Summary by user / actor.", "A2", "J2");

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
        const key = getActorUniqueKey(log) || "Unknown user";

        const existing = userMap.get(key);

        if (existing) {
          existing.logs.push(log);
        } else {
          userMap.set(key, {
            name: getActorDisplayName(log),
            email: getActorEmailDisplay(log),
            userId: getActorUserIdDisplay(log),
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
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime(),
          )[0];

          const row = usersSheet.addRow({
            name: user.name,
            email: user.email,
            userId: user.userId,
            total: userLogs.length,
            created: userLogs.filter((log) => log.action === "create").length,
            edited: userLogs.filter(
              (log) =>
          log.action === "edit" &&
          !isCheckedAuditLog(log) &&
          !isUncheckedAuditLog(log),
            ).length,
            hidden: userLogs.filter((log) => isHiddenAuditLog(log)).length,
            deleted: userLogs.filter(
              (log) =>
                !isHiddenAuditLog(log) &&
                (log.action === "delete" ||
                  log.action === "delete_year" ||
                  log.action === "delete_all"),
            ).length,
            paidBack: userLogs.filter(
              (log) =>
                log.action === "mark_paid_back" ||
                log.action === "mark_not_paid_back",
            ).length,
            latest: formatExcelDate(latest?.created_at),
          });

          styleBodyRow(row);
          row.getCell("name").font = { bold: true };
          row.getCell("latest").numFmt = "dd mmm yyyy, hh:mm";

          [
            "total",
            "created",
            "edited",
            "hidden",
            "deleted",
            "paidBack",
          ].forEach((key) => {
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
        views: [{ state: "frozen", ySplit: 5, showGridLines: false }],
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

      addMergedTitle(
        rawSheet,
        "Burton Pride C.I.C - Audit Raw JSON",
        "A1",
        "I1",
      );
      addMergedSubtitle(
        rawSheet,
        "Full raw audit log data for checking details.",
        "A2",
        "I2",
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

      [summarySheet, logsSheet, changedSheet, usersSheet, rawSheet].forEach(
        (sheet) => {
          sheet.eachRow((row) => {
            row.eachCell((cell) => {
              cell.alignment = {
                ...cell.alignment,
                vertical: cell.alignment?.vertical || "top",
                wrapText: true,
              };
            });
          });
        },
      );

      await downloadWorkbook(
        workbook,
        `burton-pride-money-audit-logs-${fileDate}.xlsx`,
      );
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
                  checks, hidden soft-deletes, saving target changes, budget
                  tracker updates, restore actions, selected-year deletes,
                  delete-all actions, and personal funds paid-back changes.
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

                <button
                  type="button"
                  onClick={exportRawJson}
                  disabled={filteredLogs.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-500/15 px-4 py-3 text-sm font-bold text-purple-200 ring-1 ring-purple-300/20 hover:bg-purple-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Clipboard className="h-4 w-4" />
                  Export JSON
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
          <StatCard label="Auto Website" value={stats.automated} tone="emerald" />
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
              High-risk actions include deletes, soft-deletes, delete-year and delete-all records.
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
              onClick={clearFilters}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white/75 ring-1 ring-white/10 hover:bg-white/20"
            >
              <X className="h-4 w-4" />
              Clear filters
            </button>
          </div>

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
              <div className="hidden max-w-full overflow-x-auto overflow-y-hidden rounded-2xl border border-white/10 xl:block">
                <table className="w-full min-w-[1250px] text-sm">
                  <thead className="bg-white/10 text-white/60">
                    <tr>
                      <th className="p-3 text-left">When</th>
                      <th className="p-3 text-left">Action</th>
                      <th className="p-3 text-left">Transaction</th>
                      <th className="p-3 text-left">Who</th>
                      <th className="p-3 text-left">Area</th>
                      <th className="p-3 text-left">Risk</th>
                      <th className="p-3 text-left">Changed Fields</th>
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
                      const risk = getRiskLevel(log);
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
            <span>Users</span>
            <strong>{stats.uniqueUsers}</strong>
          </div>
        </div>

        <table className="audit-print-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Action</th>
              <th>Transaction</th>
              <th>Who</th>
              <th>Changed Fields</th>
              <th>Source / Route</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6}>
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
                      <strong>{getTransactionTitle(log)}</strong>
                      {log.transaction_id && (
                        <small>{log.transaction_id}</small>
                      )}
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
                  subtitle={getActorEmailDisplay(selectedLog) || "No email saved"}
                  extra={getActorUserIdDisplay(selectedLog)}
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

              {showRawData && (
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

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone:
    | "white"
    | "purple"
    | "emerald"
    | "sky"
    | "cyan"
    | "amber"
    | "red"
    | "orange"
    | "pink";
}) {
  const classes = {
    white: "bg-white/[0.04] ring-white/10 text-white",
    purple: "bg-purple-500/10 ring-purple-300/10 text-purple-100",
    emerald: "bg-emerald-500/10 ring-emerald-300/10 text-emerald-100",
    sky: "bg-sky-500/10 ring-sky-300/10 text-sky-100",
    cyan: "bg-cyan-500/10 ring-cyan-300/10 text-cyan-100",
    amber: "bg-amber-500/10 ring-amber-300/10 text-amber-100",
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
  icon: ReactNode;
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
    <div
      className={`rounded-2xl border border-white/10 bg-black/20 p-4 ${className}`}
    >
      <h3 className="mb-3 font-bold">{title}</h3>

      <pre className="max-h-96 overflow-auto rounded-xl bg-black/40 p-4 text-xs text-white/70">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
