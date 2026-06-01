"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  RefreshCcw,
  Search,
  ShieldAlert,
  UploadCloud,
  XCircle,
} from "lucide-react";

type BankImport = {
  id: string;
  source_name?: string | null;
  file_name?: string | null;
  year?: string | null;
  imported_by_name?: string | null;
  imported_by_email?: string | null;
  row_count?: number | null;
  total_money_in_pence?: number | null;
  total_money_out_pence?: number | null;
  status?: string | null;
  created_at?: string | null;
};

type MatchCandidate = {
  transaction_id: string;
  transaction_reference?: string | null;
  title?: string | null;
  transaction_date?: string | null;
  amount_pence?: number | null;
  type?: string | null;
  payment_method?: string | null;
  confidence: "high" | "medium" | "low";
  score: number;
  reasons: string[];
};

type BankImportRow = {
  id: string;
  import_id: string;
  row_number?: number | null;
  transaction_date?: string | null;
  description?: string | null;
  amount_pence?: number | null;
  money_in_pence?: number | null;
  money_out_pence?: number | null;
  balance_pence?: number | null;
  reference?: string | null;
  raw?: Record<string, string> | null;
  status?: "unmatched" | "matched" | "possible_match" | "ignored" | "needs_review";
  matched_transaction_id?: string | null;
  matched_at?: string | null;
  matched_by_name?: string | null;
  review_note?: string | null;
  candidates?: MatchCandidate[];
};

function money(value?: number | null) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format((Number(value) || 0) / 100);
}

function formatDate(value?: string | null) {
  if (!value) return "No date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function statusLabel(status?: string | null) {
  if (status === "matched") return "Matched";
  if (status === "ignored") return "Ignored";
  if (status === "needs_review") return "Needs review";
  if (status === "possible_match") return "Possible match";
  return "Unmatched";
}

function statusClass(status?: string | null) {
  if (status === "matched") {
    return "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20";
  }

  if (status === "ignored") {
    return "bg-sky-500/15 text-sky-100 ring-sky-300/20";
  }

  if (status === "needs_review") {
    return "bg-amber-500/15 text-amber-100 ring-amber-300/20";
  }

  if (status === "possible_match") {
    return "bg-purple-500/15 text-purple-100 ring-purple-300/20";
  }

  return "bg-white/10 text-white/60 ring-white/10";
}

function confidenceClass(confidence: MatchCandidate["confidence"]) {
  if (confidence === "high") {
    return "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20";
  }

  if (confidence === "medium") {
    return "bg-amber-500/15 text-amber-100 ring-amber-300/20";
  }

  return "bg-red-500/15 text-red-100 ring-red-300/20";
}

