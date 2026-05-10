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
          <h1 className="break-words text-2xl font-bold sm:text-3xl">
            Money Tracker
          </h1>

          <p className="text-sm text-white/60">
            Track donations, spending, personal funds, and sponsorship money by
            year.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-2">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-white/50">
              Tracker Year
            </label>

            <select
              value={selectedYear}
              onChange={(e) => onYearChange(e.target.value)}
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
            className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/20"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>
    </section>
  );
}