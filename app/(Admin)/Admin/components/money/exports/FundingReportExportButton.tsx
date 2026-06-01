"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  FileSpreadsheet,
  Loader2,
  X,
} from "lucide-react";

type Props = {
  fundingId: string;
  year: string;
  label?: string;
  className?: string;
};

type ExportError = {
  title: string;
  message: string;
  status?: number;
  statusText?: string;
  route?: string;
  possibleFix?: string;
  rawError?: string;
  details?: string[];
};

function getHelpfulFix(status: number, route: string) {
  if (status === 400) {
    return {
      title: "Bad request",
      message: "The funding export route rejected the request.",
      possibleFix:
        "Check that fundingId and year are being sent correctly. The fundingId may be missing or the year may be invalid.",
      details: [
        "Make sure the button has a real fundingId.",
        "Make sure year is a valid year like 2026.",
        `API route used: ${route}`,
      ],
    };
  }

  if (status === 401) {
    return {
      title: "Not signed in",
      message: "Your login session has expired or you are not signed in.",
      possibleFix: "Sign out, sign back in, then try the export again.",
      details: [
        "The route is protected by Clerk auth.",
        "The server returned 401 before creating the Excel file.",
      ],
    };
  }

  if (status === 403) {
    return {
      title: "Permission blocked",
      message: "You do not have permission to export this funding report.",
      possibleFix:
        "Check your admin permission logic in the API route, such as requireMainAdmin, Clerk checks, or role checks.",
      details: [
        "The route exists but blocked the current user.",
        `API route used: ${route}`,
      ],
    };
  }

  if (status === 404) {
    return {
      title: "API route missing",
      message: "The funding report export API route could not be found.",
      possibleFix:
        "Create this file: app/api/admin/money/funding-report/export/route.ts, or update the button fetch URL to the route you actually created.",
      details: [
        "Next.js could not find the route.",
        "Check the folder name and route.ts file name.",
        `API route used: ${route}`,
      ],
    };
  }

  if (status === 405) {
    return {
      title: "Wrong API method",
      message: "The API route exists but does not export a GET function.",
      possibleFix:
        "Open app/api/admin/money/funding-report/export/route.ts and make sure it has: export async function GET(req: Request) { ... }",
      details: [
        "App Router API routes must use named method exports.",
        "Do not use default export in route.ts.",
      ],
    };
  }

  if (status === 500) {
    return {
      title: "Server error",
      message: "The funding export route crashed while creating the Excel file.",
      possibleFix:
        "Check your terminal or Vercel logs. Common causes are missing Supabase tables, wrong column names, missing fundingId match, or ExcelJS response errors.",
      details: [
        "The route was found.",
        "The request reached the server.",
        "The server failed while building the export.",
      ],
    };
  }

  return {
    title: "Export failed",
    message: "The funding export failed.",
    possibleFix:
      "Check the browser console, terminal logs, Vercel logs, and API route response.",
    details: [`API route used: ${route}`],
  };
}

async function parseExportError(response: Response): Promise<ExportError> {
  const route = response.url;
  const status = response.status;
  const statusText = response.statusText || "Request failed";
  const text = await response.text().catch(() => "");

  let payload: any = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  const help = getHelpfulFix(status, route);

  const serverDetails =
    payload?.details && typeof payload.details === "object"
      ? JSON.stringify(payload.details, null, 2)
      : payload?.details
        ? String(payload.details)
        : "";

  const rawError =
    payload?.error ||
    payload?.message ||
    payload?.details?.message ||
    serverDetails ||
    text ||
    "No error body was returned by the server.";

  return {
    title: help.title,
    message: payload?.error || payload?.details?.message || help.message,
    status,
    statusText,
    route,
    possibleFix: help.possibleFix,
    rawError,
    details: [
      `Funding export failed with HTTP ${status} ${statusText}`,
      `API route: ${route}`,
      ...help.details,
      payload?.details?.table ? `Supabase table: ${payload.details.table}` : "",
      payload?.details?.code ? `Supabase code: ${payload.details.code}` : "",
      payload?.details?.hint ? `Supabase hint: ${payload.details.hint}` : "",
      payload?.details?.expectedFile
        ? `Expected file: ${payload.details.expectedFile}`
        : "",
      serverDetails ? `Server details: ${serverDetails}` : "",
    ].filter(Boolean),
  };
}

function getFileName(response: Response, fallback: string) {
  const disposition = response.headers.get("content-disposition") || "";
  const match =
    disposition.match(/filename="([^"]+)"/i) ||
    disposition.match(/filename=([^;]+)/i);

  return match?.[1]?.replaceAll('"', "").trim() || fallback;
}

