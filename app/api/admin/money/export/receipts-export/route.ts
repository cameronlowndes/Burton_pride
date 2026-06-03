import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

import { requireAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function moneyFromPence(pence: number | null | undefined) {
  return Number(pence || 0) / 100;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";

  try {
    return new Date(value).toLocaleDateString("en-GB");
  } catch {
    return value;
  }
}

function normaliseText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function addTitle(sheet: ExcelJS.Worksheet, title: string, mergeTo = "J1") {
  sheet.mergeCells(`A1:${mergeTo}`);

  const cell = sheet.getCell("A1");
  cell.value = title;
  cell.font = {
    bold: true,
    size: 18,
    color: { argb: "FFFFFFFF" },
  };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" },
  };
  cell.alignment = {
    vertical: "middle",
    horizontal: "left",
  };

  sheet.getRow(1).height = 32;
}

function styleHeader(row: ExcelJS.Row) {
  row.font = {
    bold: true,
    color: { argb: "FFFFFFFF" },
  };

  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E293B" },
    };

    cell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };

    cell.alignment = {
      vertical: "middle",
      horizontal: "left",
      wrapText: true,
    };
  });
}

function styleSectionTitle(row: ExcelJS.Row) {
  row.font = {
    bold: true,
    size: 13,
    color: { argb: "FFFFFFFF" },
  };

  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF334155" },
    };
  });
}

function styleMoneyColumn(sheet: ExcelJS.Worksheet, columnNumber: number) {
  sheet.getColumn(columnNumber).numFmt = "£#,##0.00;[Red]-£#,##0.00";
}

function applyBorders(sheet: ExcelJS.Worksheet) {
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };

      cell.alignment = {
        vertical: "middle",
        wrapText: true,
      };
    });
  });
}

function typeLabel(type: string | null | undefined) {
  if (type === "income") return "Income";
  if (type === "expense") return "Expense";
  return normaliseText(type);
}

function hasReceipt(item: any) {
  return Boolean(
    item?.invoice_image_url ||
      item?.receipt_url ||
      item?.receipt_image_url ||
      item?.invoice_url
  );
}

