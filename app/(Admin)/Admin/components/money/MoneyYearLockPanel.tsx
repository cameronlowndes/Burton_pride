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

type MonthLockAction = "lock" | "unlock";

type BuildMonthLockPayloadResult =
  | { payload: MonthLockPayload; error?: never }
  | { payload?: never; error: string };

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const panelBaseClass = "rounded-3xl border p-4 transition sm:p-5";

const passwordInputClass =
  "w-full rounded-xl bg-black/30 p-3 pr-12 text-white outline-none ring-1 ring-white/10 placeholder:text-white/40 focus:ring-pink-300/40 disabled:cursor-not-allowed disabled:opacity-60";

const iconButtonClass =
  "absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg bg-white/10 text-white/80 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60";

const helperBadgeClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-xs font-bold text-white/70 ring-1 ring-white/10";

const selectClass =
  "w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 focus:ring-pink-300/40 disabled:cursor-not-allowed disabled:opacity-60";

const statusMessageClass = "mb-4 rounded-2xl border p-4 text-sm font-bold";

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
        className={passwordInputClass}
      />

      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className={iconButtonClass}
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

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function isValidYear(value: string) {
  return /^\d{4}$/.test(value);
}

function isValidMonthKey(value: string) {
  return MONTH_KEY_PATTERN.test(value);
}

function getMonthNumber(monthKey: string) {
  if (!isValidMonthKey(monthKey)) return null;

  const month = Number(monthKey.slice(5, 7));
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : null;
}

function buildMonthLockPayload({
  action,
  selectedYear,
  selectedLockMonth,
  password,
}: {
  action: MonthLockAction;
  selectedYear: string;
  selectedLockMonth: string;
  password: string;
}): BuildMonthLockPayloadResult {
  const year = cleanText(selectedYear);
  const monthKey = cleanText(selectedLockMonth);
  const cleanPassword = cleanText(password);

  if (!cleanPassword) {
    return { error: "Please enter the main admin password." };
  }

  if (!year || !isValidYear(year)) {
    return {
      error:
        "The selected year is missing or invalid. Please refresh and try again.",
    };
  }

  if (!monthKey) {
    return { error: "Please choose a month." };
  }

  if (!isValidMonthKey(monthKey)) {
    return {
      error: `The selected month is invalid. Expected YYYY-MM, got: ${monthKey}`,
    };
  }

  if (!monthKey.startsWith(`${year}-`)) {
    return {
      error: `The selected month (${monthKey}) does not belong to ${year}.`,
    };
  }

  const month = getMonthNumber(monthKey);

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

async function readJsonResponse(response: Response): Promise<ApiResponse> {
  const text = await response.text();

  if (!text) return {};

  try {
    return JSON.parse(text) as ApiResponse;
  } catch {
    throw new Error(
      `The month lock API returned an invalid response.\n\nHTTP status: ${response.status}\n\nRaw response:\n${text}`,
    );
  }
}

function buildApiErrorMessage({
  action,
  response,
  data,
  payload,
}: {
  action: MonthLockAction;
  response: Response;
  data: ApiResponse;
  payload: MonthLockPayload;
}) {
  const details = safeDetails(data.details);

  return [
    data.error || `Failed to ${action} month.`,
    details ? `Details:\n${details}` : "",
    `Status: ${response.status}`,
    `Month: ${payload.monthKey}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function LockStatusIcon({
  locked,
  unlockedIcon,
}: {
  locked: boolean;
  unlockedIcon: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl p-3 ring-1 ${
        locked
          ? "bg-red-500/20 text-red-100 ring-red-300/20"
          : "bg-emerald-500/20 text-emerald-100 ring-emerald-300/20"
      }`}
    >
      {locked ? <Lock className="h-5 w-5" /> : unlockedIcon}
    </div>
  );
}

