"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ElementType } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Copy,
  Download,
  FileArchive,
  FileSpreadsheet,
  Filter,
  History,
  Info,
  Landmark,
  Loader2,
  PiggyBank,
  Printer,
  ReceiptText,
  RefreshCcw,
  RotateCcw,
  ScrollText,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  UploadCloud,
  WalletCards,
  X,
} from "lucide-react";

type IconKey =
  | "archive"
  | "report"
  | "spreadsheet"
  | "receipt"
  | "history"
  | "personal"
  | "upload"
  | "bank"
  | "refund";

type ExportCategory =
  | "all"
  | "recommended"
  | "accountant"
  | "finance"
  | "checking"
  | "admin";

type ExportItem = {
  key: string;
  title: string;
  description: string;
  buttonText: string;
  url: string;
  fileName: string;
  iconKey: IconKey;
  colour: string;
  buttonColour: string;
  recommended?: boolean;
  disabled?: boolean;
  disabledMessage?: string;
};

type PageStatus =
  | {
      type: "success" | "error" | "loading";
      title?: string;
      message: string;
      route?: string;
      statusCode?: number;
      statusText?: string;
      rawError?: string;
      possibleFix?: string;
      details?: string[];
      copyText?: string;
    }
  | null;

type Props = {
  defaultYear: number;
  exportItems: ExportItem[];
};

const EASY_MODE_STORAGE_KEY = "burton-pride-money-exports-easy-mode";

const ICONS: Record<IconKey, ElementType> = {
  archive: FileArchive,
  report: ScrollText,
  spreadsheet: FileSpreadsheet,
  receipt: ReceiptText,
  history: History,
  personal: PiggyBank,
  upload: UploadCloud,
  bank: WalletCards,
  refund: RotateCcw,
};

const CATEGORY_LABELS: Record<ExportCategory, string> = {
  all: "All",
  recommended: "Recommended",
  accountant: "Accountant",
  finance: "Finance",
  checking: "Checking",
  admin: "Admin",
};

const CATEGORY_HELP: Record<ExportCategory, string> = {
  all: "Shows every export available.",
  recommended: "Shows the best option to send everything together.",
  accountant: "Best for your accountant or end-of-year accounts.",
  finance: "Core money reports like yearly totals and transactions.",
  checking: "Useful for checking receipts, bank checks, and missing evidence.",
  admin: "Admin records, audit logs, and import history.",
};

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function getCategory(item: ExportItem): ExportCategory {
  if (item.recommended || item.key === "accountant-pack") return "accountant";

  if (
    item.key === "yearly-report" ||
    item.key === "transaction-list" ||
    item.key === "personal-funds" ||
    item.key === "refunds"
  ) {
    return "finance";
  }

  if (item.key === "receipts" || item.key === "bank-balance-checks") {
    return "checking";
  }

  return "admin";
}

function getSimpleUse(item: ExportItem) {
  if (item.key === "accountant-pack") {
    return "Use this when sending everything to your accountant in one go.";
  }

  if (item.key === "yearly-report") {
    return "Use this for the main yearly summary.";
  }

  if (item.key === "transaction-list") {
    return "Use this to check every money in and money out item.";
  }

  if (item.key === "receipts") {
    return "Use this to check uploaded receipts and spot missing receipts.";
  }

  if (item.key === "audit-logs") {
    return "Use this to see who created, edited, deleted, or restored records.";
  }

  if (item.key === "funding-breakdown") {
    return "Use this for sponsors, grants, restricted funds, and remaining balances.";
  }

  if (item.key === "personal-funds") {
    return "Use this to check money paid personally and repayments still owed.";
  }

  if (item.key === "csv-import-history") {
    return "Use this to check imported bank CSV files and failed rows.";
  }

  if (item.key === "bank-balance-checks") {
    return "Use this to compare the tracker balance with the real bank statement.";
  }

  if (item.key === "refunds") {
    return "Use this to review refunds separately from ordinary income and expenses.";
  }

  return "Use this to export this report.";
}

function getExportContents(item: ExportItem) {
  if (item.key === "accountant-pack") {
    return [
      "Yearly report",
      "Transaction list",
      "Receipts index",
      "Audit logs",
      "Funding breakdown",
      "Personal funds report",
      "CSV import history",
      "Refund tracker report",
    ];
  }

  if (item.key === "yearly-report") {
    return [
      "Income total",
      "Expense total",
      "Year balance",
      "Personal funds totals",
    ];
  }

  if (item.key === "transaction-list") {
    return [
      "Transaction date",
      "Title",
      "Category",
      "Payment method",
      "Amount",
      "Receipt link",
    ];
  }

  if (item.key === "receipts") {
    return [
      "Transactions with receipts",
      "Receipt file links",
      "Receipt notes",
      "Amounts",
    ];
  }

  if (item.key === "audit-logs") {
    return [
      "Action taken",
      "Who did it",
      "When it happened",
      "Before and after data",
    ];
  }

  if (item.key === "funding-breakdown") {
    return [
      "Sponsor/funding name",
      "Received",
      "Spent",
      "Remaining",
      "Notes",
    ];
  }

  if (item.key === "personal-funds") {
    return [
      "Who paid personally",
      "Amount",
      "Paid back status",
      "Outstanding amount",
    ];
  }

  if (item.key === "csv-import-history") {
    return ["CSV file name", "Imported rows", "Failed rows", "Error notes"];
  }

  if (item.key === "bank-balance-checks") {
    return [
      "Bank statement balance",
      "Tracker balance",
      "Difference",
      "Check notes",
    ];
  }

  if (item.key === "refunds") {
    return [
      "Refund reference",
      "Refund date",
      "Refund type",
      "Amount",
      "Status",
      "Supplier",
      "Original transaction",
      "Deleted refund records",
    ];
  }

  return ["Report data"];
}

