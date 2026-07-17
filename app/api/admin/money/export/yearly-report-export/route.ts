import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

import { requireAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MoneyTransaction = Record<string, any>;
type SponsorRecord = Record<string, any>;

function pounds(pence: number | null | undefined) {
  return Number(pence || 0) / 100;
}

function moneyPence(value: any) {
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
  cell.font = {
    bold,
  };
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

  worksheet.getRow(Number(fromCell.replace(/[A-Z]/g, ""))).height = 28;
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
  colour = "FF7C3AED"
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

function isSponsorshipTransaction(item: MoneyTransaction) {
  return Boolean(
    item.sponsor_id ||
      item.sponsor_name ||
      item.sponsorship_note ||
      item.source === "sponsorship" ||
      item.source === "grant" ||
      item.source === "funding"
  );
}

function fundingTypeLabel(type?: string | null) {
  if (type === "grant") return "Grant Money";
  if (type === "loan") return "Loan";
  if (type === "other") return "Other Funding";
  return "Sponsor";
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

function fundingSourceLabel(item: MoneyTransaction) {
  if (!isSponsorshipTransaction(item)) {
    return sourceLabel(item.source);
  }

  return "Funding";
}

function bankReconciliationLabel(status?: string | null) {
  if (status === "matched") return "Matched";
  if (status === "needs_review") return "Needs review";
  if (status === "ignored") return "Ignored";
  return "Unmatched";
}

function financeNoteStatusLabel(status?: string | null) {
  if (status === "waiting_for_receipt") return "Waiting for receipt";
  if (status === "ask_sponsor") return "Ask sponsor";
  if (status === "bank_query") return "Bank query";
  if (status === "resolved") return "Resolved";
  return "No query";
}

function getTransactionFiles(item: MoneyTransaction) {
  const attachments = Array.isArray(item.attachments) ? item.attachments : [];

  if (attachments.length > 0) {
    return attachments;
  }

  if (item.invoice_image_url) {
    return [
      {
        id: `${item.id}-old-invoice`,
        transaction_id: item.id,
        file_name: "Old invoice / receipt",
        file_url: item.invoice_image_url,
        file_type: null,
        file_size: null,
        created_at: item.created_at,
      },
    ];
  }

  return [];
}

function filesSummary(item: MoneyTransaction) {
  const files = getTransactionFiles(item);

  if (files.length === 0) {
    return "None";
  }

  return files
    .map((file: any, index: number) => {
      const name = file.file_name || `Attachment ${index + 1}`;
      return `${index + 1}. ${name}: ${file.file_url || ""}`;
    })
    .join("\n");
}

function receiptStatus(item: MoneyTransaction) {
  const files = getTransactionFiles(item);

  if (files.length > 0) {
    return "Receipt / proof attached";
  }

  if (item.type === "expense") {
    return "Missing receipt / proof";
  }

  return "No file attached";
}

function checkedStatus(item: MoneyTransaction) {
  return item.checked_at ? "Checked" : "Not checked";
}

function checkedBy(item: MoneyTransaction) {
  return item.checked_by || "None";
}

function checkedAt(item: MoneyTransaction) {
  return item.checked_at ? formatDate(item.checked_at) : "None";
}

function financeNote(item: MoneyTransaction) {
  return item.finance_note || "None";
}

function financeNoteUpdatedBy(item: MoneyTransaction) {
  return item.finance_note_updated_by || "None";
}

function financeNoteUpdatedAt(item: MoneyTransaction) {
  return item.finance_note_updated_at
    ? formatDate(item.finance_note_updated_at)
    : "None";
}

function bankReconciledBy(item: MoneyTransaction) {
  return item.bank_reconciled_by || "None";
}

function bankReconciledAt(item: MoneyTransaction) {
  return item.bank_reconciled_at ? formatDate(item.bank_reconciled_at) : "None";
}

function bankReconciliationNote(item: MoneyTransaction) {
  return item.bank_reconciliation_note || "None";
}

function transactionColumns() {
  return [
    { key: "reference", width: 18 },
    { key: "year", width: 14 },
    { key: "date", width: 16 },
    { key: "title", width: 30 },
    { key: "description", width: 36 },
    { key: "type", width: 16 },
    { key: "amount", width: 16 },
    { key: "payment", width: 20 },
    { key: "source", width: 22 },
    { key: "bankStatus", width: 18 },
    { key: "bankNote", width: 34 },
    { key: "bankBy", width: 28 },
    { key: "bankAt", width: 20 },
    { key: "financeStatus", width: 24 },
    { key: "financeNote", width: 40 },
    { key: "financeBy", width: 28 },
    { key: "financeAt", width: 20 },
    { key: "receiptStatus", width: 24 },
    { key: "files", width: 55 },
    { key: "funding", width: 28 },
    { key: "fundingNote", width: 36 },
    { key: "personalFunds", width: 16 },
    { key: "paidBy", width: 22 },
    { key: "repaymentStatus", width: 20 },
    { key: "checkedStatus", width: 18 },
    { key: "checkedBy", width: 28 },
    { key: "checkedAt", width: 20 },
  ];
}

function transactionHeaderLabels() {
  return [
    "Reference",
    "Year",
    "Date",
    "Title",
    "Description",
    "Type",
    "Amount",
    "Payment Method",
    "Source",
    "Bank Match",
    "Bank Note",
    "Bank Matched By",
    "Bank Matched At",
    "Finance Query Status",
    "Finance Note",
    "Finance Updated By",
    "Finance Updated At",
    "Receipt Status",
    "Files / Attachments",
    "Funding Record",
    "Funding Note",
    "Personal Funds",
    "Paid By",
    "Repayment Status",
    "Checked Status",
    "Checked By",
    "Checked At",
  ];
}

function styleTransactionRow(row: ExcelJS.Row, item: MoneyTransaction) {
  const isPersonal = isPersonalFundsTransaction(item);
  const hasFunding = isSponsorshipTransaction(item);
  const hasFiles = getTransactionFiles(item).length > 0;
  const financeStatus = item.finance_note_status || "none";
  const bankStatus = item.bank_reconciliation_status || "unmatched";

  styleBodyRow(row);
  styleCurrencyCell(row.getCell("amount"), true);

  row.getCell("reference").font = {
    bold: true,
    color: { argb: "FF111827" },
  };

  row.getCell("files").alignment = {
    vertical: "top",
    wrapText: true,
  };

  row.getCell("financeNote").alignment = {
    vertical: "top",
    wrapText: true,
  };

  row.getCell("bankNote").alignment = {
    vertical: "top",
    wrapText: true,
  };

  if (item.checked_at) {
    row.getCell("checkedStatus").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDCFCE7" },
    };

    row.getCell("checkedStatus").font = {
      bold: true,
      color: { argb: "FF166534" },
    };

    row.getCell("checkedBy").font = {
      bold: true,
      color: { argb: "FF166534" },
    };
  } else {
    row.getCell("checkedStatus").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF3F4F6" },
    };

    row.getCell("checkedStatus").font = {
      bold: true,
      color: { argb: "FF6B7280" },
    };
  }

  if (item.type === "income") {
    row.getCell("type").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDCFCE7" },
    };

    row.getCell("type").font = {
      bold: true,
      color: { argb: "FF166534" },
    };
  }

  if (item.type === "expense") {
    row.getCell("type").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFEE2E2" },
    };

    row.getCell("type").font = {
      bold: true,
      color: { argb: "FF991B1B" },
    };
  }

  if (isPersonal) {
    row.getCell("personalFunds").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0F2FE" },
    };

    row.getCell("personalFunds").font = {
      bold: true,
      color: { argb: "FF075985" },
    };
  }

  if (hasFunding) {
    row.getCell("funding").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFEF3C7" },
    };

    row.getCell("funding").font = {
      bold: true,
      color: { argb: "FF92400E" },
    };
  }

  if (hasFiles) {
    row.getCell("receiptStatus").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDCFCE7" },
    };

    row.getCell("receiptStatus").font = {
      bold: true,
      color: { argb: "FF166534" },
    };
  } else if (item.type === "expense") {
    row.getCell("receiptStatus").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFEE2E2" },
    };

    row.getCell("receiptStatus").font = {
      bold: true,
      color: { argb: "FF991B1B" },
    };
  }

  if (bankStatus === "matched") {
    row.getCell("bankStatus").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDCFCE7" },
    };

    row.getCell("bankStatus").font = {
      bold: true,
      color: { argb: "FF166534" },
    };
  } else if (bankStatus === "needs_review") {
    row.getCell("bankStatus").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFEF3C7" },
    };

    row.getCell("bankStatus").font = {
      bold: true,
      color: { argb: "FF92400E" },
    };
  } else {
    row.getCell("bankStatus").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF3F4F6" },
    };

    row.getCell("bankStatus").font = {
      bold: true,
      color: { argb: "FF6B7280" },
    };
  }

  if (financeStatus === "resolved") {
    row.getCell("financeStatus").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDCFCE7" },
    };

    row.getCell("financeStatus").font = {
      bold: true,
      color: { argb: "FF166534" },
    };
  } else if (financeStatus !== "none") {
    row.getCell("financeStatus").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFEF3C7" },
    };

    row.getCell("financeStatus").font = {
      bold: true,
      color: { argb: "FF92400E" },
    };
  } else {
    row.getCell("financeStatus").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF3F4F6" },
    };

    row.getCell("financeStatus").font = {
      bold: true,
      color: { argb: "FF6B7280" },
    };
  }
}

