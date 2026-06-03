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

function addTitle(sheet: ExcelJS.Worksheet, title: string, mergeTo = "N1") {
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
          error: "Could not load money transactions.",
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

    const incomeTransactions = transactions.filter(
      (item: any) => item.type === "income"
    );

    const expenseTransactions = transactions.filter(
      (item: any) => item.type === "expense"
    );

    const incomePence = incomeTransactions.reduce(
      (sum: number, item: any) => sum + Number(item.amount_pence || 0),
      0
    );

    const expensePence = expenseTransactions.reduce(
      (sum: number, item: any) => sum + Number(item.amount_pence || 0),
      0
    );

    const personalFundsPence = transactions
      .filter((item: any) => item.is_personal_funds)
      .reduce(
        (sum: number, item: any) => sum + Number(item.amount_pence || 0),
        0
      );

    const repaidPersonalFundsPence = transactions
      .filter((item: any) => item.is_personal_funds && item.personal_funds_repaid)
      .reduce(
        (sum: number, item: any) => sum + Number(item.amount_pence || 0),
        0
      );

    const workbook = new ExcelJS.Workbook();

    workbook.creator = "Burton Pride Money Tracker";
    workbook.created = new Date();
    workbook.modified = new Date();

    /**
     * SHEET 1: TRANSACTIONS
     */
    const transactionsSheet = workbook.addWorksheet("Transactions");

    addTitle(transactionsSheet, `Burton Pride C.I.C Transaction List - ${year}`);

    transactionsSheet.addRow([]);
    transactionsSheet.addRow(["Generated", new Date().toLocaleString("en-GB")]);
    transactionsSheet.addRow(["Year", year]);
    transactionsSheet.addRow(["Period", `${startDate} to ${year}-12-31`]);
    transactionsSheet.addRow([]);

    const summaryTitle = transactionsSheet.addRow(["Summary"]);
    styleSectionTitle(summaryTitle);

    transactionsSheet.addRow(["Total income", moneyFromPence(incomePence)]);
    transactionsSheet.addRow(["Total expenses", moneyFromPence(expensePence)]);
    transactionsSheet.addRow([
      "Balance",
      moneyFromPence(incomePence - expensePence),
    ]);
    transactionsSheet.addRow(["Total transactions", transactions.length]);
    transactionsSheet.addRow(["Income transactions", incomeTransactions.length]);
    transactionsSheet.addRow([
      "Expense transactions",
      expenseTransactions.length,
    ]);
    transactionsSheet.addRow([
      "Personal funds used",
      moneyFromPence(personalFundsPence),
    ]);
    transactionsSheet.addRow([
      "Personal funds repaid",
      moneyFromPence(repaidPersonalFundsPence),
    ]);

    styleMoneyColumn(transactionsSheet, 2);

    transactionsSheet.addRow([]);

    const header = transactionsSheet.addRow([
      "Date",
      "Title",
      "Description",
      "Type",
      "Category",
      "Payment Method",
      "Amount",
      "Source",
      "Sponsor / Funding",
      "Funding Note",
      "Personal Funds",
      "Personal Funds Paid Back",
      "Receipt",
      "Created At",
    ]);

    styleHeader(header);

    transactions.forEach((item: any) => {
      transactionsSheet.addRow([
        formatDate(item.transaction_date),
        normaliseText(item.title),
        normaliseText(item.description),
        typeLabel(item.type),
        normaliseText(item.category),
        normaliseText(item.payment_method),
        moneyFromPence(item.amount_pence),
        normaliseText(item.source),
        normaliseText(item.sponsor_name),
        normaliseText(item.sponsorship_note),
        item.is_personal_funds
          ? normaliseText(item.personal_funds_name) || "Yes"
          : "No",
        item.personal_funds_repaid ? "Yes" : "No",
        normaliseText(item.invoice_image_url),
        normaliseText(item.created_at),
      ]);
    });

    transactionsSheet.columns = [
      { width: 16 },
      { width: 34 },
      { width: 44 },
      { width: 14 },
      { width: 24 },
      { width: 22 },
      { width: 18 },
      { width: 24 },
      { width: 28 },
      { width: 36 },
      { width: 28 },
      { width: 24 },
      { width: 48 },
      { width: 28 },
    ];

    styleMoneyColumn(transactionsSheet, 7);
    applyBorders(transactionsSheet);

    /**
     * SHEET 2: INCOME ONLY
     */
    const incomeSheet = workbook.addWorksheet("Income");

    addTitle(incomeSheet, `Income Transactions - ${year}`, "J1");
    incomeSheet.addRow([]);

    const incomeHeader = incomeSheet.addRow([
      "Date",
      "Title",
      "Description",
      "Category",
      "Payment Method",
      "Amount",
      "Source",
      "Sponsor / Funding",
      "Receipt",
      "Created At",
    ]);

    styleHeader(incomeHeader);

    incomeTransactions.forEach((item: any) => {
      incomeSheet.addRow([
        formatDate(item.transaction_date),
        normaliseText(item.title),
        normaliseText(item.description),
        normaliseText(item.category),
        normaliseText(item.payment_method),
        moneyFromPence(item.amount_pence),
        normaliseText(item.source),
        normaliseText(item.sponsor_name),
        normaliseText(item.invoice_image_url),
        normaliseText(item.created_at),
      ]);
    });

    incomeSheet.columns = [
      { width: 16 },
      { width: 34 },
      { width: 44 },
      { width: 24 },
      { width: 22 },
      { width: 18 },
      { width: 24 },
      { width: 28 },
      { width: 48 },
      { width: 28 },
    ];

    styleMoneyColumn(incomeSheet, 6);
    applyBorders(incomeSheet);

    /**
     * SHEET 3: EXPENSES ONLY
     */
    const expenseSheet = workbook.addWorksheet("Expenses");

    addTitle(expenseSheet, `Expense Transactions - ${year}`, "J1");
    expenseSheet.addRow([]);

    const expenseHeader = expenseSheet.addRow([
      "Date",
      "Title",
      "Description",
      "Category",
      "Payment Method",
      "Amount",
      "Personal Funds",
      "Paid Back",
      "Receipt",
      "Created At",
    ]);

    styleHeader(expenseHeader);

    expenseTransactions.forEach((item: any) => {
      expenseSheet.addRow([
        formatDate(item.transaction_date),
        normaliseText(item.title),
        normaliseText(item.description),
        normaliseText(item.category),
        normaliseText(item.payment_method),
        moneyFromPence(item.amount_pence),
        item.is_personal_funds
          ? normaliseText(item.personal_funds_name) || "Yes"
          : "No",
        item.personal_funds_repaid ? "Yes" : "No",
        normaliseText(item.invoice_image_url),
        normaliseText(item.created_at),
      ]);
    });

    expenseSheet.columns = [
      { width: 16 },
      { width: 34 },
      { width: 44 },
      { width: 24 },
      { width: 22 },
      { width: 18 },
      { width: 28 },
      { width: 16 },
      { width: 48 },
      { width: 28 },
    ];

    styleMoneyColumn(expenseSheet, 6);
    applyBorders(expenseSheet);

    /**
     * SHEET 4: RECEIPT CHECK
     */
    const receiptSheet = workbook.addWorksheet("Receipt Check");

    addTitle(receiptSheet, `Receipt Check - ${year}`, "H1");
    receiptSheet.addRow([]);

    const receiptHeader = receiptSheet.addRow([
      "Date",
      "Title",
      "Type",
      "Category",
      "Amount",
      "Has Receipt",
      "Receipt URL",
      "Notes",
    ]);

    styleHeader(receiptHeader);

    transactions.forEach((item: any) => {
      const receipt = normaliseText(item.invoice_image_url);

      receiptSheet.addRow([
        formatDate(item.transaction_date),
        normaliseText(item.title),
        typeLabel(item.type),
        normaliseText(item.category),
        moneyFromPence(item.amount_pence),
        receipt ? "Yes" : "No",
        receipt,
        normaliseText(item.description),
      ]);
    });

    receiptSheet.columns = [
      { width: 16 },
      { width: 34 },
      { width: 14 },
      { width: 24 },
      { width: 18 },
      { width: 16 },
      { width: 54 },
      { width: 44 },
    ];

    styleMoneyColumn(receiptSheet, 5);
    applyBorders(receiptSheet);

    /**
     * SHEET 5: RAW DEBUG
     */
    const rawSheet = workbook.addWorksheet("Raw Debug");

    addTitle(rawSheet, `Raw Transaction Data - ${year}`, "C1");
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
        "Content-Disposition": `attachment; filename="burton-pride-transactions-${year}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("Transactions export error:", error);

    return NextResponse.json(
      {
        error: "Failed to create transactions export.",
        details: {
          message: error?.message || String(error),
          route: "/api/admin/money/transactions-export",
          expectedFile: "app/api/admin/money/transactions-export/route.ts",
          likelyFix:
            "Check money_transactions table columns, ExcelJS installation, and server logs.",
        },
      },
      {
        status: 500,
      }
    );
  }
}