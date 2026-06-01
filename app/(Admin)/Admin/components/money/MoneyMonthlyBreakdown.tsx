"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Coins,
  LockKeyhole,
  RefreshCcw,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

type MoneyTransaction = {
  id?: string;
  created_at?: string | null;
  transaction_date?: string | null;
  title?: string | null;
  description?: string | null;
  type?: "income" | "expense" | string | null;
  category?: string | null;
  amount_pence?: number | null;
  payment_method?: string | null;

  sponsor_id?: string | null;
  sponsor_name?: string | null;
  sponsorship_note?: string | null;
  funding_type?: string | null;

  source?: string | null;

  is_personal_funds?: boolean | null;
  personal_funds_repaid?: boolean | null;

  deleted_at?: string | null;
};

type RefundType = "money_received_back" | "money_sent_back";
type RefundStatus = "pending" | "completed" | "cancelled";

type MoneyRefund = {
  id: string;
  year: number;
  refund_date: string;
  refund_type: RefundType;
  amount_pence: number;
  title: string;
  notes?: string | null;
  status: RefundStatus;
  is_hidden?: boolean | null;
  created_at?: string | null;
};

type RefundApiResponse = {
  success?: boolean;
  refunds?: MoneyRefund[];
  message?: string;
  error?: string;
  details?: unknown;
};

type MoneyMonthlyBreakdownProps = {
  selectedYear: string;
  transactions: MoneyTransaction[];
};

type MonthRow = {
  key: string;
  shortLabel: string;
  longLabel: string;

  moneyIn: number;
  moneyOut: number;

  restrictedIncome: number;
  restrictedSpent: number;
  restrictedLeft: number;

  generalIncome: number;
  generalOut: number;

  refundsReceivedBack: number;
  refundsSentBack: number;

  generalBalanceBeforeRefunds: number;
  generalBalance: number;

  unpaidPersonalFunds: number;

  transactionCount: number;
  refundCount: number;
  activityCount: number;
};

const MONTHS = [
  { key: "01", shortLabel: "Jan", longLabel: "January" },
  { key: "02", shortLabel: "Feb", longLabel: "February" },
  { key: "03", shortLabel: "Mar", longLabel: "March" },
  { key: "04", shortLabel: "Apr", longLabel: "April" },
  { key: "05", shortLabel: "May", longLabel: "May" },
  { key: "06", shortLabel: "Jun", longLabel: "June" },
  { key: "07", shortLabel: "Jul", longLabel: "July" },
  { key: "08", shortLabel: "Aug", longLabel: "August" },
  { key: "09", shortLabel: "Sep", longLabel: "September" },
  { key: "10", shortLabel: "Oct", longLabel: "October" },
  { key: "11", shortLabel: "Nov", longLabel: "November" },
  { key: "12", shortLabel: "Dec", longLabel: "December" },
];

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format((Number(value) || 0) / 100);
}

function getTransactionDate(item: MoneyTransaction) {
  return item.transaction_date || item.created_at || "";
}

function getTransactionYear(item: MoneyTransaction) {
  const dateValue = getTransactionDate(item);

  if (!dateValue) return "";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return String(dateValue).slice(0, 4);
  }

  return String(date.getFullYear());
}

function getTransactionMonth(item: MoneyTransaction) {
  const dateValue = getTransactionDate(item);

  if (!dateValue) return "";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return String(dateValue).slice(5, 7);
  }

  return String(date.getMonth() + 1).padStart(2, "0");
}

function getRefundDate(item: MoneyRefund) {
  return item.refund_date || item.created_at || "";
}

function getRefundYear(item: MoneyRefund) {
  const dateValue = getRefundDate(item);

  if (!dateValue) return "";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return String(dateValue).slice(0, 4);
  }

  return String(date.getFullYear());
}

function getRefundMonth(item: MoneyRefund) {
  const dateValue = getRefundDate(item);

  if (!dateValue) return "";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return String(dateValue).slice(5, 7);
  }

  return String(date.getMonth() + 1).padStart(2, "0");
}

