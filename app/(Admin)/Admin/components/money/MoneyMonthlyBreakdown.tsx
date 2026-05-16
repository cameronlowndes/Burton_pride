"use client";

import { useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { Transaction } from "@/lib/money/types";

type MoneyMonthlyBreakdownProps = {
  selectedYear: string;
  transactions: Transaction[];
};

type MonthlyRow = {
  key: string;
  label: string;
  income: number;
  donations: number;
  expenses: number;
  normalExpenses: number;
  personalFundsPaidBack: number;
  personalFundsOutstanding: number;
  personalFundsTotal: number;
  moneyOut: number;
  balance: number;
  runningBalance: number;
};

const months = [
  { key: "01", label: "January" },
  { key: "02", label: "February" },
  { key: "03", label: "March" },
  { key: "04", label: "April" },
  { key: "05", label: "May" },
  { key: "06", label: "June" },
  { key: "07", label: "July" },
  { key: "08", label: "August" },
  { key: "09", label: "September" },
  { key: "10", label: "October" },
  { key: "11", label: "November" },
  { key: "12", label: "December" },
];

function money(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format((Number(value) || 0) / 100);
}

function getTransactionMonth(transaction: Transaction) {
  const dateValue = transaction.transaction_date || transaction.created_at || "";
  if (!dateValue) return "";

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";

  return String(date.getMonth() + 1).padStart(2, "0");
}

function getTransactionYear(transaction: Transaction) {
  const dateValue = transaction.transaction_date || transaction.created_at || "";
  if (!dateValue) return "";

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";

  return String(date.getFullYear());
}

function isDonationTransaction(transaction: Transaction) {
  const source = String(transaction.source || "").toLowerCase();
  const title = String(transaction.title || "").toLowerCase();
  const category = String(transaction.category || "").toLowerCase();

  return (
    source === "website_donation" ||
    source === "website_monthly_donation" ||
    source.includes("donation") ||
    title.includes("donation") ||
    category.includes("donation")
  );
}

function isPersonalFunds(transaction: Transaction) {
  const paymentMethod = String(transaction.payment_method || "").toLowerCase();

  return Boolean(
    transaction.is_personal_funds === true ||
      paymentMethod === "personal funds" ||
      transaction.personal_funds_name
  );
}

function isHiddenTransaction(transaction: Transaction) {
  return Boolean(
    "deleted_at" in transaction &&
      (transaction as Transaction & { deleted_at?: string | null }).deleted_at
  );
}

export default function MoneyMonthlyBreakdown({
  selectedYear,
  transactions,
}: MoneyMonthlyBreakdownProps) {
  const [minimised, setMinimised] = useState(true);

  const yearTransactions = transactions.filter((transaction) => {
    if (isHiddenTransaction(transaction)) return false;
    return getTransactionYear(transaction) === selectedYear;
  });

  let runningBalance = 0;

  const monthlyRows: MonthlyRow[] = months.map((month) => {
    const monthTransactions = yearTransactions.filter(
      (transaction) => getTransactionMonth(transaction) === month.key
    );

    const income = monthTransactions
      .filter((transaction) => transaction.type === "income")
      .reduce(
        (total, transaction) => total + Number(transaction.amount_pence || 0),
        0
      );

    const donations = monthTransactions
      .filter((transaction) => transaction.type === "income")
      .filter(isDonationTransaction)
      .reduce(
        (total, transaction) => total + Number(transaction.amount_pence || 0),
        0
      );

    const normalExpenses = monthTransactions
      .filter(
        (transaction) =>
          transaction.type === "expense" && !isPersonalFunds(transaction)
      )
      .reduce(
        (total, transaction) => total + Number(transaction.amount_pence || 0),
        0
      );

    const personalFundsPaidBack = monthTransactions
      .filter(
        (transaction) =>
          transaction.type === "expense" &&
          isPersonalFunds(transaction) &&
          transaction.personal_funds_repaid === true
      )
      .reduce(
        (total, transaction) => total + Number(transaction.amount_pence || 0),
        0
      );

    const personalFundsOutstanding = monthTransactions
      .filter(
        (transaction) =>
          transaction.type === "expense" &&
          isPersonalFunds(transaction) &&
          transaction.personal_funds_repaid !== true
      )
      .reduce(
        (total, transaction) => total + Number(transaction.amount_pence || 0),
        0
      );

    const personalFundsTotal =
      personalFundsPaidBack + personalFundsOutstanding;

    /*
      Important:
      Personal funds are not Burton Pride money until the person has been paid back.
      So unpaid personal funds show separately, but they do not reduce Money Out or Balance.
    */
    const expenses = normalExpenses;
    const moneyOut = normalExpenses + personalFundsPaidBack;
    const balance = income - moneyOut;

    runningBalance += balance;

    return {
      key: month.key,
      label: month.label,
      income,
      donations,
      expenses,
      normalExpenses,
      personalFundsPaidBack,
      personalFundsOutstanding,
      personalFundsTotal,
      moneyOut,
      balance,
      runningBalance,
    };
  });

  const totals = monthlyRows.reduce(
    (acc, row) => ({
      income: acc.income + row.income,
      donations: acc.donations + row.donations,
      expenses: acc.expenses + row.expenses,
      normalExpenses: acc.normalExpenses + row.normalExpenses,
      personalFundsPaidBack:
        acc.personalFundsPaidBack + row.personalFundsPaidBack,
      personalFundsOutstanding:
        acc.personalFundsOutstanding + row.personalFundsOutstanding,
      personalFundsTotal: acc.personalFundsTotal + row.personalFundsTotal,
      moneyOut: acc.moneyOut + row.moneyOut,
      balance: acc.balance + row.balance,
    }),
    {
      income: 0,
      donations: 0,
      expenses: 0,
      normalExpenses: 0,
      personalFundsPaidBack: 0,
      personalFundsOutstanding: 0,
      personalFundsTotal: 0,
      moneyOut: 0,
      balance: 0,
    }
  );

  const bestMonth = [...monthlyRows].sort((a, b) => b.balance - a.balance)[0];

  const highestExpenseMonth = [...monthlyRows].sort(
    (a, b) => b.moneyOut - a.moneyOut
  )[0];

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-white sm:p-5">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CalendarDays className="h-5 w-5 text-sky-200" />

            <h2 className="text-xl font-bold">Monthly Breakdown</h2>

            <button
              type="button"
              onClick={() => setMinimised((prev) => !prev)}
              className="ml-0 inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20 sm:ml-3"
            >
              {minimised ? (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Show
                </>
              ) : (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Minimise
                </>
              )}
            </button>
          </div>

          <p className="mt-1 text-sm text-white/50">
            Jan to Dec view for {selectedYear}. Unpaid personal funds are shown
            separately and only count as Burton Pride money out after they are
            marked paid back.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:min-w-[560px]">
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-3">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-100/70">
              <TrendingUp className="h-4 w-4" />
              Year Money In
            </div>

            <p className="mt-1 text-lg font-black text-emerald-200">
              {money(totals.income)}
            </p>
          </div>

          <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-3">
            <div className="flex items-center gap-2 text-xs font-bold text-red-100/70">
              <TrendingDown className="h-4 w-4" />
              Year Money Out
            </div>

            <p className="mt-1 text-lg font-black text-red-200">
              {money(totals.moneyOut)}
            </p>

            {totals.personalFundsOutstanding > 0 && (
              <p className="mt-1 text-[11px] font-bold text-orange-200">
                {money(totals.personalFundsOutstanding)} personal funds not
                counted yet
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-sky-300/20 bg-sky-500/10 p-3">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-100/70">
              <Wallet className="h-4 w-4" />
              Year Balance
            </div>

            <p
              className={`mt-1 text-lg font-black ${
                totals.balance >= 0 ? "text-sky-200" : "text-red-200"
              }`}
            >
              {money(totals.balance)}
            </p>
          </div>
        </div>
      </div>

      {!minimised && (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-white/40">
                Best month
              </p>

              <p className="mt-1 text-sm font-bold text-white">
                {bestMonth?.label || "None"}
              </p>

              <p
                className={`mt-1 text-lg font-black ${
                  (bestMonth?.balance || 0) >= 0
                    ? "text-emerald-200"
                    : "text-red-200"
                }`}
              >
                {money(bestMonth?.balance || 0)}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-white/40">
                Highest money out month
              </p>

              <p className="mt-1 text-sm font-bold text-white">
                {highestExpenseMonth?.label || "None"}
              </p>

              <p className="mt-1 text-lg font-black text-red-200">
                {money(highestExpenseMonth?.moneyOut || 0)}
              </p>
            </div>

            <div className="rounded-2xl border border-orange-300/20 bg-orange-500/10 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-orange-100/70">
                Personal funds outstanding
              </p>

              <p className="mt-1 text-sm font-bold text-white">
                Not counted as Burton Pride money out yet
              </p>

              <p className="mt-1 text-lg font-black text-orange-200">
                {money(totals.personalFundsOutstanding)}
              </p>
            </div>
          </div>

          <div className="mb-4 rounded-2xl border border-orange-300/20 bg-orange-500/10 p-3 text-sm text-orange-100/80">
            <strong className="text-orange-100">Personal funds rule:</strong>{" "}
            unpaid personal funds are tracked as money owed, but they do not
            reduce Burton Pride balance until marked paid back.
          </div>

          <div className="w-full max-w-[calc(100vw-2rem)] overflow-x-auto rounded-2xl border border-white/10 xl:max-w-full">
            <table className="w-full min-w-[1180px] text-sm">
              <thead className="bg-white/10 text-white/60">
                <tr>
                  <th className="p-3 text-left">Month</th>
                  <th className="p-3 text-right">Money In</th>
                  <th className="p-3 text-right">Donations</th>
                  <th className="p-3 text-right">Money Out</th>
                  <th className="p-3 text-right">Normal Expenses</th>
                  <th className="p-3 text-right">Personal Paid Back</th>
                  <th className="p-3 text-right">Personal Outstanding</th>
                  <th className="p-3 text-right">Month Balance</th>
                  <th className="p-3 text-right">Running Balance</th>
                </tr>
              </thead>

              <tbody>
                {monthlyRows.map((row) => (
                  <tr key={row.key} className="border-t border-white/10">
                    <td className="whitespace-nowrap p-3 font-bold text-white">
                      {row.label}
                    </td>

                    <td className="whitespace-nowrap p-3 text-right font-bold text-emerald-200">
                      {money(row.income)}
                    </td>

                    <td className="whitespace-nowrap p-3 text-right font-bold text-pink-200">
                      {money(row.donations)}
                    </td>

                    <td className="whitespace-nowrap p-3 text-right font-bold text-red-200">
                      {money(row.moneyOut)}
                    </td>

                    <td className="whitespace-nowrap p-3 text-right font-bold text-orange-200">
                      {money(row.normalExpenses)}
                    </td>

                    <td className="whitespace-nowrap p-3 text-right font-bold text-emerald-200">
                      {money(row.personalFundsPaidBack)}
                    </td>

                    <td className="whitespace-nowrap p-3 text-right font-bold text-orange-200">
                      {money(row.personalFundsOutstanding)}
                    </td>

                    <td
                      className={`whitespace-nowrap p-3 text-right font-black ${
                        row.balance >= 0 ? "text-sky-200" : "text-red-200"
                      }`}
                    >
                      {money(row.balance)}
                    </td>

                    <td
                      className={`whitespace-nowrap p-3 text-right font-black ${
                        row.runningBalance >= 0
                          ? "text-white"
                          : "text-red-200"
                      }`}
                    >
                      {money(row.runningBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot className="border-t border-white/20 bg-white/10">
                <tr>
                  <td className="p-3 font-black text-white">Total</td>

                  <td className="whitespace-nowrap p-3 text-right font-black text-emerald-200">
                    {money(totals.income)}
                  </td>

                  <td className="whitespace-nowrap p-3 text-right font-black text-pink-200">
                    {money(totals.donations)}
                  </td>

                  <td className="whitespace-nowrap p-3 text-right font-black text-red-200">
                    {money(totals.moneyOut)}
                  </td>

                  <td className="whitespace-nowrap p-3 text-right font-black text-orange-200">
                    {money(totals.normalExpenses)}
                  </td>

                  <td className="whitespace-nowrap p-3 text-right font-black text-emerald-200">
                    {money(totals.personalFundsPaidBack)}
                  </td>

                  <td className="whitespace-nowrap p-3 text-right font-black text-orange-200">
                    {money(totals.personalFundsOutstanding)}
                  </td>

                  <td
                    className={`whitespace-nowrap p-3 text-right font-black ${
                      totals.balance >= 0 ? "text-sky-200" : "text-red-200"
                    }`}
                  >
                    {money(totals.balance)}
                  </td>

                  <td
                    className={`whitespace-nowrap p-3 text-right font-black ${
                      totals.balance >= 0 ? "text-white" : "text-red-200"
                    }`}
                  >
                    {money(totals.balance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
