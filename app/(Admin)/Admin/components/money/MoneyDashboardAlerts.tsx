"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  CheckCircle2,
  Eye,
  FileWarning,
  Loader2,
  ReceiptText,
  ShieldAlert,
  UploadCloud,
  WalletCards,
  X,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";
import type { Transaction } from "@/lib/money/types";

type SponsorBreakdown = {
  id?: string | null;
  sponsor_id?: string | null;
  sponsorId?: string | null;

  sponsor_name?: string | null;
  sponsorName?: string | null;
  name?: string | null;

  received_pence?: number | null;
  receivedPence?: number | null;
  received_amount_pence?: number | null;

  spent_pence?: number | null;
  spentPence?: number | null;
  spent_amount_pence?: number | null;

  remaining_pence?: number | null;
  remainingPence?: number | null;
};

type FailedCsvRow = {
  row?: number | string | null;
  line?: number | string | null;
  error?: string | null;
  reason?: string | null;
  message?: string | null;
  raw?: unknown;
};

type MoneyFilter = "all" | "income" | "expense" | "sponsorship" | "personal";

export type MoneyAlertFilter =
  | "unchecked"
  | "missing_receipt"
  | "receipt_overdue"
  | "personal_funds_unpaid"
  | "bank_unreconciled";

type AlertKey =
  | "unchecked"
  | "missing-receipts"
  | "receipt-overdue"
  | "personal-funds"
  | "overspent-funding"
  | "failed-csv"
  | "bank-reconciliation";

type Props = {
  selectedYear: string;
  transactions: Transaction[];
  yearlySponsorBreakdown?: SponsorBreakdown[];
  failedCsvRows?: FailedCsvRow[];
  onSetFilter?: (filter: MoneyFilter) => void;
  onSetSearchTerm?: (term: string) => void;
  onSetAlertFilter?: (filter: MoneyAlertFilter | null) => void;

  /**
   * Receipt expiry/check reminder.
   * Example: 7 means expenses older than 7 days with no receipt will be shown
   * in the overdue receipt alert.
   */
  receiptReminderDays?: number;

  /**
   * Required for floating window checkboxes.
   * Pass the SAME function used by MoneyTransactionsTable.
   * This should update the database and write to audit logs.
   */
  onMarkTransactionChecked: (item: Transaction) => void | Promise<void>;
};

type DashboardAlert = {
  key: AlertKey;
  title: string;
  message: string;
  count: number;
  tone: "red" | "amber" | "sky" | "purple" | "emerald";
  icon: LucideIcon;
  actionLabel: string;
  filter: MoneyFilter;
  searchTerm: string;
  alertFilter?: MoneyAlertFilter;
  canFilterTransactions: boolean;
};

const DEFAULT_RECEIPT_REMINDER_DAYS = 7;

function cleanText(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function lower(value: unknown) {
  return cleanText(value).toLowerCase();
}

function finiteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function money(value: unknown) {
  const pence = Number(value);
  if (!Number.isFinite(pence)) return "Invalid amount";

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100);
}

function readBoolean(value: unknown) {
  if (value === true || value === 1) return true;
  const normalised = lower(value);
  return normalised === "true" || normalised === "1" || normalised === "yes";
}

