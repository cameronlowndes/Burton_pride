import type { MoneyTotals } from "@/lib/money/types";
import { money } from "@/lib/money/helpers";

type MoneySummaryCardsProps = {
  totals: MoneyTotals;
};

export default function MoneySummaryCards({ totals }: MoneySummaryCardsProps) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
      <div className="min-w-0 rounded-3xl bg-purple-500/10 p-5">
        <p className="text-sm text-purple-200">Opening Balance</p>
        <p className="break-words text-2xl font-bold sm:text-3xl">
          {money(totals.openingBalance || 0)}
        </p>
      </div>

      <div className="min-w-0 rounded-3xl bg-emerald-500/10 p-5">
        <p className="text-sm text-emerald-200">Money In</p>
        <p className="break-words text-2xl font-bold sm:text-3xl">
          {money(totals.income)}
        </p>
      </div>

      <div className="min-w-0 rounded-3xl bg-red-500/10 p-5">
        <p className="text-sm text-red-200">Burton Pride Money Out</p>
        <p className="break-words text-2xl font-bold sm:text-3xl">
          {money(totals.expense)}
        </p>
      </div>

      <div className="min-w-0 rounded-3xl bg-sky-500/10 p-5">
        <p className="text-sm text-sky-200">Personal Funds</p>
        <p className="break-words text-2xl font-bold sm:text-3xl">
          {money(totals.personalFunds)}
        </p>
      </div>

      <div className="min-w-0 rounded-3xl bg-orange-500/10 p-5">
        <p className="text-sm text-orange-200">Still Owed</p>
        <p className="break-words text-2xl font-bold sm:text-3xl">
          {money(totals.personalFundsOutstanding)}
        </p>
      </div>

      <div className="min-w-0 rounded-3xl bg-amber-500/10 p-5">
        <p className="text-sm text-amber-200">Sponsorship Left</p>
        <p className="break-words text-2xl font-bold sm:text-3xl">
          {money(totals.sponsorshipRemaining)}
        </p>
      </div>

      <div className="min-w-0 rounded-3xl bg-blue-500/10 p-5">
        <p className="text-sm text-blue-200">Balance</p>
        <p className="break-words text-2xl font-bold sm:text-3xl">
          {money(totals.balance)}
        </p>
      </div>
    </section>
  );
}