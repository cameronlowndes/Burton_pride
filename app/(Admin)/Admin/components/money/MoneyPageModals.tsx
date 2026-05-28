"use client";

import type { Dispatch, SetStateAction } from "react";

import type {
  LoanInterestFormState,
  LoanRepaymentFormState,
  Sponsor,
  SponsorBreakdown,
  SponsorFormState,
} from "@/lib/money/types";

import MoneyModals from "./MoneyModals";

type LoanActionFunding = SponsorBreakdown & {
  loan_interest_pence?: number | null;
  loan_repaid_pence?: number | null;
  loan_remaining_pence?: number | null;
  loan_total_owed_pence?: number | null;
  loan_due_date?: string | null;
  loan_repayment_terms?: string | null;
  is_loan_paid_off?: boolean | null;
  loan_paid_off_at?: string | null;
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

type SupplierFormState = {
  supplierName: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  category: string;
  notes: string;
  isActive: boolean;
};

type MoneyPageModalsProps = {
  sponsorFormOpen: boolean;
  editingSponsor: Sponsor | null;
  sponsorForm: SponsorFormState;
  setSponsorForm: Dispatch<SetStateAction<SponsorFormState>>;
  savingSponsor: boolean;
  onCloseSponsorForm: () => void;
  onSaveSponsor: () => Promise<void>;

  supplierFormOpen?: boolean;
  editingSupplier?: SupplierContact | null;
  supplierForm?: SupplierFormState;
  setSupplierForm?: Dispatch<SetStateAction<SupplierFormState>>;
  savingSupplier?: boolean;
  onCloseSupplierForm?: () => void;
  onSaveSupplier?: () => Promise<void>;

  deleteSupplierId?: string | null;
  deletingSupplier?: boolean;
  setDeleteSupplierId?: Dispatch<SetStateAction<string | null>>;
  onDeleteSupplier?: () => Promise<void>;

  deleteYearOpen: boolean;
  selectedYear: string;
  yearTransactionsLength: number;
  deletingYear: boolean;
  deleteYearPassword: string;
  setDeleteYearPassword: Dispatch<SetStateAction<string>>;
  onCloseDeleteYear: () => void;
  onDeleteYear: () => Promise<void>;

  deleteSponsorId: string | null;
  deletingSponsor: boolean;
  setDeleteSponsorId: Dispatch<SetStateAction<string | null>>;
  onDeleteSponsor: () => Promise<void>;

  deleteId: string | null;
  deleting: boolean;
  setDeleteId: Dispatch<SetStateAction<string | null>>;
  onHidePayment: () => Promise<void>;

  deleteAllOpen: boolean;
  transactionsLength: number;
  deletingAll: boolean;
  deleteAllPassword: string;
  setDeleteAllPassword: Dispatch<SetStateAction<string>>;
  onCloseDeleteAll: () => void;
  onDeleteAll: () => Promise<void>;

  loanRepaymentSponsor: LoanActionFunding | null;
  loanRepaymentForm: LoanRepaymentFormState;
  setLoanRepaymentForm: Dispatch<SetStateAction<LoanRepaymentFormState>>;
  savingLoanRepayment: boolean;
  onCloseLoanRepayment: () => void;
  onSaveLoanRepayment: () => Promise<void>;

  loanInterestSponsor: LoanActionFunding | null;
  loanInterestForm: LoanInterestFormState;
  setLoanInterestForm: Dispatch<SetStateAction<LoanInterestFormState>>;
  savingLoanInterest: boolean;
  onCloseLoanInterest: () => void;
  onSaveLoanInterest: () => Promise<void>;
};

export default function MoneyPageModals({
  sponsorFormOpen,
  editingSponsor,
  sponsorForm,
  setSponsorForm,
  savingSponsor,
  onCloseSponsorForm,
  onSaveSponsor,

  supplierFormOpen = false,
  editingSupplier = null,
  supplierForm,
  setSupplierForm,
  savingSupplier = false,
  onCloseSupplierForm,
  onSaveSupplier,

  deleteSupplierId = null,
  deletingSupplier = false,
  setDeleteSupplierId,
  onDeleteSupplier,

  deleteYearOpen,
  selectedYear,
  yearTransactionsLength,
  deletingYear,
  deleteYearPassword,
  setDeleteYearPassword,
  onCloseDeleteYear,
  onDeleteYear,

  deleteSponsorId,
  deletingSponsor,
  setDeleteSponsorId,
  onDeleteSponsor,

  deleteId,
  deleting,
  setDeleteId,
  onHidePayment,

  deleteAllOpen,
  transactionsLength,
  deletingAll,
  deleteAllPassword,
  setDeleteAllPassword,
  onCloseDeleteAll,
  onDeleteAll,

  loanRepaymentSponsor,
  loanRepaymentForm,
  setLoanRepaymentForm,
  savingLoanRepayment,
  onCloseLoanRepayment,
  onSaveLoanRepayment,

  loanInterestSponsor,
  loanInterestForm,
  setLoanInterestForm,
  savingLoanInterest,
  onCloseLoanInterest,
  onSaveLoanInterest,
}: MoneyPageModalsProps) {
  return (
    <MoneyModals
      sponsorFormOpen={sponsorFormOpen}
      editingSponsor={editingSponsor}
      sponsorForm={sponsorForm}
      setSponsorForm={setSponsorForm}
      savingSponsor={savingSponsor}
      onCloseSponsorForm={onCloseSponsorForm}
      onSaveSponsor={onSaveSponsor}
      supplierFormOpen={supplierFormOpen}
      editingSupplier={editingSupplier}
      supplierForm={supplierForm}
      setSupplierForm={setSupplierForm}
      savingSupplier={savingSupplier}
      onCloseSupplierForm={onCloseSupplierForm}
      onSaveSupplier={onSaveSupplier}
      deleteSupplierId={deleteSupplierId}
      setDeleteSupplierId={setDeleteSupplierId}
      deletingSupplier={deletingSupplier}
      onCloseDeleteSupplier={() => setDeleteSupplierId?.(null)}
      onDeleteSupplier={onDeleteSupplier}
      deleteYearOpen={deleteYearOpen}
      selectedYear={selectedYear}
      yearTransactionsLength={yearTransactionsLength}
      deletingYear={deletingYear}
      deleteYearPassword={deleteYearPassword}
      setDeleteYearPassword={setDeleteYearPassword}
      onCloseDeleteYear={onCloseDeleteYear}
      onDeleteYear={onDeleteYear}
      deleteSponsorId={deleteSponsorId}
      deletingSponsor={deletingSponsor}
      onCloseDeleteSponsor={() => setDeleteSponsorId(null)}
      onDeleteSponsor={onDeleteSponsor}
      deleteId={deleteId}
      deleting={deleting}
      onCloseHidePayment={() => setDeleteId(null)}
      onHidePayment={onHidePayment}
      deleteAllOpen={deleteAllOpen}
      transactionsLength={transactionsLength}
      deletingAll={deletingAll}
      deleteAllPassword={deleteAllPassword}
      setDeleteAllPassword={setDeleteAllPassword}
      onCloseDeleteAll={onCloseDeleteAll}
      onDeleteAll={onDeleteAll}
      loanRepaymentSponsor={loanRepaymentSponsor}
      loanRepaymentForm={loanRepaymentForm}
      setLoanRepaymentForm={setLoanRepaymentForm}
      savingLoanRepayment={savingLoanRepayment}
      onCloseLoanRepayment={onCloseLoanRepayment}
      onSaveLoanRepayment={onSaveLoanRepayment}
      loanInterestSponsor={loanInterestSponsor}
      loanInterestForm={loanInterestForm}
      setLoanInterestForm={setLoanInterestForm}
      savingLoanInterest={savingLoanInterest}
      onCloseLoanInterest={onCloseLoanInterest}
      onSaveLoanInterest={onSaveLoanInterest}
    />
  );
}
