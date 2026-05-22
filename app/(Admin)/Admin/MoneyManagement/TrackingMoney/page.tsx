"use client";

import Link from "next/link";
import {
  ArrowRight,
  Coins,
  FileSpreadsheet,
  RefreshCcw,
} from "lucide-react";

import MoneyHeader from "../../components/money/MoneyHeader";
import MoneyStatsCards from "../../components/money/MoneySummaryCards";
import MoneyPageStatus from "../../components/money/MoneyPageStatus";
import MoneyDashboardAlerts from "../../components/money/MoneyDashboardAlerts";
import MoneyMainGrid from "../../components/money/MoneyMainGrid";
import MoneySponsorSection from "../../components/money/MoneySponsorSection";
import MoneyMonthlyBreakdown from "../../components/money/MoneyMonthlyBreakdown";
import MoneyYearLockPanel from "../../components/money/MoneyYearLockPanel";
import MoneyCarryForwardNote from "../../components/money/MoneyCarryForwardNote";
import MoneyPageModals from "../../components/money/MoneyPageModals";
import FundingReportExportButton from "../../components/money/FundingReportExportButton";

import { useMoneyTransactionsPage } from "@/hooks/useMoneyTransactionsPage";

export default function MoneyTransactionsPage() {
  const money = useMoneyTransactionsPage();

  return (
    <main className="min-h-screen w-full max-w-full overflow-x-auto bg-[#070716] px-3 py-5 text-white sm:px-5 lg:px-6">
      <div className="mx-auto w-full max-w-[1600px] min-w-0 space-y-6">
        <MoneyHeader
          selectedYear={money.selectedYear}
          yearOptions={money.yearOptions}
          onYearChange={money.handleYearChange}
          onRefresh={money.refreshAll}
        />

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-white">
                Website payments sync
              </h2>

              <p className="max-w-3xl text-sm text-white/65">
                Website payments are not synced automatically when this page
                loads. Use this button when you want to pull Stripe website
                payments into the money tracker, including donations, raffle,
                Windows of Hope, vendor fees, sponsorship, and future payment
                types. Manual entries will stay separate.
              </p>
            </div>

            <button
              type="button"
              onClick={money.syncStripeDonations}
              disabled={money.stripeSyncing}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-400/30 bg-sky-500/10 px-4 py-2.5 text-sm font-semibold text-sky-100 shadow-lg shadow-sky-950/20 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              <RefreshCcw
                className={`h-4 w-4 ${
                  money.stripeSyncing ? "animate-spin" : ""
                }`}
              />

              {money.stripeSyncing
                ? "Syncing website payments..."
                : "Sync Website Payments"}
            </button>
          </div>

          {money.stripeSyncMessage && (
            <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-100">
              {money.stripeSyncMessage}
            </div>
          )}

          {money.stripeSyncError && (
            <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-100">
              {money.stripeSyncError}
            </div>
          )}
        </section>

        <MoneyPageStatus
          error={money.error}
          errorDetails={money.errorDetails}
          selectedYear={money.selectedYear}
          selectedViewMonth={money.selectedViewMonth}
          filteredTransactionsLength={money.filteredTransactions.length}
          yearTransactionsLength={money.yearTransactions.length}
        />


        <MoneyDashboardAlerts
          selectedYear={money.selectedYear}
          transactions={money.yearTransactions}
          yearlySponsorBreakdown={money.yearlySponsorBreakdown}
          failedCsvRows={(money as any).failedCsvRows || []}
          onSetFilter={money.setFilter}
          onSetSearchTerm={money.setSearchTerm}
        />


        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 sm:p-5">
          <div className="mb-5 flex flex-col gap-2">
            <h2 className="text-2xl font-black text-white">
              Money tracker tools
            </h2>

            <p className="max-w-3xl text-sm leading-6 text-white/60">
              Extra tools for tracking cash fundraising and keeping Burton
              Pride accounts clear.
            </p>
          </div>

          <div className="grid gap-4">
            <Link
              href="/Admin/MoneyManagement/TrackingMoney/MoneyDashboardCharts/CashTinTracker"
              className="group rounded-3xl border border-amber-300/20 bg-amber-500/10 p-5 shadow-2xl shadow-black/20 transition hover:-translate-y-1 hover:bg-amber-500/20"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/20 text-amber-100 ring-1 ring-amber-300/20">
                <Coins className="h-6 w-6" />
              </div>

              <h3 className="text-xl font-black text-white">
                Cash Tin Tracker
              </h3>

              <p className="mt-2 text-sm leading-6 text-white/60">
                Track cash fundraising days, starting cash, money received,
                money banked, cash spent, who counted it, and any difference.
              </p>

              <div className="mt-4 inline-flex items-center gap-2 text-sm font-black text-amber-100">
                Open cash tracker
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </div>
            </Link>
          </div>
        </section>

        <MoneyYearLockPanel
          selectedYear={money.selectedYear}
          selectedYearLocked={money.selectedYearLocked}
          yearLockPassword={money.yearLockPassword}
          setYearLockPassword={money.setYearLockPassword}
          lockingYear={money.lockingYear}
          onLockYear={money.lockSelectedYear}
          onUnlockYear={money.unlockSelectedYear}
          printMonthOptions={money.printMonthOptions}
          selectedLockMonth={money.selectedLockMonth}
          setSelectedLockMonth={money.setSelectedLockMonth}
          selectedMonthLocked={money.selectedMonthLocked}
          monthLockPassword={money.monthLockPassword}
          setMonthLockPassword={money.setMonthLockPassword}
          lockingMonth={money.lockingMonth}
          onLockMonth={money.lockSelectedMonth}
          onUnlockMonth={money.unlockSelectedMonth}
        />

        <MoneyStatsCards totals={money.totals} />

        <MoneyCarryForwardNote
          selectedYear={money.selectedYear}
          carryForwardNote={money.carryForwardNote}
        />

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 sm:p-5">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-100">
                <FileSpreadsheet className="h-4 w-4" />
                Grant / funding reports
              </div>

              <h2 className="text-2xl font-black text-white">
                Export funding record reports
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
                Export one funding record at a time, showing money received,
                money spent, remaining balance, linked transactions, receipts,
                and notes for {money.selectedYear}.
              </p>
            </div>
          </div>

          {money.yearlySponsorBreakdown.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
              No funding or sponsor records found for {money.selectedYear}.
              Add a sponsor/funding record first, then export its report here.
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {money.yearlySponsorBreakdown.map((funding: any) => {
                const fundingId =
                  funding.id ||
                  funding.sponsor_id ||
                  funding.sponsorId ||
                  funding.record_id ||
                  "";

                const fundingName =
                  funding.sponsor_name ||
                  funding.sponsorName ||
                  funding.name ||
                  funding.funding_name ||
                  "Funding record";

                const receivedPence =
                  funding.received_pence ||
                  funding.receivedPence ||
                  funding.received_amount_pence ||
                  0;

                const spentPence =
                  funding.spent_pence ||
                  funding.spentPence ||
                  funding.spent_amount_pence ||
                  0;

                const remainingPence =
                  funding.remaining_pence ||
                  funding.remainingPence ||
                  receivedPence - spentPence;

                return (
                  <div
                    key={fundingId || fundingName}
                    className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h3 className="break-words text-lg font-black text-white">
                          {fundingName}
                        </h3>

                        <div className="mt-3 grid gap-2 text-sm text-white/65 sm:grid-cols-3">
                          <div className="rounded-xl bg-black/20 p-3">
                            <p className="text-xs font-black uppercase tracking-wide text-emerald-100/70">
                              Received
                            </p>
                            <p className="mt-1 font-black text-white">
                              {new Intl.NumberFormat("en-GB", {
                                style: "currency",
                                currency: "GBP",
                              }).format((Number(receivedPence) || 0) / 100)}
                            </p>
                          </div>

                          <div className="rounded-xl bg-black/20 p-3">
                            <p className="text-xs font-black uppercase tracking-wide text-red-100/70">
                              Spent
                            </p>
                            <p className="mt-1 font-black text-white">
                              {new Intl.NumberFormat("en-GB", {
                                style: "currency",
                                currency: "GBP",
                              }).format((Number(spentPence) || 0) / 100)}
                            </p>
                          </div>

                          <div className="rounded-xl bg-black/20 p-3">
                            <p className="text-xs font-black uppercase tracking-wide text-sky-100/70">
                              Remaining
                            </p>
                            <p className="mt-1 font-black text-white">
                              {new Intl.NumberFormat("en-GB", {
                                style: "currency",
                                currency: "GBP",
                              }).format((Number(remainingPence) || 0) / 100)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        <FundingReportExportButton
                          fundingId={fundingId}
                          year={money.selectedYear}
                          label="Export report"
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <MoneySponsorSection
          selectedYear={money.selectedYear}
          yearlySponsorBreakdown={money.yearlySponsorBreakdown}
          openNewSponsorForm={money.openNewSponsorForm}
          startEditSponsor={money.startEditSponsor}
          setDeleteSponsorId={money.setDeleteSponsorId}
        />

        <MoneyMonthlyBreakdown
          selectedYear={money.selectedYear}
          transactions={money.transactions}
        />

        <MoneyMainGrid
          form={money.form}
          setForm={money.setForm}
          invoiceFiles={money.invoiceFiles}
          setInvoiceFiles={money.setInvoiceFiles}
          editingTransaction={money.editingTransaction}
          displaySponsors={money.displaySponsors}
          yearlySponsorBreakdown={money.yearlySponsorBreakdown}
          saving={money.saving}
          handleSubmit={money.handleSubmit}
          cancelEditTransaction={money.cancelEditTransaction}
          fillTestTransaction={money.fillTestTransaction}
          openNewSponsorForm={money.openNewSponsorForm}
          loading={money.loading}
          transactions={money.transactions}
          filteredTransactions={money.filteredTransactions}
          yearTransactions={money.yearTransactions}
          printTransactionsList={money.printTransactionsList}
          printMonthOptions={money.printMonthOptions}
          selectedYear={money.selectedYear}
          selectedViewMonth={money.selectedViewMonth}
          setSelectedViewMonth={money.setSelectedViewMonth}
          selectedPrintMonth={money.selectedPrintMonth}
          setSelectedPrintMonth={money.setSelectedPrintMonth}
          searchTerm={money.searchTerm}
          setSearchTerm={money.setSearchTerm}
          filter={money.filter}
          setFilter={money.setFilter}
          selectedSponsorId={money.selectedSponsorId}
          setSelectedSponsorId={money.setSelectedSponsorId}
          selectedSponsor={money.selectedSponsor}
          selectedPaymentMethod={money.selectedPaymentMethod}
          setSelectedPaymentMethod={money.setSelectedPaymentMethod}
          deletingYear={money.deletingYear}
          deletingAll={money.deletingAll}
          repayingId={money.repayingId}
          checkingId={money.checkingId}
          bankReconcilingId={money.bankReconcilingId}
          financeNoteUpdatingId={money.financeNoteUpdatingId}
          deleting={money.deleting}
          onPrint={money.printTransactions}
          onExportExcel={money.exportTransactionsToExcel}
          onExportYearlyReport={money.exportFullYearlyReport}
          onOpenDeleteYear={() => money.setDeleteYearOpen(true)}
          onOpenDeleteAll={() => money.setDeleteAllOpen(true)}
          onEditTransaction={money.startEditTransaction}
          onHideTransaction={money.setDeleteId}
          onTogglePersonalFundsRepaid={money.togglePersonalFundsRepaid}
          onMarkTransactionChecked={money.markTransactionChecked}
          onUpdateBankReconciliationStatus={
            money.updateBankReconciliationStatus
          }
          onUpdateFinanceNote={money.updateFinanceNote}
        />
      </div>

      <MoneyPageModals
        sponsorFormOpen={money.sponsorFormOpen}
        editingSponsor={money.editingSponsor}
        sponsorForm={money.sponsorForm}
        setSponsorForm={money.setSponsorForm}
        savingSponsor={money.savingSponsor}
        onCloseSponsorForm={money.closeSponsorForm}
        onSaveSponsor={money.saveSponsor}
        deleteYearOpen={money.deleteYearOpen}
        selectedYear={money.selectedYear}
        yearTransactionsLength={money.yearTransactions.length}
        deletingYear={money.deletingYear}
        deleteYearPassword={money.deleteYearPassword}
        setDeleteYearPassword={money.setDeleteYearPassword}
        onCloseDeleteYear={money.closeDeleteYear}
        onDeleteYear={money.deleteSelectedYearTransactions}
        deleteSponsorId={money.deleteSponsorId}
        deletingSponsor={money.deletingSponsor}
        setDeleteSponsorId={money.setDeleteSponsorId}
        onDeleteSponsor={money.deleteSponsor}
        deleteId={money.deleteId}
        deleting={money.deleting}
        setDeleteId={money.setDeleteId}
        onHidePayment={money.deleteTransaction}
        deleteAllOpen={money.deleteAllOpen}
        transactionsLength={money.transactions.length}
        deletingAll={money.deletingAll}
        deleteAllPassword={money.deleteAllPassword}
        setDeleteAllPassword={money.setDeleteAllPassword}
        onCloseDeleteAll={money.closeDeleteAll}
        onDeleteAll={money.deleteAllTransactions}
        loanRepaymentSponsor={money.loanRepaymentSponsor}
        loanRepaymentForm={money.loanRepaymentForm}
        setLoanRepaymentForm={money.setLoanRepaymentForm}
        savingLoanRepayment={money.savingLoanRepayment}
        onCloseLoanRepayment={money.closeLoanRepaymentModal}
        onSaveLoanRepayment={money.saveLoanRepayment}
        loanInterestSponsor={money.loanInterestSponsor}
        loanInterestForm={money.loanInterestForm}
        setLoanInterestForm={money.setLoanInterestForm}
        savingLoanInterest={money.savingLoanInterest}
        onCloseLoanInterest={money.closeLoanInterestModal}
        onSaveLoanInterest={money.saveLoanInterest}
      />
    </main>
  );
}