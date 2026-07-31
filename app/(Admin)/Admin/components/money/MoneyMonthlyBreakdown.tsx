"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
  id?: string | null;
  created_at?: string | null;
  transaction_date?: string | null;
  title?: string | null;
  description?: string | null;
  type?: "income" | "expense" | string | null;
  category?: string | null;
  amount_pence?: number | string | null;
  payment_method?: string | null;
  sponsor_id?: string | null;
  sponsor_name?: string | null;
  sponsorship_note?: string | null;
  funding_type?: string | null;
  source?: string | null;
  is_personal_funds?: boolean | number | string | null;
  personal_funds_repaid?: boolean | number | string | null;
  deleted_at?: string | null;
};

type RefundType = "money_received_back" | "money_sent_back";
type RefundStatus = "pending" | "completed" | "cancelled";

type MoneyRefund = {
  id: string;
  year?: number | string | null;
  refund_date?: string | null;
  refund_type: RefundType;
  amount_pence: number | string | null;
  title: string;
  notes?: string | null;
  status: RefundStatus | string;
  is_hidden?: boolean | number | string | null;
  created_at?: string | null;
};

type RefundApiResponse = {
  success?: boolean;
  refunds?: unknown;
  message?: string;
  error?: string;
  details?: unknown;
};

type MoneyMonthlyBreakdownProps = {
  selectedYear: string;
  transactions: MoneyTransaction[];
  refundLimit?: number;
};

type MonthInfo = {
  key: string;
  shortLabel: string;
  longLabel: string;
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

const DEFAULT_REFUND_LIMIT = 500;

const MONTHS: MonthInfo[] = [
  { key: "01", shortLabel: "Jan", longLabel: "January" },
  { key: "02", shortLabel: "Feb", longLabel: "February" },
  { key: "03", shortLabel: "Mar", longLabel: "March" },
  { key: "04", shortLabel: "Apr", longLabel: "April" },
  { key: "05", shortLabel: "May", longLabel: "May" },
  { key: "06", shortLabel: "Jun", longLabel: "June" },
  { key: "07", shortLabel: "Jul", longLabel: "July" },
  { key: "08", shortLabel: "Aug", longLabel: "August" },
  { key: "09", shortLabel: "Sep", longLabel: "September" },
  { key: "10", shortLabel: "Oct", longLabel: "October" },
  { key: "11", shortLabel: "Nov", longLabel: "November" },
  { key: "12", shortLabel: "Dec", longLabel: "December" },
];

const toneClasses: Record<Tone, { card: string; bar: string }> = {
  emerald: {
    card: "border-emerald-300/20 bg-emerald-500/10 text-emerald-100",
    bar: "bg-emerald-400",
  },
  red: {
    card: "border-red-300/20 bg-red-500/10 text-red-100",
    bar: "bg-red-400",
  },
  amber: {
    card: "border-amber-300/20 bg-amber-500/10 text-amber-100",
    bar: "bg-amber-400",
  },
  sky: {
    card: "border-sky-300/20 bg-sky-500/10 text-sky-100",
    bar: "bg-sky-400",
  },
  violet: {
    card: "border-violet-300/20 bg-violet-500/10 text-violet-100",
    bar: "bg-violet-400",
  },
  rose: {
    card: "border-rose-300/20 bg-rose-500/10 text-rose-100",
    bar: "bg-rose-400",
  },
};

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function lower(value: unknown): string {
  return cleanText(value).toLowerCase();
}

function readBoolean(value: unknown): boolean {
  if (value === true || value === 1) return true;
  const normalised = lower(value);
  return normalised === "true" || normalised === "1" || normalised === "yes";
}

function safePence(value: unknown): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function formatMoney(value: unknown): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(safePence(value) / 100);
}

function normaliseRefundLimit(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_REFUND_LIMIT;
  return Math.max(1, Math.min(5000, Math.floor(parsed)));
}

