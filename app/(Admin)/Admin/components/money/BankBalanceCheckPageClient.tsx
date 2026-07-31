"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  ShieldCheck,
} from "lucide-react";

import ManualBankBalanceCheck from "./ManualBankBalanceCheck";

const YEARS_BEFORE_CURRENT = 3;
const YEARS_AFTER_CURRENT = 3;

function getCurrentLocalYear() {
  return new Date().getFullYear();
}

function buildYearOptions(selectedYear: string) {
  const currentYear = getCurrentLocalYear();
  const selectedYearNumber = Number(selectedYear);

  const validSelectedYear =
    Number.isInteger(selectedYearNumber) &&
    selectedYearNumber >= 2000 &&
    selectedYearNumber <= 2100
      ? selectedYearNumber
      : currentYear;

  const firstYear = Math.min(
    currentYear - YEARS_BEFORE_CURRENT,
    validSelectedYear,
  );

  const lastYear = Math.max(
    currentYear + YEARS_AFTER_CURRENT,
    validSelectedYear,
  );

  return Array.from(
    { length: lastYear - firstYear + 1 },
    (_, index) => String(firstYear + index),
  );
}

export default function BankBalanceCheckPageClient() {
  /*
   * Lazy initialisation ensures the date is read only when this client
   * component state is created, rather than recalculating on every render.
   */
  const [selectedYear, setSelectedYear] = useState<string>(() =>
    String(getCurrentLocalYear()),
  );

  const yearSelectId = useId();

  const yearOptions = useMemo(
    () => buildYearOptions(selectedYear),
    [selectedYear],
  );

  function handleYearChange(value: string) {
    if (!/^\d{4}$/.test(value)) return;

    const year = Number(value);

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return;
    }

    setSelectedYear(value);
  }

  return (
    <main className="min-h-screen w-full max-w-none overflow-x-hidden bg-[#030412] px-2 py-2 text-slate-100">
      <div className="w-full max-w-none">
        <header className="w-full rounded-[22px] border border-white/10 bg-[#10101f] px-4 py-4 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <Link
                href="/Admin/MoneyManagement/TrackingMoney"
                className="inline-flex min-h-10 w-fit items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Back to money tracker
              </Link>

              <div className="flex flex-wrap items-center gap-2">
                <label
                  htmlFor={yearSelectId}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-bold text-slate-300"
                >
                  <CalendarDays
                    className="h-4 w-4 text-sky-300"
                    aria-hidden="true"
                  />

                  <span>Year</span>

                  <select
                    id={yearSelectId}
                    value={selectedYear}
                    onChange={(event) =>
                      handleYearChange(event.target.value)
                    }
                    aria-label="Bank balance check year"
                    className="rounded-lg border border-white/10 bg-[#10101f] px-3 py-1.5 text-xs font-bold text-white outline-none focus:border-sky-300/60 focus:ring-2 focus:ring-sky-300/20"
                  >
                    {yearOptions.map((year) => (
                      <option
                        key={year}
                        value={year}
                        className="bg-[#10101f] text-white"
                      >
                        {year}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="inline-flex min-h-10 w-fit items-center justify-center gap-2 rounded-xl border border-sky-400/20 bg-sky-500/10 px-4 py-2 text-xs font-bold text-sky-200">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Bank reconciliation tool
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
                <Banknote className="h-5 w-5" aria-hidden="true" />
              </div>

              <div className="min-w-0">
                <h1
                  id="bank-balance-check-title"
                  className="text-2xl font-bold tracking-tight text-white sm:text-3xl"
                >
                  Manual Bank Balance Check
                </h1>

                <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-400">
                  Compare the real bank statement balance with the balance
                  calculated by Burton Pride Money Management. Completed
                  refunds received back are included once, and every saved
                  check records who completed it.
                </p>
              </div>
            </div>
          </div>
        </header>

        <section
          className="mt-4 w-full"
          aria-labelledby="bank-balance-check-title"
        >
          <ManualBankBalanceCheck selectedYear={selectedYear} />
        </section>
      </div>
    </main>
  );
}