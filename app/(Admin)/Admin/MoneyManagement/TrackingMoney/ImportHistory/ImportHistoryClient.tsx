"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  Loader2,
  RefreshCcw,
  Search,
  TrendingDown,
  TrendingUp,
  UserRound,
  X,
  XCircle,
} from "lucide-react";

type ImportBatch = {
  id: string;
  created_at: string;

  imported_by_user_id: string | null;
  imported_by_name: string | null;
  imported_by_email: string | null;

  file_name: string | null;
  import_type: string | null;

  total_rows: number;
  imported_rows: number;
  failed_rows: number;

  total_money_in_pence: number;
  total_money_out_pence: number;
  net_total_pence: number;

  status: string | null;
};

type FailedRow = {
  id: string;
  created_at: string;
  import_batch_id: string;
  row_number: number;
  error_message: string;
  row_data: any;
};

type BatchDetails = {
  batch: ImportBatch;
  failedRows: FailedRow[];
};

function money(pence: number | null | undefined) {
  const value = Number(pence || 0) / 100;

  return value.toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
  });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Unknown";

  return new Date(value).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusClass(status: string | null | undefined, failedRows: number) {
  if (status === "failed") {
    return "border-red-300/20 bg-red-500/15 text-red-100";
  }

  if (failedRows > 0) {
    return "border-amber-300/20 bg-amber-500/15 text-amber-100";
  }

  return "border-emerald-300/20 bg-emerald-500/15 text-emerald-100";
}

function statusText(status: string | null | undefined, failedRows: number) {
  if (status === "failed") return "Failed";
  if (failedRows > 0) return "Completed with errors";
  return "Completed";
}

async function readJsonResponse(response: Response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {
      ok: false,
      error: "Server returned invalid JSON.",
      rawResponse: text,
      status: response.status,
    };
  }
}

function buildApiError(payload: any, fallback: string) {
  const error = payload?.error || payload?.message || fallback;
  const reason = payload?.reason ? `\nReason: ${payload.reason}` : "";
  const likelyFix = payload?.likelyFix ? `\nLikely fix: ${payload.likelyFix}` : "";
  const details =
    payload?.details || payload?.debug
      ? `\nDetails: ${JSON.stringify(payload.details || payload.debug, null, 2)}`
      : "";

  return `${error}${reason}${likelyFix}${details}`;
}

