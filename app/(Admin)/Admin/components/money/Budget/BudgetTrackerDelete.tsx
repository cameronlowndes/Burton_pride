"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  RefreshCcw,
  RotateCcw,
  Target,
  Trash2,
  WalletCards,
} from "lucide-react";

type DeletedSavingTarget = {
  id: string;
  year?: string | null;
  target_name?: string | null;
  target_amount_pence?: number | null;
  saved_amount_pence?: number | null;
  months_to_save?: number | null;
  notes?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deleted_by_email?: string | null;
};

type DeletedBudgetItem = {
  id: string;
  year?: string | null;
  category_key?: string | null;
  category_label?: string | null;
  planned_amount_pence?: number | null;
  notes?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deleted_by_email?: string | null;
};

type DeletedItemsPayload = {
  year?: string | null;
  savingTargets: DeletedSavingTarget[];
  budgetItems: DeletedBudgetItem[];
  budgetTable?: string | null;
  budgetWarning?: string | null;
};

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format((Number(value) || 0) / 100);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "No date recorded";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function parseResponse(response: Response) {
  const text = await response.text().catch(() => "");
  let payload: any = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const mainError =
      payload?.error ||
      payload?.message ||
      "Deleted items request failed.";

    const details =
      payload?.details ||
      payload?.hint ||
      payload?.code ||
      text ||
      "No extra server details were returned.";

    const apiRoute = response.url || "/api/admin/money/deleted-items";

    const lines = [
      `Deleted area error (${response.status} ${response.statusText || "Request failed"})`,
      "",
      `Main error: ${mainError}`,
      `Details: ${details}`,
      `API route: ${apiRoute}`,
    ];

    if (response.status === 400) {
      lines.push(
        "",
        "What to check:",
        "• Make sure the request includes the item ID.",
        "• Make sure type is either saving_target or budget_item.",
        "• Check the browser Network tab to see the request body.",
      );
    }

    if (response.status === 401 || response.status === 403) {
      lines.push(
        "",
        "What to check:",
        "• Make sure you are signed in as an admin.",
        "• Check Clerk/admin permissions for this route.",
        "• Make sure the user has permission to view money/deleted records.",
      );
    }

    if (response.status === 404) {
      lines.push(
        "",
        "What to check:",
        "• Make sure app/api/admin/money/deleted-items/route.ts exists.",
        "• Make sure the route exports GET and PATCH.",
        "• The deleted row may already have been restored or removed.",
      );
    }

    if (response.status === 405) {
      lines.push(
        "",
        "What to check:",
        "• The route exists, but the HTTP method is missing.",
        "• Add export async function GET(request: Request) for loading.",
        "• Add export async function PATCH(request: Request) for restoring.",
      );
    }

    if (response.status >= 500) {
      lines.push(
        "",
        "What to check:",
        "• Check the terminal/Vercel logs for the full server error.",
        "• Make sure money_saving_targets has deleted_at, deleted_by, deleted_by_email and deleted_by_user_id.",
        "• Make sure the budget tracker table name is correct in POSSIBLE_BUDGET_TABLES.",
        "• Make sure the budget tracker table also has deleted_at and deleted_by columns.",
      );
    }

    throw new Error(lines.join("\n"));
  }

  return payload || {};
}

