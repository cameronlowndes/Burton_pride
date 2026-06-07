import type { MoneyAuditLog, MoneyAuditRiskRule } from "./audit-log-types";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  RotateCcw,
  ShieldCheck,
  Target,
  Trash2,
} from "lucide-react";

export const EASY_MODE_STORAGE_KEY = "burton-pride-money-audit-logs-easy-mode";

export const actionOptions = [
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
  { value: "refund_created", label: "Refund created" },
  { value: "refund_update", label: "Refund updated" },
  { value: "refund_hide", label: "Refund hidden" },
  { value: "refund_restore", label: "Refund restored" },
  { value: "refund_cancel", label: "Refund cancelled" },
  { value: "refund_mark_completed", label: "Refund completed" },
  { value: "refund_mark_pending", label: "Refund pending" },
  {
    value: "refund_permanently_deleted",
    label: "Refund permanently deleted",
  },
];

export function formatDateTime(value: string | null | undefined) {
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

export function formatExcelDate(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date;
}

export function formatDateOnly(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}

export function getYearOnly(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return String(date.getFullYear());
}

export function cleanLogValue(value: unknown) {
  const text = String(value || "").trim();
  return text || "";
}

export function normaliseText(value: unknown) {
  return cleanLogValue(value).toLowerCase();
}

export function isHiddenAuditLog(log: MoneyAuditLog) {
  const action = normaliseText(log.action);

  if (action !== "delete") return false;

  const route = normaliseText(log.metadata?.route);
  const source = normaliseText(log.metadata?.source);

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

export function isUncheckedAuditLog(log: MoneyAuditLog) {
  const action = normaliseText(log.action);

  if (action !== "edit") return false;

  const auditEvent = normaliseText(log.metadata?.audit_event);
  const route = normaliseText(log.metadata?.route);
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
    (afterCheckedAt === null ||
      afterCheckedAt === undefined ||
      afterCheckedAt === "");

  const hasClearedCheckedBy =
    Object.prototype.hasOwnProperty.call(changedFields, "checked_by") &&
    Boolean(checkedByChange?.before) &&
    (checkedByChange?.after === null ||
      checkedByChange?.after === undefined ||
      checkedByChange?.after === "");

  return (
    hasUncheckedMetadata ||
    (hasCheckedRoute && (hasUncheckedFields || hasClearedCheckedBy))
  );
}

export function isCheckedAuditLog(log: MoneyAuditLog) {
  const action = normaliseText(log.action);

  if (action !== "edit") return false;
  if (isUncheckedAuditLog(log)) return false;

  const auditEvent = normaliseText(log.metadata?.audit_event);
  const metadataAction = normaliseText(log.metadata?.action);
  const route = normaliseText(log.metadata?.route);
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

export function isRefundAuditLog(log: MoneyAuditLog) {
  const action = normaliseText(log.action);
  const area = normaliseText(log.metadata?.area);
  const source = normaliseText(log.metadata?.source);
  const route = normaliseText(log.metadata?.route);
  const entityType = normaliseText(log.metadata?.entity_type);
  const recordType = normaliseText(log.metadata?.record_type);

  return (
    action.startsWith("refund_") ||
    area.includes("refund") ||
    source.includes("refund") ||
    route.includes("/refunds") ||
    entityType === "refund" ||
    recordType === "refund" ||
    Boolean(log.metadata?.refund_id) ||
    Boolean(log.metadata?.deleted_refund)
  );
}

export function isSavingTargetAuditLog(log: MoneyAuditLog) {
  const action = normaliseText(log.action);
  const area = normaliseText(log.metadata?.area);
  const source = normaliseText(log.metadata?.source);
  const title = normaliseText(getRecordTitle(log));

  return (
    action.startsWith("saving_target") ||
    area.includes("saving") ||
    source.includes("saving_targets") ||
    source.includes("saving target") ||
    title.includes("saving target")
  );
}

export function isBudgetPlanningAuditLog(log: MoneyAuditLog) {
  const action = normaliseText(log.action);
  const area = normaliseText(log.metadata?.area);
  const source = normaliseText(log.metadata?.source);
  const route = normaliseText(log.metadata?.route);
  const title = normaliseText(getRecordTitle(log));

  return (
    action.startsWith("budget") ||
    area.includes("budget") ||
    source.includes("budget") ||
    route.includes("budget") ||
    title.includes("budget planning") ||
    title.includes("budget item")
  );
}

export function isDeletedAreaAuditLog(log: MoneyAuditLog) {
  const area = normaliseText(log.metadata?.area);
  const source = normaliseText(log.metadata?.source);
  const route = normaliseText(log.metadata?.route);

  return (
    area.includes("deleted_items") ||
    source.includes("deleted_items") ||
    route.includes("deleted-items")
  );
}

export function getAuditArea(log: MoneyAuditLog) {
  if (isRefundAuditLog(log)) return "Refund Tracker";
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

function safeJsonForRisk(value: unknown) {
  try {
    return JSON.stringify(value || {});
  } catch {
    return "";
  }
}

function doesRiskRuleMatch(log: MoneyAuditLog, rule: MoneyAuditRiskRule) {
  if (!rule?.is_active) return false;

  const matchValue = normaliseText(rule.match_value);
  if (!matchValue) return false;

  const action = normaliseText(log.action);

  if (rule.match_type === "action") {
    return action.includes(matchValue);
  }

  if (rule.match_type === "area") {
    return normaliseText(getAuditArea(log)).includes(matchValue);
  }

  if (rule.match_type === "source") {
    return normaliseText(log.metadata?.source).includes(matchValue);
  }

  if (rule.match_type === "route") {
    return normaliseText(log.metadata?.route).includes(matchValue);
  }

  if (rule.match_type === "title") {
    return normaliseText(getRecordTitle(log)).includes(matchValue);
  }

  if (rule.match_type === "metadata") {
    return normaliseText(safeJsonForRisk(log.metadata)).includes(matchValue);
  }

  return false;
}

export function getRiskLevel(
  log: MoneyAuditLog,
  riskRules: MoneyAuditRiskRule[] = [],
) {
  const sortedRules = [...riskRules].sort(
    (a, b) => Number(a.priority || 100) - Number(b.priority || 100),
  );

  const matchedRule = sortedRules.find((rule) => doesRiskRuleMatch(log, rule));

  if (matchedRule?.risk_level) {
    return matchedRule.risk_level;
  }

  const action = normaliseText(log.action);

  if (action === "refund_permanently_deleted") {
    return "High";
  }

  if (
    action === "refund_hide" ||
    action === "refund_restore" ||
    action === "refund_cancel"
  ) {
    return "Medium";
  }

  if (
    action === "refund_mark_completed" ||
    action === "refund_mark_pending" ||
    action === "refund_update"
  ) {
    return "Medium";
  }

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

export function riskClass(level: string) {
  if (level === "High") return "bg-red-500/15 text-red-100 ring-red-300/20";
  if (level === "Medium") {
    return "bg-amber-500/15 text-amber-100 ring-amber-300/20";
  }

  return "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20";
}

export function actionLabel(action: string, log?: MoneyAuditLog) {
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
    refund_created: "Refund Created",
    refund_update: "Refund Updated",
    refund_hide: "Refund Hidden",
    refund_restore: "Refund Restored",
    refund_cancel: "Refund Cancelled",
    refund_mark_completed: "Refund Completed",
    refund_mark_pending: "Refund Pending",
    refund_permanently_deleted: "Refund Permanently Deleted",
  };

  return labels[action] || action.replaceAll("_", " ");
}

export function actionClass(action: string, log?: MoneyAuditLog) {
  if (log && isHiddenAuditLog(log)) {
    return "bg-orange-500/15 text-orange-200 ring-orange-300/20";
  }

  if (log && isUncheckedAuditLog(log)) {
    return "bg-amber-500/15 text-amber-100 ring-amber-300/20";
  }

  if (log && isCheckedAuditLog(log)) {
    return "bg-cyan-500/15 text-cyan-100 ring-cyan-300/20";
  }

  if (action.startsWith("refund_")) {
    if (action === "refund_permanently_deleted") {
      return "bg-red-500/15 text-red-100 ring-red-300/20";
    }

    if (action === "refund_hide") {
      return "bg-orange-500/15 text-orange-100 ring-orange-300/20";
    }

    if (action === "refund_restore") {
      return "bg-purple-500/15 text-purple-100 ring-purple-300/20";
    }

    if (action === "refund_cancel" || action === "refund_mark_pending") {
      return "bg-amber-500/15 text-amber-100 ring-amber-300/20";
    }

    if (action === "refund_created" || action === "refund_mark_completed") {
      return "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20";
    }

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

export function actionExcelColour(action: string, log?: MoneyAuditLog) {
  if (log && isHiddenAuditLog(log)) return "FFEA580C";
  if (log && isUncheckedAuditLog(log)) return "FFD97706";
  if (log && isCheckedAuditLog(log)) return "FF0891B2";

  if (action.startsWith("refund_")) {
    if (action === "refund_permanently_deleted") return "FFB91C1C";
    if (action === "refund_hide") return "FFEA580C";
    if (action === "refund_restore") return "FF7C3AED";
    if (action === "refund_cancel" || action === "refund_mark_pending") {
      return "FFD97706";
    }
    if (action === "refund_created" || action === "refund_mark_completed") {
      return "FF047857";
    }
    return "FF0891B2";
  }

  if (action.includes("saving_target")) {
    if (action.includes("delete") || action.includes("soft_delete")) {
      return "FFB91C1C";
    }

    if (action.includes("restore")) return "FF7C3AED";

    return "FF0284C7";
  }

  if (action.includes("budget")) {
    if (action.includes("delete") || action.includes("soft_delete")) {
      return "FFB91C1C";
    }

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

export function actionIcon(action: string, log?: MoneyAuditLog) {
  if (log && isHiddenAuditLog(log)) return Eye;
  if (log && isUncheckedAuditLog(log)) return RotateCcw;
  if (log && isCheckedAuditLog(log)) return ShieldCheck;

  if (action.startsWith("refund_")) {
    if (
      action === "refund_permanently_deleted" ||
      action === "refund_hide"
    ) {
      return Trash2;
    }

    if (action === "refund_restore") return RotateCcw;
    if (action === "refund_cancel") return AlertTriangle;
    if (action === "refund_mark_completed") return CheckCircle2;
    if (action === "refund_mark_pending") return Clock3;

    return Activity;
  }

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

export function getChangedFieldNames(changedFields: any) {
  if (!changedFields || typeof changedFields !== "object") return [];
  return Object.keys(changedFields);
}

export function cleanFieldName(name: string) {
  return name
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function shortValue(value: any) {
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

export function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

export function formatMoneyPence(value: number | null) {
  if (value === null) return "—";

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value / 100);
}

export function getPenceFromObject(value: any) {
  if (!value || typeof value !== "object") return null;

  const penceKeys = [
    "amount_pence",
    "transaction_amount_pence",
    "refund_amount_pence",
    "value_pence",
    "total_pence",
    "planned_amount_pence",
    "agreed_amount_pence",
    "received_pence",
    "spent_pence",
    "remaining_pence",
  ];

  for (const key of penceKeys) {
    const number = numberOrNull(value[key]);

    if (number !== null) {
      return number;
    }
  }

  const poundKeys = [
    "amount",
    "transaction_amount",
    "refund_amount",
    "value",
    "total",
  ];

  for (const key of poundKeys) {
    const number = numberOrNull(value[key]);

    if (number !== null) {
      return Math.round(number * 100);
    }
  }

  return null;
}

export function getChangedAmountPence(log: MoneyAuditLog) {
  const changedFields = log.changed_fields || {};

  const penceKeys = [
    "amount_pence",
    "transaction_amount_pence",
    "refund_amount_pence",
    "value_pence",
    "total_pence",
    "planned_amount_pence",
  ];

  for (const key of penceKeys) {
    if (!Object.prototype.hasOwnProperty.call(changedFields, key)) continue;

    const before = numberOrNull(changedFields[key]?.before);
    const after = numberOrNull(changedFields[key]?.after);

    return {
      before,
      after,
    };
  }

  const poundKeys = [
    "amount",
    "transaction_amount",
    "refund_amount",
    "value",
    "total",
  ];

  for (const key of poundKeys) {
    if (!Object.prototype.hasOwnProperty.call(changedFields, key)) continue;

    const beforeNumber = numberOrNull(changedFields[key]?.before);
    const afterNumber = numberOrNull(changedFields[key]?.after);

    return {
      before: beforeNumber === null ? null : Math.round(beforeNumber * 100),
      after: afterNumber === null ? null : Math.round(afterNumber * 100),
    };
  }

  return null;
}

export function getAuditMoneyPence(log: MoneyAuditLog) {
  const changedAmount = getChangedAmountPence(log);

  if (changedAmount?.after !== null && changedAmount?.after !== undefined) {
    return changedAmount.after;
  }

  if (changedAmount?.before !== null && changedAmount?.before !== undefined) {
    return changedAmount.before;
  }

  return (
    getPenceFromObject(log.after_data) ??
    getPenceFromObject(log.before_data) ??
    getPenceFromObject(log.metadata)
  );
}

export function getAuditMoneyDisplay(log: MoneyAuditLog) {
  const changedAmount = getChangedAmountPence(log);

  if (
    changedAmount &&
    changedAmount.before !== null &&
    changedAmount.after !== null &&
    changedAmount.before !== changedAmount.after
  ) {
    return `${formatMoneyPence(changedAmount.before)} → ${formatMoneyPence(
      changedAmount.after,
    )}`;
  }

  return formatMoneyPence(getAuditMoneyPence(log));
}

export function nameFromEmail(email: string | null | undefined) {
  if (!email) return "";

  const username = email.split("@")[0] || "";

  return username
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

export function isWebsiteGeneratedLog(log: MoneyAuditLog) {
  const source = normaliseText(log.metadata?.source);
  const route = normaliseText(log.metadata?.route);
  const createdFrom = normaliseText(log.metadata?.created_from);
  const auditEvent = normaliseText(log.metadata?.audit_event);
  const title = normaliseText(getRecordTitle(log));

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

export function getMetadataValue(log: MoneyAuditLog, keys: string[]) {
  for (const key of keys) {
    const value = cleanLogValue(log.metadata?.[key]);

    if (value) return value;
  }

  return "";
}

export function getActorDisplayName(log: MoneyAuditLog) {
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

export function getActorEmailDisplay(log: MoneyAuditLog) {
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

export function getActorUserIdDisplay(log: MoneyAuditLog) {
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

export function getActorUniqueKey(log: MoneyAuditLog) {
  return (
    getActorEmailDisplay(log) ||
    getActorUserIdDisplay(log) ||
    getActorDisplayName(log)
  );
}

export function getSourceLabel(log: MoneyAuditLog) {
  const source = log.metadata?.source;
  const route = log.metadata?.route;

  if (isRefundAuditLog(log)) return "Refund Tracker";
  if (source === "money_tracker") return "Money Tracker";
  if (source) return String(source).replaceAll("_", " ");
  if (route) return String(route);

  return "—";
}

export function getRecordTitle(log: MoneyAuditLog) {
  const metadataRefund =
    log.metadata?.deleted_refund ||
    log.metadata?.refund ||
    log.metadata?.record ||
    null;

  return (
    cleanLogValue(log.transaction_title) ||
    cleanLogValue(log.metadata?.refund_description) ||
    cleanLogValue(metadataRefund?.title) ||
    cleanLogValue(log.after_data?.title) ||
    cleanLogValue(log.before_data?.title) ||
    (isRefundAuditLog(log) ? "Refund record" : "Untitled record")
  );
}

export function getRecordId(log: MoneyAuditLog) {
  return (
    cleanLogValue(log.transaction_id) ||
    getMetadataValue(log, [
      "refund_id",
      "entity_id",
      "record_id",
      "transaction_id",
      "budget_item_id",
      "saving_target_id",
    ])
  );
}

export function getAuditComment(log: MoneyAuditLog) {
  return cleanLogValue(log.admin_comment);
}

export function getAuditCommentUpdatedBy(log: MoneyAuditLog) {
  return (
    cleanLogValue(log.admin_comment_updated_by) ||
    nameFromEmail(log.admin_comment_updated_by_email) ||
    "Main admin"
  );
}

export function safeJson(value: any) {
  if (value === null || value === undefined) return "";

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function copyToClipboard(value: string) {
  return navigator.clipboard.writeText(value);
}