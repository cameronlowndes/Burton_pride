"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Bug,
  Coins,
  RotateCcw,
  Settings2,
  Sparkles,
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
import WebsitePaymentsSyncCard from "../../components/money/WebsitePaymentsSyncCard";

import { useMoneyTransactionsPage } from "@/hooks/useMoneyTransactionsPage";

const RECEIPT_REMINDER_DAYS = 7;
const EASY_MODE_STORAGE_KEY = "burton-pride-money-tracker-easy-mode";

function safeString(value: unknown) {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value || "Unknown error");
  }
}

function getHelpfulErrorMessage(message: string) {
  const lower = message.toLowerCase();

  if (
    lower.includes("main admin password is wrong") ||
    lower.includes("password is wrong") ||
    lower.includes("incorrect password")
  ) {
    return {
      title: "Main admin password is wrong",
      summary:
        "The lock request reached the server, but the password entered does not match the saved main admin password.",
      checks: [
        "Enter the main admin password again carefully.",
        "Make sure Caps Lock is not turned on.",
        "Use the password configured in the Main Admin Delete Password page.",
        "If the password was changed recently, refresh the page and try again.",
      ],
    };
  }

  if (
    lower.includes("please enter the main admin password") ||
    lower.includes("missing password")
  ) {
    return {
      title: "Enter the main admin password",
      summary:
        "The lock request was blocked because no main admin password was entered.",
      checks: [
        "Enter the main admin password in the lock panel.",
        "Then press the lock or unlock button again.",
      ],
    };
  }

  if (
    lower.includes("no main admin password has been set") ||
    lower.includes("password setting")
  ) {
    return {
      title: "Main admin password has not been set",
      summary:
        "The yearly lock cannot be changed until a main admin password has been configured.",
      checks: [
        "Open the Main Admin Delete Password page.",
        "Create or update the main admin password.",
        "Return to the money tracker and try again.",
      ],
    };
  }

  if (lower.includes("clerk") || lower.includes("@clerk/nextjs")) {
    return {
      title: "Old Clerk code is still being used",
      summary:
        "The money tracker is trying to call Clerk, but this app has moved to Supabase auth.",
      checks: [
        "Search the project for @clerk/nextjs and remove it from money/admin files.",
        "Check lib/adminPermissions.ts does not import Clerk auth().",
        "Check the money API routes do not call Clerk auth() or currentUser().",
        "Replace Clerk checks with requireAdminPermission() or your Supabase admin session helper.",
      ],
    };
  }

  if (lower.includes("401") || lower.includes("unauthorized")) {
    return {
      title: "You are not signed in",
      summary:
        "The money tracker could not confirm your Supabase admin login session.",
      checks: [
        "Go back to /Admin/Login and sign in again.",
        "Check your admin session cookie is being created.",
        "Check the route is using your Supabase auth helper, not Clerk.",
      ],
    };
  }

  if (
    lower.includes("main admin access required") ||
    lower.includes("permission") ||
    lower.includes("403")
  ) {
    return {
      title: "Permission missing",
      summary:
        "Your admin account is signed in, but does not have permission to use this money tracker action.",
      checks: [
        "Open Admin Users & Permissions.",
        "Make sure your account has money:view.",
        "Make sure your account is set as main_admin for lock and unlock actions.",
        "For website sync, make sure you have money:sync_website_payments.",
      ],
    };
  }

  if (lower.includes("relation") || lower.includes("table")) {
    return {
      title: "Database table or column problem",
      summary:
        "Supabase returned a database error. A required table or column may be missing.",
      checks: [
        "Check the table named in the error exists in Supabase.",
        "Check the column names match the code.",
        "Run any missing SQL migration for the money tracker.",
      ],
    };
  }

  return {
    title: "Money tracker error",
    summary: "Something went wrong while loading or syncing the money tracker.",
    checks: [
      "Refresh the page.",
      "Check the browser console.",
      "Check your Vercel or terminal logs.",
      "Check the API route mentioned in the error.",
    ],
  };
}

