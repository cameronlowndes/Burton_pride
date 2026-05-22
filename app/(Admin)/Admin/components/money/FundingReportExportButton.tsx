"use client";

import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";

type Props = {
  fundingId: string;
  year: string;
  label?: string;
  className?: string;
};

async function parseExportError(response: Response) {
  const text = await response.text().catch(() => "");
  let payload: any = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  return [
    `Grant / funding export failed (${response.status} ${response.statusText || "Request failed"})`,
    payload?.error ? `Main error: ${payload.error}` : null,
    payload?.details ? `Details: ${payload.details}` : null,
    !payload && text ? `Raw response: ${text}` : null,
    `API route: ${response.url}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function getFileName(response: Response, fallback: string) {
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/i);
  return match?.[1] || fallback;
}

export default function FundingReportExportButton({
  fundingId,
  year,
  label = "Export funding report",
  className = "",
}: Props) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  async function exportReport() {
    if (!fundingId) {
      setError("Funding record ID is missing.");
      return;
    }

    setExporting(true);
    setError("");

    try {
      const params = new URLSearchParams({
        fundingId,
        year,
      });

      const response = await fetch(
        `/api/admin/money/funding-report/export?${params.toString()}`,
        {
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error(await parseExportError(response));
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = getFileName(
        response,
        `funding-report-${year || new Date().getFullYear()}.xlsx`,
      );

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || "Could not export funding report.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={exportReport}
        disabled={exporting || !fundingId}
        className={
          className ||
          "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        {exporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="h-4 w-4" />
        )}
        {exporting ? "Exporting..." : label}
      </button>

      {error && (
        <div className="whitespace-pre-wrap rounded-2xl border border-red-300/25 bg-red-500/10 p-3 text-xs leading-5 text-red-100">
          {error}
        </div>
      )}
    </div>
  );
}