function parseDate(value: unknown) {
  const text = cleanText(value);
  if (!text) return null;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function safeDate(value: unknown) {
  const text = cleanText(value);
  if (!text) return "No date";
  const date = parseDate(text);
  if (!date) return text;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function safeDateTime(value: unknown) {
  const text = cleanText(value);
  if (!text) return "No date";
  const date = parseDate(text);
  if (!date) return text;

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDetailedErrorMessage(error: unknown) {
  if (!error) return "Unknown error: no error details were returned.";
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === "string") return error;
  try { return JSON.stringify(error, null, 2); }
  catch { return "Unknown error: could not read error details."; }
}

type DashboardTransaction = Transaction & Record<string, unknown>;
function tx(transaction: Transaction) { return transaction as DashboardTransaction; }
function transactionId(transaction: Transaction) { return cleanText(tx(transaction).id); }
function transactionDate(transaction: Transaction) { return tx(transaction).transaction_date || tx(transaction).date || transaction.created_at || ""; }
function transactionCreatedAt(transaction: Transaction) { return tx(transaction).created_at || transactionDate(transaction); }
function transactionYear(transaction: Transaction) { const date = parseDate(transactionDate(transaction)); return date ? String(date.getFullYear()) : ""; }
function transactionAgeDays(transaction: Transaction) {
  const date = parseDate(transactionDate(transaction) || transactionCreatedAt(transaction));
  if (!date) return 0;
  const now = new Date();
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86_400_000));
}
function receiptDueDate(transaction: Transaction, days: number) { const date=parseDate(transactionDate(transaction)||transactionCreatedAt(transaction)); if(!date)return ""; date.setDate(date.getDate()+days); return date.toISOString(); }
function receiptOverdueDays(transaction: Transaction, days: number) { return Math.max(0, transactionAgeDays(transaction)-days); }
function isForSelectedYear(transaction: Transaction, selectedYear: string) { if(!selectedYear||selectedYear==="all")return true; return transactionYear(transaction)===selectedYear; }
function isExpense(transaction: Transaction) { return lower(transaction.type)==="expense"; }
function isDeleted(transaction: Transaction) { return cleanText(tx(transaction).deleted_at).length>0; }
function isPersonalFunds(transaction: Transaction) { return readBoolean(tx(transaction).is_personal_funds)||readBoolean(tx(transaction).isPersonalFunds)||lower(transaction.payment_method)==="personal funds"; }
function isPersonalFundsPaidBack(transaction: Transaction) { return readBoolean(tx(transaction).personal_funds_repaid)||readBoolean(tx(transaction).personalFundsRepaid); }
function hasUsableAttachment(value: unknown) { if(!Array.isArray(value))return false; return value.some((a)=>{ if(typeof a==="string")return cleanText(a).length>0; if(!a||typeof a!=="object")return false; const r=a as Record<string,unknown>; return Boolean(cleanText(r.url)||cleanText(r.path)||cleanText(r.storage_path)||cleanText(r.public_url)); }); }
function hasReceipt(transaction: Transaction) { const r=tx(transaction); return Boolean(hasUsableAttachment(r.attachments)||cleanText(r.invoice_image_url)||cleanText(r.receipt_url)||cleanText(r.receiptUrl)||cleanText(r.invoice_url)||cleanText(r.invoiceUrl)); }
function isChecked(transaction: Transaction) { const r=tx(transaction); return Boolean(cleanText(r.checked_at)||cleanText(r.checked_by)||readBoolean(r.checked)||readBoolean(r.is_checked)); }
function checkedBy(transaction: Transaction) { const r=tx(transaction); return cleanText(r.checked_by_name)||cleanText(r.checked_by)||cleanText(r.checked_by_email)||"Unknown admin"; }
function checkedStatusLabel(transaction: Transaction, localChecked:boolean) { if(localChecked)return "Checked just now"; if(!isChecked(transaction))return "Not checked"; return `Checked by ${checkedBy(transaction)}`; }
function bankStatus(transaction: Transaction) { const r=tx(transaction); return lower(r.bank_reconciliation_status||r.bankReconciliationStatus||r.bank_status||r.bankStatus); }
function bankStatusLabel(transaction: Transaction) { const r=tx(transaction); return cleanText(r.bank_reconciliation_status||r.bankReconciliationStatus||r.bank_status||r.bankStatus)||"Unmatched"; }
function requiresBankReconciliation(transaction: Transaction) { const r=tx(transaction); if(readBoolean(r.requires_bank_reconciliation)||cleanText(r.bank_transaction_id))return true; const method=lower(transaction.payment_method); return ["bank","card","direct debit","standing order","bacs","stripe","paypal"].some((v)=>method.includes(v)); }
function isUnreconciled(transaction: Transaction) { if(!requiresBankReconciliation(transaction))return false; const status=bankStatus(transaction); if(!status)return true; if(["matched","reconciled","complete","completed"].includes(status))return false; return ["unmatched","unreconciled","pending","query","not matched","not_matched","missing","todo","to_do"].some((v)=>status===v||status.includes(v)); }
function sponsorName(item:SponsorBreakdown) { return cleanText(item.sponsor_name)||cleanText(item.sponsorName)||cleanText(item.name)||"Funding record"; }
function receivedPence(item:SponsorBreakdown) { return finiteNumber(item.received_pence??item.receivedPence??item.received_amount_pence,0); }
function spentPence(item:SponsorBreakdown) { return finiteNumber(item.spent_pence??item.spentPence??item.spent_amount_pence,0); }
function remainingPence(item:SponsorBreakdown) { const explicit=item.remaining_pence??item.remainingPence; return explicit===undefined||explicit===null ? receivedPence(item)-spentPence(item) : finiteNumber(explicit,0); }
function transactionTitle(transaction:Transaction) { return cleanText(tx(transaction).title)||"Untitled transaction"; }
function transactionReference(transaction:Transaction) { return cleanText(tx(transaction).transaction_reference)||"No reference"; }
function transactionAmount(transaction:Transaction) { return money(tx(transaction).amount_pence); }
function transactionPayment(transaction:Transaction) { return cleanText(transaction.payment_method)||"No payment method"; }
function transactionFunding(transaction:Transaction) { const r=tx(transaction); return cleanText(r.sponsor_name)||cleanText(r.funding_name)||cleanText(r.grant_name)||"No funding record"; }
function transactionTypeLabel(transaction:Transaction) { const type=lower(transaction.type); if(type==="income")return "Money In"; if(type==="expense")return "Money Out"; if(type==="transfer")return "Transfer"; return cleanText(transaction.type)||"Unknown type"; }
function receiptReminderStatus(transaction:Transaction, days:number) { const ageDays=transactionAgeDays(transaction); const dueDate=receiptDueDate(transaction,days); const overdueBy=receiptOverdueDays(transaction,days); return {ageDays,dueDate,overdueBy,isOverdue:ageDays>days}; }
function normaliseReceiptReminderDays(value:unknown) { const parsed=Number(value); return Number.isFinite(parsed)?Math.max(1,Math.floor(parsed)):DEFAULT_RECEIPT_REMINDER_DAYS; }
function toneClasses(tone: DashboardAlert["tone"]) {
  if (tone === "red") {
    return {
      card: "border-red-300/25 bg-red-500/10",
      icon: "bg-red-500/15 text-red-100 ring-red-300/20",
      text: "text-red-100/75",
      button: "bg-red-500/20 text-red-100 ring-red-300/20 hover:bg-red-500/30",
      modalTitle: "text-red-100",
    };
  }

  if (tone === "amber") {
    return {
      card: "border-amber-300/25 bg-amber-500/10",
      icon: "bg-amber-500/15 text-amber-100 ring-amber-300/20",
      text: "text-amber-100/75",
      button:
        "bg-amber-500/20 text-amber-100 ring-amber-300/20 hover:bg-amber-500/30",
      modalTitle: "text-amber-100",
    };
  }

  if (tone === "sky") {
    return {
      card: "border-sky-300/25 bg-sky-500/10",
      icon: "bg-sky-500/15 text-sky-100 ring-sky-300/20",
      text: "text-sky-100/75",
      button: "bg-sky-500/20 text-sky-100 ring-sky-300/20 hover:bg-sky-500/30",
      modalTitle: "text-sky-100",
    };
  }

  if (tone === "purple") {
    return {
      card: "border-purple-300/25 bg-purple-500/10",
      icon: "bg-purple-500/15 text-purple-100 ring-purple-300/20",
      text: "text-purple-100/75",
      button:
        "bg-purple-500/20 text-purple-100 ring-purple-300/20 hover:bg-purple-500/30",
      modalTitle: "text-purple-100",
    };
  }

  return {
    card: "border-emerald-300/25 bg-emerald-500/10",
    icon: "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20",
    text: "text-emerald-100/75",
    button:
      "bg-emerald-500/20 text-emerald-100 ring-emerald-300/20 hover:bg-emerald-500/30",
    modalTitle: "text-emerald-100",
  };
}

