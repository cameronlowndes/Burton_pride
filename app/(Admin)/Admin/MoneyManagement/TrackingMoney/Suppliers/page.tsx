"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ClipboardList,
  Edit3,
  Loader2,
  Mail,
  Phone,
  Plus,
  RefreshCcw,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

type Supplier = {
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

type SupplierForm = {
  supplierName: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  category: string;
  notes: string;
  isActive: boolean;
};

const DEFAULT_CATEGORIES = [
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

const EMPTY_FORM: SupplierForm = {
  supplierName: "",
  contactName: "",
  email: "",
  phone: "",
  website: "",
  category: "",
  notes: "",
  isActive: true,
};

const EASY_MODE_STORAGE_KEY = "burton-pride-money-suppliers-easy-mode";

const DELETED_SUPPLIERS_PATH =
  "/Admin/MoneyManagement/TrackingMoney/Suppliers/Deleted";

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function formatDate(value?: string | null) {
  if (!value) return "No date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isCustomCategory(category: string, categories: string[]) {
  const cleanCategory = cleanText(category);

  if (!cleanCategory) return false;

  return !categories.some(
    (option) => option.toLowerCase() === cleanCategory.toLowerCase(),
  );
}

function supplierToForm(supplier: Supplier): SupplierForm {
  return {
    supplierName: supplier.supplier_name || "",
    contactName: supplier.contact_name || "",
    email: supplier.email || "",
    phone: supplier.phone || "",
    website: supplier.website || "",
    category: supplier.category || "",
    notes: supplier.notes || "",
    isActive: supplier.is_active !== false,
  };
}

function formToPayload(form: SupplierForm, supplierId?: string | null) {
  return {
    id: supplierId || undefined,
    supplier_name: cleanText(form.supplierName),
    contact_name: cleanText(form.contactName) || null,
    email: cleanText(form.email) || null,
    phone: cleanText(form.phone) || null,
    website: cleanText(form.website) || null,
    category: cleanText(form.category) || null,
    notes: cleanText(form.notes) || null,
    is_active: Boolean(form.isActive),
  };
}

function statusLabel(supplier: Supplier) {
  return supplier.is_active === false ? "Archived" : "Active";
}

function getCategoryList(apiCategories: string[], suppliers: Supplier[]) {
  const set = new Set<string>();

  [...DEFAULT_CATEGORIES, ...apiCategories].forEach((category) => {
    const clean = cleanText(category);
    if (clean) set.add(clean);
  });

  suppliers
    .filter((supplier) => supplier.is_active !== false)
    .forEach((supplier) => {
      const clean = cleanText(supplier.category);
      if (clean) set.add(clean);
    });

  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export default function MoneySuppliersPage() {
  const router = useRouter();

  /**
   * Full Mode stays as the default.
   * Easy Mode is enabled only after the user turns it on.
   */
  const [easyMode, setEasyMode] = useState(false);
  const [modeLoaded, setModeLoaded] = useState(false);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [apiCategories, setApiCategories] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "archived" | "all">(
    "active",
  );
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierForm>(EMPTY_FORM);

  const [deleteSupplier, setDeleteSupplier] = useState<Supplier | null>(null);

  useEffect(() => {
    try {
      const savedMode = window.localStorage.getItem(EASY_MODE_STORAGE_KEY);

      if (savedMode !== null) {
        setEasyMode(savedMode === "true");
      }
    } catch {
      // Keep Full Mode as the safe default if localStorage is unavailable.
    } finally {
      setModeLoaded(true);
    }
  }, []);

  function toggleEasyMode() {
    setEasyMode((previous) => {
      const next = !previous;

      if (next) {
        // Do not leave hidden advanced filters active.
        setStatusFilter("active");
        setCategoryFilter("all");
      }

      try {
        window.localStorage.setItem(EASY_MODE_STORAGE_KEY, String(next));
      } catch {
        // The page should still work if localStorage is unavailable.
      }

      return next;
    });
  }

  const categories = useMemo(
    () => getCategoryList(apiCategories, suppliers),
    [apiCategories, suppliers],
  );

  const filteredSuppliers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return suppliers
      .filter((supplier) => {
        if (statusFilter === "active" && supplier.is_active === false) {
          return false;
        }

        if (statusFilter === "archived" && supplier.is_active !== false) {
          return false;
        }

        if (
          categoryFilter !== "all" &&
          cleanText(supplier.category).toLowerCase() !==
            categoryFilter.toLowerCase()
        ) {
          return false;
        }

        if (!search) return true;

        const haystack = [
          supplier.supplier_name,
          supplier.contact_name,
          supplier.email,
          supplier.phone,
          supplier.website,
          supplier.category,
          supplier.notes,
        ]
          .map((item) => cleanText(item).toLowerCase())
          .join(" ");

        return haystack.includes(search);
      })
      .sort((a, b) => {
        if (a.is_active === false && b.is_active !== false) return 1;
        if (a.is_active !== false && b.is_active === false) return -1;
        return cleanText(a.supplier_name).localeCompare(cleanText(b.supplier_name));
      });
  }, [categoryFilter, searchTerm, statusFilter, suppliers]);

  const activeCount = suppliers.filter((item) => item.is_active !== false).length;
  const archivedCount = suppliers.filter((item) => item.is_active === false).length;

  async function loadSuppliers() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/admin/money/suppliers?includeInactive=true",
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            payload?.details ||
            "Failed to load supplier/contact records.",
        );
      }

      setSuppliers(Array.isArray(payload?.suppliers) ? payload.suppliers : []);
      setApiCategories(
        Array.isArray(payload?.categories) ? payload.categories : [],
      );
    } catch (requestError: any) {
      setError(
        requestError?.message ||
          "Something went wrong while loading suppliers.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSuppliers();
  }, []);

  function openCreateForm() {
    setEditingSupplier(null);
    setForm(EMPTY_FORM);
    setSuccessMessage(null);
    setError(null);
    setFormOpen(true);
  }

  function openEditForm(supplier: Supplier) {
    setEditingSupplier(supplier);
    setForm(supplierToForm(supplier));
    setSuccessMessage(null);
    setError(null);
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;

    setFormOpen(false);
    setEditingSupplier(null);
    setForm(EMPTY_FORM);
  }

  async function saveSupplier() {
    setError(null);
    setSuccessMessage(null);

    if (!form.supplierName.trim()) {
      setError("Supplier / business name is required.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/admin/money/suppliers", {
        method: editingSupplier ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formToPayload(form, editingSupplier?.id)),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            payload?.details ||
            "Failed to save supplier/contact.",
        );
      }

      await loadSuppliers();

      setSuccessMessage(
        editingSupplier
          ? "Supplier/contact updated."
          : "Supplier/contact created.",
      );

      setFormOpen(false);
      setEditingSupplier(null);
      setForm(EMPTY_FORM);
    } catch (requestError: any) {
      setError(
        requestError?.message ||
          "Something went wrong while saving this supplier.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function archiveSupplier() {
    if (!deleteSupplier) return;

    setDeletingId(deleteSupplier.id);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/admin/money/suppliers?id=${encodeURIComponent(deleteSupplier.id)}`,
        {
          method: "DELETE",
        },
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            payload?.details ||
            "Failed to archive supplier/contact.",
        );
      }

      setDeleteSupplier(null);
      setSuccessMessage("Supplier/contact archived.");
      await loadSuppliers();

      router.push(DELETED_SUPPLIERS_PATH);
    } catch (requestError: any) {
      setError(
        requestError?.message ||
          "Something went wrong while archiving this supplier.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="min-h-screen w-full max-w-none overflow-x-auto bg-[#070716] px-1 py-5 text-white sm:px-2 lg:px-3">
      <div className="w-full max-w-none min-w-0 space-y-6">
        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <Link
                href="/Admin/MoneyManagement/TrackingMoney"
                className="mb-4 inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-bold text-white/75 hover:bg-white/20 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to money tracker
              </Link>

              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-100 ring-1 ring-cyan-300/20">
                  <Building2 className="h-6 w-6" />
                </div>

                <div className="min-w-0">
                  <h1 className="break-words text-3xl font-black text-white">
                    Supplier / Contact Tracker
                  </h1>

                  <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
                    {easyMode
                      ? "Add and manage the main supplier details used by your money tracker."
                      : "View, add, edit and archive regular suppliers such as printers, venues, insurance providers, entertainers, food vendors, security, equipment hire and custom contacts. Payments can be linked to these suppliers from the transaction form."}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={loadSuppliers}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/20 disabled:opacity-60"
              >
                <RefreshCcw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>

              {!easyMode && (
                <>
                  <Link
                    href="/Admin/MoneyManagement/TrackingMoney/Suppliers/Logs"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-300/20 bg-sky-500/10 px-4 py-3 text-sm font-black text-sky-100 hover:bg-sky-500/20"
                  >
                    <ClipboardList className="h-4 w-4" />
                    Supplier Logs
                  </Link>

                  <Link
                    href="/Admin/MoneyManagement/TrackingMoney/Suppliers/Deleted"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100 hover:bg-red-500/20"
                  >
                    <Trash2 className="h-4 w-4" />
                    Deleted Suppliers
                  </Link>
                </>
              )}

              <button
                type="button"
                onClick={openCreateForm}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-black text-black hover:bg-cyan-400"
              >
                <Plus className="h-4 w-4" />
                Add Supplier
              </button>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {easyMode ? (
                  <Sparkles className="h-5 w-5 text-cyan-200" />
                ) : (
                  <Settings2 className="h-5 w-5 text-sky-200" />
                )}

                <h2 className="text-lg font-black text-white">
                  {easyMode ? "Easy Mode is on" : "Full Mode is on"}
                </h2>
              </div>

              <p className="mt-2 max-w-4xl text-sm leading-6 text-white/60">
                {easyMode
                  ? "Easy Mode keeps the supplier tracker focused on names, contact details, search, edit, and archive actions."
                  : "Full Mode shows supplier logs, deleted suppliers, filters, websites, notes, archive status, and advanced form options."}
              </p>
            </div>

            <button
              type="button"
              onClick={toggleEasyMode}
              disabled={!modeLoaded}
              className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black ring-1 transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${
                easyMode
                  ? "bg-sky-500/15 text-sky-100 ring-sky-300/20 hover:bg-sky-500/25"
                  : "bg-cyan-500/15 text-cyan-100 ring-cyan-300/20 hover:bg-cyan-500/25"
              }`}
            >
              {easyMode ? (
                <>
                  <Settings2 className="h-4 w-4" />
                  Show Full Mode
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Turn on Easy Mode
                </>
              )}
            </button>
          </div>
        </section>

        <section
          className={`grid gap-4 ${
            easyMode ? "md:grid-cols-1" : "md:grid-cols-3"
          }`}
        >
          <div className="rounded-3xl border border-emerald-300/20 bg-emerald-500/10 p-5">
            <p className="text-xs font-black uppercase tracking-wide text-emerald-100/80">
              Active suppliers
            </p>
            <p className="mt-2 text-3xl font-black text-white">{activeCount}</p>
          </div>

          {!easyMode && (
            <>
              <div className="rounded-3xl border border-sky-300/20 bg-sky-500/10 p-5">
                <p className="text-xs font-black uppercase tracking-wide text-sky-100/80">
                  Categories
                </p>
                <p className="mt-2 text-3xl font-black text-white">
                  {categories.length}
                </p>
              </div>

              <div className="rounded-3xl border border-amber-300/20 bg-amber-500/10 p-5">
                <p className="text-xs font-black uppercase tracking-wide text-amber-100/80">
                  Archived suppliers
                </p>
                <p className="mt-2 text-3xl font-black text-white">
                  {archivedCount}
                </p>
              </div>
            </>
          )}
        </section>

        {error && (
          <div className="rounded-3xl border border-red-300/20 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>{error}</p>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="rounded-3xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-100">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <p>{successMessage}</p>
            </div>
          </div>
        )}

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20">
          <div
            className={`grid gap-3 ${
              easyMode ? "" : "lg:grid-cols-[minmax(0,1fr)_220px_220px]"
            }`}
          >
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search supplier, contact, email, phone, category, notes..."
                className="w-full rounded-2xl bg-black/20 py-3 pl-10 pr-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-cyan-300/40"
              />
            </label>

            {!easyMode && (
              <>
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as "active" | "archived" | "all")
                  }
                  className="rounded-2xl bg-black/20 p-3 font-bold text-white outline-none ring-1 ring-white/10 focus:ring-cyan-300/40"
                >
                  <option className="bg-[#070716] text-white" value="active">
                    Active only
                  </option>
                  <option className="bg-[#070716] text-white" value="archived">
                    Archived only
                  </option>
                  <option className="bg-[#070716] text-white" value="all">
                    All suppliers
                  </option>
                </select>

                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="rounded-2xl bg-black/20 p-3 font-bold text-white outline-none ring-1 ring-white/10 focus:ring-cyan-300/40"
                >
                  <option className="bg-[#070716] text-white" value="all">
                    All categories
                  </option>

                  {categories.map((category) => (
                    <option
                      key={category}
                      className="bg-[#070716] text-white"
                      value={category}
                    >
                      {category}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20">
          {loading ? (
            <div className="flex items-center justify-center gap-3 rounded-2xl bg-black/20 p-8 text-white/70">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading suppliers...
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
              <Building2 className="mx-auto h-10 w-10 text-white/30" />
              <h2 className="mt-4 text-xl font-black text-white">
                No suppliers found
              </h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-white/55">
                Add your first supplier/contact, or change the search and filter
                options.
              </p>
              <button
                type="button"
                onClick={openCreateForm}
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-black text-black hover:bg-cyan-400"
              >
                <Plus className="h-4 w-4" />
                Add Supplier
              </button>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
              {filteredSuppliers.map((supplier) => (
                <article
                  key={supplier.id}
                  className={`rounded-3xl border p-4 ${
                    supplier.is_active === false
                      ? "border-white/10 bg-black/20 opacity-75"
                      : "border-cyan-300/15 bg-black/25"
                  }`}
                >
                  <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="break-words text-xl font-black text-white">
                          {supplier.supplier_name}
                        </h2>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${
                            supplier.is_active === false
                              ? "bg-white/10 text-white/55 ring-white/10"
                              : "bg-emerald-500/10 text-emerald-100 ring-emerald-300/20"
                          }`}
                        >
                          {statusLabel(supplier)}
                        </span>

                        {supplier.category && (
                          <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-black text-cyan-100 ring-1 ring-cyan-300/20">
                            {supplier.category}
                          </span>
                        )}
                      </div>

                      {!easyMode && (
                        <p className="mt-1 text-xs text-white/40">
                          Added {formatDate(supplier.created_at)}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => openEditForm(supplier)}
                        className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white hover:bg-white/20"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </button>

                      {supplier.is_active !== false && (
                        <button
                          type="button"
                          onClick={() => setDeleteSupplier(supplier)}
                          className="inline-flex items-center gap-2 rounded-xl bg-red-500/15 px-3 py-2 text-xs font-black text-red-100 ring-1 ring-red-300/20 hover:bg-red-500/25"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Archive
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    {supplier.contact_name && (
                      <div className="rounded-2xl bg-white/[0.04] p-3">
                        <p className="text-xs font-black uppercase tracking-wide text-white/35">
                          Contact
                        </p>
                        <p className="mt-1 break-words text-white/80">
                          {supplier.contact_name}
                        </p>
                      </div>
                    )}

                    {supplier.email && (
                      <a
                        href={`mailto:${supplier.email}`}
                        className="rounded-2xl bg-white/[0.04] p-3 hover:bg-white/[0.08]"
                      >
                        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-white/35">
                          <Mail className="h-3.5 w-3.5" />
                          Email
                        </p>
                        <p className="mt-1 break-all text-cyan-100">
                          {supplier.email}
                        </p>
                      </a>
                    )}

                    {supplier.phone && (
                      <a
                        href={`tel:${supplier.phone}`}
                        className="rounded-2xl bg-white/[0.04] p-3 hover:bg-white/[0.08]"
                      >
                        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-white/35">
                          <Phone className="h-3.5 w-3.5" />
                          Phone
                        </p>
                        <p className="mt-1 break-words text-cyan-100">
                          {supplier.phone}
                        </p>
                      </a>
                    )}

                    {!easyMode && supplier.website && (
                      <a
                        href={supplier.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-2xl bg-white/[0.04] p-3 hover:bg-white/[0.08]"
                      >
                        <p className="text-xs font-black uppercase tracking-wide text-white/35">
                          Website
                        </p>
                        <p className="mt-1 break-all text-cyan-100">
                          {supplier.website}
                        </p>
                      </a>
                    )}
                  </div>

                  {!easyMode && supplier.notes && (
                    <div className="mt-3 rounded-2xl bg-black/20 p-3 text-sm leading-6 text-white/60">
                      {supplier.notes}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-cyan-300/20 bg-[#070716] p-5 text-white shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">
                  {editingSupplier ? "Edit Supplier / Contact" : "Add Supplier / Contact"}
                </h2>
                <p className="mt-1 text-sm leading-6 text-white/60">
                  Save supplier details here, then link payments to them from
                  the transaction form.
                </p>

                {easyMode && (
                  <p className="mt-2 rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-3 py-2 text-xs leading-5 text-cyan-100">
                    Easy Mode hides the website, notes, and active-status
                    controls. Switch back to Full Mode to edit those details.
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-xl bg-white/10 p-2 hover:bg-white/20 disabled:opacity-60"
                aria-label="Close supplier form"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <input
                value={form.supplierName}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    supplierName: event.target.value,
                  }))
                }
                placeholder="Supplier / business name"
                className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-cyan-300/20 placeholder:text-white/35 focus:ring-cyan-300/40"
              />

              <input
                value={form.contactName}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    contactName: event.target.value,
                  }))
                }
                placeholder="Contact name"
                className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-cyan-300/40"
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={form.email}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  placeholder="Email"
                  type="email"
                  className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-cyan-300/40"
                />

                <input
                  value={form.phone}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, phone: event.target.value }))
                  }
                  placeholder="Phone"
                  className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-cyan-300/40"
                />
              </div>

              {!easyMode && (
                <input
                  value={form.website}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, website: event.target.value }))
                  }
                  placeholder="Website"
                  className="w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-cyan-300/40"
                />
              )}

              <div>
                <label className="mb-2 block text-sm font-bold text-white/80">
                  Supplier category
                </label>

                <select
                  value={isCustomCategory(form.category, categories) ? "__custom__" : form.category}
                  onChange={(event) => {
                    const value = event.target.value;
                    setForm((prev) => ({
                      ...prev,
                      category: value === "__custom__" ? "" : value,
                    }));
                  }}
                  className="w-full rounded-xl bg-black/20 p-3 font-bold text-white outline-none ring-1 ring-cyan-300/20 focus:ring-cyan-300/40"
                >
                  <option className="bg-[#070716] text-white" value="">
                    Choose category...
                  </option>

                  {categories.map((category) => (
                    <option
                      key={category}
                      className="bg-[#070716] text-white"
                      value={category}
                    >
                      {category}
                    </option>
                  ))}

                  <option className="bg-[#070716] text-white" value="__custom__">
                    Custom category...
                  </option>
                </select>

                {(isCustomCategory(form.category, categories) ||
                  !form.category) && (
                  <div className="mt-3">
                    <label className="mb-2 block text-xs font-bold text-cyan-100/80">
                      Custom category
                    </label>

                    <input
                      value={
                        isCustomCategory(form.category, categories)
                          ? form.category
                          : ""
                      }
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          category: event.target.value,
                        }))
                      }
                      placeholder="Type your own category, e.g. Signage, First Aid, Toilets"
                      className="w-full rounded-xl bg-black/20 p-3 text-white outline-none ring-1 ring-cyan-300/20 placeholder:text-white/35 focus:ring-cyan-300/40"
                    />
                  </div>
                )}
              </div>

              {!easyMode && (
                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                  placeholder="Notes, quote details, payment terms, contact history..."
                  className="min-h-28 w-full rounded-xl bg-black/20 p-3 outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-cyan-300/40"
                />
              )}

              {!easyMode && (
                <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) =>
                      setForm((prev) => ({
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
                      Turn this off if you want to archive it but keep old records.
                    </span>
                  </span>
                </label>
              )}

              <div className="flex flex-col justify-end gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/20 disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={saveSupplier}
                  disabled={saving || !form.supplierName.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-black text-black hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving
                    ? editingSupplier
                      ? "Updating..."
                      : "Saving..."
                    : editingSupplier
                      ? "Update Supplier"
                      : "Save Supplier"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteSupplier && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-red-300/20 bg-[#070716] p-6 text-white shadow-2xl">
            <h2 className="text-xl font-black">Archive supplier?</h2>

            <p className="mt-3 text-sm leading-6 text-white/70">
              This will archive{" "}
              <strong className="text-white">
                {deleteSupplier.supplier_name}
              </strong>
              . Existing linked transactions will stay safe.
            </p>

            <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
              This does not permanently delete old payment history. It only sets
              the supplier as inactive. After archiving, you will be taken to
              the deleted suppliers page.
            </div>

            <div className="mt-6 flex flex-col justify-end gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setDeleteSupplier(null)}
                disabled={Boolean(deletingId)}
                className="rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/20 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={archiveSupplier}
                disabled={Boolean(deletingId)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm font-black text-white hover:bg-red-400 disabled:opacity-60"
              >
                {deletingId && <Loader2 className="h-4 w-4 animate-spin" />}
                {deletingId ? "Archiving..." : "Archive Supplier & View Deleted"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