export default function DeletedMoneyItemsClient() {
  const [selectedYear, setSelectedYear] = useState(() =>
    String(new Date().getFullYear()),
  );
  const [activeTab, setActiveTab] = useState<"saving_targets" | "budget_items">(
    "saving_targets",
  );
  const [payload, setPayload] = useState<DeletedItemsPayload>({
    savingTargets: [],
    budgetItems: [],
  });
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    return {
      savingTargets: payload.savingTargets.length,
      budgetItems: payload.budgetItems.length,
      all: payload.savingTargets.length + payload.budgetItems.length,
    };
  }, [payload.budgetItems.length, payload.savingTargets.length]);

  async function loadDeletedItems() {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/admin/money/deleted-items?year=${encodeURIComponent(
          selectedYear,
        )}`,
        { cache: "no-store" },
      );

      const data = await parseResponse(response);

      setPayload({
        savingTargets: Array.isArray(data?.savingTargets)
          ? data.savingTargets
          : [],
        budgetItems: Array.isArray(data?.budgetItems) ? data.budgetItems : [],
        budgetTable: data?.budgetTable || null,
        budgetWarning: data?.budgetWarning || null,
        year: data?.year || selectedYear,
      });
    } catch (err: any) {
      setError(err?.message || "Could not load deleted items.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDeletedItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

  async function restoreItem(type: "saving_target" | "budget_item", id: string) {
    setRestoringId(id);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/money/deleted-items", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          id,
          table: type === "budget_item" ? payload.budgetTable : undefined,
        }),
      });

      await parseResponse(response);

      setMessage(
        type === "saving_target"
          ? "Saving target restored successfully."
          : "Budget tracker item restored successfully.",
      );

      await loadDeletedItems();
    } catch (err: any) {
      setError(err?.message || "Could not restore item.");
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <section className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-red-100/70">
            Deleted total
          </p>
          <p className="mt-2 text-3xl font-black text-white">{totals.all}</p>
        </div>

        <div className="rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-sky-100/70">
            Saving targets
          </p>
          <p className="mt-2 text-3xl font-black text-white">
            {totals.savingTargets}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-emerald-100/70">
            Budget items
          </p>
          <p className="mt-2 text-3xl font-black text-white">
            {totals.budgetItems}
          </p>
        </div>

        <label className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <span className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-white/60">
            <CalendarDays className="h-4 w-4" />
            Year
          </span>
          <input
            type="number"
            value={selectedYear}
            onChange={(event) => setSelectedYear(event.target.value)}
            className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 focus:ring-pink-300/40"
          />
        </label>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("saving_targets")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-black ${
              activeTab === "saving_targets"
                ? "bg-sky-400 text-black"
                : "bg-white/10 text-white ring-1 ring-white/10 hover:bg-white/20"
            }`}
          >
            <Target className="h-4 w-4" />
            Saving targets
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("budget_items")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-black ${
              activeTab === "budget_items"
                ? "bg-emerald-400 text-black"
                : "bg-white/10 text-white ring-1 ring-white/10 hover:bg-white/20"
            }`}
          >
            <WalletCards className="h-4 w-4" />
            Budget tracker
          </button>
        </div>

        <button
          type="button"
          onClick={loadDeletedItems}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20 disabled:opacity-60"
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {message && (
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-300/30 bg-red-500/10 p-4 text-sm text-red-100">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-black text-white">Deleted area error</p>
              <p className="mt-2 whitespace-pre-wrap break-words leading-6">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}

      {payload.budgetWarning && (
        <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
          <p className="font-black text-white">Budget tracker note</p>
          <p className="mt-1">{payload.budgetWarning}</p>
        </div>
      )}

      {activeTab === "saving_targets" ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {payload.savingTargets.length === 0 ? (
            <EmptyState label="No soft-deleted saving targets for this year." />
          ) : (
            payload.savingTargets.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-words text-lg font-black text-white">
                      {item.target_name || "Saving target"}
                    </p>
                    <p className="mt-1 text-sm text-sky-100/70">
                      {money(item.saved_amount_pence)} saved of{" "}
                      {money(item.target_amount_pence)}
                    </p>
                    <p className="mt-1 text-sm text-sky-100/70">
                      Months: {item.months_to_save || 0}
                    </p>
                    {item.notes && (
                      <p className="mt-2 rounded-xl bg-black/20 px-3 py-2 text-sm text-sky-100/80">
                        {item.notes}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => restoreItem("saving_target", item.id)}
                    disabled={restoringId === item.id}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-black hover:bg-emerald-400 disabled:opacity-60"
                  >
                    <RotateCcw className="h-4 w-4" />
                    {restoringId === item.id ? "Restoring..." : "Restore"}
                  </button>
                </div>

                <DeletedMeta item={item} />
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {payload.budgetItems.length === 0 ? (
            <EmptyState label="No soft-deleted budget tracker items for this year." />
          ) : (
            payload.budgetItems.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-words text-lg font-black text-white">
                      {item.category_label || item.category_key || "Budget item"}
                    </p>
                    <p className="mt-1 text-sm text-emerald-100/70">
                      Planned: {money(item.planned_amount_pence)}
                    </p>
                    {item.notes && (
                      <p className="mt-2 rounded-xl bg-black/20 px-3 py-2 text-sm text-emerald-100/80">
                        {item.notes}
                      </p>
                    )}
                    {payload.budgetTable && (
                      <p className="mt-2 text-xs text-emerald-100/45">
                        Table: {payload.budgetTable}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => restoreItem("budget_item", item.id)}
                    disabled={restoringId === item.id}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-black hover:bg-emerald-400 disabled:opacity-60"
                  >
                    <RotateCcw className="h-4 w-4" />
                    {restoringId === item.id ? "Restoring..." : "Restore"}
                  </button>
                </div>

                <DeletedMeta item={item} />
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center lg:col-span-2">
      <Trash2 className="mx-auto mb-3 h-8 w-8 text-white/30" />
      <p className="font-bold text-white/70">{label}</p>
    </div>
  );
}

function DeletedMeta({
  item,
}: {
  item: {
    deleted_at?: string | null;
    deleted_by?: string | null;
    deleted_by_email?: string | null;
  };
}) {
  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-xs leading-5 text-white/55">
      <p>
        Deleted at:{" "}
        <span className="font-bold text-white/80">
          {formatDate(item.deleted_at)}
        </span>
      </p>
      <p>
        Deleted by:{" "}
        <span className="font-bold text-white/80">
          {item.deleted_by || "Not recorded"}
        </span>
      </p>
      {item.deleted_by_email && (
        <p className="break-all">
          Email:{" "}
          <span className="font-bold text-white/80">
            {item.deleted_by_email}
          </span>
        </p>
      )}
    </div>
  );
}