function isDeleted(item: MoneyTransaction) {
  return Boolean(item.deleted_at);
}

function isIncome(item: MoneyTransaction) {
  return item.type === "income";
}

function isExpense(item: MoneyTransaction) {
  return item.type === "expense";
}

function isRestrictedFunding(item: MoneyTransaction) {
  const source = String(item.source || "").toLowerCase();

  const category = String(item.category || "").toLowerCase();

  return Boolean(
    item.sponsor_id ||
      item.sponsor_name ||
      item.sponsorship_note ||
      source === "sponsorship" ||
      category === "sponsorship" ||
      category === "grant" ||
      category === "restricted funding" ||
      category === "restricted"
  );
}

function isPersonalFunds(item: MoneyTransaction) {
  return Boolean(
    item.is_personal_funds ||
      String(item.payment_method || "").toLowerCase() ===
        "personal funds"
  );
}

function getAmount(item: MoneyTransaction) {
  return Number(item.amount_pence || 0);
}

function getRefundAmount(item: MoneyRefund) {
  return Number(item.amount_pence || 0);
}

function isCompletedVisibleRefund(item: MoneyRefund) {
  return item.status === "completed" && !item.is_hidden;
}

function buildMonthRows(
  transactions: MoneyTransaction[],
  refunds: MoneyRefund[],
  selectedYear: string
) {
  return MONTHS.map((month) => {
    const monthTransactions = transactions.filter((item) => {
      if (isDeleted(item)) return false;

      if (
        selectedYear &&
        getTransactionYear(item) !== selectedYear
      ) {
        return false;
      }

      return getTransactionMonth(item) === month.key;
    });

    const monthRefunds = refunds.filter((item) => {
      if (!isCompletedVisibleRefund(item)) return false;

      if (selectedYear && getRefundYear(item) !== selectedYear) {
        return false;
      }

      return getRefundMonth(item) === month.key;
    });

    const row: MonthRow = {
      key: `${selectedYear}-${month.key}`,

      shortLabel: month.shortLabel,

      longLabel: month.longLabel,

      moneyIn: 0,

      moneyOut: 0,

      restrictedIncome: 0,

      restrictedSpent: 0,

      restrictedLeft: 0,

      generalIncome: 0,

      generalOut: 0,

      refundsReceivedBack: 0,

      refundsSentBack: 0,

      generalBalanceBeforeRefunds: 0,

      generalBalance: 0,

      unpaidPersonalFunds: 0,

      transactionCount: monthTransactions.length,

      refundCount: monthRefunds.length,

      activityCount:
        monthTransactions.length + monthRefunds.length,
    };

    for (const item of monthTransactions) {
      const amount = getAmount(item);

      const restricted = isRestrictedFunding(item);

      const personal = isPersonalFunds(item);

      const unpaidPersonal =
        personal && !item.personal_funds_repaid;

      if (isIncome(item)) {
        row.moneyIn += amount;

        if (restricted) {
          row.restrictedIncome += amount;
        } else {
          row.generalIncome += amount;
        }
      }

      if (isExpense(item)) {
        row.moneyOut += amount;

        if (restricted) {
          row.restrictedSpent += amount;
        } else if (unpaidPersonal) {
          row.unpaidPersonalFunds += amount;
        } else {
          row.generalOut += amount;
        }
      }
    }

    for (const refund of monthRefunds) {
      const amount = getRefundAmount(refund);

      if (refund.refund_type === "money_received_back") {
        row.refundsReceivedBack += amount;
      }

      if (refund.refund_type === "money_sent_back") {
        row.refundsSentBack += amount;
      }
    }

    row.restrictedLeft =
      row.restrictedIncome - row.restrictedSpent;

    row.generalBalanceBeforeRefunds =
      row.generalIncome - row.generalOut;

    row.generalBalance =
      row.generalIncome -
      row.generalOut +
      row.refundsReceivedBack -
      row.refundsSentBack;

    return row;
  });
}

