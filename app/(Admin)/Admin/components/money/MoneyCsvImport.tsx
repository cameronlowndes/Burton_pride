"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Edit3,
  FileClock,
  FileSpreadsheet,
  Loader2,
  RefreshCcw,
  Search,
  ShieldAlert,
  Upload,
  X,
} from "lucide-react";

type CsvRow = Record<string, string>;

type DuplicateMatch = {
  id: string;
  created_at: string;
  title: string;
  description: string | null;
  type: "income" | "expense";
  category: string | null;
  amount_pence: number;
  payment_method: string | null;
  transaction_date: string | null;
  source: string | null;
  sponsor_name: string | null;
  personal_funds_name: string | null;
};

type PreviewRow = {
  id: string;
  rowNumber: number;
  original: CsvRow;

  selected: boolean;
  valid: boolean;
  errors: string[];

  duplicateChecking: boolean;
  duplicate: boolean;
  duplicateMatches: DuplicateMatch[];
  importAnyway: boolean;

  title: string;
  description: string;
  type: "income" | "expense" | "";
  category: string;
  amountPence: number;
  amountDisplay: string;
  paymentMethod: string;
  transactionDate: string;
  invoiceImageUrl: string;

  isPersonalFunds: boolean;
  personalFundsName: string;
  personalFundsRepaid: boolean;
  personalFundsRepaidAt: string;

  sponsorId: string;
  sponsorName: string;
  sponsorshipNote: string;

  source: string;
  stripeSessionId: string;
  stripeInvoiceId: string;
  stripeCustomerId: string;
  stripePaymentIntentId: string;
};

const DEFAULT_CATEGORIES = [
  "Bank Import",
  "Donation",
  "Sponsorship",
  "Pitch Fee",
  "Food Vendor",
  "Printing",
  "Venue",
  "Insurance",
  "Security",
  "Equipment Hire",
  "Marketing",
  "Accessibility",
  "Transport",
  "Performer",
  "Cash Fundraising",
  "Cash Fundraising Expense",
  "Other",
  "Uncategorised",
];

const PAYMENT_METHODS = [
  "Bank Transfer",
  "Cash",
  "Card",
  "Stripe",
  "PayPal",
  "Cheque",
  "Direct Debit",
  "Standing Order",
  "Other",
];

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normaliseHeader(value: string) {
  return clean(value)
    .toLowerCase()
    .replace(/\uFEFF/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseBoolean(value: string) {
  const text = clean(value).toLowerCase();

  return ["true", "yes", "y", "1", "paid", "repaid"].includes(text);
}

function getFirstValue(row: CsvRow, keys: string[]) {
  for (const key of keys) {
    const normalised = normaliseHeader(key);
    const value = clean(row[normalised]);

    if (value) return value;
  }

  return "";
}

function parseMoneyStringToPence(value: unknown) {
  const raw = clean(value)
    .replace(/£/g, "")
    .replace(/,/g, "")
    .replace(/\s/g, "");

  if (!raw) return 0;

  const isNegative =
    raw.startsWith("-") || (raw.startsWith("(") && raw.endsWith(")"));

  const amount = Number(raw.replace(/[()]/g, ""));

  if (!Number.isFinite(amount)) return Number.NaN;

  const pence = Math.round(Math.abs(amount) * 100);

  return isNegative ? -pence : pence;
}

function parseMoneyToPence(row: CsvRow) {
  const amountPenceRaw = clean(row.amount_pence);

  if (amountPenceRaw) {
    const pence = Number(amountPenceRaw);

    if (Number.isFinite(pence)) {
      return Math.round(Math.abs(pence));
    }
  }

  const moneyIn = parseMoneyStringToPence(
    getFirstValue(row, ["money_in", "paid_in", "credit", "credits", "deposit", "in"])
  );

  if (Number.isFinite(moneyIn) && moneyIn > 0) {
    return Math.abs(moneyIn);
  }

  const moneyOut = parseMoneyStringToPence(
    getFirstValue(row, ["money_out", "paid_out", "debit", "debits", "withdrawal", "out"])
  );

  if (Number.isFinite(moneyOut) && moneyOut !== 0) {
    return Math.abs(moneyOut);
  }

  const amountRaw =
    getFirstValue(row, ["amount", "transaction_amount", "value", "paid_in_out"]) ||
    clean(row.amount);

  const parsed = parseMoneyStringToPence(amountRaw);

  if (!Number.isFinite(parsed)) return Number.NaN;

  return Math.abs(parsed);
}

function detectType(row: CsvRow): "income" | "expense" | "" {
  const rawType = clean(row.type).toLowerCase();

  if (["income", "in", "credit", "paid in", "money in"].includes(rawType)) {
    return "income";
  }

  if (["expense", "out", "debit", "paid out", "money out"].includes(rawType)) {
    return "expense";
  }

  const moneyIn = parseMoneyStringToPence(
    getFirstValue(row, ["money_in", "paid_in", "credit", "credits", "deposit", "in"])
  );

  if (Number.isFinite(moneyIn) && moneyIn > 0) return "income";

  const moneyOut = parseMoneyStringToPence(
    getFirstValue(row, ["money_out", "paid_out", "debit", "debits", "withdrawal", "out"])
  );

  if (Number.isFinite(moneyOut) && moneyOut !== 0) return "expense";

  const amount = parseMoneyStringToPence(
    getFirstValue(row, ["amount", "transaction_amount", "value", "paid_in_out"])
  );

  if (Number.isFinite(amount) && amount < 0) return "expense";
  if (Number.isFinite(amount) && amount > 0) return "income";

  return "";
}

function normaliseDate(value: string) {
  const raw = clean(value);

  if (!raw) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const ukMatch = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);

  if (ukMatch) {
    const day = ukMatch[1].padStart(2, "0");
    const month = ukMatch[2].padStart(2, "0");
    const year = ukMatch[3].length === 2 ? `20${ukMatch[3]}` : ukMatch[3];

    return `${year}-${month}-${day}`;
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) return raw;

  return date.toISOString().slice(0, 10);
}

function formatMoney(pence: number) {
  return (Number(pence || 0) / 100).toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
  });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Unknown date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = "";
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      currentValue += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      currentRow.push(currentValue);
      currentValue = "";

      if (currentRow.some((cell) => clean(cell) !== "")) {
        rows.push(currentRow);
      }

      currentRow = [];
      continue;
    }

    currentValue += char;
  }

  currentRow.push(currentValue);

  if (currentRow.some((cell) => clean(cell) !== "")) {
    rows.push(currentRow);
  }

  if (rows.length < 2) return [];

  const headers = rows[0].map(normaliseHeader);

  return rows.slice(1).map((row) => {
    const item: CsvRow = {};

    headers.forEach((header, index) => {
      item[header] = clean(row[index]);
    });

    return item;
  });
}

