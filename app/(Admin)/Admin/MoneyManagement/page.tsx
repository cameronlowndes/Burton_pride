"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CreditCard,
  PiggyBank,
  Plus,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";

type StatCardProps = {
  title: string;
  value: string;
  change?: string;
  positive?: boolean;
  icon: React.ElementType;
};

type Transaction = {
  id: string | number;
  name: string;
  category: string;
  date: string;
  amount: string;
  type: "income" | "expense";
};

type BreakdownItem = {
  label: string;
  value: string;
  width: string;
};

type DashboardResponse = {
  ok: boolean;
  error?: string;
  stats: {
    currentBalance: string;
    monthlyIncome: string;
    monthlySpending: string;
    savingsPot: string;
  };
  budget: {
    label: string;
    monthLabel: string;
    usedText: string;
    usedPercent: number;
    remainingText: string;
  };
  savings: {
    label: string;
    progressText: string;
    progressPercent: number;
  };
  summary: {
    totalIncome: string;
    totalExpenses: string;
    moneyLeft: string;
  };
  spendingBreakdown: BreakdownItem[];
  recentTransactions: Transaction[];
};

function clsx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function StatCard({
  title,
  value,
  change,
  positive = true,
  icon: Icon,
}: StatCardProps) {
  return (
    <div className="min-w-0 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white/60">{title}</p>
          <h3 className="mt-2 break-words text-2xl font-black text-white">
            {value}
          </h3>
        </div>

        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
          <Icon className="h-6 w-6" />
        </div>
      </div>

      {change ? (
        <div
          className={clsx(
            "inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
            positive
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-red-500/15 text-red-300"
          )}
        >
          {positive ? (
            <ArrowUpRight className="h-4 w-4 shrink-0" />
          ) : (
            <ArrowDownRight className="h-4 w-4 shrink-0" />
          )}
          <span className="truncate">{change}</span>
        </div>
      ) : null}
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  width,
}: {
  label: string;
  value: string;
  width: string;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="truncate text-white/75">{label}</span>
        <span className="shrink-0 font-semibold text-white">{value}</span>
      </div>

      <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-emerald-400" style={{ width }} />
      </div>
    </div>
  );
}

