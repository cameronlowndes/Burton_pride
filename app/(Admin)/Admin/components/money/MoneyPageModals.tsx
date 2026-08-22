"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type SetStateAction,
} from "react";
import { Loader2, Trash2, X } from "lucide-react";

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

type AsyncAction = () => void | Promise<void>;

type MoneyPageModalsProps = {
  sponsorFormOpen: boolean;
  editingSponsor: Sponsor | null;
  sponsorForm: SponsorFormState;
  setSponsorForm: Dispatch<SetStateAction<SponsorFormState>>;
  savingSponsor: boolean;
  onCloseSponsorForm: () => void;
  onSaveSponsor: AsyncAction;

  supplierFormOpen?: boolean;
  editingSupplier?: SupplierContact | null;
  supplierForm?: SupplierFormState;
  setSupplierForm?: Dispatch<SetStateAction<SupplierFormState>>;
  savingSupplier?: boolean;
  onCloseSupplierForm?: () => void;
  onSaveSupplier?: AsyncAction;

  deleteSupplierId?: string | null;
  deletingSupplier?: boolean;
  setDeleteSupplierId?: Dispatch<SetStateAction<string | null>>;
  onDeleteSupplier?: AsyncAction;

  deleteYearOpen: boolean;
  selectedYear: string;
  yearTransactionsLength: number;
  deletingYear: boolean;
  deleteYearPassword: string;
  setDeleteYearPassword: Dispatch<SetStateAction<string>>;
  onCloseDeleteYear: () => void;
  onDeleteYear: AsyncAction;

  deleteSponsorId: string | null;
  deletingSponsor: boolean;
  setDeleteSponsorId: Dispatch<SetStateAction<string | null>>;
  onDeleteSponsor: AsyncAction;

  deleteId: string | null;
  deleting: boolean;
  setDeleteId: Dispatch<SetStateAction<string | null>>;
  onHidePayment: AsyncAction;

  deleteRefundId?: string | null;
  deleteRefundTitle?: string | null;
  deletingRefund?: boolean;
  setDeleteRefundId?: Dispatch<SetStateAction<string | null>>;
  onHideRefund?: AsyncAction;

  deleteAllOpen: boolean;
  transactionsLength: number;
  deletingAll: boolean;
  deleteAllPassword: string;
  setDeleteAllPassword: Dispatch<SetStateAction<string>>;
  onCloseDeleteAll: () => void;
  onDeleteAll: AsyncAction;

  loanRepaymentSponsor: LoanActionFunding | null;
  loanRepaymentForm: LoanRepaymentFormState;
  setLoanRepaymentForm: Dispatch<SetStateAction<LoanRepaymentFormState>>;
  savingLoanRepayment: boolean;
  onCloseLoanRepayment: () => void;
  onSaveLoanRepayment: AsyncAction;

  loanInterestSponsor: LoanActionFunding | null;
  loanInterestForm: LoanInterestFormState;
  setLoanInterestForm: Dispatch<SetStateAction<LoanInterestFormState>>;
  savingLoanInterest: boolean;
  onCloseLoanInterest: () => void;
  onSaveLoanInterest: AsyncAction;
};

type RefundSoftDeleteModalProps = {
  refundId?: string | null;
  refundTitle?: string | null;
  deleting?: boolean;
  onClose: () => void;
  onConfirm?: AsyncAction;
};

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");

  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (element) =>
      !element.hasAttribute("hidden") &&
      element.getAttribute("aria-hidden") !== "true",
  );
}