export default function BankReconciliationPage() {
  const [imports, setImports] = useState<BankImport[]>([]);
  const [selectedImport, setSelectedImport] = useState<BankImport | null>(null);
  const [rows, setRows] = useState<BankImportRow[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [sourceName, setSourceName] = useState("Bank statement");

  const [loadingImports, setLoadingImports] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [updatingRowId, setUpdatingRowId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadImports() {
    try {
      setLoadingImports(true);
      setError(null);

      const response = await fetch("/api/admin/money/bank-reconciliation", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.details || data?.error || "Failed to load imports.");
      }

      setImports(data.imports || []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load bank imports.",
      );
    } finally {
      setLoadingImports(false);
    }
  }

  async function loadImportRows(importId: string) {
    try {
      setLoadingRows(true);
      setError(null);
      setMessage(null);

      const response = await fetch(
        `/api/admin/money/bank-reconciliation?importId=${encodeURIComponent(
          importId,
        )}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.details || data?.error || "Failed to load rows.");
      }

      setSelectedImport(data.import || null);
      setRows(data.rows || []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load bank rows.",
      );
    } finally {
      setLoadingRows(false);
    }
  }

  async function uploadCsv() {
    if (!file) {
      setError("Please choose a CSV file first.");
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setMessage(null);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("year", year);
      formData.append("source_name", sourceName || "Bank statement");

      const response = await fetch("/api/admin/money/bank-reconciliation", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.details || data?.error || "Failed to upload CSV.");
      }

      setSelectedImport(data.import || null);
      setRows(data.rows || []);
      setFile(null);
      setMessage(
        `Bank CSV imported successfully. ${data.rows?.length || 0} rows loaded.`,
      );

      await loadImports();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Failed to upload bank CSV.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function updateRow({
    rowId,
    action,
    transactionId,
  }: {
    rowId: string;
    action: "match" | "ignore" | "needs_review";
    transactionId?: string;
  }) {
    try {
      setUpdatingRowId(rowId);
      setError(null);
      setMessage(null);

      const response = await fetch("/api/admin/money/bank-reconciliation", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          row_id: rowId,
          transaction_id: transactionId,
          note: noteDrafts[rowId] || "",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.details || data?.error || "Failed to update row.");
      }

      setMessage(`Bank row updated: ${statusLabel(data.status)}.`);

      if (selectedImport?.id) {
        await loadImportRows(selectedImport.id);
      }
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update bank row.",
      );
    } finally {
      setUpdatingRowId(null);
    }
  }

  useEffect(() => {
    loadImports();
  }, []);

  const filteredRows = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesStatus =
        statusFilter === "all" ? true : row.status === statusFilter;

      const searchText = [
        row.row_number,
        row.transaction_date,
        row.description,
        row.reference,
        row.status,
        row.amount_pence,
        money(row.amount_pence),
        row.candidates?.map((candidate) => candidate.title).join(" "),
        row.candidates?.map((candidate) => candidate.transaction_reference).join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !search || searchText.includes(search);

      return matchesStatus && matchesSearch;
    });
  }, [rows, searchTerm, statusFilter]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const amount = Number(row.amount_pence || 0);

        if (amount >= 0) {
          acc.moneyIn += amount;
        } else {
          acc.moneyOut += Math.abs(amount);
        }

        if (row.status === "matched") acc.matched += 1;
        else if (row.status === "ignored") acc.ignored += 1;
        else if (row.status === "needs_review") acc.needsReview += 1;
        else acc.unmatched += 1;

        return acc;
      },
      {
        moneyIn: 0,
        moneyOut: 0,
        matched: 0,
        ignored: 0,
        needsReview: 0,
        unmatched: 0,
      },
    );
  }, [rows]);

  return (
    <main className="min-h-screen w-full max-w-none overflow-x-auto bg-[#070716] px-1 py-5 text-white sm:px-2 lg:px-3">
      <div className="w-full max-w-none min-w-0 space-y-6">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <Link
                href="/Admin/MoneyManagement/TrackingMoney"
                className="mb-4 inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to money tracker
              </Link>

              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-purple-300/20 bg-purple-500/10 px-4 py-2 text-sm font-bold text-purple-100">
                <FileSpreadsheet className="h-4 w-4" />
                Bank reconciliation
              </div>

              <h1 className="text-3xl font-black text-white sm:text-4xl">
                Bank Statement Reconciliation
              </h1>

              <p className="mt-2 max-w-4xl text-sm leading-6 text-white/60">
                Upload a bank CSV, compare it against the money tracker, match
                rows, mark rows as ignored, or send rows to needs review. All
                match actions go through the API so they can be logged.
              </p>
            </div>

            <button
              type="button"
              onClick={loadImports}
              disabled={loadingImports}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCcw
                className={`h-4 w-4 ${loadingImports ? "animate-spin" : ""}`}
              />
              Refresh imports
            </button>
          </div>
        </div>

        {message && (
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-100">
            <CheckCircle2 className="mr-2 inline h-4 w-4" />
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">
            <AlertTriangle className="mr-2 inline h-4 w-4" />
            {error}
          </div>
        )}

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 sm:p-5">
          <h2 className="text-2xl font-black text-white">Upload bank CSV</h2>

          <p className="mt-2 text-sm leading-6 text-white/60">
            The CSV can include columns like Date, Description, Amount, Money
            In, Money Out, Balance, and Reference. The API will try to detect
            the right columns automatically.
          </p>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_180px_220px_auto]">
            <label className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-4">
              <div className="flex items-center gap-3">
                <UploadCloud className="h-6 w-6 text-purple-200" />

                <div className="min-w-0">
                  <p className="text-sm font-black text-white">
                    {file ? file.name : "Choose CSV file"}
                  </p>

                  <p className="text-xs text-white/45">
                    Upload your bank statement export as CSV.
                  </p>
                </div>
              </div>

              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                className="mt-3 w-full text-sm text-white/60 file:mr-3 file:rounded-xl file:border-0 file:bg-purple-500 file:px-4 file:py-2 file:text-sm file:font-black file:text-white hover:file:bg-purple-400"
              />
            </label>

            <div>
              <label className="mb-1 block text-xs font-black text-white/45">
                Year
              </label>

              <input
                value={year}
                onChange={(event) => setYear(event.target.value)}
                className="w-full rounded-2xl bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none ring-1 ring-white/10 focus:ring-purple-300/40"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-black text-white/45">
                Source name
              </label>

              <input
                value={sourceName}
                onChange={(event) => setSourceName(event.target.value)}
                className="w-full rounded-2xl bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none ring-1 ring-white/10 focus:ring-purple-300/40"
              />
            </div>

            <button
              type="button"
              onClick={uploadCsv}
              disabled={uploading || !file}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-purple-500 px-5 py-3 text-sm font-black text-white hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="h-4 w-4" />
              )}
              Import CSV
            </button>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 sm:p-5">
            <h2 className="text-xl font-black text-white">Recent imports</h2>

            <div className="mt-4 space-y-3">
              {loadingImports ? (
                <div className="rounded-2xl bg-white/10 p-4 text-sm text-white/60">
                  Loading imports...
                </div>
              ) : imports.length === 0 ? (
                <div className="rounded-2xl bg-black/20 p-4 text-sm text-white/60">
                  No bank CSV imports yet.
                </div>
              ) : (
                imports.map((item) => {
                  const active = selectedImport?.id === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => loadImportRows(item.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        active
                          ? "border-purple-300/30 bg-purple-500/15"
                          : "border-white/10 bg-black/20 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-black text-white">
                            {item.source_name || "Bank statement"}
                          </p>

                          <p className="mt-1 break-words text-xs text-white/45">
                            {item.file_name || "CSV import"}
                          </p>
                        </div>

                        <span className="rounded-xl bg-black/25 px-2 py-1 text-xs font-black text-white/70 ring-1 ring-white/10">
                          {item.row_count || 0}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2 text-xs text-white/55">
                        <div>Year: {item.year || "Unknown"}</div>
                        <div>Imported: {formatDate(item.created_at)}</div>
                        <div>By: {item.imported_by_name || "Unknown admin"}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-4">
            {selectedImport ? (
              <>
                <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 sm:p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h2 className="text-2xl font-black text-white">
                        {selectedImport.source_name || "Bank statement"}
                      </h2>

                      <p className="mt-1 text-sm text-white/50">
                        {selectedImport.file_name || "CSV import"} ·{" "}
                        {selectedImport.row_count || rows.length} rows
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => loadImportRows(selectedImport.id)}
                      disabled={loadingRows}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/20 disabled:opacity-60"
                    >
                      <RefreshCcw
                        className={`h-4 w-4 ${
                          loadingRows ? "animate-spin" : ""
                        }`}
                      />
                      Refresh rows
                    </button>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-2xl bg-emerald-500/10 p-3 ring-1 ring-emerald-300/20">
                      <p className="text-xs font-black text-emerald-100/70">
                        Money In
                      </p>
                      <p className="mt-1 text-lg font-black text-white">
                        {money(totals.moneyIn)}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-red-500/10 p-3 ring-1 ring-red-300/20">
                      <p className="text-xs font-black text-red-100/70">
                        Money Out
                      </p>
                      <p className="mt-1 text-lg font-black text-white">
                        {money(totals.moneyOut)}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-emerald-500/10 p-3 ring-1 ring-emerald-300/20">
                      <p className="text-xs font-black text-emerald-100/70">
                        Matched
                      </p>
                      <p className="mt-1 text-lg font-black text-white">
                        {totals.matched}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-amber-500/10 p-3 ring-1 ring-amber-300/20">
                      <p className="text-xs font-black text-amber-100/70">
                        Needs Review
                      </p>
                      <p className="mt-1 text-lg font-black text-white">
                        {totals.needsReview}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
                      <p className="text-xs font-black text-white/50">
                        Unmatched
                      </p>
                      <p className="mt-1 text-lg font-black text-white">
                        {totals.unmatched}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 sm:p-5">
                  <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-white/35" />

                      <input
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Search bank rows by description, reference, amount or suggested match..."
                        className="w-full rounded-2xl bg-black/30 py-3 pl-10 pr-4 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-purple-300/40"
                      />
                    </div>

                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                      className="rounded-2xl bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none ring-1 ring-white/10 focus:ring-purple-300/40"
                    >
                      <option className="bg-[#11111f] text-white" value="all">
                        All rows
                      </option>
                      <option
                        className="bg-[#11111f] text-white"
                        value="unmatched"
                      >
                        Unmatched
                      </option>
                      <option
                        className="bg-[#11111f] text-white"
                        value="matched"
                      >
                        Matched
                      </option>
                      <option
                        className="bg-[#11111f] text-white"
                        value="needs_review"
                      >
                        Needs review
                      </option>
                      <option
                        className="bg-[#11111f] text-white"
                        value="ignored"
                      >
                        Ignored
                      </option>
                    </select>
                  </div>

                  <div className="mt-5 space-y-4">
                    {loadingRows ? (
                      <div className="rounded-2xl bg-white/10 p-5 text-sm text-white/60">
                        Loading bank rows...
                      </div>
                    ) : filteredRows.length === 0 ? (
                      <div className="rounded-2xl bg-black/20 p-5 text-sm text-white/60">
                        No bank rows found for this filter.
                      </div>
                    ) : (
                      filteredRows.map((row) => (
                        <div
                          key={row.id}
                          className="rounded-3xl border border-white/10 bg-black/20 p-4"
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-xl bg-white/10 px-3 py-1 text-xs font-black text-white/70 ring-1 ring-white/10">
                                  Row {row.row_number || "?"}
                                </span>

                                <span
                                  className={`rounded-xl px-3 py-1 text-xs font-black ring-1 ${statusClass(
                                    row.status,
                                  )}`}
                                >
                                  {statusLabel(row.status)}
                                </span>

                                {row.reference && (
                                  <span className="rounded-xl bg-purple-500/10 px-3 py-1 text-xs font-black text-purple-100 ring-1 ring-purple-300/20">
                                    {row.reference}
                                  </span>
                                )}
                              </div>

                              <h3 className="mt-3 break-words text-lg font-black text-white">
                                {row.description || "Bank row"}
                              </h3>

                              <div className="mt-3 grid gap-2 text-sm text-white/60 sm:grid-cols-2 xl:grid-cols-4">
                                <div>
                                  Date:{" "}
                                  <strong className="text-white">
                                    {formatDate(row.transaction_date)}
                                  </strong>
                                </div>

                                <div>
                                  Amount:{" "}
                                  <strong
                                    className={
                                      Number(row.amount_pence || 0) >= 0
                                        ? "text-emerald-200"
                                        : "text-red-200"
                                    }
                                  >
                                    {money(row.amount_pence)}
                                  </strong>
                                </div>

                                <div>
                                  Money in:{" "}
                                  <strong className="text-emerald-200">
                                    {money(row.money_in_pence)}
                                  </strong>
                                </div>

                                <div>
                                  Money out:{" "}
                                  <strong className="text-red-200">
                                    {money(row.money_out_pence)}
                                  </strong>
                                </div>
                              </div>

                              {row.review_note && (
                                <div className="mt-3 rounded-2xl bg-white/10 p-3 text-sm text-white/65">
                                  <strong className="text-white">Note:</strong>{" "}
                                  {row.review_note}
                                </div>
                              )}
                            </div>

                            <div className="shrink-0 text-left lg:text-right">
                              <textarea
                                value={noteDrafts[row.id] || ""}
                                onChange={(event) =>
                                  setNoteDrafts((prev) => ({
                                    ...prev,
                                    [row.id]: event.target.value,
                                  }))
                                }
                                placeholder="Add review note..."
                                className="min-h-20 w-full rounded-2xl bg-black/30 p-3 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-purple-300/40 lg:w-72"
                              />

                              <div className="mt-2 flex flex-wrap gap-2 lg:justify-end">
                                <button
                                  type="button"
                                  disabled={updatingRowId === row.id}
                                  onClick={() =>
                                    updateRow({
                                      rowId: row.id,
                                      action: "needs_review",
                                    })
                                  }
                                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500/15 px-3 py-2 text-xs font-black text-amber-100 ring-1 ring-amber-300/20 hover:bg-amber-500/25 disabled:opacity-60"
                                >
                                  <ShieldAlert className="h-3 w-3" />
                                  Needs review
                                </button>

                                <button
                                  type="button"
                                  disabled={updatingRowId === row.id}
                                  onClick={() =>
                                    updateRow({
                                      rowId: row.id,
                                      action: "ignore",
                                    })
                                  }
                                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500/15 px-3 py-2 text-xs font-black text-sky-100 ring-1 ring-sky-300/20 hover:bg-sky-500/25 disabled:opacity-60"
                                >
                                  <XCircle className="h-3 w-3" />
                                  Ignore
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                            <p className="mb-3 text-sm font-black text-white">
                              Suggested money tracker matches
                            </p>

                            {row.candidates && row.candidates.length > 0 ? (
                              <div className="grid gap-3">
                                {row.candidates.map((candidate) => (
                                  <div
                                    key={candidate.transaction_id}
                                    className="rounded-2xl border border-white/10 bg-black/25 p-3"
                                  >
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                      <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span
                                            className={`rounded-xl px-3 py-1 text-xs font-black ring-1 ${confidenceClass(
                                              candidate.confidence,
                                            )}`}
                                          >
                                            {candidate.confidence.toUpperCase()} ·{" "}
                                            {candidate.score}%
                                          </span>

                                          {candidate.transaction_reference && (
                                            <span className="rounded-xl bg-white/10 px-3 py-1 text-xs font-black text-white/70 ring-1 ring-white/10">
                                              {
                                                candidate.transaction_reference
                                              }
                                            </span>
                                          )}
                                        </div>

                                        <p className="mt-2 break-words text-sm font-black text-white">
                                          {candidate.title ||
                                            "Money tracker transaction"}
                                        </p>

                                        <div className="mt-2 grid gap-2 text-xs text-white/55 sm:grid-cols-3">
                                          <div>
                                            Date:{" "}
                                            {formatDate(
                                              candidate.transaction_date,
                                            )}
                                          </div>
                                          <div>
                                            Amount:{" "}
                                            {money(candidate.amount_pence)}
                                          </div>
                                          <div>
                                            Type: {candidate.type || "Unknown"}
                                          </div>
                                        </div>

                                        {candidate.reasons?.length > 0 && (
                                          <div className="mt-2 flex flex-wrap gap-1">
                                            {candidate.reasons.map(
                                              (reason, index) => (
                                                <span
                                                  key={`${reason}-${index}`}
                                                  className="rounded-lg bg-white/10 px-2 py-1 text-[11px] font-bold text-white/55"
                                                >
                                                  {reason}
                                                </span>
                                              ),
                                            )}
                                          </div>
                                        )}
                                      </div>

                                      <button
                                        type="button"
                                        disabled={
                                          updatingRowId === row.id ||
                                          row.status === "matched"
                                        }
                                        onClick={() =>
                                          updateRow({
                                            rowId: row.id,
                                            action: "match",
                                            transactionId:
                                              candidate.transaction_id,
                                          })
                                        }
                                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-xs font-black text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {updatingRowId === row.id ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <CheckCircle2 className="h-3 w-3" />
                                        )}
                                        Match this
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="rounded-xl bg-black/20 p-3 text-sm text-white/50">
                                No suggested matches found. You may need to add
                                this transaction manually in the money tracker.
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </>
            ) : (
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl shadow-black/20">
                <FileSpreadsheet className="mx-auto h-12 w-12 text-white/35" />

                <h2 className="mt-4 text-2xl font-black text-white">
                  No bank import selected
                </h2>

                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-white/60">
                  Upload a CSV file or choose a recent import from the left to
                  start matching bank rows against your money tracker.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}