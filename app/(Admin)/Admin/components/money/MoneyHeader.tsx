"use client";

import { useMemo, type ChangeEvent } from "react";
import { Loader2, RefreshCcw } from "lucide-react";

type MoneyHeaderProps = {
  selectedYear: string;
  yearOptions: string[];
  onYearChange: (year: string) => void;
  onRefresh: () => void | Promise<void>;
  refreshing?: boolean;
};

function cleanYear(value: unknown): string {
  return String(value ?? "").trim();
}

function yearLabel(year: string): string {
  if (year.toLowerCase() === "all") {
    return "All years";
  }

  return `Jan to Dec ${year}`;
}

export default function MoneyHeader({
  selectedYear,
  yearOptions,
  onYearChange,
  onRefresh,
  refreshing = false,
}: MoneyHeaderProps) {
  const cleanSelectedYear = cleanYear(selectedYear);

  const availableYears = useMemo(() => {
    const uniqueYears = new Set<string>();

    for (const value of yearOptions) {
      const year = cleanYear(value);

      if (year) {
        uniqueYears.add(year);
      }
    }

    if (cleanSelectedYear) {
      uniqueYears.add(cleanSelectedYear);
    }

    return Array.from(uniqueYears).sort((a, b) => {
      if (a.toLowerCase() === "all") return -1;
      if (b.toLowerCase() === "all") return 1;

      const aNumber = Number(a);
      const bNumber = Number(b);

      if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
        return bNumber - aNumber;
      }

      return a.localeCompare(b);
    });
  }, [yearOptions, cleanSelectedYear]);

  function handleYearChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextYear = cleanYear(event.target.value);

    if (!nextYear || nextYear === cleanSelectedYear) {
      return;
    }

    onYearChange(nextYear);
  }

  async function handleRefresh() {
    if (refreshing) {
      return;
    }

    await onRefresh();
  }

  const noYearsAvailable = availableYears.length === 0;

  return (
    <section
      className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur sm:p-6"
      aria-labelledby="money-tracker-title"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1
            id="money-tracker-title"
            className="break-words text-2xl font-black text-white sm:text-3xl"
          >
            Money Tracker
          </h1>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-white/60">
            Track Burton Pride money in, money out, personal funds,
            sponsorship, grants, loans and yearly totals.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
          <div className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 sm:w-56">
            <label
              htmlFor="money-tracker-year"
              className="mb-1 block text-xs font-black uppercase tracking-wide text-white/50"
            >
              Tracker year
            </label>

            <select
              id="money-tracker-year"
              value={noYearsAvailable ? "" : cleanSelectedYear}
              onChange={handleYearChange}
              disabled={noYearsAvailable || refreshing}
              className="w-full rounded-lg bg-transparent px-1 py-1 text-sm font-bold text-white outline-none transition focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {noYearsAvailable ? (
                <option value="" className="bg-[#11111f] text-white">
                  No years available
                </option>
              ) : (
                availableYears.map((year) => (
                  <option
                    key={year}
                    value={year}
                    className="bg-[#11111f] text-white"
                  >
                    {yearLabel(year)}
                  </option>
                ))
              )}
            </select>
          </div>

          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            aria-busy={refreshing}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? (
              <Loader2
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            )}

            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>
    </section>
  );
}