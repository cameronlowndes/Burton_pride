"use client";

import { monthNameFromKey } from "@/lib/money/utils";

type MoneyPageStatusProps = {
  error: string;
  errorDetails: any;
  selectedYear: string;
  selectedViewMonth: string;
  filteredTransactionsLength: number;
  yearTransactionsLength: number;
};

export default function MoneyPageStatus({
  error,
  errorDetails,
  selectedYear,
  selectedViewMonth,
  filteredTransactionsLength,
  yearTransactionsLength,
}: MoneyPageStatusProps) {
  return (
    <>
      {error && (
        <section className="rounded-3xl border border-red-400/30 bg-red-500/10 p-5">
          <div className="font-bold text-red-100">Error</div>

          <p className="mt-2 text-sm text-red-100">{error}</p>

          {errorDetails && (
            <pre className="mt-4 max-h-80 overflow-auto rounded-2xl bg-black/40 p-4 text-xs text-red-100">
              {JSON.stringify(errorDetails, null, 2)}
            </pre>
          )}
        </section>
      )}

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
        <p className="text-sm font-bold text-white">
          Showing money tracker for{" "}
          {selectedViewMonth === "all"
            ? `Jan to Dec ${selectedYear}`
            : monthNameFromKey(selectedViewMonth)}
        </p>

        <p className="mt-1 text-xs text-white/50">
          {filteredTransactionsLength} transaction
          {filteredTransactionsLength === 1 ? "" : "s"} showing.{" "}
          {yearTransactionsLength} saved for the full year.
        </p>
      </section>
    </>
  );
}