function addTransactionRow(
  sheet: ExcelJS.Worksheet,
  item: MoneyTransaction,
  selectedYear: string
) {
  const isPersonal = isPersonalFundsTransaction(item);
  const hasFunding = isSponsorshipTransaction(item);

  const row = sheet.addRow({
    reference: item.transaction_reference || "Pending",
    year: selectedYear,
    date: formatDate(item.transaction_date || item.created_at),
    title: item.title || "Untitled",
    description: item.description || "None",
    type: item.type === "income" ? "Money In" : "Money Out",
    amount: pounds(item.amount_pence),
    payment: hasFunding ? "Funding Money" : item.payment_method || "None",
    source: fundingSourceLabel(item),
    bankStatus: bankReconciliationLabel(item.bank_reconciliation_status),
    bankNote: bankReconciliationNote(item),
    bankBy: bankReconciledBy(item),
    bankAt: bankReconciledAt(item),
    financeStatus: financeNoteStatusLabel(item.finance_note_status),
    financeNote: financeNote(item),
    financeBy: financeNoteUpdatedBy(item),
    financeAt: financeNoteUpdatedAt(item),
    receiptStatus: receiptStatus(item),
    files: filesSummary(item),
    funding: item.sponsor_name || "None",
    fundingNote: item.sponsorship_note || "None",
    personalFunds: isPersonal ? "Yes" : "No",
    paidBy: item.personal_funds_name || "None",
    repaymentStatus: isPersonal
      ? item.personal_funds_repaid
        ? "Paid back"
        : "Not paid back"
      : "None",
    checkedStatus: checkedStatus(item),
    checkedBy: checkedBy(item),
    checkedAt: checkedAt(item),
  });

  styleTransactionRow(row, item);
}

