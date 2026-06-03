import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

import { requireAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MoneyTransaction = Record<string, any>;

function pounds(pence: number | null | undefined) {
  return Number(pence || 0) / 100;
}

function pence(value: any) {
  return Number(value || 0);
}

function safeText(value: any, fallback = "None") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function safeJson(value: any) {
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

  return date.toLocaleDateString("en-GB");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "None";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("en-GB");
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
  colour = "FF0284C7"
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

function isPersonalFundsTransaction(item: MoneyTransaction) {
  return Boolean(item.is_personal_funds);
}

function sourceLabel(source?: string | null) {
  if (source === "website_donation") return "Website Donation";
  if (source === "website_monthly_donation") return "Website Monthly Donation";
  if (source === "sponsorship") return "Sponsorship / Funding";
  if (source === "manual") return "Manual";
  if (source === "stripe") return "Stripe";
  if (!source) return "Manual";
  return String(source).replaceAll("_", " ");
}

function repaymentStatus(item: MoneyTransaction) {
  if (!isPersonalFundsTransaction(item)) return "Not personal funds";
  return item.personal_funds_repaid ? "Paid back" : "Not paid back";
}

function getPersonName(item: MoneyTransaction) {
  return (
    item.personal_funds_name ||
    item.paid_by ||
    item.created_by_name ||
    item.created_by ||
    "Unknown person"
  );
}

function getReceiptUrl(item: MoneyTransaction) {
  return (
    item.invoice_image_url ||
    item.receipt_url ||
    item.receipt_image_url ||
    item.invoice_url ||
    ""
  );
}

function receiptStatus(item: MoneyTransaction) {
  return getReceiptUrl(item) ? "Receipt / proof attached" : "Missing receipt / proof";
}

function groupByPerson(transactions: MoneyTransaction[]) {
  return transactions.reduce((acc: Record<string, any>, item) => {
    const person = getPersonName(item);
    const amount = pence(item.amount_pence);

    if (!acc[person]) {
      acc[person] = {
        person,
        total_pence: 0,
        repaid_pence: 0,
        outstanding_pence: 0,
        count: 0,
        repaid_count: 0,
        outstanding_count: 0,
      };
    }

    acc[person].total_pence += amount;
    acc[person].count += 1;

    if (item.personal_funds_repaid) {
      acc[person].repaid_pence += amount;
      acc[person].repaid_count += 1;
    } else {
      acc[person].outstanding_pence += amount;
      acc[person].outstanding_count += 1;
    }

    return acc;
  }, {});
}

async function loadPersonalFundTransactions(year: number) {
  const { data, error } = await supabaseAdmin
    .from("money_transactions")
    .select("*, attachments:money_transaction_attachments(*)")
    .gte("transaction_date", `${year}-01-01`)
    .lt("transaction_date", `${year + 1}-01-01`)
    .is("deleted_at", null)
    .eq("is_personal_funds", true)
    .order("transaction_date", { ascending: true });

  if (error) {
    throw {
      message: "Could not load personal funds transactions.",
      details: {
        message: error.message,
        hint: error.hint,
        code: error.code,
        table: "money_transactions",
        expectedFile:
          "app/api/admin/money/export/personal-funds-export/route.ts",
        likelyFix:
          "Check money_transactions table has is_personal_funds, transaction_date, deleted_at, amount_pence, personal_funds_name, personal_funds_repaid and personal_funds_repaid_at columns.",
      },
    };
  }

  return data || [];
}

function addPersonalFundRow(sheet: ExcelJS.Worksheet, item: MoneyTransaction) {
  const row = sheet.addRow({
    date: formatDate(item.transaction_date || item.created_at),
    title: safeText(item.title, "Untitled"),
    description: safeText(item.description),
    person: getPersonName(item),
    amount: pounds(item.amount_pence),
    repaid: item.personal_funds_repaid ? "Yes" : "No",
    repaymentStatus: repaymentStatus(item),
    repaidAt: item.personal_funds_repaid_at
      ? formatDate(item.personal_funds_repaid_at)
      : "Not paid back",
    paymentMethod: safeText(item.payment_method),
    source: sourceLabel(item.source),
    receiptStatus: receiptStatus(item),
    receiptUrl: safeText(getReceiptUrl(item)),
    category: safeText(item.category),
    createdAt: formatDateTime(item.created_at),
    transactionId: safeText(item.id),
  });

  styleBodyRow(row);
  styleCurrencyCell(row.getCell("amount"), true);

  row.getCell("title").font = {
    bold: true,
    color: { argb: "FF111827" },
  };

  row.getCell("person").font = {
    bold: true,
    color: { argb: "FF075985" },
  };

  if (item.personal_funds_repaid) {
    row.getCell("repaid").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDCFCE7" },
    };

    row.getCell("repaid").font = {
      bold: true,
      color: { argb: "FF166534" },
    };

    row.getCell("repaymentStatus").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDCFCE7" },
    };

    row.getCell("repaymentStatus").font = {
      bold: true,
      color: { argb: "FF166534" },
    };
  } else {
    row.getCell("repaid").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFEE2E2" },
    };

    row.getCell("repaid").font = {
      bold: true,
      color: { argb: "FF991B1B" },
    };

    row.getCell("repaymentStatus").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFEE2E2" },
    };

    row.getCell("repaymentStatus").font = {
      bold: true,
      color: { argb: "FF991B1B" },
    };
  }

  if (getReceiptUrl(item)) {
    row.getCell("receiptStatus").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDCFCE7" },
    };

    row.getCell("receiptStatus").font = {
      bold: true,
      color: { argb: "FF166534" },
    };
  } else {
    row.getCell("receiptStatus").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFEF3C7" },
    };

    row.getCell("receiptStatus").font = {
      bold: true,
      color: { argb: "FF92400E" },
    };
  }
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
    const selectedYear = String(year);
    const fileDate = new Date().toISOString().slice(0, 10);
    const transactions = await loadPersonalFundTransactions(year);

    const repaidTransactions = transactions.filter(
      (item: any) => item.personal_funds_repaid
    );

    const outstandingTransactions = transactions.filter(
      (item: any) => !item.personal_funds_repaid
    );

    const totalPence = transactions.reduce(
      (sum: number, item: any) => sum + pence(item.amount_pence),
      0
    );

    const repaidPence = repaidTransactions.reduce(
      (sum: number, item: any) => sum + pence(item.amount_pence),
      0
    );

    const outstandingPence = outstandingTransactions.reduce(
      (sum: number, item: any) => sum + pence(item.amount_pence),
      0
    );

    const peopleTotals = Object.values(groupByPerson(transactions));

    const workbook = new ExcelJS.Workbook();

    workbook.creator = "Burton Pride C.I.C";
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.subject = "Personal funds report";
    workbook.title = "Burton Pride Personal Funds Report";
    workbook.company = "Burton Pride C.I.C";

    /**
     * SHEET 1: SUMMARY
     */
    const summarySheet = workbook.addWorksheet("Personal Funds Summary", {
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
      { key: "amount", width: 18 },
      { key: "count", width: 14 },
      { key: "notes", width: 70 },
    ];

    addMergedTitle(
      summarySheet,
      "Burton Pride C.I.C - Personal Funds Report",
      "A1",
      "D1"
    );

    addMergedSubtitle(
      summarySheet,
      `Year: Jan to Dec ${selectedYear} | Generated: ${new Date().toLocaleString(
        "en-GB"
      )}`,
      "A2",
      "D2"
    );

    summarySheet.addRow([]);

    addMergedSection(summarySheet, "Personal Funds Summary", "A4", "D4");

    const summaryHeader = summarySheet.addRow([
      "Item",
      "Amount",
      "Count",
      "Notes",
    ]);
    styleHeaderRow(summaryHeader, "FF111827");

    const summaryRows: Array<[string, number, number, string]> = [
      [
        "Total personal funds paid",
        pounds(totalPence),
        transactions.length,
        "All items marked as paid personally by someone on behalf of Burton Pride.",
      ],
      [
        "Personal funds paid back",
        pounds(repaidPence),
        repaidTransactions.length,
        "Items marked as paid back.",
      ],
      [
        "Personal funds still owed",
        pounds(outstandingPence),
        outstandingTransactions.length,
        "Items not yet marked as paid back.",
      ],
    ];

    summaryRows.forEach(([label, amount, count, notes]) => {
      const row = summarySheet.addRow([label, amount, count, notes]);
      styleBodyRow(row);
      row.getCell(1).font = { bold: true };
      styleCurrencyCell(row.getCell(2), true);
      row.getCell(3).alignment = {
        horizontal: "center",
        vertical: "top",
      };
      row.getCell(3).font = { bold: true };
    });

    summarySheet.addRow([]);

    addMergedSection(summarySheet, "Person Breakdown", "A10", "D10", "FF075985");

    const peopleHeader = summarySheet.addRow([
      "Person",
      "Total",
      "Repaid",
      "Outstanding",
    ]);
    styleHeaderRow(peopleHeader, "FF075985");

    if (peopleTotals.length === 0) {
      const row = summarySheet.addRow([
        "No personal funds found for this year.",
      ]);
      styleBodyRow(row);
    } else {
      peopleTotals
        .sort((a: any, b: any) => String(a.person).localeCompare(b.person))
        .forEach((person: any) => {
          const row = summarySheet.addRow([
            person.person,
            pounds(person.total_pence),
            pounds(person.repaid_pence),
            pounds(person.outstanding_pence),
          ]);

          styleBodyRow(row);
          row.getCell(1).font = { bold: true };
          styleCurrencyCell(row.getCell(2), true);
          styleCurrencyCell(row.getCell(3), true);
          styleCurrencyCell(row.getCell(4), true);
        });
    }

    /**
     * SHEET 2: ALL PERSONAL FUNDS
     */
    const allSheet = workbook.addWorksheet("All Personal Funds", {
      views: [{ state: "frozen", ySplit: 4 }],
      pageSetup: {
        paperSize: 9,
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });

    allSheet.columns = [
      { key: "date", width: 16 },
      { key: "title", width: 32 },
      { key: "description", width: 42 },
      { key: "person", width: 26 },
      { key: "amount", width: 16 },
      { key: "repaid", width: 14 },
      { key: "repaymentStatus", width: 22 },
      { key: "repaidAt", width: 18 },
      { key: "paymentMethod", width: 22 },
      { key: "source", width: 24 },
      { key: "receiptStatus", width: 24 },
      { key: "receiptUrl", width: 55 },
      { key: "category", width: 24 },
      { key: "createdAt", width: 24 },
      { key: "transactionId", width: 40 },
    ];

    addMergedTitle(
      allSheet,
      "Burton Pride C.I.C - All Personal Funds",
      "A1",
      "O1"
    );

    addMergedSubtitle(
      allSheet,
      `Year: Jan to Dec ${selectedYear} | Rows: ${transactions.length}`,
      "A2",
      "O2"
    );

    allSheet.addRow([]);

    const allHeader = allSheet.addRow([
      "Date",
      "Title",
      "Description",
      "Person",
      "Amount",
      "Paid Back",
      "Repayment Status",
      "Paid Back At",
      "Payment Method",
      "Source",
      "Receipt Status",
      "Receipt URL",
      "Category",
      "Created At",
      "Transaction ID",
    ]);

    styleHeaderRow(allHeader, "FF0284C7");

    if (transactions.length === 0) {
      const row = allSheet.addRow([`No personal funds found for ${selectedYear}`]);
      styleBodyRow(row);
    } else {
      transactions.forEach((item: any) => {
        addPersonalFundRow(allSheet, item);
      });
    }

    allSheet.autoFilter = {
      from: "A4",
      to: "O4",
    };

    /**
     * SHEET 3: OUTSTANDING
     */
    const outstandingSheet = workbook.addWorksheet("Outstanding", {
      views: [{ state: "frozen", ySplit: 4 }],
      pageSetup: {
        paperSize: 9,
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });

    outstandingSheet.columns = allSheet.columns;

    addMergedTitle(
      outstandingSheet,
      "Burton Pride C.I.C - Personal Funds Still Owed",
      "A1",
      "O1"
    );

    addMergedSubtitle(
      outstandingSheet,
      `Year: Jan to Dec ${selectedYear} | Rows: ${outstandingTransactions.length}`,
      "A2",
      "O2"
    );

    outstandingSheet.addRow([]);

    const outstandingHeader = outstandingSheet.addRow([
      "Date",
      "Title",
      "Description",
      "Person",
      "Amount",
      "Paid Back",
      "Repayment Status",
      "Paid Back At",
      "Payment Method",
      "Source",
      "Receipt Status",
      "Receipt URL",
      "Category",
      "Created At",
      "Transaction ID",
    ]);

    styleHeaderRow(outstandingHeader, "FFB91C1C");

    if (outstandingTransactions.length === 0) {
      const row = outstandingSheet.addRow([
        `No outstanding personal funds for ${selectedYear}`,
      ]);
      styleBodyRow(row);
    } else {
      outstandingTransactions.forEach((item: any) => {
        addPersonalFundRow(outstandingSheet, item);
      });
    }

    outstandingSheet.autoFilter = {
      from: "A4",
      to: "O4",
    };

    /**
     * SHEET 4: PAID BACK
     */
    const paidBackSheet = workbook.addWorksheet("Paid Back", {
      views: [{ state: "frozen", ySplit: 4 }],
      pageSetup: {
        paperSize: 9,
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });

    paidBackSheet.columns = allSheet.columns;

    addMergedTitle(
      paidBackSheet,
      "Burton Pride C.I.C - Personal Funds Paid Back",
      "A1",
      "O1"
    );

    addMergedSubtitle(
      paidBackSheet,
      `Year: Jan to Dec ${selectedYear} | Rows: ${repaidTransactions.length}`,
      "A2",
      "O2"
    );

    paidBackSheet.addRow([]);

    const paidBackHeader = paidBackSheet.addRow([
      "Date",
      "Title",
      "Description",
      "Person",
      "Amount",
      "Paid Back",
      "Repayment Status",
      "Paid Back At",
      "Payment Method",
      "Source",
      "Receipt Status",
      "Receipt URL",
      "Category",
      "Created At",
      "Transaction ID",
    ]);

    styleHeaderRow(paidBackHeader, "FF047857");

    if (repaidTransactions.length === 0) {
      const row = paidBackSheet.addRow([
        `No paid back personal funds for ${selectedYear}`,
      ]);
      styleBodyRow(row);
    } else {
      repaidTransactions.forEach((item: any) => {
        addPersonalFundRow(paidBackSheet, item);
      });
    }

    paidBackSheet.autoFilter = {
      from: "A4",
      to: "O4",
    };

    /**
     * SHEET 5: RAW DEBUG
     */
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
      "Burton Pride C.I.C - Raw Personal Funds Data",
      "A1",
      "C1"
    );

    addMergedSubtitle(
      rawSheet,
      "Raw personal funds transaction data for checking and debugging.",
      "A2",
      "C2"
    );

    rawSheet.addRow([]);

    const rawHeader = rawSheet.addRow(["ID", "Created At", "Raw Data"]);
    styleHeaderRow(rawHeader, "FF111827");

    transactions.forEach((item: any) => {
      const row = rawSheet.addRow({
        id: item.id || "",
        createdAt: item.created_at || "",
        raw: safeJson(item),
      });

      styleBodyRow(row);
    });

    rawSheet.autoFilter = {
      from: "A4",
      to: "C4",
    };

    [summarySheet, allSheet, outstandingSheet, paidBackSheet, rawSheet].forEach(
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

    const excelBuffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(excelBuffer as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="burton-pride-personal-funds-${selectedYear}-${fileDate}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("Personal funds export error:", error);

    return NextResponse.json(
      {
        error: error?.message || "Failed to create personal funds export.",
        details: {
          message: error?.message || String(error),
          route: "/api/admin/money/export/personal-funds-export",
          expectedFile:
            "app/api/admin/money/export/personal-funds-export/route.ts",
          likelyFix:
            "Check money_transactions columns, money_transaction_attachments table, ExcelJS installation, and server logs.",
          raw: error?.details || null,
        },
      },
      {
        status: 500,
      }
    );
  }
}