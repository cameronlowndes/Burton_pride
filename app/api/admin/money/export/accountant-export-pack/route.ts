import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import JSZip from "jszip";

import { requireAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnyRecord = Record<string, any>;

type CurrentAdmin = {
  id?: string | null;
  admin_id?: string | null;
  user_id?: string | null;
  name?: string | null;
  full_name?: string | null;
  display_name?: string | null;
  email?: string | null;
};

type PackExportRoute = {
  key:
    | "yearly-report"
    | "transaction-list"
    | "receipts"
    | "audit-logs"
    | "funding-breakdown"
    | "personal-funds"
    | "csv-import-history"
    | "bank-balance-checks";
  title: string;
  filePrefix: string;
  routes: string[];
  required?: boolean;
};

type ExportAttempt = {
  route: string;
  fullUrl: string;
  routeFile: string;
  status?: number;
  statusText?: string;
  contentType?: string;
  fileSizeBytes?: number;
  errorBody?: string;
  likelyFix?: string;
};

type FailedExport = {
  key: string;
  title: string;
  fileName: string;
  required: boolean;
  attemptedRoutes: string[];
  attempts: ExportAttempt[];
  errors: string[];
  likelyFix: string;
};

type SuccessfulExport = {
  key: string;
  title: string;
  route: string;
  routeFile: string;
  fileName: string;
  size: number;
  contentType: string;
  source: "api" | "fallback";
};

const PACK_EXPORTS: PackExportRoute[] = [
  {
    key: "yearly-report",
    title: "Yearly Report",
    filePrefix: "01-yearly-report",
    required: true,
    routes: ["/api/admin/money/export/yearly-report-export"],
  },
  {
    key: "transaction-list",
    title: "Transaction List",
    filePrefix: "02-transaction-list",
    required: true,
    routes: ["/api/admin/money/export/transactions-export"],
  },
  {
    key: "receipts",
    title: "Receipts Index",
    filePrefix: "03-receipts-index",
    routes: ["/api/admin/money/export/receipts-export"],
  },
  {
    key: "audit-logs",
    title: "Audit Logs",
    filePrefix: "04-audit-logs",
    routes: ["/api/admin/money/export/audit-logs-export"],
  },
  {
    key: "funding-breakdown",
    title: "Funding Breakdown",
    filePrefix: "05-funding-breakdown",
    routes: ["/api/admin/money/export/funding-report/export"],
  },
  {
    key: "personal-funds",
    title: "Personal Funds Report",
    filePrefix: "06-personal-funds-report",
    routes: ["/api/admin/money/export/personal-funds-export"],
  },
  {
    key: "csv-import-history",
    title: "CSV Import History",
    filePrefix: "07-csv-import-history",
    routes: ["/api/admin/money/export/csv-import-history-export"],
  },
  {
    key: "bank-balance-checks",
    title: "Bank Balance Checks",
    filePrefix: "08-bank-balance-checks",
    routes: ["/api/admin/money/export/bank-balance-checks-export"],
  },
];

function isValidYear(year: number) {
  return Number.isFinite(year) && year >= 2000 && year <= 2100;
}

function safeFileNamePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function pounds(penceValue: any) {
  return Number(penceValue || 0) / 100;
}

function pence(value: any) {
  return Number(value || 0);
}

function cleanText(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";

  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  return String(value).trim();
}

function jsonText(value: any) {
  if (!value) return "";

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function dateOnly(value: any) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function dateTimeText(value: any) {
  if (!value) return "";
  return String(value).replace("T", " ").slice(0, 19);
}

function normaliseWords(value: any) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value: any) {
  const clean = normaliseWords(value);
  if (!clean) return "";

  return clean.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getActorName(admin: CurrentAdmin | null): string {
  if (!admin) return "Unknown user";

  return (
    cleanText(admin.full_name) ||
    cleanText(admin.name) ||
    cleanText(admin.display_name) ||
    cleanText(admin.email) ||
    "Unknown user"
  );
}

function getActorEmail(admin: CurrentAdmin | null): string | null {
  return cleanText(admin?.email) || null;
}

function getActorAdminId(admin: CurrentAdmin | null): string {
  return (
    cleanText(admin?.id) ||
    cleanText(admin?.admin_id) ||
    cleanText(admin?.user_id) ||
    "unknown-admin"
  );
}

async function getCurrentAdmin() {
  try {
    return (await requireAdmin()) as CurrentAdmin | null;
  } catch (error) {
    console.error("Accountant export pack auth error:", error);
    return null;
  }
}

function getBaseUrl(req: Request) {
  const url = new URL(req.url);

  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = req.headers.get("host");

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  if (host) {
    return `${url.protocol}//${host}`;
  }

  return url.origin;
}

function cleanApiRoute(route: string) {
  const trimmed = route.trim();
  if (trimmed === "/") return trimmed;
  return trimmed.replace(/\/+$/, "");
}

function addYearToRoute(route: string, year: number) {
  const fakeBase = "https://local.test";
  const url = new URL(cleanApiRoute(route), fakeBase);

  url.searchParams.set("year", String(year));

  return `${url.pathname}?${url.searchParams.toString()}`;
}

function routeToFilePath(route: string) {
  const pathOnly = route.split("?")[0] || route;

  if (!pathOnly.startsWith("/api/")) {
    return "Could not work out route file path.";
  }

  return `app${pathOnly}/route.ts`;
}

function getLikelyFix(
  status: number | undefined,
  route: string,
  errorBody?: string
) {
  const routeFile = routeToFilePath(route);
  const lowerError = String(errorBody || "").toLowerCase();

  if (!status) {
    return `The request did not return a HTTP response. Check that the server can call ${route}.`;
  }

  if (status === 400) {
    return `Check query parameters. Open ${routeFile} and make sure it accepts ?year=YYYY.`;
  }

  if (status === 401) {
    return `The route blocked the request as unauthorised. Open ${routeFile} and check Supabase admin auth/session handling.`;
  }

  if (status === 403) {
    return `The route exists but blocked this user. Open ${routeFile} and check admin permission logic.`;
  }

  if (status === 404) {
    return `This route does not exist. Create ${routeFile}, or update PACK_EXPORTS to the real route name.`;
  }

  if (status === 405) {
    return `Open ${routeFile} and make sure it exports: export async function GET(req: Request) { ... }`;
  }

  if (status === 500) {
    if (lowerError.includes("schema cache")) {
      return `Supabase table/column mismatch. Open ${routeFile} and check table/column names.`;
    }

    if (lowerError.includes("could not find the table")) {
      return `Missing Supabase table. Open ${routeFile} and either create the table or use the correct table name.`;
    }

    if (lowerError.includes("could not find") && lowerError.includes("column")) {
      return `Missing Supabase column. Open ${routeFile} and add, remove, or rename the column.`;
    }

    if (lowerError.includes("excel") || lowerError.includes("xlsx")) {
      return `Excel export crashed. Open ${routeFile} and check ExcelJS rows, merged cells, and values.`;
    }

    return `The route crashed. Open ${routeFile}, then check terminal/Vercel logs.`;
  }

  return `Open ${routeFile} and check why this route returned HTTP ${status}.`;
}

function getExtensionFromContentType(contentType: string) {
  const clean = contentType.toLowerCase();

  if (clean.includes("zip")) return "zip";
  if (clean.includes("spreadsheetml")) return "xlsx";
  if (clean.includes("excel")) return "xlsx";
  if (clean.includes("csv")) return "csv";
  if (clean.includes("pdf")) return "pdf";
  if (clean.includes("json")) return "json";
  if (clean.includes("text")) return "txt";

  return "xlsx";
}

function isProbablyFileResponse(contentType: string) {
  const clean = contentType.toLowerCase();

  if (!clean) return true;

  return (
    clean.includes("spreadsheetml") ||
    clean.includes("excel") ||
    clean.includes("csv") ||
    clean.includes("pdf") ||
    clean.includes("zip") ||
    clean.includes("octet-stream") ||
    clean.includes("text/csv") ||
    clean.includes("text/plain")
  );
}

function getFileNameFromDisposition(disposition: string | null) {
  if (!disposition) return null;

  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1].replace(/"/g, ""));
    } catch {
      return utfMatch[1].replace(/"/g, "");
    }
  }

  const normalMatch = disposition.match(/filename="?([^"]+)"?/i);
  if (normalMatch?.[1]) {
    return normalMatch[1].replace(/"/g, "");
  }

  return null;
}

function makePackFileName({
  prefix,
  year,
  sourceFileName,
  contentType,
}: {
  prefix: string;
  year: number;
  sourceFileName: string | null;
  contentType: string;
}) {
  if (sourceFileName) {
    const extension = sourceFileName.split(".").pop() || "xlsx";
    return `${prefix}-${year}.${extension}`;
  }

  const extension = getExtensionFromContentType(contentType);
  return `${prefix}-${year}.${extension}`;
}

async function readErrorBody(response: Response) {
  const contentType = response.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const json = await response.json();
      return JSON.stringify(json, null, 2);
    }

    const text = await response.text();
    return text || `${response.status} ${response.statusText}`;
  } catch {
    return `${response.status} ${response.statusText}`;
  }
}

