"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  CalendarCheck,
  Lock,
  LockOpen,
  ShieldCheck,
} from "lucide-react";

type MonthOption = {
  key: string;
  label: string;
  count: number;
};

type MoneyYearLockPanelProps = {
  selectedYear: string;
  selectedYearLocked: boolean;
  yearLockPassword: string;
  setYearLockPassword: Dispatch<SetStateAction<string>>;
  lockingYear: boolean;
  onLockYear: () => void | Promise<void>;
  onUnlockYear: () => void | Promise<void>;

  printMonthOptions: MonthOption[];
  selectedLockMonth: string;
  setSelectedLockMonth: Dispatch<SetStateAction<string>>;
  selectedMonthLocked: boolean;
  monthLockPassword: string;
  setMonthLockPassword: Dispatch<SetStateAction<string>>;
  lockingMonth: boolean;
  onLockMonth: () => void | Promise<void>;
  onUnlockMonth: () => void | Promise<void>;
};

export default function MoneyYearLockPanel({
  selectedYear,
  selectedYearLocked,
  yearLockPassword,
  setYearLockPassword,
  lockingYear,
  onLockYear,
  onUnlockYear,

  printMonthOptions,
  selectedLockMonth,
  setSelectedLockMonth,
  selectedMonthLocked,
  monthLockPassword,
  setMonthLockPassword,
  lockingMonth,
  onLockMonth,
  onUnlockMonth,
}: MoneyYearLockPanelProps) {
  const monthOptions = printMonthOptions.filter((item) => item.key !== "all");

  const selectedMonth = monthOptions.find(
    (item) => item.key === selectedLockMonth
  );

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 sm:p-5">
      <div className="grid gap-4 xl:grid-cols-2">
        {/* YEAR LOCK */}
        <div
          className={`rounded-3xl border p-4 sm:p-5 ${
            selectedYearLocked
              ? "border-red-300/20 bg-red-500/10"
              : "border-emerald-300/20 bg-emerald-500/10"
          }`}
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div
                className={`rounded-2xl p-3 ring-1 ${
                  selectedYearLocked
                    ? "bg-red-500/20 text-red-100 ring-red-300/20"
                    : "bg-emerald-500/20 text-emerald-100 ring-emerald-300/20"
                }`}
              >
                {selectedYearLocked ? (
                  <Lock className="h-5 w-5" />
                ) : (
                  <LockOpen className="h-5 w-5" />
                )}
              </div>

              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wide text-white/45">
                  Full year lock
                </p>

                <h2 className="mt-1 break-words text-xl font-black text-white">
                  {selectedYearLocked
                    ? `${selectedYear} is locked`
                    : `${selectedYear} is open`}
                </h2>

                <p className="mt-1 text-sm leading-6 text-white/60">
                  {selectedYearLocked
                    ? "This full year is locked. Unlock it with the main admin password before editing this year."
                    : "Lock the full year when the accounts are finished so nobody can edit it by mistake."}
                </p>
              </div>
            </div>

            {selectedYearLocked && (
              <div className="rounded-2xl border border-red-300/20 bg-black/20 p-4 text-sm text-red-100">
                Locked years cannot be edited, deleted, or added to until a main
                admin unlocks them.
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-bold text-white/80">
                Main admin password
              </label>

              <input
                type="password"
                value={yearLockPassword}
                onChange={(event) => setYearLockPassword(event.target.value)}
                placeholder="Enter main admin password"
                autoComplete="new-password"
                className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/40 focus:ring-pink-300/40"
              />

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                {selectedYearLocked ? (
                  <button
                    type="button"
                    onClick={onUnlockYear}
                    disabled={lockingYear || !yearLockPassword.trim()}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <LockOpen className="h-4 w-4" />
                    {lockingYear ? "Unlocking..." : `Unlock ${selectedYear}`}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onLockYear}
                    disabled={lockingYear || !yearLockPassword.trim()}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm font-black text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Lock className="h-4 w-4" />
                    {lockingYear ? "Locking..." : `Lock ${selectedYear}`}
                  </button>
                )}

                <div className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-xs font-bold text-white/70 ring-1 ring-white/10">
                  <ShieldCheck className="h-4 w-4" />
                  Main admin only
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MONTH LOCK */}
        <div
          className={`rounded-3xl border p-4 sm:p-5 ${
            selectedMonthLocked
              ? "border-red-300/20 bg-red-500/10"
              : "border-amber-300/20 bg-amber-500/10"
          }`}
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div
                className={`rounded-2xl p-3 ring-1 ${
                  selectedMonthLocked
                    ? "bg-red-500/20 text-red-100 ring-red-300/20"
                    : "bg-amber-500/20 text-amber-100 ring-amber-300/20"
                }`}
              >
                {selectedMonthLocked ? (
                  <Lock className="h-5 w-5" />
                ) : (
                  <CalendarCheck className="h-5 w-5" />
                )}
              </div>

              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wide text-white/45">
                  Single month lock
                </p>

                <h2 className="mt-1 break-words text-xl font-black text-white">
                  {selectedMonthLocked
                    ? `${selectedLockMonth} is locked`
                    : "Lock one month"}
                </h2>

                <p className="mt-1 text-sm leading-6 text-white/60">
                  Lock a single checked month without locking the whole year.
                  This stops edits, deletes, checked changes, reconciliation
                  changes, finance notes, and repayments for that month.
                </p>
              </div>
            </div>

            {selectedMonth && (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/75">
                Selected month:{" "}
                <span className="font-black text-white">
                  {selectedMonth.label} {selectedYear}
                </span>{" "}
                · {selectedMonth.count} transaction
                {selectedMonth.count === 1 ? "" : "s"}
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-bold text-white/80">
                Month to lock
              </label>

              <select
                value={selectedLockMonth}
                onChange={(event) => setSelectedLockMonth(event.target.value)}
                className="mb-3 w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 focus:ring-pink-300/40"
              >
                {monthOptions.map((month) => (
                  <option
                    key={month.key}
                    value={month.key}
                    className="bg-[#070716]"
                  >
                    {month.label} {selectedYear} — {month.count} transaction
                    {month.count === 1 ? "" : "s"}
                  </option>
                ))}
              </select>

              <label className="mb-2 block text-sm font-bold text-white/80">
                Main admin password
              </label>

              <input
                type="password"
                value={monthLockPassword}
                onChange={(event) => setMonthLockPassword(event.target.value)}
                placeholder="Enter main admin password"
                autoComplete="new-password"
                className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/40 focus:ring-pink-300/40"
              />

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                {selectedMonthLocked ? (
                  <button
                    type="button"
                    onClick={onUnlockMonth}
                    disabled={lockingMonth || !monthLockPassword.trim()}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <LockOpen className="h-4 w-4" />
                    {lockingMonth ? "Unlocking..." : "Unlock month"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onLockMonth}
                    disabled={
                      lockingMonth ||
                      !monthLockPassword.trim() ||
                      !selectedLockMonth
                    }
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-sm font-black text-black hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Lock className="h-4 w-4" />
                    {lockingMonth ? "Locking..." : "Lock month"}
                  </button>
                )}

                <div className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-xs font-bold text-white/70 ring-1 ring-white/10">
                  <ShieldCheck className="h-4 w-4" />
                  Main admin only
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}