function getReceiptUrl(item: any) {
  return (
    item?.invoice_image_url ||
    item?.receipt_url ||
    item?.receipt_image_url ||
    item?.invoice_url ||
    ""
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

  const startDate = `${year}-01-01`;
  const endDate = `${year + 1}-01-01`;

  try {
    const { data, error } = await supabaseAdmin
      .from("money_transactions")
      .select("*")
      .gte("transaction_date", startDate)
      .lt("transaction_date", endDate)
      .is("deleted_at", null)
      .order("transaction_date", { ascending: true });

    if (error) {
      return NextResponse.json(
        {
          error: "Could not load money transactions for receipts export.",
          details: {
            message: error.message,
            hint: error.hint,
            code: error.code,
            table: "money_transactions",
          },
        },
        {
          status: 500,
        }
      );
    }

    const transactions = data || [];

    const transactionsWithReceipts = transactions.filter((item: any) =>
      hasReceipt(item)
    );

    const transactionsMissingReceipts = transactions.filter(
      (item: any) => !hasReceipt(item)
    );

    const expenseTransactions = transactions.filter(
      (item: any) => item.type === "expense"
    );

    const expenseTransactionsWithReceipts = expenseTransactions.filter(
      (item: any) => hasReceipt(item)
    );

    const expenseTransactionsMissingReceipts = expenseTransactions.filter(
      (item: any) => !hasReceipt(item)
    );

    const totalPence = transactions.reduce(
      (sum: number, item: any) => sum + Number(item.amount_pence || 0),
      0
    );

    const receiptPence = transactionsWithReceipts.reduce(
      (sum: number, item: any) => sum + Number(item.amount_pence || 0),
      0
    );

    const missingReceiptPence = transactionsMissingReceipts.reduce(
      (sum: number, item: any) => sum + Number(item.amount_pence || 0),
      0
    );

    const expensePence = expenseTransactions.reduce(
      (sum: number, item: any) => sum + Number(item.amount_pence || 0),
      0
    );

    const expenseMissingReceiptPence = expenseTransactionsMissingReceipts.reduce(
      (sum: number, item: any) => sum + Number(item.amount_pence || 0),
      0
    );

    const workbook = new ExcelJS.Workbook();

    workbook.creator = "Burton Pride Money Tracker";
    workbook.created = new Date();
    workbook.modified = new Date();

    /**
     * SHEET 1: RECEIPT SUMMARY
     */
    const summarySheet = workbook.addWorksheet("Receipt Summary");

    addTitle(summarySheet, `Burton Pride C.I.C Receipts Export - ${year}`, "F1");

    summarySheet.addRow([]);
    summarySheet.addRow(["Generated", new Date().toLocaleString("en-GB")]);
    summarySheet.addRow(["Year", year]);
    summarySheet.addRow(["Period", `${startDate} to ${year}-12-31`]);
    summarySheet.addRow([]);

    const summaryHeader = summarySheet.addRow(["Summary", "Count", "Amount"]);
    styleHeader(summaryHeader);

    summarySheet.addRow([
      "All transactions",
      transactions.length,
      moneyFromPence(totalPence),
    ]);

    summarySheet.addRow([
      "Transactions with receipts",
      transactionsWithReceipts.length,
      moneyFromPence(receiptPence),
    ]);

    summarySheet.addRow([
      "Transactions missing receipts",
      transactionsMissingReceipts.length,
      moneyFromPence(missingReceiptPence),
    ]);

    summarySheet.addRow([
      "Expense transactions",
      expenseTransactions.length,
      moneyFromPence(expensePence),
    ]);

    summarySheet.addRow([
      "Expenses with receipts",
      expenseTransactionsWithReceipts.length,
      moneyFromPence(expensePence - expenseMissingReceiptPence),
    ]);

    summarySheet.addRow([
      "Expenses missing receipts",
      expenseTransactionsMissingReceipts.length,
      moneyFromPence(expenseMissingReceiptPence),
    ]);

    summarySheet.addRow([]);

    const notesRow = summarySheet.addRow(["Notes"]);
    styleSectionTitle(notesRow);

    summarySheet.addRow([
      "This export checks which transactions have receipt or invoice links attached.",
    ]);
    summarySheet.addRow([
      "Missing receipts should be reviewed before sending accounts to the accountant.",
    ]);
    summarySheet.addRow([
      "The receipt URL column uses invoice_image_url first, then receipt_url, receipt_image_url, or invoice_url if those fields exist.",
    ]);

    summarySheet.columns = [
      { width: 42 },
      { width: 16 },
      { width: 18 },
      { width: 20 },
      { width: 20 },
      { width: 20 },
    ];

    styleMoneyColumn(summarySheet, 3);
    applyBorders(summarySheet);

    /**
     * SHEET 2: RECEIPTS INDEX
     */
    const receiptsSheet = workbook.addWorksheet("Receipts Index");

    addTitle(receiptsSheet, `Receipts Index - ${year}`, "J1");
    receiptsSheet.addRow([]);

    const receiptsHeader = receiptsSheet.addRow([
      "Date",
      "Title",
      "Description",
      "Type",
      "Category",
      "Payment Method",
      "Amount",
      "Receipt URL",
      "Sponsor / Funding",
      "Created At",
    ]);

    styleHeader(receiptsHeader);

    transactionsWithReceipts.forEach((item: any) => {
      receiptsSheet.addRow([
        formatDate(item.transaction_date),
        normaliseText(item.title),
        normaliseText(item.description),
        typeLabel(item.type),
        normaliseText(item.category),
        normaliseText(item.payment_method),
        moneyFromPence(item.amount_pence),
        normaliseText(getReceiptUrl(item)),
        normaliseText(item.sponsor_name),
        normaliseText(item.created_at),
      ]);
    });

    receiptsSheet.columns = [
      { width: 16 },
      { width: 34 },
      { width: 44 },
      { width: 14 },
      { width: 24 },
      { width: 22 },
      { width: 18 },
      { width: 58 },
      { width: 28 },
      { width: 28 },
    ];

    styleMoneyColumn(receiptsSheet, 7);
    applyBorders(receiptsSheet);

    /**
     * SHEET 3: MISSING RECEIPTS
     */
    const missingSheet = workbook.addWorksheet("Missing Receipts");

    addTitle(missingSheet, `Missing Receipts - ${year}`, "J1");
    missingSheet.addRow([]);

    const missingHeader = missingSheet.addRow([
      "Date",
      "Title",
      "Description",
      "Type",
      "Category",
      "Payment Method",
      "Amount",
      "Sponsor / Funding",
      "Personal Funds",
      "Created At",
    ]);

    styleHeader(missingHeader);

    transactionsMissingReceipts.forEach((item: any) => {
      missingSheet.addRow([
        formatDate(item.transaction_date),
        normaliseText(item.title),
        normaliseText(item.description),
        typeLabel(item.type),
        normaliseText(item.category),
        normaliseText(item.payment_method),
        moneyFromPence(item.amount_pence),
        normaliseText(item.sponsor_name),
        item.is_personal_funds
          ? normaliseText(item.personal_funds_name) || "Yes"
          : "No",
        normaliseText(item.created_at),
      ]);
    });

    missingSheet.columns = [
      { width: 16 },
      { width: 34 },
      { width: 44 },
      { width: 14 },
      { width: 24 },
      { width: 22 },
      { width: 18 },
      { width: 28 },
      { width: 28 },
      { width: 28 },
    ];

    styleMoneyColumn(missingSheet, 7);
    applyBorders(missingSheet);

    /**
     * SHEET 4: EXPENSE RECEIPT CHECK
     */
    const expenseCheckSheet = workbook.addWorksheet("Expense Receipt Check");

    addTitle(expenseCheckSheet, `Expense Receipt Check - ${year}`, "K1");
    expenseCheckSheet.addRow([]);

    const expenseCheckHeader = expenseCheckSheet.addRow([
      "Date",
      "Title",
      "Description",
      "Category",
      "Payment Method",
      "Amount",
      "Has Receipt",
      "Receipt URL",
      "Personal Funds",
      "Paid Back",
      "Created At",
    ]);

    styleHeader(expenseCheckHeader);

    expenseTransactions.forEach((item: any) => {
      const receiptUrl = getReceiptUrl(item);

      expenseCheckSheet.addRow([
        formatDate(item.transaction_date),
        normaliseText(item.title),
        normaliseText(item.description),
        normaliseText(item.category),
        normaliseText(item.payment_method),
        moneyFromPence(item.amount_pence),
        receiptUrl ? "Yes" : "No",
        normaliseText(receiptUrl),
        item.is_personal_funds
          ? normaliseText(item.personal_funds_name) || "Yes"
          : "No",
        item.personal_funds_repaid ? "Yes" : "No",
        normaliseText(item.created_at),
      ]);
    });

    expenseCheckSheet.columns = [
      { width: 16 },
      { width: 34 },
      { width: 44 },
      { width: 24 },
      { width: 22 },
      { width: 18 },
      { width: 16 },
      { width: 58 },
      { width: 28 },
      { width: 16 },
      { width: 28 },
    ];

    styleMoneyColumn(expenseCheckSheet, 6);
    applyBorders(expenseCheckSheet);

    /**
     * SHEET 5: RAW DEBUG
     */
    const rawSheet = workbook.addWorksheet("Raw Debug");

    addTitle(rawSheet, `Raw Receipt Debug Data - ${year}`, "C1");
    rawSheet.addRow([]);

    const rawHeader = rawSheet.addRow(["ID", "Created At", "Raw Data"]);
    styleHeader(rawHeader);

    transactions.forEach((item: any) => {
      rawSheet.addRow([
        normaliseText(item.id),
        normaliseText(item.created_at),
        safeJson(item),
      ]);
    });

    rawSheet.columns = [{ width: 40 }, { width: 28 }, { width: 120 }];
    applyBorders(rawSheet);

    const arrayBuffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="burton-pride-receipts-${year}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("Receipts export error:", error);

    return NextResponse.json(
      {
        error: "Failed to create receipts export.",
        details: {
          message: error?.message || String(error),
          route: "/api/admin/money/export/receipts-export",
          expectedFile:
            "app/api/admin/money/export/receipts-export/route.ts",
          likelyFix:
            "Check money_transactions table columns, receipt URL fields, ExcelJS installation, and server logs.",
        },
      },
      {
        status: 500,
      }
    );
  }
}