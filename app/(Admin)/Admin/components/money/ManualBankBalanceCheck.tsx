"use client";

import { useEffect, useMemo, useState } from "react";
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

type ManualBankBalanceCheckProps = {
  selectedYear: string;
  trackerBalancePence?: number;
};

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format((Number(value) || 0) / 100);
}

function poundsToPence(value: string) {
  const cleaned = String(value || "")
    .replace(/[£,]/g, "")
    .trim();

  const numberValue = Number(cleaned);

  if (!Number.isFinite(numberValue)) return 0;

  return Math.round(numberValue * 100);
}

function penceToPoundsInput(value: number | null | undefined) {
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
  if (status === "matches" || differencePence === 0) {
    return "Matches";
  }

  if (status === "difference_found") {
    return "Difference found";
  }

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

export default function ManualBankBalanceCheck({
  selectedYear,
  trackerBalancePence,
}: ManualBankBalanceCheckProps) {
  const [checks, setChecks] = useState<BankBalanceCheck[]>([]);
  const [latestCheck, setLatestCheck] = useState<BankBalanceCheck | null>(null);

  const [realBankBalance, setRealBankBalance] = useState("");
  const [notes, setNotes] = useState("");

  const [apiTrackerBalance, setApiTrackerBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const trackerBalance =
    typeof trackerBalancePence === "number"
      ? trackerBalancePence
      : apiTrackerBalance;

  const realBankBalancePence = useMemo(
    () => poundsToPence(realBankBalance),
    [realBankBalance],
  );

  const differencePence = realBankBalancePence - trackerBalance;

  async function loadChecks() {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const response = await fetch(
        `/api/admin/money/bank-balance-checks?year=${encodeURIComponent(
          selectedYear,
        )}&limit=20`,
        {
          cache: "no-store",
        },
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data?.details || data?.error || "Failed to load bank balance checks.",
        );
      }

      setChecks(data.checks || []);
      setLatestCheck(data.latestCheck || null);
      setApiTrackerBalance(Number(data.trackerBalancePence || 0));

      if (data.latestCheck) {
        setRealBankBalance(
          penceToPoundsInput(data.latestCheck.real_bank_balance_pence),
        );
        setNotes(data.latestCheck.notes || "");
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load bank balance checks.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveCheck() {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      const response = await fetch("/api/admin/money/bank-balance-checks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          year: selectedYear,
          real_bank_balance_pence: realBankBalancePence,
          money_tracker_balance_pence: trackerBalance,
          notes,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data?.details || data?.error || "Failed to save bank balance check.",
        );
      }

      setMessage(data.message || "Bank balance check saved.");
      await loadChecks();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save bank balance check.",
      );
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

  return (
    <section className="w-full max-w-none rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 sm:p-5">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-500/10 px-4 py-2 text-sm font-black text-sky-100">
            <Banknote className="h-4 w-4" />
            Manual bank balance check
          </div>

          <h2 className="break-words text-2xl font-black text-white">
            Compare real bank balance with money tracker
          </h2>

          <p className="mt-2 max-w-4xl text-sm leading-6 text-white/60">
            Enter the balance shown on the real bank statement. The system will
            compare it with the money tracker balance and save who checked it.
          </p>
        </div>

        <button
          type="button"
          onClick={loadChecks}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh checks
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm font-bold text-red-100">
          <AlertTriangle className="mr-2 inline h-4 w-4" />
          {error}
        </div>
      )}

      {message && (
        <div className="mb-4 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">
          <CheckCircle2 className="mr-2 inline h-4 w-4" />
          {message}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-sky-100/70">
              Money tracker balance
            </p>
            <p className="mt-2 break-words text-2xl font-black text-white">
              {loading ? "Loading..." : money(trackerBalance)}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-emerald-100/70">
              Real bank balance
            </p>
            <p className="mt-2 break-words text-2xl font-black text-white">
              {money(realBankBalancePence)}
            </p>
          </div>

          <div
            className={`rounded-2xl border p-4 ${
              differencePence === 0
                ? "border-emerald-300/20 bg-emerald-500/10"
                : "border-red-300/20 bg-red-500/10"
            }`}
          >
            <p className="text-xs font-black uppercase tracking-wide text-white/60">
              Difference
            </p>
            <p
              className={`mt-2 break-words text-2xl font-black ${
                differencePence === 0 ? "text-emerald-100" : "text-red-100"
              }`}
            >
              {money(differencePence)}
            </p>
          </div>

          <div className="sm:col-span-3">
            <label className="mb-2 block text-sm font-black text-white/75">
              Real bank statement balance
            </label>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-white/45">
                  £
                </span>

                <input
                  value={realBankBalance}
                  onChange={(event) => setRealBankBalance(event.target.value)}
                  placeholder="0.00"
                  inputMode="decimal"
                  className="w-full rounded-xl bg-black/30 py-3 pl-8 pr-4 text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-sky-300/40"
                />
              </div>

              <button
                type="button"
                onClick={saveCheck}
                disabled={saving || loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-5 py-3 text-sm font-black text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save check
              </button>
            </div>
          </div>

          <div className="sm:col-span-3">
            <label className="mb-2 block text-sm font-black text-white/75">
              Notes
            </label>

            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Example: Statement balance checked against NatWest app. Difference is pending card machine payout."
              className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-sky-300/40"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-sky-100" />
            <h3 className="text-lg font-black text-white">Latest check</h3>
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
                {statusLabel(latestCheck.status, latestCheck.difference_pence)}
              </div>

              <div className="grid gap-2 text-sm text-white/65">
                <p>
                  Real bank:{" "}
                  <strong className="text-white">
                    {money(latestCheck.real_bank_balance_pence)}
                  </strong>
                </p>
                <p>
                  Tracker:{" "}
                  <strong className="text-white">
                    {money(latestCheck.money_tracker_balance_pence)}
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
                    {latestCheck.checked_by_name || "Unknown user"}
                  </strong>
                </p>
                <p>
                  Checked:{" "}
                  <strong className="text-white">
                    {formatDate(latestCheck.created_at)}
                  </strong>
                </p>
              </div>

              {latestCheck.notes && (
                <div className="rounded-xl bg-white/10 p-3 text-sm leading-6 text-white/65">
                  {latestCheck.notes}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl bg-white/10 p-4 text-sm text-white/60">
              No bank balance checks saved yet for {selectedYear}.
            </div>
          )}
        </div>
      </div>

      {checks.length > 0 && (
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20">
          <div className="border-b border-white/10 p-4">
            <h3 className="text-lg font-black text-white">Check history</h3>
            <p className="mt-1 text-sm text-white/50">
              Previous manual bank balance checks for {selectedYear}.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-white/10 text-xs uppercase tracking-wide text-white/55">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Real bank</th>
                  <th className="px-4 py-3">Tracker</th>
                  <th className="px-4 py-3">Difference</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Checked by</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {checks.map((check) => (
                  <tr key={check.id} className="bg-black/10">
                    <td className="whitespace-nowrap px-4 py-4 text-white/70">
                      <Clock3 className="mr-2 inline h-4 w-4 text-white/35" />
                      {formatDate(check.created_at)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 font-black text-emerald-100">
                      {money(check.real_bank_balance_pence)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 font-black text-sky-100">
                      {money(check.money_tracker_balance_pence)}
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
                        {statusLabel(check.status, check.difference_pence)}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-white/70">
                      {check.checked_by_name || "Unknown user"}
                    </td>

                    <td className="max-w-sm px-4 py-4 text-white/55">
                      {check.notes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}