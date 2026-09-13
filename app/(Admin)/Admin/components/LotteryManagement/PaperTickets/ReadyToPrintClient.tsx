"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  EMPTY_PRINT_CHECKS,
  PRINT_CHECK_LABELS,
  type PaperBatchSummary,
  type PrintChecks,
} from "@/lib/lottery/paper-print-types";

const LIST_API =
  "/api/admin/lotterymanagement/tickets/paper/batches/ready-to-print";

const button =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-purple-400/30 bg-purple-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-purple-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-400 disabled:cursor-not-allowed disabled:opacity-50";

const secondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-bold text-white/80 transition hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-400 disabled:cursor-not-allowed disabled:opacity-40";

const input =
  "w-full rounded-xl border border-white/10 bg-[#0f1420] px-4 py-3 text-sm text-white focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30";

const card =
  "rounded-3xl border border-white/10 bg-[#151927] p-5 sm:p-6";

const statusLabels: Record<string, string> = {
  generated: "PDF needed",
  ready_to_print: "Ready to print",
  printed: "Printed",
  cancelled: "Cancelled",
};

type DebugError = {
  message: string;
  code: string;
  endpoint?: string;
  method?: string;
  httpStatus?: number;
  statusText?: string;
  requestId?: string;
  hint?: string;
  details?: string;
  technicalDetails?: string;
  responseBody?: string;
  contentType?: string;
  occurredAt: string;
  durationMs?: number;
  context?: Record<string, unknown>;
};

class DetailedApiError extends Error {
  debug: DebugError;

  constructor(debug: DebugError) {
    super(debug.message);
    this.name = "DetailedApiError";
    this.debug = debug;
  }
}

const REDACTED_KEYS = [
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "api_key",
  "apikey",
  "service_role",
  "refresh_token",
  "access_token",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value == null) return undefined;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function redactForDebug(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[Maximum debug depth reached]";

  if (Array.isArray(value)) {
    return value.map((item) => redactForDebug(item, depth + 1));
  }

  if (!isRecord(value)) return value;

  const output: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value)) {
    const lower = key.toLowerCase();
    if (REDACTED_KEYS.some((secret) => lower.includes(secret))) {
      output[key] = "[REDACTED]";
    } else {
      output[key] = redactForDebug(item, depth + 1);
    }
  }

  return output;
}

function truncate(value: string | undefined, max = 8000) {
  if (!value) return undefined;
  return value.length > max
    ? `${value.slice(0, max)}\n\n[Truncated after ${max.toLocaleString("en-GB")} characters]`
    : value;
}

function requestIdFromHeaders(headers: Headers) {
  return (
    headers.get("x-request-id") ||
    headers.get("x-vercel-id") ||
    headers.get("x-amzn-requestid") ||
    headers.get("cf-ray") ||
    undefined
  );
}

function serverMessage(data: Record<string, unknown> | null) {
  return (
    stringValue(data?.message) ||
    stringValue(data?.error) ||
    "The request could not be completed."
  );
}

function buildServerDetails(
  data: Record<string, unknown> | null,
  rawBody: string,
) {
  const redacted = data ? redactForDebug(data) : null;

  return {
    code:
      stringValue(data?.code) ||
      stringValue(data?.error_code) ||
      stringValue(data?.errorCode) ||
      "API_REQUEST_FAILED",
    hint:
      stringValue(data?.hint) ||
      stringValue(data?.help) ||
      stringValue(data?.suggestion),
    details:
      stringValue(data?.details) ||
      stringValue(data?.detail) ||
      stringValue(data?.reason),
    technicalDetails:
      stringValue(data?.technicalDetails) ||
      stringValue(data?.technical_details) ||
      stringValue(data?.stack),
    responseBody: truncate(
      redacted
        ? JSON.stringify(redacted, null, 2)
        : rawBody.trim() || undefined,
    ),
    responseRequestId:
      stringValue(data?.requestId) ||
      stringValue(data?.request_id) ||
      stringValue(data?.traceId) ||
      stringValue(data?.trace_id),
  };
}