function toArrayBuffer(input: unknown): ArrayBuffer {
  if (input instanceof ArrayBuffer) {
    return input;
  }

  if (ArrayBuffer.isView(input)) {
    const view = input as ArrayBufferView;
    return view.buffer.slice(
      view.byteOffset,
      view.byteOffset + view.byteLength
    ) as ArrayBuffer;
  }

  return new Uint8Array(input as ArrayLike<number>).buffer;
}

async function savePackLog({
  year,
  route,
  fileName,
  status,
  actorAdminId,
  actorName,
  actorEmail,
  errorMessage,
  metadata,
}: {
  year: number;
  route: string;
  fileName: string;
  status: "started" | "success" | "failed";
  actorAdminId: string;
  actorName: string;
  actorEmail: string | null;
  errorMessage?: string | null;
  metadata?: any;
}) {
  const basePayload = {
    action: "export",
    export_key: "accountant-export-pack",
    export_title: "Accountant Export Pack",
    export_type: "export",
    export_year: year,
    route,
    file_name: fileName,
    status,
    actor_name: actorName,
    actor_email: actorEmail,
    metadata: metadata || null,
    error_message: errorMessage || null,
  };

  const attempts = [
    { ...basePayload, actor_admin_id: actorAdminId },
    { ...basePayload, actor_user_id: actorAdminId },
    basePayload,
  ];

  for (const payload of attempts) {
    try {
      const { error } = await supabaseAdmin
        .from("money_export_logs")
        .insert(payload);

      if (!error) return;
    } catch {
      // Try the next payload shape below.
    }
  }

  console.error("Could not save accountant export pack log");
}

function createWorkbook(title: string) {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = "Burton Pride C.I.C Money Tracker";
  workbook.lastModifiedBy = "Burton Pride C.I.C Money Tracker";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.company = "Burton Pride C.I.C";
  workbook.title = title;
  workbook.subject = title;

  return workbook;
}

function addTitle(
  sheet: ExcelJS.Worksheet,
  title: string,
  subtitle?: string,
  endColumn = "L"
) {
  sheet.mergeCells(`A1:${endColumn}1`);

  const titleCell = sheet.getCell("A1");
  titleCell.value = title;
  titleCell.font = {
    bold: true,
    size: 18,
    color: { argb: "FFFFFFFF" },
  };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF064E3B" },
  };
  titleCell.alignment = {
    vertical: "middle",
    horizontal: "left",
  };

  sheet.getRow(1).height = 32;

  if (subtitle) {
    sheet.mergeCells(`A2:${endColumn}2`);

    const subtitleCell = sheet.getCell("A2");
    subtitleCell.value = subtitle;
    subtitleCell.font = {
      bold: true,
      size: 11,
      color: { argb: "FF374151" },
    };
    subtitleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF0FDF4" },
    };
    subtitleCell.alignment = {
      vertical: "middle",
      horizontal: "left",
      wrapText: true,
    };

    sheet.getRow(2).height = 24;
  }
}

function styleHeader(row: ExcelJS.Row) {
  row.font = {
    bold: true,
    color: { argb: "FFFFFFFF" },
  };

  row.height = 22;

  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF111827" },
    };

    cell.alignment = {
      vertical: "middle",
      horizontal: "left",
      wrapText: true,
    };

    cell.border = {
      top: { style: "thin", color: { argb: "FFD1D5DB" } },
      bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
      left: { style: "thin", color: { argb: "FFD1D5DB" } },
      right: { style: "thin", color: { argb: "FFD1D5DB" } },
    };
  });
}

