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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

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
      notes: null,
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

    return displaySponsors.find((sponsor) => sponsor.id === selectedSponsorId) || null;
  }, [displaySponsors, selectedSponsorId]);

  const filteredTransactions = useMemo(() => {
    let rows = transactions;

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
      const sponsor = displaySponsors.find((item) => item.id === selectedSponsorId);
      const sponsorName = sponsor?.sponsor_name?.toLowerCase().trim() || "";

      rows = rows.filter((item) => {
        const transactionSponsorName = item.sponsor_name?.toLowerCase().trim() || "";

        return (
          item.sponsor_id === selectedSponsorId ||
          Boolean(sponsorName && transactionSponsorName === sponsorName)
        );
      });
    }

    return rows;
  }, [transactions, filter, selectedSponsorId, displaySponsors]);

  const totals = useMemo(() => {
    const income = transactions
      .filter((item) => item.type === "income")
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    const normalExpense = transactions
      .filter(
        (item) => item.type === "expense" && !isPersonalFundsTransaction(item)
      )
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    const personalFunds = transactions
      .filter((item) => isPersonalFundsTransaction(item))
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    const personalFundsRepaid = transactions
      .filter(
        (item) =>
          isPersonalFundsTransaction(item) && item.personal_funds_repaid === true
      )
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    const sponsorshipIncome = sponsorBreakdown.reduce(
      (sum, item) => sum + (item.received_pence || 0),
      0
    );

    const sponsorshipSpent = sponsorBreakdown.reduce(
      (sum, item) => sum + (item.spent_pence || 0),
      0
    );

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
      balance: income - expense,
    };
  }, [transactions, sponsorBreakdown]);

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
      balance: income - expense,
    };
  }, [filteredTransactions]);

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
      category: "Donation",
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
      const sponsorName = sponsor.sponsor_name?.toLowerCase().trim() || "";
      const itemSponsorName = item.sponsor_name?.toLowerCase().trim() || "";

      return (
        sponsor.id === item.sponsor_id ||
        Boolean(sponsorName && itemSponsorName && sponsorName === itemSponsorName)
      );
    });

    setEditingTransaction(item);

    setForm({
      title: item.title || "",
      description: item.description || "",
      type: item.type,
      category: item.category || "",
      amount: ((item.amount_pence || 0) / 100).toFixed(2),
      paymentMethod:
        item.source === "sponsorship" || item.sponsor_id || item.sponsor_name
          ? "Sponsorship Money"
          : item.payment_method || "",
      transactionDate:
        item.transaction_date || new Date().toISOString().slice(0, 10),
      isPersonalFunds: isPersonal,
      personalFundsName: item.personal_funds_name || "",
      sponsorId: matchingSponsor?.id || item.sponsor_id || "",
      sponsorName:
        matchingSponsor?.sponsor_name || item.sponsor_name || "",
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
      uploadData.append("type", form.type);
      uploadData.append("category", form.category);
      uploadData.append("amount", form.amount);
      uploadData.append(
        "paymentMethod",
        isSponsorLinked ? "Sponsorship Money" : form.paymentMethod
      );
      uploadData.append("transactionDate", form.transactionDate);
      uploadData.append("source", isSponsorLinked ? "sponsorship" : "manual");
      uploadData.append("isPersonalFunds", String(form.isPersonalFunds));
      uploadData.append("personalFundsName", form.personalFundsName);
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

  async function deleteAllTransactions() {
    try {
      setDeletingAll(true);
      setError("");
      setErrorDetails(null);

      const res = await fetch("/api/admin/money/transactions", {
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
          message: data.error || "Failed to delete all transactions",
          details: data,
          status: res.status,
        };
      }

      setDeleteAllOpen(false);
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
    const exportedAt = new Date().toLocaleString("en-GB");

    const baseFilterLabel =
      filter === "all"
        ? "All Transactions"
        : filter === "income"
        ? "Money In"
        : filter === "expense"
        ? "Money Out"
        : filter === "personal"
        ? "Personal Funds"
        : "Sponsorship";

    const filterLabel = selectedSponsor
      ? `${baseFilterLabel} — ${selectedSponsor.sponsor_name}`
      : baseFilterLabel;

    const rows = filteredTransactions;

    function x(value: string | number | null | undefined) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function cell(
      value: string | number | null | undefined,
      style = "Normal",
      mergeAcross?: number
    ) {
      return `
        <Cell ss:StyleID="${style}"${
        mergeAcross ? ` ss:MergeAcross="${mergeAcross}"` : ""
      }>
          <Data ss:Type="String">${x(value)}</Data>
        </Cell>
      `;
    }

    function row(cells: string, height?: number) {
      return `<Row${height ? ` ss:Height="${height}"` : ""}>${cells}</Row>`;
    }

    const sponsorRows =
      sponsorBreakdown.length === 0
        ? row(cell("No sponsors added.", "Empty", 19))
        : sponsorBreakdown
            .map((sponsor) =>
              row(`
                ${cell(sponsor.sponsor_name, "Bold")}
                ${cell(sponsor.contact_name || "—")}
                ${cell(sponsor.email || "—")}
                ${cell(sponsor.phone || "—")}
                ${cell(money(sponsor.agreed_amount_pence), "AmountGrey")}
                ${cell(money(sponsor.received_pence), "AmountGreen")}
                ${cell(money(sponsor.spent_pence), "AmountRed")}
                ${cell(money(sponsor.remaining_pence), "AmountAmber")}
                ${cell("", "Blank", 11)}
              `)
            )
            .join("");

    const transactionRows =
      rows.length === 0
        ? row(cell("No transactions to export.", "Empty", 19))
        : rows
            .map((item) => {
              const isIncome = item.type === "income";
              const isPersonal = isPersonalFundsTransaction(item);
              const hasSponsor = isSponsorshipTransaction(item);

              return row(`
                ${cell(formatDate(item.transaction_date))}
                ${cell(formatDate(item.created_at))}
                ${cell(item.title, "Bold")}
                ${cell(item.description || "—")}
                ${cell(
                  isIncome ? "Money In" : "Money Out",
                  isIncome ? "MoneyIn" : "MoneyOut"
                )}
                ${cell(item.category || "Other")}
                ${cell(item.payment_method || "—")}
                ${cell(
                  sourceLabel(item.source),
                  item.source === "sponsorship"
                    ? "SponsorSource"
                    : "ManualSource"
                )}
                ${cell(
                  hasSponsor ? item.sponsor_name || "Sponsor" : "—",
                  hasSponsor ? "SponsorCell" : "Normal"
                )}
                ${cell(item.sponsorship_note || "—")}
                ${cell(
                  isPersonal ? "Yes" : "No",
                  isPersonal ? "PersonalCell" : "Normal"
                )}
                ${cell(item.personal_funds_name || "—")}
                ${cell(
                  isPersonal
                    ? item.personal_funds_repaid
                      ? "Paid back"
                      : "Not paid back"
                    : "—",
                  isPersonal
                    ? item.personal_funds_repaid
                      ? "PaidBack"
                      : "NotPaidBack"
                    : "Normal"
                )}
                ${cell(formatDate(item.personal_funds_repaid_at))}
                ${cell(item.invoice_image_url || "—")}
                ${cell(item.stripe_session_id || "—")}
                ${cell(item.stripe_invoice_id || "—")}
                ${cell(item.stripe_customer_id || "—")}
                ${cell(item.stripe_payment_intent_id || "—")}
                ${cell(money(item.amount_pence), "Amount")}
              `);
            })
            .join("");

    const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook
  xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">

  <Styles>
    <Style ss:ID="Normal">
      <Alignment ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:FontName="Arial" ss:Size="10"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D1D5DB"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D1D5DB"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D1D5DB"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D1D5DB"/>
      </Borders>
    </Style>

    <Style ss:ID="Blank">
      <Font ss:FontName="Arial" ss:Size="10"/>
    </Style>

    <Style ss:ID="Title">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="18" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#07111F" ss:Pattern="Solid"/>
    </Style>

    <Style ss:ID="Subtitle">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="10" ss:Color="#E5E7EB"/>
      <Interior ss:Color="#374151" ss:Pattern="Solid"/>
    </Style>

    <Style ss:ID="Filter">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#111827"/>
      <Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/>
    </Style>

    <Style ss:ID="Section">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="12" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#111827" ss:Pattern="Solid"/>
    </Style>

    <Style ss:ID="Header">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#07111F" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#07111F"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#07111F"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#07111F"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#07111F"/>
      </Borders>
    </Style>

    <Style ss:ID="Bold">
      <Alignment ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D1D5DB"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D1D5DB"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D1D5DB"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D1D5DB"/>
      </Borders>
    </Style>

    <Style ss:ID="MoneyIn">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#166534"/>
      <Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/>
    </Style>

    <Style ss:ID="MoneyOut">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#991B1B"/>
      <Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/>
    </Style>

    <Style ss:ID="ManualSource">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#065F46"/>
      <Interior ss:Color="#D1FAE5" ss:Pattern="Solid"/>
    </Style>

    <Style ss:ID="SponsorSource">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#92400E"/>
      <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
    </Style>

    <Style ss:ID="SponsorCell">
      <Alignment ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#92400E"/>
      <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
    </Style>

    <Style ss:ID="PersonalCell">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#075985"/>
      <Interior ss:Color="#E0F2FE" ss:Pattern="Solid"/>
    </Style>

    <Style ss:ID="PaidBack">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#166534"/>
      <Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/>
    </Style>

    <Style ss:ID="NotPaidBack">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#9A3412"/>
      <Interior ss:Color="#FFEDD5" ss:Pattern="Solid"/>
    </Style>

    <Style ss:ID="Amount">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1"/>
    </Style>

    <Style ss:ID="AmountGrey">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1"/>
      <Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/>
    </Style>

    <Style ss:ID="AmountGreen">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#166534"/>
      <Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/>
    </Style>

    <Style ss:ID="AmountRed">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#991B1B"/>
      <Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/>
    </Style>

    <Style ss:ID="AmountAmber">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#92400E"/>
      <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
    </Style>

    <Style ss:ID="Empty">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#6B7280"/>
      <Interior ss:Color="#F9FAFB" ss:Pattern="Solid"/>
    </Style>

    <Style ss:ID="SummaryIncome">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="11" ss:Bold="1" ss:Color="#166534"/>
      <Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/>
    </Style>

    <Style ss:ID="SummaryExpense">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="11" ss:Bold="1" ss:Color="#991B1B"/>
      <Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/>
    </Style>

    <Style ss:ID="SummaryPersonal">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="11" ss:Bold="1" ss:Color="#075985"/>
      <Interior ss:Color="#E0F2FE" ss:Pattern="Solid"/>
    </Style>

    <Style ss:ID="SummaryOwed">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="11" ss:Bold="1" ss:Color="#9A3412"/>
      <Interior ss:Color="#FFEDD5" ss:Pattern="Solid"/>
    </Style>

    <Style ss:ID="SummarySponsor">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="11" ss:Bold="1" ss:Color="#92400E"/>
      <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
    </Style>

    <Style ss:ID="SummaryBalance">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="11" ss:Bold="1" ss:Color="#1E40AF"/>
      <Interior ss:Color="#DBEAFE" ss:Pattern="Solid"/>
    </Style>
  </Styles>

  <Worksheet ss:Name="Money Transactions">
    <Table ss:ExpandedColumnCount="20" ss:DefaultRowHeight="20">
      <Column ss:AutoFitWidth="0" ss:Width="95"/>
      <Column ss:AutoFitWidth="0" ss:Width="95"/>
      <Column ss:AutoFitWidth="0" ss:Width="160"/>
      <Column ss:AutoFitWidth="0" ss:Width="240"/>
      <Column ss:AutoFitWidth="0" ss:Width="90"/>
      <Column ss:AutoFitWidth="0" ss:Width="110"/>
      <Column ss:AutoFitWidth="0" ss:Width="120"/>
      <Column ss:AutoFitWidth="0" ss:Width="120"/>
      <Column ss:AutoFitWidth="0" ss:Width="140"/>
      <Column ss:AutoFitWidth="0" ss:Width="220"/>
      <Column ss:AutoFitWidth="0" ss:Width="110"/>
      <Column ss:AutoFitWidth="0" ss:Width="130"/>
      <Column ss:AutoFitWidth="0" ss:Width="130"/>
      <Column ss:AutoFitWidth="0" ss:Width="120"/>
      <Column ss:AutoFitWidth="0" ss:Width="160"/>
      <Column ss:AutoFitWidth="0" ss:Width="180"/>
      <Column ss:AutoFitWidth="0" ss:Width="180"/>
      <Column ss:AutoFitWidth="0" ss:Width="180"/>
      <Column ss:AutoFitWidth="0" ss:Width="180"/>
      <Column ss:AutoFitWidth="0" ss:Width="100"/>

      ${row(cell("Burton Pride Money Tracker", "Title", 19), 32)}
      ${row(cell(`Exported on ${exportedAt}`, "Subtitle", 19), 24)}

      ${row(
        `
          ${cell(`Filter: ${filterLabel}`, "Filter", 4)}
          ${cell(`Rows Exported: ${rows.length}`, "Filter", 4)}
          ${cell(`Sponsors: ${sponsorBreakdown.length}`, "Filter", 4)}
          ${cell("Burton Pride C.I.C", "Filter", 4)}
        `,
        24
      )}

      ${row(
        `
          ${cell(`Money In: ${money(filteredTotals.income)}`, "SummaryIncome", 2)}
          ${cell(`Money Out: ${money(filteredTotals.expense)}`, "SummaryExpense", 2)}
          ${cell(`Personal Funds: ${money(filteredTotals.personalFunds)}`, "SummaryPersonal", 2)}
          ${cell(`Still Owed: ${money(filteredTotals.personalFundsOutstanding)}`, "SummaryOwed", 2)}
          ${cell(`Sponsorship Left: ${money(totals.sponsorshipRemaining)}`, "SummarySponsor", 3)}
          ${cell(`Balance: ${money(filteredTotals.balance)}`, "SummaryBalance", 3)}
        `,
        28
      )}

      ${row(cell("", "Blank", 19), 12)}
      ${row(cell("Sponsorship Breakdown", "Section", 19), 24)}

      ${row(
        `
          ${cell("Sponsor", "Header")}
          ${cell("Contact", "Header")}
          ${cell("Email", "Header")}
          ${cell("Phone", "Header")}
          ${cell("Agreed", "Header")}
          ${cell("Received", "Header")}
          ${cell("Spent", "Header")}
          ${cell("Remaining", "Header")}
          ${cell("", "Header", 11)}
        `,
        24
      )}

      ${sponsorRows}

      ${row(cell("", "Blank", 19), 12)}
      ${row(cell("Transactions", "Section", 19), 24)}

      ${row(
        `
          ${cell("Date", "Header")}
          ${cell("Created At", "Header")}
          ${cell("Title", "Header")}
          ${cell("Description", "Header")}
          ${cell("Type", "Header")}
          ${cell("Category", "Header")}
          ${cell("Payment Method", "Header")}
          ${cell("Source", "Header")}
          ${cell("Sponsor", "Header")}
          ${cell("Sponsorship Note", "Header")}
          ${cell("Personal Funds", "Header")}
          ${cell("Paid By", "Header")}
          ${cell("Paid Back Status", "Header")}
          ${cell("Paid Back Date", "Header")}
          ${cell("Invoice / Receipt", "Header")}
          ${cell("Stripe Session ID", "Header")}
          ${cell("Stripe Invoice ID", "Header")}
          ${cell("Stripe Customer ID", "Header")}
          ${cell("Stripe Payment Intent ID", "Header")}
          ${cell("Amount", "Header")}
        `,
        26
      )}

      ${transactionRows}
    </Table>

    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <FreezePanes/>
      <FrozenNoSplit/>
      <SplitHorizontal>10</SplitHorizontal>
      <TopRowBottomPane>10</TopRowBottomPane>
      <ActivePane>2</ActivePane>
      <ProtectObjects>False</ProtectObjects>
      <ProtectScenarios>False</ProtectScenarios>
    </WorksheetOptions>
  </Worksheet>
</Workbook>`;

    const blob = new Blob([xml], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `burton-pride-money-transactions-${fileDate}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  function printTransactions() {
    const printedAt = new Date().toLocaleString("en-GB");

    const baseFilterLabel =
      filter === "all"
        ? "All Transactions"
        : filter === "income"
        ? "Money In"
        : filter === "expense"
        ? "Money Out"
        : filter === "personal"
        ? "Personal Funds"
        : "Sponsorship";

    const filterLabel = selectedSponsor
      ? `${baseFilterLabel} — ${selectedSponsor.sponsor_name}`
      : baseFilterLabel;

    const sponsorRows =
      sponsorBreakdown.length === 0
        ? `
          <tr>
            <td colspan="7" class="empty">No sponsors added.</td>
          </tr>
        `
        : sponsorBreakdown
            .map(
              (sponsor) => `
                <tr>
                  <td><strong>${escapeHtml(sponsor.sponsor_name)}</strong></td>
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
        ? `
          <tr>
            <td colspan="12" class="empty">No transactions to print.</td>
          </tr>
        `
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
                    ${
                      item.category
                        ? `<div class="small">${escapeHtml(item.category)}</div>`
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

                  <td>
                    ${
                      isPersonal
                        ? `<span class="badge personal">Personal funds</span>`
                        : "—"
                    }
                  </td>

                  <td>${escapeHtml(item.personal_funds_name || "—")}</td>

                  <td>
                    ${
                      isPersonal
                        ? item.personal_funds_repaid
                          ? `<span class="badge paid">Paid back</span>`
                          : `<span class="badge unpaid">Not paid back</span>`
                        : "—"
                    }
                  </td>

                  <td>${escapeHtml(item.payment_method || "—")}</td>

                  <td>${escapeHtml(sourceLabel(item.source))}</td>

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
          <title>Burton Pride Money Tracker Report</title>

          <style>
            * {
              box-sizing: border-box;
            }

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
              line-height: 1.1;
            }

            .header p {
              margin: 8px 0 0;
              font-size: 12px;
              color: #d1d5db;
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
              grid-template-columns: repeat(6, 1fr);
              gap: 10px;
              margin: 18px 0;
            }

            .card {
              border: 1px solid #d1d5db;
              border-radius: 12px;
              padding: 12px;
              min-height: 70px;
            }

            .card span {
              display: block;
              font-size: 10px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.06em;
              margin-bottom: 6px;
            }

            .card strong {
              font-size: 18px;
            }

            .income-card {
              background: #dcfce7;
              color: #166534;
              border-color: #86efac;
            }

            .expense-card {
              background: #fee2e2;
              color: #991b1b;
              border-color: #fca5a5;
            }

            .personal-card {
              background: #e0f2fe;
              color: #075985;
              border-color: #7dd3fc;
            }

            .owed-card {
              background: #ffedd5;
              color: #9a3412;
              border-color: #fdba74;
            }

            .sponsor-card {
              background: #fef3c7;
              color: #92400e;
              border-color: #fcd34d;
            }

            .balance-card {
              background: #dbeafe;
              color: #1e40af;
              border-color: #93c5fd;
            }

            h2 {
              margin: 22px 0 10px;
              font-size: 17px;
              color: #111827;
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
              text-transform: uppercase;
              letter-spacing: 0.03em;
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

            .green {
              color: #166534;
              background: #dcfce7;
            }

            .red {
              color: #991b1b;
              background: #fee2e2;
            }

            .amber {
              color: #92400e;
              background: #fef3c7;
            }

            .badge {
              display: inline-block;
              border-radius: 999px;
              padding: 4px 8px;
              font-size: 9.5px;
              font-weight: 800;
              white-space: nowrap;
            }

            .badge.income {
              background: #dcfce7;
              color: #166534;
            }

            .badge.expense {
              background: #fee2e2;
              color: #991b1b;
            }

            .badge.sponsor {
              background: #fef3c7;
              color: #92400e;
            }

            .badge.personal {
              background: #e0f2fe;
              color: #075985;
            }

            .badge.paid {
              background: #dcfce7;
              color: #166534;
            }

            .badge.unpaid {
              background: #ffedd5;
              color: #9a3412;
            }

            .muted {
              margin-top: 4px;
              color: #6b7280;
              font-size: 9.5px;
              white-space: pre-wrap;
            }

            .small {
              margin-top: 4px;
              color: #6b7280;
              font-size: 9px;
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
              body {
                padding: 10mm;
              }

              @page {
                size: A4 landscape;
                margin: 10mm;
              }

              .summary {
                grid-template-columns: repeat(6, 1fr);
                page-break-inside: avoid;
              }

              table {
                page-break-inside: auto;
              }

              thead {
                display: table-header-group;
              }

              tr {
                page-break-inside: avoid;
                page-break-after: auto;
              }

              h2 {
                page-break-after: avoid;
              }
            }
          </style>
        </head>

        <body>
          <div class="header">
            <h1>Burton Pride Money Tracker</h1>
            <p>Money report for Burton Pride C.I.C</p>
          </div>

          <div class="meta">
            Printed on ${escapeHtml(printedAt)} • Filter: ${escapeHtml(
      filterLabel
    )} • Rows: ${filteredTransactions.length}
          </div>

          <div class="summary">
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

          <h2>Sponsorship Breakdown</h2>

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

            <tbody>
              ${sponsorRows}
            </tbody>
          </table>

          <h2>Transactions</h2>

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
                <th>Source</th>
                <th>Invoice</th>
                <th>Amount</th>
              </tr>
            </thead>

            <tbody>
              ${transactionRows}
            </tbody>
          </table>

          <div class="footer">
            Burton Pride Money Management App
          </div>

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
  }, [filteredTransactions, filter, sponsorBreakdown, filteredTotals, totals]);

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#070716] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Money Tracker</h1>
              <p className="text-sm text-white/60">
                Track donations, spending, personal funds, and sponsorship
                money.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                loadTransactions();
                loadSponsors();
              }}
              className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
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

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
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
                Track who sponsored, what came in, what has been spent, and what
                is left.
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

          {sponsorBreakdown.length === 0 ? (
            <div className="rounded-2xl bg-black/20 p-4 text-sm text-white/60">
              No sponsors added yet.
            </div>
          ) : (
            <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sponsorBreakdown.map((sponsor) => (
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

              <select
                value={form.type}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    type: e.target.value as "income" | "expense",
                    isPersonalFunds:
                      e.target.value === "income" ? false : prev.isPersonalFunds,
                    personalFundsName:
                      e.target.value === "income" ? "" : prev.personalFundsName,
                  }))
                }
                className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10 focus:ring-pink-300/40"
              >
                <option value="income">Money In</option>
                <option value="expense">Money Out</option>
              </select>

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

              <input
                value={form.category}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, category: e.target.value }))
                }
                placeholder="Category"
                className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10 focus:ring-pink-300/40"
              />

              <div className="rounded-xl border border-amber-300/20 bg-amber-500/10 p-3">
                <label className="mb-2 block text-sm font-bold text-amber-100">
                  Sponsorship tracking
                </label>

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
                      category: selected
                        ? "Sponsorship"
                        : prev.category === "Sponsorship"
                        ? ""
                        : prev.category,
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
                  <option value="">Choose sponsor...</option>

                  {displaySponsors.map((sponsor) => (
                    <option key={sponsor.id} value={sponsor.id}>
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
                    This is locked because a sponsor is linked. Remove the sponsor if this was paid another way.
                  </p>
                </div>
              ) : (
                <select
                  value={form.paymentMethod}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      paymentMethod: e.target.value,
                      isPersonalFunds:
                        e.target.value === "Personal Funds"
                          ? true
                          : prev.isPersonalFunds,
                    }))
                  }
                  className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10 focus:ring-pink-300/40"
                >
                  <option value="">Choose payment method...</option>
                  <option value="Stripe">Stripe</option>
                  <option value="Online">Online Payment</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="PayPal">PayPal</option>
                  <option value="Card Machine">Card Machine</option>
                  <option value="Personal Funds">Personal Funds</option>
                </select>
              )}

              {form.type === "expense" && (
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

              {form.isPersonalFunds && (
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
                  {transactions.length} total transaction
                  {transactions.length === 1 ? "" : "s"}
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
                      Choose one sponsor to only show money in and spending linked to them.
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
                      <option value="all">All sponsors</option>

                      {displaySponsors.map((sponsor) => (
                        <option key={sponsor.id} value={sponsor.id}>
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
                    Showing transactions for <strong>{selectedSponsor.sponsor_name}</strong>. Export Excel and Print will also use this sponsor view.
                  </div>
                )}
              </div>
            </div>

            {loading ? (
              <p>Loading...</p>
            ) : filteredTransactions.length === 0 ? (
              <div className="rounded-2xl bg-black/20 p-4 text-sm text-white/60">
                No transactions yet
              </div>
            ) : (
              <div className="max-w-full overflow-x-auto overflow-y-hidden rounded-2xl border border-white/10">
                <table className="w-full min-w-[1350px] text-sm">
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
                      <th className="p-3 text-left">Source</th>
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

                            {item.category && (
                              <p className="mt-1 break-words text-xs text-white/40">
                                {item.category}
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
                            <span
                              className={`inline-flex min-w-[110px] items-center justify-center rounded-2xl px-3 py-2 text-xs font-bold leading-tight ${
                                item.source === "website_donation" ||
                                item.source === "website_monthly_donation"
                                  ? "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-300/20"
                                  : item.source === "sponsorship"
                                  ? "bg-amber-500/20 text-amber-100 ring-1 ring-amber-300/20"
                                  : "bg-white/10 text-white/80 ring-1 ring-white/10"
                              }`}
                            >
                              {sourceLabel(item.source)}
                            </span>
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
              This will delete {transactions.length} transaction
              {transactions.length === 1 ? "" : "s"}.
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteAllOpen(false)}
                disabled={deletingAll}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={deleteAllTransactions}
                disabled={deletingAll}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-400 disabled:opacity-60"
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