function parseDateValue(value: unknown): Date | null {
  const text = cleanText(value);
  if (!text) return null;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getDateValue(item: MoneyTransaction | MoneyRefund): string {
  if ("refund_type" in item) {
    return cleanText(item.refund_date) || cleanText(item.created_at);
  }

  return cleanText(item.transaction_date) || cleanText(item.created_at);
}

function getYear(item: MoneyTransaction | MoneyRefund): string {
  const parsed = parseDateValue(getDateValue(item));
  return parsed ? String(parsed.getFullYear()) : "";
}

function getMonth(item: MoneyTransaction | MoneyRefund): string {
  const parsed = parseDateValue(getDateValue(item));
  return parsed ? String(parsed.getMonth() + 1).padStart(2, "0") : "";
}

function isDeleted(item: MoneyTransaction): boolean {
  return cleanText(item.deleted_at).length > 0;
}

function hasRestrictedFunding(item: MoneyTransaction): boolean {
  const source = lower(item.source);
  const category = lower(item.category);
  const fundingType = lower(item.funding_type);

  return Boolean(
    cleanText(item.sponsor_id) ||
      cleanText(item.sponsor_name) ||
      cleanText(item.sponsorship_note) ||
      ["sponsor", "sponsorship", "grant", "restricted", "restricted funding"].includes(
        source,
      ) ||
      ["sponsor", "sponsorship", "grant", "restricted", "restricted funding"].includes(
        category,
      ) ||
      ["sponsor", "sponsorship", "grant", "restricted", "restricted funding"].includes(
        fundingType,
      )
  );
}

function isPersonalFunds(item: MoneyTransaction): boolean {
  return (
    readBoolean(item.is_personal_funds) ||
    lower(item.payment_method) === "personal funds"
  );
}

function isPersonalFundsRepaid(item: MoneyTransaction): boolean {
  return readBoolean(item.personal_funds_repaid);
}

function isCompletedVisibleRefund(item: MoneyRefund): boolean {
  return lower(item.status) === "completed" && !readBoolean(item.is_hidden);
}

function isMoneyRefund(value: unknown): value is MoneyRefund {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<MoneyRefund>;

  return Boolean(
    cleanText(item.id) &&
      ["money_received_back", "money_sent_back"].includes(
        cleanText(item.refund_type),
      )
  );
}

function emptyMonthRow(selectedYear: string, month: MonthInfo): MonthRow {
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
): MonthRow[] {
  return MONTHS.map((month) => {
    const row = emptyMonthRow(selectedYear, month);

    const monthTransactions = transactions.filter(
      (item) =>
        !isDeleted(item) &&
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
      const amount = safePence(item.amount_pence);
      if (amount === 0) continue;

      const restricted = hasRestrictedFunding(item);
      const personal = isPersonalFunds(item);
      const repaidPersonal = isPersonalFundsRepaid(item);
      const type = lower(item.type);

      if (type === "income") {
        row.moneyIn += amount;
        if (restricted) row.restrictedIncome += amount;
        else row.generalIncome += amount;
        continue;
      }

      if (type === "expense") {
        row.moneyOut += amount;

        if (restricted) {
          row.restrictedSpent += amount;
        } else if (personal && !repaidPersonal) {
          row.unpaidPersonalFunds += amount;
        } else {
          row.generalOut += amount;
        }
      }
    }

    for (const refund of monthRefunds) {
      const amount = safePence(refund.amount_pence);
      if (amount === 0) continue;

      if (refund.refund_type === "money_received_back") {
        row.refundsReceivedBack += amount;
      } else if (refund.refund_type === "money_sent_back") {
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
  const total = emptyMonthRow("total", {
    key: "all",
    shortLabel: "Total",
    longLabel: "Total",
  });

  for (const row of rows) {
    total.moneyIn += row.moneyIn;
    total.moneyOut += row.moneyOut;
    total.restrictedIncome += row.restrictedIncome;
    total.restrictedSpent += row.restrictedSpent;
    total.generalIncome += row.generalIncome;
    total.generalOut += row.generalOut;
    total.refundsReceivedBack += row.refundsReceivedBack;
    total.refundsSentBack += row.refundsSentBack;
    total.unpaidPersonalFunds += row.unpaidPersonalFunds;
    total.transactionCount += row.transactionCount;
    total.refundCount += row.refundCount;
    total.activityCount += row.activityCount;
  }

  total.restrictedLeft = total.restrictedIncome - total.restrictedSpent;
  total.generalBalanceBeforeRefunds = total.generalIncome - total.generalOut;
  total.generalBalance =
    total.generalBalanceBeforeRefunds +
    total.refundsReceivedBack -
    total.refundsSentBack;

  return total;
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
  const safeMax = Math.max(0, safePence(max));
  const absoluteValue = Math.abs(safePence(value));
  const percent = safeMax > 0 ? Math.min(100, (absoluteValue / safeMax) * 100) : 0;

  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="break-words text-white/60">{label}</span>
        <span className="shrink-0 font-bold text-white/75">
          {formatMoney(value)}
        </span>
      </div>

      <div
        className="h-2 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        aria-valuetext={formatMoney(value)}
      >
        <div
          className={`h-full rounded-full transition-[width] ${toneClasses[tone].bar}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function RefundError({ message }: { message: string }) {
  if (!message) return null;

  return (
    <div
      className="flex items-start gap-3 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
      role="alert"
    >
      <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
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
    <article
      className={`min-w-0 rounded-2xl border p-4 ${
        hasActivity ? "border-white/10 bg-black/25" : "border-white/5 bg-black/10"
      }`}
      aria-label={`${row.longLabel} money summary`}
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
    </article>
  );
}

export default function MoneyMonthlyBreakdown({
  selectedYear,
  transactions,
  refundLimit = DEFAULT_REFUND_LIMIT,
}: MoneyMonthlyBreakdownProps) {
  const [open, setOpen] = useState(false);
  const [refunds, setRefunds] = useState<MoneyRefund[]>([]);
  const [refundLoadError, setRefundLoadError] = useState("");
  const [isLoadingRefunds, setIsLoadingRefunds] = useState(false);
  const requestIdRef = useRef(0);
  const contentId = useId();

  const cleanSelectedYear = cleanText(selectedYear);
  const yearIsValid = /^\d{4}$/.test(cleanSelectedYear);
  const safeRefundLimit = normaliseRefundLimit(refundLimit);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();

    if (!yearIsValid) {
      setRefunds([]);
      setRefundLoadError(
        cleanSelectedYear.toLowerCase() === "all"
          ? "Choose a single year to load monthly refund adjustments."
          : "The selected year is invalid.",
      );
      setIsLoadingRefunds(false);
      return () => controller.abort();
    }

    async function loadRefunds() {
      setIsLoadingRefunds(true);
      setRefundLoadError("");

      try {
        const response = await fetch(
          `/api/admin/money/refunds?year=${encodeURIComponent(cleanSelectedYear)}&limit=${safeRefundLimit}`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
            headers: { Accept: "application/json" },
          },
        );

        const contentType = response.headers.get("content-type") || "";
        const payload = contentType.includes("application/json")
          ? ((await response.json()) as RefundApiResponse)
          : ({
              error: `Refund API returned ${response.status} ${response.statusText || "without JSON"}.`,
            } satisfies RefundApiResponse);

        if (!response.ok) {
          throw new Error(
            cleanText(payload.message) ||
              cleanText(payload.error) ||
              `Refund records could not be loaded (${response.status}).`,
          );
        }

        if (requestId !== requestIdRef.current) return;

        const refundRows = Array.isArray(payload.refunds)
          ? payload.refunds.filter(isMoneyRefund)
          : [];

        setRefunds(refundRows);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (requestId !== requestIdRef.current) return;

        setRefunds([]);
        setRefundLoadError(
          error instanceof Error
            ? error.message
            : "Refund records could not be loaded.",
        );
      } finally {
        if (requestId === requestIdRef.current && !controller.signal.aborted) {
          setIsLoadingRefunds(false);
        }
      }
    }

    void loadRefunds();

    return () => controller.abort();
  }, [cleanSelectedYear, safeRefundLimit, yearIsValid]);

  const safeTransactions = Array.isArray(transactions) ? transactions : [];

  const rows = useMemo(
    () =>
      yearIsValid
        ? buildMonthRows(safeTransactions, refunds, cleanSelectedYear)
        : MONTHS.map((month) => emptyMonthRow(cleanSelectedYear || "invalid", month)),
    [safeTransactions, refunds, cleanSelectedYear, yearIsValid],
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
          Math.abs(row.refundsReceivedBack),
          Math.abs(row.refundsSentBack),
        ]),
      ),
    [rows],
  );

  return (
    <section
      className="min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 sm:p-5"
      aria-labelledby={`${contentId}-title`}
    >
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-100 ring-1 ring-sky-300/20">
              <CalendarDays className="h-5 w-5" aria-hidden="true" />
            </div>

            <div className="min-w-0">
              <h2
                id={`${contentId}-title`}
                className="break-words text-2xl font-black text-white"
              >
                Monthly Breakdown
              </h2>

              <p className="mt-2 max-w-4xl break-words text-sm leading-6 text-white/60">
                See monthly general income, spending, refunds and restricted
                funding for {cleanSelectedYear || "the selected year"}. Personal
                funds only reduce the balance after they are marked as paid back.
              </p>

              <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                aria-expanded={open}
                aria-controls={`${contentId}-monthly-cards`}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-black text-white ring-1 ring-white/10 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                {open ? (
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                )}
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
              icon={<Wallet className="h-4 w-4" aria-hidden="true" />}
            />
            <MetricCard
              title="Money In"
              value={formatMoney(totals.generalIncome)}
              note="General money received"
              tone="emerald"
              icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
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
              icon={<TrendingDown className="h-4 w-4" aria-hidden="true" />}
            />
            <MetricCard
              title="Refunds Received"
              value={formatMoney(totals.refundsReceivedBack)}
              note="Money returned to Burton Pride"
              tone="violet"
              icon={<RefreshCcw className="h-4 w-4" aria-hidden="true" />}
            />
            <MetricCard
              title="Refunds Sent"
              value={formatMoney(totals.refundsSentBack)}
              note="Money refunded to someone else"
              tone="rose"
              icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}
            />
            <MetricCard
              title="Restricted Money Left"
              value={formatMoney(totals.restrictedLeft)}
              note="Funding kept separate"
              tone="amber"
              icon={<LockKeyhole className="h-4 w-4" aria-hidden="true" />}
            />
          </div>
        </div>

        <RefundError message={refundLoadError} />

        {isLoadingRefunds ? (
          <div
            className="flex items-center gap-2 text-xs font-bold text-sky-100/70"
            role="status"
            aria-live="polite"
          >
            <RefreshCcw className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading refund adjustments...
          </div>
        ) : null}
      </div>

      {open ? (
        <div id={`${contentId}-monthly-cards`} className="mt-5 min-w-0">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {rows.map((row) => (
              <MonthCard key={row.key} row={row} maxMonthValue={maxMonthValue} />
            ))}
          </div>

          {totals.activityCount === 0 ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
              No monthly transaction or refund activity found for {cleanSelectedYear || "the selected year"}.
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4 text-sm leading-6 text-sky-100/80">
            <div className="flex items-start gap-3">
              <Coins className="mt-0.5 h-5 w-5 shrink-0 text-sky-100" aria-hidden="true" />
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
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-100" aria-hidden="true" />
              <p>
                {totals.refundCount} completed refund
                {totals.refundCount === 1 ? "" : "s"} included in the monthly
                balance calculation for {cleanSelectedYear}.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
