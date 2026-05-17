"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import type { CarryForwardNote } from "@/lib/money/types";
import { money } from "@/lib/money/helpers";

type MoneyCarryForwardNoteProps = {
  selectedYear: string;
  carryForwardNote: CarryForwardNote;
};

export default function MoneyCarryForwardNote({
  selectedYear,
  carryForwardNote,
}: MoneyCarryForwardNoteProps) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-3xl border border-purple-400/20 bg-purple-500/10 p-5 shadow-2xl shadow-black/20">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-purple-200">
            Year-end carry forward note
          </p>

          <h2 className="mt-2 text-xl font-bold text-white">
            Opening balance calculation for {selectedYear}
          </h2>

          <p className="mt-2 max-w-4xl text-sm leading-6 text-white/70">
            Minimized by default. Open this section when you need to show how
            the opening balance was calculated for accounts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right sm:block">
            <p className="text-xs text-white/50">Opening Balance</p>
            <p className="text-2xl font-bold text-white">
              {money(carryForwardNote.openingBalance)}
            </p>
          </div>

          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white">
            {open ? (
              <ChevronDown className="h-5 w-5" />
            ) : (
              <ChevronRight className="h-5 w-5" />
            )}
          </span>
        </div>
      </button>

      {!open && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 sm:hidden">
          <p className="text-xs text-white/50">Opening Balance</p>
          <p className="text-2xl font-bold text-white">
            {money(carryForwardNote.openingBalance)}
          </p>
        </div>
      )}

      {open && (
        <>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
              <p className="text-sm text-emerald-200">
                Previous general income
              </p>
              <p className="mt-1 text-2xl font-bold text-white">
                {money(carryForwardNote.previousIncome)}
              </p>
              <p className="mt-1 text-xs text-white/50">
                {carryForwardNote.previousIncomeCount} income transaction
                {carryForwardNote.previousIncomeCount === 1 ? "" : "s"}
              </p>
            </div>

            <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4">
              <p className="text-sm text-red-200">
                Previous general spending
              </p>
              <p className="mt-1 text-2xl font-bold text-white">
                {money(carryForwardNote.previousNormalExpense)}
              </p>
              <p className="mt-1 text-xs text-white/50">
                {carryForwardNote.previousNormalExpenseCount} spending
                transaction
                {carryForwardNote.previousNormalExpenseCount === 1 ? "" : "s"}
              </p>
            </div>

            <div className="rounded-2xl border border-orange-400/20 bg-orange-500/10 p-4">
              <p className="text-sm text-orange-200">
                Previous personal funds paid back
              </p>
              <p className="mt-1 text-2xl font-bold text-white">
                {money(carryForwardNote.previousPersonalFundsRepaid)}
              </p>
              <p className="mt-1 text-xs text-white/50">
                {carryForwardNote.previousPersonalFundsRepaidCount} repayment
                transaction
                {carryForwardNote.previousPersonalFundsRepaidCount === 1
                  ? ""
                  : "s"}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-sm font-semibold text-white">
              Calculation used for accounts
            </p>

            <p className="mt-2 text-sm leading-6 text-white/70">
              Opening balance = previous general income - previous general
              spending - previous personal funds paid back.
            </p>

            <p className="mt-3 break-words rounded-xl bg-black/30 px-3 py-2 text-sm font-semibold text-purple-100">
              {money(carryForwardNote.previousIncome)} -{" "}
              {money(carryForwardNote.previousNormalExpense)} -{" "}
              {money(carryForwardNote.previousPersonalFundsRepaid)} ={" "}
              {money(carryForwardNote.openingBalance)}
            </p>

            <p className="mt-3 text-xs leading-5 text-white/50">
              Restricted sponsor, grant, loan, or funding pots are kept separate
              and are not included in this general Burton Pride opening balance.
            </p>
          </div>
        </>
      )}
    </section>
  );
}