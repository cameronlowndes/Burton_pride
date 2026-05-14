"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Home,
  PlusCircle,
  ReceiptText,
} from "lucide-react";

import MoneyHeader from "../../../../components/money/MoneyHeader";
import MoneyStatsCards from "../../../../components/money/MoneySummaryCards";
import MoneyPageStatus from "../../../../components/money/MoneyPageStatus";
import MoneyMainGrid from "../../../../components/money/MoneyMainGrid";
import MoneySponsorSection from "../../../../components/money/MoneySponsorSection";
import MoneyMonthlyBreakdown from "../../../../components/money/MoneyMonthlyBreakdown";
import MoneyPageModals from "../../../../components/money/MoneyPageModals";

import { useMoneyTransactionsPage } from "@/hooks/useMoneyTransactionsPage";

export default function MoneyTransactionsPage() {
  const moneyPage = useMoneyTransactionsPage();

  return (
    <main className="min-h-screen w-full max-w-full overflow-x-auto bg-[#070716] px-3 py-5 text-white sm:px-5 lg:px-6">
      <div className="mx-auto w-full max-w-[1900px] min-w-0 space-y-6">
        <MoneyHeader
          selectedYear={moneyPage.selectedYear}
          yearOptions={moneyPage.yearOptions}
          onYearChange={moneyPage.handleYearChange}
          onRefresh={moneyPage.refreshAll}
        />

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-sky-500/15 via-white/[0.04] to-white/[0.02] p-5 shadow-2xl sm:p-6 lg:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-500/10 px-4 py-2 text-sm font-bold text-sky-100">
                <ReceiptText className="h-4 w-4" />
                Transactions
              </div>

              <h1 className="break-words text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
                Money transactions
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65 sm:text-base">
                Add, edit, search, filter, print, export, and manage all Burton
                Pride money records in one place.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/Admin/MoneyManagement/TrackingMoney/MoneyDashboardCharts"
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20"
              >
                <Home className="h-4 w-4" />
                Dashboard
              </Link>

              <Link
                href="/Admin/MoneyManagement/TrackingMoney/MoneyDashboardCharts/AddTransaction"
                className="inline-flex items-center gap-2 rounded-xl bg-pink-500 px-4 py-3 text-sm font-black text-white hover:bg-pink-400"
              >
                <PlusCircle className="h-4 w-4" />
                Add transaction
              </Link>

              <Link
                href="/Admin/MoneyManagement/TrackingMoney/MoneyDashboardCharts"
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20"
              >
                <ArrowLeft className="h-4 w-4" />
                Go Back
              </Link>
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

        <section className="rounded-3xl border border-sky-300/20 bg-sky-500/10 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-xl font-black text-white">
                <BarChart3 className="h-5 w-5 text-sky-200" />
                Monthly overview
              </h2>

              <p className="mt-1 text-sm text-sky-100/70">
                Jan to Dec breakdown for money in, money out, donations,
                expenses, and running balance.
              </p>
            </div>
          </div>

          <div className="mt-4">
            <MoneyMonthlyBreakdown
              selectedYear={moneyPage.selectedYear}
              transactions={moneyPage.transactions}
            />
          </div>
        </section>

        <MoneySponsorSection
          selectedYear={moneyPage.selectedYear}
          yearlySponsorBreakdown={moneyPage.yearlySponsorBreakdown}
          openNewSponsorForm={moneyPage.openNewSponsorForm}
          startEditSponsor={moneyPage.startEditSponsor}
          setDeleteSponsorId={moneyPage.setDeleteSponsorId}
        />

        <MoneyMainGrid
          form={moneyPage.form}
          setForm={moneyPage.setForm}
          invoiceFile={moneyPage.invoiceFile}
          setInvoiceFile={moneyPage.setInvoiceFile}
          editingTransaction={moneyPage.editingTransaction}
          displaySponsors={moneyPage.displaySponsors}
          yearlySponsorBreakdown={moneyPage.yearlySponsorBreakdown}
          saving={moneyPage.saving}
          handleSubmit={moneyPage.handleSubmit}
          cancelEditTransaction={moneyPage.cancelEditTransaction}
          fillTestTransaction={moneyPage.fillTestTransaction}
          openNewSponsorForm={moneyPage.openNewSponsorForm}
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
          deletingYear={moneyPage.deletingYear}
          deletingAll={moneyPage.deletingAll}
          repayingId={moneyPage.repayingId}
          deleting={moneyPage.deleting}
          onPrint={moneyPage.printTransactions}
          onExportExcel={moneyPage.exportTransactionsToExcel}
          onExportYearlyReport={moneyPage.exportFullYearlyReport}
          onOpenDeleteYear={() => moneyPage.setDeleteYearOpen(true)}
          onOpenDeleteAll={() => moneyPage.setDeleteAllOpen(true)}
          onEditTransaction={moneyPage.startEditTransaction}
          onHideTransaction={moneyPage.setDeleteId}
          onTogglePersonalFundsRepaid={moneyPage.togglePersonalFundsRepaid}
        />
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
      />
    </main>
  );
}