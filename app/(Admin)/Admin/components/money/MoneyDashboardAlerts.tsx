"use client";

import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  FileWarning,
  ReceiptText,
  ShieldAlert,
  UploadCloud,
  WalletCards,
  XCircle,
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

type Props = {
  selectedYear: string;
  transactions: Transaction[];
  yearlySponsorBreakdown?: SponsorBreakdown[];
  failedCsvRows?: FailedCsvRow[];
  onSetFilter?: (filter: MoneyFilter) => void;
  onSetSearchTerm?: (term: string) => void;
};

type DashboardAlert = {
  key: string;
  title: string;
  message: string;
  count: number;
  tone: "red" | "amber" | "sky" | "purple" | "emerald";
  icon: any;
  actionLabel?: string;
  onAction?: () => void;
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

function lower(value: unknown) {
  return cleanText(value).toLowerCase();
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
  return Boolean(
    cleanText((transaction as any).invoice_image_url) ||
      cleanText((transaction as any).receipt_url) ||
      cleanText((transaction as any).receiptUrl) ||
      cleanText((transaction as any).invoice_url) ||
      cleanText((transaction as any).invoiceUrl),
  );
}

function isChecked(transaction: Transaction) {
  return Boolean(
    (transaction as any).checked_at ||
      (transaction as any).checked_by ||
      (transaction as any).checked === true ||
      (transaction as any).is_checked === true,
  );
}

function bankStatus(transaction: Transaction) {
  return lower(
    (transaction as any).bank_reconciliation_status ||
      (transaction as any).bankReconciliationStatus ||
      (transaction as any).bank_status ||
      (transaction as any).bankStatus,
  );
}

function isUnreconciled(transaction: Transaction) {
  const status = bankStatus(transaction);

  if (!status) return true;

  return (
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
      0,
  );
}

function spentPence(item: SponsorBreakdown) {
  return Number(
    item.spent_pence ?? item.spentPence ?? item.spent_amount_pence ?? 0,
  );
}

function remainingPence(item: SponsorBreakdown) {
  const explicit = item.remaining_pence ?? item.remainingPence;

  if (explicit !== undefined && explicit !== null) return Number(explicit);

  return receivedPence(item) - spentPence(item);
}

function toneClasses(tone: DashboardAlert["tone"]) {
  if (tone === "red") {
    return {
      card: "border-red-300/25 bg-red-500/10",
      icon: "bg-red-500/15 text-red-100 ring-red-300/20",
      text: "text-red-100/75",
      button: "bg-red-500/20 text-red-100 ring-red-300/20 hover:bg-red-500/30",
    };
  }

  if (tone === "amber") {
    return {
      card: "border-amber-300/25 bg-amber-500/10",
      icon: "bg-amber-500/15 text-amber-100 ring-amber-300/20",
      text: "text-amber-100/75",
      button:
        "bg-amber-500/20 text-amber-100 ring-amber-300/20 hover:bg-amber-500/30",
    };
  }

  if (tone === "sky") {
    return {
      card: "border-sky-300/25 bg-sky-500/10",
      icon: "bg-sky-500/15 text-sky-100 ring-sky-300/20",
      text: "text-sky-100/75",
      button: "bg-sky-500/20 text-sky-100 ring-sky-300/20 hover:bg-sky-500/30",
    };
  }

  if (tone === "purple") {
    return {
      card: "border-purple-300/25 bg-purple-500/10",
      icon: "bg-purple-500/15 text-purple-100 ring-purple-300/20",
      text: "text-purple-100/75",
      button:
        "bg-purple-500/20 text-purple-100 ring-purple-300/20 hover:bg-purple-500/30",
    };
  }

  return {
    card: "border-emerald-300/25 bg-emerald-500/10",
    icon: "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20",
    text: "text-emerald-100/75",
    button:
      "bg-emerald-500/20 text-emerald-100 ring-emerald-300/20 hover:bg-emerald-500/30",
  };
}

export default function MoneyDashboardAlerts({
  selectedYear,
  transactions,
  yearlySponsorBreakdown = [],
  failedCsvRows = [],
  onSetFilter,
  onSetSearchTerm,
}: Props) {
  const activeTransactions = transactions
    .filter((transaction) => !isDeleted(transaction))
    .filter((transaction) => isForSelectedYear(transaction, selectedYear));

  const uncheckedTransactions = activeTransactions.filter(
    (transaction) => !isChecked(transaction),
  );

  const missingReceiptExpenses = activeTransactions.filter(
    (transaction) => isExpense(transaction) && !hasReceipt(transaction),
  );

  const unpaidPersonalFunds = activeTransactions.filter(
    (transaction) =>
      isPersonalFunds(transaction) && !isPersonalFundsPaidBack(transaction),
  );

  const unreconciledBankItems = activeTransactions.filter(isUnreconciled);

  const overspentFunding = yearlySponsorBreakdown.filter(
    (item) => remainingPence(item) < 0,
  );

  const overspentFundingTotal = overspentFunding.reduce(
    (sum, item) => sum + Math.abs(remainingPence(item)),
    0,
  );

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
      onAction: () => {
        onSetFilter?.("all");
        onSetSearchTerm?.("unchecked");
      },
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
      actionLabel: "Search receipts",
      onAction: () => {
        onSetFilter?.("expense");
        onSetSearchTerm?.("receipt");
      },
    },
    {
      key: "personal-funds",
      title: "Unpaid personal funds",
      message:
        unpaidPersonalFunds.length > 0
          ? `Outstanding personal funds total ${money(
              unpaidPersonalFunds.reduce(
                (sum, item) => sum + Number((item as any).amount_pence || 0),
                0,
              ),
            )}.`
          : "No unpaid personal funds found.",
      count: unpaidPersonalFunds.length,
      tone: unpaidPersonalFunds.length > 0 ? "amber" : "emerald",
      icon: WalletCards,
      actionLabel: "Show personal funds",
      onAction: () => {
        onSetFilter?.("personal");
        onSetSearchTerm?.("personal funds");
      },
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
      actionLabel: "Search funding",
      onAction: () => {
        const firstName = sponsorName(overspentFunding[0] || {});
        if (firstName && firstName !== "Funding record") {
          onSetSearchTerm?.(firstName);
        }
      },
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
      onAction: () => {
        onSetSearchTerm?.("csv");
      },
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
      actionLabel: "Show bank queries",
      onAction: () => {
        onSetSearchTerm?.("bank");
      },
    },
  ];

  const urgentAlerts = alerts.filter((alert) => alert.count > 0);
  const clearCount = alerts.length - urgentAlerts.length;

  return (
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

                  {alert.onAction && alert.count > 0 && (
                    <button
                      type="button"
                      onClick={alert.onAction}
                      className={`mt-3 inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-black ring-1 ${classes.button}`}
                    >
                      {alert.actionLabel || "View"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