function sponsorNameForTransaction(item: MoneyTransaction) {
  return String(item.sponsor_name || item.funding_name || "").trim();
}

function calculateSponsorBreakdown(
  sponsors: SponsorRecord[],
  transactions: MoneyTransaction[]
) {
  const sponsorMap = new Map<string, any>();

  sponsors.forEach((sponsor) => {
    const id = String(sponsor.id || "").trim();
    const name = String(sponsor.sponsor_name || sponsor.name || "").trim();
    const key = id || name.toLowerCase();

    if (!key) return;

    sponsorMap.set(key, {
      sponsor_name: name || "Unnamed funding record",
      contact_name: sponsor.contact_name || "",
      email: sponsor.email || "",
      phone: sponsor.phone || "",
      agreed_amount_pence: moneyPence(sponsor.agreed_amount_pence),
      received_pence: 0,
      spent_pence: 0,
      remaining_pence: 0,
      carried_forward_pence: moneyPence(sponsor.carried_forward_pence),
      notes: sponsor.notes || "",
      funding_type: sponsor.funding_type || "sponsor",
    });
  });

  transactions.filter(isSponsorshipTransaction).forEach((item) => {
    const sponsorId = String(item.sponsor_id || "").trim();
    const sponsorName = sponsorNameForTransaction(item);
    const key = sponsorId || sponsorName.toLowerCase() || "unknown-funding";

    if (!sponsorMap.has(key)) {
      sponsorMap.set(key, {
        sponsor_name: sponsorName || "Unknown funding",
        contact_name: "",
        email: "",
        phone: "",
        agreed_amount_pence: 0,
        received_pence: 0,
        spent_pence: 0,
        remaining_pence: 0,
        carried_forward_pence: 0,
        notes: "",
        funding_type: item.funding_type || "sponsor",
      });
    }

    const record = sponsorMap.get(key);
    const amount = moneyPence(item.amount_pence);

    if (item.type === "income") {
      record.received_pence += amount;
    }

    if (item.type === "expense") {
      record.spent_pence += amount;
    }

    record.remaining_pence =
      record.carried_forward_pence + record.received_pence - record.spent_pence;
  });

  return Array.from(sponsorMap.values()).sort((a, b) =>
    String(a.sponsor_name).localeCompare(String(b.sponsor_name))
  );
}