function scrollToTransactions() {
  setTimeout(() => {
    const target =
      document.getElementById("money-transactions-table") ||
      document.getElementById("transactions") ||
      document.querySelector("[data-money-transactions-table]");

    target?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, 80);
}

function DetailLine({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wide text-white/35">
        {label}
      </p>

      <div className="mt-1 break-words text-sm font-semibold text-white/80">
        {value}
      </div>
    </div>
  );
}

function CheckedActionBox({
  transaction,
  checking,
  localChecked,
  onMarkChecked,
}: {
  transaction: Transaction;
  checking: boolean;
  localChecked: boolean;
  onMarkChecked: () => void | Promise<void>;
}) {
  const alreadyChecked = isChecked(transaction) || localChecked;

  if (alreadyChecked) {
    return (
      <div className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-100">
        <CheckCircle2 className="mr-2 inline h-4 w-4" />
        This transaction has been checked.
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-3">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          disabled={checking}
          onChange={() => onMarkChecked()}
          className="mt-1 h-5 w-5 rounded border-white/20 bg-black/30 text-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        />

        <span className="min-w-0">
          <span className="block text-sm font-black text-emerald-100">
            {checking
              ? "Updating database..."
              : "Tick to mark this transaction checked"}
          </span>

          <span className="mt-1 block text-xs leading-5 text-emerald-100/70">
            This updates the database and uses your existing audit-log function,
            so the log page shows which admin checked it.
          </span>
        </span>
      </label>
    </div>
  );
}

function TransactionCard({
  transaction,
  extra,
  checking = false,
  localChecked = false,
  onMarkChecked,
}: {
  transaction: Transaction;
  extra?: ReactNode;
  checking?: boolean;
  localChecked?: boolean;
  onMarkChecked: () => void | Promise<void>;
}) {
  const type = lower(transaction.type);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="break-words text-base font-black text-white">
            {transactionTitle(transaction)}
          </p>

          <p className="mt-1 text-xs text-white/45">
            {transactionReference(transaction)}
          </p>
        </div>

        <div
          className={`rounded-xl px-3 py-2 text-sm font-black ring-1 ${
            type === "income"
              ? "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20"
              : "bg-red-500/15 text-red-100 ring-red-300/20"
          }`}
        >
          {transactionAmount(transaction)}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <DetailLine label="Date" value={safeDate(transactionDate(transaction))} />

        <DetailLine
          label="Type"
          value={transactionTypeLabel(transaction)}
        />

        <DetailLine label="Payment" value={transactionPayment(transaction)} />

        <DetailLine label="Funding" value={transactionFunding(transaction)} />

        <DetailLine
          label="Checked"
          value={checkedStatusLabel(transaction, localChecked)}
        />
      </div>

      {cleanText(tx(transaction).description) && (
        <div className="mt-3 rounded-xl bg-white/5 p-3 text-sm leading-6 text-white/60">
          {cleanText(tx(transaction).description)}
        </div>
      )}

      <CheckedActionBox
        transaction={transaction}
        checking={checking}
        localChecked={localChecked}
        onMarkChecked={onMarkChecked}
      />

      {extra && <div className="mt-3">{extra}</div>}
    </div>
  );
}

function FundingCard({ item }: { item: SponsorBreakdown }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="break-words text-base font-black text-white">
            {sponsorName(item)}
          </p>

          <p className="mt-1 text-xs text-white/45">
            Funding record overspent
          </p>
        </div>

        <div className="rounded-xl bg-red-500/15 px-3 py-2 text-sm font-black text-red-100 ring-1 ring-red-300/20">
          Overspent {money(Math.abs(remainingPence(item)))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <DetailLine label="Received" value={money(receivedPence(item))} />
        <DetailLine label="Spent" value={money(spentPence(item))} />
        <DetailLine label="Remaining" value={money(remainingPence(item))} />
      </div>
    </div>
  );
}

function FailedCsvCard({ row, index }: { row: FailedCsvRow; index: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-base font-black text-white">
            Row {row.row || row.line || index + 1}
          </p>

          <p className="mt-1 text-sm text-red-100/75">
            {row.error || row.reason || row.message || "Import row failed"}
          </p>
        </div>

        <div className="rounded-xl bg-red-500/15 px-3 py-2 text-xs font-black text-red-100 ring-1 ring-red-300/20">
          Failed CSV
        </div>
      </div>

      {row.raw != null ? (
        <pre className="mt-3 max-h-48 overflow-auto rounded-xl bg-black/40 p-3 text-xs text-white/60">
          {typeof row.raw === "string"
            ? row.raw
            : JSON.stringify(row.raw, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

function EmptyModalState({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-6 text-center">
      <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-200" />

      <p className="mt-3 text-base font-black text-white">{title}</p>

      <p className="mt-1 text-sm text-white/55">
        There is nothing to show for this alert.
      </p>
    </div>
  );
}

export default function MoneyDashboardAlerts({
  selectedYear,
  transactions,
  yearlySponsorBreakdown = [],
  failedCsvRows = [],
  onSetFilter,
  onSetSearchTerm,
  onSetAlertFilter,
  receiptReminderDays = DEFAULT_RECEIPT_REMINDER_DAYS,
  onMarkTransactionChecked,
}: Props) {
  const [openAlertKey, setOpenAlertKey] = useState<AlertKey | null>(null);
  const [checkingIds, setCheckingIds] = useState<Set<string>>(() => new Set());
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const [localCheckedIds, setLocalCheckedIds] = useState<Set<string>>(
    () => new Set()
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const receiptReminderDaysSafe = normaliseReceiptReminderDays(receiptReminderDays);

  useEffect(() => {
    if (!openAlertKey) return;
    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenAlertKey(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocusedRef.current?.focus();
    };
  }, [openAlertKey]);

  useEffect(() => {
    setLocalCheckedIds((previous) => {
      const next = new Set(previous);
      for (const transaction of transactions) {
        const id = transactionId(transaction);
        if (id && isChecked(transaction)) next.delete(id);
      }
      return next.size === previous.size ? previous : next;
    });
  }, [transactions]);

  const activeTransactions = useMemo(() => {
    return transactions
      .filter((transaction) => !isDeleted(transaction))
      .filter((transaction) => isForSelectedYear(transaction, selectedYear));
  }, [transactions, selectedYear]);

  const uncheckedTransactions = useMemo(() => {
    return activeTransactions.filter((transaction) => {
      const id = transactionId(transaction);

      return !isChecked(transaction) && !localCheckedIds.has(id);
    });
  }, [activeTransactions, localCheckedIds]);

  const missingReceiptExpenses = useMemo(() => {
    return activeTransactions.filter(
      (transaction) => isExpense(transaction) && !hasReceipt(transaction)
    );
  }, [activeTransactions]);

  const overdueReceiptExpenses = useMemo(() => {
    return missingReceiptExpenses
      .filter((transaction) => {
        const status = receiptReminderStatus(
          transaction,
          receiptReminderDaysSafe
        );

        return status.isOverdue;
      })
      .sort((a, b) => {
        const aOverdue = receiptOverdueDays(a, receiptReminderDaysSafe);
        const bOverdue = receiptOverdueDays(b, receiptReminderDaysSafe);

        return bOverdue - aOverdue;
      });
  }, [missingReceiptExpenses, receiptReminderDaysSafe]);

  const longestReceiptOverdueDays = overdueReceiptExpenses.reduce(
    (highest, transaction) => Math.max(highest, receiptOverdueDays(transaction, receiptReminderDaysSafe)),
    0
  );

  const unpaidPersonalFunds = useMemo(() => {
    return activeTransactions.filter(
      (transaction) =>
        isPersonalFunds(transaction) && !isPersonalFundsPaidBack(transaction)
    );
  }, [activeTransactions]);

  const unreconciledBankItems = useMemo(() => {
    return activeTransactions.filter(isUnreconciled);
  }, [activeTransactions]);

  const overspentFunding = useMemo(() => {
    return yearlySponsorBreakdown.filter((item) => remainingPence(item) < 0);
  }, [yearlySponsorBreakdown]);

  const overspentFundingTotal = overspentFunding.reduce(
    (sum, item) => sum + Math.abs(remainingPence(item)),
    0
  );

  const unpaidPersonalFundsTotal = unpaidPersonalFunds.reduce(
    (sum, item) => sum + finiteNumber(tx(item).amount_pence, 0),
    0
  );

  async function markTransactionCheckedFromModal(transaction: Transaction) {
    const id = transactionId(transaction);
    const title = transactionTitle(transaction);
    const reference = transactionReference(transaction);

    if (!id) {
      setErrorMessage(
        `Could not mark as checked because this transaction has no ID.

Transaction: ${title}
Reference: ${reference}`
      );
      return;
    }

    try {
      setErrorMessage(null);
      setSuccessMessage(null);
      setCheckingIds((previous) => { const next = new Set(previous); next.add(id); return next; });

      await onMarkTransactionChecked(transaction);

      setLocalCheckedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });

      setSuccessMessage(
        `Transaction marked as checked: ${title}.`
      );
    } catch (error) {
      console.error("Floating window mark checked failed:", error);

      const details = getDetailedErrorMessage(error);

      setErrorMessage(
        `Could not mark this transaction as checked.

Transaction: ${title}
Reference: ${reference}
ID: ${id}

Error details:
${details}`
      );
    } finally {
      setCheckingIds((previous) => { const next = new Set(previous); next.delete(id); return next; });
    }
  }

  function applyAlertFilter(alert: DashboardAlert) {
    onSetFilter?.(alert.filter);
    if (onSetAlertFilter && alert.alertFilter) {
      onSetAlertFilter(alert.alertFilter);
      onSetSearchTerm?.("");
    } else {
      onSetSearchTerm?.(alert.searchTerm);
    }
    setOpenAlertKey(null);
    scrollToTransactions();
  }

  const alerts: DashboardAlert[] = [
    {
      key: "unchecked",
      title: "Unchecked transactions",
      message:
        uncheckedTransactions.length > 0
          ? "Some transactions still need checking before reports are finalised."
          : "All loaded transactions are checked.",
      count: uncheckedTransactions.length,
      tone: uncheckedTransactions.length > 0 ? "amber" : "emerald",
      icon: uncheckedTransactions.length > 0 ? ShieldAlert : CheckCircle2,
      actionLabel: "Show unchecked",
      filter: "all",
      searchTerm: "unchecked",
      alertFilter: "unchecked",
      canFilterTransactions: true,
    },
    {
      key: "missing-receipts",
      title: "Missing receipts",
      message:
        missingReceiptExpenses.length > 0
          ? "Expense transactions are missing receipts or invoice uploads."
          : "No missing receipts found in loaded expenses.",
      count: missingReceiptExpenses.length,
      tone: missingReceiptExpenses.length > 0 ? "red" : "emerald",
      icon: ReceiptText,
      actionLabel: "Show missing receipts",
      filter: "expense",
      searchTerm: "missing receipt",
      alertFilter: "missing_receipt",
      canFilterTransactions: true,
    },
    {
      key: "receipt-overdue",
      title: "Receipt expiry check",
      message:
        overdueReceiptExpenses.length > 0
          ? `${overdueReceiptExpenses.length} expense${
              overdueReceiptExpenses.length === 1 ? "" : "s"
            } still have no receipt after ${receiptReminderDaysSafe} day${
              receiptReminderDaysSafe === 1 ? "" : "s"
            }. Longest overdue is ${longestReceiptOverdueDays} day${
              longestReceiptOverdueDays === 1 ? "" : "s"
            }.`
          : `No missing receipts older than ${receiptReminderDaysSafe} day${
              receiptReminderDaysSafe === 1 ? "" : "s"
            }.`,
      count: overdueReceiptExpenses.length,
      tone: overdueReceiptExpenses.length > 0 ? "red" : "emerald",
      icon: overdueReceiptExpenses.length > 0 ? CalendarClock : CheckCircle2,
      actionLabel: "Show overdue receipts",
      filter: "expense",
      searchTerm: "receipt overdue",
      alertFilter: "receipt_overdue",
      canFilterTransactions: true,
    },
    {
      key: "personal-funds",
      title: "Unpaid personal funds",
      message:
        unpaidPersonalFunds.length > 0
          ? `Outstanding personal funds total ${money(unpaidPersonalFundsTotal)}.`
          : "No unpaid personal funds found.",
      count: unpaidPersonalFunds.length,
      tone: unpaidPersonalFunds.length > 0 ? "amber" : "emerald",
      icon: WalletCards,
      actionLabel: "Show unpaid personal funds",
      filter: "personal",
      searchTerm: "unpaid personal funds",
      alertFilter: "personal_funds_unpaid",
      canFilterTransactions: true,
    },
    {
      key: "overspent-funding",
      title: "Overspent funding",
      message:
        overspentFunding.length > 0
          ? `${overspentFunding.length} funding record${
              overspentFunding.length === 1 ? "" : "s"
            } overspent by ${money(overspentFundingTotal)}.`
          : "No overspent funding records found.",
      count: overspentFunding.length,
      tone: overspentFunding.length > 0 ? "red" : "emerald",
      icon: Banknote,
      actionLabel: "Show overspent funding",
      filter: "sponsorship",
      searchTerm: "",
      canFilterTransactions: false,
    },
    {
      key: "failed-csv",
      title: "Failed CSV rows",
      message:
        failedCsvRows.length > 0
          ? "Some imported CSV rows failed and need checking."
          : "No failed CSV rows are currently reported.",
      count: failedCsvRows.length,
      tone: failedCsvRows.length > 0 ? "red" : "emerald",
      icon: UploadCloud,
      actionLabel: "Review imports",
      filter: "all",
      searchTerm: "",
      canFilterTransactions: false,
    },
    {
      key: "bank-reconciliation",
      title: "Unreconciled bank items",
      message:
        unreconciledBankItems.length > 0
          ? "Some transactions still need matching against the bank statement."
          : "No unreconciled bank items found.",
      count: unreconciledBankItems.length,
      tone: unreconciledBankItems.length > 0 ? "purple" : "emerald",
      icon: FileWarning,
      actionLabel: "Show unreconciled",
      filter: "all",
      searchTerm: "unreconciled bank",
      alertFilter: "bank_unreconciled",
      canFilterTransactions: true,
    },
  ];

  const urgentAlerts = alerts.filter((alert) => alert.count > 0);
  const clearCount = alerts.length - urgentAlerts.length;
  const openAlert = alerts.find((alert) => alert.key === openAlertKey) || null;

  function renderTransactionCard(transaction: Transaction, extra?: ReactNode) {
    const id = transactionId(transaction);
    const localChecked = localCheckedIds.has(id);

    return (
      <TransactionCard
        key={id || transactionReference(transaction)}
        transaction={transaction}
        checking={checkingIds.has(id)}
        localChecked={localChecked}
        onMarkChecked={() => markTransactionCheckedFromModal(transaction)}
        extra={extra}
      />
    );
  }

  function renderModalContent(alert: DashboardAlert) {
    if (alert.key === "unchecked") {
      if (uncheckedTransactions.length === 0) {
        return <EmptyModalState title="All transactions are checked" />;
      }

      return uncheckedTransactions.map((transaction) =>
        renderTransactionCard(
          transaction,
          <div className="rounded-xl bg-amber-500/10 p-3 text-sm font-semibold text-amber-100 ring-1 ring-amber-300/20">
            This transaction is not checked yet.
          </div>
        )
      );
    }

    if (alert.key === "missing-receipts") {
      if (missingReceiptExpenses.length === 0) {
        return <EmptyModalState title="No missing receipts found" />;
      }

      return missingReceiptExpenses.map((transaction) =>
        renderTransactionCard(
          transaction,
          <div className="rounded-xl bg-red-500/10 p-3 text-sm font-semibold text-red-100 ring-1 ring-red-300/20">
            This expense has no receipt, invoice, or proof file uploaded.
          </div>
        )
      );
    }

    if (alert.key === "receipt-overdue") {
      if (overdueReceiptExpenses.length === 0) {
        return (
          <EmptyModalState
            title={`No missing receipts older than ${receiptReminderDaysSafe} days`}
          />
        );
      }

      return overdueReceiptExpenses.map((transaction) => {
        const status = receiptReminderStatus(
          transaction,
          receiptReminderDaysSafe
        );

        return renderTransactionCard(
          transaction,
          <div className="grid gap-3 rounded-xl bg-red-500/10 p-3 text-sm ring-1 ring-red-300/20 sm:grid-cols-3">
            <DetailLine
              label="Receipt rule"
              value={`Receipt expected after ${receiptReminderDaysSafe} day${
                receiptReminderDaysSafe === 1 ? "" : "s"
              }`}
            />

            <DetailLine
              label="Expense age"
              value={`${status.ageDays} day${status.ageDays === 1 ? "" : "s"} old`}
            />

            <DetailLine
              label="Overdue by"
              value={`${status.overdueBy} day${
                status.overdueBy === 1 ? "" : "s"
              }`}
            />

            <DetailLine
              label="Receipt due date"
              value={status.dueDate ? safeDate(status.dueDate) : "No due date"}
            />

            <DetailLine
              label="Created"
              value={safeDateTime(transactionCreatedAt(transaction))}
            />

            <DetailLine
              label="Action needed"
              value="Upload a receipt or invoice, or add a finance note explaining why it is missing."
            />
          </div>
        );
      });
    }

    if (alert.key === "personal-funds") {
      if (unpaidPersonalFunds.length === 0) {
        return <EmptyModalState title="No unpaid personal funds found" />;
      }

      return unpaidPersonalFunds.map((transaction) =>
        renderTransactionCard(
          transaction,
          <div className="grid gap-3 rounded-xl bg-amber-500/10 p-3 text-sm ring-1 ring-amber-300/20 sm:grid-cols-2">
            <DetailLine
              label="Paid by"
              value={
                cleanText(tx(transaction).personal_funds_name) ||
                "No name saved"
              }
            />

            <DetailLine label="Repayment status" value="Not paid back yet" />
          </div>
        )
      );
    }

    if (alert.key === "overspent-funding") {
      if (overspentFunding.length === 0) {
        return <EmptyModalState title="No overspent funding found" />;
      }

      return overspentFunding.map((item) => (
        <FundingCard
          key={
            item.id || item.sponsor_id || item.sponsorId || sponsorName(item)
          }
          item={item}
        />
      ));
    }

    if (alert.key === "failed-csv") {
      if (failedCsvRows.length === 0) {
        return <EmptyModalState title="No failed CSV rows found" />;
      }

      return failedCsvRows.map((row, index) => (
        <FailedCsvCard
          key={`${row.row || row.line || index}`}
          row={row}
          index={index}
        />
      ));
    }

    if (alert.key === "bank-reconciliation") {
      if (unreconciledBankItems.length === 0) {
        return <EmptyModalState title="No unreconciled bank items found" />;
      }

      return unreconciledBankItems.map((transaction) =>
        renderTransactionCard(
          transaction,
          <div className="grid gap-3 rounded-xl bg-purple-500/10 p-3 text-sm ring-1 ring-purple-300/20 sm:grid-cols-2">
            <DetailLine label="Bank status" value={bankStatusLabel(transaction)} />

            <DetailLine
              label="Bank note"
              value={
                cleanText(tx(transaction).bank_reconciliation_note) ||
                "No bank note"
              }
            />
          </div>
        )
      );
    }

    return <EmptyModalState title="Nothing to show" />;
  }

  return (
    <>
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 sm:p-5">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-500/10 px-4 py-2 text-sm font-bold text-amber-100">
              <AlertTriangle className="h-4 w-4" />
              Dashboard alerts
            </div>

            <h2 className="text-2xl font-black text-white">
              Things that need checking
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
              These checks help keep accounts clean before printing reports,
              locking a month, or closing a funding record for {selectedYear}.
              Receipts are flagged as overdue after {receiptReminderDaysSafe}{" "}
              day{receiptReminderDaysSafe === 1 ? "" : "s"}.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/65">
            <strong className="text-white">{urgentAlerts.length}</strong> active
            alert{urgentAlerts.length === 1 ? "" : "s"} ·{" "}
            <strong className="text-white">{clearCount}</strong> clear
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {alerts.map((alert) => {
            const classes = toneClasses(alert.tone);
            const Icon = alert.icon;

            return (
              <div
                key={alert.key}
                className={`rounded-2xl border p-4 ${classes.card}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${classes.icon}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="break-words text-base font-black text-white">
                        {alert.title}
                      </h3>

                      <span className="rounded-full bg-black/25 px-3 py-1 text-xs font-black text-white ring-1 ring-white/10">
                        {alert.count}
                      </span>
                    </div>

                    <p className={`mt-2 text-sm leading-6 ${classes.text}`}>
                      {alert.message}
                    </p>

                    {alert.key === "receipt-overdue" &&
                      overdueReceiptExpenses.length > 0 && (
                        <div className="mt-3 space-y-1 rounded-xl bg-black/20 p-3 text-xs text-white/65">
                          {overdueReceiptExpenses.slice(0, 3).map((item) => {
                            const status = receiptReminderStatus(
                              item,
                              receiptReminderDaysSafe
                            );

                            return (
                              <div
                                key={
                                  transactionId(item) ||
                                  transactionReference(item)
                                }
                                className="flex items-center justify-between gap-3"
                              >
                                <span className="break-words font-bold text-white/80">
                                  {transactionTitle(item)}
                                </span>

                                <span className="shrink-0 text-red-100">
                                  {status.overdueBy} day
                                  {status.overdueBy === 1 ? "" : "s"} overdue
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                    {alert.key === "overspent-funding" &&
                      overspentFunding.length > 0 && (
                        <div className="mt-3 space-y-1 rounded-xl bg-black/20 p-3 text-xs text-white/65">
                          {overspentFunding.slice(0, 3).map((item) => (
                            <div
                              key={
                                item.id ||
                                item.sponsor_id ||
                                item.sponsorId ||
                                sponsorName(item)
                              }
                              className="flex items-center justify-between gap-3"
                            >
                              <span className="break-words font-bold text-white/80">
                                {sponsorName(item)}
                              </span>

                              <span className="shrink-0 text-red-100">
                                {money(Math.abs(remainingPence(item)))}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                    {alert.key === "failed-csv" && failedCsvRows.length > 0 && (
                      <div className="mt-3 space-y-1 rounded-xl bg-black/20 p-3 text-xs text-white/65">
                        {failedCsvRows.slice(0, 3).map((row, index) => (
                          <div key={`${row.row || row.line || index}`}>
                            Row {row.row || row.line || index + 1}:{" "}
                            {row.error || row.reason || row.message || "Failed"}
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setOpenAlertKey(alert.key);
                        setSuccessMessage(null);
                        setErrorMessage(null);
                      }}
                      className={`mt-3 inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-black ring-1 ${classes.button}`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {alert.actionLabel}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {openAlert && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpenAlertKey(null); }}>
          <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#10101f] shadow-2xl shadow-black" role="dialog" aria-modal="true" aria-labelledby="money-alert-dialog-title" aria-describedby="money-alert-dialog-description">
            <div className="border-b border-white/10 bg-white/[0.04] p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div
                    className={`inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-black ${
                      toneClasses(openAlert.tone).modalTitle
                    }`}
                  >
                    {(() => { const OpenAlertIcon = openAlert.icon; return <OpenAlertIcon className="h-4 w-4" />; })()}
                    {openAlert.count} item{openAlert.count === 1 ? "" : "s"}
                  </div>

                  <h3 id="money-alert-dialog-title" className="mt-3 break-words text-2xl font-black text-white">
                    {openAlert.title}
                  </h3>

                  <p id="money-alert-dialog-description" className="mt-2 text-sm leading-6 text-white/60">
                    {openAlert.message}
                  </p>
                </div>

                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={() => setOpenAlertKey(null)}
                  aria-label="Close alert window"
                  className="rounded-2xl bg-white/10 p-3 text-white hover:bg-white/20"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {successMessage && (
                <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-100">
                  <CheckCircle2 className="mr-2 inline h-4 w-4" />
                  {successMessage}
                </div>
              )}

              {errorMessage && (
                <div className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

                    <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-red-100">
                      {errorMessage}
                    </pre>
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() =>
                    applyAlertFilter(openAlert)
                  }
                  disabled={openAlert.count === 0 || !openAlert.canFilterTransactions}
                  className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-black text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {openAlert.canFilterTransactions ? "Filter transaction table" : "Shown in this window"}
                </button>

                <button
                  type="button"
                  onClick={() => setOpenAlertKey(null)}
                  className="inline-flex items-center justify-center rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/20"
                >
                  Close window
                </button>

                {checkingIds.size > 0 && (
                  <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-100 ring-1 ring-emerald-300/20">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving check...
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="space-y-3">{renderModalContent(openAlert)}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}