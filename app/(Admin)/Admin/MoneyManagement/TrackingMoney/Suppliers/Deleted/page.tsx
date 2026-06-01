"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Loader2,
  RefreshCcw,
  RotateCcw,
  Search,
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

export default function DeletedSuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [permanentDeleteSupplier, setPermanentDeleteSupplier] =
    useState<Supplier | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [permanentDeleting, setPermanentDeleting] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const filteredSuppliers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    if (!search) return suppliers;

    return suppliers.filter((supplier) => {
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
    });
  }, [searchTerm, suppliers]);

  const categoryCount = useMemo(() => {
    const categories = new Set<string>();

    suppliers.forEach((supplier) => {
      const category = cleanText(supplier.category);
      if (category) categories.add(category);
    });

    return categories.size;
  }, [suppliers]);

  async function loadDeletedSuppliers() {
    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/admin/money/suppliers/deleted", {
        method: "GET",
        cache: "no-store",
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.ok === false) {
        throw new Error(
          payload?.error ||
            payload?.details ||
            "Failed to load archived suppliers.",
        );
      }

      setSuppliers(Array.isArray(payload?.suppliers) ? payload.suppliers : []);
    } catch (requestError: any) {
      setError(
        requestError?.message ||
          "Something went wrong while loading archived suppliers.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDeletedSuppliers();
  }, []);

  async function restoreSupplier(supplier: Supplier) {
    setRestoringId(supplier.id);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/admin/money/suppliers/deleted", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: supplier.id,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.ok === false) {
        throw new Error(
          payload?.error ||
            payload?.details ||
            "Failed to restore supplier.",
        );
      }

      setSuppliers((prev) => prev.filter((item) => item.id !== supplier.id));
      setSuccessMessage(`${supplier.supplier_name} has been restored.`);
    } catch (requestError: any) {
      setError(
        requestError?.message ||
          "Something went wrong while restoring this supplier.",
      );
    } finally {
      setRestoringId(null);
    }
  }

  async function permanentlyDeleteSupplier() {
    if (!permanentDeleteSupplier) return;

    const confirmText = deleteConfirmText.trim();

    if (confirmText !== "DELETE") {
      setError("Please type DELETE in capital letters to confirm.");
      return;
    }

    setPermanentDeleting(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/admin/money/suppliers/deleted", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: permanentDeleteSupplier.id,
          confirmText,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.ok === false) {
        throw new Error(
          payload?.error ||
            payload?.details ||
            "Failed to permanently delete supplier.",
        );
      }

      setSuppliers((prev) =>
        prev.filter((item) => item.id !== permanentDeleteSupplier.id),
      );
      setSuccessMessage(
        `${permanentDeleteSupplier.supplier_name} has been permanently deleted.`,
      );
      setPermanentDeleteSupplier(null);
      setDeleteConfirmText("");
    } catch (requestError: any) {
      setError(
        requestError?.message ||
          "Something went wrong while permanently deleting this supplier.",
      );
    } finally {
      setPermanentDeleting(false);
    }
  }

  return (
    <main className="min-h-screen w-full max-w-none overflow-x-auto bg-[#070716] px-1 py-5 text-white sm:px-2 lg:px-3">
      <div className="w-full max-w-none min-w-0 space-y-6">
        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <Link
                href="/Admin/MoneyManagement/TrackingMoney/Suppliers"
                className="mb-4 inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-bold text-white/75 hover:bg-white/20 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to suppliers
              </Link>

              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-500/15 text-red-100 ring-1 ring-red-300/20">
                  <Trash2 className="h-6 w-6" />
                </div>

                <div className="min-w-0">
                  <h1 className="break-words text-3xl font-black text-white">
                    Deleted / Archived Suppliers
                  </h1>

                  <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
                    View suppliers that have been archived from the supplier
                    tracker. You can restore them back to active suppliers, or
                    permanently delete them if you are sure they are no longer
                    needed.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={loadDeletedSuppliers}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/20 disabled:opacity-60"
            >
              <RefreshCcw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-red-300/20 bg-red-500/10 p-5">
            <p className="text-xs font-black uppercase tracking-wide text-red-100/80">
              Archived suppliers
            </p>
            <p className="mt-2 text-3xl font-black text-white">
              {suppliers.length}
            </p>
          </div>

          <div className="rounded-3xl border border-cyan-300/20 bg-cyan-500/10 p-5">
            <p className="text-xs font-black uppercase tracking-wide text-cyan-100/80">
              Categories
            </p>
            <p className="mt-2 text-3xl font-black text-white">
              {categoryCount}
            </p>
          </div>

          <div className="rounded-3xl border border-amber-300/20 bg-amber-500/10 p-5">
            <p className="text-xs font-black uppercase tracking-wide text-amber-100/80">
              Showing now
            </p>
            <p className="mt-2 text-3xl font-black text-white">
              {filteredSuppliers.length}
            </p>
          </div>
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
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search archived suppliers..."
              className="w-full rounded-2xl bg-black/20 py-3 pl-10 pr-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-red-300/40"
            />
          </label>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20">
          {loading ? (
            <div className="flex items-center justify-center gap-3 rounded-2xl bg-black/20 p-8 text-white/70">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading archived suppliers...
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
              <Building2 className="mx-auto h-10 w-10 text-white/30" />
              <h2 className="mt-4 text-xl font-black text-white">
                No archived suppliers found
              </h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-white/55">
                Archived suppliers will appear here after you archive them from
                the supplier tracker.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
              {filteredSuppliers.map((supplier) => (
                <article
                  key={supplier.id}
                  className="rounded-3xl border border-red-300/15 bg-black/25 p-4"
                >
                  <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="break-words text-xl font-black text-white">
                          {supplier.supplier_name}
                        </h2>

                        <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-black text-red-100 ring-1 ring-red-300/20">
                          Archived
                        </span>

                        {supplier.category && (
                          <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-black text-cyan-100 ring-1 ring-cyan-300/20">
                            {supplier.category}
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-xs text-white/40">
                        Added {formatDate(supplier.created_at)}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => restoreSupplier(supplier)}
                        disabled={restoringId === supplier.id}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-black text-emerald-100 ring-1 ring-emerald-300/20 hover:bg-emerald-500/25 disabled:opacity-60"
                      >
                        {restoringId === supplier.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5" />
                        )}
                        {restoringId === supplier.id ? "Restoring..." : "Restore"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPermanentDeleteSupplier(supplier);
                          setDeleteConfirmText("");
                          setError("");
                        }}
                        className="inline-flex items-center gap-2 rounded-xl bg-red-500/15 px-3 py-2 text-xs font-black text-red-100 ring-1 ring-red-300/20 hover:bg-red-500/25"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete Forever
                      </button>
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
                      <div className="rounded-2xl bg-white/[0.04] p-3">
                        <p className="text-xs font-black uppercase tracking-wide text-white/35">
                          Email
                        </p>
                        <p className="mt-1 break-all text-cyan-100">
                          {supplier.email}
                        </p>
                      </div>
                    )}

                    {supplier.phone && (
                      <div className="rounded-2xl bg-white/[0.04] p-3">
                        <p className="text-xs font-black uppercase tracking-wide text-white/35">
                          Phone
                        </p>
                        <p className="mt-1 break-words text-cyan-100">
                          {supplier.phone}
                        </p>
                      </div>
                    )}

                    {supplier.website && (
                      <div className="rounded-2xl bg-white/[0.04] p-3">
                        <p className="text-xs font-black uppercase tracking-wide text-white/35">
                          Website
                        </p>
                        <p className="mt-1 break-all text-cyan-100">
                          {supplier.website}
                        </p>
                      </div>
                    )}
                  </div>

                  {supplier.notes && (
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

      {permanentDeleteSupplier && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-red-300/20 bg-[#070716] p-6 text-white shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">
                  Permanently delete supplier?
                </h2>

                <p className="mt-2 text-sm leading-6 text-white/70">
                  This will permanently delete{" "}
                  <strong className="text-white">
                    {permanentDeleteSupplier.supplier_name}
                  </strong>
                  . This cannot be undone.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setPermanentDeleteSupplier(null);
                  setDeleteConfirmText("");
                }}
                disabled={permanentDeleting}
                className="rounded-xl bg-white/10 p-2 hover:bg-white/20 disabled:opacity-60"
                aria-label="Close permanent delete modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
              Only do this for test suppliers or records you are sure you no
              longer need. Old transactions may still keep the supplier name as
              text for reporting.
            </div>

            <label className="mt-5 block text-sm font-bold text-white/80">
              Type DELETE to confirm
            </label>

            <input
              value={deleteConfirmText}
              onChange={(event) => setDeleteConfirmText(event.target.value)}
              placeholder="Type DELETE"
              className="mt-2 w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/40 focus:ring-red-300/40"
            />

            <div className="mt-6 flex flex-col justify-end gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setPermanentDeleteSupplier(null);
                  setDeleteConfirmText("");
                }}
                disabled={permanentDeleting}
                className="rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/20 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={permanentlyDeleteSupplier}
                disabled={permanentDeleting || deleteConfirmText.trim() !== "DELETE"}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm font-black text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {permanentDeleting && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {permanentDeleting ? "Deleting..." : "Delete Forever"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
