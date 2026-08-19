"use client";

import { useEffect, useState, type SyntheticEvent } from "react";
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

import MoneyHeader from "../../MoneyHeader";
import MoneyStatsCards from "../../MoneySummaryCards";
import MoneyPageStatus from "../../MoneyPageStatus";
import MoneyDashboardAlerts from "../../MoneyDashboardAlerts";
import MoneyMainGrid from "../../MoneyMainGrid";
import MoneySponsorSection from "../../MoneySponsorSection";
import MoneyMonthlyBreakdown from "../../MoneyMonthlyBreakdown";
import MoneyYearLockPanel from "../../MoneyYearLockPanel";
import MoneyCarryForwardNote from "../../MoneyCarryForwardNote";
import MoneyPageModals from "../../MoneyPageModals";
import WebsitePaymentsSyncCard from "../../WebsitePaymentsSyncCard";

import { useMoneyTransactionsPage } from "@/hooks/useMoneyTransactionsPage";

const RECEIPT_REMINDER_DAYS = 7;
const EASY_MODE_STORAGE_KEY =
  "burton-pride-money-tracker-easy-mode";
const EASY_MODE_CHANGE_EVENT =
  "burton-pride-money-tracker-easy-mode-change";

type MoneyTrackerDisplayMode = "full" | "easy" | "super-easy";

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

type BudgetAwareForm = Record<string, unknown> & {
  budgetCategory?: string | null;
  budgetCategoryKey?: string | null;
  budgetCategoryLabel?: string | null;
  budget_category?: string | null;
  budget_category_key?: string | null;
  budget_category_label?: string | null;
  costArea?: string | null;
  cost_area?: string | null;
};

function cleanBudgetValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Keeps all budget field aliases in sync before the transaction save handler
 * builds its API payload. This prevents a manually selected budget from being
 * lost and incorrectly displayed as an automatic budget match in the table.
 */
function normaliseBudgetFields<T extends BudgetAwareForm>(form: T): T {
  const key = cleanBudgetValue(
    form.budget_category_key ||
      form.budgetCategoryKey ||
      form.budget_category ||
      form.budgetCategory ||
      form.cost_area ||
      form.costArea,
  );

  const label = cleanBudgetValue(
    form.budget_category_label || form.budgetCategoryLabel,
  );

  if (!key && !label) {
    return {
      ...form,
      budgetCategory: "",
      budgetCategoryKey: "",
      budgetCategoryLabel: "",
      budget_category: "",
      budget_category_key: "",
      budget_category_label: "",
      costArea: "",
      cost_area: "",
    };
  }

  const resolvedKey = key || label;
  const resolvedLabel = label || key;

  return {
    ...form,
    budgetCategory: resolvedKey,
    budgetCategoryKey: resolvedKey,
    budgetCategoryLabel: resolvedLabel,
    budget_category: resolvedKey,
    budget_category_key: resolvedKey,
    budget_category_label: resolvedLabel,
    costArea: resolvedKey,
    cost_area: resolvedKey,
  };
}

