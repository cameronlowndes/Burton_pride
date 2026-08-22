"use client";

import type { Dispatch, SetStateAction, SyntheticEvent } from "react";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  Building2,
  CreditCard,
  FileText,
  PlusCircle,
  Loader2,
  Repeat,
  ShieldCheck,
  UserRound,
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

type ExtendedFormFields = FormState & {
  supplierId?: string | null;
  supplier_id?: string | null;
  supplierName?: string | null;
  supplier_name?: string | null;
  supplierCategory?: string | null;
  supplier_category?: string | null;
  budgetCategory?: string | null;
  budgetCategoryKey?: string | null;
  budget_category?: string | null;
  budget_category_key?: string | null;
  budgetCategoryLabel?: string | null;
  budget_category_label?: string | null;
};

type SupplierFormFields = ExtendedFormFields;

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

const RECEIPT_DUE_DEFAULT_DAYS = 7;
const DIRECT_DEBIT_DEFAULT_MONTHS = 12;
const DIRECT_DEBIT_MIN_MONTHS = 2;
const DIRECT_DEBIT_MAX_MONTHS = 60;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MAX_RECEIPT_FILES = 10;
const MAX_RECEIPT_FILE_SIZE = 15 * 1024 * 1024;
const MAX_RECEIPT_TOTAL_SIZE = 50 * 1024 * 1024;

type ReceiptDueFormFields = FormState & {
  receiptDueDate?: string | null;
  receipt_due_date?: string | null;
  receiptDueBy?: string | null;
  receipt_due_by?: string | null;
};

function getReceiptDueDateFormValue(form: FormState) {
  const item = form as ReceiptDueFormFields;

  return (
    item.receiptDueDate ||
    item.receipt_due_date ||
    item.receiptDueBy ||
    item.receipt_due_by ||
    ""
  );
}

function setReceiptDueDateOnForm(prev: FormState, value: string) {
  return {
    ...prev,
    receiptDueDate: value,
    receipt_due_date: value,
    receiptDueBy: value,
    receipt_due_by: value,
  } as FormState;
}

function addDaysToDateInput(value: string, days: number) {
  if (!value) return "";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "";

  date.setTime(date.getTime() + Math.max(1, days) * MS_PER_DAY);

  return date.toISOString().slice(0, 10);
}

function todayDateInputValue() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60 * 1000;

  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function formatReceiptDueDate(value: string) {
  if (!value) return "No receipt due date set";

  return formatDate(value);
}

function getSupplierIdFormValue(form: FormState) {
  const item = form as SupplierFormFields;

  return item.supplierId || item.supplier_id || "";
}

function getSupplierNameFormValue(form: FormState) {
  const item = form as SupplierFormFields;

  return item.supplierName || item.supplier_name || "";
}

function getSupplierCategoryFormValue(form: FormState) {
  const item = form as SupplierFormFields;

  return item.supplierCategory || item.supplier_category || "";
}

function setSupplierOnForm(prev: FormState, supplier: SupplierContact | null) {
  return {
    ...prev,
    supplierId: supplier?.id || "",
    supplier_id: supplier?.id || "",
    supplierName: supplier?.supplier_name || "",
    supplier_name: supplier?.supplier_name || "",
    supplierCategory: supplier?.category || "",
    supplier_category: supplier?.category || "",
  } as FormState;
}

function supplierCategoryLabel(category?: string | null) {
  const clean = String(category || "").trim();

  return clean || "Supplier";
}

