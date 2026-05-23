"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Banknote,
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
  raw?: any;
};

type MoneyFilter = "all" | "income" | "expense" | "sponsorship" | "personal";

type AlertKey =
  | "unchecked"
  | "missing-receipts"
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
  icon: any;
  actionLabel: string;
  filter: MoneyFilter;
  searchTerm: string;
};

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format((Number(value) || 0) / 100);
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function getDetailedErrorMessage(error: unknown) {
  if (!error) {
    return "Unknown error: no error details were returned.";
  }

  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return "Unknown error: could not read error details.";
  }
}

function lower(value: unknown) {
  return cleanText(value).toLowerCase();
}

function safeDate(value: unknown) {
  const cleanValue = cleanText(value);

  if (!cleanValue) return "No date";

  const date = new Date(cleanValue);

  if (Number.isNaN(date.getTime())) return cleanValue;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function transactionId(transaction: Transaction) {
  return cleanText((transaction as any).id);
}

function transactionYear(transaction: Transaction) {
  const dateValue =
    (transaction as any).transaction_date ||
    (transaction as any).date ||
    transaction.created_at ||
    "";

  const date = new Date(String(dateValue));

  if (Number.isNaN(date.getTime())) return "";

  return String(date.getFullYear());
}

function transactionDate(transaction: Transaction) {
  return (
    (transaction as any).transaction_date ||
    (transaction as any).date ||
    transaction.created_at ||
    ""
  );
}

function isForSelectedYear(transaction: Transaction, selectedYear: string) {
  if (!selectedYear || selectedYear === "all") return true;

  const year = transactionYear(transaction);
  return !year || year === selectedYear;
}

function isExpense(transaction: Transaction) {
  return lower(transaction.type) === "expense";
}

function isDeleted(transaction: Transaction) {
  return Boolean((transaction as any).deleted_at);
}

function isPersonalFunds(transaction: Transaction) {
  return (
    Boolean((transaction as any).is_personal_funds) ||
    Boolean((transaction as any).isPersonalFunds) ||
    lower(transaction.payment_method) === "personal funds"
  );
}

function isPersonalFundsPaidBack(transaction: Transaction) {
  return (
    Boolean((transaction as any).personal_funds_repaid) ||
    Boolean((transaction as any).personalFundsRepaid)
  );
}

function hasReceipt(transaction: Transaction) {
  const attachments = Array.isArray((transaction as any).attachments)
    ? (transaction as any).attachments
    : [];

  return Boolean(
    attachments.length > 0 ||
      cleanText((transaction as any).invoice_image_url) ||
      cleanText((transaction as any).receipt_url) ||
      cleanText((transaction as any).receiptUrl) ||
      cleanText((transaction as any).invoice_url) ||
      cleanText((transaction as any).invoiceUrl)
  );
}

function isChecked(transaction: Transaction) {
  return Boolean(
    (transaction as any).checked_at ||
      (transaction as any).checked_by ||
      (transaction as any).checked === true ||
      (transaction as any).is_checked === true
  );
}

function checkedBy(transaction: Transaction) {
  return (
    cleanText((transaction as any).checked_by_name) ||
    cleanText((transaction as any).checked_by) ||
    cleanText((transaction as any).checked_by_email) ||
    "Unknown admin"
  );
}

function checkedStatusLabel(transaction: Transaction, localChecked: boolean) {
  if (localChecked) return "Checked just now";
  if (!isChecked(transaction)) return "Not checked";

  return `Checked by ${checkedBy(transaction)}`;
}

function bankStatus(transaction: Transaction) {
  return lower(
    (transaction as any).bank_reconciliation_status ||
      (transaction as any).bankReconciliationStatus ||
      (transaction as any).bank_status ||
      (transaction as any).bankStatus
  );
}

function bankStatusLabel(transaction: Transaction) {
  return (
    cleanText(
      (transaction as any).bank_reconciliation_status ||
        (transaction as any).bankReconciliationStatus ||
        (transaction as any).bank_status ||
        (transaction as any).bankStatus
    ) || "Unmatched"
  );
}

function isUnreconciled(transaction: Transaction) {
  const status = bankStatus(transaction);

  if (!status) return true;

  return (
    status === "unmatched" ||
    status === "unreconciled" ||
    status.includes("unreconciled") ||
    status.includes("pending") ||
    status.includes("query") ||
    status.includes("not matched") ||
    status.includes("not_matched") ||
    status.includes("missing") ||
    status === "todo" ||
    status === "to_do"
  );
}

function sponsorName(item: SponsorBreakdown) {
  return (
    cleanText(item.sponsor_name) ||
    cleanText(item.sponsorName) ||
    cleanText(item.name) ||
    "Funding record"
  );
}

function receivedPence(item: SponsorBreakdown) {
  return Number(
    item.received_pence ??
      item.receivedPence ??
      item.received_amount_pence ??
      0
  );
}

function spentPence(item: SponsorBreakdown) {
  return Number(
    item.spent_pence ?? item.spentPence ?? item.spent_amount_pence ?? 0
  );
}

function remainingPence(item: SponsorBreakdown) {
  const explicit = item.remaining_pence ?? item.remainingPence;

  if (explicit !== undefined && explicit !== null) return Number(explicit);

  return receivedPence(item) - spentPence(item);
}

function transactionTitle(transaction: Transaction) {
  return cleanText((transaction as any).title) || "Untitled transaction";
}

function transactionReference(transaction: Transaction) {
  return cleanText((transaction as any).transaction_reference) || "No reference";
}

function transactionAmount(transaction: Transaction) {
  return money(Number((transaction as any).amount_pence || 0));
}

function transactionPayment(transaction: Transaction) {
  return cleanText((transaction as any).payment_method) || "No payment method";
}

function transactionFunding(transaction: Transaction) {
  return (
    cleanText((transaction as any).sponsor_name) ||
    cleanText((transaction as any).funding_name) ||
    cleanText((transaction as any).grant_name) ||
    "No funding record"
  );
}

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
  const type = lower((transaction as any).type);

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
          value={type === "income" ? "Money In" : "Money Out"}
        />

        <DetailLine label="Payment" value={transactionPayment(transaction)} />

        <DetailLine label="Funding" value={transactionFunding(transaction)} />

        <DetailLine
          label="Checked"
          value={checkedStatusLabel(transaction, localChecked)}
        />
      </div>

      {cleanText((transaction as any).description) && (
        <div className="mt-3 rounded-xl bg-white/5 p-3 text-sm leading-6 text-white/60">
          {(transaction as any).description}
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

      {row.raw && (
        <pre className="mt-3 max-h-48 overflow-auto rounded-xl bg-black/40 p-3 text-xs text-white/60">
          {typeof row.raw === "string"
            ? row.raw
            : JSON.stringify(row.raw, null, 2)}
        </pre>
      )}
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
  onMarkTransactionChecked,
}: Props) {
  const [openAlertKey, setOpenAlertKey] = useState<AlertKey | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [localCheckedIds, setLocalCheckedIds] = useState<Set<string>>(
    () => new Set()
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    (sum, item) => sum + Number((item as any).amount_pence || 0),
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
      setCheckingId(id);

      await onMarkTransactionChecked(transaction);

      setLocalCheckedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });

      setSuccessMessage(
        `Transaction marked as checked: ${title}. The database has been updated and the audit log will show who did it.`
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
      setCheckingId(null);
    }
  }

  function applyAlertFilter(filter: MoneyFilter, search: string) {
    onSetFilter?.(filter);
    onSetSearchTerm?.(search);
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
      searchTerm: "overspent funding",
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
      searchTerm: "failed csv",
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
        checking={checkingId === id}
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
                cleanText((transaction as any).personal_funds_name) ||
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
                cleanText((transaction as any).bank_reconciliation_note) ||
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
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6">
          <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#10101f] shadow-2xl shadow-black">
            <div className="border-b border-white/10 bg-white/[0.04] p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div
                    className={`inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-black ${
                      toneClasses(openAlert.tone).modalTitle
                    }`}
                  >
                    <openAlert.icon className="h-4 w-4" />
                    {openAlert.count} item{openAlert.count === 1 ? "" : "s"}
                  </div>

                  <h3 className="mt-3 break-words text-2xl font-black text-white">
                    {openAlert.title}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-white/60">
                    {openAlert.message}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setOpenAlertKey(null)}
                  className="rounded-2xl bg-white/10 p-3 text-white hover:bg-white/20"
                  title="Close"
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
                    applyAlertFilter(openAlert.filter, openAlert.searchTerm)
                  }
                  disabled={openAlert.count === 0}
                  className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-black text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Filter transaction table
                </button>

                <button
                  type="button"
                  onClick={() => setOpenAlertKey(null)}
                  className="inline-flex items-center justify-center rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/20"
                >
                  Close window
                </button>

                {checkingId && (
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