function makeCopyText(error: ExportError) {
  return [
    "Grant / funding export error",
    "",
    `Title: ${error.title}`,
    `Message: ${error.message}`,
    error.status ? `Status: ${error.status}` : "",
    error.statusText ? `Status text: ${error.statusText}` : "",
    error.route ? `Route: ${error.route}` : "",
    error.possibleFix ? `Possible fix: ${error.possibleFix}` : "",
    error.rawError ? `Raw error: ${error.rawError}` : "",
    error.details?.length ? `Details:\n- ${error.details.join("\n- ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export default function FundingReportExportButton({
  fundingId,
  year,
  label = "Export funding report",
  className = "",
}: Props) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<ExportError | null>(null);
  const [success, setSuccess] = useState("");
  const [copied, setCopied] = useState(false);

  async function copyErrorDetails() {
    if (!error) return;

    try {
      await navigator.clipboard.writeText(makeCopyText(error));
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      setCopied(false);
    }
  }

  async function exportReport() {
    if (!fundingId) {
      setSuccess("");
      setError({
        title: "Funding ID missing",
        message: "Funding record ID is missing.",
        possibleFix:
          "Make sure this button is rendered inside a funding record card and receives funding.id as the fundingId prop.",
        details: [
          "The button cannot export without a fundingId.",
          `Year received: ${year || "No year supplied"}`,
        ],
      });
      return;
    }

    setExporting(true);
    setError(null);
    setSuccess("");

    const params = new URLSearchParams({
      fundingId,
      year: year || String(new Date().getFullYear()),
    });

    const route = `/api/admin/money/funding-report/export?${params.toString()}`;

    try {
      const response = await fetch(route, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        setError(await parseExportError(response));
        return;
      }

      const blob = await response.blob();

      if (!blob || blob.size === 0) {
        setError({
          title: "Empty export file",
          message: "The funding export route worked, but it returned an empty file.",
          route,
          status: response.status,
          statusText: response.statusText,
          possibleFix:
            "Check the API route and make sure it returns the Excel workbook buffer in the response body.",
          details: [
            `Funding ID: ${fundingId}`,
            `Year: ${year}`,
            "The HTTP request succeeded but the file size was 0 bytes.",
          ],
        });
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = getFileName(
        response,
        `funding-report-${year || new Date().getFullYear()}.xlsx`
      );

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSuccess(
        `Funding report downloaded successfully. File size: ${(
          blob.size / 1024
        ).toFixed(1)} KB`
      );
    } catch (err: any) {
      setError({
        title: "Export could not start",
        message:
          "The browser could not complete the funding export request. This may be a network issue, route crash, or JavaScript error.",
        route,
        rawError: err?.message || String(err),
        possibleFix:
          "Check the browser console and terminal/Vercel logs. Also check that the funding export API route exists and returns an Excel file response.",
        details: [
          `Funding ID: ${fundingId}`,
          `Year: ${year}`,
          `API route: ${route}`,
          "This error happened before a valid download could be completed.",
        ],
      });
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

      {success && (
        <div className="flex items-start gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-3 text-xs leading-5 text-emerald-100">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-300/25 bg-red-500/10 p-3 text-xs leading-5 text-red-100">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

            <div className="min-w-0 flex-1">
              <div className="font-black text-white">{error.title}</div>

              <p className="mt-1 whitespace-pre-wrap font-semibold">
                {error.message}
              </p>

              {error.status && (
                <div className="mt-2 rounded-xl border border-white/10 bg-black/20 p-2">
                  <div className="font-black text-red-100/70">HTTP status</div>
                  <div className="mt-1 font-black text-white">
                    {error.status} {error.statusText || ""}
                  </div>
                </div>
              )}

              {error.route && (
                <div className="mt-2 rounded-xl border border-white/10 bg-black/20 p-2">
                  <div className="font-black text-red-100/70">API route</div>
                  <code className="mt-1 block break-all text-red-50">
                    {error.route}
                  </code>
                </div>
              )}

              {error.possibleFix && (
                <div className="mt-2 rounded-xl border border-white/10 bg-black/20 p-2">
                  <div className="font-black text-red-100/70">Possible fix</div>
                  <p className="mt-1 whitespace-pre-wrap">{error.possibleFix}</p>
                </div>
              )}

              {error.details && error.details.length > 0 && (
                <div className="mt-2 rounded-xl border border-white/10 bg-black/20 p-2">
                  <div className="font-black text-red-100/70">Details</div>
                  <ul className="mt-1 space-y-1">
                    {error.details.map((detail) => (
                      <li key={detail} className="break-words">
                        • {detail}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {error.rawError && (
                <div className="mt-2 rounded-xl border border-red-300/20 bg-red-950/30 p-2">
                  <div className="font-black text-red-100/70">
                    Raw server error
                  </div>
                  <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-5">
                    {error.rawError}
                  </pre>
                </div>
              )}

              <button
                type="button"
                onClick={copyErrorDetails}
                className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-950 hover:bg-white/90"
              >
                <Clipboard className="h-3.5 w-3.5" />
                {copied ? "Copied" : "Copy error details"}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setError(null)}
              className="rounded-full p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
              aria-label="Clear export error"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}