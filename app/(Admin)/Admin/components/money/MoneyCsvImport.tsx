"use client";

import {
  type ChangeEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  Settings2,
  ShieldAlert,
  Sparkles,
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
  duplicateCheckError: string;
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

const EASY_MODE_STORAGE_KEY = "burton-pride-money-csv-import-easy-mode";
const MAX_CSV_FILE_BYTES = 10 * 1024 * 1024;
const MAX_CSV_ROWS = 5_000;
const DUPLICATE_CHECK_CONCURRENCY = 5;


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

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function normaliseDate(value: string) {
  const raw = clean(value);

  if (!raw) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return isValidIsoDate(raw) ? raw : "";
  }

  const ukMatch = raw.match(
    /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/,
  );

  if (ukMatch) {
    const day = ukMatch[1].padStart(2, "0");
    const month = ukMatch[2].padStart(2, "0");
    const shortYear = ukMatch[3];
    const year =
      shortYear.length === 2
        ? String(Number(shortYear) >= 70 ? 1900 + Number(shortYear) : 2000 + Number(shortYear))
        : shortYear;

    const isoDate = `${year}-${month}-${day}`;

    return isValidIsoDate(isoDate) ? isoDate : "";
  }

  /*
   * Avoid Date.parse for ambiguous values such as 03/04/2026. Bank statement
   * imports must use an explicit ISO or UK day/month/year format.
   */
  return "";
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

function detectCsvDelimiter(text: string) {
  const firstLogicalLine = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/, 1)[0];

  const candidates = [",", ";", "\t"];

  return candidates.reduce(
    (best, candidate) => {
      const count = firstLogicalLine.split(candidate).length - 1;

      return count > best.count
        ? { delimiter: candidate, count }
        : best;
    },
    { delimiter: ",", count: -1 },
  ).delimiter;
}