async function loadTransactions(year: number) {
  const { data, error } = await supabaseAdmin
    .from("money_transactions")
    .select("*, attachments:money_transaction_attachments(*)")
    .gte("transaction_date", `${year}-01-01`)
    .lt("transaction_date", `${year + 1}-01-01`)
    .is("deleted_at", null)
    .order("transaction_date", { ascending: true });

  if (error) {
    throw {
      message: "Could not load money transactions.",
      details: {
        message: error.message,
        hint: error.hint,
        code: error.code,
        table: "money_transactions",
      },
    };
  }

  return data || [];
}

async function loadSponsors() {
  const { data, error } = await supabaseAdmin
    .from("money_sponsors")
    .select("*")
    .order("sponsor_name", { ascending: true });

  if (error) {
    return [];
  }

  return data || [];
}

async function loadOpeningBalance(year: number) {
  const { data, error } = await supabaseAdmin
    .from("money_transactions")
    .select("*")
    .lt("transaction_date", `${year}-01-01`)
    .is("deleted_at", null);

  if (error) {
    return 0;
  }

  const previousTransactions = data || [];

  const previousIncome = previousTransactions
    .filter((item: any) => item.type === "income")
    .reduce((sum: number, item: any) => sum + moneyPence(item.amount_pence), 0);

  const previousExpense = previousTransactions
    .filter((item: any) => item.type === "expense")
    .reduce((sum: number, item: any) => sum + moneyPence(item.amount_pence), 0);

  return previousIncome - previousExpense;
}

