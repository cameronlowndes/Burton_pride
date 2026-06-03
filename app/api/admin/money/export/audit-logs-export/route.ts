import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

import { requireAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUDIT_LOGS_TABLE = "admin_money_audit_logs";

type MoneyAuditLog = {
  id?: string | null;
  created_at?: string | null;
  action?: string | null;
  transaction_id?: string | null;
  transaction_title?: string | null;
  actor_user_id?: string | null;
  actor_name?: string | null;
  actor_email?: string | null;
  created_by?: string | null;
  created_by_email?: string | null;
  created_by_user_id?: string | null;
  before_data?: any;
  after_data?: any;
  changed_fields?: any;
  metadata?: any;
};

function cleanLogValue(value: unknown) {
  const text = String(value || "").trim();
  return text || "";
}

function normaliseText(value: unknown) {
  return cleanLogValue(value).toLowerCase();
}

function safeJson(value: any) {
  if (value === null || value === undefined) return "";

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatExcelDate(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date;
}

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

function getYearOnly(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return String(date.getFullYear());
}

function nameFromEmail(email: string | null | undefined) {
  if (!email) return "";

  const username = email.split("@")[0] || "";

  return username
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function getMetadataValue(log: MoneyAuditLog, keys: string[]) {
  for (const key of keys) {
    const value = cleanLogValue(log.metadata?.[key]);

    if (value) return value;
  }

  return "";
}

function getTransactionTitle(log: MoneyAuditLog) {
  return (
    cleanLogValue(log.transaction_title) ||
    cleanLogValue(log.after_data?.title) ||
    cleanLogValue(log.before_data?.title) ||
    "Untitled transaction"
  );
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

function isHiddenAuditLog(log: MoneyAuditLog) {
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

function isUncheckedAuditLog(log: MoneyAuditLog) {
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

function isCheckedAuditLog(log: MoneyAuditLog) {
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

function actionLabel(actionValue: string | null | undefined, log?: MoneyAuditLog) {
  const action = cleanLogValue(actionValue);

  if (log && isHiddenAuditLog(log)) return "Hidden";
  if (log && isUncheckedAuditLog(log)) return "Unchecked";
  if (log && isCheckedAuditLog(log)) return "Checked";

  const labels: Record<string, string> = {
    create: "Created",
    edit: "Edited",
    update: "Updated",
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

  return labels[action] || action.replaceAll("_", " ") || "Unknown";
}

function actionExcelColour(
  actionValue: string | null | undefined,
  log?: MoneyAuditLog
) {
  const action = cleanLogValue(actionValue);

  if (log && isHiddenAuditLog(log)) return "FFEA580C";
  if (log && isUncheckedAuditLog(log)) return "FFD97706";
  if (log && isCheckedAuditLog(log)) return "FF0891B2";

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
  if (action === "update") return "FF0284C7";

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
    return safeJson(value);
  }

  return String(value);
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

function styleActionCell(
  cell: ExcelJS.Cell,
  action: string | null | undefined,
  log?: MoneyAuditLog
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
      value: logs.filter(
        (log) =>
          log.action === "edit" &&
          !isCheckedAuditLog(log) &&
          !isUncheckedAuditLog(log)
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
          log.action === "mark_not_paid_back"
      ).length,
      notes: "Personal funds repayment status changes.",
    },
    {
      label: "Unique users",
      value: new Set(
        logs.map((log) => getActorUniqueKey(log)).filter(Boolean)
      ).size,
      notes: "Unique actors based on email, user ID, or display name.",
    },
  ];
}

function filterLogsByYear(logs: MoneyAuditLog[], year: number) {
  return logs.filter((log) => getYearOnly(log.created_at) === String(year));
}

function buildErrorResponse(error: any) {
  return NextResponse.json(
    {
      error: "Could not load money audit logs.",
      details: {
        message: error?.message || String(error),
        hint: error?.hint,
        code: error?.code,
        table: AUDIT_LOGS_TABLE,
        expectedRoute: "app/api/admin/money/export/audit-logs-export/route.ts",
        likelyFix:
          "Check the admin_money_audit_logs table exists and has a created_at column. If your audit table name changes, update AUDIT_LOGS_TABLE at the top of this route file.",
      },
    },
    {
      status: 500,
    }
  );
}

export async function GET(req: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json(
      {
        error: "Unauthorised. Please sign in again as an admin.",
      },
      {
        status: 401,
      }
    );
  }

  const url = new URL(req.url);
  const yearValue = url.searchParams.get("year");
  const year = Number(yearValue || new Date().getFullYear());

  if (!Number.isFinite(year)) {
    return NextResponse.json(
      {
        error: "Invalid year. Please select a valid year.",
        details: {
          receivedYear: yearValue,
        },
      },
      {
        status: 400,
      }
    );
  }

  try {
    const { data, error } = await supabaseAdmin
      .from(AUDIT_LOGS_TABLE)
      .select("*")
      .gte("created_at", `${year}-01-01`)
      .lt("created_at", `${year + 1}-01-01`)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) {
      return buildErrorResponse(error);
    }

    const logs = filterLogsByYear((data || []) as MoneyAuditLog[], year);
    const now = new Date();
    const fileDate = now.toISOString().slice(0, 10);

    const workbook = new ExcelJS.Workbook();

    workbook.creator = "Burton Pride C.I.C";
    workbook.created = now;
    workbook.modified = now;
    workbook.subject = "Money audit logs";
    workbook.title = "Burton Pride Money Audit Logs";
    workbook.company = "Burton Pride C.I.C";

    const summaryRows = makeSummaryRows(logs);
    const latestLogs = [...logs]
      .sort(
        (a, b) =>
          new Date(b.created_at || "").getTime() -
          new Date(a.created_at || "").getTime()
      )
      .slice(0, 12);

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
    summarySheet.getCell("A1").value =
      "Burton Pride C.I.C - Money Audit Report";
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
    summarySheet.getCell("A2").value = `Printed report version | Generated ${now.toLocaleString(
      "en-GB"
    )} | Year: ${year} | Showing ${logs.length} logs`;
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
      fillColour: string
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
        setThinBorder(cell);
      });
    }

    styleCard("A4:B4", "A5:B6", "Total Logs", logs.length, "FFF8FAFC");

    styleCard(
      "C4:D4",
      "C5:D6",
      "Created",
      logs.filter((log) => log.action === "create").length,
      "FFECFDF5"
    );

    styleCard(
      "E4:F4",
      "E5:F6",
      "Checked",
      logs.filter((log) => isCheckedAuditLog(log)).length,
      "FFEFF6FF"
    );

    styleCard(
      "G4:H4",
      "G5:H6",
      "Unchecked",
      logs.filter((log) => isUncheckedAuditLog(log)).length,
      "FFFFFBEB"
    );

    styleCard(
      "A8:B8",
      "A9:B10",
      "Edited",
      logs.filter(
        (log) =>
          log.action === "edit" &&
          !isCheckedAuditLog(log) &&
          !isUncheckedAuditLog(log)
      ).length,
      "FFF0F9FF"
    );

    styleCard(
      "C8:D8",
      "C9:D10",
      "Hidden",
      logs.filter((log) => isHiddenAuditLog(log)).length,
      "FFFFF7ED"
    );

    styleCard(
      "E8:F8",
      "E9:F10",
      "Deleted",
      logs.filter(
        (log) =>
          !isHiddenAuditLog(log) &&
          (log.action === "delete" ||
            log.action === "delete_year" ||
            log.action === "delete_all")
      ).length,
      "FFFEF2F2"
    );

    styleCard(
      "G8:H8",
      "G9:H10",
      "Users",
      new Set(logs.map((log) => getActorUniqueKey(log)).filter(Boolean)).size,
      "FFF8FAFC"
    );

    styleCard(
      "A11:B11",
      "A12:B13",
      "Paid Back",
      logs.filter(
        (log) =>
          log.action === "mark_paid_back" ||
          log.action === "mark_not_paid_back"
      ).length,
      "FFFDF2F8"
    );

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
      "All actions",
      year,
      "No search",
      `${year}-01-01`,
      `${year}-12-31`,
      "newest",
      logs.length,
      logs.length,
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

    addMergedSection(
      summarySheet,
      "Action Breakdown",
      "A20",
      "H20",
      "FF334155"
    );

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

    for (let index = 0; index < summaryRows.length; index += 3) {
      const first = summaryRows[index];
      const second = summaryRows[index + 1];
      const third = summaryRows[index + 2];

      const row = summarySheet.addRow([
        first?.label || "",
        first?.value ?? "",
        first?.notes || "",
        second?.label || "",
        second?.value ?? "",
        second?.notes || "",
        third?.label || "",
        third?.value ?? "",
      ]);

      styleBodyRow(row);

      [1, 4, 7].forEach((cellNumber) => {
        row.getCell(cellNumber).font = {
          bold: true,
          color: { argb: "FF111827" },
        };
      });

      [2, 5, 8].forEach((cellNumber) => {
        row.getCell(cellNumber).font = {
          bold: true,
          color: { argb: "FF111827" },
        };
        row.getCell(cellNumber).alignment = {
          horizontal: "center",
          vertical: "middle",
        };
      });
    }

    addMergedSection(
      summarySheet,
      "Latest Audit Logs",
      "A27",
      "H27",
      "FF334155"
    );

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

    latestLogs.forEach((log) => {
      const changedNames = getChangedFieldNames(log.changed_fields);

      const row = summarySheet.addRow([
        formatExcelDate(log.created_at || ""),
        actionLabel(log.action, log),
        getTransactionTitle(log),
        getActorDisplayName(log),
        changedNames.map(cleanFieldName).join(", ") || "—",
        getSourceLabel(log),
        log.metadata?.route || "",
        log.id || "",
      ]);

      styleBodyRow(row);
      row.getCell(1).numFmt = "dd mmm yyyy, hh:mm";
      styleActionCell(row.getCell(2), log.action, log);
      row.getCell(3).font = { bold: true, color: { argb: "FF111827" } };
      row.getCell(4).font = { bold: true, color: { argb: "FF111827" } };
    });

    summarySheet.pageSetup.printArea = "A1:H44";
    summarySheet.headerFooter.oddFooter =
      "&LPrinted by Burton Pride C.I.C&RPage &P of &N";

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
      { key: "risk", width: 14 },
      { key: "area", width: 24 },
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

    addMergedTitle(logsSheet, "Burton Pride C.I.C - Audit Logs", "A1", "N1");

    addMergedSubtitle(
      logsSheet,
      `Formatted export | Generated ${now.toLocaleString(
        "en-GB"
      )} | Rows: ${logs.length}`,
      "A2",
      "N2"
    );

    logsSheet.addRow([]);

    const auditHeader = logsSheet.addRow([
      "When",
      "Action",
      "Risk",
      "Area",
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

    if (logs.length === 0) {
      const emptyRow = logsSheet.addRow([
        "No audit logs found for the selected year.",
      ]);
      styleBodyRow(emptyRow);
    } else {
      logs.forEach((log) => {
        const changedNames = getChangedFieldNames(log.changed_fields);

        const row = logsSheet.addRow({
          createdAt: formatExcelDate(log.created_at || ""),
          action: actionLabel(log.action, log),
          risk: getRiskLevel(log),
          area: getAuditArea(log),
          transactionTitle: getTransactionTitle(log),
          transactionId: log.transaction_id || "",
          actorName: getActorDisplayName(log),
          actorEmail: getActorEmailDisplay(log),
          actorUserId: getActorUserIdDisplay(log),
          changedFields: changedNames.map(cleanFieldName).join(", "),
          changedCount: changedNames.length,
          source: getSourceLabel(log),
          route: log.metadata?.route || "",
          logId: log.id || "",
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

        if (getRiskLevel(log) === "High") {
          styleDangerCell(row.getCell("risk"));
        } else if (getRiskLevel(log) === "Medium") {
          row.getCell("risk").font = {
            bold: true,
            color: { argb: "FF92400E" },
          };
          row.getCell("risk").fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFEF3C7" },
          };
        } else {
          styleSuccessCell(row.getCell("risk"));
        }

        if (!getActorEmailDisplay(log)) styleMutedCell(row.getCell("actorEmail"));
        if (!getActorUserIdDisplay(log)) styleMutedCell(row.getCell("actorUserId"));
        if (changedNames.length === 0) {
          styleMutedCell(row.getCell("changedFields"));
        }
      });
    }

    logsSheet.autoFilter = {
      from: "A4",
      to: "N4",
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
      "H1"
    );

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

    logs.forEach((log) => {
      const changed = log.changed_fields || {};
      const entries = Object.entries(changed);

      entries.forEach(([field, value]: [string, any]) => {
        changedFieldRowCount += 1;

        const row = changedSheet.addRow({
          createdAt: formatExcelDate(log.created_at || ""),
          action: actionLabel(log.action, log),
          transactionTitle: getTransactionTitle(log),
          actorName: getActorDisplayName(log),
          field: cleanFieldName(field),
          before: shortValue(value?.before),
          after: shortValue(value?.after),
          logId: log.id || "",
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
        "No changed field rows found for the selected year.",
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

    addMergedTitle(usersSheet, "Burton Pride C.I.C - Audit Users", "A1", "J1");
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

    logs.forEach((log) => {
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
            new Date(b.created_at || "").getTime() -
            new Date(a.created_at || "").getTime()
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
              !isUncheckedAuditLog(log)
          ).length,
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
          latest: formatExcelDate(latest?.created_at || ""),
        });

        styleBodyRow(row);
        row.getCell("name").font = { bold: true };
        row.getCell("latest").numFmt = "dd mmm yyyy, hh:mm";

        ["total", "created", "edited", "hidden", "deleted", "paidBack"].forEach(
          (key) => {
            row.getCell(key).alignment = {
              horizontal: "center",
              vertical: "middle",
            };
            row.getCell(key).font = { bold: true };
          }
        );
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

    logs.forEach((log) => {
      const row = rawSheet.addRow({
        createdAt: formatExcelDate(log.created_at || ""),
        action: actionLabel(log.action, log),
        transactionTitle: getTransactionTitle(log),
        actorName: getActorDisplayName(log),
        beforeData: safeJson(log.before_data),
        afterData: safeJson(log.after_data),
        changedFields: safeJson(log.changed_fields),
        metadata: safeJson(log.metadata),
        logId: log.id || "",
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
      }
    );

    const arrayBuffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="burton-pride-money-audit-logs-${fileDate}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("Audit logs export error:", error);

    return NextResponse.json(
      {
        error: "Failed to create audit logs export.",
        details: {
          message: error?.message || String(error),
          table: AUDIT_LOGS_TABLE,
          route: "/api/admin/money/export/audit-logs-export",
          expectedFile: "app/api/admin/money/export/audit-logs-export/route.ts",
          likelyFix:
            "Check admin_money_audit_logs table name, columns, ExcelJS installation, and server logs.",
        },
      },
      {
        status: 500,
      }
    );
  }
}