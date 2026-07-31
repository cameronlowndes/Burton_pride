"use client";

import { useMemo, type ReactNode } from "react";
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
  yearlySponsorBreakdown?: SponsorBreakdownItem[];
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

type TransactionRecord = Transaction & Record<string, unknown>;

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

function asRecord(transaction: Transaction): TransactionRecord {
  return transaction as TransactionRecord;
}

function cleanText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function lower(value: unknown): string {
  return cleanText(value).toLowerCase();
}

function safeAmount(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;

  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function nonNegativeAmount(value: unknown): number {
  return Math.max(0, safeAmount(value));
}

function safePercent(value: number, max: number): number {
  const safeValue = nonNegativeAmount(value);
  const safeMax = nonNegativeAmount(max);

  if (safeValue === 0 || safeMax === 0) return 0;

  return Math.min(100, Math.max(2, (safeValue / safeMax) * 100));
}

function transactionDate(item: Transaction): string {
  const record = asRecord(item);

  return (
    cleanText(record.transaction_date) ||
    cleanText(record.date) ||
    cleanText(record.created_at)
  );
}

function isDeletedTransaction(item: Transaction): boolean {
  return cleanText(asRecord(item).deleted_at).length > 0;
}

function transactionType(item: Transaction): string {
  return lower(asRecord(item).type);
}

function isDonationTransaction(item: Transaction): boolean {
  if (transactionType(item) !== "income") return false;

  const record = asRecord(item);
  const fields = [
    record.title,
    record.source,
    record.payment_method,
    record.description,
    record.category,
    record.transaction_category,
    record.income_type,
    record.reference,
    record.transaction_reference,
  ];

  const searchableText = fields.map(lower).filter(Boolean).join(" ");

  return (
    searchableText.includes("donation") ||
    searchableText.includes("donate") ||
    searchableText.includes("charitable gift") ||
    searchableText.includes("fundraising contribution")
  );
}

function isYearTransaction(item: Transaction, selectedYear: string): boolean {
  if (!selectedYear || selectedYear === "all") return true;

  const date = transactionDate(item);
  if (!date) return false;

  return getTransactionYear(date) === selectedYear;
}

function isTransactionInMonth(
  item: Transaction,
  selectedYear: string,
  monthKey: string,
): boolean {
  const date = transactionDate(item);
  if (!date) return false;

  const transactionMonthKey = getTransactionMonthKey(date);
  if (!transactionMonthKey) return false;

  if (!selectedYear || selectedYear === "all") {
    return transactionMonthKey.endsWith(`-${monthKey}`);
  }

  return transactionMonthKey === `${selectedYear}-${monthKey}`;
}

function totalPence(items: Transaction[]): number {
  return items.reduce(
    (sum, item) => sum + safeAmount(asRecord(item).amount_pence),
    0,
  );
}

function buildMonthlyRows(
  selectedYear: string,
  yearTransactions: Transaction[],
): MonthlyChartRow[] {
  return MONTHS.map((month) => {
    const rows = yearTransactions.filter((item) =>
      isTransactionInMonth(item, selectedYear, month.key),
    );

    const moneyIn = totalPence(
      rows.filter((item) => transactionType(item) === "income"),
    );

    const moneyOut = totalPence(
      rows.filter(
        (item) =>
          transactionType(item) === "expense" &&
          !isPersonalFundsTransaction(item),
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

function yearLabel(selectedYear: string): string {
  return !selectedYear || selectedYear === "all" ? "all years" : selectedYear;
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
  const width = safePercent(value, max);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="font-bold text-white/70">{label}</span>
        <span className="shrink-0 font-bold text-white/70">{money(value)}</span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={Math.max(0, max)}
          aria-valuenow={Math.max(0, value)}
          className={`h-full rounded-full transition-[width] duration-300 ${barToneClass[tone]}`}
          style={{ width: `${width}%` }}
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
  const hasData = rows.some(
    (month) => month.moneyIn !== 0 || month.moneyOut !== 0,
  );

  if (!hasData) {
    return (
      <div className="rounded-2xl bg-black/20 p-4 text-sm text-white/60">
        No income or expense transactions were found for this period.
      </div>
    );
  }

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
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={Math.max(0, max)}
          aria-valuenow={Math.max(0, value)}
          className={`h-full rounded-full transition-[width] duration-300 ${barToneClass[tone]}`}
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
}: {
  sponsor: SponsorBreakdownItem;
}) {
  const received = nonNegativeAmount(sponsor.received_pence);
  const spent = nonNegativeAmount(sponsor.spent_pence);
  const remaining = safeAmount(sponsor.remaining_pence);
  const positiveRemaining = Math.max(remaining, 0);

  // Each sponsor is scaled against its own actual figures. A sponsor with no
  // received money must never inherit another sponsor's received amount.
  const scaleMax = Math.max(1, received, spent, positiveRemaining);
  const sponsorName = cleanText(sponsor.sponsor_name) || "Unnamed sponsor";

  return (
    <div className="rounded-2xl bg-black/20 p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-black text-white">
            {sponsorName}
          </p>
          <p className="mt-1 text-xs text-white/50">
            Received {money(received)}
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
        <ProgressBar label="Spent" value={spent} max={scaleMax} tone="red" />
        <ProgressBar
          label="Left"
          value={positiveRemaining}
          max={scaleMax}
          tone="amber"
        />
      </div>

      {received === 0 && spent > 0 ? (
        <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-100">
          Spending is recorded, but no sponsor money has been received.
        </div>
      ) : null}

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
        No sponsor money to show for {yearLabel(selectedYear)}.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sponsors.map((sponsor, index) => (
        <SponsorMoneyCard
          key={
            cleanText(sponsor.sponsor_id) ||
            `${cleanText(sponsor.sponsor_name) || "sponsor"}-${index}`
          }
          sponsor={sponsor}
        />
      ))}
    </div>
  );
}

export default function MoneyDashboardCharts({
  selectedYear,
  transactions,
  yearlySponsorBreakdown = [],
}: MoneyDashboardChartsProps) {
  const yearTransactions = useMemo(
    () =>
      transactions.filter(
        (item) =>
          !isDeletedTransaction(item) && isYearTransaction(item, selectedYear),
      ),
    [transactions, selectedYear],
  );

  const monthlyData = useMemo(
    () => buildMonthlyRows(selectedYear, yearTransactions),
    [selectedYear, yearTransactions],
  );

  const maxMonthlyValue = useMemo(
    () =>
      Math.max(
        1,
        ...monthlyData.map((month) =>
          Math.max(month.moneyIn, month.moneyOut),
        ),
      ),
    [monthlyData],
  );

  const donationsTotal = useMemo(
    () => totalPence(yearTransactions.filter(isDonationTransaction)),
    [yearTransactions],
  );

  const expensesTotal = useMemo(
    () =>
      totalPence(
        yearTransactions.filter(
          (item) =>
            transactionType(item) === "expense" &&
            !isPersonalFundsTransaction(item),
        ),
      ),
    [yearTransactions],
  );

  const sponsorsWithMoney = useMemo(
    () =>
      yearlySponsorBreakdown
        .filter((sponsor) => {
          const received = safeAmount(sponsor.received_pence);
          const spent = safeAmount(sponsor.spent_pence);
          const remaining = safeAmount(sponsor.remaining_pence);
          const carriedForward = safeAmount(sponsor.carried_forward_pence);

          return (
            received !== 0 ||
            spent !== 0 ||
            remaining !== 0 ||
            carriedForward !== 0
          );
        })
        .slice()
        .sort(
          (a, b) =>
            safeAmount(b.remaining_pence) - safeAmount(a.remaining_pence),
        ),
    [yearlySponsorBreakdown],
  );

  const selectedPeriodLabel = yearLabel(selectedYear);

  return (
    <section
      className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-3"
      aria-label={`Money dashboard charts for ${selectedPeriodLabel}`}
    >
      <ChartPanel
        icon={
          <div className="rounded-2xl bg-sky-500/15 p-3 text-sky-200 ring-1 ring-sky-300/20">
            <BarChart3 className="h-5 w-5" aria-hidden="true" />
          </div>
        }
        title="Money in/out by month"
        description={`Monthly income and spending for ${selectedPeriodLabel}.`}
      >
        <MonthlyMoneyChart rows={monthlyData} maxValue={maxMonthlyValue} />
      </ChartPanel>

      <ChartPanel
        icon={
          <div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-200 ring-1 ring-emerald-300/20">
            <CircleDollarSign className="h-5 w-5" aria-hidden="true" />
          </div>
        }
        title="Donations vs expenses"
        description={`Quick comparison for ${selectedPeriodLabel}.`}
      >
        <DonationsVsExpenses
          donationsTotal={donationsTotal}
          expensesTotal={expensesTotal}
        />
      </ChartPanel>

      <ChartPanel
        icon={
          <div className="rounded-2xl bg-amber-500/15 p-3 text-amber-200 ring-1 ring-amber-300/20">
            <HandCoins className="h-5 w-5" aria-hidden="true" />
          </div>
        }
        title="Sponsor money left"
        description={`Remaining sponsorship balance for ${selectedPeriodLabel}.`}
      >
        <SponsorMoneyLeft
          selectedYear={selectedYear}
          sponsors={sponsorsWithMoney}
        />
      </ChartPanel>
    </section>
  );
}
