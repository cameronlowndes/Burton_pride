import type { MoneyTotals } from "@/lib/money/types";
import { money } from "@/lib/money/helpers";

type MoneySummaryCardsProps = {
  totals: MoneyTotals;
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

const cardToneClasses: Record<
  SummaryCardTone,
  {
    card: string;
    title: string;
    description: string;
    amount?: string;
  }
> = {
  purple: {
    card: "border-purple-300/20 bg-purple-500/10",
    title: "text-purple-100",
    description: "text-purple-100/65",
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

function valueOrZero(value: number | null | undefined) {
  return Number(value || 0);
}

function SummaryCard({
  title,
  amount,
  description,
  tone,
  large = false,
}: SummaryCardProps) {
  const classes = cardToneClasses[tone];

  return (
    <article
      className={`min-w-0 rounded-3xl border p-5 shadow-lg shadow-black/10 ${classes.card}`}
    >
      <p className={`text-sm font-black ${classes.title}`}>{title}</p>

      <p
        className={`mt-2 break-words font-black text-white ${
          classes.amount || ""
        } ${large ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"}`}
      >
        {money(valueOrZero(amount))}
      </p>

      <p className={`mt-2 text-xs leading-5 ${classes.description}`}>
        {description}
      </p>
    </article>
  );
}

export default function MoneySummaryCards({ totals }: MoneySummaryCardsProps) {
  const balance = valueOrZero(totals.balance);

  const summaryCards: SummaryCardProps[] = [
    {
      title: "Starting balance",
      amount: valueOrZero(totals.openingBalance),
      description: "Money carried forward into this year.",
      tone: "purple",
    },
    {
      title: "Money in",
      amount: valueOrZero(totals.income),
      description: "General money received by Burton Pride.",
      tone: "emerald",
    },
    {
      title: "Money out",
      amount: valueOrZero(totals.expense),
      description: "General payments and spending.",
      tone: "red",
    },
    {
      title: "Paid personally",
      amount: valueOrZero(totals.personalFunds),
      description: "Payments made by someone personally.",
      tone: "sky",
    },
    {
      title: "Still owed back",
      amount: valueOrZero(totals.personalFundsOutstanding),
      description: "Personal payments still waiting for repayment.",
      tone: "orange",
    },
    {
      title: "Restricted funding left",
      amount: valueOrZero(totals.sponsorshipRemaining),
      description: "Sponsor, grant or restricted funding still available.",
      tone: "amber",
    },
  ];

  return (
    <section className="space-y-4">
      <article className="rounded-3xl border border-emerald-300/30 bg-emerald-500/15 p-5 shadow-lg shadow-black/10 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-black uppercase tracking-wide text-emerald-100">
              Money available now
            </p>

            <p className="mt-2 break-words text-4xl font-black text-white sm:text-5xl">
              {money(balance)}
            </p>
          </div>

          <p className="max-w-2xl text-sm leading-6 text-emerald-100/75 lg:text-right">
            This is the general Burton Pride balance after general money in and
            money out. Restricted funding is tracked separately.
          </p>
        </div>
      </article>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {summaryCards.map((card) => (
          <SummaryCard key={card.title} {...card} />
        ))}
      </div>
    </section>
  );
}