async function apiJson<T>(
  url: string,
  options: RequestInit = {},
  context?: Record<string, unknown>,
): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const startedAt = performance.now();
  const occurredAt = new Date().toISOString();

  let response: Response;

  try {
    response = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
      ...options,
    });
  } catch (caught) {
    if (caught instanceof DOMException && caught.name === "AbortError") {
      throw caught;
    }

    const debug: DebugError = {
      message:
        caught instanceof Error
          ? caught.message
          : "The browser could not contact the server.",
      code: "NETWORK_REQUEST_FAILED",
      endpoint: url,
      method,
      occurredAt,
      durationMs: Math.round(performance.now() - startedAt),
      hint:
        "Check that the Next.js development server is running, the route exists, and the browser can reach the server.",
      technicalDetails:
        caught instanceof Error ? truncate(caught.stack || caught.message) : undefined,
      context,
    };

    console.error("[Lottery Paper Tickets] Network request failed", debug);
    throw new DetailedApiError(debug);
  }

  const durationMs = Math.round(performance.now() - startedAt);
  const contentType = response.headers.get("content-type") || undefined;
  const headerRequestId = requestIdFromHeaders(response.headers);

  let rawBody = "";
  try {
    rawBody = await response.text();
  } catch (caught) {
    const debug: DebugError = {
      message: "The server response could not be read.",
      code: "RESPONSE_READ_FAILED",
      endpoint: url,
      method,
      httpStatus: response.status,
      statusText: response.statusText,
      requestId: headerRequestId,
      contentType,
      occurredAt,
      durationMs,
      details:
        caught instanceof Error ? caught.message : "Unknown response read error.",
      hint:
        "Check the API route logs. The request reached the server, but the browser could not read its response.",
      context,
    };

    console.error("[Lottery Paper Tickets] Response read failed", debug);
    throw new DetailedApiError(debug);
  }

  let data: Record<string, unknown> | null = null;
  let jsonParseError: string | undefined;

  if (rawBody.trim()) {
    try {
      const parsed: unknown = JSON.parse(rawBody);
      if (isRecord(parsed)) {
        data = parsed;
      } else {
        jsonParseError =
          "The API returned valid JSON, but the top-level value was not an object.";
      }
    } catch (caught) {
      jsonParseError =
        caught instanceof Error ? caught.message : "Unknown JSON parse error.";
    }
  } else {
    jsonParseError = "The API returned an empty response body.";
  }

  if (jsonParseError) {
    const debug: DebugError = {
      message:
        response.status === 404
          ? "The API route returned 404 and did not provide the JSON response this page expects."
          : "The server did not return a valid JSON response.",
      code: response.status === 404 ? "API_ROUTE_NOT_FOUND" : "INVALID_JSON_RESPONSE",
      endpoint: url,
      method,
      httpStatus: response.status,
      statusText: response.statusText,
      requestId: headerRequestId,
      contentType,
      occurredAt,
      durationMs,
      details: jsonParseError,
      responseBody: truncate(rawBody),
      hint:
        response.status === 404
          ? `Check that the route for ${method} ${url} exists under app/api and that the route path/capitalisation matches this client exactly.`
          : "Look at the raw response below. If it starts with <!DOCTYPE html>, Next.js probably returned an error page, redirect, sign-in page, or 404 instead of JSON.",
      context,
    };

    console.error("[Lottery Paper Tickets] Invalid API response", debug);
    throw new DetailedApiError(debug);
  }

  if (!response.ok || data?.ok !== true) {
    const server = buildServerDetails(data, rawBody);
    const debug: DebugError = {
      message: serverMessage(data),
      code:
        server.code ||
        (response.status === 401
          ? "UNAUTHENTICATED"
          : response.status === 403
            ? "FORBIDDEN"
            : response.status === 404
              ? "API_ROUTE_NOT_FOUND"
              : response.status >= 500
                ? "SERVER_ERROR"
                : "API_REQUEST_FAILED"),
      endpoint: url,
      method,
      httpStatus: response.status,
      statusText: response.statusText,
      requestId: server.responseRequestId || headerRequestId,
      contentType,
      occurredAt,
      durationMs,
      hint:
        server.hint ||
        (response.status === 401
          ? "Your admin session may have expired. Sign in again and retry."
          : response.status === 403
            ? "Check the admin permission required by this API route."
            : response.status === 404
              ? `Check that ${method} ${url} exists and is deployed.`
              : response.status >= 500
                ? "Check the terminal running Next.js and the Supabase/Postgres logs for the matching request time or request ID."
                : undefined),
      details: server.details,
      technicalDetails: server.technicalDetails,
      responseBody: server.responseBody,
      context,
    };

    console.error("[Lottery Paper Tickets] API request failed", debug);
    throw new DetailedApiError(debug);
  }

  return data as T;
}

function post<T>(
  url: string,
  body: unknown,
  context?: Record<string, unknown>,
) {
  return apiJson<T>(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    context,
  );
}

