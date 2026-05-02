"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, Bug, FileText, RefreshCcw, Trash2 } from "lucide-react";

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
};

type FormState = {
  title: string;
  description: string;
  type: "income" | "expense";
  category: string;
  amount: string;
  paymentMethod: string;
  transactionDate: string;
};

const initialForm: FormState = {
  title: "",
  description: "",
  type: "income",
  category: "",
  amount: "",
  paymentMethod: "Stripe",
  transactionDate: new Date().toISOString().slice(0, 10),
};

function money(amountPence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format((amountPence || 0) / 100);
}

export default function MoneyTransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);

  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState("");
  const [errorDetails, setErrorDetails] = useState<any>(null);

  async function loadTransactions() {
    try {
      setLoading(true);
      setError("");
      setErrorDetails(null);

      const res = await fetch("/api/admin/money/transactions", {
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

  useEffect(() => {
    loadTransactions();
  }, []);

  const filteredTransactions = useMemo(() => {
    if (filter === "all") return transactions;
    return transactions.filter((item) => item.type === filter);
  }, [transactions, filter]);

  const totals = useMemo(() => {
    const income = transactions
      .filter((item) => item.type === "income")
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    const expense = transactions
      .filter((item) => item.type === "expense")
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);

    return {
      income,
      expense,
      balance: income - expense,
    };
  }, [transactions]);

  function fillTestTransaction() {
    setForm({
      title: "Test donation",
      description: "This is a test transaction",
      type: "income",
      category: "Donation",
      amount: "25.00",
      paymentMethod: "Stripe",
      transactionDate: new Date().toISOString().slice(0, 10),
    });

    setInvoiceFile(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");
      setErrorDetails(null);

      const uploadData = new FormData();

      uploadData.append("title", form.title);
      uploadData.append("description", form.description);
      uploadData.append("type", form.type);
      uploadData.append("category", form.category);
      uploadData.append("amount", form.amount);
      uploadData.append("paymentMethod", form.paymentMethod);
      uploadData.append("transactionDate", form.transactionDate);

      if (invoiceFile) {
        uploadData.append("invoiceFile", invoiceFile);
      }

      const res = await fetch("/api/admin/money/transactions", {
        method: "POST",
        body: uploadData,
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
          message: data.error || "Failed to save transaction",
          details: data,
          status: res.status,
          sentForm: form,
        };
      }

      setForm(initialForm);
      setInvoiceFile(null);
      await loadTransactions();
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

      setDeleteId(null);
      await loadTransactions();
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
      setErrorDetails(err);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#070716] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Money Tracker</h1>
              <p className="text-sm text-white/60">
                Track all money coming in and going out
              </p>
            </div>

            <button
              onClick={loadTransactions}
              className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
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

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl bg-emerald-500/10 p-5">
            <p className="text-sm text-emerald-200">Money In</p>
            <p className="text-3xl font-bold">{money(totals.income)}</p>
          </div>

          <div className="rounded-3xl bg-red-500/10 p-5">
            <p className="text-sm text-red-200">Money Out</p>
            <p className="text-3xl font-bold">{money(totals.expense)}</p>
          </div>

          <div className="rounded-3xl bg-sky-500/10 p-5">
            <p className="text-sm text-sky-200">Balance</p>
            <p className="text-3xl font-bold">{money(totals.balance)}</p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[400px_1fr]">
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold">Add Transaction</h2>

              <button
                type="button"
                onClick={fillTestTransaction}
                className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/20"
              >
                Test
              </button>
            </div>

            <div className="space-y-4">
              <input
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Title"
                className="w-full rounded-xl bg-black/20 p-3"
              />

              <select
                value={form.type}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    type: e.target.value as "income" | "expense",
                  }))
                }
                className="w-full rounded-xl bg-black/20 p-3"
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
                className="w-full rounded-xl bg-black/20 p-3"
              />

              <input
                value={form.category}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, category: e.target.value }))
                }
                placeholder="Category"
                className="w-full rounded-xl bg-black/20 p-3"
              />

              <select
                value={form.paymentMethod}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    paymentMethod: e.target.value,
                  }))
                }
                className="w-full rounded-xl bg-black/20 p-3"
              >
                <option value="Stripe">Stripe</option>
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="PayPal">PayPal</option>
                <option value="Card Machine">Card Machine</option>
              </select>

              <input
                type="date"
                value={form.transactionDate}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    transactionDate: e.target.value,
                  }))
                }
                className="w-full rounded-xl bg-black/20 p-3"
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
                className="w-full rounded-xl bg-black/20 p-3"
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
                  <p className="mt-2 text-xs text-white/50">
                    Selected: {invoiceFile.name}
                  </p>
                )}
              </div>

              <button
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-pink-500 p-3 font-bold disabled:opacity-60"
              >
                <Banknote className="h-4 w-4" />
                {saving ? "Saving..." : "Save Transaction"}
              </button>
            </div>
          </form>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <h2 className="mb-4 text-xl font-bold">Transactions</h2>

            <div className="mb-4 flex gap-2">
              {(["all", "income", "expense"] as const).map((item) => (
                <button
                  key={item}
                  onClick={() => setFilter(item)}
                  className={`rounded-xl px-4 py-2 text-sm font-bold ${
                    filter === item
                      ? "bg-white text-black"
                      : "bg-white/10 text-white"
                  }`}
                >
                  {item === "all"
                    ? "All"
                    : item === "income"
                    ? "Money In"
                    : "Money Out"}
                </button>
              ))}
            </div>

            {loading ? (
              <p>Loading...</p>
            ) : filteredTransactions.length === 0 ? (
              <p className="text-white/60">No transactions yet</p>
            ) : (
              <div className="overflow-x-auto overflow-y-hidden rounded-2xl border border-white/10">
                <table className="w-full min-w-[850px] text-sm">
                  <thead className="bg-white/10 text-white/60">
                    <tr>
                      <th className="p-3 text-left">Date</th>
                      <th className="p-3 text-left">Title</th>
                      <th className="p-3 text-left">Type</th>
                      <th className="p-3 text-left">Payment</th>
                      <th className="p-3 text-left">Invoice</th>
                      <th className="p-3 text-right">Amount</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredTransactions.map((item) => (
                      <tr key={item.id} className="border-t border-white/10">
                        <td className="p-3">{item.transaction_date}</td>
                        <td className="p-3">
                          <p className="font-semibold">{item.title}</p>
                          {item.description && (
                            <p className="text-xs text-white/50">
                              {item.description}
                            </p>
                          )}
                        </td>
                        <td className="p-3">
                          {item.type === "income" ? "Money In" : "Money Out"}
                        </td>
                        <td className="p-3">{item.payment_method || "—"}</td>
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
                        <td className="p-3 text-right font-bold">
                          {money(item.amount_pence)}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            disabled={deleting}
                            onClick={() => setDeleteId(item.id)}
                            className="inline-flex items-center justify-center rounded-xl bg-red-500/15 p-2 text-red-200 hover:bg-red-500/25 disabled:opacity-50"
                            title="Delete transaction"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>

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
    </main>
  );
}