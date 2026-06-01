"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Calculator,
  Home,
  PiggyBank,
  RefreshCcw,
} from "lucide-react";

import MoneyHeader from "../../../components/money/MoneyHeader";
import MoneyPageStatus from "../../../components/money/MoneyPageStatus";
import MoneyBudgetPlanning from "../../../components/money/MoneyBudgetPlanning";

import { useMoneyTransactionsPage } from "@/hooks/useMoneyTransactionsPage";

export default function MoneyBudgetPlanningPage() {
  const money = useMoneyTransactionsPage();

  return (
    <main className="min-h-screen w-full max-w-none overflow-x-auto bg-[#070716] px-1 py-5 text-white sm:px-2 lg:px-3">
      <div className="w-full max-w-none min-w-0 space-y-6">
        <MoneyHeader
          selectedYear={money.selectedYear}
          yearOptions={money.yearOptions}
          onYearChange={money.handleYearChange}
          onRefresh={money.refreshAll}
        />

        <section className="w-full max-w-none overflow-hidden rounded-[2rem] border border-emerald-300/20 bg-gradient-to-br from-emerald-500/15 via-white/[0.04] to-white/[0.02] p-5 shadow-2xl sm:p-6 lg:p-8">
          <div className="flex min-w-0 flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-100">
                <PiggyBank className="h-4 w-4" />
                Budget Planning
              </div>

              <h1 className="break-words text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
                Planned budget vs actual spending
              </h1>

              <p className="mt-3 max-w-5xl text-sm leading-6 text-white/65 sm:text-base">
                Plan costs for venue, insurance, printing, security,
                performers, equipment, accessibility, and other costs. Compare
                your planned budget against real spending from your money
                transactions.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={money.refreshAll}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Refresh
                </button>

                <Link
                  href="/Admin/MoneyManagement/TrackingMoney/MoneyDashboardCharts"
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20"
                >
                  <Home className="h-4 w-4" />
                  Dashboard
                </Link>

                <Link
                  href="/Admin/MoneyManagement/TrackingMoney/MoneyDashboardCharts/Transactions"
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Transactions
                </Link>
              </div>
            </div>

            <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 xl:w-[680px] xl:shrink-0">
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-100">
                  Budget year
                </p>

                <p className="mt-2 break-words text-2xl font-black text-white">
                  {money.selectedYear}
                </p>
              </div>

              <div className="rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-sky-100">
                  Transactions
                </p>

                <p className="mt-2 break-words text-2xl font-black text-white">
                  {money.yearTransactions.length}
                </p>
              </div>

              <div className="rounded-2xl border border-purple-300/20 bg-purple-500/10 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-purple-100">
                  Cost areas
                </p>

                <p className="mt-2 flex items-center gap-2 break-words text-2xl font-black text-white">
                  <Calculator className="h-6 w-6" />
                  {money.budgetItems.length}
                </p>
              </div>
            </div>
          </div>
        </section>

        <MoneyPageStatus
          error={money.error}
          errorDetails={money.errorDetails}
          selectedYear={money.selectedYear}
          selectedViewMonth={money.selectedViewMonth}
          filteredTransactionsLength={money.filteredTransactions.length}
          yearTransactionsLength={money.yearTransactions.length}
        />

        <section className="w-full max-w-none min-w-0">
          <MoneyBudgetPlanning
            selectedYear={money.selectedYear}
            budgetItems={money.budgetItems}
            transactions={money.yearTransactions}
            savingBudget={money.savingBudget}
            onSaveBudget={money.saveBudgetItems}
          />
        </section>

        <div className="flex w-full flex-wrap gap-3">
          <Link
            href="/Admin/MoneyManagement/TrackingMoney/MoneyDashboardCharts"
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20"
          >
            <Home className="h-4 w-4" />
            Dashboard
          </Link>

          <Link
            href="/Admin/MoneyManagement/TrackingMoney/MoneyDashboardCharts/Transactions"
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4" />
            Transactions
          </Link>
        </div>
      </div>
    </main>
  );
}
