import type { ReactNode } from "react";

import type { MoneyTotals } from "@/lib/money/types";
import { money } from "@/lib/money/helpers";

type MoneySummaryCardsProps = {
  totals: MoneyTotals;
};

type SummaryCardProps = {
  title: string;
  amount: number;
  description: string;
  className: string;
  titleClassName: string;
  descriptionClassName: string;
  important?: boolean;
};

function SummaryCard({
  title,
  amount,
  description,
  className,
  titleClassName,
  descriptionClassName,
  important = false,
}: SummaryCardProps) {
  return (
    <div
      className={`min-w-0 rounded-3xl border p-5 shadow-lg shadow-black/10 ${className}`}
    >
      <p className={`text-sm font-bold ${titleClassName}`}>{title}</p>

      <p
        className={`mt-2 break-words font-black ${
          important ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"
        }`}
      >
        {money(amount || 0)}
      </p>

      <p className={`mt-2 text-xs leading-5 ${descriptionClassName}`}>
        {description}
      </p>
    </div>
  );
}

export default function MoneySummaryCards({ totals }: MoneySummaryCardsProps) {
  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-emerald-300/30 bg-emerald-500/15 p-5 shadow-lg shadow-black/10">
        <p className="text-sm font-black uppercase tracking-wide text-emerald-100">
          Money Available Now
        </p>

        <p className="mt-2 break-words text-4xl font-black text-white sm:text-5xl">
          {money(totals.balance || 0)}
        </p>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-100/75">
          This is the general Burton Pride balance. It updates when general
          money comes in or when a payment goes out.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <SummaryCard
          title="Starting Balance"
          amount={totals.openingBalance || 0}
          description="Money carried forward from before."
          className="border-purple-300/20 bg-purple-500/10"
          titleClassName="text-purple-100"
          descriptionClassName="text-purple-100/60"
        />

        <SummaryCard
          title="Total Money In"
          amount={totals.income || 0}
          description="All general money received before spending."
          className="border-emerald-300/20 bg-emerald-500/10"
          titleClassName="text-emerald-100"
          descriptionClassName="text-emerald-100/60"
        />

        <SummaryCard
          title="Total Money Out"
          amount={totals.expense || 0}
          description="General Burton Pride payments and spending."
          className="border-red-300/20 bg-red-500/10"
          titleClassName="text-red-100"
          descriptionClassName="text-red-100/60"
        />

        <SummaryCard
          title="Paid Personally"
          amount={totals.personalFunds || 0}
          description="Money paid by a person before repayment."
          className="border-sky-300/20 bg-sky-500/10"
          titleClassName="text-sky-100"
          descriptionClassName="text-sky-100/60"
        />

        <SummaryCard
          title="Still Owed Back"
          amount={totals.personalFundsOutstanding || 0}
          description="Personal payments that still need repaying."
          className="border-orange-300/20 bg-orange-500/10"
          titleClassName="text-orange-100"
          descriptionClassName="text-orange-100/60"
        />

        <SummaryCard
          title="Restricted Funding Left"
          amount={totals.sponsorshipRemaining || 0}
          description="Sponsor, grant or restricted money still available."
          className="border-amber-300/20 bg-amber-500/10"
          titleClassName="text-amber-100"
          descriptionClassName="text-amber-100/60"
        />
      </div>
    </section>
  );
}