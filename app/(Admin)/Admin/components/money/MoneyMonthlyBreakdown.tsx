"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Coins,
  LockKeyhole,
  RefreshCcw,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

type MoneyTransaction = {
  id?: string;
  created_at?: string | null;
  transaction_date?: string | null;
  title?: string | null;
  description?: string | null;
  type?: "income" | "expense" | string | null;
  category?: string | null;
  amount_pence?: number | null;
  payment_method?: string | null;
  sponsor_id?: string | null;
  sponsor_name?: string | null;
  sponsorship_note?: string | null;
  funding_type?: string | null;
  source?: string | null;
  is_personal_funds?: boolean | null;
  personal_funds_repaid?: boolean | null;
  deleted_at?: string | null;
};

type RefundType = "money_received_back" | "money_sent_back";
type RefundStatus = "pending" | "completed" | "cancelled";

type MoneyRefund = {
  id: string;
  year: number;
  refund_date: string;
  refund_type: RefundType;
  amount_pence: number;
  title: string;
  notes?: string | null;
  status: RefundStatus;
  is_hidden?: boolean | null;
  created_at?: string | null;
};

type RefundApiResponse = {
  success?: boolean;
  refunds?: MoneyRefund[];
  message?: string;
  error?: string;
  details?: unknown;
};

type MoneyMonthlyBreakdownProps = {
  selectedYear: string;
  transactions: MoneyTransaction[];
};

type MonthRow = {
  key: string;
  shortLabel: string;
  longLabel: string;
  moneyIn: number;
  moneyOut: number;
  restrictedIncome: number;
  restrictedSpent: number;
  restrictedLeft: number;
  generalIncome: number;
  generalOut: number;
  refundsReceivedBack: number;
  refundsSentBack: number;
  generalBalanceBeforeRefunds: number;
  generalBalance: number;
  unpaidPersonalFunds: number;
  transactionCount: number;
  refundCount: number;
  activityCount: number;
};

type Tone = "emerald" | "red" | "amber" | "sky" | "violet" | "rose";

const MONTHS = [
  ["01", "Jan", "January"],
  ["02", "Feb", "February"],
  ["03", "Mar", "March"],
  ["04", "Apr", "April"],
  ["05", "May", "May"],
  ["06", "Jun", "June"],
  ["07", "Jul", "July"],
  ["08", "Aug", "August"],
  ["09", "Sep", "September"],
  ["10", "Oct", "October"],
  ["11", "Nov", "November"],
  ["12", "Dec", "December"],
].map(([key, shortLabel, longLabel]) => ({ key, shortLabel, longLabel }));

const toneClasses: Record<Tone, { card: string; bar: string; text: string }> = {
  emerald: {
    card: "border-emerald-300/20 bg-emerald-500/10 text-emerald-100",
    bar: "bg-emerald-400",
    text: "text-emerald-100",
  },
  red: {
    card: "border-red-300/20 bg-red-500/10 text-red-100",
    bar: "bg-red-400",
    text: "text-red-100",
  },
  amber: {
    card: "border-amber-300/20 bg-amber-500/10 text-amber-100",
    bar: "bg-amber-400",
    text: "text-amber-100",
  },
  sky: {
    card: "border-sky-300/20 bg-sky-500/10 text-sky-100",
    bar: "bg-sky-400",
    text: "text-sky-100",
  },
  violet: {
    card: "border-violet-300/20 bg-violet-500/10 text-violet-100",
    bar: "bg-violet-400",
    text: "text-violet-100",
  },
  rose: {
    card: "border-rose-300/20 bg-rose-500/10 text-rose-100",
    bar: "bg-rose-400",
    text: "text-rose-100",
  },
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format((Number(value) || 0) / 100);
}

function getDateValue(item: MoneyTransaction | MoneyRefund) {
  if ("refund_date" in item) return item.refund_date || item.created_at || "";
  return item.transaction_date || item.created_at || "";
}

function getYear(value: MoneyTransaction | MoneyRefund) {
  const dateValue = getDateValue(value);
  if (!dateValue) return "";

  const date = new Date(dateValue);
  return Number.isNaN(date.getTime())
    ? String(dateValue).slice(0, 4)
    : String(date.getFullYear());
}

function getMonth(value: MoneyTransaction | MoneyRefund) {
  const dateValue = getDateValue(value);
  if (!dateValue) return "";

  const date = new Date(dateValue);
  return Number.isNaN(date.getTime())
    ? String(dateValue).slice(5, 7)
    : String(date.getMonth() + 1).padStart(2, "0");
}

