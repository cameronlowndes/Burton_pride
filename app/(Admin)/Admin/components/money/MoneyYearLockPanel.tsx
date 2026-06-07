"use client";

import { memo, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  AlertTriangle,
  CalendarCheck,
  Eye,
  EyeOff,
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
  onLockYear: (password?: string) => void | Promise<void>;
  onUnlockYear: (password?: string) => void | Promise<void>;

  printMonthOptions: MonthOption[];
  selectedLockMonth: string;
  setSelectedLockMonth: Dispatch<SetStateAction<string>>;
  selectedMonthLocked: boolean;
};

type ApiResponse = {
  ok?: boolean;
  success?: boolean;
  message?: string;
  error?: string;
  details?: unknown;
};

type MonthLockPayload = {
  action: "lock" | "unlock";
  lockType: "month";
  year: string;
  month: number;
  monthKey: string;
  periodKey: string;
  password: string;
};

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const PasswordBox = memo(function PasswordBox({
  value,
  onChange,
  placeholder,
  visible,
  onToggle,
  name,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  visible: boolean;
  onToggle: () => void;
  name: string;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        name={name}
        autoComplete="new-password"
        spellCheck={false}
        disabled={disabled}
        className="w-full rounded-xl bg-black/30 p-3 pr-12 text-white outline-none ring-1 ring-white/10 placeholder:text-white/40 focus:ring-pink-300/40 disabled:cursor-not-allowed disabled:opacity-60"
      />

      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg bg-white/10 text-white/80 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});

function safeDetails(value: unknown) {
  if (!value) return "";

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function cleanYear(value: unknown) {
  return String(value || "").trim();
}

function cleanMonthKey(value: unknown) {
  return String(value || "").trim();
}

function monthNumberFromKey(monthKey: string) {
  if (!MONTH_KEY_PATTERN.test(monthKey)) return null;

  const month = Number(monthKey.slice(5, 7));
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : null;
}

function buildMonthLockPayload({
  action,
  selectedYear,
  selectedLockMonth,
  password,
}: {
  action: "lock" | "unlock";
  selectedYear: string;
  selectedLockMonth: string;
  password: string;
}): { payload?: MonthLockPayload; error?: string } {
  const year = cleanYear(selectedYear);
  const monthKey = cleanMonthKey(selectedLockMonth);
  const cleanPassword = String(password || "").trim();

  if (!cleanPassword) {
    return { error: "Please enter the main admin password." };
  }

  if (!year || !/^\d{4}$/.test(year)) {
    return { error: "The selected year is missing or invalid. Please refresh the page and try again." };
  }

  if (!monthKey) {
    return { error: "Please choose a month." };
  }

  if (!MONTH_KEY_PATTERN.test(monthKey)) {
    return {
      error: `The selected month is invalid. Expected format YYYY-MM, but got: ${monthKey}`,
    };
  }

  if (!monthKey.startsWith(`${year}-`)) {
    return {
      error: `The selected month (${monthKey}) does not belong to the selected year (${year}). Please choose a month from ${year}.`,
    };
  }

  const month = monthNumberFromKey(monthKey);

  if (!month) {
    return { error: "The selected month number is invalid." };
  }

  return {
    payload: {
      action,
      lockType: "month",
      year,
      month,
      monthKey,
      periodKey: monthKey,
      password: cleanPassword,
    },
  };
}

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
}: MoneyYearLockPanelProps) {
  const [localYearPassword, setLocalYearPassword] = useState(yearLockPassword);
  const [localMonthPassword, setLocalMonthPassword] = useState("");

  const [showYearPassword, setShowYearPassword] = useState(false);
  const [showMonthPassword, setShowMonthPassword] = useState(false);

  const [lockingMonth, setLockingMonth] = useState(false);
  const [monthMessage, setMonthMessage] = useState("");
  const [monthError, setMonthError] = useState("");

  const monthOptions = useMemo(
    () =>
      printMonthOptions
        .filter((item) => item.key !== "all")
        .filter((item) => MONTH_KEY_PATTERN.test(item.key))
        .filter((item) => item.key.startsWith(`${cleanYear(selectedYear)}-`)),
    [printMonthOptions, selectedYear]
  );

  const selectedMonth = useMemo(
    () => monthOptions.find((item) => item.key === selectedLockMonth),
    [monthOptions, selectedLockMonth]
  );

  const monthActionDisabled =
    lockingMonth ||
    !localMonthPassword.trim() ||
    !selectedLockMonth ||
    !selectedMonth ||
    !MONTH_KEY_PATTERN.test(selectedLockMonth) ||
    !selectedLockMonth.startsWith(`${cleanYear(selectedYear)}-`);

  async function handleLockYear() {
    const password = localYearPassword.trim();

    if (!password) return;

    setYearLockPassword(password);
    await onLockYear(password);
  }

  async function handleUnlockYear() {
    const password = localYearPassword.trim();

    if (!password) return;

    setYearLockPassword(password);
    await onUnlockYear(password);
  }

  async function submitMonthLock(action: "lock" | "unlock") {
    setMonthMessage("");
    setMonthError("");

    if (lockingMonth) return;

    const built = buildMonthLockPayload({
      action,
      selectedYear,
      selectedLockMonth,
      password: localMonthPassword,
    });

    if (built.error || !built.payload) {
      setMonthError(built.error || "Month lock request could not be created.");
      return;
    }

    setLockingMonth(true);

    try {
      const response = await fetch("/api/admin/money/month-locks", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(built.payload),
      });

      const text = await response.text();

      let data: ApiResponse = {};

      try {
        data = text ? (JSON.parse(text) as ApiResponse) : {};
      } catch {
        setMonthError(
          `The month lock API returned an invalid response.\n\nHTTP status: ${response.status}\n\nRaw response:\n${text}`
        );
        return;
      }

      if (!response.ok || !(data.ok || data.success)) {
        const details = safeDetails(data.details);

        setMonthError(
          [
            data.error || `Failed to ${action} month.`,
            details ? `Details:\n${details}` : "",
            `HTTP status: ${response.status}`,
            `Request sent: POST /api/admin/money/month-locks`,
            `Action: ${built.payload.action}`,
            `Lock type: ${built.payload.lockType}`,
            `Year: ${built.payload.year}`,
            `Month number: ${built.payload.month}`,
            `Month key: ${built.payload.monthKey}`,
            `Password included: yes`,
          ]
            .filter(Boolean)
            .join("\n\n")
        );

        return;
      }

      setMonthMessage(
        data.message ||
          `${built.payload.monthKey} has been ${
            action === "lock" ? "locked" : "unlocked"
          }.`
      );

      setLocalMonthPassword("");

      window.setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      setMonthError(
        error instanceof Error
          ? `Network error: ${error.message}`
          : `Failed to ${action} month.`
      );
    } finally {
      setLockingMonth(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 sm:p-5">
      {monthMessage && (
        <div className="mb-4 rounded-2xl border border-emerald-300/20 bg-emerald-500/15 p-4 text-sm font-bold text-emerald-100">
          {monthMessage}
        </div>
      )}

      {monthError && (
        <div className="mb-4 rounded-2xl border border-red-300/20 bg-red-500/15 p-4 text-red-100">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />

            <div className="min-w-0">
              <p className="font-black">Month lock failed</p>

              <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/20 p-3 text-xs leading-relaxed">
                {monthError}
              </pre>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
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

              <div>
                <p className="text-xs font-black uppercase tracking-wide text-white/45">
                  Full year lock
                </p>

                <h2 className="mt-1 text-xl font-black text-white">
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

            <div>
              <label className="mb-2 block text-sm font-bold text-white/80">
                Main admin password
              </label>

              <PasswordBox
                value={localYearPassword}
                onChange={setLocalYearPassword}
                placeholder="Enter main admin password"
                visible={showYearPassword}
                onToggle={() => setShowYearPassword((previous) => !previous)}
                name="year-lock-password"
                disabled={lockingYear}
              />

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                {selectedYearLocked ? (
                  <button
                    type="button"
                    onClick={handleUnlockYear}
                    disabled={lockingYear || !localYearPassword.trim()}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <LockOpen className="h-4 w-4" />
                    {lockingYear ? "Unlocking..." : `Unlock ${selectedYear}`}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleLockYear}
                    disabled={lockingYear || !localYearPassword.trim()}
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

              <div>
                <p className="text-xs font-black uppercase tracking-wide text-white/45">
                  Single month lock
                </p>

                <h2 className="mt-1 text-xl font-black text-white">
                  {selectedMonthLocked
                    ? `${selectedLockMonth} is locked`
                    : "Lock one month"}
                </h2>

                <p className="mt-1 text-sm leading-6 text-white/60">
                  Lock a single checked month without locking the whole year.
                  This sends the year, month number, and month key to the server
                  so the tracker can stop edits, deletes, checked changes,
                  reconciliation changes, finance notes, and repayments for that
                  month.
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

            {!selectedMonth && (
              <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm font-bold text-red-100">
                Choose a valid month from {selectedYear} before locking or unlocking.
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-bold text-white/80">
                Month to lock
              </label>

              <select
                value={selectedLockMonth}
                onChange={(event) => {
                  setSelectedLockMonth(event.target.value);
                  setMonthError("");
                  setMonthMessage("");
                }}
                disabled={lockingMonth}
                className="mb-3 w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 focus:ring-pink-300/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {monthOptions.length === 0 ? (
                  <option className="bg-[#070716]" value="">
                    No valid months found for {selectedYear}
                  </option>
                ) : (
                  monthOptions.map((month) => (
                    <option
                      key={month.key}
                      value={month.key}
                      className="bg-[#070716]"
                    >
                      {month.label} {selectedYear} — {month.count} transaction
                      {month.count === 1 ? "" : "s"}
                    </option>
                  ))
                )}
              </select>

              <label className="mb-2 block text-sm font-bold text-white/80">
                Main admin password
              </label>

              <PasswordBox
                value={localMonthPassword}
                onChange={setLocalMonthPassword}
                placeholder="Enter main admin password"
                visible={showMonthPassword}
                onToggle={() => setShowMonthPassword((previous) => !previous)}
                name="month-lock-password"
                disabled={lockingMonth}
              />

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                {selectedMonthLocked ? (
                  <button
                    type="button"
                    onClick={() => submitMonthLock("unlock")}
                    disabled={monthActionDisabled}
                    title={
                      monthActionDisabled
                        ? "Choose a valid month and enter the main admin password."
                        : `Unlock ${selectedLockMonth}`
                    }
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <LockOpen className="h-4 w-4" />
                    {lockingMonth ? "Unlocking..." : "Unlock month"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => submitMonthLock("lock")}
                    disabled={monthActionDisabled}
                    title={
                      monthActionDisabled
                        ? "Choose a valid month and enter the main admin password."
                        : `Lock ${selectedLockMonth}`
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

              <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-5 text-white/55">
                Server request: <span className="font-bold text-white">POST /api/admin/money/month-locks</span>{" "}
                with <span className="font-bold text-white">action</span>,{" "}
                <span className="font-bold text-white">lockType</span>,{" "}
                <span className="font-bold text-white">year</span>,{" "}
                <span className="font-bold text-white">month</span>,{" "}
                <span className="font-bold text-white">monthKey</span>, and password.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
