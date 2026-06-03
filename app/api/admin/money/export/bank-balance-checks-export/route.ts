import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

import { requireAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BANK_CHECK_TABLES = [
  "money_bank_balance_checks",
  "admin_money_bank_balance_checks",
  "bank_balance_checks",
];

type BankBalanceCheck = Record<string, any>;

function poundsFromPence(pence: number | null | undefined) {
  return Number(pence || 0) / 100;
}

function penceValue(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function safeText(value: unknown, fallback = "None") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function safeJson(value: unknown) {
  if (value === null || value === undefined) return "";

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return "None";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("en-GB");
}

function getCheckDate(item: BankBalanceCheck) {
  return (
    item.check_date ||
    item.bank_statement_date ||
    item.statement_date ||
    item.created_at ||
    item.updated_at ||
    null
  );
}

function getCreatedDate(item: BankBalanceCheck) {
  return item.created_at || item.createdAt || item.updated_at || null;
}

function getBankBalancePence(item: BankBalanceCheck) {
  return (
    penceValue(item.bank_balance_pence) ||
    penceValue(item.statement_balance_pence) ||
    penceValue(item.real_bank_balance_pence) ||
    penceValue(item.actual_balance_pence) ||
    Math.round(Number(item.bank_balance || item.statement_balance || 0) * 100)
  );
}

function getTrackerBalancePence(item: BankBalanceCheck) {
  return (
    penceValue(item.tracker_balance_pence) ||
    penceValue(item.money_tracker_balance_pence) ||
    penceValue(item.system_balance_pence) ||
    penceValue(item.expected_balance_pence) ||
    Math.round(
      Number(item.tracker_balance || item.money_tracker_balance || 0) * 100
    )
  );
}

function getDifferencePence(item: BankBalanceCheck) {
  if (
    item.difference_pence !== null &&
    item.difference_pence !== undefined &&
    item.difference_pence !== ""
  ) {
    return penceValue(item.difference_pence);
  }

  if (
    item.balance_difference_pence !== null &&
    item.balance_difference_pence !== undefined &&
    item.balance_difference_pence !== ""
  ) {
    return penceValue(item.balance_difference_pence);
  }

  return getBankBalancePence(item) - getTrackerBalancePence(item);
}

function getCheckedBy(item: BankBalanceCheck) {
  return (
    item.checked_by ||
    item.created_by ||
    item.created_by_name ||
    item.actor_name ||
    item.user_name ||
    item.admin_name ||
    "Unknown user"
  );
}

function getCheckedByEmail(item: BankBalanceCheck) {
  return (
    item.checked_by_email ||
    item.created_by_email ||
    item.actor_email ||
    item.user_email ||
    item.admin_email ||
    ""
  );
}

function getStatus(item: BankBalanceCheck) {
  const difference = getDifferencePence(item);
  const status = String(item.status || item.check_status || "").toLowerCase();

  if (status) {
    if (status === "matched") return "Matched";
    if (status === "balanced") return "Matched";
    if (status === "needs_review") return "Needs review";
    if (status === "unreconciled") return "Unreconciled";
    if (status === "resolved") return "Resolved";
    return status.replaceAll("_", " ");
  }

  if (difference === 0) return "Matched";
  return "Needs review";
}

function getNotes(item: BankBalanceCheck) {
  return (
    item.notes ||
    item.note ||
    item.check_notes ||
    item.reconciliation_note ||
    item.balance_note ||
    ""
  );
}

function getStatementName(item: BankBalanceCheck) {
  return (
    item.statement_name ||
    item.bank_statement_name ||
    item.file_name ||
    item.statement_file_name ||
    "Manual bank balance check"
  );
}

function getStatementUrl(item: BankBalanceCheck) {
  return (
    item.statement_url ||
    item.bank_statement_url ||
    item.file_url ||
    item.statement_file_url ||
    item.attachment_url ||
    ""
  );
}

function isInYear(item: BankBalanceCheck, year: number) {
  const dateValue = getCheckDate(item);

  if (!dateValue) return true;

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return true;

  return date.getFullYear() === year;
}

function styleHeaderRow(row: ExcelJS.Row, argb = "FF111827") {
  row.eachCell((cell) => {
    cell.font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
    };

    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb },
    };

    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };

    cell.border = {
      top: { style: "thin", color: { argb: "FFD1D5DB" } },
      left: { style: "thin", color: { argb: "FFD1D5DB" } },
      bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
      right: { style: "thin", color: { argb: "FFD1D5DB" } },
    };
  });

  row.height = 24;
}

function styleBodyRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.alignment = {
      vertical: "top",
      wrapText: true,
    };

    cell.border = {
      top: { style: "thin", color: { argb: "FFE5E7EB" } },
      left: { style: "thin", color: { argb: "FFE5E7EB" } },
      bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
      right: { style: "thin", color: { argb: "FFE5E7EB" } },
    };
  });
}