function hasRestrictedFunding(item: MoneyTransaction) {
  const source = String(item.source || "").toLowerCase();
  const category = String(item.category || "").toLowerCase();

  return Boolean(
    item.sponsor_id ||
      item.sponsor_name ||
      item.sponsorship_note ||
      source === "sponsorship" ||
      ["sponsorship", "grant", "restricted funding", "restricted"].includes(
        category,
      ),
  );
}

function isPersonalFunds(item: MoneyTransaction) {
  return Boolean(
    item.is_personal_funds ||
      String(item.payment_method || "").toLowerCase() === "personal funds",
  );
}

function isCompletedVisibleRefund(item: MoneyRefund) {
  return item.status === "completed" && !item.is_hidden;
}

function emptyMonthRow(selectedYear: string, month: (typeof MONTHS)[number]): MonthRow {
  return {
    key: `${selectedYear}-${month.key}`,
    shortLabel: month.shortLabel,
    longLabel: month.longLabel,
    moneyIn: 0,
    moneyOut: 0,
    restrictedIncome: 0,
    restrictedSpent: 0,
    restrictedLeft: 0,
    generalIncome: 0,
    generalOut: 0,
    refundsReceivedBack: 0,
    refundsSentBack: 0,
    generalBalanceBeforeRefunds: 0,
    generalBalance: 0,
    unpaidPersonalFunds: 0,
    transactionCount: 0,
    refundCount: 0,
    activityCount: 0,
  };
}

function buildMonthRows(
  transactions: MoneyTransaction[],
  refunds: MoneyRefund[],
  selectedYear: string,
) {
  return MONTHS.map((month) => {
    const row = emptyMonthRow(selectedYear, month);

    const monthTransactions = transactions.filter(
      (item) =>
        !item.deleted_at &&
        getYear(item) === selectedYear &&
        getMonth(item) === month.key,
    );

    const monthRefunds = refunds.filter(
      (item) =>
        isCompletedVisibleRefund(item) &&
        getYear(item) === selectedYear &&
        getMonth(item) === month.key,
    );

    row.transactionCount = monthTransactions.length;
    row.refundCount = monthRefunds.length;
    row.activityCount = row.transactionCount + row.refundCount;

    for (const item of monthTransactions) {
      const amount = Number(item.amount_pence || 0);
      const restricted = hasRestrictedFunding(item);
      const unpaidPersonal = isPersonalFunds(item) && !item.personal_funds_repaid;

      if (item.type === "income") {
        row.moneyIn += amount;
        if (restricted) row.restrictedIncome += amount;
        else row.generalIncome += amount;
      }

      if (item.type === "expense") {
        row.moneyOut += amount;
        if (restricted) row.restrictedSpent += amount;
        else if (unpaidPersonal) row.unpaidPersonalFunds += amount;
        else row.generalOut += amount;
      }
    }

    for (const refund of monthRefunds) {
      const amount = Number(refund.amount_pence || 0);

      if (refund.refund_type === "money_received_back") {
        row.refundsReceivedBack += amount;
      }

      if (refund.refund_type === "money_sent_back") {
        row.refundsSentBack += amount;
      }
    }

    row.restrictedLeft = row.restrictedIncome - row.restrictedSpent;
    row.generalBalanceBeforeRefunds = row.generalIncome - row.generalOut;
    row.generalBalance =
      row.generalBalanceBeforeRefunds +
      row.refundsReceivedBack -
      row.refundsSentBack;

    return row;
  });
}

function buildTotals(rows: MonthRow[]): MonthRow {
  return rows.reduce(
    (acc, row) => {
      acc.moneyIn += row.moneyIn;
      acc.moneyOut += row.moneyOut;
      acc.restrictedIncome += row.restrictedIncome;
      acc.restrictedSpent += row.restrictedSpent;
      acc.restrictedLeft += row.restrictedLeft;
      acc.generalIncome += row.generalIncome;
      acc.generalOut += row.generalOut;
      acc.refundsReceivedBack += row.refundsReceivedBack;
      acc.refundsSentBack += row.refundsSentBack;
      acc.generalBalanceBeforeRefunds += row.generalBalanceBeforeRefunds;
      acc.generalBalance += row.generalBalance;
      acc.unpaidPersonalFunds += row.unpaidPersonalFunds;
      acc.transactionCount += row.transactionCount;
      acc.refundCount += row.refundCount;
      acc.activityCount += row.activityCount;
      return acc;
    },
    emptyMonthRow("total", {
      key: "all",
      shortLabel: "Total",
      longLabel: "Total",
    }),
  );
}