function calculateTotals(transactions: MoneyTransaction[], openingBalance: number) {
  const income = transactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + moneyPence(item.amount_pence), 0);

  const expense = transactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + moneyPence(item.amount_pence), 0);

  const personalFunds = transactions
    .filter(isPersonalFundsTransaction)
    .reduce((sum, item) => sum + moneyPence(item.amount_pence), 0);

  const personalFundsRepaid = transactions
    .filter((item) => isPersonalFundsTransaction(item) && item.personal_funds_repaid)
    .reduce((sum, item) => sum + moneyPence(item.amount_pence), 0);

  const sponsorshipIncome = transactions
    .filter((item) => isSponsorshipTransaction(item) && item.type === "income")
    .reduce((sum, item) => sum + moneyPence(item.amount_pence), 0);

  const sponsorshipSpent = transactions
    .filter((item) => isSponsorshipTransaction(item) && item.type === "expense")
    .reduce((sum, item) => sum + moneyPence(item.amount_pence), 0);

  return {
    openingBalance,
    income,
    expense,
    personalFunds,
    personalFundsRepaid,
    personalFundsOutstanding: personalFunds - personalFundsRepaid,
    sponsorshipIncome,
    sponsorshipSpent,
    sponsorshipRemaining: sponsorshipIncome - sponsorshipSpent,
    balance: openingBalance + income - expense,
  };
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

    const [yearTransactions, sponsors, openingBalance] = await Promise.all([
      loadTransactions(year),
      loadSponsors(),
      loadOpeningBalance(year),
    ]);

    const totals = calculateTotals(yearTransactions, openingBalance);
    const yearlySponsorBreakdown = calculateSponsorBreakdown(
      sponsors,
      yearTransactions
    );

    const workbook = new ExcelJS.Workbook();

    /*
     * Keep workbook metadata limited to fields supported by the
     * installed ExcelJS type definitions.
     */
    workbook.creator = "Burton Pride C.I.C";
    workbook.lastModifiedBy = "Burton Pride C.I.C";
    workbook.created = new Date();
    workbook.modified = new Date();

    /**
     * SHEET 1: YEAR SUMMARY
     */
    const summarySheet = workbook.addWorksheet("Year Summary", {
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
      { key: "label", width: 36 },
      { key: "amount", width: 20 },
      { key: "notes", width: 60 },
    ];

    addMergedTitle(
      summarySheet,
      "Burton Pride C.I.C - Full Yearly Money Report",
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

    addMergedSection(summarySheet, "Year Summary", "A4", "C4", "FF7C3AED");

    const summaryHeader = summarySheet.addRow(["Item", "Amount", "Notes"]);
    styleHeaderRow(summaryHeader, "FF111827");

    const summaryRows: Array<[string, number, string]> = [
      [
        "Opening Balance",
        pounds(totals.openingBalance || 0),
        "Money carried forward from previous years.",
      ],
      ["Money In", pounds(totals.income), "All income in the selected year."],
      [
        "Money Out",
        pounds(totals.expense),
        "Burton Pride money out for the selected year.",
      ],
      [
        "Personal Funds Paid",
        pounds(totals.personalFunds),
        "Money paid personally by people on behalf of Burton Pride.",
      ],
      [
        "Personal Funds Paid Back",
        pounds(totals.personalFundsRepaid),
        "Personal funds marked as paid back.",
      ],
      [
        "Personal Funds Still Owed",
        pounds(totals.personalFundsOutstanding),
        "Personal funds not yet paid back.",
      ],
      [
        "Funding Money Received",
        pounds(totals.sponsorshipIncome),
        "Sponsor, grant, loan or other restricted funding received.",
      ],
      [
        "Funding Money Spent",
        pounds(totals.sponsorshipSpent),
        "Spending linked to sponsors, grants, loans or other funding records.",
      ],
      [
        "Funding Money Left",
        pounds(totals.sponsorshipRemaining),
        "Restricted funding remaining after linked spending.",
      ],
      [
        "Closing Balance",
        pounds(totals.balance),
        "Opening balance plus income minus expenses.",
      ],
    ];

    summaryRows.forEach(([label, amount, notes]) => {
      const row = summarySheet.addRow([label, amount, notes]);
      styleBodyRow(row);
      row.getCell(1).font = { bold: true };
      styleCurrencyCell(row.getCell(2), true);
    });

    /**
     * SHEET 2: FUNDING BREAKDOWN
     */
    const sponsorSheet = workbook.addWorksheet("Funding Breakdown", {
      views: [{ state: "frozen", ySplit: 4 }],
      pageSetup: {
        paperSize: 9,
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });

    sponsorSheet.columns = [
      { key: "fundingType", width: 20 },
      { key: "funding", width: 30 },
      { key: "contact", width: 24 },
      { key: "email", width: 30 },
      { key: "phone", width: 18 },
      { key: "agreed", width: 16 },
      { key: "received", width: 16 },
      { key: "spent", width: 16 },
      { key: "remaining", width: 16 },
      { key: "carriedForward", width: 18 },
      { key: "notes", width: 45 },
    ];

    addMergedTitle(
      sponsorSheet,
      "Burton Pride C.I.C - Funding Breakdown",
      "A1",
      "K1"
    );

    addMergedSubtitle(
      sponsorSheet,
      `Year: Jan to Dec ${selectedYear}`,
      "A2",
      "K2"
    );

    sponsorSheet.addRow([]);

    const sponsorHeader = sponsorSheet.addRow([
      "Funding Type",
      "Funding Record",
      "Contact",
      "Email",
      "Phone",
      "Agreed / Awarded",
      "Received",
      "Spent",
      "Remaining",
      "Carried Forward",
      "Notes",
    ]);

    styleHeaderRow(sponsorHeader, "FF92400E");

    if (yearlySponsorBreakdown.length === 0) {
      const row = sponsorSheet.addRow([
        `No sponsors, grants, loans or other funding added for ${selectedYear}`,
      ]);
      styleBodyRow(row);
    } else {
      yearlySponsorBreakdown.forEach((sponsor) => {
        const row = sponsorSheet.addRow({
          fundingType: fundingTypeLabel(sponsor.funding_type),
          funding: safeText(sponsor.sponsor_name),
          contact: safeText(sponsor.contact_name),
          email: safeText(sponsor.email),
          phone: safeText(sponsor.phone),
          agreed: pounds(sponsor.agreed_amount_pence),
          received: pounds(sponsor.received_pence),
          spent: pounds(sponsor.spent_pence),
          remaining: pounds(sponsor.remaining_pence),
          carriedForward: pounds(sponsor.carried_forward_pence || 0),
          notes: safeText(sponsor.notes),
        });

        styleBodyRow(row);

        styleCurrencyCell(row.getCell("agreed"), true);
        styleCurrencyCell(row.getCell("received"), true);
        styleCurrencyCell(row.getCell("spent"), true);
        styleCurrencyCell(row.getCell("remaining"), true);
        styleCurrencyCell(row.getCell("carriedForward"), true);

        row.getCell("fundingType").font = {
          bold: true,
          color: { argb: "FF92400E" },
        };

        row.getCell("received").font = {
          bold: true,
          color: { argb: "FF166534" },
        };

        row.getCell("spent").font = {
          bold: true,
          color: { argb: "FF991B1B" },
        };

        row.getCell("remaining").font = {
          bold: true,
          color: { argb: "FF92400E" },
        };
      });
    }

    sponsorSheet.autoFilter = {
      from: "A4",
      to: "K4",
    };

    /**
     * SHEET 3: ALL TRANSACTIONS
     */
    const transactionSheet = workbook.addWorksheet("All Transactions", {
      views: [{ state: "frozen", ySplit: 4 }],
      pageSetup: {
        paperSize: 9,
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });

    transactionSheet.columns = transactionColumns();

    addMergedTitle(
      transactionSheet,
      "Burton Pride C.I.C - All Transactions",
      "A1",
      "AA1"
    );

    addMergedSubtitle(
      transactionSheet,
      `Year: Jan to Dec ${selectedYear} | Rows: ${yearTransactions.length}`,
      "A2",
      "AA2"
    );

    transactionSheet.addRow([]);

    const transactionHeader = transactionSheet.addRow(
      transactionHeaderLabels()
    );

    styleHeaderRow(transactionHeader, "FF047857");

    if (yearTransactions.length === 0) {
      const row = transactionSheet.addRow([
        `No transactions saved for ${selectedYear}`,
      ]);
      styleBodyRow(row);
    } else {
      yearTransactions.forEach((item) => {
        addTransactionRow(transactionSheet, item, selectedYear);
      });
    }

    transactionSheet.autoFilter = {
      from: "A4",
      to: "AA4",
    };

    /**
     * SHEET 4: RAW DEBUG
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
      "Burton Pride C.I.C - Raw Yearly Report Data",
      "A1",
      "C1"
    );

    addMergedSubtitle(
      rawSheet,
      "Raw transaction data for checking and debugging.",
      "A2",
      "C2"
    );

    rawSheet.addRow([]);

    const rawHeader = rawSheet.addRow(["ID", "Created At", "Raw Data"]);
    styleHeaderRow(rawHeader, "FF111827");

    yearTransactions.forEach((item) => {
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

    [summarySheet, sponsorSheet, transactionSheet, rawSheet].forEach((sheet) => {
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

    return new NextResponse(excelBuffer as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="burton-pride-full-yearly-report-${selectedYear}-${fileDate}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("Yearly report export error:", error);

    return NextResponse.json(
      {
        error: "Failed to create yearly report export.",
        details: {
          message: error?.message || String(error),
          route: "/api/admin/money/export/yearly-report-export",
          expectedFile:
            "app/api/admin/money/export/yearly-report-export/route.ts",
          likelyFix:
            "Check money_transactions table, money_transaction_attachments table, money_sponsors table, ExcelJS installation, and server logs.",
          raw: error?.details || null,
        },
      },
      {
        status: 500,
      }
    );
  }
}