function styleCurrencyCell(cell: ExcelJS.Cell, bold = false) {
  cell.numFmt = "£#,##0.00;[Red]-£#,##0.00";
  cell.font = { bold };
  cell.alignment = {
    horizontal: "right",
    vertical: "top",
  };
}

function styleStatusCell(cell: ExcelJS.Cell, status: string) {
  const clean = status.toLowerCase();

  if (clean.includes("matched") || clean.includes("resolved")) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDCFCE7" },
    };
    cell.font = {
      bold: true,
      color: { argb: "FF166534" },
    };
    return;
  }

  if (clean.includes("review") || clean.includes("unreconciled")) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFEF3C7" },
    };
    cell.font = {
      bold: true,
      color: { argb: "FF92400E" },
    };
    return;
  }

  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF3F4F6" },
  };
  cell.font = {
    bold: true,
    color: { argb: "FF374151" },
  };
}

function styleDifferenceCell(cell: ExcelJS.Cell, differencePence: number) {
  styleCurrencyCell(cell, true);

  if (differencePence === 0) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDCFCE7" },
    };
    cell.font = {
      bold: true,
      color: { argb: "FF166534" },
    };
    return;
  }

  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFEE2E2" },
  };
  cell.font = {
    bold: true,
    color: { argb: "FF991B1B" },
  };
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
  cell.font = {
    bold: true,
    size: 18,
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

function addMergedSubtitle(
  worksheet: ExcelJS.Worksheet,
  text: string,
  fromCell: string,
  toCell: string
) {
  worksheet.mergeCells(`${fromCell}:${toCell}`);

  const cell = worksheet.getCell(fromCell);

  cell.value = text;
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

function addMergedSection(
  worksheet: ExcelJS.Worksheet,
  text: string,
  fromCell: string,
  toCell: string,
  colour = "FF0F766E"
) {
  worksheet.mergeCells(`${fromCell}:${toCell}`);

  const cell = worksheet.getCell(fromCell);

  cell.value = text;
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

async function loadBankChecks(year: number) {
  const attempts: any[] = [];

  for (const table of BANK_CHECK_TABLES) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select("*")
      .limit(5000);

    if (error) {
      attempts.push({
        table,
        message: error.message,
        hint: error.hint,
        code: error.code,
      });

      continue;
    }

    return {
      table,
      rows: (data || []).filter((item: BankBalanceCheck) =>
        isInYear(item, year)
      ),
      attempts,
    };
  }

  throw {
    message: "Could not find a bank balance checks table.",
    details: {
      attemptedTables: attempts,
      possibleTables: BANK_CHECK_TABLES,
      likelyFix:
        "Create money_bank_balance_checks or update BANK_CHECK_TABLES at the top of this route file to match your real table name.",
    },
  };
}

export async function GET(req: Request) {
  try {
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

    const selectedYear = String(year);
    const fileDate = new Date().toISOString().slice(0, 10);

    const { table, rows, attempts } = await loadBankChecks(year);

    const totalChecks = rows.length;

    const matchedChecks = rows.filter(
      (item) => getDifferencePence(item) === 0
    ).length;

    const reviewChecks = rows.filter(
      (item) => getDifferencePence(item) !== 0
    ).length;

    const totalDifferencePence = rows.reduce(
      (sum: number, item: BankBalanceCheck) => sum + getDifferencePence(item),
      0
    );

    const latestCheck = [...rows].sort(
      (a, b) =>
        new Date(getCheckDate(b) || "").getTime() -
        new Date(getCheckDate(a) || "").getTime()
    )[0];

    const workbook = new ExcelJS.Workbook();

    workbook.creator = "Burton Pride C.I.C";
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.subject = "Bank balance checks report";
    workbook.title = "Burton Pride Bank Balance Checks";
    workbook.company = "Burton Pride C.I.C";

    const summarySheet = workbook.addWorksheet("Bank Check Summary", {
      views: [{ state: "frozen", ySplit: 5 }],
      pageSetup: {
        paperSize: 9,
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });

    summarySheet.columns = [
      { key: "label", width: 34 },
      { key: "value", width: 24 },
      { key: "notes", width: 78 },
    ];

    addMergedTitle(
      summarySheet,
      "Burton Pride C.I.C - Bank Balance Checks",
      "A1",
      "C1"
    );

    addMergedSubtitle(
      summarySheet,
      `Year: Jan to Dec ${selectedYear} | Generated: ${new Date().toLocaleString(
        "en-GB"
      )}`,
      "A2",
      "C2"
    );

    summarySheet.addRow([]);

    addMergedSection(summarySheet, "Bank Balance Summary", "A4", "C4");

    const summaryHeader = summarySheet.addRow(["Item", "Value", "Notes"]);
    styleHeaderRow(summaryHeader, "FF111827");

    const summaryRows: Array<[string, string | number, string]> = [
      ["Table used", table, "Supabase table used for this export."],
      [
        "Total checks",
        totalChecks,
        "Number of bank checks in the selected year.",
      ],
      [
        "Matched checks",
        matchedChecks,
        "Checks where bank balance and tracker balance match.",
      ],
      [
        "Needs review checks",
        reviewChecks,
        "Checks where the balances do not match.",
      ],
      [
        "Total difference",
        poundsFromPence(totalDifferencePence).toFixed(2),
        "Total of all bank minus tracker differences.",
      ],
      [
        "Latest check",
        latestCheck ? formatDate(getCheckDate(latestCheck)) : "None",
        "Most recent bank balance check found.",
      ],
    ];

    summaryRows.forEach(([label, value, notes]) => {
      const row = summarySheet.addRow([label, value, notes]);
      styleBodyRow(row);
      row.getCell(1).font = { bold: true };
      row.getCell(2).font = { bold: true };
    });

    summarySheet.addRow([]);

    addMergedSection(summarySheet, "Tables Tried", "A13", "C13", "FF334155");

    const triedHeader = summarySheet.addRow(["Table", "Result", "Details"]);
    styleHeaderRow(triedHeader, "FF334155");

    if (attempts.length === 0) {
      const row = summarySheet.addRow([
        table,
        "Used",
        "This was the first table tried and it loaded successfully.",
      ]);
      styleBodyRow(row);
    } else {
      attempts.forEach((attempt) => {
        const row = summarySheet.addRow([
          attempt.table,
          "Failed",
          safeJson(attempt),
        ]);
        styleBodyRow(row);
      });

      const usedRow = summarySheet.addRow([
        table,
        "Used",
        "This table loaded successfully.",
      ]);
      styleBodyRow(usedRow);
    }

    const checksSheet = workbook.addWorksheet("Bank Checks", {
      views: [{ state: "frozen", ySplit: 4 }],
      pageSetup: {
        paperSize: 9,
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });

    checksSheet.columns = [
      { key: "date", width: 24 },
      { key: "status", width: 20 },
      { key: "bankBalance", width: 18 },
      { key: "trackerBalance", width: 18 },
      { key: "difference", width: 18 },
      { key: "checkedBy", width: 28 },
      { key: "checkedByEmail", width: 34 },
      { key: "notes", width: 55 },
      { key: "statementName", width: 34 },
      { key: "statementUrl", width: 55 },
      { key: "createdAt", width: 24 },
      { key: "id", width: 40 },
    ];

    addMergedTitle(
      checksSheet,
      "Burton Pride C.I.C - Bank Balance Check List",
      "A1",
      "L1"
    );

    addMergedSubtitle(
      checksSheet,
      `Year: Jan to Dec ${selectedYear} | Rows: ${rows.length} | Table: ${table}`,
      "A2",
      "L2"
    );

    checksSheet.addRow([]);

    const checksHeader = checksSheet.addRow([
      "Check Date",
      "Status",
      "Bank Statement Balance",
      "Money Tracker Balance",
      "Difference",
      "Checked By",
      "Checked By Email",
      "Notes",
      "Statement / File",
      "Statement URL",
      "Created At",
      "Check ID",
    ]);

    styleHeaderRow(checksHeader, "FF0F766E");

    if (rows.length === 0) {
      const row = checksSheet.addRow([
        `No bank balance checks found for ${selectedYear}.`,
      ]);
      styleBodyRow(row);
    } else {
      rows.forEach((item: BankBalanceCheck) => {
        const status = getStatus(item);
        const difference = getDifferencePence(item);

        const row = checksSheet.addRow({
          date: formatDate(getCheckDate(item)),
          status,
          bankBalance: poundsFromPence(getBankBalancePence(item)),
          trackerBalance: poundsFromPence(getTrackerBalancePence(item)),
          difference: poundsFromPence(difference),
          checkedBy: getCheckedBy(item),
          checkedByEmail: getCheckedByEmail(item),
          notes: safeText(getNotes(item), ""),
          statementName: getStatementName(item),
          statementUrl: safeText(getStatementUrl(item), ""),
          createdAt: formatDate(getCreatedDate(item)),
          id: safeText(item.id, ""),
        });

        styleBodyRow(row);
        styleStatusCell(row.getCell("status"), status);
        styleCurrencyCell(row.getCell("bankBalance"), true);
        styleCurrencyCell(row.getCell("trackerBalance"), true);
        styleDifferenceCell(row.getCell("difference"), difference);
        row.getCell("checkedBy").font = { bold: true };
      });
    }

    checksSheet.autoFilter = {
      from: "A4",
      to: "L4",
    };

    const reviewSheet = workbook.addWorksheet("Needs Review", {
      views: [{ state: "frozen", ySplit: 4 }],
      pageSetup: {
        paperSize: 9,
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });

    reviewSheet.columns = checksSheet.columns;

    addMergedTitle(
      reviewSheet,
      "Burton Pride C.I.C - Bank Checks Needing Review",
      "A1",
      "L1"
    );

    addMergedSubtitle(
      reviewSheet,
      `Year: Jan to Dec ${selectedYear} | Rows: ${reviewChecks}`,
      "A2",
      "L2"
    );

    reviewSheet.addRow([]);

    const reviewHeader = reviewSheet.addRow([
      "Check Date",
      "Status",
      "Bank Statement Balance",
      "Money Tracker Balance",
      "Difference",
      "Checked By",
      "Checked By Email",
      "Notes",
      "Statement / File",
      "Statement URL",
      "Created At",
      "Check ID",
    ]);

    styleHeaderRow(reviewHeader, "FFB91C1C");

    const reviewRows = rows.filter(
      (item: BankBalanceCheck) => getDifferencePence(item) !== 0
    );

    if (reviewRows.length === 0) {
      const row = reviewSheet.addRow([
        `No bank balance checks need review for ${selectedYear}.`,
      ]);
      styleBodyRow(row);
    } else {
      reviewRows.forEach((item: BankBalanceCheck) => {
        const status = getStatus(item);
        const difference = getDifferencePence(item);

        const row = reviewSheet.addRow({
          date: formatDate(getCheckDate(item)),
          status,
          bankBalance: poundsFromPence(getBankBalancePence(item)),
          trackerBalance: poundsFromPence(getTrackerBalancePence(item)),
          difference: poundsFromPence(difference),
          checkedBy: getCheckedBy(item),
          checkedByEmail: getCheckedByEmail(item),
          notes: safeText(getNotes(item), ""),
          statementName: getStatementName(item),
          statementUrl: safeText(getStatementUrl(item), ""),
          createdAt: formatDate(getCreatedDate(item)),
          id: safeText(item.id, ""),
        });

        styleBodyRow(row);
        styleStatusCell(row.getCell("status"), status);
        styleCurrencyCell(row.getCell("bankBalance"), true);
        styleCurrencyCell(row.getCell("trackerBalance"), true);
        styleDifferenceCell(row.getCell("difference"), difference);
        row.getCell("checkedBy").font = { bold: true };
      });
    }

    reviewSheet.autoFilter = {
      from: "A4",
      to: "L4",
    };

    const rawSheet = workbook.addWorksheet("Raw Debug", {
      views: [{ state: "frozen", ySplit: 4 }],
      pageSetup: {
        paperSize: 9,
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });

    rawSheet.columns = [
      { key: "id", width: 40 },
      { key: "createdAt", width: 28 },
      { key: "raw", width: 120 },
    ];

    addMergedTitle(
      rawSheet,
      "Burton Pride C.I.C - Raw Bank Balance Checks",
      "A1",
      "C1"
    );

    addMergedSubtitle(rawSheet, `Raw data from table: ${table}`, "A2", "C2");

    rawSheet.addRow([]);

    const rawHeader = rawSheet.addRow(["ID", "Created At", "Raw Data"]);
    styleHeaderRow(rawHeader, "FF111827");

    rows.forEach((item: BankBalanceCheck) => {
      const row = rawSheet.addRow({
        id: safeText(item.id, ""),
        createdAt: formatDate(getCreatedDate(item)),
        raw: safeJson(item),
      });

      styleBodyRow(row);
    });

    rawSheet.autoFilter = {
      from: "A4",
      to: "C4",
    };

    [summarySheet, checksSheet, reviewSheet, rawSheet].forEach((sheet) => {
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

    const excelBuffer = await workbook.xlsx.writeBuffer();
    const bytes = new Uint8Array(excelBuffer as ArrayBuffer);

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="burton-pride-bank-balance-checks-${selectedYear}-${fileDate}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("Bank balance checks export error:", error);

    return NextResponse.json(
      {
        error:
          error?.message || "Failed to create bank balance checks export.",
        details: {
          message: error?.message || String(error),
          route: "/api/admin/money/export/bank-balance-checks-export",
          expectedFile:
            "app/api/admin/money/export/bank-balance-checks-export/route.ts",
          likelyFix:
            "Check your bank balance checks table name. This route tries money_bank_balance_checks, admin_money_bank_balance_checks and bank_balance_checks. If your table name is different, update BANK_CHECK_TABLES at the top of this file.",
          raw: error?.details || null,
        },
      },
      {
        status: 500,
      }
    );
  }
}