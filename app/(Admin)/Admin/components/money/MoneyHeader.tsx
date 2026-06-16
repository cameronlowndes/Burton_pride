"use client";

import { RefreshCcw } from "lucide-react";

type MoneyHeaderProps = {
  selectedYear: string;
  yearOptions: string[];
  onYearChange: (year: string) => void;
  onRefresh: () => void;
};

export default function MoneyHeader({
  selectedYear,
  yearOptions,
  onYearChange,
  onRefresh,
}: MoneyHeaderProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-black text-white sm:text-3xl">
            Money Tracker
          </h1>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-white/60">
            Track Burton Pride money in, money out, personal funds, sponsorship,
            grants, loans and yearly totals.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
          <div className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 sm:w-56">
            <label
              htmlFor="money-tracker-year"
              className="mb-1 block text-xs font-black uppercase tracking-wide text-white/50"
            >
              Tracker Year
            </label>

            <select
              id="money-tracker-year"
              value={selectedYear}
              onChange={(event) => onYearChange(event.target.value)}
              className="w-full bg-transparent text-sm font-bold text-white outline-none"
            >
              {yearOptions.map((year) => (
                <option
                  key={year}
                  value={year}
                  className="bg-[#11111f] text-white"
                >
                  Jan to Dec {year}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/20"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>
    </section>
  );
}