export default function MoneyManagementHomePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardResponse | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/admin/money/dashboard", {
        cache: "no-store",
      });

      const json: DashboardResponse = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to load dashboard");
      }

      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.10),_transparent_28%),linear-gradient(135deg,_#020617_0%,_#0f172a_45%,_#020617_100%)] px-4 py-6 text-white sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          Loading money dashboard...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen w-full bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.10),_transparent_28%),linear-gradient(135deg,_#020617_0%,_#0f172a_45%,_#020617_100%)] px-4 py-6 text-white sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-6 backdrop-blur-xl">
          <h2 className="text-xl font-bold">Failed to load dashboard</h2>
          <p className="mt-2 text-white/80">{error || "Unknown error"}</p>

          <button
            type="button"
            onClick={loadDashboard}
            className="mt-4 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const recentTransactions = data.recentTransactions || [];
  const spendingBreakdown = data.spendingBreakdown || [];

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.10),_transparent_28%),linear-gradient(135deg,_#020617_0%,_#0f172a_45%,_#020617_100%)] text-white">
      <div className="w-full px-4 py-4 sm:px-6 lg:px-8">
        <div className="grid min-w-0 grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-6">
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur-xl sm:p-6">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-emerald-300">
                    Money Management Dashboard
                  </p>
                  <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                    Welcome back
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm text-white/65 sm:text-base">
                    Track your spending, monitor your income, and stay on top of
                    your savings goals all in one place.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Link
                    href="/Admin/Money/Transactions"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 font-bold text-black transition hover:bg-emerald-400"
                  >
                    <Plus className="h-4 w-4" />
                    Add Transaction
                  </Link>

                  <Link
                    href="/Admin/Money/Budgets"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
                  >
                    <PiggyBank className="h-4 w-4" />
                    View Budgets
                  </Link>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
              <StatCard
                title="Current Balance"
                value={data.stats.currentBalance}
                icon={Wallet}
              />
              <StatCard
                title="Monthly Income"
                value={data.stats.monthlyIncome}
                icon={TrendingUp}
              />
              <StatCard
                title="Monthly Spending"
                value={data.stats.monthlySpending}
                icon={Receipt}
              />
              <StatCard
                title="Savings Pot"
                value={data.stats.savingsPot}
                icon={PiggyBank}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h2 className="text-lg font-bold">{data.budget.label}</h2>
                  <div className="rounded-xl bg-white/10 px-3 py-1 text-xs text-white/70">
                    {data.budget.monthLabel}
                  </div>
                </div>

                <div className="mb-3 flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-white/60">Used</p>
                    <p className="text-2xl font-black">{data.budget.usedText}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-emerald-300">
                    {data.budget.usedPercent}%
                  </p>
                </div>

                <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-emerald-400"
                    style={{ width: `${data.budget.usedPercent}%` }}
                  />
                </div>

                <p className="mt-3 text-sm text-white/60">
                  You still have{" "}
                  <span className="font-bold text-white">
                    {data.budget.remainingText}
                  </span>{" "}
                  left in your monthly budget.
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h2 className="text-lg font-bold">Savings Goal</h2>
                  <div className="rounded-xl bg-white/10 px-3 py-1 text-xs text-white/70">
                    {data.savings.label}
                  </div>
                </div>

                <div className="mb-3 flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-white/60">Progress</p>
                    <p className="text-2xl font-black">
                      {data.savings.progressText}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-emerald-300">
                    {data.savings.progressPercent}%
                  </p>
                </div>

                <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-emerald-400"
                    style={{ width: `${data.savings.progressPercent}%` }}
                  />
                </div>

                <p className="mt-3 text-sm text-white/60">
                  Keep going — you are getting close to your target.
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold">Recent Transactions</h2>
                  <p className="text-sm text-white/60">
                    Latest money activity on your account
                  </p>
                </div>

                <Link
                  href="/Admin/Money/Transactions"
                  className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  View all
                </Link>
              </div>

              <div className="space-y-3">
                {recentTransactions.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-white/60">
                    No recent transactions yet.
                  </div>
                ) : (
                  recentTransactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-4">
                        <div
                          className={clsx(
                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                            transaction.type === "income"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-red-500/15 text-red-300"
                          )}
                        >
                          {transaction.type === "income" ? (
                            <ArrowDownRight className="h-5 w-5" />
                          ) : (
                            <ArrowUpRight className="h-5 w-5" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold text-white">
                            {transaction.name}
                          </div>
                          <div className="truncate text-sm text-white/55">
                            {transaction.category} • {transaction.date}
                          </div>
                        </div>
                      </div>

                      <div
                        className={clsx(
                          "shrink-0 text-sm font-bold sm:text-base",
                          transaction.type === "income"
                            ? "text-emerald-300"
                            : "text-white"
                        )}
                      >
                        {transaction.amount}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 2xl:hidden">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                <h2 className="mb-4 text-xl font-bold">Quick Actions</h2>

                <div className="flex flex-col gap-3">
                  <Link
                    href="/Admin/Money/Transactions"
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 transition hover:bg-white/10"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                      <Receipt className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold">Add transaction</p>
                      <p className="text-sm text-white/60">
                        Record new spending or income
                      </p>
                    </div>
                  </Link>

                  <Link
                    href="/Admin/Money/Accounts"
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 transition hover:bg-white/10"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                      <Wallet className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold">Manage accounts</p>
                      <p className="text-sm text-white/60">
                        Update your money accounts
                      </p>
                    </div>
                  </Link>

                  <Link
                    href="/Admin/Money/Cards"
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 transition hover:bg-white/10"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold">Manage cards</p>
                      <p className="text-sm text-white/60">
                        Keep track of linked cards
                      </p>
                    </div>
                  </Link>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                <h2 className="mb-4 text-xl font-bold">Spending Breakdown</h2>

                <div className="space-y-4">
                  {spendingBreakdown.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-white/60">
                      No spending breakdown available yet.
                    </div>
                  ) : (
                    spendingBreakdown.map((item) => (
                      <BreakdownRow
                        key={item.label}
                        label={item.label}
                        value={item.value}
                        width={item.width}
                      />
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                <h2 className="mb-4 text-xl font-bold">This Month Summary</h2>

                <div className="space-y-3 text-sm text-white/70">
                  <div className="flex items-center justify-between rounded-2xl bg-black/20 px-4 py-3">
                    <span>Total income</span>
                    <span className="font-bold text-emerald-300">
                      {data.summary.totalIncome}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl bg-black/20 px-4 py-3">
                    <span>Total expenses</span>
                    <span className="font-bold text-white">
                      {data.summary.totalExpenses}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl bg-black/20 px-4 py-3">
                    <span>Money left</span>
                    <span className="font-bold text-emerald-300">
                      {data.summary.moneyLeft}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden content-start gap-6 2xl:grid">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
              <h2 className="mb-4 text-xl font-bold">Quick Actions</h2>

              <div className="flex flex-col gap-3">
                <Link
                  href="/Admin/Money/Transactions"
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 transition hover:bg-white/10"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                    <Receipt className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">Add transaction</p>
                    <p className="text-sm text-white/60">
                      Record new spending or income
                    </p>
                  </div>
                </Link>

                <Link
                  href="/Admin/Money/Accounts"
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 transition hover:bg-white/10"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">Manage accounts</p>
                    <p className="text-sm text-white/60">
                      Update your money accounts
                    </p>
                  </div>
                </Link>

                <Link
                  href="/Admin/Money/Cards"
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 transition hover:bg-white/10"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">Manage cards</p>
                    <p className="text-sm text-white/60">
                      Keep track of linked cards
                    </p>
                  </div>
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
              <h2 className="mb-4 text-xl font-bold">Spending Breakdown</h2>

              <div className="space-y-4">
                {spendingBreakdown.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-white/60">
                    No spending breakdown available yet.
                  </div>
                ) : (
                  spendingBreakdown.map((item) => (
                    <BreakdownRow
                      key={item.label}
                      label={item.label}
                      value={item.value}
                      width={item.width}
                    />
                  ))
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
              <h2 className="mb-4 text-xl font-bold">This Month Summary</h2>

              <div className="space-y-3 text-sm text-white/70">
                <div className="flex items-center justify-between rounded-2xl bg-black/20 px-4 py-3">
                  <span>Total income</span>
                  <span className="font-bold text-emerald-300">
                    {data.summary.totalIncome}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-black/20 px-4 py-3">
                  <span>Total expenses</span>
                  <span className="font-bold text-white">
                    {data.summary.totalExpenses}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-black/20 px-4 py-3">
                  <span>Money left</span>
                  <span className="font-bold text-emerald-300">
                    {data.summary.moneyLeft}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}