function RefundSoftDeleteModal({
  refundId,
  refundTitle,
  deleting = false,
  onClose,
  onConfirm,
}: RefundSoftDeleteModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const submittingRef = useRef(false);

  const open = Boolean(refundId);

  const safeClose = useCallback(() => {
    if (!deleting) {
      onClose();
    }
  }, [deleting, onClose]);

  useEffect(() => {
    if (!open) {
      submittingRef.current = false;
      return;
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        safeClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusableElements = getFocusableElements(dialogRef.current);

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [open, safeClose]);

  async function handleConfirm() {
    if (!onConfirm || deleting || submittingRef.current) {
      return;
    }

    submittingRef.current = true;

    try {
      await onConfirm();
    } finally {
      submittingRef.current = false;
    }
  }

  function handleBackdropMouseDown(
    event: React.MouseEvent<HTMLDivElement>,
  ) {
    if (event.target === event.currentTarget) {
      safeClose();
    }
  }

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" && event.target === event.currentTarget) {
      event.preventDefault();
    }
  }

  if (!open) {
    return null;
  }

  const cleanedTitle = String(refundTitle ?? "").trim();

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-black/75 px-4 py-6 backdrop-blur-sm"
      onMouseDown={handleBackdropMouseDown}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#10101f] shadow-2xl shadow-black/50 outline-none"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-500/10 text-rose-200">
              <Trash2 className="h-5 w-5" aria-hidden="true" />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wide text-rose-300">
                Refund Tracker
              </p>

              <h2
                id={titleId}
                className="mt-1 break-words text-lg font-black text-white"
              >
                Move refund to Deleted Refunds?
              </h2>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={safeClose}
            disabled={deleting}
            className="shrink-0 rounded-xl border border-white/10 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close refund deletion window"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="px-5 py-5">
          <p id={descriptionId} className="text-sm leading-6 text-white/70">
            Move{" "}
            <strong className="break-words text-white">
              {cleanedTitle || "this refund"}
            </strong>{" "}
            to Deleted Refunds?
          </p>

          <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
            This is a soft delete. The refund will stop affecting the available
            Burton Pride balance, but it can be restored later from the Deleted
            Refunds page.
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={safeClose}
              disabled={deleting}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Keep refund
            </button>

            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={deleting || !onConfirm}
              aria-busy={deleting}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-2 text-xs font-black text-white transition hover:bg-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? (
                <Loader2
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              )}

              {deleting ? "Moving refund..." : "Move to Deleted Refunds"}
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
  /*
   * Keep sponsor form actions stable while the parent Money page re-renders.
   *
   * This prevents MoneyModals from seeing a new onClose/onSave function
   * reference after every sponsor form keystroke.
   */
  const onCloseSponsorFormRef = useRef(onCloseSponsorForm);
  const onSaveSponsorRef = useRef(onSaveSponsor);

  useEffect(() => {
    onCloseSponsorFormRef.current = onCloseSponsorForm;
  }, [onCloseSponsorForm]);

  useEffect(() => {
    onSaveSponsorRef.current = onSaveSponsor;
  }, [onSaveSponsor]);

  const stableCloseSponsorForm = useCallback(() => {
    onCloseSponsorFormRef.current();
  }, []);

  const stableSaveSponsor = useCallback(async () => {
    await onSaveSponsorRef.current();
  }, []);

  const closeSupplierDelete = useCallback(() => {
    if (!deletingSupplier) {
      setDeleteSupplierId?.(null);
    }
  }, [deletingSupplier, setDeleteSupplierId]);

  const closeSponsorDelete = useCallback(() => {
    if (!deletingSponsor) {
      setDeleteSponsorId(null);
    }
  }, [deletingSponsor, setDeleteSponsorId]);

  const closePaymentDelete = useCallback(() => {
    if (!deleting) {
      setDeleteId(null);
    }
  }, [deleting, setDeleteId]);

  const closeRefundDelete = useCallback(() => {
    if (!deletingRefund) {
      setDeleteRefundId?.(null);
    }
  }, [deletingRefund, setDeleteRefundId]);

  return (
    <>
      <MoneyModals
        sponsorFormOpen={sponsorFormOpen}
        editingSponsor={editingSponsor}
        sponsorForm={sponsorForm}
        setSponsorForm={setSponsorForm}
        savingSponsor={savingSponsor}
        onCloseSponsorForm={stableCloseSponsorForm}
        onSaveSponsor={stableSaveSponsor}
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
        onCloseDeleteSupplier={closeSupplierDelete}
        onDeleteSupplier={onDeleteSupplier}
        deleteYearOpen={deleteYearOpen}
        selectedYear={selectedYear}
        yearTransactionsLength={Math.max(0, yearTransactionsLength)}
        deletingYear={deletingYear}
        deleteYearPassword={deleteYearPassword}
        setDeleteYearPassword={setDeleteYearPassword}
        onCloseDeleteYear={onCloseDeleteYear}
        onDeleteYear={onDeleteYear}
        deleteSponsorId={deleteSponsorId}
        deletingSponsor={deletingSponsor}
        onCloseDeleteSponsor={closeSponsorDelete}
        onDeleteSponsor={onDeleteSponsor}
        deleteId={deleteId}
        deleting={deleting}
        onCloseHidePayment={closePaymentDelete}
        onHidePayment={onHidePayment}
        deleteAllOpen={deleteAllOpen}
        transactionsLength={Math.max(0, transactionsLength)}
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
        onClose={closeRefundDelete}
        onConfirm={onHideRefund}
      />
    </>
  );
}
