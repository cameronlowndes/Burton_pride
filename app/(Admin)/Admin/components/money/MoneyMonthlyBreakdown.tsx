"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Coins,
  LockKeyhole,
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
  generalBalance: number;
  unpaidPersonalFunds: number;
  transactionCount: number;
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
      String(item.payment_method || "").toLowerCase() === "personal funds"
  );
}

function getAmount(item: MoneyTransaction) {
  return Number(item.amount_pence || 0);
}

function buildMonthRows(transactions: MoneyTransaction[], selectedYear: string) {
  return MONTHS.map((month) => {
    const monthTransactions = transactions.filter((item) => {
      if (isDeleted(item)) return false;
      if (selectedYear && getTransactionYear(item) !== selectedYear) return false;
      return getTransactionMonth(item) === month.key;
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
      generalBalance: 0,
      unpaidPersonalFunds: 0,
      transactionCount: monthTransactions.length,
    };

    for (const item of monthTransactions) {
      const amount = getAmount(item);
      const restricted = isRestrictedFunding(item);
      const personal = isPersonalFunds(item);
      const unpaidPersonal = personal && !item.personal_funds_repaid;

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

    row.restrictedLeft = row.restrictedIncome - row.restrictedSpent;
    row.generalBalance = row.generalIncome - row.generalOut;

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
  tone: "emerald" | "red" | "amber" | "sky";
  icon: React.ReactNode;
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
      : tone === "red"
        ? "border-red-300/20 bg-red-500/10 text-red-100"
        : tone === "amber"
          ? "border-amber-300/20 bg-amber-500/10 text-amber-100"
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

      {note && (
        <p className="mt-2 break-words text-xs font-bold leading-5 opacity-80">
          {note}
        </p>
      )}
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
  tone: "emerald" | "red" | "amber" | "sky";
}) {
  const percent = max > 0 ? Math.min(100, Math.round((Math.abs(value) / max) * 100)) : 0;

  const barClass =
    tone === "emerald"
      ? "bg-emerald-400"
      : tone === "red"
        ? "bg-red-400"
        : tone === "amber"
          ? "bg-amber-400"
          : "bg-sky-400";

  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="break-words text-white/60">{label}</span>
        <span className="shrink-0 font-bold text-white/75">{formatMoney(value)}</span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export default function MoneyMonthlyBreakdown({
  selectedYear,
  transactions,
}: MoneyMonthlyBreakdownProps) {
  const [open, setOpen] = useState(false);

  const rows = useMemo(
    () => buildMonthRows(transactions || [], selectedYear),
    [transactions, selectedYear]
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
        acc.generalBalance += row.generalBalance;
        acc.unpaidPersonalFunds += row.unpaidPersonalFunds;
        acc.transactionCount += row.transactionCount;
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
        generalBalance: 0,
        unpaidPersonalFunds: 0,
        transactionCount: 0,
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
      ])
    );
  }, [rows]);

  return (
    <section className="min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 sm:p-5">
      <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-100 ring-1 ring-sky-300/20">
            <CalendarDays className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <h2 className="break-words text-2xl font-black text-white">
              Monthly Breakdown
            </h2>

            <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-white/60">
              Jan to Dec view for {selectedYear}. Restricted sponsor, grant,
              loan, or funding money is kept separate from the general Burton
              Pride balance. Unpaid personal funds only reduce the balance after
              they are marked paid back.
            </p>

            <button
              type="button"
              onClick={() => setOpen((current) => !current)}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20"
            >
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {open ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:w-[720px] xl:grid-cols-4">
          <MetricCard
            title="General Money In"
            value={formatMoney(totals.generalIncome)}
            tone="emerald"
            icon={<TrendingUp className="h-4 w-4" />}
          />

          <MetricCard
            title="General Money Out"
            value={formatMoney(totals.generalOut)}
            note={
              totals.unpaidPersonalFunds > 0
                ? `${formatMoney(totals.unpaidPersonalFunds)} personal funds not counted yet`
                : undefined
            }
            tone="red"
            icon={<TrendingDown className="h-4 w-4" />}
          />

          <MetricCard
            title="Restricted Funding Left"
            value={formatMoney(totals.restrictedLeft)}
            tone="amber"
            icon={<LockKeyhole className="h-4 w-4" />}
          />

          <MetricCard
            title="General Balance"
            value={formatMoney(totals.generalBalance)}
            tone="sky"
            icon={<Wallet className="h-4 w-4" />}
          />
        </div>
      </div>

      {open && (
        <div className="mt-5 min-w-0">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {rows.map((row) => {
              const hasActivity = row.transactionCount > 0;

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
                      label="Money in"
                      value={row.generalIncome}
                      max={maxMonthValue}
                      tone="emerald"
                    />

                    <MonthProgress
                      label="Money out"
                      value={row.generalOut}
                      max={maxMonthValue}
                      tone="red"
                    />

                    <MonthProgress
                      label="Restricted left"
                      value={row.restrictedLeft}
                      max={maxMonthValue}
                      tone="amber"
                    />

                    {row.unpaidPersonalFunds > 0 && (
                      <div className="rounded-xl bg-orange-500/10 px-3 py-2 text-xs font-bold leading-5 text-orange-100 ring-1 ring-orange-300/20">
                        {formatMoney(row.unpaidPersonalFunds)} personal funds
                        not counted yet
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {totals.transactionCount === 0 && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
              No monthly transaction activity found for {selectedYear}.
            </div>
          )}

          <div className="mt-4 rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4 text-sm leading-6 text-sky-100/80">
            <div className="flex items-start gap-3">
              <Coins className="mt-0.5 h-5 w-5 shrink-0 text-sky-100" />
              <p>
                General balance is calculated from unrestricted money in minus
                unrestricted money out. Restricted sponsor, grant, loan, or
                funding balances are shown separately so they do not look like
                free general money.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