function styleRows(sheet: ExcelJS.Worksheet, startRow = 4) {
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber < startRow) return;

    row.eachCell((cell) => {
      cell.alignment = {
        vertical: "top",
        horizontal: "left",
        wrapText: true,
      };

      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };

      if (rowNumber % 2 === 0) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF9FAFB" },
        };
      }
    });
  });
}

function freezeAndFilter(sheet: ExcelJS.Worksheet, headerRowNumber = 3) {
  sheet.views = [
    {
      state: "frozen",
      ySplit: headerRowNumber,
    },
  ];

  const headerRow = sheet.getRow(headerRowNumber);
  const cellCount = headerRow.cellCount || 1;

  sheet.autoFilter = {
    from: {
      row: headerRowNumber,
      column: 1,
    },
    to: {
      row: headerRowNumber,
      column: cellCount,
    },
  };
}

function autoWidth(sheet: ExcelJS.Worksheet) {
  sheet.columns.forEach((column) => {
    let maxLength = 12;

    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const value = cell.value;

      let text = "";

      if (value === null || value === undefined) {
        text = "";
      } else if (typeof value === "object") {
        text = JSON.stringify(value);
      } else {
        text = String(value);
      }

      maxLength = Math.max(maxLength, Math.min(text.length + 2, 55));
    });

    column.width = Math.max(14, maxLength);
  });
}

function formatMoneyColumns(sheet: ExcelJS.Worksheet, columns: number[]) {
  columns.forEach((columnNumber) => {
    sheet.getColumn(columnNumber).numFmt = "£#,##0.00;[Red]-£#,##0.00";
  });
}

async function workbookBuffer(workbook: ExcelJS.Workbook): Promise<ArrayBuffer> {
  const buffer = await workbook.xlsx.writeBuffer();
  return toArrayBuffer(buffer);
}

function getTransactionDate(item: AnyRecord) {
  return item.transaction_date || item.date || item.created_at || "";
}

function getAmount(item: AnyRecord) {
  return pence(item.amount_pence);
}

function isDeleted(item: AnyRecord) {
  return Boolean(item.deleted_at);
}

function isIncome(item: AnyRecord) {
  return String(item.type || "").toLowerCase() === "income";
}

function isExpense(item: AnyRecord) {
  return String(item.type || "").toLowerCase() === "expense";
}

function isPersonalFunds(item: AnyRecord) {
  return Boolean(item.is_personal_funds);
}

function isPersonalFundsRepaid(item: AnyRecord) {
  return Boolean(item.personal_funds_repaid);
}

async function readTransactions(year: number) {
  const start = `${year}-01-01`;
  const end = `${year + 1}-01-01`;

  const { data, error } = await supabaseAdmin
    .from("money_transactions")
    .select("*")
    .gte("transaction_date", start)
    .lt("transaction_date", end)
    .order("transaction_date", { ascending: true });

  if (error) {
    throw new Error(`money_transactions fallback failed: ${error.message}`);
  }

  return (data || []) as AnyRecord[];
}

async function readSponsors() {
  const { data, error } = await supabaseAdmin
    .from("money_sponsors")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    return [] as AnyRecord[];
  }

  return (data || []) as AnyRecord[];
}

async function readExportLogs(year: number) {
  const start = `${year}-01-01`;
  const end = `${year + 1}-01-01`;

  const { data, error } = await supabaseAdmin
    .from("money_export_logs")
    .select("*")
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at", { ascending: false });

  if (error) {
    return [] as AnyRecord[];
  }

  return (data || []) as AnyRecord[];
}

async function readCsvImportHistory(year: number) {
  const start = `${year}-01-01`;
  const end = `${year + 1}-01-01`;

  const tableNames = [
    "money_csv_import_history",
    "money_csv_import_logs",
    "csv_import_history",
  ];

  for (const table of tableNames) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select("*")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false });

    if (!error) return (data || []) as AnyRecord[];
  }

  return [] as AnyRecord[];
}

async function readBankChecks(year: number) {
  const start = `${year}-01-01`;
  const end = `${year + 1}-01-01`;

  const tableNames = [
    "money_bank_balance_checks",
    "bank_balance_checks",
    "money_bank_checks",
  ];

  for (const table of tableNames) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select("*")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false });

    if (!error) return (data || []) as AnyRecord[];
  }

  return [] as AnyRecord[];
}

function sponsorMatchesTransaction(sponsor: AnyRecord, transaction: AnyRecord) {
  if (sponsor.id && transaction.sponsor_id) {
    return String(sponsor.id) === String(transaction.sponsor_id);
  }

  if (sponsor.sponsor_name && transaction.sponsor_name) {
    return (
      String(sponsor.sponsor_name).toLowerCase().trim() ===
      String(transaction.sponsor_name).toLowerCase().trim()
    );
  }

  return false;
}

function createYearlyWorkbook(year: number, transactions: AnyRecord[]) {
  const active = transactions.filter((item) => !isDeleted(item));

  const income = active
    .filter(isIncome)
    .reduce((sum, item) => sum + getAmount(item), 0);

  const expenses = active
    .filter(isExpense)
    .reduce((sum, item) => sum + getAmount(item), 0);

  const personal = active
    .filter(isPersonalFunds)
    .reduce((sum, item) => sum + getAmount(item), 0);

  const repaid = active
    .filter((item) => isPersonalFunds(item) && isPersonalFundsRepaid(item))
    .reduce((sum, item) => sum + getAmount(item), 0);

  const workbook = createWorkbook(`Yearly Report ${year}`);
  const sheet = workbook.addWorksheet("Yearly Report");

  addTitle(
    sheet,
    `Burton Pride C.I.C - Yearly Report ${year}`,
    "Fallback report built inside the accountant pack.",
    "D"
  );

  sheet.addRow([]);
  sheet.addRow(["Section", "Amount", "Notes", "Check"]);
  styleHeader(sheet.getRow(3));

  sheet.addRow(["Total income", pounds(income), "Money received", ""]);
  sheet.addRow(["Total expenses", pounds(expenses), "Money spent", ""]);
  sheet.addRow(["Year balance", pounds(income - expenses), "Income minus expenses", ""]);
  sheet.addRow(["Personal funds used", pounds(personal), "Paid personally", ""]);
  sheet.addRow(["Personal funds repaid", pounds(repaid), "Marked as repaid", ""]);
  sheet.addRow([
    "Personal funds outstanding",
    pounds(personal - repaid),
    "Still owed back",
    personal - repaid > 0 ? "Needs checking" : "OK",
  ]);

  styleRows(sheet, 4);
  formatMoneyColumns(sheet, [2]);
  autoWidth(sheet);
  freezeAndFilter(sheet, 3);

  return workbook;
}

