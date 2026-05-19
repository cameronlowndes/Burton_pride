"use client";

import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Home,
  Printer,
  RefreshCcw,
  Table,
} from "lucide-react";

import MoneyHeader from "../../../../components/money/MoneyHeader";
import MoneyPageStatus from "../../../../components/money/MoneyPageStatus";
import MoneyMonthlyBreakdown from "../../../../components/money/MoneyMonthlyBreakdown";
import MoneyPageModals from "../../../../components/money/MoneyPageModals";

import { useMoneyTransactionsPage } from "@/hooks/useMoneyTransactionsPage";
import { money } from "@/lib/money/helpers";

export default function MoneyReportsPage() {
  const moneyPage = useMoneyTransactionsPage();

  return (
    <main className="min-h-screen w-full max-w-full overflow-x-auto bg-[#070716] px-3 py-5 text-white sm:px-5 lg:px-6">
      <div className="mx-auto w-full max-w-[1400px] min-w-0 space-y-6">
        <MoneyHeader
          selectedYear={moneyPage.selectedYear}
          yearOptions={moneyPage.yearOptions}
          onYearChange={moneyPage.handleYearChange}
          onRefresh={moneyPage.refreshAll}
        />

        <section className="overflow-hidden rounded-[2rem] border border-emerald-300/20 bg-gradient-to-br from-emerald-500/15 via-white/[0.04] to-white/[0.02] p-5 shadow-2xl sm:p-6 lg:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-100">
                <FileText className="h-4 w-4" />
                Reports
              </div>

              <h1 className="break-words text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
                Money reports
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65 sm:text-base">
                Print reports, export Excel files, export full yearly reports,
                and check your monthly breakdown.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={moneyPage.refreshAll}
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
              </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 lg:min-w-[560px]">
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-100">
                  Money in
                </p>

                <p className="mt-2 break-words text-2xl font-black text-white">
                  {money(moneyPage.totals.income)}
                </p>
              </div>

              <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-red-100">
                  Money out
                </p>

                <p className="mt-2 break-words text-2xl font-black text-white">
                  {money(moneyPage.totals.expense)}
                </p>
              </div>

              <div className="rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-sky-100">
                  Balance
                </p>

                <p
                  className={`mt-2 break-words text-2xl font-black ${
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

        <section className="grid gap-4 lg:grid-cols-3">
          <button
            type="button"
            onClick={moneyPage.printTransactions}
            disabled={moneyPage.printTransactionsList.length === 0}
            className="rounded-3xl border border-sky-300/20 bg-sky-500/10 p-5 text-left text-sky-100 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Printer className="mb-4 h-6 w-6" />

            <h2 className="text-lg font-black text-white">Print report</h2>

            <p className="mt-2 text-sm text-white/60">
              Print the selected year or selected month using your report
              layout.
            </p>

            <p className="mt-4 text-sm font-black">Print now</p>
          </button>

          <button
            type="button"
            onClick={moneyPage.exportTransactionsToExcel}
            disabled={moneyPage.filteredTransactions.length === 0}
            className="rounded-3xl border border-emerald-300/20 bg-emerald-500/10 p-5 text-left text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Table className="mb-4 h-6 w-6" />

            <h2 className="text-lg font-black text-white">Export Excel</h2>

            <p className="mt-2 text-sm text-white/60">
              Export the current filtered transaction view to Excel.
            </p>

            <p className="mt-4 text-sm font-black">Export transactions</p>
          </button>

          <button
            type="button"
            onClick={moneyPage.exportFullYearlyReport}
            disabled={moneyPage.yearTransactions.length === 0}
            className="rounded-3xl border border-purple-300/20 bg-purple-500/10 p-5 text-left text-purple-100 transition hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileText className="mb-4 h-6 w-6" />

            <h2 className="text-lg font-black text-white">Yearly report</h2>

            <p className="mt-2 text-sm text-white/60">
              Export the full yearly report with totals and sponsor breakdown.
            </p>

            <p className="mt-4 text-sm font-black">Export yearly report</p>
          </button>
        </section>

        <MoneyMonthlyBreakdown
          selectedYear={moneyPage.selectedYear}
          transactions={moneyPage.transactions}
        />

        <div className="flex flex-wrap gap-3">
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
        loanRepaymentSponsor={moneyPage.loanRepaymentSponsor}
        loanRepaymentForm={moneyPage.loanRepaymentForm}
        setLoanRepaymentForm={moneyPage.setLoanRepaymentForm}
        savingLoanRepayment={moneyPage.savingLoanRepayment}
        onCloseLoanRepayment={moneyPage.closeLoanRepaymentModal}
        onSaveLoanRepayment={moneyPage.saveLoanRepayment}
        loanInterestSponsor={moneyPage.loanInterestSponsor}
        loanInterestForm={moneyPage.loanInterestForm}
        setLoanInterestForm={moneyPage.setLoanInterestForm}
        savingLoanInterest={moneyPage.savingLoanInterest}
        onCloseLoanInterest={moneyPage.closeLoanInterestModal}
        onSaveLoanInterest={moneyPage.saveLoanInterest}
      />
    </main>
  );
}