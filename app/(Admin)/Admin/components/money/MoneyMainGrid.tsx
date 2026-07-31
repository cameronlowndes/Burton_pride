"use client";

import type { Dispatch, SetStateAction, SyntheticEvent } from "react";

import type {
  BankReconciliationStatus,
  FinanceNoteStatus,
  FormState,
  FundingType,
  Sponsor,
  Transaction,
} from "@/lib/money/types";

import MoneyTransactionForm from "./MoneyTransactionForm";
import MoneyTransactionsTable from "./MoneyTransactionsTable";

type MonthOption = {
  key: string;
  label: string;
  count: number;
};

type MoneyFilter = "all" | "income" | "expense" | "sponsorship" | "personal";

type YearlySponsorBreakdown = {
  sponsor_id: string;
  sponsor_name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  agreed_amount_pence: number;
  received_pence: number;
  spent_pence: number;
  remaining_pence: number;
  carried_forward_pence?: number;
  notes?: string | null;
  funding_type?: FundingType | null;
};

type SupplierContact = {
  id: string;
  created_at?: string | null;
  supplier_name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  category?: string | null;
  notes?: string | null;
  is_active?: boolean | null;
};

type MoneyMainGridProps = {
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;

  invoiceFiles: File[];
  setInvoiceFiles: Dispatch<SetStateAction<File[]>>;

  editingTransaction: Transaction | null;
  saving: boolean;
  handleSubmit: (event: SyntheticEvent<HTMLFormElement>) => Promise<void>;
  cancelEditTransaction: () => void;
  fillTestTransaction?: () => void;

  displaySponsors: Sponsor[];
  yearlySponsorBreakdown: YearlySponsorBreakdown[];
  openNewSponsorForm: () => void;

  displaySuppliers?: SupplierContact[];
  openNewSupplierForm?: () => void;

  loading: boolean;
  transactions: Transaction[];
  filteredTransactions: Transaction[];
  yearTransactions: Transaction[];
  printTransactionsList: Transaction[];
  printMonthOptions: MonthOption[];

  selectedYear: string;
  selectedViewMonth: string;
  setSelectedViewMonth: Dispatch<SetStateAction<string>>;

  selectedPrintMonth: string;
  setSelectedPrintMonth: Dispatch<SetStateAction<string>>;

  searchTerm: string;
  setSearchTerm: Dispatch<SetStateAction<string>>;

  filter: MoneyFilter;
  setFilter: Dispatch<SetStateAction<MoneyFilter>>;

  selectedSponsorId: string;
  setSelectedSponsorId: Dispatch<SetStateAction<string>>;
  selectedSponsor: Sponsor | null;

  selectedPaymentMethod: string;
  setSelectedPaymentMethod: Dispatch<SetStateAction<string>>;

  deletingYear: boolean;
  deletingAll: boolean;
  deleting: boolean;

  repayingId: string | null;
  checkingId: string | null;
  bankReconcilingId: string | null;
  financeNoteUpdatingId: string | null;

  receiptReminderDays?: number;

  onPrint: () => void;
  onExportExcel: () => Promise<void>;
  onExportYearlyReport: () => Promise<void>;
  onOpenDeleteYear: () => void;
  onOpenDeleteAll: () => void;

  onEditTransaction: (item: Transaction) => void;
  onHideTransaction: Dispatch<SetStateAction<string | null>>;

  onTogglePersonalFundsRepaid: (
    item: Transaction,
    proofFiles?: File[],
  ) => Promise<void>;

  onMarkTransactionChecked: (item: Transaction) => Promise<void>;

  onUpdateBankReconciliationStatus: (
    item: Transaction,
    status: BankReconciliationStatus,
    note?: string,
  ) => Promise<void>;

  onUpdateFinanceNote: (
    item: Transaction,
    status: FinanceNoteStatus,
    note?: string,
  ) => Promise<void>;

  /**
   * Reloads only the Money Tracker transaction data.
   *
   * This must be the same async function that fetches
   * /api/admin/money/transactions and updates the transactions state.
   * Do not pass window.location.reload or router.refresh.
   */
  onRefreshTransactions: () => void | Promise<void>;
};

