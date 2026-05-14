"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  CalendarDays,
  FileText,
  HandCoins,
  LayoutDashboard,
  PlusCircle,
  RefreshCcw,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";

import MoneyHeader from "../../../components/money/MoneyHeader";
import MoneyStatsCards from "../../../components/money/MoneySummaryCards";
import MoneyPageStatus from "../../../components/money/MoneyPageStatus";
import MoneySponsorSection from "../../../components/money/MoneySponsorSection";
import MoneyMonthlyBreakdown from "../../../components/money/MoneyMonthlyBreakdown";
import MoneyDashboardCharts from "../../../components/money/MoneyDashboardCharts";
import MoneyTransactionForm from "../../../components/money/MoneyTransactionForm";
import MoneyTransactionsTable from "../../../components/money/MoneyTransactionsTable";
import MoneyPageModals from "../../../components/money/MoneyPageModals";

import { useMoneyTransactionsPage } from "@/hooks/useMoneyTransactionsPage";
import { money } from "@/lib/money/helpers";

export default function MoneyDashboardPage() {
  const moneyPage = useMoneyTransactionsPage();

  const [addTransactionOpen, setAddTransactionOpen] = useState(false);
  const [transactionsWindowOpen, setTransactionsWindowOpen] = useState(false);
  const [sponsorWindowOpen, setSponsorWindowOpen] = useState(false);
  const [reportsWindowOpen, setReportsWindowOpen] = useState(false);

  async function writeMoneyAuditLog(
    action: string,
    description: string,
    extra?: Record<string, unknown>
  ) {
    try {
      await fetch("/api/admin/money/audit-log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          description,
          selectedYear: moneyPage.selectedYear,
          selectedViewMonth: moneyPage.selectedViewMonth,
          selectedPrintMonth: moneyPage.selectedPrintMonth,
          transactionCount: moneyPage.filteredTransactions.length,
          yearTransactionCount: moneyPage.yearTransactions.length,
          extra: extra || {},
        }),
      });
    } catch {
      // Do not block the dashboard if audit logging fails.
    }
  }

  const openAddTransactionModal = () => {
    moneyPage.cancelEditTransaction();
    setTransactionsWindowOpen(false);
    setSponsorWindowOpen(false);
    setReportsWindowOpen(false);
    setAddTransactionOpen(true);
  };

  const closeAddTransactionModal = () => {
    setAddTransactionOpen(false);
    moneyPage.cancelEditTransaction();
  };

  const openTransactionsWindow = () => {
    setAddTransactionOpen(false);
    setSponsorWindowOpen(false);
    setReportsWindowOpen(false);
    setTransactionsWindowOpen(true);
  };

  const closeTransactionsWindow = () => {
    setTransactionsWindowOpen(false);
  };

  const openSponsorWindow = () => {
    setAddTransactionOpen(false);
    setTransactionsWindowOpen(false);
    setReportsWindowOpen(false);
    setSponsorWindowOpen(true);
  };

  const closeSponsorWindow = () => {
    setSponsorWindowOpen(false);
  };

  const openReportsWindow = async () => {
    setAddTransactionOpen(false);
    setTransactionsWindowOpen(false);
    setSponsorWindowOpen(false);
    setReportsWindowOpen(true);

    await writeMoneyAuditLog(
      "reports_window_opened",
      `Opened reports window for ${moneyPage.selectedYear}.`
    );
  };

  const closeReportsWindow = () => {
    setReportsWindowOpen(false);
  };

  async function handlePrintReport() {
    await writeMoneyAuditLog(
      "report_printed",
      `Printed money report for ${moneyPage.selectedYear}.`,
      {
        printMonth: moneyPage.selectedPrintMonth,
        filteredTransactions: moneyPage.filteredTransactions.length,
        printTransactions: moneyPage.printTransactionsList.length,
      }
    );

    moneyPage.printTransactions();
  }

  async function handleExportExcelReport() {
    await writeMoneyAuditLog(
      "transactions_excel_exported",
      `Exported transaction Excel report for ${moneyPage.selectedYear}.`,
      {
        selectedViewMonth: moneyPage.selectedViewMonth,
        filteredTransactions: moneyPage.filteredTransactions.length,
      }
    );

    await moneyPage.exportTransactionsToExcel();
  }

  async function handleExportYearlyReport() {
    await writeMoneyAuditLog(
      "yearly_report_exported",
      `Exported full yearly money report for ${moneyPage.selectedYear}.`,
      {
        yearTransactions: moneyPage.yearTransactions.length,
        openingBalance: moneyPage.totals.openingBalance,
        income: moneyPage.totals.income,
        expense: moneyPage.totals.expense,
        balance: moneyPage.totals.balance,
        sponsorshipIncome: moneyPage.totals.sponsorshipIncome,
        sponsorshipSpent: moneyPage.totals.sponsorshipSpent,
        sponsorshipRemaining: moneyPage.totals.sponsorshipRemaining,
      }
    );

    await moneyPage.exportFullYearlyReport();
  }

  const overspentSponsors = moneyPage.yearlySponsorBreakdown.filter(
    (sponsor) => sponsor.remaining_pence < 0
  );

  const lowSponsorBalances = moneyPage.yearlySponsorBreakdown.filter(
    (sponsor) =>
      sponsor.remaining_pence >= 0 &&
      sponsor.received_pence > 0 &&
      sponsor.remaining_pence <= sponsor.received_pence * 0.2
  );

  const recentTransactions = [...moneyPage.yearTransactions]
    .sort((a, b) => {
      const aDate = new Date(a.transaction_date || a.created_at).getTime();
      const bDate = new Date(b.transaction_date || b.created_at).getTime();

      return bDate - aDate;
    })
    .slice(0, 6);

  return (
    <main className="min-h-screen w-full max-w-full overflow-x-auto bg-[#070716] px-3 py-5 text-white sm:px-5 lg:px-6">
      <div className="mx-auto w-full max-w-[1900px] min-w-0 space-y-6">
        <MoneyHeader
          selectedYear={moneyPage.selectedYear}
          yearOptions={moneyPage.yearOptions}
          onYearChange={moneyPage.handleYearChange}
          onRefresh={moneyPage.refreshAll}
        />

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.04] to-white/[0.02] p-5 shadow-2xl sm:p-6 lg:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-pink-300/20 bg-pink-500/10 px-4 py-2 text-sm font-bold text-pink-100">
                <LayoutDashboard className="h-4 w-4" />
                Money Dashboard
              </div>

              <h1 className="break-words text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
                Burton Pride money overview
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65 sm:text-base">
                A clear yearly view of income, spending, donations, sponsor
                balances, monthly movement, and warnings for anything that needs
                checking.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={openAddTransactionModal}
                  className="hidden items-center gap-2 rounded-xl bg-pink-500 px-4 py-3 text-sm font-black text-white hover:bg-pink-400 md:inline-flex"
                >
                  <PlusCircle className="h-4 w-4" />
                  Add transaction
                </button>

                <Link
                  href="/Admin/MoneyManagement/TrackingMoney/MoneyDashboardCharts/AddTransaction"
                  className="inline-flex items-center gap-2 rounded-xl bg-pink-500 px-4 py-3 text-sm font-black text-white hover:bg-pink-400 md:hidden"
                >
                  <PlusCircle className="h-4 w-4" />
                  Add transaction
                </Link>

                <button
                  type="button"
                  onClick={moneyPage.refreshAll}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Refresh dashboard
                </button>
              </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[520px]">
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
                <div className="mb-3 flex items-center gap-2 text-emerald-100">
                  <Banknote className="h-4 w-4" />
                  <p className="text-xs font-bold uppercase tracking-wide">
                    Money in
                  </p>
                </div>

                <p className="break-words text-2xl font-black text-white">
                  {money(moneyPage.totals.income)}
                </p>
              </div>

              <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4">
                <div className="mb-3 flex items-center gap-2 text-red-100">
                  <Wallet className="h-4 w-4" />
                  <p className="text-xs font-bold uppercase tracking-wide">
                    Money out
                  </p>
                </div>

                <p className="break-words text-2xl font-black text-white">
                  {money(moneyPage.totals.expense)}
                </p>
              </div>

              <div className="rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4">
                <div className="mb-3 flex items-center gap-2 text-sky-100">
                  <ShieldCheck className="h-4 w-4" />
                  <p className="text-xs font-bold uppercase tracking-wide">
                    Balance
                  </p>
                </div>

                <p
                  className={`break-words text-2xl font-black ${
                    moneyPage.totals.balance >= 0
                      ? "text-emerald-200"
                      : "text-red-200"
                  }`}
                >
                  {money(moneyPage.totals.balance)}
                </p>
              </div>
            </div>
          </div>
        </section>

        <MoneyPageStatus
          error={moneyPage.error}
          errorDetails={moneyPage.errorDetails}
          selectedYear={moneyPage.selectedYear}
          selectedViewMonth={moneyPage.selectedViewMonth}
          filteredTransactionsLength={moneyPage.filteredTransactions.length}
          yearTransactionsLength={moneyPage.yearTransactions.length}
        />

        <MoneyStatsCards totals={moneyPage.totals} />

        {(overspentSponsors.length > 0 || lowSponsorBalances.length > 0) && (
          <section className="rounded-3xl border border-red-300/20 bg-red-500/10 p-4 sm:p-5">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-2xl bg-red-500/20 p-3 text-red-100 ring-1 ring-red-300/20">
                <ShieldCheck className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <h2 className="text-xl font-black text-white">
                  Sponsor balance warnings
                </h2>

                <p className="text-sm text-red-100/70">
                  Check these before spending more sponsor money.
                </p>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {overspentSponsors.map((sponsor) => (
                <div
                  key={`overspent-${sponsor.sponsor_id}`}
                  className="rounded-2xl border border-red-300/20 bg-black/20 p-4"
                >
                  <p className="break-words font-black text-white">
                    {sponsor.sponsor_name}
                  </p>

                  <p className="mt-1 text-sm text-red-100">
                    Overspent by{" "}
                    <strong>{money(Math.abs(sponsor.remaining_pence))}</strong>
                  </p>
                </div>
              ))}

              {lowSponsorBalances.map((sponsor) => (
                <div
                  key={`low-${sponsor.sponsor_id}`}
                  className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4"
                >
                  <p className="break-words font-black text-white">
                    {sponsor.sponsor_name}
                  </p>

                  <p className="mt-1 text-sm text-amber-100">
                    Low sponsor balance left:{" "}
                    <strong>{money(sponsor.remaining_pence)}</strong>
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
          <button
            type="button"
            onClick={openTransactionsWindow}
            className="group hidden rounded-3xl border border-sky-300/20 bg-sky-500/10 p-5 text-left text-sky-100 transition hover:-translate-y-1 hover:bg-white/[0.08] md:block"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="rounded-2xl bg-black/20 p-3">
                <ReceiptText className="h-5 w-5" />
              </div>

              <ArrowRight className="h-5 w-5 opacity-60 transition group-hover:translate-x-1 group-hover:opacity-100" />
            </div>

            <h2 className="text-lg font-black text-white">Transactions</h2>

            <p className="mt-2 text-sm leading-6 text-white/60">
              Add, edit, print, export, and manage all money records.
            </p>

            <p className="mt-4 text-sm font-black">Open floating window</p>
          </button>

          <Link
            href="/Admin/MoneyManagement/TrackingMoney/MoneyDashboardCharts/Transactions"
            className="group rounded-3xl border border-sky-300/20 bg-sky-500/10 p-5 text-sky-100 transition hover:-translate-y-1 hover:bg-white/[0.08] md:hidden"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="rounded-2xl bg-black/20 p-3">
                <ReceiptText className="h-5 w-5" />
              </div>

              <ArrowRight className="h-5 w-5 opacity-60 transition group-hover:translate-x-1 group-hover:opacity-100" />
            </div>

            <h2 className="text-lg font-black text-white">Transactions</h2>

            <p className="mt-2 text-sm leading-6 text-white/60">
              Add, edit, print, export, and manage all money records.
            </p>

            <p className="mt-4 text-sm font-black">Open transactions page</p>
          </Link>

          <button
            type="button"
            onClick={openAddTransactionModal}
            className="group hidden rounded-3xl border border-pink-300/20 bg-pink-500/10 p-5 text-left text-pink-100 transition hover:-translate-y-1 hover:bg-white/[0.08] md:block"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="rounded-2xl bg-black/20 p-3">
                <PlusCircle className="h-5 w-5" />
              </div>

              <ArrowRight className="h-5 w-5 opacity-60 transition group-hover:translate-x-1 group-hover:opacity-100" />
            </div>

            <h2 className="text-lg font-black text-white">Add payment</h2>

            <p className="mt-2 text-sm leading-6 text-white/60">
              Quickly add money in, money out, personal funds, or sponsor spend.
            </p>

            <p className="mt-4 text-sm font-black">Open floating form</p>
          </button>

          <Link
            href="/Admin/MoneyManagement/TrackingMoney/MoneyDashboardCharts/AddTransaction"
            className="group rounded-3xl border border-pink-300/20 bg-pink-500/10 p-5 text-pink-100 transition hover:-translate-y-1 hover:bg-white/[0.08] md:hidden"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="rounded-2xl bg-black/20 p-3">
                <PlusCircle className="h-5 w-5" />
              </div>

              <ArrowRight className="h-5 w-5 opacity-60 transition group-hover:translate-x-1 group-hover:opacity-100" />
            </div>

            <h2 className="text-lg font-black text-white">Add payment</h2>

            <p className="mt-2 text-sm leading-6 text-white/60">
              Quickly add money in, money out, personal funds, or sponsor spend.
            </p>

            <p className="mt-4 text-sm font-black">Open form page</p>
          </Link>

          <button
            type="button"
            onClick={openSponsorWindow}
            className="group hidden rounded-3xl border border-amber-300/20 bg-amber-500/10 p-5 text-left text-amber-100 transition hover:-translate-y-1 hover:bg-white/[0.08] md:block"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="rounded-2xl bg-black/20 p-3">
                <HandCoins className="h-5 w-5" />
              </div>

              <ArrowRight className="h-5 w-5 opacity-60 transition group-hover:translate-x-1 group-hover:opacity-100" />
            </div>

            <h2 className="text-lg font-black text-white">Sponsor tracking</h2>

            <p className="mt-2 text-sm leading-6 text-white/60">
              Check sponsor income, spending, remaining balances, and overspend.
            </p>

            <p className="mt-4 text-sm font-black">Open floating window</p>
          </button>

          <Link
            href="/Admin/MoneyManagement/TrackingMoney/MoneyDashboardCharts/Sponsors"
            className="group rounded-3xl border border-amber-300/20 bg-amber-500/10 p-5 text-amber-100 transition hover:-translate-y-1 hover:bg-white/[0.08] md:hidden"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="rounded-2xl bg-black/20 p-3">
                <HandCoins className="h-5 w-5" />
              </div>

              <ArrowRight className="h-5 w-5 opacity-60 transition group-hover:translate-x-1 group-hover:opacity-100" />
            </div>

            <h2 className="text-lg font-black text-white">Sponsor tracking</h2>

            <p className="mt-2 text-sm leading-6 text-white/60">
              Check sponsor income, spending, remaining balances, and overspend.
            </p>

            <p className="mt-4 text-sm font-black">View sponsors</p>
          </Link>

          <button
            type="button"
            onClick={openReportsWindow}
            className="group hidden rounded-3xl border border-emerald-300/20 bg-emerald-500/10 p-5 text-left text-emerald-100 transition hover:-translate-y-1 hover:bg-white/[0.08] md:block"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="rounded-2xl bg-black/20 p-3">
                <FileText className="h-5 w-5" />
              </div>

              <ArrowRight className="h-5 w-5 opacity-60 transition group-hover:translate-x-1 group-hover:opacity-100" />
            </div>

            <h2 className="text-lg font-black text-white">Reports</h2>

            <p className="mt-2 text-sm leading-6 text-white/60">
              Use the reports area to print reports and export Excel files.
            </p>

            <p className="mt-4 text-sm font-black">Open floating window</p>
          </button>

          <Link
            href="/Admin/MoneyManagement/TrackingMoney/MoneyDashboardCharts/Reports"
            className="group rounded-3xl border border-emerald-300/20 bg-emerald-500/10 p-5 text-emerald-100 transition hover:-translate-y-1 hover:bg-white/[0.08] md:hidden"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="rounded-2xl bg-black/20 p-3">
                <FileText className="h-5 w-5" />
              </div>

              <ArrowRight className="h-5 w-5 opacity-60 transition group-hover:translate-x-1 group-hover:opacity-100" />
            </div>

            <h2 className="text-lg font-black text-white">Reports</h2>

            <p className="mt-2 text-sm leading-6 text-white/60">
              Use the reports area to print reports and export Excel files.
            </p>

            <p className="mt-4 text-sm font-black">Create report</p>
          </Link>
        </section>

        <section className="grid min-w-0 grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-6">
            <MoneyDashboardCharts
              selectedYear={moneyPage.selectedYear}
              transactions={moneyPage.transactions}
              yearlySponsorBreakdown={moneyPage.yearlySponsorBreakdown}
            />

            <MoneyMonthlyBreakdown
              selectedYear={moneyPage.selectedYear}
              transactions={moneyPage.transactions}
            />
          </div>

          <aside className="min-w-0 space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
              <div className="mb-4 flex items-start gap-3">
                <div className="rounded-2xl bg-purple-500/15 p-3 text-purple-200 ring-1 ring-purple-300/20">
                  <CalendarDays className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <h2 className="text-xl font-black text-white">
                    Recent activity
                  </h2>

                  <p className="text-sm text-white/50">
                    Latest transactions in {moneyPage.selectedYear}.
                  </p>
                </div>
              </div>

              {moneyPage.loading ? (
                <div className="rounded-2xl bg-black/20 p-4 text-sm text-white/60">
                  Loading recent activity...
                </div>
              ) : recentTransactions.length === 0 ? (
                <div className="rounded-2xl bg-black/20 p-4 text-sm text-white/60">
                  No transactions found for {moneyPage.selectedYear}.
                </div>
              ) : (
                <div className="space-y-3">
                  {recentTransactions.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words font-bold text-white">
                            {item.title}
                          </p>

                          <p className="mt-1 text-xs text-white/45">
                            {item.transaction_date || item.created_at}
                          </p>

                          {item.sponsor_name && (
                            <p className="mt-2 inline-flex rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-100 ring-1 ring-amber-300/20">
                              {item.sponsor_name}
                            </p>
                          )}
                        </div>

                        <p
                          className={`shrink-0 text-sm font-black ${
                            item.type === "income"
                              ? "text-emerald-300"
                              : "text-red-300"
                          }`}
                        >
                          {item.type === "income" ? "+" : "-"}
                          {money(item.amount_pence)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={openTransactionsWindow}
                className="mt-4 hidden w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20 md:inline-flex"
              >
                View all transactions
                <ArrowRight className="h-4 w-4" />
              </button>

              <Link
                href="/Admin/Money/Transactions"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20 md:hidden"
              >
                View all transactions
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
              <div className="mb-4 flex items-start gap-3">
                <div className="rounded-2xl bg-amber-500/15 p-3 text-amber-200 ring-1 ring-amber-300/20">
                  <Sparkles className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <h2 className="text-xl font-black text-white">
                    Quick checks
                  </h2>

                  <p className="text-sm text-white/50">
                    Things worth checking before reports are shared.
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="rounded-2xl bg-black/20 p-4">
                  <div className="flex justify-between gap-3">
                    <span className="text-white/60">Transactions this year</span>

                    <strong className="text-white">
                      {moneyPage.yearTransactions.length}
                    </strong>
                  </div>
                </div>

                <div className="rounded-2xl bg-black/20 p-4">
                  <div className="flex justify-between gap-3">
                    <span className="text-white/60">Sponsor warnings</span>

                    <strong
                      className={
                        overspentSponsors.length > 0
                          ? "text-red-300"
                          : "text-emerald-300"
                      }
                    >
                      {overspentSponsors.length}
                    </strong>
                  </div>
                </div>

                <div className="rounded-2xl bg-black/20 p-4">
                  <div className="flex justify-between gap-3">
                    <span className="text-white/60">
                      Personal funds outstanding
                    </span>

                    <strong
                      className={
                        moneyPage.totals.personalFundsOutstanding > 0
                          ? "text-orange-300"
                          : "text-emerald-300"
                      }
                    >
                      {money(moneyPage.totals.personalFundsOutstanding)}
                    </strong>
                  </div>
                </div>

                <div className="rounded-2xl bg-black/20 p-4">
                  <div className="flex justify-between gap-3">
                    <span className="text-white/60">Sponsor money left</span>

                    <strong
                      className={
                        moneyPage.totals.sponsorshipRemaining >= 0
                          ? "text-amber-200"
                          : "text-red-300"
                      }
                    >
                      {money(moneyPage.totals.sponsorshipRemaining)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>

      {reportsWindowOpen && (
        <div className="fixed inset-0 z-50 hidden items-start justify-center overflow-y-auto bg-black/75 px-4 py-8 backdrop-blur-sm md:flex">
          <div className="w-full max-w-[1200px] rounded-[2rem] border border-white/10 bg-[#070716] p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="min-w-0">
                <h2 className="text-lg font-black text-white">Reports</h2>

                <p className="text-xs text-white/50">
                  Print reports, export Excel files, and check monthly
                  breakdowns. These actions are saved to audit logs.
                </p>
              </div>

              <button
                type="button"
                onClick={closeReportsWindow}
                className="shrink-0 rounded-xl bg-white/10 p-2 text-white hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <button
                type="button"
                onClick={handlePrintReport}
                disabled={moneyPage.printTransactionsList.length === 0}
                className="rounded-3xl border border-sky-300/20 bg-sky-500/10 p-5 text-left text-sky-100 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileText className="mb-4 h-6 w-6" />
                <h3 className="text-lg font-black text-white">Print report</h3>
                <p className="mt-2 text-sm text-white/60">
                  Print the selected year or selected month using your report
                  layout.
                </p>
                <p className="mt-4 text-sm font-black">Print now</p>
              </button>

              <button
                type="button"
                onClick={handleExportExcelReport}
                disabled={moneyPage.filteredTransactions.length === 0}
                className="rounded-3xl border border-emerald-300/20 bg-emerald-500/10 p-5 text-left text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileText className="mb-4 h-6 w-6" />
                <h3 className="text-lg font-black text-white">Export Excel</h3>
                <p className="mt-2 text-sm text-white/60">
                  Export the current filtered transaction view to Excel.
                </p>
                <p className="mt-4 text-sm font-black">Export transactions</p>
              </button>

              <button
                type="button"
                onClick={handleExportYearlyReport}
                disabled={moneyPage.yearTransactions.length === 0}
                className="rounded-3xl border border-purple-300/20 bg-purple-500/10 p-5 text-left text-purple-100 transition hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileText className="mb-4 h-6 w-6" />
                <h3 className="text-lg font-black text-white">Yearly report</h3>
                <p className="mt-2 text-sm text-white/60">
                  Export the full yearly report with totals and sponsor
                  breakdown.
                </p>
                <p className="mt-4 text-sm font-black">Export yearly report</p>
              </button>
            </div>

            <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <MoneyMonthlyBreakdown
                selectedYear={moneyPage.selectedYear}
                transactions={moneyPage.transactions}
              />
            </div>
          </div>
        </div>
      )}

      {sponsorWindowOpen && (
        <div className="fixed inset-0 z-50 hidden items-start justify-center overflow-y-auto bg-black/75 px-4 py-8 backdrop-blur-sm md:flex">
          <div className="w-full max-w-[1300px] rounded-[2rem] border border-white/10 bg-[#070716] p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="min-w-0">
                <h2 className="text-lg font-black text-white">
                  Sponsor tracking
                </h2>

                <p className="text-xs text-white/50">
                  Check sponsor income, spending, remaining balances, and
                  overspend.
                </p>
              </div>

              <button
                type="button"
                onClick={closeSponsorWindow}
                className="shrink-0 rounded-xl bg-white/10 p-2 text-white hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <MoneySponsorSection
              selectedYear={moneyPage.selectedYear}
              yearlySponsorBreakdown={moneyPage.yearlySponsorBreakdown}
              openNewSponsorForm={moneyPage.openNewSponsorForm}
              startEditSponsor={moneyPage.startEditSponsor}
              setDeleteSponsorId={moneyPage.setDeleteSponsorId}
            />
          </div>
        </div>
      )}

      {transactionsWindowOpen && (
        <div className="fixed inset-0 z-50 hidden items-start justify-center overflow-y-auto bg-black/75 px-4 py-8 backdrop-blur-sm md:flex">
          <div className="w-full max-w-[1500px] rounded-[2rem] border border-white/10 bg-[#070716] p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="min-w-0">
                <h2 className="text-lg font-black text-white">
                  Transactions
                </h2>

                <p className="text-xs text-white/50">
                  View, search, filter, print, export, edit, and hide
                  transactions.
                </p>
              </div>

              <button
                type="button"
                onClick={closeTransactionsWindow}
                className="shrink-0 rounded-xl bg-white/10 p-2 text-white hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <MoneyTransactionsTable
              loading={moneyPage.loading}
              transactions={moneyPage.transactions}
              filteredTransactions={moneyPage.filteredTransactions}
              yearTransactions={moneyPage.yearTransactions}
              printTransactionsList={moneyPage.printTransactionsList}
              printMonthOptions={moneyPage.printMonthOptions}
              selectedYear={moneyPage.selectedYear}
              selectedViewMonth={moneyPage.selectedViewMonth}
              setSelectedViewMonth={moneyPage.setSelectedViewMonth}
              selectedPrintMonth={moneyPage.selectedPrintMonth}
              setSelectedPrintMonth={moneyPage.setSelectedPrintMonth}
              searchTerm={moneyPage.searchTerm}
              setSearchTerm={moneyPage.setSearchTerm}
              filter={moneyPage.filter}
              setFilter={moneyPage.setFilter}
              selectedSponsorId={moneyPage.selectedSponsorId}
              setSelectedSponsorId={moneyPage.setSelectedSponsorId}
              selectedSponsor={moneyPage.selectedSponsor}
              selectedPaymentMethod={moneyPage.selectedPaymentMethod}
              setSelectedPaymentMethod={moneyPage.setSelectedPaymentMethod}
              displaySponsors={moneyPage.displaySponsors}
              deletingYear={moneyPage.deletingYear}
              deletingAll={moneyPage.deletingAll}
              repayingId={moneyPage.repayingId}
              deleting={moneyPage.deleting}
              onPrint={moneyPage.printTransactions}
              onExportExcel={moneyPage.exportTransactionsToExcel}
              onExportYearlyReport={moneyPage.exportFullYearlyReport}
              onOpenDeleteYear={() => moneyPage.setDeleteYearOpen(true)}
              onOpenDeleteAll={() => moneyPage.setDeleteAllOpen(true)}
              onEditTransaction={(item) => {
                setTransactionsWindowOpen(false);
                moneyPage.startEditTransaction(item);
                setAddTransactionOpen(true);
              }}
              onHideTransaction={moneyPage.setDeleteId}
              onTogglePersonalFundsRepaid={moneyPage.togglePersonalFundsRepaid}
            />
          </div>
        </div>
      )}

      {addTransactionOpen && (
        <div className="fixed inset-0 z-50 hidden items-start justify-center overflow-y-auto bg-black/75 px-4 py-8 backdrop-blur-sm md:flex">
          <div className="w-full max-w-[520px] rounded-[2rem] border border-white/10 bg-[#070716] p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="min-w-0">
                <h2 className="text-lg font-black text-white">
                  Add transaction
                </h2>

                <p className="text-xs text-white/50">
                  Save money in, money out, sponsor spend, or personal funds.
                </p>
              </div>

              <button
                type="button"
                onClick={closeAddTransactionModal}
                className="shrink-0 rounded-xl bg-white/10 p-2 text-white hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <MoneyTransactionForm
              form={moneyPage.form}
              setForm={moneyPage.setForm}
              invoiceFile={moneyPage.invoiceFile}
              setInvoiceFile={moneyPage.setInvoiceFile}
              editingTransaction={moneyPage.editingTransaction}
              displaySponsors={moneyPage.displaySponsors}
              yearlySponsorBreakdown={moneyPage.yearlySponsorBreakdown}
              saving={moneyPage.saving}
              handleSubmit={moneyPage.handleSubmit}
              cancelEditTransaction={closeAddTransactionModal}
              fillTestTransaction={moneyPage.fillTestTransaction}
              openNewSponsorForm={moneyPage.openNewSponsorForm}
            />
          </div>
        </div>
      )}

      <MoneyPageModals
        sponsorFormOpen={moneyPage.sponsorFormOpen}
        editingSponsor={moneyPage.editingSponsor}
        sponsorForm={moneyPage.sponsorForm}
        setSponsorForm={moneyPage.setSponsorForm}
        savingSponsor={moneyPage.savingSponsor}
        onCloseSponsorForm={moneyPage.closeSponsorForm}
        onSaveSponsor={moneyPage.saveSponsor}
        deleteYearOpen={moneyPage.deleteYearOpen}
        selectedYear={moneyPage.selectedYear}
        yearTransactionsLength={moneyPage.yearTransactions.length}
        deletingYear={moneyPage.deletingYear}
        deleteYearPassword={moneyPage.deleteYearPassword}
        setDeleteYearPassword={moneyPage.setDeleteYearPassword}
        onCloseDeleteYear={moneyPage.closeDeleteYear}
        onDeleteYear={moneyPage.deleteSelectedYearTransactions}
        deleteSponsorId={moneyPage.deleteSponsorId}
        deletingSponsor={moneyPage.deletingSponsor}
        setDeleteSponsorId={moneyPage.setDeleteSponsorId}
        onDeleteSponsor={moneyPage.deleteSponsor}
        deleteId={moneyPage.deleteId}
        deleting={moneyPage.deleting}
        setDeleteId={moneyPage.setDeleteId}
        onHidePayment={moneyPage.deleteTransaction}
        deleteAllOpen={moneyPage.deleteAllOpen}
        transactionsLength={moneyPage.transactions.length}
        deletingAll={moneyPage.deletingAll}
        deleteAllPassword={moneyPage.deleteAllPassword}
        setDeleteAllPassword={moneyPage.setDeleteAllPassword}
        onCloseDeleteAll={moneyPage.closeDeleteAll}
        onDeleteAll={moneyPage.deleteAllTransactions}
      />
    </main>
  );
}