function toDebugError(
  caught: unknown,
  fallbackMessage: string,
  context?: Record<string, unknown>,
): DebugError {
  if (caught instanceof DetailedApiError) {
    return {
      ...caught.debug,
      context: {
        ...(caught.debug.context || {}),
        ...(context || {}),
      },
    };
  }

  if (caught instanceof DOMException && caught.name === "AbortError") {
    return {
      message: "The request was cancelled.",
      code: "REQUEST_ABORTED",
      occurredAt: new Date().toISOString(),
      context,
    };
  }

  return {
    message: caught instanceof Error ? caught.message : fallbackMessage,
    code: "CLIENT_ERROR",
    occurredAt: new Date().toISOString(),
    technicalDetails:
      caught instanceof Error ? truncate(caught.stack || caught.message) : undefined,
    context,
  };
}

function validationError(
  message: string,
  details: string,
  context?: Record<string, unknown>,
): DebugError {
  return {
    message,
    code: "CLIENT_VALIDATION_ERROR",
    occurredAt: new Date().toISOString(),
    details,
    hint:
      "Correct the highlighted input and try again. This validation happened in the browser before an API request was sent.",
    context,
  };
}

function diagnosticText(error: DebugError) {
  const lines = [
    "Burton Pride Lottery Management - Debug Error",
    "================================================",
    `Message: ${error.message}`,
    `Code: ${error.code}`,
    error.httpStatus != null
      ? `HTTP: ${error.httpStatus}${error.statusText ? ` ${error.statusText}` : ""}`
      : null,
    error.method || error.endpoint
      ? `Request: ${error.method || "GET"} ${error.endpoint || "Unknown endpoint"}`
      : null,
    error.requestId ? `Request ID: ${error.requestId}` : null,
    `Time: ${error.occurredAt}`,
    error.durationMs != null ? `Duration: ${error.durationMs} ms` : null,
    error.contentType ? `Content-Type: ${error.contentType}` : null,
    error.hint ? `Hint: ${error.hint}` : null,
    error.details ? `Details:\n${error.details}` : null,
    error.technicalDetails
      ? `Technical details:\n${error.technicalDetails}`
      : null,
    error.context
      ? `Context:\n${JSON.stringify(redactForDebug(error.context), null, 2)}`
      : null,
    error.responseBody ? `Server response:\n${error.responseBody}` : null,
  ].filter(Boolean);

  return lines.join("\n\n");
}

function ErrorPanel({
  error,
  retry,
}: {
  error: DebugError;
  retry?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copyDetails() {
    try {
      await navigator.clipboard.writeText(diagnosticText(error));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      role="alert"
      className="space-y-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100"
    >
      <div className="space-y-1">
        <p className="text-base font-bold text-red-100">{error.message}</p>
        <p className="font-mono text-xs text-red-200/80">
          {error.code}
          {error.httpStatus != null ? ` · HTTP ${error.httpStatus}` : ""}
          {error.requestId ? ` · Request ${error.requestId}` : ""}
        </p>
      </div>

      {error.hint ? (
        <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 p-3 text-amber-100">
          <strong>What to check:</strong> {error.hint}
        </div>
      ) : null}

      <details open className="rounded-xl border border-white/10 bg-black/20">
        <summary className="cursor-pointer px-4 py-3 font-bold text-white">
          Full debugging information
        </summary>

        <dl className="grid gap-x-5 gap-y-3 border-t border-white/10 px-4 py-4 sm:grid-cols-[150px_1fr]">
          <dt className="font-bold text-white/50">Error code</dt>
          <dd className="break-all font-mono">{error.code}</dd>

          {error.httpStatus != null ? (
            <>
              <dt className="font-bold text-white/50">HTTP status</dt>
              <dd className="break-all font-mono">
                {error.httpStatus} {error.statusText || ""}
              </dd>
            </>
          ) : null}

          {error.endpoint ? (
            <>
              <dt className="font-bold text-white/50">Endpoint</dt>
              <dd className="break-all font-mono">
                {error.method || "GET"} {error.endpoint}
              </dd>
            </>
          ) : null}

          {error.requestId ? (
            <>
              <dt className="font-bold text-white/50">Request ID</dt>
              <dd className="break-all font-mono">{error.requestId}</dd>
            </>
          ) : null}

          <dt className="font-bold text-white/50">Time</dt>
          <dd className="break-all font-mono">{error.occurredAt}</dd>

          {error.durationMs != null ? (
            <>
              <dt className="font-bold text-white/50">Duration</dt>
              <dd className="font-mono">{error.durationMs} ms</dd>
            </>
          ) : null}

          {error.contentType ? (
            <>
              <dt className="font-bold text-white/50">Content-Type</dt>
              <dd className="break-all font-mono">{error.contentType}</dd>
            </>
          ) : null}
        </dl>

        {error.details ? (
          <div className="border-t border-white/10 p-4">
            <p className="mb-2 font-bold text-white/60">Server details</p>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-3 font-mono text-xs text-red-100">
              {error.details}
            </pre>
          </div>
        ) : null}

        {error.technicalDetails ? (
          <div className="border-t border-white/10 p-4">
            <p className="mb-2 font-bold text-white/60">Technical details / stack</p>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-3 font-mono text-xs text-red-100">
              {error.technicalDetails}
            </pre>
          </div>
        ) : null}

        {error.context ? (
          <div className="border-t border-white/10 p-4">
            <p className="mb-2 font-bold text-white/60">Client context</p>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-3 font-mono text-xs text-red-100">
              {JSON.stringify(redactForDebug(error.context), null, 2)}
            </pre>
          </div>
        ) : null}

        {error.responseBody ? (
          <div className="border-t border-white/10 p-4">
            <p className="mb-2 font-bold text-white/60">Raw / redacted server response</p>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-3 font-mono text-xs text-red-100">
              {error.responseBody}
            </pre>
          </div>
        ) : null}
      </details>

      <div className="flex flex-wrap gap-3">
        <button type="button" className={secondary} onClick={copyDetails}>
          {copied ? "Debug details copied" : "Copy debug details"}
        </button>
        {retry ? (
          <button type="button" className={secondary} onClick={retry}>
            Retry
          </button>
        ) : null}
      </div>

      <p className="text-xs leading-5 text-red-100/60">
        Sensitive keys such as passwords, tokens, cookies and authorisation
        values are redacted before the response is displayed or copied.
      </p>
    </div>
  );
}

function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/London",
      }).format(new Date(value))
    : "Not recorded";
}

