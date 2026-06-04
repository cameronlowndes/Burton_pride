"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Edit3,
  FileClock,
  FlaskConical,
  ListChecks,
  Loader2,
  Plus,
  RefreshCcw,
  RotateCcw,
  Search,
  Trash2,
  ExternalLink,
  Table2,
  X,
  XCircle,
} from "lucide-react";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
  notes: string | null;
  reference_number: string | null;
  original_transaction_id: string | null;
  supplier_id: string | null;
  status: RefundStatus;
  created_by_name: string | null;
  created_by_email: string | null;
  is_hidden: boolean;

  supplier?: {
    id: string;
    supplier_name: string;
  } | null;

  original_transaction?: {
    id: string;
    title: string;
    amount_pence: number;
    transaction_type: string;
    transaction_date: string;
  } | null;
};

type RefundSummary = {
  total_records: number;
  completed_records: number;
  money_received_back_pence: number;
  money_sent_back_pence: number;
  net_refunds_pence: number;
};

type SupplierOption = {
  id: string;
  supplier_name: string;
};

type TransactionOption = {
  id: string;
  title: string;
  amount_pence: number;
  transaction_type: string;
  transaction_date: string;
};

type RefundFormState = {
  year: string;
  refund_date: string;
  refund_type: RefundType;
  amount: string;
  title: string;
  notes: string;
  reference_number: string;
  supplier_id: string;
  original_transaction_id: string;
  status: RefundStatus;
};

type ApiResponse = {
  success?: boolean;
  ok?: boolean;
  message?: string;
  error?: string;
  details?: unknown;
  likelyFix?: string;
};

type RefundListResponse = ApiResponse & {
  refunds?: RefundRecord[];
  summary?: RefundSummary;
};

type DetailedError = {
  id: string;
  title: string;
  message: string;
  endpoint: string;
  method: string;
  status?: number;
  statusText?: string;
  serverDetails?: string;
  likelyFix: string;
  timestamp: string;
};

type ConfirmDialogTone = "danger" | "warning" | "test";

type ConfirmDialogState = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: ConfirmDialogTone;
};

const currentYear = new Date().getFullYear();
const today = new Date().toISOString().slice(0, 10);

const EMPTY_SUMMARY: RefundSummary = {
  total_records: 0,
  completed_records: 0,
  money_received_back_pence: 0,
  money_sent_back_pence: 0,
  net_refunds_pence: 0,
};

const DEFAULT_CONFIRM_DIALOG: ConfirmDialogState = {
  isOpen: false,
  title: "",
  message: "",
  confirmLabel: "Confirm",
  cancelLabel: "Cancel",
  tone: "warning",
};

const inputClass =
  "mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#090a17] px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-60";

function createDefaultForm(year = currentYear): RefundFormState {
  return {
    year: String(year),
    refund_date: today,
    refund_type: "money_received_back",
    amount: "",
    title: "",
    notes: "",
    reference_number: "",
    supplier_id: "",
    original_transaction_id: "",
    status: "completed",
  };
}

function formatMoney(amountPence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format((amountPence || 0) / 100);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function stringifyDetails(details: unknown): string {
  if (details === undefined || details === null) {
    return "";
  }

  if (typeof details === "string") {
    return details;
  }

  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
}

function getApiMessage(
  payload: ApiResponse | undefined,
  fallback: string
) {
  return payload?.message || payload?.error || fallback;
}

async function readApiResponse<T extends ApiResponse>(
  response: Response
): Promise<T> {
  const rawBody = await response.text();

  if (!rawBody) {
    return {} as T;
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    return {
      message:
        "The server returned a response that was not valid JSON.",
      details: rawBody.slice(0, 4000),
    } as T;
  }
}

function getLikelyFix({
  endpoint,
  status,
  message,
  details,
}: {
  endpoint: string;
  status?: number;
  message: string;
  details?: unknown;
}) {
  const combinedText = `${message} ${stringifyDetails(details)}`
    .toLowerCase()
    .trim();

  if (
    combinedText.includes("money_refunds") &&
    (combinedText.includes("does not exist") ||
      combinedText.includes("could not find") ||
      combinedText.includes("schema cache") ||
      combinedText.includes("relation"))
  ) {
    return "Create the public.money_refunds table in Supabase using the Refund Tracker SQL. If the table already exists, confirm that the table name is exactly money_refunds and reload the Supabase schema cache.";
  }

  if (
    combinedText.includes("money_suppliers") &&
    (combinedText.includes("does not exist") ||
      combinedText.includes("could not find") ||
      combinedText.includes("relation"))
  ) {
    return "Check that the public.money_suppliers table exists. Confirm that the supplier API route and the refund foreign key use the correct table name.";
  }

  if (
    combinedText.includes("money_transactions") &&
    (combinedText.includes("does not exist") ||
      combinedText.includes("could not find") ||
      combinedText.includes("relation"))
  ) {
    return "Check that the public.money_transactions table exists. Confirm that the transactions API route and the refund foreign key use the correct table name.";
  }

  if (
    combinedText.includes("relationship") ||
    combinedText.includes("foreign key") ||
    combinedText.includes("could not find a relationship")
  ) {
    return "Check the Supabase foreign-key relationships. money_refunds.supplier_id should link to money_suppliers.id and money_refunds.original_transaction_id should link to money_transactions.id.";
  }

  if (
    combinedText.includes("column") &&
    (combinedText.includes("does not exist") ||
      combinedText.includes("could not find") ||
      combinedText.includes("schema cache"))
  ) {
    return "A database column is missing or has a different name. Compare the Supabase table columns with the Refund Tracker SQL and update the API query if needed.";
  }

  if (
    combinedText.includes("invalid input syntax for type uuid") ||
    combinedText.includes("uuid")
  ) {
    return "One of the linked record IDs is not a valid UUID. Check the selected supplier, original transaction or refund ID.";
  }

  if (status === 401 || status === 403) {
    return "Your login session may have expired or your account may not have permission to use this page. Sign in again and confirm your admin access.";
  }

  if (status === 404) {
    return `The route ${endpoint} could not be found. Check that the API file exists inside the correct app/api folder and that the folder names match the URL exactly.`;
  }

  if (status === 405) {
    return "The route exists but does not support this request method. Check that the API route exports the correct named handler, such as GET, POST or PATCH.";
  }

  if (status === 500) {
    return "The server route failed while processing the request. Check the terminal or Vercel logs for the complete Supabase or Next.js error.";
  }

  if (status && status >= 400 && status < 500) {
    return "The request was rejected. Check the values entered and review the server details below.";
  }

  return "Refresh the page and try again. If the issue continues, check the browser console, terminal or Vercel logs.";
}

function createDetailedError({
  title,
  endpoint,
  method,
  response,
  payload,
}: {
  title: string;
  endpoint: string;
  method: string;
  response?: Response;
  payload?: ApiResponse;
}): DetailedError {
  const message = getApiMessage(
    payload,
    "The request failed without a clear error message."
  );

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title,
    message,
    endpoint,
    method,
    status: response?.status,
    statusText: response?.statusText,
    serverDetails: stringifyDetails(payload?.details),
    likelyFix:
      payload?.likelyFix ||
      getLikelyFix({
        endpoint,
        status: response?.status,
        message,
        details: payload?.details,
      }),
    timestamp: new Date().toLocaleString("en-GB"),
  };
}

