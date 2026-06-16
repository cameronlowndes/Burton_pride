"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import {
  Download,
  FileText,
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

type TransactionsPanelProps = {
  loading: boolean;
  filteredTransactions: Transaction[];
  yearTransactions: Transaction[];
  transactions: Transaction[];

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
  displaySponsors: Sponsor[];
  selectedSponsor: Sponsor | null;

  printMonthOptions: MonthOption[];
  printTransactionsList: Transaction[];

  deletingYear: boolean;
  deletingAll: boolean;
  deleting: boolean;
  repayingId: string | null;

  setDeleteYearOpen: Dispatch<SetStateAction<boolean>>;
  setDeleteAllOpen: Dispatch<SetStateAction<boolean>>;
  setDeleteId: Dispatch<SetStateAction<string | null>>;

  startEditTransaction: (item: Transaction) => void;
  togglePersonalFundsRepaid: (item: Transaction) => Promise<void>;
  printTransactions: () => void;
  exportTransactionsToExcel: () => Promise<void>;
  exportFullYearlyReport: () => Promise<void>;
};

type ActionButtonTone = "sky" | "emerald" | "purple" | "orange" | "red";

const filterOptions: { value: TransactionFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "income", label: "Money In" },
  { value: "expense", label: "Money Out" },
  { value: "personal", label: "Personal Funds" },
  { value: "sponsorship", label: "Sponsor / Grant" },
];

const actionButtonClass: Record<ActionButtonTone, string> = {
  sky: "bg-sky-500/15 text-sky-200 ring-sky-300/20 hover:bg-sky-500/25",
  emerald:
    "bg-emerald-500/15 text-emerald-200 ring-emerald-300/20 hover:bg-emerald-500/25",
  purple:
    "bg-purple-500/15 text-purple-200 ring-purple-300/20 hover:bg-purple-500/25",
  orange:
    "bg-orange-500/15 text-orange-200 ring-orange-300/20 hover:bg-orange-500/25",
  red: "bg-red-500/15 text-red-200 ring-red-300/20 hover:bg-red-500/25",
};

function viewLabel(selectedYear: string, selectedViewMonth: string) {
  return selectedViewMonth === "all"
    ? selectedYear
    : monthNameFromKey(selectedViewMonth);
}

function printButtonLabel(selectedPrintMonth: string) {
  if (selectedPrintMonth === "all") return "Print Year";

  return `Print ${monthNameFromKey(selectedPrintMonth).split(" ")[0]}`;
}