function getPlainFileType(fileName: string) {
  if (fileName.toLowerCase().endsWith(".zip")) return "ZIP pack";
  if (fileName.toLowerCase().endsWith(".xlsx")) return "Excel file";
  if (fileName.toLowerCase().endsWith(".csv")) return "CSV file";
  return "Download";
}

function buildUrlWithYear(url: string, year: number) {
  const [path, queryString] = url.split("?");
  const params = new URLSearchParams(queryString || "");
  params.set("year", String(year));
  return `${path}?${params.toString()}`;
}

function buildPrintUrl(exportKey: string, year: number) {
  const safeExportKey = encodeURIComponent(exportKey);
  const params = new URLSearchParams();

  params.set("year", String(year));

  return `/api/admin/money/export/print/${safeExportKey}?${params.toString()}`;
}

function fileNameWithYear(
  fileName: string,
  defaultYear: number,
  selectedYear: number
) {
  return fileName.replace(String(defaultYear), String(selectedYear));
}

function routeToFilePath(route: string) {
  const pathOnly = route.split("?")[0] || route;

  if (!pathOnly.startsWith("/api/")) {
    return "Could not work out route file path.";
  }

  return `app${pathOnly}/route.ts`;
}

async function saveExportLog({
  action,
  item,
  year,
  route,
  fileName,
  status,
  errorMessage,
  metadata,
}: {
  action: "export" | "print";
  item: ExportItem | { key: string; title: string; fileName?: string };
  year: number;
  route: string;
  fileName?: string;
  status: "started" | "success" | "failed";
  errorMessage?: string;
  metadata?: any;
}) {
  try {
    await fetch("/api/admin/money/export/logs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        action,
        export_key: item.key,
        export_title: item.title,
        export_type: action,
        export_year: year,
        route,
        file_name: fileName || item.fileName || null,
        status,
        error_message: errorMessage || null,
        metadata: metadata || null,
      }),
    });
  } catch (error) {
    console.error("Could not save export log", error);
  }
}

function openPrintExport({
  exportKey,
  exportTitle,
  year,
  fileName,
}: {
  exportKey: string;
  exportTitle: string;
  year: number;
  fileName?: string;
}) {
  const printUrl = buildPrintUrl(exportKey, year);

  saveExportLog({
    action: "print",
    item: {
      key: exportKey,
      title: exportTitle,
      fileName,
    },
    year,
    route: printUrl,
    fileName,
    status: "started",
    metadata: {
      opened_from: "money_exports_page",
    },
  });

  window.open(printUrl, "_blank", "width=1200,height=850");
}

function printSingleExportItem(
  item: ExportItem,
  selectedYear: number,
  defaultYear: number
) {
  if (item.disabled || item.key === "bank-balance-checks") {
    return;
  }

  openPrintExport({
    exportKey: item.key,
    exportTitle: item.title,
    year: selectedYear,
    fileName: fileNameWithYear(item.fileName, defaultYear, selectedYear),
  });
}

function getHelpfulError(statusCode: number, route: string) {
  const routeFile = routeToFilePath(route);

  if (statusCode === 400) {
    return {
      message: "The export route rejected the request.",
      possibleFix:
        "Check the year value and any required query parameters in the export route.",
      details: [
        "This usually means the API route found something wrong with the request.",
        `Check this file: ${routeFile}`,
      ],
    };
  }

  if (statusCode === 401) {
    return {
      message: "You are not signed in, or your login session expired.",
      possibleFix: "Sign out, sign back in, then try the export again.",
      details: [
        "The route is protected by Clerk auth.",
        "The route returned 401 before downloading the file.",
      ],
    };
  }

  if (statusCode === 403) {
    return {
      message: "You do not have permission to download this export.",
      possibleFix:
        "Check your admin permission logic, such as requireMainAdmin, Clerk user checks, or role permissions.",
      details: [
        "The route exists, but it blocked the current user.",
        `Check this file: ${routeFile}`,
      ],
    };
  }

  if (statusCode === 404) {
    return {
      message: "This export API route does not exist yet.",
      possibleFix: `Create this file: ${routeFile}`,
      details: [
        "The button is pointing to an API route that Next.js cannot find.",
        "Create the route.ts file or correct the button URL.",
      ],
    };
  }

  if (statusCode === 405) {
    return {
      message: "The API route exists but does not export a GET function.",
      possibleFix:
        "Open the route.ts file and make sure it uses: export async function GET(req: Request) { ... }",
      details: [
        "This often happens when the route has a default export.",
        "App Router API routes must use named HTTP method exports.",
        `Check this file: ${routeFile}`,
      ],
    };
  }

  if (statusCode === 500) {
    return {
      message: "The export route crashed on the server.",
      possibleFix:
        "Check your terminal or Vercel logs. Common causes are missing Supabase tables, wrong column names, ExcelJS errors, or broken route code.",
      details: [
        "The route was found but failed while creating the export.",
        `Check this file: ${routeFile}`,
        "Check Supabase table names and column names.",
        "Check whether ExcelJS and JSZip are installed if this is the accountant pack.",
      ],
    };
  }

  return {
    message: "The export failed.",
    possibleFix:
      "Check the browser console, terminal logs, and API route response.",
    details: [`Check this file: ${routeFile}`],
  };
}

