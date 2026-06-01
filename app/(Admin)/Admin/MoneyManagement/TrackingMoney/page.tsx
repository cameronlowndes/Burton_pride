"use client";

import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  Coins,
  RefreshCcw,
  RotateCcw,
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

import { useMoneyTransactionsPage } from "@/hooks/useMoneyTransactionsPage";

const RECEIPT_REMINDER_DAYS = 7;

export default function MoneyTransactionsPage() {
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
                Windows of Hope, vendor fees, sponsorship and future payment
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

          {money.stripeSyncMessage ? (
            <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-100">
              {money.stripeSyncMessage}
            </div>
          ) : null}

          {money.stripeSyncError ? (
            <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-100">
              {money.stripeSyncError}
            </div>
          ) : null}
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
          receiptReminderDays={RECEIPT_REMINDER_DAYS}
          onSetFilter={money.setFilter}
          onSetSearchTerm={money.setSearchTerm}
          onMarkTransactionChecked={money.markTransactionChecked}
        />

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 sm:p-5">
          <div className="mb-5 flex flex-col gap-2">
            <h2 className="text-2xl font-black text-white">
              Money tracker tools
            </h2>

            <p className="max-w-3xl text-sm leading-6 text-white/60">
              Extra tools for tracking cash fundraising, refunds and Burton
              Pride accounts clearly.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Link
              href="/Admin/MoneyManagement/TrackingMoney/BudgetPlanning"
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
                money banked, cash spent, who counted it and any difference.
              </p>

              <div className="mt-4 inline-flex items-center gap-2 text-sm font-black text-amber-100">
                Open cash tracker

                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </div>
            </Link>

            <Link
              href="/Admin/MoneyManagement/TrackingMoney/Refunds"
              className="group rounded-3xl border border-violet-300/20 bg-violet-500/10 p-5 shadow-2xl shadow-black/20 transition hover:-translate-y-1 hover:bg-violet-500/20"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-400/20 text-violet-100 ring-1 ring-violet-300/20">
                <RotateCcw className="h-6 w-6" />
              </div>

              <h3 className="text-xl font-black text-white">
                Refund Tracker
              </h3>

              <p className="mt-2 text-sm leading-6 text-white/60">
                Track money returned to Burton Pride and money refunded back
                to other people separately from ordinary income and expenses.
                Money received back is added into the available Burton Pride
                balance without being counted as new income.
              </p>

              <div className="mt-4 inline-flex items-center gap-2 text-sm font-black text-violet-100">
                Open refund tracker

                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </div>
            </Link>

            <Link
              href="/Admin/MoneyManagement/TrackingMoney/BankBalanceCheck"
              className="group rounded-3xl border border-sky-300/20 bg-sky-500/10 p-5 shadow-2xl shadow-black/20 transition hover:-translate-y-1 hover:bg-sky-500/20"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-400/20 text-sky-100 ring-1 ring-sky-300/20">
                <Banknote className="h-6 w-6" />
              </div>

              <h3 className="text-xl font-black text-white">
                Manual Bank Balance Check
              </h3>

              <p className="mt-2 text-sm leading-6 text-white/60">
                Open the dedicated page to compare the real bank statement
                balance with Burton Pride Money In, including completed
                refunds received back. Save each check with the person who
                completed it.
              </p>

              <div className="mt-4 inline-flex items-center gap-2 text-sm font-black text-sky-100">
                Open bank balance check

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

        <div id="money-transactions-table" data-money-transactions-table>
          <MoneyMainGrid
            form={money.form}
            setForm={money.setForm}
            invoiceFiles={money.invoiceFiles}
            setInvoiceFiles={money.setInvoiceFiles}
            editingTransaction={money.editingTransaction}
            displaySponsors={money.displaySponsors}
            yearlySponsorBreakdown={money.yearlySponsorBreakdown}
            displaySuppliers={
              (money as any).displaySuppliers ||
              (money as any).suppliers ||
              []
            }
            openNewSupplierForm={(money as any).openNewSupplierForm}
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
            receiptReminderDays={RECEIPT_REMINDER_DAYS}
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
      </div>

      <MoneyPageModals
        sponsorFormOpen={money.sponsorFormOpen}
        editingSponsor={money.editingSponsor}
        sponsorForm={money.sponsorForm}
        setSponsorForm={money.setSponsorForm}
        savingSponsor={money.savingSponsor}
        onCloseSponsorForm={money.closeSponsorForm}
        onSaveSponsor={money.saveSponsor}
        supplierFormOpen={(money as any).supplierFormOpen || false}
        editingSupplier={(money as any).editingSupplier || null}
        supplierForm={(money as any).supplierForm}
        setSupplierForm={(money as any).setSupplierForm}
        savingSupplier={(money as any).savingSupplier || false}
        onCloseSupplierForm={(money as any).closeSupplierForm}
        onSaveSupplier={(money as any).saveSupplier}
        deleteSupplierId={(money as any).deleteSupplierId || null}
        deletingSupplier={(money as any).deletingSupplier || false}
        setDeleteSupplierId={(money as any).setDeleteSupplierId}
        onDeleteSupplier={(money as any).deleteSupplier}
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