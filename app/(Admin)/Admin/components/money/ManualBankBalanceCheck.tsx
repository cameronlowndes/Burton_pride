"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCcw,
  Save,
  ShieldCheck,
} from "lucide-react";

type BankBalanceCheck = {
  id: string;
  year: string;
  real_bank_balance_pence: number;
  money_tracker_balance_pence: number;
  difference_pence: number;
  status: "matches" | "difference_found" | "needs_check" | string;
  notes?: string | null;
  checked_by_user_id?: string | null;
  checked_by_name?: string | null;
  checked_by_email?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type TrackerBreakdown = {
  year: string;

  opening_balance_pence: number;

  ordinary_money_in_pence: number;
  ordinary_money_out_pence: number;

  refunds_received_back_pence: number;
  refunds_sent_back_pence: number;
  net_refund_adjustment_pence: number;

  money_in_including_refunds_pence: number;
  money_out_including_refunds_pence: number;

  /**
   * The complete calculated Money Management balance:
   *
   * opening balance
   * + money in
   * + refunds received
   * - money out
   * - refunds sent
   */
  available_balance_pence: number;

  current_year_transaction_count: number;
  current_year_refund_count: number;
  completed_current_year_refund_count: number;
};

type ApiResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  code?: string;
  details?: unknown;
  hint?: string | null;

  year?: string;

  trackerBalancePence?: number;
  trackerBreakdown?: TrackerBreakdown;

  checks?: BankBalanceCheck[];
  latestCheck?: BankBalanceCheck | null;

  check?: BankBalanceCheck;
};

type ManualBankBalanceCheckProps = {
  selectedYear: string;
};

type ParsedMoneyInput =
  | {
      valid: true;
      pence: number;
      normalised: string;
    }
  | {
      valid: false;
      pence: null;
      normalised: string;
      reason: string;
    };

const EMPTY_BREAKDOWN: TrackerBreakdown = {
  year: "",
  opening_balance_pence: 0,
  ordinary_money_in_pence: 0,
  ordinary_money_out_pence: 0,
  refunds_received_back_pence: 0,
  refunds_sent_back_pence: 0,
  net_refund_adjustment_pence: 0,
  money_in_including_refunds_pence: 0,
  money_out_including_refunds_pence: 0,
  available_balance_pence: 0,
  current_year_transaction_count: 0,
  current_year_refund_count: 0,
  completed_current_year_refund_count: 0,
};

const MAX_NOTES_LENGTH = 2_000;
const MAX_ABSOLUTE_BALANCE_PENCE = 1_000_000_000_00;

function money(value?: number | null) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format((Number(value) || 0) / 100);
}

function parsePoundsInput(value: string): ParsedMoneyInput {
  const normalised = String(value || "")
    .replace(/[£,\s]/g, "")
    .trim();

  if (!normalised) {
    return {
      valid: false,
      pence: null,
      normalised,
      reason: "Enter the real bank statement balance.",
    };
  }

  if (!/^-?(?:\d+|\d*\.\d{1,2})$/.test(normalised)) {
    return {
      valid: false,
      pence: null,
      normalised,
      reason:
        "Enter a valid amount with no more than two decimal places, for example 1250.50.",
    };
  }

  const pounds = Number(normalised);

  if (!Number.isFinite(pounds)) {
    return {
      valid: false,
      pence: null,
      normalised,
      reason: "The bank balance is not a valid number.",
    };
  }

  const pence = Math.round(pounds * 100);

  if (!Number.isSafeInteger(pence)) {
    return {
      valid: false,
      pence: null,
      normalised,
      reason: "The bank balance is too large to save safely.",
    };
  }

  if (Math.abs(pence) > MAX_ABSOLUTE_BALANCE_PENCE) {
    return {
      valid: false,
      pence: null,
      normalised,
      reason: "The bank balance is outside the supported range.",
    };
  }

  return {
    valid: true,
    pence,
    normalised,
  };
}

function penceToPoundsInput(value?: number | null) {
  return ((Number(value) || 0) / 100).toFixed(2);
}

function formatDate(value?: string | null) {
  if (!value) return "Unknown date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: string, differencePence: number) {
  if (status === "matches" || differencePence === 0) return "Matches";
  if (status === "difference_found") return "Difference found";
  return "Needs checking";
}

