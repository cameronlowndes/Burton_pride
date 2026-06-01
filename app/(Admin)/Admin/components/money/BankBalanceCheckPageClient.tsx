"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  ShieldCheck,
} from "lucide-react";

import ManualBankBalanceCheck from "./ManualBankBalanceCheck";

function buildYearOptions() {
  const currentYear = new Date().getFullYear();

  return Array.from({ length: 7 }, (_, index) =>
    String(currentYear - 3 + index),
  );
}

export default function BankBalanceCheckPageClient() {
  const yearOptions = useMemo(() => buildYearOptions(), []);

  const [selectedYear, setSelectedYear] = useState(
    String(new Date().getFullYear()),
  );

  return (
    <main className="min-h-screen bg-[#030412] px-2 py-2 text-slate-100">
      <div className="w-full">
        <header className="rounded-[22px] border border-white/10 bg-[#10101f] px-4 py-4 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <Link
                href="/Admin/MoneyManagement/TrackingMoney"
                className="inline-flex min-h-8 w-fit items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-white/15 hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to money tracker
              </Link>

              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-bold text-slate-300">
                  <CalendarDays className="h-4 w-4 text-sky-300" />

                  <span>Year</span>

                  <select
                    value={selectedYear}
                    onChange={(event) => setSelectedYear(event.target.value)}
                    className="rounded-lg border border-white/10 bg-[#10101f] px-3 py-1.5 text-xs font-bold text-white outline-none"
                  >
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="inline-flex min-h-10 w-fit items-center justify-center gap-2 rounded-xl border border-sky-400/20 bg-sky-500/10 px-4 py-2 text-xs font-bold text-sky-200">
                  <ShieldCheck className="h-4 w-4" />
                  Bank reconciliation tool
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
                <Banknote className="h-5 w-5" />
              </div>

              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Manual Bank Balance Check
                </h1>

                <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-400">
                  Compare the real bank statement balance with Burton Pride
                  Money In. Completed refunds received back are included once,
                  and every saved check records who completed it.
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="mt-4">
          <ManualBankBalanceCheck selectedYear={selectedYear} />
        </section>
      </div>
    </main>
  );
}
