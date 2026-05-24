"use client";

import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useUser } from "@clerk/nextjs";
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
  setFilter: Dispatch<SetStateAction<"all" | "income" | "expense" | "sponsorship" | "personal">>;

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
  onTogglePersonalFundsRepaid: (item: Transaction, proofFiles?: File[]) => void | Promise<void>;
  onMarkTransactionChecked: (item: Transaction) => void | Promise<void>;
  onUpdateBankReconciliationStatus: (
    item: Transaction,
    status: BankReconciliationStatus,
    note?: string
  ) => void | Promise<void>;
  onUpdateFinanceNote: (item: Transaction, status: FinanceNoteStatus, note?: string) => void | Promise<void>;

  /**
   * Receipt expiry/check reminder.
   * Expenses with no receipt older than this number of days will be flagged.
   * Default is 7 days.
   */
  receiptReminderDays?: number;
};

type SortKey =
  | "date"
  | "title"
  | "type"
  | "amount"
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
  | "funding";

type ColumnKey =
  | "select"
  | "reference"
  | "date"
  | "title"
  | "type"
  | "amount"
  | "funding"
  | "fundingNote"
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

const columnOptions: { key: ColumnKey; label: string; locked?: boolean }[] = [
  { key: "select", label: "Select", locked: true },
  { key: "reference", label: "Reference" },
  { key: "date", label: "Date" },
  { key: "title", label: "Title", locked: true },
  { key: "type", label: "Type" },
  { key: "amount", label: "Amount", locked: true },
  { key: "funding", label: "Funding" },
  { key: "fundingNote", label: "Funding Note" },
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
  funding: true,
  fundingNote: false,
  personal: true,
  paidBy: false,
  repayment: true,
  payment: true,
  bank: true,
  receipt: true,
  finance: true,
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
  if (type === "grant") return "bg-emerald-500/20 text-emerald-100 ring-emerald-300/20";
  if (type === "loan") return "bg-blue-500/20 text-blue-100 ring-blue-300/20";
  if (type === "other") return "bg-purple-500/20 text-purple-100 ring-purple-300/20";
  return "bg-amber-500/20 text-amber-100 ring-amber-300/20";
}

function bankReconciliationLabel(status?: string | null) {
  if (status === "matched") return "Matched";
  if (status === "needs_review") return "Needs review";
  if (status === "ignored") return "Ignored";
  return "Unmatched";
}

function bankReconciliationBadgeClass(status?: string | null) {
  if (status === "matched") return "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20";
  if (status === "needs_review") return "bg-amber-500/15 text-amber-100 ring-amber-300/20";
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
  if (status === "waiting_for_receipt") return "bg-amber-500/15 text-amber-100 ring-amber-300/20";
  if (status === "ask_sponsor") return "bg-purple-500/15 text-purple-100 ring-purple-300/20";
  if (status === "bank_query") return "bg-red-500/15 text-red-100 ring-red-300/20";
  if (status === "resolved") return "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20";
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
  return String(value || "").trim().toLowerCase();
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

  return row.checked_by_name || row.checked_by || nameFromEmail(row.checked_by_email) || "Unknown admin";
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

  if (checkedByUserId && currentUserId) return checkedByUserId === currentUserId;
  if (checkedByEmail && currentUserEmail) return normaliseText(checkedByEmail) === normaliseText(currentUserEmail);
  if (checkedByName && currentUserName) return normaliseText(checkedByName) === normaliseText(currentUserName);

  return false;
}

function transactionMonthKey(item: Transaction) {
  const rawDate = String(item.transaction_date || item.created_at || "").trim();
  if (!rawDate) return "";
  return rawDate.slice(0, 7);
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

function receiptDueDate(item: Transaction, reminderDays = DEFAULT_RECEIPT_REMINDER_DAYS) {
  const date = parseTransactionDate(item);

  if (!date) return null;

  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + Math.max(1, Number(reminderDays || DEFAULT_RECEIPT_REMINDER_DAYS)));

  return nextDate;
}

function receiptDueDateLabel(item: Transaction, reminderDays = DEFAULT_RECEIPT_REMINDER_DAYS) {
  const date = receiptDueDate(item, reminderDays);

  if (!date) return "No due date";

  return formatDate(date.toISOString());
}

function receiptOverdueDays(item: Transaction, reminderDays = DEFAULT_RECEIPT_REMINDER_DAYS) {
  return Math.max(0, transactionAgeDays(item) - Math.max(1, Number(reminderDays || DEFAULT_RECEIPT_REMINDER_DAYS)));
}

function isReceiptOverdue(item: Transaction, reminderDays = DEFAULT_RECEIPT_REMINDER_DAYS) {
  return hasMissingReceiptWarning(item) && transactionAgeDays(item) >= Math.max(1, Number(reminderDays || DEFAULT_RECEIPT_REMINDER_DAYS));
}

function receiptReminderLabel(item: Transaction, reminderDays = DEFAULT_RECEIPT_REMINDER_DAYS) {
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
    isSpecialSearch: isUncheckedSearch || isCheckedSearch || isReceiptOverdueSearch,
  };
}