function statusClass(status: string, differencePence: number) {
  if (status === "matches" || differencePence === 0) {
    return "border-emerald-300/20 bg-emerald-500/10 text-emerald-100";
  }

  if (status === "difference_found") {
    return "border-red-300/20 bg-red-500/10 text-red-100";
  }

  return "border-amber-300/20 bg-amber-500/10 text-amber-100";
}

function apiErrorMessage(
  data: ApiResponse,
  fallback: string,
  response?: Response,
) {
  return [
    data.error || data.message || fallback,
    data.code ? `Code: ${data.code}` : "",
    typeof data.details === "string" ? `Details: ${data.details}` : "",
    data.hint ? `Hint: ${data.hint}` : "",
    response ? `HTTP: ${response.status}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function readJsonResponse(response: Response): Promise<ApiResponse> {
  const rawBody = await response.text();

  if (!rawBody) return {};

  try {
    return JSON.parse(rawBody) as ApiResponse;
  } catch {
    return {
      error: "The server returned a response that was not valid JSON.",
      details: rawBody.slice(0, 1_500),
    };
  }
}

function isValidYear(value: string) {
  return /^\d{4}$/.test(value) && Number(value) >= 2000 && Number(value) <= 2100;
}

export default function ManualBankBalanceCheck({
  selectedYear,
}: ManualBankBalanceCheckProps) {
  const balanceInputId = useId();
  const notesInputId = useId();

  const [checks, setChecks] = useState<BankBalanceCheck[]>([]);
  const [latestCheck, setLatestCheck] = useState<BankBalanceCheck | null>(null);
  const [breakdown, setBreakdown] =
    useState<TrackerBreakdown>(EMPTY_BREAKDOWN);

  const [realBankBalance, setRealBankBalance] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  /*
   * A monotonically increasing request ID prevents an older request from one
   * year overwriting a newer year after the admin changes the dropdown.
   */
  const loadRequestIdRef = useRef(0);
  const loadAbortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const parsedRealBankBalance = useMemo(
    () => parsePoundsInput(realBankBalance),
    [realBankBalance],
  );

  const realBankBalancePence = parsedRealBankBalance.valid
    ? parsedRealBankBalance.pence
    : null;

  /*
   * A real bank balance must be compared with the complete calculated tracker
   * balance, not with gross Money In alone. Gross Money In ignores expenses,
   * refunds sent and the opening balance.
   */
  const comparisonTrackerBalancePence =
    breakdown.available_balance_pence;

  const differencePence =
    realBankBalancePence === null
      ? null
      : realBankBalancePence - comparisonTrackerBalancePence;

  const loadChecks = useCallback(
    async (options?: { preserveMessage?: boolean }) => {
      if (!isValidYear(selectedYear)) {
        setError("The selected year is invalid.");
        setLoading(false);
        return;
      }

      const requestId = ++loadRequestIdRef.current;

      loadAbortControllerRef.current?.abort();

      const controller = new AbortController();
      loadAbortControllerRef.current = controller;

      try {
        setLoading(true);
        setError("");

        if (!options?.preserveMessage) {
          setMessage("");
        }

        const response = await fetch(
          `/api/admin/money/bank-balance-checks?year=${encodeURIComponent(
            selectedYear,
          )}&limit=20&t=${Date.now()}`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: {
              Accept: "application/json",
            },
            signal: controller.signal,
          },
        );

        const data = await readJsonResponse(response);

        if (!response.ok || !data.ok) {
          throw new Error(
            apiErrorMessage(
              data,
              "Failed to load bank balance checks.",
              response,
            ),
          );
        }

        if (
          controller.signal.aborted ||
          requestId !== loadRequestIdRef.current ||
          !mountedRef.current
        ) {
          return;
        }

        const nextChecks = Array.isArray(data.checks)
          ? data.checks
          : [];

        const nextLatestCheck = data.latestCheck || null;
        const nextBreakdown =
          data.trackerBreakdown || EMPTY_BREAKDOWN;

        setChecks(nextChecks);
        setLatestCheck(nextLatestCheck);
        setBreakdown(nextBreakdown);

        /*
         * Prevent values from the previous year remaining in the form when the
         * new year has no saved check.
         */
        if (nextLatestCheck) {
          setRealBankBalance(
            penceToPoundsInput(
              nextLatestCheck.real_bank_balance_pence,
            ),
          );
          setNotes(nextLatestCheck.notes || "");
        } else {
          setRealBankBalance("");
          setNotes("");
        }
      } catch (loadError) {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        ) {
          return;
        }

        if (!mountedRef.current) return;

        setChecks([]);
        setLatestCheck(null);
        setBreakdown({
          ...EMPTY_BREAKDOWN,
          year: selectedYear,
        });
        setRealBankBalance("");
        setNotes("");

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load bank balance checks.",
        );
      } finally {
        if (
          requestId === loadRequestIdRef.current &&
          mountedRef.current
        ) {
          setLoading(false);
        }
      }
    },
    [selectedYear],
  );

  const saveCheck = useCallback(async () => {
    if (saving || loading) return;

    if (!isValidYear(selectedYear)) {
      setError("The selected year is invalid.");
      return;
    }

    if (!parsedRealBankBalance.valid) {
      setError(parsedRealBankBalance.reason);
      return;
    }

    const cleanNotes = notes.trim();

    if (cleanNotes.length > MAX_NOTES_LENGTH) {
      setError(
        `Notes must be ${MAX_NOTES_LENGTH.toLocaleString(
          "en-GB",
        )} characters or fewer.`,
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const response = await fetch(
        "/api/admin/money/bank-balance-checks",
        {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            year: selectedYear,
            real_bank_balance_pence:
              parsedRealBankBalance.pence,
            notes: cleanNotes || null,
          }),
        },
      );

      const data = await readJsonResponse(response);

      if (!response.ok || !data.ok) {
        throw new Error(
          apiErrorMessage(
            data,
            "Failed to save bank balance check.",
            response,
          ),
        );
      }

      const successMessage =
        data.message || "Bank balance check saved.";

      /*
       * Reload without clearing the success notice. The old implementation
       * immediately erased its own success message inside loadChecks().
       */
      await loadChecks({ preserveMessage: true });

      if (mountedRef.current) {
        setMessage(successMessage);
      }
    } catch (saveError) {
      if (!mountedRef.current) return;

      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save bank balance check.",
      );
    } finally {
      if (mountedRef.current) {
        setSaving(false);
      }
    }
  }, [
    loading,
    loadChecks,
    notes,
    parsedRealBankBalance,
    saving,
    selectedYear,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    void loadChecks();

    return () => {
      mountedRef.current = false;
      loadAbortControllerRef.current?.abort();
    };
  }, [loadChecks]);

  return (
    <section className="w-full max-w-none rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 sm:p-5">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-500/10 px-4 py-2 text-sm font-black text-sky-100">
            <Banknote className="h-4 w-4" aria-hidden="true" />
            Manual bank balance check
          </div>

          <h2 className="break-words text-2xl font-black text-white">
            Compare real bank balance with Money Management
          </h2>

          <p className="mt-2 max-w-4xl text-sm leading-6 text-white/60">
            The real statement balance is compared with the complete calculated
            Money Management balance: opening balance plus Money In and refunds
            received, minus Money Out and refunds sent.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadChecks()}
          disabled={loading || saving}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCcw
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          Refresh checks
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          className="mb-4 whitespace-pre-line rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm font-bold leading-6 text-red-100"
        >
          <AlertTriangle
            className="mr-2 inline h-4 w-4"
            aria-hidden="true"
          />
          {error}
        </div>
      ) : null}

      {message ? (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100"
        >
          <CheckCircle2
            className="mr-2 inline h-4 w-4"
            aria-hidden="true"
          />
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-violet-300/20 bg-violet-500/10 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-violet-100/70">
              Opening balance
            </p>

            <p className="mt-2 break-words text-2xl font-black text-white">
              {loading
                ? "Loading..."
                : money(breakdown.opening_balance_pence)}
            </p>

            <p className="mt-2 text-xs leading-5 text-violet-100/60">
              Balance carried into {selectedYear}.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-emerald-100/70">
              Money in
            </p>

            <p className="mt-2 break-words text-2xl font-black text-white">
              {loading
                ? "Loading..."
                : money(
                    breakdown.money_in_including_refunds_pence,
                  )}
            </p>

            <p className="mt-2 text-xs leading-5 text-emerald-100/60">
              Ordinary Money In:{" "}
              {money(breakdown.ordinary_money_in_pence)}. Completed refunds
              received:{" "}
              {money(breakdown.refunds_received_back_pence)}.
            </p>
          </div>

          <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-red-100/70">
              Money out
            </p>

            <p className="mt-2 break-words text-2xl font-black text-white">
              {loading
                ? "Loading..."
                : money(
                    breakdown.money_out_including_refunds_pence,
                  )}
            </p>

            <p className="mt-2 text-xs leading-5 text-red-100/60">
              Ordinary Money Out:{" "}
              {money(breakdown.ordinary_money_out_pence)}. Completed refunds
              sent: {money(breakdown.refunds_sent_back_pence)}.
            </p>
          </div>

          <div className="rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-sky-100/70">
              Calculated tracker balance
            </p>

            <p className="mt-2 break-words text-2xl font-black text-white">
              {loading
                ? "Loading..."
                : money(comparisonTrackerBalancePence)}
            </p>

            <p className="mt-2 text-xs leading-5 text-sky-100/60">
              Complete expected bank balance after all included movements.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-emerald-100/70">
              Real bank balance
            </p>

            <p className="mt-2 break-words text-2xl font-black text-white">
              {realBankBalancePence === null
                ? "Not entered"
                : money(realBankBalancePence)}
            </p>
          </div>

          <div
            className={`rounded-2xl border p-4 sm:col-span-2 xl:col-span-5 ${
              differencePence === null
                ? "border-white/10 bg-white/[0.04]"
                : differencePence === 0
                  ? "border-emerald-300/20 bg-emerald-500/10"
                  : "border-red-300/20 bg-red-500/10"
            }`}
          >
            <p className="text-xs font-black uppercase tracking-wide text-white/60">
              Difference
            </p>

            <p
              className={`mt-2 break-words text-3xl font-black ${
                differencePence === null
                  ? "text-white/50"
                  : differencePence === 0
                    ? "text-emerald-100"
                    : "text-red-100"
              }`}
            >
              {differencePence === null
                ? "Enter the real balance"
                : money(differencePence)}
            </p>

            {differencePence !== null ? (
              <p className="mt-2 text-xs leading-5 text-white/55">
                Real bank balance minus calculated Money Management balance.
              </p>
            ) : null}
          </div>

          <div className="sm:col-span-2 xl:col-span-5">
            <label
              htmlFor={balanceInputId}
              className="mb-2 block text-sm font-black text-white/75"
            >
              Real bank statement balance
            </label>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-white/45">
                  £
                </span>

                <input
                  id={balanceInputId}
                  value={realBankBalance}
                  onChange={(event) => {
                    setRealBankBalance(event.target.value);

                    if (error) {
                      setError("");
                    }
                  }}
                  onBlur={() => {
                    if (parsedRealBankBalance.valid) {
                      setRealBankBalance(
                        penceToPoundsInput(
                          parsedRealBankBalance.pence,
                        ),
                      );
                    }
                  }}
                  placeholder="0.00"
                  inputMode="decimal"
                  autoComplete="off"
                  aria-invalid={
                    realBankBalance.length > 0 &&
                    !parsedRealBankBalance.valid
                  }
                  aria-describedby={`${balanceInputId}-help`}
                  className="w-full rounded-xl bg-black/30 py-3 pl-8 pr-4 text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-sky-300/40"
                />
              </div>

              <button
                type="button"
                onClick={() => void saveCheck()}
                disabled={
                  saving ||
                  loading ||
                  !parsedRealBankBalance.valid
                }
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sky-500 px-5 py-3 text-sm font-black text-white transition hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Save className="h-4 w-4" aria-hidden="true" />
                )}

                {saving ? "Saving..." : "Save check"}
              </button>
            </div>

            <p
              id={`${balanceInputId}-help`}
              className={`mt-2 text-xs ${
                realBankBalance &&
                !parsedRealBankBalance.valid
                  ? "font-bold text-red-200"
                  : "text-white/45"
              }`}
            >
              {realBankBalance &&
              !parsedRealBankBalance.valid
                ? parsedRealBankBalance.reason
                : "Enter the exact closing balance shown by the bank statement or banking app."}
            </p>
          </div>

          <div className="sm:col-span-2 xl:col-span-5">
            <label
              htmlFor={notesInputId}
              className="mb-2 block text-sm font-black text-white/75"
            >
              Notes
            </label>

            <textarea
              id={notesInputId}
              value={notes}
              onChange={(event) =>
                setNotes(
                  event.target.value.slice(
                    0,
                    MAX_NOTES_LENGTH,
                  ),
                )
              }
              rows={3}
              maxLength={MAX_NOTES_LENGTH}
              placeholder="Example: Statement checked against the banking app. Difference is a pending card-machine payout."
              className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-sky-300/40"
            />

            <p className="mt-1 text-right text-xs text-white/35">
              {notes.length.toLocaleString("en-GB")} /{" "}
              {MAX_NOTES_LENGTH.toLocaleString("en-GB")}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck
              className="h-5 w-5 text-sky-100"
              aria-hidden="true"
            />
            <h3 className="text-lg font-black text-white">
              Latest check
            </h3>
          </div>

          {loading ? (
            <div className="rounded-xl bg-white/10 p-4 text-sm text-white/60">
              Loading latest bank check...
            </div>
          ) : latestCheck ? (
            <div className="space-y-3">
              <div
                className={`rounded-xl border px-3 py-2 text-sm font-black ${statusClass(
                  latestCheck.status,
                  latestCheck.difference_pence,
                )}`}
              >
                {statusLabel(
                  latestCheck.status,
                  latestCheck.difference_pence,
                )}
              </div>

              <div className="grid gap-2 text-sm text-white/65">
                <p>
                  Real bank:{" "}
                  <strong className="text-white">
                    {money(
                      latestCheck.real_bank_balance_pence,
                    )}
                  </strong>
                </p>

                <p>
                  Calculated tracker balance:{" "}
                  <strong className="text-white">
                    {money(
                      latestCheck.money_tracker_balance_pence,
                    )}
                  </strong>
                </p>

                <p>
                  Difference:{" "}
                  <strong
                    className={
                      latestCheck.difference_pence === 0
                        ? "text-emerald-100"
                        : "text-red-100"
                    }
                  >
                    {money(latestCheck.difference_pence)}
                  </strong>
                </p>

                <p>
                  Checked by:{" "}
                  <strong className="text-white">
                    {latestCheck.checked_by_name ||
                      latestCheck.checked_by_email ||
                      "Unknown user"}
                  </strong>
                </p>

                <p>
                  Checked:{" "}
                  <strong className="text-white">
                    {formatDate(latestCheck.created_at)}
                  </strong>
                </p>
              </div>

              {latestCheck.notes ? (
                <div className="whitespace-pre-wrap break-words rounded-xl bg-white/10 p-3 text-sm leading-6 text-white/65">
                  {latestCheck.notes}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl bg-white/10 p-4 text-sm text-white/60">
              No bank balance checks saved yet for {selectedYear}.
            </div>
          )}
        </div>
      </div>

      {checks.length > 0 ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20">
          <div className="border-b border-white/10 p-4">
            <h3 className="text-lg font-black text-white">
              Check history
            </h3>

            <p className="mt-1 text-sm text-white/50">
              Previous manual bank balance checks for {selectedYear}. Each
              calculated tracker balance is generated by the server.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <caption className="sr-only">
                Manual bank balance check history for {selectedYear}
              </caption>

              <thead className="bg-white/10 text-xs uppercase tracking-wide text-white/55">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Real bank
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Tracker balance
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Difference
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Checked by
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Notes
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {checks.map((check) => (
                  <tr
                    key={check.id}
                    className="bg-black/10 transition hover:bg-white/[0.04]"
                  >
                    <td className="whitespace-nowrap px-4 py-4 text-white/70">
                      <Clock3
                        className="mr-2 inline h-4 w-4 text-white/35"
                        aria-hidden="true"
                      />
                      {formatDate(check.created_at)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 font-black text-emerald-100">
                      {money(check.real_bank_balance_pence)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 font-black text-sky-100">
                      {money(
                        check.money_tracker_balance_pence,
                      )}
                    </td>

                    <td
                      className={`whitespace-nowrap px-4 py-4 font-black ${
                        check.difference_pence === 0
                          ? "text-emerald-100"
                          : "text-red-100"
                      }`}
                    >
                      {money(check.difference_pence)}
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClass(
                          check.status,
                          check.difference_pence,
                        )}`}
                      >
                        {statusLabel(
                          check.status,
                          check.difference_pence,
                        )}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-white/70">
                      {check.checked_by_name ||
                        check.checked_by_email ||
                        "Unknown user"}
                    </td>

                    <td className="max-w-sm whitespace-pre-wrap break-words px-4 py-4 text-white/55">
                      {check.notes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
