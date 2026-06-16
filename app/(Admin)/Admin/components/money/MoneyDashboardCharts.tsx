"use client";

import type { ReactNode } from "react";
import { BarChart3, CircleDollarSign, HandCoins } from "lucide-react";

import type { Transaction } from "@/lib/money/types";
import { money } from "@/lib/money/helpers";
import {
  getTransactionMonthKey,
  getTransactionYear,
  isPersonalFundsTransaction,
} from "@/lib/money/utils";

type SponsorBreakdownItem = {
  sponsor_id: string;
  sponsor_name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  agreed_amount_pence: number;
  received_pence: number;
  spent_pence: number;
  remaining_pence: number;
  carried_forward_pence?: number;
  notes?: string | null;
};

type MoneyDashboardChartsProps = {
  selectedYear: string;
  transactions: Transaction[];
  yearlySponsorBreakdown: SponsorBreakdownItem[];
};

type MonthInfo = {
  key: string;
  short: string;
  full: string;
};

type MonthlyChartRow = MonthInfo & {
  moneyIn: number;
  moneyOut: number;
  balance: number;
};

type BarTone = "emerald" | "red" | "amber";

const MONTHS: MonthInfo[] = [
  { key: "01", short: "Jan", full: "January" },
  { key: "02", short: "Feb", full: "February" },
  { key: "03", short: "Mar", full: "March" },
  { key: "04", short: "Apr", full: "April" },
  { key: "05", short: "May", full: "May" },
  { key: "06", short: "Jun", full: "June" },
  { key: "07", short: "Jul", full: "July" },
  { key: "08", short: "Aug", full: "August" },
  { key: "09", short: "Sep", full: "September" },
  { key: "10", short: "Oct", full: "October" },
  { key: "11", short: "Nov", full: "November" },
  { key: "12", short: "Dec", full: "December" },
];

const barToneClass: Record<BarTone, string> = {
  emerald: "bg-emerald-400",
  red: "bg-red-400",
  amber: "bg-amber-400",
};