function MainAdminBadge() {
  return (
    <div className={helperBadgeClass}>
      <ShieldCheck className="h-4 w-4" />
      Main admin only
    </div>
  );
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

  const cleanSelectedYear = cleanText(selectedYear);

  const monthOptions = useMemo(
    () =>
      printMonthOptions
        .filter((item) => item.key !== "all")
        .filter((item) => isValidMonthKey(item.key))
        .filter((item) => item.key.startsWith(`${cleanSelectedYear}-`)),
    [printMonthOptions, cleanSelectedYear],
  );

  const selectedMonth = useMemo(
    () => monthOptions.find((item) => item.key === selectedLockMonth) || null,
    [monthOptions, selectedLockMonth],
  );

  const monthActionDisabled =
    lockingMonth ||
    !localMonthPassword.trim() ||
    !selectedMonth ||
    !isValidMonthKey(selectedLockMonth) ||
    !selectedLockMonth.startsWith(`${cleanSelectedYear}-`);

  async function handleYearAction(action: MonthLockAction) {
    const password = localYearPassword.trim();

    if (!password) return;

    setYearLockPassword(password);

    if (action === "lock") {
      await onLockYear(password);
      return;
    }

    await onUnlockYear(password);
  }

  async function submitMonthLock(action: MonthLockAction) {
    if (lockingMonth) return;

    setMonthMessage("");
    setMonthError("");

    const built = buildMonthLockPayload({
      action,
      selectedYear,
      selectedLockMonth,
      password: localMonthPassword,
    });

    if ("error" in built) {
      setMonthError(built.error ?? "An unexpected error occurred.");
      return;
    }

    const { payload } = built;

    setLockingMonth(true);

    try {
      const response = await fetch("/api/admin/money/month-locks", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await readJsonResponse(response);

      if (!response.ok || !(data.ok || data.success)) {
        setMonthError(
          buildApiErrorMessage({
            action,
            response,
            data,
            payload,
          }),
        );
        return;
      }

      setMonthMessage(
        data.message ||
          `${payload.monthKey} has been ${
            action === "lock" ? "locked" : "unlocked"
          }.`,
      );
      setLocalMonthPassword("");

      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      setMonthError(
        error instanceof Error
          ? error.message
          : `Failed to ${action} month. Please try again.`,
      );
    } finally {
      setLockingMonth(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 sm:p-5">
      {monthMessage ? (
        <div
          className={`${statusMessageClass} border-emerald-300/20 bg-emerald-500/15 text-emerald-100`}
        >
          {monthMessage}
        </div>
      ) : null}

      {monthError ? (
        <div
          className={`${statusMessageClass} border-red-300/20 bg-red-500/15 text-red-100`}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0">
              <p className="font-black">Month lock failed</p>
              <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/20 p-3 text-xs leading-relaxed">
                {monthError}
              </pre>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <div
          className={`${panelBaseClass} ${
            selectedYearLocked
              ? "border-red-300/20 bg-red-500/10"
              : "border-emerald-300/20 bg-emerald-500/10"
          }`}
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <LockStatusIcon
                locked={selectedYearLocked}
                unlockedIcon={<LockOpen className="h-5 w-5" />}
              />

              <div className="min-w-0">
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
                    ? "Unlock the year before editing payments, checks, notes or reconciliations."
                    : "Lock the year once accounts are finished to stop accidental changes."}
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
                <button
                  type="button"
                  onClick={() =>
                    handleYearAction(selectedYearLocked ? "unlock" : "lock")
                  }
                  disabled={lockingYear || !localYearPassword.trim()}
                  className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    selectedYearLocked
                      ? "bg-emerald-500 text-black hover:bg-emerald-400"
                      : "bg-red-500 text-white hover:bg-red-400"
                  }`}
                >
                  {selectedYearLocked ? (
                    <LockOpen className="h-4 w-4" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                  {lockingYear
                    ? selectedYearLocked
                      ? "Unlocking..."
                      : "Locking..."
                    : selectedYearLocked
                      ? `Unlock ${selectedYear}`
                      : `Lock ${selectedYear}`}
                </button>

                <MainAdminBadge />
              </div>
            </div>
          </div>
        </div>

        <div
          className={`${panelBaseClass} ${
            selectedMonthLocked
              ? "border-red-300/20 bg-red-500/10"
              : "border-amber-300/20 bg-amber-500/10"
          }`}
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <LockStatusIcon
                locked={selectedMonthLocked}
                unlockedIcon={<CalendarCheck className="h-5 w-5" />}
              />

              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wide text-white/45">
                  Single month lock
                </p>
                <h2 className="mt-1 text-xl font-black text-white">
                  {selectedMonthLocked
                    ? `${selectedLockMonth} is locked`
                    : "Lock one month"}
                </h2>
                <p className="mt-1 text-sm leading-6 text-white/60">
                  Lock one finished month without locking the whole year.
                </p>
              </div>
            </div>

            {selectedMonth ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/75">
                Selected month:{" "}
                <span className="font-black text-white">
                  {selectedMonth.label} {selectedYear}
                </span>{" "}
                · {selectedMonth.count} transaction
                {selectedMonth.count === 1 ? "" : "s"}
              </div>
            ) : (
              <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm font-bold text-red-100">
                Choose a valid month from {selectedYear} before locking or
                unlocking.
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
                className={`${selectClass} mb-3`}
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
                <button
                  type="button"
                  onClick={() =>
                    submitMonthLock(selectedMonthLocked ? "unlock" : "lock")
                  }
                  disabled={monthActionDisabled}
                  title={
                    monthActionDisabled
                      ? "Choose a valid month and enter the main admin password."
                      : selectedMonthLocked
                        ? `Unlock ${selectedLockMonth}`
                        : `Lock ${selectedLockMonth}`
                  }
                  className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    selectedMonthLocked
                      ? "bg-emerald-500 text-black hover:bg-emerald-400"
                      : "bg-amber-400 text-black hover:bg-amber-300"
                  }`}
                >
                  {selectedMonthLocked ? (
                    <LockOpen className="h-4 w-4" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                  {lockingMonth
                    ? selectedMonthLocked
                      ? "Unlocking..."
                      : "Locking..."
                    : selectedMonthLocked
                      ? "Unlock month"
                      : "Lock month"}
                </button>

                <MainAdminBadge />
              </div>

              <p className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-5 text-white/55">
                Month locks stop edits, deletes, checked changes, finance notes,
                reconciliation changes and repayments for the selected month.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
