"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit3,
  PiggyBank,
  Save,
  X,
} from "lucide-react";

import type { Transaction } from "@/lib/money/types";

type BudgetItem = {
  id?: string | null;
  year: string;
  category_key: string;
  category_label: string;
  planned_amount_pence: number;
  notes?: string | null;
};

type Props = {
  selectedYear: string;
  budgetItems: BudgetItem[];
  transactions: Transaction[];
  savingBudget: boolean;
  onSaveBudget: (items: BudgetItem[]) => void | Promise<void>;
};

function money(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format((Number(value) || 0) / 100);
}

function penceToInput(value: number) {
  return ((Number(value) || 0) / 100).toFixed(2);
}

function inputToPence(value: string) {
  const amount = Number(String(value || "0").replace(/,/g, ""));
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

const KEYWORDS: Record<string, string[]> = {
  venue: ["venue", "pitch", "field", "hire", "shobnall"],
  insurance: ["insurance", "public liability", "liability"],
  printing: ["print", "printing", "poster", "banner", "flyer", "leaflet"],
  security: ["security", "steward", "first aid", "safety"],
  performers: ["performer", "drag", "queen", "artist", "dj", "entertainment"],
  equipment: ["equipment", "gazebo", "table", "stage", "pa", "speaker", "mic"],
  accessibility: [
    "accessibility",
    "accessible",
    "disabled",
    "bsl",
    "quiet space",
    "sensory",
  ],
  other: [],
};

function getActualForCategory(
  categoryKey: string,
  categoryLabel: string,
  transactions: Transaction[]
) {
  if (categoryKey === "other") {
    const knownKeys = Object.keys(KEYWORDS).filter((key) => key !== "other");

    return transactions
      .filter((item) => item.type === "expense")
      .filter((item) => {
        const haystack = [
          item.title,
          item.description,
          item.category,
          item.payment_method,
          item.sponsorship_note,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return !knownKeys.some((key) =>
          KEYWORDS[key].some((word) => haystack.includes(word.toLowerCase()))
        );
      })
      .reduce((sum, item) => sum + (item.amount_pence || 0), 0);
  }

  const words = [
    categoryKey,
    categoryLabel,
    ...(KEYWORDS[categoryKey] || []),
  ].map((word) => word.toLowerCase());

  return transactions
    .filter((item) => item.type === "expense")
    .filter((item) => {
      const haystack = [
        item.title,
        item.description,
        item.category,
        item.payment_method,
        item.sponsorship_note,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return words.some((word) => haystack.includes(word));
    })
    .reduce((sum, item) => sum + (item.amount_pence || 0), 0);
}

export default function MoneyBudgetPlanning({
  selectedYear,
  budgetItems,
  transactions,
  savingBudget,
  onSaveBudget,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftItems, setDraftItems] = useState<BudgetItem[]>(budgetItems);

  useEffect(() => {
    setDraftItems(budgetItems);
  }, [budgetItems]);

  const rows = useMemo(() => {
    return (editing ? draftItems : budgetItems).map((item) => {
      const actualPence = getActualForCategory(
        item.category_key,
        item.category_label,
        transactions
      );

      const plannedPence = Number(item.planned_amount_pence || 0);
      const remainingPence = plannedPence - actualPence;
      const percentUsed =
        plannedPence > 0 ? Math.round((actualPence / plannedPence) * 100) : 0;

      return {
        ...item,
        actualPence,
        remainingPence,
        percentUsed,
      };
    });
  }, [budgetItems, draftItems, editing, transactions]);

  const totals = useMemo(() => {
    const planned = rows.reduce(
      (sum, item) => sum + (item.planned_amount_pence || 0),
      0
    );

    const actual = rows.reduce((sum, item) => sum + item.actualPence, 0);
    const remaining = planned - actual;
    const percentUsed = planned > 0 ? Math.round((actual / planned) * 100) : 0;

    return {
      planned,
      actual,
      remaining,
      percentUsed,
    };
  }, [rows]);

  const hasOverBudgetRows = rows.some((item) => item.remainingPence < 0);

  function startEditing() {
    setDraftItems(budgetItems);
    setEditing(true);
    setIsOpen(true);
  }

  function cancelEditing() {
    setDraftItems(budgetItems);
    setEditing(false);
  }

  function updateDraft(
    categoryKey: string,
    field: "planned_amount_pence" | "notes",
    value: string
  ) {
    setDraftItems((prev) =>
      prev.map((item) => {
        if (item.category_key !== categoryKey) return item;

        return {
          ...item,
          [field]:
            field === "planned_amount_pence" ? inputToPence(value) : value,
        };
      })
    );
  }

  async function saveBudget() {
    await onSaveBudget(draftItems);
    setEditing(false);
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-100">
            <PiggyBank className="h-4 w-4" />
            Budget planning
          </div>

          <h2 className="break-words text-2xl font-black text-white">
            Planned budget vs actual spending
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
            Plan your expected costs for {selectedYear}, then compare them
            against real spending from your transactions.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20"
          >
            {isOpen ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Hide details
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Show details
              </>
            )}
          </button>

          {!editing && (
            <button
              type="button"
              onClick={startEditing}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-pink-500 px-4 py-3 text-sm font-black text-white hover:bg-pink-400"
            >
              <Edit3 className="h-4 w-4" />
              Edit budget
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-100">
            Planned
          </p>
          <p className="mt-2 text-2xl font-black text-white">
            {money(totals.planned)}
          </p>
        </div>

        <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-red-100">
            Actual spent
          </p>
          <p className="mt-2 text-2xl font-black text-white">
            {money(totals.actual)}
          </p>
        </div>

        <div
          className={`rounded-2xl border p-4 ${
            totals.remaining >= 0
              ? "border-sky-300/20 bg-sky-500/10"
              : "border-red-300/20 bg-red-500/10"
          }`}
        >
          <p className="text-xs font-bold uppercase tracking-wide text-white/60">
            Remaining
          </p>
          <p
            className={`mt-2 text-2xl font-black ${
              totals.remaining >= 0 ? "text-sky-100" : "text-red-100"
            }`}
          >
            {money(totals.remaining)}
          </p>
        </div>

        <div className="rounded-2xl border border-purple-300/20 bg-purple-500/10 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-purple-100">
            Budget used
          </p>
          <p className="mt-2 text-2xl font-black text-white">
            {totals.percentUsed}%
          </p>
        </div>
      </div>

      {!isOpen && hasOverBudgetRows && (
        <div className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm text-red-100">
          Some cost areas are over budget. Open details to check the rows before
          approving more spending.
        </div>
      )}

      {isOpen && (
        <div className="mt-5 space-y-5">
          {editing && (
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={saveBudget}
                disabled={savingBudget}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {savingBudget ? "Saving..." : "Save budget"}
              </button>

              <button
                type="button"
                onClick={cancelEditing}
                disabled={savingBudget}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="bg-white/10 text-xs uppercase tracking-wide text-white/60">
                  <tr>
                    <th className="px-4 py-3">Cost area</th>
                    <th className="px-4 py-3">Planned budget</th>
                    <th className="px-4 py-3">Actual spending</th>
                    <th className="px-4 py-3">Remaining</th>
                    <th className="px-4 py-3">Used</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/10">
                  {rows.map((item) => {
                    const overBudget = item.remainingPence < 0;

                    return (
                      <tr key={item.category_key} className="bg-black/10">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <Banknote className="h-4 w-4 text-white/45" />
                            <span className="font-black text-white">
                              {item.category_label}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          {editing ? (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={penceToInput(item.planned_amount_pence)}
                              onChange={(event) =>
                                updateDraft(
                                  item.category_key,
                                  "planned_amount_pence",
                                  event.target.value
                                )
                              }
                              className="w-32 rounded-xl bg-black/30 p-2 text-white outline-none ring-1 ring-white/10 focus:ring-pink-300/40"
                            />
                          ) : (
                            <span className="font-bold text-white">
                              {money(item.planned_amount_pence)}
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-4 font-bold text-white">
                          {money(item.actualPence)}
                        </td>

                        <td
                          className={`px-4 py-4 font-black ${
                            overBudget ? "text-red-200" : "text-emerald-200"
                          }`}
                        >
                          {money(item.remainingPence)}
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-white/10">
                              <div
                                className={`h-full rounded-full ${
                                  overBudget ? "bg-red-400" : "bg-emerald-400"
                                }`}
                                style={{
                                  width: `${Math.min(item.percentUsed, 100)}%`,
                                }}
                              />
                            </div>

                            <span className="font-bold text-white/75">
                              {item.percentUsed}%
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          {editing ? (
                            <input
                              type="text"
                              value={item.notes || ""}
                              onChange={(event) =>
                                updateDraft(
                                  item.category_key,
                                  "notes",
                                  event.target.value
                                )
                              }
                              placeholder="Add note"
                              className="w-full rounded-xl bg-black/30 p-2 text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-pink-300/40"
                            />
                          ) : item.notes ? (
                            <span className="text-white/70">{item.notes}</span>
                          ) : (
                            <span className="text-white/30">No notes</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {hasOverBudgetRows && (
            <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm text-red-100">
              <CheckCircle2 className="mb-2 h-5 w-5" />
              Some cost areas are over budget. Check the rows marked in red
              before approving more spending.
            </div>
          )}
        </div>
      )}
    </section>
  );
}