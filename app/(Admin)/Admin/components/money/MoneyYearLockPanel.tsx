"use client";

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LockOpen,
  ShieldCheck,
} from "lucide-react";

type MonthOption = {
  key: string;
  label: string;
  count: number;
};

type MonthLockAction = "lock" | "unlock";

type MoneyYearLockPanelProps = {
  selectedYear: string;
  selectedYearLocked: boolean;
  yearLockPassword: string;
  setYearLockPassword: Dispatch<SetStateAction<string>>;
  lockingYear: boolean;
  onLockYear: (password?: string) => void | Promise<void>;
  onUnlockYear: (password?: string) => void | Promise<void>;

  printMonthOptions?: MonthOption[];
  selectedLockMonth: string;
  setSelectedLockMonth: Dispatch<SetStateAction<string>>;
  selectedMonthLocked: boolean;

  /**
   * Optional callback used to update parent state immediately after a
   * successful month lock action. The component also calls router.refresh().
   */
  onMonthLockChanged?: (
    monthKey: string,
    locked: boolean,
  ) => void | Promise<void>;
};

type ApiResponse = {
  ok?: boolean;
  success?: boolean;
  message?: string;
  error?: string;
  details?: unknown;
};

type MonthLockPayload = {
  action: MonthLockAction;
  lockType: "month";
  year: string;
  month: number;
  monthKey: string;
  periodKey: string;
  password: string;
};

type BuildMonthLockPayloadResult =
  | { payload: MonthLockPayload; error?: never }
  | { payload?: never; error: string };

type StatusMessage = {
  tone: "success" | "error";
  title: string;
  body: string;
};

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const panelBaseClass = "rounded-3xl border p-4 transition sm:p-5";

const passwordInputClass =
  "w-full rounded-xl bg-black/30 p-3 pr-12 text-white outline-none ring-1 ring-white/10 placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-pink-300/50 disabled:cursor-not-allowed disabled:opacity-60";

const iconButtonClass =
  "absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg bg-white/10 text-white/80 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 disabled:cursor-not-allowed disabled:opacity-60";

const helperBadgeClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-xs font-bold text-white/70 ring-1 ring-white/10";

const selectClass =
  "w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 focus-visible:ring-2 focus-visible:ring-pink-300/50 disabled:cursor-not-allowed disabled:opacity-60";

const PasswordBox = memo(function PasswordBox({
  value,
  onChange,
  placeholder,
  visible,
  onToggle,
  name,
  label,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  visible: boolean;
  onToggle: () => void;
  name: string;
  label: string;
  disabled?: boolean;
}) {
  const inputId = useId();

  return (
    <div>
      <label
        htmlFor={inputId}
        className="mb-2 block text-sm font-bold text-white/80"
      >
        {label}
      </label>

      <div className="relative">
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          name={name}
          autoComplete="current-password"
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
          aria-pressed={visible}
          title={visible ? "Hide password" : "Show password"}
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
});

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function safeCount(value: unknown): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.floor(parsed));
}

function safeDetails(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  if (value instanceof Error) {
    return JSON.stringify(
      {
        name: value.name,
        message: value.message,
        stack: value.stack,
      },
      null,
      2,
    );
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    try {
      return String(value);
    } catch {
      return "Technical details could not be displayed.";
    }
  }
}

function isValidYear(value: string): boolean {
  return /^\d{4}$/.test(value);
}

function isValidMonthKey(value: string): boolean {
  return MONTH_KEY_PATTERN.test(value);
}