function createTransactionsWorkbook(year: number, transactions: AnyRecord[]) {
  const workbook = createWorkbook(`Transaction List ${year}`);
  const sheet = workbook.addWorksheet("Transactions");

  addTitle(
    sheet,
    `Burton Pride C.I.C - Transaction List ${year}`,
    "Fallback transaction list built inside the accountant pack.",
    "V"
  );

  sheet.addRow([]);
  sheet.addRow([
    "Date",
    "Title",
    "Description",
    "Type",
    "Category",
    "Payment Method",
    "Amount",
    "Sponsor ID",
    "Sponsor Name",
    "Sponsorship Note",
    "Personal Funds",
    "Personal Funds Name",
    "Paid Back",
    "Paid Back At",
    "Receipt URL",
    "Finance Note",
    "Bank Status",
    "Bank Note",
    "Source",
    "Created By",
    "Updated By",
    "Created At",
  ]);

  styleHeader(sheet.getRow(3));

  transactions
    .filter((item) => !isDeleted(item))
    .forEach((item) => {
      sheet.addRow([
        dateOnly(getTransactionDate(item)),
        item.title || "",
        item.description || "",
        item.type || "",
        item.category || "",
        item.payment_method || "",
        pounds(item.amount_pence),
        item.sponsor_id || "",
        item.sponsor_name || "",
        item.sponsorship_note || "",
        item.is_personal_funds ? "Yes" : "No",
        item.personal_funds_name || "",
        item.personal_funds_repaid ? "Yes" : "No",
        dateOnly(item.personal_funds_repaid_at),
        item.invoice_image_url || "",
        item.finance_note || "",
        item.bank_reconciliation_status || "",
        item.bank_reconciliation_note || "",
        item.source || "",
        item.created_by_name || item.created_by_email || "",
        item.updated_by_name || item.updated_by_email || "",
        dateTimeText(item.created_at),
      ]);
    });

  styleRows(sheet, 4);
  formatMoneyColumns(sheet, [7]);
  autoWidth(sheet);
  freezeAndFilter(sheet, 3);

  return workbook;
}

function createReceiptsWorkbook(year: number, transactions: AnyRecord[]) {
  const workbook = createWorkbook(`Receipts Index ${year}`);
  const sheet = workbook.addWorksheet("Receipts Index");

  addTitle(
    sheet,
    `Burton Pride C.I.C - Receipts Index ${year}`,
    "Fallback receipts index built inside the accountant pack.",
    "J"
  );

  sheet.addRow([]);
  sheet.addRow([
    "Date",
    "Transaction",
    "Type",
    "Category",
    "Payment Method",
    "Amount",
    "Receipt Status",
    "Receipt URL",
    "Notes",
    "Check",
  ]);

  styleHeader(sheet.getRow(3));

  transactions
    .filter((item) => !isDeleted(item))
    .forEach((item) => {
      const needsReceipt =
        item.receipt_required ||
        item.receipt_missing ||
        isExpense(item) ||
        item.payment_method === "Personal Funds";

      const hasReceipt = Boolean(item.invoice_image_url);

      sheet.addRow([
        dateOnly(getTransactionDate(item)),
        item.title || "",
        item.type || "",
        item.category || "",
        item.payment_method || "",
        pounds(item.amount_pence),
        hasReceipt ? "Uploaded" : needsReceipt ? "Missing" : "Not required",
        item.invoice_image_url || "",
        item.description || item.finance_note || "",
        !hasReceipt && needsReceipt ? "Needs receipt" : "OK",
      ]);
    });

  styleRows(sheet, 4);
  formatMoneyColumns(sheet, [6]);
  autoWidth(sheet);
  freezeAndFilter(sheet, 3);

  return workbook;
}

function getLogAction(log: AnyRecord) {
  const action = log.action || log.export_type || log.status || "";

  if (String(action).toLowerCase() === "export" && log.status) {
    return `Export ${titleCase(log.status)}`;
  }

  if (String(action).toLowerCase() === "print" && log.status) {
    return `Print ${titleCase(log.status)}`;
  }

  return titleCase(action);
}

function getLogRisk(log: AnyRecord) {
  const action = String(getLogAction(log)).toLowerCase();
  const status = String(log.status || "").toLowerCase();

  if (action.includes("delete") || action.includes("failed") || status === "failed") {
    return "High";
  }

  if (action.includes("export") || action.includes("print") || action.includes("edit")) {
    return "Medium";
  }

  return "Low";
}

function createAuditLogsWorkbook(year: number, logs: AnyRecord[]) {
  const workbook = createWorkbook(`Audit Logs ${year}`);
  const sheet = workbook.addWorksheet("Audit Logs");

  addTitle(
    sheet,
    `Burton Pride C.I.C - Audit Logs ${year}`,
    `Fallback audit logs built from money_export_logs. Rows: ${logs.length}`,
    "N"
  );

  sheet.addRow([]);
  sheet.addRow([
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
    "Status",
    "Log ID",
  ]);

  styleHeader(sheet.getRow(3));

  logs.forEach((log) => {
    const metadata = log.metadata || {};
    const changed =
      metadata.changed_fields ||
      metadata.included_files ||
      metadata.tables_used ||
      {};

    const changedNames = Array.isArray(changed)
      ? changed
      : changed && typeof changed === "object"
        ? Object.keys(changed)
        : [];

    sheet.addRow([
      dateTimeText(log.created_at),
      getLogAction(log),
      getLogRisk(log),
      titleCase(log.export_key || metadata.area || "Money Tracker"),
      log.export_title || log.file_name || metadata.title || "",
      log.export_key || metadata.record_id || "",
      log.actor_name || log.user_name || "Unknown user",
      log.actor_email || log.user_email || "",
      log.actor_admin_id || log.actor_user_id || log.user_id || "",
      changedNames.join(", "),
      changedNames.length,
      log.route || metadata.source || "Money Tracker",
      titleCase(log.status || ""),
      log.id || "",
    ]);
  });

  styleRows(sheet, 4);
  autoWidth(sheet);
  freezeAndFilter(sheet, 3);

  sheet.getColumn(1).width = 22;
  sheet.getColumn(2).width = 18;
  sheet.getColumn(3).width = 12;
  sheet.getColumn(5).width = 34;
  sheet.getColumn(8).width = 34;
  sheet.getColumn(10).width = 50;

  return workbook;
}