export default function MoneyTransactionsPage() {
  const money = useMoneyTransactionsPage();
  const [displayMode, setDisplayMode] =
    useState<MoneyTrackerDisplayMode>("full");

  const easyMode = displayMode === "easy" || displayMode === "super-easy";
  const superEasyMode = displayMode === "super-easy";

  useEffect(() => {
    const savedMode = window.localStorage.getItem(EASY_MODE_STORAGE_KEY);

    if (savedMode === "easy" || savedMode === "super-easy") {
      setDisplayMode(savedMode);
    } else {
      setDisplayMode("full");
    }

    function handleStorageChange(event: StorageEvent) {
      if (event.key !== EASY_MODE_STORAGE_KEY) return;

      if (event.newValue === "easy" || event.newValue === "super-easy") {
        setDisplayMode(event.newValue);
      } else {
        setDisplayMode("full");
      }
    }

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(EASY_MODE_STORAGE_KEY, displayMode);
    document.documentElement.dataset.moneyTrackerMode = displayMode;

    window.dispatchEvent(
      new CustomEvent(EASY_MODE_CHANGE_EVENT, {
        detail: {
          easyMode,
          superEasyMode,
          mode: displayMode,
        },
      }),
    );
  }, [displayMode, easyMode, superEasyMode]);

  function changeDisplayMode(nextMode: MoneyTrackerDisplayMode) {
    setDisplayMode(nextMode);
  }

  // This is spread into every imported money component.
  // Components can use easyMode for both simplified modes, or superEasyMode
  // when they need to show only the most basic add-payment controls.
  // The `as any` keeps this page compatible while older components are updated.
  const easyModeProps = { easyMode, superEasyMode, displayMode } as any;

  async function handleMoneyTransactionSubmit(
    event: SyntheticEvent<HTMLFormElement>,
  ) {
    const currentForm = money.form as unknown as BudgetAwareForm;
    const normalisedForm = normaliseBudgetFields(currentForm);

    // Update the state used by the form and also synchronise the current object
    // immediately. The immediate synchronisation is important because the hook's
    // submit handler may read the existing form object before React completes the
    // state update.
    Object.assign(currentForm, normalisedForm);
    money.setForm(normalisedForm as typeof money.form);

    await money.handleSubmit(event);
  }

  return (
    <main
      data-easy-mode={easyMode ? "true" : "false"}
      data-super-easy-mode={superEasyMode ? "true" : "false"}
      data-money-tracker-mode={displayMode}
      className="min-h-screen w-full max-w-none overflow-x-auto bg-[#070716] px-1 py-5 text-white sm:px-2 lg:px-3"
    >
      <div className="w-full max-w-none min-w-0 space-y-6">
        <MoneyHeader
          {...easyModeProps}
          selectedYear={money.selectedYear}
          yearOptions={money.yearOptions}
          onYearChange={money.handleYearChange}
          onRefresh={money.refreshAll}
        />

        <section className="rounded-3xl border border-pink-300/20 bg-pink-500/10 p-4 shadow-2xl shadow-black/20 sm:p-5">
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-pink-500/20 text-pink-100 ring-1 ring-pink-300/20">
                {displayMode === "full" ? (
                  <Settings2 className="h-5 w-5" />
                ) : (
                  <Sparkles className="h-5 w-5" />
                )}
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-pink-100/65">
                  Display mode
                </p>

                <h2 className="mt-1 text-xl font-black text-white">
                  {displayMode === "super-easy"
                    ? "Super Easy Mode is on"
                    : displayMode === "easy"
                      ? "Easy Mode is on"
                      : "Full Mode is on"}
                </h2>

                <p className="mt-1 max-w-3xl text-sm leading-6 text-white/65">
                  {displayMode === "super-easy"
                    ? "Only the basic money tracker is shown. This is the simplest view for adding and checking payments without extra information getting in the way."
                    : displayMode === "easy"
                      ? "The main money tracker and summary are shown. Advanced reports, syncing, account locks and management tools are hidden to keep the page simple."
                      : "All money tracker tools are visible, including reports, website sync, alerts, account locks, funding details and monthly breakdowns."}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => changeDisplayMode("super-easy")}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${
                  displayMode === "super-easy"
                    ? "bg-white text-black"
                    : "border border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.1]"
                }`}
              >
                <Sparkles className="h-4 w-4" />
                Super Easy Mode
              </button>

              <button
                type="button"
                onClick={() => changeDisplayMode("easy")}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${
                  displayMode === "easy"
                    ? "bg-white text-black"
                    : "border border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.1]"
                }`}
              >
                <Sparkles className="h-4 w-4" />
                Easy Mode
              </button>

              <button
                type="button"
                onClick={() => changeDisplayMode("full")}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${
                  displayMode === "full"
                    ? "bg-white text-black"
                    : "border border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.1]"
                }`}
              >
                <Settings2 className="h-4 w-4" />
                Full Mode
              </button>
            </div>
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
              {...easyModeProps}
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
         
              onSync={(confirmedSessionIds) =>
                money.syncStripeDonations(confirmedSessionIds as any)
              }
              DetailedErrorBox={DetailedErrorBox}
            />

            <MoneyPageStatus
              {...easyModeProps}
              error={money.error}
              errorDetails={money.errorDetails}
              selectedYear={money.selectedYear}
              selectedViewMonth={money.selectedViewMonth}
              filteredTransactionsLength={money.filteredTransactions.length}
              yearTransactionsLength={money.yearTransactions.length}
            />

            <MoneyDashboardAlerts
              {...easyModeProps}
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
              {...easyModeProps}
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

            <MoneyStatsCards {...easyModeProps} totals={money.totals} />

            <MoneyCarryForwardNote
              {...easyModeProps}
              selectedYear={money.selectedYear}
              carryForwardNote={money.carryForwardNote}
            />

            <MoneySponsorSection
              {...easyModeProps}
              selectedYear={money.selectedYear}
              yearlySponsorBreakdown={money.yearlySponsorBreakdown}
              openNewSponsorForm={money.openNewSponsorForm}
              startEditSponsor={money.startEditSponsor}
              setDeleteSponsorId={money.setDeleteSponsorId}
            />

            <MoneyMonthlyBreakdown
              {...easyModeProps}
              selectedYear={money.selectedYear}
              transactions={money.transactions}
            />
          </>
        ) : superEasyMode ? null : (
          <MoneyStatsCards {...easyModeProps} totals={money.totals} />
        )}

        <div id="money-transactions-table" data-money-transactions-table>
          <MoneyMainGrid
            {...easyModeProps}
            form={money.form}
            setForm={money.setForm}
            invoiceFiles={money.invoiceFiles}
            setInvoiceFiles={money.setInvoiceFiles}
            editingTransaction={money.editingTransaction}
            displaySponsors={money.displaySponsors}
            yearlySponsorBreakdown={money.yearlySponsorBreakdown}
            budgetItems={(money as any).budgetItems || []}
            displaySuppliers={
              (money as any).displaySuppliers ||
              (money as any).suppliers ||
              []
            }
            openNewSupplierForm={(money as any).openNewSupplierForm}
            saving={money.saving}
            handleSubmit={handleMoneyTransactionSubmit}
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
            onRefreshTransactions={money.refreshAll}
          />
        </div>
      </div>

      <MoneyPageModals
        {...easyModeProps}
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