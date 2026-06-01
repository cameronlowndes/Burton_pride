export type FundingType = "sponsor" | "grant" | "loan" | "other";

export type LoanInterestType = "none" | "fixed" | "percentage";

export type BankReconciliationStatus =
  | "unmatched"
  | "matched"
  | "needs_review"
  | "ignored";

export type FinanceNoteStatus =
  | "none"
  | "waiting_for_receipt"
  | "ask_sponsor"
  | "bank_query"
  | "resolved";

export type TransactionSource =
  | "manual"
  | "website_donation"
  | "website_monthly_donation"
  | "sponsorship"
  | "grant"
  | "loan"
  | "loan_repayment"
  | "loan_interest"
  | string;

export type TransactionAttachment = {
  id: string;
  transaction_id: string;
  file_name: string | null;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
};

export type Transaction = {
  id: string;
  created_at: string;

  /**
   * Unique transaction reference for accounts, receipts and reports.
   * Example: BP-2026-001
   */
  transaction_reference: string | null;

  title: string;
  description: string | null;
  type: "income" | "expense";
  category: string | null;
  amount_pence: number;
  payment_method: string | null;
  transaction_date: string | null;

  /**
   * Bank reconciliation fields.
   * Used to show whether this transaction has been matched to a bank statement.
   */
  bank_reconciliation_status: BankReconciliationStatus | null;
  bank_reconciled_at: string | null;
  bank_reconciled_by: string | null;
  bank_reconciliation_note: string | null;

  /**
   * Finance notes / queries.
   * Used for admin notes such as waiting for receipt, ask sponsor, bank query, or resolved.
   */
  finance_note_status: FinanceNoteStatus | null;
  finance_note: string | null;
  finance_note_updated_at: string | null;
  finance_note_updated_by: string | null;

  /**
   * Old single-file field.
   * Keep this for backwards compatibility with old receipts/invoices.
   */
  invoice_image_url: string | null;

  /**
   * New multiple attachments system.
   * Files are loaded from money_transaction_attachments.
   */
  attachments?: TransactionAttachment[];

  is_personal_funds: boolean | null;
  personal_funds_name: string | null;
  personal_funds_repaid: boolean | null;
  personal_funds_repaid_at: string | null;

  sponsor_id: string | null;
  sponsor_name: string | null;
  sponsorship_note: string | null;

  source: TransactionSource | null;
  stripe_session_id: string | null;
  stripe_invoice_id: string | null;
  stripe_customer_id: string | null;
  stripe_payment_intent_id: string | null;

  /**
   * Stripe mode fields.
   * Test payments should not be counted as real Burton Pride money.
   */
  stripe_livemode?: boolean | null;
  is_test_payment?: boolean | null;

  /**
   * Soft delete fields.
   */
  deleted_at?: string | null;
  deleted_by?: string | null;

  /**
   * Checked by admin fields.
   * Once checked, it cannot be unchecked by another admin.
   */
  checked_at: string | null;
  checked_by: string | null;
};

export type Sponsor = {
  id: string;
  sponsor_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  agreed_amount_pence: number;
  received_amount_pence: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;

  /**
   * Used to choose what kind of funding this record is:
   * sponsor = business/community sponsorship
   * grant = grant money from funders/council/etc
   * loan = money that may need paying back
   * other = any other restricted funding
   */
  funding_type: FundingType | null;

  /**
   * Loan tracking fields.
   * Only used when funding_type is "loan".
   */
  loan_monthly_payment_pence?: number | null;
  loan_interest_type?: LoanInterestType | null;
  loan_interest_pence?: number | null;
  loan_interest_percentage?: number | null;
  loan_due_date?: string | null;
  loan_repayment_terms?: string | null;
  is_loan_paid_off?: boolean | null;
  loan_paid_off_at?: string | null;
};

export type SponsorBreakdown = {
  sponsor_id: string;
  sponsor_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  agreed_amount_pence: number;
  received_pence: number;
  spent_pence: number;
  remaining_pence: number;
  carried_forward_pence?: number;
  notes?: string | null;

  /**
   * Lets the UI show Sponsor, Grant Money, Loan, or Other Funding.
   */
  funding_type: FundingType | null;

  /**
   * Loan tracking breakdown fields.
   * These let the UI show:
   * - monthly repayment
   * - interest
   * - total owed
   * - paid back
   * - still to repay
   * - due date
   */
  loan_monthly_payment_pence?: number | null;
  loan_interest_type?: LoanInterestType | null;
  loan_interest_pence?: number | null;
  loan_interest_percentage?: number | null;
  loan_repaid_pence?: number | null;
  loan_total_owed_pence?: number | null;
  loan_remaining_pence?: number | null;
  loan_due_date?: string | null;
  loan_repayment_terms?: string | null;
  is_loan_paid_off?: boolean | null;
  loan_paid_off_at?: string | null;
};

