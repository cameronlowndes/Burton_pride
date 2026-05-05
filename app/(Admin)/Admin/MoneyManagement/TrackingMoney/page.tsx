"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Bug,
  Download,
  FileText,
  Pencil,
  Printer,
  RefreshCcw,
  Trash2,
  X,
} from "lucide-react";

type Transaction = {
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
};

type Sponsor = {
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

type SponsorBreakdown = {
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

type FormState = {
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
};

type SponsorFormState = {
  sponsorName: string;
  contactName: string;
  email: string;
  phone: string;
  agreedAmount: string;
  receivedAmount: string;
  notes: string;
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

const paymentMethods = [
  "Stripe",
  "Online Payment",
  "Cash",
  "Bank Transfer",
  "PayPal",
  "Card Machine",
  "Personal Funds",
  "Item Donation",
];

function money(amountPence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format((amountPence || 0) / 100);
}

function sourceLabel(source: string | null) {
  if (source === "website_donation") return "Website Donation";
  if (source === "website_monthly_donation") return "Monthly Donation";
  if (source === "sponsorship") return "Sponsorship";
  if (source === "manual") return "Manual";
  if (!source) return "Manual";

  return source
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getTransactionYear(value: string | null | undefined) {
  if (!value) return new Date().getFullYear().toString();

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date().getFullYear().toString();
  }

  return date.getFullYear().toString();
}

function isPersonalFundsTransaction(item: Transaction) {
  return (
    item.type === "expense" &&
    (item.is_personal_funds === true ||
      item.payment_method?.toLowerCase() === "personal funds")
  );
}

function isSponsorshipTransaction(item: Transaction) {
  return (
    Boolean(item.sponsor_id || item.sponsor_name) ||
    item.source === "sponsorship" ||
    item.category?.toLowerCase() === "sponsorship"
  );
}

function sponsorNameMatches(
  a: string | null | undefined,
  b: string | null | undefined
) {
  return Boolean(a && b && a.toLowerCase().trim() === b.toLowerCase().trim());
}

export default function MoneyTransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [sponsorBreakdown, setSponsorBreakdown] = useState<SponsorBreakdown[]>(
    []
  );

  const [form, setForm] = useState<FormState>(initialForm);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);

  const [filter, setFilter] = useState<
    "all" | "income" | "expense" | "sponsorship" | "personal"
  >("all");

  const [selectedSponsorId, setSelectedSponsorId] = useState<string>("all");

  const [selectedYear, setSelectedYear] = useState<string>(
    new Date().getFullYear().toString()
  );

  const [searchTerm, setSearchTerm] = useState("");
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

      const text = await res.text();

      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { rawResponse: text };
      }

      if (!res.ok || !data.ok) {
        throw {
          message: data.error || "Failed to load transactions",
          details: data,
          status: res.status,
        };
      }

      setTransactions(data.transactions || []);
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

      const text = await res.text();

      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { rawResponse: text };
      }

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

  useEffect(() => {
    loadTransactions();
    loadSponsors();
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

    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [transactions, displaySponsors]);

  const yearTransactions = useMemo(() => {
    return transactions.filter((item) => {
      const year = getTransactionYear(item.transaction_date || item.created_at);
      return year === selectedYear;
    });
  }, [transactions, selectedYear]);

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
          sponsorCreatedYear && Number(sponsorCreatedYear) < Number(selectedYear);

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
    let rows = yearTransactions;

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

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();

      rows = rows.filter((item) => {
        return (
          item.title?.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.payment_method?.toLowerCase().includes(q) ||
          item.sponsor_name?.toLowerCase().includes(q) ||
          item.sponsorship_note?.toLowerCase().includes(q) ||
          item.personal_funds_name?.toLowerCase().includes(q)
        );
      });
    }

    return rows;
  }, [
    yearTransactions,
    filter,
    selectedSponsorId,
    displaySponsors,
    searchTerm,
  ]);

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
    const income = filteredTransactions
      .filter((item) => item.type === "income")
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    const normalExpense = filteredTransactions
      .filter(
        (item) => item.type === "expense" && !isPersonalFundsTransaction(item)
      )
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    const personalFunds = filteredTransactions
      .filter((item) => isPersonalFundsTransaction(item))
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    const personalFundsRepaid = filteredTransactions
      .filter(
        (item) =>
          isPersonalFundsTransaction(item) && item.personal_funds_repaid === true
      )
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    const sponsorshipIncome = filteredTransactions
      .filter((item) => item.type === "income" && isSponsorshipTransaction(item))
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    const sponsorshipSpent = filteredTransactions
      .filter((item) => item.type === "expense" && isSponsorshipTransaction(item))
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
  }, [filteredTransactions, totals.openingBalance]);

  function openNewSponsorForm() {
    setEditingSponsor(null);
    setSponsorForm(initialSponsorForm);
    setSponsorFormOpen(true);
  }

  function startEditSponsor(sponsorId: string) {
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

      const text = await res.text();

      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { rawResponse: text };
      }

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

      const res = await fetch(`/api/admin/money/sponsors/${deleteSponsorId}`, {
        method: "DELETE",
      });

      const text = await res.text();

      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { rawResponse: text };
      }

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
    });

    setInvoiceFile(null);
  }

  function startEditTransaction(item: Transaction) {
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

  async function handleSubmit(e: React.FormEvent) {
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

      const uploadData = new FormData();

      uploadData.append("title", form.title);
      uploadData.append("description", form.description);
      uploadData.append("type", isSponsorLinked ? "expense" : form.type);
      uploadData.append("category", isSponsorLinked ? "Sponsorship" : "");
      uploadData.append("amount", form.amount);
      uploadData.append(
        "paymentMethod",
        isSponsorLinked ? "Sponsorship Money" : form.paymentMethod
      );
      uploadData.append("transactionDate", form.transactionDate);
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

      const text = await res.text();

      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { rawResponse: text };
      }

      if (!res.ok || !data.ok) {
        throw {
          message: data.error || "Failed to save transaction",
          details: data,
          status: res.status,
          sentForm: form,
        };
      }

      setForm(initialForm);
      setInvoiceFile(null);
      setEditingTransaction(null);
      await loadTransactions();
      await loadSponsors();
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
      setErrorDetails(err);
    } finally {
      setSaving(false);
    }
  }

  async function deleteTransaction() {
    if (!deleteId) return;

    try {
      setDeleting(true);
      setError("");
      setErrorDetails(null);

      const res = await fetch(`/api/admin/money/transactions/${deleteId}`, {
        method: "DELETE",
      });

      const text = await res.text();

      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { rawResponse: text };
      }

      if (!res.ok || !data.ok) {
        throw {
          message: data.error || "Failed to delete transaction",
          details: data,
          status: res.status,
        };
      }

      if (editingTransaction?.id === deleteId) {
        cancelEditTransaction();
      }

      setDeleteId(null);
      await loadTransactions();
      await loadSponsors();
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
      setErrorDetails(err);
    } finally {
      setDeleting(false);
    }
  }

  async function deleteSelectedYearTransactions() {
    try {
      setDeletingYear(true);
      setError("");
      setErrorDetails(null);

      if (!deleteYearPassword.trim()) {
        setError("Please enter the main admin delete password.");
        setDeletingYear(false);
        return;
      }

      const res = await fetch(
        `/api/admin/money/transactions/year/${selectedYear}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            password: deleteYearPassword,
          }),
        }
      );

      const text = await res.text();

      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { rawResponse: text };
      }

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

      if (!deleteAllPassword.trim()) {
        setError("Please enter the main admin delete password.");
        setDeletingAll(false);
        return;
      }

      const res = await fetch("/api/admin/money/transactions", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: deleteAllPassword,
        }),
      });

      const text = await res.text();

      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { rawResponse: text };
      }

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
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
      setErrorDetails(err);
    } finally {
      setDeletingAll(false);
    }
  }

  async function togglePersonalFundsRepaid(item: Transaction) {
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

      const text = await res.text();

      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { rawResponse: text };
      }

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

  function exportTransactionsToExcel() {
    const fileDate = new Date().toISOString().slice(0, 10);

    const rows = filteredTransactions.map((item) => ({
      Year: selectedYear,
      Date: formatDate(item.transaction_date),
      Title: item.title,
      Description: item.description || "",
      Type: item.type === "income" ? "Money In" : "Money Out",
      Payment: item.payment_method || "",
      Source: sourceLabel(item.source),
      Sponsor: item.sponsor_name || "",
      "Sponsorship Note": item.sponsorship_note || "",
      "Personal Funds": isPersonalFundsTransaction(item) ? "Yes" : "No",
      "Paid By": item.personal_funds_name || "",
      "Repayment Status": isPersonalFundsTransaction(item)
        ? item.personal_funds_repaid
          ? "Paid back"
          : "Not paid back"
        : "",
      Invoice: item.invoice_image_url || "",
      Amount: money(item.amount_pence),
    }));

    const headers = Object.keys(
      rows[0] || {
        Year: "",
        Date: "",
        Title: "",
        Description: "",
        Type: "",
        Payment: "",
        Source: "",
        Sponsor: "",
        "Sponsorship Note": "",
        "Personal Funds": "",
        "Paid By": "",
        "Repayment Status": "",
        Invoice: "",
        Amount: "",
      }
    );

    const csv = [
      headers.join(","),
      ...rows.map((row: any) =>
        headers
          .map((header) => `"${String(row[header] ?? "").replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `burton-pride-money-transactions-${selectedYear}-${fileDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  function printTransactions() {
    const printedAt = new Date().toLocaleString("en-GB");

    const sponsorRows =
      yearlySponsorBreakdown.length === 0
        ? `<tr><td colspan="7" class="empty">No sponsors added for ${escapeHtml(
            selectedYear
          )}.</td></tr>`
        : yearlySponsorBreakdown
            .map(
              (sponsor) => `
                <tr>
                  <td>
                    <strong>${escapeHtml(sponsor.sponsor_name)}</strong>
                    ${
                      sponsor.notes
                        ? `<div class="muted">${escapeHtml(sponsor.notes)}</div>`
                        : ""
                    }
                    ${
                      (sponsor.carried_forward_pence || 0) > 0
                        ? `<div class="muted">Carried forward: ${escapeHtml(
                            money(sponsor.carried_forward_pence || 0)
                          )}</div>`
                        : ""
                    }
                  </td>
                  <td>${escapeHtml(sponsor.contact_name || "—")}</td>
                  <td>${escapeHtml(sponsor.email || "—")}</td>
                  <td class="amount">${escapeHtml(
                    money(sponsor.agreed_amount_pence)
                  )}</td>
                  <td class="amount green">${escapeHtml(
                    money(sponsor.received_pence)
                  )}</td>
                  <td class="amount red">${escapeHtml(
                    money(sponsor.spent_pence)
                  )}</td>
                  <td class="amount amber">${escapeHtml(
                    money(sponsor.remaining_pence)
                  )}</td>
                </tr>
              `
            )
            .join("");

    const transactionRows =
      filteredTransactions.length === 0
        ? `<tr><td colspan="11" class="empty">No transactions to print for ${escapeHtml(
            selectedYear
          )}.</td></tr>`
        : filteredTransactions
            .map((item) => {
              const isIncome = item.type === "income";
              const isPersonal = isPersonalFundsTransaction(item);
              const hasSponsor = isSponsorshipTransaction(item);

              return `
                <tr>
                  <td>${escapeHtml(formatDate(item.transaction_date))}</td>
                  <td>
                    <strong>${escapeHtml(item.title)}</strong>
                    ${
                      item.description
                        ? `<div class="muted">${escapeHtml(
                            item.description
                          )}</div>`
                        : ""
                    }
                  </td>
                  <td>
                    <span class="badge ${isIncome ? "income" : "expense"}">
                      ${escapeHtml(isIncome ? "Money In" : "Money Out")}
                    </span>
                  </td>
                  <td>
                    ${
                      hasSponsor
                        ? `<span class="badge sponsor">${escapeHtml(
                            item.sponsor_name || "Sponsor"
                          )}</span>`
                        : "—"
                    }
                  </td>
                  <td>${escapeHtml(item.sponsorship_note || "—")}</td>
                  <td>${isPersonal ? "Personal funds" : "—"}</td>
                  <td>${escapeHtml(item.personal_funds_name || "—")}</td>
                  <td>${
                    isPersonal
                      ? item.personal_funds_repaid
                        ? "Paid back"
                        : "Not paid back"
                      : "—"
                  }</td>
                  <td>${escapeHtml(item.payment_method || "—")}</td>
                  <td>${escapeHtml(item.invoice_image_url ? "Yes" : "—")}</td>
                  <td class="amount">${escapeHtml(money(item.amount_pence))}</td>
                </tr>
              `;
            })
            .join("");

    const printHtml = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Burton Pride Money Tracker Report ${escapeHtml(
            selectedYear
          )}</title>
          <style>
            body {
              margin: 0;
              padding: 24px;
              font-family: Arial, Helvetica, sans-serif;
              color: #111827;
              background: #ffffff;
            }

            .header {
              background: #07111f;
              color: #ffffff;
              padding: 18px 20px;
              border-radius: 14px 14px 0 0;
              text-align: center;
            }

            .header h1 {
              margin: 0;
              font-size: 26px;
            }

            .meta {
              background: #374151;
              color: #e5e7eb;
              padding: 10px 16px;
              text-align: center;
              font-size: 12px;
              border-radius: 0 0 14px 14px;
            }

            .summary {
              display: grid;
              grid-template-columns: repeat(7, 1fr);
              gap: 10px;
              margin: 18px 0;
            }

            .card {
              border: 1px solid #d1d5db;
              border-radius: 12px;
              padding: 12px;
            }

            .card span {
              display: block;
              font-size: 10px;
              font-weight: 800;
              text-transform: uppercase;
              margin-bottom: 6px;
            }

            .card strong {
              font-size: 16px;
            }

            .opening-card { background: #f3e8ff; color: #6b21a8; }
            .income-card { background: #dcfce7; color: #166534; }
            .expense-card { background: #fee2e2; color: #991b1b; }
            .personal-card { background: #e0f2fe; color: #075985; }
            .owed-card { background: #ffedd5; color: #9a3412; }
            .sponsor-card { background: #fef3c7; color: #92400e; }
            .balance-card { background: #dbeafe; color: #1e40af; }

            h2 {
              margin: 22px 0 10px;
              font-size: 17px;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 18px;
              font-size: 10.5px;
            }

            th {
              background: #07111f;
              color: #ffffff;
              text-align: left;
              padding: 8px;
              border: 1px solid #07111f;
              font-size: 9.5px;
            }

            td {
              padding: 8px;
              border: 1px solid #d1d5db;
              vertical-align: top;
            }

            tr:nth-child(even) td {
              background: #f9fafb;
            }

            .amount {
              text-align: right;
              white-space: nowrap;
              font-weight: 800;
            }

            .green { color: #166534; }
            .red { color: #991b1b; }
            .amber { color: #92400e; }

            .badge {
              display: inline-block;
              border-radius: 999px;
              padding: 4px 8px;
              font-size: 9.5px;
              font-weight: 800;
              white-space: nowrap;
            }

            .badge.income { background: #dcfce7; color: #166534; }
            .badge.expense { background: #fee2e2; color: #991b1b; }
            .badge.sponsor { background: #fef3c7; color: #92400e; }

            .muted {
              margin-top: 4px;
              color: #6b7280;
              font-size: 9.5px;
              white-space: pre-wrap;
            }

            .empty {
              text-align: center;
              color: #6b7280;
              padding: 18px;
            }

            .footer {
              margin-top: 18px;
              padding-top: 12px;
              border-top: 1px solid #d1d5db;
              text-align: center;
              font-size: 10px;
              color: #6b7280;
            }

            @media print {
              body { padding: 10mm; }

              @page {
                size: A4 landscape;
                margin: 10mm;
              }

              thead { display: table-header-group; }
              tr { page-break-inside: avoid; }
              h2 { page-break-after: avoid; }
            }
          </style>
        </head>

        <body>
          <div class="header">
            <h1>Burton Pride Money Tracker</h1>
            <p>Money report for Burton Pride C.I.C</p>
          </div>

          <div class="meta">
            Tracker year: Jan to Dec ${escapeHtml(
              selectedYear
            )} • Printed on ${escapeHtml(printedAt)} • Rows: ${
      filteredTransactions.length
    }
          </div>

          <div class="summary">
            <div class="card opening-card">
              <span>Opening Balance</span>
              <strong>${escapeHtml(money(totals.openingBalance || 0))}</strong>
            </div>

            <div class="card income-card">
              <span>Money In</span>
              <strong>${escapeHtml(money(filteredTotals.income))}</strong>
            </div>

            <div class="card expense-card">
              <span>Money Out</span>
              <strong>${escapeHtml(money(filteredTotals.expense))}</strong>
            </div>

            <div class="card personal-card">
              <span>Personal Funds</span>
              <strong>${escapeHtml(money(filteredTotals.personalFunds))}</strong>
            </div>

            <div class="card owed-card">
              <span>Still Owed</span>
              <strong>${escapeHtml(
                money(filteredTotals.personalFundsOutstanding)
              )}</strong>
            </div>

            <div class="card sponsor-card">
              <span>Sponsorship Left</span>
              <strong>${escapeHtml(money(totals.sponsorshipRemaining))}</strong>
            </div>

            <div class="card balance-card">
              <span>Balance</span>
              <strong>${escapeHtml(money(filteredTotals.balance))}</strong>
            </div>
          </div>

          <h2>Sponsorship Breakdown — ${escapeHtml(selectedYear)}</h2>

          <table>
            <thead>
              <tr>
                <th>Sponsor</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Agreed</th>
                <th>Received</th>
                <th>Spent</th>
                <th>Remaining</th>
              </tr>
            </thead>
            <tbody>${sponsorRows}</tbody>
          </table>

          <h2>Transactions — ${escapeHtml(selectedYear)}</h2>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Title / Notes</th>
                <th>Type</th>
                <th>Sponsor</th>
                <th>Sponsorship Note</th>
                <th>Personal</th>
                <th>Paid By</th>
                <th>Repayment</th>
                <th>Payment</th>
                <th>Invoice</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>${transactionRows}</tbody>
          </table>

          <div class="footer">Burton Pride Money Management App</div>

          <script>
            window.onload = function () {
              window.focus();
              setTimeout(function () {
                window.print();
              }, 300);
            };
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=1200,height=800");

    if (!printWindow) {
      setError("Popup blocked. Please allow popups to print this report.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();
  }

  useEffect(() => {
    function handlePrintShortcut(event: KeyboardEvent) {
      const isPrintShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p";

      if (!isPrintShortcut) return;

      event.preventDefault();
      event.stopPropagation();

      if (filteredTransactions.length === 0) {
        setError("There are no transactions to print.");
        return;
      }

      printTransactions();
    }

    window.addEventListener("keydown", handlePrintShortcut);

    return () => {
      window.removeEventListener("keydown", handlePrintShortcut);
    };
  }, [
    filteredTransactions,
    filteredTotals,
    totals,
    yearlySponsorBreakdown,
    selectedYear,
  ]);

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#070716] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Money Tracker</h1>
              <p className="text-sm text-white/60">
                Track donations, spending, personal funds, and sponsorship money
                by year.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-2">
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-white/50">
                  Tracker Year
                </label>

                <select
                  value={selectedYear}
                  onChange={(e) => {
                    setSelectedYear(e.target.value);
                    setSelectedSponsorId("all");
                    setFilter("all");
                    setSearchTerm("");
                  }}
                  className="bg-transparent text-sm font-bold text-white outline-none"
                >
                  {yearOptions.map((year) => (
                    <option
                      key={year}
                      value={year}
                      className="bg-[#11111f] text-white"
                    >
                      Jan to Dec {year}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  loadTransactions();
                  loadSponsors();
                }}
                className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm hover:bg-white/20"
              >
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>
        </section>

        {error && (
          <section className="rounded-3xl border border-red-400/30 bg-red-500/10 p-5">
            <div className="flex items-center gap-2 font-bold text-red-100">
              <Bug className="h-5 w-5" />
              Error
            </div>

            <p className="mt-2 text-sm text-red-100">{error}</p>

            {errorDetails && (
              <pre className="mt-4 max-h-80 overflow-auto rounded-2xl bg-black/40 p-4 text-xs text-red-100">
                {JSON.stringify(errorDetails, null, 2)}
              </pre>
            )}
          </section>
        )}

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-sm font-bold text-white">
            Showing money tracker for Jan to Dec {selectedYear}
          </p>
          <p className="mt-1 text-xs text-white/50">
            {yearTransactions.length} transaction
            {yearTransactions.length === 1 ? "" : "s"} saved for this year.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          <div className="min-w-0 rounded-3xl bg-purple-500/10 p-5">
            <p className="text-sm text-purple-200">Opening Balance</p>
            <p className="break-words text-3xl font-bold">
              {money(totals.openingBalance || 0)}
            </p>
          </div>

          <div className="min-w-0 rounded-3xl bg-emerald-500/10 p-5">
            <p className="text-sm text-emerald-200">Money In</p>
            <p className="break-words text-3xl font-bold">
              {money(totals.income)}
            </p>
          </div>

          <div className="min-w-0 rounded-3xl bg-red-500/10 p-5">
            <p className="text-sm text-red-200">Burton Pride Money Out</p>
            <p className="break-words text-3xl font-bold">
              {money(totals.expense)}
            </p>
          </div>

          <div className="min-w-0 rounded-3xl bg-sky-500/10 p-5">
            <p className="text-sm text-sky-200">Personal Funds</p>
            <p className="break-words text-3xl font-bold">
              {money(totals.personalFunds)}
            </p>
          </div>

          <div className="min-w-0 rounded-3xl bg-orange-500/10 p-5">
            <p className="text-sm text-orange-200">Still Owed</p>
            <p className="break-words text-3xl font-bold">
              {money(totals.personalFundsOutstanding)}
            </p>
          </div>

          <div className="min-w-0 rounded-3xl bg-amber-500/10 p-5">
            <p className="text-sm text-amber-200">Sponsorship Left</p>
            <p className="break-words text-3xl font-bold">
              {money(totals.sponsorshipRemaining)}
            </p>
          </div>

          <div className="min-w-0 rounded-3xl bg-blue-500/10 p-5">
            <p className="text-sm text-blue-200">Balance</p>
            <p className="break-words text-3xl font-bold">
              {money(totals.balance)}
            </p>
          </div>
        </section>

        <section className="min-w-0 overflow-hidden rounded-3xl border border-amber-300/20 bg-amber-500/10 p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-amber-100">
                Sponsorship Breakdown
              </h2>
              <p className="text-sm text-amber-100/70">
                Jan to Dec {selectedYear}: track who sponsored, what came in,
                what has been spent, and what is left.
              </p>
            </div>

            <button
              type="button"
              onClick={openNewSponsorForm}
              className="shrink-0 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-400"
            >
              Add Sponsor
            </button>
          </div>

          {yearlySponsorBreakdown.length === 0 ? (
            <div className="rounded-2xl bg-black/20 p-4 text-sm text-white/60">
              No sponsors added for {selectedYear} yet.
            </div>
          ) : (
            <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {yearlySponsorBreakdown.map((sponsor) => (
                <div
                  key={sponsor.sponsor_id}
                  className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="break-words text-lg font-bold text-white">
                      {sponsor.sponsor_name}
                    </h3>

                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => startEditSponsor(sponsor.sponsor_id)}
                        className="rounded-xl bg-amber-500/15 p-2 text-amber-100 ring-1 ring-amber-300/20 hover:bg-amber-500/25"
                        title="Edit sponsor"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteSponsorId(sponsor.sponsor_id)}
                        className="rounded-xl bg-red-500/15 p-2 text-red-200 ring-1 ring-red-300/20 hover:bg-red-500/25"
                        title="Delete sponsor"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {sponsor.contact_name && (
                    <p className="mt-1 break-words text-sm text-white/50">
                      Contact: {sponsor.contact_name}
                    </p>
                  )}

                  {sponsor.email && (
                    <p className="break-words text-sm text-white/50">
                      {sponsor.email}
                    </p>
                  )}

                  {sponsor.phone && (
                    <p className="break-words text-sm text-white/50">
                      {sponsor.phone}
                    </p>
                  )}

                  {sponsor.notes && (
                    <div className="mt-3 rounded-xl bg-white/5 p-3 text-xs text-white/60">
                      <p className="mb-1 font-bold text-white/80">
                        Sponsor notes
                      </p>
                      <p className="whitespace-pre-wrap break-words">
                        {sponsor.notes}
                      </p>
                    </div>
                  )}

                  {(sponsor.carried_forward_pence || 0) > 0 && (
                    <div className="mt-3 rounded-xl bg-purple-500/10 p-3 text-xs text-purple-100 ring-1 ring-purple-300/20">
                      Carried forward into {selectedYear}:{" "}
                      <strong>
                        {money(sponsor.carried_forward_pence || 0)}
                      </strong>
                    </div>
                  )}

                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-white/60">Agreed</span>
                      <span className="font-bold text-white">
                        {money(sponsor.agreed_amount_pence)}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span className="text-white/60">Received</span>
                      <span className="font-bold text-emerald-300">
                        {money(sponsor.received_pence)}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span className="text-white/60">Spent</span>
                      <span className="font-bold text-red-300">
                        {money(sponsor.spent_pence)}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3 rounded-xl bg-amber-500/10 px-3 py-2">
                      <span className="text-amber-100">Remaining</span>
                      <span className="font-bold text-amber-100">
                        {money(sponsor.remaining_pence)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)] 2xl:grid-cols-[400px_minmax(0,1fr)]">
          <form
            onSubmit={handleSubmit}
            className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.04] p-5"
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
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Title"
                className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10 focus:ring-pink-300/40"
              />

              {form.sponsorId ? (
                <div className="rounded-xl border border-red-300/20 bg-red-500/10 p-3 text-sm text-red-100">
                  <p className="font-bold">Transaction type</p>
                  <p className="mt-1 text-lg font-black text-white">
                    Money Out
                  </p>
                  <p className="mt-1 text-xs text-red-100/70">
                    This is locked because sponsor transactions are spending
                    from sponsor money.
                  </p>
                </div>
              ) : (
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      type: e.target.value as "income" | "expense",
                      isPersonalFunds:
                        e.target.value === "income"
                          ? false
                          : prev.isPersonalFunds,
                      personalFundsName:
                        e.target.value === "income"
                          ? ""
                          : prev.personalFundsName,
                    }))
                  }
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

              <input
                value={form.amount}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, amount: e.target.value }))
                }
                placeholder="Amount"
                type="number"
                step="0.01"
                className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10 focus:ring-pink-300/40"
              />

              <div className="rounded-xl border border-amber-300/20 bg-amber-500/10 p-3">
                <label className="mb-1 block text-sm font-bold text-amber-100">
                  Use sponsor money for this spending
                </label>

                <p className="mb-2 text-xs text-amber-100/70">
                  Choose a sponsor only when this payment is being paid from
                  sponsorship money.
                </p>

                <select
                  value={form.sponsorId}
                  onChange={(e) => {
                    const selected = displaySponsors.find(
                      (sponsor) => sponsor.id === e.target.value
                    );

                    setForm((prev) => ({
                      ...prev,
                      sponsorId: selected?.id || "",
                      sponsorName: selected?.sponsor_name || "",
                      type: selected ? "expense" : prev.type,
                      category: selected ? "Sponsorship" : "",
                      paymentMethod: selected
                        ? "Sponsorship Money"
                        : prev.paymentMethod === "Sponsorship Money"
                        ? ""
                        : prev.paymentMethod,
                      isPersonalFunds: selected ? false : prev.isPersonalFunds,
                      personalFundsName: selected ? "" : prev.personalFundsName,
                    }));
                  }}
                  className="w-full rounded-xl bg-black/20 p-3 text-white outline-none ring-1 ring-white/10 focus:ring-amber-300/40"
                >
                  <option className="bg-[#11111f] text-white" value="">
                    Choose sponsor...
                  </option>

                  {displaySponsors.map((sponsor) => (
                    <option
                      className="bg-[#11111f] text-white"
                      key={sponsor.id}
                      value={sponsor.id}
                    >
                      {sponsor.sponsor_name}
                    </option>
                  ))}
                </select>

                <textarea
                  value={form.sponsorshipNote}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      sponsorshipNote: e.target.value,
                    }))
                  }
                  placeholder="Example: Paid from CTS Wholesale sponsorship money"
                  className="mt-3 min-h-20 w-full rounded-xl bg-black/20 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/40 focus:ring-amber-300/40"
                />

                <button
                  type="button"
                  onClick={openNewSponsorForm}
                  className="mt-3 rounded-xl bg-amber-500/20 px-4 py-2 text-sm font-bold text-amber-100 ring-1 ring-amber-300/20 hover:bg-amber-500/30"
                >
                  Add New Sponsor
                </button>
              </div>

              {form.sponsorId ? (
                <div className="rounded-xl border border-amber-300/20 bg-amber-500/10 p-3 text-sm text-amber-100">
                  <p className="font-bold">Payment method</p>
                  <p className="mt-1 text-lg font-black text-white">
                    Sponsorship Money
                  </p>
                  <p className="mt-1 text-xs text-amber-100/70">
                    This is locked because a sponsor is linked. Remove the
                    sponsor if this was paid another way.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="mb-3 text-sm font-bold text-white/70">
                    Payment method
                  </p>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {paymentMethods.map((method) => {
                      const active = form.paymentMethod === method;

                      return (
                        <button
                          key={method}
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              paymentMethod: method,
                              isPersonalFunds:
                                method === "Personal Funds"
                                  ? true
                                  : prev.isPersonalFunds,
                            }))
                          }
                          className={`rounded-xl px-4 py-3 text-left text-sm font-bold transition ${
                            active
                              ? "bg-pink-500 text-white ring-2 ring-pink-200/50"
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
                    <p className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-xs text-white/70">
                      Selected:{" "}
                      <span className="font-bold text-white">
                        {form.paymentMethod}
                      </span>
                    </p>
                  )}
                </div>
              )}

              {form.type === "expense" && !form.sponsorId && (
                <label className="flex items-start gap-3 rounded-xl border border-sky-300/20 bg-sky-500/10 p-3">
                  <input
                    type="checkbox"
                    checked={form.isPersonalFunds}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        isPersonalFunds: e.target.checked,
                        paymentMethod: e.target.checked
                          ? "Personal Funds"
                          : prev.paymentMethod === "Personal Funds"
                          ? ""
                          : prev.paymentMethod,
                        personalFundsName: e.target.checked
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
                      This will be recorded, but it will not come off Burton
                      Pride’s balance until it is marked paid back.
                    </span>
                  </span>
                </label>
              )}

              {form.isPersonalFunds && !form.sponsorId && (
                <input
                  value={form.personalFundsName}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      personalFundsName: e.target.value,
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
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      transactionDate: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10 focus:ring-pink-300/40"
                />

                <p className="mt-2 text-xs text-white/40">
                  This transaction will be saved under Jan to Dec{" "}
                  {getTransactionYear(form.transactionDate)}.
                </p>
              </div>

              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Notes"
                className="min-h-24 w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10 focus:ring-pink-300/40"
              />

              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <label className="mb-2 flex items-center gap-2 text-sm font-bold text-white/70">
                  <FileText className="h-4 w-4" />
                  Upload invoice / receipt
                </label>

                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-pink-500 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-pink-400"
                />

                {invoiceFile && (
                  <p className="mt-2 break-words text-xs text-white/50">
                    Selected: {invoiceFile.name}
                  </p>
                )}

                {editingTransaction?.invoice_image_url && !invoiceFile && (
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

              <button
                type="submit"
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-pink-500 p-3 font-bold text-white hover:bg-pink-400 disabled:opacity-60"
              >
                <Banknote className="h-4 w-4" />
                {saving
                  ? editingTransaction
                    ? "Updating..."
                    : "Saving..."
                  : editingTransaction
                  ? "Update Transaction"
                  : "Save Transaction"}
              </button>
            </div>
          </form>

          <div className="min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-xl font-bold">Transactions</h2>
                <p className="text-sm text-white/50">
                  {yearTransactions.length} transaction
                  {yearTransactions.length === 1 ? "" : "s"} in {selectedYear}
                </p>
              </div>

              <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={printTransactions}
                  disabled={filteredTransactions.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500/15 px-4 py-2 text-sm font-bold text-sky-200 ring-1 ring-sky-300/20 hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </button>

                <button
                  type="button"
                  onClick={exportTransactionsToExcel}
                  disabled={filteredTransactions.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500/15 px-4 py-2 text-sm font-bold text-emerald-200 ring-1 ring-emerald-300/20 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  Export Excel
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteYearOpen(true)}
                  disabled={yearTransactions.length === 0 || deletingYear}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500/15 px-4 py-2 text-sm font-bold text-orange-200 ring-1 ring-orange-300/20 hover:bg-orange-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete {selectedYear}
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteAllOpen(true)}
                  disabled={transactions.length === 0 || deletingAll}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-500/15 px-4 py-2 text-sm font-bold text-red-200 ring-1 ring-red-300/20 hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete All
                </button>
              </div>
            </div>

            <div className="mb-4 space-y-3">
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`Search ${selectedYear} transactions...`}
                className="w-full rounded-xl bg-black/30 p-3 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/40 focus:ring-pink-300/40"
              />

              <div className="flex flex-wrap gap-2">
                {(
                  ["all", "income", "expense", "personal", "sponsorship"] as const
                ).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setFilter(item)}
                    className={`rounded-xl px-4 py-2 text-sm font-bold ${
                      filter === item
                        ? "bg-white text-black"
                        : "bg-white/10 text-white hover:bg-white/20"
                    }`}
                  >
                    {item === "all"
                      ? "All"
                      : item === "income"
                      ? "Money In"
                      : item === "expense"
                      ? "Money Out"
                      : item === "personal"
                      ? "Personal Funds"
                      : "Sponsorship"}
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-amber-100">
                      Organise by sponsor
                    </p>
                    <p className="text-xs text-amber-100/70">
                      Choose one sponsor to only show money in and spending
                      linked to them for {selectedYear}.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <select
                      value={selectedSponsorId}
                      onChange={(e) => {
                        const nextSponsorId = e.target.value;
                        setSelectedSponsorId(nextSponsorId);

                        if (nextSponsorId !== "all") {
                          setFilter("sponsorship");
                        }
                      }}
                      className="min-w-[240px] rounded-xl bg-black/30 p-3 text-sm text-white outline-none ring-1 ring-amber-300/20 focus:ring-amber-300/50"
                    >
                      <option className="bg-[#11111f] text-white" value="all">
                        All sponsors
                      </option>

                      {displaySponsors.map((sponsor) => (
                        <option
                          className="bg-[#11111f] text-white"
                          key={sponsor.id}
                          value={sponsor.id}
                        >
                          {sponsor.sponsor_name}
                        </option>
                      ))}
                    </select>

                    {selectedSponsorId !== "all" && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSponsorId("all");
                          setFilter("all");
                        }}
                        className="rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/20"
                      >
                        Clear sponsor
                      </button>
                    )}
                  </div>
                </div>

                {selectedSponsor && (
                  <div className="mt-3 rounded-xl bg-black/20 px-4 py-3 text-sm text-amber-100">
                    Showing {selectedYear} transactions for{" "}
                    <strong>{selectedSponsor.sponsor_name}</strong>. Export
                    Excel and Print will also use this sponsor view.
                  </div>
                )}
              </div>
            </div>

            {loading ? (
              <p>Loading...</p>
            ) : filteredTransactions.length === 0 ? (
              <div className="rounded-2xl bg-black/20 p-4 text-sm text-white/60">
                No transactions found for {selectedYear}
              </div>
            ) : (
              <div className="max-w-full overflow-x-auto overflow-y-hidden rounded-2xl border border-white/10">
                <table className="w-full min-w-[1250px] text-sm">
                  <thead className="bg-white/10 text-white/60">
                    <tr>
                      <th className="p-3 text-left">Date</th>
                      <th className="p-3 text-left">Title</th>
                      <th className="p-3 text-left">Type</th>
                      <th className="p-3 text-left">Sponsor</th>
                      <th className="p-3 text-left">Sponsorship Note</th>
                      <th className="p-3 text-left">Personal</th>
                      <th className="p-3 text-left">Paid By</th>
                      <th className="p-3 text-left">Repayment</th>
                      <th className="p-3 text-left">Payment</th>
                      <th className="p-3 text-left">Invoice</th>
                      <th className="p-3 text-right">Amount</th>
                      <th className="sticky right-0 bg-[#242435] p-3 text-right backdrop-blur">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredTransactions.map((item) => {
                      const isPersonal = isPersonalFundsTransaction(item);
                      const hasSponsor = isSponsorshipTransaction(item);

                      return (
                        <tr key={item.id} className="border-t border-white/10">
                          <td className="whitespace-nowrap p-3">
                            {item.transaction_date}
                          </td>

                          <td className="max-w-[220px] p-3">
                            <p className="break-words font-semibold">
                              {item.title}
                            </p>

                            {item.description && (
                              <p className="mt-1 line-clamp-3 break-words text-xs text-white/50">
                                {item.description}
                              </p>
                            )}
                          </td>

                          <td className="whitespace-nowrap p-3">
                            {item.type === "income" ? "Money In" : "Money Out"}
                          </td>

                          <td className="max-w-[160px] p-3">
                            {hasSponsor ? (
                              <span className="inline-flex rounded-2xl bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-100 ring-1 ring-amber-300/20">
                                {item.sponsor_name || "Sponsor"}
                              </span>
                            ) : (
                              <span className="text-white/40">—</span>
                            )}
                          </td>

                          <td className="max-w-[220px] p-3">
                            {item.sponsorship_note ? (
                              <span className="line-clamp-3 break-words text-sm text-amber-100">
                                {item.sponsorship_note}
                              </span>
                            ) : (
                              <span className="text-white/40">—</span>
                            )}
                          </td>

                          <td className="p-3">
                            {isPersonal ? (
                              <span className="inline-flex whitespace-nowrap rounded-2xl bg-sky-500/20 px-3 py-1 text-xs font-bold text-sky-100 ring-1 ring-sky-300/20">
                                Personal funds
                              </span>
                            ) : (
                              <span className="text-white/40">—</span>
                            )}
                          </td>

                          <td className="max-w-[160px] p-3">
                            {item.personal_funds_name ? (
                              <span className="break-words font-semibold text-sky-200">
                                {item.personal_funds_name}
                              </span>
                            ) : (
                              <span className="text-white/40">—</span>
                            )}
                          </td>

                          <td className="p-3">
                            {isPersonal ? (
                              <div className="space-y-2">
                                {item.personal_funds_repaid ? (
                                  <div className="rounded-2xl bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-200 ring-1 ring-emerald-300/20">
                                    Paid back
                                    {item.personal_funds_repaid_at && (
                                      <div className="mt-1 text-[11px] font-semibold text-emerald-100/70">
                                        {formatDate(
                                          item.personal_funds_repaid_at
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="rounded-2xl bg-orange-500/15 px-3 py-2 text-xs font-bold text-orange-200 ring-1 ring-orange-300/20">
                                    Not paid back
                                  </div>
                                )}

                                <button
                                  type="button"
                                  disabled={repayingId === item.id}
                                  onClick={() => togglePersonalFundsRepaid(item)}
                                  className={`w-full rounded-xl px-3 py-2 text-xs font-bold transition disabled:opacity-60 ${
                                    item.personal_funds_repaid
                                      ? "bg-orange-500/15 text-orange-200 ring-1 ring-orange-300/20 hover:bg-orange-500/25"
                                      : "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-300/20 hover:bg-emerald-500/25"
                                  }`}
                                >
                                  {repayingId === item.id
                                    ? "Updating..."
                                    : item.personal_funds_repaid
                                    ? "Mark not paid back"
                                    : "Mark paid back"}
                                </button>
                              </div>
                            ) : (
                              <span className="text-white/40">—</span>
                            )}
                          </td>

                          <td className="whitespace-nowrap p-3">
                            {item.payment_method || "—"}
                          </td>

                          <td className="p-3">
                            {item.invoice_image_url ? (
                              <a
                                href={item.invoice_image_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20"
                              >
                                <FileText className="h-4 w-4" />
                                View
                              </a>
                            ) : (
                              <span className="text-white/40">—</span>
                            )}
                          </td>

                          <td className="whitespace-nowrap p-3 text-right font-bold">
                            <div>{money(item.amount_pence)}</div>

                            {hasSponsor && (
                              <div className="mt-1 text-xs font-semibold text-amber-300">
                                {item.type === "income"
                                  ? "Sponsor money in"
                                  : "Sponsor-funded spend"}
                              </div>
                            )}

                            {isPersonal && item.personal_funds_repaid && (
                              <div className="mt-1 text-xs font-semibold text-emerald-300">
                                Taken from balance
                              </div>
                            )}

                            {isPersonal && !item.personal_funds_repaid && (
                              <div className="mt-1 text-xs font-semibold text-orange-300">
                                Not taken yet
                              </div>
                            )}
                          </td>

                          <td className="sticky right-0 bg-[#11111f] p-3 text-right">
                            <div className="inline-flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => startEditTransaction(item)}
                                className="inline-flex items-center justify-center rounded-xl bg-sky-500/15 p-2 text-sky-200 hover:bg-sky-500/25"
                                title="Edit transaction"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>

                              <button
                                type="button"
                                disabled={deleting}
                                onClick={() => setDeleteId(item.id)}
                                className="inline-flex items-center justify-center rounded-xl bg-red-500/15 p-2 text-red-200 hover:bg-red-500/25 disabled:opacity-50"
                                title="Delete transaction"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>

      {sponsorFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#070716] p-6 text-white shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">
                  {editingSponsor ? "Edit Sponsor" : "Add Sponsor"}
                </h2>
                <p className="text-sm text-white/60">
                  {editingSponsor
                    ? "Update this sponsor’s details, agreed amount, and received money."
                    : "Add sponsor details so income and spending can be tracked clearly."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeSponsorForm}
                className="rounded-xl bg-white/10 p-2 hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <input
                value={sponsorForm.sponsorName}
                onChange={(e) =>
                  setSponsorForm((prev) => ({
                    ...prev,
                    sponsorName: e.target.value,
                  }))
                }
                placeholder="Sponsor name"
                className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10"
              />

              <input
                value={sponsorForm.contactName}
                onChange={(e) =>
                  setSponsorForm((prev) => ({
                    ...prev,
                    contactName: e.target.value,
                  }))
                }
                placeholder="Contact name"
                className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10"
              />

              <input
                value={sponsorForm.email}
                onChange={(e) =>
                  setSponsorForm((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }))
                }
                placeholder="Email"
                className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10"
              />

              <input
                value={sponsorForm.phone}
                onChange={(e) =>
                  setSponsorForm((prev) => ({
                    ...prev,
                    phone: e.target.value,
                  }))
                }
                placeholder="Phone"
                className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10"
              />

              <input
                value={sponsorForm.agreedAmount}
                onChange={(e) =>
                  setSponsorForm((prev) => ({
                    ...prev,
                    agreedAmount: e.target.value,
                  }))
                }
                placeholder="Agreed sponsorship amount, e.g. 1300"
                type="number"
                step="0.01"
                className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10"
              />

              <input
                value={sponsorForm.receivedAmount}
                onChange={(e) =>
                  setSponsorForm((prev) => ({
                    ...prev,
                    receivedAmount: e.target.value,
                  }))
                }
                placeholder="Received sponsorship money, e.g. 1300"
                type="number"
                step="0.01"
                className="w-full rounded-xl bg-emerald-500/10 p-3 outline-none ring-1 ring-emerald-300/20 focus:ring-emerald-300/40"
              />

              <textarea
                value={sponsorForm.notes}
                onChange={(e) =>
                  setSponsorForm((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
                placeholder="Notes / agreed use / restrictions"
                className="min-h-24 w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10"
              />

              <button
                type="button"
                disabled={savingSponsor}
                onClick={saveSponsor}
                className="w-full rounded-xl bg-amber-500 px-4 py-3 font-bold text-black hover:bg-amber-400 disabled:opacity-60"
              >
                {savingSponsor
                  ? editingSponsor
                    ? "Updating..."
                    : "Saving..."
                  : editingSponsor
                  ? "Update Sponsor"
                  : "Save Sponsor"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteYearOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#070716] p-6 text-white shadow-2xl">
            <h2 className="text-xl font-bold">
              Delete {selectedYear} transactions?
            </h2>

            <p className="mt-3 text-sm text-white/70">
              This will only delete transactions dated between January and
              December {selectedYear}. Other years will stay safe.
            </p>

            <div className="mt-5 rounded-2xl border border-orange-400/20 bg-orange-500/10 p-4 text-sm text-orange-100">
              This will delete {yearTransactions.length} transaction
              {yearTransactions.length === 1 ? "" : "s"} from {selectedYear}.
            </div>

            <label className="mt-5 block text-sm font-bold text-white/80">
              Main admin delete password
            </label>

            <input
              type="password"
              value={deleteYearPassword}
              onChange={(e) => setDeleteYearPassword(e.target.value)}
              placeholder="Enter main admin delete password"
              autoComplete="new-password"
              name="money-delete-year-password"
              className="mt-2 w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/40 focus:ring-orange-300/40"
            />

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeleteYearOpen(false);
                  setDeleteYearPassword("");
                }}
                disabled={deletingYear}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={deleteSelectedYearTransactions}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#070716] p-6 text-white shadow-2xl">
            <h2 className="text-xl font-bold">Delete sponsor?</h2>

            <p className="mt-3 text-sm text-white/70">
              Are you sure you want to delete this sponsor? Existing transactions
              will stay in your money tracker, but the sponsor link will be
              removed from those transactions.
            </p>

            <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm text-amber-100">
              Export your Excel report first if you need to keep a full sponsor
              breakdown before deleting.
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteSponsorId(null)}
                disabled={deletingSponsor}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={deleteSponsor}
                disabled={deletingSponsor}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-400 disabled:opacity-60"
              >
                {deletingSponsor ? "Deleting..." : "Delete Sponsor"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#070716] p-6 text-white shadow-2xl">
            <h2 className="text-xl font-bold">Delete payment?</h2>

            <p className="mt-3 text-sm text-white/70">
              Are you sure you want to delete this transaction? This cannot be
              undone.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                disabled={deleting}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={deleteTransaction}
                disabled={deleting}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-400 disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteAllOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#070716] p-6 text-white shadow-2xl">
            <h2 className="text-xl font-bold">Delete all transactions?</h2>

            <p className="mt-3 text-sm text-white/70">
              Are you sure you want to delete every transaction? This will delete
              all money in, money out, manual transactions, synced donation
              entries, and sponsor-linked transactions. This cannot be undone.
            </p>

            <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
              This will delete every transaction in the database, not just{" "}
              {selectedYear}. There are currently {transactions.length} total
              transaction{transactions.length === 1 ? "" : "s"} saved.
            </div>

            <label className="mt-5 block text-sm font-bold text-white/80">
              Main admin delete password
            </label>

            <input
              type="password"
              value={deleteAllPassword}
              onChange={(e) => setDeleteAllPassword(e.target.value)}
              placeholder="Enter main admin delete password"
              autoComplete="new-password"
              name="money-delete-all-password"
              className="mt-2 w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/40 focus:ring-red-300/40"
            />

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeleteAllOpen(false);
                  setDeleteAllPassword("");
                }}
                disabled={deletingAll}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={deleteAllTransactions}
                disabled={deletingAll || !deleteAllPassword.trim()}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingAll ? "Deleting..." : "Delete Everything"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/*
  MONEY TRACKER TODO / FUTURE FEATURES

  1. Delete selected year with main admin password
     - Make “Delete selected year” ask for the main admin delete password.
     - Connect it to /api/admin/settings/delete-password.
     - Use the same protection as Delete All.

  2. Export full yearly report
     - Add a yearly report export button.
     - Include opening balance, money in, money out, personal funds,
       sponsorship breakdown, and all transactions.

  3. Audit log
     - Save a log every time someone creates, edits, deletes,
       restores, or marks a transaction paid back.
     - Store who did it, what changed, and when.

  4. Undo delete / soft delete
     - Do not permanently delete transactions straight away.
     - Add deleted_at and deleted_by fields.
     - Hide deleted transactions by default.
     - Add a restore deleted transactions area.

  5. Receipt preview
     - Show a small preview or file name in the transaction row.
     - Keep the View button as well.

  6. Required sponsor spending notes
     - When sponsor money is used, make sponsorshipNote required.
     - This helps prove why sponsor money was spent.

  7. Remaining sponsor warning
     - Warn if sponsor spending is more than the sponsor has left.
     - Example: “This spend is £50 over the remaining sponsor balance.”

  8. Monthly breakdown
     - Add a Jan to Dec monthly view.
     - Show money in, money out, donations, expenses, and balance by month.

  9. Search by amount
     - Update search so typing “25” finds £25 transactions.
     - Match against amount_pence converted to pounds.

  10. Filter by payment method
      - Add filter for Stripe, Cash, Bank Transfer, PayPal,
        Card Machine, Personal Funds, and Item Donation.

  11. Dashboard charts
      - Add simple charts for:
        - money in/out by month
        - donations vs expenses
        - sponsor money left

  12. Lock old years
      - Add a lock year button when accounts are finished.
      - Example: lock 2026 after year-end.
      - Only main admin can unlock/edit locked years.

  13. Transaction reference number
      - Give each transaction a reference like BP-2026-001.
      - Useful for accounts, receipts, and reports.

  14. Multiple file attachments
      - Allow more than one file per transaction.
      - Useful for receipts, invoices, bank screenshots, or emails.

  15. Mark transaction as checked
      - Add “Checked by admin” tick box.
      - Store checked_by and checked_at.

  16. CSV import
      - Allow bank statement CSV upload.
      - Let admin match/import transactions manually.

  17. Separate Stripe sync button
      - Stop syncing Stripe automatically on page load.
      - Add button: “Sync Stripe Donations”.
      - Keep manual money tracker work separate from Stripe.

  18. Year-end carry forward note
      - Show how opening balance was calculated from previous years.
      - Make it clear for accounts.

  19. Role permissions
      - Main admin only:
        - delete all
        - delete selected year
        - edit old years
        - change sponsor totals
      - Normal admins:
        - add transactions only

  20. Confirmation typing
      - For dangerous actions, ask admin to type:
        - DELETE ALL
        - DELETE YEAR
        - DELETE 2026 / selected year
      - Also require the main admin delete password.
*/