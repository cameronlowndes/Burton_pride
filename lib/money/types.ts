export type Transaction = {
  id: string;
  created_at: string;
  title: string;
  description: string | null;
  type: "income" | "expense";
  category: string | null;
  amount_pence: number;
  payment_method: string | null;
  transaction_date: string | null;
  invoice_image_url: string | null;

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

  deleted_at?: string | null;
  deleted_by?: string | null;
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