function getMonthNumber(monthKey: string): number | null {
  if (!isValidMonthKey(monthKey)) {
    return null;
  }

  const month = Number(monthKey.slice(5, 7));

  return Number.isInteger(month) && month >= 1 && month <= 12
    ? month
    : null;
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

  if (!isValidYear(year)) {
    return {
      error:
        "The selected year is missing or invalid. Refresh the page and try again.",
    };
  }

  if (!monthKey) {
    return { error: "Please choose a month." };
  }

  if (!isValidMonthKey(monthKey)) {
    return {
      error: `The selected month is invalid. Expected YYYY-MM but received "${monthKey}".`,
    };
  }

  if (!monthKey.startsWith(`${year}-`)) {
    return {
      error: `The selected month (${monthKey}) does not belong to ${year}.`,
    };
  }

  const month = getMonthNumber(monthKey);

  if (month === null) {
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

  if (!text.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(text) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Response body was not a JSON object.");
    }

    return parsed as ApiResponse;
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Invalid JSON response.";

    throw new Error(
      [
        "The month lock API returned an invalid response.",
        `HTTP status: ${response.status}`,
        `Reason: ${reason}`,
        `Raw response: ${text.slice(0, 2000)}`,
      ].join("\n\n"),
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
}): string {
  const details = safeDetails(data.details);

  return [
    cleanText(data.error) ||
      cleanText(data.message) ||
      `Failed to ${action} month.`,
    details ? `Details:\n${details}` : "",
    `HTTP status: ${response.status}`,
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
  unlockedIcon: ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl p-3 ring-1 ${
        locked
          ? "bg-red-500/20 text-red-100 ring-red-300/20"
          : "bg-emerald-500/20 text-emerald-100 ring-emerald-300/20"
      }`}
      aria-hidden="true"
    >
      {locked ? <Lock className="h-5 w-5" /> : unlockedIcon}
    </div>
  );
}

function MainAdminBadge() {
  return (
    <div className={helperBadgeClass}>
      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
      Main admin only
    </div>
  );
}

function StatusPanel({ message }: { message: StatusMessage }) {
  const success = message.tone === "success";

  return (
    <div
      role={success ? "status" : "alert"}
      aria-live={success ? "polite" : "assertive"}
      className={`mb-4 rounded-2xl border p-4 text-sm font-bold ${
        success
          ? "border-emerald-300/20 bg-emerald-500/15 text-emerald-100"
          : "border-red-300/20 bg-red-500/15 text-red-100"
      }`}
    >
      <div className="flex items-start gap-3">
        {success ? (
          <CheckCircle2
            className="mt-0.5 h-5 w-5 shrink-0"
            aria-hidden="true"
          />
        ) : (
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0"
            aria-hidden="true"
          />
        )}

        <div className="min-w-0">
          <p className="font-black">{message.title}</p>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/20 p-3 font-sans text-xs leading-relaxed">
            {message.body}
          </pre>
        </div>
      </div>
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
  printMonthOptions = [],
  selectedLockMonth,
  setSelectedLockMonth,
  selectedMonthLocked,
  onMonthLockChanged,
}: MoneyYearLockPanelProps) {
  const router = useRouter();

  const [localYearPassword, setLocalYearPassword] =
    useState(yearLockPassword);
  const [localMonthPassword, setLocalMonthPassword] = useState("");
  const [showYearPassword, setShowYearPassword] = useState(false);
  const [showMonthPassword, setShowMonthPassword] = useState(false);
  const [yearActionPending, setYearActionPending] = useState(false);
  const [monthActionPending, setMonthActionPending] = useState(false);
  const [statusMessage, setStatusMessage] =
    useState<StatusMessage | null>(null);

  const yearSubmitRef = useRef(false);
  const monthSubmitRef = useRef(false);

  const cleanSelectedYear = cleanText(selectedYear);
  const yearIsValid = isValidYear(cleanSelectedYear);

  useEffect(() => {
    setLocalYearPassword(yearLockPassword);
  }, [yearLockPassword]);

  useEffect(() => {
    setStatusMessage(null);
    setLocalMonthPassword("");
    setShowMonthPassword(false);
  }, [cleanSelectedYear]);

  const monthOptions = useMemo(() => {
    const seen = new Set<string>();

    return printMonthOptions
      .map((item) => ({
        key: cleanText(item.key),
        label: cleanText(item.label),
        count: safeCount(item.count),
      }))
      .filter((item) => item.key !== "all")
      .filter((item) => isValidMonthKey(item.key))
      .filter((item) => item.key.startsWith(`${cleanSelectedYear}-`))
      .filter((item) => {
        if (seen.has(item.key)) {
          return false;
        }

        seen.add(item.key);
        return true;
      })
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [printMonthOptions, cleanSelectedYear]);

  useEffect(() => {
    if (monthOptions.length === 0) {
      if (selectedLockMonth) {
        setSelectedLockMonth("");
      }
      return;
    }

    const selectedIsValid = monthOptions.some(
      (item) => item.key === selectedLockMonth,
    );

    if (!selectedIsValid) {
      setSelectedLockMonth(monthOptions[0].key);
    }
  }, [monthOptions, selectedLockMonth, setSelectedLockMonth]);

  const selectedMonth = useMemo(
    () =>
      monthOptions.find((item) => item.key === selectedLockMonth) ??
      null,
    [monthOptions, selectedLockMonth],
  );

  const busy =
    lockingYear ||
    yearActionPending ||
    monthActionPending;

  const monthActionDisabled =
    busy ||
    !localMonthPassword.trim() ||
    !selectedMonth ||
    !isValidMonthKey(selectedLockMonth) ||
    !selectedLockMonth.startsWith(`${cleanSelectedYear}-`);

  const handleYearAction = useCallback(
    async (action: MonthLockAction) => {
      if (busy || yearSubmitRef.current) {
        return;
      }

      const password = localYearPassword.trim();

      if (!password) {
        setStatusMessage({
          tone: "error",
          title: "Year lock failed",
          body: "Please enter the main admin password.",
        });
        return;
      }

      if (!yearIsValid) {
        setStatusMessage({
          tone: "error",
          title: "Year lock failed",
          body: "The selected year is invalid. Refresh the page and try again.",
        });
        return;
      }

      yearSubmitRef.current = true;
      setYearActionPending(true);
      setStatusMessage(null);
      setYearLockPassword(password);

      try {
        if (action === "lock") {
          await onLockYear(password);
        } else {
          await onUnlockYear(password);
        }

        setLocalYearPassword("");
        setYearLockPassword("");
        setShowYearPassword(false);

        setStatusMessage({
          tone: "success",
          title:
            action === "lock"
              ? "Year locked"
              : "Year unlocked",
          body: `${cleanSelectedYear} has been ${
            action === "lock" ? "locked" : "unlocked"
          }.`,
        });

        router.refresh();
      } catch (error) {
        setStatusMessage({
          tone: "error",
          title: "Year lock failed",
          body:
            error instanceof Error
              ? error.message
              : `Failed to ${action} ${cleanSelectedYear}.`,
        });
      } finally {
        yearSubmitRef.current = false;
        setYearActionPending(false);
      }
    },
    [
      busy,
      cleanSelectedYear,
      localYearPassword,
      onLockYear,
      onUnlockYear,
      router,
      setYearLockPassword,
      yearIsValid,
    ],
  );

  const submitMonthLock = useCallback(
    async (action: MonthLockAction) => {
      if (busy || monthSubmitRef.current) {
        return;
      }

      setStatusMessage(null);

      const built = buildMonthLockPayload({
        action,
        selectedYear: cleanSelectedYear,
        selectedLockMonth,
        password: localMonthPassword,
      });

      if ("error" in built) {
        setStatusMessage({
          tone: "error",
          title: "Month lock failed",
          body: built.error ?? "Unknown error",
        });
        return;
      }

      const { payload } = built;

      monthSubmitRef.current = true;
      setMonthActionPending(true);

      try {
        const response = await fetch("/api/admin/money/month-locks", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        });

        const data = await readJsonResponse(response);

        if (!response.ok || !(data.ok === true || data.success === true)) {
          throw new Error(
            buildApiErrorMessage({
              action,
              response,
              data,
              payload,
            }),
          );
        }

        setLocalMonthPassword("");
        setShowMonthPassword(false);

        setStatusMessage({
          tone: "success",
          title:
            action === "lock"
              ? "Month locked"
              : "Month unlocked",
          body:
            cleanText(data.message) ||
            `${payload.monthKey} has been ${
              action === "lock" ? "locked" : "unlocked"
            }.`,
        });

        await onMonthLockChanged?.(
          payload.monthKey,
          action === "lock",
        );

        router.refresh();
      } catch (error) {
        setStatusMessage({
          tone: "error",
          title: "Month lock failed",
          body:
            error instanceof Error
              ? error.message
              : `Failed to ${action} ${selectedLockMonth}.`,
        });
      } finally {
        monthSubmitRef.current = false;
        setMonthActionPending(false);
      }
    },
    [
      busy,
      cleanSelectedYear,
      localMonthPassword,
      onMonthLockChanged,
      router,
      selectedLockMonth,
    ],
  );

  const yearAction = selectedYearLocked ? "unlock" : "lock";
  const monthAction = selectedMonthLocked ? "unlock" : "lock";

  return (
    <section
      aria-labelledby="money-lock-panel-title"
      className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 sm:p-5"
    >
      <h1 id="money-lock-panel-title" className="sr-only">
        Money tracker year and month locks
      </h1>

      {statusMessage ? (
        <StatusPanel message={statusMessage} />
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
                <h2 className="mt-1 break-words text-xl font-black text-white">
                  {selectedYearLocked
                    ? `${cleanSelectedYear || "Selected year"} is locked`
                    : `${cleanSelectedYear || "Selected year"} is open`}
                </h2>
                <p className="mt-1 text-sm leading-6 text-white/60">
                  {selectedYearLocked
                    ? "Unlock the year before editing payments, checks, notes or reconciliations."
                    : "Lock the year once accounts are finished to stop accidental changes."}
                </p>
              </div>
            </div>

            <PasswordBox
              value={localYearPassword}
              onChange={(value) => {
                setLocalYearPassword(value);
                setStatusMessage(null);
              }}
              placeholder="Enter main admin password"
              visible={showYearPassword}
              onToggle={() =>
                setShowYearPassword((previous) => !previous)
              }
              name="year-lock-password"
              label="Main admin password"
              disabled={busy}
            />

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => void handleYearAction(yearAction)}
                disabled={
                  busy ||
                  !localYearPassword.trim() ||
                  !yearIsValid
                }
                aria-busy={lockingYear || yearActionPending}
                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-60 ${
                  selectedYearLocked
                    ? "bg-emerald-500 text-black hover:bg-emerald-400"
                    : "bg-red-500 text-white hover:bg-red-400"
                }`}
              >
                {lockingYear || yearActionPending ? (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : selectedYearLocked ? (
                  <LockOpen className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Lock className="h-4 w-4" aria-hidden="true" />
                )}

                {lockingYear || yearActionPending
                  ? selectedYearLocked
                    ? "Unlocking..."
                    : "Locking..."
                  : selectedYearLocked
                    ? `Unlock ${cleanSelectedYear}`
                    : `Lock ${cleanSelectedYear}`}
              </button>

              <MainAdminBadge />
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
                <h2 className="mt-1 break-words text-xl font-black text-white">
                  {selectedMonthLocked && selectedMonth
                    ? `${selectedMonth.label} ${cleanSelectedYear} is locked`
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
                  {selectedMonth.label} {cleanSelectedYear}
                </span>{" "}
                · {selectedMonth.count} transaction
                {selectedMonth.count === 1 ? "" : "s"}
              </div>
            ) : (
              <div
                role="alert"
                className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm font-bold text-red-100"
              >
                Choose a valid month from{" "}
                {cleanSelectedYear || "the selected year"} before locking or
                unlocking.
              </div>
            )}

            <div>
              <label
                htmlFor="money-lock-month"
                className="mb-2 block text-sm font-bold text-white/80"
              >
                Month to lock
              </label>

              <select
                id="money-lock-month"
                value={selectedMonth ? selectedLockMonth : ""}
                onChange={(event) => {
                  setSelectedLockMonth(event.target.value);
                  setStatusMessage(null);
                  setLocalMonthPassword("");
                }}
                disabled={busy || monthOptions.length === 0}
                className={`${selectClass} mb-3`}
              >
                {monthOptions.length === 0 ? (
                  <option className="bg-[#070716]" value="">
                    No valid months found for{" "}
                    {cleanSelectedYear || "this year"}
                  </option>
                ) : (
                  monthOptions.map((month) => (
                    <option
                      key={month.key}
                      value={month.key}
                      className="bg-[#070716]"
                    >
                      {month.label} {cleanSelectedYear} — {month.count}{" "}
                      transaction{month.count === 1 ? "" : "s"}
                    </option>
                  ))
                )}
              </select>

              <PasswordBox
                value={localMonthPassword}
                onChange={(value) => {
                  setLocalMonthPassword(value);
                  setStatusMessage(null);
                }}
                placeholder="Enter main admin password"
                visible={showMonthPassword}
                onToggle={() =>
                  setShowMonthPassword((previous) => !previous)
                }
                name="month-lock-password"
                label="Main admin password"
                disabled={busy}
              />

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void submitMonthLock(monthAction)}
                  disabled={monthActionDisabled}
                  aria-busy={monthActionPending}
                  title={
                    monthActionDisabled
                      ? "Choose a valid month and enter the main admin password."
                      : selectedMonthLocked
                        ? `Unlock ${selectedLockMonth}`
                        : `Lock ${selectedLockMonth}`
                  }
                  className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-60 ${
                    selectedMonthLocked
                      ? "bg-emerald-500 text-black hover:bg-emerald-400"
                      : "bg-amber-400 text-black hover:bg-amber-300"
                  }`}
                >
                  {monthActionPending ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : selectedMonthLocked ? (
                    <LockOpen
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                  ) : (
                    <Lock className="h-4 w-4" aria-hidden="true" />
                  )}

                  {monthActionPending
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
