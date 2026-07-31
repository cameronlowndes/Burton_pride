"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  FileText,
  Loader2,
  RefreshCcw,
  WalletCards,
  X,
} from "lucide-react";

import { monthNameFromKey } from "@/lib/money/utils";

type MoneyPageStatusProps = {
  error?: string | null;
  errorDetails?: unknown;

  selectedYear: string;
  selectedViewMonth: string;

  filteredTransactionsLength: number;
  yearTransactionsLength: number;

  filteredRefundsLength?: number;
  yearRefundsLength?: number;
  completedRefundsLength?: number;

  refundsLoading?: boolean;
  refundsError?: string | null;
  refundsErrorDetails?: unknown;
};

type ErrorPanelProps = {
  title: string;
  message: string;
  details?: unknown;
  onDismiss: () => void;
};

type StatusTone = "default" | "refund" | "success" | "total";
type StatusIconName = "transactions" | "refunds" | "completed" | "total";

type StatusCardProps = {
  title: string;
  value: number;
  description: string;
  tone: StatusTone;
  icon: StatusIconName;
};

const CARD_TONE_CLASSES: Record<
  StatusTone,
  { card: string; text: string }
> = {
  default: {
    card: "border-white/10 bg-black/20",
    text: "text-white/50",
  },
  refund: {
    card: "border-violet-300/20 bg-violet-500/10",
    text: "text-violet-100/80",
  },
  success: {
    card: "border-emerald-300/20 bg-emerald-500/10",
    text: "text-emerald-100/80",
  },
  total: {
    card: "border-sky-300/20 bg-sky-500/10",
    text: "text-sky-100/80",
  },
};

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function safeCount(value: unknown): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.floor(parsed));
}

function stringifyDetails(details: unknown): string {
  if (details === undefined || details === null || details === "") {
    return "";
  }

  if (typeof details === "string") {
    return details.trim();
  }

  if (details instanceof Error) {
    return JSON.stringify(
      {
        name: details.name,
        message: details.message,
        stack: details.stack,
      },
      null,
      2,
    );
  }

  try {
    return JSON.stringify(details, null, 2);
  } catch {
    try {
      return String(details);
    } catch {
      return "Technical details could not be displayed.";
    }
  }
}

function getPeriodLabel(
  selectedYear: string,
  selectedViewMonth: string,
): string {
  const year = cleanText(selectedYear);
  const month = cleanText(selectedViewMonth).toLowerCase();

  if (!year && (!month || month === "all")) {
    return "all available dates";
  }

  if (!month || month === "all") {
    return year.toLowerCase() === "all"
      ? "all years"
      : `Jan to Dec ${year || "selected year"}`;
  }

  const monthName = cleanText(monthNameFromKey(month)) || `Month ${month}`;

  if (!year || year.toLowerCase() === "all") {
    return `${monthName} across all years`;
  }

  return `${monthName} ${year}`;
}

function plural(value: number, singular: string, pluralWord?: string): string {
  const safeValue = safeCount(value);
  const label =
    safeValue === 1 ? singular : pluralWord ?? `${singular}s`;

  return `${safeValue} ${label}`;
}

function StatusIcon({ icon }: { icon: StatusIconName }) {
  if (icon === "refunds") {
    return <RefreshCcw className="h-4 w-4" aria-hidden="true" />;
  }

  if (icon === "transactions") {
    return <WalletCards className="h-4 w-4" aria-hidden="true" />;
  }

  if (icon === "completed") {
    return <CheckCircle2 className="h-4 w-4" aria-hidden="true" />;
  }

  return <FileText className="h-4 w-4" aria-hidden="true" />;
}

