"use client";

import type { Dispatch, SetStateAction, SyntheticEvent } from "react";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  FileText,
  Loader2,
  Repeat,
  X,
} from "lucide-react";

import type {
  FinanceNoteStatus,
  FormState,
  FundingType,
  RepeatFrequency,
  Sponsor,
  Transaction,
} from "@/lib/money/types";

import {
  formatDate,
  getTransactionYear,
  repeatFrequencyLabel,
} from "@/lib/money/utils";

import { money } from "@/lib/money/helpers";

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
  loan_monthly_payment_pence?: number | null;
  loan_repaid_pence?: number | null;
  loan_remaining_pence?: number | null;
  loan_total_owed_pence?: number | null;
};

type DuplicateMatch = {
  id: string;
  created_at: string;
  title: string;
  description: string | null;
  type: "income" | "expense";
  category: string | null;
  amount_pence: number;
  payment_method: string | null;
  transaction_date: string | null;
  source: string | null;
  sponsor_name: string | null;
  personal_funds_name: string | null;
};

type BudgetItem = {
  id?: string | null;
  year?: string;
  category_key: string;
  category_label: string;
  planned_amount_pence?: number;
  notes?: string | null;
};

const defaultBudgetItems: BudgetItem[] = [
  { category_key: "venue", category_label: "Venue" },
  { category_key: "insurance", category_label: "Insurance" },
  { category_key: "printing", category_label: "Printing" },
  { category_key: "security", category_label: "Security" },
  { category_key: "performers", category_label: "Performers" },
  { category_key: "equipment", category_label: "Equipment" },
  { category_key: "accessibility", category_label: "Accessibility" },
  { category_key: "other", category_label: "Other costs" },
];

function getBudgetFormValue(form: FormState) {
  const item = form as FormState & {
    budgetCategory?: string | null;
    budgetCategoryKey?: string | null;
    budget_category?: string | null;
    budget_category_key?: string | null;
    costArea?: string | null;
    cost_area?: string | null;
  };

  return (
    item.budgetCategory ||
    item.budgetCategoryKey ||
    item.budget_category ||
    item.budget_category_key ||
    item.costArea ||
    item.cost_area ||
    ""
  );
}

type MoneyTransactionFormProps = {
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;

  invoiceFiles: File[];
  setInvoiceFiles: Dispatch<SetStateAction<File[]>>;

  editingTransaction: Transaction | null;
  saving: boolean;
  displaySponsors: Sponsor[];
  yearlySponsorBreakdown: YearlySponsorBreakdown[];
  budgetItems?: BudgetItem[];

  handleSubmit: (event: SyntheticEvent<HTMLFormElement>) => Promise<void>;
  cancelEditTransaction: () => void;
  fillTestTransaction: () => void;
  openNewSponsorForm: () => void;
};

const paymentMethods = [
  "Stripe",
  "Online Payment",
  "Cash",
  "Bank Transfer",
  "PayPal",
  "Card Machine",
  "Personal Funds",
  "Item Donation",
  "Other Types",
];

const loanRepaymentPaymentMethods = [
  "Bank Transfer",
  "Online Payment",
  "Cash",
  "Card Machine",
  "PayPal",
  "Other Types",
];

const loanTransactionModes = [
  {
    value: "Loan Repayment",
    label: "Pay back the loan",
    help: "Use this when Burton Pride has paid money back to the lender.",
  },
  {
    value: "Loan Spending",
    label: "Use loan money for spending",
    help: "Use this when Burton Pride is spending money that came from this loan.",
  },
];

const financeNoteOptions: {
  value: FinanceNoteStatus;
  label: string;
  help: string;
}[] = [
  {
    value: "none",
    label: "No query",
    help: "No finance query needed.",
  },
  {
    value: "waiting_for_receipt",
    label: "Waiting for receipt",
    help: "Use when proof, invoice, or receipt still needs to be collected.",
  },
  {
    value: "ask_sponsor",
    label: "Ask sponsor",
    help: "Use when you need to ask the sponsor/funder about this transaction.",
  },
  {
    value: "bank_query",
    label: "Bank query",
    help: "Use when something needs checking against the bank statement.",
  },
  {
    value: "resolved",
    label: "Resolved",
    help: "Use when the finance query has been dealt with.",
  },
];

function amountToPence(amount: string) {
  const cleanAmount = Number(amount || 0);

  if (!Number.isFinite(cleanAmount)) {
    return 0;
  }

  return Math.round(cleanAmount * 100);
}

function penceToPoundsInput(value: number | null | undefined) {
  const pence = Number(value || 0);

  if (!Number.isFinite(pence) || pence <= 0) {
    return "";
  }

  return (pence / 100).toFixed(2);
}

function fundingTypeLabel(type?: FundingType | string | null) {
  if (type === "grant") return "Grant Money";
  if (type === "loan") return "Loan";
  if (type === "other") return "Other Funding";
  return "Sponsor";
}

function fundingTypeShortLabel(type?: FundingType | string | null) {
  if (type === "grant") return "grant";
  if (type === "loan") return "loan";
  if (type === "other") return "funding";
  return "sponsor";
}

function getLoanMode(category: string | null | undefined) {
  return category === "Loan Spending" ? "Loan Spending" : "Loan Repayment";
}

