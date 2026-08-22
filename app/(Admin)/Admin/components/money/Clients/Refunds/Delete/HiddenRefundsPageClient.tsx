"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  FileClock,
  Loader2,
  RefreshCcw,
  RotateCcw,
  Search,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type RefundType = "money_received_back" | "money_sent_back";
type RefundStatus = "pending" | "completed" | "cancelled";

type RefundRecord = {
  id: string;
  year: number;
  refund_date: string;
  refund_type: RefundType;
  amount_pence: number;
  title: string;
  notes?: string | null;
  reference_number?: string | null;
  supplier_id?: string | null;
  original_transaction_id?: string | null;
  status: RefundStatus;
  is_hidden?: boolean | null;
  hidden_at?: string | null;
  hidden_by_name?: string | null;
  hidden_by_email?: string | null;
  created_at?: string | null;
  updated_at?: string | null;

  supplier?: {
    id: string;
    supplier_name: string;
  } | null;

  original_transaction?: {
    id: string;
    title: string;
    amount_pence?: number | null;
    transaction_type?: string | null;
    transaction_date?: string | null;
  } | null;
};

type RefundApiResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  details?: unknown;
  refunds?: RefundRecord[];
  refund?: RefundRecord;
};

type RefundModalState = {
  open: boolean;
  refund: RefundRecord | null;
};

function currentYear() {
  return String(new Date().getFullYear());
}

function buildYearOptions() {
  const year = new Date().getFullYear();

  return Array.from({ length: 7 }, (_, index) =>
    String(year - 3 + index),
  );
}

function money(value?: number | null) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format((Number(value) || 0) / 100);
}

function formatDate(value?: string | null) {
  if (!value) return "Unknown date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function refundTypeLabel(type: RefundType) {
  return type === "money_received_back"
    ? "Refund Received Back"
    : "Refund Sent Back";
}

function refundTypeClass(type: RefundType) {
  return type === "money_received_back"
    ? "border-cyan-300/20 bg-cyan-500/10 text-cyan-100"
    : "border-violet-300/20 bg-violet-500/10 text-violet-100";
}

function statusLabel(status: RefundStatus) {
  if (status === "completed") return "Completed";
  if (status === "pending") return "Pending";
  return "Cancelled";
}

function statusClass(status: RefundStatus) {
  if (status === "completed") {
    return "border-emerald-300/20 bg-emerald-500/10 text-emerald-100";
  }

  if (status === "pending") {
    return "border-amber-300/20 bg-amber-500/10 text-amber-100";
  }

  return "border-slate-300/20 bg-slate-500/10 text-slate-200";
}

function fallbackReference(refund: RefundRecord) {
  if (refund.reference_number?.trim()) {
    return refund.reference_number.trim();
  }

  return `REFUND-${refund.year}-${refund.id.slice(0, 8).toUpperCase()}`;
}

async function readJsonResponse(
  response: Response,
): Promise<RefundApiResponse> {
  const rawBody = await response.text();

  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody) as RefundApiResponse;
  } catch {
    return {
      error: "The server returned a response that was not valid JSON.",
      details: rawBody,
    };
  }
}