function validatePreviewRow(row: PreviewRow) {
  const errors: string[] = [];

  if (!clean(row.title)) errors.push("Missing title.");

  if (row.type !== "income" && row.type !== "expense") {
    errors.push("Type must be income or expense.");
  }

  if (!Number.isFinite(row.amountPence) || row.amountPence <= 0) {
    errors.push("Amount must be a valid number greater than 0.");
  }

  if (!clean(row.transactionDate)) {
    errors.push("Missing transaction date.");
  } else if (Number.isNaN(Date.parse(row.transactionDate))) {
    errors.push("Transaction date is not valid.");
  }

  if (!clean(row.paymentMethod)) errors.push("Missing payment method.");

  return errors;
}

function applyValidation(row: PreviewRow): PreviewRow {
  const errors = validatePreviewRow(row);
  const valid = errors.length === 0;

  return {
    ...row,
    errors,
    valid,
    selected: row.selected,
    amountDisplay: Number.isFinite(row.amountPence)
      ? formatMoney(row.amountPence)
      : "Invalid",
  };
}

function buildPreviewRow(row: CsvRow, index: number): PreviewRow {
  const title = clean(
    row.title ||
      row.name ||
      row.details ||
      row.description ||
      row.transaction_description ||
      row.payee ||
      row.merchant ||
      row.narrative
  );

  const description = clean(row.description || row.notes || row.memo || row.details);
  const type = detectType(row);
  const amountPence = parseMoneyToPence(row);

  const transactionDate = normaliseDate(
    clean(
      row.transaction_date ||
        row.date ||
        row.posted_date ||
        row.booking_date ||
        row.value_date ||
        row.paid_at ||
        row.created_at
    )
  );

  const paymentMethod =
    clean(row.payment_method || row.method) || "Bank Transfer";

  const previewRow: PreviewRow = {
    id: `${Date.now()}-${index}`,
    rowNumber: index + 2,
    original: row,

    selected: true,
    valid: false,
    errors: [],

    duplicateChecking: false,
    duplicate: false,
    duplicateMatches: [],
    importAnyway: false,

    title,
    description,
    type,
    category: clean(row.category) || "Bank Import",
    amountPence: Number.isFinite(amountPence) ? amountPence : 0,
    amountDisplay: Number.isFinite(amountPence)
      ? formatMoney(amountPence)
      : "Invalid",
    paymentMethod,
    transactionDate,
    invoiceImageUrl: clean(row.invoice_image_url),

    isPersonalFunds: parseBoolean(row.is_personal_funds),
    personalFundsName: clean(row.personal_funds_name),
    personalFundsRepaid: parseBoolean(row.personal_funds_repaid),
    personalFundsRepaidAt: clean(row.personal_funds_repaid_at),

    sponsorId: clean(row.sponsor_id),
    sponsorName: clean(row.sponsor_name),
    sponsorshipNote: clean(row.sponsorship_note),

    source: clean(row.source || "bank_csv"),
    stripeSessionId: clean(row.stripe_session_id),
    stripeInvoiceId: clean(row.stripe_invoice_id),
    stripeCustomerId: clean(row.stripe_customer_id),
    stripePaymentIntentId: clean(row.stripe_payment_intent_id),
  };

  return applyValidation(previewRow);
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.12em] text-white/45">
      {children}
    </span>
  );
}

