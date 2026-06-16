"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
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

type ModalTone = "default" | "amber" | "cyan" | "orange" | "blue" | "red";

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

const loanRepaymentPaymentMethods = [
  "Bank Transfer",
  "Cash",
  "Card Machine",
  "PayPal",
  "Online Payment",
  "Other Types",
];

const toneClasses: Record<
  ModalTone,
  { ring: string; panel: string; button: string }
> = {
  default: {
    ring: "ring-white/10 focus:ring-white/30",
    panel: "border-white/10 bg-white/[0.04] text-white/70",
    button: "bg-white/10 text-white hover:bg-white/20",
  },
  amber: {
    ring: "ring-amber-300/20 focus:ring-amber-300/40",
    panel: "border-amber-300/20 bg-amber-500/10 text-amber-100",
    button: "bg-amber-500 text-black hover:bg-amber-400",
  },
  cyan: {
    ring: "ring-cyan-300/20 focus:ring-cyan-300/40",
    panel: "border-cyan-300/20 bg-cyan-500/10 text-cyan-100",
    button: "bg-cyan-500 text-black hover:bg-cyan-400",
  },
  orange: {
    ring: "ring-orange-300/20 focus:ring-orange-300/40",
    panel: "border-orange-300/20 bg-orange-500/10 text-orange-100",
    button: "bg-orange-500 text-black hover:bg-orange-400",
  },
  blue: {
    ring: "ring-blue-300/20 focus:ring-blue-300/40",
    panel: "border-blue-300/20 bg-blue-500/10 text-blue-100",
    button: "bg-blue-500 text-white hover:bg-blue-400",
  },
  red: {
    ring: "ring-red-300/20 focus:ring-red-300/40",
    panel: "border-red-300/20 bg-red-500/10 text-red-100",
    button: "bg-red-500 text-white hover:bg-red-400",
  },
};

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

function ModalShell({
  open,
  title,
  description,
  tone = "default",
  maxWidth = "max-w-lg",
  saving = false,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  tone?: ModalTone;
  maxWidth?: string;
  saving?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm">
      <section
        className={`max-h-[92vh] w-full ${maxWidth} overflow-y-auto rounded-3xl border border-white/10 bg-[#070716] p-4 text-white shadow-2xl sm:p-5`}
      >
        <header className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="break-words text-xl font-black text-white">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm leading-6 text-white/60">
                {description}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="shrink-0 rounded-xl bg-white/10 p-2 text-white/80 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={`Close ${title}`}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {children}
      </section>
    </div>
  );
}

