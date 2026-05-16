"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCcw,
  Search,
  Upload,
  X,
} from "lucide-react";

type ImportType = "income" | "expense";

type CsvPreviewRow = {
  id: string;
  selected: boolean;
  originalRow: Record<string, string>;
  rowNumber: number;
  transactionDate: string;
  bankStatementDate: string;
  bankStatementDescription: string;
  title: string;
  description: string;
  type: ImportType;
  amount: string;
  paymentMethod: string;
  category: string;
};

type ImportResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
  batchId?: string;
  importedCount?: number;
  failedCount?: number;
  imported?: any[];
  failedRows?: any[];
};

const paymentMethods = [
  "Bank Transfer",
  "Stripe",
  "Online Payment",
  "Cash",
  "PayPal",
  "Card Machine",
  "Personal Funds",
  "Item Donation",
];

function clean(value: unknown) {
  return String(value || "").trim();
}

function normaliseHeader(value: string) {
  return clean(value)
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .replace(/[^a-z0-9]+/g, "");
}

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);

  return result.map((item) => clean(item));
}

function parseCsvText(text: string) {
  const cleanText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = cleanText
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return {
      headers: [] as string[],
      rows: [] as Record<string, string>[],
    };
  }

  const headers = parseCsvLine(lines[0]).map((header) =>
    header.replace(/^\uFEFF/, "").trim(),
  );

  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });

    return row;
  });

  return { headers, rows };
}

function findColumn(headers: string[], possibleNames: string[]) {
  const normalisedPossible = possibleNames.map(normaliseHeader);

  return (
    headers.find((header) => {
      const normalised = normaliseHeader(header);
      return normalisedPossible.includes(normalised);
    }) || ""
  );
}

function findColumnContains(headers: string[], possibleParts: string[]) {
  const normalisedParts = possibleParts.map(normaliseHeader);

  return (
    headers.find((header) => {
      const normalised = normaliseHeader(header);
      return normalisedParts.some((part) => normalised.includes(part));
    }) || ""
  );
}

function parseMoneyValue(value: unknown) {
  const raw = clean(value)
    .replace("£", "")
    .replaceAll(",", "")
    .replace(/[()]/g, "")
    .trim();

  if (!raw) return 0;

  const numberValue = Number(raw);

  if (!Number.isFinite(numberValue)) return 0;

  const wasNegative =
    clean(value).includes("-") ||
    (clean(value).includes("(") && clean(value).includes(")"));

  return wasNegative ? -Math.abs(numberValue) : numberValue;
}

function formatAmount(value: number) {
  return Math.abs(value).toFixed(2);
}

