export type FundingType = "sponsor" | "grant" | "loan" | "other";

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

  source: string | null;
  stripe_session_id: string | null;
  stripe_invoice_id: string | null;
  stripe_customer_id: string | null;
  stripe_payment_intent_id: string | null;

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
];