const SELECT_CLASS =
  "w-full rounded-2xl border border-white/10 bg-[#12091a] px-4 py-3 text-sm font-bold text-white outline-none focus:border-emerald-300/40";

const SELECT_CLASS_BLACK =
  "w-full rounded-2xl border border-white/10 bg-[#12091a] px-4 py-3 text-sm font-black text-white outline-none focus:border-emerald-300/40";

const OPTION_DEFAULT_CLASS = "bg-[#12091a] text-white";
const OPTION_INCOME_CLASS = "bg-[#052e25] text-emerald-100";
const OPTION_EXPENSE_CLASS = "bg-[#3b1018] text-red-100";
const OPTION_CATEGORY_CLASS = "bg-[#12091a] text-white";
const OPTION_METHOD_CLASS = "bg-[#0f172a] text-sky-100";

function prepareRowForImport(row: PreviewRow) {
  const fallbackTitle =
    clean(row.title) ||
    getFirstValue(row.original, [
      "description",
      "details",
      "transaction_description",
      "name",
      "payee",
      "merchant",
      "narrative",
      "reference",
      "ref",
    ]) ||
    `Bank CSV row ${row.rowNumber}`;

  const fallbackType =
    row.type ||
    detectType(row.original) ||
    (row.amountPence > 0 ? "income" : "");

  const fallbackAmount =
    Number.isFinite(row.amountPence) && row.amountPence > 0
      ? row.amountPence
      : parseMoneyToPence(row.original);

  const fallbackDate =
    clean(row.transactionDate) ||
    normaliseDate(
      getFirstValue(row.original, [
        "date",
        "transaction_date",
        "posted_date",
        "booking_date",
        "value_date",
        "paid_at",
        "created_at",
      ])
    );

  const fallbackPaymentMethod = clean(row.paymentMethod) || "Bank Transfer";

  return {
    ...row,
    title: fallbackTitle,
    type: fallbackType as "income" | "expense" | "",
    amountPence:
      Number.isFinite(fallbackAmount) && fallbackAmount > 0
        ? Math.abs(fallbackAmount)
        : 0,
    transactionDate: fallbackDate,
    paymentMethod: fallbackPaymentMethod,
    category: clean(row.category) || "Bank Import",
  };
}

function validatePreparedRow(row: ReturnType<typeof prepareRowForImport>) {
  const errors: string[] = [];

  if (!clean(row.title)) errors.push("Missing title.");
  if (row.type !== "income" && row.type !== "expense") {
    errors.push("Type must be income or expense.");
  }
  if (!Number.isFinite(row.amountPence) || row.amountPence <= 0) {
    errors.push("Amount must be a valid number greater than 0.");
  }
  if (!clean(row.transactionDate)) {
    errors.push("Missing transaction date.");
  } else if (Number.isNaN(Date.parse(row.transactionDate))) {
    errors.push("Transaction date is not valid.");
  }
  if (!clean(row.paymentMethod)) errors.push("Missing payment method.");

  return errors;
}

