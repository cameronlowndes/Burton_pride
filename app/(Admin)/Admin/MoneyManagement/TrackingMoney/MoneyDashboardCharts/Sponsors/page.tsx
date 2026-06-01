"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Home,
  PlusCircle,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";

import MoneyHeader from "../../../../components/money/MoneyHeader";
import MoneyPageStatus from "../../../../components/money/MoneyPageStatus";
import MoneySponsorSection from "../../../../components/money/MoneySponsorSection";
import MoneyPageModals from "../../../../components/money/MoneyPageModals";

import { useMoneyTransactionsPage } from "@/hooks/useMoneyTransactionsPage";
import { money } from "@/lib/money/helpers";

export default function SponsorTrackingPage() {
  const moneyPage = useMoneyTransactionsPage();

  const overspentSponsors = moneyPage.yearlySponsorBreakdown.filter(
    (sponsor) => sponsor.remaining_pence < 0
  );

  const lowSponsorBalances = moneyPage.yearlySponsorBreakdown.filter(
    (sponsor) =>
      sponsor.remaining_pence >= 0 &&
      sponsor.received_pence > 0 &&
      sponsor.remaining_pence <= sponsor.received_pence * 0.2
  );

  return (
    <main className="min-h-screen w-full max-w-full overflow-x-auto bg-[#070716] px-3 py-5 text-white sm:px-5 lg:px-6">
      <div className="mx-auto w-full max-w-[1400px] min-w-0 space-y-6">
        <MoneyHeader
          selectedYear={moneyPage.selectedYear}
          yearOptions={moneyPage.yearOptions}
          onYearChange={moneyPage.handleYearChange}
          onRefresh={moneyPage.refreshAll}
        />

        <section className="overflow-hidden rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-amber-500/15 via-white/[0.04] to-white/[0.02] p-5 shadow-2xl sm:p-6 lg:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-500/10 px-4 py-2 text-sm font-bold text-amber-100">
                <ShieldCheck className="h-4 w-4" />
                Sponsor Tracking
              </div>

              <h1 className="break-words text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
                Sponsor money tracker
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65 sm:text-base">
                Check sponsor income, spending, carried-forward funds,
                remaining balances, and overspend warnings.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={moneyPage.openNewSponsorForm}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-black text-black hover:bg-amber-400"
                >
                  <PlusCircle className="h-4 w-4" />
                  Add sponsor
                </button>

                <button
                  type="button"
                  onClick={moneyPage.refreshAll}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Refresh
                </button>
              </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 lg:min-w-[560px]">
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-100">
                  Sponsor received
                </p>
                <p className="mt-2 break-words text-2xl font-black text-white">
                  {money(moneyPage.totals.sponsorshipIncome)}
                </p>
              </div>

              <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-red-100">
                  Sponsor spent
                </p>
                <p className="mt-2 break-words text-2xl font-black text-white">
                  {money(moneyPage.totals.sponsorshipSpent)}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-100">
                  Sponsor left
                </p>
                <p
                  className={`mt-2 break-words text-2xl font-black ${
                    moneyPage.totals.sponsorshipRemaining >= 0
                      ? "text-amber-100"
                      : "text-red-200"
                  }`}
                >
                  {money(moneyPage.totals.sponsorshipRemaining)}
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

        {(overspentSponsors.length > 0 || lowSponsorBalances.length > 0) && (
          <section className="rounded-3xl border border-red-300/20 bg-red-500/10 p-4 sm:p-5">
            <h2 className="text-xl font-black text-white">
              Sponsor balance warnings
            </h2>

            <p className="mt-1 text-sm text-red-100/70">
              Check these before spending more sponsor money.
            </p>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
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

        <MoneySponsorSection
          selectedYear={moneyPage.selectedYear}
          yearlySponsorBreakdown={moneyPage.yearlySponsorBreakdown}
          openNewSponsorForm={moneyPage.openNewSponsorForm}
          startEditSponsor={moneyPage.startEditSponsor}
          setDeleteSponsorId={moneyPage.setDeleteSponsorId}
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