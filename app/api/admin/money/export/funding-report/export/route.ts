import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

import { requireAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MoneySponsor = {
  id: string;
  sponsor_name?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  agreed_amount_pence?: number | null;
  received_amount_pence?: number | null;
  notes?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
};

type MoneyTransaction = {
  id: string;
  created_at?: string | null;
  title?: string | null;
  description?: string | null;
  type?: "income" | "expense" | string | null;
  category?: string | null;
  amount_pence?: number | null;
  payment_method?: string | null;
  transaction_date?: string | null;
  invoice_image_url?: string | null;
  sponsor_id?: string | null;
  sponsor_name?: string | null;
  sponsorship_note?: string | null;
  source?: string | null;
  deleted_at?: string | null;
  personal_funds_repaid?: boolean | null;
  is_personal_funds?: boolean | null;
};

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function moneyPounds(value: number | null | undefined) {
  return (Number(value || 0) / 100).toFixed(2);
}

function pence(value: number | null | undefined) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB");
}

function safeSheetName(value: string) {
  return value.replace(/[\\/*?:[\]]/g, " ").slice(0, 31) || "Sheet";
}

function setThinBorder(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: "thin", color: { argb: "FFE5E7EB" } },
    left: { style: "thin", color: { argb: "FFE5E7EB" } },
    bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
    right: { style: "thin", color: { argb: "FFE5E7EB" } },
  };
}

function styleTitle(cell: ExcelJS.Cell) {
  cell.font = { bold: true, size: 20, color: { argb: "FFFFFFFF" } };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF111827" },
  };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
}

function styleSection(cell: ExcelJS.Cell, colour = "FF334155") {
  cell.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: colour },
  };
  cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
}

function styleHeader(row: ExcelJS.Row, colour = "FF111827") {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: colour },
    };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    setThinBorder(cell);
  });
  row.height = 26;
}

function styleBody(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.alignment = { vertical: "top", wrapText: true };
    setThinBorder(cell);
  });
}

function styleMoneyCell(cell: ExcelJS.Cell) {
  cell.numFmt = '£#,##0.00;[Red]-£#,##0.00';
  cell.alignment = { horizontal: "right", vertical: "middle" };
}

function addMergedTitle(sheet: ExcelJS.Worksheet, text: string, from: string, to: string) {
  sheet.mergeCells(`${from}:${to}`);
  const cell = sheet.getCell(from);
  cell.value = text;
  styleTitle(cell);
}

function addMergedSection(
  sheet: ExcelJS.Worksheet,
  text: string,
  from: string,
  to: string,
  colour = "FF334155",
) {
  sheet.mergeCells(`${from}:${to}`);
  const cell = sheet.getCell(from);
  cell.value = text;
  styleSection(cell, colour);
}

function getTransactionAmount(transaction: MoneyTransaction) {
  return pence(transaction.amount_pence);
}

function isIncome(transaction: MoneyTransaction) {
  return String(transaction.type || "").toLowerCase() === "income";
}

function isExpense(transaction: MoneyTransaction) {
  return String(transaction.type || "").toLowerCase() === "expense";
}

function getTransactionTitle(transaction: MoneyTransaction) {
  return transaction.title || transaction.description || "Untitled transaction";
}

function fileNameSafe(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "funding-report";
}

function buildChangedDetails(transactions: MoneyTransaction[]) {
  return transactions
    .map((transaction) => ({
      date: transaction.transaction_date || transaction.created_at || "",
      title: getTransactionTitle(transaction),
      type: transaction.type || "",
      amount: getTransactionAmount(transaction),
      category: transaction.category || "",
      receipt: transaction.invoice_image_url || "",
      notes: transaction.description || transaction.sponsorship_note || "",
    }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function getReceiptRows(transactions: MoneyTransaction[]) {
  return transactions.filter((transaction) => Boolean(transaction.invoice_image_url));
}

function buildFundingFilter(sponsor: MoneySponsor, year: string) {
  const sponsorName = cleanText(sponsor.sponsor_name);

  let query = supabaseAdmin
    .from("money_transactions")
    .select("*")
    .is("deleted_at", null)
    .order("transaction_date", { ascending: true });

  if (year) {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    query = query.gte("transaction_date", start).lte("transaction_date", end);
  }

  if (sponsor.id && sponsorName) {
    query = query.or(
      `sponsor_id.eq.${sponsor.id},sponsor_name.ilike.${sponsorName}`,
    );
  } else if (sponsor.id) {
    query = query.eq("sponsor_id", sponsor.id);
  } else if (sponsorName) {
    query = query.ilike("sponsor_name", sponsorName);
  }

  return query;
}

export async function GET(request: Request) {
  const admin = await requireAdmin();

  if (!admin) {
    return NextResponse.json(
      {
        error: "You must be signed in as an admin.",
        details: "Your Supabase admin session was not found. Please sign in again through the admin login page.",
      },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const fundingId = cleanText(searchParams.get("fundingId") || searchParams.get("sponsorId"));
  const year = cleanText(searchParams.get("year")) || String(new Date().getFullYear());

  if (!fundingId) {
    return NextResponse.json(
      {
        error: "Funding record ID is required.",
        details:
          "Call this route with ?fundingId=SPONSOR_ID&year=2026. The funding record is currently read from money_sponsors.",
      },
      { status: 400 },
    );
  }

  const { data: sponsor, error: sponsorError } = await supabaseAdmin
    .from("money_sponsors")
    .select("*")
    .eq("id", fundingId)
    .maybeSingle();

  if (sponsorError) {
    return NextResponse.json(
      {
        error: "Failed to load funding record.",
        details: sponsorError.message,
      },
      { status: 500 },
    );
  }

  if (!sponsor) {
    return NextResponse.json(
      {
        error: "Funding record not found.",
        details:
          "No row was found in money_sponsors for that ID. Check the fundingId/sponsorId.",
      },
      { status: 404 },
    );
  }

  const { data: transactions, error: transactionError } =
    await buildFundingFilter(sponsor as MoneySponsor, year);

  if (transactionError) {
    return NextResponse.json(
      {
        error: "Failed to load funding transactions.",
        details: transactionError.message,
      },
      { status: 500 },
    );
  }

  const fundingRecord = sponsor as MoneySponsor;
  const rows = (transactions || []) as MoneyTransaction[];
  const receivedPence = rows
    .filter(isIncome)
    .reduce((sum, item) => sum + getTransactionAmount(item), 0);
  const spentPence = rows
    .filter(isExpense)
    .reduce((sum, item) => sum + getTransactionAmount(item), 0);
  const remainingPence = receivedPence - spentPence;
  const agreedPence = pence(fundingRecord.agreed_amount_pence);
  const sponsorReceivedPence = pence(fundingRecord.received_amount_pence);
  const receiptRows = getReceiptRows(rows);

  const workbook = new ExcelJS.Workbook();
  const now = new Date();
  const fundingName = cleanText(fundingRecord.sponsor_name) || "Funding Record";

  /*
   * Keep workbook metadata limited to fields supported by the
   * installed ExcelJS type definitions.
   */
  workbook.creator = "Burton Pride C.I.C";
  workbook.lastModifiedBy = "Burton Pride C.I.C";
  workbook.created = now;
  workbook.modified = now;

  const summarySheet = workbook.addWorksheet("Funding Report", {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
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

  summarySheet.columns = [
    { key: "a", width: 26 },
    { key: "b", width: 18 },
    { key: "c", width: 26 },
    { key: "d", width: 18 },
    { key: "e", width: 26 },
    { key: "f", width: 18 },
  ];

  addMergedTitle(
    summarySheet,
    `Burton Pride C.I.C - Grant / Funding Report`,
    "A1",
    "F1",
  );
  summarySheet.getRow(1).height = 32;

  summarySheet.mergeCells("A2:F2");
  summarySheet.getCell("A2").value =
    `Funding record: ${fundingName} | Year: ${year} | Generated: ${now.toLocaleString("en-GB")}`;
  summarySheet.getCell("A2").font = { bold: true, color: { argb: "FF374151" } };
  summarySheet.getCell("A2").alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };

  addMergedSection(summarySheet, "Funding Record", "A4", "F4", "FF334155");
  const fundingInfoRows = [
    ["Funding / sponsor name", fundingName, "Contact", fundingRecord.contact_name || "", "Active", fundingRecord.is_active ? "Yes" : "No"],
    ["Email", fundingRecord.email || "", "Phone", fundingRecord.phone || "", "Created", formatDate(fundingRecord.created_at)],
    ["Agreed amount", Number(moneyPounds(agreedPence)), "Recorded received on sponsor", Number(moneyPounds(sponsorReceivedPence)), "Report year", year],
  ];

  fundingInfoRows.forEach((values) => {
    const row = summarySheet.addRow(values);
    styleBody(row);
    [1, 3, 5].forEach((cellNumber) => {
      row.getCell(cellNumber).font = { bold: true, color: { argb: "FF111827" } };
      row.getCell(cellNumber).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF8FAFC" },
      };
    });
    [2, 4].forEach((cellNumber) => {
      if (typeof row.getCell(cellNumber).value === "number") {
        styleMoneyCell(row.getCell(cellNumber));
      }
    });
  });

  addMergedSection(summarySheet, "Money Summary", "A9", "F9", "FF065F46");
  const summaryHeader = summarySheet.addRow([
    "Money received",
    "Money spent",
    "Remaining balance",
    "Transactions",
    "Receipts attached",
    "Notes",
  ]);
  styleHeader(summaryHeader, "FF065F46");

  const summaryRow = summarySheet.addRow([
    Number(moneyPounds(receivedPence)),
    Number(moneyPounds(spentPence)),
    Number(moneyPounds(remainingPence)),
    rows.length,
    receiptRows.length,
    fundingRecord.notes || "",
  ]);
  styleBody(summaryRow);
  [1, 2, 3].forEach((cellNumber) => styleMoneyCell(summaryRow.getCell(cellNumber)));
  summaryRow.getCell(3).font = {
    bold: true,
    color: { argb: remainingPence >= 0 ? "FF166534" : "FF991B1B" },
  };

  addMergedSection(summarySheet, "Spending / Income Breakdown", "A13", "F13", "FF1D4ED8");
  const breakdownHeader = summarySheet.addRow([
    "Date",
    "Type",
    "Title",
    "Category",
    "Amount",
    "Notes",
  ]);
  styleHeader(breakdownHeader, "FF1D4ED8");

  if (rows.length === 0) {
    const emptyRow = summarySheet.addRow([
      "No linked funding transactions found for this year.",
      "",
      "",
      "",
      "",
      "",
    ]);
    styleBody(emptyRow);
  } else {
    buildChangedDetails(rows).forEach((item) => {
      const row = summarySheet.addRow([
        formatDate(item.date),
        item.type,
        item.title,
        item.category,
        Number(moneyPounds(item.amount)),
        item.notes,
      ]);
      styleBody(row);
      styleMoneyCell(row.getCell(5));
      row.getCell(2).font = {
        bold: true,
        color: { argb: item.type === "income" ? "FF166534" : "FF991B1B" },
      };
    });
  }

  addMergedSection(summarySheet, "Funding Notes", "A30", "F30", "FF7C3AED");
  summarySheet.mergeCells("A31:F34");
  summarySheet.getCell("A31").value = fundingRecord.notes || "No funding notes recorded.";
  summarySheet.getCell("A31").alignment = { vertical: "top", wrapText: true };
  setThinBorder(summarySheet.getCell("A31"));

  summarySheet.headerFooter.oddFooter = "&LGrant/Funding Report&RPage &P of &N";

  const transactionSheet = workbook.addWorksheet("Transactions", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  transactionSheet.columns = [
    { key: "date", width: 16 },
    { key: "type", width: 14 },
    { key: "title", width: 32 },
    { key: "description", width: 46 },
    { key: "category", width: 22 },
    { key: "method", width: 20 },
    { key: "amount", width: 16 },
    { key: "source", width: 24 },
    { key: "receipt", width: 70 },
    { key: "transactionId", width: 38 },
  ];

  const transactionHeader = transactionSheet.addRow([
    "Date",
    "Type",
    "Title",
    "Description",
    "Category",
    "Payment Method",
    "Amount",
    "Source",
    "Receipt / Invoice URL",
    "Transaction ID",
  ]);
  styleHeader(transactionHeader);

  rows.forEach((transaction) => {
    const row = transactionSheet.addRow({
      date: formatDate(transaction.transaction_date || transaction.created_at),
      type: transaction.type || "",
      title: transaction.title || "",
      description: transaction.description || transaction.sponsorship_note || "",
      category: transaction.category || "",
      method: transaction.payment_method || "",
      amount: Number(moneyPounds(transaction.amount_pence)),
      source: transaction.source || "",
      receipt: transaction.invoice_image_url || "",
      transactionId: transaction.id,
    });

    styleBody(row);
    styleMoneyCell(row.getCell("amount"));
    row.getCell("type").font = {
      bold: true,
      color: { argb: isIncome(transaction) ? "FF166534" : "FF991B1B" },
    };

    if (transaction.invoice_image_url) {
      row.getCell("receipt").value = {
        text: transaction.invoice_image_url,
        hyperlink: transaction.invoice_image_url,
      };
      row.getCell("receipt").font = {
        color: { argb: "FF2563EB" },
        underline: true,
      };
    }
  });

  transactionSheet.autoFilter = {
    from: "A1",
    to: "J1",
  };

  const receiptSheet = workbook.addWorksheet(safeSheetName("Receipts"), {
    views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
  });

  receiptSheet.columns = [
    { key: "date", width: 16 },
    { key: "title", width: 34 },
    { key: "amount", width: 16 },
    { key: "receipt", width: 90 },
    { key: "notes", width: 50 },
  ];

  const receiptHeader = receiptSheet.addRow([
    "Date",
    "Title",
    "Amount",
    "Receipt / Invoice URL",
    "Notes",
  ]);
  styleHeader(receiptHeader, "FF7C2D12");

  if (receiptRows.length === 0) {
    const row = receiptSheet.addRow([
      "No receipt URLs are attached to linked funding transactions.",
    ]);
    styleBody(row);
  } else {
    receiptRows.forEach((transaction) => {
      const row = receiptSheet.addRow({
        date: formatDate(transaction.transaction_date || transaction.created_at),
        title: getTransactionTitle(transaction),
        amount: Number(moneyPounds(transaction.amount_pence)),
        receipt: transaction.invoice_image_url || "",
        notes: transaction.description || transaction.sponsorship_note || "",
      });

      styleBody(row);
      styleMoneyCell(row.getCell("amount"));

      if (transaction.invoice_image_url) {
        row.getCell("receipt").value = {
          text: transaction.invoice_image_url,
          hyperlink: transaction.invoice_image_url,
        };
        row.getCell("receipt").font = {
          color: { argb: "FF2563EB" },
          underline: true,
        };
      }
    });
  }

  const notesSheet = workbook.addWorksheet("Notes", {
    views: [{ showGridLines: false }],
  });
  notesSheet.columns = [
    { key: "field", width: 26 },
    { key: "value", width: 90 },
  ];

  const notesHeader = notesSheet.addRow(["Field", "Value"]);
  styleHeader(notesHeader, "FF7C3AED");

  [
    ["Funding record ID", fundingRecord.id],
    ["Funding name", fundingName],
    ["Year", year],
    ["Agreed amount", `£${moneyPounds(agreedPence)}`],
    ["Received from linked transactions", `£${moneyPounds(receivedPence)}`],
    ["Spent from linked transactions", `£${moneyPounds(spentPence)}`],
    ["Remaining balance", `£${moneyPounds(remainingPence)}`],
    ["Funding record notes", fundingRecord.notes || ""],
    ["Report generated", now.toLocaleString("en-GB")],
    [
      "How transactions are matched",
      "Transactions are linked by sponsor_id, or by sponsor_name matching the funding/sponsor record name.",
    ],
  ].forEach((item) => {
    const row = notesSheet.addRow(item);
    styleBody(row);
    row.getCell(1).font = { bold: true };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `${fileNameSafe(fundingName)}-funding-report-${year}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