function ActionButton({
  children,
  disabled,
  onClick,
  tone,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void | Promise<void>;
  tone: ActionButtonTone;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-w-[135px] flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ring-1 transition disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none ${actionButtonClass[tone]}`}
    >
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
      className={`inline-flex whitespace-nowrap rounded-2xl px-3 py-1 text-xs font-bold ring-1 ${className}`}
    >
      {children}
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
  const repaid = Boolean(item.personal_funds_repaid);

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
        {item.personal_funds_repaid_at ? (
          <div className="mt-1 text-[11px] font-semibold text-white/65">
            {formatDate(item.personal_funds_repaid_at)}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        disabled={repayingId === item.id}
        onClick={() => togglePersonalFundsRepaid(item)}
        className={`w-full rounded-xl px-3 py-2 text-xs font-bold ring-1 transition disabled:cursor-not-allowed disabled:opacity-60 ${
          repaid
            ? "bg-orange-500/15 text-orange-200 ring-orange-300/20 hover:bg-orange-500/25"
            : "bg-emerald-500/15 text-emerald-200 ring-emerald-300/20 hover:bg-emerald-500/25"
        }`}
      >
        {repayingId === item.id
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

  return (
    <div className="whitespace-nowrap text-right font-bold">
      <div>{money(item.amount_pence)}</div>

      {hasSponsor ? (
        <div className="mt-1 text-xs font-semibold text-amber-300">
          {item.type === "income" ? "Sponsor money in" : "Sponsor-funded spend"}
        </div>
      ) : null}

      {isPersonal ? (
        <div
          className={`mt-1 text-xs font-semibold ${
            item.personal_funds_repaid ? "text-emerald-300" : "text-orange-300"
          }`}
        >
          {item.personal_funds_repaid ? "Taken from balance" : "Not taken yet"}
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
    <div className="w-full max-w-[calc(100vw-2rem)] overflow-x-auto rounded-2xl border border-white/10 xl:max-w-full">
      <table className="w-full min-w-[1050px] text-sm">
        <thead className="bg-white/10 text-white/60">
          <tr>
            <th className="p-3 text-left">Date</th>
            <th className="p-3 text-left">Transaction</th>
            <th className="p-3 text-left">Type</th>
            <th className="p-3 text-left">Sponsor / grant</th>
            <th className="p-3 text-left">Personal funds</th>
            <th className="p-3 text-left">Payment</th>
            <th className="p-3 text-left">Invoice</th>
            <th className="p-3 text-right">Amount</th>
            <th className="sticky right-0 z-10 bg-[#11111f] p-3 text-right shadow-[-12px_0_18px_rgba(0,0,0,0.35)]">
              Actions
            </th>
          </tr>
        </thead>

        <tbody>
          {transactions.map((item) => {
            const isPersonal = isPersonalFundsTransaction(item);
            const hasSponsor = isSponsorshipTransaction(item);

            return (
              <tr key={item.id} className="border-t border-white/10 align-top">
                <td className="whitespace-nowrap p-3 text-white/75">
                  {none(item.transaction_date)}
                </td>

                <td className="max-w-[300px] p-3">
                  <p className="break-words font-semibold text-white">
                    {item.title}
                  </p>
                  {item.description ? (
                    <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-white/50">
                      {item.description}
                    </p>
                  ) : null}
                  {item.sponsorship_note ? (
                    <p className="mt-2 line-clamp-2 break-words rounded-xl bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100">
                      {item.sponsorship_note}
                    </p>
                  ) : null}
                </td>

                <td className="whitespace-nowrap p-3">
                  <StatusPill
                    className={
                      item.type === "income"
                        ? "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20"
                        : "bg-red-500/15 text-red-100 ring-red-300/20"
                    }
                  >
                    {item.type === "income" ? "Money In" : "Money Out"}
                  </StatusPill>
                </td>

                <td className="max-w-[190px] p-3">
                  {hasSponsor ? (
                    <StatusPill className="bg-amber-500/20 text-amber-100 ring-amber-300/20">
                      {item.sponsor_name || "Sponsor / grant"}
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
                      {item.personal_funds_name ? (
                        <p className="break-words text-sm font-semibold text-sky-200">
                          {item.personal_funds_name}
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
                  {item.payment_method || "None"}
                </td>

                <td className="p-3">
                  {item.invoice_image_url ? (
                    <a
                      href={item.invoice_image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20"
                    >
                      <FileText className="h-4 w-4" />
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
                      className="inline-flex items-center justify-center rounded-xl bg-sky-500/15 p-2 text-sky-200 hover:bg-sky-500/25"
                      title="Edit transaction"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => setDeleteId(item.id)}
                      className="inline-flex items-center justify-center rounded-xl bg-red-500/15 p-2 text-red-200 hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                      title="Hide transaction"
                    >
                      <Trash2 className="h-4 w-4" />
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
  filteredTransactions,
  yearTransactions,
  transactions,
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
  displaySponsors,
  selectedSponsor,
  printMonthOptions,
  printTransactionsList,
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
  const currentViewLabel = viewLabel(selectedYear, selectedViewMonth);

  return (
    <section className="min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-black text-white">Transactions</h2>
          <p className="mt-1 text-sm text-white/55">
            {filteredTransactions.length} transaction
            {filteredTransactions.length === 1 ? "" : "s"} showing for{" "}
            {currentViewLabel}.
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-3 2xl:flex 2xl:flex-wrap 2xl:justify-end">
          <select
            value={selectedPrintMonth}
            onChange={(event) => setSelectedPrintMonth(event.target.value)}
            className="min-w-0 rounded-xl bg-black/30 px-3 py-2 text-sm font-bold text-white outline-none ring-1 ring-sky-300/20 focus:ring-sky-300/50"
            title="Choose print month"
          >
            {printMonthOptions.map((month) => (
              <option
                key={month.key}
                value={month.key}
                className="bg-[#11111f] text-white"
              >
                Print {month.label} ({month.count})
              </option>
            ))}
          </select>

          <ActionButton
            tone="sky"
            onClick={printTransactions}
            disabled={printTransactionsList.length === 0}
          >
            <Printer className="h-4 w-4" />
            {printButtonLabel(selectedPrintMonth)}
          </ActionButton>

          <ActionButton
            tone="emerald"
            onClick={exportTransactionsToExcel}
            disabled={filteredTransactions.length === 0}
          >
            <Download className="h-4 w-4" />
            Export Excel
          </ActionButton>

          <ActionButton
            tone="purple"
            onClick={exportFullYearlyReport}
            disabled={yearTransactions.length === 0}
          >
            <FileText className="h-4 w-4" />
            Yearly Report
          </ActionButton>

          <ActionButton
            tone="orange"
            onClick={() => setDeleteYearOpen(true)}
            disabled={yearTransactions.length === 0 || deletingYear}
          >
            <Trash2 className="h-4 w-4" />
            Delete {selectedYear}
          </ActionButton>

          <ActionButton
            tone="red"
            onClick={() => setDeleteAllOpen(true)}
            disabled={transactions.length === 0 || deletingAll}
          >
            <Trash2 className="h-4 w-4" />
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
                value={selectedViewMonth}
                onChange={(event) => {
                  setSelectedViewMonth(event.target.value);
                  setSearchTerm("");
                }}
                className="w-full rounded-xl bg-black/30 p-3 text-sm font-bold text-white outline-none ring-1 ring-white/10 focus:ring-sky-300/50"
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
            </label>

            <label>
              <span className="mb-2 block text-xs font-black uppercase tracking-wide text-white/45">
                Sponsor / grant
              </span>
              <select
                value={selectedSponsorId}
                onChange={(event) => {
                  const nextSponsorId = event.target.value;
                  setSelectedSponsorId(nextSponsorId);
                  if (nextSponsorId !== "all") setFilter("sponsorship");
                }}
                className="w-full rounded-xl bg-black/30 p-3 text-sm font-bold text-white outline-none ring-1 ring-white/10 focus:ring-amber-300/50"
              >
                <option className="bg-[#11111f] text-white" value="all">
                  All sponsors / grants
                </option>
                {displaySponsors.map((sponsor) => (
                  <option
                    key={sponsor.id}
                    value={sponsor.id}
                    className="bg-[#11111f] text-white"
                  >
                    {sponsor.sponsor_name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={`Search ${currentViewLabel} transactions...`}
              className="w-full rounded-xl bg-black/30 p-3 pl-10 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/40 focus:ring-pink-300/40"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
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
            {selectedSponsor ? ` for ${selectedSponsor.sponsor_name}` : ""}.
          </p>

          <div className="flex flex-wrap gap-2">
            {selectedViewMonth !== "all" ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedViewMonth("all");
                  setSearchTerm("");
                }}
                className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20"
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
                className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20"
              >
                Clear sponsor
              </button>
            ) : null}
          </div>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
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
