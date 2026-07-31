"use client";

import {
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  Download,
  FileText,
  Loader2,
  Pencil,
  Printer,
  Search,
  Trash2,
} from "lucide-react";

import type { Sponsor, Transaction } from "@/lib/money/types";
import {
  formatDate,
  isPersonalFundsTransaction,
  isSponsorshipTransaction,
  money,
  monthNameFromKey,
  none,
} from "@/lib/money/utils";

type MonthOption = {
  key: string;
  label: string;
  count: number;
};

type TransactionFilter =
  | "all"
  | "income"
  | "expense"
  | "sponsorship"
  | "personal";

type AsyncAction = () => void | Promise<void>;

type TransactionsPanelProps = {
  loading: boolean;
  filteredTransactions?: Transaction[];
  yearTransactions?: Transaction[];
  transactions?: Transaction[];

  selectedYear: string;
  selectedViewMonth: string;
  selectedPrintMonth: string;
  setSelectedPrintMonth: Dispatch<SetStateAction<string>>;
  setSelectedViewMonth: Dispatch<SetStateAction<string>>;

  searchTerm: string;
  setSearchTerm: Dispatch<SetStateAction<string>>;

  filter: TransactionFilter;
  setFilter: Dispatch<SetStateAction<TransactionFilter>>;

  selectedSponsorId: string;
  setSelectedSponsorId: Dispatch<SetStateAction<string>>;
  displaySponsors?: Sponsor[];
  selectedSponsor?: Sponsor | null;

  printMonthOptions?: MonthOption[];
  printTransactionsList?: Transaction[];

  deletingYear: boolean;
  deletingAll: boolean;
  deleting: boolean;
  repayingId: string | null;

  setDeleteYearOpen: Dispatch<SetStateAction<boolean>>;
  setDeleteAllOpen: Dispatch<SetStateAction<boolean>>;
  setDeleteId: Dispatch<SetStateAction<string | null>>;

  startEditTransaction: (item: Transaction) => void;
  togglePersonalFundsRepaid: (item: Transaction) => Promise<void>;
  printTransactions: AsyncAction;
  exportTransactionsToExcel: AsyncAction;
  exportFullYearlyReport: AsyncAction;
};

type ActionButtonTone = "sky" | "emerald" | "purple" | "orange" | "red";
type ActionKey = "print" | "excel" | "year-report";

const FILTER_OPTIONS: { value: TransactionFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "income", label: "Money In" },
  { value: "expense", label: "Money Out" },
  { value: "personal", label: "Personal Funds" },
  { value: "sponsorship", label: "Sponsor / Grant" },
];

const ACTION_BUTTON_CLASS: Record<ActionButtonTone, string> = {
  sky: "bg-sky-500/15 text-sky-200 ring-sky-300/20 hover:bg-sky-500/25",
  emerald:
    "bg-emerald-500/15 text-emerald-200 ring-emerald-300/20 hover:bg-emerald-500/25",
  purple:
    "bg-purple-500/15 text-purple-200 ring-purple-300/20 hover:bg-purple-500/25",
  orange:
    "bg-orange-500/15 text-orange-200 ring-orange-300/20 hover:bg-orange-500/25",
  red: "bg-red-500/15 text-red-200 ring-red-300/20 hover:bg-red-500/25",
};

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function safeCount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function readBoolean(value: unknown): boolean {
  if (value === true || value === 1 || value === "1") return true;

  const normalised = cleanText(value).toLowerCase();
  return normalised === "true" || normalised === "yes";
}

function safeTransactionId(item: Transaction): string {
  return cleanText(item.id);
}

function transactionRenderKey(item: Transaction, index: number): string {
  return (
    safeTransactionId(item) ||
    [
      cleanText(item.transaction_date),
      cleanText(item.title),
      cleanText(item.amount_pence),
      index,
    ].join(":")
  );
}

function normaliseMonthOptions(options: MonthOption[]): MonthOption[] {
  const seen = new Set<string>();

  return options
    .map((item) => ({
      key: cleanText(item.key),
      label: cleanText(item.label) || cleanText(item.key),
      count: safeCount(item.count),
    }))
    .filter((item) => item.key.length > 0)
    .filter((item) => {
      if (seen.has(item.key)) return false;
      seen.add(item.key);
      return true;
    });
}

function viewLabel(selectedYear: string, selectedViewMonth: string): string {
  const year = cleanText(selectedYear);
  const month = cleanText(selectedViewMonth).toLowerCase();

  if (!month || month === "all") {
    return year.toLowerCase() === "all"
      ? "all years"
      : year || "selected year";
  }

  const monthName = cleanText(monthNameFromKey(month)) || month;

  return year && year.toLowerCase() !== "all"
    ? `${monthName} ${year}`
    : monthName;
}