function createFundingWorkbook(
  year: number,
  transactions: AnyRecord[],
  sponsors: AnyRecord[]
) {
  const workbook = createWorkbook(`Funding Breakdown ${year}`);
  const sheet = workbook.addWorksheet("Funding Breakdown");

  addTitle(
    sheet,
    `Burton Pride C.I.C - Funding Breakdown ${year}`,
    "Fallback funding report built inside the accountant pack.",
    "L"
  );

  sheet.addRow([]);
  sheet.addRow([
    "Sponsor / Funding Name",
    "Contact Name",
    "Email",
    "Phone",
    "Agreed Amount",
    "Received",
    "Spent",
    "Remaining",
    "Linked Transactions",
    "Notes",
    "Active",
    "Created At",
  ]);

  styleHeader(sheet.getRow(3));

  sponsors.forEach((sponsor) => {
    const linked = transactions.filter((item) =>
      sponsorMatchesTransaction(sponsor, item)
    );

    const received = linked
      .filter(isIncome)
      .reduce((sum, item) => sum + getAmount(item), 0);

    const spent = linked
      .filter(isExpense)
      .reduce((sum, item) => sum + getAmount(item), 0);

    sheet.addRow([
      sponsor.sponsor_name || sponsor.name || "",
      sponsor.contact_name || "",
      sponsor.email || "",
      sponsor.phone || "",
      pounds(sponsor.agreed_amount_pence),
      pounds(received),
      pounds(spent),
      pounds(received - spent),
      linked.length,
      sponsor.notes || "",
      sponsor.is_active === false ? "No" : "Yes",
      dateTimeText(sponsor.created_at),
    ]);
  });

  const linkedNames = new Set(
    sponsors.map((sponsor) =>
      String(sponsor.sponsor_name || sponsor.name || "").toLowerCase().trim()
    )
  );

  const withoutRecord = transactions.filter((item) => {
    if (!item.sponsor_name && !item.sponsor_id) return false;
    const name = String(item.sponsor_name || "").toLowerCase().trim();
    return name && !linkedNames.has(name);
  });

  const missingNames = Array.from(
    new Set(withoutRecord.map((item) => item.sponsor_name || item.sponsor_id))
  );

  missingNames.forEach((name) => {
    const linked = withoutRecord.filter(
      (item) => (item.sponsor_name || item.sponsor_id) === name
    );

    const received = linked
      .filter(isIncome)
      .reduce((sum, item) => sum + getAmount(item), 0);

    const spent = linked
      .filter(isExpense)
      .reduce((sum, item) => sum + getAmount(item), 0);

    sheet.addRow([
      name,
      "",
      "",
      "",
      "",
      pounds(received),
      pounds(spent),
      pounds(received - spent),
      linked.length,
      "Linked transactions found but no matching sponsor/funding record.",
      "Check",
      "",
    ]);
  });

  styleRows(sheet, 4);
  formatMoneyColumns(sheet, [5, 6, 7, 8]);
  autoWidth(sheet);
  freezeAndFilter(sheet, 3);

  return workbook;
}

function createPersonalFundsWorkbook(year: number, transactions: AnyRecord[]) {
  const workbook = createWorkbook(`Personal Funds ${year}`);
  const sheet = workbook.addWorksheet("Personal Funds");

  addTitle(
    sheet,
    `Burton Pride C.I.C - Personal Funds ${year}`,
    "Fallback personal funds report built inside the accountant pack.",
    "K"
  );

  sheet.addRow([]);
  sheet.addRow([
    "Date",
    "Person",
    "Title",
    "Type",
    "Category",
    "Amount",
    "Paid Back",
    "Paid Back At",
    "Outstanding",
    "Receipt",
    "Notes",
  ]);

  styleHeader(sheet.getRow(3));

  transactions
    .filter((item) => !isDeleted(item) && isPersonalFunds(item))
    .forEach((item) => {
      const amount = getAmount(item);
      const repaid = isPersonalFundsRepaid(item);

      sheet.addRow([
        dateOnly(getTransactionDate(item)),
        item.personal_funds_name || "",
        item.title || "",
        item.type || "",
        item.category || "",
        pounds(amount),
        repaid ? "Yes" : "No",
        dateOnly(item.personal_funds_repaid_at),
        repaid ? 0 : pounds(amount),
        item.invoice_image_url || "",
        item.description || item.finance_note || "",
      ]);
    });

  styleRows(sheet, 4);
  formatMoneyColumns(sheet, [6, 9]);
  autoWidth(sheet);
  freezeAndFilter(sheet, 3);

  return workbook;
}

function createCsvWorkbook(year: number, rows: AnyRecord[]) {
  const workbook = createWorkbook(`CSV Import History ${year}`);
  const sheet = workbook.addWorksheet("CSV Import History");

  addTitle(
    sheet,
    `Burton Pride C.I.C - CSV Import History ${year}`,
    "Fallback CSV import history built inside the accountant pack.",
    "K"
  );

  sheet.addRow([]);
  sheet.addRow([
    "Created At",
    "File Name",
    "Imported By Name",
    "Imported By Email",
    "Status",
    "Rows Total",
    "Rows Imported",
    "Rows Failed",
    "Error Notes",
    "Metadata",
    "ID",
  ]);

  styleHeader(sheet.getRow(3));

  rows.forEach((item) => {
    sheet.addRow([
      dateTimeText(item.created_at),
      item.file_name || item.csv_file_name || "",
      item.imported_by_name || item.created_by_name || "",
      item.imported_by_email || item.created_by_email || "",
      item.status || "",
      item.rows_total ?? item.total_rows ?? "",
      item.rows_imported ?? item.imported_rows ?? "",
      item.rows_failed ?? item.failed_rows ?? "",
      item.error_notes || item.error_message || "",
      jsonText(item.metadata),
      item.id || "",
    ]);
  });

  styleRows(sheet, 4);
  autoWidth(sheet);
  freezeAndFilter(sheet, 3);

  return workbook;
}