export default function ReadyToPrintClient({ initialBatchId }: { initialBatchId: string }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(initialBatchId);
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [items, setItems] = useState<PaperBatchSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<DebugError | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null);
    apiJson<{items:PaperBatchSummary[];total:number}>(`${LIST_API}?status=${encodeURIComponent(filter)}&page=${page}`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) { setItems(result.items); setTotal(result.total); } })
      .catch((caught) => { if (!controller.signal.aborted) setError(toDebugError(caught, "Batches could not be loaded.", { operation: "load_batch_queue", filter, page })); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filter, page, revision]);

  function selectBatch(id: string) {
    setSelectedId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("batch", id); else url.searchParams.delete("batch");
    window.history.replaceState(null, "", url);
  }

  return <main className="w-full space-y-6 p-4 text-white sm:p-6 lg:p-8">
    <header className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <a href="/Admin/LotteryManagement/PaperTickets" className={secondary}>← Back to paper tickets</a>
        <button type="button" className={button} onClick={() => setCreateOpen(true)}>Create paper ticket batch</button>
      </div>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-purple-300">Lottery management</p>
        <h1 className="text-3xl font-bold sm:text-4xl">Ready to Print</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/50">Generate ticket PDFs, check a physical test sheet and confirm when the full batch has been printed.</p>
      </div>
    </header>
    <section aria-label="Paper ticket printing steps" className="grid gap-4 md:grid-cols-3">
      {[
        ["1", "Create a ticket batch", "Choose your lottery and quantity, upload front and back artwork, then generate the unique tickets."],
        ["2", "Generate and check the PDF", "Open the batch below, generate its PDF, check both sides and print a test sheet."],
        ["3", "Print and confirm", "Print the complete batch at actual size, complete the checks and confirm printing."],
      ].map(([number, title, description]) => <div key={number} className={card}>
        <div className="mb-3 flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-purple-500/15 font-bold text-purple-300">{number}</span><h2 className="text-sm font-bold">{title}</h2></div>
        <p className="text-xs leading-5 text-white/50">{description}</p>
      </div>)}
    </section>

    {createOpen && <CreateBatchForm onClose={() => setCreateOpen(false)} onCreated={(id) => {
      setCreateOpen(false); setFilter("all"); setPage(1); selectBatch(id); setRevision(value => value + 1);
    }} />}
    {selectedId ? <section aria-label="Selected paper-ticket batch" className="space-y-4">
      <button type="button" onClick={() => selectBatch("")} className={secondary}>Close selected batch</button>
      <BatchPanel key={selectedId} batchId={selectedId} onChanged={() => setRevision(value => value + 1)} />
    </section> : null}

    <section aria-labelledby="batches-title" className={`${card} space-y-5`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="batches-title" className="text-xl font-bold">Paper-ticket batches</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1"><span className="block text-xs font-bold text-white/60">Batch status</span>
            <select value={filter} onChange={event => { setFilter(event.target.value); setPage(1); }} className={input}>
              <option value="all">All batches</option><option value="generated">PDF needed</option>
              <option value="ready_to_print">Ready to print</option><option value="printed">Printed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <button type="button" className={secondary} disabled={loading} onClick={() => setRevision(value => value + 1)}>Refresh batches</button>
        </div>
      </div>
      {error ? <ErrorPanel error={error} retry={() => setRevision(value => value + 1)} /> : null}
      {loading ? <p role="status">Loading batches…</p> : !error && !items.length ? <div className="rounded-2xl border border-dashed border-purple-400/25 bg-purple-500/[0.04] px-5 py-10 text-center">
        <h3 className="text-xl font-bold">{filter === "all" ? "No paper ticket batches yet" : "No batches match this status"}</h3>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/50">{filter === "all"
          ? "Creating a lottery and enabling paper tickets does not generate printable tickets. Create a batch with a quantity and front/back artwork first. It will appear here with the status PDF needed."
          : "Choose All batches to see the complete print queue, or create a new batch."}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button type="button" className={button} onClick={() => setCreateOpen(true)}>Create paper ticket batch</button>
          {filter !== "all" && <button type="button" className={secondary} onClick={() => { setFilter("all"); setPage(1); }}>Show all batches</button>}
        </div>
      </div> : null}
      {!loading && !error && items.length ? <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-left"><caption className="sr-only">Paper-ticket batches and printing status</caption>
          <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-white/50"><tr>
            {["Batch", "Lottery", "Tickets", "Status", "Printed", "Action"].map(label => <th scope="col" key={label} className="px-4 py-3 font-semibold">{label}</th>)}
          </tr></thead>
          <tbody>{items.map(batch => <tr key={batch.id} className="border-t border-white/10 text-sm hover:bg-white/[0.02]">
            <td className="whitespace-nowrap px-4 py-4 font-semibold">{batch.batch_reference}</td>
            <td className="px-4 py-4">{batch.lottery_title}</td><td className="px-4 py-4">{batch.quantity.toLocaleString("en-GB")}</td>
            <td className="whitespace-nowrap px-4 py-4"><span className="rounded-full border border-purple-400/20 bg-purple-500/10 px-3 py-1 text-xs font-bold text-purple-200">{statusLabels[batch.status] || batch.status}</span></td>
            <td className="whitespace-nowrap px-4 py-4">{date(batch.printed_at)}</td>
            <td className="px-4 py-4"><button type="button" className={secondary} onClick={() => selectBatch(batch.id)} aria-label={`Open batch ${batch.batch_reference}`}>Open batch</button></td>
          </tr>)}</tbody>
        </table>
      </div> : null}
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" className={secondary} disabled={loading || page === 1} onClick={() => setPage(value => value - 1)}>Previous</button>
        <p>Page {page} · {total.toLocaleString("en-GB")} batches</p>
        <button type="button" className={secondary} disabled={loading || page * 25 >= total} onClick={() => setPage(value => value + 1)}>Next</button>
      </div>
    </section>
  </main>;
}

