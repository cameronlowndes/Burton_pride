"use client";

import MoneyHeader from "../../components/money/MoneyHeader";
import MoneyStatsCards from "../../components/money/MoneySummaryCards";
import MoneyPageStatus from "../../components/money/MoneyPageStatus";
import MoneyMainGrid from "../../components/money/MoneyMainGrid";
import MoneySponsorSection from "../../components/money/MoneySponsorSection";
import MoneyMonthlyBreakdown from "../../components/money/MoneyMonthlyBreakdown";
import MoneyYearLockPanel from "../../components/money/MoneyYearLockPanel";
import MoneyPageModals from "../../components/money/MoneyPageModals";

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

        <MoneyPageStatus
          error={money.error}
          errorDetails={money.errorDetails}
          selectedYear={money.selectedYear}
          selectedViewMonth={money.selectedViewMonth}
          filteredTransactionsLength={money.filteredTransactions.length}
          yearTransactionsLength={money.yearTransactions.length}
        />

        <MoneyYearLockPanel
          selectedYear={money.selectedYear}
          selectedYearLocked={money.selectedYearLocked}
          yearLockPassword={money.yearLockPassword}
          setYearLockPassword={money.setYearLockPassword}
          lockingYear={money.lockingYear}
          onLockYear={money.lockSelectedYear}
          onUnlockYear={money.unlockSelectedYear}
        />

        <MoneyStatsCards totals={money.totals} />

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
      />
    </main>
  );
}