function createBankChecksWorkbook(year: number, rows: AnyRecord[]) {
  const workbook = createWorkbook(`Bank Balance Checks ${year}`);
  const sheet = workbook.addWorksheet("Bank Balance Checks");

  addTitle(
    sheet,
    `Burton Pride C.I.C - Bank Balance Checks ${year}`,
    "Fallback bank checks report built inside the accountant pack.",
    "J"
  );

  sheet.addRow([]);
  sheet.addRow([
    "Check Date",
    "Bank Statement Balance",
    "Tracker Balance",
    "Difference",
    "Status",
    "Notes",
    "Created By Name",
    "Created By Email",
    "Created At",
    "ID",
  ]);

  styleHeader(sheet.getRow(3));

  rows.forEach((item) => {
    const bankBalance = pence(
      item.bank_statement_balance_pence ??
        item.real_bank_balance_pence ??
        item.statement_balance_pence
    );

    const trackerBalance = pence(
      item.tracker_balance_pence ?? item.money_tracker_balance_pence
    );

    const difference =
      item.difference_pence !== undefined && item.difference_pence !== null
        ? pence(item.difference_pence)
        : bankBalance - trackerBalance;

    sheet.addRow([
      dateOnly(item.check_date || item.created_at),
      pounds(bankBalance),
      pounds(trackerBalance),
      pounds(difference),
      difference === 0 ? "Matched" : "Difference found",
      item.notes || item.note || "",
      item.created_by_name || item.checked_by_name || "",
      item.created_by_email || item.checked_by_email || "",
      dateTimeText(item.created_at),
      item.id || "",
    ]);
  });

  styleRows(sheet, 4);
  formatMoneyColumns(sheet, [2, 3, 4]);
  autoWidth(sheet);
  freezeAndFilter(sheet, 3);

  return workbook;
}

async function buildFallbackExport(
  exportItem: PackExportRoute,
  year: number
): Promise<ArrayBuffer> {
  const transactions = await readTransactions(year);

  if (exportItem.key === "yearly-report") {
    return workbookBuffer(createYearlyWorkbook(year, transactions));
  }

  if (exportItem.key === "transaction-list") {
    return workbookBuffer(createTransactionsWorkbook(year, transactions));
  }

  if (exportItem.key === "receipts") {
    return workbookBuffer(createReceiptsWorkbook(year, transactions));
  }

  if (exportItem.key === "audit-logs") {
    const logs = await readExportLogs(year);
    return workbookBuffer(createAuditLogsWorkbook(year, logs));
  }

  if (exportItem.key === "funding-breakdown") {
    const sponsors = await readSponsors();
    return workbookBuffer(createFundingWorkbook(year, transactions, sponsors));
  }

  if (exportItem.key === "personal-funds") {
    return workbookBuffer(createPersonalFundsWorkbook(year, transactions));
  }

  if (exportItem.key === "csv-import-history") {
    const rows = await readCsvImportHistory(year);
    return workbookBuffer(createCsvWorkbook(year, rows));
  }

  if (exportItem.key === "bank-balance-checks") {
    const rows = await readBankChecks(year);
    return workbookBuffer(createBankChecksWorkbook(year, rows));
  }

  throw new Error(`No fallback builder exists for ${exportItem.key}`);
}

