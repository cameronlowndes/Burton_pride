"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SyntheticEvent } from "react";

import type {
  BankReconciliationStatus,
  FinanceNoteStatus,
  FormState,
  LoanInterestFormState,
  LoanRepaymentFormState,
  Sponsor,
  SponsorBreakdown,
  SponsorFormState,
  Transaction,
} from "@/lib/money/types";

import {
  initialLoanInterestForm,
  initialLoanRepaymentForm,
} from "@/lib/money/types";

import {
  addRepeatingDate,
  getTransactionMonthKey,
  getTransactionYear,
  isPersonalFundsTransaction,
  isSponsorshipTransaction,
  monthNameFromKey,
  repeatFrequencyLabel,
  sponsorNameMatches,
} from "@/lib/money/utils";

import {
  exportFullYearlyReportFile,
  exportTransactionsToExcelFile,
} from "@/lib/money/excel";

import { printMoneyReport } from "@/lib/money/print";

type YearLock = {
  id?: string;
  year: string;
  is_locked: boolean;
  locked_at?: string | null;
  locked_by?: string | null;
  unlocked_at?: string | null;
  unlocked_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type MonthLock = {
  id?: string;
  year: string;
  month_key: string;
  is_locked: boolean;
  locked_at?: string | null;
  locked_by?: string | null;
  unlocked_at?: string | null;
  unlocked_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type BudgetItem = {
  id?: string | null;
  year: string;
  category_key: string;
  category_label: string;
  planned_amount_pence: number;
  notes?: string | null;
};

type CarryForwardNote = {
  selectedYear: string;
  previousIncome: number;
  previousNormalExpense: number;
  previousPersonalFundsRepaid: number;
  openingBalance: number;
  previousTransactionCount: number;
  previousIncomeCount: number;
  previousNormalExpenseCount: number;
  previousPersonalFundsRepaidCount: number;
  formula: string;
};

type LoanActionFunding = SponsorBreakdown & {
  loan_monthly_payment_pence?: number | null;
  loan_interest_type?: "none" | "fixed" | "percentage" | string | null;
  loan_interest_pence?: number | null;
  loan_interest_percentage?: number | null;
  loan_repaid_pence?: number | null;
  loan_remaining_pence?: number | null;
  loan_total_owed_pence?: number | null;
  loan_due_date?: string | null;
  loan_repayment_terms?: string | null;
  is_loan_paid_off?: boolean | null;
  loan_paid_off_at?: string | null;
};

const initialForm: FormState = {
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

const initialSponsorForm: SponsorFormState = {
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

async function readJsonResponse(res: Response) {
  const text = await res.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { rawResponse: text };
  }
}

function makeAmountSearchValues(amountPence: number | null | undefined) {
  const pence = Number(amountPence || 0);
  const pounds = pence / 100;

  const poundsFixed = pounds.toFixed(2);
  const poundsNoTrailingZeros = pounds.toString();
  const poundsWithComma = pounds.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return [
    String(pence),
    poundsNoTrailingZeros,
    poundsFixed,
    poundsWithComma,
    `£${poundsNoTrailingZeros}`,
    `£${poundsFixed}`,
    `£${poundsWithComma}`,
  ].map((value) => value.toLowerCase());
}

function getFundingTypeLabel(type?: string | null) {
  if (type === "grant") return "grant";
  if (type === "loan") return "loan";
  if (type === "other") return "funding";
  return "sponsor";
}

function isNormalMoneyInTransaction(item: Transaction) {
  return item.type === "income" && !hasFundingLink(item);
}

function isNormalMoneyOutTransaction(item: Transaction) {
  return (
    item.type === "expense" &&
    !isPersonalFundsTransaction(item) &&
    !hasFundingLink(item)
  );
}

function isPersonalFundsExpenseTransaction(item: Transaction) {
  return item.type === "expense" && isPersonalFundsTransaction(item);
}

function isPaidBackPersonalFundsExpense(item: Transaction) {
  return (
    isPersonalFundsExpenseTransaction(item) &&
    item.personal_funds_repaid === true
  );
}

function hasFundingLink(item: Transaction) {
  const source = String(item.source || "");

  return (
    isSponsorshipTransaction(item) ||
    source === "sponsorship" ||
    source === "grant" ||
    source === "loan" ||
    source === "loan_repayment" ||
    source === "loan_interest" ||
    Boolean(item.sponsor_id || item.sponsor_name)
  );
}

function isLoanRepaymentTransaction(item: Transaction) {
  return String(item.source || "") === "loan_repayment";
}

function isLoanInterestTransaction(item: Transaction) {
  return String(item.source || "") === "loan_interest";
}

function getLoanMode(category: string | null | undefined) {
  return category === "Loan Spending" ? "Loan Spending" : "Loan Repayment";
}

function isLoanSpendingTransaction(item: Transaction) {
  return String(item.source || "") === "loan";
}

function poundsToPence(value: string) {
  const amount = Number(String(value || "").replace(/,/g, ""));

  if (!Number.isFinite(amount)) return 0;

  return Math.round(amount * 100);
}

function calculatePercentageInterestPence(
  principalPence: number,
  percentage: number | null | undefined
) {
  const cleanPercentage = Number(percentage || 0);

  if (!Number.isFinite(cleanPercentage) || cleanPercentage <= 0) {
    return 0;
  }

  return Math.round(principalPence * (cleanPercentage / 100));
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentMonthKey() {
  return `${new Date().getFullYear()}-${String(
    new Date().getMonth() + 1
  ).padStart(2, "0")}`;
}

export function useMoneyTransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [sponsorBreakdown, setSponsorBreakdown] = useState<SponsorBreakdown[]>(
    []
  );

  const [yearLocks, setYearLocks] = useState<YearLock[]>([]);
  const [yearLockPassword, setYearLockPassword] = useState("");
  const [lockingYear, setLockingYear] = useState(false);

  const [monthLocks, setMonthLocks] = useState<MonthLock[]>([]);
  const [selectedLockMonth, setSelectedLockMonth] =
    useState<string>(getCurrentMonthKey());
  const [monthLockPassword, setMonthLockPassword] = useState("");
  const [lockingMonth, setLockingMonth] = useState(false);

  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [savingBudget, setSavingBudget] = useState(false);

  const [form, setForm] = useState<FormState>(initialForm);
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);

  const [filter, setFilter] = useState<
    "all" | "income" | "expense" | "sponsorship" | "personal"
  >("all");

  const [selectedSponsorId, setSelectedSponsorId] = useState<string>("all");
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<string>("all");

  const [selectedYear, setSelectedYear] = useState<string>(
    new Date().getFullYear().toString()
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPrintMonth, setSelectedPrintMonth] = useState<string>("all");
  const [selectedViewMonth, setSelectedViewMonth] = useState<string>("all");

  const [deleteYearOpen, setDeleteYearOpen] = useState(false);
  const [deletingYear, setDeletingYear] = useState(false);
  const [deleteYearPassword, setDeleteYearPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [deleteAllPassword, setDeleteAllPassword] = useState("");

  const [repayingId, setRepayingId] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [bankReconcilingId, setBankReconcilingId] = useState<string | null>(
    null
  );
  const [financeNoteUpdatingId, setFinanceNoteUpdatingId] = useState<
    string | null
  >(null);

  const [sponsorFormOpen, setSponsorFormOpen] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null);
  const [savingSponsor, setSavingSponsor] = useState(false);
  const [sponsorForm, setSponsorForm] =
    useState<SponsorFormState>(initialSponsorForm);

  const [deleteSponsorId, setDeleteSponsorId] = useState<string | null>(null);
  const [deletingSponsor, setDeletingSponsor] = useState(false);

  const [loanRepaymentSponsor, setLoanRepaymentSponsor] =
    useState<LoanActionFunding | null>(null);
  const [loanRepaymentForm, setLoanRepaymentForm] =
    useState<LoanRepaymentFormState>(initialLoanRepaymentForm);
  const [savingLoanRepayment, setSavingLoanRepayment] = useState(false);

  const [loanInterestSponsor, setLoanInterestSponsor] =
    useState<LoanActionFunding | null>(null);
  const [loanInterestForm, setLoanInterestForm] =
    useState<LoanInterestFormState>(initialLoanInterestForm);
  const [savingLoanInterest, setSavingLoanInterest] = useState(false);

  const [error, setError] = useState("");
  const [errorDetails, setErrorDetails] = useState<any>(null);

  const [stripeSyncing, setStripeSyncing] = useState(false);
  const [stripeSyncMessage, setStripeSyncMessage] = useState<string | null>(
    null
  );
  const [stripeSyncError, setStripeSyncError] = useState<string | null>(null);

  const displaySponsors = useMemo(() => {
    if (sponsors.length > 0) return sponsors;

    return sponsorBreakdown.map((item) => ({
      id: item.sponsor_id,
      sponsor_name: item.sponsor_name,
      contact_name: item.contact_name,
      email: item.email,
      phone: item.phone,
      agreed_amount_pence: item.agreed_amount_pence,
      received_amount_pence: item.received_pence,
      notes: item.notes || null,
      is_active: true,
      created_at: "",
      funding_type: item.funding_type || "sponsor",
      loan_monthly_payment_pence: item.loan_monthly_payment_pence || 0,
      loan_interest_type: item.loan_interest_type || "none",
      loan_interest_pence: item.loan_interest_pence || 0,
      loan_interest_percentage: item.loan_interest_percentage || 0,
      loan_due_date: item.loan_due_date || null,
      loan_repayment_terms: item.loan_repayment_terms || null,
      is_loan_paid_off: item.is_loan_paid_off || false,
      loan_paid_off_at: item.loan_paid_off_at || null,
    }));
  }, [sponsors, sponsorBreakdown]);

  async function loadTransactions() {
    try {
      setLoading(true);
      setError("");
      setErrorDetails(null);

      const res = await fetch(`/api/admin/money/transactions?t=${Date.now()}`, {
        cache: "no-store",
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        throw {
          message: data.error || "Failed to load transactions",
          details: data,
          status: res.status,
        };
      }

      setTransactions(
        (data.transactions || []).filter(
          (item: Transaction) => !item.deleted_at
        )
      );
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
      setErrorDetails(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadSponsors() {
    try {
      setError("");
      setErrorDetails(null);

      const res = await fetch(`/api/admin/money/sponsors?t=${Date.now()}`, {
        cache: "no-store",
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        throw {
          message: data.error || "Failed to load funding records",
          details: data,
          status: res.status,
        };
      }

      setSponsors(data.sponsors || []);
      setSponsorBreakdown(data.breakdown || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load funding records");
      setErrorDetails(err);
    }
  }

  async function loadYearLocks() {
    try {
      setError("");
      setErrorDetails(null);

      const res = await fetch(`/api/admin/money/year-locks?t=${Date.now()}`, {
        cache: "no-store",
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        throw {
          message: data.error || "Failed to load year locks",
          details: data,
          status: res.status,
        };
      }

      setYearLocks(data.locks || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load year locks");
      setErrorDetails(err);
    }
  }

  async function loadMonthLocks() {
    try {
      setError("");
      setErrorDetails(null);

      const res = await fetch(`/api/admin/money/month-locks?t=${Date.now()}`, {
        cache: "no-store",
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        throw {
          message: data.error || "Failed to load month locks",
          details: data,
          status: res.status,
        };
      }

      setMonthLocks(data.locks || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load month locks");
      setErrorDetails(err);
    }
  }

  async function loadBudgetItems() {
    try {
      setError("");
      setErrorDetails(null);

      const res = await fetch(
        `/api/admin/money/budget?year=${selectedYear}&t=${Date.now()}`,
        {
          cache: "no-store",
        }
      );

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        throw {
          message: data.error || "Failed to load budget planning.",
          details: data,
          status: res.status,
        };
      }

      setBudgetItems(data.budgetItems || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load budget planning.");
      setErrorDetails(err);
    }
  }

  async function saveBudgetItems(items: BudgetItem[]) {
    try {
      setSavingBudget(true);
      setError("");
      setErrorDetails(null);

      const res = await fetch("/api/admin/money/budget", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          year: selectedYear,
          items,
        }),
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        throw {
          message: data.error || "Failed to save budget planning.",
          details: data,
          status: res.status,
        };
      }

      await loadBudgetItems();
    } catch (err: any) {
      setError(err?.message || "Failed to save budget planning.");
      setErrorDetails(err);
    } finally {
      setSavingBudget(false);
    }
  }

  async function syncStripeDonations() {
    try {
      setStripeSyncing(true);
      setStripeSyncMessage(null);
      setStripeSyncError(null);
      setError("");
      setErrorDetails(null);

      const res = await fetch(`/api/admin/money/sync-stripe?t=${Date.now()}`, {
        method: "POST",
        cache: "no-store",
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        throw {
          message: data.error || "Failed to sync Stripe donations",
          details: data,
          status: res.status,
        };
      }

      const created = Number(data.created || 0);
      const updated = Number(data.updated || 0);
      const skipped = Number(data.skipped || 0);

      setStripeSyncMessage(
        `Stripe sync complete. Added ${created}, updated ${updated}, skipped ${skipped}. Manual transactions were not changed.`
      );

      await loadTransactions();
      await loadSponsors();
      await loadYearLocks();
      await loadMonthLocks();
      await loadBudgetItems();
    } catch (err: any) {
      const message =
        err?.message || "Something went wrong syncing Stripe donations.";

      setStripeSyncError(message);
      setError(message);
      setErrorDetails(err);
    } finally {
      setStripeSyncing(false);
    }
  }

  useEffect(() => {
    loadTransactions();
    loadSponsors();
    loadYearLocks();
    loadMonthLocks();
    loadBudgetItems();
  }, []);

  useEffect(() => {
    loadBudgetItems();
  }, [selectedYear]);

  const selectedSponsor = useMemo(() => {
    if (selectedSponsorId === "all") return null;

    return (
      displaySponsors.find((sponsor) => sponsor.id === selectedSponsorId) ||
      null
    );
  }, [displaySponsors, selectedSponsorId]);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();

    const years = new Set<string>([
      String(currentYear - 2),
      String(currentYear - 1),
      String(currentYear),
      String(currentYear + 1),
      String(currentYear + 2),
    ]);

    transactions.forEach((item) => {
      years.add(getTransactionYear(item.transaction_date || item.created_at));
    });

    displaySponsors.forEach((sponsor) => {
      if (sponsor.created_at) {
        years.add(getTransactionYear(sponsor.created_at));
      }
    });

    yearLocks.forEach((lock) => {
      if (lock.year) {
        years.add(String(lock.year));
      }
    });

    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [transactions, displaySponsors, yearLocks]);

  const selectedYearLock = useMemo(() => {
    return yearLocks.find((item) => String(item.year) === selectedYear) || null;
  }, [yearLocks, selectedYear]);

  const selectedYearLocked = Boolean(selectedYearLock?.is_locked);

  const selectedMonthLock = useMemo(() => {
    return (
      monthLocks.find((item) => item.month_key === selectedLockMonth) || null
    );
  }, [monthLocks, selectedLockMonth]);

  const selectedMonthLocked = Boolean(selectedMonthLock?.is_locked);

  function isYearLocked(year: string) {
    return yearLocks.some(
      (item) => String(item.year) === String(year) && item.is_locked === true
    );
  }

  function isMonthLocked(monthKey: string) {
    return monthLocks.some(
      (item) => item.month_key === monthKey && item.is_locked === true
    );
  }

  function getLockMessage(date: string | null | undefined) {
    const safeDate = date || getTodayDate();
    const year = getTransactionYear(safeDate);
    const monthKey = getTransactionMonthKey(safeDate);

    if (isYearLocked(year)) {
      return `${year} is locked. Unlock this year with the main admin password before making changes.`;
    }

    if (isMonthLocked(monthKey)) {
      return `${monthKey} is locked. Unlock this month with the main admin password before making changes.`;
    }

    return "";
  }

  const yearTransactions = useMemo(() => {
    return transactions.filter((item) => {
      const year = getTransactionYear(item.transaction_date || item.created_at);
      return year === selectedYear;
    });
  }, [transactions, selectedYear]);

  const printMonthOptions = useMemo(() => {
    const months = Array.from({ length: 12 }).map((_, index) => {
      const monthNumber = String(index + 1).padStart(2, "0");
      const key = `${selectedYear}-${monthNumber}`;
      const date = new Date(Number(selectedYear), index, 1);

      const count = yearTransactions.filter((item) => {
        return (
          getTransactionMonthKey(item.transaction_date || item.created_at) ===
          key
        );
      }).length;

      return {
        key,
        label: date.toLocaleDateString("en-GB", {
          month: "long",
        }),
        count,
      };
    });

    return [
      {
        key: "all",
        label: "Full year",
        count: yearTransactions.length,
      },
      ...months,
    ];
  }, [selectedYear, yearTransactions]);

  const monthViewTransactions = useMemo(() => {
    if (selectedViewMonth === "all") return yearTransactions;

    return yearTransactions.filter((item) => {
      return (
        getTransactionMonthKey(item.transaction_date || item.created_at) ===
        selectedViewMonth
      );
    });
  }, [yearTransactions, selectedViewMonth]);

  const previousYearTransactions = useMemo(() => {
    return transactions.filter((item) => {
      const year = Number(
        getTransactionYear(item.transaction_date || item.created_at)
      );

      return year < Number(selectedYear);
    });
  }, [transactions, selectedYear]);

  const carryForwardNote = useMemo<CarryForwardNote>(() => {
    const previousIncomeTransactions = previousYearTransactions.filter(
      isNormalMoneyInTransaction
    );

    const previousNormalExpenseTransactions = previousYearTransactions.filter(
      isNormalMoneyOutTransaction
    );

    const previousPersonalFundsRepaidTransactions =
      previousYearTransactions.filter(isPaidBackPersonalFundsExpense);

    const previousIncome = previousIncomeTransactions.reduce(
      (sum, item) => sum + (item.amount_pence || 0),
      0
    );

    const previousNormalExpense = previousNormalExpenseTransactions.reduce(
      (sum, item) => sum + (item.amount_pence || 0),
      0
    );

    const previousPersonalFundsRepaid =
      previousPersonalFundsRepaidTransactions.reduce(
        (sum, item) => sum + (item.amount_pence || 0),
        0
      );

    const openingBalance =
      previousIncome - previousNormalExpense - previousPersonalFundsRepaid;

    return {
      selectedYear,
      previousIncome,
      previousNormalExpense,
      previousPersonalFundsRepaid,
      openingBalance,
      previousTransactionCount: previousYearTransactions.length,
      previousIncomeCount: previousIncomeTransactions.length,
      previousNormalExpenseCount: previousNormalExpenseTransactions.length,
      previousPersonalFundsRepaidCount:
        previousPersonalFundsRepaidTransactions.length,
      formula:
        "Previous general income - previous general spending - previous personal funds paid back = opening balance",
    };
  }, [previousYearTransactions, selectedYear]);

  const carryForward = carryForwardNote.openingBalance;

  const yearlySponsorBreakdown = useMemo(() => {
    return displaySponsors
      .map((rawSponsor) => {
        const sponsor = rawSponsor as Sponsor & {
          loan_monthly_payment_pence?: number | null;
          loan_interest_pence?: number | null;
          loan_interest_type?: string | null;
          loan_interest_percentage?: number | null;
          loan_repayment_terms?: string | null;
          loan_due_date?: string | null;
          is_loan_paid_off?: boolean | null;
          loan_paid_off_at?: string | null;
        };

        const fundingType = sponsor.funding_type || "sponsor";
        const isLoan = fundingType === "loan";

        const thisYearSponsorTransactions = yearTransactions.filter((item) => {
          if (!hasFundingLink(item)) return false;

          return (
            item.sponsor_id === sponsor.id ||
            sponsorNameMatches(item.sponsor_name, sponsor.sponsor_name)
          );
        });

        const previousSponsorTransactions = previousYearTransactions.filter(
          (item) => {
            if (!hasFundingLink(item)) return false;

            return (
              item.sponsor_id === sponsor.id ||
              sponsorNameMatches(item.sponsor_name, sponsor.sponsor_name)
            );
          }
        );

        const previousReceived = previousSponsorTransactions
          .filter((item) => item.type === "income")
          .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

        const previousSpent = previousSponsorTransactions
          .filter((item) => item.type === "expense")
          .filter((item) => !isLoanInterestTransaction(item))
          .filter((item) => !isLoanRepaymentTransaction(item))
          .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

        const previousLoanInterest = previousSponsorTransactions
          .filter(isLoanInterestTransaction)
          .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

        const previousLoanRepaid = previousSponsorTransactions
          .filter(isLoanRepaymentTransaction)
          .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

        const sponsorCreatedYear = sponsor.created_at
          ? getTransactionYear(sponsor.created_at)
          : "";

        const sponsorStartedBeforeThisYear =
          sponsorCreatedYear &&
          Number(sponsorCreatedYear) < Number(selectedYear);

        const sponsorStartedThisYear = sponsorCreatedYear === selectedYear;

        const manualReceivedFromSponsorRecord =
          sponsorStartedThisYear || sponsorStartedBeforeThisYear
            ? sponsor.received_amount_pence || 0
            : 0;

        const previousCarryForward = isLoan
          ? 0
          : sponsorStartedBeforeThisYear && previousReceived === 0
            ? manualReceivedFromSponsorRecord - previousSpent
            : previousReceived - previousSpent;

        const safeCarryForward = Math.max(previousCarryForward, 0);

        const receivedFromTransactions = thisYearSponsorTransactions
          .filter((item) => item.type === "income")
          .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

        const spentPence = thisYearSponsorTransactions
          .filter((item) => item.type === "expense")
          .filter((item) => !isLoanInterestTransaction(item))
          .filter((item) => !isLoanRepaymentTransaction(item))
          .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

        const loanInterestThisYear = thisYearSponsorTransactions
          .filter(isLoanInterestTransaction)
          .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

        const loanRepaidThisYear = thisYearSponsorTransactions
          .filter(isLoanRepaymentTransaction)
          .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

        const receivedPence = isLoan
          ? receivedFromTransactions ||
            (sponsorStartedThisYear || sponsorStartedBeforeThisYear
              ? sponsor.received_amount_pence || 0
              : 0)
          : safeCarryForward + receivedFromTransactions ||
            (sponsorStartedThisYear ? sponsor.received_amount_pence || 0 : 0);

        const agreedPence =
          sponsorStartedThisYear ||
          sponsorStartedBeforeThisYear ||
          thisYearSponsorTransactions.length > 0
            ? sponsor.agreed_amount_pence || 0
            : 0;

        const loanInterestType = sponsor.loan_interest_type || "none";

        const fixedLoanInterestPence =
          isLoan && loanInterestType === "fixed"
            ? Number(sponsor.loan_interest_pence || 0)
            : 0;

        const percentageLoanInterestPence =
          isLoan && loanInterestType === "percentage"
            ? calculatePercentageInterestPence(
                receivedPence,
                sponsor.loan_interest_percentage
              )
            : 0;

        const totalLoanInterestPence = isLoan
          ? fixedLoanInterestPence +
            percentageLoanInterestPence +
            previousLoanInterest +
            loanInterestThisYear
          : 0;

        const totalLoanRepaidPence = isLoan
          ? previousLoanRepaid + loanRepaidThisYear
          : 0;

        const loanTotalOwedPence = isLoan
          ? receivedPence + totalLoanInterestPence
          : 0;

        const loanRemainingPence = isLoan
          ? Math.max(loanTotalOwedPence - totalLoanRepaidPence, 0)
          : 0;

        return {
          sponsor_id: sponsor.id,
          sponsor_name: sponsor.sponsor_name,
          contact_name: sponsor.contact_name,
          email: sponsor.email,
          phone: sponsor.phone,
          agreed_amount_pence: agreedPence,
          received_pence: receivedPence,
          spent_pence: spentPence,
          remaining_pence: isLoan ? receivedPence : receivedPence - spentPence,
          carried_forward_pence: safeCarryForward,
          notes: sponsor.notes,
          funding_type: fundingType,

          loan_monthly_payment_pence: Number(
            sponsor.loan_monthly_payment_pence || 0
          ),
          loan_interest_type: loanInterestType,
          loan_interest_pence: totalLoanInterestPence,
          loan_interest_percentage: Number(
            sponsor.loan_interest_percentage || 0
          ),
          loan_repaid_pence: totalLoanRepaidPence,
          loan_total_owed_pence: loanTotalOwedPence,
          loan_remaining_pence: loanRemainingPence,
          loan_due_date: sponsor.loan_due_date || null,
          loan_repayment_terms: sponsor.loan_repayment_terms || null,
          is_loan_paid_off:
            Boolean(sponsor.is_loan_paid_off) ||
            (isLoan && loanTotalOwedPence > 0 && loanRemainingPence <= 0),
          loan_paid_off_at: sponsor.loan_paid_off_at || null,
        };
      })
      .filter(
        (sponsor) =>
          sponsor.agreed_amount_pence > 0 ||
          sponsor.received_pence > 0 ||
          sponsor.spent_pence > 0 ||
          sponsor.loan_interest_pence > 0 ||
          sponsor.loan_repaid_pence > 0 ||
          (sponsor.carried_forward_pence || 0) > 0
      );
  }, [
    displaySponsors,
    yearTransactions,
    previousYearTransactions,
    selectedYear,
  ]);

  const filteredTransactions = useMemo(() => {
    let rows = monthViewTransactions;

    if (filter === "income") {
      rows = rows.filter((item) => item.type === "income");
    }

    if (filter === "expense") {
      rows = rows.filter((item) => item.type === "expense");
    }

    if (filter === "personal") {
      rows = rows.filter((item) => isPersonalFundsTransaction(item));
    }

    if (filter === "sponsorship") {
      rows = rows.filter((item) => hasFundingLink(item));
    }

    if (selectedSponsorId !== "all") {
      const sponsor = displaySponsors.find(
        (item) => item.id === selectedSponsorId
      );

      rows = rows.filter((item) => {
        return (
          item.sponsor_id === selectedSponsorId ||
          sponsorNameMatches(item.sponsor_name, sponsor?.sponsor_name)
        );
      });
    }

    if (selectedPaymentMethod !== "all") {
      rows = rows.filter((item) => {
        if (selectedPaymentMethod === "Personal Funds") {
          return (
            item.payment_method === "Personal Funds" ||
            isPersonalFundsTransaction(item)
          );
        }

        return item.payment_method === selectedPaymentMethod;
      });
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();

      rows = rows.filter((item) => {
        const amountSearchValues = makeAmountSearchValues(item.amount_pence);

        const matchesAmount = amountSearchValues.some((value) =>
          value.includes(q)
        );

        const matchesAttachment = (item.attachments || []).some((file) => {
          return (
            file.file_name?.toLowerCase().includes(q) ||
            file.file_url?.toLowerCase().includes(q) ||
            file.file_type?.toLowerCase().includes(q)
          );
        });

        return (
          item.transaction_reference?.toLowerCase().includes(q) ||
          item.title?.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.payment_method?.toLowerCase().includes(q) ||
          item.sponsor_name?.toLowerCase().includes(q) ||
          item.sponsorship_note?.toLowerCase().includes(q) ||
          item.personal_funds_name?.toLowerCase().includes(q) ||
          item.checked_by?.toLowerCase().includes(q) ||
          item.bank_reconciliation_status?.toLowerCase().includes(q) ||
          item.bank_reconciled_by?.toLowerCase().includes(q) ||
          item.bank_reconciliation_note?.toLowerCase().includes(q) ||
          item.finance_note_status?.toLowerCase().includes(q) ||
          item.finance_note?.toLowerCase().includes(q) ||
          item.finance_note_updated_by?.toLowerCase().includes(q) ||
          matchesAttachment ||
          matchesAmount
        );
      });
    }

    return rows;
  }, [
    monthViewTransactions,
    filter,
    selectedSponsorId,
    selectedPaymentMethod,
    displaySponsors,
    searchTerm,
  ]);

  const printTransactionsList = useMemo(() => {
    if (selectedPrintMonth === "all") return filteredTransactions;

    return filteredTransactions.filter((item) => {
      return (
        getTransactionMonthKey(item.transaction_date || item.created_at) ===
        selectedPrintMonth
      );
    });
  }, [filteredTransactions, selectedPrintMonth]);

  const totals = useMemo(() => {
    const income = yearTransactions
      .filter(isNormalMoneyInTransaction)
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    const normalExpense = yearTransactions
      .filter(isNormalMoneyOutTransaction)
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    const personalFunds = yearTransactions
      .filter(isPersonalFundsExpenseTransaction)
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    const personalFundsRepaid = yearTransactions
      .filter(isPaidBackPersonalFundsExpense)
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    const sponsorshipIncome = yearlySponsorBreakdown.reduce(
      (sum, item) => sum + (item.received_pence || 0),
      0
    );

    const sponsorshipSpent = yearlySponsorBreakdown.reduce(
      (sum, item) => sum + (item.spent_pence || 0),
      0
    );

    const personalFundsOutstanding = personalFunds - personalFundsRepaid;
    const expense = normalExpense + personalFundsRepaid;

    return {
      openingBalance: carryForward,
      income,
      normalExpense,
      expense,
      personalFunds,
      personalFundsRepaid,
      personalFundsOutstanding,
      sponsorshipIncome,
      sponsorshipSpent,
      sponsorshipRemaining: sponsorshipIncome - sponsorshipSpent,
      balance: carryForward + income - expense,
    };
  }, [yearTransactions, yearlySponsorBreakdown, carryForward]);

  const filteredTotals = useMemo(() => {
    const income = printTransactionsList
      .filter(isNormalMoneyInTransaction)
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    const normalExpense = printTransactionsList
      .filter(isNormalMoneyOutTransaction)
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    const personalFunds = printTransactionsList
      .filter(isPersonalFundsExpenseTransaction)
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    const personalFundsRepaid = printTransactionsList
      .filter(isPaidBackPersonalFundsExpense)
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    const sponsorshipIncome = printTransactionsList
      .filter((item) => item.type === "income" && isSponsorshipTransaction(item))
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    const sponsorshipSpent = printTransactionsList
      .filter(
        (item) => item.type === "expense" && isSponsorshipTransaction(item)
      )
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    const personalFundsOutstanding = personalFunds - personalFundsRepaid;
    const expense = normalExpense + personalFundsRepaid;

    return {
      income,
      normalExpense,
      expense,
      personalFunds,
      personalFundsRepaid,
      personalFundsOutstanding,
      sponsorshipIncome,
      sponsorshipSpent,
      sponsorshipRemaining: sponsorshipIncome - sponsorshipSpent,
      balance: totals.openingBalance + income - expense,
    };
  }, [printTransactionsList, totals.openingBalance]);

  function openNewSponsorForm() {
    setEditingSponsor(null);
    setSponsorForm(initialSponsorForm);
    setSponsorFormOpen(true);
  }

  function startEditSponsor(sponsorId: string) {
    if (selectedYearLocked) {
      setError(
        `${selectedYear} is locked. Unlock this year with the main admin password before editing funding records.`
      );
      return;
    }

    const sponsor = displaySponsors.find((item) => item.id === sponsorId);

    if (!sponsor) {
      setError("Could not find funding record to edit.");
      return;
    }

    setEditingSponsor(sponsor);

    const editableSponsor = sponsor as Sponsor & {
      loan_monthly_payment_pence?: number | null;
      loan_interest_type?: "none" | "fixed" | "percentage" | string | null;
      loan_interest_pence?: number | null;
      loan_interest_percentage?: number | null;
      loan_due_date?: string | null;
      loan_repayment_terms?: string | null;
    };

    const loanInterestType = editableSponsor.loan_interest_type || "none";

    setSponsorForm({
      fundingType: editableSponsor.funding_type || "sponsor",
      sponsorName: editableSponsor.sponsor_name || "",
      contactName: editableSponsor.contact_name || "",
      email: editableSponsor.email || "",
      phone: editableSponsor.phone || "",
      agreedAmount: ((editableSponsor.agreed_amount_pence || 0) / 100).toFixed(
        2
      ),
      receivedAmount: (
        (editableSponsor.received_amount_pence || 0) / 100
      ).toFixed(2),
      notes: editableSponsor.notes || "",

      loanMonthlyPayment: editableSponsor.loan_monthly_payment_pence
        ? (editableSponsor.loan_monthly_payment_pence / 100).toFixed(2)
        : "",
      loanInterestType:
        loanInterestType === "fixed" || loanInterestType === "percentage"
          ? loanInterestType
          : "none",
      loanInterestAmount:
        loanInterestType === "percentage"
          ? String(editableSponsor.loan_interest_percentage || "")
          : editableSponsor.loan_interest_pence
            ? (editableSponsor.loan_interest_pence / 100).toFixed(2)
            : "",
      loanDueDate: editableSponsor.loan_due_date || "",
      loanRepaymentTerms: editableSponsor.loan_repayment_terms || "",
    });

    setSponsorFormOpen(true);
  }

  function closeSponsorForm() {
    setSponsorFormOpen(false);
    setEditingSponsor(null);
    setSponsorForm(initialSponsorForm);
  }

  async function saveSponsor() {
    try {
      setSavingSponsor(true);
      setError("");
      setErrorDetails(null);

      if (selectedYearLocked) {
        setError(
          `${selectedYear} is locked. Unlock this year with the main admin password before saving funding records.`
        );
        setSavingSponsor(false);
        return;
      }

      if (!sponsorForm.sponsorName.trim()) {
        const label = getFundingTypeLabel(sponsorForm.fundingType);
        setError(`Please enter a ${label} name.`);
        setSavingSponsor(false);
        return;
      }

      const res = await fetch(
        editingSponsor
          ? `/api/admin/money/sponsors/${editingSponsor.id}`
          : "/api/admin/money/sponsors",
        {
          method: editingSponsor ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(sponsorForm),
        }
      );

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        throw {
          message: data.error || "Failed to save funding record",
          details: data,
          status: res.status,
        };
      }

      closeSponsorForm();
      await loadSponsors();
      await loadTransactions();
      await loadYearLocks();
      await loadMonthLocks();
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
      setErrorDetails(err);
    } finally {
      setSavingSponsor(false);
    }
  }

  async function deleteSponsor() {
    if (!deleteSponsorId) return;

    try {
      setDeletingSponsor(true);
      setError("");
      setErrorDetails(null);

      if (selectedYearLocked) {
        setError(
          `${selectedYear} is locked. Unlock this year with the main admin password before deleting funding records.`
        );
        setDeletingSponsor(false);
        return;
      }

      const res = await fetch(`/api/admin/money/sponsors/${deleteSponsorId}`, {
        method: "DELETE",
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        throw {
          message: data.error || "Failed to delete funding record",
          details: data,
          status: res.status,
        };
      }

      if (form.sponsorId === deleteSponsorId) {
        setForm((prev) => ({
          ...prev,
          sponsorId: "",
          sponsorName: "",
          sponsorshipNote: "",
        }));
      }

      if (selectedSponsorId === deleteSponsorId) {
        setSelectedSponsorId("all");
        setFilter("all");
      }

      if (editingSponsor?.id === deleteSponsorId) {
        closeSponsorForm();
      }

      setDeleteSponsorId(null);
      await loadSponsors();
      await loadTransactions();
      await loadYearLocks();
      await loadMonthLocks();
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
      setErrorDetails(err);
    } finally {
      setDeletingSponsor(false);
    }
  }

  function fillTestTransaction() {
    setEditingTransaction(null);

    setForm({
      title: "Test donation",
      description: "This is a test transaction",
      type: "income",
      category: "",
      amount: "25.00",
      paymentMethod: "Stripe",
      transactionDate: getTodayDate(),
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
    });

    setInvoiceFiles([]);
  }

  function startEditTransaction(item: Transaction) {
    const lockMessage = getLockMessage(item.transaction_date || item.created_at);

    if (lockMessage) {
      setError(lockMessage);
      return;
    }

    const isPersonal = isPersonalFundsTransaction(item);

    const matchingSponsor = displaySponsors.find((sponsor) => {
      return (
        sponsor.id === item.sponsor_id ||
        sponsorNameMatches(sponsor.sponsor_name, item.sponsor_name)
      );
    });

    const hasSponsorLinked = Boolean(
      matchingSponsor?.id || item.sponsor_id || item.sponsor_name
    );

    const linkedFundingType =
      matchingSponsor?.funding_type ||
      (String(item.source || "") === "loan" ||
      String(item.source || "") === "loan_repayment" ||
      String(item.source || "") === "loan_interest"
        ? "loan"
        : String(item.source || "") === "grant"
          ? "grant"
          : "sponsor");

    const isLoanLinked = linkedFundingType === "loan";

    const loanCategory =
      isLoanSpendingTransaction(item) || item.category === "Loan Spending"
        ? "Loan Spending"
        : "Loan Repayment";

    const editCategory = hasSponsorLinked
      ? isLoanLinked
        ? loanCategory
        : "Sponsorship"
      : item.category || "";

    const editPaymentMethod = hasSponsorLinked
      ? isLoanLinked
        ? loanCategory === "Loan Spending"
          ? "Loan Money"
          : item.payment_method || "Bank Transfer"
        : "Sponsorship Money"
      : item.payment_method || "";

    setEditingTransaction(item);

    setForm({
      title: item.title || "",
      description: item.description || "",
      type: hasSponsorLinked ? "expense" : item.type,
      category: editCategory,
      amount: ((item.amount_pence || 0) / 100).toFixed(2),
      paymentMethod: editPaymentMethod,
      transactionDate: item.transaction_date || getTodayDate(),
      isPersonalFunds: hasSponsorLinked ? false : isPersonal,
      personalFundsName: hasSponsorLinked ? "" : item.personal_funds_name || "",
      sponsorId: matchingSponsor?.id || item.sponsor_id || "",
      sponsorName: matchingSponsor?.sponsor_name || item.sponsor_name || "",
      sponsorshipNote: item.sponsorship_note || "",

      bankReconciliationStatus:
        item.bank_reconciliation_status || "unmatched",
      bankReconciliationNote: item.bank_reconciliation_note || "",

      financeNoteStatus: item.finance_note_status || "none",
      financeNote: item.finance_note || "",

      isRepeating: false,
      repeatFrequency: "monthly",
      repeatCount: "12",
    });

    setInvoiceFiles([]);
    setError("");
    setErrorDetails(null);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function cancelEditTransaction() {
    setEditingTransaction(null);
    setForm(initialForm);
    setInvoiceFiles([]);
    setError("");
    setErrorDetails(null);
  }

  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");
      setErrorDetails(null);

      if (!form.title.trim()) {
        setError("Please enter a title.");
        setSaving(false);
        return;
      }

      if (!form.amount || Number(form.amount) <= 0) {
        setError("Please enter an amount above £0.");
        setSaving(false);
        return;
      }

      const lockMessage = getLockMessage(form.transactionDate);

      if (lockMessage) {
        setError(lockMessage);
        setSaving(false);
        return;
      }

      if (!form.paymentMethod && !form.sponsorId) {
        setError("Please choose a payment method.");
        setSaving(false);
        return;
      }

      if (form.isPersonalFunds && !form.personalFundsName.trim()) {
        setError(
          "Please enter the name of the person who paid with personal funds."
        );
        setSaving(false);
        return;
      }

      if (form.isRepeating && editingTransaction) {
        setError(
          "Repeating payments can only be created as new transactions, not while editing."
        );
        setSaving(false);
        return;
      }

      const repeatCount = form.isRepeating ? Number(form.repeatCount) : 1;

      if (form.isRepeating && (!repeatCount || repeatCount < 2)) {
        setError("Please enter at least 2 repeating payments.");
        setSaving(false);
        return;
      }

      if (form.isRepeating && repeatCount > 60) {
        setError("Please keep repeating payments to 60 or fewer at one time.");
        setSaving(false);
        return;
      }

      const selectedSponsorForSave = form.sponsorId
        ? displaySponsors.find((sponsor) => sponsor.id === form.sponsorId)
        : null;

      const finalSponsorId = selectedSponsorForSave?.id || "";
      const finalSponsorName = selectedSponsorForSave?.sponsor_name || "";
      const isSponsorLinked = Boolean(finalSponsorId || finalSponsorName);

      const isLoanLinked = selectedSponsorForSave?.funding_type === "loan";
      const loanMode = getLoanMode(form.category);
      const isLoanRepayment = isLoanLinked && loanMode === "Loan Repayment";
      const isLoanSpending = isLoanLinked && loanMode === "Loan Spending";

      const fundingSource = isSponsorLinked
        ? isLoanRepayment
          ? "loan_repayment"
          : isLoanSpending
            ? "loan"
            : selectedSponsorForSave?.funding_type === "grant"
              ? "grant"
              : "sponsorship"
        : "manual";

      const fundingCategory = isSponsorLinked
        ? isLoanRepayment
          ? "Loan Repayment"
          : isLoanSpending
            ? "Loan Spending"
            : "Sponsorship"
        : form.category;

      const fundingPaymentMethod = isSponsorLinked
        ? isLoanRepayment
          ? form.paymentMethod || "Bank Transfer"
          : isLoanSpending
            ? "Loan Money"
            : "Sponsorship Money"
        : form.paymentMethod;

      const looksLikeFunding =
        form.paymentMethod === "Sponsorship Money" ||
        form.paymentMethod === "Loan Money" ||
        form.category.toLowerCase().trim() === "sponsorship" ||
        form.category === "Loan Repayment" ||
        form.category === "Loan Spending" ||
        Boolean(editingTransaction?.source === "sponsorship") ||
        Boolean(editingTransaction?.source === "grant") ||
        Boolean(editingTransaction?.source === "loan") ||
        Boolean(editingTransaction?.source === "loan_repayment") ||
        Boolean(editingTransaction?.source === "loan_interest") ||
        Boolean(editingTransaction?.sponsor_id) ||
        Boolean(editingTransaction?.sponsor_name);

      if (looksLikeFunding && !isSponsorLinked) {
        setError(
          "Please choose the correct sponsor, grant, loan, or funding record before saving this transaction."
        );
        setSaving(false);
        return;
      }

      if (isSponsorLinked && !form.sponsorshipNote.trim()) {
        setError(
          isLoanRepayment
            ? "Please add a loan repayment note explaining what was paid back."
            : isLoanSpending
              ? "Please add a loan spending note explaining what the loan money was used for."
              : "Please add a funding note explaining what this restricted money was used for."
        );
        setSaving(false);
        return;
      }

      const datesToCreate = Array.from({ length: repeatCount }).map((_, index) =>
        addRepeatingDate(form.transactionDate, index, form.repeatFrequency)
      );

      for (let index = 0; index < datesToCreate.length; index += 1) {
        const transactionDate = datesToCreate[index];
        const repeatingLockMessage = getLockMessage(transactionDate);

        if (repeatingLockMessage) {
          throw {
            message: repeatingLockMessage,
            details: {
              transactionDate,
            },
          };
        }

        const uploadData = new FormData();

        uploadData.append(
          "title",
          form.isRepeating
            ? `${form.title} (${index + 1}/${repeatCount})`
            : form.title
        );

        uploadData.append(
          "description",
          form.isRepeating
            ? `${form.description || ""}${
                form.description ? "\n\n" : ""
              }Repeating payment: ${repeatFrequencyLabel(
                form.repeatFrequency
              )}. Payment ${index + 1} of ${repeatCount}.`
            : form.description
        );

        uploadData.append("type", isSponsorLinked ? "expense" : form.type);
        uploadData.append("category", fundingCategory);
        uploadData.append("amount", form.amount);
        uploadData.append("paymentMethod", fundingPaymentMethod);
        uploadData.append("transactionDate", transactionDate);
        uploadData.append("source", fundingSource);
        uploadData.append(
          "isPersonalFunds",
          String(isSponsorLinked ? false : form.isPersonalFunds)
        );
        uploadData.append(
          "personalFundsName",
          isSponsorLinked ? "" : form.personalFundsName
        );
        uploadData.append("sponsorId", finalSponsorId);
        uploadData.append("sponsorName", finalSponsorName);
        uploadData.append("sponsorshipNote", form.sponsorshipNote);

        uploadData.append(
          "bankReconciliationStatus",
          form.bankReconciliationStatus || "unmatched"
        );
        uploadData.append(
          "bankReconciliationNote",
          form.bankReconciliationNote || ""
        );

        uploadData.append("financeNoteStatus", form.financeNoteStatus || "none");
        uploadData.append("financeNote", form.financeNote || "");

        uploadData.append("isRepeating", String(form.isRepeating));
        uploadData.append("repeatFrequency", form.repeatFrequency);
        uploadData.append("repeatCount", String(repeatCount));
        uploadData.append("repeatIndex", String(index + 1));

        invoiceFiles.forEach((file) => {
          uploadData.append("invoiceFiles", file);
        });

        const res = await fetch(
          editingTransaction
            ? `/api/admin/money/transactions/${editingTransaction.id}`
            : "/api/admin/money/transactions",
          {
            method: editingTransaction ? "PATCH" : "POST",
            body: uploadData,
          }
        );

        const data = await readJsonResponse(res);

        if (!res.ok || !data.ok) {
          throw {
            message:
              data.error ||
              `Failed to save transaction ${index + 1} of ${repeatCount}`,
            details: data,
            status: res.status,
            sentForm: form,
          };
        }
      }

      setForm(initialForm);
      setInvoiceFiles([]);
      setEditingTransaction(null);
      await loadTransactions();
      await loadSponsors();
      await loadYearLocks();
      await loadMonthLocks();
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
      setErrorDetails(err);
    } finally {
      setSaving(false);
    }
  }

  async function markTransactionChecked(item: Transaction) {
    const lockMessage = getLockMessage(item.transaction_date || item.created_at);

    if (lockMessage) {
      setError(lockMessage);
      return;
    }

    try {
      setCheckingId(item.id);
      setError("");
      setErrorDetails(null);

      const res = await fetch(
        `/api/admin/money/transactions/${item.id}/checked`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        throw {
          message:
            data.error ||
            (item.checked_at
              ? "Failed to undo checked status"
              : "Failed to mark transaction as checked"),
          details: data,
          status: res.status,
        };
      }

      if (data.transaction) {
        setTransactions((prev) =>
          prev.map((transaction) =>
            transaction.id === item.id
              ? {
                  ...transaction,
                  ...data.transaction,
                }
              : transaction
          )
        );
      } else {
        await loadTransactions();
      }

      await loadSponsors();
      await loadYearLocks();
      await loadMonthLocks();
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
      setErrorDetails(err);
    } finally {
      setCheckingId(null);
    }
  }

  async function updateBankReconciliationStatus(
    item: Transaction,
    status: BankReconciliationStatus,
    note = ""
  ) {
    const lockMessage = getLockMessage(item.transaction_date || item.created_at);

    if (lockMessage) {
      setError(lockMessage);
      return;
    }

    try {
      setBankReconcilingId(item.id);
      setError("");
      setErrorDetails(null);

      const res = await fetch(
        `/api/admin/money/transactions/${item.id}/bank-reconciliation`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status,
            note,
          }),
        }
      );

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        throw {
          message:
            data.error || "Failed to update bank reconciliation status.",
          details: data,
          status: res.status,
        };
      }

      if (data.transaction) {
        setTransactions((prev) =>
          prev.map((transaction) =>
            transaction.id === item.id
              ? {
                  ...transaction,
                  ...data.transaction,
                }
              : transaction
          )
        );
      } else {
        await loadTransactions();
      }

      await loadSponsors();
      await loadYearLocks();
      await loadMonthLocks();
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
      setErrorDetails(err);
    } finally {
      setBankReconcilingId(null);
    }
  }

  async function updateFinanceNote(
    item: Transaction,
    status: FinanceNoteStatus,
    note = ""
  ) {
    const lockMessage = getLockMessage(item.transaction_date || item.created_at);

    if (lockMessage) {
      setError(lockMessage);
      return;
    }

    try {
      setFinanceNoteUpdatingId(item.id);
      setError("");
      setErrorDetails(null);

      const res = await fetch(
        `/api/admin/money/transactions/${item.id}/finance-note`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status,
            note,
          }),
        }
      );

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        throw {
          message: data.error || "Failed to update finance note.",
          details: data,
          status: res.status,
        };
      }

      if (data.transaction) {
        setTransactions((prev) =>
          prev.map((transaction) =>
            transaction.id === item.id
              ? {
                  ...transaction,
                  ...data.transaction,
                }
              : transaction
          )
        );
      } else {
        await loadTransactions();
      }

      await loadSponsors();
      await loadYearLocks();
      await loadMonthLocks();
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
      setErrorDetails(err);
    } finally {
      setFinanceNoteUpdatingId(null);
    }
  }

  async function deleteTransaction() {
    if (!deleteId) return;

    const transactionToDelete = transactions.find((item) => item.id === deleteId);

    if (transactionToDelete) {
      const lockMessage = getLockMessage(
        transactionToDelete.transaction_date || transactionToDelete.created_at
      );

      if (lockMessage) {
        setError(lockMessage);
        setDeleteId(null);
        return;
      }
    }

    try {
      setDeleting(true);
      setError("");
      setErrorDetails(null);

      const res = await fetch(`/api/admin/money/transactions/${deleteId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          softDelete: true,
        }),
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        throw {
          message: data.error || "Failed to hide transaction",
          details: data,
          status: res.status,
        };
      }

      if (editingTransaction?.id === deleteId) {
        cancelEditTransaction();
      }

      setTransactions((prev) => prev.filter((item) => item.id !== deleteId));
      setDeleteId(null);
      await loadSponsors();
      await loadYearLocks();
      await loadMonthLocks();
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
      setErrorDetails(err);
    } finally {
      setDeleting(false);
    }
  }

  async function verifyMainAdminDeletePassword(password: string) {
    const res = await fetch("/api/admin/settings/delete-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        password,
      }),
    });

    const data = await readJsonResponse(res);

    if (!res.ok || !data.ok) {
      throw {
        message: data.error || "Incorrect main admin delete password.",
        details: data,
        status: res.status,
      };
    }

    return true;
  }

  async function updateYearLock(action: "lock" | "unlock") {
    try {
      setLockingYear(true);
      setError("");
      setErrorDetails(null);

      const cleanPassword = yearLockPassword.trim();

      if (!cleanPassword) {
        setError("Please enter the main admin password.");
        setLockingYear(false);
        return;
      }

      await verifyMainAdminDeletePassword(cleanPassword);

      const res = await fetch("/api/admin/money/year-locks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          year: selectedYear,
          action,
        }),
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        throw {
          message:
            data.error ||
            (action === "lock"
              ? `Failed to lock ${selectedYear}.`
              : `Failed to unlock ${selectedYear}.`),
          details: data,
          status: res.status,
        };
      }

      setYearLockPassword("");
      await loadYearLocks();
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
      setErrorDetails(err);
    } finally {
      setLockingYear(false);
    }
  }

  async function lockSelectedYear() {
    await updateYearLock("lock");
  }

  async function unlockSelectedYear() {
    await updateYearLock("unlock");
  }

  async function updateMonthLock(action: "lock" | "unlock") {
    try {
      setLockingMonth(true);
      setError("");
      setErrorDetails(null);

      const cleanPassword = monthLockPassword.trim();

      if (!cleanPassword) {
        setError("Please enter the main admin password.");
        setLockingMonth(false);
        return;
      }

      if (!selectedLockMonth || selectedLockMonth === "all") {
        setError("Please choose a single month to lock.");
        setLockingMonth(false);
        return;
      }

      await verifyMainAdminDeletePassword(cleanPassword);

      const res = await fetch("/api/admin/money/month-locks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          year: selectedYear,
          monthKey: selectedLockMonth,
          action,
        }),
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        throw {
          message:
            data.error ||
            (action === "lock"
              ? `Failed to lock ${selectedLockMonth}.`
              : `Failed to unlock ${selectedLockMonth}.`),
          details: data,
          status: res.status,
        };
      }

      setMonthLockPassword("");
      await loadMonthLocks();
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
      setErrorDetails(err);
    } finally {
      setLockingMonth(false);
    }
  }

  async function lockSelectedMonth() {
    await updateMonthLock("lock");
  }

  async function unlockSelectedMonth() {
    await updateMonthLock("unlock");
  }

  async function deleteSelectedYearTransactions() {
    try {
      setDeletingYear(true);
      setError("");
      setErrorDetails(null);

      if (selectedYearLocked) {
        setError(
          `${selectedYear} is locked. Unlock this year before deleting its transactions.`
        );
        setDeletingYear(false);
        return;
      }

      const lockedMonths = monthLocks.filter(
        (item) => item.year === selectedYear && item.is_locked === true
      );

      if (lockedMonths.length > 0) {
        setError(
          `Cannot delete ${selectedYear} while locked months exist. Unlock these months first: ${lockedMonths
            .map((item) => item.month_key)
            .join(", ")}.`
        );
        setDeletingYear(false);
        return;
      }

      const cleanPassword = deleteYearPassword.trim();

      if (!cleanPassword) {
        setError("Please enter the main admin delete password.");
        setDeletingYear(false);
        return;
      }

      await verifyMainAdminDeletePassword(cleanPassword);

      const res = await fetch(
        `/api/admin/money/transactions/year/${selectedYear}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            password: cleanPassword,
          }),
        }
      );

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        throw {
          message: data.error || `Failed to delete ${selectedYear} transactions`,
          details: data,
          status: res.status,
        };
      }

      setDeleteYearOpen(false);
      setDeleteYearPassword("");
      cancelEditTransaction();

      await loadTransactions();
      await loadSponsors();
      await loadYearLocks();
      await loadMonthLocks();
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
      setErrorDetails(err);
    } finally {
      setDeletingYear(false);
    }
  }

  async function deleteAllTransactions() {
    try {
      setDeletingAll(true);
      setError("");
      setErrorDetails(null);

      const lockedYears = yearLocks.filter((item) => item.is_locked === true);
      const lockedMonths = monthLocks.filter((item) => item.is_locked === true);

      if (lockedYears.length > 0) {
        setError(
          `Cannot delete everything while locked years exist. Unlock these years first: ${lockedYears
            .map((item) => item.year)
            .join(", ")}.`
        );
        setDeletingAll(false);
        return;
      }

      if (lockedMonths.length > 0) {
        setError(
          `Cannot delete everything while locked months exist. Unlock these months first: ${lockedMonths
            .map((item) => item.month_key)
            .join(", ")}.`
        );
        setDeletingAll(false);
        return;
      }

      const cleanPassword = deleteAllPassword.trim();

      if (!cleanPassword) {
        setError("Please enter the main admin delete password.");
        setDeletingAll(false);
        return;
      }

      await verifyMainAdminDeletePassword(cleanPassword);

      const res = await fetch("/api/admin/money/transactions", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: cleanPassword,
        }),
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        throw {
          message: data.error || "Failed to delete all transactions",
          details: data,
          status: res.status,
        };
      }

      setDeleteAllOpen(false);
      setDeleteAllPassword("");
      cancelEditTransaction();

      await loadTransactions();
      await loadSponsors();
      await loadYearLocks();
      await loadMonthLocks();
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
      setErrorDetails(err);
    } finally {
      setDeletingAll(false);
    }
  }

  async function togglePersonalFundsRepaid(
    item: Transaction,
    proofFiles: File[] = []
  ) {
    const lockMessage = getLockMessage(item.transaction_date || item.created_at);

    if (lockMessage) {
      setError(lockMessage);
      return;
    }

    try {
      setRepayingId(item.id);
      setError("");
      setErrorDetails(null);

      const nextRepaid = !item.personal_funds_repaid;

      if (nextRepaid && proofFiles.length === 0) {
        setError(
          "Please upload proof before marking this personal funds payment as paid back. Upload a receipt, bank screenshot, or payment confirmation."
        );
        return;
      }

      const uploadData = new FormData();
      uploadData.append("repaid", String(nextRepaid));

      proofFiles.forEach((file) => {
        uploadData.append("repaymentProofFiles", file);
      });

      const res = await fetch(
        `/api/admin/money/transactions/${item.id}/repayment`,
        {
          method: "PATCH",
          body: uploadData,
        }
      );

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        throw {
          message: data.error || "Failed to update personal funds repayment",
          details: data,
          status: res.status,
        };
      }

      await loadTransactions();
      await loadSponsors();
      await loadYearLocks();
      await loadMonthLocks();
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
      setErrorDetails(err);
    } finally {
      setRepayingId(null);
    }
  }

  function openLoanRepaymentModal(sponsor: SponsorBreakdown) {
    const lockMessage = getLockMessage(getTodayDate());

    if (lockMessage) {
      setError(lockMessage);
      return;
    }

    setLoanRepaymentSponsor(sponsor as LoanActionFunding);
    setLoanRepaymentForm({
      ...initialLoanRepaymentForm,
      sponsorId: sponsor.sponsor_id,
      sponsorName: sponsor.sponsor_name,
      transactionDate: getTodayDate(),
    });
    setError("");
    setErrorDetails(null);
  }

  function closeLoanRepaymentModal() {
    setLoanRepaymentSponsor(null);
    setLoanRepaymentForm(initialLoanRepaymentForm);
    setSavingLoanRepayment(false);
  }

  async function saveLoanRepayment() {
    if (!loanRepaymentSponsor) return;

    try {
      setSavingLoanRepayment(true);
      setError("");
      setErrorDetails(null);

      const amountPence = poundsToPence(loanRepaymentForm.amount);
      const lockMessage = getLockMessage(loanRepaymentForm.transactionDate);

      if (lockMessage) {
        setError(lockMessage);
        setSavingLoanRepayment(false);
        return;
      }

      if (amountPence <= 0) {
        setError("Please enter a loan repayment amount above £0.");
        setSavingLoanRepayment(false);
        return;
      }

      if (!loanRepaymentForm.paymentMethod.trim()) {
        setError("Please choose a payment method for this loan repayment.");
        setSavingLoanRepayment(false);
        return;
      }

      const uploadData = new FormData();
      uploadData.append(
        "title",
        `Loan repayment - ${loanRepaymentSponsor.sponsor_name}`
      );
      uploadData.append("description", loanRepaymentForm.note || "");
      uploadData.append("type", "expense");
      uploadData.append("category", "Loan Repayment");
      uploadData.append("amount", loanRepaymentForm.amount);
      uploadData.append("paymentMethod", loanRepaymentForm.paymentMethod);
      uploadData.append("transactionDate", loanRepaymentForm.transactionDate);
      uploadData.append("source", "loan_repayment");
      uploadData.append("isPersonalFunds", "false");
      uploadData.append("personalFundsName", "");
      uploadData.append(
        "sponsorId",
        loanRepaymentForm.sponsorId || loanRepaymentSponsor.sponsor_id
      );
      uploadData.append(
        "sponsorName",
        loanRepaymentForm.sponsorName || loanRepaymentSponsor.sponsor_name
      );
      uploadData.append(
        "sponsorshipNote",
        loanRepaymentForm.note ||
          `Loan repayment for ${loanRepaymentSponsor.sponsor_name}`
      );
      uploadData.append("bankReconciliationStatus", "unmatched");
      uploadData.append("bankReconciliationNote", "");
      uploadData.append("financeNoteStatus", "none");
      uploadData.append("financeNote", "");
      uploadData.append("isRepeating", "false");
      uploadData.append("repeatFrequency", "monthly");
      uploadData.append("repeatCount", "1");
      uploadData.append("repeatIndex", "1");

      const res = await fetch("/api/admin/money/transactions", {
        method: "POST",
        body: uploadData,
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        throw {
          message: data.error || "Failed to record loan repayment.",
          details: data,
          status: res.status,
        };
      }

      closeLoanRepaymentModal();
      await loadTransactions();
      await loadSponsors();
      await loadYearLocks();
      await loadMonthLocks();
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
      setErrorDetails(err);
    } finally {
      setSavingLoanRepayment(false);
    }
  }

  function openLoanInterestModal(sponsor: SponsorBreakdown) {
    const lockMessage = getLockMessage(getTodayDate());

    if (lockMessage) {
      setError(lockMessage);
      return;
    }

    setLoanInterestSponsor(sponsor as LoanActionFunding);
    setLoanInterestForm({
      ...initialLoanInterestForm,
      sponsorId: sponsor.sponsor_id,
      sponsorName: sponsor.sponsor_name,
      transactionDate: getTodayDate(),
    });
    setError("");
    setErrorDetails(null);
  }

  function closeLoanInterestModal() {
    setLoanInterestSponsor(null);
    setLoanInterestForm(initialLoanInterestForm);
    setSavingLoanInterest(false);
  }

  async function saveLoanInterest() {
    if (!loanInterestSponsor) return;

    try {
      setSavingLoanInterest(true);
      setError("");
      setErrorDetails(null);

      const amountPence = poundsToPence(loanInterestForm.amount);
      const lockMessage = getLockMessage(loanInterestForm.transactionDate);

      if (lockMessage) {
        setError(lockMessage);
        setSavingLoanInterest(false);
        return;
      }

      if (amountPence <= 0) {
        setError("Please enter a loan interest amount above £0.");
        setSavingLoanInterest(false);
        return;
      }

      const uploadData = new FormData();
      uploadData.append(
        "title",
        `Loan interest - ${loanInterestSponsor.sponsor_name}`
      );
      uploadData.append("description", loanInterestForm.note || "");
      uploadData.append("type", "expense");
      uploadData.append("category", "Loan Interest");
      uploadData.append("amount", loanInterestForm.amount);
      uploadData.append("paymentMethod", "Loan Interest");
      uploadData.append("transactionDate", loanInterestForm.transactionDate);
      uploadData.append("source", "loan_interest");
      uploadData.append("isPersonalFunds", "false");
      uploadData.append("personalFundsName", "");
      uploadData.append(
        "sponsorId",
        loanInterestForm.sponsorId || loanInterestSponsor.sponsor_id
      );
      uploadData.append(
        "sponsorName",
        loanInterestForm.sponsorName || loanInterestSponsor.sponsor_name
      );
      uploadData.append(
        "sponsorshipNote",
        loanInterestForm.note ||
          `Interest added to loan from ${loanInterestSponsor.sponsor_name}`
      );
      uploadData.append("bankReconciliationStatus", "unmatched");
      uploadData.append("bankReconciliationNote", "");
      uploadData.append("financeNoteStatus", "none");
      uploadData.append("financeNote", "");
      uploadData.append("isRepeating", "false");
      uploadData.append("repeatFrequency", "monthly");
      uploadData.append("repeatCount", "1");
      uploadData.append("repeatIndex", "1");

      const res = await fetch("/api/admin/money/transactions", {
        method: "POST",
        body: uploadData,
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        throw {
          message: data.error || "Failed to add loan interest.",
          details: data,
          status: res.status,
        };
      }

      closeLoanInterestModal();
      await loadTransactions();
      await loadSponsors();
      await loadYearLocks();
      await loadMonthLocks();
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
      setErrorDetails(err);
    } finally {
      setSavingLoanInterest(false);
    }
  }

  async function exportTransactionsToExcel() {
    try {
      setError("");
      setErrorDetails(null);

      await exportTransactionsToExcelFile({
        selectedYear,
        selectedViewMonth: selectedPrintMonth,
        filteredTransactions: printTransactionsList,
      });
    } catch (err: any) {
      setError(err?.message || "Failed to export Excel file");
      setErrorDetails(err);
    }
  }

  async function exportFullYearlyReport() {
    try {
      setError("");
      setErrorDetails(null);

      await exportFullYearlyReportFile({
        selectedYear,
        totals,
        yearlySponsorBreakdown,
        yearTransactions,
      });
    } catch (err: any) {
      setError(err?.message || "Failed to export yearly report");
      setErrorDetails(err);
    }
  }

  const printTransactions = useCallback(() => {
    try {
      setError("");
      setErrorDetails(null);

      printMoneyReport({
        selectedYear,
        selectedPrintMonth,
        totals,
        filteredTotals,
        yearlySponsorBreakdown,
        printTransactionsList,
        onPopupBlocked: () => {
          setError("Popup blocked. Please allow popups to print this report.");
        },
      });
    } catch (err: any) {
      setError(err?.message || "Failed to print report");
      setErrorDetails(err);
    }
  }, [
    selectedYear,
    selectedPrintMonth,
    totals,
    filteredTotals,
    yearlySponsorBreakdown,
    printTransactionsList,
  ]);

  useEffect(() => {
    function handlePrintShortcut(event: KeyboardEvent) {
      const isPrintShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p";

      if (!isPrintShortcut) return;

      event.preventDefault();
      event.stopPropagation();

      if (printTransactionsList.length === 0) {
        setError("There are no transactions to print.");
        return;
      }

      printTransactions();
    }

    window.addEventListener("keydown", handlePrintShortcut);

    return () => {
      window.removeEventListener("keydown", handlePrintShortcut);
    };
  }, [printTransactions, printTransactionsList.length]);

  function handleYearChange(year: string) {
    setSelectedYear(year);
    setSelectedSponsorId("all");
    setSelectedPaymentMethod("all");
    setFilter("all");
    setSearchTerm("");
    setSelectedPrintMonth("all");
    setSelectedViewMonth("all");
    setYearLockPassword("");
    setMonthLockPassword("");
    setSelectedLockMonth(`${year}-01`);
  }

  function refreshAll() {
    loadTransactions();
    loadSponsors();
    loadYearLocks();
    loadMonthLocks();
    loadBudgetItems();
  }

  function closeDeleteYear() {
    setDeleteYearOpen(false);
    setDeleteYearPassword("");
  }

  function closeDeleteAll() {
    setDeleteAllOpen(false);
    setDeleteAllPassword("");
  }

  return {
    transactions,
    form,
    setForm,
    invoiceFiles,
    setInvoiceFiles,
    editingTransaction,
    filter,
    setFilter,
    selectedSponsorId,
    setSelectedSponsorId,
    selectedPaymentMethod,
    setSelectedPaymentMethod,
    selectedSponsor,
    selectedYear,
    selectedViewMonth,
    setSelectedViewMonth,
    selectedPrintMonth,
    setSelectedPrintMonth,
    searchTerm,
    setSearchTerm,
    deleteYearOpen,
    setDeleteYearOpen,
    deletingYear,
    deleteYearPassword,
    setDeleteYearPassword,
    loading,
    saving,
    deleteId,
    setDeleteId,
    deleting,
    deleteAllOpen,
    setDeleteAllOpen,
    deletingAll,
    deleteAllPassword,
    setDeleteAllPassword,
    repayingId,
    checkingId,
    bankReconcilingId,
    financeNoteUpdatingId,
    sponsorFormOpen,
    editingSponsor,
    savingSponsor,
    sponsorForm,
    setSponsorForm,
    deleteSponsorId,
    setDeleteSponsorId,
    deletingSponsor,

    loanRepaymentSponsor,
    loanRepaymentForm,
    setLoanRepaymentForm,
    savingLoanRepayment,
    loanInterestSponsor,
    loanInterestForm,
    setLoanInterestForm,
    savingLoanInterest,

    error,
    errorDetails,
    stripeSyncing,
    stripeSyncMessage,
    stripeSyncError,

    budgetItems,
    savingBudget,
    loadBudgetItems,
    saveBudgetItems,

    yearLocks,
    selectedYearLock,
    selectedYearLocked,
    yearLockPassword,
    setYearLockPassword,
    lockingYear,

    monthLocks,
    selectedLockMonth,
    setSelectedLockMonth,
    selectedMonthLock,
    selectedMonthLocked,
    monthLockPassword,
    setMonthLockPassword,
    lockingMonth,
    isMonthLocked,
    getLockMessage,

    displaySponsors,
    yearOptions,
    yearTransactions,
    printMonthOptions,
    yearlySponsorBreakdown,
    filteredTransactions,
    printTransactionsList,
    totals,
    filteredTotals,
    carryForwardNote,

    monthNameFromKey,

    handleYearChange,
    refreshAll,
    syncStripeDonations,

    openNewSponsorForm,
    startEditSponsor,
    closeSponsorForm,
    saveSponsor,
    deleteSponsor,

    openLoanRepaymentModal,
    closeLoanRepaymentModal,
    saveLoanRepayment,
    openLoanInterestModal,
    closeLoanInterestModal,
    saveLoanInterest,

    fillTestTransaction,
    startEditTransaction,
    cancelEditTransaction,
    handleSubmit,
    deleteTransaction,

    markTransactionChecked,
    updateBankReconciliationStatus,
    updateFinanceNote,

    lockSelectedYear,
    unlockSelectedYear,
    lockSelectedMonth,
    unlockSelectedMonth,
    deleteSelectedYearTransactions,
    deleteAllTransactions,
    togglePersonalFundsRepaid,
    exportTransactionsToExcel,
    exportFullYearlyReport,
    printTransactions,

    closeDeleteYear,
    closeDeleteAll,
  };
}