function DetailedErrorBox({
  title,
  error,
  details,
}: {
  title: string;
  error: unknown;
  details?: unknown;
}) {
  const message = safeString(error);
  const detailText = details ? safeString(details) : "";
  const help = getHelpfulErrorMessage(`${message}\n${detailText}`);

  return (
    <section className="rounded-3xl border border-red-400/30 bg-red-500/10 p-4 shadow-2xl shadow-black/20">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-red-300/20 bg-red-500/15 text-red-100">
          <AlertTriangle className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-red-200">
            {title}
          </p>

          <h2 className="mt-2 text-xl font-black text-white">{help.title}</h2>

          <p className="mt-2 text-sm leading-6 text-red-100/80">
            {help.summary}
          </p>

          <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-black text-amber-100">
              <Bug className="h-4 w-4" />
              What to check
            </div>

            <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-amber-100/80">
              {help.checks.map((check) => (
                <li key={check}>{check}</li>
              ))}
            </ul>
          </div>

          <details className="mt-4 rounded-2xl border border-red-300/20 bg-black/30">
            <summary className="cursor-pointer px-4 py-3 text-sm font-black text-red-100">
              Show technical details
            </summary>

            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words border-t border-red-300/10 p-4 text-xs leading-5 text-red-50/90">
              {JSON.stringify(
                {
                  message,
                  details: detailText || null,
                },
                null,
                2,
              )}
            </pre>
          </details>
        </div>
      </div>
    </section>
  );
}

export default function MoneyTransactionsPage() {
  const money = useMoneyTransactionsPage();
  const [easyMode, setEasyMode] = useState(false);

  useEffect(() => {
    const savedMode = window.localStorage.getItem(EASY_MODE_STORAGE_KEY);

    if (savedMode === "full") {
      setEasyMode(false);
    }
  }, []);

  function changeEasyMode(nextEasyMode: boolean) {
    setEasyMode(nextEasyMode);
    window.localStorage.setItem(
      EASY_MODE_STORAGE_KEY,
      nextEasyMode ? "easy" : "full",
    );
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

        <section className="rounded-3xl border border-pink-300/20 bg-pink-500/10 p-4 shadow-2xl shadow-black/20 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-pink-500/20 text-pink-100 ring-1 ring-pink-300/20">
                {easyMode ? (
                  <Sparkles className="h-5 w-5" />
                ) : (
                  <Settings2 className="h-5 w-5" />
                )}
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-pink-100/65">
                  Display mode
                </p>

                <h2 className="mt-1 text-xl font-black text-white">
                  {easyMode ? "Easy Mode is on" : "Full Mode is on"}
                </h2>

                <p className="mt-1 max-w-3xl text-sm leading-6 text-white/65">
                  {easyMode
                    ? "The page is showing the main money tracker only. Advanced reports, syncing, account locks and management tools are hidden to keep the page simple."
                    : "All money tracker tools are visible, including reports, website sync, alerts, account locks, funding details and monthly breakdowns."}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => changeEasyMode(!easyMode)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-black transition hover:bg-pink-100 lg:w-auto"
            >
              {easyMode ? (
                <Settings2 className="h-4 w-4" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {easyMode ? "Show Full Mode" : "Use Easy Mode"}
            </button>
          </div>
        </section>

        {money.error ? (
          <DetailedErrorBox
            title="Money tracker error"
            error={money.error}
            details={money.errorDetails}
          />
        ) : null}

        {!easyMode ? (
          <>
            <WebsitePaymentsSyncCard
              syncing={money.stripeSyncing}
              previewing={(money as any).stripePreviewing || false}
              message={money.stripeSyncMessage}
              error={money.stripeSyncError}
              previewItems={(money as any).stripePreviewItems || []}
              onPreview={
                (money as any).previewStripeDonations ||
                (() => {
                  console.warn("previewStripeDonations is missing from hook.");
                })
              }
              onSync={money.syncStripeDonations}
              DetailedErrorBox={DetailedErrorBox}
            />

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
                    to other people separately from ordinary income and
                    expenses.
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
                    refunds received back.
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
          </>
        ) : (
          <MoneyStatsCards totals={money.totals} />
        )}

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