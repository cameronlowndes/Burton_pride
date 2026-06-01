"use client";

import { BarChart3, CircleDollarSign, HandCoins } from "lucide-react";
import type { Transaction } from "@/lib/money/types";
import {
  getTransactionMonthKey,
  getTransactionYear,
  isPersonalFundsTransaction,
  isSponsorshipTransaction,
} from "@/lib/money/utils";
import { money } from "@/lib/money/helpers";

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

const months = [
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

function safePercent(value: number, max: number) {
  if (!max || max <= 0) return 0;
  return Math.max(2, Math.min(100, Math.round((value / max) * 100)));
}

function isDonationTransaction(item: Transaction) {
  const title = item.title?.toLowerCase() || "";
  const source = item.source?.toLowerCase() || "";
  const paymentMethod = item.payment_method?.toLowerCase() || "";
  const description = item.description?.toLowerCase() || "";

  return (
    item.type === "income" &&
    (source.includes("donation") ||
      title.includes("donation") ||
      description.includes("donation") ||
      paymentMethod.includes("stripe"))
  );
}

export default function MoneyDashboardCharts({
  selectedYear,
  transactions,
  yearlySponsorBreakdown,
}: MoneyDashboardChartsProps) {
  const yearTransactions = transactions.filter((item) => {
    const date = item.transaction_date || item.created_at;
    return getTransactionYear(date) === selectedYear;
  });

  const monthlyData = months.map((month) => {
    const monthKey = `${selectedYear}-${month.key}`;

    const rows = yearTransactions.filter((item) => {
      const date = item.transaction_date || item.created_at;
      return getTransactionMonthKey(date) === monthKey;
    });

    const moneyIn = rows
      .filter((item) => item.type === "income")
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    const moneyOut = rows
      .filter((item) => item.type === "expense" && !isPersonalFundsTransaction(item))
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    return {
      ...month,
      moneyIn,
      moneyOut,
      balance: moneyIn - moneyOut,
    };
  });

  const maxMonthlyValue = Math.max(
    1,
    ...monthlyData.map((month) => Math.max(month.moneyIn, month.moneyOut))
  );

  const donationsTotal = yearTransactions
    .filter((item) => isDonationTransaction(item))
    .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

  const expensesTotal = yearTransactions
    .filter((item) => item.type === "expense" && !isPersonalFundsTransaction(item))
    .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

  const donationsVsExpensesMax = Math.max(1, donationsTotal, expensesTotal);

  const sponsorsWithMoney = yearlySponsorBreakdown
    .filter(
      (sponsor) =>
        sponsor.received_pence > 0 ||
        sponsor.spent_pence > 0 ||
        sponsor.remaining_pence > 0
    )
    .sort((a, b) => b.remaining_pence - a.remaining_pence);

  const maxSponsorReceived = Math.max(
    1,
    ...sponsorsWithMoney.map((sponsor) => sponsor.received_pence || 0)
  );

  return (
    <section className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-3">
      <div className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-2xl bg-sky-500/15 p-3 text-sky-200 ring-1 ring-sky-300/20">
            <BarChart3 className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <h2 className="text-lg font-black text-white">
              Money in/out by month
            </h2>
            <p className="text-sm text-white/50">
              Monthly income and spending for {selectedYear}.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {monthlyData.map((month) => (
            <div key={month.key} className="rounded-2xl bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-white">{month.short}</p>
                <p
                  className={`text-xs font-bold ${
                    month.balance >= 0 ? "text-emerald-300" : "text-red-300"
                  }`}
                >
                  Balance {money(month.balance)}
                </p>
              </div>

              <div className="space-y-2">
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-emerald-200">Money in</span>
                    <span className="text-white/70">{money(month.moneyIn)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-emerald-400"
                      style={{
                        width: `${safePercent(month.moneyIn, maxMonthlyValue)}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-red-200">Money out</span>
                    <span className="text-white/70">{money(month.moneyOut)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-red-400"
                      style={{
                        width: `${safePercent(month.moneyOut, maxMonthlyValue)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-200 ring-1 ring-emerald-300/20">
            <CircleDollarSign className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <h2 className="text-lg font-black text-white">
              Donations vs expenses
            </h2>
            <p className="text-sm text-white/50">
              Quick comparison for {selectedYear}.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="font-bold text-emerald-100">Donations</p>
              <p className="font-black text-white">{money(donationsTotal)}</p>
            </div>

            <div className="h-4 overflow-hidden rounded-full bg-black/30">
              <div
                className="h-full rounded-full bg-emerald-400"
                style={{
                  width: `${safePercent(
                    donationsTotal,
                    donationsVsExpensesMax
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="font-bold text-red-100">Expenses</p>
              <p className="font-black text-white">{money(expensesTotal)}</p>
            </div>

            <div className="h-4 overflow-hidden rounded-full bg-black/30">
              <div
                className="h-full rounded-full bg-red-400"
                style={{
                  width: `${safePercent(
                    expensesTotal,
                    donationsVsExpensesMax
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="rounded-2xl bg-black/20 p-4 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-white/60">Difference</span>
              <strong
                className={
                  donationsTotal - expensesTotal >= 0
                    ? "text-emerald-300"
                    : "text-red-300"
                }
              >
                {money(donationsTotal - expensesTotal)}
              </strong>
            </div>
          </div>
        </div>
      </div>

      <div className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-2xl bg-amber-500/15 p-3 text-amber-200 ring-1 ring-amber-300/20">
            <HandCoins className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <h2 className="text-lg font-black text-white">
              Sponsor money left
            </h2>
            <p className="text-sm text-white/50">
              Remaining sponsorship balance by sponsor.
            </p>
          </div>
        </div>

        {sponsorsWithMoney.length === 0 ? (
          <div className="rounded-2xl bg-black/20 p-4 text-sm text-white/60">
            No sponsor money to show for {selectedYear}.
          </div>
        ) : (
          <div className="space-y-3">
            {sponsorsWithMoney.map((sponsor) => {
              const spentPercent = safePercent(
                sponsor.spent_pence,
                sponsor.received_pence || maxSponsorReceived
              );

              const remainingPercent = safePercent(
                Math.max(sponsor.remaining_pence, 0),
                sponsor.received_pence || maxSponsorReceived
              );

              return (
                <div
                  key={sponsor.sponsor_id}
                  className="rounded-2xl bg-black/20 p-3"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-bold text-white">
                        {sponsor.sponsor_name}
                      </p>
                      <p className="text-xs text-white/50">
                        Received {money(sponsor.received_pence)}
                      </p>
                    </div>

                    <p
                      className={`shrink-0 text-sm font-black ${
                        sponsor.remaining_pence >= 0
                          ? "text-amber-200"
                          : "text-red-300"
                      }`}
                    >
                      {money(sponsor.remaining_pence)}
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <div>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-red-200">Spent</span>
                        <span className="text-white/70">
                          {money(sponsor.spent_pence)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-red-400"
                          style={{ width: `${spentPercent}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-amber-200">Left</span>
                        <span className="text-white/70">
                          {money(sponsor.remaining_pence)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-amber-400"
                          style={{ width: `${remainingPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {sponsor.remaining_pence < 0 && (
                    <div className="mt-3 rounded-xl border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                      Overspent by {money(Math.abs(sponsor.remaining_pence))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}