function RestoreRefundModal({
  state,
  working,
  onClose,
  onConfirm,
}: {
  state: RefundModalState;
  working: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  if (!state.open || !state.refund) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm">
      <section className="w-full max-w-lg overflow-hidden rounded-[22px] border border-white/10 bg-[#10101f] shadow-2xl shadow-black/50">
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-200">
              <Undo2 className="h-5 w-5" />
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-300">
                Deleted Refunds
              </p>

              <h2 className="mt-1 text-lg font-bold text-white">
                Restore this refund?
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={working}
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close restore refund popup"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="px-5 py-5">
          <p className="text-sm leading-6 text-slate-300">
            Restore{" "}
            <span className="font-bold text-white">
              {state.refund.title}
            </span>{" "}
            to the active Refund Tracker?
          </p>

          <div className="mt-4 rounded-xl border border-sky-300/20 bg-sky-500/10 px-4 py-3 text-sm leading-6 text-sky-100">
            Restoring the refund will make it visible again. A completed refund
            will start affecting the relevant totals again.
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={working}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Keep Deleted
            </button>

            <button
              type="button"
              onClick={() => void onConfirm()}
              disabled={working}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {working ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Undo2 className="h-4 w-4" />
              )}

              {working ? "Restoring Refund..." : "Restore Refund"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function PermanentlyDeleteRefundModal({
  state,
  working,
  confirmation,
  onConfirmationChange,
  onClose,
  onConfirm,
}: {
  state: RefundModalState;
  working: boolean;
  confirmation: string;
  onConfirmationChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  if (!state.open || !state.refund) {
    return null;
  }

  const confirmationMatches = confirmation.trim().toUpperCase() === "DELETE";

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm">
      <section className="w-full max-w-lg overflow-hidden rounded-[22px] border border-red-300/20 bg-[#10101f] shadow-2xl shadow-black/60">
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-400/20 bg-red-500/10 text-red-200">
              <Trash2 className="h-5 w-5" />
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-red-300">
                Permanent deletion
              </p>

              <h2 className="mt-1 text-lg font-bold text-white">
                Permanently delete this refund?
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={working}
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close permanent refund deletion popup"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="px-5 py-5">
          <p className="text-sm leading-6 text-slate-300">
            You are about to permanently delete{" "}
            <span className="font-bold text-white">{state.refund.title}</span>.
          </p>

          <div className="mt-4 rounded-xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100">
            This removes the row from <strong>money_refunds</strong> in
            Supabase. It cannot be restored afterwards.
          </div>

          <label className="mt-4 block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-red-200">
              Type DELETE to confirm
            </span>

            <input
              value={confirmation}
              onChange={(event) => onConfirmationChange(event.target.value)}
              placeholder="DELETE"
              autoComplete="off"
              className="w-full rounded-xl border border-red-300/20 bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-red-100/30 focus:border-red-300/50"
            />
          </label>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={working}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => void onConfirm()}
              disabled={working || !confirmationMatches}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {working ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}

              {working ? "Deleting Permanently..." : "Delete Permanently"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function HiddenRefundsPageClient() {
  const yearOptions = useMemo(() => buildYearOptions(), []);

  const [selectedYear, setSelectedYear] = useState(currentYear());
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [errorDetails, setErrorDetails] = useState<unknown>(null);

  const [restoreModal, setRestoreModal] = useState<RefundModalState>({
    open: false,
    refund: null,
  });

  const [deleteModal, setDeleteModal] = useState<RefundModalState>({
    open: false,
    refund: null,
  });

  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const loadHiddenRefunds = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setErrorDetails(null);

      const response = await fetch(
        `/api/admin/money/refunds?year=${encodeURIComponent(
          selectedYear,
        )}&includeHidden=true&limit=500`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const payload = await readJsonResponse(response);

      if (!response.ok) {
        throw {
          message:
            payload.message ||
            payload.error ||
            "Deleted refunds could not be loaded.",
          details: payload.details || payload,
          status: response.status,
        };
      }

      const hiddenRefunds = Array.isArray(payload.refunds)
        ? payload.refunds.filter((refund) => refund.is_hidden)
        : [];

      setRefunds(hiddenRefunds);
    } catch (loadError: any) {
      setRefunds([]);

      setError(
        loadError?.message || "Deleted refunds could not be loaded.",
      );

      setErrorDetails(loadError?.details || loadError);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    void loadHiddenRefunds();
  }, [loadHiddenRefunds]);

  const filteredRefunds = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) {
      return refunds;
    }

    return refunds.filter((refund) =>
      [
        fallbackReference(refund),
        refund.title,
        refund.notes,
        refund.reference_number,
        refund.supplier?.supplier_name,
        refund.original_transaction?.title,
        refund.hidden_by_name,
        refund.hidden_by_email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [refunds, searchTerm]);

  function openRestoreModal(refund: RefundRecord) {
    setMessage("");
    setRestoreModal({
      open: true,
      refund,
    });
  }

  function closeRestoreModal() {
    if (workingId) return;

    setRestoreModal({
      open: false,
      refund: null,
    });
  }

  async function restoreRefund() {
    const refund = restoreModal.refund;

    if (!refund) return;

    try {
      setWorkingId(refund.id);
      setError("");
      setErrorDetails(null);
      setMessage("");

      const response = await fetch("/api/admin/money/refunds", {
        method: "PATCH",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          id: refund.id,
          action: "restore",
        }),
      });

      const payload = await readJsonResponse(response);

      if (!response.ok) {
        throw {
          message:
            payload.message ||
            payload.error ||
            "The refund could not be restored.",
          details: payload.details || payload,
          status: response.status,
        };
      }

      setMessage(
        payload.message || "Refund restored successfully.",
      );

      setRestoreModal({
        open: false,
        refund: null,
      });

      await loadHiddenRefunds();
    } catch (restoreError: any) {
      setError(
        restoreError?.message || "The refund could not be restored.",
      );

      setErrorDetails(restoreError?.details || restoreError);
    } finally {
      setWorkingId(null);
    }
  }

  function openDeleteModal(refund: RefundRecord) {
    setMessage("");
    setDeleteConfirmation("");
    setDeleteModal({
      open: true,
      refund,
    });
  }

  function closeDeleteModal() {
    if (workingId) return;

    setDeleteConfirmation("");
    setDeleteModal({
      open: false,
      refund: null,
    });
  }

  async function permanentlyDeleteRefund() {
    const refund = deleteModal.refund;

    if (!refund) return;

    try {
      setWorkingId(refund.id);
      setError("");
      setErrorDetails(null);
      setMessage("");

      const response = await fetch("/api/admin/money/refunds", {
        method: "DELETE",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          id: refund.id,
          confirmation: deleteConfirmation,
        }),
      });

      const payload = await readJsonResponse(response);

      if (!response.ok) {
        throw {
          message:
            payload.message ||
            payload.error ||
            "The refund could not be permanently deleted.",
          details: payload.details || payload,
          status: response.status,
        };
      }

      setMessage(
        payload.message ||
          "Refund permanently deleted. This action cannot be undone.",
      );

      setDeleteConfirmation("");
      setDeleteModal({
        open: false,
        refund: null,
      });

      await loadHiddenRefunds();
    } catch (deleteError: any) {
      setError(
        deleteError?.message ||
          "The refund could not be permanently deleted.",
      );

      setErrorDetails(deleteError?.details || deleteError);
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#030412] px-2 py-2 text-slate-100">
      <div className="w-full space-y-4">
        <header className="rounded-[22px] border border-white/10 bg-[#10101f] px-4 py-4 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <Link
                href="/Admin/MoneyManagement/TrackingMoney/Refunds"
                className="inline-flex min-h-8 w-fit items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-white/15 hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Refund Tracker
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

                <button
                  type="button"
                  onClick={() => void loadHiddenRefunds()}
                  disabled={loading}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCcw
                    className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </button>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-500/10 text-rose-200">
                <FileClock className="h-5 w-5" />
              </div>

              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Deleted Refunds
                </h1>

                <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-400">
                  Refunds moved out of the active tracker are kept here first.
                  Restore a refund when it needs to return to the active tracker,
                  or permanently delete it from Supabase when it is no longer
                  required.
                </p>
              </div>
            </div>
          </div>
        </header>

        {error ? (
          <section className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-red-100">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />

              <div className="min-w-0 flex-1">
                <p className="font-black">Deleted refunds could not be loaded</p>

                <p className="mt-1 break-words text-sm leading-6 text-red-100/85">
                  {error}
                </p>

                {errorDetails ? (
                  <details className="mt-3 overflow-hidden rounded-xl border border-red-300/20 bg-black/20">
                    <summary className="cursor-pointer px-3 py-2 text-xs font-black uppercase tracking-wide">
                      Show technical details
                    </summary>

                    <pre className="max-h-72 overflow-auto border-t border-red-300/10 p-3 text-xs leading-5">
                      {JSON.stringify(errorDetails, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {message ? (
          <section className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">
            <CheckCircle2 className="mr-2 inline h-4 w-4" />
            {message}
          </section>
        ) : null}

        <section className="grid gap-3 md:grid-cols-2">
          <article className="rounded-[20px] border border-rose-400/20 bg-rose-500/10 px-4 py-4 text-rose-100">
            <p className="text-[11px] font-bold uppercase tracking-wide opacity-80">
              Deleted refunds
            </p>

            <p className="mt-2 text-2xl font-bold text-white">
              {refunds.length}
            </p>
          </article>

          <article className="rounded-[20px] border border-sky-400/20 bg-sky-500/10 px-4 py-4 text-sky-100">
            <p className="text-[11px] font-bold uppercase tracking-wide opacity-80">
              Showing after search
            </p>

            <p className="mt-2 text-2xl font-bold text-white">
              {filteredRefunds.length}
            </p>
          </article>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#10101f] p-3 shadow-2xl shadow-black/20">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search deleted refund, supplier, reference, notes..."
              className="w-full rounded-xl border border-white/10 bg-black/20 py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/40"
            />
          </div>
        </section>

        <section className="overflow-hidden rounded-[22px] border border-white/10 bg-[#10101f] shadow-2xl shadow-black/20">
          {loading ? (
            <div className="flex min-h-56 items-center justify-center gap-3 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading deleted refunds...
            </div>
          ) : filteredRefunds.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center">
              <FileClock className="h-8 w-8 text-slate-600" />

              <h2 className="mt-4 text-base font-bold text-white">
                No deleted refunds found
              </h2>

              <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">
                Deleted refunds will appear here after they are moved out of the
                active Refund Tracker.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px] text-left text-sm">
                <thead className="bg-white/10 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">Original transaction</th>
                    <th className="px-4 py-3">Deleted by</th>
                    <th className="px-4 py-3">Deleted at</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/10">
                  {filteredRefunds.map((refund) => (
                    <tr key={refund.id} className="bg-black/10">
                      <td className="px-4 py-4 align-top">
                        <span className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-xs font-black text-cyan-100">
                          {fallbackReference(refund)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 align-top text-slate-300">
                        {formatDate(refund.refund_date)}
                      </td>

                      <td className="max-w-xs px-4 py-4 align-top">
                        <p className="font-bold text-white">{refund.title}</p>

                        {refund.notes ? (
                          <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-500">
                            {refund.notes}
                          </p>
                        ) : null}
                      </td>

                      <td className="px-4 py-4 align-top">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${refundTypeClass(
                            refund.refund_type,
                          )}`}
                        >
                          {refundTypeLabel(refund.refund_type)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 align-top font-black text-white">
                        {money(refund.amount_pence)}
                      </td>

                      <td className="px-4 py-4 align-top">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusClass(
                            refund.status,
                          )}`}
                        >
                          {statusLabel(refund.status)}
                        </span>
                      </td>

                      <td className="px-4 py-4 align-top text-slate-400">
                        {refund.supplier?.supplier_name || "Not linked"}
                      </td>

                      <td className="max-w-xs px-4 py-4 align-top text-slate-400">
                        {refund.original_transaction?.title || "Not linked"}
                      </td>

                      <td className="px-4 py-4 align-top text-slate-400">
                        <p>{refund.hidden_by_name || "Unknown user"}</p>

                        {refund.hidden_by_email ? (
                          <p className="mt-1 text-xs text-slate-600">
                            {refund.hidden_by_email}
                          </p>
                        ) : null}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 align-top text-slate-400">
                        {formatDate(refund.hidden_at)}
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openRestoreModal(refund)}
                            disabled={workingId === refund.id}
                            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {workingId === refund.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Undo2 className="h-4 w-4" />
                            )}

                            Restore
                          </button>

                          <button
                            type="button"
                            onClick={() => openDeleteModal(refund)}
                            disabled={workingId === refund.id}
                            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete forever
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <RestoreRefundModal
        state={restoreModal}
        working={Boolean(workingId)}
        onClose={closeRestoreModal}
        onConfirm={restoreRefund}
      />

      <PermanentlyDeleteRefundModal
        state={deleteModal}
        working={Boolean(workingId)}
        confirmation={deleteConfirmation}
        onConfirmationChange={setDeleteConfirmation}
        onClose={closeDeleteModal}
        onConfirm={permanentlyDeleteRefund}
      />
    </main>
  );
}
