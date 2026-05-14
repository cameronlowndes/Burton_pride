"use client";

import type { Dispatch, SetStateAction } from "react";
import { Lock, LockOpen, ShieldCheck } from "lucide-react";

type MoneyYearLockPanelProps = {
  selectedYear: string;
  selectedYearLocked: boolean;
  yearLockPassword: string;
  setYearLockPassword: Dispatch<SetStateAction<string>>;
  lockingYear: boolean;
  onLockYear: () => void | Promise<void>;
  onUnlockYear: () => void | Promise<void>;
};

export default function MoneyYearLockPanel({
  selectedYear,
  selectedYearLocked,
  yearLockPassword,
  setYearLockPassword,
  lockingYear,
  onLockYear,
  onUnlockYear,
}: MoneyYearLockPanelProps) {
  return (
    <section
      className={`rounded-3xl border p-4 sm:p-5 ${
        selectedYearLocked
          ? "border-red-300/20 bg-red-500/10"
          : "border-emerald-300/20 bg-emerald-500/10"
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-3">
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
              <h2 className="break-words text-xl font-black text-white">
                {selectedYearLocked
                  ? `${selectedYear} is locked`
                  : `${selectedYear} is open`}
              </h2>

              <p className="text-sm text-white/60">
                {selectedYearLocked
                  ? "This year is locked because the accounts are finished. Unlock with the main admin password before editing."
                  : "Lock this year when the accounts are finished so nobody can edit it by mistake."}
              </p>
            </div>
          </div>

          {selectedYearLocked && (
            <div className="rounded-2xl border border-red-300/20 bg-black/20 p-4 text-sm text-red-100">
              Locked years cannot be edited, deleted, or added to until a main
              admin unlocks them.
            </div>
          )}
        </div>

        <div className="w-full min-w-0 lg:max-w-md">
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
    </section>
  );
}