function MetricCard({
  title,
  value,
  note,
  tone,
  icon,
}: {
  title: string;
  value: string;
  note?: string;
  tone: Tone;
  icon: ReactNode;
}) {
  return (
    <div className={`min-w-0 rounded-2xl border p-4 ${toneClasses[tone].card}`}>
      <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide opacity-80">
        {icon}
        <span className="break-words">{title}</span>
      </div>

      <p className="break-words text-xl font-black text-white sm:text-2xl">
        {value}
      </p>

      {note ? (
        <p className="mt-2 break-words text-xs font-bold leading-5 opacity-80">
          {note}
        </p>
      ) : null}
    </div>
  );
}

function MonthProgress({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: Tone;
}) {
  const percent = max > 0 ? Math.min(100, Math.round((Math.abs(value) / max) * 100)) : 0;

  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="break-words text-white/60">{label}</span>
        <span className="shrink-0 font-bold text-white/75">
          {formatMoney(value)}
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${toneClasses[tone].bar}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function RefundError({ message }: { message: string }) {
  if (!message) return null;

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
      <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-black">Refund totals could not be loaded</p>
        <p className="mt-1 leading-6 text-rose-100/80">{message}</p>
        <p className="mt-1 text-xs leading-5 text-rose-100/60">
          Transaction totals are still shown, but the available balance may be
          missing refund adjustments until the Refund Tracker API loads.
        </p>
      </div>
    </div>
  );
}