function createNetworkError({
  title,
  endpoint,
  method,
  error,
}: {
  title: string;
  endpoint: string;
  method: string;
  error: unknown;
}): DetailedError {
  const message =
    error instanceof Error
      ? error.message
      : "The browser could not connect to the server.";

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title,
    message,
    endpoint,
    method,
    serverDetails:
      "No API response was received. This may be caused by a network issue, a server crash or a route that failed before returning JSON.",
    likelyFix:
      "Check that the development server is running. Then review the browser console, terminal or Vercel logs.",
    timestamp: new Date().toLocaleString("en-GB"),
  };
}

function normaliseSuppliers(payload: unknown): SupplierOption[] {
  if (!payload || typeof payload !== "object") return [];

  const record = payload as Record<string, unknown>;

  const source =
    (Array.isArray(record.suppliers) && record.suppliers) ||
    (Array.isArray(record.data) && record.data) ||
    (Array.isArray(payload) && payload) ||
    [];

  return source
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const supplier = item as Record<string, unknown>;

      const id =
        typeof supplier.id === "string" ? supplier.id : "";

      const supplierName =
        typeof supplier.supplier_name === "string"
          ? supplier.supplier_name
          : typeof supplier.name === "string"
            ? supplier.name
            : "";

      if (!id || !supplierName) return null;

      return {
        id,
        supplier_name: supplierName,
      };
    })
    .filter((item): item is SupplierOption => Boolean(item));
}

function normaliseTransactions(
  payload: unknown
): TransactionOption[] {
  if (!payload || typeof payload !== "object") return [];

  const record = payload as Record<string, unknown>;

  const source =
    (Array.isArray(record.transactions) && record.transactions) ||
    (Array.isArray(record.data) && record.data) ||
    (Array.isArray(payload) && payload) ||
    [];

  return source
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const transaction = item as Record<string, unknown>;

      const id =
        typeof transaction.id === "string"
          ? transaction.id
          : "";

      if (!id) return null;

      return {
        id,

        title:
          typeof transaction.title === "string"
            ? transaction.title
            : typeof transaction.description === "string"
              ? transaction.description
              : "Untitled transaction",

        amount_pence:
          typeof transaction.amount_pence === "number"
            ? transaction.amount_pence
            : 0,

        transaction_type:
          typeof transaction.transaction_type === "string"
            ? transaction.transaction_type
            : typeof transaction.type === "string"
              ? transaction.type
              : "transaction",

        transaction_date:
          typeof transaction.transaction_date === "string"
            ? transaction.transaction_date
            : "",
      };
    })
    .filter((item): item is TransactionOption => Boolean(item));
}