function parseCsv(text: string): CsvRow[] {
  const source = text.replace(/^\uFEFF/, "");

  if (!source.trim()) {
    throw new Error("The CSV file is empty.");
  }

  const delimiter = detectCsvDelimiter(source);
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = "";
  let insideQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      currentValue += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === delimiter && !insideQuotes) {
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

  if (insideQuotes) {
    throw new Error(
      "The CSV contains an unclosed quoted field. Check the final row and quotation marks.",
    );
  }

  currentRow.push(currentValue);

  if (currentRow.some((cell) => clean(cell) !== "")) {
    rows.push(currentRow);
  }

  if (rows.length < 2) {
    throw new Error(
      "The CSV must contain a header row and at least one transaction row.",
    );
  }

  if (rows.length - 1 > MAX_CSV_ROWS) {
    throw new Error(
      `This CSV contains ${(
        rows.length - 1
      ).toLocaleString("en-GB")} rows. The maximum is ${MAX_CSV_ROWS.toLocaleString(
        "en-GB",
      )} rows per import.`,
    );
  }

  const headers = rows[0].map(normaliseHeader);

  if (headers.every((header) => !header)) {
    throw new Error("The CSV header row is empty.");
  }

  const duplicateHeaders = headers.filter(
    (header, index) =>
      Boolean(header) && headers.indexOf(header) !== index,
  );

  if (duplicateHeaders.length > 0) {
    throw new Error(
      `The CSV contains duplicate column headings: ${Array.from(
        new Set(duplicateHeaders),
      ).join(", ")}.`,
    );
  }

  return rows.slice(1).map((row) => {
    const item: CsvRow = {};

    headers.forEach((header, index) => {
      if (!header) return;
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

  if (row.isPersonalFunds && !clean(row.personalFundsName)) {
    errors.push("Personal funds name is required.");
  }

  if (
    row.personalFundsRepaidAt &&
    !normaliseDate(row.personalFundsRepaidAt)
  ) {
    errors.push("Personal funds repaid date is not valid.");
  }

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
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${index}-${Math.random()}`,
    rowNumber: index + 2,
    original: row,

    selected: true,
    valid: false,
    errors: [],

    duplicateChecking: false,
    duplicateCheckError: "",
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

function FieldLabel({ children }: { children: ReactNode }) {
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

  if (row.isPersonalFunds && !clean(row.personalFundsName)) {
    errors.push("Personal funds name is required.");
  }

  if (
    row.personalFundsRepaidAt &&
    !normaliseDate(row.personalFundsRepaidAt)
  ) {
    errors.push("Personal funds repaid date is not valid.");
  }

  return errors;
}

function duplicateFingerprint(row: PreviewRow) {
  const prepared = prepareRowForImport(row);

  return [
    clean(prepared.title).toLowerCase(),
    prepared.transactionDate,
    prepared.amountPence,
    clean(prepared.paymentMethod).toLowerCase(),
    prepared.type,
  ].join("|");
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;

      if (index >= items.length) return;

      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, concurrency), items.length) },
      () => runWorker(),
    ),
  );

  return results;
}

async function readApiJson(response: Response) {
  const raw = await response.text();

  if (!raw) return {} as Record<string, unknown>;

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {
      error: "The server returned invalid JSON.",
      details: raw.slice(0, 1_000),
    };
  }
}

export default function MoneyCsvImport() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileReadRunIdRef = useRef(0);
  const duplicateRunIdRef = useRef(0);
  const mountedRef = useRef(true);

  /**
   * Full Mode stays as the default.
   * Easy Mode is enabled only after the user turns it on.
   */
  const [easyMode, setEasyMode] = useState(false);
  const [modeLoaded, setModeLoaded] = useState(false);

  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [query, setQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  useEffect(() => {
    try {
      const savedMode = window.localStorage.getItem(EASY_MODE_STORAGE_KEY);

      if (savedMode !== null) {
        setEasyMode(savedMode === "true");
      }
    } catch {
      // Keep Full Mode as the safe default if localStorage is unavailable.
    } finally {
      setModeLoaded(true);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      fileReadRunIdRef.current += 1;
      duplicateRunIdRef.current += 1;
    };
  }, []);

  function toggleEasyMode() {
    setEasyMode((previous) => {
      const next = !previous;

      try {
        window.localStorage.setItem(EASY_MODE_STORAGE_KEY, String(next));
      } catch {
        // The CSV importer should still work if localStorage is unavailable.
      }

      return next;
    });
  }

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

  const importReadyRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.selected &&
          row.valid &&
          !row.duplicateCheckError &&
          (!row.duplicate || row.importAnyway),
      ),
    [rows],
  );

  const totals = useMemo(() => {
    return importReadyRows.reduce(
      (acc, row) => {
        const prepared = prepareRowForImport(row);

        if (prepared.type === "income") {
          acc.moneyIn += prepared.amountPence;
        }

        if (prepared.type === "expense") {
          acc.moneyOut += prepared.amountPence;
        }

        return acc;
      },
      {
        moneyIn: 0,
        moneyOut: 0,
      },
    );
  }, [importReadyRows]);

  function updateRow(rowId: string, patch: Partial<PreviewRow>) {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== rowId) return row;

        return applyValidation({
          ...row,
          ...patch,
          duplicate: false,
          duplicateMatches: [],
          duplicateCheckError: "",
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
    const prepared = prepareRowForImport(row);

    const response = await fetch(
      "/api/admin/money/transactions/duplicate-check",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          title: prepared.title,
          transaction_date: prepared.transactionDate,
          amount_pence: prepared.amountPence,
          payment_method: prepared.paymentMethod,
          type: prepared.type,
        }),
      },
    );

    const payload = await readApiJson(response);

    if (!response.ok) {
      throw new Error(
        [
          clean(payload.error) ||
            "Failed to check duplicate transaction.",
          payload.code ? `Code: ${clean(payload.code)}` : "",
          payload.details
            ? `Details: ${clean(payload.details)}`
            : "",
          `HTTP: ${response.status}`,
        ]
          .filter(Boolean)
          .join("\n"),
      );
    }

    return {
      duplicate: Boolean(payload.duplicate),
      matches: Array.isArray(payload.matches)
        ? (payload.matches as DuplicateMatch[])
        : [],
    };
  }

  async function checkDuplicatesForRows(
    previewRows: PreviewRow[],
  ) {
    const validRows = previewRows.filter((row) => row.valid);

    if (validRows.length === 0) {
      setCheckingDuplicates(false);
      return;
    }

    const runId = ++duplicateRunIdRef.current;

    setCheckingDuplicates(true);

    setRows((current) =>
      current.map((row) =>
        row.valid
          ? {
              ...row,
              duplicateChecking: true,
              duplicateCheckError: "",
            }
          : row,
      ),
    );

    try {
      const results = await mapWithConcurrency(
        validRows,
        DUPLICATE_CHECK_CONCURRENCY,
        async (row) => {
          const fingerprint = duplicateFingerprint(row);

          try {
            const duplicateCheck =
              await checkDuplicateTransaction(row);

            return {
              id: row.id,
              fingerprint,
              duplicate: duplicateCheck.duplicate,
              matches: duplicateCheck.matches,
              error: "",
            };
          } catch (error) {
            return {
              id: row.id,
              fingerprint,
              duplicate: false,
              matches: [] as DuplicateMatch[],
              error:
                error instanceof Error
                  ? error.message
                  : "Duplicate check failed.",
            };
          }
        },
      );

      if (
        runId !== duplicateRunIdRef.current ||
        !mountedRef.current
      ) {
        return;
      }

      const resultMap = new Map(
        results.map((result) => [result.id, result]),
      );

      setRows((current) =>
        current.map((row) => {
          const result = resultMap.get(row.id);

          if (!result) return row;

          if (duplicateFingerprint(row) !== result.fingerprint) {
            return {
              ...row,
              duplicateChecking: false,
              duplicate: false,
              duplicateMatches: [],
              duplicateCheckError:
                "This row changed during duplicate checking. Recheck duplicates before importing it.",
              importAnyway: false,
            };
          }

          return {
            ...row,
            duplicateChecking: false,
            duplicate: result.duplicate,
            duplicateMatches: result.matches,
            duplicateCheckError: result.error,
            importAnyway: false,
          };
        }),
      );

      const duplicateCount = results.filter(
        (result) => result.duplicate,
      ).length;

      const errorCount = results.filter(
        (result) => result.error,
      ).length;

      if (errorCount > 0) {
        setErrorMessage(
          `${errorCount} duplicate check${
            errorCount === 1 ? "" : "s"
          } failed. Those rows are blocked until duplicate checking succeeds.`,
        );
      }

      if (duplicateCount > 0) {
        setStatusMessage(
          `Loaded ${previewRows.length} CSV rows. ${duplicateCount} possible duplicate transaction${
            duplicateCount === 1 ? "" : "s"
          } found. Review the yellow warnings before importing.`,
        );
      } else {
        setStatusMessage(
          `Loaded ${previewRows.length} CSV rows. ${
            previewRows.filter((row) => row.valid).length
          } rows are valid. ${
            errorCount > 0
              ? `${errorCount} duplicate checks still need attention.`
              : "No duplicates found."
          }`,
        );
      }
    } finally {
      if (
        runId === duplicateRunIdRef.current &&
        mountedRef.current
      ) {
        setCheckingDuplicates(false);
      }
    }
  }

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    const runId = ++fileReadRunIdRef.current;
    duplicateRunIdRef.current += 1;

    setErrorMessage(null);
    setStatusMessage(null);
    setCheckingDuplicates(false);

    if (file.size > MAX_CSV_FILE_BYTES) {
      setFileName("");
      setRows([]);
      setErrorMessage(
        `The CSV file is too large. The maximum size is ${(
          MAX_CSV_FILE_BYTES /
          1024 /
          1024
        ).toFixed(0)} MB.`,
      );
      event.target.value = "";
      return;
    }

    const lowerName = file.name.toLowerCase();

    if (
      !lowerName.endsWith(".csv") &&
      file.type !== "text/csv" &&
      file.type !== "application/vnd.ms-excel"
    ) {
      setFileName("");
      setRows([]);
      setErrorMessage("Choose a CSV file.");
      event.target.value = "";
      return;
    }

    setFileName(file.name);

    try {
      const csvText = await file.text();

      if (
        runId !== fileReadRunIdRef.current ||
        !mountedRef.current
      ) {
        return;
      }

      const parsed = parseCsv(csvText);
      const previewRows = parsed.map(buildPreviewRow);

      setRows(previewRows);

      setStatusMessage(
        `Loaded ${previewRows.length} CSV rows. Invalid rows can be edited below. Checking duplicates...`,
      );

      await checkDuplicatesForRows(previewRows);
    } catch (error) {
      if (
        runId !== fileReadRunIdRef.current ||
        !mountedRef.current
      ) {
        return;
      }

      console.error("CSV file read failed", error);
      setCheckingDuplicates(false);
      setRows([]);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to read the CSV file.",
      );
    } finally {
      /*
       * Resetting the native input lets the same file be chosen again after
       * the admin fixes it on disk.
       */
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  function clearCsv() {
    fileReadRunIdRef.current += 1;
    duplicateRunIdRef.current += 1;

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
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }

  async function saveImportHistoryBatch({
    totalRows,
    importedRows,
    failedRowDetails,
    totalMoneyInPence,
    totalMoneyOutPence,
  }: {
    totalRows: number;
    importedRows: number;
    failedRowDetails: {
      row_number: number;
      error_message: string;
      row_data: CsvRow;
    }[];
    totalMoneyInPence: number;
    totalMoneyOutPence: number;
  }) {
    const response = await fetch(
      "/api/admin/money/import-history/create-batch",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          fileName: fileName || "bank-statement.csv",
          importType: "money_transactions",
          totalRows,
          importedRows,
          failedRows: failedRowDetails.length,
          totalMoneyInPence,
          totalMoneyOutPence,
          netTotalPence:
            totalMoneyInPence - totalMoneyOutPence,
          failedRowDetails,
          status:
            failedRowDetails.length > 0
              ? "completed_with_errors"
              : "completed",
        }),
      },
    );

    const payload = await readApiJson(response);

    if (!response.ok) {
      throw new Error(
        [
          clean(payload.error) ||
            "Failed to save import history.",
          payload.code ? `Code: ${clean(payload.code)}` : "",
          payload.details
            ? `Details: ${clean(payload.details)}`
            : "",
          `HTTP: ${response.status}`,
        ]
          .filter(Boolean)
          .join("\n"),
      );
    }

    return payload.batch;
  }

  async function importSelectedRows() {
    if (importing || checkingDuplicates) return;

    if (selectedRows.length === 0) {
      setErrorMessage("Please tick at least one row to import.");
      return;
    }

    const duplicateCheckFailures = selectedRows.filter(
      (row) => row.duplicateCheckError,
    );

    if (duplicateCheckFailures.length > 0) {
      setErrorMessage(
        `${duplicateCheckFailures.length} selected row${
          duplicateCheckFailures.length === 1 ? "" : "s"
        } could not be checked for duplicates. Recheck duplicates before importing.`,
      );
      return;
    }

    setImporting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const importFailures: {
      row_number: number;
      error_message: string;
      row_data: CsvRow;
    }[] = [];

    const importedRowIds = new Set<string>();
    let importedCount = 0;
    let importedMoneyInPence = 0;
    let importedMoneyOutPence = 0;

    try {
      for (const selectedRow of selectedRows) {
        const row = prepareRowForImport(selectedRow);
        const preparedErrors = validatePreparedRow(row);

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

        try {
          const response = await fetch(
            "/api/admin/money/transactions",
            {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
              },
              credentials: "include",
              cache: "no-store",
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
                personal_funds_name:
                  row.personalFundsName || null,
                personal_funds_repaid:
                  row.personalFundsRepaid,
                personal_funds_repaid_at:
                  row.personalFundsRepaidAt
                    ? normaliseDate(
                        row.personalFundsRepaidAt,
                      )
                    : null,

                sponsor_id: row.sponsorId || null,
                sponsor_name: row.sponsorName || null,
                sponsorship_note:
                  row.sponsorshipNote || null,

                source: row.source || "bank_csv",
                stripe_session_id:
                  row.stripeSessionId || null,
                stripe_invoice_id:
                  row.stripeInvoiceId || null,
                stripe_customer_id:
                  row.stripeCustomerId || null,
                stripe_payment_intent_id:
                  row.stripePaymentIntentId || null,
              }),
            },
          );

          const payload = await readApiJson(response);

          if (!response.ok) {
            throw new Error(
              [
                clean(payload.error) ||
                  clean(payload.message) ||
                  "Transaction could not be created.",
                payload.code
                  ? `Code: ${clean(payload.code)}`
                  : "",
                payload.details
                  ? `Details: ${clean(payload.details)}`
                  : "",
                `HTTP: ${response.status}`,
              ]
                .filter(Boolean)
                .join("\n"),
            );
          }

          importedCount += 1;
          importedRowIds.add(selectedRow.id);

          if (row.type === "income") {
            importedMoneyInPence += row.amountPence;
          } else {
            importedMoneyOutPence += row.amountPence;
          }
        } catch (error) {
          importFailures.push({
            row_number: row.rowNumber,
            error_message:
              error instanceof Error
                ? error.message
                : "Transaction could not be created.",
            row_data: row.original,
          });
        }
      }

      /*
       * Remove imported rows before saving history. If history logging fails,
       * the successfully created transactions cannot accidentally be imported
       * again from the same preview.
       */
      setRows((current) =>
        current
          .filter((row) => !importedRowIds.has(row.id))
          .map((row) => ({
            ...row,
            selected: false,
          })),
      );

      let historyError = "";

      try {
        await saveImportHistoryBatch({
          totalRows: selectedRows.length,
          importedRows: importedCount,
          failedRowDetails: importFailures,
          totalMoneyInPence: importedMoneyInPence,
          totalMoneyOutPence: importedMoneyOutPence,
        });
      } catch (error) {
        historyError =
          error instanceof Error
            ? error.message
            : "Import history could not be saved.";
      }

      setStatusMessage(
        `Import complete. ${importedCount} row${
          importedCount === 1 ? "" : "s"
        } imported and ${importFailures.length} failed or skipped row${
          importFailures.length === 1 ? "" : "s"
        }.${
          historyError
            ? " The transactions were saved, but Import History needs attention."
            : " The batch was saved to Import History."
        }`,
      );

      if (historyError) {
        setErrorMessage(historyError);
      }
    } catch (error) {
      console.error("CSV import failed", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "CSV import failed.",
      );
    } finally {
      if (mountedRef.current) {
        setImporting(false);
      }
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
          {!easyMode && (
            <Link
              href="/Admin/MoneyManagement/TrackingMoney/ImportHistory"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/15"
            >
              <FileClock className="h-4 w-4" />
              Import History
            </Link>
          )}

          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            aria-label="Choose bank statement CSV file"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => {
              if (inputRef.current) {
                inputRef.current.value = "";
                inputRef.current.click();
              }
            }}
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

      <section className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {easyMode ? (
                <Sparkles className="h-5 w-5 text-emerald-200" />
              ) : (
                <Settings2 className="h-5 w-5 text-sky-200" />
              )}

              <h3 className="text-lg font-black text-white">
                {easyMode ? "Easy Mode is on" : "Full Mode is on"}
              </h3>
            </div>

            <p className="mt-2 max-w-4xl text-sm leading-6 text-white/60">
              {easyMode
                ? "Easy Mode shows the main CSV import fields only: title, type, amount and date. Duplicate warnings and import checks still stay visible."
                : "Full Mode shows every CSV row field, including notes, categories, payment methods, sponsor details and personal-funds options."}
            </p>
          </div>

          <button
            type="button"
            onClick={toggleEasyMode}
            disabled={!modeLoaded}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black ring-1 transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${
              easyMode
                ? "bg-sky-500/15 text-sky-100 ring-sky-300/20 hover:bg-sky-500/25"
                : "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20 hover:bg-emerald-500/25"
            }`}
          >
            {easyMode ? (
              <>
                <Settings2 className="h-4 w-4" />
                Show Full Mode
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Turn on Easy Mode
              </>
            )}
          </button>
        </div>
      </section>

      {fileName && (
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
          Loaded file: <span className="font-black text-white">{fileName}</span>
        </div>
      )}

      {statusMessage && (
        <div
          role="status"
          aria-live="polite"
          className="mt-5 flex gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <p>{statusMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="mt-5 flex gap-3 rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm text-red-100">
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

              {!easyMode && (
                <button
                  type="button"
                  onClick={recheckDuplicates}
                  disabled={checkingDuplicates}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-300/20 bg-sky-500/10 px-4 py-3 text-sm font-black text-sky-100 hover:bg-sky-500/20 disabled:opacity-50"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Recheck duplicates
                </button>
              )}

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
                disabled={importing || checkingDuplicates || selectedRows.length === 0}
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

          {easyMode && (
            <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-100">
              Easy Mode hides optional row fields. Switch back to Full Mode to
              edit descriptions, categories, payment methods, sponsor details,
              or personal-funds information.
            </div>
          )}

          <div className="mt-6 space-y-4">
            {filteredRows.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-8 text-center text-sm text-white/55">
                No CSV rows match the current search.
              </div>
            ) : null}

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

                    {row.duplicateCheckError && (
                      <span
                        className="inline-flex items-center gap-2 rounded-full border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs font-black text-red-100"
                        title={row.duplicateCheckError}
                      >
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                        Duplicate check failed
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

                    {row.duplicateMatches.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {row.duplicateMatches.slice(0, 3).map((match) => (
                          <div
                            key={match.id}
                            className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs"
                          >
                            <p className="font-black text-white">
                              {match.title}
                            </p>
                            <p className="mt-1 text-white/60">
                              {formatDate(match.transaction_date)} ·{" "}
                              {formatMoney(match.amount_pence)} ·{" "}
                              {match.payment_method || "No payment method"}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

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

                <div
                  className={`mt-5 grid gap-4 ${
                    easyMode
                      ? "md:grid-cols-2 xl:grid-cols-4"
                      : "xl:grid-cols-[1.2fr_0.8fr_0.8fr_0.7fr_0.8fr_0.8fr]"
                  }`}
                >
                  <div className={easyMode ? "" : "xl:col-span-2"}>
                    <FieldLabel>Transaction title</FieldLabel>
                    <input
                      value={row.title}
                      onChange={(event) =>
                        updateRow(row.id, { title: event.target.value })
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-white/35 focus:border-emerald-300/40"
                      placeholder="Transaction title"
                    />

                    {!easyMode && (
                      <>
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
                      </>
                    )}
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

                  {!easyMode && (
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
                  )}

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

                  {!easyMode && (
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
                  )}

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

                  {!easyMode && (
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
                  )}

                  {!easyMode && (
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
                  )}

                  {easyMode && (
                    <div className="md:col-span-2 xl:col-span-4">
                      <p className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs leading-5 text-white/55">
                        Category: {row.category || "Bank Import"} · Payment:{" "}
                        {row.paymentMethod || "Bank Transfer"}
                        {row.sponsorName ? ` · Sponsor: ${row.sponsorName}` : ""}
                        {row.isPersonalFunds
                          ? ` · Personal funds${row.personalFundsName ? `: ${row.personalFundsName}` : ""}`
                          : ""}
                      </p>
                    </div>
                  )}
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
            onClick={() => {
              if (inputRef.current) {
                inputRef.current.value = "";
                inputRef.current.click();
              }
            }}
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
