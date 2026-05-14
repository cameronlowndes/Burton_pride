"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SyntheticEvent } from "react";

import type {
  FormState,
  Sponsor,
  SponsorBreakdown,
  SponsorFormState,
  Transaction,
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
  isRepeating: false,
  repeatFrequency: "monthly",
  repeatCount: "12",
};

const initialSponsorForm: SponsorFormState = {
  sponsorName: "",
  contactName: "",
  email: "",
  phone: "",
  agreedAmount: "",
  receivedAmount: "",
  notes: "",
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

export function useMoneyTransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [sponsorBreakdown, setSponsorBreakdown] = useState<SponsorBreakdown[]>(
    []
  );

  const [yearLocks, setYearLocks] = useState<YearLock[]>([]);
  const [yearLockPassword, setYearLockPassword] = useState("");
  const [lockingYear, setLockingYear] = useState(false);

  const [form, setForm] = useState<FormState>(initialForm);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
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

  const [sponsorFormOpen, setSponsorFormOpen] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null);
  const [savingSponsor, setSavingSponsor] = useState(false);
  const [sponsorForm, setSponsorForm] =
    useState<SponsorFormState>(initialSponsorForm);

  const [deleteSponsorId, setDeleteSponsorId] = useState<string | null>(null);
  const [deletingSponsor, setDeletingSponsor] = useState(false);

  const [error, setError] = useState("");
  const [errorDetails, setErrorDetails] = useState<any>(null);

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
          message: data.error || "Failed to load sponsors",
          details: data,
          status: res.status,
        };
      }

      setSponsors(data.sponsors || []);
      setSponsorBreakdown(data.breakdown || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load sponsors");
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

  useEffect(() => {
    loadTransactions();
    loadSponsors();
    loadYearLocks();
  }, []);

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

  const carryForward = useMemo(() => {
    const previousIncome = previousYearTransactions
      .filter((item) => item.type === "income")
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    const previousNormalExpense = previousYearTransactions
      .filter(
        (item) => item.type === "expense" && !isPersonalFundsTransaction(item)
      )
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    const previousPersonalFundsRepaid = previousYearTransactions
      .filter(
        (item) =>
          isPersonalFundsTransaction(item) && item.personal_funds_repaid === true
      )
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    return previousIncome - previousNormalExpense - previousPersonalFundsRepaid;
  }, [previousYearTransactions]);

  const yearlySponsorBreakdown = useMemo(() => {
    return displaySponsors
      .map((sponsor) => {
        const thisYearSponsorTransactions = yearTransactions.filter((item) => {
          if (!isSponsorshipTransaction(item)) return false;

          return (
            item.sponsor_id === sponsor.id ||
            sponsorNameMatches(item.sponsor_name, sponsor.sponsor_name)
          );
        });

        const previousSponsorTransactions = previousYearTransactions.filter(
          (item) => {
            if (!isSponsorshipTransaction(item)) return false;

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

        const previousCarryForward =
          sponsorStartedBeforeThisYear && previousReceived === 0
            ? manualReceivedFromSponsorRecord - previousSpent
            : previousReceived - previousSpent;

        const safeCarryForward = Math.max(previousCarryForward, 0);

        const receivedFromTransactions = thisYearSponsorTransactions
          .filter((item) => item.type === "income")
          .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

        const spentPence = thisYearSponsorTransactions
          .filter((item) => item.type === "expense")
          .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

        const receivedPence =
          safeCarryForward + receivedFromTransactions ||
          (sponsorStartedThisYear ? sponsor.received_amount_pence || 0 : 0);

        const agreedPence =
          sponsorStartedThisYear ||
          sponsorStartedBeforeThisYear ||
          thisYearSponsorTransactions.length > 0
            ? sponsor.agreed_amount_pence || 0
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
          remaining_pence: receivedPence - spentPence,
          carried_forward_pence: safeCarryForward,
          notes: sponsor.notes,
        };
      })
      .filter(
        (sponsor) =>
          sponsor.agreed_amount_pence > 0 ||
          sponsor.received_pence > 0 ||
          sponsor.spent_pence > 0 ||
          (sponsor.carried_forward_pence || 0) > 0
      );
  }, [displaySponsors, yearTransactions, previousYearTransactions, selectedYear]);

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
      rows = rows.filter((item) => isSponsorshipTransaction(item));
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

        return (
          item.title?.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.payment_method?.toLowerCase().includes(q) ||
          item.sponsor_name?.toLowerCase().includes(q) ||
          item.sponsorship_note?.toLowerCase().includes(q) ||
          item.personal_funds_name?.toLowerCase().includes(q) ||
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
      .filter((item) => item.type === "income")
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    const normalExpense = yearTransactions
      .filter(
        (item) => item.type === "expense" && !isPersonalFundsTransaction(item)
      )
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    const personalFunds = yearTransactions
      .filter((item) => isPersonalFundsTransaction(item))
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    const personalFundsRepaid = yearTransactions
      .filter(
        (item) =>
          isPersonalFundsTransaction(item) && item.personal_funds_repaid === true
      )
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
      .filter((item) => item.type === "income")
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    const normalExpense = printTransactionsList
      .filter(
        (item) => item.type === "expense" && !isPersonalFundsTransaction(item)
      )
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    const personalFunds = printTransactionsList
      .filter((item) => isPersonalFundsTransaction(item))
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    const personalFundsRepaid = printTransactionsList
      .filter(
        (item) =>
          isPersonalFundsTransaction(item) && item.personal_funds_repaid === true
      )
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

  function isYearLocked(year: string) {
    return yearLocks.some(
      (item) => String(item.year) === String(year) && item.is_locked === true
    );
  }

  function openNewSponsorForm() {
    setEditingSponsor(null);
    setSponsorForm(initialSponsorForm);
    setSponsorFormOpen(true);
  }

  function startEditSponsor(sponsorId: string) {
    if (selectedYearLocked) {
      setError(
        `${selectedYear} is locked. Unlock this year with the main admin password before editing sponsor records.`
      );
      return;
    }

    const sponsor = displaySponsors.find((item) => item.id === sponsorId);

    if (!sponsor) {
      setError("Could not find sponsor to edit.");
      return;
    }

    setEditingSponsor(sponsor);
    setSponsorForm({
      sponsorName: sponsor.sponsor_name || "",
      contactName: sponsor.contact_name || "",
      email: sponsor.email || "",
      phone: sponsor.phone || "",
      agreedAmount: ((sponsor.agreed_amount_pence || 0) / 100).toFixed(2),
      receivedAmount: ((sponsor.received_amount_pence || 0) / 100).toFixed(2),
      notes: sponsor.notes || "",
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
          `${selectedYear} is locked. Unlock this year with the main admin password before saving sponsor records.`
        );
        setSavingSponsor(false);
        return;
      }

      if (!sponsorForm.sponsorName.trim()) {
        setError("Please enter a sponsor name.");
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
          message: data.error || "Failed to save sponsor",
          details: data,
          status: res.status,
        };
      }

      closeSponsorForm();
      await loadSponsors();
      await loadTransactions();
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
          `${selectedYear} is locked. Unlock this year with the main admin password before deleting sponsor records.`
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
          message: data.error || "Failed to delete sponsor",
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
      transactionDate: new Date().toISOString().slice(0, 10),
      isPersonalFunds: false,
      personalFundsName: "",
      sponsorId: "",
      sponsorName: "",
      sponsorshipNote: "",
      isRepeating: false,
      repeatFrequency: "monthly",
      repeatCount: "12",
    });

    setInvoiceFile(null);
  }

  function startEditTransaction(item: Transaction) {
    const editYear = getTransactionYear(
      item.transaction_date || item.created_at
    );

    if (isYearLocked(editYear)) {
      setError(
        `${editYear} is locked. Unlock this year with the main admin password before editing this transaction.`
      );
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

    setEditingTransaction(item);

    setForm({
      title: item.title || "",
      description: item.description || "",
      type: hasSponsorLinked ? "expense" : item.type,
      category: hasSponsorLinked ? "Sponsorship" : "",
      amount: ((item.amount_pence || 0) / 100).toFixed(2),
      paymentMethod: hasSponsorLinked
        ? "Sponsorship Money"
        : item.payment_method || "",
      transactionDate:
        item.transaction_date || new Date().toISOString().slice(0, 10),
      isPersonalFunds: hasSponsorLinked ? false : isPersonal,
      personalFundsName: hasSponsorLinked ? "" : item.personal_funds_name || "",
      sponsorId: matchingSponsor?.id || item.sponsor_id || "",
      sponsorName: matchingSponsor?.sponsor_name || item.sponsor_name || "",
      sponsorshipNote: item.sponsorship_note || "",
      isRepeating: false,
      repeatFrequency: "monthly",
      repeatCount: "12",
    });

    setInvoiceFile(null);
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
    setInvoiceFile(null);
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

      const saveYear = getTransactionYear(form.transactionDate);

      if (isYearLocked(saveYear)) {
        setError(
          `${saveYear} is locked. Unlock this year with the main admin password before adding or editing transactions.`
        );
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

      const looksLikeSponsorship =
        form.paymentMethod === "Sponsorship Money" ||
        form.category.toLowerCase().trim() === "sponsorship" ||
        Boolean(editingTransaction?.source === "sponsorship") ||
        Boolean(editingTransaction?.sponsor_id) ||
        Boolean(editingTransaction?.sponsor_name);

      if (looksLikeSponsorship && !isSponsorLinked) {
        setError(
          "Please choose the correct sponsor before saving this sponsorship transaction."
        );
        setSaving(false);
        return;
      }

      if (isSponsorLinked && !form.sponsorshipNote.trim()) {
        setError(
          "Please add a sponsorship note explaining what this sponsor money was spent on."
        );
        setSaving(false);
        return;
      }

      const datesToCreate = Array.from({ length: repeatCount }).map((_, index) =>
        addRepeatingDate(form.transactionDate, index, form.repeatFrequency)
      );

      for (let index = 0; index < datesToCreate.length; index += 1) {
        const transactionDate = datesToCreate[index];
        const transactionYear = getTransactionYear(transactionDate);

        if (isYearLocked(transactionYear)) {
          throw {
            message: `${transactionYear} is locked. Unlock this year before creating this repeating payment.`,
            details: {
              transactionDate,
              transactionYear,
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
        uploadData.append("category", isSponsorLinked ? "Sponsorship" : "");
        uploadData.append("amount", form.amount);
        uploadData.append(
          "paymentMethod",
          isSponsorLinked ? "Sponsorship Money" : form.paymentMethod
        );
        uploadData.append("transactionDate", transactionDate);
        uploadData.append("source", isSponsorLinked ? "sponsorship" : "manual");
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
        uploadData.append("isRepeating", String(form.isRepeating));
        uploadData.append("repeatFrequency", form.repeatFrequency);
        uploadData.append("repeatCount", String(repeatCount));
        uploadData.append("repeatIndex", String(index + 1));

        if (invoiceFile) {
          uploadData.append("invoiceFile", invoiceFile);
        }

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
      setInvoiceFile(null);
      setEditingTransaction(null);
      await loadTransactions();
      await loadSponsors();
      await loadYearLocks();
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
      setErrorDetails(err);
    } finally {
      setSaving(false);
    }
  }

  async function deleteTransaction() {
    if (!deleteId) return;

    const transactionToDelete = transactions.find((item) => item.id === deleteId);

    if (transactionToDelete) {
      const deleteYear = getTransactionYear(
        transactionToDelete.transaction_date || transactionToDelete.created_at
      );

      if (isYearLocked(deleteYear)) {
        setError(
          `${deleteYear} is locked. Unlock this year with the main admin password before hiding this transaction.`
        );
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

      if (lockedYears.length > 0) {
        setError(
          `Cannot delete everything while locked years exist. Unlock these years first: ${lockedYears
            .map((item) => item.year)
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
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
      setErrorDetails(err);
    } finally {
      setDeletingAll(false);
    }
  }

  async function togglePersonalFundsRepaid(item: Transaction) {
    const repayYear = getTransactionYear(item.transaction_date || item.created_at);

    if (isYearLocked(repayYear)) {
      setError(
        `${repayYear} is locked. Unlock this year with the main admin password before changing repayments.`
      );
      return;
    }

    try {
      setRepayingId(item.id);
      setError("");
      setErrorDetails(null);

      const nextRepaid = !item.personal_funds_repaid;

      const res = await fetch(
        `/api/admin/money/transactions/${item.id}/repayment`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            repaid: nextRepaid,
          }),
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
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
      setErrorDetails(err);
    } finally {
      setRepayingId(null);
    }
  }

  async function exportTransactionsToExcel() {
    try {
      setError("");
      setErrorDetails(null);

      await exportTransactionsToExcelFile({
        selectedYear,
        selectedViewMonth,
        filteredTransactions,
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
  }

  function refreshAll() {
    loadTransactions();
    loadSponsors();
    loadYearLocks();
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
    invoiceFile,
    setInvoiceFile,
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
    sponsorFormOpen,
    editingSponsor,
    savingSponsor,
    sponsorForm,
    setSponsorForm,
    deleteSponsorId,
    setDeleteSponsorId,
    deletingSponsor,
    error,
    errorDetails,

    yearLocks,
    selectedYearLock,
    selectedYearLocked,
    yearLockPassword,
    setYearLockPassword,
    lockingYear,

    displaySponsors,
    yearOptions,
    yearTransactions,
    printMonthOptions,
    yearlySponsorBreakdown,
    filteredTransactions,
    printTransactionsList,
    totals,

    monthNameFromKey,

    handleYearChange,
    refreshAll,

    openNewSponsorForm,
    startEditSponsor,
    closeSponsorForm,
    saveSponsor,
    deleteSponsor,

    fillTestTransaction,
    startEditTransaction,
    cancelEditTransaction,
    handleSubmit,
    deleteTransaction,

    lockSelectedYear,
    unlockSelectedYear,
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