function supplierContactLine(supplier?: SupplierContact | null) {
  if (!supplier) return "";

  const parts = [
    supplierCategoryLabel(supplier.category),
    supplier.contact_name,
    supplier.email,
    supplier.phone,
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  return parts.join(" · ");
}

type DirectDebitAccountSource = "organisation" | "personal";
type BudgetSelectionMode = "auto" | "saved" | "manual";

type DirectDebitFormFields = FormState & {
  directDebitAccountSource?: DirectDebitAccountSource | null;
  direct_debit_account_source?: DirectDebitAccountSource | null;
  directDebitAccountHolder?: string | null;
  direct_debit_account_holder?: string | null;
  directDebitReference?: string | null;
  direct_debit_reference?: string | null;
  directDebitPlanNote?: string | null;
  direct_debit_plan_note?: string | null;
};

function getDirectDebitAccountSource(form: FormState): DirectDebitAccountSource {
  const item = form as DirectDebitFormFields;

  return (
    item.directDebitAccountSource ||
    item.direct_debit_account_source ||
    (form.isPersonalFunds ? "personal" : "organisation")
  );
}

function getDirectDebitAccountHolder(form: FormState) {
  const item = form as DirectDebitFormFields;

  return (
    item.directDebitAccountHolder ||
    item.direct_debit_account_holder ||
    form.personalFundsName ||
    ""
  );
}

function getDirectDebitReference(form: FormState) {
  const item = form as DirectDebitFormFields;

  return item.directDebitReference || item.direct_debit_reference || "";
}

function getDirectDebitPlanNote(form: FormState) {
  const item = form as DirectDebitFormFields;

  return item.directDebitPlanNote || item.direct_debit_plan_note || "";
}

function setDirectDebitDetails(
  prev: FormState,
  values: {
    accountSource?: DirectDebitAccountSource;
    accountHolder?: string;
    reference?: string;
    planNote?: string;
  },
) {
  const accountSource =
    values.accountSource || getDirectDebitAccountSource(prev);
  const accountHolder =
    values.accountHolder ?? getDirectDebitAccountHolder(prev);
  const reference = values.reference ?? getDirectDebitReference(prev);
  const planNote = values.planNote ?? getDirectDebitPlanNote(prev);
  const usesPersonalAccount = accountSource === "personal";

  return {
    ...prev,
    directDebitAccountSource: accountSource,
    direct_debit_account_source: accountSource,
    directDebitAccountHolder: accountHolder,
    direct_debit_account_holder: accountHolder,
    directDebitReference: reference,
    direct_debit_reference: reference,
    directDebitPlanNote: planNote,
    direct_debit_plan_note: planNote,
    isPersonalFunds: usesPersonalAccount,
    personalFundsName: usesPersonalAccount ? accountHolder : "",
  } as FormState;
}

type BudgetFormFields = FormState & {
  budgetCategory?: string | null;
  budgetCategoryKey?: string | null;
  budget_category?: string | null;
  budget_category_key?: string | null;
  budgetCategoryLabel?: string | null;
  budget_category_label?: string | null;
  costArea?: string | null;
  cost_area?: string | null;
};

function getBudgetFormValue(form: FormState) {
  const item = form as BudgetFormFields;

  return (
    item.budgetCategoryKey ||
    item.budget_category_key ||
    item.budgetCategory ||
    item.budget_category ||
    item.costArea ||
    item.cost_area ||
    ""
  );
}

function getBudgetLabelFormValue(form: FormState) {
  const item = form as BudgetFormFields;

  return item.budgetCategoryLabel || item.budget_category_label || "";
}

function makeBudgetKeyFromLabel(label: string) {
  return String(label || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "other";
}

function findBudgetByKeyOrLabel(
  budgetOptions: BudgetItem[],
  value?: string | null,
) {
  const cleanValue = String(value || "").trim().toLowerCase();

  if (!cleanValue) return null;

  return (
    budgetOptions.find((item) => {
      const key = String(item.category_key || "").trim().toLowerCase();
      const label = String(item.category_label || "").trim().toLowerCase();

      return key === cleanValue || label === cleanValue;
    }) || null
  );
}

function setBudgetOnForm(
  prev: FormState,
  budgetKey: string,
  budgetLabel: string,
) {
  const cleanKey = String(budgetKey || "").trim();
  const cleanLabel = String(budgetLabel || "").trim();

  return {
    ...prev,
    budgetCategory: cleanKey,
    budgetCategoryKey: cleanKey,
    budget_category: cleanKey,
    budget_category_key: cleanKey,
    budgetCategoryLabel: cleanLabel,
    budget_category_label: cleanLabel,
    costArea: cleanKey,
    cost_area: cleanKey,
  } as FormState;
}

function clearBudgetOnForm(prev: FormState) {
  return setBudgetOnForm(prev, "", "");
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
  displaySuppliers?: SupplierContact[];
  suppliers?: SupplierContact[];
  openNewSupplierForm?: () => void;

  handleSubmit: (event: SyntheticEvent<HTMLFormElement>) => Promise<void>;
  cancelEditTransaction: () => void;

  openNewSponsorForm: () => void;
};

const paymentMethods = [
  "Stripe",
  "Received Donation",
  "Online Payment",
  "Cash",
  "Bank Transfer",
  "PayPal",
  "Card Machine",
  "Personal Funds",
  "Item Donation",
  "Balance Adjustment",
  "Other Types",
  "Ticket Sales",
  "Refund Received",
  "Cheque",
  "Direct Debit",
];

const easyModePaymentMethods = [
  "Bank Transfer",
  "Cash",
  "Card Machine",
  "Online Payment",
  "Received Donation",
  "Personal Funds",
];

const easyModeOtherPaymentMethods = paymentMethods.filter(
  (method) => !easyModePaymentMethods.includes(method),
);

const loanRepaymentPaymentMethods = [
  "Bank Transfer",
  "Received Donation",
  "Online Payment",
  "Cash",
  "Card Machine",
  "PayPal",
  "Other Types",
  "Ticket Sales",
  "Refund Received",
  "Cheque",
  "Direct Debit",
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
  const cleanAmount = Number(String(amount ?? "").trim());

  if (!Number.isFinite(cleanAmount) || cleanAmount <= 0) {
    return 0;
  }

  return Math.round(cleanAmount * 100);
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim()
    ? error.message
    : fallback;
}

function isUsableAttachment(attachment: unknown) {
  if (!attachment || typeof attachment !== "object") return false;
  const item = attachment as { file_url?: unknown; url?: unknown; path?: unknown };
  return Boolean(
    String(item.file_url ?? "").trim() ||
      String(item.url ?? "").trim() ||
      String(item.path ?? "").trim(),
  );
}

function validateReceiptFiles(files: File[]) {
  if (files.length > MAX_RECEIPT_FILES) {
    return `Choose no more than ${MAX_RECEIPT_FILES} files.`;
  }

  const oversized = files.find((file) => file.size > MAX_RECEIPT_FILE_SIZE);
  if (oversized) {
    return `${oversized.name} is larger than 15 MB.`;
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > MAX_RECEIPT_TOTAL_SIZE) {
    return "The selected files are larger than 50 MB in total.";
  }

  return "";
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
  displaySuppliers = [],
  suppliers = [],
  openNewSupplierForm,
  handleSubmit,
  cancelEditTransaction,
  openNewSponsorForm,
}: MoneyTransactionFormProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const transactionDateInputRef = useRef<HTMLInputElement | null>(null);
  const receiptInputRef = useRef<HTMLInputElement | null>(null);

  /*
   * Keep the latest selected receipt files in a ref as well as React state.
   *
   * When editing a transaction, this form performs duplicate/funding/receipt
   * checks before it calls the parent save handler. Those checks contain
   * awaits, so we do not rely only on the original SyntheticEvent or a state
   * value that may be replaced by another render before the update is sent.
   */
  const receiptFilesRef = useRef<File[]>(invoiceFiles);

  const saveAnywayRef = useRef(false);
  const saveWithoutReceiptRef = useRef(false);
  const saveOverFundingLimitRef = useRef(false);
  const submittingRef = useRef(false);

  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<
    DuplicateMatch[] | null
  >(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [missingReceiptWarningOpen, setMissingReceiptWarningOpen] =
    useState(false);
  const [fundingOverspendWarningOpen, setFundingOverspendWarningOpen] =
    useState(false);
  const [easyMode, setEasyMode] = useState(true);
  const [showFullAccountingDetails, setShowFullAccountingDetails] =
    useState(false);
  const [budgetTextDraft, setBudgetTextDraft] = useState("");
  const [budgetSelectionMode, setBudgetSelectionMode] =
    useState<BudgetSelectionMode>("auto");

  useEffect(() => {
    receiptFilesRef.current = Array.isArray(invoiceFiles)
      ? [...invoiceFiles]
      : [];
  }, [invoiceFiles]);

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
  const isBalanceAdjustment =
    !hasLinkedFunding && form.paymentMethod === "Balance Adjustment";
  const budgetOptions =
    budgetItems.length > 0 ? budgetItems : defaultBudgetItems;
  const selectedBudgetCategory = getBudgetFormValue(form);
  const selectedBudgetLabelFromForm = getBudgetLabelFormValue(form);
  const selectedBudgetOption =
    findBudgetByKeyOrLabel(budgetOptions, selectedBudgetCategory) ||
    findBudgetByKeyOrLabel(budgetOptions, selectedBudgetLabelFromForm);
  const selectedBudgetLabel =
    selectedBudgetOption?.category_label ||
    selectedBudgetLabelFromForm ||
    selectedBudgetCategory;
  const selectedBudgetKey =
    selectedBudgetOption?.category_key || selectedBudgetCategory;
  const selectedReceiptDueDate = getReceiptDueDateFormValue(form);
  const selectedSupplierId = getSupplierIdFormValue(form);
  const selectedSupplierName = getSupplierNameFormValue(form);
  const selectedSupplierCategory = getSupplierCategoryFormValue(form);
  const supplierOptions =
    displaySuppliers.length > 0 ? displaySuppliers : suppliers;
  const selectedSupplier =
    supplierOptions.find((supplier) => supplier.id === selectedSupplierId) ||
    null;
  const activeSuppliers = supplierOptions.filter(
    (supplier) => supplier.is_active !== false,
  );
  const suggestedReceiptDueDate = addDaysToDateInput(
    form.transactionDate,
    RECEIPT_DUE_DEFAULT_DAYS,
  );
  const isDirectDebit = form.paymentMethod === "Direct Debit";
  const directDebitAccountSource = getDirectDebitAccountSource(form);
  const directDebitAccountHolder = getDirectDebitAccountHolder(form);
  const directDebitReference = getDirectDebitReference(form);
  const directDebitPlanNote = getDirectDebitPlanNote(form);
  const directDebitUsesPersonalAccount =
    isDirectDebit && directDebitAccountSource === "personal";
  const directDebitPaymentCount = Math.min(
    DIRECT_DEBIT_MAX_MONTHS,
    Math.max(
      DIRECT_DEBIT_MIN_MONTHS,
      Math.floor(Number(form.repeatCount || DIRECT_DEBIT_DEFAULT_MONTHS)) ||
        DIRECT_DEBIT_DEFAULT_MONTHS,
    ),
  );
  const isPersonalFundsPayment =
    form.paymentMethod === "Personal Funds" ||
    directDebitUsesPersonalAccount ||
    Boolean(form.isPersonalFunds);

  const hasAdvancedValues = Boolean(
    form.sponsorId ||
    selectedSupplierId ||
    selectedSupplierName ||
    selectedBudgetCategory ||
    (form.financeNoteStatus && form.financeNoteStatus !== "none") ||
    form.financeNote?.trim() ||
    form.isRepeating ||
    isDirectDebit ||
    directDebitReference ||
    directDebitPlanNote ||
    selectedReceiptDueDate,
  );

  const canManuallyLinkBudget =
    form.type === "expense" &&
    !isItemDonation &&
    !isBalanceAdjustment &&
    !isPersonalFundsPayment;

  useEffect(() => {
    const mustNotUseBudget =
      form.type === "income" || isItemDonation || isBalanceAdjustment;

    if (!mustNotUseBudget) {
      return;
    }

    if (!selectedBudgetCategory && !selectedBudgetLabel) {
      return;
    }

    setForm((prev) => clearBudgetOnForm(prev));
  }, [
    form.type,
    isItemDonation,
    isBalanceAdjustment,
    selectedBudgetCategory,
    selectedBudgetLabel,
    setForm,
  ]);

  useEffect(() => {
    if (!isDirectDebit || editingTransaction) {
      return;
    }

    setForm((prev) => {
      const nextCount = String(
        Math.min(
          DIRECT_DEBIT_MAX_MONTHS,
          Math.max(
            DIRECT_DEBIT_MIN_MONTHS,
            Number(prev.repeatCount || DIRECT_DEBIT_DEFAULT_MONTHS) ||
              DIRECT_DEBIT_DEFAULT_MONTHS,
          ),
        ),
      );

      if (
        prev.isRepeating &&
        prev.repeatFrequency === "monthly" &&
        prev.repeatCount === nextCount
      ) {
        return prev;
      }

      return {
        ...prev,
        isRepeating: true,
        repeatFrequency: "monthly",
        repeatCount: nextCount,
      };
    });
  }, [editingTransaction, isDirectDebit, setForm]);

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

  useEffect(() => {
    if (!selectedBudgetKey) {
      setBudgetSelectionMode("auto");
      setBudgetTextDraft("");
      return;
    }

    if (selectedBudgetOption) {
      setBudgetSelectionMode("saved");
      setBudgetTextDraft(selectedBudgetOption.category_label);
      return;
    }

    setBudgetSelectionMode("manual");
    setBudgetTextDraft(selectedBudgetLabel || selectedBudgetKey);
  }, [selectedBudgetKey, selectedBudgetLabel, selectedBudgetOption]);

  useEffect(() => {
    if (!easyMode && (editingTransaction || hasAdvancedValues)) {
      setShowFullAccountingDetails(true);
    }
  }, [easyMode, editingTransaction, hasAdvancedValues]);

  function chooseBudgetCategory(selectedKey: string) {
    const selectedBudget = findBudgetByKeyOrLabel(budgetOptions, selectedKey);

    if (!selectedKey) {
      setBudgetSelectionMode("auto");
      setBudgetTextDraft("");
      setForm((prev) => clearBudgetOnForm(prev));
      return;
    }

    const label = selectedBudget?.category_label || selectedKey;
    const key = selectedBudget?.category_key || makeBudgetKeyFromLabel(label);

    setBudgetSelectionMode("saved");
    setBudgetTextDraft(label);
    setForm((prev) => setBudgetOnForm(prev, key, label));
  }

  function typeBudgetCategory(value: string) {
    const cleanValue = value.trim();
    const matchedBudget = findBudgetByKeyOrLabel(budgetOptions, cleanValue);
    const label = matchedBudget?.category_label || cleanValue;
    const key = matchedBudget?.category_key || makeBudgetKeyFromLabel(label);

    setBudgetSelectionMode("manual");
    setBudgetTextDraft(value);

    // Keep the transaction state updated immediately so the parent submit
    // handler sends the manual budget key and label to the database/table.
    setForm((prev) => {
      if (!cleanValue) {
        return clearBudgetOnForm(prev);
      }

      return setBudgetOnForm(prev, key, label);
    });
  }

  function useAutoBudgetMatching() {
    setBudgetSelectionMode("auto");
    setBudgetTextDraft("");
    setForm((prev) => clearBudgetOnForm(prev));
  }

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
  const usableExistingAttachments = existingAttachments.filter(isUsableAttachment);

  const hasExistingReceipt =
    usableExistingAttachments.length > 0 ||
    Boolean(String(editingTransaction?.invoice_image_url ?? "").trim());

  const needsReceiptWarning =
    form.type === "expense" &&
    !isItemDonation &&
    !isBalanceAdjustment &&
    invoiceFiles.length === 0 &&
    !hasExistingReceipt;

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

      const payload = (await response.json().catch(() => null)) as
        | { duplicate?: unknown; matches?: unknown; error?: unknown; message?: unknown }
        | null;

      if (!response.ok) {
        throw new Error(
          String(payload?.error || payload?.message || "Failed to check duplicates."),
        );
      }

      const matches = Array.isArray(payload?.matches)
        ? payload.matches.filter(
            (item): item is DuplicateMatch =>
              Boolean(item) && typeof item === "object" && "id" in item,
          )
        : [];

      return {
        duplicate: Boolean(payload?.duplicate) && matches.length > 0,
        matches,
      };
    } finally {
      setCheckingDuplicate(false);
    }
  }

  async function createSupplierTransactionLog(snapshot: {
    supplierId: string;
    supplierName: string;
    supplierCategory: string;
    title: string;
    description: string;
    type: string;
    amount: string;
    amountPence: number;
    transactionDate: string;
    paymentMethod: string;
    fundingId: string;
    fundingName: string;
    financeNoteStatus: string;
    financeNote: string;
    receiptDueDate: string;
    isRepeating: boolean;
    repeatFrequency: string;
    repeatCount: string;
    directDebitAccountSource: DirectDebitAccountSource;
    directDebitAccountHolder: string;
    directDebitReference: string;
    directDebitPlanNote: string;
    isDirectDebit: boolean;
  }) {
    if (!snapshot.supplierId && !snapshot.supplierName) {
      return;
    }

    const supplierName = snapshot.supplierName || "Unknown supplier";
    const supplierCategory = snapshot.supplierCategory;

    try {
      const response = await fetch("/api/admin/money/suppliers/logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          supplier_id: snapshot.supplierId || null,
          supplier_name: supplierName,
          action: "transaction_linked",
          action_label: "Transaction linked",
          message: `Transaction linked to supplier/contact: ${supplierName}`,
          details: {
            transaction_title: snapshot.title,
            transaction_description: snapshot.description,
            transaction_type: snapshot.type,
            transaction_amount: snapshot.amount,
            transaction_amount_pence: snapshot.amountPence,
            transaction_date: snapshot.transactionDate,
            payment_method: snapshot.paymentMethod,
            supplier_category: supplierCategory || null,
            funding_id: snapshot.fundingId || null,
            funding_name: snapshot.fundingName || null,
            finance_note_status: snapshot.financeNoteStatus || null,
            finance_note: snapshot.financeNote || null,
            receipt_due_date: snapshot.receiptDueDate || null,
            is_repeating: snapshot.isRepeating,
            repeat_frequency: snapshot.isRepeating ? snapshot.repeatFrequency : null,
            repeat_count: snapshot.isRepeating ? snapshot.repeatCount : null,
            direct_debit_account_source: snapshot.isDirectDebit
              ? snapshot.directDebitAccountSource
              : null,
            direct_debit_account_holder: snapshot.isDirectDebit
              ? snapshot.directDebitAccountHolder || null
              : null,
            direct_debit_reference: snapshot.isDirectDebit
              ? snapshot.directDebitReference || null
              : null,
            direct_debit_plan_note: snapshot.isDirectDebit
              ? snapshot.directDebitPlanNote || null
              : null,
          },
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        console.error("Failed to create supplier transaction log:", payload);
      }
    } catch (error) {
      console.error("Failed to create supplier transaction log:", error);
    }
  }

  async function handleFormSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    /*
     * Keep the actual form element before any asynchronous checks run.
     *
     * This is important for receipt uploads when editing an existing
     * transaction. The parent save handler may build FormData from
     * event.currentTarget. React's currentTarget is not something we should
     * depend on after several awaits, so a stable event is created below.
     */
    event.persist?.();

    const submittedFormElement =
      event.currentTarget || formRef.current;

    const receiptFilesAtSubmit = [
      ...receiptFilesRef.current,
    ];

    if (saving || checkingDuplicate || submittingRef.current) {
      return;
    }

    setDuplicateWarning(null);
    setDuplicateError(null);

    if (isDirectDebit && !editingTransaction) {
      if (!form.transactionDate) {
        setDuplicateError(
          "Choose the first Direct Debit collection date before saving.",
        );
        return;
      }

      if (
        directDebitUsesPersonalAccount &&
        !directDebitAccountHolder.trim()
      ) {
        setDuplicateError(
          "Enter the name of the person whose account pays this Direct Debit.",
        );
        return;
      }

      if (directDebitPaymentCount < DIRECT_DEBIT_MIN_MONTHS) {
        setDuplicateError(
          `A monthly Direct Debit plan must contain at least ${DIRECT_DEBIT_MIN_MONTHS} payments.`,
        );
        return;
      }
    }

    if (!saveAnywayRef.current) {
      try {
        const duplicateCheck = await checkDuplicateBeforeSave();

        if (duplicateCheck.duplicate) {
          setDuplicateWarning(duplicateCheck.matches);
          return;
        }
      } catch (error: unknown) {
        setDuplicateError(
          errorMessage(error, "Could not check for duplicate transactions."),
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

    /*
     * Validate the exact receipt files that are about to be sent.
     * Do this again at submit time so an edit cannot silently lose an invalid
     * or stale file selection.
     */
    const submitReceiptValidation =
      validateReceiptFiles(receiptFilesAtSubmit);

    if (submitReceiptValidation) {
      setFileError(submitReceiptValidation);
      return;
    }

    saveAnywayRef.current = false;
    saveWithoutReceiptRef.current = false;
    saveOverFundingLimitRef.current = false;
    setMissingReceiptWarningOpen(false);
    setFundingOverspendWarningOpen(false);

    const supplierSnapshot = {
      supplierId: selectedSupplierId,
      supplierName:
        selectedSupplier?.supplier_name || selectedSupplierName || "",
      supplierCategory:
        selectedSupplier?.category || selectedSupplierCategory || "",
      title: form.title,
      description: form.description,
      type: form.type,
      amount: form.amount,
      amountPence: currentAmountPence,
      transactionDate: form.transactionDate,
      paymentMethod: form.paymentMethod,
      fundingId: form.sponsorId,
      fundingName: form.sponsorName,
      financeNoteStatus: form.financeNoteStatus || "",
      financeNote: form.financeNote || "",
      receiptDueDate: selectedReceiptDueDate,
      isRepeating: Boolean(form.isRepeating),
      repeatFrequency: form.repeatFrequency || "",
      repeatCount: form.repeatCount || "",
      directDebitAccountSource,
      directDebitAccountHolder,
      directDebitReference,
      directDebitPlanNote,
      isDirectDebit,
    };

    submittingRef.current = true;

    try {
      /*
       * Build a stable submit event for the parent handler.
       *
       * The parent transaction saver can safely use:
       *   event.currentTarget
       *   new FormData(event.currentTarget)
       *
       * even though this component has already awaited duplicate/funding
       * checks. This fixes newly selected receipts being lost specifically
       * when an existing transaction is updated.
       */
      const stableSubmitEvent = {
        ...event,
        currentTarget: submittedFormElement,
        target: submittedFormElement,
        preventDefault: () => undefined,
        persist: () => undefined,
      } as SyntheticEvent<HTMLFormElement>;

      /*
       * Keep the latest receipt state available until the parent save has
       * finished. Do not clear invoiceFiles before handleSubmit resolves.
       */
      receiptFilesRef.current = receiptFilesAtSubmit;

      await handleSubmit(stableSubmitEvent);
      await createSupplierTransactionLog(supplierSnapshot);

      // Tell the transactions table to reload immediately after a successful
      // save. This is especially important for manually selected budgets so
      // the chosen Budget Planning row appears in the table without requiring
      // the admin to press Refresh table.
      window.dispatchEvent(
        new CustomEvent("money-transaction-saved", {
          detail: {
            transactionId: editingTransaction?.id || null,
            title: form.title,
            transactionDate: form.transactionDate,
            budgetKey: selectedBudgetKey || null,
            budgetLabel: selectedBudgetLabel || null,
            budgetMode: selectedBudgetKey || selectedBudgetLabel ? "manual" : "auto",
            receiptFileCount: receiptFilesAtSubmit.length,
            receiptFileNames: receiptFilesAtSubmit.map((file) => file.name),
            receiptAddedDuringEdit:
              Boolean(editingTransaction) && receiptFilesAtSubmit.length > 0,
          },
        }),
      );
    } catch (error) {
      setDuplicateError(errorMessage(error, "The transaction could not be saved."));
    } finally {
      submittingRef.current = false;
    }
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
    // Keep typing fast: do not fire four state updates on every key press
    // when the warnings are already closed/empty.
    if (duplicateWarning) {
      setDuplicateWarning(null);
    }

    if (duplicateError) {
      setDuplicateError(null);
    }

    if (missingReceiptWarningOpen) {
      setMissingReceiptWarningOpen(false);
    }

    if (fundingOverspendWarningOpen) {
      setFundingOverspendWarningOpen(false);
    }
  }

  function choosePaymentMethod(method: string) {
    setDuplicateWarning(null);
    setDuplicateError(null);

    setForm((prev) => {
      const nextIsItemDonation = method === "Item Donation";
      const nextIsBalanceAdjustment = method === "Balance Adjustment";
      const nextIsPersonalFunds = method === "Personal Funds";
      const nextIsDirectDebit = method === "Direct Debit";
      const clearsLinkedAccounting =
        nextIsItemDonation ||
        nextIsBalanceAdjustment ||
        nextIsPersonalFunds;

      const previousCategory = String(prev.category || "").trim();
      const nextCategory = nextIsItemDonation
        ? "Item Donation"
        : nextIsBalanceAdjustment
          ? "Balance Adjustment"
          : previousCategory === "Item Donation" ||
              previousCategory === "Balance Adjustment"
            ? ""
            : prev.category;

      const nextForm = {
        ...prev,
        paymentMethod: method,
        sponsorId: clearsLinkedAccounting ? "" : prev.sponsorId,
        sponsorName: clearsLinkedAccounting ? "" : prev.sponsorName,
        supplierId: clearsLinkedAccounting
          ? ""
          : (prev as ExtendedFormFields).supplierId,
        supplier_id: clearsLinkedAccounting
          ? ""
          : (prev as ExtendedFormFields).supplier_id,
        supplierName: clearsLinkedAccounting
          ? ""
          : (prev as ExtendedFormFields).supplierName,
        supplier_name: clearsLinkedAccounting
          ? ""
          : (prev as ExtendedFormFields).supplier_name,
        supplierCategory: clearsLinkedAccounting
          ? ""
          : (prev as ExtendedFormFields).supplierCategory,
        supplier_category: clearsLinkedAccounting
          ? ""
          : (prev as ExtendedFormFields).supplier_category,

        // Item donations are non-cash records. Balance adjustments are genuine
        // corrections to available money and keep the direction selected by
        // the admin: Money In increases the balance and Money Out reduces it.
        type: nextIsItemDonation
          ? "income"
          : nextIsPersonalFunds
            ? "expense"
            : prev.type,
        category: nextCategory,

        // Item donations, personal funds awaiting repayment and balance
        // corrections must never be attached to Budget Planning.
        budgetCategory: clearsLinkedAccounting
          ? ""
          : (prev as ExtendedFormFields).budgetCategory,
        budgetCategoryKey: clearsLinkedAccounting
          ? ""
          : (prev as ExtendedFormFields).budgetCategoryKey,
        budget_category: clearsLinkedAccounting
          ? ""
          : (prev as ExtendedFormFields).budget_category,
        budget_category_key: clearsLinkedAccounting
          ? ""
          : (prev as ExtendedFormFields).budget_category_key,
        budgetCategoryLabel: clearsLinkedAccounting
          ? ""
          : (prev as ExtendedFormFields).budgetCategoryLabel,
        budget_category_label: clearsLinkedAccounting
          ? ""
          : (prev as ExtendedFormFields).budget_category_label,
        costArea: clearsLinkedAccounting
          ? ""
          : (prev as BudgetFormFields).costArea,
        cost_area: clearsLinkedAccounting
          ? ""
          : (prev as BudgetFormFields).cost_area,

        isPersonalFunds:
          nextIsItemDonation || nextIsBalanceAdjustment || isLoanFunding
            ? false
            : nextIsPersonalFunds
              ? true
              : prev.isPersonalFunds,
        personalFundsName:
          nextIsItemDonation || nextIsBalanceAdjustment || isLoanFunding
            ? ""
            : prev.personalFundsName,
        sponsorshipNote:
          nextIsItemDonation || nextIsBalanceAdjustment
            ? ""
            : prev.sponsorshipNote,
        isRepeating: nextIsDirectDebit
          ? true
          : clearsLinkedAccounting
            ? false
            : prev.isRepeating,
        repeatFrequency: nextIsDirectDebit
          ? "monthly"
          : prev.repeatFrequency,
        repeatCount: nextIsDirectDebit
          ? prev.repeatCount || String(DIRECT_DEBIT_DEFAULT_MONTHS)
          : prev.repeatCount,
      } as FormState;

      return nextIsDirectDebit
        ? setDirectDebitDetails(nextForm, {
            accountSource: getDirectDebitAccountSource(prev),
          })
        : nextForm;
    });
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
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-sky-300/20 bg-sky-500/10 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-sky-100">
                {easyMode ? "Easy Mode is on" : "Full Mode is on"}
              </p>

              <p className="mt-1 text-xs leading-5 text-sky-100/70">
                {easyMode
                  ? "Simple step-by-step form for quick entries."
                  : "Clean full form. Open Advanced details only when you need supplier, budget, finance or repeat options."}
              </p>

              {easyMode && hasAdvancedValues && (
                <p className="mt-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-bold leading-5 text-amber-100 ring-1 ring-amber-300/20">
                  This transaction already contains advanced details. They are
                  still saved, but hidden while Easy Mode is on.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setEasyMode((previous) => {
                  const nextEasyMode = !previous;
                  if (nextEasyMode) {
                    setShowFullAccountingDetails(false);
                  }
                  return nextEasyMode;
                });
              }}
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-sky-500 px-4 py-3 text-sm font-black text-black transition hover:bg-sky-400"
            >
              {easyMode ? "Show Full Mode" : "Use Easy Mode"}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            {easyMode && (
              <label className="mb-2 block text-sm font-black text-white">
                Step 1 — What is this payment for?
              </label>
            )}

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
                  : easyMode
                    ? "Example: Raffle ticket money or venue payment"
                    : "Title"
              }
              className={`w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10 focus:ring-pink-300/40 ${
                easyMode ? "text-base font-semibold sm:p-4" : ""
              }`}
            />
          </div>

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
          ) : isBalanceAdjustment ? (
            <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-3 text-sm text-cyan-100">
              <p className="font-bold">Transaction type</p>

              <p className="mt-1 text-lg font-black text-white">
                Balance Adjustment
              </p>

              <p className="mt-1 text-xs leading-5 text-cyan-100/75">
                Use this only to correct the Money Tracker balance. Choose
                Money In to increase the available balance or Money Out to
                reduce it. This correction will not be sent to Budget Planning.
              </p>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) =>
                      clearBudgetOnForm({
                        ...prev,
                        type: "income",
                        category: "Balance Adjustment",
                        isPersonalFunds: false,
                        personalFundsName: "",
                      } as FormState),
                    )
                  }
                  className={`rounded-xl px-3 py-3 text-left text-sm font-black ring-1 transition ${
                    form.type === "income"
                      ? "bg-emerald-500 text-black ring-emerald-200/60"
                      : "bg-black/20 text-emerald-100 ring-emerald-300/20 hover:bg-emerald-500/15"
                  }`}
                >
                  Increase available balance
                  <span className="mt-1 block text-xs font-semibold opacity-75">
                    Save this correction as Money In
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) =>
                      clearBudgetOnForm({
                        ...prev,
                        type: "expense",
                        category: "Balance Adjustment",
                        isPersonalFunds: false,
                        personalFundsName: "",
                      } as FormState),
                    )
                  }
                  className={`rounded-xl px-3 py-3 text-left text-sm font-black ring-1 transition ${
                    form.type === "expense"
                      ? "bg-red-500 text-white ring-red-200/60"
                      : "bg-black/20 text-red-100 ring-red-300/20 hover:bg-red-500/15"
                  }`}
                >
                  Reduce available balance
                  <span className="mt-1 block text-xs font-semibold opacity-75">
                    Save this correction as Money Out
                  </span>
                </button>
              </div>
            </div>
          ) : easyMode ? (
            <div>
              <p className="mb-2 text-sm font-black text-white">
                Step 2 — Is money coming in or going out?
              </p>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    resetWarnings();
                    setForm((prev) =>
                      clearBudgetOnForm({
                        ...prev,
                        type: "income",
                        isPersonalFunds: false,
                        personalFundsName: "",
                      } as FormState),
                    );
                  }}
                  className={`rounded-2xl px-4 py-4 text-left text-base font-black ring-1 transition ${
                    form.type === "income"
                      ? "bg-emerald-500 text-black ring-emerald-200/60"
                      : "bg-emerald-500/10 text-emerald-100 ring-emerald-300/20 hover:bg-emerald-500/20"
                  }`}
                >
                  Money In
                  <span className="mt-1 block text-xs font-semibold opacity-75">
                    Money received by Burton Pride
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    resetWarnings();
                    setForm((prev) => ({
                      ...prev,
                      type: "expense",
                    }));
                  }}
                  className={`rounded-2xl px-4 py-4 text-left text-base font-black ring-1 transition ${
                    form.type === "expense"
                      ? "bg-red-500 text-white ring-red-200/60"
                      : "bg-red-500/10 text-red-100 ring-red-300/20 hover:bg-red-500/20"
                  }`}
                >
                  Money Out
                  <span className="mt-1 block text-xs font-semibold opacity-75">
                    Money spent or paid out
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <select
              value={form.type}
              onChange={(event) => {
                resetWarnings();

                const nextType = event.target.value as "income" | "expense";

                setForm((prev) => {
                  const nextForm = {
                    ...prev,
                    type: nextType,
                    isPersonalFunds:
                      nextType === "income" ? false : prev.isPersonalFunds,
                    personalFundsName:
                      nextType === "income" ? "" : prev.personalFundsName,
                  } as FormState;

                  return nextType === "income"
                    ? clearBudgetOnForm(nextForm)
                    : nextForm;
                });
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
            {easyMode && (
              <label className="mb-2 block text-sm font-black text-white">
                Step 3 — Enter the amount
              </label>
            )}

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
                  : isBalanceAdjustment
                    ? "Balance correction amount"
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
                easyMode ? "text-lg font-black sm:p-4" : ""
              } ${
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

            {isBalanceAdjustment && (
              <p className="mt-2 rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-3 py-2 text-xs leading-5 text-cyan-100">
                This amount will {form.type === "income" ? "increase" : "reduce"} the
                available Money Tracker balance. It is an accounting correction
                only and will not be included in any Budget Planning row.
              </p>
            )}
          </div>

          {!easyMode &&
            (isItemDonation ? (
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
            ) : isBalanceAdjustment ? (
              <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-3 text-sm text-cyan-100">
                <p className="font-black text-white">
                  Money Tracker balance correction
                </p>

                <p className="mt-1 text-xs leading-5 text-cyan-100/75">
                  This entry changes the available balance using the selected
                  Money In or Money Out direction. It is kept as a clear audit
                  record and is excluded from Budget Planning.
                </p>

                <div className="mt-3 rounded-xl bg-black/20 px-3 py-2 text-xs leading-5 text-cyan-50">
                  <p>
                    No budget, supplier, sponsor, personal-funds record, or
                    recurring payment will be attached.
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
                                    prev.paymentMethod !==
                                      "Sponsorship Money" &&
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
            ))}

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
                  : easyMode
                    ? "Step 4 — How was it paid?"
                    : "Payment method"}
              </p>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(isLoanRepayment
                  ? loanRepaymentPaymentMethods
                  : easyMode
                    ? easyModePaymentMethods
                    : paymentMethods
                ).map((method) => {
                  const active = form.paymentMethod === method;

                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => choosePaymentMethod(method)}
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

              {easyMode && !isLoanRepayment && (
                <div className="mt-3">
                  <label className="mb-2 block text-xs font-bold text-white/60">
                    More payment methods
                  </label>

                  <select
                    value={
                      easyModeOtherPaymentMethods.includes(form.paymentMethod)
                        ? form.paymentMethod
                        : ""
                    }
                    onChange={(event) => {
                      if (event.target.value) {
                        choosePaymentMethod(event.target.value);
                      }
                    }}
                    className="w-full rounded-xl bg-black/30 p-3 text-sm font-bold text-white outline-none ring-1 ring-white/10 focus:ring-pink-300/40"
                  >
                    <option className="bg-[#11111f] text-white" value="">
                      Choose another payment method...
                    </option>

                    {easyModeOtherPaymentMethods.map((method) => (
                      <option
                        key={method}
                        value={method}
                        className="bg-[#11111f] text-white"
                      >
                        {method}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
                      : isBalanceAdjustment
                        ? "bg-cyan-500/10 text-cyan-100 ring-1 ring-cyan-300/20"
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
                  {isBalanceAdjustment && (
                    <span className="mt-1 block text-cyan-100/75">
                      This adjusts the available balance only. It is not linked
                      to a budget, supplier, sponsor, or funding record.
                    </span>
                  )}
                </p>
              )}
            </div>
          )}

          {isDirectDebit && !isItemDonation && (
            <div className="rounded-2xl border border-indigo-300/25 bg-indigo-500/10 p-4 ring-1 ring-indigo-300/10">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-100 ring-1 ring-indigo-300/20">
                  <CreditCard className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <p className="text-base font-black text-white">
                    Monthly Direct Debit plan
                  </p>
                  <p className="mt-1 text-xs leading-5 text-indigo-100/70">
                    Direct Debits are locked to once per month. The transaction
                    date is the first collection date, and each later payment is
                    created monthly on the same schedule.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) =>
                      setDirectDebitDetails(prev, {
                        accountSource: "organisation",
                        accountHolder: "",
                      }),
                    )
                  }
                  className={`rounded-2xl p-4 text-left ring-1 transition ${
                    directDebitAccountSource === "organisation"
                      ? "bg-indigo-500 text-white ring-indigo-200/60"
                      : "bg-black/20 text-indigo-50 ring-indigo-300/20 hover:bg-indigo-500/15"
                  }`}
                >
                  <span className="flex items-center gap-2 font-black">
                    <Building2 className="h-4 w-4" />
                    Burton Pride account
                  </span>
                  <span className="mt-1 block text-xs opacity-75">
                    The monthly payment leaves Burton Pride’s own bank account.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) =>
                      setDirectDebitDetails(prev, {
                        accountSource: "personal",
                      }),
                    )
                  }
                  className={`rounded-2xl p-4 text-left ring-1 transition ${
                    directDebitAccountSource === "personal"
                      ? "bg-sky-500 text-black ring-sky-200/60"
                      : "bg-black/20 text-sky-50 ring-sky-300/20 hover:bg-sky-500/15"
                  }`}
                >
                  <span className="flex items-center gap-2 font-black">
                    <UserRound className="h-4 w-4" />
                    Personal account
                  </span>
                  <span className="mt-1 block text-xs opacity-75">
                    A person pays first and Burton Pride may need to repay them.
                  </span>
                </button>
              </div>

              {directDebitUsesPersonalAccount && (
                <div className="mt-4 rounded-2xl border border-sky-300/20 bg-sky-500/10 p-3">
                  <label className="mb-2 block text-sm font-black text-sky-100">
                    Person whose account is charged
                  </label>
                  <input
                    value={directDebitAccountHolder}
                    onChange={(event) =>
                      setForm((prev) =>
                        setDirectDebitDetails(prev, {
                          accountSource: "personal",
                          accountHolder: event.target.value,
                        }),
                      )
                    }
                    placeholder="Example: Your Name"
                    className="w-full rounded-xl bg-black/25 p-3 text-white outline-none ring-1 ring-sky-300/20 placeholder:text-white/35 focus:ring-sky-300/50"
                  />
                  <p className="mt-2 text-xs leading-5 text-sky-100/70">
                    Each monthly payment is recorded as personal funds and does
                    not reduce Burton Pride’s bank balance until that person is
                    marked as paid back.
                  </p>
                </div>
              )}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-black text-indigo-100/80">
                    Number of monthly payments
                  </label>
                  <input
                    type="number"
                    min={DIRECT_DEBIT_MIN_MONTHS}
                    max={DIRECT_DEBIT_MAX_MONTHS}
                    step="1"
                    value={directDebitPaymentCount}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        isRepeating: true,
                        repeatFrequency: "monthly",
                        repeatCount: String(
                          Math.min(
                            DIRECT_DEBIT_MAX_MONTHS,
                            Math.max(
                              DIRECT_DEBIT_MIN_MONTHS,
                              Number(event.target.value || 0),
                            ),
                          ),
                        ),
                      }))
                    }
                    className="w-full rounded-xl bg-black/25 p-3 text-sm font-bold text-white outline-none ring-1 ring-indigo-300/20 focus:ring-indigo-300/50"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-black text-indigo-100/80">
                    Direct Debit reference
                  </label>
                  <input
                    value={directDebitReference}
                    onChange={(event) =>
                      setForm((prev) =>
                        setDirectDebitDetails(prev, {
                          reference: event.target.value,
                        }),
                      )
                    }
                    placeholder="Mandate, supplier or account reference"
                    className="w-full rounded-xl bg-black/25 p-3 text-sm font-bold text-white outline-none ring-1 ring-indigo-300/20 placeholder:text-white/35 focus:ring-indigo-300/50"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="mb-1 block text-xs font-black text-indigo-100/80">
                  Plan note
                </label>
                <textarea
                  value={directDebitPlanNote}
                  onChange={(event) =>
                    setForm((prev) =>
                      setDirectDebitDetails(prev, {
                        planNote: event.target.value,
                      }),
                    )
                  }
                  placeholder="Example: Website hosting, collected monthly until renewed"
                  className="min-h-20 w-full rounded-xl bg-black/25 p-3 text-sm text-white outline-none ring-1 ring-indigo-300/20 placeholder:text-white/35 focus:ring-indigo-300/50"
                />
              </div>

              <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-3 text-xs leading-5 text-emerald-100">
                <p className="flex items-center gap-2 font-black text-white">
                  <ShieldCheck className="h-4 w-4" />
                  Monthly protection is on
                </p>
                <p className="mt-1">
                  This plan will create {directDebitPaymentCount} separate
                  monthly payments, beginning on {form.transactionDate ? formatDate(form.transactionDate) : "a date still to be selected"}.
                  Weekly and yearly frequencies are disabled for Direct Debit.
                </p>
                {directDebitUsesPersonalAccount && (
                  <p className="mt-2 font-bold text-sky-100">
                    Paid from personal account: {directDebitAccountHolder || "name required"}.
                  </p>
                )}
              </div>
            </div>
          )}

          {!easyMode && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black text-white">
                    Advanced details
                  </p>
                  <p className="mt-1 text-xs leading-5 text-white/55">
                    Supplier, budget tracker, finance notes, repeating payments and receipt due date.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowFullAccountingDetails((previous) => !previous)
                  }
                  className="inline-flex items-center justify-center rounded-xl bg-white/10 px-4 py-2 text-xs font-black text-white ring-1 ring-white/10 hover:bg-white/20"
                >
                  {showFullAccountingDetails
                    ? "Hide advanced details"
                    : "Show advanced details"}
                </button>
              </div>
            </div>
          )}

          {!easyMode && showFullAccountingDetails && !isItemDonation && !isPersonalFundsPayment && (
            <div className="rounded-xl border border-violet-300/20 bg-violet-500/10 p-3">
              <label className="mb-1 flex items-center gap-2 text-sm font-black text-violet-100">
                <Building2 className="h-4 w-4" />
                Supplier / contact
              </label>

              <p className="mb-3 text-xs leading-5 text-violet-100/70">
                Link this payment to a regular supplier such as a printer,
                venue, insurance provider, entertainer, food vendor, security,
                equipment hire, or other contact.
              </p>

              <select
                value={selectedSupplierId}
                onChange={(event) => {
                  const supplier =
                    activeSuppliers.find(
                      (item) => item.id === event.target.value,
                    ) || null;

                  setForm((prev) => setSupplierOnForm(prev, supplier));
                }}
                className="w-full rounded-xl bg-black/20 p-3 text-white outline-none ring-1 ring-violet-300/20 focus:ring-violet-300/50"
              >
                <option className="bg-[#11111f] text-white" value="">
                  No supplier / contact linked
                </option>

                {activeSuppliers.map((supplier) => (
                  <option
                    key={supplier.id}
                    value={supplier.id}
                    className="bg-[#11111f] text-white"
                  >
                    {supplierCategoryLabel(supplier.category)} —{" "}
                    {supplier.supplier_name}
                  </option>
                ))}
              </select>

              {selectedSupplier ? (
                <div className="mt-3 rounded-xl bg-black/20 px-3 py-2 text-xs leading-5 text-violet-50">
                  <p>
                    Linked to{" "}
                    <strong className="text-white">
                      {selectedSupplier.supplier_name}
                    </strong>
                    .
                  </p>

                  <p className="mt-1 text-violet-100/60">
                    When this transaction is saved, it will be recorded in
                    Supplier Logs.
                  </p>

                  {supplierContactLine(selectedSupplier) && (
                    <p className="mt-1 text-violet-100/70">
                      {supplierContactLine(selectedSupplier)}
                    </p>
                  )}

                  {selectedSupplier.notes && (
                    <p className="mt-1 line-clamp-3 text-violet-100/60">
                      {selectedSupplier.notes}
                    </p>
                  )}
                </div>
              ) : selectedSupplierName ? (
                <div className="mt-3 rounded-xl bg-black/20 px-3 py-2 text-xs leading-5 text-violet-50">
                  <p>
                    Linked to{" "}
                    <strong className="text-white">
                      {selectedSupplierName}
                    </strong>
                    {selectedSupplierCategory
                      ? ` · ${selectedSupplierCategory}`
                      : ""}
                    .
                  </p>

                  <p className="mt-1 text-violet-100/60">
                    When this transaction is saved, it will be recorded in
                    Supplier Logs.
                  </p>
                </div>
              ) : (
                <p className="mt-2 rounded-xl bg-black/20 px-3 py-2 text-xs leading-5 text-violet-100/65">
                  Optional, but useful for reports and repeat payments.
                </p>
              )}

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                {openNewSupplierForm && (
                  <button
                    type="button"
                    onClick={openNewSupplierForm}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-500/20 px-4 py-2 text-xs font-black text-violet-100 ring-1 ring-violet-300/20 hover:bg-violet-500/30"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    Add new supplier
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => setSupplierOnForm(prev, null))
                  }
                  disabled={!selectedSupplierId && !selectedSupplierName}
                  className="rounded-xl bg-white/10 px-4 py-2 text-xs font-black text-white ring-1 ring-white/10 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Clear supplier
                </button>
              </div>

              {activeSuppliers.length === 0 && (
                <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100">
                  No suppliers have been added yet. Add one first, then it will
                  appear in this dropdown.
                </p>
              )}
            </div>
          )}

          {!easyMode && showFullAccountingDetails && canManuallyLinkBudget && (
            <div className="rounded-xl border border-pink-300/25 bg-pink-500/10 p-3 ring-1 ring-pink-300/10">
              <label className="mb-1 block text-sm font-black text-pink-100">
                Which budget is this going to?
              </label>

              <p className="mb-3 text-xs leading-5 text-pink-100/70">
                Pick one of the three options below. A saved or manually typed
                budget is stored on the transaction and sent to the Money
                Tracker table exactly as selected.
              </p>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={useAutoBudgetMatching}
                  className={`rounded-xl px-3 py-3 text-left text-xs font-black ring-1 transition ${
                    budgetSelectionMode === "auto"
                      ? "bg-pink-500 text-white ring-pink-200/60"
                      : "bg-black/25 text-pink-100 ring-pink-300/20 hover:bg-pink-500/15"
                  }`}
                >
                  Auto match
                  <span className="mt-1 block font-semibold opacity-70">
                    Match from title and notes
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setBudgetSelectionMode("saved")}
                  className={`rounded-xl px-3 py-3 text-left text-xs font-black ring-1 transition ${
                    budgetSelectionMode === "saved"
                      ? "bg-pink-500 text-white ring-pink-200/60"
                      : "bg-black/25 text-pink-100 ring-pink-300/20 hover:bg-pink-500/15"
                  }`}
                >
                  Choose saved budget
                  <span className="mt-1 block font-semibold opacity-70">
                    Pick a Budget Planning row
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBudgetSelectionMode("manual");
                    if (selectedBudgetOption) {
                      setBudgetTextDraft("");
                      setForm((prev) => clearBudgetOnForm(prev));
                    }
                  }}
                  className={`rounded-xl px-3 py-3 text-left text-xs font-black ring-1 transition ${
                    budgetSelectionMode === "manual"
                      ? "bg-pink-500 text-white ring-pink-200/60"
                      : "bg-black/25 text-pink-100 ring-pink-300/20 hover:bg-pink-500/15"
                  }`}
                >
                  Type manually
                  <span className="mt-1 block font-semibold opacity-70">
                    Create your own budget name
                  </span>
                </button>
              </div>

              {budgetSelectionMode === "saved" && (
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-black text-pink-100/80">
                    Choose the Budget Planning row
                  </label>

                  <select
                    value={selectedBudgetOption?.category_key || ""}
                    onChange={(event) => chooseBudgetCategory(event.target.value)}
                    className="w-full rounded-xl bg-black/25 p-3 text-white outline-none ring-1 ring-pink-300/25 focus:ring-pink-300/60"
                  >
                    <option className="bg-[#11111f] text-white" value="">
                      Choose a budget...
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
                </div>
              )}

              {budgetSelectionMode === "manual" && (
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-black text-pink-100/80">
                    Type the budget name manually
                  </label>

                  <input
                    value={budgetTextDraft}
                    onChange={(event) => typeBudgetCategory(event.target.value)}
                    placeholder="Example: Venue, Insurance, Printing, Security..."
                    className="w-full rounded-xl bg-black/25 p-3 text-sm font-bold text-white outline-none ring-1 ring-pink-300/25 placeholder:text-white/35 focus:ring-pink-300/60"
                  />

                  <p className="mt-2 text-xs leading-5 text-pink-100/70">
                    The manual name is linked immediately while you type and
                    will be sent to the transaction table when you save.
                  </p>
                </div>
              )}

              {budgetSelectionMode === "auto" ? (
                <p className="mt-3 rounded-xl bg-black/25 px-3 py-2 text-xs text-pink-100/70">
                  Auto match is on. No fixed budget is stored. Budget Planning
                  will match from the title, notes, category and payment details.
                </p>
              ) : selectedBudgetKey ? (
                <div className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-xs leading-5 text-emerald-100">
                  <p className="font-black text-white">Budget link ready</p>
                  <p className="mt-1">
                    This transaction will be sent to the table under: {" "}
                    <strong className="text-white">
                      {selectedBudgetLabel || selectedBudgetKey}
                    </strong>
                  </p>
                  <p className="mt-1 text-emerald-100/75">
                    Saved key: {" "}
                    <span className="font-mono text-white">
                      {selectedBudgetKey}
                    </span>
                  </p>
                </div>
              ) : (
                <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100">
                  Choose a saved budget or type a manual budget name before
                  saving this transaction.
                </p>
              )}

              <button
                type="button"
                onClick={useAutoBudgetMatching}
                disabled={budgetSelectionMode === "auto" && !selectedBudgetKey}
                className="mt-3 rounded-xl bg-white/10 px-4 py-2 text-xs font-black text-white ring-1 ring-white/10 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear budget link and use auto match
              </button>
            </div>
          )}

          {!easyMode && showFullAccountingDetails && (
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

              {form.financeNoteStatus !== "none" &&
                !form.financeNote.trim() && (
                  <p className="mt-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-100 ring-1 ring-amber-300/20">
                    Tip: add a short note so another admin knows what needs
                    doing.
                  </p>
                )}
            </div>
          )}

          {!easyMode &&
            showFullAccountingDetails &&
            !editingTransaction &&
            !isDirectDebit && (
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

          {!easyMode && showFullAccountingDetails && editingTransaction && (
            <div className="rounded-xl border border-purple-300/20 bg-purple-500/10 p-3 text-xs text-purple-100/80">
              Repeating payments can only be created when adding a new
              transaction, not while editing an existing one.
            </div>
          )}

          {form.type === "expense" &&
            !form.sponsorId &&
            !isItemDonation &&
            !isDirectDebit && (
            <label className="flex items-start gap-3 rounded-xl border border-sky-300/20 bg-sky-500/10 p-3">
              <input
                type="checkbox"
                checked={form.isPersonalFunds}
                onChange={(event) =>
                  setForm((prev) => {
                    const nextForm = {
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
                    } as FormState;

                    return event.target.checked
                      ? clearBudgetOnForm(nextForm)
                      : nextForm;
                  })
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

          {form.isPersonalFunds && !form.sponsorId && !isDirectDebit && (
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
            <label className="mb-2 block text-sm font-black text-white">
              {easyMode ? "Step 5 — Choose the date" : "Transaction date"}
            </label>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative w-full">
                <input
                  ref={transactionDateInputRef}
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
                  style={{ colorScheme: "dark" }}
                  className={`w-full rounded-xl bg-black/20 p-3 pr-16 text-white outline-none ring-1 ring-white/10 focus:ring-pink-300/40 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-y-0 [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-14 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 ${
                    easyMode ? "text-base font-bold sm:p-4 sm:pr-16" : ""
                  }`}
                />

                <button
                  type="button"
                  aria-label="Open calendar"
                  title="Open calendar"
                  onClick={() => {
                    const input = transactionDateInputRef.current;

                    if (!input) return;

                    input.focus();

                    if (typeof input.showPicker === "function") {
                      input.showPicker();
                    } else {
                      input.click();
                    }
                  }}
                  className="absolute right-2 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg bg-pink-500 text-white shadow-lg ring-1 ring-pink-200/40 transition hover:bg-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-200"
                >
                  <CalendarDays className="h-5 w-5" strokeWidth={2.5} />
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setDuplicateWarning(null);
                  setDuplicateError(null);

                  setForm((prev) => ({
                    ...prev,
                    transactionDate: todayDateInputValue(),
                  }));
                }}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-pink-500 px-5 py-3 text-sm font-black text-white transition hover:bg-pink-400"
              >
                <CalendarDays className="h-4 w-4" />
                Use Today
              </button>
            </div>

            <p className="mt-2 text-xs text-white/40">
              This transaction will be saved under Jan to Dec{" "}
              {getTransactionYear(form.transactionDate)}.
            </p>
          </div>

          {!easyMode && showFullAccountingDetails && !isItemDonation && (
            <div className="rounded-xl border border-amber-300/20 bg-amber-500/10 p-3">
              <label className="mb-1 block text-sm font-black text-amber-100">
                Receipt due date
              </label>

              <p className="mb-3 text-xs leading-5 text-amber-100/70">
                Choose the date this receipt, invoice, bank screenshot, or proof
                needs to be uploaded by. Leave blank to use the normal automatic
                reminder.
              </p>

              <input
                type="date"
                value={selectedReceiptDueDate}
                onChange={(event) => {
                  const nextDate = event.target.value;

                  setForm((prev) => setReceiptDueDateOnForm(prev, nextDate));

                  if (nextDate) {
                    setForm((prev) => ({
                      ...setReceiptDueDateOnForm(prev, nextDate),
                      financeNoteStatus:
                        prev.financeNoteStatus === "none"
                          ? "waiting_for_receipt"
                          : prev.financeNoteStatus,
                    }));
                  }
                }}
                className="w-full rounded-xl bg-black/20 p-3 text-white outline-none ring-1 ring-amber-300/20 focus:ring-amber-300/50"
              />

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    const nextDate = suggestedReceiptDueDate;

                    if (!nextDate) {
                      return;
                    }

                    setForm((prev) => ({
                      ...setReceiptDueDateOnForm(prev, nextDate),
                      financeNoteStatus:
                        prev.financeNoteStatus === "none"
                          ? "waiting_for_receipt"
                          : prev.financeNoteStatus,
                    }));
                  }}
                  disabled={!suggestedReceiptDueDate}
                  className="rounded-xl bg-amber-500/20 px-3 py-2 text-xs font-black text-amber-100 ring-1 ring-amber-300/20 hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Use suggested date
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => setReceiptDueDateOnForm(prev, ""))
                  }
                  disabled={!selectedReceiptDueDate}
                  className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white ring-1 ring-white/10 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Clear due date
                </button>
              </div>

              <div className="mt-3 rounded-xl bg-black/20 px-3 py-2 text-xs leading-5 text-amber-50">
                {selectedReceiptDueDate ? (
                  <p>
                    Receipt due by{" "}
                    <strong className="text-white">
                      {formatReceiptDueDate(selectedReceiptDueDate)}
                    </strong>
                    .
                  </p>
                ) : suggestedReceiptDueDate ? (
                  <p>
                    Suggested date is{" "}
                    <strong className="text-white">
                      {formatReceiptDueDate(suggestedReceiptDueDate)}
                    </strong>{" "}
                    based on {RECEIPT_DUE_DEFAULT_DAYS} days after the
                    transaction date.
                  </p>
                ) : (
                  <p>
                    Add a transaction date first, then you can choose or use a
                    suggested receipt due date.
                  </p>
                )}
              </div>
            </div>
          )}

          <div>
            {easyMode && (
              <label className="mb-2 block text-sm font-black text-white">
                Step 6 — Add a note{" "}
                <span className="font-semibold text-white/45">(optional)</span>
              </label>
            )}

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
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <label className="mb-2 flex items-center gap-2 text-sm font-bold text-white/70">
              <FileText className="h-4 w-4" />
              {easyMode
                ? "Step 7 — Add receipt or proof (optional)"
                : "Upload files / receipts / invoices"}
            </label>

            <p className="mb-3 text-xs text-white/45">
              {easyMode
                ? "Add a receipt, invoice or bank screenshot now if you have one. You can still save without it."
                : "You can upload more than one file. Useful for receipts, invoices, bank screenshots, emails or supporting documents."}
            </p>

            <input
              ref={receiptInputRef}
              type="file"
              name="receipt_files"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.eml,.msg"
              onChange={(event) => {
                const files = Array.from(event.target.files || []);
                const validationError = validateReceiptFiles(files);

                if (validationError) {
                  setFileError(validationError);
                  receiptFilesRef.current = [];
                  setInvoiceFiles([]);
                  event.currentTarget.value = "";
                  return;
                }

                /*
                 * Update the ref immediately before React schedules the state
                 * update. This guarantees the very latest selected receipt is
                 * available if Save is pressed straight away.
                 */
                receiptFilesRef.current = files;
                setFileError(null);
                setInvoiceFiles(files);
                setMissingReceiptWarningOpen(false);
                saveWithoutReceiptRef.current = false;
              }}
              className="w-full text-sm text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-pink-500 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-pink-400"
            />

            {fileError ? (
              <p role="alert" className="mt-2 rounded-xl border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-100">
                {fileError}
              </p>
            ) : null}

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
                    receiptFilesRef.current = [];
                    setInvoiceFiles([]);

                    if (receiptInputRef.current) {
                      receiptInputRef.current.value = "";
                    }

                    saveWithoutReceiptRef.current = false;
                    setMissingReceiptWarningOpen(false);
                  }}
                  className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-xs font-bold text-red-100 ring-1 ring-red-300/20 hover:bg-red-500/25"
                >
                  Clear selected files
                </button>
              </div>
            )}

            {usableExistingAttachments.length > 0 && (
              <div className="mt-3 rounded-xl bg-sky-500/10 p-3 ring-1 ring-sky-300/20">
                <p className="mb-2 text-xs font-bold text-sky-100">
                  Existing attachments ({usableExistingAttachments.length})
                </p>

                <div className="space-y-2">
                  {usableExistingAttachments.map((attachment, index) => (
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
              usableExistingAttachments.length === 0 &&
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
            disabled={saving || checkingDuplicate || submittingRef.current}
            aria-busy={saving || checkingDuplicate}
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
                  : isDirectDebit
                    ? "Creating monthly Direct Debit plan..."
                    : form.isRepeating
                      ? "Creating repeating payments..."
                      : "Saving..."
                : editingTransaction
                  ? "Update Transaction"
                  : isDirectDebit
                    ? "Create Monthly Direct Debit Plan"
                    : form.isRepeating
                      ? "Create Repeating Payments"
                      : isItemDonation
                      ? "Save Item Donation"
                      : isLoanFunding
                        ? isLoanRepayment
                          ? "Save Loan Repayment"
                          : "Save Loan Spending"
                        : easyMode
                          ? form.type === "income"
                            ? "Save Money In"
                            : "Save Money Out"
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
                  can go back and attach a file, set a receipt due date, or
                  click OK to save without a receipt.
                  {selectedReceiptDueDate && (
                    <span className="mt-2 block font-black text-white">
                      Receipt due by{" "}
                      {formatReceiptDueDate(selectedReceiptDueDate)}
                    </span>
                  )}
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
