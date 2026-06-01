"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bug,
  FileText,
  RefreshCcw,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";

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

  supplier_id?: string | null;
  supplier_name?: string | null;
  supplier_category?: string | null;

  source: string | null;
  stripe_session_id: string | null;
  stripe_invoice_id: string | null;
  stripe_customer_id: string | null;
  stripe_payment_intent_id: string | null;

  deleted_at: string | null;
  deleted_by?: string | null;
};

function money(amountPence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format((amountPence || 0) / 100);
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

function displayAdminName(value: string | null | undefined) {
  if (!value) return "Unknown";

  const clean = value.trim();

  if (!clean) return "Unknown";

  const knownNames: Record<string, string> = {
    "cameronlowndes@burtonpride.co.uk": "cameron lowndes",
    "cameron.lowndes@burtonpride.co.uk": "cameron lowndes",
    "cameron-lowndes@burtonpride.co.uk": "cameron lowndes",
    "cameron_lowndes@burtonpride.co.uk": "cameron lowndes",
    cameronlowndes: "cameron lowndes",
    "cameron.lowndes": "cameron lowndes",
    "cameron-lowndes": "cameron lowndes",
    cameron_lowndes: "cameron lowndes",
  };

  const lowerClean = clean.toLowerCase();

  if (knownNames[lowerClean]) {
    return knownNames[lowerClean];
  }

  const beforeEmail = lowerClean.includes("@")
    ? lowerClean.split("@")[0]
    : lowerClean;

  return beforeEmail
    .replace(/[._-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
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

export default function HiddenTransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const [error, setError] = useState("");
  const [errorDetails, setErrorDetails] = useState<any>(null);

  async function loadHiddenTransactions() {
    try {
      setLoading(true);
      setError("");
      setErrorDetails(null);

      const res = await fetch(
        `/api/admin/money/transactions/hidden?t=${Date.now()}`,
        {
          cache: "no-store",
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
          message: data.error || "Failed to load hidden transactions.",
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

  useEffect(() => {
    loadHiddenTransactions();
  }, []);

  const filteredTransactions = useMemo(() => {
    let rows = transactions;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();

      rows = rows.filter((item) => {
        return (
          item.title?.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.payment_method?.toLowerCase().includes(q) ||
          item.sponsor_name?.toLowerCase().includes(q) ||
          item.sponsorship_note?.toLowerCase().includes(q) ||
          item.supplier_name?.toLowerCase().includes(q) ||
          item.supplier_category?.toLowerCase().includes(q) ||
          item.personal_funds_name?.toLowerCase().includes(q) ||
          displayAdminName(item.deleted_by).toLowerCase().includes(q) ||
          sourceLabel(item.source).toLowerCase().includes(q)
        );
      });
    }

    return rows;
  }, [transactions, searchTerm]);

  const totals = useMemo(() => {
    const income = filteredTransactions
      .filter((item) => item.type === "income")
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    const expense = filteredTransactions
      .filter((item) => item.type === "expense")
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    return {
      income,
      expense,
      count: filteredTransactions.length,
    };
  }, [filteredTransactions]);

  async function restoreTransaction(id: string) {
    try {
      setRestoringId(id);
      setError("");
      setErrorDetails(null);

      const res = await fetch(`/api/admin/money/transactions/${id}/restore`, {
        method: "PATCH",
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
          message: data.error || "Failed to restore transaction.",
          details: data,
          status: res.status,
        };
      }

      setTransactions((prev) => prev.filter((item) => item.id !== id));
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
      setErrorDetails(err);
    } finally {
      setRestoringId(null);
    }
  }

  async function permanentlyDeleteTransaction() {
    if (!deleteId) return;

    try {
      setDeleting(true);
      setError("");
      setErrorDetails(null);

      const cleanConfirmText = deleteConfirmText.trim();

      if (cleanConfirmText !== "DELETE") {
        setError("Please type DELETE in capital letters to confirm.");
        setDeleting(false);
        return;
      }

      const res = await fetch(
        `/api/admin/money/transactions/${deleteId}/permanent`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            confirmText: cleanConfirmText,
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
          message: data.error || "Failed to permanently delete transaction.",
          details: data,
          status: res.status,
        };
      }

      setTransactions((prev) => prev.filter((item) => item.id !== deleteId));
      setDeleteId(null);
      setDeleteConfirmText("");
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
      setErrorDetails(err);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="min-h-screen w-full max-w-none overflow-x-auto bg-[#070716] px-1 py-5 text-white sm:px-2 lg:px-3">
      <div className="w-full max-w-none min-w-0 space-y-6">
        <section className="w-full max-w-none rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <Link
                href="/Admin/Money"
                className="mb-4 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Money Tracker
              </Link>

              <h1 className="text-3xl font-bold">Hidden Transactions</h1>
              <p className="mt-1 text-sm text-white/60">
                These are soft-deleted payments. They are hidden from the money
                tracker, totals, Excel exports, and print reports.
              </p>
            </div>

            <button
              type="button"
              onClick={loadHiddenTransactions}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-bold hover:bg-white/20"
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

        <section className="grid w-full max-w-none gap-4 md:grid-cols-3">
          <div className="rounded-3xl bg-purple-500/10 p-5">
            <p className="text-sm text-purple-200">Hidden Items</p>
            <p className="text-3xl font-bold">{totals.count}</p>
          </div>

          <div className="rounded-3xl bg-emerald-500/10 p-5">
            <p className="text-sm text-emerald-200">Hidden Money In</p>
            <p className="text-3xl font-bold">{money(totals.income)}</p>
          </div>

          <div className="rounded-3xl bg-red-500/10 p-5">
            <p className="text-sm text-red-200">Hidden Money Out</p>
            <p className="text-3xl font-bold">{money(totals.expense)}</p>
          </div>
        </section>

        <section className="w-full max-w-none rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-4 flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold">Hidden Payments</h2>
              <p className="text-sm text-white/50">
                Restore a payment to bring it back into the main tracker. The
                Hidden By column shows which admin hid it.
              </p>
            </div>

            <div className="relative w-full lg:w-[520px] lg:shrink-0">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search hidden transactions..."
                className="w-full rounded-xl bg-black/30 py-3 pl-11 pr-4 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/40 focus:ring-pink-300/40"
              />
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl bg-black/20 p-5 text-sm text-white/60">
              Loading hidden transactions...
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="rounded-2xl bg-black/20 p-5 text-sm text-white/60">
              No hidden transactions found.
            </div>
          ) : (
            <div className="w-full max-w-none overflow-x-auto overflow-y-hidden rounded-2xl border border-white/10">
              <table className="w-full min-w-[1650px] text-sm">
                <thead className="bg-white/10 text-white/60">
                  <tr>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Hidden On</th>
                    <th className="p-3 text-left">Hidden By</th>
                    <th className="p-3 text-left">Title</th>
                    <th className="p-3 text-left">Type</th>
                    <th className="p-3 text-left">Source</th>
                    <th className="p-3 text-left">Sponsor</th>
                    <th className="p-3 text-left">Supplier</th>
                    <th className="p-3 text-left">Personal</th>
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
                          {formatDate(item.transaction_date || item.created_at)}
                        </td>

                        <td className="whitespace-nowrap p-3 text-red-200">
                          {formatDate(item.deleted_at)}
                        </td>

                        <td className="max-w-[190px] p-3">
                          <div className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-100 ring-1 ring-red-300/20">
                            <p className="font-bold">Hidden by</p>
                            <p className="mt-1 break-words">
                              {displayAdminName(item.deleted_by)}
                            </p>
                          </div>
                        </td>

                        <td className="max-w-[240px] p-3">
                          <p className="break-words font-semibold">
                            {item.title}
                          </p>

                          {item.description && (
                            <p className="mt-1 line-clamp-3 break-words text-xs text-white/50">
                              {item.description}
                            </p>
                          )}

                          {item.sponsorship_note && (
                            <p className="mt-2 line-clamp-3 break-words rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                              {item.sponsorship_note}
                            </p>
                          )}
                        </td>

                        <td className="whitespace-nowrap p-3">
                          <span
                            className={`inline-flex rounded-2xl px-3 py-1 text-xs font-bold ring-1 ${
                              item.type === "income"
                                ? "bg-emerald-500/15 text-emerald-200 ring-emerald-300/20"
                                : "bg-red-500/15 text-red-200 ring-red-300/20"
                            }`}
                          >
                            {item.type === "income" ? "Money In" : "Money Out"}
                          </span>
                        </td>

                        <td className="whitespace-nowrap p-3">
                          {sourceLabel(item.source)}
                        </td>

                        <td className="max-w-[180px] p-3">
                          {hasSponsor ? (
                            <span className="inline-flex rounded-2xl bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-100 ring-1 ring-amber-300/20">
                              {item.sponsor_name || "Sponsor"}
                            </span>
                          ) : (
                            <span className="text-white/40">—</span>
                          )}
                        </td>

                        <td className="max-w-[200px] p-3">
                          {item.supplier_name ? (
                            <div className="space-y-1">
                              <span className="inline-flex rounded-2xl bg-cyan-500/15 px-3 py-1 text-xs font-bold text-cyan-100 ring-1 ring-cyan-300/20">
                                {item.supplier_name}
                              </span>

                              {item.supplier_category && (
                                <p className="text-xs text-cyan-100/65">
                                  {item.supplier_category}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-white/40">—</span>
                          )}
                        </td>

                        <td className="p-3">
                          {isPersonal ? (
                            <div className="space-y-1">
                              <span className="inline-flex whitespace-nowrap rounded-2xl bg-sky-500/20 px-3 py-1 text-xs font-bold text-sky-100 ring-1 ring-sky-300/20">
                                Personal funds
                              </span>

                              {item.personal_funds_name && (
                                <p className="text-xs text-sky-100/70">
                                  {item.personal_funds_name}
                                </p>
                              )}
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
                          {money(item.amount_pence)}
                        </td>

                        <td className="sticky right-0 bg-[#11111f] p-3 text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={restoringId === item.id}
                              onClick={() => restoreTransaction(item.id)}
                              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-200 ring-1 ring-emerald-300/20 hover:bg-emerald-500/25 disabled:opacity-50"
                              title="Restore transaction"
                            >
                              <RotateCcw className="h-4 w-4" />
                              {restoringId === item.id
                                ? "Restoring..."
                                : "Restore"}
                            </button>

                            <button
                              type="button"
                              disabled={deleting}
                              onClick={() => {
                                setDeleteId(item.id);
                                setDeleteConfirmText("");
                              }}
                              className="inline-flex items-center gap-2 rounded-xl bg-red-500/15 px-3 py-2 text-xs font-bold text-red-200 ring-1 ring-red-300/20 hover:bg-red-500/25 disabled:opacity-50"
                              title="Permanently delete transaction"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete Forever
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
        </section>
      </div>

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-1 py-4 backdrop-blur-sm sm:px-2">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#070716] p-6 text-white shadow-2xl">
            <h2 className="text-xl font-bold">Permanently delete payment?</h2>

            <p className="mt-3 text-sm text-white/70">
              This will permanently remove the hidden transaction from Supabase.
              This cannot be undone.
            </p>

            <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
              Only do this if you are sure you no longer need this record.
            </div>

            <label className="mt-5 block text-sm font-bold text-white/80">
              Type DELETE to confirm
            </label>

            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE"
              autoComplete="off"
              name="money-hidden-delete-confirm"
              className="mt-2 w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/40 focus:ring-red-300/40"
            />

            <p className="mt-2 text-xs text-white/45">
              This must be typed exactly as{" "}
              <span className="font-bold text-red-200">DELETE</span>.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeleteId(null);
                  setDeleteConfirmText("");
                }}
                disabled={deleting}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={permanentlyDeleteTransaction}
                disabled={deleting || deleteConfirmText.trim() !== "DELETE"}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete Forever"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}