function compareText(a: unknown, b: unknown) {
  return cleanText(a).localeCompare(cleanText(b), "en-GB", { sensitivity: "base" });
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
    item.personal_funds_name,
    item.bank_reconciliation_status,
    item.bank_reconciliation_note,
    item.finance_note_status,
    item.finance_note,
    item.checked_at ? "checked" : "unchecked uncheck not checked notchecked",
    item.checked_by,
    (item as any).checked_by_name,
    (item as any).checked_by_email,
    missingReceipt ? "missing receipt no receipt receipt missing proof missing" : "receipt uploaded proof attached",
    isReceiptOverdue(item) ? RECEIPT_OVERDUE_SEARCH_WORDS : "receipt not overdue",
    files.map((file) => file.file_name).join(" "),
    String(item.amount_pence || ""),
    money(item.amount_pence),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function transactionMatchesQuickFilter(item: Transaction, quickFilter: QuickFilter, receiptReminderDays = DEFAULT_RECEIPT_REMINDER_DAYS) {
  if (quickFilter === "all") return true;
  if (quickFilter === "unchecked") return !item.checked_at;
  if (quickFilter === "checked") return Boolean(item.checked_at);
  if (quickFilter === "missing_receipts") return hasMissingReceiptWarning(item);
  if (quickFilter === "receipt_overdue") return isReceiptOverdue(item, receiptReminderDays);
  if (quickFilter === "finance_queries") return Boolean(item.finance_note_status && item.finance_note_status !== "none");
  if (quickFilter === "bank_unmatched") return !item.bank_reconciliation_status || item.bank_reconciliation_status === "unmatched";
  if (quickFilter === "personal_unpaid") return isPersonalFundsTransaction(item) && !item.personal_funds_repaid;
  if (quickFilter === "funding") return isSponsorshipTransaction(item);
  return true;
}

function exportSelectedTransactionsCsv(items: Transaction[]) {
  const headers = [
    "Reference",
    "Date",
    "Title",
    "Type",
    "Amount",
    "Payment Method",
    "Funding",
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
    item.payment_method || "",
    item.sponsor_name || "",
    item.personal_funds_name || "",
    item.bank_reconciliation_status || "unmatched",
    item.finance_note_status || "none",
    isReceiptOverdue(item) ? receiptReminderLabel(item) : hasMissingReceiptWarning(item) ? "Missing receipt" : "Receipt uploaded",
    item.checked_at ? `Checked by ${getCheckedByDisplayName(item)}` : "Not checked",
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
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

function Badge({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`inline-flex rounded-2xl px-3 py-1 text-xs font-bold ring-1 ${className}`}>{children}</span>;
}

function WarningBadges({ item, receiptReminderDays = DEFAULT_RECEIPT_REMINDER_DAYS }: { item: Transaction; receiptReminderDays?: number }) {
  const badges: ReactNode[] = [];

  if (!item.checked_at) {
    badges.push(
      <span key="unchecked" className="inline-flex items-center gap-1 rounded-xl border border-amber-300/20 bg-amber-500/10 px-2 py-1 text-[11px] font-black text-amber-100">
        <ShieldAlert className="h-3 w-3" />
        Unchecked
      </span>
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
      </span>
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
      </span>
    );
  }

  if (isPersonalFundsTransaction(item) && !item.personal_funds_repaid) {
    badges.push(
      <span key="personal" className="inline-flex items-center gap-1 rounded-xl border border-orange-300/20 bg-orange-500/10 px-2 py-1 text-[11px] font-black text-orange-100">
        <AlertTriangle className="h-3 w-3" />
        Payback due
      </span>
    );
  }

  if (item.finance_note_status && item.finance_note_status !== "none") {
    badges.push(
      <span key="finance" className="inline-flex items-center gap-1 rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-2 py-1 text-[11px] font-black text-cyan-100">
        <FileText className="h-3 w-3" />
        Finance query
      </span>
    );
  }

  if (badges.length === 0) return null;

  return <div className="mt-2 flex flex-wrap gap-1">{badges}</div>;
}

function SortButton({ label, sortKey, activeSortKey, sortDirection, onSort }: {
  label: string;
  sortKey: SortKey;
  activeSortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
}) {
  const active = sortKey === activeSortKey;

  return (
    <button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1 text-left font-black text-white/70 hover:text-white">
      {label}
      {active ? sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" /> : null}
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
  receiptReminderDays = DEFAULT_RECEIPT_REMINDER_DAYS,
}: MoneyTransactionsTableProps) {
  const { user } = useUser();

  const currentUserId = user?.id || null;
  const currentUserEmail = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || null;
  const currentUserName = user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || nameFromEmail(currentUserEmail) || null;

  const receiptReminderDaysSafe = Math.max(1, Number(receiptReminderDays || DEFAULT_RECEIPT_REMINDER_DAYS));

  const [repaymentProofFiles, setRepaymentProofFiles] = useState<Record<string, File[]>>({});
  const [financeNoteDrafts, setFinanceNoteDrafts] = useState<Record<string, { status: FinanceNoteStatus; note: string }>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [localReceiptReminderDays, setLocalReceiptReminderDays] = useState(receiptReminderDaysSafe);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [detailsItem, setDetailsItem] = useState<Transaction | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(defaultVisibleColumns);

  const topActionButtonBase =
    "inline-flex min-w-[135px] flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ring-1 transition disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none";

  const activeReceiptReminderDays = Math.max(1, Number(localReceiptReminderDays || receiptReminderDaysSafe));

  function getFundingForTransaction(item: Transaction) {
    if (!isSponsorshipTransaction(item)) return null;

    return (
      displaySponsors.find((sponsor) => {
        const sponsorName = String(sponsor.sponsor_name || "").trim().toLowerCase();
        const itemSponsorName = String(item.sponsor_name || "").trim().toLowerCase();

        return sponsor.id === item.sponsor_id || Boolean(sponsorName && itemSponsorName && sponsorName === itemSponsorName);
      }) || null
    );
  }

  function getFinanceDraft(item: Transaction) {
    return financeNoteDrafts[item.id] || { status: item.finance_note_status || "none", note: item.finance_note || "" };
  }

  function setFinanceDraftStatus(item: Transaction, status: FinanceNoteStatus) {
    const currentDraft = getFinanceDraft(item);
    setFinanceNoteDrafts((prev) => ({ ...prev, [item.id]: { ...currentDraft, status } }));
  }

  function setFinanceDraftNote(item: Transaction, note: string) {
    const currentDraft = getFinanceDraft(item);
    setFinanceNoteDrafts((prev) => ({ ...prev, [item.id]: { ...currentDraft, note } }));
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
    setSortDirection(nextKey === "date" || nextKey === "amount" ? "desc" : "asc");
  }

  const visibleTransactions = useMemo(() => {
    const { cleanSearch, isUncheckedSearch, isCheckedSearch, isReceiptOverdueSearch, isSpecialSearch } = isSpecialCheckedSearch(searchTerm);

    const baseItems = isSpecialSearch ? yearTransactions : filteredTransactions;

    const filtered = baseItems.filter((item) => {
      const matchesMonth = selectedViewMonth === "all" || transactionMonthKey(item) === selectedViewMonth;

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
            ? !paymentMethodFilterOptions.includes(item.payment_method || "Other Types")
            : item.payment_method === selectedPaymentMethod;

      const matchesSponsor =
        selectedSponsorId === "all"
          ? true
          : isSponsorshipTransaction(item) && Boolean(item.sponsor_id === selectedSponsorId || getFundingForTransaction(item)?.id === selectedSponsorId);

      const matchesCheckedSearch = isUncheckedSearch ? !item.checked_at : isCheckedSearch ? Boolean(item.checked_at) : true;
      const matchesReceiptOverdueSearch = isReceiptOverdueSearch ? isReceiptOverdue(item, activeReceiptReminderDays) : true;
      const matchesQuickFilter = transactionMatchesQuickFilter(item, quickFilter, activeReceiptReminderDays);
      const matchesTextSearch = !cleanSearch || isSpecialSearch || getRowSearchText(item).includes(cleanSearch);

      return matchesMonth && matchesType && matchesPaymentMethod && matchesSponsor && matchesCheckedSearch && matchesReceiptOverdueSearch && matchesQuickFilter && matchesTextSearch;
    });

    return [...filtered].sort((a, b) => {
      let result = 0;

      if (sortKey === "date") result = compareText(a.transaction_date || a.created_at, b.transaction_date || b.created_at);
      if (sortKey === "title") result = compareText(a.title, b.title);
      if (sortKey === "type") result = compareText(a.type, b.type);
      if (sortKey === "amount") result = numberValue(a.amount_pence) - numberValue(b.amount_pence);
      if (sortKey === "funding") result = compareText(a.sponsor_name, b.sponsor_name);
      if (sortKey === "payment") result = compareText(a.payment_method, b.payment_method);
      if (sortKey === "checked") result = Number(Boolean(a.checked_at)) - Number(Boolean(b.checked_at));
      if (sortKey === "bank") result = compareText(a.bank_reconciliation_status || "unmatched", b.bank_reconciliation_status || "unmatched");
      if (sortKey === "receipt") {
        const aOverdue = isReceiptOverdue(a, activeReceiptReminderDays) ? 2 : hasMissingReceiptWarning(a) ? 1 : 0;
        const bOverdue = isReceiptOverdue(b, activeReceiptReminderDays) ? 2 : hasMissingReceiptWarning(b) ? 1 : 0;
        result = aOverdue - bOverdue;
      }
      if (sortKey === "finance") result = compareText(a.finance_note_status || "none", b.finance_note_status || "none");

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

  const visibleIds = useMemo(() => visibleTransactions.map((item) => item.id).filter(Boolean), [visibleTransactions]);
  const selectedTransactions = useMemo(() => visibleTransactions.filter((item) => selectedIds.has(item.id)), [visibleTransactions, selectedIds]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  const totals = useMemo(() => {
    return visibleTransactions.reduce(
      (acc, item) => {
        if (item.type === "income") acc.income += Number(item.amount_pence || 0);
        if (item.type === "expense") acc.expense += Number(item.amount_pence || 0);
        if (!item.checked_at) acc.unchecked += 1;
        if (hasMissingReceiptWarning(item)) acc.missingReceipts += 1;
        if (isReceiptOverdue(item, activeReceiptReminderDays)) acc.overdueReceipts += 1;
        if (isPersonalFundsTransaction(item) && !item.personal_funds_repaid) acc.unpaidPersonal += Number(item.amount_pence || 0);
        return acc;
      },
      { income: 0, expense: 0, unchecked: 0, missingReceipts: 0, overdueReceipts: 0, unpaidPersonal: 0 }
    );
  }, [visibleTransactions, activeReceiptReminderDays]);

  function toggleSelect(id: string) {
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

  async function bulkAction(label: string, action: (item: Transaction) => Promise<void> | void) {
    if (selectedTransactions.length === 0) return;

    try {
      setBulkBusy(true);
      setToast(null);

      for (const item of selectedTransactions) {
        await action(item);
      }

      setToast({ type: "success", message: `${label} completed for ${selectedTransactions.length} selected transaction${selectedTransactions.length === 1 ? "" : "s"}.` });
      setSelectedIds(new Set());
    } catch (error) {
      console.error(error);
      setToast({ type: "error", message: `${label} failed. Check console/server logs for details.` });
    } finally {
      setBulkBusy(false);
    }
  }

  function ColumnCell({ column, children, className = "" }: { column: ColumnKey; children: ReactNode; className?: string }) {
    if (!visibleColumns[column]) return null;
    return <td className={className}>{children}</td>;
  }

  function ColumnHeader({ column, children, className = "" }: { column: ColumnKey; children: ReactNode; className?: string }) {
    if (!visibleColumns[column]) return null;
    return <th className={className}>{children}</th>;
  }

  function renderCheckedCell(item: Transaction) {
    if (item.checked_at) {
      const checkedByName = getCheckedByDisplayName(item);
      const canUncheck = canCurrentAdminUncheckTransaction({ item, currentUserId, currentUserEmail, currentUserName });

      return (
        <div className="space-y-2">
          <div className="rounded-2xl bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-200 ring-1 ring-emerald-300/20">
            <div>Checked</div>
            <div className="mt-1 text-[11px] font-semibold text-emerald-100/70">By {checkedByName}</div>
            <div className="mt-1 text-[11px] font-semibold text-emerald-100/70">{formatDate(item.checked_at)}</div>
          </div>

          {canUncheck ? (
            <button type="button" disabled={checkingId === item.id} onClick={() => onMarkTransactionChecked(item)} className="w-full rounded-xl bg-orange-500/15 px-3 py-2 text-xs font-bold text-orange-200 ring-1 ring-orange-300/20 hover:bg-orange-500/25 disabled:opacity-60">
              {checkingId === item.id ? "Undoing..." : "Undo checked"}
            </button>
          ) : (
            <div className="rounded-xl bg-white/10 px-3 py-2 text-[11px] font-bold text-white/50 ring-1 ring-white/10" title="Only the admin who marked this transaction as checked can undo it.">
              Only {checkedByName} can uncheck
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="rounded-2xl bg-white/10 px-3 py-2 text-xs font-bold text-white/60 ring-1 ring-white/10">Not checked</div>
        <button type="button" disabled={checkingId === item.id} onClick={() => onMarkTransactionChecked(item)} className="w-full rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-200 ring-1 ring-emerald-300/20 hover:bg-emerald-500/25 disabled:opacity-60">
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

    return (
      <div key={item.id} className={`rounded-2xl border border-white/10 bg-black/20 p-4 ${receiptOverdue ? "ring-2 ring-red-300/30" : missingReceipt ? "ring-1 ring-red-300/20" : ""}`}>
        <div className="flex items-start justify-between gap-3">
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="mt-1 h-4 w-4 rounded border-white/20 bg-black/30" />
            <div>
              <p className="break-words font-black text-white">{item.title}</p>
              <p className="mt-1 text-xs text-white/45">{item.transaction_reference || "Pending reference"}</p>
            </div>
          </label>

          <div className={`shrink-0 rounded-xl px-3 py-2 text-sm font-black ring-1 ${item.type === "income" ? "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20" : "bg-red-500/15 text-red-100 ring-red-300/20"}`}>
            {money(item.amount_pence)}
          </div>
        </div>

        <WarningBadges item={item} receiptReminderDays={activeReceiptReminderDays} />

        {receiptOverdue && (
          <div className="mt-3 rounded-xl border border-red-300/20 bg-red-500/10 p-3 text-xs font-bold leading-5 text-red-100">
            {receiptReminderLabel(item, activeReceiptReminderDays)}
          </div>
        )}

        <div className="mt-4 grid gap-2 text-sm text-white/65 sm:grid-cols-2">
          <div>Date: <strong className="text-white">{none(item.transaction_date)}</strong></div>
          <div>Type: <strong className="text-white">{item.type === "income" ? "Money In" : "Money Out"}</strong></div>
          <div>Payment: <strong className="text-white">{hasFunding ? "Funding Money" : item.payment_method || "None"}</strong></div>
          <div>Status: <strong className="text-white">{item.checked_at ? "Checked" : "Not checked"}</strong></div>
          {isPersonal && <div>Personal funds: <strong className="text-white">{item.personal_funds_repaid ? "Paid back" : "Not paid back"}</strong></div>}
          {hasFunding && <div>Funding: <strong className="text-white">{item.sponsor_name || "Funding record"}</strong></div>}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setDetailsItem(item)} className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20">
            <Eye className="mr-1 inline h-3 w-3" /> Details
          </button>
          <button type="button" onClick={() => onEditTransaction(item)} className="rounded-xl bg-sky-500/15 px-3 py-2 text-xs font-bold text-sky-200 hover:bg-sky-500/25">
            <Pencil className="mr-1 inline h-3 w-3" /> Edit
          </button>
          <button type="button" onClick={() => onMarkTransactionChecked(item)} disabled={checkingId === item.id} className="rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50">
            <CheckCircle2 className="mr-1 inline h-3 w-3" /> {item.checked_at ? "Undo" : "Check"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-bold">Transactions</h2>
          <p className="text-sm text-white/50">
            {visibleTransactions.length} transaction{visibleTransactions.length === 1 ? "" : "s"} showing for {selectedViewMonth === "all" ? selectedYear : monthNameFromKey(selectedViewMonth)}
          </p>
          <p className="mt-1 text-xs text-white/40">Sorted by {sortKey} ({sortDirection}). Selected: {selectedTransactions.length}</p>
        </div>

        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-3 2xl:flex 2xl:flex-wrap 2xl:justify-end">
          <select value={selectedPrintMonth} onChange={(event) => setSelectedPrintMonth(event.target.value)} className="min-w-0 rounded-xl bg-black/30 px-3 py-2 text-sm font-bold text-white outline-none ring-1 ring-sky-300/20 focus:ring-sky-300/50" title="Choose print/export month">
            {printMonthOptions.map((month) => (
              <option key={month.key} value={month.key} className="bg-[#11111f] text-white">Print / Export {month.label} ({month.count})</option>
            ))}
          </select>

          <button type="button" onClick={onPrint} disabled={printTransactionsList.length === 0} className={`${topActionButtonBase} bg-sky-500/15 text-sky-200 ring-sky-300/20 hover:bg-sky-500/25`}>
            <Printer className="h-4 w-4" /> {selectedPrintMonth === "all" ? "Print Year" : `Print ${monthNameFromKey(selectedPrintMonth).split(" ")[0]}`}
          </button>

          <button type="button" onClick={onExportExcel} disabled={printTransactionsList.length === 0} className={`${topActionButtonBase} bg-emerald-500/15 text-emerald-200 ring-emerald-300/20 hover:bg-emerald-500/25`}>
            <Download className="h-4 w-4" /> {selectedPrintMonth === "all" ? "Export Excel" : `Export ${monthNameFromKey(selectedPrintMonth).split(" ")[0]}`}
          </button>

          <button type="button" onClick={onExportYearlyReport} disabled={yearTransactions.length === 0} className={`${topActionButtonBase} bg-purple-500/15 text-purple-200 ring-purple-300/20 hover:bg-purple-500/25`}>
            <FileText className="h-4 w-4" /> Yearly Report
          </button>

          <button type="button" onClick={onOpenDeleteYear} disabled={yearTransactions.length === 0 || deletingYear} className={`${topActionButtonBase} bg-orange-500/15 text-orange-200 ring-orange-300/20 hover:bg-orange-500/25`}>
            <Trash2 className="h-4 w-4" /> Delete {selectedYear}
          </button>

          <button type="button" onClick={onOpenDeleteAll} disabled={transactions.length === 0 || deletingAll} className={`${topActionButtonBase} bg-red-500/15 text-red-200 ring-red-300/20 hover:bg-red-500/25`}>
            <Trash2 className="h-4 w-4" /> Delete All
          </button>
        </div>
      </div>

      {toast && (
        <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-bold ${toast.type === "success" ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100" : "border-red-300/20 bg-red-500/10 text-red-100"}`}>
          {toast.message}
        </div>
      )}

      <div className="mb-4 grid gap-3 xl:grid-cols-[1fr_auto]">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <button type="button" onClick={() => setFiltersOpen((prev) => !prev)} className="flex w-full items-center justify-between text-left text-sm font-black text-white">
            <span className="inline-flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" /> Filters and search</span>
            {filtersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {filtersOpen && (
            <div className="mt-3 space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-white/35" />
                <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={`Search ${selectedViewMonth === "all" ? selectedYear : monthNameFromKey(selectedViewMonth)} by reference, title, funding, checked, unchecked, missing receipt, bank, amount...`} className="w-full rounded-xl bg-black/30 py-3 pl-10 pr-3 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/40 focus:ring-pink-300/40" />
              </div>

              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                <select value={selectedViewMonth} onChange={(event) => { setSelectedViewMonth(event.target.value); setSearchTerm(""); }} className="rounded-xl bg-black/30 p-3 text-sm font-bold text-white outline-none ring-1 ring-sky-300/20">
                  {printMonthOptions.map((month) => <option key={month.key} value={month.key} className="bg-[#11111f] text-white">View {month.label} ({month.count})</option>)}
                </select>

                <select value={selectedPaymentMethod} onChange={(event) => setSelectedPaymentMethod(event.target.value)} className="rounded-xl bg-black/30 p-3 text-sm font-bold text-white outline-none ring-1 ring-emerald-300/20">
                  {paymentMethodFilterOptions.map((method) => <option key={method} value={method} className="bg-[#11111f] text-white">{method === "all" ? "All payment methods" : method}</option>)}
                </select>

                <select value={selectedSponsorId} onChange={(event) => { const nextSponsorId = event.target.value; setSelectedSponsorId(nextSponsorId); if (nextSponsorId !== "all") setFilter("sponsorship"); }} className="rounded-xl bg-black/30 p-3 text-sm text-white outline-none ring-1 ring-amber-300/20">
                  <option className="bg-[#11111f] text-white" value="all">All funding records</option>
                  {displaySponsors.map((sponsor) => <option className="bg-[#11111f] text-white" key={sponsor.id} value={sponsor.id}>{fundingTypeLabel(sponsor.funding_type)} — {sponsor.sponsor_name}</option>)}
                </select>

                <select value={quickFilter} onChange={(event) => setQuickFilter(event.target.value as QuickFilter)} className="rounded-xl bg-black/30 p-3 text-sm font-bold text-white outline-none ring-1 ring-white/10">
                  <option className="bg-[#11111f] text-white" value="all">Quick filter: All</option>
                  <option className="bg-[#11111f] text-white" value="unchecked">Unchecked only</option>
                  <option className="bg-[#11111f] text-white" value="checked">Checked only</option>
                  <option className="bg-[#11111f] text-white" value="missing_receipts">Missing receipts</option>
                  <option className="bg-[#11111f] text-white" value="receipt_overdue">Receipt overdue</option>
                  <option className="bg-[#11111f] text-white" value="finance_queries">Finance queries</option>
                  <option className="bg-[#11111f] text-white" value="bank_unmatched">Bank unmatched</option>
                  <option className="bg-[#11111f] text-white" value="personal_unpaid">Personal funds unpaid</option>
                  <option className="bg-[#11111f] text-white" value="funding">Funding linked</option>
                </select>

                <select
                  value={activeReceiptReminderDays}
                  onChange={(event) => setLocalReceiptReminderDays(Number(event.target.value))}
                  className="rounded-xl bg-black/30 p-3 text-sm font-bold text-white outline-none ring-1 ring-red-300/20"
                  title="Receipt reminder days"
                >
                  {receiptReminderDayOptions.map((days) => (
                    <option key={days} className="bg-[#11111f] text-white" value={days}>
                      Receipt overdue after {days} day{days === 1 ? "" : "s"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap gap-2">
                {(["all", "income", "expense", "personal", "sponsorship"] as const).map((item) => (
                  <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded-xl px-4 py-2 text-sm font-bold ${filter === item ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"}`}>
                    {item === "all" ? "All" : item === "income" ? "Money In" : item === "expense" ? "Money Out" : item === "personal" ? "Personal Funds" : "Funding"}
                  </button>
                ))}

                <button type="button" onClick={() => { setSearchTerm(""); setFilter("all"); setSelectedSponsorId("all"); setSelectedPaymentMethod("all"); setQuickFilter("all"); setLocalReceiptReminderDays(receiptReminderDaysSafe); }} className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20">
                  Clear all
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="relative rounded-2xl border border-white/10 bg-black/20 p-3">
          <button type="button" onClick={() => setColumnsOpen((prev) => !prev)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/20 xl:w-auto">
            <Columns3 className="h-4 w-4" /> Columns
          </button>

          {columnsOpen && (
            <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-2xl border border-white/10 bg-[#11111f] p-3 shadow-2xl shadow-black">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-black text-white">Show columns</p>
                <button type="button" onClick={() => setColumnsOpen(false)} className="rounded-lg bg-white/10 p-1 text-white"><X className="h-4 w-4" /></button>
              </div>
              <div className="grid gap-2">
                {columnOptions.map((column) => (
                  <label key={column.key} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm font-bold text-white/75">
                    <input type="checkbox" checked={visibleColumns[column.key]} disabled={column.locked} onChange={() => setVisibleColumns((prev) => ({ ...prev, [column.key]: !prev[column.key] }))} />
                    {column.label}
                    {column.locked && <span className="ml-auto text-[10px] text-white/35">locked</span>}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-2xl bg-emerald-500/10 p-3 ring-1 ring-emerald-300/20"><p className="text-xs font-black text-emerald-100/70">Money In</p><p className="mt-1 text-lg font-black text-white">{money(totals.income)}</p></div>
        <div className="rounded-2xl bg-red-500/10 p-3 ring-1 ring-red-300/20"><p className="text-xs font-black text-red-100/70">Money Out</p><p className="mt-1 text-lg font-black text-white">{money(totals.expense)}</p></div>
        <div className="rounded-2xl bg-sky-500/10 p-3 ring-1 ring-sky-300/20"><p className="text-xs font-black text-sky-100/70">Balance in view</p><p className="mt-1 text-lg font-black text-white">{money(totals.income - totals.expense)}</p></div>
        <div className="rounded-2xl bg-amber-500/10 p-3 ring-1 ring-amber-300/20"><p className="text-xs font-black text-amber-100/70">Unchecked</p><p className="mt-1 text-lg font-black text-white">{totals.unchecked}</p></div>
        <div className="rounded-2xl bg-red-500/10 p-3 ring-1 ring-red-300/20"><p className="text-xs font-black text-red-100/70">Receipt overdue</p><p className="mt-1 text-lg font-black text-white">{totals.overdueReceipts}</p><p className="mt-1 text-[11px] font-bold text-red-100/55">after {activeReceiptReminderDays} days</p></div>
        <div className="rounded-2xl bg-orange-500/10 p-3 ring-1 ring-orange-300/20"><p className="text-xs font-black text-orange-100/70">Unpaid personal</p><p className="mt-1 text-lg font-black text-white">{money(totals.unpaidPersonal)}</p></div>
      </div>

      {selectedTransactions.length > 0 && (
        <div className="sticky top-2 z-20 mb-4 rounded-2xl border border-pink-300/20 bg-[#1b1020]/95 p-3 shadow-2xl shadow-black backdrop-blur">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="text-sm font-bold text-white">
              {selectedTransactions.length} selected
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={bulkBusy} onClick={() => bulkAction("Mark checked", (item) => !item.checked_at ? onMarkTransactionChecked(item) : undefined)} className="rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-black text-emerald-100 ring-1 ring-emerald-300/20 hover:bg-emerald-500/25 disabled:opacity-50">Bulk mark checked</button>
              <button type="button" disabled={bulkBusy} onClick={() => bulkAction("Mark bank matched", (item) => onUpdateBankReconciliationStatus(item, "matched"))} className="rounded-xl bg-sky-500/15 px-3 py-2 text-xs font-black text-sky-100 ring-1 ring-sky-300/20 hover:bg-sky-500/25 disabled:opacity-50">Bulk bank matched</button>
              <button type="button" disabled={bulkBusy} onClick={() => exportSelectedTransactionsCsv(selectedTransactions)} className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white ring-1 ring-white/10 hover:bg-white/20 disabled:opacity-50">Export selected CSV</button>
              <button type="button" disabled={bulkBusy || deleting} onClick={() => bulkAction("Hide selected", (item) => onHideTransaction(item.id))} className="rounded-xl bg-red-500/15 px-3 py-2 text-xs font-black text-red-100 ring-1 ring-red-300/20 hover:bg-red-500/25 disabled:opacity-50">Hide selected</button>
              <button type="button" onClick={() => setSelectedIds(new Set())} className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white hover:bg-white/20">Clear selected</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl bg-white/10" />)}
        </div>
      ) : visibleTransactions.length === 0 ? (
        <div className="rounded-2xl bg-black/20 p-8 text-center text-sm text-white/60">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-white/35" />
          No transactions found for {selectedViewMonth === "all" ? selectedYear : monthNameFromKey(selectedViewMonth)}.
        </div>
      ) : (
        <>
          <div className="grid gap-3 xl:hidden">{visibleTransactions.map(renderMobileCard)}</div>

          <div className="hidden w-full max-w-[calc(100vw-2rem)] overflow-x-auto rounded-2xl border border-white/10 xl:block xl:max-w-full">
            <table className="w-full min-w-[2100px] text-sm">
              <thead className="bg-white/10 text-white/60">
                <tr>
                  <ColumnHeader column="select" className="p-3 text-left"><input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} /></ColumnHeader>
                  <ColumnHeader column="reference" className="p-3 text-left">Reference</ColumnHeader>
                  <ColumnHeader column="date" className="p-3 text-left"><SortButton label="Date" sortKey="date" activeSortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} /></ColumnHeader>
                  <ColumnHeader column="title" className="p-3 text-left"><SortButton label="Title" sortKey="title" activeSortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} /></ColumnHeader>
                  <ColumnHeader column="type" className="p-3 text-left"><SortButton label="Type" sortKey="type" activeSortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} /></ColumnHeader>
                  <ColumnHeader column="amount" className="p-3 text-right"><SortButton label="Amount" sortKey="amount" activeSortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} /></ColumnHeader>
                  <ColumnHeader column="funding" className="p-3 text-left"><SortButton label="Funding" sortKey="funding" activeSortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} /></ColumnHeader>
                  <ColumnHeader column="fundingNote" className="p-3 text-left">Funding Note</ColumnHeader>
                  <ColumnHeader column="personal" className="p-3 text-left">Personal</ColumnHeader>
                  <ColumnHeader column="paidBy" className="p-3 text-left">Paid By</ColumnHeader>
                  <ColumnHeader column="repayment" className="p-3 text-left">Repayment</ColumnHeader>
                  <ColumnHeader column="payment" className="p-3 text-left"><SortButton label="Payment" sortKey="payment" activeSortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} /></ColumnHeader>
                  <ColumnHeader column="bank" className="p-3 text-left"><SortButton label="Bank" sortKey="bank" activeSortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} /></ColumnHeader>
                  <ColumnHeader column="receipt" className="p-3 text-left"><SortButton label="Receipt" sortKey="receipt" activeSortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} /></ColumnHeader>
                  <ColumnHeader column="finance" className="p-3 text-left"><SortButton label="Finance" sortKey="finance" activeSortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} /></ColumnHeader>
                  <ColumnHeader column="checked" className="p-3 text-left"><SortButton label="Checked" sortKey="checked" activeSortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} /></ColumnHeader>
                  <ColumnHeader column="actions" className="sticky right-0 z-10 bg-[#242435] p-3 text-right shadow-[-12px_0_18px_rgba(0,0,0,0.35)]">Action</ColumnHeader>
                </tr>
              </thead>

              <tbody>
                {visibleTransactions.map((item) => {
                  const isPersonal = isPersonalFundsTransaction(item);
                  const hasFunding = isSponsorshipTransaction(item);
                  const fundingRecord = getFundingForTransaction(item);
                  const fundingType = fundingRecord?.funding_type || "sponsor";
                  const fundingLabel = fundingTypeLabel(fundingType);
                  const shortLabel = fundingShortLabel(fundingType);
                  const files = getTransactionFiles(item);
                  const missingReceipt = hasMissingReceiptWarning(item);
                  const receiptOverdue = isReceiptOverdue(item, activeReceiptReminderDays);
                  const proofFiles = repaymentProofFiles[item.id] || [];
                  const bankStatus = item.bank_reconciliation_status || "unmatched";
                  const financeDraft = getFinanceDraft(item);
                  const financeStatus = item.finance_note_status || "none";
                  const financeNoteChanged = financeDraft.status !== financeStatus || financeDraft.note !== (item.finance_note || "");

                  return (
                    <tr key={item.id} className={`border-t border-white/10 ${receiptOverdue ? "bg-red-500/[0.07]" : missingReceipt ? "bg-red-500/[0.03]" : ""}`}>
                      <ColumnCell column="select" className="p-3 align-top"><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} /></ColumnCell>

                      <ColumnCell column="reference" className="whitespace-nowrap p-3 align-top">
                        {item.transaction_reference ? <span className="inline-flex rounded-xl bg-white/10 px-3 py-1 text-xs font-black text-white ring-1 ring-white/10">{item.transaction_reference}</span> : <span className="text-white/40">Pending</span>}
                      </ColumnCell>

                      <ColumnCell column="date" className="whitespace-nowrap p-3 align-top">{none(item.transaction_date)}</ColumnCell>

                      <ColumnCell column="title" className="max-w-[240px] p-3 align-top">
                        <button type="button" onClick={() => setDetailsItem(item)} className="break-words text-left font-semibold text-white hover:text-sky-200">{item.title}</button>
                        {item.description && <p className="mt-1 line-clamp-3 break-words text-xs text-white/50">{item.description}</p>}
                        <WarningBadges item={item} receiptReminderDays={activeReceiptReminderDays} />
                      </ColumnCell>

                      <ColumnCell column="type" className="whitespace-nowrap p-3 align-top">{item.type === "income" ? "Money In" : "Money Out"}</ColumnCell>

                      <ColumnCell column="amount" className="whitespace-nowrap p-3 text-right align-top font-bold">
                        <div>{money(item.amount_pence)}</div>
                        {hasFunding && <div className="mt-1 text-xs font-semibold text-amber-300">{item.type === "income" ? `${fundingLabel} in` : `${shortLabel}-funded spend`}</div>}
                        {isPersonal && item.personal_funds_repaid && <div className="mt-1 text-xs font-semibold text-emerald-300">Taken from balance</div>}
                        {isPersonal && !item.personal_funds_repaid && <div className="mt-1 text-xs font-semibold text-orange-300">Not taken yet</div>}
                      </ColumnCell>

                      <ColumnCell column="funding" className="max-w-[180px] p-3 align-top">
                        {hasFunding ? (
                          <div className="space-y-2">
                            <Badge className={fundingBadgeClass(fundingType)}>{fundingLabel}</Badge>
                            <p className="break-words text-xs font-semibold text-white/80">{item.sponsor_name || fundingRecord?.sponsor_name || "Funding record"}</p>
                          </div>
                        ) : <span className="text-white/40">None</span>}
                      </ColumnCell>

                      <ColumnCell column="fundingNote" className="max-w-[220px] p-3 align-top">{item.sponsorship_note ? <span className="line-clamp-3 break-words text-sm text-amber-100">{item.sponsorship_note}</span> : <span className="text-white/40">None</span>}</ColumnCell>

                      <ColumnCell column="personal" className="p-3 align-top">{isPersonal ? <Badge className="bg-sky-500/20 text-sky-100 ring-sky-300/20">Personal funds</Badge> : <span className="text-white/40">None</span>}</ColumnCell>

                      <ColumnCell column="paidBy" className="max-w-[160px] p-3 align-top">{item.personal_funds_name ? <span className="break-words font-semibold text-sky-200">{item.personal_funds_name}</span> : <span className="text-white/40">None</span>}</ColumnCell>

                      <ColumnCell column="repayment" className="min-w-[190px] p-3 align-top">
                        {isPersonal ? (
                          <div className="space-y-2">
                            {item.personal_funds_repaid ? <div className="rounded-2xl bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-200 ring-1 ring-emerald-300/20">Paid back{item.personal_funds_repaid_at && <div className="mt-1 text-[11px] font-semibold text-emerald-100/70">{formatDate(item.personal_funds_repaid_at)}</div>}</div> : <div className="rounded-2xl bg-orange-500/15 px-3 py-2 text-xs font-bold text-orange-200 ring-1 ring-orange-300/20">Not paid back</div>}

                            {!item.personal_funds_repaid && (
                              <div className="rounded-xl bg-black/20 p-2 ring-1 ring-white/10">
                                <label className="mb-1 block text-[11px] font-bold text-white/60">Upload proof before payback</label>
                                <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.eml,.msg" onChange={(event) => { const selectedFiles = Array.from(event.target.files || []); setRepaymentProofFiles((prev) => ({ ...prev, [item.id]: selectedFiles })); }} className="w-full text-[11px] text-white/60 file:mr-2 file:rounded-lg file:border-0 file:bg-emerald-500 file:px-2 file:py-1 file:text-[11px] file:font-bold file:text-white hover:file:bg-emerald-400" />
                                {proofFiles.length > 0 && <p className="mt-2 text-[11px] font-semibold text-emerald-200">{proofFiles.length} proof file{proofFiles.length === 1 ? "" : "s"} selected</p>}
                              </div>
                            )}

                            <button type="button" disabled={repayingId === item.id} onClick={async () => { await onTogglePersonalFundsRepaid(item, proofFiles); setRepaymentProofFiles((prev) => ({ ...prev, [item.id]: [] })); }} className={`w-full rounded-xl px-3 py-2 text-xs font-bold transition disabled:opacity-60 ${item.personal_funds_repaid ? "bg-orange-500/15 text-orange-200 ring-1 ring-orange-300/20 hover:bg-orange-500/25" : "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-300/20 hover:bg-emerald-500/25"}`}>
                              {repayingId === item.id ? "Updating..." : item.personal_funds_repaid ? "Mark not paid back" : "Mark paid back"}
                            </button>
                          </div>
                        ) : <span className="text-white/40">None</span>}
                      </ColumnCell>

                      <ColumnCell column="payment" className="whitespace-nowrap p-3 align-top">{hasFunding ? "Funding Money" : item.payment_method || "None"}</ColumnCell>

                      <ColumnCell column="bank" className="min-w-[230px] p-3 align-top">
                        <div className="space-y-2">
                          <Badge className={bankReconciliationBadgeClass(bankStatus)}>{bankReconciliationLabel(bankStatus)}</Badge>
                          {item.bank_reconciled_by && <p className="text-[11px] font-semibold text-white/50">By {item.bank_reconciled_by}</p>}
                          {item.bank_reconciled_at && <p className="text-[11px] font-semibold text-white/50">{formatDate(item.bank_reconciled_at)}</p>}
                          {item.bank_reconciliation_note && <p className="line-clamp-2 text-[11px] text-white/45">{item.bank_reconciliation_note}</p>}
                          <div className="grid grid-cols-2 gap-1">
                            <button type="button" disabled={bankReconcilingId === item.id} onClick={() => onUpdateBankReconciliationStatus(item, "matched")} className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-1.5 text-[11px] font-black text-emerald-100 ring-1 ring-emerald-300/20 hover:bg-emerald-500/25 disabled:opacity-50">{bankReconcilingId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} Matched</button>
                            <button type="button" disabled={bankReconcilingId === item.id} onClick={() => onUpdateBankReconciliationStatus(item, "needs_review")} className="inline-flex items-center justify-center gap-1 rounded-lg bg-amber-500/15 px-2 py-1.5 text-[11px] font-black text-amber-100 ring-1 ring-amber-300/20 hover:bg-amber-500/25 disabled:opacity-50"><ShieldAlert className="h-3 w-3" /> Review</button>
                            <button type="button" disabled={bankReconcilingId === item.id} onClick={() => onUpdateBankReconciliationStatus(item, "ignored")} className="inline-flex items-center justify-center gap-1 rounded-lg bg-sky-500/15 px-2 py-1.5 text-[11px] font-black text-sky-100 ring-1 ring-sky-300/20 hover:bg-sky-500/25 disabled:opacity-50">Ignore</button>
                            <button type="button" disabled={bankReconcilingId === item.id} onClick={() => onUpdateBankReconciliationStatus(item, "unmatched")} className="inline-flex items-center justify-center gap-1 rounded-lg bg-white/10 px-2 py-1.5 text-[11px] font-black text-white/70 ring-1 ring-white/10 hover:bg-white/15 disabled:opacity-50"><RefreshCcw className="h-3 w-3" /> Unmatched</button>
                          </div>
                        </div>
                      </ColumnCell>

                      <ColumnCell column="receipt" className="min-w-[230px] p-3 align-top">
                        {missingReceipt ? (
                          <div className={`rounded-2xl border px-3 py-2 text-xs text-red-100 ${receiptOverdue ? "border-red-300/30 bg-red-500/15" : "border-red-300/20 bg-red-500/10"}`}>
                            <div className="flex items-center gap-2 font-black">
                              {receiptOverdue ? <CalendarClock className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                              {receiptOverdue ? "Receipt overdue" : "Missing receipt"}
                            </div>
                            <div className="mt-1 text-red-100/70">
                              {receiptReminderLabel(item, activeReceiptReminderDays)}
                            </div>
                            <div className="mt-2 rounded-xl bg-black/20 px-2 py-1 text-[11px] font-bold text-red-100/75">
                              Rule: upload receipt within {activeReceiptReminderDays} day{activeReceiptReminderDays === 1 ? "" : "s"} of the expense.
                            </div>
                          </div>
                        ) : files.length > 0 ? (
                          <div className="space-y-2">
                            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100"><div className="font-black">Receipt / proof attached</div><div className="mt-1 text-emerald-100/70">{files.length} file{files.length === 1 ? "" : "s"} attached.</div></div>
                            <div className="space-y-1">
                              {files.slice(0, 3).map((file, index) => <a key={file.id || `${file.file_url}-${index}`} href={file.file_url} target="_blank" rel="noopener noreferrer" className="block max-w-[220px] truncate rounded-lg bg-white/10 px-2 py-1 text-xs font-bold text-white hover:bg-white/20" title={file.file_name || `Attachment ${index + 1}`}><FileText className="mr-1 inline h-3 w-3" />{file.file_name || `Attachment ${index + 1}`}{file.file_size ? ` (${formatFileSize(file.file_size)})` : ""}</a>)}
                              {files.length > 3 && <p className="text-xs text-white/40">+{files.length - 3} more file{files.length - 3 === 1 ? "" : "s"}</p>}
                            </div>
                          </div>
                        ) : <span className="text-white/30">NOT UPLOAD YET</span>}
                      </ColumnCell>

                      <ColumnCell column="finance" className="min-w-[260px] p-3 align-top">
                        <div className="space-y-2">
                          <Badge className={financeNoteBadgeClass(financeStatus)}>{financeNoteStatusLabel(financeStatus)}</Badge>
                          {item.finance_note && <p className="line-clamp-3 rounded-xl bg-black/20 px-3 py-2 text-xs text-white/65 ring-1 ring-white/10">{item.finance_note}</p>}
                          {item.finance_note_updated_by && <p className="text-[11px] font-semibold text-white/45">By {item.finance_note_updated_by}</p>}
                          {item.finance_note_updated_at && <p className="text-[11px] font-semibold text-white/45">{formatDate(item.finance_note_updated_at)}</p>}
                          <div className="rounded-xl bg-black/20 p-2 ring-1 ring-white/10">
                            <label className="mb-1 block text-[11px] font-bold text-white/50">Update finance query</label>
                            <select value={financeDraft.status} onChange={(event) => setFinanceDraftStatus(item, event.target.value as FinanceNoteStatus)} className="w-full rounded-lg bg-black/30 px-2 py-2 text-xs font-bold text-white outline-none ring-1 ring-white/10 focus:ring-cyan-300/40">
                              {financeNoteOptions.map((option) => <option key={option.value} value={option.value} className="bg-[#11111f] text-white">{option.label}</option>)}
                            </select>
                            <textarea value={financeDraft.note} onChange={(event) => setFinanceDraftNote(item, event.target.value)} placeholder="Add finance note..." className="mt-2 min-h-16 w-full rounded-lg bg-black/30 px-2 py-2 text-xs text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-cyan-300/40" />
                            <button type="button" disabled={financeNoteUpdatingId === item.id || !financeNoteChanged} onClick={() => saveFinanceDraft(item)} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500/15 px-3 py-2 text-xs font-black text-cyan-100 ring-1 ring-cyan-300/20 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50">{financeNoteUpdatingId === item.id && <Loader2 className="h-3 w-3 animate-spin" />} Save finance note</button>
                          </div>
                        </div>
                      </ColumnCell>

                      <ColumnCell column="checked" className="min-w-[210px] p-3 align-top">{renderCheckedCell(item)}</ColumnCell>

                      <ColumnCell column="actions" className="sticky right-0 z-10 bg-[#11111f] p-3 text-right align-top shadow-[-12px_0_18px_rgba(0,0,0,0.35)]">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button type="button" onClick={() => setDetailsItem(item)} className="inline-flex items-center justify-center rounded-xl bg-white/10 p-2 text-white hover:bg-white/20" title="View details"><Eye className="h-4 w-4" /></button>
                          <button type="button" onClick={() => onEditTransaction(item)} className="inline-flex items-center justify-center rounded-xl bg-sky-500/15 p-2 text-sky-200 hover:bg-sky-500/25" title="Edit transaction"><Pencil className="h-4 w-4" /></button>
                          <button type="button" disabled={deleting} onClick={() => onHideTransaction(item.id)} className="inline-flex items-center justify-center rounded-xl bg-red-500/15 p-2 text-red-200 hover:bg-red-500/25 disabled:opacity-50" title="Hide transaction"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </ColumnCell>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {detailsItem && (
        <div className="fixed inset-0 z-[999] flex justify-end bg-black/70 backdrop-blur-sm">
          <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-[#10101f] p-5 shadow-2xl shadow-black">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-white/40">Transaction details</p>
                <h3 className="mt-1 break-words text-2xl font-black text-white">{detailsItem.title}</h3>
                <p className="mt-1 text-sm text-white/45">{detailsItem.transaction_reference || "No reference"}</p>
              </div>
              <button type="button" onClick={() => setDetailsItem(null)} className="rounded-2xl bg-white/10 p-3 text-white hover:bg-white/20"><X className="h-5 w-5" /></button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/5 p-4"><p className="text-xs font-black text-white/40">Date</p><p className="mt-1 font-bold text-white">{none(detailsItem.transaction_date)}</p></div>
              <div className="rounded-2xl bg-white/5 p-4"><p className="text-xs font-black text-white/40">Amount</p><p className="mt-1 font-bold text-white">{money(detailsItem.amount_pence)}</p></div>
              <div className="rounded-2xl bg-white/5 p-4"><p className="text-xs font-black text-white/40">Type</p><p className="mt-1 font-bold text-white">{detailsItem.type === "income" ? "Money In" : "Money Out"}</p></div>
              <div className="rounded-2xl bg-white/5 p-4"><p className="text-xs font-black text-white/40">Payment</p><p className="mt-1 font-bold text-white">{detailsItem.payment_method || "None"}</p></div>
              <div className="rounded-2xl bg-white/5 p-4"><p className="text-xs font-black text-white/40">Bank</p><p className="mt-1 font-bold text-white">{bankReconciliationLabel(detailsItem.bank_reconciliation_status || "unmatched")}</p></div>
              <div className="rounded-2xl bg-white/5 p-4"><p className="text-xs font-black text-white/40">Checked</p><p className="mt-1 font-bold text-white">{detailsItem.checked_at ? `Checked by ${getCheckedByDisplayName(detailsItem)}` : "Not checked"}</p></div>
            </div>

            {detailsItem.description && <div className="mt-4 rounded-2xl bg-white/5 p-4"><p className="text-xs font-black text-white/40">Description</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/70">{detailsItem.description}</p></div>}
            {detailsItem.sponsorship_note && <div className="mt-4 rounded-2xl bg-amber-500/10 p-4 ring-1 ring-amber-300/20"><p className="text-xs font-black text-amber-100/70">Funding note</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-amber-100/80">{detailsItem.sponsorship_note}</p></div>}
            {detailsItem.finance_note && <div className="mt-4 rounded-2xl bg-cyan-500/10 p-4 ring-1 ring-cyan-300/20"><p className="text-xs font-black text-cyan-100/70">Finance note</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-cyan-100/80">{detailsItem.finance_note}</p></div>}

            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={() => onEditTransaction(detailsItem)} className="rounded-xl bg-sky-500/15 px-4 py-3 text-sm font-black text-sky-100 ring-1 ring-sky-300/20 hover:bg-sky-500/25">Edit transaction</button>
              <button type="button" onClick={() => onMarkTransactionChecked(detailsItem)} className="rounded-xl bg-emerald-500/15 px-4 py-3 text-sm font-black text-emerald-100 ring-1 ring-emerald-300/20 hover:bg-emerald-500/25">{detailsItem.checked_at ? "Undo checked" : "Mark checked"}</button>
              <button type="button" onClick={() => setDetailsItem(null)} className="rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/20">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