function safeAmount(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function safePercent(value: number, max: number) {
  if (!max || max <= 0 || value <= 0) return 0;
  return Math.max(2, Math.min(100, Math.round((value / max) * 100)));
}

function isDonationTransaction(item: Transaction) {
  if (item.type !== "income") return false;

  const searchableText = [
    item.title,
    item.source,
    item.payment_method,
    item.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    searchableText.includes("donation") || searchableText.includes("stripe")
  );
}

function isYearTransaction(item: Transaction, selectedYear: string) {
  const date = item.transaction_date || item.created_at;
  return getTransactionYear(date) === selectedYear;
}

function totalPence(items: Transaction[]) {
  return items.reduce((sum, item) => sum + safeAmount(item.amount_pence), 0);
}

function buildMonthlyRows(
  selectedYear: string,
  yearTransactions: Transaction[],
): MonthlyChartRow[] {
  return MONTHS.map((month) => {
    const monthKey = `${selectedYear}-${month.key}`;

    const rows = yearTransactions.filter((item) => {
      const date = item.transaction_date || item.created_at;
      return getTransactionMonthKey(date) === monthKey;
    });

    const moneyIn = totalPence(rows.filter((item) => item.type === "income"));
    const moneyOut = totalPence(
      rows.filter(
        (item) => item.type === "expense" && !isPersonalFundsTransaction(item),
      ),
    );

    return {
      ...month,
      moneyIn,
      moneyOut,
      balance: moneyIn - moneyOut,
    };
  });
}

function ChartPanel({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/10 sm:p-5">
      <div className="mb-5 flex items-start gap-3">
        {icon}

        <div className="min-w-0">
          <h2 className="break-words text-lg font-black text-white">{title}</h2>
          <p className="mt-1 text-sm leading-5 text-white/50">{description}</p>
        </div>
      </div>

      {children}
    </div>
  );
}

function ProgressBar({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: BarTone;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="font-bold text-white/70">{label}</span>
        <span className="shrink-0 font-bold text-white/70">{money(value)}</span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${barToneClass[tone]}`}
          style={{ width: `${safePercent(value, max)}%` }}
        />
      </div>
    </div>
  );
}

function MonthlyMoneyChart({
  rows,
  maxValue,
}: {
  rows: MonthlyChartRow[];
  maxValue: number;
}) {
  return (
    <div className="space-y-3">
      {rows.map((month) => (
        <div key={month.key} className="rounded-2xl bg-black/20 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-white">{month.short}</p>
              <p className="text-[11px] text-white/40">{month.full}</p>
            </div>

            <p
              className={`shrink-0 text-xs font-black ${
                month.balance >= 0 ? "text-emerald-300" : "text-red-300"
              }`}
            >
              Balance {money(month.balance)}
            </p>
          </div>

          <div className="space-y-2">
            <ProgressBar
              label="Money in"
              value={month.moneyIn}
              max={maxValue}
              tone="emerald"
            />
            <ProgressBar
              label="Money out"
              value={month.moneyOut}
              max={maxValue}
              tone="red"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ComparisonRow({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: BarTone;
}) {
  const panelClass =
    tone === "emerald"
      ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
      : tone === "red"
        ? "border-red-300/20 bg-red-500/10 text-red-100"
        : "border-amber-300/20 bg-amber-500/10 text-amber-100";

  return (
    <div className={`rounded-2xl border p-4 ${panelClass}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="font-black">{label}</p>
        <p className="font-black text-white">{money(value)}</p>
      </div>

      <div className="h-4 overflow-hidden rounded-full bg-black/30">
        <div
          className={`h-full rounded-full ${barToneClass[tone]}`}
          style={{ width: `${safePercent(value, max)}%` }}
        />
      </div>
    </div>
  );
}

function DonationsVsExpenses({
  donationsTotal,
  expensesTotal,
}: {
  donationsTotal: number;
  expensesTotal: number;
}) {
  const maxValue = Math.max(1, donationsTotal, expensesTotal);
  const difference = donationsTotal - expensesTotal;

  return (
    <div className="space-y-4">
      <ComparisonRow
        label="Donations"
        value={donationsTotal}
        max={maxValue}
        tone="emerald"
      />

      <ComparisonRow
        label="Expenses"
        value={expensesTotal}
        max={maxValue}
        tone="red"
      />

      <div className="rounded-2xl bg-black/20 p-4 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-white/60">Difference</span>
          <strong
            className={difference >= 0 ? "text-emerald-300" : "text-red-300"}
          >
            {money(difference)}
          </strong>
        </div>
      </div>
    </div>
  );
}

function SponsorMoneyCard({
  sponsor,
  maxSponsorReceived,
}: {
  sponsor: SponsorBreakdownItem;
  maxSponsorReceived: number;
}) {
  const received = sponsor.received_pence || maxSponsorReceived;
  const spent = safeAmount(sponsor.spent_pence);
  const remaining = safeAmount(sponsor.remaining_pence);

  return (
    <div className="rounded-2xl bg-black/20 p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-black text-white">
            {sponsor.sponsor_name}
          </p>
          <p className="mt-1 text-xs text-white/50">
            Received {money(sponsor.received_pence)}
          </p>
        </div>

        <p
          className={`shrink-0 text-sm font-black ${
            remaining >= 0 ? "text-amber-200" : "text-red-300"
          }`}
        >
          {money(remaining)}
        </p>
      </div>

      <div className="grid gap-2">
        <ProgressBar label="Spent" value={spent} max={received} tone="red" />
        <ProgressBar
          label="Left"
          value={Math.max(remaining, 0)}
          max={received}
          tone="amber"
        />
      </div>

      {remaining < 0 ? (
        <div className="mt-3 rounded-xl border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-100">
          Overspent by {money(Math.abs(remaining))}
        </div>
      ) : null}
    </div>
  );
}

function SponsorMoneyLeft({
  selectedYear,
  sponsors,
}: {
  selectedYear: string;
  sponsors: SponsorBreakdownItem[];
}) {
  if (sponsors.length === 0) {
    return (
      <div className="rounded-2xl bg-black/20 p-4 text-sm text-white/60">
        No sponsor money to show for {selectedYear}.
      </div>
    );
  }

  const maxSponsorReceived = Math.max(
    1,
    ...sponsors.map((sponsor) => sponsor.received_pence || 0),
  );

  return (
    <div className="space-y-3">
      {sponsors.map((sponsor) => (
        <SponsorMoneyCard
          key={sponsor.sponsor_id}
          sponsor={sponsor}
          maxSponsorReceived={maxSponsorReceived}
        />
      ))}
    </div>
  );
}

export default function MoneyDashboardCharts({
  selectedYear,
  transactions,
  yearlySponsorBreakdown,
}: MoneyDashboardChartsProps) {
  const yearTransactions = transactions.filter((item) =>
    isYearTransaction(item, selectedYear),
  );

  const monthlyData = buildMonthlyRows(selectedYear, yearTransactions);

  const maxMonthlyValue = Math.max(
    1,
    ...monthlyData.map((month) => Math.max(month.moneyIn, month.moneyOut)),
  );

  const donationsTotal = totalPence(
    yearTransactions.filter(isDonationTransaction),
  );

  const expensesTotal = totalPence(
    yearTransactions.filter(
      (item) => item.type === "expense" && !isPersonalFundsTransaction(item),
    ),
  );

  const sponsorsWithMoney = yearlySponsorBreakdown
    .filter(
      (sponsor) =>
        safeAmount(sponsor.received_pence) > 0 ||
        safeAmount(sponsor.spent_pence) > 0 ||
        safeAmount(sponsor.remaining_pence) !== 0,
    )
    .sort(
      (a, b) => safeAmount(b.remaining_pence) - safeAmount(a.remaining_pence),
    );

  return (
    <section className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-3">
      <ChartPanel
        icon={
          <div className="rounded-2xl bg-sky-500/15 p-3 text-sky-200 ring-1 ring-sky-300/20">
            <BarChart3 className="h-5 w-5" />
          </div>
        }
        title="Money in/out by month"
        description={`Monthly income and spending for ${selectedYear}.`}
      >
        <MonthlyMoneyChart rows={monthlyData} maxValue={maxMonthlyValue} />
      </ChartPanel>

      <ChartPanel
        icon={
          <div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-200 ring-1 ring-emerald-300/20">
            <CircleDollarSign className="h-5 w-5" />
          </div>
        }
        title="Donations vs expenses"
        description={`Quick comparison for ${selectedYear}.`}
      >
        <DonationsVsExpenses
          donationsTotal={donationsTotal}
          expensesTotal={expensesTotal}
        />
      </ChartPanel>

      <ChartPanel
        icon={
          <div className="rounded-2xl bg-amber-500/15 p-3 text-amber-200 ring-1 ring-amber-300/20">
            <HandCoins className="h-5 w-5" />
          </div>
        }
        title="Sponsor money left"
        description="Remaining sponsorship balance by sponsor."
      >
        <SponsorMoneyLeft
          selectedYear={selectedYear}
          sponsors={sponsorsWithMoney}
        />
      </ChartPanel>
    </section>
  );
}
