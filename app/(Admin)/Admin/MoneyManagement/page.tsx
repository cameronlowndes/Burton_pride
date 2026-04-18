"use client";

import Link from "next/link";
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
  id: number;
  name: string;
  category: string;
  date: string;
  amount: string;
  type: "income" | "expense";
};

const recentTransactions: Transaction[] = [
  {
    id: 1,
    name: "Tesco",
    category: "Groceries",
    date: "18 Apr 2026",
    amount: "-£42.80",
    type: "expense",
  },
  {
    id: 2,
    name: "Salary Payment",
    category: "Income",
    date: "17 Apr 2026",
    amount: "+£1,850.00",
    type: "income",
  },
  {
    id: 3,
    name: "Netflix",
    category: "Subscriptions",
    date: "16 Apr 2026",
    amount: "-£10.99",
    type: "expense",
  },
  {
    id: 4,
    name: "Shell Petrol",
    category: "Transport",
    date: "15 Apr 2026",
    amount: "-£55.00",
    type: "expense",
  },
  {
    id: 5,
    name: "Savings Transfer",
    category: "Savings",
    date: "14 Apr 2026",
    amount: "-£200.00",
    type: "expense",
  },
];

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
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-white/60">{title}</p>
          <h3 className="mt-2 text-2xl font-black text-white">{value}</h3>
        </div>

        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
          <Icon className="h-6 w-6" />
        </div>
      </div>

      {change ? (
        <div
          className={clsx(
            "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
            positive
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-red-500/15 text-red-300"
          )}
        >
          {positive ? (
            <ArrowUpRight className="h-4 w-4" />
          ) : (
            <ArrowDownRight className="h-4 w-4" />
          )}
          {change}
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
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-white/75">{label}</span>
        <span className="font-semibold text-white">{value}</span>
      </div>

      <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-emerald-400" style={{ width }} />
      </div>
    </div>
  );
}

export default function MoneyManagementHomePage() {
  const budgetUsed = 72;
  const savingsGoal = 64;

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.10),_transparent_28%),linear-gradient(135deg,_#020617_0%,_#0f172a_45%,_#020617_100%)] text-white">
      <div className="w-full p-4 sm:p-6 lg:p-8">
        <div className="grid gap-6 xl:grid-cols-[1.5fr_0.95fr]">
          <div className="space-y-6 min-w-0">
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
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

                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/Admin/Money/Transactions"
                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 font-bold text-black transition hover:bg-emerald-400"
                  >
                    <Plus className="h-4 w-4" />
                    Add Transaction
                  </Link>

                  <Link
                    href="/Admin/Money/Budgets"
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
                  >
                    <PiggyBank className="h-4 w-4" />
                    View Budgets
                  </Link>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
              <StatCard
                title="Current Balance"
                value="£4,820.36"
                change="+8.4% this month"
                positive
                icon={Wallet}
              />
              <StatCard
                title="Monthly Income"
                value="£2,350.00"
                change="+3.2% this month"
                positive
                icon={TrendingUp}
              />
              <StatCard
                title="Monthly Spending"
                value="£1,428.79"
                change="-4.1% from last month"
                positive
                icon={Receipt}
              />
              <StatCard
                title="Savings Pot"
                value="£1,260.00"
                change="+£200 added"
                positive
                icon={PiggyBank}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h2 className="text-lg font-bold">Monthly Budget</h2>
                  <div className="rounded-xl bg-white/10 px-3 py-1 text-xs text-white/70">
                    April 2026
                  </div>
                </div>

                <div className="mb-3 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm text-white/60">Used</p>
                    <p className="text-2xl font-black">£1,440 / £2,000</p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-300">
                    {budgetUsed}%
                  </p>
                </div>

                <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-emerald-400"
                    style={{ width: `${budgetUsed}%` }}
                  />
                </div>

                <p className="mt-3 text-sm text-white/60">
                  You still have <span className="font-bold text-white">£560</span>{" "}
                  left in your monthly budget.
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h2 className="text-lg font-bold">Savings Goal</h2>
                  <div className="rounded-xl bg-white/10 px-3 py-1 text-xs text-white/70">
                    Holiday Fund
                  </div>
                </div>

                <div className="mb-3 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm text-white/60">Progress</p>
                    <p className="text-2xl font-black">£640 / £1,000</p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-300">
                    {savingsGoal}%
                  </p>
                </div>

                <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-emerald-400"
                    style={{ width: `${savingsGoal}%` }}
                  />
                </div>

                <p className="mt-3 text-sm text-white/60">
                  Keep going — you are getting close to your target.
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
              <div className="mb-5 flex items-center justify-between gap-4">
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
                {recentTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-4"
                  >
                    <div className="flex min-w-0 items-center gap-4">
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

                      <div className="min-w-0">
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
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6 min-w-0">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
              <h2 className="mb-4 text-xl font-bold">Quick Actions</h2>

              <div className="grid gap-3">
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
                <BreakdownRow label="Groceries" value="£320" width="80%" />
                <BreakdownRow label="Bills" value="£410" width="92%" />
                <BreakdownRow label="Transport" value="£120" width="45%" />
                <BreakdownRow label="Subscriptions" value="£38" width="20%" />
                <BreakdownRow label="Entertainment" value="£145" width="56%" />
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
              <h2 className="mb-4 text-xl font-bold">This Month Summary</h2>

              <div className="space-y-3 text-sm text-white/70">
                <div className="flex items-center justify-between rounded-2xl bg-black/20 px-4 py-3">
                  <span>Total income</span>
                  <span className="font-bold text-emerald-300">£2,350.00</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-black/20 px-4 py-3">
                  <span>Total expenses</span>
                  <span className="font-bold text-white">£1,428.79</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-black/20 px-4 py-3">
                  <span>Money left</span>
                  <span className="font-bold text-emerald-300">£921.21</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}