function downloadFailedRowsCsv(details: BatchDetails) {
  const rows = details.failedRows;

  const headers = ["row_number", "error_message", "row_data"];

  const csvRows = [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.row_number,
        `"${String(row.error_message || "").replace(/"/g, '""')}"`,
        `"${JSON.stringify(row.row_data || {}).replace(/"/g, '""')}"`,
      ].join(",")
    ),
  ];

  const blob = new Blob([csvRows.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `failed-rows-${details.batch.id}.csv`;
  link.click();

  URL.revokeObjectURL(url);
}

export default function ImportHistoryClient() {
  const [imports, setImports] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<BatchDetails | null>(
    null
  );
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  async function loadImports() {
    try {
      setError(null);

      const response = await fetch("/api/admin/money/import-history", {
        cache: "no-store",
        credentials: "include",
      });

      const payload = await readJsonResponse(response);

      if (!response.ok || payload?.ok === false) {
        throw new Error(
          buildApiError(payload, "Failed to load import history.")
        );
      }

      setImports(payload.imports || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load import history.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    await loadImports();
  }

  async function openBatch(batchId: string) {
    try {
      setSelectedBatchId(batchId);
      setSelectedDetails(null);
      setDetailsError(null);
      setDetailsLoading(true);

      const response = await fetch(`/api/admin/money/import-history/${batchId}`, {
        cache: "no-store",
        credentials: "include",
      });

      const payload = await readJsonResponse(response);

      if (!response.ok || payload?.ok === false) {
        throw new Error(buildApiError(payload, "Failed to load import batch."));
      }

      setSelectedDetails(payload);
    } catch (err: any) {
      setDetailsError(err?.message || "Failed to load import batch.");
    } finally {
      setDetailsLoading(false);
    }
  }

  useEffect(() => {
    loadImports();
  }, []);

  const filteredImports = useMemo(() => {
    const search = query.trim().toLowerCase();

    if (!search) return imports;

    return imports.filter((item) => {
      return [
        item.file_name,
        item.imported_by_name,
        item.imported_by_email,
        item.import_type,
        item.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [imports, query]);

  const totals = useMemo(() => {
    return imports.reduce(
      (acc, item) => {
        acc.imports += 1;
        acc.rows += Number(item.imported_rows || 0);
        acc.failedRows += Number(item.failed_rows || 0);
        acc.moneyIn += Number(item.total_money_in_pence || 0);
        acc.moneyOut += Number(item.total_money_out_pence || 0);
        acc.net += Number(item.net_total_pence || 0);
        return acc;
      },
      {
        imports: 0,
        rows: 0,
        failedRows: 0,
        moneyIn: 0,
        moneyOut: 0,
        net: 0,
      }
    );
  }, [imports]);

  return (
    <>
      <section className="grid w-full max-w-none gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-white/60">Total imports</p>
            <FileSpreadsheet className="h-5 w-5 text-sky-200" />
          </div>
          <p className="mt-3 text-3xl font-black">{totals.imports}</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-white/60">Rows imported</p>
            <CheckCircle2 className="h-5 w-5 text-emerald-200" />
          </div>
          <p className="mt-3 text-3xl font-black">{totals.rows}</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-white/60">Failed rows</p>
            <XCircle className="h-5 w-5 text-red-200" />
          </div>
          <p className="mt-3 text-3xl font-black">{totals.failedRows}</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-white/60">Money in</p>
            <TrendingUp className="h-5 w-5 text-emerald-200" />
          </div>
          <p className="mt-3 text-3xl font-black">{money(totals.moneyIn)}</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-white/60">Money out</p>
            <TrendingDown className="h-5 w-5 text-red-200" />
          </div>
          <p className="mt-3 text-3xl font-black">{money(totals.moneyOut)}</p>
        </div>
      </section>

      <section className="w-full max-w-none rounded-[2rem] border border-white/10 bg-white/[0.06] p-4 shadow-2xl backdrop-blur-xl sm:p-5">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-black">CSV import batches</h2>
            <p className="mt-1 text-sm text-white/60">
              Every CSV upload should create one batch record here.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto lg:shrink-0">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search imports..."
                className="w-full rounded-2xl border border-white/10 bg-black/25 py-3 pl-11 pr-4 text-sm font-bold text-white outline-none placeholder:text-white/35 focus:border-sky-300/40 sm:w-96 lg:w-[520px]"
              />
            </div>

            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-5 flex gap-3 rounded-3xl border border-red-300/20 bg-red-500/10 p-4 text-sm text-red-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="whitespace-pre-line">{error}</p>
          </div>
        )}

        <div className="mt-5 w-full max-w-none overflow-hidden rounded-3xl border border-white/10">
          {loading ? (
            <div className="flex min-h-[260px] items-center justify-center">
              <div className="flex items-center gap-3 text-white/70">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading import history...
              </div>
            </div>
          ) : filteredImports.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center p-8 text-center">
              <FileSpreadsheet className="h-12 w-12 text-white/25" />
              <h3 className="mt-4 text-xl font-black">No imports found</h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/60">
                Once CSV imports are connected to the import batch tables, every
                upload will appear here.
              </p>
            </div>
          ) : (
            <div className="w-full max-w-none overflow-x-auto">
              <table className="w-full min-w-[1200px] text-left text-sm">
                <thead className="bg-black/30 text-xs uppercase tracking-[0.18em] text-white/45">
                  <tr>
                    <th className="px-4 py-4">Date</th>
                    <th className="px-4 py-4">File</th>
                    <th className="px-4 py-4">Imported by</th>
                    <th className="px-4 py-4">Rows</th>
                    <th className="px-4 py-4">Failed</th>
                    <th className="px-4 py-4">Money in</th>
                    <th className="px-4 py-4">Money out</th>
                    <th className="px-4 py-4">Net</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4 text-right">View</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/10">
                  {filteredImports.map((item) => (
                    <tr key={item.id} className="hover:bg-white/[0.04]">
                      <td className="px-4 py-4 text-white/75">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-white/35" />
                          {formatDate(item.created_at)}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <p className="font-black text-white">
                          {item.file_name || "Unknown file"}
                        </p>
                        <p className="mt-1 text-xs text-white/45">
                          {item.import_type || "money_transactions"}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <UserRound className="h-4 w-4 text-white/35" />
                          <div>
                            <p className="font-bold text-white">
                              {item.imported_by_name || "Unknown admin"}
                            </p>
                            <p className="text-xs text-white/45">
                              {item.imported_by_email || "No email saved"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <p className="font-black text-white">
                          {item.imported_rows}
                        </p>
                        <p className="text-xs text-white/45">
                          of {item.total_rows} total
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={
                            item.failed_rows > 0
                              ? "font-black text-amber-200"
                              : "font-black text-emerald-200"
                          }
                        >
                          {item.failed_rows}
                        </span>
                      </td>

                      <td className="px-4 py-4 font-black text-emerald-200">
                        {money(item.total_money_in_pence)}
                      </td>

                      <td className="px-4 py-4 font-black text-red-200">
                        {money(item.total_money_out_pence)}
                      </td>

                      <td className="px-4 py-4 font-black text-white">
                        {money(item.net_total_pence)}
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClass(
                            item.status,
                            item.failed_rows
                          )}`}
                        >
                          {statusText(item.status, item.failed_rows)}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => openBatch(item.id)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-black text-white hover:bg-white/15"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {selectedBatchId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-1 py-4 backdrop-blur-md sm:px-2">
          <div className="max-h-[92vh] w-full max-w-none overflow-hidden rounded-[2rem] border border-white/10 bg-[#0b0b1f] shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
              <div>
                <h3 className="text-2xl font-black">Import batch details</h3>
                <p className="mt-1 text-sm text-white/55">
                  Review the totals and failed rows for this CSV import.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedBatchId(null);
                  setSelectedDetails(null);
                  setDetailsError(null);
                }}
                className="rounded-2xl border border-white/10 bg-white/10 p-3 text-white hover:bg-white/15"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto p-5">
              {detailsLoading ? (
                <div className="flex min-h-[260px] items-center justify-center">
                  <div className="flex items-center gap-3 text-white/70">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading batch details...
                  </div>
                </div>
              ) : detailsError ? (
                <div className="rounded-3xl border border-red-300/20 bg-red-500/10 p-4 text-sm text-red-100">
                  <span className="whitespace-pre-line">{detailsError}</span>
                </div>
              ) : selectedDetails ? (
                <div className="space-y-5">
                  <section className="grid w-full max-w-none gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">
                        File
                      </p>
                      <p className="mt-2 break-words text-lg font-black">
                        {selectedDetails.batch.file_name || "Unknown file"}
                      </p>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">
                        Imported by
                      </p>
                      <p className="mt-2 text-lg font-black">
                        {selectedDetails.batch.imported_by_name ||
                          "Unknown admin"}
                      </p>
                      <p className="mt-1 text-xs text-white/45">
                        {selectedDetails.batch.imported_by_email ||
                          "No email saved"}
                      </p>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">
                        Date
                      </p>
                      <p className="mt-2 text-lg font-black">
                        {formatDate(selectedDetails.batch.created_at)}
                      </p>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">
                        Status
                      </p>
                      <span
                        className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClass(
                          selectedDetails.batch.status,
                          selectedDetails.batch.failed_rows
                        )}`}
                      >
                        {statusText(
                          selectedDetails.batch.status,
                          selectedDetails.batch.failed_rows
                        )}
                      </span>
                    </div>
                  </section>

                  <section className="grid w-full max-w-none gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                      <p className="text-sm font-bold text-white/55">
                        Total rows
                      </p>
                      <p className="mt-2 text-2xl font-black">
                        {selectedDetails.batch.total_rows}
                      </p>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                      <p className="text-sm font-bold text-white/55">
                        Imported rows
                      </p>
                      <p className="mt-2 text-2xl font-black text-emerald-200">
                        {selectedDetails.batch.imported_rows}
                      </p>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                      <p className="text-sm font-bold text-white/55">
                        Failed rows
                      </p>
                      <p className="mt-2 text-2xl font-black text-amber-200">
                        {selectedDetails.batch.failed_rows}
                      </p>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                      <p className="text-sm font-bold text-white/55">
                        Money in
                      </p>
                      <p className="mt-2 text-2xl font-black text-emerald-200">
                        {money(selectedDetails.batch.total_money_in_pence)}
                      </p>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                      <p className="text-sm font-bold text-white/55">
                        Money out
                      </p>
                      <p className="mt-2 text-2xl font-black text-red-200">
                        {money(selectedDetails.batch.total_money_out_pence)}
                      </p>
                    </div>
                  </section>

                  <section className="w-full max-w-none rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h4 className="text-xl font-black">Failed rows</h4>
                        <p className="mt-1 text-sm text-white/55">
                          Rows that could not be imported are shown here with
                          the reason.
                        </p>
                      </div>

                      {selectedDetails.failedRows.length > 0 && (
                        <button
                          type="button"
                          onClick={() => downloadFailedRowsCsv(selectedDetails)}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/15"
                        >
                          <Download className="h-4 w-4" />
                          Download failed rows
                        </button>
                      )}
                    </div>

                    <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
                      {selectedDetails.failedRows.length === 0 ? (
                        <div className="flex min-h-[160px] flex-col items-center justify-center p-6 text-center">
                          <CheckCircle2 className="h-10 w-10 text-emerald-200" />
                          <p className="mt-3 font-black">
                            No failed rows for this import
                          </p>
                          <p className="mt-1 text-sm text-white/55">
                            Everything in this CSV batch imported successfully.
                          </p>
                        </div>
                      ) : (
                        <div className="w-full max-w-none overflow-x-auto">
                          <table className="w-full min-w-[950px] text-left text-sm">
                            <thead className="bg-black/30 text-xs uppercase tracking-[0.18em] text-white/45">
                              <tr>
                                <th className="px-4 py-4">Row</th>
                                <th className="px-4 py-4">Reason</th>
                                <th className="px-4 py-4">Original data</th>
                              </tr>
                            </thead>

                            <tbody className="divide-y divide-white/10">
                              {selectedDetails.failedRows.map((row) => (
                                <tr key={row.id}>
                                  <td className="px-4 py-4 font-black">
                                    {row.row_number}
                                  </td>

                                  <td className="px-4 py-4 text-red-100">
                                    {row.error_message}
                                  </td>

                                  <td className="px-4 py-4">
                                    <pre className="max-h-32 overflow-auto rounded-2xl bg-black/30 p-3 text-xs text-white/70">
                                      {JSON.stringify(row.row_data || {}, null, 2)}
                                    </pre>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}