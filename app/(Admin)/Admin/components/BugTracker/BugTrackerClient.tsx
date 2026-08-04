"use client";

import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  Bug,
  CheckCircle2,
  ChevronRight,
  ClipboardCopy,
  CircleDot,
  Clock3,
  FileText,
  Filter,
  Home,
  LayoutDashboard,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  Send,
  ShieldAlert,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type BugApplication =
  | "admin_portal"
  | "money_management"
  | "stock_control"
  | "event_hub"
  | "public_website";

type BugPriority = "minor" | "normal" | "senior";

type BugStatus =
  | "reported"
  | "acknowledged"
  | "investigating"
  | "in_progress"
  | "waiting_for_information"
  | "fix_ready"
  | "testing"
  | "resolved"
  | "closed"
  | "reopened"
  | "rejected"
  | "duplicate";

type BugReport = {
  id: string;
  reference_number: string;

  title: string;
  description: string;

  application: BugApplication;
  affected_feature: string | null;
  page_url: string | null;

  priority: BugPriority;
  status: BugStatus;

  reporter_admin_id: string | null;
  reporter_name: string | null;
  reporter_email: string | null;

  assigned_admin_id: string | null;
  assigned_admin_name: string | null;

  email_notification_sent: boolean;
  email_notification_error: string | null;
  email_notification_sent_at: string | null;

  first_response_at: string | null;
  investigation_started_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;

  created_at: string;
  updated_at: string;
};

type BugSummary = {
  total: number;
  open: number;
  minor: number;
  normal: number;
  senior: number;
  resolved: number;
};

type BugTrackerResponse = {
  ok: boolean;
  reports?: BugReport[];
  summary?: BugSummary;
  error?: string;
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
  requestId?: string;
  request_id?: string;
};

type BugTrackerCreateResponse = {
  ok: boolean;
  report?: BugReport;
  emailSent?: boolean;
  emailWarning?: string | null;
  message?: string;
  error?: string;
  code?: string;
  details?: string;
  hint?: string;
  requestId?: string;
  request_id?: string;
};

type ReportBugForm = {
  application: BugApplication;
  priority: BugPriority;
  title: string;
  description: string;
  affected_feature: string;
  page_url: string;
  steps_to_reproduce: string;
  expected_result: string;
  actual_result: string;
};

type CurrentAdmin = {
  id: string;
  name: string;
  email: string;
};

type BugTrackerClientProps = {
  currentAdmin: CurrentAdmin;
};

type ApplicationFilter = "all" | BugApplication;
type PriorityFilter = "all" | BugPriority;
type StatusFilter = "all" | BugStatus;

const APPLICATION_LABELS: Record<BugApplication, string> = {
  admin_portal: "Admin Portal",
  money_management: "Money Management",
  stock_control: "Stock Control",
  event_hub: "Event Hub",
  public_website: "Public Website",
};

const PRIORITY_LABELS: Record<BugPriority, string> = {
  minor: "Minor Bug",
  normal: "Normal Issue",
  senior: "Senior Bug",
};

const STATUS_LABELS: Record<BugStatus, string> = {
  reported: "Reported",
  acknowledged: "Acknowledged",
  investigating: "Investigating",
  in_progress: "Fix in progress",
  waiting_for_information: "Waiting for information",
  fix_ready: "Fix ready",
  testing: "Testing",
  resolved: "Resolved",
  closed: "Closed",
  reopened: "Reopened",
  rejected: "Rejected",
  duplicate: "Duplicate",
};

const EMPTY_SUMMARY: BugSummary = {
  total: 0,
  open: 0,
  minor: 0,
  normal: 0,
  senior: 0,
  resolved: 0,
};

const EMPTY_REPORT_FORM: ReportBugForm = {
  application: "admin_portal",
  priority: "normal",
  title: "",
  description: "",
  affected_feature: "",
  page_url: "",
  steps_to_reproduce: "",
  expected_result: "",
  actual_result: "",
};

type BugTrackerErrorDetails = {
  code: string;
  title: string;
  message: string;
  technicalDetails: string | null;
  hint: string | null;
  httpStatus: number | null;
  endpoint: string;
  requestId: string | null;
  occurredAt: string;
  retryable: boolean;
};

function createClientErrorCode(status: number | null) {
  if (status === 400) return "BUG-TRACKER-400";
  if (status === 401) return "BUG-TRACKER-401";
  if (status === 403) return "BUG-TRACKER-403";
  if (status === 404) return "BUG-TRACKER-404";
  if (status === 409) return "BUG-TRACKER-409";
  if (status === 422) return "BUG-TRACKER-422";
  if (status === 429) return "BUG-TRACKER-429";
  if (status && status >= 500) return `BUG-TRACKER-${status}`;

  return "BUG-TRACKER-CLIENT";
}

function getErrorTitle(status: number | null) {
  if (status === 400) return "Invalid bug tracker request";
  if (status === 401) return "Admin session expired";
  if (status === 403) return "Bug tracker access denied";
  if (status === 404) return "Bug tracker API not found";
  if (status === 409) return "Bug tracker data conflict";
  if (status === 422) return "Bug tracker validation failed";
  if (status === 429) return "Too many bug tracker requests";
  if (status && status >= 500) return "Bug tracker server error";

  return "Bug tracker connection error";
}

function isRetryableStatus(status: number | null) {
  return (
    status === null ||
    status === 408 ||
    status === 429 ||
    (status >= 500 && status <= 599)
  );
}