function ErrorPanel({ title, message, details, onDismiss }: ErrorPanelProps) {
  const technicalDetails = useMemo(
    () => stringifyDetails(details),
    [details],
  );

  return (
    <section
      role="alert"
      aria-live="assertive"
      className="rounded-3xl border border-red-400/30 bg-red-500/10 p-5 shadow-2xl shadow-black/20"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-red-300/20 bg-red-500/10 text-red-100">
          <CircleAlert className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="break-words text-base font-black text-red-100">
                {title}
              </h2>

              <p className="mt-2 break-words text-sm leading-6 text-red-100/90">
                {message}
              </p>
            </div>

            <button
              type="button"
              onClick={onDismiss}
              className="shrink-0 rounded-xl border border-red-300/20 bg-red-500/10 p-2 text-red-100 transition hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
              aria-label={`Dismiss ${title}`}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {technicalDetails ? (
            <details className="mt-4 overflow-hidden rounded-2xl border border-red-300/20 bg-black/20">
              <summary className="cursor-pointer px-4 py-3 text-xs font-black uppercase tracking-wide text-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-300">
                Show technical details
              </summary>

              <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words border-t border-red-300/10 bg-black/30 p-4 text-xs leading-5 text-red-100">
                {technicalDetails}
              </pre>
            </details>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function StatusCard({
  title,
  value,
  description,
  tone,
  icon,
}: StatusCardProps) {
  const classes = CARD_TONE_CLASSES[tone];
  const safeValue = safeCount(value);

  return (
    <article className={`rounded-2xl border px-4 py-3 ${classes.card}`}>
      <div
        className={`flex items-center gap-2 text-xs font-black uppercase tracking-wide ${classes.text}`}
      >
        <StatusIcon icon={icon} />
        <span className="break-words">{title}</span>
      </div>

      <p className="mt-2 text-xl font-black text-white">{safeValue}</p>

      <p className={`mt-1 break-words text-xs leading-5 ${classes.text}`}>
        {description}
      </p>
    </article>
  );
}

export default function MoneyPageStatus({
  error = "",
  errorDetails,

  selectedYear,
  selectedViewMonth,

  filteredTransactionsLength,
  yearTransactionsLength,

  filteredRefundsLength = 0,
  yearRefundsLength = 0,
  completedRefundsLength = 0,

  refundsLoading = false,
  refundsError = "",
  refundsErrorDetails,
}: MoneyPageStatusProps) {
  const transactionError = cleanText(error);
  const refundError = cleanText(refundsError);

  const [dismissedTransactionError, setDismissedTransactionError] =
    useState<string>("");
  const [dismissedRefundError, setDismissedRefundError] =
    useState<string>("");

  useEffect(() => {
    if (!transactionError) {
      setDismissedTransactionError("");
    }
  }, [transactionError]);

  useEffect(() => {
    if (!refundError) {
      setDismissedRefundError("");
    }
  }, [refundError]);

  const safeFilteredTransactions = safeCount(filteredTransactionsLength);
  const safeYearTransactions = safeCount(yearTransactionsLength);
  const safeFilteredRefunds = safeCount(filteredRefundsLength);
  const safeYearRefunds = safeCount(yearRefundsLength);
  const safeCompletedRefunds = Math.min(
    safeYearRefunds,
    safeCount(completedRefundsLength),
  );

  const periodLabel = getPeriodLabel(selectedYear, selectedViewMonth);
  const visibleActivityCount =
    safeFilteredTransactions + safeFilteredRefunds;
  const yearActivityCount = safeYearTransactions + safeYearRefunds;

  const showTransactionError =
    Boolean(transactionError) &&
    dismissedTransactionError !== transactionError;

  const showRefundError =
    Boolean(refundError) && dismissedRefundError !== refundError;

  return (
    <div className="space-y-4">
      {showTransactionError ? (
        <ErrorPanel
          title="Money tracker error"
          message={transactionError}
          details={errorDetails}
          onDismiss={() =>
            setDismissedTransactionError(transactionError)
          }
        />
      ) : null}

      {showRefundError ? (
        <ErrorPanel
          title="Refund records could not be loaded"
          message={refundError}
          details={refundsErrorDetails}
          onDismiss={() => setDismissedRefundError(refundError)}
        />
      ) : null}

      <section
        aria-labelledby="money-page-status-title"
        className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20"
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p
              id="money-page-status-title"
              className="break-words text-sm font-black text-white"
            >
              Showing money tracker for {periodLabel}
            </p>

            <p className="mt-1 max-w-3xl text-xs leading-5 text-white/50">
              Transactions and refunds are shown together for visibility.
              Refunds are still recorded separately so they do not look like
              ordinary income or spending.
            </p>
          </div>

          {refundsLoading ? (
            <div
              role="status"
              aria-live="polite"
              className="inline-flex w-fit items-center gap-2 rounded-xl border border-sky-300/20 bg-sky-500/10 px-3 py-2 text-xs font-bold text-sky-100"
            >
              <Loader2
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              Loading refunds...
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatusCard
            title="Visible transactions"
            value={safeFilteredTransactions}
            description={`${plural(
              safeYearTransactions,
              "normal transaction",
            )} saved for the full year.`}
            tone="default"
            icon="transactions"
          />

          <StatusCard
            title="Visible refunds"
            value={safeFilteredRefunds}
            description={`${plural(
              safeYearRefunds,
              "refund",
            )} saved for the full year.`}
            tone="refund"
            icon="refunds"
          />

          <StatusCard
            title="Completed refunds"
            value={safeCompletedRefunds}
            description="Only completed refunds adjust the available Burton Pride balance."
            tone="success"
            icon="completed"
          />

          <StatusCard
            title="Total visible activity"
            value={visibleActivityCount}
            description={`${plural(
              yearActivityCount,
              "combined record",
            )} saved for the full year.`}
            tone="total"
            icon="total"
          />
        </div>
      </section>
    </div>
  );
}