function normaliseDate(value: unknown) {
  const raw = clean(value);

  if (!raw) return new Date().toISOString().slice(0, 10);

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const ukMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);

  if (ukMatch) {
    const day = ukMatch[1].padStart(2, "0");
    const month = ukMatch[2].padStart(2, "0");
    const year =
      ukMatch[3].length === 2 ? `20${ukMatch[3]}` : ukMatch[3].padStart(4, "0");

    return `${year}-${month}-${day}`;
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

function guessRows(headers: string[], csvRows: Record<string, string>[]) {
  const dateColumn =
    findColumn(headers, [
      "Date",
      "Transaction Date",
      "TransactionDate",
      "Posted Date",
      "Posting Date",
      "Bank Date",
      "Value Date",
    ]) || findColumnContains(headers, ["date"]);

  const descriptionColumn =
    findColumn(headers, [
      "Description",
      "Details",
      "Transaction Description",
      "Narrative",
      "Name",
      "Reference",
      "Memo",
    ]) || findColumnContains(headers, ["description", "detail", "narrative"]);

  const moneyInColumn =
    findColumn(headers, [
      "Money In",
      "Paid In",
      "Credit",
      "Credit Amount",
      "Deposit",
      "In",
      "Amount In",
    ]) || findColumnContains(headers, ["moneyin", "paidin", "credit", "deposit"]);

  const moneyOutColumn =
    findColumn(headers, [
      "Money Out",
      "Paid Out",
      "Debit",
      "Debit Amount",
      "Withdrawal",
      "Out",
      "Amount Out",
    ]) ||
    findColumnContains(headers, ["moneyout", "paidout", "debit", "withdrawal"]);

  const amountColumn =
    findColumn(headers, ["Amount", "Value", "Transaction Amount"]) ||
    findColumnContains(headers, ["amount", "value"]);

  return csvRows.map((row, index) => {
    const dateValue = row[dateColumn] || "";
    const descriptionValue = row[descriptionColumn] || "";

    const moneyIn = parseMoneyValue(row[moneyInColumn]);
    const moneyOut = parseMoneyValue(row[moneyOutColumn]);
    const singleAmount = parseMoneyValue(row[amountColumn]);

    let type: ImportType = "expense";
    let amount = 0;

    if (moneyIn > 0) {
      type = "income";
      amount = moneyIn;
    } else if (moneyOut > 0) {
      type = "expense";
      amount = moneyOut;
    } else if (singleAmount < 0) {
      type = "expense";
      amount = singleAmount;
    } else if (singleAmount > 0) {
      type = "income";
      amount = singleAmount;
    }

    const date = normaliseDate(dateValue);
    const description =
      clean(descriptionValue) || `CSV bank statement row ${index + 1}`;

    return {
      id: `${index}-${Math.random().toString(36).slice(2)}`,
      selected: amount > 0,
      originalRow: row,
      rowNumber: index + 1,
      transactionDate: date,
      bankStatementDate: date,
      bankStatementDescription: description,
      title: description.slice(0, 90),
      description,
      type,
      amount: amount > 0 ? formatAmount(amount) : "",
      paymentMethod: "Bank Transfer",
      category: "",
    } satisfies CsvPreviewRow;
  });
}

export default function MoneyCsvImport() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<CsvPreviewRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [responseDetails, setResponseDetails] = useState<ImportResponse | null>(
    null,
  );

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;

    const q = searchTerm.toLowerCase().trim();

    return rows.filter((row) => {
      return (
        row.title.toLowerCase().includes(q) ||
        row.description.toLowerCase().includes(q) ||
        row.bankStatementDescription.toLowerCase().includes(q) ||
        row.type.toLowerCase().includes(q) ||
        row.amount.toLowerCase().includes(q) ||
        row.paymentMethod.toLowerCase().includes(q) ||
        JSON.stringify(row.originalRow).toLowerCase().includes(q)
      );
    });
  }, [rows, searchTerm]);

  const selectedRows = useMemo(() => {
    return rows.filter((row) => row.selected);
  }, [rows]);

  const totals = useMemo(() => {
    const income = selectedRows
      .filter((row) => row.type === "income")
      .reduce((sum, row) => sum + parseMoneyValue(row.amount), 0);

    const expense = selectedRows
      .filter((row) => row.type === "expense")
      .reduce((sum, row) => sum + parseMoneyValue(row.amount), 0);

    return {
      selected: selectedRows.length,
      income,
      expense,
      balance: income - expense,
    };
  }, [selectedRows]);

  function updateRow(id: string, changes: Partial<CsvPreviewRow>) {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...changes } : row)),
    );
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    try {
      setError("");
      setMessage("");
      setResponseDetails(null);

      const file = event.target.files?.[0];

      if (!file) return;

      if (!file.name.toLowerCase().endsWith(".csv")) {
        setError("Please upload a CSV file.");
        return;
      }

      setFileName(file.name);

      const text = await file.text();
      const parsed = parseCsvText(text);

      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        setError("No CSV rows found. Please check the file and try again.");
        setRows([]);
        return;
      }

      const guessedRows = guessRows(parsed.headers, parsed.rows);
      setRows(guessedRows);

      setMessage(
        `${guessedRows.length} CSV row${guessedRows.length === 1 ? "" : "s"} loaded. Please review before importing.`,
      );
    } catch (err: any) {
      setError(err?.message || "Failed to read CSV file.");
      setRows([]);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function selectAllVisible() {
    const visibleIds = new Set(filteredRows.map((row) => row.id));

    setRows((prev) =>
      prev.map((row) =>
        visibleIds.has(row.id) ? { ...row, selected: true } : row,
      ),
    );
  }

  function deselectAllVisible() {
    const visibleIds = new Set(filteredRows.map((row) => row.id));

    setRows((prev) =>
      prev.map((row) =>
        visibleIds.has(row.id) ? { ...row, selected: false } : row,
      ),
    );
  }

  function clearImport() {
    setFileName("");
    setRows([]);
    setSearchTerm("");
    setMessage("");
    setError("");
    setResponseDetails(null);
  }

  async function importSelectedRows() {
    try {
      setImporting(true);
      setError("");
      setMessage("");
      setResponseDetails(null);

      const rowsToImport = rows.filter((row) => row.selected);

      if (rowsToImport.length === 0) {
        setError("Please select at least one row to import.");
        return;
      }

      const invalidRow = rowsToImport.find((row) => {
        return (
          !row.title.trim() ||
          !row.transactionDate ||
          !row.amount ||
          parseMoneyValue(row.amount) <= 0
        );
      });

      if (invalidRow) {
        setError(
          `Row ${invalidRow.rowNumber} needs a title, date, and amount before it can be imported.`,
        );
        return;
      }

      const res = await fetch("/api/admin/money/csv-import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rows: rowsToImport.map((row) => ({
            selected: row.selected,
            title: row.title,
            description: row.description,
            type: row.type,
            category: row.category,
            amount: row.amount,
            paymentMethod: row.paymentMethod,
            transactionDate: row.transactionDate,
            bankStatementDate: row.bankStatementDate,
            bankStatementDescription: row.bankStatementDescription,
            originalRow: row.originalRow,
          })),
        }),
      });

      const text = await res.text();

      let data: ImportResponse = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: text };
      }

      setResponseDetails(data);

      if (!res.ok || !data.ok) {
        throw {
          message: data.error || "Failed to import CSV rows.",
          details: data,
        };
      }

      const importedIds = new Set(
        rowsToImport.map((row) => `${row.rowNumber}-${row.title}-${row.amount}`),
      );

      setRows((prev) =>
        prev.filter(
          (row) => !importedIds.has(`${row.rowNumber}-${row.title}-${row.amount}`),
        ),
      );

      setMessage(
        data.message ||
          `${data.importedCount || rowsToImport.length} transaction(s) imported successfully.`,
      );
    } catch (err: any) {
      setError(err?.message || "Something went wrong importing CSV rows.");
      setResponseDetails(err?.details || null);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="min-w-0 space-y-6 text-white">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-4 py-2 text-xs font-bold text-emerald-100 ring-1 ring-emerald-300/20">
              <FileSpreadsheet className="h-4 w-4" />
              Bank Statement CSV Import
            </div>

            <h1 className="break-words text-3xl font-black tracking-tight">
              CSV Import
            </h1>

            <p className="mt-2 max-w-4xl text-sm leading-6 text-white/60">
              Upload a bank statement CSV, review each row, choose what should
              be imported, then create money tracker transactions manually from
              the preview.
            </p>

            {fileName && (
              <p className="mt-3 text-xs font-semibold text-white/45">
                Loaded file: <span className="text-white">{fileName}</span>
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-500/15 px-4 py-3 text-sm font-bold text-emerald-200 ring-1 ring-emerald-300/20 hover:bg-emerald-500/25">
              <Upload className="h-4 w-4" />
              Upload CSV
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={clearImport}
              disabled={rows.length === 0 && !fileName}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/10 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              Clear
            </button>
          </div>
        </div>
      </section>

      {error && (
        <section className="rounded-3xl border border-red-400/30 bg-red-500/10 p-5">
          <div className="flex items-center gap-2 font-bold text-red-100">
            <AlertTriangle className="h-5 w-5" />
            Error
          </div>

          <p className="mt-2 text-sm text-red-100">{error}</p>

          {responseDetails && (
            <pre className="mt-4 max-h-80 overflow-auto rounded-2xl bg-black/40 p-4 text-xs text-red-100">
              {JSON.stringify(responseDetails, null, 2)}
            </pre>
          )}
        </section>
      )}

      {message && (
        <section className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-5">
          <div className="flex items-center gap-2 font-bold text-emerald-100">
            <CheckCircle2 className="h-5 w-5" />
            Success
          </div>

          <p className="mt-2 text-sm text-emerald-100">{message}</p>

          {responseDetails?.batchId && (
            <p className="mt-2 text-xs text-emerald-100/70">
              Batch ID: {responseDetails.batchId}
            </p>
          )}
        </section>
      )}

      {rows.length > 0 && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Rows Loaded" value={rows.length} />
            <StatCard label="Selected" value={totals.selected} />
            <StatCard label="Money In" value={`£${totals.income.toFixed(2)}`} />
            <StatCard label="Money Out" value={`£${totals.expense.toFixed(2)}`} />
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />

                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search CSV rows by title, description, amount, type, payment method, or raw data..."
                  className="w-full rounded-2xl bg-black/30 py-3 pl-11 pr-4 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/40 focus:ring-emerald-300/40"
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={selectAllVisible}
                  className="rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/10 hover:bg-white/20"
                >
                  Select visible
                </button>

                <button
                  type="button"
                  onClick={deselectAllVisible}
                  className="rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/10 hover:bg-white/20"
                >
                  Deselect visible
                </button>

                <button
                  type="button"
                  onClick={importSelectedRows}
                  disabled={selectedRows.length === 0 || importing}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500/15 px-4 py-3 text-sm font-bold text-emerald-200 ring-1 ring-emerald-300/20 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCcw
                    className={`h-4 w-4 ${importing ? "animate-spin" : ""}`}
                  />
                  {importing
                    ? "Importing..."
                    : `Import ${selectedRows.length} selected`}
                </button>
              </div>
            </div>

            <div className="mb-4 rounded-2xl bg-black/20 px-4 py-3 text-sm text-white/60">
              Showing <strong className="text-white">{filteredRows.length}</strong>{" "}
              CSV row{filteredRows.length === 1 ? "" : "s"} from{" "}
              <strong className="text-white">{rows.length}</strong> loaded.
            </div>

            <div className="w-full max-w-[calc(100vw-2rem)] overflow-x-auto rounded-2xl border border-white/10 xl:max-w-full">
              <table className="w-full min-w-[1350px] text-sm">
                <thead className="bg-white/10 text-white/60">
                  <tr>
                    <th className="p-3 text-left">Import</th>
                    <th className="p-3 text-left">CSV Row</th>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Title</th>
                    <th className="p-3 text-left">Type</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-left">Payment</th>
                    <th className="p-3 text-left">Description</th>
                    <th className="p-3 text-left">Raw Bank Line</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.id} className="border-t border-white/10">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={(event) =>
                            updateRow(row.id, {
                              selected: event.target.checked,
                            })
                          }
                          className="h-5 w-5 rounded border-white/20 bg-black/30"
                        />
                      </td>

                      <td className="whitespace-nowrap p-3 text-white/60">
                        #{row.rowNumber}
                      </td>

                      <td className="min-w-[150px] p-3">
                        <input
                          type="date"
                          value={row.transactionDate}
                          onChange={(event) =>
                            updateRow(row.id, {
                              transactionDate: event.target.value,
                              bankStatementDate: event.target.value,
                            })
                          }
                          className="w-full rounded-xl bg-black/30 px-3 py-2 text-xs font-bold text-white outline-none ring-1 ring-white/10 focus:ring-emerald-300/40"
                        />
                      </td>

                      <td className="min-w-[240px] p-3">
                        <input
                          value={row.title}
                          onChange={(event) =>
                            updateRow(row.id, {
                              title: event.target.value,
                            })
                          }
                          className="w-full rounded-xl bg-black/30 px-3 py-2 text-xs text-white outline-none ring-1 ring-white/10 focus:ring-emerald-300/40"
                        />
                      </td>

                      <td className="min-w-[140px] p-3">
                        <select
                          value={row.type}
                          onChange={(event) =>
                            updateRow(row.id, {
                              type: event.target.value as ImportType,
                            })
                          }
                          className="w-full rounded-xl bg-black/30 px-3 py-2 text-xs font-bold text-white outline-none ring-1 ring-white/10 focus:ring-emerald-300/40"
                        >
                          <option className="bg-[#11111f]" value="income">
                            Money In
                          </option>
                          <option className="bg-[#11111f]" value="expense">
                            Money Out
                          </option>
                        </select>
                      </td>

                      <td className="min-w-[140px] p-3 text-right">
                        <input
                          value={row.amount}
                          onChange={(event) =>
                            updateRow(row.id, {
                              amount: event.target.value,
                            })
                          }
                          className="w-full rounded-xl bg-black/30 px-3 py-2 text-right text-xs font-bold text-white outline-none ring-1 ring-white/10 focus:ring-emerald-300/40"
                        />
                      </td>

                      <td className="min-w-[180px] p-3">
                        <select
                          value={row.paymentMethod}
                          onChange={(event) =>
                            updateRow(row.id, {
                              paymentMethod: event.target.value,
                            })
                          }
                          className="w-full rounded-xl bg-black/30 px-3 py-2 text-xs font-bold text-white outline-none ring-1 ring-white/10 focus:ring-emerald-300/40"
                        >
                          {paymentMethods.map((method) => (
                            <option
                              key={method}
                              className="bg-[#11111f]"
                              value={method}
                            >
                              {method}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="min-w-[260px] p-3">
                        <textarea
                          value={row.description}
                          onChange={(event) =>
                            updateRow(row.id, {
                              description: event.target.value,
                              bankStatementDescription: event.target.value,
                            })
                          }
                          rows={2}
                          className="w-full rounded-xl bg-black/30 px-3 py-2 text-xs text-white outline-none ring-1 ring-white/10 focus:ring-emerald-300/40"
                        />
                      </td>

                      <td className="max-w-[320px] p-3">
                        <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/30 p-3 text-[11px] text-white/45">
                          {JSON.stringify(row.originalRow, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-3xl bg-white/[0.04] p-5 text-white ring-1 ring-white/10">
      <p className="text-sm text-white/60">{label}</p>
      <p className="mt-1 break-words text-3xl font-black">{value}</p>
    </div>
  );
}