function buildErrorReport(error: BugTrackerErrorDetails) {
  return [
    `Error code: ${error.code}`,
    `Title: ${error.title}`,
    `Message: ${error.message}`,
    `HTTP status: ${error.httpStatus ?? "Not available"}`,
    `Endpoint: ${error.endpoint}`,
    `Request ID: ${error.requestId || "Not available"}`,
    `Occurred at: ${error.occurredAt}`,
    `Retryable: ${error.retryable ? "Yes" : "No"}`,
    `Technical details: ${error.technicalDetails || "Not available"}`,
    `Suggested action: ${error.hint || "No additional guidance supplied."}`,
  ].join("\n");
}

const CLOSED_STATUSES: BugStatus[] = [
  "resolved",
  "closed",
  "rejected",
  "duplicate",
];

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatTimeAgo(value: string) {
  const createdDate = new Date(value);

  if (Number.isNaN(createdDate.getTime())) {
    return "Unknown";
  }

  const difference = Date.now() - createdDate.getTime();

  const minutes = Math.floor(difference / 60_000);
  const hours = Math.floor(difference / 3_600_000);
  const days = Math.floor(difference / 86_400_000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function getBugAgeInHours(createdAt: string) {
  const createdDate = new Date(createdAt);

  if (Number.isNaN(createdDate.getTime())) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor((Date.now() - createdDate.getTime()) / 3_600_000),
  );
}

function isOpenBug(report: BugReport) {
  return !CLOSED_STATUSES.includes(report.status);
}

function prioritySortValue(priority: BugPriority) {
  switch (priority) {
    case "senior":
      return 3;
    case "normal":
      return 2;
    case "minor":
      return 1;
  }
}

function getPriorityClasses(priority: BugPriority) {
  switch (priority) {
    case "minor":
      return {
        card:
          "border-emerald-300/20 bg-gradient-to-br from-emerald-500/[0.08] via-white/[0.025] to-cyan-500/[0.04]",
        badge:
          "bg-emerald-500/15 text-emerald-100 ring-emerald-300/25",
        icon: "text-emerald-300",
        dot: "bg-emerald-400",
      };

    case "normal":
      return {
        card:
          "border-amber-300/20 bg-gradient-to-br from-amber-500/[0.08] via-white/[0.025] to-orange-500/[0.04]",
        badge: "bg-amber-500/15 text-amber-100 ring-amber-300/25",
        icon: "text-amber-300",
        dot: "bg-amber-400",
      };

    case "senior":
      return {
        card:
          "border-red-300/30 bg-gradient-to-br from-red-500/[0.10] via-white/[0.025] to-pink-500/[0.05] shadow-lg shadow-red-950/20",
        badge: "bg-red-500/20 text-red-100 ring-red-300/30",
        icon: "text-red-300",
        dot: "bg-red-400",
      };
  }
}

function getStatusClasses(status: BugStatus) {
  switch (status) {
    case "resolved":
      return "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20";

    case "closed":
      return "bg-slate-500/20 text-slate-200 ring-slate-300/15";

    case "rejected":
    case "duplicate":
      return "bg-rose-500/15 text-rose-100 ring-rose-300/20";

    case "investigating":
    case "in_progress":
    case "testing":
    case "fix_ready":
      return "bg-sky-500/15 text-sky-100 ring-sky-300/20";

    case "waiting_for_information":
      return "bg-amber-500/15 text-amber-100 ring-amber-300/20";

    case "reopened":
      return "bg-orange-500/15 text-orange-100 ring-orange-300/20";

    default:
      return "bg-purple-500/15 text-purple-100 ring-purple-300/20";
  }
}

function SummaryCard({
  label,
  value,
  description,
  icon,
  tone,
}: {
  label: string;
  value: number;
  description: string;
  icon: React.ReactNode;
  tone:
    | "slate"
    | "purple"
    | "red"
    | "amber"
    | "emerald"
    | "sky";
}) {
  const toneClasses = {
    slate:
      "border-white/10 bg-gradient-to-br from-white/[0.07] via-white/[0.035] to-transparent",
    purple:
      "border-purple-300/20 bg-gradient-to-br from-purple-500/[0.12] via-fuchsia-500/[0.04] to-transparent",
    red:
      "border-red-300/20 bg-gradient-to-br from-red-500/[0.11] via-pink-500/[0.04] to-transparent",
    amber:
      "border-amber-300/20 bg-gradient-to-br from-amber-500/[0.11] via-orange-500/[0.04] to-transparent",
    emerald:
      "border-emerald-300/20 bg-gradient-to-br from-emerald-500/[0.11] via-cyan-500/[0.04] to-transparent",
    sky:
      "border-sky-300/20 bg-gradient-to-br from-sky-500/[0.11] via-blue-500/[0.04] to-transparent",
  };

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border p-5 shadow-lg shadow-black/10 backdrop-blur-xl ${toneClasses[tone]}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent"
      />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-300">
            {label}
          </p>

          <p className="mt-2 text-3xl font-black tracking-tight text-white">
            {value}
          </p>
        </div>

        <div className="rounded-xl bg-white/[0.06] p-2.5 ring-1 ring-white/10 backdrop-blur-md">
          {icon}
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-400">
        {description}
      </p>
    </article>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.13em] text-slate-400">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{ colorScheme: "dark" }}
        className="
          h-11
          w-full
          cursor-pointer
          rounded-xl
          border
          border-white/20
          bg-black
          px-3
          text-sm
          font-semibold
          text-white
          outline-none
          transition
          [color-scheme:dark]
          [&>option]:bg-black
          [&>option]:text-white
          [&>option]:font-medium
          focus:border-pink-300/60
          focus:ring-2
          focus:ring-purple-500/30
        "
      >
        {children}
      </select>
    </label>
  );
}