function BatchPanel({ batchId, onChanged }: { batchId: string; onChanged: () => void }) {
  const [batch, setBatch] = useState<PaperBatchSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState<DebugError | null>(null);
  const [message, setMessage] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [checks, setChecks] = useState<PrintChecks>(() => ({ ...EMPTY_PRINT_CHECKS }));
  const [note, setNote] = useState("");
  const [reprintReason, setReprintReason] = useState("");
  const alive = useRef(true);
  const pdfApi = `/api/admin/lotterymanagement/tickets/paper/batches/${encodeURIComponent(batchId)}/pdf`;

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null); setPreviewUrl(""); setChecks({ ...EMPTY_PRINT_CHECKS });
    apiJson<{items:PaperBatchSummary[]}>(`${LIST_API}?batch=${encodeURIComponent(batchId)}`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setBatch(result.items[0] || null); })
      .catch((caught) => { if (!controller.signal.aborted) { setBatch(null); setError(toDebugError(caught, "The batch could not be loaded.", { operation: "load_selected_batch", batchId })); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [batchId, revision]);

  async function action(name: "generate" | "preview" | "download" | "confirm") {
    if (busy || !batch) return;
    setBusy(name); setError(null); setMessage("");
    try {
      if (name === "generate") {
        await post(pdfApi, { action: "generate" }, { operation: "generate_pdf", batchId, batchReference: batch.batch_reference });
        if (alive.current) { setMessage("The PDF is ready. Preview it and print a test sheet."); setRevision(value => value + 1); onChanged(); }
      } else if (name === "preview") {
        const result = await post<{preview_url:string}>(`${pdfApi}/preview`, { reason: reprintReason }, { operation: "preview_pdf", batchId, batchReference: batch.batch_reference, reprint: batch.status === "printed" });
        if (alive.current) setPreviewUrl(result.preview_url);
      } else if (name === "download") {
        const result = await post<{download_url:string}>(pdfApi, { action: "download", reason: reprintReason }, { operation: "download_pdf", batchId, batchReference: batch.batch_reference, reprint: batch.status === "printed" });
        if (alive.current) {
          const link = document.createElement("a"); link.href = result.download_url;
          link.rel = "noreferrer"; document.body.appendChild(link); link.click(); link.remove();
          setMessage("The PDF download is ready. Confirm printing only after the full batch is printed.");
        }
      } else {
        await post(
          `/api/admin/lotterymanagement/tickets/paper/batches/${encodeURIComponent(batchId)}/confirm-printed`,
          {
            confirmed: true,
            pdf_sha256: batch.pdf_sha256,
            checks,
            note,
          },
          {
            operation: "confirm_printed",
            batchId,
            batchReference: batch.batch_reference,
            pdfSha256Present: Boolean(batch.pdf_sha256),
          },
        );
        if (alive.current) { setMessage("Printing confirmed. Tickets remain unsold until their sales and payments are recorded."); setRevision(value => value + 1); onChanged(); }
      }
    } catch (error) {
      if (alive.current) setError(toDebugError(error, "The action could not be completed.", { operation: name, batchId, batchReference: batch.batch_reference }));
    } finally { if (alive.current) setBusy(""); }
  }
  if (loading) return <p role="status">Loading selected batch…</p>;
  if (!batch) {
    const batchError =
      error ||
      validationError(
        "Batch not found.",
        "The Ready to Print API returned no matching batch for the selected batch ID.",
        { operation: "load_selected_batch", batchId },
      );

    return (
      <div className="space-y-3">
        <ErrorPanel
          error={batchError}
          retry={() => setRevision((value) => value + 1)}
        />
      </div>
    );
  }
  const reprint = batch.status === "printed";
  const canExport = batch.pdf_ready && (!reprint || reprintReason.trim().length >= 8);
  const canConfirm = batch.status === "ready_to_print" && batch.pdf_ready && !!batch.pdf_sha256 && Object.values(checks).every(Boolean);

  return <div className="space-y-6 rounded-3xl border border-purple-400/20 bg-[#151927] p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-2xl font-bold">{batch.batch_reference}</h2><p className="mt-1 text-lg">{batch.lottery_title}</p><p className="mt-2 font-semibold text-purple-300">{statusLabels[batch.status] || batch.status}</p></div>
      <button type="button" className={secondary} disabled={!!busy} onClick={() => setRevision(value => value + 1)}>Refresh selected batch</button>
    </div>
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div><dt className="text-xs font-bold text-white/50">Tickets</dt><dd>{batch.quantity.toLocaleString("en-GB")}</dd></div>
      <div><dt className="text-xs font-bold text-white/50">PDF pages</dt><dd>{batch.pdf_page_count ?? "Not generated"}</dd></div>
      <div><dt className="text-xs font-bold text-white/50">Print settings</dt><dd>A4 landscape · {batch.tickets_per_sheet} per sheet · 100%</dd></div>
      <div><dt className="text-xs font-bold text-white/50">Duplex flip</dt><dd>{batch.duplex_flip === "long_edge" ? "Long edge" : "Short edge"}</dd></div>
    </dl>
    {batch.status === "cancelled" ? <p>This batch is cancelled. Printing actions are unavailable.</p> : <>
      {reprint ? <div className="space-y-3"><p>Printing confirmed: {date(batch.printed_at)}. Further PDF access is recorded as a reprint export.</p>
        <label className="block space-y-2"><span className="text-xs font-bold text-white/50">Reprint reason</span><textarea className={input} maxLength={500} rows={2} value={reprintReason} disabled={!!busy} onChange={event => setReprintReason(event.target.value)} placeholder="At least 8 characters" /></label>
      </div> : null}
      <div className="flex flex-wrap gap-3">
        {batch.status === "generated" ? <button type="button" className={button} disabled={!!busy} onClick={() => action("generate")}>{busy === "generate" ? "Generating PDF…" : "Generate PDF"}</button> : null}
        <button type="button" className={secondary} disabled={!!busy || !canExport} onClick={() => action("preview")}>{busy === "preview" ? "Opening preview…" : "Preview PDF"}</button>
        <button type="button" className={button} disabled={!!busy || !canExport} onClick={() => action("download")}>{busy === "download" ? "Preparing download…" : "Download PDF"}</button>
      </div>
      {previewUrl ? <section aria-label="Ticket PDF preview" className="space-y-3">
        <p>Check both sides and the ticket details. Print at actual size with the duplex setting above.</p>
        <iframe src={previewUrl} title={`Ticket PDF preview for ${batch.batch_reference}`} referrerPolicy="no-referrer" className="h-[650px] w-full rounded-xl border border-slate-400 bg-white" />
        <p>If your browser cannot display the preview, use Download PDF and open the file in your PDF reader. Preview links expire after five minutes; use Preview PDF again to refresh one.</p>
      </section> : null}
      {batch.status === "ready_to_print" ? <form onSubmit={event => { event.preventDefault(); if (canConfirm) void action("confirm"); }} className="space-y-4">
        <fieldset disabled={!!busy} className="space-y-3"><legend className="mb-3 text-xl font-bold">Confirm successful printing</legend>
          {(Object.keys(PRINT_CHECK_LABELS) as (keyof PrintChecks)[]).map(key => <label key={key} className="flex cursor-pointer items-start gap-3 rounded-lg p-2 border border-white/10 bg-white/[0.02] hover:bg-white/[0.05]">
            <input type="checkbox" checked={checks[key]} onChange={event => setChecks(current => ({ ...current, [key]: event.target.checked }))} className="mt-1 h-5 w-5 shrink-0 accent-purple-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-500" />
            <span>{PRINT_CHECK_LABELS[key]}</span>
          </label>)}
          <label className="block space-y-2"><span className="text-xs font-bold text-white/50">Printing note (optional)</span><textarea value={note} onChange={event => setNote(event.target.value)} maxLength={500} rows={2} className={input} placeholder="Printer, location or other relevant details" /></label>
        </fieldset>
        <p>Confirm after the full batch is printed. This records printing; tickets become draw entries only after their sales and payments are recorded.</p>
        <button type="submit" className={button} disabled={!!busy || !canConfirm}>{busy === "confirm" ? "Confirming printing…" : "Confirm Printed"}</button>
      </form> : null}
    </>}
    {busy ? <p role="status">{busy === "generate" ? "Generating the PDF. Large batches can take several minutes." : "Completing your request…"}</p> : null}
    {error ? <ErrorPanel error={error} retry={() => setRevision(value => value + 1)} /> : null}
    {message ? <p role="status" className="font-medium rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">{message}</p> : null}
  </div>;
}


type PaperLotteryOption = { id: string; title: string; status: string; max_tickets: number | null };
function CreateBatchForm({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [lotteries, setLotteries] = useState<PaperLotteryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<DebugError | null>(null);
  const [retry, setRetry] = useState(0);
  const submitting = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null);
    apiJson<{ items: PaperLotteryOption[] }>("/api/admin/lotterymanagement/tickets/paper/lotteries", { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setLotteries(result.items); })
      .catch((caught) => { if (!controller.signal.aborted) setError(toDebugError(caught, "Unable to load lotteries.", { operation: "load_paper_lotteries" })); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const body = new FormData(form);
    for (const side of ["front_design", "back_design"]) {
      const file = body.get(side);
      if (
        !(file instanceof File) ||
        !file.size ||
        file.size > 15 * 1024 * 1024 ||
        !["image/png", "image/jpeg", "image/webp"].includes(file.type)
      ) {
        setError(
          validationError(
            "The artwork file is not valid.",
            `${side} must be a PNG, JPEG or WebP image, larger than 0 bytes and no larger than 15 MB.`,
            {
              operation: "validate_batch_artwork",
              field: side,
              fileName: file instanceof File ? file.name : null,
              fileType: file instanceof File ? file.type : null,
              fileSize: file instanceof File ? file.size : null,
              maximumBytes: 15 * 1024 * 1024,
            },
          ),
        );
        return;
      }
    }
    submitting.current = true; setBusy(true); setError(null);
    try {
      const result = await apiJson<{ batch_id: string }>(
        "/api/admin/lotterymanagement/tickets/paper/batches",
        { method: "POST", body },
        {
          operation: "create_paper_ticket_batch",
          lotteryId: stringValue(body.get("lottery_id")),
          quantity: stringValue(body.get("quantity")),
          ticketsPerSheet: stringValue(body.get("tickets_per_sheet")),
          duplexFlip: stringValue(body.get("duplex_flip")),
          codeFormat: stringValue(body.get("code_format")),
          frontArtwork:
            body.get("front_design") instanceof File
              ? {
                  name: (body.get("front_design") as File).name,
                  type: (body.get("front_design") as File).type,
                  size: (body.get("front_design") as File).size,
                }
              : null,
          backArtwork:
            body.get("back_design") instanceof File
              ? {
                  name: (body.get("back_design") as File).name,
                  type: (body.get("back_design") as File).type,
                  size: (body.get("back_design") as File).size,
                }
              : null,
        },
      );
      if (!result.batch_id) {
        throw new DetailedApiError({
          message: "The batch was created without a batch ID in the response.",
          code: "MISSING_BATCH_ID",
          endpoint: "/api/admin/lotterymanagement/tickets/paper/batches",
          method: "POST",
          occurredAt: new Date().toISOString(),
          hint:
            "Check the POST batch route and make sure its success JSON includes { ok: true, batch_id: \"...\" }.",
          details:
            "The HTTP request completed successfully, but result.batch_id was empty or missing.",
          context: {
            operation: "create_paper_ticket_batch",
            lotteryId: stringValue(body.get("lottery_id")),
            quantity: stringValue(body.get("quantity")),
          },
        });
      }
      onCreated(result.batch_id);
    } catch (caught) {
      setError(toDebugError(caught, "Unable to create the batch.", { operation: "create_paper_ticket_batch" }));
    } finally { submitting.current = false; setBusy(false); }
  }

  return <section aria-labelledby="create-batch-title" className={`${card} space-y-5 border-purple-400/25`}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 id="create-batch-title" className="text-xl font-bold">Create paper ticket batch</h2><p className="mt-2 text-sm text-white/50">Generate the tickets first, then create their PDF in the batch panel below.</p></div>
      <button type="button" className={secondary} disabled={busy} onClick={onClose}>Close form</button>
    </div>
    {loading ? <p role="status">Loading paper lotteries…</p> : <>
      {!lotteries.length && !error ? <p className="text-sm text-amber-200">No eligible paper lotteries found. Enable paper tickets on your lottery and save it first.</p> : null}
      {!!lotteries.length && <form onSubmit={submit} className="space-y-5">
        <fieldset disabled={busy} className="grid gap-5 md:grid-cols-2">
          <label className="space-y-2"><span className="block text-sm font-bold">Lottery</span>
            <select name="lottery_id" required className={input} defaultValue={lotteries.length === 1 ? lotteries[0].id : ""}>
              <option value="" disabled>Select a paper lottery</option>
              {lotteries.map(item => <option key={item.id} value={item.id}>{item.title} · {item.status}</option>)}
            </select>
          </label>
          <label className="space-y-2"><span className="block text-sm font-bold">Number of paper tickets</span><input name="quantity" type="number" min={1} max={5000} step={1} required defaultValue={100} className={input} /></label>
          <input type="hidden" name="page_size" value="A4" />
          <label className="space-y-2"><span className="block text-sm font-bold">Tickets per A4 landscape sheet</span><select name="tickets_per_sheet" defaultValue="6" className={input}><option value="2">2 tickets</option><option value="4">4 tickets</option><option value="6">6 tickets</option></select></label>
          <label className="space-y-2"><span className="block text-sm font-bold">Duplex flip</span><select name="duplex_flip" defaultValue="short_edge" className={input}><option value="short_edge">Short edge</option><option value="long_edge">Long edge</option></select></label>
          <label className="space-y-2"><span className="block text-sm font-bold">Barcode format</span><select name="code_format" defaultValue="qr_and_code128" className={input}><option value="qr">QR code</option><option value="qr_and_code128">QR code and Code 128 barcode</option></select></label>
          <div className="rounded-xl border border-blue-400/20 bg-blue-500/10 p-4 text-xs leading-5 text-blue-100">The server creates random ticket numbers, UUIDs and secure barcode tokens, and checks the combined online/paper ticket capacity. Creating a batch reserves tickets; it does not record a sale.</div>
          <label className="space-y-2"><span className="block text-sm font-bold">Front artwork</span><input name="front_design" type="file" required accept="image/png,image/jpeg,image/webp" className={input} /><span className="block text-xs text-white/50">PNG, JPEG or WebP · maximum 15 MB.</span></label>
          <label className="space-y-2"><span className="block text-sm font-bold">Back artwork</span><input name="back_design" type="file" required accept="image/png,image/jpeg,image/webp" className={input} /><span className="block text-xs text-white/50">PNG, JPEG or WebP · maximum 15 MB.</span></label>
        </fieldset>
        <button type="submit" className={button} disabled={busy}>{busy ? "Creating ticket batch…" : "Generate paper tickets"}</button>
        {busy && <p role="status" className="text-sm text-white/60">Uploading artwork and creating tickets. Please keep this page open.</p>}
      </form>}
    </>}
    {error ? (
      <ErrorPanel
        error={error}
        retry={
          !lotteries.length
            ? () => setRetry((value) => value + 1)
            : undefined
        }
      />
    ) : null}
  </section>;
}