function StatusBadge({ status }: { status: RefundStatus }) {
  if (status === "completed") {
    return (
      <span className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-200">
        Completed
      </span>
    );
  }

  if (status === "pending") {
    return (
      <span className="inline-flex rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-200">
        Pending
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-slate-400/20 bg-slate-500/10 px-2.5 py-1 text-xs font-bold text-slate-300">
      Cancelled
    </span>
  );
}

function SummaryCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className: string;
}) {
  return (
    <article className={`rounded-[20px] border px-4 py-4 ${className}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide opacity-80">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </article>
  );
}

function DetailedErrorCard({
  error,
  onDismiss,
  onRetry,
}: {
  error: DetailedError;
  onDismiss: () => void;
  onRetry: () => void;
}) {
  return (
    <section className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-4 text-rose-100">
      <div className="flex items-start gap-3">
        <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-bold text-rose-100">
                {error.title}
              </p>

              <p className="mt-1 text-sm leading-6 text-rose-200">
                {error.message}
              </p>
            </div>

            <button
              type="button"
              onClick={onDismiss}
              className="self-start rounded-lg border border-rose-300/20 bg-rose-400/10 p-1.5 text-rose-200 transition hover:bg-rose-400/20"
              aria-label="Dismiss error"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-rose-300/10 bg-black/15 px-3 py-2">
              <p className="font-bold uppercase tracking-wide text-rose-300">
                Route
              </p>

              <p className="mt-1 break-all font-mono text-rose-100">
                {error.endpoint}
              </p>
            </div>

            <div className="rounded-lg border border-rose-300/10 bg-black/15 px-3 py-2">
              <p className="font-bold uppercase tracking-wide text-rose-300">
                Method
              </p>

              <p className="mt-1 font-mono text-rose-100">
                {error.method}
              </p>
            </div>

            <div className="rounded-lg border border-rose-300/10 bg-black/15 px-3 py-2">
              <p className="font-bold uppercase tracking-wide text-rose-300">
                HTTP status
              </p>

              <p className="mt-1 font-mono text-rose-100">
                {error.status
                  ? `${error.status} ${error.statusText || ""}`.trim()
                  : "No response received"}
              </p>
            </div>

            <div className="rounded-lg border border-rose-300/10 bg-black/15 px-3 py-2">
              <p className="font-bold uppercase tracking-wide text-rose-300">
                Time
              </p>

              <p className="mt-1 text-rose-100">{error.timestamp}</p>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-amber-300/20 bg-amber-400/10 px-3 py-3 text-sm">
            <p className="font-bold text-amber-200">
              Likely fix
            </p>

            <p className="mt-1 leading-6 text-amber-100">
              {error.likelyFix}
            </p>
          </div>

          {error.serverDetails ? (
            <details className="mt-3 rounded-lg border border-rose-300/10 bg-black/15 px-3 py-3">
              <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-rose-200">
                Show server details
              </summary>

              <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/20 p-3 text-xs leading-5 text-rose-100">
                {error.serverDetails}
              </pre>
            </details>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs font-bold text-rose-100 transition hover:bg-rose-400/20"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Retry loading
            </button>

            <button
              type="button"
              onClick={onDismiss}
              className="inline-flex min-h-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ConfirmDialog({
  dialog,
  onCancel,
  onConfirm,
}: {
  dialog: ConfirmDialogState;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!dialog.isOpen) {
    return null;
  }

  const confirmButtonClass =
    dialog.tone === "danger"
      ? "bg-rose-500 text-white hover:bg-rose-400"
      : dialog.tone === "test"
        ? "bg-violet-500 text-white hover:bg-violet-400"
        : "bg-amber-400 text-slate-950 hover:bg-amber-300";

  const iconClass =
    dialog.tone === "danger"
      ? "border-rose-400/20 bg-rose-500/10 text-rose-200"
      : dialog.tone === "test"
        ? "border-violet-400/20 bg-violet-500/10 text-violet-200"
        : "border-amber-400/20 bg-amber-500/10 text-amber-200";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm">
      <section className="w-full max-w-lg overflow-hidden rounded-[22px] border border-white/10 bg-[#10101f] shadow-2xl shadow-black/50">
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${iconClass}`}
            >
              {dialog.tone === "test" ? (
                <FlaskConical className="h-5 w-5" />
              ) : (
                <CircleAlert className="h-5 w-5" />
              )}
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Refund Tracker
              </p>

              <h2 className="mt-1 text-lg font-bold text-white">
                {dialog.title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
            aria-label="Close confirmation message"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="px-5 py-5">
          <p className="text-sm leading-6 text-slate-300">
            {dialog.message}
          </p>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              {dialog.cancelLabel}
            </button>

            <button
              type="button"
              onClick={onConfirm}
              className={`inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-xs font-bold transition ${confirmButtonClass}`}
            >
              {dialog.confirmLabel}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}


function TransactionBrowserDialog({
  isOpen,
  transactions,
  searchTerm,
  onSearchTermChange,
  onClose,
  onOpenFullPage,
  onSelectTransaction,
}: {
  isOpen: boolean;
  transactions: TransactionOption[];
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onClose: () => void;
  onOpenFullPage: () => void;
  onSelectTransaction: (transaction: TransactionOption) => void;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] hidden items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm md:flex">
      <section className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-[22px] border border-white/10 bg-[#10101f] shadow-2xl shadow-black/60">
        <header className="flex flex-col gap-4 border-b border-white/10 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-500/10 text-sky-200">
              <Table2 className="h-5 w-5" />
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-sky-300">
                Money Tracker
              </p>

              <h2 className="mt-1 text-xl font-bold text-white">
                Transaction Table
              </h2>

              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
                View the available transactions without leaving the Refund
                Tracker. Choose a transaction to link it to the refund form.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenFullPage}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-sky-400/20 bg-sky-500/10 px-4 py-2 text-xs font-bold text-sky-200 transition hover:bg-sky-500/20"
            >
              <ExternalLink className="h-4 w-4" />
              Open Full Transaction Page
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-300 transition hover:bg-white/10 hover:text-white"
              aria-label="Close transaction table"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="border-b border-white/10 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />

            <input
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              placeholder="Search transaction title, type, date or amount..."
              className="h-11 w-full rounded-xl border border-white/10 bg-[#090a17] pl-10 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-400/50"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {transactions.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
              <Table2 className="h-9 w-9 text-slate-700" />

              <h3 className="mt-4 text-base font-bold text-white">
                No transactions found
              </h3>

              <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">
                Try another search or refresh the Refund Tracker options.
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-[#181829] text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Transaction</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {transactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className="bg-[#090a17] transition hover:bg-white/[0.04]"
                  >
                    <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-2">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDate(transaction.transaction_date)}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <p className="font-bold text-white">
                        {transaction.title}
                      </p>

                      <p className="mt-1 break-all text-xs text-slate-600">
                        {transaction.id}
                      </p>
                    </td>

                    <td className="px-4 py-4 text-xs text-slate-300">
                      {transaction.transaction_type}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 font-bold text-white">
                      {formatMoney(transaction.amount_pence)}
                    </td>

                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectTransaction(transaction)}
                        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl bg-cyan-500 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-400"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Link Transaction
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

export default function MoneyRefundTracker() {
  const router = useRouter();

  const [refunds, setRefunds] = useState<RefundRecord[]>([]);

  const [summary, setSummary] =
    useState<RefundSummary>(EMPTY_SUMMARY);

  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);

  const [transactions, setTransactions] = useState<
    TransactionOption[]
  >([]);

  const [selectedYear, setSelectedYear] = useState(
    String(currentYear)
  );

  const [searchTerm, setSearchTerm] = useState("");

  const [statusFilter, setStatusFilter] = useState<
    "all" | RefundStatus
  >("all");

  const [typeFilter, setTypeFilter] = useState<
    "all" | RefundType
  >("all");

  const [form, setForm] = useState<RefundFormState>(() =>
    createDefaultForm(currentYear)
  );

  const [editingId, setEditingId] = useState<string | null>(null);

  const [workingId, setWorkingId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const [isLoadingOptions, setIsLoadingOptions] = useState(true);

  const [isSaving, setIsSaving] = useState(false);

  const [isCreatingTest, setIsCreatingTest] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [isTransactionBrowserOpen, setIsTransactionBrowserOpen] =
    useState(false);

  const [transactionBrowserSearch, setTransactionBrowserSearch] =
    useState("");

  const [detailedErrors, setDetailedErrors] = useState<
    DetailedError[]
  >([]);

  const [successMessage, setSuccessMessage] = useState("");

  const [confirmDialog, setConfirmDialog] =
    useState<ConfirmDialogState>(DEFAULT_CONFIRM_DIALOG);

  const confirmResolverRef = useRef<
    ((confirmed: boolean) => void) | null
  >(null);

  const filteredRefunds = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return refunds.filter((refund) => {
      if (
        statusFilter !== "all" &&
        refund.status !== statusFilter
      ) {
        return false;
      }

      if (
        typeFilter !== "all" &&
        refund.refund_type !== typeFilter
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        refund.title,
        refund.notes,
        refund.reference_number,
        refund.supplier?.supplier_name,
        refund.original_transaction?.title,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [refunds, searchTerm, statusFilter, typeFilter]);

  const filteredTransactionOptions = useMemo(() => {
    const query = transactionBrowserSearch.trim().toLowerCase();

    if (!query) {
      return transactions;
    }

    return transactions.filter((transaction) =>
      [
        transaction.title,
        transaction.transaction_type,
        transaction.transaction_date,
        String(transaction.amount_pence),
        formatMoney(transaction.amount_pence),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [transactionBrowserSearch, transactions]);

  const reportError = useCallback((error: DetailedError) => {
    setDetailedErrors((current) => {
      const withoutDuplicate = current.filter(
        (item) =>
          !(
            item.title === error.title &&
            item.endpoint === error.endpoint &&
            item.method === error.method &&
            item.status === error.status &&
            item.message === error.message
          )
      );

      return [error, ...withoutDuplicate].slice(0, 5);
    });
  }, []);

  const dismissError = useCallback((errorId: string) => {
    setDetailedErrors((current) =>
      current.filter((item) => item.id !== errorId)
    );
  }, []);

  const clearErrors = useCallback(() => {
    setDetailedErrors([]);
  }, []);

  const loadRefunds = useCallback(async () => {
    setIsLoading(true);

    const endpoint = `/api/admin/money/refunds?year=${encodeURIComponent(
      selectedYear
    )}&limit=500`;

    try {
      const response = await fetch(endpoint, {
        cache: "no-store",
      });

      const payload =
        await readApiResponse<RefundListResponse>(response);

      if (!response.ok) {
        setRefunds([]);
        setSummary(EMPTY_SUMMARY);

        reportError(
          createDetailedError({
            title: "Refunds could not be loaded",
            endpoint,
            method: "GET",
            response,
            payload,
          })
        );

        return;
      }

      setRefunds(
        Array.isArray(payload.refunds) ? payload.refunds : []
      );

      setSummary(payload.summary ?? EMPTY_SUMMARY);
    } catch (error) {
      setRefunds([]);
      setSummary(EMPTY_SUMMARY);

      reportError(
        createNetworkError({
          title: "Refunds could not be loaded",
          endpoint,
          method: "GET",
          error,
        })
      );
    } finally {
      setIsLoading(false);
    }
  }, [reportError, selectedYear]);

  const loadOptions = useCallback(async () => {
    setIsLoadingOptions(true);

    const supplierEndpoint =
      "/api/admin/money/suppliers?limit=500";

    const transactionEndpoint =
      `/api/admin/money/transactions?year=${encodeURIComponent(
        selectedYear
      )}&limit=500`;

    try {
      const [supplierResult, transactionResult] =
        await Promise.allSettled([
          fetch(supplierEndpoint, {
            cache: "no-store",
          }),

          fetch(transactionEndpoint, {
            cache: "no-store",
          }),
        ]);

      if (supplierResult.status === "fulfilled") {
        const supplierResponse = supplierResult.value;

        const supplierPayload =
          await readApiResponse<ApiResponse>(supplierResponse);

        if (supplierResponse.ok) {
          setSuppliers(normaliseSuppliers(supplierPayload));
        } else {
          setSuppliers([]);

          reportError(
            createDetailedError({
              title: "Supplier options could not be loaded",
              endpoint: supplierEndpoint,
              method: "GET",
              response: supplierResponse,
              payload: supplierPayload,
            })
          );
        }
      } else {
        setSuppliers([]);

        reportError(
          createNetworkError({
            title: "Supplier options could not be loaded",
            endpoint: supplierEndpoint,
            method: "GET",
            error: supplierResult.reason,
          })
        );
      }

      if (transactionResult.status === "fulfilled") {
        const transactionResponse = transactionResult.value;

        const transactionPayload =
          await readApiResponse<ApiResponse>(transactionResponse);

        if (transactionResponse.ok) {
          setTransactions(
            normaliseTransactions(transactionPayload)
          );
        } else {
          setTransactions([]);

          reportError(
            createDetailedError({
              title: "Transaction options could not be loaded",
              endpoint: transactionEndpoint,
              method: "GET",
              response: transactionResponse,
              payload: transactionPayload,
            })
          );
        }
      } else {
        setTransactions([]);

        reportError(
          createNetworkError({
            title: "Transaction options could not be loaded",
            endpoint: transactionEndpoint,
            method: "GET",
            error: transactionResult.reason,
          })
        );
      }
    } finally {
      setIsLoadingOptions(false);
    }
  }, [reportError, selectedYear]);

  const reloadEverything = useCallback(async () => {
    clearErrors();
    setSuccessMessage("");

    await Promise.all([loadRefunds(), loadOptions()]);
  }, [clearErrors, loadOptions, loadRefunds]);

  useEffect(() => {
    void Promise.all([loadRefunds(), loadOptions()]);
  }, [loadOptions, loadRefunds]);

  useEffect(() => {
    return () => {
      if (confirmResolverRef.current) {
        confirmResolverRef.current(false);
        confirmResolverRef.current = null;
      }
    };
  }, []);

  function requestConfirmation({
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    tone = "warning",
  }: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: ConfirmDialogTone;
  }) {
    return new Promise<boolean>((resolve) => {
      if (confirmResolverRef.current) {
        confirmResolverRef.current(false);
      }

      confirmResolverRef.current = resolve;

      setConfirmDialog({
        isOpen: true,
        title,
        message,
        confirmLabel,
        cancelLabel,
        tone,
      });
    });
  }

  function closeConfirmation(confirmed: boolean) {
    const resolver = confirmResolverRef.current;

    confirmResolverRef.current = null;

    setConfirmDialog(DEFAULT_CONFIRM_DIALOG);

    if (resolver) {
      resolver(confirmed);
    }
  }

  function openTransactionBrowser() {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches
    ) {
      router.push(
        "/Admin/MoneyManagement/TrackingMoney"
      );

      return;
    }

    setTransactionBrowserSearch("");
    setIsTransactionBrowserOpen(true);
  }

  function closeTransactionBrowser() {
    setIsTransactionBrowserOpen(false);
    setTransactionBrowserSearch("");
  }

  function openFullTransactionPage() {
    router.push(
      "/Admin/MoneyManagement/TrackingMoney"
    );
  }

  function selectTransactionFromBrowser(transaction: TransactionOption) {
    updateForm("original_transaction_id", transaction.id);

    setIsTransactionBrowserOpen(false);
    setTransactionBrowserSearch("");

    if (!isModalOpen) {
      setEditingId(null);
      setIsModalOpen(true);
    }
  }

  function updateForm<K extends keyof RefundFormState>(
    key: K,
    value: RefundFormState[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function openAddModal() {
    setEditingId(null);

    setForm(createDefaultForm(Number(selectedYear)));

    setIsModalOpen(true);
  }

  function openEditModal(refund: RefundRecord) {
    setEditingId(refund.id);

    setForm({
      year: String(refund.year),
      refund_date: refund.refund_date.slice(0, 10),
      refund_type: refund.refund_type,
      amount: (refund.amount_pence / 100).toFixed(2),
      title: refund.title,
      notes: refund.notes ?? "",
      reference_number: refund.reference_number ?? "",
      supplier_id: refund.supplier_id ?? "",
      original_transaction_id:
        refund.original_transaction_id ?? "",
      status: refund.status,
    });

    setIsModalOpen(true);
  }

  function closeModal(force = false) {
    if (isSaving && !force) {
      return;
    }

    setIsModalOpen(false);

    setEditingId(null);

    setForm(createDefaultForm(Number(selectedYear)));
  }

  async function createTestRefund() {
    const confirmed = await requestConfirmation({
      title: "Create test refund?",
      message:
        "This will add a real £15.00 completed test refund to the Refund Tracker. You can move it to Deleted Refunds afterwards when you have finished testing.",
      confirmLabel: "Create Test Refund",
      cancelLabel: "Cancel",
      tone: "test",
    });

    if (!confirmed) {
      return;
    }

    const endpoint = "/api/admin/money/refunds";
    const method = "POST";

    setIsCreatingTest(true);

    clearErrors();

    setSuccessMessage("");

    const timestamp = Date.now();

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          year: Number(selectedYear),
          refund_date: today,
          refund_type: "money_received_back",
          amount: "15.00",
          title: "Test refund from supplier",
          notes:
            "Test refund record created using the Add Test Refund button. This checks that the Refund Tracker can save, display, calculate and delete refunds correctly.",
          reference_number: `TEST-REFUND-${timestamp}`,
          supplier_id: null,
          original_transaction_id: null,
          status: "completed",
        }),
      });

      const payload =
        await readApiResponse<ApiResponse>(response);

      if (!response.ok) {
        reportError(
          createDetailedError({
            title: "Test refund could not be created",
            endpoint,
            method,
            response,
            payload,
          })
        );

        return;
      }

      setSuccessMessage(
        "Test refund created successfully. £15.00 has been added to Money received back."
      );

      await loadRefunds();
    } catch (error) {
      reportError(
        createNetworkError({
          title: "Test refund could not be created",
          endpoint,
          method,
          error,
        })
      );
    } finally {
      setIsCreatingTest(false);
    }
  }

  async function saveRefund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const endpoint = "/api/admin/money/refunds";

    const method = editingId ? "PATCH" : "POST";

    setIsSaving(true);

    clearErrors();

    setSuccessMessage("");

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(editingId
            ? {
                id: editingId,
                action: "update",
              }
            : {}),

          year: Number(form.year),

          refund_date: form.refund_date,

          refund_type: form.refund_type,

          amount: form.amount,

          title: form.title,

          notes: form.notes,

          reference_number: form.reference_number,

          supplier_id: form.supplier_id || null,

          original_transaction_id:
            form.original_transaction_id || null,

          status: form.status,
        }),
      });

      const payload =
        await readApiResponse<ApiResponse>(response);

      if (!response.ok) {
        reportError(
          createDetailedError({
            title: editingId
              ? "Refund could not be updated"
              : "Refund could not be added",
            endpoint,
            method,
            response,
            payload,
          })
        );

        return;
      }

      setSuccessMessage(
        editingId
          ? "Refund updated successfully."
          : "Refund added successfully."
      );

      closeModal(true);

      await loadRefunds();
    } catch (error) {
      reportError(
        createNetworkError({
          title: editingId
            ? "Refund could not be updated"
            : "Refund could not be added",
          endpoint,
          method,
          error,
        })
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function runAction(
    refund: RefundRecord,
    action:
      | "hide"
      | "cancel"
      | "mark_completed"
      | "mark_pending"
  ) {
    if (action === "hide") {
      const confirmed = await requestConfirmation({
        title: "Move refund to Deleted Refunds?",
        message: `Move "${refund.title}" to Deleted Refunds? This is a soft delete. You can restore the refund later.`,
        confirmLabel: "Move to Deleted Refunds",
        cancelLabel: "Keep Refund",
        tone: "danger",
      });

      if (!confirmed) {
        return;
      }
    }

    if (action === "cancel") {
      const confirmed = await requestConfirmation({
        title: "Cancel this refund?",
        message: `Mark "${refund.title}" as cancelled? The refund will remain visible for audit purposes, but it will no longer be included in completed refund totals.`,
        confirmLabel: "Cancel Refund",
        cancelLabel: "Keep Refund",
        tone: "warning",
      });

      if (!confirmed) {
        return;
      }
    }

    const endpoint = "/api/admin/money/refunds";

    const method = "PATCH";

    setWorkingId(refund.id);

    clearErrors();

    setSuccessMessage("");

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: refund.id,
          action,
        }),
      });

      const payload =
        await readApiResponse<ApiResponse>(response);

      if (!response.ok) {
        reportError(
          createDetailedError({
            title: `Refund action failed: ${action}`,
            endpoint,
            method,
            response,
            payload,
          })
        );

        return;
      }

      setSuccessMessage(
        action === "hide"
          ? "Refund moved to Deleted Refunds."
          : action === "cancel"
            ? "Refund marked as cancelled."
            : action === "mark_completed"
              ? "Refund marked as completed."
              : "Refund marked as pending."
      );

      await loadRefunds();
    } catch (error) {
      reportError(
        createNetworkError({
          title: `Refund action failed: ${action}`,
          endpoint,
          method,
          error,
        })
      );
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
                href="/Admin/MoneyManagement/TrackingMoney"
                className="inline-flex min-h-8 w-fit items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-white/15 hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Money Tracker
              </Link>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void reloadEverything()}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/15 hover:text-white"
                >
                  <RotateCcw className="h-4 w-4" />
                  Refresh
                </button>

                <button
                  type="button"
                  onClick={openTransactionBrowser}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-200 transition hover:bg-cyan-500/20"
                >
                  <Table2 className="h-4 w-4" />
                  View Transactions
                </button>

                <button
                  type="button"
                  onClick={() => void createTestRefund()}
                  disabled={isCreatingTest}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 py-2 text-xs font-bold text-violet-200 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCreatingTest ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FlaskConical className="h-4 w-4" />
                  )}

                  {isCreatingTest
                    ? "Creating Test..."
                    : "Add Test Refund"}
                </button>

                <Link
                  href="/Admin/MoneyManagement/TrackingMoney/AuditLogs"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-sky-400/20 bg-sky-500/10 px-4 py-2 text-xs font-bold text-sky-200 transition hover:bg-sky-500/20"
                >
                  <ListChecks className="h-4 w-4" />
                  Refund Logs
                </Link>

                <Link
                  href="/Admin/MoneyManagement/TrackingMoney/Refunds/Delete"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-2 text-xs font-bold text-rose-200 transition hover:bg-rose-500/20"
                >
                  <FileClock className="h-4 w-4" />
                  Deleted Refunds
                </Link>

                <button
                  type="button"
                  onClick={openAddModal}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-400"
                >
                  <Plus className="h-4 w-4" />
                  Add Refund
                </button>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
                <RefreshCcw className="h-5 w-5" />
              </div>

              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Refund Tracker
                </h1>

                <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-400">
                  View, add, edit and archive refunds separately from
                  ordinary income and expenses. Link refunds to suppliers
                  and the original payment where needed.
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          <SummaryCard
            label="Money received back"
            value={formatMoney(summary.money_received_back_pence)}
            className="border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
          />

          <SummaryCard
            label="Money sent back"
            value={formatMoney(summary.money_sent_back_pence)}
            className="border-sky-400/20 bg-sky-500/10 text-sky-200"
          />

          <SummaryCard
            label="Completed refunds"
            value={String(summary.completed_records)}
            className="border-amber-400/20 bg-amber-500/10 text-amber-200"
          />
        </section>

        {detailedErrors.map((error) => (
          <DetailedErrorCard
            key={error.id}
            error={error}
            onDismiss={() => dismissError(error.id)}
            onRetry={() => void reloadEverything()}
          />
        ))}

        {successMessage ? (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />

            <p className="flex-1">{successMessage}</p>

            <button
              type="button"
              onClick={() => setSuccessMessage("")}
              aria-label="Dismiss success message"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <section className="rounded-[22px] border border-white/10 bg-[#10101f] p-3 shadow-xl shadow-black/10">
          <div className="grid gap-2 lg:grid-cols-12">
            <div className="relative lg:col-span-6">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />

              <input
                type="search"
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(event.target.value)
                }
                placeholder="Search refund, supplier, reference, notes..."
                className="h-10 w-full rounded-xl border border-white/10 bg-[#090a17] pl-10 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400/50"
              />
            </div>

            <select
              value={selectedYear}
              onChange={(event) =>
                setSelectedYear(event.target.value)
              }
              className="h-10 rounded-xl border border-white/10 bg-[#090a17] px-3 text-sm font-semibold text-slate-200 outline-none lg:col-span-2"
            >
              <option value={String(currentYear)}>
                {currentYear}
              </option>

              <option value={String(currentYear - 1)}>
                {currentYear - 1}
              </option>

              <option value={String(currentYear + 1)}>
                {currentYear + 1}
              </option>
            </select>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as "all" | RefundStatus
                )
              }
              className="h-10 rounded-xl border border-white/10 bg-[#090a17] px-3 text-sm font-semibold text-slate-200 outline-none lg:col-span-2"
            >
              <option value="all">All statuses</option>
              <option value="completed">Completed only</option>
              <option value="pending">Pending only</option>
              <option value="cancelled">Cancelled only</option>
            </select>

            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(
                  event.target.value as "all" | RefundType
                )
              }
              className="h-10 rounded-xl border border-white/10 bg-[#090a17] px-3 text-sm font-semibold text-slate-200 outline-none lg:col-span-2"
            >
              <option value="all">All refund types</option>
              <option value="money_received_back">
                Money received back
              </option>
              <option value="money_sent_back">
                Money sent back
              </option>
            </select>
          </div>
        </section>

        <section className="rounded-[22px] border border-white/10 bg-[#10101f] p-3 shadow-xl shadow-black/10">
          {isLoading ? (
            <div className="flex min-h-48 items-center justify-center rounded-xl border border-white/10 bg-[#090a17]">
              <Loader2 className="h-7 w-7 animate-spin text-cyan-300" />
            </div>
          ) : filteredRefunds.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-white/10 bg-[#090a17] px-4 py-10 text-center">
              <RefreshCcw className="h-8 w-8 text-slate-600" />

              <h3 className="mt-3 text-base font-bold text-white">
                No refunds found
              </h3>

              <p className="mt-1 max-w-lg text-xs leading-5 text-slate-500">
                Add your first refund or create a test refund to confirm
                that the tracker is working.
              </p>

              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => void createTestRefund()}
                  disabled={isCreatingTest}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 py-2 text-xs font-bold text-violet-200 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCreatingTest ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FlaskConical className="h-4 w-4" />
                  )}

                  {isCreatingTest
                    ? "Creating Test..."
                    : "Add Test Refund"}
                </button>

                <button
                  type="button"
                  onClick={openAddModal}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-400"
                >
                  <Plus className="h-4 w-4" />
                  Add Refund
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="min-w-[1200px] w-full text-left text-sm">
                <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Refund</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">
                      Original transaction
                    </th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/10">
                  {filteredRefunds.map((refund) => {
                    const isWorking = workingId === refund.id;

                    return (
                      <tr
                        key={refund.id}
                        className="bg-[#090a17] transition hover:bg-white/[0.04]"
                      >
                        <td className="px-4 py-3">
                          <p className="font-bold text-white">
                            {refund.title}
                          </p>

                          {refund.notes ? (
                            <p className="mt-1 max-w-xs text-xs text-slate-500">
                              {refund.notes}
                            </p>
                          ) : null}
                        </td>

                        <td className="px-4 py-3 text-xs text-slate-300">
                          {refund.refund_type ===
                          "money_received_back"
                            ? "Money received back"
                            : "Money sent back"}
                        </td>

                        <td className="px-4 py-3 font-bold text-white">
                          {formatMoney(refund.amount_pence)}
                        </td>

                        <td className="px-4 py-3 text-xs text-slate-400">
                          <span className="inline-flex items-center gap-2">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {formatDate(refund.refund_date)}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <StatusBadge status={refund.status} />
                        </td>

                        <td className="px-4 py-3 text-xs text-slate-400">
                          {refund.supplier?.supplier_name ||
                            "Not linked"}
                        </td>

                        <td className="px-4 py-3 text-xs text-slate-400">
                          {refund.original_transaction?.title ||
                            "Not linked"}
                        </td>

                        <td className="px-4 py-3 text-xs text-slate-400">
                          {refund.reference_number ||
                            "Not recorded"}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                openEditModal(refund)
                              }
                              className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10"
                              title="Edit refund"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>

                            {refund.status === "pending" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void runAction(
                                    refund,
                                    "mark_completed"
                                  )
                                }
                                className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-2 text-emerald-200 transition hover:bg-emerald-500/20"
                                title="Mark completed"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </button>
                            ) : null}

                            {refund.status === "completed" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void runAction(
                                    refund,
                                    "mark_pending"
                                  )
                                }
                                className="rounded-lg border border-amber-400/20 bg-amber-500/10 p-2 text-amber-200 transition hover:bg-amber-500/20"
                                title="Mark pending"
                              >
                                <Clock3 className="h-4 w-4" />
                              </button>
                            ) : null}

                            {refund.status !== "cancelled" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void runAction(refund, "cancel")
                                }
                                className="rounded-lg border border-slate-400/20 bg-slate-500/10 p-2 text-slate-300 transition hover:bg-slate-500/20"
                                title="Cancel refund"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            ) : null}

                            <button
                              type="button"
                              disabled={isWorking}
                              onClick={() =>
                                void runAction(refund, "hide")
                              }
                              className="rounded-lg border border-rose-400/20 bg-rose-500/10 p-2 text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
                              title="Move to deleted refunds"
                            >
                              {isWorking ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-3 py-6 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[22px] border border-white/10 bg-[#10101f] shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-cyan-300">
                  Refund Tracker
                </p>

                <h2 className="mt-1 text-xl font-bold text-white">
                  {editingId ? "Edit Refund" : "Add Refund"}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => closeModal()}
                className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10"
                aria-label="Close refund form"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {detailedErrors.length > 0 ? (
              <div className="space-y-3 border-b border-white/10 p-4">
                {detailedErrors.map((error) => (
                  <DetailedErrorCard
                    key={`modal-${error.id}`}
                    error={error}
                    onDismiss={() => dismissError(error.id)}
                    onRetry={() => void reloadEverything()}
                  />
                ))}
              </div>
            ) : null}

            <form
              onSubmit={saveRefund}
              className="grid gap-4 p-5 xl:grid-cols-12"
            >
              <label className="xl:col-span-3">
                <span className="text-xs font-bold text-slate-300">
                  Refund type
                </span>

                <select
                  value={form.refund_type}
                  onChange={(event) =>
                    updateForm(
                      "refund_type",
                      event.target.value as RefundType
                    )
                  }
                  className={inputClass}
                >
                  <option value="money_received_back">
                    Money received back
                  </option>

                  <option value="money_sent_back">
                    Money sent back
                  </option>
                </select>
              </label>

              <label className="xl:col-span-2">
                <span className="text-xs font-bold text-slate-300">
                  Amount
                </span>

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) =>
                    updateForm("amount", event.target.value)
                  }
                  required
                  placeholder="0.00"
                  className={inputClass}
                />
              </label>

              <label className="xl:col-span-2">
                <span className="text-xs font-bold text-slate-300">
                  Refund date
                </span>

                <input
                  type="date"
                  value={form.refund_date}
                  onChange={(event) =>
                    updateForm(
                      "refund_date",
                      event.target.value
                    )
                  }
                  required
                  className={inputClass}
                />
              </label>

              <label className="xl:col-span-2">
                <span className="text-xs font-bold text-slate-300">
                  Year
                </span>

                <input
                  type="number"
                  min="2000"
                  max="2200"
                  value={form.year}
                  onChange={(event) =>
                    updateForm("year", event.target.value)
                  }
                  required
                  className={inputClass}
                />
              </label>

              <label className="xl:col-span-3">
                <span className="text-xs font-bold text-slate-300">
                  Status
                </span>

                <select
                  value={form.status}
                  onChange={(event) =>
                    updateForm(
                      "status",
                      event.target.value as RefundStatus
                    )
                  }
                  className={inputClass}
                >
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>

              <label className="xl:col-span-7">
                <span className="text-xs font-bold text-slate-300">
                  Refund title
                </span>

                <input
                  type="text"
                  value={form.title}
                  onChange={(event) =>
                    updateForm("title", event.target.value)
                  }
                  required
                  placeholder="Example: Partial refund from supplier"
                  className={inputClass}
                />
              </label>

              <label className="xl:col-span-5">
                <span className="text-xs font-bold text-slate-300">
                  Reference number
                </span>

                <input
                  type="text"
                  value={form.reference_number}
                  onChange={(event) =>
                    updateForm(
                      "reference_number",
                      event.target.value
                    )
                  }
                  placeholder="Optional reference number"
                  className={inputClass}
                />
              </label>

              <label className="xl:col-span-6">
                <span className="text-xs font-bold text-slate-300">
                  Link supplier
                </span>

                <select
                  value={form.supplier_id}
                  onChange={(event) =>
                    updateForm(
                      "supplier_id",
                      event.target.value
                    )
                  }
                  disabled={isLoadingOptions}
                  className={inputClass}
                >
                  <option value="">No supplier linked</option>

                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.supplier_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="xl:col-span-6">
                <span className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-300">
                  <span>Link original transaction</span>

                  <button
                    type="button"
                    onClick={openTransactionBrowser}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1.5 text-[11px] font-bold text-cyan-200 transition hover:bg-cyan-500/20"
                  >
                    <Table2 className="h-3.5 w-3.5" />
                    Browse Transactions
                  </button>
                </span>

                <select
                  value={form.original_transaction_id}
                  onChange={(event) =>
                    updateForm(
                      "original_transaction_id",
                      event.target.value
                    )
                  }
                  disabled={isLoadingOptions}
                  className={inputClass}
                >
                  <option value="">
                    No original transaction linked
                  </option>

                  {transactions.map((transaction) => (
                    <option
                      key={transaction.id}
                      value={transaction.id}
                    >
                      {formatDate(transaction.transaction_date)} —{" "}
                      {transaction.title} —{" "}
                      {formatMoney(transaction.amount_pence)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="xl:col-span-12">
                <span className="text-xs font-bold text-slate-300">
                  Notes
                </span>

                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    updateForm("notes", event.target.value)
                  }
                  rows={4}
                  placeholder="Add any useful details about the refund."
                  className="mt-2 w-full rounded-xl border border-white/10 bg-[#090a17] px-3 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/10"
                />
              </label>

              <div className="flex flex-col-reverse gap-2 border-t border-white/10 pt-4 sm:flex-row sm:justify-end xl:col-span-12">
                <button
                  type="button"
                  onClick={() => closeModal()}
                  disabled={isSaving}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/10 disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-cyan-500 px-5 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}

                  {editingId ? "Save Refund" : "Add Refund"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <TransactionBrowserDialog
        isOpen={isTransactionBrowserOpen}
        transactions={filteredTransactionOptions}
        searchTerm={transactionBrowserSearch}
        onSearchTermChange={setTransactionBrowserSearch}
        onClose={closeTransactionBrowser}
        onOpenFullPage={openFullTransactionPage}
        onSelectTransaction={selectTransactionFromBrowser}
      />

      <ConfirmDialog
        dialog={confirmDialog}
        onCancel={() => closeConfirmation(false)}
        onConfirm={() => closeConfirmation(true)}
      />
    </main>
  );
}