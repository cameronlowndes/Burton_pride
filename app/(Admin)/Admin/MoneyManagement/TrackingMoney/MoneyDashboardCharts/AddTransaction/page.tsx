"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Banknote,
  Home,
  PlusCircle,
  RefreshCcw,
} from "lucide-react";

import MoneyHeader from "../../../../components/money/MoneyHeader";
import MoneyPageStatus from "../../../../components/money/MoneyPageStatus";
import MoneyTransactionForm from "../../../../components/money/MoneyTransactionForm";
import MoneyPageModals from "../../../../components/money/MoneyPageModals";

import { useMoneyTransactionsPage } from "@/hooks/useMoneyTransactionsPage";

export default function AddTransactionPage() {
  const moneyPage = useMoneyTransactionsPage();

  return (
    <main className="min-h-screen w-full max-w-full overflow-x-auto bg-[#070716] px-3 py-5 text-white sm:px-5 lg:px-6">
      <div className="mx-auto w-full max-w-[900px] min-w-0 space-y-6">
        <MoneyHeader
          selectedYear={moneyPage.selectedYear}
          yearOptions={moneyPage.yearOptions}
          onYearChange={moneyPage.handleYearChange}
          onRefresh={moneyPage.refreshAll}
        />

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-pink-500/15 via-white/[0.04] to-white/[0.02] p-5 shadow-2xl sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-pink-300/20 bg-pink-500/10 px-4 py-2 text-sm font-bold text-pink-100">
                <PlusCircle className="h-4 w-4" />
                Add Transaction
              </div>

              <h1 className="break-words text-3xl font-black tracking-tight text-white sm:text-4xl">
                Add money record
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">
                Add money in, money out, personal funds, sponsorship spending,
                receipts, and repeating payments.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/Admin/Money/Dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20"
              >
                <Home className="h-4 w-4" />
                Dashboard
              </Link>

              <Link
                href="/Admin/MoneyManagement/TrackingMoney"
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20"
              >
                <ArrowLeft className="h-4 w-4" />
                Transactions
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

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl sm:p-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-xl font-black text-white">
                <Banknote className="h-5 w-5 text-pink-200" />
                New transaction
              </h2>

              <p className="mt-1 text-sm text-white/50">
                Complete the form below and save it into the money tracker.
              </p>
            </div>

            <button
              type="button"
              onClick={moneyPage.refreshAll}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
          </div>

          <MoneyTransactionForm
            form={moneyPage.form}
            setForm={moneyPage.setForm}
            invoiceFiles={moneyPage.invoiceFiles}
            setInvoiceFiles={moneyPage.setInvoiceFiles}
            editingTransaction={moneyPage.editingTransaction}
            displaySponsors={moneyPage.displaySponsors}
            yearlySponsorBreakdown={moneyPage.yearlySponsorBreakdown}
            saving={moneyPage.saving}
            handleSubmit={moneyPage.handleSubmit}
            cancelEditTransaction={moneyPage.cancelEditTransaction}
            openNewSponsorForm={moneyPage.openNewSponsorForm}
          />
        </section>
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