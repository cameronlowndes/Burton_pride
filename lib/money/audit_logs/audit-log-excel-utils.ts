import ExcelJS from "exceljs";
import type { MoneyAuditLog } from "./audit-log-types";
import {
  actionExcelColour,
  getActorUniqueKey,
  isCheckedAuditLog,
  isHiddenAuditLog,
  isRefundAuditLog,
  isUncheckedAuditLog,
} from "./audit-log-utils";

export async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string) {
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

export function setThinBorder(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: "thin", color: { argb: "FFE5E7EB" } },
    left: { style: "thin", color: { argb: "FFE5E7EB" } },
    bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
    right: { style: "thin", color: { argb: "FFE5E7EB" } },
  };
}

export function styleTitleCell(cell: ExcelJS.Cell) {
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

export function styleSubtitleCell(cell: ExcelJS.Cell) {
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

export function styleSectionCell(cell: ExcelJS.Cell, colour = "FF334155") {
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

export function styleHeaderRow(row: ExcelJS.Row, colour = "FF111827") {
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

export function styleBodyRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.alignment = {
      vertical: "top",
      wrapText: true,
    };

    setThinBorder(cell);
  });
}

export function addMergedTitle(
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

export function addMergedSubtitle(
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

export function addMergedSection(
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

export function styleActionCell(
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

export function styleMutedCell(cell: ExcelJS.Cell) {
  cell.font = {
    color: { argb: "FF6B7280" },
  };
}

export function styleSuccessCell(cell: ExcelJS.Cell) {
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

export function styleDangerCell(cell: ExcelJS.Cell) {
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

export function makeSummaryRows(logs: MoneyAuditLog[]) {
  const hidden = logs.filter((log) => isHiddenAuditLog(log)).length;
  const deleted = logs.filter(
    (log) =>
      !isHiddenAuditLog(log) &&
      (log.action === "delete" ||
        log.action === "delete_year" ||
        log.action === "delete_all" ||
        log.action === "refund_permanently_deleted"),
  ).length;

  const refundLogs = logs.filter((log) => isRefundAuditLog(log)).length;
  const refundHidden = logs.filter((log) => log.action === "refund_hide").length;
  const refundDeleted = logs.filter(
    (log) => log.action === "refund_permanently_deleted",
  ).length;
  const refundRestored = logs.filter(
    (log) => log.action === "refund_restore",
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
      label: "Refund logs",
      value: refundLogs,
      notes: "All refund tracker actions.",
    },
    {
      label: "Refunds hidden",
      value: refundHidden,
      notes: "Refunds moved into Deleted Refunds.",
    },
    {
      label: "Refunds permanently deleted",
      value: refundDeleted,
      notes: "Refund records permanently removed from Supabase.",
    },
    {
      label: "Refunds restored",
      value: refundRestored,
      notes: "Refunds returned to the active Refund Tracker.",
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
