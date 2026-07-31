import { useMemo } from "react";

import type { MoneyTotals } from "@/lib/money/types";
import { money } from "@/lib/money/helpers";

type MoneySummaryCardsProps = {
  totals?: MoneyTotals | null;
};

type SummaryCardTone =
  | "purple"
  | "emerald"
  | "red"
  | "sky"
  | "orange"
  | "amber";

type SummaryCardProps = {
  title: string;
  amount: number;
  description: string;
  tone: SummaryCardTone;
  large?: boolean;
};

const CARD_TONE_CLASSES: Record<
  SummaryCardTone,
  {
    card: string;
    title: string;
    description: string;
    amount: string;
  }
> = {
  purple: {
    card: "border-purple-300/20 bg-purple-500/10",
    title: "text-purple-100",
    description: "text-purple-100/65",
    amount: "text-purple-50",
  },
  emerald: {
    card: "border-emerald-300/20 bg-emerald-500/10",
    title: "text-emerald-100",
    description: "text-emerald-100/65",
    amount: "text-emerald-50",
  },
  red: {
    card: "border-red-300/20 bg-red-500/10",
    title: "text-red-100",
    description: "text-red-100/65",
    amount: "text-red-50",
  },
  sky: {
    card: "border-sky-300/20 bg-sky-500/10",
    title: "text-sky-100",
    description: "text-sky-100/65",
    amount: "text-sky-50",
  },
  orange: {
    card: "border-orange-300/20 bg-orange-500/10",
    title: "text-orange-100",
    description: "text-orange-100/65",
    amount: "text-orange-50",
  },
  amber: {
    card: "border-amber-300/20 bg-amber-500/10",
    title: "text-amber-100",
    description: "text-amber-100/65",
    amount: "text-amber-50",
  },
};

function safeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: unknown): string {
  return money(safeNumber(value));
}

function SummaryCard({
  title,
  amount,
  description,
  tone,
  large = false,
}: SummaryCardProps) {
  const classes = CARD_TONE_CLASSES[tone];

  return (
    <article
      className={`min-w-0 rounded-3xl border p-5 shadow-lg shadow-black/10 ${classes.card}`}
    >
      <p className={`break-words text-sm font-black ${classes.title}`}>
        {title}
      </p>

      <p
        className={`mt-2 break-words font-black ${classes.amount} ${
          large ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"
        }`}
      >
        {formatMoney(amount)}
      </p>

      <p
        className={`mt-2 break-words text-xs leading-5 ${classes.description}`}
      >
        {description}
      </p>
    </article>
  );
}

export default function MoneySummaryCards({
  totals,
}: MoneySummaryCardsProps) {
  const safeTotals = totals ?? ({} as MoneyTotals);

  const balance = safeNumber(safeTotals.balance);

  const summaryCards = useMemo<SummaryCardProps[]>(
    () => [
      {
        title: "Starting balance",
        amount: safeNumber(safeTotals.openingBalance),
        description: "Money carried forward into this year.",
        tone: "purple",
      },
      {
        title: "Money in",
        amount: safeNumber(safeTotals.income),
        description: "General money received by Burton Pride.",
        tone: "emerald",
      },
      {
        title: "Money out",
        amount: safeNumber(safeTotals.expense),
        description: "General payments and spending.",
        tone: "red",
      },
      {
        title: "Paid personally",
        amount: safeNumber(safeTotals.personalFunds),
        description: "Payments made by someone personally.",
        tone: "sky",
      },
      {
        title: "Still owed back",
        amount: safeNumber(safeTotals.personalFundsOutstanding),
        description: "Personal payments still waiting for repayment.",
        tone: "orange",
      },
      {
        title: "Restricted funding left",
        amount: safeNumber(safeTotals.sponsorshipRemaining),
        description: "Sponsor, grant or restricted funding still available.",
        tone: "amber",
      },
    ],
    [
      safeTotals.expense,
      safeTotals.income,
      safeTotals.openingBalance,
      safeTotals.personalFunds,
      safeTotals.personalFundsOutstanding,
      safeTotals.sponsorshipRemaining,
    ],
  );

  const balanceIsNegative = balance < 0;

  return (
    <section
      aria-labelledby="money-summary-title"
      className="space-y-4"
    >
      <article
        className={`rounded-3xl border p-5 shadow-lg shadow-black/10 sm:p-6 ${
          balanceIsNegative
            ? "border-red-300/30 bg-red-500/15"
            : "border-emerald-300/30 bg-emerald-500/15"
        }`}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p
              id="money-summary-title"
              className={`text-sm font-black uppercase tracking-wide ${
                balanceIsNegative
                  ? "text-red-100"
                  : "text-emerald-100"
              }`}
            >
              Money available now
            </p>

            <p
              className={`mt-2 break-words text-4xl font-black sm:text-5xl ${
                balanceIsNegative ? "text-red-50" : "text-white"
              }`}
            >
              {formatMoney(balance)}
            </p>
          </div>

          <p
            className={`max-w-2xl text-sm leading-6 lg:text-right ${
              balanceIsNegative
                ? "text-red-100/75"
                : "text-emerald-100/75"
            }`}
          >
            This is the general Burton Pride balance after general money in and
            money out. Restricted funding is tracked separately.
          </p>
        </div>

        {balanceIsNegative ? (
          <div
            role="alert"
            className="mt-4 rounded-2xl border border-red-300/20 bg-black/20 px-4 py-3 text-sm font-bold text-red-100"
          >
            The available general balance is below zero and needs checking.
          </div>
        ) : null}
      </article>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {summaryCards.map((card) => (
          <SummaryCard key={card.title} {...card} />
        ))}
      </div>
    </section>
  );
}