export default function BugTrackerClient({
  currentAdmin,
}: BugTrackerClientProps) {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [summary, setSummary] = useState<BugSummary>(EMPTY_SUMMARY);

  const [search, setSearch] = useState("");
  const [application, setApplication] =
    useState<ApplicationFilter>("all");
  const [priority, setPriority] =
    useState<PriorityFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] =
    useState<BugTrackerErrorDetails | null>(null);
  const [errorCopied, setErrorCopied] = useState(false);

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportForm, setReportForm] =
    useState<ReportBugForm>(EMPTY_REPORT_FORM);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSuccess, setReportSuccess] = useState<{
    reference: string;
    message: string;
    emailSent: boolean;
  } | null>(null);

  const hasActiveFilters =
    search.trim().length > 0 ||
    application !== "all" ||
    priority !== "all" ||
    status !== "all";

  const loadReports = useCallback(
    async (showRefreshState = false) => {
      if (showRefreshState) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const searchParams = new URLSearchParams();

        if (search.trim()) {
          searchParams.set("search", search.trim());
        }

        if (application !== "all") {
          searchParams.set("application", application);
        }

        if (priority !== "all") {
          searchParams.set("priority", priority);
        }

        if (status !== "all") {
          searchParams.set("status", status);
        }

        const query = searchParams.toString();

        const endpoint =
          `/api/admin/bug-tracker${query ? `?${query}` : ""}`;

        const response = await fetch(endpoint, {
          method: "GET",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });

        const rawBody = await response.text();

        let result: BugTrackerResponse | null = null;

        if (rawBody) {
          try {
            result = JSON.parse(rawBody) as BugTrackerResponse;
          } catch {
            result = null;
          }
        }

        if (!response.ok || !result?.ok) {
          const status = response.status || null;
          const requestId =
            result?.requestId ||
            result?.request_id ||
            response.headers.get("x-request-id") ||
            response.headers.get("x-vercel-id");

          const errorDetails: BugTrackerErrorDetails = {
            code:
              result?.code?.trim() ||
              createClientErrorCode(status),
            title: getErrorTitle(status),
            message:
              result?.error?.trim() ||
              result?.message?.trim() ||
              `The Bug Tracker API returned an unsuccessful response${
                status ? ` (${status})` : ""
              }.`,
            technicalDetails:
              result?.details?.trim() ||
              (!result && rawBody
                ? rawBody.slice(0, 2_000)
                : null),
            hint:
              result?.hint?.trim() ||
              (status === 401
                ? "Sign in again and then reload the Bug Tracker."
                : status === 403
                  ? "Ask a main administrator to check your Bug Tracker permissions."
                  : status === 404
                    ? "Check that app/api/admin/bug-tracker/route.ts exists and exports GET."
                    : status && status >= 500
                      ? "Check the server console and Supabase logs, then try again."
                      : null),
            httpStatus: status,
            endpoint,
            requestId,
            occurredAt: new Date().toISOString(),
            retryable: isRetryableStatus(status),
          };

          throw errorDetails;
        }

        setReports(result.reports || []);
        setSummary(result.summary || EMPTY_SUMMARY);
      } catch (loadError) {
        const fallbackError: BugTrackerErrorDetails = {
          code: "BUG-TRACKER-NETWORK",
          title: "Unable to contact the Bug Tracker API",
          message:
            loadError instanceof Error
              ? loadError.message
              : "The browser could not load bug reports.",
          technicalDetails:
            loadError instanceof Error
              ? loadError.stack || null
              : null,
          hint:
            "Check your internet connection, confirm the API route is running, and then try again.",
          httpStatus: null,
          endpoint: "/api/admin/bug-tracker",
          requestId: null,
          occurredAt: new Date().toISOString(),
          retryable: true,
        };

        const detailedError =
          typeof loadError === "object" &&
          loadError !== null &&
          "code" in loadError &&
          "message" in loadError
            ? (loadError as BugTrackerErrorDetails)
            : fallbackError;

        setError(detailedError);
        setErrorCopied(false);
        setReports([]);
        setSummary(EMPTY_SUMMARY);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [application, priority, search, status],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadReports(false);
    }, search.trim() ? 300 : 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [loadReports, search]);

  const sortedReports = useMemo(() => {
    return [...reports].sort((first, second) => {
      const firstClosed = isOpenBug(first) ? 0 : 1;
      const secondClosed = isOpenBug(second) ? 0 : 1;

      if (firstClosed !== secondClosed) {
        return firstClosed - secondClosed;
      }

      const priorityDifference =
        prioritySortValue(second.priority) -
        prioritySortValue(first.priority);

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return (
        new Date(second.created_at).getTime() -
        new Date(first.created_at).getTime()
      );
    });
  }, [reports]);

  const activeReports = useMemo(
    () =>
      sortedReports.filter(
        (report) =>
          report.status !== "resolved" &&
          report.status !== "closed",
      ),
    [sortedReports],
  );

  const resolvedReports = useMemo(
    () =>
      sortedReports
        .filter(
          (report) =>
            report.status === "resolved" ||
            report.status === "closed",
        )
        .sort(
          (first, second) =>
            new Date(
              second.resolved_at ||
                second.closed_at ||
                second.updated_at,
            ).getTime() -
            new Date(
              first.resolved_at ||
                first.closed_at ||
                first.updated_at,
            ).getTime(),
        ),
    [sortedReports],
  );

  function clearFilters() {
    setSearch("");
    setApplication("all");
    setPriority("all");
    setStatus("all");
  }

  function openReportModal() {
    setReportError(null);
    setReportSuccess(null);
    setReportForm({
      ...EMPTY_REPORT_FORM,
      page_url:
        typeof window !== "undefined" ? window.location.href : "",
    });
    setReportModalOpen(true);
  }

  function closeReportModal() {
    if (submittingReport) return;

    setReportModalOpen(false);
    setReportError(null);
    setReportSuccess(null);
  }

  function updateReportField<K extends keyof ReportBugForm>(
    field: K,
    value: ReportBugForm[K],
  ) {
    setReportForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function submitBugReport() {
    const title = reportForm.title.trim();
    const description = reportForm.description.trim();
    const actualResult = reportForm.actual_result.trim();

    if (!title) {
      setReportError("Enter a short title for the bug.");
      return;
    }

    if (!description) {
      setReportError("Explain what the bug is and how it affects the system.");
      return;
    }

    if (!actualResult) {
      setReportError("Explain what actually happened.");
      return;
    }

    setSubmittingReport(true);
    setReportError(null);
    setReportSuccess(null);

    try {
      const response = await fetch("/api/admin/bug-tracker", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          application: reportForm.application,
          priority: reportForm.priority,
          title,
          description,
          affected_feature:
            reportForm.affected_feature.trim() || null,
          page_url: reportForm.page_url.trim() || null,
          steps_to_reproduce:
            reportForm.steps_to_reproduce.trim() || null,
          expected_result:
            reportForm.expected_result.trim() || null,
          actual_result: actualResult,
          browser_name:
            typeof navigator !== "undefined"
              ? navigator.userAgent
              : null,
          device_type:
            typeof window !== "undefined" &&
            window.matchMedia("(pointer: coarse)").matches
              ? "Touch device"
              : "Desktop or laptop",
          operating_system:
            typeof navigator !== "undefined"
              ? navigator.platform
              : null,
        }),
      });

      const result =
        (await response.json()) as BugTrackerCreateResponse;

      if (!response.ok || !result.ok || !result.report) {
        throw new Error(
          [
            result.error || result.message || "The bug report could not be submitted.",
            result.code ? `Error code: ${result.code}.` : null,
            result.hint || null,
          ]
            .filter(Boolean)
            .join(" "),
        );
      }

      setReportSuccess({
        reference: result.report.reference_number,
        message:
          result.message ||
          "Your bug report has been saved successfully.",
        emailSent: Boolean(result.emailSent),
      });

      await loadReports(true);
    } catch (submitError) {
      setReportError(
        submitError instanceof Error
          ? submitError.message
          : "The bug report could not be submitted.",
      );
    } finally {
      setSubmittingReport(false);
    }
  }

  async function copyErrorDetails() {
    if (!error) return;

    try {
      await navigator.clipboard.writeText(buildErrorReport(error));
      setErrorCopied(true);

      window.setTimeout(() => {
        setErrorCopied(false);
      }, 2_000);
    } catch (copyError) {
      console.error("Failed to copy Bug Tracker error details", copyError);
    }
  }

  return (
    <div className="relative space-y-6">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-red-500/10 blur-3xl" />
        <div className="absolute left-[18%] top-8 h-72 w-72 rounded-full bg-orange-500/10 blur-3xl" />
        <div className="absolute left-[36%] top-28 h-72 w-72 rounded-full bg-yellow-400/10 blur-3xl" />
        <div className="absolute right-[30%] top-10 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute right-[12%] top-28 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute -right-24 top-8 h-72 w-72 rounded-full bg-purple-500/10 blur-3xl" />
      </div>
      <section className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-4 shadow-xl shadow-black/10 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.15em] text-purple-200/70">
            Admin Portal
          </p>
          <h1 className="mt-1 text-xl font-black text-white">
            Bug Tracker
          </h1>
        </div>

        <Link
          href="/Admin/Dashboard"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-purple-300/20 bg-purple-500/10 px-5 text-sm font-black text-purple-100 transition hover:bg-purple-500/20 hover:text-white"
        >
          <Home aria-hidden="true" className="h-4 w-4" />
          Back to Admin Portal
        </Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <SummaryCard
          label="All Bugs"
          value={summary.total}
          description="All bug reports currently matching the selected filters."
          icon={
            <Bug
              aria-hidden="true"
              className="h-5 w-5 text-slate-200"
            />
          }
          tone="slate"
        />

        <SummaryCard
          label="Open Bugs"
          value={summary.open}
          description="Reports that still require investigation, work or testing."
          icon={
            <CircleDot
              aria-hidden="true"
              className="h-5 w-5 text-purple-200"
            />
          }
          tone="purple"
        />

        <SummaryCard
          label="Senior Bugs"
          value={summary.senior}
          description="Critical issues that may require action within one to two days."
          icon={
            <ShieldAlert
              aria-hidden="true"
              className="h-5 w-5 text-red-200"
            />
          }
          tone="red"
        />

        <SummaryCard
          label="Normal Issues"
          value={summary.normal}
          description="Issues scheduled into the normal development cycle."
          icon={
            <AlertTriangle
              aria-hidden="true"
              className="h-5 w-5 text-amber-200"
            />
          }
          tone="amber"
        />

        <SummaryCard
          label="Minor Bugs"
          value={summary.minor}
          description="Small cosmetic, spelling, layout or usability problems."
          icon={
            <AlertCircle
              aria-hidden="true"
              className="h-5 w-5 text-sky-200"
            />
          }
          tone="sky"
        />

        
      </section>

      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-black/15 backdrop-blur-2xl sm:p-5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-red-400/50 via-yellow-300/50 via-emerald-400/50 via-sky-400/50 to-purple-400/50"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-purple-500/10 blur-3xl"
        />
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Filter
                aria-hidden="true"
                className="h-5 w-5 text-purple-200"
              />

              <h2 className="text-lg font-black text-white">
                Search and filter reports
              </h2>
            </div>

            <p className="mt-1 text-sm text-slate-400">
              Find bugs by reference number, title, description or reporter.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void loadReports(true)}
              disabled={refreshing}
              className="
                inline-flex
                h-11
                items-center
                justify-center
                gap-2
                rounded-xl
                border
                border-white/10
                bg-white/[0.06]
                backdrop-blur-xl
                px-4
                text-sm
                font-bold
                text-white
                transition
                hover:bg-white/[0.09]
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >
              <RefreshCcw
                aria-hidden="true"
                className={`h-4 w-4 ${
                  refreshing ? "animate-spin" : ""
                }`}
              />

              Refresh
            </button>

            <button
              type="button"
              onClick={openReportModal}
              className="
                inline-flex
                h-11
                items-center
                justify-center
                gap-2
                rounded-xl
                bg-gradient-to-r
                from-pink-500
                via-purple-600
                to-sky-500
                px-5
                text-sm
                font-black
                text-white
                shadow-lg
                shadow-purple-950/30
                ring-1
                ring-white/10
                transition
                hover:brightness-110
              "
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              Report a Bug
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.6fr)_1fr_1fr_1fr_auto]">
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.13em] text-slate-400">
              Search
            </span>

            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
              />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search bugs..."
                className="
                  h-11
                  w-full
                  rounded-xl
                  border
                  border-white/10
                  bg-black/20
                  backdrop-blur-xl
                  pl-10
                  pr-10
                  text-sm
                  text-white
                  outline-none
                  placeholder:text-slate-600
                  focus:border-pink-300/40
                  focus:ring-2
                  focus:ring-purple-500/20
                "
              />

              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </label>

          <FilterSelect
            label="Application"
            value={application}
            onChange={(value) =>
              setApplication(value as ApplicationFilter)
            }
          >
            <option value="all">All applications</option>
            <option value="admin_portal">Admin Portal</option>
            <option value="money_management">
              Money Management
            </option>
            <option value="stock_control">Stock Control</option>
            <option value="event_hub">Event Hub</option>
            <option value="public_website">Public Website</option>
          </FilterSelect>

          <FilterSelect
            label="Priority"
            value={priority}
            onChange={(value) =>
              setPriority(value as PriorityFilter)
            }
          >
            <option value="all">All priorities</option>
            <option value="senior">Senior Bug</option>
            <option value="normal">Normal Issue</option>
            <option value="minor">Minor Bug</option>
          </FilterSelect>

          <FilterSelect
            label="Status"
            value={status}
            onChange={(value) =>
              setStatus(value as StatusFilter)
            }
          >
            <option value="all">All statuses</option>

            {Object.entries(STATUS_LABELS).map(
              ([statusValue, statusLabel]) => (
                <option key={statusValue} value={statusValue}>
                  {statusLabel}
                </option>
              ),
            )}
          </FilterSelect>

          <div className="flex items-end">
            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
              className="
                inline-flex
                h-11
                w-full
                items-center
                justify-center
                gap-2
                rounded-xl
                border
                border-black/20
                bg-black/20
                px-4
                text-sm
                font-bold
                text-slate-200
                transition
                hover:bg-white/[0.08]
                disabled:cursor-not-allowed
                disabled:opacity-40
                xl:w-auto
              "
            >
              <X aria-hidden="true" className="h-4 w-4" />
              Clear
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <section className="overflow-hidden rounded-3xl border border-red-300/30 bg-red-950/35 shadow-2xl shadow-red-950/25 backdrop-blur-2xl">
          <div className="border-b border-red-200/15 bg-red-500/10 px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="rounded-xl bg-red-500/20 p-2.5 ring-1 ring-red-300/25">
                  <AlertTriangle
                    aria-hidden="true"
                    className="h-5 w-5 text-red-100"
                  />
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.15em] text-red-200/70">
                    {error.code}
                  </p>

                  <h2 className="mt-1 text-xl font-black text-red-50">
                    {error.title}
                  </h2>

                  <p className="mt-2 max-w-4xl text-sm leading-6 text-red-50/80">
                    {error.message}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void copyErrorDetails()}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/15"
                >
                  <ClipboardCopy
                    aria-hidden="true"
                    className="h-4 w-4"
                  />
                  {errorCopied ? "Copied" : "Copy error details"}
                </button>

                <button
                  type="button"
                  onClick={() => void loadReports(true)}
                  disabled={refreshing}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-red-500/25 px-4 text-sm font-bold text-red-50 ring-1 ring-red-300/25 transition hover:bg-red-500/35 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCcw
                    aria-hidden="true"
                    className={`h-4 w-4 ${
                      refreshing ? "animate-spin" : ""
                    }`}
                  />
                  Try Again
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4 sm:p-6">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                HTTP status
              </p>
              <p className="mt-2 font-mono text-sm font-bold text-white">
                {error.httpStatus ?? "Not available"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                Request ID
              </p>
              <p className="mt-2 break-all font-mono text-sm font-bold text-white">
                {error.requestId || "Not available"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                Retryable
              </p>
              <p className="mt-2 text-sm font-bold text-white">
                {error.retryable ? "Yes" : "No"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                Time
              </p>
              <p className="mt-2 text-sm font-bold text-white">
                {formatDate(error.occurredAt)}
              </p>
            </div>
          </div>

          <div className="space-y-3 px-5 pb-5 sm:px-6 sm:pb-6">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                Endpoint
              </p>
              <code className="mt-2 block break-all text-sm text-red-100">
                {error.endpoint}
              </code>
            </div>

            {error.technicalDetails ? (
              <details className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <summary className="cursor-pointer text-sm font-black text-white">
                  Technical details
                </summary>

                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/35 p-4 text-xs leading-5 text-red-100">
                  {error.technicalDetails}
                </pre>
              </details>
            ) : null}

            {error.hint ? (
              <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-200/70">
                  Suggested action
                </p>
                <p className="mt-2 text-sm leading-6 text-amber-50/85">
                  {error.hint}
                </p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/15 backdrop-blur-2xl">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-red-400/50 via-yellow-300/50 via-emerald-400/50 via-sky-400/50 to-purple-400/50"
        />
        <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <LayoutDashboard
                aria-hidden="true"
                className="h-5 w-5 text-purple-200"
              />

              <h2 className="text-lg font-black text-white">
                Active Bug Reports
              </h2>
            </div>

            <p className="mt-1 text-sm text-slate-400">
              Showing {activeReports.length} active report
              {activeReports.length === 1 ? "" : "s"}.
            </p>
          </div>

          <div className="rounded-xl bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-300 ring-1 ring-white/10 backdrop-blur-xl">
            Signed in as {currentAdmin.name}
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center px-6 py-16">
            <div className="text-center">
              <Loader2
                aria-hidden="true"
                className="mx-auto h-8 w-8 animate-spin text-purple-300"
              />

              <p className="mt-4 text-sm font-semibold text-slate-300">
                Loading bug reports...
              </p>
            </div>
          </div>
        ) : activeReports.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10 ring-1 ring-purple-300/15">
              <Bug
                aria-hidden="true"
                className="h-8 w-8 text-purple-200"
              />
            </div>

            <h3 className="mt-5 text-xl font-black text-white">
              No active bug reports found
            </h3>

            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">
              {hasActiveFilters
                ? "No reports match the filters you selected."
                : "There are currently no active bug reports. Resolved reports are shown in the separate table below."}
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-bold text-white hover:bg-white/[0.09]"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                  Clear Filters
                </button>
              ) : null}

              <button
                type="button"
                onClick={openReportModal}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 via-purple-600 to-sky-500 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-purple-950/30 ring-1 ring-white/10 transition hover:brightness-110"
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
                Report First Bug
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 p-4 sm:p-5">
            {activeReports.map((report) => {
              const priorityStyle = getPriorityClasses(
                report.priority,
              );

              const ageHours = getBugAgeInHours(
                report.created_at,
              );

              const seniorOverdue =
                report.priority === "senior" &&
                isOpenBug(report) &&
                ageHours >= 48;

              return (
                <Link
                  key={report.id}
                  href={`/Admin/BugTracker/${report.id}`}
                  className={`
                    group
                    block
                    rounded-2xl
                    border
                    p-4
                    transition
                    hover:-translate-y-0.5
                    backdrop-blur-xl
                    hover:border-white/25
                    hover:bg-white/[0.08]
                    sm:p-5
                    ${priorityStyle.card}
                  `}
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`
                            inline-flex
                            items-center
                            gap-2
                            rounded-full
                            px-3
                            py-1
                            text-xs
                            font-black
                            ring-1
                            ${priorityStyle.badge}
                          `}
                        >
                          <span
                            aria-hidden="true"
                            className={`h-2 w-2 rounded-full ${priorityStyle.dot}`}
                          />

                          {PRIORITY_LABELS[report.priority]}
                        </span>

                        <span
                          className={`
                            rounded-full
                            px-3
                            py-1
                            text-xs
                            font-bold
                            ring-1
                            ${getStatusClasses(report.status)}
                          `}
                        >
                          {STATUS_LABELS[report.status]}
                        </span>

                        <span className="rounded-full bg-white/[0.05] px-3 py-1 text-xs font-semibold text-slate-300 ring-1 ring-white/10">
                          {APPLICATION_LABELS[report.application]}
                        </span>

                        {seniorOverdue ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/25 px-3 py-1 text-xs font-black text-red-50 ring-1 ring-red-300/30">
                            <Clock3
                              aria-hidden="true"
                              className="h-3.5 w-3.5"
                            />
                            OVERDUE
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-4 flex items-start gap-3">
                        <div
                          className={`mt-0.5 rounded-xl bg-black/20 p-2 ring-1 ring-white/10 ${priorityStyle.icon}`}
                        >
                          {report.priority === "senior" ? (
                            <ShieldAlert
                              aria-hidden="true"
                              className="h-5 w-5"
                            />
                          ) : report.priority === "normal" ? (
                            <AlertTriangle
                              aria-hidden="true"
                              className="h-5 w-5"
                            />
                          ) : (
                            <Bug
                              aria-hidden="true"
                              className="h-5 w-5"
                            />
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-[0.13em] text-slate-500">
                            {report.reference_number}
                          </p>

                          <h3 className="mt-1 text-lg font-black leading-6 text-white group-hover:text-purple-100">
                            {report.title}
                          </h3>

                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-300">
                            {report.description}
                          </p>
                        </div>
                      </div>

                      {report.priority === "senior" &&
                      isOpenBug(report) ? (
                        <div
                          className={`
                            mt-4
                            rounded-xl
                            border
                            px-4
                            py-3
                            text-sm
                            font-bold
                            ${
                              seniorOverdue
                                ? "border-red-300/25 bg-red-500/15 text-red-100"
                                : "border-red-300/15 bg-red-500/10 text-red-100/90"
                            }
                          `}
                        >
                          {seniorOverdue
                            ? "This Senior Bug has passed the 1–2 day target."
                            : "Urgent Senior Bug — target investigation and fix within 1–2 days."}
                        </div>
                      ) : null}

                      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">
                        <span>
                          Reported by{" "}
                          <strong className="text-slate-300">
                            {report.reporter_name ||
                              report.reporter_email ||
                              "Unknown administrator"}
                          </strong>
                        </span>

                        <span>
                          Reported{" "}
                          <strong className="text-slate-300">
                            {formatTimeAgo(report.created_at)}
                          </strong>
                        </span>

                        <span>
                          Assigned to{" "}
                          <strong className="text-slate-300">
                            {report.assigned_admin_name ||
                              "Not assigned"}
                          </strong>
                        </span>

                        <span>
                          Email{" "}
                          <strong
                            className={
                              report.email_notification_sent
                                ? "text-emerald-300"
                                : "text-amber-300"
                            }
                          >
                            {report.email_notification_sent
                              ? "sent"
                              : "not sent"}
                          </strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center justify-between gap-4 border-t border-white/10 pt-4 xl:min-w-[180px] xl:flex-col xl:items-end xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
                      <div className="text-left xl:text-right">
                        <p className="text-xs font-semibold text-slate-500">
                          Created
                        </p>

                        <p className="mt-1 text-sm font-bold text-slate-300">
                          {formatDate(report.created_at)}
                        </p>
                      </div>

                      <div className="inline-flex items-center gap-2 text-sm font-black text-purple-200">
                        View report
                        <ChevronRight
                          aria-hidden="true"
                          className="h-4 w-4 transition-transform group-hover:translate-x-1"
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="relative overflow-hidden rounded-3xl border border-emerald-300/15 bg-white/[0.04] shadow-2xl shadow-black/15 backdrop-blur-2xl">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/70 to-transparent"
        />

        <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <CheckCircle2
                aria-hidden="true"
                className="h-5 w-5 text-emerald-300"
              />

              <h2 className="text-lg font-black text-white">
                Resolved Bug Reports
              </h2>
            </div>

            <p className="mt-1 text-sm text-slate-400">
              Resolved and closed reports are kept separately so they
              do not get mixed up with bugs that still need work.
            </p>
          </div>

          <div className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-100 ring-1 ring-emerald-300/20">
            {resolvedReports.length} resolved report
            {resolvedReports.length === 1 ? "" : "s"}
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[180px] items-center justify-center px-6 py-12">
            <Loader2
              aria-hidden="true"
              className="h-7 w-7 animate-spin text-emerald-300"
            />
          </div>
        ) : resolvedReports.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <CheckCircle2
              aria-hidden="true"
              className="mx-auto h-10 w-10 text-emerald-300/60"
            />
            <h3 className="mt-4 text-lg font-black text-white">
              No resolved reports yet
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Bugs will move into this table when their status is
              changed to Resolved or Closed.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-black/20">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                    Reference
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                    Bug
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                    Application
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                    Status
                  </th>
                  
                  <th className="px-5 py-3 text-right text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {resolvedReports.map((report) => (
                  <tr
                    key={report.id}
                    className="bg-emerald-500/[0.025] transition hover:bg-emerald-500/[0.06]"
                  >
                    <td className="whitespace-nowrap px-5 py-4 font-mono text-xs font-bold text-emerald-200">
                      {report.reference_number}
                    </td>

                    <td className="min-w-[300px] px-5 py-4">
                      <p className="font-black text-white">
                        {report.title}
                      </p>
                      <p className="mt-1 line-clamp-1 text-sm text-slate-400">
                        {report.description}
                      </p>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-slate-300">
                      {APPLICATION_LABELS[report.application]}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${getStatusClasses(
                          report.status,
                        )}`}
                      >
                        {STATUS_LABELS[report.status]}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-300">
                      {formatDate(
                        report.resolved_at ||
                          report.closed_at ||
                          report.updated_at,
                      )}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <Link
                        href={`/Admin/BugTracker/${report.id}`}
                        className="inline-flex h-9 items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3 text-xs font-black text-emerald-100 transition hover:bg-emerald-500/20"
                      >
                        View report
                        <ChevronRight
                          aria-hidden="true"
                          className="h-3.5 w-3.5"
                        />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {reportModalOpen ? (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-3 backdrop-blur-md sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-bug-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeReportModal();
            }
          }}
        >
          <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-white/20 bg-slate-950 shadow-2xl shadow-black/50">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-gradient-to-r from-fuchsia-700 via-purple-700 to-indigo-700 px-5 py-5 sm:px-7">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
                  <Bug className="h-6 w-6 text-white" aria-hidden="true" />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-white/65">
                    Bug Tracker
                  </p>
                  <h2
                    id="report-bug-title"
                    className="mt-1 text-2xl font-black text-white"
                  >
                    Report a Bug
                  </h2>
                  <p className="mt-1 text-sm text-white/75">
                    Cameron will receive an email after the report is saved.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeReportModal}
                disabled={submittingReport}
                aria-label="Close report bug popup"
                className="rounded-xl bg-white/10 p-2 text-white transition hover:bg-white/20 disabled:opacity-50"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {reportSuccess ? (
              <div className="p-6 sm:p-8">
                <div className="rounded-3xl border border-emerald-300/25 bg-emerald-500/10 p-6 text-center">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-300" />
                  <h3 className="mt-4 text-2xl font-black text-white">
                    Bug Report Received
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    {reportSuccess.message}
                  </p>

                  <div className="mx-auto mt-5 max-w-md rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                      Reference
                    </p>
                    <p className="mt-2 font-mono text-lg font-black text-white">
                      {reportSuccess.reference}
                    </p>
                  </div>

                  <p className="mt-4 text-sm font-semibold text-slate-300">
                    {reportSuccess.emailSent
                      ? "Cameron has been sent an email containing the bug details."
                      : "The report was saved, but the email notification could not be confirmed."}
                  </p>

                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setReportSuccess(null);
                        setReportForm({
                          ...EMPTY_REPORT_FORM,
                          page_url:
                            typeof window !== "undefined"
                              ? window.location.href
                              : "",
                        });
                      }}
                      className="rounded-xl border border-white/15 bg-white/10 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/15"
                    >
                      Report Another Bug
                    </button>

                    <button
                      type="button"
                      onClick={closeReportModal}
                      className="rounded-xl bg-gradient-to-r from-pink-500 via-purple-600 to-sky-500 px-5 py-2.5 text-sm font-black text-white hover:brightness-110"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6 p-5 sm:p-7">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-white">
                      Application <span className="text-red-300">*</span>
                    </span>
                    <select
                      value={reportForm.application}
                      onChange={(event) =>
                        updateReportField(
                          "application",
                          event.target.value as BugApplication,
                        )
                      }
                      style={{ colorScheme: "dark" }}
                      className="h-12 w-full rounded-xl border border-white/15 bg-black px-3 text-sm font-semibold text-white outline-none focus:border-pink-300/60 focus:ring-2 focus:ring-purple-500/30 [&>option]:bg-black [&>option]:text-white"
                    >
                      {Object.entries(APPLICATION_LABELS).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-white">
                      Priority <span className="text-red-300">*</span>
                    </span>
                    <select
                      value={reportForm.priority}
                      onChange={(event) =>
                        updateReportField(
                          "priority",
                          event.target.value as BugPriority,
                        )
                      }
                      style={{ colorScheme: "dark" }}
                      className="h-12 w-full rounded-xl border border-white/15 bg-black px-3 text-sm font-semibold text-white outline-none focus:border-pink-300/60 focus:ring-2 focus:ring-purple-500/30 [&>option]:bg-black [&>option]:text-white"
                    >
                      <option value="minor">Minor Bug</option>
                      <option value="normal">Normal Issue</option>
                      <option value="senior">Senior Bug — Critical</option>
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm font-bold text-white">
                      Bug title <span className="text-red-300">*</span>
                    </span>
                    <input
                      value={reportForm.title}
                      onChange={(event) =>
                        updateReportField("title", event.target.value)
                      }
                      maxLength={200}
                      placeholder="Example: Save button does not update the transaction"
                      className="h-12 w-full rounded-xl border border-white/15 bg-black/40 px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-pink-300/60 focus:ring-2 focus:ring-purple-500/30"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-white">
                      Affected feature
                    </span>
                    <input
                      value={reportForm.affected_feature}
                      onChange={(event) =>
                        updateReportField(
                          "affected_feature",
                          event.target.value,
                        )
                      }
                      maxLength={200}
                      placeholder="Example: Transaction form"
                      className="h-12 w-full rounded-xl border border-white/15 bg-black/40 px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-pink-300/60 focus:ring-2 focus:ring-purple-500/30"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-white">
                      Page URL
                    </span>
                    <input
                      value={reportForm.page_url}
                      onChange={(event) =>
                        updateReportField("page_url", event.target.value)
                      }
                      placeholder="Current page URL"
                      className="h-12 w-full rounded-xl border border-white/15 bg-black/40 px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-pink-300/60 focus:ring-2 focus:ring-purple-500/30"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-white">
                    Bug description <span className="text-red-300">*</span>
                  </span>
                  <textarea
                    value={reportForm.description}
                    onChange={(event) =>
                      updateReportField("description", event.target.value)
                    }
                    rows={4}
                    maxLength={10000}
                    placeholder="Explain what the bug is and how it affects the system."
                    className="w-full resize-y rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-pink-300/60 focus:ring-2 focus:ring-purple-500/30"
                  />
                </label>

                <div className="grid gap-4 lg:grid-cols-3">
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-white">
                      Steps to reproduce
                    </span>
                    <textarea
                      value={reportForm.steps_to_reproduce}
                      onChange={(event) =>
                        updateReportField(
                          "steps_to_reproduce",
                          event.target.value,
                        )
                      }
                      rows={5}
                      placeholder={"1. Open the page\n2. Select...\n3. Click..."}
                      className="w-full resize-y rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-pink-300/60 focus:ring-2 focus:ring-purple-500/30"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-white">
                      Expected result
                    </span>
                    <textarea
                      value={reportForm.expected_result}
                      onChange={(event) =>
                        updateReportField(
                          "expected_result",
                          event.target.value,
                        )
                      }
                      rows={5}
                      placeholder="Explain what should have happened."
                      className="w-full resize-y rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-pink-300/60 focus:ring-2 focus:ring-purple-500/30"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-white">
                      Actual result <span className="text-red-300">*</span>
                    </span>
                    <textarea
                      value={reportForm.actual_result}
                      onChange={(event) =>
                        updateReportField(
                          "actual_result",
                          event.target.value,
                        )
                      }
                      rows={5}
                      placeholder="Explain what actually happened."
                      className="w-full resize-y rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-pink-300/60 focus:ring-2 focus:ring-purple-500/30"
                    />
                  </label>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-start gap-3">
                    <FileText className="mt-0.5 h-5 w-5 shrink-0 text-purple-200" />
                    <div>
                      <p className="text-sm font-bold text-white">
                        Reporter details
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        This report will be recorded as {currentAdmin.name} ({currentAdmin.email}).
                      </p>
                    </div>
                  </div>
                </div>

                {reportError ? (
                  <div className="rounded-2xl border border-red-300/25 bg-red-500/10 p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-200" />
                      <p className="text-sm leading-6 text-red-100">
                        {reportError}
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeReportModal}
                    disabled={submittingReport}
                    className="h-11 rounded-xl border border-white/15 bg-white/10 px-5 text-sm font-bold text-white transition hover:bg-white/15 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={() => void submitBugReport()}
                    disabled={submittingReport}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 via-purple-600 to-sky-500 px-6 text-sm font-black text-white shadow-lg shadow-purple-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submittingReport ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}

                    {submittingReport
                      ? "Submitting report..."
                      : "Submit Bug Report"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}