export default function MoneyMainGrid({
  form,
  setForm,
  invoiceFiles,
  setInvoiceFiles,
  editingTransaction,
  saving,
  handleSubmit,
  cancelEditTransaction,
  fillTestTransaction,

  displaySponsors,
  yearlySponsorBreakdown,
  openNewSponsorForm,

  displaySuppliers = [],
  openNewSupplierForm,

  loading,
  transactions,
  filteredTransactions,
  yearTransactions,
  printTransactionsList,
  printMonthOptions,

  selectedYear,
  selectedViewMonth,
  setSelectedViewMonth,
  selectedPrintMonth,
  setSelectedPrintMonth,

  searchTerm,
  setSearchTerm,
  filter,
  setFilter,

  selectedSponsorId,
  setSelectedSponsorId,
  selectedSponsor,

  selectedPaymentMethod,
  setSelectedPaymentMethod,

  deletingYear,
  deletingAll,
  deleting,
  repayingId,
  checkingId,
  bankReconcilingId,
  financeNoteUpdatingId,

  receiptReminderDays = 7,

  onPrint,
  onExportExcel,
  onExportYearlyReport,
  onOpenDeleteYear,
  onOpenDeleteAll,
  onEditTransaction,
  onHideTransaction,
  onTogglePersonalFundsRepaid,
  onMarkTransactionChecked,
  onUpdateBankReconciliationStatus,
  onUpdateFinanceNote,
  onRefreshTransactions,
}: MoneyMainGridProps) {
  return (
    <section className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
      <MoneyTransactionForm
        form={form}
        setForm={setForm}
        invoiceFiles={invoiceFiles}
        setInvoiceFiles={setInvoiceFiles}
        editingTransaction={editingTransaction}
        saving={saving}
        displaySponsors={displaySponsors}
        yearlySponsorBreakdown={yearlySponsorBreakdown}
        displaySuppliers={displaySuppliers}
        openNewSupplierForm={openNewSupplierForm}
        handleSubmit={handleSubmit}
        cancelEditTransaction={cancelEditTransaction}
        openNewSponsorForm={openNewSponsorForm}
      />

      <MoneyTransactionsTable
        loading={loading}
        transactions={transactions}
        filteredTransactions={filteredTransactions}
        printTransactionsList={printTransactionsList}
        yearTransactions={yearTransactions}
        selectedYear={selectedYear}
        selectedViewMonth={selectedViewMonth}
        setSelectedViewMonth={setSelectedViewMonth}
        selectedPrintMonth={selectedPrintMonth}
        setSelectedPrintMonth={setSelectedPrintMonth}
        printMonthOptions={printMonthOptions}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filter={filter}
        setFilter={setFilter}
        selectedSponsorId={selectedSponsorId}
        setSelectedSponsorId={setSelectedSponsorId}
        selectedSponsor={selectedSponsor}
        displaySponsors={displaySponsors}
        selectedPaymentMethod={selectedPaymentMethod}
        setSelectedPaymentMethod={setSelectedPaymentMethod}
        deletingYear={deletingYear}
        deletingAll={deletingAll}
        deleting={deleting}
        repayingId={repayingId}
        checkingId={checkingId}
        bankReconcilingId={bankReconcilingId}
        financeNoteUpdatingId={financeNoteUpdatingId}
        receiptReminderDays={receiptReminderDays}
        onPrint={onPrint}
        onExportExcel={onExportExcel}
        onExportYearlyReport={onExportYearlyReport}
        onOpenDeleteYear={onOpenDeleteYear}
        onOpenDeleteAll={onOpenDeleteAll}
        onEditTransaction={onEditTransaction}
        onHideTransaction={onHideTransaction}
        onTogglePersonalFundsRepaid={onTogglePersonalFundsRepaid}
        onMarkTransactionChecked={onMarkTransactionChecked}
        onUpdateBankReconciliationStatus={onUpdateBankReconciliationStatus}
        onUpdateFinanceNote={onUpdateFinanceNote}
        onRefreshTransactions={onRefreshTransactions}
      />
    </section>
  );
}