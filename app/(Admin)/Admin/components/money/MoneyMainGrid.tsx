"use client";

import type { Dispatch, SetStateAction, SyntheticEvent } from "react";

import type {
  FormState,
  Sponsor,
  Transaction,
} from "@/lib/money/types";

import MoneyTransactionForm from "./MoneyTransactionForm";
import MoneyTransactionsTable from "./MoneyTransactionsTable";

type MoneyMainGridProps = {
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  invoiceFile: File | null;
  setInvoiceFile: Dispatch<SetStateAction<File | null>>;
  editingTransaction: Transaction | null;
  displaySponsors: Sponsor[];
  saving: boolean;
  handleSubmit: (e: SyntheticEvent<HTMLFormElement>) => Promise<void>;
  cancelEditTransaction: () => void;
  fillTestTransaction: () => void;
  openNewSponsorForm: () => void;

  loading: boolean;
  transactions: Transaction[];
  filteredTransactions: Transaction[];
  yearTransactions: Transaction[];
  printTransactionsList: Transaction[];
  printMonthOptions: {
    key: string;
    label: string;
    count: number;
  }[];

  selectedYear: string;
  selectedViewMonth: string;
  setSelectedViewMonth: Dispatch<SetStateAction<string>>;
  selectedPrintMonth: string;
  setSelectedPrintMonth: Dispatch<SetStateAction<string>>;

  searchTerm: string;
  setSearchTerm: Dispatch<SetStateAction<string>>;

  filter: "all" | "income" | "expense" | "sponsorship" | "personal";
  setFilter: Dispatch<
    SetStateAction<"all" | "income" | "expense" | "sponsorship" | "personal">
  >;

  selectedSponsorId: string;
  setSelectedSponsorId: Dispatch<SetStateAction<string>>;
  selectedSponsor: Sponsor | null;

  deletingYear: boolean;
  deletingAll: boolean;
  repayingId: string | null;
  deleting: boolean;

  onPrint: () => void;
  onExportExcel: () => Promise<void>;
  onExportYearlyReport: () => Promise<void>;
  onOpenDeleteYear: () => void;
  onOpenDeleteAll: () => void;
  onEditTransaction: (item: Transaction) => void;
  onHideTransaction: Dispatch<SetStateAction<string | null>>;
  onTogglePersonalFundsRepaid: (item: Transaction) => Promise<void>;
};

export default function MoneyMainGrid({
  form,
  setForm,
  invoiceFile,
  setInvoiceFile,
  editingTransaction,
  displaySponsors,
  saving,
  handleSubmit,
  cancelEditTransaction,
  fillTestTransaction,
  openNewSponsorForm,

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

  deletingYear,
  deletingAll,
  repayingId,
  deleting,

  onPrint,
  onExportExcel,
  onExportYearlyReport,
  onOpenDeleteYear,
  onOpenDeleteAll,
  onEditTransaction,
  onHideTransaction,
  onTogglePersonalFundsRepaid,
}: MoneyMainGridProps) {
  return (
    <section className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
      <MoneyTransactionForm
        form={form}
        setForm={setForm}
        invoiceFile={invoiceFile}
        setInvoiceFile={setInvoiceFile}
        editingTransaction={editingTransaction}
        displaySponsors={displaySponsors}
        saving={saving}
        handleSubmit={handleSubmit}
        cancelEditTransaction={cancelEditTransaction}
        fillTestTransaction={fillTestTransaction}
        openNewSponsorForm={openNewSponsorForm}
      />

      <MoneyTransactionsTable
        loading={loading}
        transactions={transactions}
        filteredTransactions={filteredTransactions}
        yearTransactions={yearTransactions}
        printTransactionsList={printTransactionsList}
        printMonthOptions={printMonthOptions}
        selectedYear={selectedYear}
        selectedViewMonth={selectedViewMonth}
        setSelectedViewMonth={setSelectedViewMonth}
        selectedPrintMonth={selectedPrintMonth}
        setSelectedPrintMonth={setSelectedPrintMonth}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filter={filter}
        setFilter={setFilter}
        selectedSponsorId={selectedSponsorId}
        setSelectedSponsorId={setSelectedSponsorId}
        selectedSponsor={selectedSponsor}
        displaySponsors={displaySponsors}
        deletingYear={deletingYear}
        deletingAll={deletingAll}
        repayingId={repayingId}
        deleting={deleting}
        onPrint={onPrint}
        onExportExcel={onExportExcel}
        onExportYearlyReport={onExportYearlyReport}
        onOpenDeleteYear={onOpenDeleteYear}
        onOpenDeleteAll={onOpenDeleteAll}
        onEditTransaction={onEditTransaction}
        onHideTransaction={onHideTransaction}
        onTogglePersonalFundsRepaid={onTogglePersonalFundsRepaid}
      />
    </section>
  );
}