function printButtonLabel(selectedPrintMonth: string): string {
  const month = cleanText(selectedPrintMonth).toLowerCase();

  if (!month || month === "all") return "Print Year";

  const label = cleanText(monthNameFromKey(month)) || month;
  return `Print ${label.split(" ")[0]}`;
}

function validExternalUrl(value: unknown): string {
  const text = cleanText(value);
  if (!text) return "";

  try {
    const url = new URL(text, window.location.origin);

    if (!["http:", "https:"].includes(url.protocol)) {
      return "";
    }

    return url.href;
  } catch {
    return "";
  }
}

function ActionButton({
  children,
  disabled,
  onClick,
  tone,
  busy = false,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: AsyncAction;
  tone: ActionButtonTone;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={disabled || busy}
      aria-busy={busy}
      className={`inline-flex min-w-[135px] flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none ${ACTION_BUTTON_CLASS[tone]}`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

function EmptyState({
  selectedYear,
  selectedViewMonth,
}: {
  selectedYear: string;
  selectedViewMonth: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
      No transactions found for {viewLabel(selectedYear, selectedViewMonth)}.
    </div>
  );
}

function StatusPill({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex max-w-full rounded-2xl px-3 py-1 text-xs font-bold ring-1 ${className}`}
    >
      <span className="break-words">{children}</span>
    </span>
  );
}

function PersonalRepaymentCell({
  item,
  repayingId,
  togglePersonalFundsRepaid,
}: {
  item: Transaction;
  repayingId: string | null;
  togglePersonalFundsRepaid: (item: Transaction) => Promise<void>;
}) {
  const id = safeTransactionId(item);
  const repaid = readBoolean(item.personal_funds_repaid);
  const busy = Boolean(id && repayingId === id);

  return (
    <div className="space-y-2">
      <div
        className={`rounded-2xl px-3 py-2 text-xs font-bold ring-1 ${
          repaid
            ? "bg-emerald-500/15 text-emerald-200 ring-emerald-300/20"
            : "bg-orange-500/15 text-orange-200 ring-orange-300/20"
        }`}
      >
        {repaid ? "Paid back" : "Not paid back"}
        {cleanText(item.personal_funds_repaid_at) ? (
          <div className="mt-1 text-[11px] font-semibold text-white/65">
            {formatDate(item.personal_funds_repaid_at)}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        disabled={busy || !id}
        onClick={() => void togglePersonalFundsRepaid(item)}
        aria-busy={busy}
        className={`w-full rounded-xl px-3 py-2 text-xs font-bold ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-60 ${
          repaid
            ? "bg-orange-500/15 text-orange-200 ring-orange-300/20 hover:bg-orange-500/25"
            : "bg-emerald-500/15 text-emerald-200 ring-emerald-300/20 hover:bg-emerald-500/25"
        }`}
      >
        {busy
          ? "Updating..."
          : repaid
            ? "Mark not paid back"
            : "Mark paid back"}
      </button>
    </div>
  );
}

function AmountCell({ item }: { item: Transaction }) {
  const isPersonal = isPersonalFundsTransaction(item);
  const hasSponsor = isSponsorshipTransaction(item);
  const repaid = readBoolean(item.personal_funds_repaid);

  return (
    <div className="whitespace-nowrap text-right font-bold">
      <div>{money(Number(item.amount_pence) || 0)}</div>

      {hasSponsor ? (
        <div className="mt-1 text-xs font-semibold text-amber-300">
          {item.type === "income" ? "Sponsor money in" : "Sponsor-funded spend"}
        </div>
      ) : null}

      {isPersonal ? (
        <div
          className={`mt-1 text-xs font-semibold ${
            repaid ? "text-emerald-300" : "text-orange-300"
          }`}
        >
          {repaid ? "Taken from balance" : "Not taken yet"}
        </div>
      ) : null}
    </div>
  );
}

function TransactionsTable({
  transactions,
  deleting,
  repayingId,
  startEditTransaction,
  setDeleteId,
  togglePersonalFundsRepaid,
}: {
  transactions: Transaction[];
  deleting: boolean;
  repayingId: string | null;
  startEditTransaction: (item: Transaction) => void;
  setDeleteId: Dispatch<SetStateAction<string | null>>;
  togglePersonalFundsRepaid: (item: Transaction) => Promise<void>;
}) {
  return (
    <div
      className="w-full max-w-[calc(100vw-2rem)] overflow-x-auto rounded-2xl border border-white/10 xl:max-w-full"
      role="region"
      aria-label="Money transactions table"
      tabIndex={0}
    >
      <table className="w-full min-w-[1050px] text-sm">
        <thead className="bg-white/10 text-white/60">
          <tr>
            <th scope="col" className="p-3 text-left">Date</th>
            <th scope="col" className="p-3 text-left">Transaction</th>
            <th scope="col" className="p-3 text-left">Type</th>
            <th scope="col" className="p-3 text-left">Sponsor / grant</th>
            <th scope="col" className="p-3 text-left">Personal funds</th>
            <th scope="col" className="p-3 text-left">Payment</th>
            <th scope="col" className="p-3 text-left">Invoice</th>
            <th scope="col" className="p-3 text-right">Amount</th>
            <th
              scope="col"
              className="sticky right-0 z-10 bg-[#11111f] p-3 text-right shadow-[-12px_0_18px_rgba(0,0,0,0.35)]"
            >
              Actions
            </th>
          </tr>
        </thead>

        <tbody>
          {transactions.map((item, index) => {
            const id = safeTransactionId(item);
            const isPersonal = isPersonalFundsTransaction(item);
            const hasSponsor = isSponsorshipTransaction(item);
            const invoiceUrl = validExternalUrl(item.invoice_image_url);

            return (
              <tr
                key={transactionRenderKey(item, index)}
                className="border-t border-white/10 align-top"
              >
                <td className="whitespace-nowrap p-3 text-white/75">
                  {none(item.transaction_date)}
                </td>

                <td className="max-w-[300px] p-3">
                  <p className="break-words font-semibold text-white">
                    {cleanText(item.title) || "Untitled transaction"}
                  </p>

                  {cleanText(item.description) ? (
                    <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-white/50">
                      {cleanText(item.description)}
                    </p>
                  ) : null}

                  {cleanText(item.sponsorship_note) ? (
                    <p className="mt-2 line-clamp-2 break-words rounded-xl bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100">
                      {cleanText(item.sponsorship_note)}
                    </p>
                  ) : null}
                </td>

                <td className="whitespace-nowrap p-3">
                  <StatusPill
                    className={
                      item.type === "income"
                        ? "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20"
                        : item.type === "expense"
                          ? "bg-red-500/15 text-red-100 ring-red-300/20"
                          : "bg-white/10 text-white/70 ring-white/10"
                    }
                  >
                    {item.type === "income"
                      ? "Money In"
                      : item.type === "expense"
                        ? "Money Out"
                        : cleanText(item.type) || "Unknown"}
                  </StatusPill>
                </td>

                <td className="max-w-[190px] p-3">
                  {hasSponsor ? (
                    <StatusPill className="bg-amber-500/20 text-amber-100 ring-amber-300/20">
                      {cleanText(item.sponsor_name) || "Sponsor / grant"}
                    </StatusPill>
                  ) : (
                    <span className="text-white/35">None</span>
                  )}
                </td>

                <td className="max-w-[190px] p-3">
                  {isPersonal ? (
                    <div className="space-y-2">
                      <StatusPill className="bg-sky-500/20 text-sky-100 ring-sky-300/20">
                        Personal funds
                      </StatusPill>

                      {cleanText(item.personal_funds_name) ? (
                        <p className="break-words text-sm font-semibold text-sky-200">
                          {cleanText(item.personal_funds_name)}
                        </p>
                      ) : null}

                      <PersonalRepaymentCell
                        item={item}
                        repayingId={repayingId}
                        togglePersonalFundsRepaid={togglePersonalFundsRepaid}
                      />
                    </div>
                  ) : (
                    <span className="text-white/35">None</span>
                  )}
                </td>

                <td className="whitespace-nowrap p-3 text-white/75">
                  {cleanText(item.payment_method) || "None"}
                </td>

                <td className="p-3">
                  {invoiceUrl ? (
                    <a
                      href={invoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                      aria-label={`View invoice for ${cleanText(item.title) || "transaction"}`}
                    >
                      <FileText className="h-4 w-4" aria-hidden="true" />
                      View
                    </a>
                  ) : (
                    <span className="text-white/35">None</span>
                  )}
                </td>

                <td className="p-3">
                  <AmountCell item={item} />
                </td>

                <td className="sticky right-0 z-10 bg-[#11111f] p-3 text-right shadow-[-12px_0_18px_rgba(0,0,0,0.35)]">
                  <div className="inline-flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => startEditTransaction(item)}
                      className="inline-flex items-center justify-center rounded-xl bg-sky-500/15 p-2 text-sky-200 hover:bg-sky-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                      aria-label={`Edit ${cleanText(item.title) || "transaction"}`}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      disabled={deleting || !id}
                      onClick={() => {
                        if (id) setDeleteId(id);
                      }}
                      className="inline-flex items-center justify-center rounded-xl bg-red-500/15 p-2 text-red-200 hover:bg-red-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={`Hide ${cleanText(item.title) || "transaction"}`}
                      title={id ? "Hide transaction" : "Missing transaction ID"}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function TransactionsPanel({
  loading,
  filteredTransactions = [],
  yearTransactions = [],
  transactions = [],
  selectedYear,
  selectedViewMonth,
  selectedPrintMonth,
  setSelectedPrintMonth,
  setSelectedViewMonth,
  searchTerm,
  setSearchTerm,
  filter,
  setFilter,
  selectedSponsorId,
  setSelectedSponsorId,
  displaySponsors = [],
  selectedSponsor = null,
  printMonthOptions = [],
  printTransactionsList = [],
  deletingYear,
  deletingAll,
  deleting,
  repayingId,
  setDeleteYearOpen,
  setDeleteAllOpen,
  setDeleteId,
  startEditTransaction,
  togglePersonalFundsRepaid,
  printTransactions,
  exportTransactionsToExcel,
  exportFullYearlyReport,
}: TransactionsPanelProps) {
  const [busyAction, setBusyAction] = useState<ActionKey | null>(null);
  const [actionError, setActionError] = useState("");

  const monthOptions = useMemo(
    () => normaliseMonthOptions(printMonthOptions),
    [printMonthOptions],
  );

  const sponsors = useMemo(() => {
    const seen = new Set<string>();

    return displaySponsors.filter((sponsor) => {
      const id = cleanText(sponsor.id);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [displaySponsors]);

  const currentViewLabel = viewLabel(selectedYear, selectedViewMonth);

  async function runAction(key: ActionKey, action: AsyncAction) {
    if (busyAction) return;

    setBusyAction(key);
    setActionError("");

    try {
      await action();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "The requested action could not be completed.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section
      aria-labelledby="transactions-panel-title"
      className="min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-5"
    >
      {actionError ? (
        <div
          role="alert"
          className="mb-4 rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm text-red-100"
        >
          {actionError}
        </div>
      ) : null}

      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 id="transactions-panel-title" className="text-xl font-black text-white">
            Transactions
          </h2>

          <p className="mt-1 text-sm text-white/55">
            {filteredTransactions.length} transaction
            {filteredTransactions.length === 1 ? "" : "s"} showing for{" "}
            {currentViewLabel}.
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-3 2xl:flex 2xl:flex-wrap 2xl:justify-end">
          <select
            aria-label="Choose print month"
            value={
              monthOptions.some((item) => item.key === selectedPrintMonth)
                ? selectedPrintMonth
                : monthOptions[0]?.key ?? ""
            }
            onChange={(event) => setSelectedPrintMonth(event.target.value)}
            disabled={monthOptions.length === 0 || Boolean(busyAction)}
            className="min-w-0 rounded-xl bg-black/30 px-3 py-2 text-sm font-bold text-white outline-none ring-1 ring-sky-300/20 focus-visible:ring-2 focus-visible:ring-sky-300/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {monthOptions.length === 0 ? (
              <option className="bg-[#11111f] text-white" value="">
                No print periods available
              </option>
            ) : (
              monthOptions.map((month) => (
                <option
                  key={month.key}
                  value={month.key}
                  className="bg-[#11111f] text-white"
                >
                  Print {month.label} ({month.count})
                </option>
              ))
            )}
          </select>

          <ActionButton
            tone="sky"
            onClick={() => runAction("print", printTransactions)}
            disabled={printTransactionsList.length === 0}
            busy={busyAction === "print"}
          >
            {busyAction !== "print" ? <Printer className="h-4 w-4" aria-hidden="true" /> : null}
            {printButtonLabel(selectedPrintMonth)}
          </ActionButton>

          <ActionButton
            tone="emerald"
            onClick={() => runAction("excel", exportTransactionsToExcel)}
            disabled={filteredTransactions.length === 0}
            busy={busyAction === "excel"}
          >
            {busyAction !== "excel" ? <Download className="h-4 w-4" aria-hidden="true" /> : null}
            Export Excel
          </ActionButton>

          <ActionButton
            tone="purple"
            onClick={() => runAction("year-report", exportFullYearlyReport)}
            disabled={yearTransactions.length === 0}
            busy={busyAction === "year-report"}
          >
            {busyAction !== "year-report" ? <FileText className="h-4 w-4" aria-hidden="true" /> : null}
            Yearly Report
          </ActionButton>

          <ActionButton
            tone="orange"
            onClick={() => setDeleteYearOpen(true)}
            disabled={yearTransactions.length === 0 || deletingYear || Boolean(busyAction)}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete {cleanText(selectedYear) || "Year"}
          </ActionButton>

          <ActionButton
            tone="red"
            onClick={() => setDeleteAllOpen(true)}
            disabled={transactions.length === 0 || deletingAll || Boolean(busyAction)}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete All
          </ActionButton>
        </div>
      </div>

      <div className="mb-5 grid gap-3 xl:grid-cols-[1fr_auto] xl:items-end">
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              <span className="mb-2 block text-xs font-black uppercase tracking-wide text-white/45">
                View month
              </span>

              <select
                value={
                  monthOptions.some((item) => item.key === selectedViewMonth)
                    ? selectedViewMonth
                    : monthOptions[0]?.key ?? ""
                }
                onChange={(event) => {
                  setSelectedViewMonth(event.target.value);
                  setSearchTerm("");
                }}
                disabled={monthOptions.length === 0}
                className="w-full rounded-xl bg-black/30 p-3 text-sm font-bold text-white outline-none ring-1 ring-white/10 focus-visible:ring-2 focus-visible:ring-sky-300/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {monthOptions.length === 0 ? (
                  <option className="bg-[#11111f] text-white" value="">
                    No months available
                  </option>
                ) : (
                  monthOptions.map((month) => (
                    <option
                      key={month.key}
                      value={month.key}
                      className="bg-[#11111f] text-white"
                    >
                      {month.label} ({month.count})
                    </option>
                  ))
                )}
              </select>
            </label>

            <label>
              <span className="mb-2 block text-xs font-black uppercase tracking-wide text-white/45">
                Sponsor / grant
              </span>

              <select
                value={
                  selectedSponsorId === "all" ||
                  sponsors.some((sponsor) => cleanText(sponsor.id) === selectedSponsorId)
                    ? selectedSponsorId
                    : "all"
                }
                onChange={(event) => {
                  const nextSponsorId = event.target.value;
                  setSelectedSponsorId(nextSponsorId);
                  setFilter(nextSponsorId === "all" ? "all" : "sponsorship");
                }}
                className="w-full rounded-xl bg-black/30 p-3 text-sm font-bold text-white outline-none ring-1 ring-white/10 focus-visible:ring-2 focus-visible:ring-amber-300/50"
              >
                <option className="bg-[#11111f] text-white" value="all">
                  All sponsors / grants
                </option>

                {sponsors.map((sponsor) => (
                  <option
                    key={cleanText(sponsor.id)}
                    value={cleanText(sponsor.id)}
                    className="bg-[#11111f] text-white"
                  >
                    {cleanText(sponsor.sponsor_name) || "Unnamed sponsor"}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="relative block">
            <span className="sr-only">Search transactions</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
              aria-hidden="true"
            />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={`Search ${currentViewLabel} transactions...`}
              className="w-full rounded-xl bg-black/30 p-3 pl-10 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-pink-300/40"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Transaction filters">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              aria-pressed={filter === option.value}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                filter === option.value
                  ? "bg-white text-black"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {(selectedViewMonth !== "all" || selectedSponsorId !== "all") && (
        <div className="mb-5 flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white/65 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Showing {currentViewLabel}
            {selectedSponsor
              ? ` for ${cleanText(selectedSponsor.sponsor_name) || "selected sponsor"}`
              : ""}
            .
          </p>

          <div className="flex flex-wrap gap-2">
            {selectedViewMonth !== "all" ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedViewMonth("all");
                  setSearchTerm("");
                }}
                className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                Clear month
              </button>
            ) : null}

            {selectedSponsorId !== "all" ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedSponsorId("all");
                  setFilter("all");
                }}
                className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                Clear sponsor
              </button>
            ) : null}
          </div>
        </div>
      )}

      {loading ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading transactions...
        </div>
      ) : filteredTransactions.length === 0 ? (
        <EmptyState
          selectedYear={selectedYear}
          selectedViewMonth={selectedViewMonth}
        />
      ) : (
        <TransactionsTable
          transactions={filteredTransactions}
          deleting={deleting}
          repayingId={repayingId}
          setDeleteId={setDeleteId}
          startEditTransaction={startEditTransaction}
          togglePersonalFundsRepaid={togglePersonalFundsRepaid}
        />
      )}
    </section>
  );
}
