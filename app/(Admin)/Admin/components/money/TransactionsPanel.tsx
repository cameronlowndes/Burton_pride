import {
  Download,
  FileText,
  Pencil,
  Printer,
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

type TransactionsPanelProps = {
  loading: boolean;
  filteredTransactions: Transaction[];
  yearTransactions: Transaction[];
  transactions: Transaction[];
  selectedYear: string;
  selectedViewMonth: string;
  selectedPrintMonth: string;
  setSelectedPrintMonth: React.Dispatch<React.SetStateAction<string>>;
  setSelectedViewMonth: React.Dispatch<React.SetStateAction<string>>;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  filter: "all" | "income" | "expense" | "sponsorship" | "personal";
  setFilter: React.Dispatch<
    React.SetStateAction<"all" | "income" | "expense" | "sponsorship" | "personal">
  >;
  selectedSponsorId: string;
  setSelectedSponsorId: React.Dispatch<React.SetStateAction<string>>;
  displaySponsors: Sponsor[];
  selectedSponsor: Sponsor | null;
  printMonthOptions: MonthOption[];
  printTransactionsList: Transaction[];
  deletingYear: boolean;
  deletingAll: boolean;
  deleting: boolean;
  repayingId: string | null;
  setDeleteYearOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setDeleteAllOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setDeleteId: React.Dispatch<React.SetStateAction<string | null>>;
  startEditTransaction: (item: Transaction) => void;
  togglePersonalFundsRepaid: (item: Transaction) => Promise<void>;
  printTransactions: () => void;
  exportTransactionsToExcel: () => Promise<void>;
  exportFullYearlyReport: () => Promise<void>;
};

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
  const topActionButtonBase =
    "inline-flex min-w-[135px] flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ring-1 transition disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none";

  return (
    <div className="min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-bold">Transactions</h2>

          <p className="text-sm text-white/50">
            {filteredTransactions.length} transaction
            {filteredTransactions.length === 1 ? "" : "s"} showing for{" "}
            {selectedViewMonth === "all"
              ? selectedYear
              : monthNameFromKey(selectedViewMonth)}
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-3 2xl:flex 2xl:flex-wrap 2xl:justify-end">
          <select
            value={selectedPrintMonth}
            onChange={(e) => setSelectedPrintMonth(e.target.value)}
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

          <button
            type="button"
            onClick={printTransactions}
            disabled={printTransactionsList.length === 0}
            className={`${topActionButtonBase} bg-sky-500/15 text-sky-200 ring-sky-300/20 hover:bg-sky-500/25`}
          >
            <Printer className="h-4 w-4" />
            {selectedPrintMonth === "all"
              ? "Print Year"
              : `Print ${monthNameFromKey(selectedPrintMonth).split(" ")[0]}`}
          </button>

          <button
            type="button"
            onClick={exportTransactionsToExcel}
            disabled={filteredTransactions.length === 0}
            className={`${topActionButtonBase} bg-emerald-500/15 text-emerald-200 ring-emerald-300/20 hover:bg-emerald-500/25`}
          >
            <Download className="h-4 w-4" />
            Export Excel
          </button>

          <button
            type="button"
            onClick={exportFullYearlyReport}
            disabled={yearTransactions.length === 0}
            className={`${topActionButtonBase} bg-purple-500/15 text-purple-200 ring-purple-300/20 hover:bg-purple-500/25`}
          >
            <FileText className="h-4 w-4" />
            Yearly Report
          </button>

          <button
            type="button"
            onClick={() => setDeleteYearOpen(true)}
            disabled={yearTransactions.length === 0 || deletingYear}
            className={`${topActionButtonBase} bg-orange-500/15 text-orange-200 ring-orange-300/20 hover:bg-orange-500/25`}
          >
            <Trash2 className="h-4 w-4" />
            Delete {selectedYear}
          </button>

          <button
            type="button"
            onClick={() => setDeleteAllOpen(true)}
            disabled={transactions.length === 0 || deletingAll}
            className={`${topActionButtonBase} bg-red-500/15 text-red-200 ring-red-300/20 hover:bg-red-500/25`}
          >
            <Trash2 className="h-4 w-4" />
            Delete All
          </button>
        </div>
      </div>

      <div className="mb-4 space-y-3">
        <div className="rounded-2xl border border-sky-300/20 bg-sky-500/10 p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-bold text-sky-100">
                View transactions by month
              </p>

              <p className="text-xs text-sky-100/70">
                Choose a month to only show that month on screen. Export Excel
                uses this current view. Yearly Report still exports the full
                year.
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
              <select
                value={selectedViewMonth}
                onChange={(e) => {
                  setSelectedViewMonth(e.target.value);
                  setSearchTerm("");
                }}
                className="w-full min-w-0 rounded-xl bg-black/30 p-3 text-sm font-bold text-white outline-none ring-1 ring-sky-300/20 focus:ring-sky-300/50 sm:min-w-[240px]"
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

              {selectedViewMonth !== "all" && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedViewMonth("all");
                    setSearchTerm("");
                  }}
                  className="rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/20"
                >
                  Clear month
                </button>
              )}
            </div>
          </div>
        </div>

        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={`Search ${
            selectedViewMonth === "all"
              ? selectedYear
              : monthNameFromKey(selectedViewMonth)
          } transactions...`}
          className="w-full rounded-xl bg-black/30 p-3 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/40 focus:ring-pink-300/40"
        />

        <div className="flex flex-wrap gap-2">
          {(["all", "income", "expense", "personal", "sponsorship"] as const).map(
            (item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={`rounded-xl px-4 py-2 text-sm font-bold ${
                  filter === item
                    ? "bg-white text-black"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {item === "all"
                  ? "All"
                  : item === "income"
                  ? "Money In"
                  : item === "expense"
                  ? "Money Out"
                  : item === "personal"
                  ? "Personal Funds"
                  : "Sponsorship"}
              </button>
            )
          )}
        </div>

        <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-bold text-amber-100">
                Organise by sponsor
              </p>

              <p className="text-xs text-amber-100/70">
                Choose one sponsor to only show money in and spending linked to
                them.
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
              <select
                value={selectedSponsorId}
                onChange={(e) => {
                  const nextSponsorId = e.target.value;
                  setSelectedSponsorId(nextSponsorId);

                  if (nextSponsorId !== "all") {
                    setFilter("sponsorship");
                  }
                }}
                className="w-full min-w-0 rounded-xl bg-black/30 p-3 text-sm text-white outline-none ring-1 ring-amber-300/20 focus:ring-amber-300/50 sm:min-w-[240px]"
              >
                <option className="bg-[#11111f] text-white" value="all">
                  All sponsors
                </option>

                {displaySponsors.map((sponsor) => (
                  <option
                    className="bg-[#11111f] text-white"
                    key={sponsor.id}
                    value={sponsor.id}
                  >
                    {sponsor.sponsor_name}
                  </option>
                ))}
              </select>

              {selectedSponsorId !== "all" && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSponsorId("all");
                    setFilter("all");
                  }}
                  className="rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/20"
                >
                  Clear sponsor
                </button>
              )}
            </div>
          </div>

          {selectedSponsor && (
            <div className="mt-3 rounded-xl bg-black/20 px-4 py-3 text-sm text-amber-100">
              Showing transactions for{" "}
              <strong>{selectedSponsor.sponsor_name}</strong>.
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : filteredTransactions.length === 0 ? (
        <div className="rounded-2xl bg-black/20 p-4 text-sm text-white/60">
          No transactions found for{" "}
          {selectedViewMonth === "all"
            ? selectedYear
            : monthNameFromKey(selectedViewMonth)}
        </div>
      ) : (
        <div className="w-full max-w-[calc(100vw-2rem)] overflow-x-auto rounded-2xl border border-white/10 xl:max-w-full">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-white/10 text-white/60">
              <tr>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Title</th>
                <th className="p-3 text-left">Type</th>
                <th className="p-3 text-left">Sponsor</th>
                <th className="p-3 text-left">Sponsorship Note</th>
                <th className="p-3 text-left">Personal</th>
                <th className="p-3 text-left">Paid By</th>
                <th className="p-3 text-left">Repayment</th>
                <th className="p-3 text-left">Payment</th>
                <th className="p-3 text-left">Invoice</th>
                <th className="p-3 text-right">Amount</th>
                <th className="sticky right-0 z-10 bg-[#242435] p-3 text-right shadow-[-12px_0_18px_rgba(0,0,0,0.35)]">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredTransactions.map((item) => {
                const isPersonal = isPersonalFundsTransaction(item);
                const hasSponsor = isSponsorshipTransaction(item);

                return (
                  <tr key={item.id} className="border-t border-white/10">
                    <td className="whitespace-nowrap p-3">
                      {none(item.transaction_date)}
                    </td>

                    <td className="max-w-[220px] p-3">
                      <p className="break-words font-semibold">{item.title}</p>

                      {item.description && (
                        <p className="mt-1 line-clamp-3 break-words text-xs text-white/50">
                          {item.description}
                        </p>
                      )}
                    </td>

                    <td className="whitespace-nowrap p-3">
                      {item.type === "income" ? "Money In" : "Money Out"}
                    </td>

                    <td className="max-w-[160px] p-3">
                      {hasSponsor ? (
                        <span className="inline-flex rounded-2xl bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-100 ring-1 ring-amber-300/20">
                          {item.sponsor_name || "Sponsor"}
                        </span>
                      ) : (
                        <span className="text-white/40">None</span>
                      )}
                    </td>

                    <td className="max-w-[220px] p-3">
                      {item.sponsorship_note ? (
                        <span className="line-clamp-3 break-words text-sm text-amber-100">
                          {item.sponsorship_note}
                        </span>
                      ) : (
                        <span className="text-white/40">None</span>
                      )}
                    </td>

                    <td className="p-3">
                      {isPersonal ? (
                        <span className="inline-flex whitespace-nowrap rounded-2xl bg-sky-500/20 px-3 py-1 text-xs font-bold text-sky-100 ring-1 ring-sky-300/20">
                          Personal funds
                        </span>
                      ) : (
                        <span className="text-white/40">None</span>
                      )}
                    </td>

                    <td className="max-w-[160px] p-3">
                      {item.personal_funds_name ? (
                        <span className="break-words font-semibold text-sky-200">
                          {item.personal_funds_name}
                        </span>
                      ) : (
                        <span className="text-white/40">None</span>
                      )}
                    </td>

                    <td className="p-3">
                      {isPersonal ? (
                        <div className="space-y-2">
                          {item.personal_funds_repaid ? (
                            <div className="rounded-2xl bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-200 ring-1 ring-emerald-300/20">
                              Paid back
                              {item.personal_funds_repaid_at && (
                                <div className="mt-1 text-[11px] font-semibold text-emerald-100/70">
                                  {formatDate(item.personal_funds_repaid_at)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="rounded-2xl bg-orange-500/15 px-3 py-2 text-xs font-bold text-orange-200 ring-1 ring-orange-300/20">
                              Not paid back
                            </div>
                          )}

                          <button
                            type="button"
                            disabled={repayingId === item.id}
                            onClick={() => togglePersonalFundsRepaid(item)}
                            className={`w-full rounded-xl px-3 py-2 text-xs font-bold transition disabled:opacity-60 ${
                              item.personal_funds_repaid
                                ? "bg-orange-500/15 text-orange-200 ring-1 ring-orange-300/20 hover:bg-orange-500/25"
                                : "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-300/20 hover:bg-emerald-500/25"
                            }`}
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
                    </td>

                    <td className="whitespace-nowrap p-3">
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
                        <span className="text-white/40">None</span>
                      )}
                    </td>

                    <td className="whitespace-nowrap p-3 text-right font-bold">
                      <div>{money(item.amount_pence)}</div>

                      {hasSponsor && (
                        <div className="mt-1 text-xs font-semibold text-amber-300">
                          {item.type === "income"
                            ? "Sponsor money in"
                            : "Sponsor-funded spend"}
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
                          className="inline-flex items-center justify-center rounded-xl bg-red-500/15 p-2 text-red-200 hover:bg-red-500/25 disabled:opacity-50"
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
      )}
    </div>
  );
}