async function readExportError(response: Response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const json = await response.json();

      return {
        error:
          json?.error ||
          json?.message ||
          json?.details ||
          JSON.stringify(json, null, 2),
        details: json?.details || json,
      };
    } catch {
      return {
        error: "The server returned JSON, but the error could not be read.",
        details: null,
      };
    }
  }

  try {
    const text = await response.text();

    return {
      error: text || "No error body was returned by the server.",
      details: null,
    };
  } catch {
    return {
      error: "Could not read the error response.",
      details: null,
    };
  }
}

function makeCopyText(status: NonNullable<PageStatus>) {
  return [
    `Money export issue`,
    ``,
    `Title: ${status.title || ""}`,
    `Message: ${status.message || ""}`,
    status.route ? `Route: ${status.route}` : "",
    status.statusCode ? `Status: ${status.statusCode}` : "",
    status.statusText ? `Status text: ${status.statusText}` : "",
    status.possibleFix ? `Possible fix: ${status.possibleFix}` : "",
    status.rawError ? `Raw error: ${status.rawError}` : "",
    status.details?.length ? `Details:\n- ${status.details.join("\n- ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function StatusBox({
  status,
  onClear,
}: {
  status: PageStatus;
  onClear: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!status) return null;

  const copyText = status.copyText || makeCopyText(status);

  async function copyErrorDetails() {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className={classNames(
        "money-print-hidden mt-5 w-full rounded-2xl border p-4 text-sm shadow-xl",
        status.type === "success" &&
          "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
        status.type === "error" &&
          "border-red-400/30 bg-red-500/10 text-red-100",
        status.type === "loading" &&
          "border-blue-400/30 bg-blue-500/10 text-blue-100"
      )}
    >
      <div className="flex items-start gap-3">
        {status.type === "success" ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        ) : status.type === "error" ? (
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        ) : (
          <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin" />
        )}

        <div className="min-w-0 flex-1">
          <div className="font-black text-white">
            {status.title ||
              (status.type === "error"
                ? "Export failed"
                : status.type === "success"
                  ? "Export complete"
                  : "Preparing export")}
          </div>

          <p className="mt-1 font-bold leading-6 opacity-90">
            {status.message}
          </p>

          {status.route && (
            <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/30 p-3">
              <div className="text-xs font-black uppercase tracking-wide text-white/45">
                API route
              </div>
              <code className="mt-1 block break-all text-xs font-bold text-white/80">
                {status.route}
              </code>
            </div>
          )}

          {(status.statusCode || status.statusText) && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {status.statusCode && (
                <div className="rounded-xl border border-white/10 bg-slate-950/30 p-3">
                  <div className="text-xs font-black uppercase tracking-wide text-white/45">
                    HTTP status
                  </div>
                  <div className="mt-1 text-lg font-black text-white">
                    {status.statusCode}
                  </div>
                </div>
              )}

              {status.statusText && (
                <div className="rounded-xl border border-white/10 bg-slate-950/30 p-3">
                  <div className="text-xs font-black uppercase tracking-wide text-white/45">
                    Status text
                  </div>
                  <div className="mt-1 text-lg font-black text-white">
                    {status.statusText || "No status text"}
                  </div>
                </div>
              )}
            </div>
          )}

          {status.possibleFix && (
            <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/30 p-3">
              <div className="text-xs font-black uppercase tracking-wide text-white/45">
                Possible fix
              </div>
              <p className="mt-1 leading-6 text-white/85">
                {status.possibleFix}
              </p>
            </div>
          )}

          {status.details && status.details.length > 0 && (
            <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/30 p-3">
              <div className="text-xs font-black uppercase tracking-wide text-white/45">
                Details
              </div>

              <ul className="mt-2 space-y-1 text-white/80">
                {status.details.map((detail) => (
                  <li key={detail} className="break-words">
                    • {detail}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {status.rawError && (
            <div className="mt-3 rounded-xl border border-red-300/20 bg-red-950/30 p-3">
              <div className="text-xs font-black uppercase tracking-wide text-red-100/60">
                Raw server error
              </div>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs font-bold leading-5 text-red-50/90">
                {status.rawError}
              </pre>
            </div>
          )}

          {status.type === "error" && (
            <button
              type="button"
              onClick={copyErrorDetails}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-black text-slate-950 transition hover:bg-white/90"
            >
              <Copy className="h-4 w-4" />
              {copied ? "Copied" : "Copy error details"}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onClear}
          className="rounded-full p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
          aria-label="Clear message"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function HelpPanel() {
  return (
    <section className="money-print-hidden grid gap-4 xl:grid-cols-3">
      <div className="rounded-[2rem] border border-emerald-300/20 bg-emerald-400/10 p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-300/20 text-emerald-100">
            <ShieldCheck className="h-5 w-5" />
          </div>

          <div>
            <h3 className="font-black text-white">Best for accountant</h3>
            <p className="text-sm text-white/60">Use the full export pack.</p>
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border border-blue-300/20 bg-blue-400/10 p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-300/20 text-blue-100">
            <ClipboardCheck className="h-5 w-5" />
          </div>

          <div>
            <h3 className="font-black text-white">Best for checking</h3>
            <p className="text-sm text-white/60">
              Use receipts, audit logs, and bank checks.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border border-yellow-300/20 bg-yellow-400/10 p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-300/20 text-yellow-100">
            <Landmark className="h-5 w-5" />
          </div>

          <div>
            <h3 className="font-black text-white">Best for grants</h3>
            <p className="text-sm text-white/60">
              Use funding and sponsor breakdown.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function MoneyExportsClient({
  defaultYear,
  exportItems,
}: Props) {
  /**
   * Full Mode stays as the default.
   * Easy Mode is enabled only after the user turns it on.
   */
  const [easyMode, setEasyMode] = useState(false);
  const [modeLoaded, setModeLoaded] = useState(false);

  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<ExportCategory>("all");
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [status, setStatus] = useState<PageStatus>(null);
  const [showGuide, setShowGuide] = useState(true);
  const [compactMode, setCompactMode] = useState(false);

  useEffect(() => {
    try {
      const savedMode = window.localStorage.getItem(EASY_MODE_STORAGE_KEY);

      if (savedMode !== null) {
        setEasyMode(savedMode === "true");
      }
    } catch {
      // Keep Full Mode as the safe default if localStorage is unavailable.
    } finally {
      setModeLoaded(true);
    }
  }, []);

  function toggleEasyMode() {
    setEasyMode((previous) => {
      const next = !previous;

      if (next) {
        // Avoid leaving hidden advanced filters active.
        setSearch("");
        setSelectedCategory("all");
        setShowGuide(false);
      }

      try {
        window.localStorage.setItem(EASY_MODE_STORAGE_KEY, String(next));
      } catch {
        // The page should still work if localStorage is unavailable.
      }

      return next;
    });
  }

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 12 }, (_, index) => current - 6 + index);
  }, []);

  const recommendedItem = useMemo(() => {
    return exportItems.find((item) => item.recommended) || exportItems[0];
  }, [exportItems]);

  const exportStats = useMemo(() => {
    const total = exportItems.length;
    const excel = exportItems.filter((item) =>
      item.fileName.toLowerCase().endsWith(".xlsx")
    ).length;
    const zip = exportItems.filter((item) =>
      item.fileName.toLowerCase().endsWith(".zip")
    ).length;

    return {
      total,
      excel,
      zip,
    };
  }, [exportItems]);

  const filteredItems = useMemo(() => {
    const cleanSearch = search.toLowerCase().trim();

    return exportItems.filter((item) => {
      const category = getCategory(item);

      const matchesCategory =
        selectedCategory === "all" ||
        selectedCategory === category ||
        (selectedCategory === "recommended" && !!item.recommended);

      const matchesSearch =
        !cleanSearch ||
        item.title.toLowerCase().includes(cleanSearch) ||
        item.description.toLowerCase().includes(cleanSearch) ||
        item.buttonText.toLowerCase().includes(cleanSearch) ||
        item.key.toLowerCase().includes(cleanSearch) ||
        getSimpleUse(item).toLowerCase().includes(cleanSearch) ||
        getExportContents(item).join(" ").toLowerCase().includes(cleanSearch);

      return matchesCategory && matchesSearch;
    });
  }, [exportItems, search, selectedCategory]);

  async function downloadExport(item: ExportItem) {
    if (item.disabled || item.key === "bank-balance-checks") {
      setStatus({
        type: "error",
        title: "Feature temporarily unavailable",
        message:
          item.disabledMessage ||
          "This feature is currently being fixed and will be available again soon.",
      });

      return;
    }

    const route = buildUrlWithYear(item.url, selectedYear);
    const expectedFileName = fileNameWithYear(
      item.fileName,
      defaultYear,
      selectedYear
    );

    try {
      setDownloadingKey(item.key);

      await saveExportLog({
        action: "export",
        item,
        year: selectedYear,
        route,
        fileName: expectedFileName,
        status: "started",
        metadata: {
          opened_from: "money_exports_page",
        },
      });

      setStatus({
        type: "loading",
        title: "Preparing export",
        message: `Preparing ${item.title} for ${selectedYear}...`,
        route,
        details: [
          `Export: ${item.title}`,
          `Year: ${selectedYear}`,
          `Expected file: ${expectedFileName}`,
        ],
      });

      const response = await fetch(route, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        const errorData = await readExportError(response);
        const help = getHelpfulError(response.status, route);

        const details = [
          `Export: ${item.title}`,
          `Year: ${selectedYear}`,
          `Route: ${route}`,
          `Route file should be: ${routeToFilePath(route)}`,
          `HTTP status: ${response.status} ${response.statusText || ""}`.trim(),
          ...help.details,
        ];

        if (errorData.details) {
          details.push(`Server details: ${JSON.stringify(errorData.details)}`);
        }

        const errorStatus: NonNullable<PageStatus> = {
          type: "error",
          title: `${item.title} failed`,
          message: help.message,
          route,
          statusCode: response.status,
          statusText: response.statusText,
          rawError: String(errorData.error || ""),
          possibleFix: help.possibleFix,
          details,
        };

        errorStatus.copyText = makeCopyText(errorStatus);

        await saveExportLog({
          action: "export",
          item,
          year: selectedYear,
          route,
          fileName: expectedFileName,
          status: "failed",
          errorMessage: String(errorData.error || help.message || ""),
          metadata: {
            http_status: response.status,
            status_text: response.statusText,
            details,
          },
        });

        console.error("Money export failed", {
          exportKey: item.key,
          exportTitle: item.title,
          route,
          status: response.status,
          statusText: response.statusText,
          serverError: errorData.error,
          details: errorData.details,
        });

        setStatus(errorStatus);
        return;
      }

      const blob = await response.blob();

      if (!blob || blob.size === 0) {
        const emptyStatus: NonNullable<PageStatus> = {
          type: "error",
          title: `${item.title} returned an empty file`,
          message: "The export route worked, but the downloaded file is empty.",
          route,
          statusCode: response.status,
          statusText: response.statusText,
          possibleFix:
            "Open the API route and check that it returns the Excel/ZIP response body, not an empty response.",
          details: [
            `Export: ${item.title}`,
            `Year: ${selectedYear}`,
            `Route: ${route}`,
            `Route file should be: ${routeToFilePath(route)}`,
            "The response was successful but file size was 0 bytes.",
          ],
        };

        emptyStatus.copyText = makeCopyText(emptyStatus);

        await saveExportLog({
          action: "export",
          item,
          year: selectedYear,
          route,
          fileName: expectedFileName,
          status: "failed",
          errorMessage: "The export route returned an empty file.",
          metadata: {
            http_status: response.status,
            status_text: response.statusText,
            file_size_bytes: 0,
          },
        });

        setStatus(emptyStatus);
        return;
      }

      const objectUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = expectedFileName;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(objectUrl);

      await saveExportLog({
        action: "export",
        item,
        year: selectedYear,
        route,
        fileName: expectedFileName,
        status: "success",
        metadata: {
          file_size_bytes: blob.size,
        },
      });

      setStatus({
        type: "success",
        title: "Export downloaded",
        message: `${item.title} for ${selectedYear} downloaded successfully.`,
        route,
        details: [
          `Export: ${item.title}`,
          `Year: ${selectedYear}`,
          `File name: ${expectedFileName}`,
          `File size: ${(blob.size / 1024).toFixed(1)} KB`,
        ],
      });
    } catch (error: any) {
      const unexpectedStatus: NonNullable<PageStatus> = {
        type: "error",
        title: `${item.title} could not start`,
        message:
          "The browser could not complete the export request. This may be a network issue, route crash, or JavaScript error.",
        route,
        rawError: error?.message || String(error),
        possibleFix:
          "Check the browser console and terminal/Vercel logs. Also check that the export API route exists and returns a file response.",
        details: [
          `Export: ${item.title}`,
          `Year: ${selectedYear}`,
          `Route: ${route}`,
          `Route file should be: ${routeToFilePath(route)}`,
          "This error happened before a valid download could be completed.",
        ],
      };

      unexpectedStatus.copyText = makeCopyText(unexpectedStatus);

      await saveExportLog({
        action: "export",
        item,
        year: selectedYear,
        route,
        fileName: expectedFileName,
        status: "failed",
        errorMessage: error?.message || String(error),
      });

      console.error("Money export unexpected error", {
        exportKey: item.key,
        exportTitle: item.title,
        route,
        error,
      });

      setStatus(unexpectedStatus);
    } finally {
      setDownloadingKey(null);
    }
  }

  async function downloadRecommendedPack() {
    if (!recommendedItem) return;
    await downloadExport(recommendedItem);
  }

  function resetFilters() {
    setSearch("");
    setSelectedCategory("all");
    setStatus(null);
  }

  function printExportPage() {
    openPrintExport({
      exportKey: "all",
      exportTitle: "All Export Print Reports",
      year: selectedYear,
      fileName: `burton-pride-all-export-print-reports-${selectedYear}.pdf`,
    });
  }

  const hasFilters = search.trim() || selectedCategory !== "all";
  const useCompactCards = easyMode || compactMode;

  return (
    <>
      <style jsx global>{`
        @media screen {
          .money-print-only {
            display: none !important;
          }
        }

        @media print {
          @page {
            size: A4;
            margin: 14mm;
          }

          html,
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }

          body * {
            visibility: hidden;
          }

          .money-print-page,
          .money-print-page * {
            visibility: visible;
          }

          .money-print-page {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .money-print-hidden {
            display: none !important;
          }

          .money-print-only {
            display: block !important;
          }

          .money-print-grid {
            display: block !important;
          }

          .money-print-card {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            min-height: auto !important;
            margin: 0 0 12px 0 !important;
            padding: 14px !important;
            border: 1px solid #d4d4d8 !important;
            border-radius: 12px !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            transform: none !important;
          }

          .money-print-card,
          .money-print-card * {
            color: #000000 !important;
          }

          .money-print-card span,
          .money-print-card div,
          .money-print-card p {
            background: transparent !important;
            border-color: #d4d4d8 !important;
          }

          .money-print-title {
            color: #000000 !important;
            font-size: 24px !important;
            line-height: 1.2 !important;
            margin: 0 0 6px 0 !important;
          }

          .money-print-subtitle {
            color: #333333 !important;
            font-size: 12px !important;
            line-height: 1.45 !important;
          }

          .money-print-section-title {
            color: #000000 !important;
            font-size: 18px !important;
            margin: 18px 0 10px 0 !important;
          }

          .money-print-small {
            color: #333333 !important;
            font-size: 11px !important;
          }

          .money-print-badge {
            display: inline-block !important;
            margin: 0 6px 6px 0 !important;
            padding: 3px 8px !important;
            border: 1px solid #d4d4d8 !important;
            border-radius: 999px !important;
            font-size: 10px !important;
            font-weight: 700 !important;
            color: #000000 !important;
            background: #ffffff !important;
          }

          .money-print-button-area {
            display: none !important;
          }

          svg,
          .absolute {
            display: none !important;
          }
        }
      `}</style>

      <div className="money-print-page w-full space-y-6">
        <div className="money-print-only">
          <h1 className="money-print-title">
            Burton Pride Money Management Export List
          </h1>

          <p className="money-print-subtitle">Printing year: {selectedYear}</p>

          <p className="money-print-subtitle">
            This printout shows every export option available on the Money
            Management export page.
          </p>
        </div>

        <section className="money-print-hidden relative overflow-hidden rounded-[2rem] border border-emerald-300/30 bg-gradient-to-br from-emerald-400/20 via-white/10 to-blue-500/10 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-emerald-300/20 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-blue-300/10 blur-3xl" />

          <div className="relative grid gap-6 xl:grid-cols-[1fr_auto] xl:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/15 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-100">
                <Star className="h-4 w-4" />
                Best option
              </div>

              <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
                Send everything in one download
              </h2>

              <p className="mt-3 max-w-5xl text-sm leading-6 text-white/75 sm:text-base">
                {easyMode
                  ? "Download the full accountant pack when you want everything together in one ZIP file."
                  : "The Accountant Export Pack is the easiest option. It creates one ZIP file with the yearly report, transaction list, receipts index, audit logs, funding breakdown, personal funds report, CSV import history, and refund tracker report."}
              </p>

              {!easyMode && (
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/25 p-4">
                    <div className="text-2xl font-black text-white">
                      {exportStats.total}
                    </div>
                    <div className="text-xs font-bold text-white/50">
                      Export options
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-950/25 p-4">
                    <div className="text-2xl font-black text-white">
                      {exportStats.excel}
                    </div>
                    <div className="text-xs font-bold text-white/50">
                      Excel reports
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-950/25 p-4">
                    <div className="text-2xl font-black text-white">
                      {exportStats.zip}
                    </div>
                    <div className="text-xs font-bold text-white/50">
                      ZIP packs
                    </div>
                  </div>
                </div>
              )}

              {!easyMode && (
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href="/Admin/MoneyManagement/TrackingMoney/Exports/ExportLogs"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
                  >
                    <History className="h-4 w-4" />
                    View export logs
                  </Link>
                </div>
              )}
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/30 p-4">
              <button
                type="button"
                onClick={downloadRecommendedPack}
                disabled={!!downloadingKey || !recommendedItem}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-300 px-6 py-4 text-sm font-black text-emerald-950 shadow-xl shadow-emerald-950/30 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {downloadingKey === recommendedItem?.key ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <FileArchive className="h-5 w-5" />
                )}
                Download Full Accountant Pack
              </button>

              <p className="mt-3 text-center text-xs font-bold text-white/50">
                Recommended for accountant, committee checks, and year-end
                files.
              </p>
            </div>
          </div>
        </section>

        <section className="money-print-hidden rounded-[2rem] border border-white/10 bg-white/10 p-4 shadow-2xl backdrop-blur-xl sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {easyMode ? (
                  <Sparkles className="h-5 w-5 text-emerald-200" />
                ) : (
                  <Settings2 className="h-5 w-5 text-sky-200" />
                )}

                <h2 className="text-lg font-black text-white">
                  {easyMode ? "Easy Mode is on" : "Full Mode is on"}
                </h2>
              </div>

              <p className="mt-2 max-w-4xl text-sm leading-6 text-white/60">
                {easyMode
                  ? "Easy Mode keeps exports simple: choose the year, download the accountant pack, or download an individual report."
                  : "Full Mode shows search, categories, print tools, export logs, help panels, and full report contents."}
              </p>
            </div>

            <button
              type="button"
              onClick={toggleEasyMode}
              disabled={!modeLoaded}
              className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black ring-1 transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${
                easyMode
                  ? "bg-sky-500/15 text-sky-100 ring-sky-300/20 hover:bg-sky-500/25"
                  : "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20 hover:bg-emerald-500/25"
              }`}
            >
              {easyMode ? (
                <>
                  <Settings2 className="h-4 w-4" />
                  Show Full Mode
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Turn on Easy Mode
                </>
              )}
            </button>
          </div>
        </section>

        {!easyMode && showGuide && <HelpPanel />}

        <section className="money-print-hidden w-full rounded-[2rem] border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
            <label className="block xl:w-56">
              <span className="mb-2 flex items-center gap-2 text-sm font-black text-white">
                <CalendarDays className="h-4 w-4 text-emerald-200" />
                Export year
              </span>

              <select
                value={selectedYear}
                onChange={(event) =>
                  setSelectedYear(Number(event.target.value))
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-bold text-white outline-none ring-emerald-300/30 transition focus:ring-4"
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>

            {!easyMode && (
              <label className="block flex-1">
                <span className="mb-2 flex items-center gap-2 text-sm font-black text-white">
                  <Search className="h-4 w-4 text-blue-200" />
                  Search exports
                </span>

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search accountant, receipts, refunds, audit logs, funding, personal funds..."
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-bold text-white outline-none ring-blue-300/30 placeholder:text-white/35 focus:ring-4"
                />
              </label>
            )}

            {!easyMode && (
              <div className="grid gap-3 sm:grid-cols-5 xl:w-auto">
                <button
                  type="button"
                  onClick={printExportPage}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-white/90"
                >
                  <Printer className="h-4 w-4" />
                  Print page
                </button>

                <Link
                  href="/Admin/MoneyManagement/TrackingMoney/Exports/ExportLogs"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/15"
                >
                  <History className="h-4 w-4" />
                  Logs
                </Link>

                <button
                  type="button"
                  onClick={() => setCompactMode((value) => !value)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/15"
                >
                  <Filter className="h-4 w-4" />
                  {compactMode ? "Big cards" : "Compact"}
                </button>

                <button
                  type="button"
                  onClick={() => setShowGuide((value) => !value)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/15"
                >
                  <Info className="h-4 w-4" />
                  {showGuide ? "Hide guide" : "Show guide"}
                </button>

                <button
                  type="button"
                  onClick={resetFilters}
                  disabled={!hasFilters}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Reset
                </button>
              </div>
            )}
          </div>

          {!easyMode && (
            <>
              <div className="mt-5 flex flex-wrap gap-2">
                {(Object.keys(CATEGORY_LABELS) as ExportCategory[]).map(
                  (category) => {
                    const active = selectedCategory === category;

                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setSelectedCategory(category)}
                        title={CATEGORY_HELP[category]}
                        className={classNames(
                          "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black transition",
                          active
                            ? "border-emerald-300 bg-emerald-300 text-emerald-950"
                            : "border-white/10 bg-white/10 text-white/75 hover:bg-white/15"
                        )}
                      >
                        {active && <BadgeCheck className="h-3.5 w-3.5" />}
                        {CATEGORY_LABELS[category]}
                      </button>
                    );
                  }
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/30 p-4 text-sm text-white/65">
                <div className="flex items-start gap-2">
                  <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />

                  <div>
                    <span className="font-black text-white">
                      Showing {filteredItems.length} of {exportItems.length}{" "}
                      exports.
                    </span>{" "}
                    {CATEGORY_HELP[selectedCategory]}
                  </div>
                </div>
              </div>
            </>
          )}

          <StatusBox status={status} onClear={() => setStatus(null)} />
        </section>

        <h2 className="money-print-only money-print-section-title">
          Export options
        </h2>

        <section
          className={classNames(
            "money-print-grid grid w-full gap-5",
            useCompactCards
              ? "md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
              : "sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
          )}
        >
          {filteredItems.map((item) => {
            const Icon = ICONS[item.iconKey] || FileSpreadsheet;
            const isDownloading = downloadingKey === item.key;
            const category = getCategory(item);
            const contents = getExportContents(item);
            const route = buildUrlWithYear(item.url, selectedYear);
            const isDisabled =
              item.disabled || item.key === "bank-balance-checks";

            return (
              <article
                key={item.key}
                className={classNames(
                  "money-print-card group relative flex flex-col overflow-hidden rounded-[2rem] border p-5 shadow-2xl backdrop-blur-xl transition duration-200 hover:-translate-y-1 hover:bg-white/[0.13]",
                  useCompactCards ? "min-h-[250px]" : "min-h-[370px]",
                  item.colour
                )}
              >
                <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/10 blur-2xl transition group-hover:bg-white/20" />

                <div className="relative flex items-start justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                    <Icon className="h-6 w-6" />
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    {item.recommended && (
                      <span className="money-print-badge rounded-full bg-emerald-300 px-3 py-1 text-xs font-black text-emerald-950">
                        Best
                      </span>
                    )}

                    <span className="money-print-badge rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black text-white/70">
                      {CATEGORY_LABELS[category]}
                    </span>

                    <span className="money-print-badge rounded-full border border-white/10 bg-slate-950/30 px-3 py-1 text-xs font-black text-white/60">
                      {getPlainFileType(item.fileName)}
                    </span>
                  </div>
                </div>

                <h2 className="relative mt-5 text-xl font-black text-white">
                  {item.title}
                </h2>

                {!easyMode && (
                  <p className="relative mt-3 text-sm leading-6 text-white/70">
                    {item.description}
                  </p>
                )}

                <div className="relative mt-4 rounded-2xl border border-white/10 bg-slate-950/30 p-3 text-sm font-bold leading-5 text-white/80">
                  <div className="mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-white/45">
                    <Sparkles className="h-3.5 w-3.5" />
                    When to use
                  </div>
                  {getSimpleUse(item)}
                </div>

                {!easyMode && (
                  <div className="relative mt-4">
                    <div className="mb-2 text-xs font-black uppercase tracking-wide text-white/45">
                      Includes
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {contents.map((content) => (
                        <span
                          key={content}
                          className="money-print-badge rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-white/65"
                        >
                          {content}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="money-print-only mt-4 space-y-1">
                  <p className="money-print-small">
                    <strong>File:</strong>{" "}
                    {fileNameWithYear(item.fileName, defaultYear, selectedYear)}
                  </p>

                  <p className="money-print-small">
                    <strong>Route:</strong> {route}
                  </p>
                </div>

                <div className="flex-1" />

                <div className="money-print-button-area">
                  {isDisabled && (
                    <div className="relative mt-5 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />

                        <div className="min-w-0">
                          <p className="text-sm font-black text-amber-100">
                            Feature being fixed
                          </p>

                          <p className="mt-1 text-sm leading-6 text-white/70">
                            {item.disabledMessage ||
                              "This feature is currently being fixed and will be available again soon."}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (isDisabled) return;
                      downloadExport(item);
                    }}
                    disabled={!!downloadingKey || isDisabled}
                    aria-disabled={isDisabled}
                    title={
                      isDisabled
                        ? "This feature is currently being fixed and will be available again soon."
                        : undefined
                    }
                    className={classNames(
                      "relative mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50",
                      isDisabled
                        ? "border border-white/10 bg-slate-700/70 text-white/40"
                        : item.buttonColour
                    )}
                  >
                    {isDownloading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isDisabled ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}

                    {isDownloading
                      ? "Downloading..."
                      : isDisabled
                        ? "Temporarily unavailable"
                        : item.buttonText}
                  </button>

                  {!easyMode && (
                    <button
                      type="button"
                      onClick={() => {
                        if (isDisabled) return;

                        printSingleExportItem(
                          item,
                          selectedYear,
                          defaultYear
                        );
                      }}
                      disabled={isDisabled}
                      aria-disabled={isDisabled}
                      title={
                        isDisabled
                          ? "This feature is currently being fixed and will be available again soon."
                          : undefined
                      }
                      className={classNames(
                        "relative mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black shadow-lg transition",
                        isDisabled
                          ? "cursor-not-allowed border-white/10 bg-white/5 text-white/30 opacity-50"
                          : "border-white/10 bg-white/10 text-white hover:bg-white/15"
                      )}
                    >
                      <Printer className="h-4 w-4" />
                      {isDisabled ? "Print unavailable" : "Print version"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>

        {filteredItems.length === 0 && (
          <div className="money-print-hidden w-full rounded-[2rem] border border-white/10 bg-white/10 p-10 text-center shadow-2xl backdrop-blur-xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white">
              <Search className="h-6 w-6" />
            </div>

            <h3 className="mt-4 text-xl font-black text-white">
              No exports found
            </h3>

            <p className="mt-2 text-sm text-white/60">
              Try removing your search or changing the category filter.
            </p>

            <button
              type="button"
              onClick={resetFilters}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950"
            >
              <RefreshCcw className="h-4 w-4" />
              Reset filters
            </button>
          </div>
        )}
      </div>
    </>
  );
}