function MonthCard({ row, maxMonthValue }: { row: MonthRow; maxMonthValue: number }) {
  const hasActivity = row.activityCount > 0;
  const refundAdjustment = row.refundsReceivedBack - row.refundsSentBack;

  return (
    <div
      className={`min-w-0 rounded-2xl border p-4 ${
        hasActivity ? "border-white/10 bg-black/25" : "border-white/5 bg-black/10"
      }`}
    >
      <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-base font-black text-white">
            {row.shortLabel}
          </h3>
          <p className="mt-1 text-xs text-white/40">
            {row.transactionCount} transaction{row.transactionCount === 1 ? "" : "s"}
            {row.refundCount > 0
              ? ` · ${row.refundCount} refund${row.refundCount === 1 ? "" : "s"}`
              : ""}
          </p>
        </div>

        <div
          className={`shrink-0 rounded-xl px-3 py-1 text-xs font-black ring-1 ${
            row.generalBalance >= 0
              ? "bg-emerald-500/10 text-emerald-100 ring-emerald-300/20"
              : "bg-red-500/10 text-red-100 ring-red-300/20"
          }`}
        >
          Balance {formatMoney(row.generalBalance)}
        </div>
      </div>

      <div className="space-y-3">
        <MonthProgress label="Money in" value={row.generalIncome} max={maxMonthValue} tone="emerald" />
        <MonthProgress label="Money out" value={row.generalOut} max={maxMonthValue} tone="red" />
        <MonthProgress label="Refunds received" value={row.refundsReceivedBack} max={maxMonthValue} tone="violet" />
        <MonthProgress label="Refunds sent" value={row.refundsSentBack} max={maxMonthValue} tone="rose" />
        <MonthProgress label="Restricted money left" value={row.restrictedLeft} max={maxMonthValue} tone="amber" />

        {row.unpaidPersonalFunds > 0 ? (
          <div className="rounded-xl bg-orange-500/10 px-3 py-2 text-xs font-bold leading-5 text-orange-100 ring-1 ring-orange-300/20">
            {formatMoney(row.unpaidPersonalFunds)} personal funds not counted yet
          </div>
        ) : null}

        {refundAdjustment !== 0 ? (
          <div className="rounded-xl bg-violet-500/10 px-3 py-2 text-xs font-bold leading-5 text-violet-100 ring-1 ring-violet-300/20">
            Refund adjustment: {formatMoney(refundAdjustment)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function MoneyMonthlyBreakdown({
  selectedYear,
  transactions,
}: MoneyMonthlyBreakdownProps) {
  const [open, setOpen] = useState(false);
  const [refunds, setRefunds] = useState<MoneyRefund[]>([]);
  const [refundLoadError, setRefundLoadError] = useState("");
  const [isLoadingRefunds, setIsLoadingRefunds] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadRefunds() {
      setIsLoadingRefunds(true);
      setRefundLoadError("");

      try {
        const response = await fetch(
          `/api/admin/money/refunds?year=${encodeURIComponent(selectedYear)}&limit=500`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const payload = (await response.json().catch(() => ({}))) as RefundApiResponse;

        if (!response.ok) {
          throw new Error(
            payload.message || payload.error || "Refund records could not be loaded.",
          );
        }

        setRefunds(Array.isArray(payload.refunds) ? payload.refunds : []);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;

        setRefunds([]);
        setRefundLoadError(
          error instanceof Error ? error.message : "Refund records could not be loaded.",
        );
      } finally {
        setIsLoadingRefunds(false);
      }
    }

    void loadRefunds();

    return () => controller.abort();
  }, [selectedYear]);

  const rows = useMemo(
    () => buildMonthRows(transactions || [], refunds || [], selectedYear),
    [transactions, refunds, selectedYear],
  );

  const totals = useMemo(() => buildTotals(rows), [rows]);

  const maxMonthValue = useMemo(
    () =>
      Math.max(
        1,
        ...rows.flatMap((row) => [
          Math.abs(row.generalIncome),
          Math.abs(row.generalOut),
          Math.abs(row.restrictedLeft),
          Math.abs(row.generalBalance),
          Math.abs(row.refundsReceivedBack),
          Math.abs(row.refundsSentBack),
        ]),
      ),
    [rows],
  );

  return (
    <section className="min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 sm:p-5">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-100 ring-1 ring-sky-300/20">
              <CalendarDays className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <h2 className="break-words text-2xl font-black text-white">
                Monthly Breakdown
              </h2>

              <p className="mt-2 max-w-4xl break-words text-sm leading-6 text-white/60">
                See monthly general income, spending, refunds and restricted
                funding for {selectedYear}. Personal funds only reduce the
                balance after they are marked as paid back.
              </p>

              <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-black text-white ring-1 ring-white/10 transition hover:bg-white/20"
              >
                {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {open ? "Hide monthly cards" : "Show monthly cards"}
              </button>
            </div>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:w-[930px] xl:grid-cols-3 2xl:grid-cols-6">
            <MetricCard
              title="Money Available Now"
              value={formatMoney(totals.generalBalance)}
              note="General money currently available"
              tone="sky"
              icon={<Wallet className="h-4 w-4" />}
            />
            <MetricCard
              title="Money In"
              value={formatMoney(totals.generalIncome)}
              note="General money received"
              tone="emerald"
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <MetricCard
              title="Money Out"
              value={formatMoney(totals.generalOut)}
              note={
                totals.unpaidPersonalFunds > 0
                  ? `${formatMoney(totals.unpaidPersonalFunds)} still needs paying back`
                  : "General payments made"
              }
              tone="red"
              icon={<TrendingDown className="h-4 w-4" />}
            />
            <MetricCard
              title="Refunds Received"
              value={formatMoney(totals.refundsReceivedBack)}
              note="Money returned to Burton Pride"
              tone="violet"
              icon={<RefreshCcw className="h-4 w-4" />}
            />
            <MetricCard
              title="Refunds Sent"
              value={formatMoney(totals.refundsSentBack)}
              note="Money refunded to someone else"
              tone="rose"
              icon={<RotateCcw className="h-4 w-4" />}
            />
            <MetricCard
              title="Restricted Money Left"
              value={formatMoney(totals.restrictedLeft)}
              note="Funding kept separate"
              tone="amber"
              icon={<LockKeyhole className="h-4 w-4" />}
            />
          </div>
        </div>

        <RefundError message={refundLoadError} />

        {isLoadingRefunds ? (
          <div className="flex items-center gap-2 text-xs font-bold text-sky-100/70">
            <RefreshCcw className="h-4 w-4 animate-spin" />
            Loading refund adjustments...
          </div>
        ) : null}
      </div>

      {open ? (
        <div className="mt-5 min-w-0">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {rows.map((row) => (
              <MonthCard key={row.key} row={row} maxMonthValue={maxMonthValue} />
            ))}
          </div>

          {totals.activityCount === 0 ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
              No monthly transaction or refund activity found for {selectedYear}.
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4 text-sm leading-6 text-sky-100/80">
            <div className="flex items-start gap-3">
              <Coins className="mt-0.5 h-5 w-5 shrink-0 text-sky-100" />
              <div>
                <p className="font-black text-sky-100">
                  How money available now is calculated
                </p>
                <p className="mt-1">
                  General money in minus general money out, plus completed
                  refunds received back, minus completed refunds sent back.
                  Restricted funding stays separate because it is not free
                  general money.
                </p>
              </div>
            </div>
          </div>

          {totals.refundCount > 0 ? (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-100/80">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-100" />
              <p>
                {totals.refundCount} completed refund
                {totals.refundCount === 1 ? "" : "s"} included in the monthly
                balance calculation for {selectedYear}.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
