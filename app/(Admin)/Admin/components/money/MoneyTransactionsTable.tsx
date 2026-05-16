"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { useUser } from "@clerk/nextjs";
import { Download, FileText, Pencil, Printer, Trash2 } from "lucide-react";

import type {
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

  onPrint: () => void;
  onExportExcel: () => void | Promise<void>;
  onExportYearlyReport: () => void | Promise<void>;
  onOpenDeleteYear: () => void;
  onOpenDeleteAll: () => void;
  onEditTransaction: (item: Transaction) => void;
  onHideTransaction: (id: string) => void;
  onTogglePersonalFundsRepaid: (
    item: Transaction,
    proofFiles?: File[]
  ) => void | Promise<void>;
  onMarkTransactionChecked: (item: Transaction) => void | Promise<void>;
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
];

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
  if (type === "grant") {
    return "bg-emerald-500/20 text-emerald-100 ring-emerald-300/20";
  }

  if (type === "loan") {
    return "bg-blue-500/20 text-blue-100 ring-blue-300/20";
  }

  if (type === "other") {
    return "bg-purple-500/20 text-purple-100 ring-purple-300/20";
  }

  return "bg-amber-500/20 text-amber-100 ring-amber-300/20";
}

function formatFileSize(size?: number | null) {
  if (!size || size <= 0) return "";

  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function getTransactionFiles(item: Transaction): TransactionAttachment[] {
  const attachments = item.attachments || [];

  if (attachments.length > 0) {
    return attachments;
  }

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

function normaliseText(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function nameFromEmail(email?: string | null) {
  const cleanEmail = String(email || "").trim();

  if (!cleanEmail || !cleanEmail.includes("@")) {
    return "";
  }

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
  const row = item as Transaction & {
    checked_by_email?: string | null;
  };

  return row.checked_by_email || null;
}

function getCheckedByUserId(item: Transaction) {
  const row = item as Transaction & {
    checked_by_user_id?: string | null;
  };

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

  if (checkedByUserId && currentUserId) {
    return checkedByUserId === currentUserId;
  }

  if (checkedByEmail && currentUserEmail) {
    return normaliseText(checkedByEmail) === normaliseText(currentUserEmail);
  }

  /*
    Legacy fallback for older checked records that only saved checked_by.
    New records should use checked_by_user_id / checked_by_email from the API.
  */
  if (checkedByName && currentUserName) {
    return normaliseText(checkedByName) === normaliseText(currentUserName);
  }

  return false;
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

  onPrint,
  onExportExcel,
  onExportYearlyReport,
  onOpenDeleteYear,
  onOpenDeleteAll,
  onEditTransaction,
  onHideTransaction,
  onTogglePersonalFundsRepaid,
  onMarkTransactionChecked,
}: MoneyTransactionsTableProps) {
  const { user } = useUser();

  const currentUserId = user?.id || null;
  const currentUserEmail =
    user?.primaryEmailAddress?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress ||
    null;
  const currentUserName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    nameFromEmail(currentUserEmail) ||
    null;

  const [repaymentProofFiles, setRepaymentProofFiles] = useState<
    Record<string, File[]>
  >({});

  const topActionButtonBase =
    "inline-flex min-w-[135px] flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ring-1 transition disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none";

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
            sponsorName && itemSponsorName && sponsorName === itemSponsorName
          )
        );
      }) || null
    );
  }

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

          {selectedPrintMonth !== "all" && (
            <p className="mt-1 text-xs text-emerald-200/80">
              Export and print selected for{" "}
              <strong>{monthNameFromKey(selectedPrintMonth)}</strong> —{" "}
              {printTransactionsList.length} transaction
              {printTransactionsList.length === 1 ? "" : "s"}.
            </p>
          )}
        </div>

        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-3 2xl:flex 2xl:flex-wrap 2xl:justify-end">
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
            <Printer className="h-4 w-4" />
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
            <Download className="h-4 w-4" />

            {selectedPrintMonth === "all"
              ? "Export Excel"
              : `Export ${monthNameFromKey(selectedPrintMonth).split(" ")[0]}`}
          </button>

          <button
            type="button"
            onClick={onExportYearlyReport}
            disabled={yearTransactions.length === 0}
            className={`${topActionButtonBase} bg-purple-500/15 text-purple-200 ring-purple-300/20 hover:bg-purple-500/25`}
          >
            <FileText className="h-4 w-4" />
            Yearly Report
          </button>

          <button
            type="button"
            onClick={onOpenDeleteYear}
            disabled={yearTransactions.length === 0 || deletingYear}
            className={`${topActionButtonBase} bg-orange-500/15 text-orange-200 ring-orange-300/20 hover:bg-orange-500/25`}
          >
            <Trash2 className="h-4 w-4" />
            Delete {selectedYear}
          </button>

          <button
            type="button"
            onClick={onOpenDeleteAll}
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
                Choose a month to only show that month on screen. The
                Print/Export dropdown above controls what gets printed or
                exported.
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
              <select
                value={selectedViewMonth}
                onChange={(event) => {
                  setSelectedViewMonth(event.target.value);
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
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder={`Search ${
            selectedViewMonth === "all"
              ? selectedYear
              : monthNameFromKey(selectedViewMonth)
          } transactions by reference, title, funding name, note, payment method, or amount...`}
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
                        : "Funding"}
              </button>
            )
          )}
        </div>

        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-bold text-emerald-100">
                Filter by payment method
              </p>

              <p className="text-xs text-emerald-100/70">
                Show only transactions paid by Stripe, Cash, Bank Transfer,
                PayPal, Card Machine, Personal Funds, or Item Donation.
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
              <select
                value={selectedPaymentMethod}
                onChange={(event) =>
                  setSelectedPaymentMethod(event.target.value)
                }
                className="w-full min-w-0 rounded-xl bg-black/30 p-3 text-sm font-bold text-white outline-none ring-1 ring-emerald-300/20 focus:ring-emerald-300/50 sm:min-w-[240px]"
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

              {selectedPaymentMethod !== "all" && (
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethod("all")}
                  className="rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/20"
                >
                  Clear payment
                </button>
              )}
            </div>
          </div>

          {selectedPaymentMethod !== "all" && (
            <div className="mt-3 rounded-xl bg-black/20 px-4 py-3 text-sm text-emerald-100">
              Showing payment method:{" "}
              <strong>{selectedPaymentMethod}</strong>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-bold text-amber-100">
                Organise by funding record
              </p>

              <p className="text-xs text-amber-100/70">
                Choose one sponsor, grant, loan or other funding record to only
                show money in and spending linked to it.
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
              <select
                value={selectedSponsorId}
                onChange={(event) => {
                  const nextSponsorId = event.target.value;
                  setSelectedSponsorId(nextSponsorId);

                  if (nextSponsorId !== "all") {
                    setFilter("sponsorship");
                  }
                }}
                className="w-full min-w-0 rounded-xl bg-black/30 p-3 text-sm text-white outline-none ring-1 ring-amber-300/20 focus:ring-amber-300/50 sm:min-w-[240px]"
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

              {selectedSponsorId !== "all" && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSponsorId("all");
                    setFilter("all");
                  }}
                  className="rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/20"
                >
                  Clear funding
                </button>
              )}
            </div>
          </div>

          {selectedSponsor && (
            <div className="mt-3 rounded-xl bg-black/20 px-4 py-3 text-sm text-amber-100">
              Showing transactions for{" "}
              <strong>
                {fundingTypeLabel(selectedSponsor.funding_type)} —{" "}
                {selectedSponsor.sponsor_name}
              </strong>
              .
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
          <table className="w-full min-w-[1450px] text-sm">
            <thead className="bg-white/10 text-white/60">
              <tr>
                <th className="p-3 text-left">Reference</th>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Title</th>
                <th className="p-3 text-left">Type</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3 text-left">Funding</th>
                <th className="p-3 text-left">Funding Note</th>
                <th className="p-3 text-left">Personal</th>
                <th className="p-3 text-left">Paid By</th>
                <th className="p-3 text-left">Repayment</th>
                <th className="p-3 text-left">Payment</th>
                <th className="p-3 text-left">Files</th>
                <th className="p-3 text-left">Checked</th>
                <th className="sticky right-0 z-10 bg-[#242435] p-3 text-right shadow-[-12px_0_18px_rgba(0,0,0,0.35)]">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredTransactions.map((item) => {
                const isPersonal = isPersonalFundsTransaction(item);
                const hasFunding = isSponsorshipTransaction(item);
                const fundingRecord = getFundingForTransaction(item);
                const fundingType = fundingRecord?.funding_type || "sponsor";
                const fundingLabel = fundingTypeLabel(fundingType);
                const shortLabel = fundingShortLabel(fundingType);
                const files = getTransactionFiles(item);
                const proofFiles = repaymentProofFiles[item.id] || [];

                return (
                  <tr key={item.id} className="border-t border-white/10">
                    <td className="whitespace-nowrap p-3">
                      {item.transaction_reference ? (
                        <span className="inline-flex rounded-xl bg-white/10 px-3 py-1 text-xs font-black text-white ring-1 ring-white/10">
                          {item.transaction_reference}
                        </span>
                      ) : (
                        <span className="text-white/40">Pending</span>
                      )}
                    </td>

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

                    <td className="whitespace-nowrap p-3 text-right font-bold">
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
                    </td>

                    <td className="max-w-[180px] p-3">
                      {hasFunding ? (
                        <div className="space-y-2">
                          <span
                            className={`inline-flex rounded-2xl px-3 py-1 text-xs font-bold ring-1 ${fundingBadgeClass(
                              fundingType
                            )}`}
                          >
                            {fundingLabel}
                          </span>

                          <p className="break-words text-xs font-semibold text-white/80">
                            {item.sponsor_name ||
                              fundingRecord?.sponsor_name ||
                              "Funding record"}
                          </p>
                        </div>
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

                    <td className="min-w-[190px] p-3">
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

                          {!item.personal_funds_repaid && (
                            <div className="rounded-xl bg-black/20 p-2 ring-1 ring-white/10">
                              <label className="mb-1 block text-[11px] font-bold text-white/60">
                                Upload proof before payback
                              </label>

                              <input
                                type="file"
                                multiple
                                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.eml,.msg"
                                onChange={(event) => {
                                  const selectedFiles = Array.from(
                                    event.target.files || []
                                  );

                                  setRepaymentProofFiles((prev) => ({
                                    ...prev,
                                    [item.id]: selectedFiles,
                                  }));
                                }}
                                className="w-full text-[11px] text-white/60 file:mr-2 file:rounded-lg file:border-0 file:bg-emerald-500 file:px-2 file:py-1 file:text-[11px] file:font-bold file:text-white hover:file:bg-emerald-400"
                              />

                              {proofFiles.length > 0 && (
                                <p className="mt-2 text-[11px] font-semibold text-emerald-200">
                                  {proofFiles.length} proof file
                                  {proofFiles.length === 1 ? "" : "s"} selected
                                </p>
                              )}
                            </div>
                          )}

                          <button
                            type="button"
                            disabled={repayingId === item.id}
                            onClick={async () => {
                              await onTogglePersonalFundsRepaid(
                                item,
                                proofFiles
                              );

                              setRepaymentProofFiles((prev) => ({
                                ...prev,
                                [item.id]: [],
                              }));
                            }}
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
                      {hasFunding
                        ? "Funding Money"
                        : item.payment_method || "None"}
                    </td>

                    <td className="min-w-[170px] p-3">
                      {files.length > 0 ? (
                        <div className="space-y-2">
                          <span className="inline-flex rounded-2xl bg-sky-500/15 px-3 py-1 text-xs font-bold text-sky-100 ring-1 ring-sky-300/20">
                            {files.length} file{files.length === 1 ? "" : "s"}
                          </span>

                          <div className="space-y-1">
                            {files.slice(0, 3).map((file, index) => (
                              <a
                                key={file.id || `${file.file_url}-${index}`}
                                href={file.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block max-w-[210px] truncate rounded-lg bg-white/10 px-2 py-1 text-xs font-bold text-white hover:bg-white/20"
                                title={
                                  file.file_name || `Attachment ${index + 1}`
                                }
                              >
                                <FileText className="mr-1 inline h-3 w-3" />
                                {file.file_name || `Attachment ${index + 1}`}
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
                        <span className="text-white/40">None</span>
                      )}
                    </td>

                    <td className="min-w-[210px] p-3">
                      {item.checked_at ? (
                        (() => {
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
                                  onClick={() => onMarkTransactionChecked(item)}
                                  className="w-full rounded-xl bg-orange-500/15 px-3 py-2 text-xs font-bold text-orange-200 ring-1 ring-orange-300/20 hover:bg-orange-500/25 disabled:opacity-60"
                                >
                                  {checkingId === item.id
                                    ? "Undoing..."
                                    : "Undo checked"}
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
                        })()
                      ) : (
                        <div className="space-y-2">
                          <div className="rounded-2xl bg-white/10 px-3 py-2 text-xs font-bold text-white/60 ring-1 ring-white/10">
                            Not checked
                          </div>

                          <button
                            type="button"
                            disabled={checkingId === item.id}
                            onClick={() => onMarkTransactionChecked(item)}
                            className="w-full rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-200 ring-1 ring-emerald-300/20 hover:bg-emerald-500/25 disabled:opacity-60"
                          >
                            {checkingId === item.id
                              ? "Checking..."
                              : "Mark checked"}
                          </button>
                        </div>
                      )}
                    </td>

                    <td className="sticky right-0 z-10 bg-[#11111f] p-3 text-right shadow-[-12px_0_18px_rgba(0,0,0,0.35)]">
                      <div className="inline-flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onEditTransaction(item)}
                          className="inline-flex items-center justify-center rounded-xl bg-sky-500/15 p-2 text-sky-200 hover:bg-sky-500/25"
                          title="Edit transaction"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          disabled={deleting}
                          onClick={() => onHideTransaction(item.id)}
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