export default function MoneyCsvImport() {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [query, setQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  const filteredRows = useMemo(() => {
    const search = query.trim().toLowerCase();

    if (!search) return rows;

    return rows.filter((row) =>
      [
        row.title,
        row.description,
        row.type,
        row.category,
        row.paymentMethod,
        row.transactionDate,
        row.sponsorName,
        row.source,
        row.errors.join(" "),
        row.duplicate ? "duplicate warning possible duplicate" : "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(search)
    );
  }, [rows, query]);

  const selectedRows = useMemo(
    () => rows.filter((row) => row.selected),
    [rows]
  );

  const selectedValidRows = useMemo(
    () => rows.filter((row) => row.selected && row.valid),
    [rows]
  );

  const invalidRows = useMemo(() => rows.filter((row) => !row.valid), [rows]);

  const duplicateRows = useMemo(
    () => rows.filter((row) => row.valid && row.duplicate),
    [rows]
  );

  const blockedDuplicateRows = useMemo(
    () =>
      rows.filter(
        (row) => row.valid && row.selected && row.duplicate && !row.importAnyway
      ),
    [rows]
  );

  const totals = useMemo(() => {
    return selectedRows.reduce(
      (acc, row) => {
        if (row.duplicate && !row.importAnyway) return acc;

        const prepared = prepareRowForImport(row);

        if (prepared.type === "income") acc.moneyIn += prepared.amountPence;
        if (prepared.type === "expense") acc.moneyOut += prepared.amountPence;
        return acc;
      },
      {
        moneyIn: 0,
        moneyOut: 0,
      }
    );
  }, [selectedRows]);

  function updateRow(rowId: string, patch: Partial<PreviewRow>) {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== rowId) return row;

        return applyValidation({
          ...row,
          ...patch,
          duplicate: false,
          duplicateMatches: [],
          importAnyway: false,
          duplicateChecking: false,
        });
      })
    );
  }

  function updateAmount(rowId: string, value: string) {
    const amountPence = parseMoneyStringToPence(value);

    updateRow(rowId, {
      amountPence: Number.isFinite(amountPence)
        ? Math.abs(amountPence)
        : Number.NaN,
    });
  }

  function autoFixRow(rowId: string) {
    const row = rows.find((item) => item.id === rowId);
    if (!row) return;

    const moneyIn = getFirstValue(row.original, [
      "money_in",
      "paid_in",
      "credit",
      "credits",
      "deposit",
      "in",
    ]);

    const moneyOut = getFirstValue(row.original, [
      "money_out",
      "paid_out",
      "debit",
      "debits",
      "withdrawal",
      "out",
    ]);

    const amount = getFirstValue(row.original, [
      "amount",
      "transaction_amount",
      "value",
      "paid_in_out",
    ]);

    const guessedAmount =
      row.amountPence > 0 ? row.amountPence : parseMoneyToPence(row.original);

    const guessedType =
      row.type ||
      (moneyIn ? "income" : moneyOut ? "expense" : detectType(row.original));

    updateRow(rowId, {
      type: guessedType || row.type,
      category: row.category || "Bank Import",
      paymentMethod: row.paymentMethod || "Bank Transfer",
      amountPence:
        Number.isFinite(guessedAmount) && guessedAmount > 0
          ? guessedAmount
          : Math.abs(parseMoneyStringToPence(moneyIn || moneyOut || amount)),
      transactionDate:
        row.transactionDate ||
        normaliseDate(
          getFirstValue(row.original, [
            "date",
            "transaction_date",
            "posted_date",
            "booking_date",
          ])
        ),
      title:
        row.title ||
        getFirstValue(row.original, [
          "description",
          "details",
          "name",
          "payee",
          "merchant",
        ]),
    });
  }

  async function checkDuplicateTransaction(row: PreviewRow) {
    const response = await fetch(
      "/api/admin/money/transactions/duplicate-check",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          title: row.title,
          transaction_date: row.transactionDate,
          amount_pence: row.amountPence,
          payment_method: row.paymentMethod,
        }),
      }
    );

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.error || "Failed to check duplicate transaction.");
    }

    return {
      duplicate: Boolean(payload?.duplicate),
      matches: Array.isArray(payload?.matches) ? payload.matches : [],
    };
  }

  async function checkDuplicatesForRows(previewRows: PreviewRow[]) {
    const validRows = previewRows.filter((row) => row.valid);

    if (validRows.length === 0) return;

    setCheckingDuplicates(true);

    setRows((current) =>
      current.map((row) =>
        row.valid
          ? {
              ...row,
              duplicateChecking: true,
            }
          : row
      )
    );

    const checkedRows = await Promise.all(
      previewRows.map(async (row) => {
        if (!row.valid) return row;

        try {
          const duplicateCheck = await checkDuplicateTransaction(row);

          return {
            ...row,
            duplicateChecking: false,
            duplicate: duplicateCheck.duplicate,
            duplicateMatches: duplicateCheck.matches,
            importAnyway: false,
          };
        } catch {
          return {
            ...row,
            duplicateChecking: false,
            duplicate: false,
            duplicateMatches: [],
            importAnyway: false,
          };
        }
      })
    );

    setRows(checkedRows);
    setCheckingDuplicates(false);

    const duplicateCount = checkedRows.filter(
      (row) => row.valid && row.duplicate
    ).length;

    if (duplicateCount > 0) {
      setStatusMessage(
        `Loaded ${checkedRows.length} CSV rows. ${duplicateCount} possible duplicate transaction${
          duplicateCount === 1 ? "" : "s"
        } found. Review the yellow warnings before importing.`
      );
    } else {
      setStatusMessage(
        `Loaded ${checkedRows.length} CSV rows. ${
          checkedRows.filter((row) => row.valid).length
        } rows are ready to import. No duplicates found.`
      );
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setErrorMessage(null);
    setStatusMessage(null);
    setFileName(file.name);

    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      const previewRows = parsed.map(buildPreviewRow);

      setRows(previewRows);

      setStatusMessage(
        `Loaded ${previewRows.length} CSV rows. Failed rows can be edited in the cards below. Checking duplicates...`
      );

      await checkDuplicatesForRows(previewRows);
    } catch (error) {
      console.error(error);
      setCheckingDuplicates(false);
      setErrorMessage("Failed to read the CSV file.");
    }
  }

  function clearCsv() {
    setFileName("");
    setRows([]);
    setQuery("");
    setStatusMessage(null);
    setErrorMessage(null);
    setCheckingDuplicates(false);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function toggleRow(rowId: string) {
    setRows((current) =>
      current.map((row) =>
        row.id === rowId
          ? {
              ...row,
              selected: !row.selected,
            }
          : row
      )
    );
  }

  function toggleImportAnyway(rowId: string) {
    setRows((current) =>
      current.map((row) =>
        row.id === rowId && row.valid && row.duplicate
          ? {
              ...row,
              importAnyway: !row.importAnyway,
            }
          : row
      )
    );
  }

  function allowAllDuplicates() {
    setRows((current) =>
      current.map((row) =>
        row.valid && row.duplicate
          ? {
              ...row,
              importAnyway: true,
            }
          : row
      )
    );
  }

  function blockAllDuplicates() {
    setRows((current) =>
      current.map((row) =>
        row.valid && row.duplicate
          ? {
              ...row,
              importAnyway: false,
            }
          : row
      )
    );
  }

  function selectAllValid() {
    setRows((current) =>
      current.map((row) => ({
        ...row,
        selected: row.valid,
      }))
    );
  }

  function deselectAll() {
    setRows((current) =>
      current.map((row) => ({
        ...row,
        selected: false,
      }))
    );
  }

  async function recheckDuplicates() {
    await checkDuplicatesForRows(rows);
  }

  function downloadFailedRowsCsv() {
    const failedRows = invalidRows;

    const csvRows = [
      ["row_number", "error_message", "row_data"].join(","),
      ...failedRows.map((row) =>
        [
          row.rowNumber,
          `"${row.errors.join(" | ").replace(/"/g, '""')}"`,
          `"${JSON.stringify(row.original).replace(/"/g, '""')}"`,
        ].join(",")
      ),
    ];

    const blob = new Blob([csvRows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `failed-rows-${fileName || "csv-import"}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  async function saveImportHistoryBatch({
    importedRows,
    failedRowDetails,
  }: {
    importedRows: number;
    failedRowDetails: {
      row_number: number;
      error_message: string;
      row_data: any;
    }[];
  }) {
    const response = await fetch("/api/admin/money/import-history/create-batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        fileName: fileName || "bank-statement.csv",
        importType: "money_transactions",

        totalRows: rows.length,
        importedRows,
        failedRows: failedRowDetails.length,

        totalMoneyInPence: totals.moneyIn,
        totalMoneyOutPence: totals.moneyOut,
        netTotalPence: totals.moneyIn - totals.moneyOut,

        failedRowDetails,
        status:
          failedRowDetails.length > 0 ? "completed_with_errors" : "completed",
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error || "Failed to save import history.");
    }

    return payload.batch;
  }

  async function importSelectedRows() {
    if (selectedRows.length === 0) {
      setErrorMessage("Please tick at least one row to import.");
      return;
    }

    setImporting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const selectedRowIds = new Set(selectedRows.map((row) => row.id));

    const failedRowDetails = rows
      .filter((row) => !selectedRowIds.has(row.id) && !row.valid)
      .map((row) => ({
        row_number: row.rowNumber,
        error_message: row.errors.join(" | "),
        row_data: row.original,
      }));

    try {
      let importedCount = 0;

      const importFailures: {
        row_number: number;
        error_message: string;
        row_data: any;
      }[] = [];

      for (const selectedRow of selectedRows) {
        const row = prepareRowForImport(selectedRow);
        const preparedErrors = validatePreparedRow(row);

        try {
          if (preparedErrors.length > 0) {
            importFailures.push({
              row_number: row.rowNumber,
              error_message: preparedErrors.join(" | "),
              row_data: row.original,
            });

            continue;
          }

          if (row.duplicate && !row.importAnyway) {
            importFailures.push({
              row_number: row.rowNumber,
              error_message:
                "Skipped because a possible duplicate transaction already exists. Admin did not choose Import anyway.",
              row_data: row.original,
            });

            continue;
          }

          const response = await fetch("/api/admin/money/transactions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              title: row.title,
              description: row.description || null,
              type: row.type,
              category: row.category || null,
              amount_pence: row.amountPence,
              payment_method: row.paymentMethod || null,
              transaction_date: row.transactionDate || null,
              invoice_image_url: row.invoiceImageUrl || null,

              is_personal_funds: row.isPersonalFunds,
              personal_funds_name: row.personalFundsName || null,
              personal_funds_repaid: row.personalFundsRepaid,
              personal_funds_repaid_at: row.personalFundsRepaidAt || null,

              sponsor_id: row.sponsorId || null,
              sponsor_name: row.sponsorName || null,
              sponsorship_note: row.sponsorshipNote || null,

              source: row.source || "bank_csv",
              stripe_session_id: row.stripeSessionId || null,
              stripe_invoice_id: row.stripeInvoiceId || null,
              stripe_customer_id: row.stripeCustomerId || null,
              stripe_payment_intent_id: row.stripePaymentIntentId || null,
            }),
          });

          const payload = await response.json().catch(() => null);

          if (!response.ok) {
            throw new Error(
              payload?.error ||
                payload?.message ||
                "Transaction could not be created."
            );
          }

          importedCount += 1;
        } catch (error: any) {
          importFailures.push({
            row_number: row.rowNumber,
            error_message:
              error?.message || "Transaction could not be created.",
            row_data: row.original,
          });
        }
      }

      const allFailedRows = [...failedRowDetails, ...importFailures];

      await saveImportHistoryBatch({
        importedRows: importedCount,
        failedRowDetails: allFailedRows,
      });

      setStatusMessage(
        `Import complete. ${importedCount} rows imported and ${allFailedRows.length} failed or skipped rows saved to Import History.`
      );

      setRows((current) =>
        current.map((row) => ({
          ...row,
          selected: false,
        }))
      );
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error?.message || "CSV import failed.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-4 py-2 text-xs font-bold text-emerald-100 ring-1 ring-emerald-300/20">
            <FileSpreadsheet className="h-4 w-4" />
            Bank Statement CSV Import
          </div>

          <h2 className="text-3xl font-black">CSV Import</h2>

          <p className="mt-2 max-w-4xl text-sm leading-6 text-white/60">
            Upload a bank statement CSV, then fix rows using large readable
            cards. Failed rows turn valid as soon as the missing fields are
            corrected.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/admin/money/import-history"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/15"
          >
            <FileClock className="h-4 w-4" />
            Import History
          </Link>

          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/15 px-4 py-3 text-sm font-black text-emerald-100 ring-1 ring-emerald-300/20 hover:bg-emerald-500/25"
          >
            <Upload className="h-4 w-4" />
            Upload CSV
          </button>

          <button
            type="button"
            onClick={clearCsv}
            disabled={rows.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="h-4 w-4" />
            Clear
          </button>
        </div>
      </div>

      {fileName && (
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
          Loaded file: <span className="font-black text-white">{fileName}</span>
        </div>
      )}

      {statusMessage && (
        <div className="mt-5 flex gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <p>{statusMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="mt-5 flex gap-3 rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm text-red-100">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>{errorMessage}</p>
        </div>
      )}

      {checkingDuplicates && (
        <div className="mt-5 flex gap-3 rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4 text-sm text-sky-100">
          <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin" />
          <p>Checking existing transactions for possible duplicates...</p>
        </div>
      )}

      {duplicateRows.length > 0 && (
        <div className="mt-5 rounded-3xl border border-amber-300/20 bg-amber-500/10 p-5 text-amber-50">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-3">
              <ShieldAlert className="mt-1 h-6 w-6 shrink-0 text-amber-200" />
              <div>
                <h3 className="text-lg font-black">
                  Possible duplicate transactions found
                </h3>
                <p className="mt-1 text-sm leading-6 text-amber-50/80">
                  {duplicateRows.length} row
                  {duplicateRows.length === 1 ? "" : "s"} match an existing
                  transaction. Duplicate rows will be skipped unless you choose
                  Import anyway.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={allowAllDuplicates}
                className="rounded-2xl border border-amber-300/30 bg-amber-300/15 px-4 py-3 text-sm font-black text-amber-50 hover:bg-amber-300/25"
              >
                Import all duplicates anyway
              </button>

              <button
                type="button"
                onClick={blockAllDuplicates}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-black text-white hover:bg-white/10"
              >
                Block duplicate rows
              </button>
            </div>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <p className="text-sm font-bold text-white/55">Total rows</p>
              <p className="mt-2 text-3xl font-black">{rows.length}</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <p className="text-sm font-bold text-white/55">Ticked rows</p>
              <p className="mt-2 text-3xl font-black text-emerald-200">
                {selectedRows.length}
              </p>
              <p className="mt-1 text-xs text-white/40">
                {selectedValidRows.length} already valid
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <p className="text-sm font-bold text-white/55">Failed rows</p>
              <p className="mt-2 text-3xl font-black text-red-200">
                {invalidRows.length}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <p className="text-sm font-bold text-white/55">Duplicates</p>
              <p className="mt-2 text-3xl font-black text-amber-200">
                {duplicateRows.length}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <p className="text-sm font-bold text-white/55">Money in</p>
              <p className="mt-2 text-3xl font-black text-emerald-200">
                {formatMoney(totals.moneyIn)}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <p className="text-sm font-bold text-white/55">Money out</p>
              <p className="mt-2 text-3xl font-black text-red-200">
                {formatMoney(totals.moneyOut)}
              </p>
            </div>
          </section>

          <div className="mt-6 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full xl:max-w-md">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search rows..."
                className="w-full rounded-2xl border border-white/10 bg-black/25 py-3 pl-11 pr-4 text-sm font-bold text-white outline-none placeholder:text-white/35 focus:border-emerald-300/40"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={selectAllValid}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/15"
              >
                Select valid rows
              </button>

              <button
                type="button"
                onClick={deselectAll}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/15"
              >
                Deselect all
              </button>

              <button
                type="button"
                onClick={recheckDuplicates}
                disabled={checkingDuplicates}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-300/20 bg-sky-500/10 px-4 py-3 text-sm font-black text-sky-100 hover:bg-sky-500/20 disabled:opacity-50"
              >
                <RefreshCcw className="h-4 w-4" />
                Recheck duplicates
              </button>

              {invalidRows.length > 0 && (
                <button
                  type="button"
                  onClick={downloadFailedRowsCsv}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-300/20 bg-amber-500/10 px-4 py-3 text-sm font-black text-amber-100 hover:bg-amber-500/20"
                >
                  <Download className="h-4 w-4" />
                  Download failed rows
                </button>
              )}

              <button
                type="button"
                onClick={importSelectedRows}
                disabled={importing || selectedRows.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {importing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Import selected rows
              </button>
            </div>
          </div>

          {blockedDuplicateRows.length > 0 && (
            <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm text-amber-100">
              {blockedDuplicateRows.length} selected duplicate row
              {blockedDuplicateRows.length === 1 ? "" : "s"} will be skipped
              unless you click <span className="font-black">Import anyway</span>.
            </div>
          )}

          <div className="mt-6 space-y-4">
            {filteredRows.map((row) => (
              <article
                key={row.id}
                className={[
                  "rounded-3xl border p-5 shadow-xl",
                  row.valid
                    ? "border-emerald-300/15 bg-emerald-500/[0.045]"
                    : "border-red-300/20 bg-red-500/[0.055]",
                  row.duplicate ? "border-amber-300/25 bg-amber-500/[0.055]" : "",
                ].join(" ")}
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-3 rounded-2xl bg-black/25 px-4 py-3 text-sm font-black text-white">
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={() => toggleRow(row.id)}
                        className="h-5 w-5 rounded border-white/20 bg-black/30"
                      />
                      Use row {row.rowNumber}
                    </label>

                    {row.valid ? (
                      <span className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-100">
                        Valid
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs font-black text-red-100">
                        Failed
                      </span>
                    )}

                    {row.duplicateChecking && (
                      <span className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-500/10 px-3 py-2 text-xs font-black text-sky-100">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Checking duplicate
                      </span>
                    )}

                    {row.duplicate && (
                      <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs font-black text-amber-100">
                        <AlertTriangle className="h-3 w-3" />
                        Possible duplicate
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => autoFixRow(row.id)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-100 hover:bg-emerald-500/20"
                  >
                    <Edit3 className="h-4 w-4" />
                    Auto fix row
                  </button>
                </div>

                {row.errors.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-red-300/20 bg-black/25 p-4">
                    <div className="mb-2 font-black text-red-100">
                      Fix these issues:
                    </div>
                    <ul className="space-y-1 text-sm text-red-100">
                      {row.errors.map((error) => (
                        <li key={error}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {row.duplicate && (
                  <div className="mt-4 rounded-2xl border border-amber-300/20 bg-black/25 p-4 text-sm text-amber-50/85">
                    <div className="font-black text-amber-100">
                      Duplicate warning
                    </div>
                    <p className="mt-1">
                      Similar transaction already exists. Keep blocked or use
                      Import anyway.
                    </p>

                    <button
                      type="button"
                      onClick={() => toggleImportAnyway(row.id)}
                      className={
                        row.importAnyway
                          ? "mt-3 rounded-xl border border-emerald-300/30 bg-emerald-500/15 px-3 py-2 text-xs font-black text-emerald-100 hover:bg-emerald-500/25"
                          : "mt-3 rounded-xl border border-amber-300/30 bg-amber-500/15 px-3 py-2 text-xs font-black text-amber-100 hover:bg-amber-500/25"
                      }
                    >
                      {row.importAnyway
                        ? "Import anyway enabled"
                        : "Import anyway"}
                    </button>
                  </div>
                )}

                <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr_0.8fr_0.7fr_0.8fr_0.8fr]">
                  <div className="xl:col-span-2">
                    <FieldLabel>Transaction title</FieldLabel>
                    <input
                      value={row.title}
                      onChange={(event) =>
                        updateRow(row.id, { title: event.target.value })
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-white/35 focus:border-emerald-300/40"
                      placeholder="Transaction title"
                    />

                    <FieldLabel>Description / notes</FieldLabel>
                    <textarea
                      value={row.description}
                      onChange={(event) =>
                        updateRow(row.id, {
                          description: event.target.value,
                        })
                      }
                      className="min-h-24 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/80 outline-none placeholder:text-white/35 focus:border-emerald-300/40"
                      placeholder="Description / notes"
                    />
                  </div>

                  <div>
                    <FieldLabel>Type</FieldLabel>
                    <select
                      value={row.type}
                      onChange={(event) =>
                        updateRow(row.id, {
                          type: event.target.value as
                            | "income"
                            | "expense"
                            | "",
                        })
                      }
                      className={SELECT_CLASS_BLACK}
                    >
                      <option className={OPTION_DEFAULT_CLASS} value="">
                        Choose
                      </option>
                      <option className={OPTION_INCOME_CLASS} value="income">
                        Income
                      </option>
                      <option className={OPTION_EXPENSE_CLASS} value="expense">
                        Expense
                      </option>
                    </select>
                  </div>

                  <div>
                    <FieldLabel>Category</FieldLabel>
                    <select
                      value={row.category || "Bank Import"}
                      onChange={(event) =>
                        updateRow(row.id, { category: event.target.value })
                      }
                      className={SELECT_CLASS}
                    >
                      {DEFAULT_CATEGORIES.map((category) => (
                        <option
                            key={category}
                            value={category}
                            className={OPTION_CATEGORY_CLASS}
                          >
                            {category}
                          </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <FieldLabel>Amount</FieldLabel>
                    <input
                      value={
                        Number.isFinite(row.amountPence) && row.amountPence > 0
                          ? (row.amountPence / 100).toFixed(2)
                          : ""
                      }
                      onChange={(event) =>
                        updateAmount(row.id, event.target.value)
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-black text-white outline-none placeholder:text-white/35 focus:border-emerald-300/40"
                      placeholder="0.00"
                    />
                    <p className="mt-1 text-xs text-white/45">
                      {row.amountDisplay}
                    </p>
                  </div>

                  <div>
                    <FieldLabel>Payment method</FieldLabel>
                    <select
                      value={row.paymentMethod}
                      onChange={(event) =>
                        updateRow(row.id, {
                          paymentMethod: event.target.value,
                        })
                      }
                      className={SELECT_CLASS}
                    >
                      <option className={OPTION_DEFAULT_CLASS} value="">
                        Choose
                      </option>
                      {PAYMENT_METHODS.map((method) => (
                        <option
                          key={method}
                          value={method}
                          className={OPTION_METHOD_CLASS}
                        >
                          {method}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <FieldLabel>Date</FieldLabel>
                    <input
                      type="date"
                      value={row.transactionDate}
                      onChange={(event) =>
                        updateRow(row.id, {
                          transactionDate: event.target.value,
                        })
                      }
                      className={SELECT_CLASS}
                    />
                  </div>

                  <div>
                    <FieldLabel>Sponsor</FieldLabel>
                    <input
                      value={row.sponsorName}
                      onChange={(event) =>
                        updateRow(row.id, {
                          sponsorName: event.target.value,
                        })
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-emerald-300/40"
                      placeholder="Optional"
                    />
                  </div>

                  <div>
                    <FieldLabel>Personal funds</FieldLabel>
                    <label className="flex min-h-[48px] items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-white/80">
                      <input
                        type="checkbox"
                        checked={row.isPersonalFunds}
                        onChange={(event) =>
                          updateRow(row.id, {
                            isPersonalFunds: event.target.checked,
                          })
                        }
                      />
                      Personal funds
                    </label>

                    {row.isPersonalFunds && (
                      <input
                        value={row.personalFundsName}
                        onChange={(event) =>
                          updateRow(row.id, {
                            personalFundsName: event.target.value,
                          })
                        }
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-emerald-300/40"
                        placeholder="Name"
                      />
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {rows.length === 0 && (
        <div className="mt-6 flex min-h-[260px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/20 p-8 text-center">
          <FileSpreadsheet className="h-12 w-12 text-white/25" />

          <h3 className="mt-4 text-xl font-black">Upload a CSV file</h3>

          <p className="mt-2 max-w-xl text-sm leading-6 text-white/55">
            Choose a CSV file to preview rows before importing them into your
            money tracker.
          </p>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/15 px-5 py-3 text-sm font-black text-emerald-100 ring-1 ring-emerald-300/20 hover:bg-emerald-500/25"
          >
            <Upload className="h-4 w-4" />
            Upload CSV
          </button>
        </div>
      )}
    </section>
  );
}