function formatFileSize(size?: number | null) {
  if (!size || size <= 0) return "";

  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatDuplicateDate(value: string | null | undefined) {
  if (!value) return "No date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function MoneyTransactionForm({
  form,
  setForm,
  invoiceFiles,
  setInvoiceFiles,
  editingTransaction,
  saving,
  displaySponsors,
  yearlySponsorBreakdown,
  budgetItems = [],
  handleSubmit,
  cancelEditTransaction,
  fillTestTransaction,
  openNewSponsorForm,
}: MoneyTransactionFormProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const saveAnywayRef = useRef(false);
  const saveWithoutReceiptRef = useRef(false);
  const saveOverFundingLimitRef = useRef(false);

  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<
    DuplicateMatch[] | null
  >(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [missingReceiptWarningOpen, setMissingReceiptWarningOpen] =
    useState(false);
  const [fundingOverspendWarningOpen, setFundingOverspendWarningOpen] =
    useState(false);

  const selectedSponsorBreakdown = form.sponsorId
    ? yearlySponsorBreakdown.find(
        (sponsor) => sponsor.sponsor_id === form.sponsorId,
      )
    : null;

  const selectedFunding = form.sponsorId
    ? displaySponsors.find((sponsor) => sponsor.id === form.sponsorId) || null
    : null;

  const selectedFundingType =
    selectedSponsorBreakdown?.funding_type ||
    selectedFunding?.funding_type ||
    "sponsor";

  const isLoanFunding = selectedFundingType === "loan";
  const hasLinkedFunding = Boolean(form.sponsorId);
  const isItemDonation =
    !hasLinkedFunding && form.paymentMethod === "Item Donation";
  const budgetOptions =
    budgetItems.length > 0 ? budgetItems : defaultBudgetItems;
  const selectedBudgetCategory = getBudgetFormValue(form);
  const canManuallyLinkBudget = !isItemDonation;

  const loanMode = getLoanMode(form.category);
  const isLoanRepayment = isLoanFunding && loanMode === "Loan Repayment";
  const isLoanSpending = isLoanFunding && loanMode === "Loan Spending";

  const plannedLoanRepaymentPence =
    selectedSponsorBreakdown?.loan_monthly_payment_pence ??
    selectedFunding?.loan_monthly_payment_pence ??
    0;

  const plannedLoanRepaymentAmount = penceToPoundsInput(
    plannedLoanRepaymentPence,
  );

  const lockLoanRepaymentAmount =
    isLoanRepayment && plannedLoanRepaymentPence > 0;

  useEffect(() => {
    if (!lockLoanRepaymentAmount || !plannedLoanRepaymentAmount) {
      return;
    }

    setForm((prev) => {
      if (prev.amount === plannedLoanRepaymentAmount) {
        return prev;
      }

      return {
        ...prev,
        amount: plannedLoanRepaymentAmount,
      };
    });
  }, [lockLoanRepaymentAmount, plannedLoanRepaymentAmount, setForm]);

  const selectedFundingLabel = fundingTypeLabel(selectedFundingType);
  const selectedFundingShortLabel = fundingTypeShortLabel(selectedFundingType);

  const currentAmountPence = amountToPence(form.amount);

  const normalRemainingPence = selectedSponsorBreakdown?.remaining_pence ?? 0;
  const loanStillToRepayPence =
    selectedSponsorBreakdown?.loan_remaining_pence ?? normalRemainingPence;

  const balanceToCheckPence = isLoanRepayment
    ? loanStillToRepayPence
    : normalRemainingPence;

  const overSpendPence =
    form.sponsorId && currentAmountPence > balanceToCheckPence
      ? currentAmountPence - balanceToCheckPence
      : 0;

  const existingAttachments = editingTransaction?.attachments || [];

  const hasExistingReceipt =
    existingAttachments.length > 0 ||
    Boolean(editingTransaction?.invoice_image_url);

  const needsReceiptWarning = invoiceFiles.length === 0 && !hasExistingReceipt;

  const selectedFinanceNoteOption =
    financeNoteOptions.find(
      (option) => option.value === form.financeNoteStatus,
    ) || financeNoteOptions[0];

  async function checkDuplicateBeforeSave() {
    const paymentMethod = form.sponsorId
      ? isLoanRepayment
        ? form.paymentMethod || "Bank Transfer"
        : isLoanSpending
          ? "Loan Money"
          : "Sponsorship Money"
      : form.paymentMethod;

    if (
      !form.title.trim() ||
      !form.transactionDate ||
      !paymentMethod ||
      currentAmountPence <= 0
    ) {
      return {
        duplicate: false,
        matches: [],
      };
    }

    setCheckingDuplicate(true);
    setDuplicateError(null);

    try {
      const response = await fetch(
        "/api/admin/money/transactions/duplicate-check",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: form.title,
            transaction_date: form.transactionDate,
            amount_pence: currentAmountPence,
            payment_method: paymentMethod,
            ignore_id: editingTransaction?.id || null,
          }),
        },
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to check duplicates.");
      }

      return {
        duplicate: Boolean(payload?.duplicate),
        matches: Array.isArray(payload?.matches) ? payload.matches : [],
      };
    } finally {
      setCheckingDuplicate(false);
    }
  }

  async function handleFormSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    setDuplicateWarning(null);
    setDuplicateError(null);

    if (!saveAnywayRef.current) {
      try {
        const duplicateCheck = await checkDuplicateBeforeSave();

        if (duplicateCheck.duplicate) {
          setDuplicateWarning(duplicateCheck.matches);
          return;
        }
      } catch (error: any) {
        setDuplicateError(
          error?.message || "Could not check for duplicate transactions.",
        );
        return;
      }
    }

    if (
      !saveOverFundingLimitRef.current &&
      form.sponsorId &&
      overSpendPence > 0
    ) {
      setFundingOverspendWarningOpen(true);
      return;
    }

    if (!saveWithoutReceiptRef.current && needsReceiptWarning) {
      setMissingReceiptWarningOpen(true);
      return;
    }

    saveAnywayRef.current = false;
    saveWithoutReceiptRef.current = false;
    saveOverFundingLimitRef.current = false;
    setMissingReceiptWarningOpen(false);
    setFundingOverspendWarningOpen(false);

    await handleSubmit(event);
  }

  function saveAnyway() {
    saveAnywayRef.current = true;
    setDuplicateWarning(null);
    setDuplicateError(null);

    setTimeout(() => {
      formRef.current?.requestSubmit();
    }, 0);
  }

  function saveWithoutReceipt() {
    saveWithoutReceiptRef.current = true;
    setMissingReceiptWarningOpen(false);

    setTimeout(() => {
      formRef.current?.requestSubmit();
    }, 0);
  }

  function closeMissingReceiptPopup() {
    saveWithoutReceiptRef.current = false;
    setMissingReceiptWarningOpen(false);
  }

  function saveOverFundingLimit() {
    saveOverFundingLimitRef.current = true;
    setFundingOverspendWarningOpen(false);

    setTimeout(() => {
      formRef.current?.requestSubmit();
    }, 0);
  }

  function closeFundingOverspendPopup() {
    saveOverFundingLimitRef.current = false;
    setFundingOverspendWarningOpen(false);
  }

  function resetWarnings() {
    setDuplicateWarning(null);
    setDuplicateError(null);
    setMissingReceiptWarningOpen(false);
    setFundingOverspendWarningOpen(false);
  }

  return (
    <>
      <form
        ref={formRef}
        onSubmit={handleFormSubmit}
        className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-5"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold">
              {editingTransaction ? "Edit Transaction" : "Add Transaction"}
            </h2>

            {editingTransaction && (
              <p className="mt-1 break-words text-xs text-sky-200">
                Editing: {editingTransaction.title}
              </p>
            )}
          </div>

          <div className="flex shrink-0 gap-2">
            {editingTransaction && (
              <button
                type="button"
                onClick={cancelEditTransaction}
                className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/20"
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
            )}

            {!editingTransaction && (
              <button
                type="button"
                onClick={fillTestTransaction}
                className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/20"
              >
                Test
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <input
            value={form.title}
            onChange={(event) => {
              resetWarnings();

              setForm((prev) => ({
                ...prev,
                title: event.target.value,
              }));
            }}
            placeholder={
              isLoanFunding
                ? isLoanRepayment
                  ? "Title, e.g. Loan repayment"
                  : "Title, e.g. Spending from loan money"
                : "Title"
            }
            className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10 focus:ring-pink-300/40"
          />

          {hasLinkedFunding ? (
            <div
              className={`rounded-xl border p-3 text-sm ${
                isLoanFunding
                  ? "border-orange-300/20 bg-orange-500/10 text-orange-100"
                  : "border-red-300/20 bg-red-500/10 text-red-100"
              }`}
            >
              <p className="font-bold">Transaction type</p>

              <p className="mt-1 text-lg font-black text-white">
                {isLoanFunding
                  ? isLoanRepayment
                    ? "Loan Repayment"
                    : "Loan Spending"
                  : "Money Out"}
              </p>

              <p className="mt-1 text-xs text-white/70">
                {isLoanFunding
                  ? isLoanRepayment
                    ? "This records money Burton Pride has paid back to the lender. It reduces the amount still owed on this loan."
                    : "This records Burton Pride spending money that came from this loan. It does not count as paying the loan back."
                  : `This is locked because this transaction is spending from a linked ${selectedFundingShortLabel} record.`}
              </p>
            </div>
          ) : isItemDonation ? (
            <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">
              <p className="font-bold">Transaction type</p>

              <p className="mt-1 text-lg font-black text-white">
                Item Donation
              </p>

              <p className="mt-1 text-xs text-emerald-100/75">
                This records the estimated value of donated items only. It does
                not count as Burton Pride money in, money out, or cash balance.
              </p>
            </div>
          ) : (
            <select
              value={form.type}
              onChange={(event) => {
                resetWarnings();

                setForm((prev) => ({
                  ...prev,
                  type: event.target.value as "income" | "expense",
                  isPersonalFunds:
                    event.target.value === "income"
                      ? false
                      : prev.isPersonalFunds,
                  personalFundsName:
                    event.target.value === "income"
                      ? ""
                      : prev.personalFundsName,
                }));
              }}
              className="w-full rounded-xl bg-black/20 p-3 text-white outline-none ring-1 ring-white/10 focus:ring-pink-300/40"
            >
              <option className="bg-[#11111f] text-white" value="income">
                Money In
              </option>
              <option className="bg-[#11111f] text-white" value="expense">
                Money Out
              </option>
            </select>
          )}

          <div>
            <input
              value={
                lockLoanRepaymentAmount
                  ? plannedLoanRepaymentAmount
                  : form.amount
              }
              onChange={(event) => {
                if (lockLoanRepaymentAmount) {
                  return;
                }

                setDuplicateWarning(null);
                setDuplicateError(null);
                setFundingOverspendWarningOpen(false);
                saveOverFundingLimitRef.current = false;

                setForm((prev) => ({
                  ...prev,
                  amount: event.target.value,
                }));
              }}
              placeholder={
                isItemDonation
                  ? "Estimated item value"
                  : isLoanFunding
                    ? isLoanRepayment
                      ? plannedLoanRepaymentAmount
                        ? `Locked repayment amount: £${plannedLoanRepaymentAmount}`
                        : "Amount paid back to lender"
                      : "Amount spent from loan money"
                    : "Amount"
              }
              type="number"
              step="0.01"
              disabled={lockLoanRepaymentAmount}
              className={`w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10 focus:ring-pink-300/40 ${
                lockLoanRepaymentAmount
                  ? "cursor-not-allowed opacity-75 ring-orange-300/30"
                  : ""
              }`}
            />

            {lockLoanRepaymentAmount && (
              <p className="mt-2 rounded-xl border border-orange-300/20 bg-orange-500/10 px-3 py-2 text-xs leading-5 text-orange-100">
                This amount is locked to the planned monthly repayment of{" "}
                <strong>£{plannedLoanRepaymentAmount}</strong>. To pay a
                different amount, change the loan’s planned monthly repayment
                amount first.
              </p>
            )}

            {isLoanRepayment && !lockLoanRepaymentAmount && (
              <p className="mt-2 rounded-xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100">
                No planned monthly repayment amount is saved on this loan yet,
                so this repayment amount is editable.
              </p>
            )}

            {isItemDonation && (
              <p className="mt-2 rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-xs leading-5 text-emerald-100">
                This is the estimated value of the donated item only. It will
                not be counted as Burton Pride money in, money out, or cash
                balance.
              </p>
            )}
          </div>

          {isItemDonation ? (
            <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">
              <p className="font-black text-white">Item donation record</p>

              <p className="mt-1 text-xs leading-5 text-emerald-100/75">
                Use this for items given to Burton Pride, for example raffle
                prizes, equipment, supplies, or stock. The amount is only the
                estimated item value for records and reports.
              </p>

              <div className="mt-3 rounded-xl bg-black/20 px-3 py-2 text-xs leading-5 text-emerald-50">
                <p>
                  This will not be added to money in, money out, current
                  balance, year-end balance, monthly income, or monthly
                  spending.
                </p>
              </div>
            </div>
          ) : (
            <div
              className={`rounded-xl border p-3 ${
                isLoanFunding
                  ? "border-orange-300/20 bg-orange-500/10"
                  : "border-amber-300/20 bg-amber-500/10"
              }`}
            >
              <label
                className={`mb-1 block text-sm font-bold ${
                  isLoanFunding ? "text-orange-100" : "text-amber-100"
                }`}
              >
                {isLoanFunding
                  ? "Choose what this loan transaction is for"
                  : "Use restricted funding for this spending"}
              </label>

              <p
                className={`mb-2 text-xs ${
                  isLoanFunding ? "text-orange-100/75" : "text-amber-100/70"
                }`}
              >
                {isLoanFunding
                  ? "Choose whether this is money paid back to the lender, or spending using loan money."
                  : "Choose a sponsor, grant, loan or other funding record when this payment is being paid from restricted funding."}
              </p>

              {isLoanFunding && (
                <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {loanTransactionModes.map((mode) => {
                    const active = loanMode === mode.value;

                    return (
                      <button
                        key={mode.value}
                        type="button"
                        onClick={() => {
                          resetWarnings();

                          setForm((prev) => ({
                            ...prev,
                            category: mode.value,
                            amount:
                              mode.value === "Loan Repayment" &&
                              plannedLoanRepaymentAmount
                                ? plannedLoanRepaymentAmount
                                : mode.value === "Loan Spending" &&
                                    prev.amount === plannedLoanRepaymentAmount
                                  ? ""
                                  : prev.amount,
                            paymentMethod:
                              mode.value === "Loan Repayment"
                                ? prev.paymentMethod &&
                                  prev.paymentMethod !== "Sponsorship Money" &&
                                  prev.paymentMethod !== "Loan Money"
                                  ? prev.paymentMethod
                                  : "Bank Transfer"
                                : "Loan Money",
                            sponsorshipNote:
                              mode.value === "Loan Repayment"
                                ? prev.sponsorshipNote || "Loan repayment"
                                : prev.sponsorshipNote === "Loan repayment"
                                  ? ""
                                  : prev.sponsorshipNote,
                          }));
                        }}
                        className={`rounded-xl px-3 py-3 text-left text-sm font-black ring-1 ${
                          active
                            ? "bg-orange-500 text-black ring-orange-200/60"
                            : "bg-black/20 text-orange-100 ring-orange-300/20 hover:bg-orange-500/10"
                        }`}
                      >
                        <span className="block">{mode.label}</span>
                        <span
                          className={`mt-1 block text-xs font-normal ${
                            active ? "text-black/70" : "text-orange-100/65"
                          }`}
                        >
                          {mode.help}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <select
                value={form.sponsorId}
                onChange={(event) => {
                  resetWarnings();
                  saveOverFundingLimitRef.current = false;

                  const selected = displaySponsors.find(
                    (sponsor) => sponsor.id === event.target.value,
                  );

                  const selectedType = selected?.funding_type || "sponsor";
                  const selectedIsLoan = selectedType === "loan";

                  const selectedMonthlyRepaymentAmount = selectedIsLoan
                    ? penceToPoundsInput(selected?.loan_monthly_payment_pence)
                    : "";

                  setForm((prev) => ({
                    ...prev,
                    sponsorId: selected?.id || "",
                    sponsorName: selected?.sponsor_name || "",
                    type: selected ? "expense" : prev.type,
                    category: selected
                      ? selectedIsLoan
                        ? "Loan Repayment"
                        : "Sponsorship"
                      : "",
                    amount:
                      selectedIsLoan && selectedMonthlyRepaymentAmount
                        ? selectedMonthlyRepaymentAmount
                        : !selected
                          ? ""
                          : prev.amount,
                    paymentMethod: selected
                      ? selectedIsLoan
                        ? prev.paymentMethod &&
                          prev.paymentMethod !== "Sponsorship Money" &&
                          prev.paymentMethod !== "Loan Money"
                          ? prev.paymentMethod
                          : "Bank Transfer"
                        : "Sponsorship Money"
                      : prev.paymentMethod === "Sponsorship Money" ||
                          prev.paymentMethod === "Loan Money"
                        ? ""
                        : prev.paymentMethod,
                    isPersonalFunds: selected ? false : prev.isPersonalFunds,
                    personalFundsName: selected ? "" : prev.personalFundsName,
                    sponsorshipNote: selectedIsLoan
                      ? prev.sponsorshipNote || "Loan repayment"
                      : prev.sponsorshipNote,
                  }));
                }}
                className={`w-full rounded-xl bg-black/20 p-3 text-white outline-none ring-1 ${
                  isLoanFunding
                    ? "ring-orange-300/20 focus:ring-orange-300/40"
                    : "ring-white/10 focus:ring-amber-300/40"
                }`}
              >
                <option className="bg-[#11111f] text-white" value="">
                  Choose funding record...
                </option>

                {displaySponsors.map((sponsor) => (
                  <option
                    key={sponsor.id}
                    value={sponsor.id}
                    className="bg-[#11111f] text-white"
                  >
                    {fundingTypeLabel(sponsor.funding_type)} —{" "}
                    {sponsor.sponsor_name}
                  </option>
                ))}
              </select>

              {form.sponsorId && selectedSponsorBreakdown && (
                <div
                  className={`mt-3 rounded-xl border bg-black/20 p-3 text-xs ${
                    isLoanFunding
                      ? "border-orange-300/20 text-orange-100"
                      : "border-amber-300/20 text-amber-100"
                  }`}
                >
                  <div className="flex justify-between gap-3">
                    <span>Funding type</span>
                    <strong>{selectedFundingLabel}</strong>
                  </div>

                  {isLoanFunding ? (
                    <>
                      <div className="mt-1 flex justify-between gap-3">
                        <span>Loan received</span>
                        <strong>
                          {money(selectedSponsorBreakdown.received_pence)}
                        </strong>
                      </div>

                      <div className="mt-1 flex justify-between gap-3">
                        <span>Still to repay</span>
                        <strong>{money(loanStillToRepayPence)}</strong>
                      </div>

                      <div className="mt-1 flex justify-between gap-3">
                        <span>Loan money available</span>
                        <strong>{money(normalRemainingPence)}</strong>
                      </div>

                      {currentAmountPence > 0 && (
                        <div className="mt-1 flex justify-between gap-3">
                          <span>
                            {isLoanRepayment
                              ? "This repayment"
                              : "This loan spend"}
                          </span>
                          <strong>{money(currentAmountPence)}</strong>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="mt-1 flex justify-between gap-3">
                        <span>Remaining funding balance</span>
                        <strong>{money(normalRemainingPence)}</strong>
                      </div>

                      {currentAmountPence > 0 && (
                        <div className="mt-1 flex justify-between gap-3">
                          <span>This spend</span>
                          <strong>{money(currentAmountPence)}</strong>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {overSpendPence > 0 && (
                <div className="mt-3 rounded-xl border border-red-300/30 bg-red-500/15 p-3 text-sm text-red-100">
                  <p className="font-black text-white">
                    {isLoanRepayment
                      ? "Loan repayment warning"
                      : "Funding balance warning"}
                  </p>

                  <p className="mt-1">
                    {isLoanRepayment
                      ? `This repayment is ${money(
                          overSpendPence,
                        )} more than the amount still owed on this loan.`
                      : `This spend is ${money(
                          overSpendPence,
                        )} over the remaining ${selectedFundingShortLabel} balance.`}
                  </p>
                </div>
              )}

              <label
                className={`mt-3 block text-sm font-bold ${
                  isLoanFunding ? "text-orange-100" : "text-amber-100"
                }`}
              >
                {isLoanFunding
                  ? isLoanRepayment
                    ? "Loan repayment note"
                    : "Loan spending note"
                  : "Funding spending note"}{" "}
                {form.sponsorId && <span className="text-red-200">*</span>}
              </label>

              <textarea
                value={form.sponsorshipNote}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    sponsorshipNote: event.target.value,
                  }))
                }
                placeholder={
                  form.sponsorId
                    ? isLoanFunding
                      ? isLoanRepayment
                        ? "Required: explain this loan repayment, e.g. £200 paid back to lender"
                        : "Required: explain what the loan money was spent on"
                      : `Required: explain what this ${selectedFundingShortLabel} money was spent on`
                    : "Example: Paid from grant money for event supplies"
                }
                required={Boolean(form.sponsorId)}
                className={`mt-2 min-h-20 w-full rounded-xl bg-black/20 p-3 text-white outline-none ring-1 placeholder:text-white/40 ${
                  form.sponsorId && !form.sponsorshipNote.trim()
                    ? "ring-red-300/40 focus:ring-red-300/60"
                    : isLoanFunding
                      ? "ring-orange-300/20 focus:ring-orange-300/40"
                      : "ring-white/10 focus:ring-amber-300/40"
                }`}
              />

              {form.sponsorId && (
                <p className="mt-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-100 ring-1 ring-red-300/20">
                  {isLoanFunding
                    ? isLoanRepayment
                      ? "Required: add a clear note so Burton Pride can prove this was a loan repayment."
                      : "Required: add a clear note so Burton Pride can prove what the loan money was used for."
                    : `Required: add a clear note so Burton Pride can prove why this ${selectedFundingShortLabel} money was used.`}
                </p>
              )}

              <button
                type="button"
                onClick={openNewSponsorForm}
                className={`mt-3 rounded-xl px-4 py-2 text-sm font-bold ring-1 ${
                  isLoanFunding
                    ? "bg-orange-500/20 text-orange-100 ring-orange-300/20 hover:bg-orange-500/30"
                    : "bg-amber-500/20 text-amber-100 ring-amber-300/20 hover:bg-amber-500/30"
                }`}
              >
                Add New Funding
              </button>
            </div>
          )}

          {form.sponsorId && (!isLoanFunding || isLoanSpending) ? (
            <div className="rounded-xl border border-amber-300/20 bg-amber-500/10 p-3 text-sm text-amber-100">
              <p className="font-bold">Payment method</p>
              <p className="mt-1 text-lg font-black text-white">
                {isLoanSpending ? "Loan Money" : "Funding Money"}
              </p>
              <p className="mt-1 text-xs text-amber-100/70">
                {isLoanSpending
                  ? "This is locked because this transaction is spending money from the selected loan."
                  : "This is locked because a sponsor, grant or funding record is linked. Remove the funding record if this was paid another way."}
              </p>
            </div>
          ) : (
            <div
              className={`rounded-xl border p-3 ${
                isLoanRepayment
                  ? "border-orange-300/20 bg-orange-500/10"
                  : "border-white/10 bg-black/20"
              }`}
            >
              <p
                className={`mb-3 text-sm font-bold ${
                  isLoanRepayment ? "text-orange-100" : "text-white/70"
                }`}
              >
                {isLoanRepayment
                  ? "How was this loan repayment paid?"
                  : "Payment method"}
              </p>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(isLoanRepayment
                  ? loanRepaymentPaymentMethods
                  : paymentMethods
                ).map((method) => {
                  const active = form.paymentMethod === method;

                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => {
                        setDuplicateWarning(null);
                        setDuplicateError(null);

                        setForm((prev) => {
                          const nextIsItemDonation = method === "Item Donation";

                          return {
                            ...prev,
                            paymentMethod: method,
                            sponsorId: nextIsItemDonation ? "" : prev.sponsorId,
                            sponsorName: nextIsItemDonation
                              ? ""
                              : prev.sponsorName,
                            type: nextIsItemDonation ? "income" : prev.type,
                            category: nextIsItemDonation
                              ? "Item Donation"
                              : prev.category === "Item Donation"
                                ? ""
                                : prev.category,
                            budgetCategory: nextIsItemDonation
                              ? ""
                              : (prev as any).budgetCategory,
                            budgetCategoryKey: nextIsItemDonation
                              ? ""
                              : (prev as any).budgetCategoryKey,
                            budget_category: nextIsItemDonation
                              ? ""
                              : (prev as any).budget_category,
                            budget_category_key: nextIsItemDonation
                              ? ""
                              : (prev as any).budget_category_key,
                            budgetCategoryLabel: nextIsItemDonation
                              ? ""
                              : (prev as any).budgetCategoryLabel,
                            budget_category_label: nextIsItemDonation
                              ? ""
                              : (prev as any).budget_category_label,
                            isPersonalFunds:
                              nextIsItemDonation || isLoanFunding
                                ? false
                                : method === "Personal Funds"
                                  ? true
                                  : prev.isPersonalFunds,
                            personalFundsName:
                              nextIsItemDonation || isLoanFunding
                                ? ""
                                : prev.personalFundsName,
                            sponsorshipNote: nextIsItemDonation
                              ? ""
                              : prev.sponsorshipNote,
                          };
                        });
                      }}
                      className={`rounded-xl px-4 py-3 text-left text-sm font-bold transition ${
                        active
                          ? isLoanRepayment
                            ? "bg-orange-500 text-black ring-2 ring-orange-200/50"
                            : "bg-pink-500 text-white ring-2 ring-pink-200/50"
                          : "bg-white/10 text-white/80 ring-1 ring-white/10 hover:bg-white/20"
                      }`}
                    >
                      {method}
                    </button>
                  );
                })}
              </div>

              {!form.paymentMethod && (
                <p className="mt-3 text-xs text-white/40">
                  Choose how this money was paid.
                </p>
              )}

              {form.paymentMethod && (
                <p
                  className={`mt-3 rounded-lg px-3 py-2 text-xs ${
                    isItemDonation
                      ? "bg-emerald-500/10 text-emerald-100 ring-1 ring-emerald-300/20"
                      : "bg-white/10 text-white/70"
                  }`}
                >
                  Selected:{" "}
                  <span className="font-bold text-white">
                    {form.paymentMethod}
                  </span>
                  {isItemDonation && (
                    <span className="mt-1 block text-emerald-100/75">
                      Record the item value only. This is not cash money in or
                      money out.
                    </span>
                  )}
                </p>
              )}
            </div>
          )}

          {canManuallyLinkBudget && (
            <div className="rounded-xl border border-pink-300/25 bg-pink-500/10 p-3 ring-1 ring-pink-300/10">
              <label className="mb-1 block text-sm font-black text-pink-100">
                Which budget is this going to?
              </label>

              <p className="mb-3 text-xs leading-5 text-pink-100/70">
                Choose the Budget Planning row for this transaction. This lets
                you fix it manually if automatic matching puts it in the wrong
                place.
              </p>

              <select
                value={selectedBudgetCategory}
                onChange={(event) => {
                  const selectedKey = event.target.value;
                  const selectedBudget = budgetOptions.find(
                    (item) => item.category_key === selectedKey,
                  );

                  setForm(
                    (prev) =>
                      ({
                        ...prev,
                        budgetCategory: selectedKey,
                        budgetCategoryKey: selectedKey,
                        budget_category: selectedKey,
                        budget_category_key: selectedKey,
                        budgetCategoryLabel:
                          selectedBudget?.category_label || "",
                        budget_category_label:
                          selectedBudget?.category_label || "",
                      }) as FormState,
                  );
                }}
                className="w-full rounded-xl bg-black/25 p-3 text-white outline-none ring-1 ring-pink-300/25 focus:ring-pink-300/60"
              >
                <option className="bg-[#11111f] text-white" value="">
                  Auto match from title / notes
                </option>

                {budgetOptions.map((item) => (
                  <option
                    key={item.category_key}
                    value={item.category_key}
                    className="bg-[#11111f] text-white"
                  >
                    {item.category_label}
                  </option>
                ))}
              </select>

              {selectedBudgetCategory ? (
                <p className="mt-2 rounded-xl bg-black/25 px-3 py-2 text-xs text-pink-100/80">
                  Selected budget: {" "}
                  <strong className="text-white">
                    {budgetOptions.find(
                      (item) => item.category_key === selectedBudgetCategory,
                    )?.category_label || selectedBudgetCategory}
                  </strong>
                </p>
              ) : (
                <p className="mt-2 rounded-xl bg-black/25 px-3 py-2 text-xs text-pink-100/70">
                  Auto match is on. Budget Planning will try to match this from
                  the title, notes, category, and payment information.
                </p>
              )}

              {form.type === "income" && (
                <p className="mt-2 rounded-xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100">
                  This is currently set as Money In. Budget Planning actual
                  spending is normally counted from Money Out transactions only.
                </p>
              )}
            </div>
          )}

          <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-3">
            <label className="mb-1 block text-sm font-bold text-cyan-100">
              Finance notes and queries
            </label>

            <p className="mb-3 text-xs text-cyan-100/70">
              Add an accounts/admin status such as waiting for receipt, ask
              sponsor, bank query, or resolved.
            </p>

            <select
              value={form.financeNoteStatus}
              onChange={(event) => {
                const nextStatus = event.target.value as FinanceNoteStatus;

                setForm((prev) => ({
                  ...prev,
                  financeNoteStatus: nextStatus,
                  financeNote:
                    nextStatus === "none" && !prev.financeNote.trim()
                      ? ""
                      : prev.financeNote,
                }));
              }}
              className="w-full rounded-xl bg-black/20 p-3 text-white outline-none ring-1 ring-cyan-300/20 focus:ring-cyan-300/50"
            >
              {financeNoteOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  className="bg-[#11111f] text-white"
                >
                  {option.label}
                </option>
              ))}
            </select>

            <p className="mt-2 rounded-xl bg-black/20 px-3 py-2 text-xs text-cyan-100/70">
              {selectedFinanceNoteOption.help}
            </p>

            <textarea
              value={form.financeNote}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  financeNote: event.target.value,
                }))
              }
              placeholder={
                form.financeNoteStatus === "waiting_for_receipt"
                  ? "Example: Waiting for receipt from supplier..."
                  : form.financeNoteStatus === "ask_sponsor"
                    ? "Example: Ask sponsor what this payment relates to..."
                    : form.financeNoteStatus === "bank_query"
                      ? "Example: Check this against NatWest statement..."
                      : form.financeNoteStatus === "resolved"
                        ? "Example: Resolved by Cameron, receipt received..."
                        : "Optional finance note..."
              }
              className="mt-3 min-h-20 w-full rounded-xl bg-black/20 p-3 text-white outline-none ring-1 ring-cyan-300/20 placeholder:text-white/40 focus:ring-cyan-300/50"
            />

            {form.financeNoteStatus !== "none" && !form.financeNote.trim() && (
              <p className="mt-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-100 ring-1 ring-amber-300/20">
                Tip: add a short note so another admin knows what needs doing.
              </p>
            )}
          </div>

          {!editingTransaction && (
            <div className="rounded-xl border border-purple-300/20 bg-purple-500/10 p-3">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={form.isRepeating}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      isRepeating: event.target.checked,
                    }))
                  }
                  className="mt-1 h-4 w-4 rounded border-white/20"
                />

                <span>
                  <span className="flex items-center gap-2 text-sm font-bold text-white">
                    <Repeat className="h-4 w-4 text-purple-200" />
                    Make this a repeating payment
                  </span>

                  <span className="mt-1 block text-xs text-purple-100/70">
                    This creates multiple separate transactions from the start
                    date.
                  </span>
                </span>
              </label>

              {form.isRepeating && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-purple-100/80">
                      Repeat every
                    </label>

                    <select
                      value={form.repeatFrequency}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          repeatFrequency: event.target
                            .value as RepeatFrequency,
                        }))
                      }
                      className="w-full rounded-xl bg-black/30 p-3 text-sm font-bold text-white outline-none ring-1 ring-purple-300/20 focus:ring-purple-300/50"
                    >
                      <option
                        className="bg-[#11111f] text-white"
                        value="weekly"
                      >
                        Weekly
                      </option>
                      <option
                        className="bg-[#11111f] text-white"
                        value="monthly"
                      >
                        Monthly
                      </option>
                      <option
                        className="bg-[#11111f] text-white"
                        value="yearly"
                      >
                        Yearly
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-purple-100/80">
                      Number of payments
                    </label>

                    <input
                      type="number"
                      min="2"
                      max="60"
                      step="1"
                      value={form.repeatCount}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          repeatCount: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl bg-black/30 p-3 text-sm font-bold text-white outline-none ring-1 ring-purple-300/20 focus:ring-purple-300/50"
                    />
                  </div>

                  <div className="rounded-xl bg-black/20 p-3 text-xs text-purple-100/80 sm:col-span-2">
                    This will create{" "}
                    <strong className="text-white">
                      {Number(form.repeatCount || 0) || 0}
                    </strong>{" "}
                    payments starting on{" "}
                    <strong className="text-white">
                      {formatDate(form.transactionDate)}
                    </strong>{" "}
                    and repeating{" "}
                    <strong className="text-white">
                      {repeatFrequencyLabel(form.repeatFrequency)}
                    </strong>
                    .
                  </div>
                </div>
              )}
            </div>
          )}

          {editingTransaction && (
            <div className="rounded-xl border border-purple-300/20 bg-purple-500/10 p-3 text-xs text-purple-100/80">
              Repeating payments can only be created when adding a new
              transaction, not while editing an existing one.
            </div>
          )}

          {form.type === "expense" && !form.sponsorId && !isItemDonation && (
            <label className="flex items-start gap-3 rounded-xl border border-sky-300/20 bg-sky-500/10 p-3">
              <input
                type="checkbox"
                checked={form.isPersonalFunds}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    isPersonalFunds: event.target.checked,
                    paymentMethod: event.target.checked
                      ? "Personal Funds"
                      : prev.paymentMethod === "Personal Funds"
                        ? ""
                        : prev.paymentMethod,
                    personalFundsName: event.target.checked
                      ? prev.personalFundsName
                      : "",
                  }))
                }
                className="mt-1 h-4 w-4 rounded border-white/20"
              />

              <span>
                <span className="block text-sm font-bold text-white">
                  Paid with personal funds
                </span>

                <span className="block text-xs text-white/50">
                  This will be recorded, but it will not come off Burton Pride’s
                  balance until it is marked paid back.
                </span>
              </span>
            </label>
          )}

          {form.isPersonalFunds && !form.sponsorId && (
            <input
              value={form.personalFundsName}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  personalFundsName: event.target.value,
                }))
              }
              placeholder="Name of person who paid"
              className="w-full rounded-xl bg-sky-500/10 p-3 text-white outline-none ring-1 ring-sky-300/20 placeholder:text-white/40 focus:ring-sky-300/50"
            />
          )}

          <div>
            <input
              type="date"
              value={form.transactionDate}
              onChange={(event) => {
                setDuplicateWarning(null);
                setDuplicateError(null);

                setForm((prev) => ({
                  ...prev,
                  transactionDate: event.target.value,
                }));
              }}
              className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10 focus:ring-pink-300/40"
            />

            <p className="mt-2 text-xs text-white/40">
              This transaction will be saved under Jan to Dec{" "}
              {getTransactionYear(form.transactionDate)}.
            </p>
          </div>

          <textarea
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                description: event.target.value,
              }))
            }
            placeholder={
              isItemDonation
                ? "Notes about the donated item, who donated it, or what it will be used for"
                : isLoanFunding
                  ? isLoanRepayment
                    ? "Extra notes about this repayment"
                    : "Extra notes about this loan spending"
                  : "Notes"
            }
            className="min-h-24 w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10 focus:ring-pink-300/40"
          />

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <label className="mb-2 flex items-center gap-2 text-sm font-bold text-white/70">
              <FileText className="h-4 w-4" />
              Upload files / receipts / invoices
            </label>

            <p className="mb-3 text-xs text-white/45">
              You can upload more than one file. Useful for receipts, invoices,
              bank screenshots, emails or supporting documents.
            </p>

            <input
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.eml,.msg"
              onChange={(event) => {
                const files = Array.from(event.target.files || []);
                setInvoiceFiles(files);
                setMissingReceiptWarningOpen(false);
                saveWithoutReceiptRef.current = false;
              }}
              className="w-full text-sm text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-pink-500 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-pink-400"
            />

            {invoiceFiles.length > 0 && form.isRepeating && (
              <p className="mt-2 rounded-xl bg-purple-500/10 px-3 py-2 text-xs text-purple-100">
                These same {invoiceFiles.length} file
                {invoiceFiles.length === 1 ? "" : "s"} will be attached to each
                repeating payment.
              </p>
            )}

            {invoiceFiles.length > 0 && (
              <div className="mt-3 rounded-xl bg-white/5 p-3">
                <p className="mb-2 text-xs font-bold text-white/70">
                  New selected files ({invoiceFiles.length})
                </p>

                <div className="space-y-2">
                  {invoiceFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${file.size}-${index}`}
                      className="flex items-start justify-between gap-3 rounded-lg bg-black/20 px-3 py-2 text-xs text-white/60"
                    >
                      <span className="min-w-0 break-all">
                        {index + 1}. {file.name}
                      </span>

                      <span className="shrink-0 text-white/40">
                        {formatFileSize(file.size)}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setInvoiceFiles([]);
                    saveWithoutReceiptRef.current = false;
                    setMissingReceiptWarningOpen(false);
                  }}
                  className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-xs font-bold text-red-100 ring-1 ring-red-300/20 hover:bg-red-500/25"
                >
                  Clear selected files
                </button>
              </div>
            )}

            {existingAttachments.length > 0 && (
              <div className="mt-3 rounded-xl bg-sky-500/10 p-3 ring-1 ring-sky-300/20">
                <p className="mb-2 text-xs font-bold text-sky-100">
                  Existing attachments ({existingAttachments.length})
                </p>

                <div className="space-y-2">
                  {existingAttachments.map((attachment, index) => (
                    <a
                      key={attachment.id || `${attachment.file_url}-${index}`}
                      href={attachment.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start justify-between gap-3 rounded-lg bg-black/20 px-3 py-2 text-xs text-sky-100 hover:bg-black/30"
                    >
                      <span className="min-w-0 break-all">
                        {index + 1}.{" "}
                        {attachment.file_name || `Attachment ${index + 1}`}
                      </span>

                      <span className="shrink-0 text-sky-100/50">
                        {formatFileSize(attachment.file_size)}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {editingTransaction?.invoice_image_url &&
              existingAttachments.length === 0 &&
              invoiceFiles.length === 0 && (
                <a
                  href={editingTransaction.invoice_image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex break-all text-xs font-bold text-sky-200 hover:text-sky-100"
                >
                  View current invoice / receipt
                </a>
              )}
          </div>

          {duplicateError && (
            <div className="rounded-xl border border-red-300/20 bg-red-500/10 p-4 text-sm text-red-100">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <p>{duplicateError}</p>
              </div>
            </div>
          )}

          {duplicateWarning && duplicateWarning.length > 0 && (
            <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 p-4 text-amber-50">
              <div className="flex gap-3">
                <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-amber-200" />

                <div className="min-w-0 flex-1">
                  <h3 className="font-black">Possible duplicate transaction</h3>

                  <p className="mt-1 text-sm leading-6 text-amber-50/80">
                    A transaction with the same title, date, amount, and payment
                    method already exists. Please check before saving.
                  </p>

                  <div className="mt-3 space-y-2">
                    {duplicateWarning.slice(0, 3).map((match) => (
                      <div
                        key={match.id}
                        className="rounded-xl border border-amber-300/20 bg-black/25 p-3 text-sm"
                      >
                        <p className="font-black">{match.title}</p>
                        <p className="mt-1 text-amber-50/75">
                          {money(Number(match.amount_pence || 0))} ·{" "}
                          {formatDuplicateDate(match.transaction_date)} ·{" "}
                          {match.payment_method || "No payment method"}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => {
                        saveAnywayRef.current = false;
                        setDuplicateWarning(null);
                      }}
                      className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-black text-white hover:bg-white/10"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={saveAnyway}
                      className="rounded-xl border border-amber-300/30 bg-amber-500/20 px-4 py-2 text-sm font-black text-amber-50 hover:bg-amber-500/30"
                    >
                      Save anyway
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={saving || checkingDuplicate}
            className={`flex w-full items-center justify-center gap-2 rounded-xl p-3 font-bold disabled:opacity-60 ${
              isItemDonation
                ? "bg-emerald-500 text-black hover:bg-emerald-400"
                : isLoanFunding
                  ? "bg-orange-500 text-black hover:bg-orange-400"
                  : "bg-pink-500 text-white hover:bg-pink-400"
            }`}
          >
            {checkingDuplicate ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Banknote className="h-4 w-4" />
            )}

            {checkingDuplicate
              ? "Checking duplicates..."
              : saving
                ? editingTransaction
                  ? "Updating..."
                  : form.isRepeating
                    ? "Creating repeating payments..."
                    : "Saving..."
                : editingTransaction
                  ? "Update Transaction"
                  : form.isRepeating
                    ? "Create Repeating Payments"
                    : isItemDonation
                      ? "Save Item Donation"
                      : isLoanFunding
                        ? isLoanRepayment
                          ? "Save Loan Repayment"
                          : "Save Loan Spending"
                        : "Save Transaction"}
          </button>
        </div>
      </form>

      {fundingOverspendWarningOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-red-300/30 bg-[#11111f] p-5 text-white shadow-2xl shadow-black/50">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-500/15 text-red-200 ring-1 ring-red-300/30">
                <AlertTriangle className="h-6 w-6" />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-black text-white">
                  {isLoanRepayment
                    ? "Loan repayment warning"
                    : "Funding overspend warning"}
                </h3>

                <p className="mt-2 text-sm leading-6 text-white/70">
                  {isLoanRepayment
                    ? "This repayment is higher than the amount still owed on this loan."
                    : "This transaction is linked to a funding record, but the amount is higher than the remaining balance."}
                </p>

                <div className="mt-3 rounded-2xl border border-red-300/20 bg-red-500/10 p-3 text-sm leading-6 text-red-50">
                  <div className="flex justify-between gap-3">
                    <span>Funding record</span>
                    <strong className="text-right">
                      {selectedFunding?.sponsor_name ||
                        form.sponsorName ||
                        "Selected funding"}
                    </strong>
                  </div>

                  <div className="mt-1 flex justify-between gap-3">
                    <span>
                      {isLoanRepayment ? "Still to repay" : "Remaining balance"}
                    </span>
                    <strong>{money(balanceToCheckPence)}</strong>
                  </div>

                  <div className="mt-1 flex justify-between gap-3">
                    <span>
                      {isLoanRepayment ? "This repayment" : "This spend"}
                    </span>
                    <strong>{money(currentAmountPence)}</strong>
                  </div>

                  <div className="mt-1 flex justify-between gap-3 text-red-100">
                    <span>
                      {isLoanRepayment
                        ? "Over repayment amount"
                        : "Overspend amount"}
                    </span>
                    <strong>{money(overSpendPence)}</strong>
                  </div>
                </div>

                <p className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-3 text-sm leading-6 text-amber-50">
                  {isLoanRepayment
                    ? "Please check the loan record before saving. Continue only if this is correct."
                    : "Please check the funding record before saving. You can go back and reduce the amount, choose a different funding record, or continue if this is correct."}
                </p>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeFundingOverspendPopup}
                    className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/15"
                  >
                    Go back
                  </button>

                  <button
                    type="button"
                    onClick={saveOverFundingLimit}
                    className="rounded-2xl bg-red-500 px-4 py-3 text-sm font-black text-white hover:bg-red-400"
                  >
                    {isLoanRepayment
                      ? "OK, save over loan balance"
                      : "OK, save over funding balance"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {missingReceiptWarningOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-amber-300/30 bg-[#11111f] p-5 text-white shadow-2xl shadow-black/50">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-200 ring-1 ring-amber-300/30">
                <AlertTriangle className="h-6 w-6" />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-black text-white">
                  Receipt or proof is missing
                </h3>

                <p className="mt-2 text-sm leading-6 text-white/70">
                  No receipt, invoice, bank screenshot, email, or proof file has
                  been attached to this transaction.
                </p>

                <p className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-3 text-sm leading-6 text-amber-50">
                  For accounts, it is better to upload proof before saving. You
                  can go back and attach a file, or click OK to save without a
                  receipt.
                </p>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeMissingReceiptPopup}
                    className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/15"
                  >
                    Go back
                  </button>

                  <button
                    type="button"
                    onClick={saveWithoutReceipt}
                    className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-black text-black hover:bg-amber-400"
                  >
                    OK, save without receipt
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