function MetricCard({
  title,
  value,
  note,
  tone,
  icon,
}: {
  title: string;
  value: string;
  note?: string;
  tone:
    | "emerald"
    | "red"
    | "amber"
    | "sky"
    | "violet"
    | "rose";
  icon: React.ReactNode;
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
      : tone === "red"
        ? "border-red-300/20 bg-red-500/10 text-red-100"
        : tone === "amber"
          ? "border-amber-300/20 bg-amber-500/10 text-amber-100"
          : tone === "violet"
            ? "border-violet-300/20 bg-violet-500/10 text-violet-100"
            : tone === "rose"
              ? "border-rose-300/20 bg-rose-500/10 text-rose-100"
              : "border-sky-300/20 bg-sky-500/10 text-sky-100";

  return (
    <div className={`min-w-0 rounded-2xl border p-4 ${toneClass}`}>
      <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide opacity-80">
        {icon}

        <span className="break-words">{title}</span>
      </div>

      <p className="break-words text-xl font-black text-white sm:text-2xl">
        {value}
      </p>

      {note ? (
        <p className="mt-2 break-words text-xs font-bold leading-5 opacity-80">
          {note}
        </p>
      ) : null}
    </div>
  );
}

function MonthProgress({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone:
    | "emerald"
    | "red"
    | "amber"
    | "sky"
    | "violet"
    | "rose";
}) {
  const percent =
    max > 0
      ? Math.min(
          100,
          Math.round((Math.abs(value) / max) * 100)
        )
      : 0;

  const barClass =
    tone === "emerald"
      ? "bg-emerald-400"
      : tone === "red"
        ? "bg-red-400"
        : tone === "amber"
          ? "bg-amber-400"
          : tone === "violet"
            ? "bg-violet-400"
            : tone === "rose"
              ? "bg-rose-400"
              : "bg-sky-400";

  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="break-words text-white/60">
          {label}
        </span>

        <span className="shrink-0 font-bold text-white/75">
          {formatMoney(value)}
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${barClass}`}
          style={{
            width: `${percent}%`,
          }}
        />
      </div>
    </div>
  );
}

export default function MoneyMonthlyBreakdown({
  selectedYear,
  transactions,
}: MoneyMonthlyBreakdownProps) {
  const [open, setOpen] = useState(false);

  const [refunds, setRefunds] = useState<MoneyRefund[]>([]);

  const [refundLoadError, setRefundLoadError] = useState("");

  const [isLoadingRefunds, setIsLoadingRefunds] =
    useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadRefunds() {
      setIsLoadingRefunds(true);

      setRefundLoadError("");

      try {
        const endpoint =
          `/api/admin/money/refunds?year=${encodeURIComponent(
            selectedYear
          )}&limit=500`;

        const response = await fetch(endpoint, {
          method: "GET",

          cache: "no-store",

          signal: controller.signal,
        });

        const payload =
          (await response.json().catch(() => ({}))) as RefundApiResponse;

        if (!response.ok) {
          throw new Error(
            payload.message ||
              payload.error ||
              "Refund records could not be loaded."
          );
        }

        setRefunds(
          Array.isArray(payload.refunds)
            ? payload.refunds
            : []
        );
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setRefunds([]);

        setRefundLoadError(
          error instanceof Error
            ? error.message
            : "Refund records could not be loaded."
        );
      } finally {
        setIsLoadingRefunds(false);
      }
    }

    void loadRefunds();

    return () => {
      controller.abort();
    };
  }, [selectedYear]);

  const rows = useMemo(
    () =>
      buildMonthRows(
        transactions || [],
        refunds || [],
        selectedYear
      ),
    [transactions, refunds, selectedYear]
  );

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.moneyIn += row.moneyIn;

        acc.moneyOut += row.moneyOut;

        acc.restrictedIncome += row.restrictedIncome;

        acc.restrictedSpent += row.restrictedSpent;

        acc.restrictedLeft += row.restrictedLeft;

        acc.generalIncome += row.generalIncome;

        acc.generalOut += row.generalOut;

        acc.refundsReceivedBack += row.refundsReceivedBack;

        acc.refundsSentBack += row.refundsSentBack;

        acc.generalBalanceBeforeRefunds +=
          row.generalBalanceBeforeRefunds;

        acc.generalBalance += row.generalBalance;

        acc.unpaidPersonalFunds += row.unpaidPersonalFunds;

        acc.transactionCount += row.transactionCount;

        acc.refundCount += row.refundCount;

        acc.activityCount += row.activityCount;

        return acc;
      },
      {
        moneyIn: 0,

        moneyOut: 0,

        restrictedIncome: 0,

        restrictedSpent: 0,

        restrictedLeft: 0,

        generalIncome: 0,

        generalOut: 0,

        refundsReceivedBack: 0,

        refundsSentBack: 0,

        generalBalanceBeforeRefunds: 0,

        generalBalance: 0,

        unpaidPersonalFunds: 0,

        transactionCount: 0,

        refundCount: 0,

        activityCount: 0,
      }
    );
  }, [rows]);

  const maxMonthValue = useMemo(() => {
    return Math.max(
      1,

      ...rows.flatMap((row) => [
        Math.abs(row.moneyIn),

        Math.abs(row.moneyOut),

        Math.abs(row.restrictedLeft),

        Math.abs(row.generalBalance),

        Math.abs(row.refundsReceivedBack),

        Math.abs(row.refundsSentBack),
      ])
    );
  }, [rows]);

  return (
    <section className="min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 sm:p-5">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-100 ring-1 ring-sky-300/20">
              <CalendarDays className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <h2 className="break-words text-2xl font-black text-white">
                Monthly Breakdown
              </h2>

              <p className="mt-2 max-w-4xl break-words text-sm leading-6 text-white/60">
                Jan to Dec view for {selectedYear}. Restricted sponsor,
                grant, loan or funding money is kept separate from the
                general Burton Pride balance. Completed refunds are also
                displayed separately, but money received back increases
                the available general balance and money sent back reduces
                it. Unpaid personal funds only reduce the balance after
                they are marked as paid back.
              </p>

              <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-black text-white ring-1 ring-white/10 transition hover:bg-white/20"
              >
                {open ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}

                {open ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:w-[930px] xl:grid-cols-3 2xl:grid-cols-6">
            <MetricCard
              title="General Money In"
              value={formatMoney(totals.generalIncome)}
              note="Ordinary unrestricted income only"
              tone="emerald"
              icon={<TrendingUp className="h-4 w-4" />}
            />

            <MetricCard
              title="General Money Out"
              value={formatMoney(totals.generalOut)}
              note={
                totals.unpaidPersonalFunds > 0
                  ? `${formatMoney(
                      totals.unpaidPersonalFunds
                    )} personal funds not counted yet`
                  : "Ordinary Burton Pride spending only"
              }
              tone="red"
              icon={<TrendingDown className="h-4 w-4" />}
            />

            <MetricCard
              title="Refunds Received Back"
              value={formatMoney(totals.refundsReceivedBack)}
              note="Added back into the available balance"
              tone="violet"
              icon={<RefreshCcw className="h-4 w-4" />}
            />

            <MetricCard
              title="Refunds Sent Back"
              value={formatMoney(totals.refundsSentBack)}
              note="Removed from the available balance"
              tone="rose"
              icon={<RotateCcw className="h-4 w-4" />}
            />

            <MetricCard
              title="Restricted Funding Left"
              value={formatMoney(totals.restrictedLeft)}
              note="Kept separate from general money"
              tone="amber"
              icon={<LockKeyhole className="h-4 w-4" />}
            />

            <MetricCard
              title="Available General Balance"
              value={formatMoney(totals.generalBalance)}
              note="General money in − general money out + refunds received − refunds sent"
              tone="sky"
              icon={<Wallet className="h-4 w-4" />}
            />
          </div>
        </div>

        {refundLoadError ? (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />

            <div>
              <p className="font-black">
                Refund totals could not be loaded
              </p>

              <p className="mt-1 leading-6 text-rose-100/80">
                {refundLoadError}
              </p>

              <p className="mt-1 text-xs leading-5 text-rose-100/60">
                The ordinary transaction totals are still shown, but the
                available general balance may be missing refund
                adjustments until the Refund Tracker API loads
                successfully.
              </p>
            </div>
          </div>
        ) : null}

        {isLoadingRefunds ? (
          <div className="flex items-center gap-2 text-xs font-bold text-sky-100/70">
            <RefreshCcw className="h-4 w-4 animate-spin" />

            Loading refund adjustments...
          </div>
        ) : null}
      </div>

      {open ? (
        <div className="mt-5 min-w-0">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {rows.map((row) => {
              const hasActivity = row.activityCount > 0;

              return (
                <div
                  key={row.key}
                  className={`min-w-0 rounded-2xl border p-4 ${
                    hasActivity
                      ? "border-white/10 bg-black/25"
                      : "border-white/5 bg-black/10"
                  }`}
                >
                  <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words text-base font-black text-white">
                        {row.shortLabel}
                      </h3>

                      <p className="mt-1 text-xs text-white/40">
                        {row.transactionCount} transaction
                        {row.transactionCount === 1 ? "" : "s"}

                        {row.refundCount > 0
                          ? ` · ${row.refundCount} refund${
                              row.refundCount === 1 ? "" : "s"
                            }`
                          : ""}
                      </p>
                    </div>

                    <div
                      className={`shrink-0 rounded-xl px-3 py-1 text-xs font-black ring-1 ${
                        row.generalBalance >= 0
                          ? "bg-emerald-500/10 text-emerald-100 ring-emerald-300/20"
                          : "bg-red-500/10 text-red-100 ring-red-300/20"
                      }`}
                    >
                      Balance {formatMoney(row.generalBalance)}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <MonthProgress
                      label="General money in"
                      value={row.generalIncome}
                      max={maxMonthValue}
                      tone="emerald"
                    />

                    <MonthProgress
                      label="General money out"
                      value={row.generalOut}
                      max={maxMonthValue}
                      tone="red"
                    />

                    <MonthProgress
                      label="Refunds received back"
                      value={row.refundsReceivedBack}
                      max={maxMonthValue}
                      tone="violet"
                    />

                    <MonthProgress
                      label="Refunds sent back"
                      value={row.refundsSentBack}
                      max={maxMonthValue}
                      tone="rose"
                    />

                    <MonthProgress
                      label="Restricted funding left"
                      value={row.restrictedLeft}
                      max={maxMonthValue}
                      tone="amber"
                    />

                    {row.unpaidPersonalFunds > 0 ? (
                      <div className="rounded-xl bg-orange-500/10 px-3 py-2 text-xs font-bold leading-5 text-orange-100 ring-1 ring-orange-300/20">
                        {formatMoney(row.unpaidPersonalFunds)} personal
                        funds not counted yet
                      </div>
                    ) : null}

                    {row.refundsReceivedBack > 0 ||
                    row.refundsSentBack > 0 ? (
                      <div className="rounded-xl bg-violet-500/10 px-3 py-2 text-xs font-bold leading-5 text-violet-100 ring-1 ring-violet-300/20">
                        Refund adjustment:{" "}
                        {formatMoney(
                          row.refundsReceivedBack -
                            row.refundsSentBack
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {totals.activityCount === 0 ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
              No monthly transaction or refund activity found for{" "}
              {selectedYear}.
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4 text-sm leading-6 text-sky-100/80">
            <div className="flex items-start gap-3">
              <Coins className="mt-0.5 h-5 w-5 shrink-0 text-sky-100" />

              <div>
                <p className="font-black text-sky-100">
                  How the available general balance is calculated
                </p>

                <p className="mt-1">
                  General money in minus general money out, plus completed
                  refunds received back, minus completed refunds sent back.
                  Refunds remain visible separately so they are not
                  confused with new income or ordinary spending.
                  Restricted sponsor, grant, loan or funding balances stay
                  separate because they are not free general money.
                </p>
              </div>
            </div>
          </div>

          {totals.refundCount > 0 ? (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-100/80">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-100" />

              <p>
                {totals.refundCount} completed refund
                {totals.refundCount === 1 ? "" : "s"} included in the
                monthly balance calculation for {selectedYear}.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}