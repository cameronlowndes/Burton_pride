"use client";

import type { Dispatch, SetStateAction } from "react";
import { X } from "lucide-react";

import type {
  FundingType,
  LoanInterestFormState,
  LoanRepaymentFormState,
  Sponsor,
  SponsorBreakdown,
  SponsorFormState,
} from "@/lib/money/types";

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

type MoneyModalsProps = {
  sponsorFormOpen: boolean;
  editingSponsor: Sponsor | null;
  sponsorForm: SponsorFormState;
  setSponsorForm: Dispatch<SetStateAction<SponsorFormState>>;
  savingSponsor: boolean;
  onCloseSponsorForm: () => void;
  onSaveSponsor: () => void | Promise<void>;

  /**
   * Supplier / contact tracker.
   * Used for regular suppliers such as printers, venues, insurance,
   * entertainers, food vendors, security, equipment hire, and custom contacts.
   */
  supplierFormOpen?: boolean;
  editingSupplier?: SupplierContact | null;
  supplierForm?: SupplierFormState;
  setSupplierForm?: Dispatch<SetStateAction<SupplierFormState>>;
  savingSupplier?: boolean;
  onCloseSupplierForm?: () => void;
  onSaveSupplier?: () => void | Promise<void>;

  deleteSupplierId?: string | null;
  setDeleteSupplierId?: Dispatch<SetStateAction<string | null>>;
  deletingSupplier?: boolean;
  onCloseDeleteSupplier?: () => void;
  onDeleteSupplier?: () => void | Promise<void>;

  deleteYearOpen: boolean;
  selectedYear: string;
  yearTransactionsLength: number;
  deletingYear: boolean;
  deleteYearPassword: string;
  setDeleteYearPassword: Dispatch<SetStateAction<string>>;
  onCloseDeleteYear: () => void;
  onDeleteYear: () => void | Promise<void>;

  deleteSponsorId: string | null;
  deletingSponsor: boolean;
  onCloseDeleteSponsor: () => void;
  onDeleteSponsor: () => void | Promise<void>;

  deleteId: string | null;
  deleting: boolean;
  onCloseHidePayment: () => void;
  onHidePayment: () => void | Promise<void>;

  deleteAllOpen: boolean;
  transactionsLength: number;
  deletingAll: boolean;
  deleteAllPassword: string;
  setDeleteAllPassword: Dispatch<SetStateAction<string>>;
  onCloseDeleteAll: () => void;
  onDeleteAll: () => void | Promise<void>;

  loanRepaymentSponsor: LoanActionFunding | null;
  loanRepaymentForm: LoanRepaymentFormState;
  setLoanRepaymentForm: Dispatch<SetStateAction<LoanRepaymentFormState>>;
  savingLoanRepayment: boolean;
  onCloseLoanRepayment: () => void;
  onSaveLoanRepayment: () => void | Promise<void>;

  loanInterestSponsor: LoanActionFunding | null;
  loanInterestForm: LoanInterestFormState;
  setLoanInterestForm: Dispatch<SetStateAction<LoanInterestFormState>>;
  savingLoanInterest: boolean;
  onCloseLoanInterest: () => void;
  onSaveLoanInterest: () => void | Promise<void>;
};

const supplierCategoryOptions = [
  "Printer",
  "Venue",
  "Insurance",
  "Entertainer",
  "Food Vendor",
  "Security",
  "Equipment Hire",
  "Marketing",
  "Accessibility",
  "Transport",
  "Other",
];

function isCustomSupplierCategory(category?: string | null) {
  const cleanCategory = String(category || "").trim();

  if (!cleanCategory) return false;

  return !supplierCategoryOptions.some(
    (option) => option.toLowerCase() === cleanCategory.toLowerCase(),
  );
}

function fundingTypeLabel(type: FundingType) {
  if (type === "grant") return "Grant Money";
  if (type === "loan") return "Loan";
  if (type === "other") return "Other Funding";
  return "Sponsor";
}