function buildFailedExportText(failed: FailedExport) {
  return [
    `${failed.title} failed`,
    "",
    "WHAT HAPPENED",
    "The accountant pack tried the export API route and then tried to build a fallback file internally, but both failed.",
    "",
    "MAIN LIKELY FIX",
    failed.likelyFix,
    "",
    "ROUTES TRIED",
    ...failed.attempts.flatMap((attempt, index) => [
      "",
      `${index + 1}. ${attempt.route}`,
      `   Route file: ${attempt.routeFile}`,
      `   Full URL: ${attempt.fullUrl}`,
      `   HTTP status: ${attempt.status || "No response"} ${
        attempt.statusText || ""
      }`.trim(),
      `   Content type: ${attempt.contentType || "Unknown"}`,
      `   File size: ${
        attempt.fileSizeBytes !== undefined
          ? `${attempt.fileSizeBytes} bytes`
          : "No file returned"
      }`,
      `   Likely fix: ${attempt.likelyFix || "Check route logs."}`,
      attempt.errorBody ? `   Server error:\n${attempt.errorBody}` : "",
    ]),
    "",
    "NEXT STEPS",
    "1. Open the route file shown above.",
    "2. Check terminal/Vercel logs.",
    "3. Check Supabase table and column names.",
    "4. Check the route exports a named GET function.",
    "5. If the API route is broken, check the fallback builder in accountant-export-pack/route.ts.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

async function fetchExportFile({
  req,
  baseUrl,
  year,
  exportItem,
}: {
  req: Request;
  baseUrl: string;
  year: number;
  exportItem: PackExportRoute;
}) {
  const cookie = req.headers.get("cookie") || "";
  const authorization = req.headers.get("authorization") || "";
  const attemptedRoutes: string[] = [];
  const attempts: ExportAttempt[] = [];
  const errors: string[] = [];

  for (const route of exportItem.routes) {
    const routeWithYear = addYearToRoute(route, year);
    const routeFile = routeToFilePath(routeWithYear);
    const fullUrl = `${baseUrl}${routeWithYear}`;

    attemptedRoutes.push(routeWithYear);

    try {
      const response = await fetch(fullUrl, {
        method: "GET",
        cache: "no-store",
        headers: {
          cookie,
          ...(authorization ? { authorization } : {}),
          "x-accountant-pack-request": "true",
        },
      });

      const contentType = response.headers.get("content-type") || "";

      if (!response.ok) {
        const errorBody = await readErrorBody(response);
        const likelyFix = getLikelyFix(response.status, routeWithYear, errorBody);

        attempts.push({
          route: routeWithYear,
          fullUrl,
          routeFile,
          status: response.status,
          statusText: response.statusText,
          contentType,
          errorBody,
          likelyFix,
        });

        errors.push(
          `${exportItem.title}: ${routeWithYear} returned ${response.status} ${
            response.statusText || ""
          }. ${likelyFix}`
        );

        continue;
      }

      if (!isProbablyFileResponse(contentType)) {
        const body = await readErrorBody(response);
        const likelyFix = `Open ${routeFile}. This route returned 200 OK but content type was "${contentType}", not a file.`;

        attempts.push({
          route: routeWithYear,
          fullUrl,
          routeFile,
          status: response.status,
          statusText: response.statusText,
          contentType,
          errorBody: body.slice(0, 3000),
          likelyFix,
        });

        errors.push(`${exportItem.title}: ${routeWithYear} returned non-file content.`);
        continue;
      }

      const arrayBuffer = await response.arrayBuffer();

      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        const likelyFix = `Open ${routeFile}. The route returned 200 OK but the file body was empty.`;

        attempts.push({
          route: routeWithYear,
          fullUrl,
          routeFile,
          status: response.status,
          statusText: response.statusText,
          contentType,
          fileSizeBytes: 0,
          errorBody: "The route returned an empty file.",
          likelyFix,
        });

        errors.push(`${exportItem.title}: ${routeWithYear} returned an empty file.`);
        continue;
      }

      const sourceFileName = getFileNameFromDisposition(
        response.headers.get("content-disposition")
      );

      const fileName = makePackFileName({
        prefix: exportItem.filePrefix,
        year,
        sourceFileName,
        contentType:
          contentType ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      attempts.push({
        route: routeWithYear,
        fullUrl,
        routeFile,
        status: response.status,
        statusText: response.statusText,
        contentType,
        fileSizeBytes: arrayBuffer.byteLength,
      });

      return {
        ok: true as const,
        key: exportItem.key,
        title: exportItem.title,
        route: routeWithYear,
        routeFile,
        fileName,
        contentType,
        size: arrayBuffer.byteLength,
        data: arrayBuffer,
        attemptedRoutes,
        attempts,
        errors,
        source: "api" as const,
      };
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      const likelyFix = `The pack could not call ${routeWithYear}. Check base URL, middleware, and route availability.`;

      attempts.push({
        route: routeWithYear,
        fullUrl,
        routeFile,
        errorBody: errorMessage,
        likelyFix,
      });

      errors.push(`${exportItem.title}: ${routeWithYear} crashed: ${errorMessage}`);
    }
  }

  try {
    const fallbackArrayBuffer = await buildFallbackExport(exportItem, year);

    if (!fallbackArrayBuffer || fallbackArrayBuffer.byteLength === 0) {
      throw new Error("Fallback builder returned an empty file.");
    }

    const fileName = `${exportItem.filePrefix}-${year}.xlsx`;
    const routeWithYear = `internal-fallback:${exportItem.key}?year=${year}`;

    attempts.push({
      route: routeWithYear,
      fullUrl: routeWithYear,
      routeFile: "app/api/admin/money/export/accountant-export-pack/route.ts",
      status: 200,
      statusText: "Fallback OK",
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileSizeBytes: fallbackArrayBuffer.byteLength,
      likelyFix:
        "The original export API failed, but the accountant pack fallback built this file successfully.",
    });

    return {
      ok: true as const,
      key: exportItem.key,
      title: exportItem.title,
      route: routeWithYear,
      routeFile: "app/api/admin/money/export/accountant-export-pack/route.ts",
      fileName,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: fallbackArrayBuffer.byteLength,
      data: fallbackArrayBuffer,
      attemptedRoutes,
      attempts,
      errors,
      source: "fallback" as const,
    };
  } catch (fallbackError: any) {
    const fallbackMessage = fallbackError?.message || String(fallbackError);

    attempts.push({
      route: `internal-fallback:${exportItem.key}?year=${year}`,
      fullUrl: `internal-fallback:${exportItem.key}?year=${year}`,
      routeFile: "app/api/admin/money/export/accountant-export-pack/route.ts",
      errorBody: fallbackMessage,
      likelyFix:
        "The fallback builder failed. Check Supabase table names used inside accountant-export-pack/route.ts.",
    });

    errors.push(`${exportItem.title}: fallback builder failed: ${fallbackMessage}`);
  }

  const mainLikelyFix =
    attempts.find((attempt) => attempt.status === 500)?.likelyFix ||
    attempts.find((attempt) => attempt.status === 404)?.likelyFix ||
    attempts.find((attempt) => attempt.status === 405)?.likelyFix ||
    attempts[0]?.likelyFix ||
    `Check the export route and fallback builder for ${exportItem.title}.`;

  return {
    ok: false as const,
    key: exportItem.key,
    title: exportItem.title,
    fileName: `${exportItem.filePrefix}-${year}-FAILED.txt`,
    required: Boolean(exportItem.required),
    attemptedRoutes,
    attempts,
    errors,
    likelyFix: mainLikelyFix,
  };
}

function buildDebugJson({
  year,
  baseUrl,
  successFiles,
  failedFiles,
}: {
  year: number;
  baseUrl: string;
  successFiles: SuccessfulExport[];
  failedFiles: FailedExport[];
}) {
  return JSON.stringify(
    {
      ok: failedFiles.length === 0,
      year,
      generated_at: new Date().toISOString(),
      base_url: baseUrl,
      successful_exports: successFiles,
      failed_exports: failedFiles,
      required_failures: failedFiles.filter((item) => item.required),
      quick_fix_summary:
        failedFiles.length === 0
          ? "No failed exports."
          : failedFiles.map((item) => ({
              export: item.title,
              required: item.required,
              likely_fix: item.likelyFix,
              routes_tried: item.attemptedRoutes,
              route_files: item.attempts.map((attempt) => attempt.routeFile),
            })),
    },
    null,
    2
  );
}

function buildReadme({
  year,
  generatedBy,
  generatedByEmail,
  baseUrl,
  successFiles,
  failedFiles,
}: {
  year: number;
  generatedBy: string;
  generatedByEmail: string | null;
  baseUrl: string;
  successFiles: SuccessfulExport[];
  failedFiles: FailedExport[];
}) {
  return [
    "Burton Pride C.I.C Accountant Export Pack",
    "",
    `Year: ${year}`,
    `Generated: ${new Date().toISOString()}`,
    `Generated by: ${generatedBy}${generatedByEmail ? ` <${generatedByEmail}>` : ""}`,
    `Base URL used: ${baseUrl}`,
    "",
    "WHAT THIS PACK DOES",
    "This ZIP calls the separate export APIs first. If one fails, it builds a fallback Excel file inside the accountant pack route.",
    "",
    "INCLUDED FILES",
    successFiles.length
      ? successFiles
          .map(
            (item) =>
              `- ${item.fileName} | ${item.title} | Source: ${item.source} | Route: ${item.route} | File: ${item.routeFile} | Size: ${(
                item.size / 1024
              ).toFixed(1)} KB`
          )
          .join("\n")
      : "- No exports downloaded successfully.",
    "",
    failedFiles.length > 0 ? "FAILED OR MISSING EXPORTS" : "FAILED OR MISSING EXPORTS: none",
    failedFiles.length > 0
      ? failedFiles
          .map((item) =>
            [
              `- ${item.title}`,
              `  Required: ${item.required ? "Yes" : "No"}`,
              `  File added: ${item.fileName}`,
              `  Likely fix: ${item.likelyFix}`,
              `  Routes tried: ${item.attemptedRoutes.join(", ")}`,
            ].join("\n")
          )
          .join("\n")
      : "",
    "",
    "HOW TO FIX FAILED EXPORTS",
    "1. Open ACCOUNTANT-PACK-DEBUG.json in this ZIP.",
    "2. Find failed_exports.",
    "3. Open the routeFile shown for the failed route or fallback builder.",
    "4. Check errorBody/server error.",
    "5. Fix the route path, missing GET export, or Supabase table/column name.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function GET(req: Request) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return NextResponse.json(
      {
        error: "Unauthorised",
        likelyFix: "Sign in again as an admin, then try downloading the accountant pack.",
      },
      {
        status: 401,
      }
    );
  }

  const actorAdminId = getActorAdminId(admin);
  const actorName = getActorName(admin);
  const actorEmail = getActorEmail(admin);

  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year") || new Date().getFullYear());

  if (!isValidYear(year)) {
    return NextResponse.json(
      {
        error: "Invalid year",
        details: "Year must be between 2000 and 2100.",
        receivedYear: url.searchParams.get("year"),
        likelyFix:
          "Change the export URL to include a valid year, for example ?year=2026.",
      },
      {
        status: 400,
      }
    );
  }

  const route = "/api/admin/money/export/accountant-export-pack";
  const fileName = `burton-pride-accountant-export-pack-${safeFileNamePart(
    String(year)
  )}.zip`;

  const baseUrl = getBaseUrl(req);
  const zip = new JSZip();

  await savePackLog({
    year,
    route,
    fileName,
    status: "started",
    actorAdminId,
    actorName,
    actorEmail,
    metadata: {
      mode: "api_first_with_internal_fallback",
      base_url: baseUrl,
      exports_requested: PACK_EXPORTS.map((item) => item.key),
      routes: PACK_EXPORTS.map((item) => ({
        key: item.key,
        title: item.title,
        routes: item.routes,
      })),
    },
  });

  try {
    const results = await Promise.all(
      PACK_EXPORTS.map((exportItem) =>
        fetchExportFile({
          req,
          baseUrl,
          year,
          exportItem,
        })
      )
    );

    const successFiles: SuccessfulExport[] = [];
    const failedFiles: FailedExport[] = [];

    for (const result of results) {
      if (result.ok) {
        zip.file(result.fileName, result.data);

        successFiles.push({
          key: result.key,
          title: result.title,
          route: result.route,
          routeFile: result.routeFile,
          fileName: result.fileName,
          size: result.size,
          contentType: result.contentType,
          source: result.source,
        });

        continue;
      }

      const failedExport: FailedExport = {
        key: result.key,
        title: result.title,
        fileName: result.fileName,
        required: result.required,
        attemptedRoutes: result.attemptedRoutes,
        attempts: result.attempts,
        errors: result.errors,
        likelyFix: result.likelyFix,
      };

      failedFiles.push(failedExport);
      zip.file(result.fileName, buildFailedExportText(failedExport));
    }

    zip.file(
      "ACCOUNTANT-PACK-DEBUG.json",
      buildDebugJson({
        year,
        baseUrl,
        successFiles,
        failedFiles,
      })
    );

    zip.file(
      `README-${year}.txt`,
      buildReadme({
        year,
        generatedBy: actorName,
        generatedByEmail: actorEmail,
        baseUrl,
        successFiles,
        failedFiles,
      })
    );

    const requiredFailures = failedFiles.filter((failed) =>
      PACK_EXPORTS.find((item) => item.key === failed.key && item.required)
    );

    const zipArrayBuffer = await zip.generateAsync({
      type: "arraybuffer",
      compression: "DEFLATE",
      compressionOptions: {
        level: 6,
      },
    });

    await savePackLog({
      year,
      route,
      fileName,
      status: requiredFailures.length > 0 ? "failed" : "success",
      actorAdminId,
      actorName,
      actorEmail,
      errorMessage:
        requiredFailures.length > 0
          ? `Required exports failed: ${requiredFailures
              .map((item) => item.title)
              .join(", ")}`
          : failedFiles.length > 0
            ? `Optional exports failed: ${failedFiles
                .map((item) => item.title)
                .join(", ")}`
            : null,
      metadata: {
        mode: "api_first_with_internal_fallback",
        base_url: baseUrl,
        successful_exports: successFiles,
        failed_exports: failedFiles,
        required_failures: requiredFailures,
        file_size_bytes: zipArrayBuffer.byteLength,
      },
    });

    return new NextResponse(zipArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
        "X-Accountant-Pack-Successful-Exports": String(successFiles.length),
        "X-Accountant-Pack-Failed-Exports": String(failedFiles.length),
        "X-Accountant-Pack-Required-Failures": String(requiredFailures.length),
      },
    });
  } catch (error: any) {
    console.error("Accountant export pack failed:", error);

    const message = error?.message || "Accountant export pack failed.";

    await savePackLog({
      year,
      route,
      fileName,
      status: "failed",
      actorAdminId,
      actorName,
      actorEmail,
      errorMessage: message,
      metadata: {
        mode: "api_first_with_internal_fallback",
        base_url: baseUrl,
        stack: error?.stack || null,
      },
    });

    return NextResponse.json(
      {
        error: message,
        route,
        expectedFile:
          "app/api/admin/money/export/accountant-export-pack/route.ts",
        baseUrl,
        likelyFix:
          "Check ACCOUNTANT-PACK-DEBUG.json if a ZIP downloaded. If no ZIP downloaded, check this route file, JSZip, Supabase admin auth, and Vercel/terminal logs.",
        checks: [
          "Make sure JSZip and ExcelJS are installed.",
          "Make sure this route exports named GET.",
          "Make sure the smaller export APIs exist.",
          "Make sure each smaller export API returns a real file body.",
          "Make sure Supabase table and column names match the fallback builders.",
          "Make sure PACK_EXPORTS uses your real route names.",
        ],
        stack: process.env.NODE_ENV === "development" ? error?.stack : undefined,
      },
      {
        status: 500,
      }
    );
  }
}