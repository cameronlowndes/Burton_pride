"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import type { CarryForwardNote } from "@/lib/money/types";
import { money } from "@/lib/money/helpers";

type MoneyCarryForwardNoteProps = {
  selectedYear: string;
  carryForwardNote: CarryForwardNote;
};

function safeMoneyValue(value: unknown) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function safeCount(value: unknown) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) return 0;

  return Math.max(0, Math.trunc(numberValue));
}

function validYearLabel(value: string) {
  const cleanValue = String(value || "").trim();

  return /^\d{4}$/.test(cleanValue) ? cleanValue : "selected year";
}

export default function MoneyCarryForwardNote({
  selectedYear,
  carryForwardNote,
}: MoneyCarryForwardNoteProps) {
  const [open, setOpen] = useState(false);
  const contentId = useId();

  /*
   * Close the expanded calculation when the year changes so an old expanded
   * explanation is not mistaken for the newly selected year while data is
   * loading or being replaced.
   */
  useEffect(() => {
    setOpen(false);
  }, [selectedYear]);

  const yearLabel = validYearLabel(selectedYear);

  const values = useMemo(
    () => ({
      openingBalance: safeMoneyValue(
        carryForwardNote.openingBalance,
      ),
      previousIncome: safeMoneyValue(
        carryForwardNote.previousIncome,
      ),
      previousNormalExpense: safeMoneyValue(
        carryForwardNote.previousNormalExpense,
      ),
      previousPersonalFundsRepaid: safeMoneyValue(
        carryForwardNote.previousPersonalFundsRepaid,
      ),
      previousIncomeCount: safeCount(
        carryForwardNote.previousIncomeCount,
      ),
      previousNormalExpenseCount: safeCount(
        carryForwardNote.previousNormalExpenseCount,
      ),
      previousPersonalFundsRepaidCount: safeCount(
        carryForwardNote.previousPersonalFundsRepaidCount,
      ),
    }),
    [carryForwardNote],
  );

  const calculatedOpeningBalance =
    values.previousIncome -
    values.previousNormalExpense -
    values.previousPersonalFundsRepaid;

  const calculationDifference =
    values.openingBalance - calculatedOpeningBalance;

  const calculationMatches = calculationDifference === 0;

  return (
    <section className="w-full rounded-3xl border border-purple-400/20 bg-purple-500/10 p-4 shadow-2xl shadow-black/20 sm:p-5">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex min-h-11 w-full items-center justify-between gap-4 rounded-2xl text-left outline-none transition focus-visible:ring-2 focus-visible:ring-purple-300"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-purple-200">
            Year-end carry forward note
          </p>

          <h2 className="mt-2 break-words text-xl font-bold text-white">
            Opening balance calculation for {yearLabel}
          </h2>

          <p className="mt-2 max-w-4xl text-sm leading-6 text-white/70">
            Minimized by default. Open this section when you need to show how
            the opening balance was calculated for the accounts.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right sm:block">
            <p className="text-xs text-white/50">Opening balance</p>
            <p className="text-2xl font-bold text-white">
              {money(values.openingBalance)}
            </p>
          </div>

          <span
            aria-hidden="true"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white"
          >
            {open ? (
              <ChevronDown className="h-5 w-5" />
            ) : (
              <ChevronRight className="h-5 w-5" />
            )}
          </span>
        </div>
      </button>

      {!open ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 sm:hidden">
          <p className="text-xs text-white/50">Opening balance</p>
          <p className="text-2xl font-bold text-white">
            {money(values.openingBalance)}
          </p>
        </div>
      ) : null}

      <div
        id={contentId}
        hidden={!open}
        className="mt-5"
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
            <p className="text-sm text-emerald-200">
              Previous general income
            </p>

            <p className="mt-1 break-words text-2xl font-bold text-white">
              {money(values.previousIncome)}
            </p>

            <p className="mt-1 text-xs text-white/50">
              {values.previousIncomeCount} income transaction
              {values.previousIncomeCount === 1 ? "" : "s"}
            </p>
          </div>

          <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4">
            <p className="text-sm text-red-200">
              Previous general spending
            </p>

            <p className="mt-1 break-words text-2xl font-bold text-white">
              {money(values.previousNormalExpense)}
            </p>

            <p className="mt-1 text-xs text-white/50">
              {values.previousNormalExpenseCount} spending transaction
              {values.previousNormalExpenseCount === 1 ? "" : "s"}
            </p>
          </div>

          <div className="rounded-2xl border border-orange-400/20 bg-orange-500/10 p-4">
            <p className="text-sm text-orange-200">
              Previous personal funds paid back
            </p>

            <p className="mt-1 break-words text-2xl font-bold text-white">
              {money(values.previousPersonalFundsRepaid)}
            </p>

            <p className="mt-1 text-xs text-white/50">
              {values.previousPersonalFundsRepaidCount} repayment transaction
              {values.previousPersonalFundsRepaidCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm font-semibold text-white">
            Calculation used for accounts
          </p>

          <p className="mt-2 text-sm leading-6 text-white/70">
            Opening balance = previous general income − previous general
            spending − previous personal funds paid back.
          </p>

          <p className="mt-3 break-words rounded-xl bg-black/30 px-3 py-2 text-sm font-semibold leading-6 text-purple-100">
            {money(values.previousIncome)} −{" "}
            {money(values.previousNormalExpense)} −{" "}
            {money(values.previousPersonalFundsRepaid)} ={" "}
            {money(calculatedOpeningBalance)}
          </p>

          <div
            className={`mt-3 rounded-xl border px-3 py-2 text-xs font-bold leading-5 ${
              calculationMatches
                ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
                : "border-red-300/20 bg-red-500/10 text-red-100"
            }`}
          >
            {calculationMatches ? (
              <p>
                The saved opening balance matches the displayed calculation.
              </p>
            ) : (
              <div className="space-y-1">
                <p>
                  Warning: the saved opening balance does not match the
                  displayed calculation.
                </p>
                <p>
                  Saved: {money(values.openingBalance)} · Calculated:{" "}
                  {money(calculatedOpeningBalance)} · Difference:{" "}
                  {money(calculationDifference)}
                </p>
              </div>
            )}
          </div>

          <p className="mt-3 text-xs leading-5 text-white/50">
            Restricted sponsor, grant, loan or other funding pots are kept
            separate and are not included in this general Burton Pride opening
            balance.
          </p>
        </div>
      </div>
    </section>
  );
}