export type CarryForwardNote = {
  /**
   * All previous years' general income.
   * Does not include restricted sponsor/grant/loan funding.
   */
  previousIncome: number;

  /**
   * All previous years' general Burton Pride spending.
   * Does not include sponsor/grant restricted spending.
   */
  previousNormalExpense: number;

  /**
   * Previous personal funds that have been paid back.
   * These reduce the carried-forward general balance.
   */
  previousPersonalFundsRepaid: number;

  /**
   * Final opening balance for the selected year.
   */
  openingBalance: number;

  /**
   * Counts shown in the carry-forward note UI.
   */
  previousTransactionCount: number;
  previousIncomeCount: number;
  previousNormalExpenseCount: number;
  previousPersonalFundsRepaidCount: number;

  /**
   * Plain-English formula for accounts.
   */
  formula: string;
};

export type RepeatFrequency = "weekly" | "monthly" | "yearly";

export type FormState = {
  title: string;
  description: string;
  type: "income" | "expense";
  category: string;
  amount: string;
  paymentMethod: string;
  transactionDate: string;
  isPersonalFunds: boolean;
  personalFundsName: string;
  sponsorId: string;
  sponsorName: string;
  sponsorshipNote: string;

  /**
   * Bank reconciliation fields.
   */
  bankReconciliationStatus: BankReconciliationStatus;
  bankReconciliationNote: string;

  /**
   * Finance notes / queries.
   */
  financeNoteStatus: FinanceNoteStatus;
  financeNote: string;

  isRepeating: boolean;
  repeatFrequency: RepeatFrequency;
  repeatCount: string;
};

export type SponsorFormState = {
  fundingType: FundingType;
  sponsorName: string;
  contactName: string;
  email: string;
  phone: string;
  agreedAmount: string;
  receivedAmount: string;
  notes: string;

  /**
   * Loan-only form fields.
   * These are shown when fundingType is "loan".
   */
  loanMonthlyPayment: string;
  loanInterestType: LoanInterestType;
  loanInterestAmount: string;
  loanDueDate: string;
  loanRepaymentTerms: string;
};

export type LoanRepaymentFormState = {
  sponsorId: string;
  sponsorName: string;
  amount: string;
  paymentMethod: string;
  transactionDate: string;
  note: string;
};

export type LoanInterestFormState = {
  sponsorId: string;
  sponsorName: string;
  amount: string;
  transactionDate: string;
  note: string;
};

export type MoneyTotals = {
  openingBalance: number;
  income: number;
  normalExpense: number;
  expense: number;
  personalFunds: number;
  personalFundsRepaid: number;
  personalFundsOutstanding: number;
  sponsorshipIncome: number;
  sponsorshipSpent: number;
  sponsorshipRemaining: number;
  balance: number;
};

export const initialForm: FormState = {
  title: "",
  description: "",
  type: "income",
  category: "",
  amount: "",
  paymentMethod: "",
  transactionDate: new Date().toISOString().slice(0, 10),
  isPersonalFunds: false,
  personalFundsName: "",
  sponsorId: "",
  sponsorName: "",
  sponsorshipNote: "",

  bankReconciliationStatus: "unmatched",
  bankReconciliationNote: "",

  financeNoteStatus: "none",
  financeNote: "",

  isRepeating: false,
  repeatFrequency: "monthly",
  repeatCount: "12",
};

export const initialSponsorForm: SponsorFormState = {
  fundingType: "sponsor",
  sponsorName: "",
  contactName: "",
  email: "",
  phone: "",
  agreedAmount: "",
  receivedAmount: "",
  notes: "",

  loanMonthlyPayment: "",
  loanInterestType: "none",
  loanInterestAmount: "",
  loanDueDate: "",
  loanRepaymentTerms: "",
};

export const initialLoanRepaymentForm: LoanRepaymentFormState = {
  sponsorId: "",
  sponsorName: "",
  amount: "",
  paymentMethod: "Bank Transfer",
  transactionDate: new Date().toISOString().slice(0, 10),
  note: "",
};

export const initialLoanInterestForm: LoanInterestFormState = {
  sponsorId: "",
  sponsorName: "",
  amount: "",
  transactionDate: new Date().toISOString().slice(0, 10),
  note: "",
};

export const paymentMethods = [
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

export const financeNoteStatusOptions: {
  value: FinanceNoteStatus;
  label: string;
}[] = [
  {
    value: "none",
    label: "No query",
  },
  {
    value: "waiting_for_receipt",
    label: "Waiting for receipt",
  },
  {
    value: "ask_sponsor",
    label: "Ask sponsor",
  },
  {
    value: "bank_query",
    label: "Bank query",
  },
  {
    value: "resolved",
    label: "Resolved",
  },
];