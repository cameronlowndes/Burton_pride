"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import Link from "next/link";
import { useAdmin } from "../providers/AdminProvider";
import {
  AlertTriangle,
  ArrowDown,
  CalendarClock,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Columns3,
  Download,
  Eye,
  FileText,
  Loader2,
  Pencil,
  Printer,
  RefreshCcw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";

import type {
  BankReconciliationStatus,
  FinanceNoteStatus,
  FundingType,
  Sponsor,
  Transaction,
  TransactionAttachment,
} from "@/lib/money/types";

import {
  formatDate,
  isPersonalFundsTransaction,
  isSponsorshipTransaction,
  monthNameFromKey,
  money,
  none,
} from "@/lib/money/helpers";

type MonthOption = {
  key: string;
  label: string;
  count: number;
};

type PaymentMethodFilter =
  | "all"
  | "Stripe"
  | "Cash"
  | "Bank Transfer"
  | "PayPal"
  | "Card Machine"
  | "Personal Funds"
  | "Item Donation"
  | "Other Types"
  | string;

type MoneyTransactionsTableProps = {
  loading: boolean;

  transactions: Transaction[];
  filteredTransactions: Transaction[];
  printTransactionsList: Transaction[];
  yearTransactions: Transaction[];

  selectedYear: string;
  selectedViewMonth: string;
  setSelectedViewMonth: Dispatch<SetStateAction<string>>;

  selectedPrintMonth: string;
  setSelectedPrintMonth: Dispatch<SetStateAction<string>>;

  printMonthOptions: MonthOption[];

  searchTerm: string;
  setSearchTerm: Dispatch<SetStateAction<string>>;

  filter: "all" | "income" | "expense" | "sponsorship" | "personal";
  setFilter: Dispatch<
    SetStateAction<"all" | "income" | "expense" | "sponsorship" | "personal">
  >;

  selectedSponsorId: string;
  setSelectedSponsorId: Dispatch<SetStateAction<string>>;

  selectedSponsor: Sponsor | null;
  displaySponsors: Sponsor[];

  selectedPaymentMethod: PaymentMethodFilter;
  setSelectedPaymentMethod: Dispatch<SetStateAction<string>>;

  deletingYear: boolean;
  deletingAll: boolean;
  deleting: boolean;
  repayingId: string | null;
  checkingId: string | null;
  bankReconcilingId: string | null;
  financeNoteUpdatingId: string | null;

  onPrint: () => void;
  onExportExcel: () => void | Promise<void>;
  onExportYearlyReport: () => void | Promise<void>;
  onOpenDeleteYear: () => void;
  onOpenDeleteAll: () => void;
  onEditTransaction: (item: Transaction) => void;
  onHideTransaction: (id: string) => void;
  onTogglePersonalFundsRepaid: (
    item: Transaction,
    proofFiles?: File[],
  ) => void | Promise<void>;
  onMarkTransactionChecked: (item: Transaction) => void | Promise<void>;
  onUpdateBankReconciliationStatus: (
    item: Transaction,
    status: BankReconciliationStatus,
    note?: string,
  ) => void | Promise<void>;
  onUpdateFinanceNote: (
    item: Transaction,
    status: FinanceNoteStatus,
    note?: string,
  ) => void | Promise<void>;

  /**
   * Opening balance carried forward into the selected year.
   *
   * This is used when the full-year table view is open so the table's
   * available balance matches the main money tracker and the manual bank
   * balance check.
   */
  openingBalancePence?: number;

  /**
   * Receipt expiry/check reminder.
   * Expenses with no receipt older than this number of days will be flagged.
   * Default is 7 days.
   */
  receiptReminderDays?: number;

  /**
   * Read-only protection for locked accounting periods.
   * Pass only values that are currently locked.
   */
  lockedYears?: string[];
  lockedMonths?: string[];
};

type SortKey =
  | "date"
  | "title"
  | "type"
  | "amount"
  | "budget"
  | "funding"
  | "payment"
  | "checked"
  | "bank"
  | "receipt"
  | "finance";

type SortDirection = "asc" | "desc";

type QuickFilter =
  | "all"
  | "unchecked"
  | "checked"
  | "missing_receipts"
  | "receipt_overdue"
  | "finance_queries"
  | "bank_unmatched"
  | "personal_unpaid"
  | "funding"
  | "refunds";

type ColumnKey =
  | "select"
  | "reference"
  | "date"
  | "title"
  | "type"
  | "amount"
  | "budget"
  | "funding"
  | "fundingNote"
  | "supplier"
  | "personal"
  | "paidBy"
  | "repayment"
  | "payment"
  | "bank"
  | "receipt"
  | "finance"
  | "checked"
  | "actions";

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

type RefundType = "money_received_back" | "money_sent_back";
type RefundStatus = "pending" | "completed" | "cancelled";

type TrackingRefund = {
  id: string;
  year: number;
  refund_date: string;
  refund_type: RefundType;
  amount_pence: number;
  title: string;
  notes: string | null;
  reference_number: string | null;
  supplier_id: string | null;
  original_transaction_id: string | null;
  status: RefundStatus;
  is_hidden: boolean;
  created_at: string;
  supplier?: {
    id: string;
    supplier_name: string;
  } | null;
  original_transaction?: {
    id: string;
    title: string;
    amount_pence: number;
    transaction_type: string;
    transaction_date: string;
  } | null;
};

type RefundListResponse = {
  success?: boolean;
  message?: string;
  refunds?: TrackingRefund[];
};

type TrackingRow =
  | {
      kind: "transaction";
      item: Transaction;
    }
  | {
      kind: "refund";
      item: TrackingRefund;
    };

const paymentMethodFilterOptions = [
  "all",
  "Stripe",
  "Cash",
  "Bank Transfer",
  "PayPal",
  "Card Machine",
  "Personal Funds",
  "Item Donation",
  "Other Types",
];

const financeNoteOptions: { value: FinanceNoteStatus; label: string }[] = [
  { value: "none", label: "No query" },
  { value: "waiting_for_receipt", label: "Waiting for receipt" },
  { value: "ask_sponsor", label: "Ask sponsor" },
  { value: "bank_query", label: "Bank query" },
  { value: "resolved", label: "Resolved" },
];

const DEFAULT_RECEIPT_REMINDER_DAYS = 7;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const RECEIPT_OVERDUE_SEARCH_WORDS =
  "receipt overdue overdue receipt old receipt expired receipt receipt expiry missing receipt over 7 days";

const receiptReminderDayOptions = [3, 7, 14, 21, 30];
const EMPTY_STRING_LIST: string[] = [];

const columnOptions: { key: ColumnKey; label: string; locked?: boolean }[] = [
  { key: "select", label: "Select", locked: true },
  { key: "reference", label: "Reference" },
  { key: "date", label: "Date" },
  { key: "title", label: "Title", locked: true },
  { key: "type", label: "Type" },
  { key: "amount", label: "Amount", locked: true },
  { key: "budget", label: "Budget" },
  { key: "funding", label: "Funding" },
  { key: "fundingNote", label: "Funding Note" },
  { key: "supplier", label: "Supplier" },
  { key: "personal", label: "Personal" },
  { key: "paidBy", label: "Paid By" },
  { key: "repayment", label: "Repayment" },
  { key: "payment", label: "Payment" },
  { key: "bank", label: "Bank Match" },
  { key: "receipt", label: "Receipt" },
  { key: "finance", label: "Finance Note" },
  { key: "checked", label: "Checked" },
  { key: "actions", label: "Actions", locked: true },
];

const defaultVisibleColumns: Record<ColumnKey, boolean> = {
  select: true,
  reference: true,
  date: true,
  title: true,
  type: true,
  amount: true,
  budget: true,

  // Keep normal mode clean by default. These advanced columns can still be
  // switched back on from the Columns menu.
  funding: false,
  fundingNote: false,
  supplier: false,
  personal: false,
  paidBy: false,
  repayment: false,

  payment: true,
  bank: true,
  receipt: false,
  finance: false,
  checked: true,
  actions: true,
};

const easyModeVisibleColumns: Record<ColumnKey, boolean> = {
  select: true,
  reference: true,
  date: true,
  title: true,
  type: true,
  amount: true,
  budget: true,
  funding: false,
  fundingNote: false,
  supplier: false,
  personal: false,
  paidBy: false,
  repayment: false,
  payment: true,
  bank: false,
  receipt: false,
  finance: false,
  checked: true,
  actions: true,
};

function cleanText(value?: unknown) {
  return String(value || "").trim();
}

function lower(value?: unknown) {
  return cleanText(value).toLowerCase();
}

function numberValue(value?: unknown) {
  const next = Number(value || 0);
  return Number.isFinite(next) ? next : 0;
}

const budgetFallbackLabels: Record<string, string> = {
  venue: "Venue",
  insurance: "Insurance",
  printing: "Printing",
  security: "Security",
  performers: "Performers",
  equipment: "Equipment",
  accessibility: "Accessibility",
  other: "Other costs",
  other_costs: "Other costs",
};

const autoBudgetRules: {
  key: string;
  label: string;
  words: string[];
}[] = [
  {
    key: "venue",
    label: "Venue",
    words: [
      "venue",
      "hall",
      "room hire",
      "hire room",
      "building hire",
      "park hire",
      "site hire",
      "shobnall",
      "bridge inn",
      "burton town hall",
      "town hall",
    ],
  },
  {
    key: "insurance",
    label: "Insurance",
    words: [
      "insurance",
      "public liability",
      "liability",
      "cover",
      "policy",
      "premium",
      "insurer",
    ],
  },
  {
    key: "printing",
    label: "Printing",
    words: [
      "print",
      "printing",
      "poster",
      "posters",
      "banner",
      "banners",
      "leaflet",
      "leaflets",
      "flyer",
      "flyers",
      "programme",
      "signage",
      "signs",
      "wristband",
      "wristbands",
    ],
  },
  {
    key: "security",
    label: "Security",
    words: [
      "security",
      "sIA",
      "steward",
      "stewards",
      "marshal",
      "marshals",
      "barrier",
      "barriers",
      "crowd",
      "first response security",
    ],
  },
  {
    key: "performers",
    label: "Performers",
    words: [
      "performer",
      "performers",
      "artist",
      "artists",
      "drag",
      "singer",
      "dj",
      "host",
      "entertainment",
      "act",
      "acts",
      "stage act",
      "citrine",
      "iris prism",
      "miss stella",
    ],
  },
  {
    key: "equipment",
    label: "Equipment",
    words: [
      "equipment",
      "gazebo",
      "gazebos",
      "table",
      "tables",
      "chair",
      "chairs",
      "stage",
      "pa system",
      "speaker",
      "speakers",
      "microphone",
      "mic",
      "generator",
      "cable",
      "cables",
      "storage",
      "storage box",
      "lock",
      "lock for storage",
      "box",
      "padlock",
      "tent",
      "marquee",
      "toilet",
      "toilets",
      "bin",
      "bins",
      "radio",
      "radios",
      "hi vis",
      "lanyard",
      "lanyards",
      "extension lead",
    ],
  },
  {
    key: "accessibility",
    label: "Accessibility",
    words: [
      "accessibility",
      "accessible",
      "disabled",
      "mobility",
      "wheelchair",
      "quiet space",
      "sensory",
      "sign language",
      "bsl",
      "ramp",
      "ramps",
    ],
  },
];

type TransactionBudgetFields = Transaction & {
  budgetCategory?: string | null;
  budgetCategoryKey?: string | null;
  budgetCategoryLabel?: string | null;
  budget_category?: string | null;
  budget_category_key?: string | null;
  budget_category_label?: string | null;
  costArea?: string | null;
  cost_area?: string | null;
};

function humaniseBudgetValue(value?: string | null) {
  const clean = cleanText(value);

  if (!clean) return "";

  return (
    budgetFallbackLabels[clean.toLowerCase()] ||
    clean
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
      .trim()
  );
}

function getTransactionBudgetKey(item: Transaction) {
  const row = item as TransactionBudgetFields;

  return cleanText(
    row.budgetCategoryKey ||
      row.budget_category_key ||
      row.budgetCategory ||
      row.budget_category ||
      row.costArea ||
      row.cost_area,
  );
}

function getTransactionBudgetLabel(item: Transaction) {
  const row = item as TransactionBudgetFields;
  const savedLabel = cleanText(row.budgetCategoryLabel || row.budget_category_label);

  if (savedLabel) return savedLabel;

  return humaniseBudgetValue(getTransactionBudgetKey(item));
}

function getAutoBudgetMatch(item: Transaction) {
  const searchText = [
    item.title,
    item.description,
    item.category,
    item.payment_method,
    item.sponsorship_note,
    getSupplierName(item),
    getSupplierCategory(item),
    item.personal_funds_name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!searchText.trim()) {
    return {
      key: "other",
      label: "Other costs",
      matchedBy: "no clear title, note, category, supplier or payment wording was found",
    };
  }

  for (const rule of autoBudgetRules) {
    const matchedWord = rule.words.find((word) =>
      searchText.includes(word.toLowerCase()),
    );

    if (matchedWord) {
      return {
        key: rule.key,
        label: rule.label,
        matchedBy: matchedWord,
      };
    }
  }

  return {
    key: "other",
    label: "Other costs",
    matchedBy: "no specific budget keyword matched",
  };
}

function getTransactionBudgetInfo(item: Transaction) {
  const budgetKey = getTransactionBudgetKey(item);
  const budgetLabel = getTransactionBudgetLabel(item);
  const isManualBudget = Boolean(budgetKey || budgetLabel);
  const isPersonal = isPersonalFundsTransaction(item);
  const isMoneyIn = item.type === "income";
  const isItemDonation =
    item.payment_method === "Item Donation" ||
    cleanText(item.category).toLowerCase() === "item donation";

  if (isMoneyIn) {
    return {
      label: "None",
      detail:
        "Money In is not sent to Budget Planning. Budget Planning is for Money Out spending only.",
      isManualBudget: false,
      isAutoMatched: false,
      isExcluded: true,
      matchLabel: "None",
      matchKey: "",
    };
  }

  if (isItemDonation) {
    return {
      label: "Not in budget",
      detail:
        "Item donations are recorded for value only and are not saved to Budget Planning spend.",
      isManualBudget: false,
      isAutoMatched: false,
      isExcluded: true,
      matchLabel: "Not in budget",
      matchKey: "",
    };
  }

  if (isPersonal && !item.personal_funds_repaid) {
    return {
      label: "Not in budget yet",
      detail:
        "Personal funds only count once they are marked as paid back.",
      isManualBudget: false,
      isAutoMatched: false,
      isExcluded: true,
      matchLabel: "Not in budget yet",
      matchKey: "",
    };
  }

  if (isManualBudget) {
    const manualLabel = budgetLabel || budgetKey;

    return {
      label: manualLabel,
      detail: "Manually saved to this Budget Planning row.",
      isManualBudget: true,
      isAutoMatched: false,
      isExcluded: false,
      matchLabel: manualLabel,
      matchKey: budgetKey,
    };
  }

  const autoMatch = getAutoBudgetMatch(item);

  return {
    label: `Auto match → ${autoMatch.label}`,
    detail: `No manual budget row saved. Budget Planning should auto match this to ${autoMatch.label} because it matched: ${autoMatch.matchedBy}.`,
    isManualBudget: false,
    isAutoMatched: true,
    isExcluded: false,
    matchLabel: autoMatch.label,
    matchKey: autoMatch.key,
  };
}

function budgetBadgeClass(item: Transaction) {
  const budgetInfo = getTransactionBudgetInfo(item);

  if (budgetInfo.isExcluded) {
    return "bg-white/10 text-white/55 ring-white/10";
  }

  if (budgetInfo.isManualBudget) {
    return "bg-pink-500/20 text-pink-100 ring-pink-300/20";
  }

  return "bg-sky-500/15 text-sky-100 ring-sky-300/20";
}

function BudgetBadge({
  item,
  showReason = true,
}: {
  item: Transaction;
  showReason?: boolean;
}) {
  const budgetInfo = getTransactionBudgetInfo(item);

  return (
    <div className="space-y-1">
      <Badge className={budgetBadgeClass(item)}>{budgetInfo.label}</Badge>

      {showReason ? (
        <p className="max-w-[220px] text-[11px] font-medium leading-5 text-white/45">
          {budgetInfo.detail}
        </p>
      ) : null}
    </div>
  );
}

function fundingTypeLabel(type?: FundingType | string | null) {
  if (type === "grant") return "Grant Money";
  if (type === "loan") return "Loan";
  if (type === "other") return "Other Funding";
  return "Sponsor";
}

function fundingShortLabel(type?: FundingType | string | null) {
  if (type === "grant") return "grant";
  if (type === "loan") return "loan";
  if (type === "other") return "funding";
  return "sponsor";
}

function fundingBadgeClass(type?: FundingType | string | null) {
  if (type === "grant")
    return "bg-emerald-500/20 text-emerald-100 ring-emerald-300/20";
  if (type === "loan") return "bg-blue-500/20 text-blue-100 ring-blue-300/20";
  if (type === "other")
    return "bg-purple-500/20 text-purple-100 ring-purple-300/20";
  return "bg-amber-500/20 text-amber-100 ring-amber-300/20";
}

function getSupplierName(item: Transaction) {
  const row = item as Transaction & {
    supplier_name?: string | null;
    supplierName?: string | null;
  };

  return cleanText(row.supplier_name || row.supplierName);
}

function getSupplierCategory(item: Transaction) {
  const row = item as Transaction & {
    supplier_category?: string | null;
    supplierCategory?: string | null;
  };

  return cleanText(row.supplier_category || row.supplierCategory);
}

function getSupplierId(item: Transaction) {
  const row = item as Transaction & {
    supplier_id?: string | null;
    supplierId?: string | null;
  };

  return cleanText(row.supplier_id || row.supplierId);
}

function hasSupplierLinked(item: Transaction) {
  return Boolean(getSupplierId(item) || getSupplierName(item));
}

function supplierBadgeClass(category?: string | null) {
  const cleanCategory = cleanText(category).toLowerCase();

  if (cleanCategory.includes("venue"))
    return "bg-purple-500/20 text-purple-100 ring-purple-300/20";
  if (cleanCategory.includes("insurance"))
    return "bg-blue-500/20 text-blue-100 ring-blue-300/20";
  if (cleanCategory.includes("food"))
    return "bg-orange-500/20 text-orange-100 ring-orange-300/20";
  if (cleanCategory.includes("printer") || cleanCategory.includes("print"))
    return "bg-pink-500/20 text-pink-100 ring-pink-300/20";
  if (cleanCategory.includes("security"))
    return "bg-red-500/20 text-red-100 ring-red-300/20";

  return "bg-violet-500/20 text-violet-100 ring-violet-300/20";
}

function bankReconciliationLabel(status?: string | null) {
  if (status === "matched") return "Matched";
  if (status === "needs_review") return "Needs review";
  if (status === "ignored") return "Ignored";
  return "Unmatched";
}

function bankReconciliationBadgeClass(status?: string | null) {
  if (status === "matched")
    return "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20";
  if (status === "needs_review")
    return "bg-amber-500/15 text-amber-100 ring-amber-300/20";
  if (status === "ignored") return "bg-sky-500/15 text-sky-100 ring-sky-300/20";
  return "bg-white/10 text-white/60 ring-white/10";
}

function financeNoteStatusLabel(status?: string | null) {
  if (status === "waiting_for_receipt") return "Waiting for receipt";
  if (status === "ask_sponsor") return "Ask sponsor";
  if (status === "bank_query") return "Bank query";
  if (status === "resolved") return "Resolved";
  return "No query";
}

function financeNoteBadgeClass(status?: string | null) {
  if (status === "waiting_for_receipt")
    return "bg-amber-500/15 text-amber-100 ring-amber-300/20";
  if (status === "ask_sponsor")
    return "bg-purple-500/15 text-purple-100 ring-purple-300/20";
  if (status === "bank_query")
    return "bg-red-500/15 text-red-100 ring-red-300/20";
  if (status === "resolved")
    return "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20";
  return "bg-white/10 text-white/60 ring-white/10";
}

function formatFileSize(size?: number | null) {
  if (!size || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function getTransactionFiles(item: Transaction): TransactionAttachment[] {
  const attachments = item.attachments || [];

  if (attachments.length > 0) return attachments;

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

function hasMissingReceiptWarning(item: Transaction) {
  const files = getTransactionFiles(item);
  return item.type === "expense" && files.length === 0;
}

function normaliseText(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function nameFromEmail(email?: string | null) {
  const cleanEmail = String(email || "").trim();
  if (!cleanEmail || !cleanEmail.includes("@")) return "";

  return cleanEmail
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function getCheckedByDisplayName(item: Transaction) {
  const row = item as Transaction & {
    checked_by_name?: string | null;
    checked_by_email?: string | null;
    checked_by_user_id?: string | null;
  };

  return (
    row.checked_by_name ||
    row.checked_by ||
    nameFromEmail(row.checked_by_email) ||
    "Unknown admin"
  );
}

function getCheckedByEmail(item: Transaction) {
  const row = item as Transaction & { checked_by_email?: string | null };
  return row.checked_by_email || null;
}

function getCheckedByUserId(item: Transaction) {
  const row = item as Transaction & { checked_by_user_id?: string | null };
  return row.checked_by_user_id || null;
}

function canCurrentAdminUncheckTransaction({
  item,
  currentUserId,
  currentUserEmail,
  currentUserName,
}: {
  item: Transaction;
  currentUserId?: string | null;
  currentUserEmail?: string | null;
  currentUserName?: string | null;
}) {
  if (!item.checked_at) return false;

  const checkedByUserId = getCheckedByUserId(item);
  const checkedByEmail = getCheckedByEmail(item);
  const checkedByName = getCheckedByDisplayName(item);

  if (checkedByUserId && currentUserId)
    return checkedByUserId === currentUserId;
  if (checkedByEmail && currentUserEmail)
    return normaliseText(checkedByEmail) === normaliseText(currentUserEmail);
  if (checkedByName && currentUserName)
    return normaliseText(checkedByName) === normaliseText(currentUserName);

  return false;
}

function transactionMonthKey(item: Transaction) {
  const rawDate = String(item.transaction_date || item.created_at || "").trim();
  if (!rawDate) return "";
  return rawDate.slice(0, 7);
}

function normaliseLockedMonthKeys(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => {
          if (typeof item === "string") return item.trim();

          if (item && typeof item === "object") {
            const row = item as Record<string, unknown>;

            if (row.is_locked === false) return "";

            return String(
              row.month_key ||
                row.monthKey ||
                row.period_key ||
                row.periodKey ||
                row.key ||
                "",
            ).trim();
          }

          return "";
        })
        .filter((monthKey) => /^\d{4}-\d{2}$/.test(monthKey)),
    ),
  );
}

function normaliseLockedYearKeys(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => {
          if (typeof item === "string") return item.trim();

          if (item && typeof item === "object") {
            const row = item as Record<string, unknown>;

            if (row.is_locked === false) return "";

            return String(row.year || row.year_key || row.key || "").trim();
          }

          return "";
        })
        .filter((yearKey) => /^\d{4}$/.test(yearKey)),
    ),
  );
}

