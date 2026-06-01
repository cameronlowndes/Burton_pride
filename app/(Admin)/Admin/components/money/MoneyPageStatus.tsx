"use client";

import {
  CircleAlert,
  FileText,
  Loader2,
  RefreshCcw,
  WalletCards,
  X,
} from "lucide-react";
import { useState } from "react";

import { monthNameFromKey } from "@/lib/money/utils";

type MoneyPageStatusProps = {
  error: string;
  errorDetails: unknown;

  selectedYear: string;
  selectedViewMonth: string;

  filteredTransactionsLength: number;
  yearTransactionsLength: number;

  /**
   * Refund values are optional so this component continues working while
   * the refund integration is being added to the main money hook.
   */
  filteredRefundsLength?: number;
  yearRefundsLength?: number;
  completedRefundsLength?: number;

  refundsLoading?: boolean;
  refundsError?: string;
  refundsErrorDetails?: unknown;
};

function stringifyDetails(details: unknown) {
  if (details === undefined || details === null) {
    return "";
  }

  if (typeof details === "string") {
    return details;
  }

  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
}

function getSelectedPeriodLabel({
  selectedYear,
  selectedViewMonth,
}: {
  selectedYear: string;
  selectedViewMonth: string;
}) {
  if (selectedViewMonth === "all") {
    return `Jan to Dec ${selectedYear}`;
  }

  return `${monthNameFromKey(selectedViewMonth)} ${selectedYear}`;
}

function ErrorPanel({
  title,
  message,
  details,
  onDismiss,
}: {
  title: string;
  message: string;
  details?: unknown;
  onDismiss: () => void;
}) {
  const serverDetails = stringifyDetails(details);

  return (
    <section className="rounded-3xl border border-red-400/30 bg-red-500/10 p-5 shadow-2xl shadow-black/20">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-red-300/20 bg-red-500/10 text-red-100">
          <CircleAlert className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-red-100">
                {title}
              </h2>

              <p className="mt-2 break-words text-sm leading-6 text-red-100/90">
                {message}
              </p>
            </div>

            <button
              type="button"
              onClick={onDismiss}
              className="rounded-xl border border-red-300/20 bg-red-500/10 p-2 text-red-100 transition hover:bg-red-500/20"
              aria-label="Dismiss error message"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {serverDetails ? (
            <details className="mt-4 overflow-hidden rounded-2xl border border-red-300/20 bg-black/20">
              <summary className="cursor-pointer px-4 py-3 text-xs font-black uppercase tracking-wide text-red-100">
                Show technical details
              </summary>

              <pre className="max-h-80 overflow-auto border-t border-red-300/10 bg-black/30 p-4 text-xs leading-5 text-red-100">
                {serverDetails}
              </pre>
            </details>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default function MoneyPageStatus({
  error,
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
  const [hideTransactionError, setHideTransactionError] =
    useState(false);

  const [hideRefundError, setHideRefundError] = useState(false);

  const periodLabel = getSelectedPeriodLabel({
    selectedYear,
    selectedViewMonth,
  });

  const visibleActivityCount =
    filteredTransactionsLength + filteredRefundsLength;

  const yearActivityCount =
    yearTransactionsLength + yearRefundsLength;

  return (
    <div className="space-y-4">
      {error && !hideTransactionError ? (
        <ErrorPanel
          title="Money tracker error"
          message={error}
          details={errorDetails}
          onDismiss={() => setHideTransactionError(true)}
        />
      ) : null}

      {refundsError && !hideRefundError ? (
        <ErrorPanel
          title="Refund records could not be loaded"
          message={refundsError}
          details={refundsErrorDetails}
          onDismiss={() => setHideRefundError(true)}
        />
      ) : null}

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm font-black text-white">
              Showing money tracker for {periodLabel}
            </p>

            <p className="mt-1 max-w-3xl text-xs leading-5 text-white/50">
              Normal transactions and refunds are displayed together for
              visibility. Refunds remain recorded separately so they do not
              look like ordinary income or expenses.
            </p>
          </div>

          {refundsLoading ? (
            <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-sky-300/20 bg-sky-500/10 px-3 py-2 text-xs font-bold text-sky-100">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading refunds...
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-white/50">
              <WalletCards className="h-4 w-4" />
              Visible transactions
            </div>

            <p className="mt-2 text-xl font-black text-white">
              {filteredTransactionsLength}
            </p>

            <p className="mt-1 text-xs leading-5 text-white/45">
              {yearTransactionsLength} normal transaction
              {yearTransactionsLength === 1 ? "" : "s"} saved for the full
              year.
            </p>
          </div>

          <div className="rounded-2xl border border-violet-300/20 bg-violet-500/10 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-violet-100/80">
              <RefreshCcw className="h-4 w-4" />
              Visible refunds
            </div>

            <p className="mt-2 text-xl font-black text-white">
              {filteredRefundsLength}
            </p>

            <p className="mt-1 text-xs leading-5 text-violet-100/70">
              {yearRefundsLength} refund
              {yearRefundsLength === 1 ? "" : "s"} saved for the full year.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-emerald-100/80">
              <FileText className="h-4 w-4" />
              Completed refunds
            </div>

            <p className="mt-2 text-xl font-black text-white">
              {completedRefundsLength}
            </p>

            <p className="mt-1 text-xs leading-5 text-emerald-100/70">
              Only completed refunds adjust the available Burton Pride
              balance.
            </p>
          </div>

          <div className="rounded-2xl border border-sky-300/20 bg-sky-500/10 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-sky-100/80">
              <FileText className="h-4 w-4" />
              Total visible activity
            </div>

            <p className="mt-2 text-xl font-black text-white">
              {visibleActivityCount}
            </p>

            <p className="mt-1 text-xs leading-5 text-sky-100/70">
              {yearActivityCount} combined record
              {yearActivityCount === 1 ? "" : "s"} saved for the full year.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}