function InfoBox({
  tone = "default",
  children,
}: {
  tone?: ModalTone;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 text-sm leading-6 ${toneClasses[tone].panel}`}
    >
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  tone = "default",
  type = "text",
  step,
  name,
  autoComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  tone?: ModalTone;
  type?: string;
  step?: string;
  name?: string;
  autoComplete?: string;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      type={type}
      step={step}
      name={name}
      autoComplete={autoComplete}
      className={`w-full rounded-xl bg-black/20 p-3 text-white outline-none ring-1 placeholder:text-white/35 ${toneClasses[tone].ring}`}
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  tone = "default",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  tone?: ModalTone;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={`min-h-24 w-full rounded-xl bg-black/20 p-3 text-white outline-none ring-1 placeholder:text-white/35 ${toneClasses[tone].ring}`}
    />
  );
}

function SelectInput({
  value,
  onChange,
  options,
  tone = "default",
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  tone?: ModalTone;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`w-full rounded-xl bg-black/20 p-3 font-bold text-white outline-none ring-1 ${toneClasses[tone].ring}`}
    >
      {options.map((option) => (
        <option
          key={option.value}
          className="bg-[#070716] text-white"
          value={option.value}
        >
          {option.label}
        </option>
      ))}
    </select>
  );
}

function ModalActions({
  cancelLabel = "Cancel",
  confirmLabel,
  savingLabel = "Saving...",
  saving = false,
  disabled = false,
  tone = "default",
  onCancel,
  onConfirm,
}: {
  cancelLabel?: string;
  confirmLabel: string;
  savingLabel?: string;
  saving?: boolean;
  disabled?: boolean;
  tone?: ModalTone;
  onCancel: () => void;
  onConfirm?: () => void | Promise<void>;
}) {
  return (
    <div className="flex flex-col justify-end gap-3 sm:flex-row">
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {cancelLabel}
      </button>

      <button
        type="button"
        onClick={onConfirm}
        disabled={saving || disabled || !onConfirm}
        className={`rounded-xl px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${toneClasses[tone].button}`}
      >
        {saving ? savingLabel : confirmLabel}
      </button>
    </div>
  );
}

function FundingModal({
  open,
  editingSponsor,
  sponsorForm,
  setSponsorForm,
  savingSponsor,
  onClose,
  onSave,
}: {
  open: boolean;
  editingSponsor: Sponsor | null;
  sponsorForm: SponsorFormState;
  setSponsorForm: Dispatch<SetStateAction<SponsorFormState>>;
  savingSponsor: boolean;
  onClose: () => void;
  onSave: () => void | Promise<void>;
}) {
  const activeFundingType = sponsorForm.fundingType || "sponsor";
  const activeFundingLabel = fundingTypeLabel(activeFundingType);
  const isLoan = activeFundingType === "loan";

  return (
    <ModalShell
      open={open}
      title={editingSponsor ? "Edit Funding" : "Add Funding"}
      description={
        editingSponsor
          ? "Update this funding record, agreed amount and received money."
          : "Add a sponsor, grant, loan or other restricted funding record."
      }
      saving={savingSponsor}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-bold text-white/80">
            Funding type
          </label>
          <SelectInput
            value={activeFundingType}
            tone="amber"
            onChange={(value) =>
              setSponsorForm((prev) => ({
                ...prev,
                fundingType: value as FundingType,
                loanMonthlyPayment:
                  value === "loan" ? prev.loanMonthlyPayment : "",
                loanInterestType:
                  value === "loan" ? prev.loanInterestType || "none" : "none",
                loanInterestAmount:
                  value === "loan" ? prev.loanInterestAmount : "",
                loanDueDate: value === "loan" ? prev.loanDueDate : "",
                loanRepaymentTerms:
                  value === "loan" ? prev.loanRepaymentTerms : "",
              }))
            }
            options={[
              { value: "sponsor", label: "Sponsor" },
              { value: "grant", label: "Grant Money" },
              { value: "loan", label: "Loan" },
              { value: "other", label: "Other" },
            ]}
          />
        </div>

        <TextInput
          value={sponsorForm.sponsorName}
          onChange={(value) =>
            setSponsorForm((prev) => ({ ...prev, sponsorName: value }))
          }
          placeholder={fundingNamePlaceholder(activeFundingType)}
        />

        <TextInput
          value={sponsorForm.contactName}
          onChange={(value) =>
            setSponsorForm((prev) => ({ ...prev, contactName: value }))
          }
          placeholder="Contact name"
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput
            value={sponsorForm.email}
            onChange={(value) =>
              setSponsorForm((prev) => ({ ...prev, email: value }))
            }
            placeholder="Email"
            type="email"
          />

          <TextInput
            value={sponsorForm.phone}
            onChange={(value) =>
              setSponsorForm((prev) => ({ ...prev, phone: value }))
            }
            placeholder="Phone"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput
            value={sponsorForm.agreedAmount}
            onChange={(value) =>
              setSponsorForm((prev) => ({ ...prev, agreedAmount: value }))
            }
            placeholder={agreedAmountPlaceholder(activeFundingType)}
            type="number"
            step="0.01"
          />

          <TextInput
            value={sponsorForm.receivedAmount}
            onChange={(value) =>
              setSponsorForm((prev) => ({ ...prev, receivedAmount: value }))
            }
            placeholder={receivedAmountPlaceholder(activeFundingType)}
            tone="amber"
            type="number"
            step="0.01"
          />
        </div>

        {isLoan ? (
          <LoanSetupFields
            sponsorForm={sponsorForm}
            setSponsorForm={setSponsorForm}
          />
        ) : null}

        <TextArea
          value={sponsorForm.notes}
          onChange={(value) =>
            setSponsorForm((prev) => ({ ...prev, notes: value }))
          }
          placeholder={notesPlaceholder(activeFundingType)}
        />

        <InfoBox tone="amber">
          {isLoan ? (
            <>
              This will be saved as <strong>Loan</strong>. Loan amount and
              interest show what is owed. Money paid back should be recorded
              later using <strong>Record loan repayment</strong>.
            </>
          ) : (
            <>
              This will be saved as <strong>{activeFundingLabel}</strong>. You
              can track money received, money spent and remaining balance in the
              funding breakdown.
            </>
          )}
        </InfoBox>

        <button
          type="button"
          disabled={savingSponsor}
          onClick={onSave}
          className="w-full rounded-xl bg-amber-500 px-4 py-3 font-bold text-black hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
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
    </ModalShell>
  );
}

function LoanSetupFields({
  sponsorForm,
  setSponsorForm,
}: {
  sponsorForm: SponsorFormState;
  setSponsorForm: Dispatch<SetStateAction<SponsorFormState>>;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-blue-300/20 bg-blue-500/10 p-4">
      <InfoBox tone="blue">
        <strong>Loan setup:</strong> add the loan amount, planned monthly
        payment, any lender interest and the due date. Money paid back must be
        added later using
        <strong> Record loan repayment</strong>.
      </InfoBox>

      <div>
        <label className="mb-2 block text-sm font-bold text-blue-100">
          Planned monthly repayment amount
        </label>
        <TextInput
          value={sponsorForm.loanMonthlyPayment}
          onChange={(value) =>
            setSponsorForm((prev) => ({ ...prev, loanMonthlyPayment: value }))
          }
          placeholder="Example: 120.01"
          tone="blue"
          type="number"
          step="0.01"
        />
        <p className="mt-2 text-xs leading-5 text-blue-100/70">
          This is the payment plan only. It does not count as paid back until
          you use Record loan repayment.
        </p>
      </div>

      <div>
        <label className="mb-2 block text-sm font-bold text-blue-100">
          Is the lender adding interest?
        </label>
        <SelectInput
          value={sponsorForm.loanInterestType}
          tone="blue"
          onChange={(value) =>
            setSponsorForm((prev) => ({
              ...prev,
              loanInterestType: value as "none" | "fixed" | "percentage",
              loanInterestAmount:
                value === "none" ? "" : prev.loanInterestAmount,
            }))
          }
          options={[
            { value: "none", label: "No interest added" },
            { value: "fixed", label: "Yes - fixed interest added on top" },
            {
              value: "percentage",
              label: "Yes - percentage interest added on top",
            },
          ]}
        />
      </div>

      {sponsorForm.loanInterestType !== "none" ? (
        <div>
          <label className="mb-2 block text-sm font-bold text-blue-100">
            {sponsorForm.loanInterestType === "percentage"
              ? "Interest percentage added by lender"
              : "Interest charge added by lender"}
          </label>
          <TextInput
            value={sponsorForm.loanInterestAmount}
            onChange={(value) =>
              setSponsorForm((prev) => ({ ...prev, loanInterestAmount: value }))
            }
            placeholder={
              sponsorForm.loanInterestType === "percentage"
                ? "Example: 10 means 10% extra owed"
                : "Example: 200 means £200 extra interest added"
            }
            tone="blue"
            type="number"
            step="0.01"
          />
          <div className="mt-3 space-y-3">
            <InfoBox tone="orange">
              Only use this if the lender is charging extra interest on top of
              the loan. Do not use this box for repayments.
            </InfoBox>
            <InfoBox tone="amber">
              This interest will be added to the total loan owed. For example, a
              £1,300 loan with £200 interest will show as £1,500 owed.
            </InfoBox>
          </div>
        </div>
      ) : null}

      <div>
        <label className="mb-2 block text-sm font-bold text-blue-100">
          Loan due date
        </label>
        <TextInput
          type="date"
          value={sponsorForm.loanDueDate}
          tone="blue"
          onChange={(value) =>
            setSponsorForm((prev) => ({ ...prev, loanDueDate: value }))
          }
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-bold text-blue-100">
          Repayment terms
        </label>
        <TextArea
          value={sponsorForm.loanRepaymentTerms}
          tone="blue"
          onChange={(value) =>
            setSponsorForm((prev) => ({ ...prev, loanRepaymentTerms: value }))
          }
          placeholder="Example: Planned repayment is £120.01 per month. Full loan must be paid by the due date."
        />
      </div>
    </div>
  );
}

function SupplierModal({
  open,
  editingSupplier,
  supplierForm,
  setSupplierForm,
  savingSupplier,
  onClose,
  onSave,
}: {
  open: boolean;
  editingSupplier: SupplierContact | null;
  supplierForm?: SupplierFormState;
  setSupplierForm?: Dispatch<SetStateAction<SupplierFormState>>;
  savingSupplier: boolean;
  onClose?: () => void;
  onSave?: () => void | Promise<void>;
}) {
  if (!supplierForm) return null;

  return (
    <ModalShell
      open={open}
      title={
        editingSupplier ? "Edit Supplier / Contact" : "Add Supplier / Contact"
      }
      description="Store regular suppliers, venues, insurance providers, entertainers, food vendors and other contacts."
      tone="cyan"
      saving={savingSupplier}
      onClose={() => onClose?.()}
    >
      <div className="space-y-4">
        <TextInput
          value={supplierForm.supplierName}
          onChange={(value) =>
            setSupplierForm?.((prev) => ({ ...prev, supplierName: value }))
          }
          placeholder="Supplier / business name, e.g. Local Printer"
          tone="cyan"
        />

        <TextInput
          value={supplierForm.contactName}
          onChange={(value) =>
            setSupplierForm?.((prev) => ({ ...prev, contactName: value }))
          }
          placeholder="Contact name"
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput
            value={supplierForm.email}
            onChange={(value) =>
              setSupplierForm?.((prev) => ({ ...prev, email: value }))
            }
            placeholder="Email"
            type="email"
          />
          <TextInput
            value={supplierForm.phone}
            onChange={(value) =>
              setSupplierForm?.((prev) => ({ ...prev, phone: value }))
            }
            placeholder="Phone"
          />
        </div>

        <TextInput
          value={supplierForm.website}
          onChange={(value) =>
            setSupplierForm?.((prev) => ({ ...prev, website: value }))
          }
          placeholder="Website"
        />

        <SupplierCategoryField
          supplierForm={supplierForm}
          setSupplierForm={setSupplierForm}
        />

        <TextArea
          value={supplierForm.notes}
          onChange={(value) =>
            setSupplierForm?.((prev) => ({ ...prev, notes: value }))
          }
          placeholder="Notes, e.g. quote details, usual service, payment terms, or contact history"
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
              Turn this off to archive the supplier while keeping old linked
              transactions safe.
            </span>
          </span>
        </label>

        <InfoBox tone="cyan">
          This supplier can be linked to transactions so you can search, filter
          and report payments by regular contacts.
        </InfoBox>

        <ModalActions
          tone="cyan"
          saving={savingSupplier}
          confirmLabel={editingSupplier ? "Update Supplier" : "Save Supplier"}
          savingLabel={editingSupplier ? "Updating..." : "Saving..."}
          disabled={!supplierForm.supplierName.trim()}
          onCancel={() => onClose?.()}
          onConfirm={onSave}
        />
      </div>
    </ModalShell>
  );
}

function SupplierCategoryField({
  supplierForm,
  setSupplierForm,
}: {
  supplierForm: SupplierFormState;
  setSupplierForm?: Dispatch<SetStateAction<SupplierFormState>>;
}) {
  const showCustomCategory =
    isCustomSupplierCategory(supplierForm.category) ||
    supplierForm.category === "";

  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-white/80">
        Supplier category
      </label>
      <SelectInput
        value={
          isCustomSupplierCategory(supplierForm.category)
            ? "__custom__"
            : supplierForm.category
        }
        tone="cyan"
        onChange={(value) =>
          setSupplierForm?.((prev) => ({
            ...prev,
            category: value === "__custom__" ? "" : value,
          }))
        }
        options={[
          { value: "", label: "Choose category..." },
          ...supplierCategoryOptions.map((category) => ({
            value: category,
            label: category,
          })),
          { value: "__custom__", label: "Custom category..." },
        ]}
      />

      {showCustomCategory ? (
        <div className="mt-3">
          <label className="mb-2 block text-xs font-bold text-cyan-100/80">
            Custom category
          </label>
          <TextInput
            value={
              isCustomSupplierCategory(supplierForm.category)
                ? supplierForm.category
                : ""
            }
            onChange={(value) =>
              setSupplierForm?.((prev) => ({ ...prev, category: value }))
            }
            placeholder="Type your own category, e.g. Signage, First Aid, Toilets"
            tone="cyan"
          />
          <p className="mt-2 rounded-xl bg-black/20 px-3 py-2 text-xs leading-5 text-cyan-100/70">
            Type a new category here if it is not listed above. It will be saved
            against this supplier.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function LoanRepaymentModal({
  sponsor,
  form,
  setForm,
  saving,
  onClose,
  onSave,
}: {
  sponsor: LoanActionFunding | null;
  form: LoanRepaymentFormState;
  setForm: Dispatch<SetStateAction<LoanRepaymentFormState>>;
  saving: boolean;
  onClose: () => void;
  onSave: () => void | Promise<void>;
}) {
  return (
    <ModalShell
      open={Boolean(sponsor)}
      title="Record loan repayment"
      description={
        <>
          Record money paid back to <strong>{sponsor?.sponsor_name}</strong>.
        </>
      }
      tone="orange"
      saving={saving}
      onClose={onClose}
    >
      <div className="space-y-4">
        <InfoBox tone="orange">
          Use this form only when Burton Pride has actually paid money back to
          the lender. This reduces the amount still to repay.
        </InfoBox>

        <TextInput
          value={form.amount}
          onChange={(value) => setForm((prev) => ({ ...prev, amount: value }))}
          placeholder="Amount paid back, e.g. 200"
          type="number"
          step="0.01"
          tone="orange"
        />

        <SelectInput
          value={form.paymentMethod}
          tone="orange"
          onChange={(value) =>
            setForm((prev) => ({ ...prev, paymentMethod: value }))
          }
          options={loanRepaymentPaymentMethods.map((method) => ({
            value: method,
            label: method,
          }))}
        />

        <TextInput
          type="date"
          value={form.transactionDate}
          onChange={(value) =>
            setForm((prev) => ({ ...prev, transactionDate: value }))
          }
          tone="orange"
        />

        <TextArea
          value={form.note}
          onChange={(value) => setForm((prev) => ({ ...prev, note: value }))}
          placeholder="Note, e.g. first repayment / monthly loan repayment"
          tone="orange"
        />

        <InfoBox tone="orange">
          This will be saved as an expense and linked to the loan.
        </InfoBox>

        <ModalActions
          tone="orange"
          saving={saving}
          confirmLabel="Save Repayment"
          savingLabel="Saving..."
          onCancel={onClose}
          onConfirm={onSave}
        />
      </div>
    </ModalShell>
  );
}

function LoanInterestModal({
  sponsor,
  form,
  setForm,
  saving,
  onClose,
  onSave,
}: {
  sponsor: LoanActionFunding | null;
  form: LoanInterestFormState;
  setForm: Dispatch<SetStateAction<LoanInterestFormState>>;
  saving: boolean;
  onClose: () => void;
  onSave: () => void | Promise<void>;
}) {
  return (
    <ModalShell
      open={Boolean(sponsor)}
      title="Add lender interest"
      description={
        <>
          Add extra interest charged by <strong>{sponsor?.sponsor_name}</strong>
          .
        </>
      }
      tone="blue"
      saving={saving}
      onClose={onClose}
    >
      <div className="space-y-4">
        <InfoBox tone="blue">
          Use this only for extra interest or charges added by the lender. Do
          not use this for money Burton Pride has paid back.
        </InfoBox>

        <TextInput
          value={form.amount}
          onChange={(value) => setForm((prev) => ({ ...prev, amount: value }))}
          placeholder="Interest charged by lender, e.g. 25"
          type="number"
          step="0.01"
          tone="blue"
        />

        <TextInput
          type="date"
          value={form.transactionDate}
          onChange={(value) =>
            setForm((prev) => ({ ...prev, transactionDate: value }))
          }
          tone="blue"
        />

        <TextArea
          value={form.note}
          onChange={(value) => setForm((prev) => ({ ...prev, note: value }))}
          placeholder="Note, e.g. lender added interest charge"
          tone="blue"
        />

        <InfoBox tone="blue">
          This will increase the total amount owed on the loan.
        </InfoBox>

        <ModalActions
          tone="blue"
          saving={saving}
          confirmLabel="Save Lender Interest"
          savingLabel="Saving..."
          onCancel={onClose}
          onConfirm={onSave}
        />
      </div>
    </ModalShell>
  );
}

function ConfirmModal({
  open,
  title,
  message,
  warning,
  confirmLabel,
  savingLabel = "Working...",
  password,
  passwordLabel,
  passwordName,
  setPassword,
  count,
  saving = false,
  tone = "red",
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  warning?: ReactNode;
  confirmLabel: string;
  savingLabel?: string;
  password?: string;
  passwordLabel?: string;
  passwordName?: string;
  setPassword?: Dispatch<SetStateAction<string>>;
  count?: number;
  saving?: boolean;
  tone?: ModalTone;
  onClose: () => void;
  onConfirm?: () => void | Promise<void>;
}) {
  const needsPassword = Boolean(setPassword);
  const disabled = needsPassword ? !String(password || "").trim() : false;

  return (
    <ModalShell
      open={open}
      title={title}
      saving={saving}
      onClose={onClose}
      maxWidth="max-w-md"
    >
      <div className="space-y-5">
        <p className="text-sm leading-6 text-white/70">{message}</p>

        {warning ? <InfoBox tone={tone}>{warning}</InfoBox> : null}

        {count !== undefined ? (
          <p className="rounded-xl bg-black/20 px-3 py-2 text-xs font-bold text-white/55">
            Records affected: <span className="text-white">{count}</span>
          </p>
        ) : null}

        {needsPassword ? (
          <div>
            <label className="block text-sm font-bold text-white/80">
              {passwordLabel}
            </label>
            <TextInput
              type="password"
              value={password || ""}
              onChange={(value) => setPassword?.(value)}
              placeholder="Enter main admin delete password"
              name={passwordName}
              autoComplete="new-password"
              tone={tone}
            />
          </div>
        ) : null}

        <ModalActions
          tone={tone}
          saving={saving}
          disabled={disabled}
          confirmLabel={confirmLabel}
          savingLabel={savingLabel}
          onCancel={onClose}
          onConfirm={onConfirm}
        />
      </div>
    </ModalShell>
  );
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
  return (
    <>
      <FundingModal
        open={sponsorFormOpen}
        editingSponsor={editingSponsor}
        sponsorForm={sponsorForm}
        setSponsorForm={setSponsorForm}
        savingSponsor={savingSponsor}
        onClose={onCloseSponsorForm}
        onSave={onSaveSponsor}
      />

      <SupplierModal
        open={supplierFormOpen}
        editingSupplier={editingSupplier}
        supplierForm={supplierForm}
        setSupplierForm={setSupplierForm}
        savingSupplier={savingSupplier}
        onClose={onCloseSupplierForm}
        onSave={onSaveSupplier}
      />

      <LoanRepaymentModal
        sponsor={loanRepaymentSponsor}
        form={loanRepaymentForm}
        setForm={setLoanRepaymentForm}
        saving={savingLoanRepayment}
        onClose={onCloseLoanRepayment}
        onSave={onSaveLoanRepayment}
      />

      <LoanInterestModal
        sponsor={loanInterestSponsor}
        form={loanInterestForm}
        setForm={setLoanInterestForm}
        saving={savingLoanInterest}
        onClose={onCloseLoanInterest}
        onSave={onSaveLoanInterest}
      />

      <ConfirmModal
        open={deleteYearOpen}
        title={`Delete ${selectedYear} transactions?`}
        message={`This will only delete transactions dated between January and December ${selectedYear}. Other years will stay safe.`}
        warning={
          <>
            This will delete {yearTransactionsLength} transaction
            {yearTransactionsLength === 1 ? "" : "s"} from {selectedYear}.
          </>
        }
        count={yearTransactionsLength}
        password={deleteYearPassword}
        passwordLabel="Main admin delete password"
        passwordName="money-delete-year-password"
        setPassword={setDeleteYearPassword}
        saving={deletingYear}
        tone="orange"
        confirmLabel={`Delete ${selectedYear}`}
        savingLabel="Deleting..."
        onClose={onCloseDeleteYear}
        onConfirm={onDeleteYear}
      />

      <ConfirmModal
        open={Boolean(deleteSponsorId)}
        title="Delete funding record?"
        message="Existing transactions will stay in your money tracker, but the funding link will be removed from those transactions."
        warning="Export your Excel report first if you need to keep a full funding breakdown before deleting."
        saving={deletingSponsor}
        tone="red"
        confirmLabel="Delete Funding"
        savingLabel="Deleting..."
        onClose={onCloseDeleteSponsor}
        onConfirm={onDeleteSponsor}
      />

      <ConfirmModal
        open={Boolean(deleteSupplierId)}
        title="Archive supplier?"
        message="This will archive the supplier/contact so it will no longer show as active. Existing linked transactions will stay in the money tracker."
        warning="This is a safe archive action. It does not delete old payment history."
        saving={deletingSupplier}
        tone="cyan"
        confirmLabel="Archive Supplier"
        savingLabel="Archiving..."
        onClose={onCloseDeleteSupplier || (() => setDeleteSupplierId?.(null))}
        onConfirm={onDeleteSupplier}
      />

      <ConfirmModal
        open={Boolean(deleteId)}
        title="Hide payment?"
        message="This will soft delete the transaction and hide it from the money tracker, totals, Excel exports and print reports."
        warning="This will not permanently remove the transaction from Supabase. It will only mark it as deleted."
        saving={deleting}
        tone="red"
        confirmLabel="Hide Payment"
        savingLabel="Hiding..."
        onClose={onCloseHidePayment}
        onConfirm={onHidePayment}
      />

      <ConfirmModal
        open={deleteAllOpen}
        title="Delete all transactions?"
        message="This will delete all money in, money out, manual transactions, synced donation entries and funding-linked transactions. This cannot be undone."
        warning={
          <>
            This will delete every transaction in the database. There are
            currently {transactionsLength} total transaction
            {transactionsLength === 1 ? "" : "s"} saved.
          </>
        }
        count={transactionsLength}
        password={deleteAllPassword}
        passwordLabel="Main admin delete password"
        passwordName="money-delete-all-password"
        setPassword={setDeleteAllPassword}
        saving={deletingAll}
        tone="red"
        confirmLabel="Delete Everything"
        savingLabel="Deleting..."
        onClose={onCloseDeleteAll}
        onConfirm={onDeleteAll}
      />
    </>
  );
}
