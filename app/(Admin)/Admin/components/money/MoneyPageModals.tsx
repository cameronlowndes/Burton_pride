"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";

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

  /**
   * Optional refund soft-delete popup.
   *
   * These props allow the main Tracking Money table to open a matching
   * custom popup when a refund row is moved to Deleted Refunds.
   *
   * They are optional so the page will continue compiling before the
   * refund wiring is added to useMoneyTransactionsPage.ts.
   */
  deleteRefundId?: string | null;
  deleteRefundTitle?: string | null;
  deletingRefund?: boolean;
  setDeleteRefundId?: Dispatch<SetStateAction<string | null>>;
  onHideRefund?: () => Promise<void>;

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

function RefundSoftDeleteModal({
  refundId,
  refundTitle,
  deleting,
  onClose,
  onConfirm,
}: {
  refundId: string | null;
  refundTitle: string | null;
  deleting: boolean;
  onClose: () => void;
  onConfirm?: () => Promise<void>;
}) {
  if (!refundId) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm">
      <section className="w-full max-w-lg overflow-hidden rounded-[22px] border border-white/10 bg-[#10101f] shadow-2xl shadow-black/50">
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-500/10 text-rose-200">
              <Trash2 className="h-5 w-5" />
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-rose-300">
                Refund Tracker
              </p>

              <h2 className="mt-1 text-lg font-bold text-white">
                Move refund to Deleted Refunds?
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close refund deletion popup"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="px-5 py-5">
          <p className="text-sm leading-6 text-slate-300">
            Move{" "}
            <span className="font-bold text-white">
              {refundTitle || "this refund"}
            </span>{" "}
            to Deleted Refunds?
          </p>

          <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
            This is a soft delete. The refund will stop affecting the
            available Burton Pride balance, but it can be restored later
            from the Deleted Refunds page.
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Keep Refund
            </button>

            <button
              type="button"
              onClick={() => void onConfirm?.()}
              disabled={deleting || !onConfirm}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RotateCcw
                className={`h-4 w-4 ${
                  deleting ? "animate-spin" : ""
                }`}
              />

              {deleting
                ? "Moving Refund..."
                : "Move to Deleted Refunds"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

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

  deleteRefundId = null,
  deleteRefundTitle = null,
  deletingRefund = false,
  setDeleteRefundId,
  onHideRefund,

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
    <>
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

      <RefundSoftDeleteModal
        refundId={deleteRefundId}
        refundTitle={deleteRefundTitle}
        deleting={deletingRefund}
        onClose={() => setDeleteRefundId?.(null)}
        onConfirm={onHideRefund}
      />
    </>
  );
}