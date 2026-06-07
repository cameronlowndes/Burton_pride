"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calculator,
  Home,
  PiggyBank,
  RefreshCcw,
  Settings2,
  Sparkles,
} from "lucide-react";

import MoneyHeader from "../../../components/money/MoneyHeader";
import MoneyPageStatus from "../../../components/money/MoneyPageStatus";
import MoneyBudgetPlanning from "../../../components/money/MoneyBudgetPlanning";

import { useMoneyTransactionsPage } from "@/hooks/useMoneyTransactionsPage";

const EASY_MODE_STORAGE_KEY = "burton-pride-budget-planning-easy-mode";

export default function MoneyBudgetPlanningPage() {
  const money = useMoneyTransactionsPage();

  /**
   * Full Mode is the default.
   * Easy Mode is only enabled when the user switches it on.
   */
  const [easyMode, setEasyMode] = useState(false);
  const [modeLoaded, setModeLoaded] = useState(false);

  useEffect(() => {
    try {
      const savedMode = window.localStorage.getItem(EASY_MODE_STORAGE_KEY);

      if (savedMode !== null) {
        setEasyMode(savedMode === "true");
      }
    } catch {
      // Keep Full Mode as the safe default if localStorage is unavailable.
    } finally {
      setModeLoaded(true);
    }
  }, []);

  function toggleEasyMode() {
    setEasyMode((previous) => {
      const next = !previous;

      try {
        window.localStorage.setItem(EASY_MODE_STORAGE_KEY, String(next));
      } catch {
        // The page should still work if localStorage is unavailable.
      }

      return next;
    });
  }

  return (
    <main className="min-h-screen w-full max-w-none overflow-x-auto bg-[#070716] px-1 py-5 text-white sm:px-2 lg:px-3">
      <div className="w-full max-w-none min-w-0 space-y-6">
        <MoneyHeader
          selectedYear={money.selectedYear}
          yearOptions={money.yearOptions}
          onYearChange={money.handleYearChange}
          onRefresh={money.refreshAll}
        />

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {easyMode ? (
                  <Sparkles className="h-5 w-5 text-emerald-200" />
                ) : (
                  <Settings2 className="h-5 w-5 text-sky-200" />
                )}

                <h2 className="text-lg font-black text-white">
                  {easyMode ? "Easy Mode is on" : "Full Mode is on"}
                </h2>
              </div>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
                {easyMode
                  ? "Easy Mode keeps this page focused on the budget planner and the main navigation buttons."
                  : "Full Mode shows the budget summary cards, page status, and the full planning information."}
              </p>
            </div>

            <button
              type="button"
              onClick={toggleEasyMode}
              disabled={!modeLoaded}
              className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black ring-1 transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${
                easyMode
                  ? "bg-sky-500/15 text-sky-100 ring-sky-300/20 hover:bg-sky-500/25"
                  : "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20 hover:bg-emerald-500/25"
              }`}
            >
              {easyMode ? (
                <>
                  <Settings2 className="h-4 w-4" />
                  Show Full Mode
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Turn on Easy Mode
                </>
              )}
            </button>
          </div>
        </section>

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

              {!easyMode && (
                <p className="mt-3 max-w-5xl text-sm leading-6 text-white/65 sm:text-base">
                  Plan costs for venue, insurance, printing, security,
                  performers, equipment, accessibility, and other costs. Compare
                  your planned budget against real spending from your money
                  transactions.
                </p>
              )}

              {easyMode && (
                <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65 sm:text-base">
                  Add your planned costs and compare them with your real
                  spending.
                </p>
              )}

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

            {!easyMode && (
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
            )}
          </div>
        </section>

        {(money.error || !easyMode) && (
          <MoneyPageStatus
            error={money.error}
            errorDetails={money.errorDetails}
            selectedYear={money.selectedYear}
            selectedViewMonth={money.selectedViewMonth}
            filteredTransactionsLength={money.filteredTransactions.length}
            yearTransactionsLength={money.yearTransactions.length}
          />
        )}

        <section className="w-full max-w-none min-w-0">
          <MoneyBudgetPlanning
            selectedYear={money.selectedYear}
            budgetItems={money.budgetItems}
            transactions={money.yearTransactions}
            savingBudget={money.savingBudget}
            onSaveBudget={money.saveBudgetItems}
          />
        </section>

        {!easyMode && (
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
        )}
      </div>
    </main>
  );
}