async function readLockPayload(response: Response) {
  const rawBody = await response.text();

  if (!rawBody) return {};

  try {
    return JSON.parse(rawBody);
  } catch {
    return {};
  }
}

function transactionReminderBaseDate(item: Transaction) {
  return item.transaction_date || item.created_at || "";
}

function parseTransactionDate(item: Transaction) {
  const rawDate = String(transactionReminderBaseDate(item) || "").trim();

  if (!rawDate) return null;

  const date = new Date(rawDate);

  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function transactionAgeDays(item: Transaction) {
  const date = parseTransactionDate(item);

  if (!date) return 0;

  return Math.max(0, Math.floor((Date.now() - date.getTime()) / MS_PER_DAY));
}

function receiptDueDate(
  item: Transaction,
  reminderDays = DEFAULT_RECEIPT_REMINDER_DAYS,
) {
  const date = parseTransactionDate(item);

  if (!date) return null;

  const nextDate = new Date(date);
  nextDate.setDate(
    nextDate.getDate() +
      Math.max(1, Number(reminderDays || DEFAULT_RECEIPT_REMINDER_DAYS)),
  );

  return nextDate;
}

function receiptDueDateLabel(
  item: Transaction,
  reminderDays = DEFAULT_RECEIPT_REMINDER_DAYS,
) {
  const date = receiptDueDate(item, reminderDays);

  if (!date) return "No due date";

  return formatDate(date.toISOString());
}

function receiptOverdueDays(
  item: Transaction,
  reminderDays = DEFAULT_RECEIPT_REMINDER_DAYS,
) {
  return Math.max(
    0,
    transactionAgeDays(item) -
      Math.max(1, Number(reminderDays || DEFAULT_RECEIPT_REMINDER_DAYS)),
  );
}

function isReceiptOverdue(
  item: Transaction,
  reminderDays = DEFAULT_RECEIPT_REMINDER_DAYS,
) {
  return (
    hasMissingReceiptWarning(item) &&
    transactionAgeDays(item) >=
      Math.max(1, Number(reminderDays || DEFAULT_RECEIPT_REMINDER_DAYS))
  );
}

function receiptReminderLabel(
  item: Transaction,
  reminderDays = DEFAULT_RECEIPT_REMINDER_DAYS,
) {
  const ageDays = transactionAgeDays(item);
  const overdueDays = receiptOverdueDays(item, reminderDays);
  const dueDate = receiptDueDateLabel(item, reminderDays);

  if (isReceiptOverdue(item, reminderDays)) {
    return `Missing receipt for ${ageDays} day${ageDays === 1 ? "" : "s"} — overdue by ${overdueDays} day${overdueDays === 1 ? "" : "s"} (due ${dueDate})`;
  }

  if (hasMissingReceiptWarning(item)) {
    return `Missing receipt for ${ageDays} day${ageDays === 1 ? "" : "s"} — due ${dueDate}`;
  }

  return "Receipt uploaded";
}

function isSpecialCheckedSearch(searchTerm: string) {
  const cleanSearch = searchTerm.trim().toLowerCase();

  const isUncheckedSearch =
    cleanSearch === "unchecked" ||
    cleanSearch === "uncheck" ||
    cleanSearch === "not checked" ||
    cleanSearch === "notchecked";

  const isCheckedSearch = cleanSearch === "checked";

  const isReceiptOverdueSearch =
    cleanSearch === "receipt overdue" ||
    cleanSearch === "overdue receipt" ||
    cleanSearch === "expired receipt" ||
    cleanSearch === "receipt expiry" ||
    cleanSearch === "old receipt";

  return {
    cleanSearch,
    isUncheckedSearch,
    isCheckedSearch,
    isReceiptOverdueSearch,
    isSpecialSearch:
      isUncheckedSearch || isCheckedSearch || isReceiptOverdueSearch,
  };
}

function compareText(a: unknown, b: unknown) {
  return cleanText(a).localeCompare(cleanText(b), "en-GB", {
    sensitivity: "base",
  });
}

function refundMonthKey(refund: TrackingRefund) {
  return String(refund.refund_date || refund.created_at || "").slice(0, 7);
}

function refundReference(refund: TrackingRefund) {
  const suppliedReference = cleanText(refund.reference_number);

  if (suppliedReference) {
    return suppliedReference;
  }

  return `REFUND-${refund.year}-${String(refund.id || "")
    .slice(0, 8)
    .toUpperCase()}`;
}

function refundTypeLabel(refund: TrackingRefund) {
  return refund.refund_type === "money_received_back"
    ? "Refund Received Back"
    : "Refund Sent Back";
}

function refundStatusLabel(status: RefundStatus) {
  if (status === "completed") return "Completed";
  if (status === "pending") return "Pending";
  return "Cancelled";
}

function refundStatusBadgeClass(status: RefundStatus) {
  if (status === "completed")
    return "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20";
  if (status === "pending")
    return "bg-amber-500/15 text-amber-100 ring-amber-300/20";
  return "bg-white/10 text-white/60 ring-white/10";
}

function refundTypeBadgeClass(refund: TrackingRefund) {
  return refund.refund_type === "money_received_back"
    ? "bg-cyan-500/15 text-cyan-100 ring-cyan-300/20"
    : "bg-purple-500/15 text-purple-100 ring-purple-300/20";
}

function getRefundSearchText(refund: TrackingRefund) {
  return [
    "refund",
    refundReference(refund),
    refund.title,
    refund.notes,
    refundTypeLabel(refund),
    refund.status,
    refund.supplier?.supplier_name,
    refund.original_transaction?.title,
    String(refund.amount_pence || ""),
    money(refund.amount_pence),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function trackingRowSortText(row: TrackingRow, sortKey: SortKey) {
  if (row.kind === "transaction") {
    const item = row.item;

    if (sortKey === "date") return item.transaction_date || item.created_at;
    if (sortKey === "title") return item.title;
    if (sortKey === "type") return item.type;
    if (sortKey === "funding") return item.sponsor_name;
    if (sortKey === "payment") return item.payment_method;
    if (sortKey === "checked") return item.checked_at ? "checked" : "unchecked";
    if (sortKey === "bank")
      return item.bank_reconciliation_status || "unmatched";
    if (sortKey === "receipt")
      return hasMissingReceiptWarning(item) ? "missing" : "uploaded";
    if (sortKey === "finance") return item.finance_note_status || "none";

    return "";
  }

  const refund = row.item;

  if (sortKey === "date") return refund.refund_date || refund.created_at;
  if (sortKey === "title") return refund.title;
  if (sortKey === "type") return refundTypeLabel(refund);
  if (sortKey === "payment") return "refund";
  if (sortKey === "checked") return refund.status;
  if (sortKey === "bank") return "refund";
  if (sortKey === "receipt") return "refund";
  if (sortKey === "finance") return "refund";

  return "";
}

function trackingRowSortAmount(row: TrackingRow) {
  return numberValue(row.item.amount_pence);
}

function getRowSearchText(item: Transaction) {
  const files = getTransactionFiles(item);
  const missingReceipt = hasMissingReceiptWarning(item);

  return [
    item.transaction_reference,
    item.title,
    item.description,
    item.type === "income" ? "money in income" : "money out expense",
    item.payment_method,
    item.sponsor_name,
    item.sponsorship_note,
    getSupplierName(item),
    getSupplierCategory(item),
    getTransactionBudgetKey(item),
    getTransactionBudgetLabel(item),
    getTransactionBudgetInfo(item).label,
    getTransactionBudgetInfo(item).detail,
    hasSupplierLinked(item)
      ? "supplier contact linked supplier contact"
      : "no supplier no contact",
    item.personal_funds_name,
    item.bank_reconciliation_status,
    item.bank_reconciliation_note,
    item.finance_note_status,
    item.finance_note,
    item.checked_at ? "checked" : "unchecked uncheck not checked notchecked",
    item.checked_by,
    (item as any).checked_by_name,
    (item as any).checked_by_email,
    missingReceipt
      ? "missing receipt no receipt receipt missing proof missing"
      : "receipt uploaded proof attached",
    isReceiptOverdue(item)
      ? RECEIPT_OVERDUE_SEARCH_WORDS
      : "receipt not overdue",
    files.map((file) => file.file_name).join(" "),
    String(item.amount_pence || ""),
    money(item.amount_pence),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function transactionMatchesQuickFilter(
  item: Transaction,
  quickFilter: QuickFilter,
  receiptReminderDays = DEFAULT_RECEIPT_REMINDER_DAYS,
) {
  if (quickFilter === "all") return true;
  if (quickFilter === "unchecked") return !item.checked_at;
  if (quickFilter === "checked") return Boolean(item.checked_at);
  if (quickFilter === "missing_receipts") return hasMissingReceiptWarning(item);
  if (quickFilter === "receipt_overdue")
    return isReceiptOverdue(item, receiptReminderDays);
  if (quickFilter === "finance_queries")
    return Boolean(
      item.finance_note_status && item.finance_note_status !== "none",
    );
  if (quickFilter === "bank_unmatched")
    return (
      !item.bank_reconciliation_status ||
      item.bank_reconciliation_status === "unmatched"
    );
  if (quickFilter === "personal_unpaid")
    return isPersonalFundsTransaction(item) && !item.personal_funds_repaid;
  if (quickFilter === "funding") return isSponsorshipTransaction(item);
  if (quickFilter === "refunds") return false;
  return true;
}

function exportSelectedTransactionsCsv(items: Transaction[]) {
  const headers = [
    "Reference",
    "Date",
    "Title",
    "Type",
    "Amount",
    "Budget",
    "Budget Reason",
    "Payment Method",
    "Funding",
    "Supplier",
    "Supplier Category",
    "Personal Funds Name",
    "Bank Status",
    "Finance Status",
    "Receipt Status",
    "Checked",
  ];

  const rows = items.map((item) => [
    item.transaction_reference || "",
    item.transaction_date || "",
    item.title || "",
    item.type || "",
    money(item.amount_pence),
    getTransactionBudgetInfo(item).label,
    getTransactionBudgetInfo(item).detail,
    item.payment_method || "",
    item.sponsor_name || "",
    getSupplierName(item),
    getSupplierCategory(item),
    item.personal_funds_name || "",
    item.bank_reconciliation_status || "unmatched",
    item.finance_note_status || "none",
    isReceiptOverdue(item)
      ? receiptReminderLabel(item)
      : hasMissingReceiptWarning(item)
        ? "Missing receipt"
        : "Receipt uploaded",
    item.checked_at
      ? `Checked by ${getCheckedByDisplayName(item)}`
      : "Not checked",
  ]);

  const csv = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `selected-money-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex rounded-2xl px-3 py-1 text-xs font-bold ring-1 ${className}`}
    >
      {children}
    </span>
  );
}

function WarningBadges({
  item,
  receiptReminderDays = DEFAULT_RECEIPT_REMINDER_DAYS,
}: {
  item: Transaction;
  receiptReminderDays?: number;
}) {
  const badges: ReactNode[] = [];

  if (!item.checked_at) {
    badges.push(
      <span
        key="unchecked"
        className="inline-flex items-center gap-1 rounded-xl border border-amber-300/20 bg-amber-500/10 px-2 py-1 text-[11px] font-black text-amber-100"
      >
        <ShieldAlert className="h-3 w-3" />
        Unchecked
      </span>,
    );
  }

  if (isReceiptOverdue(item, receiptReminderDays)) {
    badges.push(
      <span
        key="receipt-overdue"
        className="inline-flex items-center gap-1 rounded-xl border border-red-300/30 bg-red-500/15 px-2 py-1 text-[11px] font-black text-red-100"
        title={receiptReminderLabel(item, receiptReminderDays)}
      >
        <CalendarClock className="h-3 w-3" />
        Receipt overdue · {transactionAgeDays(item)} days
      </span>,
    );
  } else if (hasMissingReceiptWarning(item)) {
    badges.push(
      <span
        key="receipt"
        className="inline-flex items-center gap-1 rounded-xl border border-red-300/20 bg-red-500/10 px-2 py-1 text-[11px] font-black text-red-100"
        title={receiptReminderLabel(item, receiptReminderDays)}
      >
        <AlertTriangle className="h-3 w-3" />
        Missing receipt
      </span>,
    );
  }

  if (isPersonalFundsTransaction(item) && !item.personal_funds_repaid) {
    badges.push(
      <span
        key="personal"
        className="inline-flex items-center gap-1 rounded-xl border border-orange-300/20 bg-orange-500/10 px-2 py-1 text-[11px] font-black text-orange-100"
      >
        <AlertTriangle className="h-3 w-3" />
        Payback due
      </span>,
    );
  }

  if (item.finance_note_status && item.finance_note_status !== "none") {
    badges.push(
      <span
        key="finance"
        className="inline-flex items-center gap-1 rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-2 py-1 text-[11px] font-black text-cyan-100"
      >
        <FileText className="h-3 w-3" />
        Finance query
      </span>,
    );
  }

  if (badges.length === 0) return null;

  return <div className="mt-2 flex flex-wrap gap-1">{badges}</div>;
}

function SortButton({
  label,
  sortKey,
  activeSortKey,
  sortDirection,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeSortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
}) {
  const active = sortKey === activeSortKey;

  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className="inline-flex items-center gap-1 text-left font-black text-white/70 hover:text-white"
    >
      {label}
      {active ? (
        sortDirection === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : null}
    </button>
  );
}

export default function MoneyTransactionsTable({
  loading,
  transactions,
  filteredTransactions,
  printTransactionsList,
  yearTransactions,

  selectedYear,
  selectedViewMonth,
  setSelectedViewMonth,

  selectedPrintMonth,
  setSelectedPrintMonth,

  printMonthOptions,

  searchTerm,
  setSearchTerm,

  filter,
  setFilter,

  selectedSponsorId,
  setSelectedSponsorId,

  selectedSponsor,
  displaySponsors,

  selectedPaymentMethod,
  setSelectedPaymentMethod,

  deletingYear,
  deletingAll,
  deleting,
  repayingId,
  checkingId,
  bankReconcilingId,
  financeNoteUpdatingId,

  onPrint,
  onExportExcel,
  onExportYearlyReport,
  onOpenDeleteYear,
  onOpenDeleteAll,
  onEditTransaction,
  onHideTransaction,
  onTogglePersonalFundsRepaid,
  onMarkTransactionChecked,
  onUpdateBankReconciliationStatus,
  onUpdateFinanceNote,
  openingBalancePence = 0,
  receiptReminderDays = DEFAULT_RECEIPT_REMINDER_DAYS,
  lockedYears = EMPTY_STRING_LIST,
  lockedMonths = EMPTY_STRING_LIST,
}: MoneyTransactionsTableProps) {
  const { admin } = useAdmin();

  const currentUserId = admin?.id || null;
  const currentUserEmail = admin?.email || null;

  const currentUserName =
    admin?.full_name || nameFromEmail(currentUserEmail) || null;

  const receiptReminderDaysSafe = Math.max(
    1,
    Number(receiptReminderDays || DEFAULT_RECEIPT_REMINDER_DAYS),
  );

  const [repaymentProofFiles, setRepaymentProofFiles] = useState<
    Record<string, File[]>
  >({});
  const [financeNoteDrafts, setFinanceNoteDrafts] = useState<
    Record<string, { status: FinanceNoteStatus; note: string }>
  >({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [localReceiptReminderDays, setLocalReceiptReminderDays] = useState(
    receiptReminderDaysSafe,
  );
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [easyMode, setEasyMode] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [detailsItem, setDetailsItem] = useState<Transaction | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<
    Record<ColumnKey, boolean>
  >(defaultVisibleColumns);
  const [refunds, setRefunds] = useState<TrackingRefund[]>([]);
  const [refundsLoading, setRefundsLoading] = useState(false);
  const [refundsError, setRefundsError] = useState("");

  /**
   * Fallback lock data loaded directly by this table.
   *
   * The parent page should still pass lockedYears and lockedMonths, but this
   * fallback keeps the read-only protection and warning banner working when an
   * older MoneyMainGrid or hook has not passed the arrays through yet.
   */
  const [apiLockedYears, setApiLockedYears] = useState<string[]>([]);
  const [apiLockedMonths, setApiLockedMonths] = useState<string[]>([]);

  /**
   * Desktop table drag-to-scroll.
   *
   * The full money table is wider than the screen on normal/full mode. This
   * lets admins hold the mouse down on empty/table space and drag left or
   * right, instead of needing to go down to the bottom browser scrollbar.
   */
  const desktopTableScrollRef = useRef<HTMLDivElement | null>(null);
  const desktopTableDragRef = useRef({
    active: false,
    pointerId: null as number | null,
    startX: 0,
    scrollLeft: 0,
    moved: false,
  });
  const [desktopTableDragging, setDesktopTableDragging] = useState(false);

  function isTableDragBlockedTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;

    return Boolean(
      target.closest(
        "button, a, input, select, textarea, label, summary, details, [role='button'], [data-no-drag-scroll='true']",
      ),
    );
  }

  function startDesktopTableDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (isTableDragBlockedTarget(event.target)) return;

    const element = desktopTableScrollRef.current;
    if (!element) return;

    desktopTableDragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: element.scrollLeft,
      moved: false,
    };

    element.setPointerCapture?.(event.pointerId);
    setDesktopTableDragging(true);
  }

  function moveDesktopTableDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = desktopTableDragRef.current;
    if (!drag.active) return;

    const element = desktopTableScrollRef.current;
    if (!element) return;

    const distanceMoved = event.clientX - drag.startX;

    if (Math.abs(distanceMoved) > 3) {
      drag.moved = true;
    }

    if (drag.moved) {
      event.preventDefault();
    }

    element.scrollLeft = drag.scrollLeft - distanceMoved;
  }

  function stopDesktopTableDrag(event?: ReactPointerEvent<HTMLDivElement>) {
    const element = desktopTableScrollRef.current;
    const pointerId = desktopTableDragRef.current.pointerId;

    if (element && pointerId !== null) {
      try {
        element.releasePointerCapture?.(pointerId);
      } catch {
        // Pointer capture can already be released by the browser.
      }
    }

    desktopTableDragRef.current.active = false;
    desktopTableDragRef.current.pointerId = null;
    setDesktopTableDragging(false);
  }

  function scrollDesktopTableBy(amount: number) {
    const element = desktopTableScrollRef.current;
    if (!element) return;

    element.scrollBy({
      left: amount,
      behavior: "smooth",
    });
  }

  const effectiveVisibleColumns = useMemo(
    () => (easyMode ? easyModeVisibleColumns : visibleColumns),
    [easyMode, visibleColumns],
  );

  function enableEasyMode() {
    setEasyMode(true);
    setColumnsOpen(false);
    setFiltersOpen(false);
    setSelectedIds(new Set());
    setSearchTerm("");
    setFilter("all");
    setSelectedSponsorId("all");
    setSelectedPaymentMethod("all");
    setQuickFilter("all");
    setLocalReceiptReminderDays(receiptReminderDaysSafe);
  }

  function resetEasyModeFilters() {
    setSearchTerm("");
    setFilter("all");
    setSelectedSponsorId("all");
    setSelectedPaymentMethod("all");
    setQuickFilter("all");
    setSelectedViewMonth("all");
  }

  function showEasyModePayments(
    nextFilter: "all" | "income" | "expense" | "sponsorship" | "personal",
    nextQuickFilter: QuickFilter = "all",
  ) {
    setFilter(nextFilter);
    setQuickFilter(nextQuickFilter);
    setSelectedSponsorId("all");
    setSelectedPaymentMethod("all");
  }

  const topActionButtonBase =
    "inline-flex min-w-[135px] flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ring-1 transition disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/25 disabled:ring-white/5 disabled:opacity-60 disabled:grayscale disabled:hover:bg-white/5 sm:flex-none";

  const activeReceiptReminderDays = Math.max(
    1,
    Number(localReceiptReminderDays || receiptReminderDaysSafe),
  );

  const lockedYearSet = useMemo(
    () => new Set([...normaliseLockedYearKeys(lockedYears), ...apiLockedYears]),
    [lockedYears, apiLockedYears],
  );

  const lockedMonthSet = useMemo(
    () =>
      new Set([...normaliseLockedMonthKeys(lockedMonths), ...apiLockedMonths]),
    [lockedMonths, apiLockedMonths],
  );

  const selectedYearIsLocked = lockedYearSet.has(String(selectedYear));
  const selectedViewMonthIsLocked =
    selectedViewMonth !== "all" &&
    lockedMonthSet.has(String(selectedViewMonth));
  const selectedPrintMonthIsLocked =
    selectedPrintMonth !== "all" &&
    lockedMonthSet.has(String(selectedPrintMonth));
  const selectedViewIsLocked =
    selectedYearIsLocked || selectedViewMonthIsLocked;
  const selectedPrintPeriodIsLocked =
    selectedYearIsLocked || selectedPrintMonthIsLocked;
  const hasAnyLockedPeriod = lockedYearSet.size > 0 || lockedMonthSet.size > 0;

  useEffect(() => {
    let cancelled = false;

    async function loadActiveLocks() {
      try {
        const [yearResponse, monthResponse] = await Promise.all([
          fetch(`/api/admin/money/year-locks?t=${Date.now()}`, {
            cache: "no-store",
          }),
          fetch(
            `/api/admin/money/month-locks?year=${encodeURIComponent(
              selectedYear,
            )}&t=${Date.now()}`,
            {
              cache: "no-store",
            },
          ),
        ]);

        const [yearPayload, monthPayload] = await Promise.all([
          readLockPayload(yearResponse),
          readLockPayload(monthResponse),
        ]);

        if (cancelled) return;

        if (yearResponse.ok) {
          setApiLockedYears(
            normaliseLockedYearKeys(
              yearPayload.lockedYears || yearPayload.locks || [],
            ),
          );
        }

        if (monthResponse.ok) {
          setApiLockedMonths(
            normaliseLockedMonthKeys(
              monthPayload.lockedMonths || monthPayload.locks || [],
            ),
          );
        }
      } catch {
        // Keep using parent props if this fallback request fails.
      }
    }

    /**
     * Load once when the selected year changes.
     *
     * Do not poll every few seconds. The main hook already refreshes lock data
     * immediately after a lock or unlock action, and focus refresh keeps this
     * fallback safe when returning to the browser tab.
     */
    void loadActiveLocks();

    function reloadOnFocus() {
      void loadActiveLocks();
    }

    window.addEventListener("focus", reloadOnFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", reloadOnFocus);
    };
  }, [selectedYear]);

  function getSelectedViewLockReason() {
    if (selectedYearIsLocked) {
      return `${selectedYear} is locked. Unlock the year before making changes.`;
    }

    if (selectedViewMonthIsLocked) {
      return `${monthNameFromKey(selectedViewMonth)} is locked. Unlock the month before making changes.`;
    }

    return "";
  }

  function getSelectedPrintLockReason() {
    if (selectedYearIsLocked) {
      return `${selectedYear} is locked. Unlock the year before making changes.`;
    }

    if (selectedPrintMonthIsLocked) {
      return `${monthNameFromKey(selectedPrintMonth)} is locked. Unlock the month before making changes.`;
    }

    return "";
  }

  function getTransactionLockReason(item: Transaction) {
    const monthKey = transactionMonthKey(item);
    const yearKey = monthKey.slice(0, 4);

    if (yearKey && lockedYearSet.has(yearKey)) {
      return `${yearKey} is locked. Unlock the year before making changes.`;
    }

    if (monthKey && lockedMonthSet.has(monthKey)) {
      return `${monthNameFromKey(monthKey)} is locked. Unlock the month before making changes.`;
    }

    // Safety fallback: if the current table view is locked, do not allow
    // any mutation button to run even when a row has a missing/odd date.
    if (selectedViewIsLocked) {
      return getSelectedViewLockReason();
    }

    return "";
  }

  function isTransactionLocked(item: Transaction) {
    return Boolean(getTransactionLockReason(item));
  }

  function showLockedToast(lockReason: string) {
    setToast({
      type: "error",
      message:
        lockReason ||
        "This transaction is in a locked month or year. Unlock it before making changes.",
    });
  }

  function runTransactionAction(
    item: Transaction,
    action: () => void | Promise<void>,
  ) {
    const lockReason = getTransactionLockReason(item);

    if (lockReason) {
      showLockedToast(lockReason);
      return undefined;
    }

    return action();
  }

  function runPeriodAction(
    action: () => void | Promise<void>,
    lockReason = getSelectedViewLockReason(),
  ) {
    if (lockReason) {
      showLockedToast(lockReason);
      return undefined;
    }

    return action();
  }

  function lockedActionTitle(item: Transaction, fallback: string) {
    return getTransactionLockReason(item) || fallback;
  }

  useEffect(() => {
    let cancelled = false;

    async function loadRefundsForTrackingTable() {
      setRefundsLoading(true);
      setRefundsError("");

      try {
        const response = await fetch(
          `/api/admin/money/refunds?year=${encodeURIComponent(selectedYear)}&limit=500`,
          {
            cache: "no-store",
          },
        );

        const payload = (await response.json()) as RefundListResponse;

        if (!response.ok) {
          throw new Error(payload.message || "Refunds could not be loaded.");
        }

        if (!cancelled) {
          setRefunds(
            Array.isArray(payload.refunds)
              ? payload.refunds.filter((refund) => !refund.is_hidden)
              : [],
          );
        }
      } catch (error) {
        if (!cancelled) {
          setRefunds([]);
          setRefundsError(
            error instanceof Error
              ? error.message
              : "Refunds could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) {
          setRefundsLoading(false);
        }
      }
    }

    void loadRefundsForTrackingTable();

    return () => {
      cancelled = true;
    };
  }, [selectedYear]);

  useEffect(() => {
    setSelectedIds((previous) => {
      let changed = false;
      const next = new Set<string>();

      for (const id of previous) {
        const item = transactions.find((transaction) => transaction.id === id);

        if (
          item &&
          !item.checked_at &&
          !isTransactionLocked(item) &&
          !selectedViewIsLocked
        ) {
          next.add(id);
        } else {
          changed = true;
        }
      }

      return changed ? next : previous;
    });
  }, [transactions, lockedYearSet, lockedMonthSet]);

  function getFundingForTransaction(item: Transaction) {
    if (!isSponsorshipTransaction(item)) return null;

    return (
      displaySponsors.find((sponsor) => {
        const sponsorName = String(sponsor.sponsor_name || "")
          .trim()
          .toLowerCase();
        const itemSponsorName = String(item.sponsor_name || "")
          .trim()
          .toLowerCase();

        return (
          sponsor.id === item.sponsor_id ||
          Boolean(
            sponsorName && itemSponsorName && sponsorName === itemSponsorName,
          )
        );
      }) || null
    );
  }

  function getFinanceDraft(item: Transaction) {
    return (
      financeNoteDrafts[item.id] || {
        status: item.finance_note_status || "none",
        note: item.finance_note || "",
      }
    );
  }

  function setFinanceDraftStatus(item: Transaction, status: FinanceNoteStatus) {
    const currentDraft = getFinanceDraft(item);
    setFinanceNoteDrafts((prev) => ({
      ...prev,
      [item.id]: { ...currentDraft, status },
    }));
  }

  function setFinanceDraftNote(item: Transaction, note: string) {
    const currentDraft = getFinanceDraft(item);
    setFinanceNoteDrafts((prev) => ({
      ...prev,
      [item.id]: { ...currentDraft, note },
    }));
  }

  async function saveFinanceDraft(item: Transaction) {
    const draft = getFinanceDraft(item);
    await onUpdateFinanceNote(item, draft.status, draft.note);

    setFinanceNoteDrafts((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
  }

  function handleSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(
      nextKey === "date" || nextKey === "amount" ? "desc" : "asc",
    );
  }

  const visibleTransactions = useMemo(() => {
    const {
      cleanSearch,
      isUncheckedSearch,
      isCheckedSearch,
      isReceiptOverdueSearch,
      isSpecialSearch,
    } = isSpecialCheckedSearch(searchTerm);

    const baseItems = isSpecialSearch ? yearTransactions : filteredTransactions;

    const filtered = baseItems.filter((item) => {
      const matchesMonth =
        selectedViewMonth === "all" ||
        transactionMonthKey(item) === selectedViewMonth;

      const matchesType =
        filter === "all"
          ? true
          : filter === "income"
            ? item.type === "income"
            : filter === "expense"
              ? item.type === "expense" && !isPersonalFundsTransaction(item)
              : filter === "personal"
                ? isPersonalFundsTransaction(item)
                : filter === "sponsorship"
                  ? isSponsorshipTransaction(item)
                  : true;

      const matchesPaymentMethod =
        selectedPaymentMethod === "all"
          ? true
          : selectedPaymentMethod === "Other Types"
            ? !paymentMethodFilterOptions.includes(
                item.payment_method || "Other Types",
              )
            : item.payment_method === selectedPaymentMethod;

      const matchesSponsor =
        selectedSponsorId === "all"
          ? true
          : isSponsorshipTransaction(item) &&
            Boolean(
              item.sponsor_id === selectedSponsorId ||
              getFundingForTransaction(item)?.id === selectedSponsorId,
            );

      const matchesCheckedSearch = isUncheckedSearch
        ? !item.checked_at
        : isCheckedSearch
          ? Boolean(item.checked_at)
          : true;
      const matchesReceiptOverdueSearch = isReceiptOverdueSearch
        ? isReceiptOverdue(item, activeReceiptReminderDays)
        : true;
      const matchesQuickFilter = transactionMatchesQuickFilter(
        item,
        quickFilter,
        activeReceiptReminderDays,
      );
      const matchesTextSearch =
        !cleanSearch ||
        isSpecialSearch ||
        getRowSearchText(item).includes(cleanSearch);

      return (
        matchesMonth &&
        matchesType &&
        matchesPaymentMethod &&
        matchesSponsor &&
        matchesCheckedSearch &&
        matchesReceiptOverdueSearch &&
        matchesQuickFilter &&
        matchesTextSearch
      );
    });

    return [...filtered].sort((a, b) => {
      let result = 0;

      if (sortKey === "date")
        result = compareText(
          a.transaction_date || a.created_at,
          b.transaction_date || b.created_at,
        );
      if (sortKey === "title") result = compareText(a.title, b.title);
      if (sortKey === "type") result = compareText(a.type, b.type);
      if (sortKey === "amount")
        result = numberValue(a.amount_pence) - numberValue(b.amount_pence);
      if (sortKey === "funding")
        result = compareText(a.sponsor_name, b.sponsor_name);
      if (sortKey === "payment")
        result = compareText(a.payment_method, b.payment_method);
      if (sortKey === "checked")
        result = Number(Boolean(a.checked_at)) - Number(Boolean(b.checked_at));
      if (sortKey === "bank")
        result = compareText(
          a.bank_reconciliation_status || "unmatched",
          b.bank_reconciliation_status || "unmatched",
        );
      if (sortKey === "receipt") {
        const aOverdue = isReceiptOverdue(a, activeReceiptReminderDays)
          ? 2
          : hasMissingReceiptWarning(a)
            ? 1
            : 0;
        const bOverdue = isReceiptOverdue(b, activeReceiptReminderDays)
          ? 2
          : hasMissingReceiptWarning(b)
            ? 1
            : 0;
        result = aOverdue - bOverdue;
      }
      if (sortKey === "finance")
        result = compareText(
          a.finance_note_status || "none",
          b.finance_note_status || "none",
        );

      return sortDirection === "asc" ? result : result * -1;
    });
  }, [
    searchTerm,
    filteredTransactions,
    yearTransactions,
    selectedViewMonth,
    filter,
    selectedPaymentMethod,
    selectedSponsorId,
    displaySponsors,
    sortKey,
    sortDirection,
    quickFilter,
    activeReceiptReminderDays,
  ]);

  const visibleRefunds = useMemo(() => {
    const cleanSearch = searchTerm.trim().toLowerCase();

    const canShowRefunds =
      filter === "all" &&
      selectedPaymentMethod === "all" &&
      selectedSponsorId === "all" &&
      (quickFilter === "all" || quickFilter === "refunds");

    if (!canShowRefunds) {
      return [];
    }

    return refunds.filter((refund) => {
      const matchesMonth =
        selectedViewMonth === "all" ||
        refundMonthKey(refund) === selectedViewMonth;

      const matchesTextSearch =
        !cleanSearch || getRefundSearchText(refund).includes(cleanSearch);

      return matchesMonth && matchesTextSearch;
    });
  }, [
    refunds,
    searchTerm,
    selectedViewMonth,
    filter,
    selectedPaymentMethod,
    selectedSponsorId,
    quickFilter,
  ]);

  const visibleTrackingRows = useMemo(() => {
    const rows: TrackingRow[] = [
      ...visibleTransactions.map(
        (item): TrackingRow => ({
          kind: "transaction",
          item,
        }),
      ),

      ...visibleRefunds.map(
        (item): TrackingRow => ({
          kind: "refund",
          item,
        }),
      ),
    ];

    return rows.sort((a, b) => {
      const result =
        sortKey === "amount"
          ? trackingRowSortAmount(a) - trackingRowSortAmount(b)
          : compareText(
              trackingRowSortText(a, sortKey),
              trackingRowSortText(b, sortKey),
            );

      return sortDirection === "asc" ? result : result * -1;
    });
  }, [visibleTransactions, visibleRefunds, sortKey, sortDirection]);

  const refundTotals = useMemo(() => {
    return refunds.reduce(
      (acc, refund) => {
        if (refund.status !== "completed" || refund.is_hidden) {
          return acc;
        }

        if (refund.refund_type === "money_received_back") {
          acc.receivedBack += Number(refund.amount_pence || 0);
        }

        if (refund.refund_type === "money_sent_back") {
          acc.sentBack += Number(refund.amount_pence || 0);
        }

        return acc;
      },
      {
        receivedBack: 0,
        sentBack: 0,
      },
    );
  }, [refunds]);

  const visibleIds = useMemo(
    () =>
      visibleTransactions
        .filter(
          (item) =>
            !item.checked_at &&
            !isTransactionLocked(item) &&
            !selectedViewIsLocked,
        )
        .map((item) => item.id)
        .filter(Boolean),
    [visibleTransactions, lockedYears, lockedMonths],
  );
  const selectedTransactions = useMemo(
    () => visibleTransactions.filter((item) => selectedIds.has(item.id)),
    [visibleTransactions, selectedIds],
  );
  const selectedEditableTransactions = useMemo(
    () =>
      selectedTransactions.filter(
        (item) => !item.checked_at && !isTransactionLocked(item),
      ),
    [selectedTransactions, lockedYears, lockedMonths],
  );
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  const totals = useMemo(() => {
    return visibleTransactions.reduce(
      (acc, item) => {
        const amount = Number(item.amount_pence || 0);
        const personalFunds = isPersonalFundsTransaction(item);
        const fundingLinked = isSponsorshipTransaction(item);

        /**
         * Use the same money rules as the main tracker:
         *
         * - General income counts as available Money In.
         * - Restricted funding stays separate.
         * - Normal Burton Pride spending counts as Money Out.
         * - Personal-funds spending only counts after it is paid back.
         */
        if (item.type === "income" && !fundingLinked) {
          acc.availableIncome += amount;
        }

        if (item.type === "expense" && !fundingLinked && !personalFunds) {
          acc.availableExpense += amount;
        }

        if (
          item.type === "expense" &&
          personalFunds &&
          item.personal_funds_repaid === true
        ) {
          acc.availableExpense += amount;
        }

        if (item.type === "income") {
          acc.rawIncome += amount;
        }

        if (item.type === "expense") {
          acc.rawExpense += amount;
        }

        if (!item.checked_at) {
          acc.unchecked += 1;
        }

        if (hasMissingReceiptWarning(item)) {
          acc.missingReceipts += 1;
        }

        if (isReceiptOverdue(item, activeReceiptReminderDays)) {
          acc.overdueReceipts += 1;
        }

        if (personalFunds && !item.personal_funds_repaid) {
          acc.unpaidPersonal += amount;
        }

        return acc;
      },
      {
        availableIncome: 0,
        availableExpense: 0,
        rawIncome: 0,
        rawExpense: 0,
        unchecked: 0,
        missingReceipts: 0,
        overdueReceipts: 0,
        unpaidPersonal: 0,
      },
    );
  }, [visibleTransactions, activeReceiptReminderDays]);

  /**
   * Completed refunds remain clearly labelled as refunds, but they adjust the
   * usable Burton Pride money totals.
   *
   * Refund received back -> added into Money In.
   * Refund sent back -> added into Money Out.
   */
  const moneyInIncludingCompletedRefunds =
    totals.availableIncome + refundTotals.receivedBack;

  const moneyOutIncludingCompletedRefunds =
    totals.availableExpense + refundTotals.sentBack;

  /**
   * Only add the opening balance when the full-year view is open.
   * A selected month shows that month's movement instead of pretending the
   * opening balance happened again inside the selected month.
   */
  const openingBalanceForView =
    selectedViewMonth === "all" ? Number(openingBalancePence || 0) : 0;

  const availableBalanceInView =
    openingBalanceForView +
    moneyInIncludingCompletedRefunds -
    moneyOutIncludingCompletedRefunds;

  function toggleSelect(id: string) {
    const item = transactions.find((transaction) => transaction.id === id);

    if (item && (item.checked_at || isTransactionLocked(item))) return;

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function bulkAction(
    label: string,
    action: (item: Transaction) => Promise<void> | void,
  ) {
    const editableTransactions = selectedTransactions.filter(
      (item) => !item.checked_at && !isTransactionLocked(item),
    );

    if (editableTransactions.length === 0) {
      setToast({
        type: "error",
        message:
          "The selected transaction is in a locked month or year. Unlock it before making changes.",
      });
      return;
    }

    try {
      setBulkBusy(true);
      setToast(null);

      for (const item of editableTransactions) {
        await action(item);
      }

      setToast({
        type: "success",
        message: `${label} completed for ${editableTransactions.length} selected transaction${editableTransactions.length === 1 ? "" : "s"}.`,
      });
      setSelectedIds(new Set());
    } catch (error) {
      console.error(error);
      setToast({
        type: "error",
        message: `${label} failed. Check console/server logs for details.`,
      });
    } finally {
      setBulkBusy(false);
    }
  }

  function ColumnCell({
    column,
    children,
    className = "",
  }: {
    column: ColumnKey;
    children: ReactNode;
    className?: string;
  }) {
    if (!effectiveVisibleColumns[column]) return null;
    return <td className={className}>{children}</td>;
  }

  function ColumnHeader({
    column,
    children,
    className = "",
  }: {
    column: ColumnKey;
    children: ReactNode;
    className?: string;
  }) {
    if (!effectiveVisibleColumns[column]) return null;
    return <th className={className}>{children}</th>;
  }

  function renderCheckedCell(item: Transaction) {
    const lockReason = getTransactionLockReason(item);

    if (lockReason) {
      return (
        <div
          className="rounded-2xl bg-red-500/10 px-3 py-2 text-xs font-bold text-red-100 ring-1 ring-red-300/20"
          title={lockReason}
        >
          Locked
          <div className="mt-1 text-[11px] font-semibold text-red-100/70">
            Unlock the month or year to change this.
          </div>
        </div>
      );
    }

    if (item.checked_at) {
      const checkedByName = getCheckedByDisplayName(item);
      const canUncheck = canCurrentAdminUncheckTransaction({
        item,
        currentUserId,
        currentUserEmail,
        currentUserName,
      });

      return (
        <div className="space-y-2">
          <div className="rounded-2xl bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-200 ring-1 ring-emerald-300/20">
            <div>Checked</div>
            <div className="mt-1 text-[11px] font-semibold text-emerald-100/70">
              By {checkedByName}
            </div>
            <div className="mt-1 text-[11px] font-semibold text-emerald-100/70">
              {formatDate(item.checked_at)}
            </div>
          </div>

          {canUncheck ? (
            <button
              type="button"
              disabled={checkingId === item.id}
              onClick={() =>
                runTransactionAction(item, () => onMarkTransactionChecked(item))
              }
              className="w-full rounded-xl bg-orange-500/15 px-3 py-2 text-xs font-bold text-orange-200 ring-1 ring-orange-300/20 hover:bg-orange-500/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/25 disabled:ring-white/5 disabled:opacity-60 disabled:grayscale disabled:hover:bg-white/5"
            >
              {checkingId === item.id ? "Undoing..." : "Undo checked"}
            </button>
          ) : (
            <div
              className="rounded-xl bg-white/10 px-3 py-2 text-[11px] font-bold text-white/50 ring-1 ring-white/10"
              title="Only the admin who marked this transaction as checked can undo it."
            >
              Only {checkedByName} can uncheck
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="rounded-2xl bg-white/10 px-3 py-2 text-xs font-bold text-white/60 ring-1 ring-white/10">
          Not checked
        </div>
        <button
          type="button"
          disabled={checkingId === item.id}
          onClick={() =>
            runTransactionAction(item, () => onMarkTransactionChecked(item))
          }
          className="w-full rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-200 ring-1 ring-emerald-300/20 hover:bg-emerald-500/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/25 disabled:ring-white/5 disabled:opacity-60 disabled:grayscale disabled:hover:bg-white/5"
        >
          {checkingId === item.id ? "Checking..." : "Mark checked"}
        </button>
      </div>
    );
  }

  function renderMobileCard(item: Transaction) {
    const isPersonal = isPersonalFundsTransaction(item);
    const hasFunding = isSponsorshipTransaction(item);
    const missingReceipt = hasMissingReceiptWarning(item);
    const receiptOverdue = isReceiptOverdue(item, activeReceiptReminderDays);
    const lockReason = getTransactionLockReason(item);
    const locked = Boolean(lockReason);
    const paymentChecked = Boolean(item.checked_at);
    const checkedByName = paymentChecked ? getCheckedByDisplayName(item) : "";
    const canUndoChecked = paymentChecked
      ? canCurrentAdminUncheckTransaction({
          item,
          currentUserId,
          currentUserEmail,
          currentUserName,
        })
      : false;
    const checkedByOtherAdmin = Boolean(paymentChecked && !canUndoChecked);
    const paymentActionsLocked = locked || paymentChecked;
    const paymentActionLockReason = locked
      ? lockReason
      : paymentChecked
        ? `This payment was checked by ${checkedByName}. Undo the checked status before making changes.`
        : "";

    return (
      <div
        key={item.id}
        className={`rounded-2xl border border-white/10 bg-black/20 p-4 ${receiptOverdue ? "ring-2 ring-red-300/30" : missingReceipt ? "ring-1 ring-red-300/20" : ""}`}
      >
        <div className="flex items-start justify-between gap-3">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={selectedIds.has(item.id)}
              disabled={paymentActionsLocked}
              onChange={() => toggleSelect(item.id)}
              className="mt-1 h-4 w-4 rounded border-white/20 bg-black/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/25 disabled:ring-white/5 disabled:opacity-60 disabled:grayscale disabled:hover:bg-white/5"
            />
            <div>
              <p className="break-words font-black text-white">{item.title}</p>
              <p className="mt-1 text-xs text-white/45">
                {item.transaction_reference || "Pending reference"}
              </p>
            </div>
          </label>

          <div
            className={`shrink-0 rounded-xl px-3 py-2 text-sm font-black ring-1 ${item.type === "income" ? "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20" : "bg-red-500/15 text-red-100 ring-red-300/20"}`}
          >
            {money(item.amount_pence)}
          </div>
        </div>

        <WarningBadges
          item={item}
          receiptReminderDays={activeReceiptReminderDays}
        />

        {locked && (
          <div className="mt-3 rounded-xl border border-red-300/20 bg-red-500/10 p-3 text-xs font-bold leading-5 text-red-100">
            {lockReason}
          </div>
        )}

        {receiptOverdue && (
          <div className="mt-3 rounded-xl border border-red-300/20 bg-red-500/10 p-3 text-xs font-bold leading-5 text-red-100">
            {receiptReminderLabel(item, activeReceiptReminderDays)}
          </div>
        )}

        <div className="mt-4 grid gap-2 text-sm text-white/65 sm:grid-cols-2">
          <div>
            Date:{" "}
            <strong className="text-white">
              {none(item.transaction_date)}
            </strong>
          </div>
          <div>
            Type:{" "}
            <strong className="text-white">
              {item.type === "income" ? "Money In" : "Money Out"}
            </strong>
          </div>
          <div>
            Payment:{" "}
            <strong className="text-white">
              {hasFunding ? "Funding Money" : item.payment_method || "None"}
            </strong>
          </div>
          <div className="sm:col-span-2">
            Budget:{" "}
            <strong className="text-white">
              {getTransactionBudgetInfo(item).label}
            </strong>
            <p className="mt-1 text-xs leading-5 text-white/45">
              {getTransactionBudgetInfo(item).detail}
            </p>
          </div>
          {hasSupplierLinked(item) && (
            <div>
              Supplier:{" "}
              <strong className="text-white">
                {getSupplierName(item) || "Supplier/contact"}
              </strong>
              {getSupplierCategory(item)
                ? ` · ${getSupplierCategory(item)}`
                : ""}
            </div>
          )}
          <div>
            Status:{" "}
            <strong className="text-white">
              {item.checked_at ? "Checked" : "Not checked"}
            </strong>
          </div>
          {isPersonal && (
            <div>
              Personal funds:{" "}
              <strong className="text-white">
                {item.personal_funds_repaid ? "Paid back" : "Not paid back"}
              </strong>
            </div>
          )}
          {hasFunding && (
            <div>
              Funding:{" "}
              <strong className="text-white">
                {item.sponsor_name || "Funding record"}
              </strong>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={paymentActionsLocked}
            onClick={() => setDetailsItem(item)}
            title={paymentActionLockReason || "View details"}
            className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Eye className="mr-1 inline h-3 w-3" /> Details
          </button>
          <button
            type="button"
            disabled={paymentActionsLocked}
            onClick={() =>
              runTransactionAction(item, () => onEditTransaction(item))
            }
            title={paymentActionLockReason || "Edit payment"}
            className="rounded-xl bg-sky-500/15 px-3 py-2 text-xs font-bold text-sky-200 hover:bg-sky-500/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/25 disabled:ring-white/5 disabled:opacity-60 disabled:grayscale disabled:hover:bg-white/5"
          >
            <Pencil className="mr-1 inline h-3 w-3" /> Edit
          </button>
          <button
            type="button"
            onClick={() =>
              runTransactionAction(item, () => onMarkTransactionChecked(item))
            }
            disabled={locked || checkingId === item.id || checkedByOtherAdmin}
            title={
              checkedByOtherAdmin
                ? `Only ${checkedByName} can undo the checked status.`
                : item.checked_at
                  ? "Undo the checked status"
                  : "Mark this payment as checked"
            }
            className="rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/25 disabled:ring-white/5 disabled:opacity-60 disabled:grayscale disabled:hover:bg-white/5"
          >
            <CheckCircle2 className="mr-1 inline h-3 w-3" />{" "}
            {item.checked_at ? "Undo" : "Check"}
          </button>
        </div>
      </div>
    );
  }

  function renderEasyModeCard(item: Transaction) {
    const isPersonal = isPersonalFundsTransaction(item);
    const hasFunding = isSponsorshipTransaction(item);
    const missingReceipt = hasMissingReceiptWarning(item);
    const receiptOverdue = isReceiptOverdue(item, activeReceiptReminderDays);
    const lockReason = getTransactionLockReason(item);
    const locked = Boolean(lockReason);
    const checkedByName = item.checked_at ? getCheckedByDisplayName(item) : "";
    const checkedByEmail = item.checked_at ? getCheckedByEmail(item) : null;
    const canUndoChecked = item.checked_at
      ? canCurrentAdminUncheckTransaction({
          item,
          currentUserId,
          currentUserEmail,
          currentUserName,
        })
      : false;
    const checkedByOtherAdmin = Boolean(item.checked_at && !canUndoChecked);
    const paymentChecked = Boolean(item.checked_at);
    const paymentActionsLocked = locked || paymentChecked;
    const paymentActionLockReason = locked
      ? lockReason
      : paymentChecked
        ? `This payment was checked by ${checkedByName}. Undo the checked status before making changes.`
        : "";

    return (
      <article
        key={`easy-${item.id}`}
        className={`rounded-3xl border bg-black/25 p-5 shadow-xl ${
          locked
            ? "border-red-300/30"
            : receiptOverdue
              ? "border-red-300/30"
              : "border-white/10"
        }`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${
                  item.type === "income"
                    ? "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20"
                    : "bg-red-500/15 text-red-100 ring-red-300/20"
                }`}
              >
                {item.type === "income" ? "MONEY IN" : "MONEY OUT"}
              </span>

              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/70 ring-1 ring-white/10">
                {item.payment_method || "No payment method"}
              </span>
            </div>

            <h3 className="mt-3 break-words text-xl font-black leading-tight text-white sm:text-2xl">
              {item.title}
            </h3>

            <p className="mt-2 text-sm font-semibold text-white/55">
              {item.transaction_reference || "Reference not added yet"}
            </p>
          </div>

          <div
            className={`shrink-0 rounded-2xl px-4 py-3 text-2xl font-black ring-1 ${
              item.type === "income"
                ? "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20"
                : "bg-red-500/15 text-red-100 ring-red-300/20"
            }`}
          >
            {money(item.amount_pence)}
          </div>
        </div>

        <WarningBadges
          item={item}
          receiptReminderDays={activeReceiptReminderDays}
        />

        {locked ? (
          <div className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm font-bold leading-6 text-red-100">
            {lockReason}
          </div>
        ) : null}

        {receiptOverdue ? (
          <div className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm font-bold leading-6 text-red-100">
            {receiptReminderLabel(item, activeReceiptReminderDays)}
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-white/45">
              Date
            </p>
            <p className="mt-2 text-base font-black text-white">
              {none(item.transaction_date)}
            </p>
          </div>

          <div className="rounded-2xl bg-pink-500/10 p-4 ring-1 ring-pink-300/20">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-pink-100/70">
              Budget tracker
            </p>
            <div className="mt-2">
              <BudgetBadge item={item} />
            </div>
          </div>

          <div
            className={`rounded-2xl p-4 ring-1 ${
              checkedByOtherAdmin
                ? "bg-orange-500/10 ring-orange-300/20"
                : item.checked_at
                  ? "bg-emerald-500/10 ring-emerald-300/20"
                  : "bg-white/[0.06] ring-white/10"
            }`}
          >
            <p className="text-xs font-black uppercase tracking-[0.14em] text-white/45">
              Checked status
            </p>

            <p
              className={`mt-2 text-base font-black ${
                checkedByOtherAdmin
                  ? "text-orange-100"
                  : item.checked_at
                    ? "text-emerald-100"
                    : "text-amber-100"
              }`}
            >
              {checkedByOtherAdmin
                ? "Locked by another admin"
                : item.checked_at
                  ? "Checked"
                  : "Needs checking"}
            </p>

            {item.checked_at ? (
              <div className="mt-2 space-y-1 text-xs font-semibold leading-5 text-white/65">
                <p>
                  Checked by{" "}
                  <span className="font-black text-white">{checkedByName}</span>
                </p>

                {checkedByEmail ? (
                  <p className="break-all text-white/50">{checkedByEmail}</p>
                ) : null}

                <p className="text-white/50">{formatDate(item.checked_at)}</p>
              </div>
            ) : null}
          </div>

          {hasFunding ? (
            <div className="rounded-2xl bg-amber-500/10 p-4 ring-1 ring-amber-300/20 sm:col-span-2">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-100/70">
                Funding
              </p>
              <p className="mt-2 text-base font-black text-amber-100">
                {item.sponsor_name || "Funding record linked"}
              </p>
            </div>
          ) : null}

          {isPersonal ? (
            <div className="rounded-2xl bg-orange-500/10 p-4 ring-1 ring-orange-300/20 sm:col-span-2">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-orange-100/70">
                Personal funds
              </p>
              <p className="mt-2 text-base font-black text-orange-100">
                {item.personal_funds_repaid
                  ? "Paid back"
                  : "Still needs paying back"}
              </p>
            </div>
          ) : null}
        </div>

        {checkedByOtherAdmin ? (
          <div className="mt-4 rounded-2xl border border-orange-300/20 bg-orange-500/10 p-4 text-sm font-bold leading-6 text-orange-100">
            <p className="font-black text-white">
              Checked status locked by {checkedByName}
            </p>

            <p className="mt-1 text-orange-100/80">
              Only the admin who marked this payment as checked can undo it.
            </p>

            {checkedByEmail ? (
              <p className="mt-1 break-all text-xs text-orange-100/65">
                {checkedByEmail}
              </p>
            ) : null}
          </div>
        ) : null}

        {paymentChecked && !checkedByOtherAdmin ? (
          <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm font-bold leading-6 text-emerald-100">
            <p className="font-black text-white">
              Payment is locked after checking
            </p>
            <p className="mt-1 text-emerald-100/80">
              Press Undo checked before editing, deleting, selecting, or
              changing this payment.
            </p>
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <button
            type="button"
            disabled={locked || checkingId === item.id || checkedByOtherAdmin}
            onClick={() =>
              runTransactionAction(item, () => onMarkTransactionChecked(item))
            }
            title={
              checkedByOtherAdmin
                ? `Only ${checkedByName} can undo the checked status.`
                : item.checked_at
                  ? "Undo the checked status"
                  : "Mark this payment as checked"
            }
            className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl px-4 py-4 text-base font-black ring-1 transition disabled:cursor-not-allowed disabled:opacity-60 ${
              checkedByOtherAdmin
                ? "bg-orange-500/10 text-orange-100 ring-orange-300/20"
                : item.checked_at
                  ? "bg-orange-500/15 text-orange-100 ring-orange-300/20 hover:bg-orange-500/25"
                  : "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20 hover:bg-emerald-500/25"
            }`}
          >
            <CheckCircle2 className="h-5 w-5" />

            {checkingId === item.id
              ? "Saving..."
              : checkedByOtherAdmin
                ? `Locked by ${checkedByName}`
                : item.checked_at
                  ? "Undo checked"
                  : "Mark checked"}
          </button>

          <button
            type="button"
            disabled={paymentActionsLocked}
            onClick={() =>
              runTransactionAction(item, () => onEditTransaction(item))
            }
            title={paymentActionLockReason || "Edit payment"}
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-sky-500/15 px-4 py-4 text-base font-black text-sky-100 ring-1 ring-sky-300/20 transition hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Pencil className="h-5 w-5" />
            Edit payment
          </button>

          <button
            type="button"
            disabled={paymentActionsLocked || deleting}
            onClick={() =>
              runTransactionAction(item, () => onHideTransaction(item.id))
            }
            title={paymentActionLockReason || "Delete payment"}
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-red-500/15 px-4 py-4 text-base font-black text-red-100 ring-1 ring-red-300/20 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-5 w-5" />
            {deleting ? "Deleting..." : "Delete payment"}
          </button>

          <button
            type="button"
            disabled={paymentActionsLocked}
            onClick={() => setDetailsItem(item)}
            title={paymentActionLockReason || "View details"}
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-4 text-base font-black text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Eye className="h-5 w-5" />
            View details
          </button>
        </div>
      </article>
    );
  }

  function renderEasyModeRefundCard(refund: TrackingRefund) {
    return (
      <article
        key={`easy-refund-${refund.id}`}
        className="rounded-3xl border border-cyan-300/20 bg-cyan-500/[0.06] p-5 shadow-xl"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={refundTypeBadgeClass(refund)}>
                {refundTypeLabel(refund)}
              </Badge>

              <Badge className={refundStatusBadgeClass(refund.status)}>
                {refundStatusLabel(refund.status)}
              </Badge>
            </div>

            <h3 className="mt-3 break-words text-xl font-black leading-tight text-white sm:text-2xl">
              {refund.title}
            </h3>

            <p className="mt-2 text-sm font-semibold text-white/55">
              {refundReference(refund)}
            </p>
          </div>

          <div className="shrink-0 rounded-2xl bg-cyan-500/15 px-4 py-3 text-2xl font-black text-cyan-100 ring-1 ring-cyan-300/20">
            {money(refund.amount_pence)}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-white/45">
              Date
            </p>
            <p className="mt-2 text-base font-black text-white">
              {none(refund.refund_date)}
            </p>
          </div>

          <div className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-white/45">
              Status
            </p>
            <p className="mt-2 text-base font-black text-cyan-100">
              {refundStatusLabel(refund.status)}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <Link
            href="/admin/money/refunds"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500/15 px-4 py-3 text-sm font-black text-cyan-100 ring-1 ring-cyan-300/20 transition hover:bg-cyan-500/25"
          >
            <Eye className="h-4 w-4" />
            Open refund tracker
          </Link>
        </div>
      </article>
    );
  }

  function renderMobileRefundCard(refund: TrackingRefund) {
    return (
      <div
        key={`refund-${refund.id}`}
        className="rounded-2xl border border-cyan-300/20 bg-cyan-500/[0.06] p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={refundTypeBadgeClass(refund)}>
                {refundTypeLabel(refund)}
              </Badge>

              <Badge className={refundStatusBadgeClass(refund.status)}>
                {refundStatusLabel(refund.status)}
              </Badge>
            </div>

            <p className="mt-3 break-words font-black text-white">
              {refund.title}
            </p>

            <p className="mt-1 text-xs text-white/45">
              {refundReference(refund)}
            </p>
          </div>

          <div className="shrink-0 rounded-xl bg-cyan-500/15 px-3 py-2 text-sm font-black text-cyan-100 ring-1 ring-cyan-300/20">
            {money(refund.amount_pence)}
          </div>
        </div>

        {refund.notes ? (
          <p className="mt-3 text-xs leading-5 text-white/55">{refund.notes}</p>
        ) : null}

        <div className="mt-4 grid gap-2 text-sm text-white/65 sm:grid-cols-2">
          <div>
            Date:{" "}
            <strong className="text-white">{none(refund.refund_date)}</strong>
          </div>

          <div>
            Supplier:{" "}
            <strong className="text-white">
              {refund.supplier?.supplier_name || "None"}
            </strong>
          </div>

          <div>
            Original transaction:{" "}
            <strong className="text-white">
              {refund.original_transaction?.title || "Not linked"}
            </strong>
          </div>

          <div>
            Totals:{" "}
            <strong className="text-cyan-100">
              Kept separate from Money In / Money Out
            </strong>
          </div>
        </div>

        <div className="mt-4">
          <Link
            href="/admin/money/refunds"
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-500/15 px-3 py-2 text-xs font-bold text-cyan-100 ring-1 ring-cyan-300/20 transition hover:bg-cyan-500/25"
          >
            <Eye className="h-3 w-3" />
            Open Refund Tracker
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold">Transactions</h2>

            {selectedViewIsLocked && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-300/30 bg-red-500/20 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-red-50">
                <ShieldAlert className="h-3.5 w-3.5" />
                {selectedYearIsLocked
                  ? `${selectedYear} locked`
                  : `${monthNameFromKey(selectedViewMonth)} locked`}
              </span>
            )}

            <button
              type="button"
              onClick={() => {
                if (easyMode) {
                  setEasyMode(false);
                } else {
                  enableEasyMode();
                }
              }}
              className={`rounded-xl px-3 py-2 text-xs font-black ring-1 transition ${
                easyMode
                  ? "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20 hover:bg-emerald-500/25"
                  : "bg-purple-500/15 text-purple-100 ring-purple-300/20 hover:bg-purple-500/25"
              }`}
            >
              {easyMode ? "Easy Mode On" : "Switch to Easy Mode"}
            </button>
          </div>
          <p className="mt-1 text-xs font-bold text-white/45">
            {easyMode
              ? "Easy Mode shows large simple cards. Normal mode now starts clean; use Columns to show advanced details."
              : "Full Mode is on. Advanced columns, filters and tools are visible."}
          </p>
          <p className="text-sm text-white/50">
            {visibleTrackingRows.length} entr
            {visibleTrackingRows.length === 1 ? "y" : "ies"} showing for{" "}
            {selectedViewMonth === "all"
              ? selectedYear
              : monthNameFromKey(selectedViewMonth)}
          </p>
          <p className="mt-1 text-xs text-white/40">
            Sorted by {sortKey} ({sortDirection}). Selected:{" "}
            {selectedTransactions.length}. Transactions:{" "}
            {visibleTransactions.length}. Refunds: {visibleRefunds.length}.
          </p>
        </div>

        <div
          className={`${easyMode ? "hidden" : "grid"} w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-3 2xl:flex 2xl:flex-wrap 2xl:justify-end`}
        >
          <select
            value={selectedPrintMonth}
            onChange={(event) => setSelectedPrintMonth(event.target.value)}
            className="min-w-0 rounded-xl bg-black/30 px-3 py-2 text-sm font-bold text-white outline-none ring-1 ring-sky-300/20 focus:ring-sky-300/50"
            title="Choose print/export month"
          >
            {printMonthOptions.map((month) => (
              <option
                key={month.key}
                value={month.key}
                className="bg-[#11111f] text-white"
              >
                Print / Export {month.label} ({month.count})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onPrint}
            disabled={printTransactionsList.length === 0}
            className={`${topActionButtonBase} bg-sky-500/15 text-sky-200 ring-sky-300/20 hover:bg-sky-500/25`}
          >
            <Printer className="h-4 w-4" />{" "}
            {selectedPrintMonth === "all"
              ? "Print Year"
              : `Print ${monthNameFromKey(selectedPrintMonth).split(" ")[0]}`}
          </button>

          <button
            type="button"
            onClick={onExportExcel}
            disabled={printTransactionsList.length === 0}
            className={`${topActionButtonBase} bg-emerald-500/15 text-emerald-200 ring-emerald-300/20 hover:bg-emerald-500/25`}
          >
            <Download className="h-4 w-4" />{" "}
            {selectedPrintMonth === "all"
              ? "Export Excel"
              : `Export ${monthNameFromKey(selectedPrintMonth).split(" ")[0]}`}
          </button>

          <button
            type="button"
            onClick={onExportYearlyReport}
            disabled={yearTransactions.length === 0}
            className={`${easyMode ? "hidden" : ""} ${topActionButtonBase} bg-purple-500/15 text-purple-200 ring-purple-300/20 hover:bg-purple-500/25`}
          >
            <FileText className="h-4 w-4" /> Yearly Report
          </button>

          <button
            type="button"
            onClick={onOpenDeleteYear}
            disabled={
              yearTransactions.length === 0 ||
              deletingYear ||
              selectedYearIsLocked
            }
            title={
              selectedYearIsLocked
                ? `${selectedYear} is locked. Unlock the year before deleting it.`
                : `Delete ${selectedYear}`
            }
            className={`${easyMode ? "hidden" : ""} ${topActionButtonBase} bg-orange-500/15 text-orange-200 ring-orange-300/20 hover:bg-orange-500/25`}
          >
            <Trash2 className="h-4 w-4" /> Delete {selectedYear}
          </button>

          <button
            type="button"
            onClick={onOpenDeleteAll}
            disabled={
              transactions.length === 0 || deletingAll || hasAnyLockedPeriod
            }
            title={
              hasAnyLockedPeriod
                ? "Unlock all locked months and years before deleting all transactions."
                : "Delete all transactions"
            }
            className={`${easyMode ? "hidden" : ""} ${topActionButtonBase} bg-red-500/15 text-red-200 ring-red-300/20 hover:bg-red-500/25`}
          >
            <Trash2 className="h-4 w-4" /> Delete All
          </button>
        </div>
      </div>

      {selectedViewIsLocked && (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-red-300/30 bg-red-500/15 px-4 py-4 text-red-100 shadow-xl shadow-red-950/20 sm:flex-row sm:items-center">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-500/20 ring-1 ring-red-300/30">
            <ShieldAlert className="h-6 w-6" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="inline-flex rounded-full border border-red-300/30 bg-red-500/20 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-red-50">
              {selectedYearIsLocked
                ? "This year is locked"
                : "This month is locked"}
            </div>

            <p className="mt-2 text-sm font-black leading-6 text-white">
              {selectedYearIsLocked
                ? `${selectedYear} is locked. Transactions cannot be edited, checked, hidden, repaid, or changed until the year is unlocked.`
                : `${monthNameFromKey(selectedViewMonth)} is locked. Transactions cannot be edited, checked, hidden, repaid, or changed until the month is unlocked.`}
            </p>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-bold ${toast.type === "success" ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100" : "border-red-300/20 bg-red-500/10 text-red-100"}`}
        >
          {toast.message}
        </div>
      )}

      {refundsError && (
        <div className="mb-4 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">
          Refund rows could not be loaded: {refundsError}
        </div>
      )}

      {easyMode ? (
        <div className="mb-4 rounded-3xl border border-emerald-300/20 bg-emerald-500/[0.08] p-4 shadow-xl sm:p-5">
          <div className="mb-4">
            <h3 className="text-xl font-black text-white">Find a payment</h3>
            <p className="mt-1 text-sm leading-6 text-emerald-100/75">
              Search for a payment or tap one of the large buttons below.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_260px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search payment name or reference..."
                className="w-full rounded-2xl bg-black/30 py-4 pl-12 pr-4 text-base font-semibold text-white outline-none ring-1 ring-white/10 placeholder:text-white/40 focus:ring-emerald-300/50"
              />
            </div>

            <select
              value={selectedViewMonth}
              onChange={(event) => {
                setSelectedViewMonth(event.target.value);
                setSearchTerm("");
              }}
              className="rounded-2xl bg-black/30 p-4 text-base font-black text-white outline-none ring-1 ring-emerald-300/20"
            >
              {printMonthOptions.map((month) => (
                <option
                  key={month.key}
                  value={month.key}
                  className="bg-[#11111f] text-white"
                >
                  {month.label} ({month.count})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={resetEasyModeFilters}
              className="rounded-2xl bg-white/10 px-5 py-4 text-base font-black text-white transition hover:bg-white/20"
            >
              Show all payments
            </button>
          </div>

          <div className="mt-5">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-100/65">
              Show me
            </p>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <button
                type="button"
                onClick={() => showEasyModePayments("all", "all")}
                className={`rounded-2xl px-4 py-4 text-left text-sm font-black ring-1 transition ${
                  filter === "all" && quickFilter === "all"
                    ? "bg-white text-black ring-white"
                    : "bg-white/10 text-white ring-white/10 hover:bg-white/20"
                }`}
              >
                All payments
              </button>

              <button
                type="button"
                onClick={() => showEasyModePayments("all", "unchecked")}
                className={`rounded-2xl px-4 py-4 text-left text-sm font-black ring-1 transition ${
                  quickFilter === "unchecked"
                    ? "bg-amber-100 text-black ring-amber-100"
                    : "bg-amber-500/10 text-amber-100 ring-amber-300/20 hover:bg-amber-500/20"
                }`}
              >
                Needs checking
              </button>

              <button
                type="button"
                onClick={() => showEasyModePayments("income", "all")}
                className={`rounded-2xl px-4 py-4 text-left text-sm font-black ring-1 transition ${
                  filter === "income" && quickFilter === "all"
                    ? "bg-emerald-100 text-black ring-emerald-100"
                    : "bg-emerald-500/10 text-emerald-100 ring-emerald-300/20 hover:bg-emerald-500/20"
                }`}
              >
                Money in
              </button>

              <button
                type="button"
                onClick={() => showEasyModePayments("expense", "all")}
                className={`rounded-2xl px-4 py-4 text-left text-sm font-black ring-1 transition ${
                  filter === "expense" && quickFilter === "all"
                    ? "bg-red-100 text-black ring-red-100"
                    : "bg-red-500/10 text-red-100 ring-red-300/20 hover:bg-red-500/20"
                }`}
              >
                Money out
              </button>

              <button
                type="button"
                onClick={() => showEasyModePayments("all", "missing_receipts")}
                className={`rounded-2xl px-4 py-4 text-left text-sm font-black ring-1 transition ${
                  quickFilter === "missing_receipts"
                    ? "bg-orange-100 text-black ring-orange-100"
                    : "bg-orange-500/10 text-orange-100 ring-orange-300/20 hover:bg-orange-500/20"
                }`}
              >
                Missing receipts
              </button>

              <button
                type="button"
                onClick={() => showEasyModePayments("all", "refunds")}
                className={`rounded-2xl px-4 py-4 text-left text-sm font-black ring-1 transition ${
                  quickFilter === "refunds"
                    ? "bg-cyan-100 text-black ring-cyan-100"
                    : "bg-cyan-500/10 text-cyan-100 ring-cyan-300/20 hover:bg-cyan-500/20"
                }`}
              >
                Refunds
              </button>
            </div>

            <p className="mt-4 text-sm font-bold text-white/70">
              Showing {visibleTrackingRows.length} entr
              {visibleTrackingRows.length === 1 ? "y" : "ies"}.
            </p>
          </div>
        </div>
      ) : null}

      <div
        className={`${easyMode ? "hidden" : "mb-4 grid gap-3 xl:grid-cols-[1fr_auto]"}`}
      >
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <button
            type="button"
            onClick={() => setFiltersOpen((prev) => !prev)}
            className="flex w-full items-center justify-between text-left text-sm font-black text-white"
          >
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" /> Filters and search
            </span>
            {filtersOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {filtersOpen && (
            <div className="mt-3 space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-white/35" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={`Search ${selectedViewMonth === "all" ? selectedYear : monthNameFromKey(selectedViewMonth)} by reference, title, funding, checked, unchecked, missing receipt, bank, amount...`}
                  className="w-full rounded-xl bg-black/30 py-3 pl-10 pr-3 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/40 focus:ring-pink-300/40"
                />
              </div>

              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                <select
                  value={selectedViewMonth}
                  onChange={(event) => {
                    setSelectedViewMonth(event.target.value);
                    setSearchTerm("");
                  }}
                  className="rounded-xl bg-black/30 p-3 text-sm font-bold text-white outline-none ring-1 ring-sky-300/20"
                >
                  {printMonthOptions.map((month) => (
                    <option
                      key={month.key}
                      value={month.key}
                      className="bg-[#11111f] text-white"
                    >
                      View {month.label} ({month.count})
                    </option>
                  ))}
                </select>

                <select
                  value={selectedPaymentMethod}
                  onChange={(event) =>
                    setSelectedPaymentMethod(event.target.value)
                  }
                  className={`${easyMode ? "hidden" : ""} rounded-xl bg-black/30 p-3 text-sm font-bold text-white outline-none ring-1 ring-emerald-300/20`}
                >
                  {paymentMethodFilterOptions.map((method) => (
                    <option
                      key={method}
                      value={method}
                      className="bg-[#11111f] text-white"
                    >
                      {method === "all" ? "All payment methods" : method}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedSponsorId}
                  onChange={(event) => {
                    const nextSponsorId = event.target.value;
                    setSelectedSponsorId(nextSponsorId);
                    if (nextSponsorId !== "all") setFilter("sponsorship");
                  }}
                  className={`${easyMode ? "hidden" : ""} rounded-xl bg-black/30 p-3 text-sm text-white outline-none ring-1 ring-amber-300/20`}
                >
                  <option className="bg-[#11111f] text-white" value="all">
                    All funding records
                  </option>
                  {displaySponsors.map((sponsor) => (
                    <option
                      className="bg-[#11111f] text-white"
                      key={sponsor.id}
                      value={sponsor.id}
                    >
                      {fundingTypeLabel(sponsor.funding_type)} —{" "}
                      {sponsor.sponsor_name}
                    </option>
                  ))}
                </select>

                <select
                  value={quickFilter}
                  onChange={(event) =>
                    setQuickFilter(event.target.value as QuickFilter)
                  }
                  className={`${easyMode ? "hidden" : ""} rounded-xl bg-black/30 p-3 text-sm font-bold text-white outline-none ring-1 ring-white/10`}
                >
                  <option className="bg-[#11111f] text-white" value="all">
                    Quick filter: All
                  </option>
                  <option className="bg-[#11111f] text-white" value="unchecked">
                    Unchecked only
                  </option>
                  <option className="bg-[#11111f] text-white" value="checked">
                    Checked only
                  </option>
                  <option
                    className="bg-[#11111f] text-white"
                    value="missing_receipts"
                  >
                    Missing receipts
                  </option>
                  <option
                    className="bg-[#11111f] text-white"
                    value="receipt_overdue"
                  >
                    Receipt overdue
                  </option>
                  <option
                    className="bg-[#11111f] text-white"
                    value="finance_queries"
                  >
                    Finance queries
                  </option>
                  <option
                    className="bg-[#11111f] text-white"
                    value="bank_unmatched"
                  >
                    Bank unmatched
                  </option>
                  <option
                    className="bg-[#11111f] text-white"
                    value="personal_unpaid"
                  >
                    Personal funds unpaid
                  </option>
                  <option className="bg-[#11111f] text-white" value="funding">
                    Funding linked
                  </option>
                  <option className="bg-[#11111f] text-white" value="refunds">
                    Refunds only
                  </option>
                </select>

                <select
                  value={activeReceiptReminderDays}
                  onChange={(event) =>
                    setLocalReceiptReminderDays(Number(event.target.value))
                  }
                  className={`${easyMode ? "hidden" : ""} rounded-xl bg-black/30 p-3 text-sm font-bold text-white outline-none ring-1 ring-red-300/20`}
                  title="Receipt reminder days"
                >
                  {receiptReminderDayOptions.map((days) => (
                    <option
                      key={days}
                      className="bg-[#11111f] text-white"
                      value={days}
                    >
                      Receipt overdue after {days} day{days === 1 ? "" : "s"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap gap-2">
                {(
                  [
                    "all",
                    "income",
                    "expense",
                    "personal",
                    "sponsorship",
                  ] as const
                ).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setFilter(item)}
                    className={`rounded-xl px-4 py-2 text-sm font-bold ${filter === item ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"}`}
                  >
                    {item === "all"
                      ? "All"
                      : item === "income"
                        ? "Money In"
                        : item === "expense"
                          ? "Money Out"
                          : item === "personal"
                            ? "Personal Funds"
                            : "Funding"}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setFilter("all");
                    setSelectedSponsorId("all");
                    setSelectedPaymentMethod("all");
                    setQuickFilter("all");
                    setLocalReceiptReminderDays(receiptReminderDaysSafe);
                  }}
                  className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20"
                >
                  Clear all
                </button>
              </div>
            </div>
          )}
        </div>

        <div
          className={`${easyMode ? "hidden" : "relative rounded-2xl border border-white/10 bg-black/20 p-3"}`}
        >
          <button
            type="button"
            onClick={() => setColumnsOpen((prev) => !prev)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/20 xl:w-auto"
          >
            <Columns3 className="h-4 w-4" /> Columns
          </button>

          {!easyMode && columnsOpen && (
            <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-2xl border border-white/10 bg-[#11111f] p-3 shadow-2xl shadow-black">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-black text-white">Show columns</p>
                <button
                  type="button"
                  onClick={() => setColumnsOpen(false)}
                  className="rounded-lg bg-white/10 p-1 text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-2">
                {columnOptions.map((column) => (
                  <label
                    key={column.key}
                    className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm font-bold text-white/75"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns[column.key]}
                      disabled={column.locked}
                      onChange={() =>
                        setVisibleColumns((prev) => ({
                          ...prev,
                          [column.key]: !prev[column.key],
                        }))
                      }
                    />
                    {column.label}
                    {column.locked && (
                      <span className="ml-auto text-[10px] text-white/35">
                        locked
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {easyMode && (
        <div className="mb-4 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          <p className="font-black">Easy Mode is on</p>
          <p className="mt-1 text-xs leading-5 text-emerald-100/75">
            Tap a payment to check, edit or delete it. Checked payments stay
            locked until the same admin presses Undo checked.
          </p>
        </div>
      )}

      <section className="mb-4 space-y-3">
        <div className="rounded-3xl border border-sky-300/30 bg-sky-500/15 p-5 shadow-lg shadow-black/10">
          <p className="text-sm font-black uppercase tracking-wide text-sky-100">
            Money Available Now
          </p>

          <p className="mt-2 break-words text-4xl font-black text-white sm:text-5xl">
            {money(availableBalanceInView)}
          </p>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-sky-100/75">
            This is the money currently available in the selected view. It
            updates when money comes in, payments go out or completed refunds
            are added.
          </p>
        </div>

        <div
          className={`grid gap-3 sm:grid-cols-2 ${easyMode ? "xl:grid-cols-2" : "xl:grid-cols-4 2xl:grid-cols-7"}`}
        >
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
            <p className="text-sm font-black text-emerald-100">
              Total Money In
            </p>

            <p className="mt-2 break-words text-2xl font-black text-white">
              {money(moneyInIncludingCompletedRefunds)}
            </p>

            <p className="mt-2 text-xs leading-5 text-emerald-100/65">
              General money received, including completed refunds received back.
            </p>
          </div>

          <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4">
            <p className="text-sm font-black text-red-100">Total Money Out</p>

            <p className="mt-2 break-words text-2xl font-black text-white">
              {money(moneyOutIncludingCompletedRefunds)}
            </p>

            <p className="mt-2 text-xs leading-5 text-red-100/65">
              Payments made by Burton Pride. Personal funds only count after
              repayment.
            </p>
          </div>

          <div
            className={`${easyMode ? "hidden" : ""} rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4`}
          >
            <p className="text-sm font-black text-cyan-100">Refunds Received</p>

            <p className="mt-2 break-words text-2xl font-black text-white">
              {money(refundTotals.receivedBack)}
            </p>

            <p className="mt-2 text-xs leading-5 text-cyan-100/65">
              Money returned to Burton Pride.
            </p>
          </div>

          <div
            className={`${easyMode ? "hidden" : ""} rounded-2xl border border-purple-300/20 bg-purple-500/10 p-4`}
          >
            <p className="text-sm font-black text-purple-100">
              Refunds Sent Back
            </p>

            <p className="mt-2 break-words text-2xl font-black text-white">
              {money(refundTotals.sentBack)}
            </p>

            <p className="mt-2 text-xs leading-5 text-purple-100/65">
              Money refunded back to other people.
            </p>
          </div>

          <div
            className={`${easyMode ? "hidden" : ""} rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4`}
          >
            <p className="text-sm font-black text-amber-100">
              Payments To Check
            </p>

            <p className="mt-2 text-2xl font-black text-white">
              {totals.unchecked}
            </p>

            <p className="mt-2 text-xs leading-5 text-amber-100/65">
              Payments that have not been checked yet.
            </p>
          </div>

          <div
            className={`${easyMode ? "hidden" : ""} rounded-2xl border border-red-300/20 bg-red-500/10 p-4`}
          >
            <p className="text-sm font-black text-red-100">Receipts Overdue</p>

            <p className="mt-2 text-2xl font-black text-white">
              {totals.overdueReceipts}
            </p>

            <p className="mt-2 text-xs leading-5 text-red-100/65">
              Missing for more than {activeReceiptReminderDays} days.
            </p>
          </div>

          <div
            className={`${easyMode ? "hidden" : ""} rounded-2xl border border-orange-300/20 bg-orange-500/10 p-4`}
          >
            <p className="text-sm font-black text-orange-100">
              Still Owed Back
            </p>

            <p className="mt-2 break-words text-2xl font-black text-white">
              {money(totals.unpaidPersonal)}
            </p>

            <p className="mt-2 text-xs leading-5 text-orange-100/65">
              Personal payments that still need repaying.
            </p>
          </div>
        </div>
      </section>

      {!easyMode && selectedTransactions.length > 0 && (
        <div className="sticky top-2 z-20 mb-4 rounded-2xl border border-pink-300/20 bg-[#1b1020]/95 p-3 shadow-2xl shadow-black backdrop-blur">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="text-sm font-bold text-white">
              {selectedTransactions.length} selected
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={
                  bulkBusy ||
                  selectedViewIsLocked ||
                  selectedEditableTransactions.length === 0
                }
                onClick={() =>
                  runPeriodAction(() =>
                    bulkAction("Mark checked", (item) =>
                      !item.checked_at
                        ? onMarkTransactionChecked(item)
                        : undefined,
                    ),
                  )
                }
                className="rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-black text-emerald-100 ring-1 ring-emerald-300/20 hover:bg-emerald-500/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/25 disabled:ring-white/5 disabled:opacity-60 disabled:grayscale disabled:hover:bg-white/5"
              >
                Bulk mark checked
              </button>
              <button
                type="button"
                disabled={
                  bulkBusy ||
                  selectedViewIsLocked ||
                  selectedEditableTransactions.length === 0
                }
                onClick={() =>
                  runPeriodAction(() =>
                    bulkAction("Mark bank matched", (item) =>
                      onUpdateBankReconciliationStatus(item, "matched"),
                    ),
                  )
                }
                className="rounded-xl bg-sky-500/15 px-3 py-2 text-xs font-black text-sky-100 ring-1 ring-sky-300/20 hover:bg-sky-500/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/25 disabled:ring-white/5 disabled:opacity-60 disabled:grayscale disabled:hover:bg-white/5"
              >
                Bulk bank matched
              </button>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() =>
                  exportSelectedTransactionsCsv(selectedTransactions)
                }
                className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white ring-1 ring-white/10 hover:bg-white/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/25 disabled:ring-white/5 disabled:opacity-60 disabled:grayscale disabled:hover:bg-white/5"
              >
                Export selected CSV
              </button>
              <button
                type="button"
                disabled={
                  bulkBusy ||
                  deleting ||
                  selectedViewIsLocked ||
                  selectedEditableTransactions.length === 0
                }
                onClick={() =>
                  runPeriodAction(() =>
                    bulkAction("Hide selected", (item) =>
                      onHideTransaction(item.id),
                    ),
                  )
                }
                title={
                  getSelectedViewLockReason() ||
                  "Locked transactions cannot be hidden."
                }
                className="rounded-xl bg-red-500/15 px-3 py-2 text-xs font-black text-red-100 ring-1 ring-red-300/20 hover:bg-red-500/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/25 disabled:ring-white/5 disabled:opacity-60 disabled:grayscale disabled:hover:bg-white/5"
              >
                Hide selected
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white hover:bg-white/20"
              >
                Clear selected
              </button>
            </div>
          </div>
        </div>
      )}

      {loading || refundsLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-24 animate-pulse rounded-2xl bg-white/10"
            />
          ))}
        </div>
      ) : visibleTrackingRows.length === 0 ? (
        <div className="rounded-2xl bg-black/20 p-8 text-center text-sm text-white/60">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-white/35" />
          No transactions found for{" "}
          {selectedViewMonth === "all"
            ? selectedYear
            : monthNameFromKey(selectedViewMonth)}
          .
        </div>
      ) : (
        <>
          {easyMode ? (
            <div className="grid gap-4">
              {visibleTrackingRows.map((row) =>
                row.kind === "transaction"
                  ? renderEasyModeCard(row.item)
                  : renderEasyModeRefundCard(row.item),
              )}
            </div>
          ) : null}

          <div className={`${easyMode ? "hidden" : "grid"} gap-3 xl:hidden`}>
            {visibleTrackingRows.map((row) =>
              row.kind === "transaction"
                ? renderMobileCard(row.item)
                : renderMobileRefundCard(row.item),
            )}
          </div>

          <div
            className={`${easyMode ? "hidden" : "hidden xl:block"} space-y-2`}
          >
            <div
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-white/65"
              data-no-drag-scroll="true"
            >
              <span>
                Drag the table left or right, or use the buttons.
              </span>

              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => scrollDesktopTableBy(-450)}
                  className="rounded-xl bg-white/10 px-3 py-2 text-white hover:bg-white/20"
                >
                  ← Left
                </button>
                <button
                  type="button"
                  onClick={() => scrollDesktopTableBy(450)}
                  className="rounded-xl bg-white/10 px-3 py-2 text-white hover:bg-white/20"
                >
                  Right →
                </button>
              </div>
            </div>

            <div
              ref={desktopTableScrollRef}
              onPointerDown={startDesktopTableDrag}
              onPointerMove={moveDesktopTableDrag}
              onPointerUp={stopDesktopTableDrag}
              onPointerCancel={stopDesktopTableDrag}
              onPointerLeave={stopDesktopTableDrag}
              className={`w-full max-w-[calc(100vw-2rem)] overflow-x-auto rounded-2xl border border-white/10 xl:max-w-full ${
                desktopTableDragging
                  ? "cursor-grabbing select-none"
                  : "cursor-grab"
              }`}
              title="Hold and drag left or right to move across the table"
            >
              <table
                className="w-full min-w-[1550px] text-sm"
              >
                <thead className="bg-white/10 text-white/60">
                  <tr>
                    <ColumnHeader column="select" className="p-3 text-left">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        disabled={visibleIds.length === 0}
                        onChange={toggleSelectAllVisible}
                      />
                    </ColumnHeader>
                    <ColumnHeader column="reference" className="p-3 text-left">
                      Reference
                    </ColumnHeader>
                    <ColumnHeader column="date" className="p-3 text-left">
                      <SortButton
                        label="Date"
                        sortKey="date"
                        activeSortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </ColumnHeader>
                    <ColumnHeader column="title" className="p-3 text-left">
                      <SortButton
                        label="Title"
                        sortKey="title"
                        activeSortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </ColumnHeader>
                    <ColumnHeader column="type" className="p-3 text-left">
                      <SortButton
                        label="Type"
                        sortKey="type"
                        activeSortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </ColumnHeader>
                    <ColumnHeader column="amount" className="p-3 text-right">
                      <SortButton
                        label="Amount"
                        sortKey="amount"
                        activeSortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </ColumnHeader>
                    <ColumnHeader column="budget" className="p-3 text-left">
                      Budget
                    </ColumnHeader>
                    <ColumnHeader column="funding" className="p-3 text-left">
                      <SortButton
                        label="Funding"
                        sortKey="funding"
                        activeSortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </ColumnHeader>
                    <ColumnHeader
                      column="fundingNote"
                      className="p-3 text-left"
                    >
                      Funding Note
                    </ColumnHeader>
                    <ColumnHeader column="supplier" className="p-3 text-left">
                      Supplier
                    </ColumnHeader>
                    <ColumnHeader column="personal" className="p-3 text-left">
                      Personal
                    </ColumnHeader>
                    <ColumnHeader column="paidBy" className="p-3 text-left">
                      Paid By
                    </ColumnHeader>
                    <ColumnHeader column="repayment" className="p-3 text-left">
                      Repayment
                    </ColumnHeader>
                    <ColumnHeader column="payment" className="p-3 text-left">
                      <SortButton
                        label="Payment"
                        sortKey="payment"
                        activeSortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </ColumnHeader>
                    <ColumnHeader column="bank" className="p-3 text-left">
                      <SortButton
                        label="Bank"
                        sortKey="bank"
                        activeSortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </ColumnHeader>
                    <ColumnHeader column="receipt" className="p-3 text-left">
                      <SortButton
                        label="Receipt"
                        sortKey="receipt"
                        activeSortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </ColumnHeader>
                    <ColumnHeader column="finance" className="p-3 text-left">
                      <SortButton
                        label="Finance"
                        sortKey="finance"
                        activeSortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </ColumnHeader>
                    <ColumnHeader column="checked" className="p-3 text-left">
                      <SortButton
                        label="Checked"
                        sortKey="checked"
                        activeSortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </ColumnHeader>
                    <ColumnHeader
                      column="actions"
                      className="sticky right-0 z-10 bg-[#242435] p-3 text-right shadow-[-12px_0_18px_rgba(0,0,0,0.35)]"
                    >
                      Action
                    </ColumnHeader>
                  </tr>
                </thead>

                <tbody>
                  {visibleTrackingRows.map((row) => {
                    if (row.kind === "refund") {
                      const refund = row.item;

                      return (
                        <tr
                          key={`refund-${refund.id}`}
                          className="border-t border-cyan-300/20 bg-cyan-500/[0.06]"
                        >
                          <ColumnCell column="select" className="p-3 align-top">
                            <span className="text-white/25">—</span>
                          </ColumnCell>

                          <ColumnCell
                            column="reference"
                            className="whitespace-nowrap p-3 align-top"
                          >
                            <span className="inline-flex rounded-xl bg-cyan-500/15 px-3 py-1 text-xs font-black text-cyan-100 ring-1 ring-cyan-300/20">
                              {refundReference(refund)}
                            </span>
                          </ColumnCell>

                          <ColumnCell
                            column="date"
                            className="whitespace-nowrap p-3 align-top"
                          >
                            {none(refund.refund_date)}
                          </ColumnCell>

                          <ColumnCell
                            column="title"
                            className="max-w-[240px] p-3 align-top"
                          >
                            <p className="break-words font-semibold text-white">
                              {refund.title}
                            </p>

                            {refund.notes ? (
                              <p className="mt-1 line-clamp-3 break-words text-xs text-white/50">
                                {refund.notes}
                              </p>
                            ) : null}

                            <div className="mt-2 flex flex-wrap gap-1">
                              <Badge className={refundTypeBadgeClass(refund)}>
                                {refundTypeLabel(refund)}
                              </Badge>

                              <Badge
                                className={refundStatusBadgeClass(
                                  refund.status,
                                )}
                              >
                                {refundStatusLabel(refund.status)}
                              </Badge>
                            </div>
                          </ColumnCell>

                          <ColumnCell
                            column="type"
                            className="whitespace-nowrap p-3 align-top"
                          >
                            <span className="font-bold text-cyan-100">
                              {refundTypeLabel(refund)}
                            </span>
                          </ColumnCell>

                          <ColumnCell
                            column="amount"
                            className="whitespace-nowrap p-3 text-right align-top font-bold text-cyan-100"
                          >
                            <div>{money(refund.amount_pence)}</div>
                            <div className="mt-1 text-xs font-semibold text-cyan-200/70">
                              Separate refund total
                            </div>
                          </ColumnCell>

                          <ColumnCell
                            column="budget"
                            className="max-w-[220px] p-3 align-top"
                          >
                            <span className="text-white/40">
                              Managed in Refund Tracker
                            </span>
                          </ColumnCell>

                          <ColumnCell
                            column="funding"
                            className="p-3 align-top"
                          >
                            <span className="text-white/40">None</span>
                          </ColumnCell>

                          <ColumnCell
                            column="fundingNote"
                            className="p-3 align-top"
                          >
                            <span className="text-white/40">None</span>
                          </ColumnCell>

                          <ColumnCell
                            column="supplier"
                            className="max-w-[220px] p-3 align-top"
                          >
                            {refund.supplier?.supplier_name ? (
                              <p className="break-words text-xs font-semibold text-white/85">
                                {refund.supplier.supplier_name}
                              </p>
                            ) : (
                              <span className="text-white/40">None</span>
                            )}
                          </ColumnCell>

                          <ColumnCell
                            column="personal"
                            className="p-3 align-top"
                          >
                            <span className="text-white/40">None</span>
                          </ColumnCell>

                          <ColumnCell column="paidBy" className="p-3 align-top">
                            <span className="text-white/40">None</span>
                          </ColumnCell>

                          <ColumnCell
                            column="repayment"
                            className="p-3 align-top"
                          >
                            <span className="text-white/40">
                              Not applicable
                            </span>
                          </ColumnCell>

                          <ColumnCell
                            column="payment"
                            className="whitespace-nowrap p-3 align-top"
                          >
                            Refund
                          </ColumnCell>

                          <ColumnCell column="bank" className="p-3 align-top">
                            <span className="text-white/40">
                              Managed in Refund Tracker
                            </span>
                          </ColumnCell>

                          <ColumnCell
                            column="receipt"
                            className="p-3 align-top"
                          >
                            <span className="text-white/40">
                              Not applicable
                            </span>
                          </ColumnCell>

                          <ColumnCell
                            column="finance"
                            className="p-3 align-top"
                          >
                            {refund.original_transaction?.title ? (
                              <div>
                                <p className="text-xs font-bold text-cyan-100">
                                  Linked transaction
                                </p>
                                <p className="mt-1 max-w-[220px] break-words text-xs text-white/55">
                                  {refund.original_transaction.title}
                                </p>
                              </div>
                            ) : (
                              <span className="text-white/40">
                                No linked transaction
                              </span>
                            )}
                          </ColumnCell>

                          <ColumnCell
                            column="checked"
                            className="p-3 align-top"
                          >
                            <Badge
                              className={refundStatusBadgeClass(refund.status)}
                            >
                              {refundStatusLabel(refund.status)}
                            </Badge>
                          </ColumnCell>

                          <ColumnCell
                            column="actions"
                            className="sticky right-0 z-10 bg-[#101a24] p-3 text-right align-top shadow-[-12px_0_18px_rgba(0,0,0,0.35)]"
                          >
                            <Link
                              href="/admin/money/refunds"
                              className="inline-flex items-center justify-center rounded-xl bg-cyan-500/15 p-2 text-cyan-100 transition hover:bg-cyan-500/25"
                              title="Open Refund Tracker"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          </ColumnCell>
                        </tr>
                      );
                    }

                    const item = row.item;
                    const isPersonal = isPersonalFundsTransaction(item);
                    const hasFunding = isSponsorshipTransaction(item);
                    const fundingRecord = getFundingForTransaction(item);
                    const fundingType =
                      fundingRecord?.funding_type || "sponsor";
                    const fundingLabel = fundingTypeLabel(fundingType);
                    const shortLabel = fundingShortLabel(fundingType);
                    const files = getTransactionFiles(item);
                    const missingReceipt = hasMissingReceiptWarning(item);
                    const receiptOverdue = isReceiptOverdue(
                      item,
                      activeReceiptReminderDays,
                    );
                    const proofFiles = repaymentProofFiles[item.id] || [];
                    const bankStatus =
                      item.bank_reconciliation_status || "unmatched";
                    const financeDraft = getFinanceDraft(item);
                    const financeStatus = item.finance_note_status || "none";
                    const financeNoteChanged =
                      financeDraft.status !== financeStatus ||
                      financeDraft.note !== (item.finance_note || "");
                    const lockReason = getTransactionLockReason(item);
                    const locked = Boolean(lockReason);
                    const paymentChecked = Boolean(item.checked_at);
                    const checkedByName = paymentChecked
                      ? getCheckedByDisplayName(item)
                      : "";
                    const paymentActionsLocked = locked || paymentChecked;
                    const paymentActionLockReason = locked
                      ? lockReason
                      : paymentChecked
                        ? `This payment was checked by ${checkedByName}. Undo the checked status before making changes.`
                        : "";

                    return (
                      <tr
                        key={item.id}
                        className={`border-t border-white/10 ${locked ? "bg-red-500/[0.05]" : receiptOverdue ? "bg-red-500/[0.07]" : missingReceipt ? "bg-red-500/[0.03]" : ""}`}
                      >
                        <ColumnCell column="select" className="p-3 align-top">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            disabled={paymentActionsLocked}
                            onChange={() => toggleSelect(item.id)}
                            title={
                              paymentActionLockReason || "Select transaction"
                            }
                          />
                        </ColumnCell>

                        <ColumnCell
                          column="reference"
                          className="whitespace-nowrap p-3 align-top"
                        >
                          {item.transaction_reference ? (
                            <span className="inline-flex rounded-xl bg-white/10 px-3 py-1 text-xs font-black text-white ring-1 ring-white/10">
                              {item.transaction_reference}
                            </span>
                          ) : (
                            <span className="text-white/40">Pending</span>
                          )}
                        </ColumnCell>

                        <ColumnCell
                          column="date"
                          className="whitespace-nowrap p-3 align-top"
                        >
                          {none(item.transaction_date)}
                        </ColumnCell>

                        <ColumnCell
                          column="title"
                          className="max-w-[240px] p-3 align-top"
                        >
                          <button
                            type="button"
                            disabled={paymentActionsLocked}
                            onClick={() => setDetailsItem(item)}
                            title={paymentActionLockReason || "View details"}
                            className="break-words text-left font-semibold text-white hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {item.title}
                          </button>
                          {item.description && (
                            <p className="mt-1 line-clamp-3 break-words text-xs text-white/50">
                              {item.description}
                            </p>
                          )}
                          <WarningBadges
                            item={item}
                            receiptReminderDays={activeReceiptReminderDays}
                          />
                          {locked && (
                            <p className="mt-2 rounded-xl bg-red-500/10 px-2 py-1 text-[11px] font-bold text-red-100 ring-1 ring-red-300/20">
                              {lockReason}
                            </p>
                          )}
                        </ColumnCell>

                        <ColumnCell
                          column="type"
                          className="whitespace-nowrap p-3 align-top"
                        >
                          {item.type === "income" ? "Money In" : "Money Out"}
                        </ColumnCell>

                        <ColumnCell
                          column="amount"
                          className="whitespace-nowrap p-3 text-right align-top font-bold"
                        >
                          <div>{money(item.amount_pence)}</div>
                          {hasFunding && (
                            <div className="mt-1 text-xs font-semibold text-amber-300">
                              {item.type === "income"
                                ? `${fundingLabel} in`
                                : `${shortLabel}-funded spend`}
                            </div>
                          )}
                          {isPersonal && item.personal_funds_repaid && (
                            <div className="mt-1 text-xs font-semibold text-emerald-300">
                              Taken from balance
                            </div>
                          )}
                          {isPersonal && !item.personal_funds_repaid && (
                            <div className="mt-1 text-xs font-semibold text-orange-300">
                              Not taken yet
                            </div>
                          )}
                        </ColumnCell>

                        <ColumnCell
                          column="budget"
                          className="max-w-[230px] p-3 align-top"
                        >
                          <BudgetBadge item={item} showReason={false} />
                        </ColumnCell>

                        <ColumnCell
                          column="funding"
                          className="max-w-[180px] p-3 align-top"
                        >
                          {hasFunding ? (
                            <div className="space-y-2">
                              <Badge className={fundingBadgeClass(fundingType)}>
                                {fundingLabel}
                              </Badge>
                              <p className="break-words text-xs font-semibold text-white/80">
                                {item.sponsor_name ||
                                  fundingRecord?.sponsor_name ||
                                  "Funding record"}
                              </p>
                            </div>
                          ) : (
                            <span className="text-white/40">None</span>
                          )}
                        </ColumnCell>

                        <ColumnCell
                          column="fundingNote"
                          className="max-w-[220px] p-3 align-top"
                        >
                          {item.sponsorship_note ? (
                            <span className="line-clamp-3 break-words text-sm text-amber-100">
                              {item.sponsorship_note}
                            </span>
                          ) : (
                            <span className="text-white/40">None</span>
                          )}
                        </ColumnCell>

                        <ColumnCell
                          column="supplier"
                          className="max-w-[220px] p-3 align-top"
                        >
                          {hasSupplierLinked(item) ? (
                            <div className="space-y-2">
                              <Badge
                                className={supplierBadgeClass(
                                  getSupplierCategory(item),
                                )}
                              >
                                {getSupplierCategory(item) || "Supplier"}
                              </Badge>

                              <p className="break-words text-xs font-semibold text-white/85">
                                {getSupplierName(item) || "Supplier/contact"}
                              </p>
                            </div>
                          ) : (
                            <span className="text-white/40">None</span>
                          )}
                        </ColumnCell>

                        <ColumnCell column="personal" className="p-3 align-top">
                          {isPersonal ? (
                            <Badge className="bg-sky-500/20 text-sky-100 ring-sky-300/20">
                              Personal funds
                            </Badge>
                          ) : (
                            <span className="text-white/40">None</span>
                          )}
                        </ColumnCell>

                        <ColumnCell
                          column="paidBy"
                          className="max-w-[160px] p-3 align-top"
                        >
                          {item.personal_funds_name ? (
                            <span className="break-words font-semibold text-sky-200">
                              {item.personal_funds_name}
                            </span>
                          ) : (
                            <span className="text-white/40">None</span>
                          )}
                        </ColumnCell>

                        <ColumnCell
                          column="repayment"
                          className="min-w-[190px] p-3 align-top"
                        >
                          {isPersonal ? (
                            <div className="space-y-2">
                              {item.personal_funds_repaid ? (
                                <div className="rounded-2xl bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-200 ring-1 ring-emerald-300/20">
                                  Paid back
                                  {item.personal_funds_repaid_at && (
                                    <div className="mt-1 text-[11px] font-semibold text-emerald-100/70">
                                      {formatDate(
                                        item.personal_funds_repaid_at,
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="rounded-2xl bg-orange-500/15 px-3 py-2 text-xs font-bold text-orange-200 ring-1 ring-orange-300/20">
                                  Not paid back
                                </div>
                              )}

                              {!item.personal_funds_repaid && (
                                <div className="rounded-xl bg-black/20 p-2 ring-1 ring-white/10">
                                  <label className="mb-1 block text-[11px] font-bold text-white/60">
                                    Upload proof before payback
                                  </label>
                                  <input
                                    type="file"
                                    disabled={paymentActionsLocked}
                                    multiple
                                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.eml,.msg"
                                    onChange={(event) => {
                                      const selectedFiles = Array.from(
                                        event.target.files || [],
                                      );
                                      setRepaymentProofFiles((prev) => ({
                                        ...prev,
                                        [item.id]: selectedFiles,
                                      }));
                                    }}
                                    className="w-full text-[11px] text-white/60 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/25 disabled:ring-white/5 disabled:opacity-60 disabled:grayscale disabled:hover:bg-white/5 file:mr-2 file:rounded-lg file:border-0 file:bg-emerald-500 file:px-2 file:py-1 file:text-[11px] file:font-bold file:text-white hover:file:bg-emerald-400"
                                  />
                                  {proofFiles.length > 0 && (
                                    <p className="mt-2 text-[11px] font-semibold text-emerald-200">
                                      {proofFiles.length} proof file
                                      {proofFiles.length === 1 ? "" : "s"}{" "}
                                      selected
                                    </p>
                                  )}
                                </div>
                              )}

                              <button
                                type="button"
                                disabled={
                                  paymentActionsLocked || repayingId === item.id
                                }
                                onClick={() =>
                                  runTransactionAction(item, async () => {
                                    await onTogglePersonalFundsRepaid(
                                      item,
                                      proofFiles,
                                    );
                                    setRepaymentProofFiles((prev) => ({
                                      ...prev,
                                      [item.id]: [],
                                    }));
                                  })
                                }
                                className={`w-full rounded-xl px-3 py-2 text-xs font-bold transition disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/25 disabled:ring-white/5 disabled:opacity-60 disabled:grayscale disabled:hover:bg-white/5 ${item.personal_funds_repaid ? "bg-orange-500/15 text-orange-200 ring-1 ring-orange-300/20 hover:bg-orange-500/25" : "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-300/20 hover:bg-emerald-500/25"}`}
                              >
                                {repayingId === item.id
                                  ? "Updating..."
                                  : item.personal_funds_repaid
                                    ? "Mark not paid back"
                                    : "Mark paid back"}
                              </button>
                            </div>
                          ) : (
                            <span className="text-white/40">None</span>
                          )}
                        </ColumnCell>

                        <ColumnCell
                          column="payment"
                          className="whitespace-nowrap p-3 align-top"
                        >
                          {hasFunding
                            ? "Funding Money"
                            : item.payment_method || "None"}
                        </ColumnCell>

                        <ColumnCell
                          column="bank"
                          className="min-w-[230px] p-3 align-top"
                        >
                          <div className="space-y-2">
                            <Badge
                              className={bankReconciliationBadgeClass(
                                bankStatus,
                              )}
                            >
                              {bankReconciliationLabel(bankStatus)}
                            </Badge>
                            {item.bank_reconciled_by && (
                              <p className="text-[11px] font-semibold text-white/50">
                                By {item.bank_reconciled_by}
                              </p>
                            )}
                            {item.bank_reconciled_at && (
                              <p className="text-[11px] font-semibold text-white/50">
                                {formatDate(item.bank_reconciled_at)}
                              </p>
                            )}
                            {item.bank_reconciliation_note && (
                              <p className="line-clamp-2 text-[11px] text-white/45">
                                {item.bank_reconciliation_note}
                              </p>
                            )}
                            <div className="grid grid-cols-2 gap-1">
                              <button
                                type="button"
                                disabled={
                                  paymentActionsLocked ||
                                  bankReconcilingId === item.id
                                }
                                onClick={() =>
                                  runTransactionAction(item, () =>
                                    onUpdateBankReconciliationStatus(
                                      item,
                                      "matched",
                                    ),
                                  )
                                }
                                className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-1.5 text-[11px] font-black text-emerald-100 ring-1 ring-emerald-300/20 hover:bg-emerald-500/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/25 disabled:ring-white/5 disabled:opacity-60 disabled:grayscale disabled:hover:bg-white/5"
                              >
                                {bankReconcilingId === item.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-3 w-3" />
                                )}{" "}
                                Matched
                              </button>
                              <button
                                type="button"
                                disabled={
                                  paymentActionsLocked ||
                                  bankReconcilingId === item.id
                                }
                                onClick={() =>
                                  runTransactionAction(item, () =>
                                    onUpdateBankReconciliationStatus(
                                      item,
                                      "needs_review",
                                    ),
                                  )
                                }
                                className="inline-flex items-center justify-center gap-1 rounded-lg bg-amber-500/15 px-2 py-1.5 text-[11px] font-black text-amber-100 ring-1 ring-amber-300/20 hover:bg-amber-500/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/25 disabled:ring-white/5 disabled:opacity-60 disabled:grayscale disabled:hover:bg-white/5"
                              >
                                <ShieldAlert className="h-3 w-3" /> Review
                              </button>
                              <button
                                type="button"
                                disabled={
                                  paymentActionsLocked ||
                                  bankReconcilingId === item.id
                                }
                                onClick={() =>
                                  runTransactionAction(item, () =>
                                    onUpdateBankReconciliationStatus(
                                      item,
                                      "ignored",
                                    ),
                                  )
                                }
                                className="inline-flex items-center justify-center gap-1 rounded-lg bg-sky-500/15 px-2 py-1.5 text-[11px] font-black text-sky-100 ring-1 ring-sky-300/20 hover:bg-sky-500/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/25 disabled:ring-white/5 disabled:opacity-60 disabled:grayscale disabled:hover:bg-white/5"
                              >
                                Ignore
                              </button>
                              <button
                                type="button"
                                disabled={
                                  paymentActionsLocked ||
                                  bankReconcilingId === item.id
                                }
                                onClick={() =>
                                  runTransactionAction(item, () =>
                                    onUpdateBankReconciliationStatus(
                                      item,
                                      "unmatched",
                                    ),
                                  )
                                }
                                className="inline-flex items-center justify-center gap-1 rounded-lg bg-white/10 px-2 py-1.5 text-[11px] font-black text-white/70 ring-1 ring-white/10 hover:bg-white/15 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/25 disabled:ring-white/5 disabled:opacity-60 disabled:grayscale disabled:hover:bg-white/5"
                              >
                                <RefreshCcw className="h-3 w-3" /> Unmatched
                              </button>
                            </div>
                          </div>
                        </ColumnCell>

                        <ColumnCell
                          column="receipt"
                          className="min-w-[230px] p-3 align-top"
                        >
                          {missingReceipt ? (
                            <div
                              className={`rounded-2xl border px-3 py-2 text-xs text-red-100 ${receiptOverdue ? "border-red-300/30 bg-red-500/15" : "border-red-300/20 bg-red-500/10"}`}
                            >
                              <div className="flex items-center gap-2 font-black">
                                {receiptOverdue ? (
                                  <CalendarClock className="h-4 w-4" />
                                ) : (
                                  <AlertTriangle className="h-4 w-4" />
                                )}
                                {receiptOverdue
                                  ? "Receipt overdue"
                                  : "Missing receipt"}
                              </div>
                              <div className="mt-1 text-red-100/70">
                                {receiptReminderLabel(
                                  item,
                                  activeReceiptReminderDays,
                                )}
                              </div>
                              <div className="mt-2 rounded-xl bg-black/20 px-2 py-1 text-[11px] font-bold text-red-100/75">
                                Rule: upload receipt within{" "}
                                {activeReceiptReminderDays} day
                                {activeReceiptReminderDays === 1 ? "" : "s"} of
                                the expense.
                              </div>
                            </div>
                          ) : files.length > 0 ? (
                            <div className="space-y-2">
                              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                                <div className="font-black">
                                  Receipt / proof attached
                                </div>
                                <div className="mt-1 text-emerald-100/70">
                                  {files.length} file
                                  {files.length === 1 ? "" : "s"} attached.
                                </div>
                              </div>
                              <div className="space-y-1">
                                {files.slice(0, 3).map((file, index) => (
                                  <a
                                    key={file.id || `${file.file_url}-${index}`}
                                    href={file.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block max-w-[220px] truncate rounded-lg bg-white/10 px-2 py-1 text-xs font-bold text-white hover:bg-white/20"
                                    title={
                                      file.file_name ||
                                      `Attachment ${index + 1}`
                                    }
                                  >
                                    <FileText className="mr-1 inline h-3 w-3" />
                                    {file.file_name ||
                                      `Attachment ${index + 1}`}
                                    {file.file_size
                                      ? ` (${formatFileSize(file.file_size)})`
                                      : ""}
                                  </a>
                                ))}
                                {files.length > 3 && (
                                  <p className="text-xs text-white/40">
                                    +{files.length - 3} more file
                                    {files.length - 3 === 1 ? "" : "s"}
                                  </p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-white/30">
                              NOT UPLOAD YET
                            </span>
                          )}
                        </ColumnCell>

                        <ColumnCell
                          column="finance"
                          className="min-w-[260px] p-3 align-top"
                        >
                          <div className="space-y-2">
                            <Badge
                              className={financeNoteBadgeClass(financeStatus)}
                            >
                              {financeNoteStatusLabel(financeStatus)}
                            </Badge>
                            {item.finance_note && (
                              <p className="line-clamp-3 rounded-xl bg-black/20 px-3 py-2 text-xs text-white/65 ring-1 ring-white/10">
                                {item.finance_note}
                              </p>
                            )}
                            {item.finance_note_updated_by && (
                              <p className="text-[11px] font-semibold text-white/45">
                                By {item.finance_note_updated_by}
                              </p>
                            )}
                            {item.finance_note_updated_at && (
                              <p className="text-[11px] font-semibold text-white/45">
                                {formatDate(item.finance_note_updated_at)}
                              </p>
                            )}
                            <div className="rounded-xl bg-black/20 p-2 ring-1 ring-white/10">
                              <label className="mb-1 block text-[11px] font-bold text-white/50">
                                Update finance query
                              </label>
                              <select
                                value={financeDraft.status}
                                disabled={paymentActionsLocked}
                                onChange={(event) =>
                                  setFinanceDraftStatus(
                                    item,
                                    event.target.value as FinanceNoteStatus,
                                  )
                                }
                                className="w-full rounded-lg bg-black/30 px-2 py-2 text-xs font-bold text-white outline-none ring-1 ring-white/10 focus:ring-cyan-300/40"
                              >
                                {financeNoteOptions.map((option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                    className="bg-[#11111f] text-white"
                                  >
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <textarea
                                value={financeDraft.note}
                                disabled={paymentActionsLocked}
                                onChange={(event) =>
                                  setFinanceDraftNote(item, event.target.value)
                                }
                                placeholder="Add finance note..."
                                className="mt-2 min-h-16 w-full rounded-lg bg-black/30 px-2 py-2 text-xs text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-cyan-300/40"
                              />
                              <button
                                type="button"
                                disabled={
                                  paymentActionsLocked ||
                                  financeNoteUpdatingId === item.id ||
                                  !financeNoteChanged
                                }
                                onClick={() =>
                                  runTransactionAction(item, () =>
                                    saveFinanceDraft(item),
                                  )
                                }
                                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500/15 px-3 py-2 text-xs font-black text-cyan-100 ring-1 ring-cyan-300/20 hover:bg-cyan-500/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/25 disabled:ring-white/5 disabled:opacity-60 disabled:grayscale disabled:hover:bg-white/5"
                              >
                                {financeNoteUpdatingId === item.id && (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                )}{" "}
                                Save finance note
                              </button>
                            </div>
                          </div>
                        </ColumnCell>

                        <ColumnCell
                          column="checked"
                          className="min-w-[210px] p-3 align-top"
                        >
                          {renderCheckedCell(item)}
                        </ColumnCell>

                        <ColumnCell
                          column="actions"
                          className="sticky right-0 z-10 bg-[#11111f] p-3 text-right align-top shadow-[-12px_0_18px_rgba(0,0,0,0.35)]"
                        >
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={paymentActionsLocked}
                              onClick={() => setDetailsItem(item)}
                              className="inline-flex items-center justify-center rounded-xl bg-white/10 p-2 text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                              title={paymentActionLockReason || "View details"}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={paymentActionsLocked}
                              onClick={() =>
                                runTransactionAction(item, () =>
                                  onEditTransaction(item),
                                )
                              }
                              className="inline-flex items-center justify-center rounded-xl bg-sky-500/15 p-2 text-sky-200 hover:bg-sky-500/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/25 disabled:ring-white/5 disabled:opacity-60 disabled:grayscale disabled:hover:bg-white/5"
                              title={
                                paymentActionLockReason || "Edit transaction"
                              }
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={paymentActionsLocked || deleting}
                              onClick={() =>
                                runTransactionAction(item, () =>
                                  onHideTransaction(item.id),
                                )
                              }
                              className="inline-flex items-center justify-center rounded-xl bg-red-500/15 p-2 text-red-200 hover:bg-red-500/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/25 disabled:ring-white/5 disabled:opacity-60 disabled:grayscale disabled:hover:bg-white/5"
                              title={
                                paymentActionLockReason || "Hide transaction"
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </ColumnCell>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {detailsItem && (
        <div className="fixed inset-0 z-[999] flex justify-end bg-black/70 backdrop-blur-sm">
          <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-[#10101f] p-5 shadow-2xl shadow-black">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-white/40">
                  Transaction details
                </p>
                <h3 className="mt-1 break-words text-2xl font-black text-white">
                  {detailsItem.title}
                </h3>
                <p className="mt-1 text-sm text-white/45">
                  {detailsItem.transaction_reference || "No reference"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailsItem(null)}
                className="rounded-2xl bg-white/10 p-3 text-white hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-xs font-black text-white/40">Date</p>
                <p className="mt-1 font-bold text-white">
                  {none(detailsItem.transaction_date)}
                </p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-xs font-black text-white/40">Amount</p>
                <p className="mt-1 font-bold text-white">
                  {money(detailsItem.amount_pence)}
                </p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-xs font-black text-white/40">Type</p>
                <p className="mt-1 font-bold text-white">
                  {detailsItem.type === "income" ? "Money In" : "Money Out"}
                </p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-xs font-black text-white/40">Payment</p>
                <p className="mt-1 font-bold text-white">
                  {detailsItem.payment_method || "None"}
                </p>
              </div>
              <div className="rounded-2xl bg-pink-500/10 p-4 ring-1 ring-pink-300/20">
                <p className="text-xs font-black text-pink-100/70">
                  Budget tracker
                </p>
                <div className="mt-2">
                  <BudgetBadge item={detailsItem} />
                </div>
              </div>
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-xs font-black text-white/40">Bank</p>
                <p className="mt-1 font-bold text-white">
                  {bankReconciliationLabel(
                    detailsItem.bank_reconciliation_status || "unmatched",
                  )}
                </p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-xs font-black text-white/40">Checked</p>
                <p className="mt-1 font-bold text-white">
                  {detailsItem.checked_at
                    ? `Checked by ${getCheckedByDisplayName(detailsItem)}`
                    : "Not checked"}
                </p>
              </div>
            </div>

            {isTransactionLocked(detailsItem) && (
              <div className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm font-bold text-red-100">
                {getTransactionLockReason(detailsItem)}
              </div>
            )}

            {detailsItem.description && (
              <div className="mt-4 rounded-2xl bg-white/5 p-4">
                <p className="text-xs font-black text-white/40">Description</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/70">
                  {detailsItem.description}
                </p>
              </div>
            )}
            {detailsItem.sponsorship_note && (
              <div className="mt-4 rounded-2xl bg-amber-500/10 p-4 ring-1 ring-amber-300/20">
                <p className="text-xs font-black text-amber-100/70">
                  Funding note
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-amber-100/80">
                  {detailsItem.sponsorship_note}
                </p>
              </div>
            )}
            {detailsItem.finance_note && (
              <div className="mt-4 rounded-2xl bg-cyan-500/10 p-4 ring-1 ring-cyan-300/20">
                <p className="text-xs font-black text-cyan-100/70">
                  Finance note
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-cyan-100/80">
                  {detailsItem.finance_note}
                </p>
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isTransactionLocked(detailsItem)}
                onClick={() =>
                  runTransactionAction(detailsItem, () =>
                    onEditTransaction(detailsItem),
                  )
                }
                className="rounded-xl bg-sky-500/15 px-4 py-3 text-sm font-black text-sky-100 ring-1 ring-sky-300/20 hover:bg-sky-500/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/25 disabled:ring-white/5 disabled:opacity-60 disabled:grayscale disabled:hover:bg-white/5"
                title={
                  getTransactionLockReason(detailsItem) || "Edit transaction"
                }
              >
                Edit transaction
              </button>
              <button
                type="button"
                disabled={isTransactionLocked(detailsItem)}
                onClick={() =>
                  runTransactionAction(detailsItem, () =>
                    onMarkTransactionChecked(detailsItem),
                  )
                }
                className="rounded-xl bg-emerald-500/15 px-4 py-3 text-sm font-black text-emerald-100 ring-1 ring-emerald-300/20 hover:bg-emerald-500/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/25 disabled:ring-white/5 disabled:opacity-60 disabled:grayscale disabled:hover:bg-white/5"
                title={
                  getTransactionLockReason(detailsItem) ||
                  (detailsItem.checked_at ? "Undo checked" : "Mark checked")
                }
              >
                {detailsItem.checked_at ? "Undo checked" : "Mark checked"}
              </button>
              <button
                type="button"
                onClick={() => setDetailsItem(null)}
                className="rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/20"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