function fundingNamePlaceholder(type: FundingType) {
  if (type === "grant") return "Grant / funder name";
  if (type === "loan") return "Loan provider name";
  if (type === "other") return "Funding name";
  return "Sponsor name";
}

function agreedAmountPlaceholder(type: FundingType) {
  if (type === "grant") return "Awarded grant amount, e.g. 1300";
  if (type === "loan") return "Loan amount, e.g. 1300";
  if (type === "other") return "Agreed funding amount, e.g. 1300";
  return "Agreed sponsorship amount, e.g. 1300";
}

function receivedAmountPlaceholder(type: FundingType) {
  if (type === "grant") return "Received grant money, e.g. 1300";
  if (type === "loan") return "Received loan money, e.g. 1300";
  if (type === "other") return "Received funding money, e.g. 1300";
  return "Received sponsorship money, e.g. 1300";
}

function notesPlaceholder(type: FundingType) {
  if (type === "grant") return "Grant notes / agreed use / restrictions";
  if (type === "loan") return "Loan notes / extra notes / restrictions";
  if (type === "other") return "Funding notes / agreed use / restrictions";
  return "Notes / agreed use / restrictions";
}

export default function MoneyModals({
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
  setDeleteSupplierId,
  deletingSupplier = false,
  onCloseDeleteSupplier,
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
  onCloseDeleteSponsor,
  onDeleteSponsor,

  deleteId,
  deleting,
  onCloseHidePayment,
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
}: MoneyModalsProps) {
  const activeFundingType = sponsorForm.fundingType || "sponsor";
  const activeFundingLabel = fundingTypeLabel(activeFundingType);

  return (
    <>
      {sponsorFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm">
         <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-[#070716] p-4 text-white shadow-2xl sm:p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="break-words text-xl font-bold">
                  {editingSponsor ? "Edit Funding" : "Add Funding"}
                </h2>

                <p className="text-sm text-white/60">
                  {editingSponsor
                    ? "Update this funding record, agreed amount, and received money."
                    : "Add sponsor, grant money, loan, or other funding so income and spending can be tracked clearly."}
                </p>
              </div>

              <button
                type="button"
                onClick={onCloseSponsorForm}
                className="shrink-0 rounded-xl bg-white/10 p-2 hover:bg-white/20"
                aria-label="Close funding form"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-white/80">
                  Funding type
                </label>

                <select
                  value={activeFundingType}
                  onChange={(event) =>
                    setSponsorForm((prev) => ({
                      ...prev,
                      fundingType: event.target.value as FundingType,
                      loanMonthlyPayment:
                        event.target.value === "loan"
                          ? prev.loanMonthlyPayment
                          : "",
                      loanInterestType:
                        event.target.value === "loan"
                          ? prev.loanInterestType || "none"
                          : "none",
                      loanInterestAmount:
                        event.target.value === "loan"
                          ? prev.loanInterestAmount
                          : "",
                      loanDueDate:
                        event.target.value === "loan" ? prev.loanDueDate : "",
                      loanRepaymentTerms:
                        event.target.value === "loan"
                          ? prev.loanRepaymentTerms
                          : "",
                    }))
                  }
                  className="w-full rounded-xl bg-black/20 p-3 font-bold text-white outline-none ring-1 ring-amber-300/20 focus:ring-amber-300/40"
                >
                  <option className="bg-[#070716] text-white" value="sponsor">
                    Sponsor
                  </option>
                  <option className="bg-[#070716] text-white" value="grant">
                    Grant Money
                  </option>
                  <option className="bg-[#070716] text-white" value="loan">
                    Loan
                  </option>
                  <option className="bg-[#070716] text-white" value="other">
                    Other
                  </option>
                </select>
              </div>

              <input
                value={sponsorForm.sponsorName}
                onChange={(event) =>
                  setSponsorForm((prev) => ({
                    ...prev,
                    sponsorName: event.target.value,
                  }))
                }
                placeholder={fundingNamePlaceholder(activeFundingType)}
                className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10"
              />

              <input
                value={sponsorForm.contactName}
                onChange={(event) =>
                  setSponsorForm((prev) => ({
                    ...prev,
                    contactName: event.target.value,
                  }))
                }
                placeholder="Contact name"
                className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10"
              />

              <input
                value={sponsorForm.email}
                onChange={(event) =>
                  setSponsorForm((prev) => ({
                    ...prev,
                    email: event.target.value,
                  }))
                }
                placeholder="Email"
                className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10"
              />

              <input
                value={sponsorForm.phone}
                onChange={(event) =>
                  setSponsorForm((prev) => ({
                    ...prev,
                    phone: event.target.value,
                  }))
                }
                placeholder="Phone"
                className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10"
              />

              <input
                value={sponsorForm.agreedAmount}
                onChange={(event) =>
                  setSponsorForm((prev) => ({
                    ...prev,
                    agreedAmount: event.target.value,
                  }))
                }
                placeholder={agreedAmountPlaceholder(activeFundingType)}
                type="number"
                step="0.01"
                className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10"
              />

              <input
                value={sponsorForm.receivedAmount}
                onChange={(event) =>
                  setSponsorForm((prev) => ({
                    ...prev,
                    receivedAmount: event.target.value,
                  }))
                }
                placeholder={receivedAmountPlaceholder(activeFundingType)}
                type="number"
                step="0.01"
                className="w-full rounded-xl bg-emerald-500/10 p-3 outline-none ring-1 ring-emerald-300/20 focus:ring-emerald-300/40"
              />

              {activeFundingType === "loan" && (
                <div className="space-y-4 rounded-2xl border border-blue-300/20 bg-blue-500/10 p-4">
                  <div className="rounded-2xl border border-blue-300/20 bg-black/20 p-4 text-sm leading-6 text-blue-100">
                    <strong>Loan setup:</strong> add the loan amount, planned
                    monthly payment, any lender interest, and the due date. Money
                    you have actually paid back must be added later using{" "}
                    <strong>Record loan repayment</strong>.
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-blue-100">
                      Planned monthly repayment amount
                    </label>

                    <input
                      value={sponsorForm.loanMonthlyPayment}
                      onChange={(event) =>
                        setSponsorForm((prev) => ({
                          ...prev,
                          loanMonthlyPayment: event.target.value,
                        }))
                      }
                      placeholder="Example: 120.01"
                      type="number"
                      step="0.01"
                      className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-blue-300/20 focus:ring-blue-300/40"
                    />

                    <p className="mt-2 text-xs leading-5 text-blue-100/70">
                      This is the payment plan only. It does not count as paid
                      back until you use “Record loan repayment”.
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-blue-100">
                      Is the lender adding interest?
                    </label>

                    <select
                      value={sponsorForm.loanInterestType}
                      onChange={(event) =>
                        setSponsorForm((prev) => ({
                          ...prev,
                          loanInterestType: event.target.value as
                            | "none"
                            | "fixed"
                            | "percentage",
                          loanInterestAmount:
                            event.target.value === "none"
                              ? ""
                              : prev.loanInterestAmount,
                        }))
                      }
                      className="w-full rounded-xl bg-black/20 p-3 font-bold text-white outline-none ring-1 ring-blue-300/20 focus:ring-blue-300/40"
                    >
                      <option className="bg-[#070716] text-white" value="none">
                        No interest added
                      </option>

                      <option className="bg-[#070716] text-white" value="fixed">
                        Yes - fixed interest added on top
                      </option>

                      <option
                        className="bg-[#070716] text-white"
                        value="percentage"
                      >
                        Yes - percentage interest added on top
                      </option>
                    </select>

                    <p className="mt-2 text-xs leading-5 text-blue-100/70">
                      Interest is only extra money charged by the lender. Do not
                      use this for repayments.
                    </p>
                  </div>

                  {sponsorForm.loanInterestType !== "none" && (
                    <div>
                      <label className="mb-2 block text-sm font-bold text-blue-100">
                        {sponsorForm.loanInterestType === "percentage"
                          ? "Interest percentage added by lender"
                          : "Interest charge added by lender"}
                      </label>

                      <input
                        value={sponsorForm.loanInterestAmount}
                        onChange={(event) =>
                          setSponsorForm((prev) => ({
                            ...prev,
                            loanInterestAmount: event.target.value,
                          }))
                        }
                        placeholder={
                          sponsorForm.loanInterestType === "percentage"
                            ? "Example: 10 means 10% extra owed"
                            : "Example: 200 means £200 extra interest added"
                        }
                        type="number"
                        step="0.01"
                        className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-blue-300/20 focus:ring-blue-300/40"
                      />

                      <div className="mt-3 rounded-xl border border-orange-300/20 bg-orange-500/10 p-3 text-xs leading-5 text-orange-100">
                        Only use this if the lender is charging extra interest
                        on top of the loan. Do not use this box for repayments.
                        Repayments should be added using the “Record loan
                        repayment” button after saving the loan.
                      </div>

                      <div className="mt-3 rounded-xl border border-yellow-300/20 bg-yellow-500/10 p-3 text-xs leading-5 text-yellow-100">
                        This interest will be added to the total loan owed. For
                        example, a £1,300 loan with £200 interest will show as
                        £1,500 owed.
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="mb-2 block text-sm font-bold text-blue-100">
                      Loan due date
                    </label>

                    <input
                      type="date"
                      value={sponsorForm.loanDueDate}
                      onChange={(event) =>
                        setSponsorForm((prev) => ({
                          ...prev,
                          loanDueDate: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-blue-300/20 focus:ring-blue-300/40"
                    />

                    <p className="mt-2 text-xs leading-5 text-blue-100/70">
                      The date the loan should be fully paid back by.
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-blue-100">
                      Repayment terms
                    </label>

                    <textarea
                      value={sponsorForm.loanRepaymentTerms}
                      onChange={(event) =>
                        setSponsorForm((prev) => ({
                          ...prev,
                          loanRepaymentTerms: event.target.value,
                        }))
                      }
                      placeholder="Example: Planned repayment is £120.01 per month. Full loan must be paid by the due date."
                      className="min-h-24 w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-blue-300/20 focus:ring-blue-300/40"
                    />
                  </div>
                </div>
              )}

              <textarea
                value={sponsorForm.notes}
                onChange={(event) =>
                  setSponsorForm((prev) => ({
                    ...prev,
                    notes: event.target.value,
                  }))
                }
                placeholder={notesPlaceholder(activeFundingType)}
                className="min-h-24 w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10"
              />

              <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                {activeFundingType === "loan" ? (
                  <>
                    This will be saved as <strong>Loan</strong>. Loan amount and
                    interest show what is owed. Money paid back should be
                    recorded later using <strong>Record loan repayment</strong>.
                  </>
                ) : (
                  <>
                    This will be saved as{" "}
                    <strong>{activeFundingLabel}</strong>. You can track money
                    received, money spent, and remaining balance in the funding
                    breakdown.
                  </>
                )}
              </div>

              <button
                type="button"
                disabled={savingSponsor}
                onClick={onSaveSponsor}
                className="w-full rounded-xl bg-amber-500 px-4 py-3 font-bold text-black hover:bg-amber-400 disabled:opacity-60"
              >
                {savingSponsor
                  ? editingSponsor
                    ? "Updating..."
                    : "Saving..."
                  : editingSponsor
                    ? "Update Funding"
                    : "Save Funding"}
              </button>
            </div>
          </div>
        </div>
      )}


      {supplierFormOpen && supplierForm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-cyan-300/20 bg-[#070716] p-4 text-white shadow-2xl sm:p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="break-words text-xl font-bold">
                  {editingSupplier ? "Edit Supplier / Contact" : "Add Supplier / Contact"}
                </h2>

                <p className="text-sm leading-6 text-white/60">
                  Store regular suppliers such as printers, venues, insurance
                  providers, entertainers, food vendors, security, equipment
                  hire, or custom contacts, then link payments to them.
                </p>
              </div>

              <button
                type="button"
                onClick={onCloseSupplierForm}
                disabled={savingSupplier}
                className="shrink-0 rounded-xl bg-white/10 p-2 hover:bg-white/20 disabled:opacity-60"
                aria-label="Close supplier form"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <input
                value={supplierForm.supplierName}
                onChange={(event) =>
                  setSupplierForm?.((prev) => ({
                    ...prev,
                    supplierName: event.target.value,
                  }))
                }
                placeholder="Supplier / business name, e.g. Local Printer"
                className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-cyan-300/20 placeholder:text-white/35 focus:ring-cyan-300/40"
              />

              <input
                value={supplierForm.contactName}
                onChange={(event) =>
                  setSupplierForm?.((prev) => ({
                    ...prev,
                    contactName: event.target.value,
                  }))
                }
                placeholder="Contact name"
                className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-cyan-300/40"
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={supplierForm.email}
                  onChange={(event) =>
                    setSupplierForm?.((prev) => ({
                      ...prev,
                      email: event.target.value,
                    }))
                  }
                  placeholder="Email"
                  type="email"
                  className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-cyan-300/40"
                />

                <input
                  value={supplierForm.phone}
                  onChange={(event) =>
                    setSupplierForm?.((prev) => ({
                      ...prev,
                      phone: event.target.value,
                    }))
                  }
                  placeholder="Phone"
                  className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-cyan-300/40"
                />
              </div>

              <input
                value={supplierForm.website}
                onChange={(event) =>
                  setSupplierForm?.((prev) => ({
                    ...prev,
                    website: event.target.value,
                  }))
                }
                placeholder="Website"
                className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-cyan-300/40"
              />

              <div>
                <label className="mb-2 block text-sm font-bold text-white/80">
                  Supplier category
                </label>

                <select
                  value={
                    isCustomSupplierCategory(supplierForm.category)
                      ? "__custom__"
                      : supplierForm.category
                  }
                  onChange={(event) => {
                    const nextValue = event.target.value;

                    setSupplierForm?.((prev) => ({
                      ...prev,
                      category: nextValue === "__custom__" ? "" : nextValue,
                    }));
                  }}
                  className="w-full rounded-xl bg-black/20 p-3 font-bold text-white outline-none ring-1 ring-cyan-300/20 focus:ring-cyan-300/40"
                >
                  <option className="bg-[#070716] text-white" value="">
                    Choose category...
                  </option>

                  {supplierCategoryOptions.map((category) => (
                    <option
                      key={category}
                      className="bg-[#070716] text-white"
                      value={category}
                    >
                      {category}
                    </option>
                  ))}

                  <option className="bg-[#070716] text-white" value="__custom__">
                    Custom category...
                  </option>
                </select>

                {(isCustomSupplierCategory(supplierForm.category) ||
                  supplierForm.category === "") && (
                  <div className="mt-3">
                    <label className="mb-2 block text-xs font-bold text-cyan-100/80">
                      Custom category
                    </label>

                    <input
                      value={
                        isCustomSupplierCategory(supplierForm.category)
                          ? supplierForm.category
                          : ""
                      }
                      onChange={(event) =>
                        setSupplierForm?.((prev) => ({
                          ...prev,
                          category: event.target.value,
                        }))
                      }
                      placeholder="Type your own category, e.g. Signage, First Aid, Toilets"
                      className="w-full rounded-xl bg-black/20 p-3 text-white outline-none ring-1 ring-cyan-300/20 placeholder:text-white/35 focus:ring-cyan-300/40"
                    />

                    <p className="mt-2 rounded-xl bg-black/20 px-3 py-2 text-xs leading-5 text-cyan-100/70">
                      Type a new category here if it is not listed above. It
                      will be saved against this supplier and can be used for
                      reports and searching.
                    </p>
                  </div>
                )}
              </div>

              <textarea
                value={supplierForm.notes}
                onChange={(event) =>
                  setSupplierForm?.((prev) => ({
                    ...prev,
                    notes: event.target.value,
                  }))
                }
                placeholder="Notes, e.g. quote details, usual service, payment terms, or contact history"
                className="min-h-24 w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-cyan-300/40"
              />

              <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <input
                  type="checkbox"
                  checked={supplierForm.isActive}
                  onChange={(event) =>
                    setSupplierForm?.((prev) => ({
                      ...prev,
                      isActive: event.target.checked,
                    }))
                  }
                  className="mt-1 h-4 w-4 rounded border-white/20"
                />

                <span>
                  <span className="block text-sm font-bold text-white">
                    Active supplier
                  </span>

                  <span className="block text-xs leading-5 text-white/50">
                    Turn this off to archive the supplier while keeping old
                    linked transactions safe.
                  </span>
                </span>
              </label>

              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4 text-sm leading-6 text-cyan-100">
                This supplier can be linked to transactions so you can search,
                filter and report payments by regular contacts.
              </div>

              <div className="flex flex-col justify-end gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={onCloseSupplierForm}
                  disabled={savingSupplier}
                  className="rounded-xl bg-white/10 px-4 py-3 text-sm font-bold hover:bg-white/20 disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={onSaveSupplier}
                  disabled={
                    savingSupplier ||
                    !supplierForm.supplierName.trim() ||
                    !onSaveSupplier
                  }
                  className="rounded-xl bg-cyan-500 px-4 py-3 text-sm font-bold text-black hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingSupplier
                    ? editingSupplier
                      ? "Updating..."
                      : "Saving..."
                    : editingSupplier
                      ? "Update Supplier"
                      : "Save Supplier"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loanRepaymentSponsor && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-orange-300/20 bg-[#070716] p-6 text-white shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="break-words text-xl font-bold">
                  Record loan repayment
                </h2>

                <p className="text-sm text-white/60">
                  Record money paid back to{" "}
                  <strong>{loanRepaymentSponsor.sponsor_name}</strong>.
                </p>
              </div>

              <button
                type="button"
                onClick={onCloseLoanRepayment}
                disabled={savingLoanRepayment}
                className="shrink-0 rounded-xl bg-white/10 p-2 hover:bg-white/20 disabled:opacity-60"
                aria-label="Close loan repayment form"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-orange-300/20 bg-orange-500/10 p-4 text-sm leading-6 text-orange-100">
                Use this form only when Burton Pride has actually paid money
                back to the lender. This reduces the amount still to repay.
              </div>

              <input
                value={loanRepaymentForm.amount}
                onChange={(event) =>
                  setLoanRepaymentForm((prev) => ({
                    ...prev,
                    amount: event.target.value,
                  }))
                }
                placeholder="Amount paid back, e.g. 200"
                type="number"
                step="0.01"
                className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-orange-300/20 focus:ring-orange-300/40"
              />

              <select
                value={loanRepaymentForm.paymentMethod}
                onChange={(event) =>
                  setLoanRepaymentForm((prev) => ({
                    ...prev,
                    paymentMethod: event.target.value,
                  }))
                }
                className="w-full rounded-xl bg-black/20 p-3 font-bold text-white outline-none ring-1 ring-orange-300/20 focus:ring-orange-300/40"
              >
                <option className="bg-[#070716] text-white" value="Bank Transfer">
                  Bank Transfer
                </option>
                <option className="bg-[#070716] text-white" value="Cash">
                  Cash
                </option>
                <option className="bg-[#070716] text-white" value="Card Machine">
                  Card Machine
                </option>
                <option className="bg-[#070716] text-white" value="PayPal">
                  PayPal
                </option>
                <option className="bg-[#070716] text-white" value="Online Payment">
                  Online Payment
                </option>
                <option className="bg-[#070716] text-white" value="Other Types">
                  Other Types
                </option>
              </select>

              <input
                type="date"
                value={loanRepaymentForm.transactionDate}
                onChange={(event) =>
                  setLoanRepaymentForm((prev) => ({
                    ...prev,
                    transactionDate: event.target.value,
                  }))
                }
                className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-orange-300/20 focus:ring-orange-300/40"
              />

              <textarea
                value={loanRepaymentForm.note}
                onChange={(event) =>
                  setLoanRepaymentForm((prev) => ({
                    ...prev,
                    note: event.target.value,
                  }))
                }
                placeholder="Note, e.g. first repayment / monthly loan repayment"
                className="min-h-24 w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-orange-300/20 focus:ring-orange-300/40"
              />

              <div className="rounded-2xl border border-orange-300/20 bg-orange-500/10 p-4 text-sm text-orange-100">
                This will be saved as an expense and linked to the loan.
              </div>

              <div className="flex flex-col justify-end gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={onCloseLoanRepayment}
                  disabled={savingLoanRepayment}
                  className="rounded-xl bg-white/10 px-4 py-3 text-sm font-bold hover:bg-white/20 disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={onSaveLoanRepayment}
                  disabled={savingLoanRepayment}
                  className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-black hover:bg-orange-400 disabled:opacity-60"
                >
                  {savingLoanRepayment ? "Saving..." : "Save Repayment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loanInterestSponsor && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-blue-300/20 bg-[#070716] p-6 text-white shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="break-words text-xl font-bold">
                  Add lender interest
                </h2>

                <p className="text-sm text-white/60">
                  Add extra interest charged by{" "}
                  <strong>{loanInterestSponsor.sponsor_name}</strong>.
                </p>
              </div>

              <button
                type="button"
                onClick={onCloseLoanInterest}
                disabled={savingLoanInterest}
                className="shrink-0 rounded-xl bg-white/10 p-2 hover:bg-white/20 disabled:opacity-60"
                aria-label="Close loan interest form"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-blue-300/20 bg-blue-500/10 p-4 text-sm leading-6 text-blue-100">
                Use this only for extra interest or charges added by the lender.
                Do not use this for money Burton Pride has paid back.
              </div>

              <input
                value={loanInterestForm.amount}
                onChange={(event) =>
                  setLoanInterestForm((prev) => ({
                    ...prev,
                    amount: event.target.value,
                  }))
                }
                placeholder="Interest charged by lender, e.g. 25"
                type="number"
                step="0.01"
                className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-blue-300/20 focus:ring-blue-300/40"
              />

              <input
                type="date"
                value={loanInterestForm.transactionDate}
                onChange={(event) =>
                  setLoanInterestForm((prev) => ({
                    ...prev,
                    transactionDate: event.target.value,
                  }))
                }
                className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-blue-300/20 focus:ring-blue-300/40"
              />

              <textarea
                value={loanInterestForm.note}
                onChange={(event) =>
                  setLoanInterestForm((prev) => ({
                    ...prev,
                    note: event.target.value,
                  }))
                }
                placeholder="Note, e.g. lender added interest charge"
                className="min-h-24 w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-blue-300/20 focus:ring-blue-300/40"
              />

              <div className="rounded-2xl border border-blue-300/20 bg-blue-500/10 p-4 text-sm text-blue-100">
                This will increase the total amount owed on the loan.
              </div>

              <div className="flex flex-col justify-end gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={onCloseLoanInterest}
                  disabled={savingLoanInterest}
                  className="rounded-xl bg-white/10 px-4 py-3 text-sm font-bold hover:bg-white/20 disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={onSaveLoanInterest}
                  disabled={savingLoanInterest}
                  className="rounded-xl bg-blue-500 px-4 py-3 text-sm font-bold text-white hover:bg-blue-400 disabled:opacity-60"
                >
                  {savingLoanInterest ? "Saving..." : "Save Lender Interest"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteYearOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#070716] p-6 text-white shadow-2xl">
            <h2 className="break-words text-xl font-bold">
              Delete {selectedYear} transactions?
            </h2>

            <p className="mt-3 text-sm text-white/70">
              This will only delete transactions dated between January and
              December {selectedYear}. Other years will stay safe.
            </p>

            <div className="mt-5 rounded-2xl border border-orange-400/20 bg-orange-500/10 p-4 text-sm text-orange-100">
              This will delete {yearTransactionsLength} transaction
              {yearTransactionsLength === 1 ? "" : "s"} from {selectedYear}.
            </div>

            <label className="mt-5 block text-sm font-bold text-white/80">
              Main admin delete password
            </label>

            <input
              type="password"
              value={deleteYearPassword}
              onChange={(event) => setDeleteYearPassword(event.target.value)}
              placeholder="Enter main admin delete password"
              autoComplete="new-password"
              name="money-delete-year-password"
              className="mt-2 w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/40 focus:ring-orange-300/40"
            />

            <div className="mt-6 flex flex-col justify-end gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onCloseDeleteYear}
                disabled={deletingYear}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={onDeleteYear}
                disabled={deletingYear || !deleteYearPassword.trim()}
                className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingYear ? "Deleting..." : `Delete ${selectedYear}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteSponsorId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#070716] p-6 text-white shadow-2xl">
            <h2 className="text-xl font-bold">Delete funding record?</h2>

            <p className="mt-3 text-sm text-white/70">
              Are you sure you want to delete this funding record? Existing
              transactions will stay in your money tracker, but the funding link
              will be removed from those transactions.
            </p>

            <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm text-amber-100">
              Export your Excel report first if you need to keep a full funding
              breakdown before deleting.
            </div>

            <div className="mt-6 flex flex-col justify-end gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onCloseDeleteSponsor}
                disabled={deletingSponsor}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={onDeleteSponsor}
                disabled={deletingSponsor}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-400 disabled:opacity-60"
              >
                {deletingSponsor ? "Deleting..." : "Delete Funding"}
              </button>
            </div>
          </div>
        </div>
      )}


      {deleteSupplierId && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#070716] p-6 text-white shadow-2xl">
            <h2 className="text-xl font-bold">Archive supplier?</h2>

            <p className="mt-3 text-sm leading-6 text-white/70">
              This will archive the supplier/contact so it will no longer show
              as active. Existing linked transactions will stay in the money
              tracker.
            </p>

            <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4 text-sm leading-6 text-cyan-100">
              This is a safe archive action. It does not delete old payment
              history.
            </div>

            <div className="mt-6 flex flex-col justify-end gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onCloseDeleteSupplier || (() => setDeleteSupplierId?.(null))}
                disabled={deletingSupplier}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={onDeleteSupplier}
                disabled={deletingSupplier || !onDeleteSupplier}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-400 disabled:opacity-60"
              >
                {deletingSupplier ? "Archiving..." : "Archive Supplier"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#070716] p-6 text-white shadow-2xl">
            <h2 className="text-xl font-bold">Hide payment?</h2>

            <p className="mt-3 text-sm text-white/70">
              Are you sure you want to hide this transaction? It will be soft
              deleted and hidden from the money tracker, totals, Excel exports,
              and print reports.
            </p>

            <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
              This will not permanently remove the transaction from Supabase. It
              will only mark it as deleted and hide it from this page.
            </div>

            <div className="mt-6 flex flex-col justify-end gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onCloseHidePayment}
                disabled={deleting}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={onHidePayment}
                disabled={deleting}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-400 disabled:opacity-60"
              >
                {deleting ? "Hiding..." : "Hide Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteAllOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#070716] p-6 text-white shadow-2xl">
            <h2 className="text-xl font-bold">Delete all transactions?</h2>

            <p className="mt-3 text-sm text-white/70">
              Are you sure you want to delete every transaction? This will delete
              all money in, money out, manual transactions, synced donation
              entries, and funding-linked transactions. This cannot be undone.
            </p>

            <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
              This will delete every transaction in the database. There are
              currently {transactionsLength} total transaction
              {transactionsLength === 1 ? "" : "s"} saved.
            </div>

            <label className="mt-5 block text-sm font-bold text-white/80">
              Main admin delete password
            </label>

            <input
              type="password"
              value={deleteAllPassword}
              onChange={(event) => setDeleteAllPassword(event.target.value)}
              placeholder="Enter main admin delete password"
              autoComplete="new-password"
              name="money-delete-all-password"
              className="mt-2 w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/40 focus:ring-red-300/40"
            />

            <div className="mt-6 flex flex-col justify-end gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onCloseDeleteAll}
                disabled={deletingAll}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={onDeleteAll}
                disabled={deletingAll || !deleteAllPassword.trim()}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingAll ? "Deleting..." : "Delete Everything"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}