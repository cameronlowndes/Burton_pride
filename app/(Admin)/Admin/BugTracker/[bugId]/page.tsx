"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Bug,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  ExternalLink,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Loader2,
  Mail,
  MailCheck,
  Monitor,
  RefreshCw,
  Save,
  Shield,
  ShieldAlert,
  Trash2,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type BugPriority = "minor" | "normal" | "senior" | "critical";
type BugStatus =
  | "reported"
  | "open"
  | "investigating"
  | "in_progress"
  | "waiting"
  | "resolved"
  | "closed"
  | "rejected";

type BugReport = {
  id: string;
  reference?: string | null;
  title: string;
  description: string;
  priority: BugPriority;
  status: BugStatus;
  app_name?: string | null;
  page_name?: string | null;
  page_url?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  steps_to_reproduce?: string | null;
  expected_result?: string | null;
  actual_result?: string | null;
  browser?: string | null;
  operating_system?: string | null;
  device_type?: string | null;
  screenshot_url?: string | null;
  reporter_name?: string | null;
  reporter_email?: string | null;
  assigned_to_name?: string | null;
  assigned_to_email?: string | null;
  admin_notes?: string | null;
  resolution_notes?: string | null;
  created_at: string;
  updated_at?: string | null;
  resolved_at?: string | null;
};

type DetailedError = {
  title: string;
  message: string;
  code: string;
  operation: string;
  httpStatus?: number;
  httpStatusText?: string;
  bugId?: string;
  details?: string;
  hint?: string;
  requestId?: string;
  timestamp: string;
};

type EmailNotificationResult = {
  required: boolean;
  sent: boolean;
  recipient?: string | null;
  email_id?: string | null;
  error?: string | null;
  error_code?: string | null;
  provider?: string | null;
  operation?: string | null;
  request_id?: string | null;
  http_status?: number | null;
  timestamp?: string | null;
  details?: string | null;
  hint?: string | null;
};

type StatusUpdatePopup = {
  open: boolean;
  title: string;
  message: string;
  previousStatus: BugStatus;
  newStatus: BugStatus;
  recipient?: string | null;
  emailRequired: boolean;
  emailSent: boolean;
  emailError?: string | null;
  emailErrorCode?: string | null;
  emailId?: string | null;
  provider?: string | null;
  operation?: string | null;
  requestId?: string | null;
  httpStatus?: number | null;
  timestamp?: string | null;
  details?: string | null;
  hint?: string | null;
  bugId: string;
};

const STATUS_OPTIONS: Array<{ value: BugStatus; label: string }> = [
  { value: "reported", label: "Reported" },
  { value: "open", label: "Open" },
  { value: "investigating", label: "Investigating" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting", label: "Waiting for information" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
  { value: "rejected", label: "Rejected" },
];

const PRIORITY_OPTIONS: Array<{ value: BugPriority; label: string }> = [
  { value: "minor", label: "Minor bug" },
  { value: "normal", label: "Normal issue" },
  { value: "senior", label: "Senior bug" },
  { value: "critical", label: "Critical bug" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readApiMessage(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback;
  if (typeof payload.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }
  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }
  return fallback;
}

function readStringField(payload: unknown, keys: string[]): string | undefined {
  if (!isRecord(payload)) return undefined;
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  if (isRecord(payload.error)) {
    for (const key of keys) {
      const value = payload.error[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return undefined;
}

function createDetailedError({
  title,
  fallbackMessage,
  operation,
  bugId,
  payload,
  response,
  caughtError,
  code,
}: {
  title: string;
  fallbackMessage: string;
  operation: string;
  bugId?: string;
  payload?: unknown;
  response?: Response;
  caughtError?: unknown;
  code?: string;
}): DetailedError {
  const serverMessage = readApiMessage(payload, fallbackMessage);
  const caughtMessage = caughtError instanceof Error ? caughtError.message : undefined;

  return {
    title,
    message: serverMessage !== fallbackMessage ? serverMessage : caughtMessage || fallbackMessage,
    code:
      code ||
      readStringField(payload, ["code", "error_code", "errorCode"]) ||
      (response ? `BUG_API_HTTP_${response.status}` : "BUG_TRACKER_CLIENT_ERROR"),
    operation,
    httpStatus: response?.status,
    httpStatusText: response?.statusText || undefined,
    bugId,
    details: readStringField(payload, ["details", "detail", "technical_details"]),
    hint: readStringField(payload, ["hint", "suggestion", "resolution"]),
    requestId:
      response?.headers.get("x-request-id") ||
      readStringField(payload, ["request_id", "requestId", "trace_id", "traceId"]),
    timestamp: new Date().toISOString(),
  };
}

function extractBug(payload: unknown): BugReport | null {
  if (!isRecord(payload)) return null;
  const value = payload.bug ?? payload.data ?? payload;
  if (!isRecord(value) || typeof value.id !== "string") return null;
  return value as BugReport;
}

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatRelativeDate(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });
  const abs = Math.abs(seconds);
  if (abs < 60) return formatter.format(seconds, "second");
  if (abs < 3600) return formatter.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return formatter.format(Math.round(seconds / 3600), "hour");
  return formatter.format(Math.round(seconds / 86400), "day");
}

function normaliseLabel(value?: string | null) {
  if (!value) return "Not recorded";
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function priorityTone(priority: BugPriority) {
  switch (priority) {
    case "minor":
      return {
        border: "border-sky-400/25",
        background: "bg-sky-500/10",
        text: "text-sky-100",
        icon: "text-sky-300",
        shadow: "shadow-sky-950/20",
      };
    case "normal":
      return {
        border: "border-amber-400/25",
        background: "bg-amber-500/10",
        text: "text-amber-100",
        icon: "text-amber-300",
        shadow: "shadow-amber-950/20",
      };
    case "senior":
      return {
        border: "border-orange-400/25",
        background: "bg-orange-500/10",
        text: "text-orange-100",
        icon: "text-orange-300",
        shadow: "shadow-orange-950/20",
      };
    case "critical":
      return {
        border: "border-red-400/30",
        background: "bg-red-500/10",
        text: "text-red-100",
        icon: "text-red-300",
        shadow: "shadow-red-950/20",
      };
  }
}

function statusTone(status: BugStatus) {
  switch (status) {
    case "reported":
      return "border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-100";
    case "open":
      return "border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-100";
    case "investigating":
      return "border-purple-400/20 bg-purple-500/10 text-purple-100";
    case "in_progress":
      return "border-blue-400/20 bg-blue-500/10 text-blue-100";
    case "waiting":
      return "border-amber-400/20 bg-amber-500/10 text-amber-100";
    case "resolved":
      return "border-emerald-400/20 bg-emerald-500/10 text-emerald-100";
    case "closed":
      return "border-slate-400/20 bg-slate-500/10 text-slate-100";
    case "rejected":
      return "border-rose-400/20 bg-rose-500/10 text-rose-100";
  }
}

function Panel({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[22px] border border-white/10 bg-[#2d2d2f] shadow-xl shadow-black/20">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
        <div className="text-white/75">{icon}</div>
        <div>
          <h2 className="text-base font-black text-white">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-white/45">{description}</p> : null}
        </div>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function InfoBox({ label, value, mono = false }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-white/8 bg-[#262628] px-4 py-3.5">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/35">{label}</p>
      <p className={`mt-2 break-words text-sm leading-6 text-white/80 ${mono ? "font-mono text-xs" : ""}`}>
        {value?.trim() || "Not recorded"}
      </p>
    </div>
  );
}

function SideRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-3 border-b border-white/8 py-3.5 last:border-b-0">
      <div className="mt-0.5 text-violet-300">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/35">{label}</p>
        <p className="mt-1 break-words text-sm text-white/75">{value?.trim() || "Not recorded"}</p>
      </div>
    </div>
  );
}


function buildEmailDebugText(popup: StatusUpdatePopup) {
  return [
    "Burton Pride Bug Tracker email notification diagnostics",
    `Bug ID: ${popup.bugId}`,
    `Previous status: ${popup.previousStatus}`,
    `New status: ${popup.newStatus}`,
    `Email required: ${popup.emailRequired ? "yes" : "no"}`,
    `Email sent: ${popup.emailSent ? "yes" : "no"}`,
    `Recipient: ${popup.recipient || "Not supplied"}`,
    `Provider: ${popup.provider || "Not supplied"}`,
    `Email ID: ${popup.emailId || "Not supplied"}`,
    `Error code: ${popup.emailErrorCode || "Not supplied"}`,
    `Operation: ${popup.operation || "Not supplied"}`,
    `Request ID: ${popup.requestId || "Not supplied"}`,
    `HTTP status: ${
      typeof popup.httpStatus === "number"
        ? String(popup.httpStatus)
        : "Not supplied"
    }`,
    `Time: ${popup.timestamp || new Date().toISOString()}`,
    `Error: ${popup.emailError || "Not supplied"}`,
    `Details: ${popup.details || "Not supplied"}`,
    `Hint: ${popup.hint || "Not supplied"}`,
  ].join("\\n");
}

function StatusUpdateEmailPopup({
  popup,
  onClose,
}: {
  popup: StatusUpdatePopup;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!popup.open) return null;

  const success = popup.emailRequired && popup.emailSent;
  const warning = popup.emailRequired && !popup.emailSent;

  async function copyDiagnostics() {
    try {
      await navigator.clipboard.writeText(
        buildEmailDebugText(popup),
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch (copyError) {
      console.error(
        "Unable to copy email diagnostics",
        copyError,
      );
    }
  }

  const technicalRows = [
    ["Error code", popup.emailErrorCode || "Not returned"],
    ["Provider", popup.provider || "Not returned"],
    ["Operation", popup.operation || "Send fixed bug email"],
    ["HTTP status", typeof popup.httpStatus === "number" ? String(popup.httpStatus) : "Not returned"],
    ["Request ID", popup.requestId || "Not returned"],
    ["Email ID", popup.emailId || "Not returned"],
    ["Bug report ID", popup.bugId],
    ["Time", popup.timestamp ? formatDate(popup.timestamp) : formatDate(new Date().toISOString())],
  ];

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center overflow-y-auto bg-black/80 px-4 py-8 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="status-update-popup-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="my-auto w-full max-w-4xl overflow-hidden rounded-[24px] border border-white/10 bg-[#2d2d30] shadow-2xl shadow-black/70">
        <div
          className={`flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5 ${
            success
              ? "bg-emerald-500/10"
              : warning
                ? "bg-red-500/10"
                : "bg-violet-500/10"
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`rounded-2xl p-3 ${
                success
                  ? "bg-emerald-500/15 text-emerald-200"
                  : warning
                    ? "bg-red-500/15 text-red-200"
                    : "bg-violet-500/15 text-violet-200"
              }`}
            >
              {success ? (
                <MailCheck className="h-6 w-6" />
              ) : warning ? (
                <AlertCircle className="h-6 w-6" />
              ) : (
                <CheckCircle2 className="h-6 w-6" />
              )}
            </div>

            <div>
              <h2
                id="status-update-popup-title"
                className="text-xl font-black text-white"
              >
                {popup.title}
              </h2>

              <p className="mt-1 text-sm leading-6 text-white/65">
                {popup.message}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-white/45 transition hover:bg-white/10 hover:text-white"
            aria-label="Close status update popup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[78vh] space-y-4 overflow-y-auto p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoBox
              label="Previous status"
              value={normaliseLabel(popup.previousStatus)}
            />
            <InfoBox
              label="New status"
              value={normaliseLabel(popup.newStatus)}
            />
          </div>

          <div
            className={`rounded-2xl border p-4 ${
              success
                ? "border-emerald-400/20 bg-emerald-500/10"
                : warning
                  ? "border-red-400/20 bg-red-500/10"
                  : "border-violet-400/20 bg-violet-500/10"
            }`}
          >
            <div className="flex items-start gap-3">
              <Mail
                className={`mt-0.5 h-5 w-5 shrink-0 ${
                  success
                    ? "text-emerald-300"
                    : warning
                      ? "text-red-300"
                      : "text-violet-300"
                }`}
              />

              <div className="min-w-0">
                <p className="text-sm font-black text-white">
                  {success
                    ? "Email notification sent"
                    : warning
                      ? "Email notification failed"
                      : "No email was required"}
                </p>

                <p className="mt-1 break-words text-sm leading-6 text-white/65">
                  {success
                    ? `The reporter was emailed at ${
                        popup.recipient ||
                        "their recorded email address"
                      }.`
                    : warning
                      ? popup.emailError ||
                        "The status was saved, but the reporter could not be emailed."
                      : "The report was updated successfully. Email notifications are sent when the bug is marked Resolved or Closed."}
                </p>
              </div>
            </div>
          </div>

          {warning ? (
            <>
              <section className="overflow-hidden rounded-2xl border border-red-400/20 bg-[#342728]">
                <div className="border-b border-red-300/10 px-5 py-4">
                  <h3 className="text-sm font-black text-red-100">
                    Detailed email error
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-red-100/55">
                    Use these details to identify whether the problem
                    came from the API route, Resend configuration,
                    sender verification, recipient data or the email
                    provider.
                  </p>
                </div>

                <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
                  {technicalRows.map(([label, value]) => (
                    <InfoBox
                      key={label}
                      label={label}
                      value={value}
                      mono
                    />
                  ))}
                </div>

                <div className="grid gap-3 border-t border-red-300/10 p-5 lg:grid-cols-2">
                  <InfoBox
                    label="Reporter email"
                    value={popup.recipient || "Not supplied"}
                    mono
                  />
                  <InfoBox
                    label="Email error"
                    value={
                      popup.emailError ||
                      "The API did not return an email error message."
                    }
                  />
                  <InfoBox
                    label="Technical details"
                    value={
                      popup.details ||
                      "No technical details were returned by the API."
                    }
                    mono
                  />
                  <InfoBox
                    label="Suggested action"
                    value={
                      popup.hint ||
                      "Check RESEND_API_KEY, verify BUG_REPORT_FROM_EMAIL in Resend, confirm reporter_email is valid, and make sure the PATCH API returns email_notification."
                    }
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-5">
                <h3 className="text-sm font-black text-amber-100">
                  Debug checklist
                </h3>
                <div className="mt-3 space-y-2 text-sm leading-6 text-amber-50/70">
                  <p>1. Confirm <code className="rounded bg-black/25 px-1.5 py-0.5 text-xs">RESEND_API_KEY</code> exists in the server environment.</p>
                  <p>2. Confirm the domain in <code className="rounded bg-black/25 px-1.5 py-0.5 text-xs">BUG_REPORT_FROM_EMAIL</code> is verified in Resend.</p>
                  <p>3. Confirm <code className="rounded bg-black/25 px-1.5 py-0.5 text-xs">reporter_email</code> contains a valid email address.</p>
                  <p>4. Check the server console for the full Resend response.</p>
                  <p>5. Confirm the PATCH response contains <code className="rounded bg-black/25 px-1.5 py-0.5 text-xs">email_notification.sent</code>, <code className="rounded bg-black/25 px-1.5 py-0.5 text-xs">error</code>, and <code className="rounded bg-black/25 px-1.5 py-0.5 text-xs">request_id</code>.</p>
                </div>
              </section>
            </>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
            <button
              type="button"
              onClick={() => void copyDiagnostics()}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-black text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              {copied ? (
                <ClipboardCheck className="h-4 w-4 text-emerald-300" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Diagnostics copied" : "Copy diagnostics"}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-6 text-sm font-black text-white shadow-lg shadow-fuchsia-950/30 transition hover:brightness-110"
            >
              Close
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function DetailedErrorMessage({ error }: { error: DetailedError }) {
  const rows = [
    ["Error code", error.code],
    ["Operation", error.operation],
    ["HTTP response", error.httpStatus ? `${error.httpStatus} ${error.httpStatusText || ""}`.trim() : "No HTTP response"],
    ["Bug report ID", error.bugId || "Not available"],
    ["Request ID", error.requestId || "Not supplied"],
    ["Time", formatDate(error.timestamp)],
  ];

  return (
    <section className="overflow-hidden rounded-[22px] border border-red-400/25 bg-[#342728] shadow-xl shadow-black/20">
      <div className="flex items-start gap-3 border-b border-red-300/10 px-5 py-4">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
        <div>
          <h2 className="font-black text-red-50">{error.title}</h2>
          <p className="mt-1 text-sm leading-6 text-red-50/70">{error.message}</p>
        </div>
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map(([label, value]) => (
          <InfoBox key={label} label={label} value={value} mono />
        ))}
      </div>
      {error.details || error.hint ? (
        <div className="grid gap-3 border-t border-red-300/10 p-5 lg:grid-cols-2">
          {error.details ? <InfoBox label="Technical details" value={error.details} mono /> : null}
          {error.hint ? <InfoBox label="Suggested action" value={error.hint} /> : null}
        </div>
      ) : null}
    </section>
  );
}

export default function BugTrackerDetailsPage() {
  const params = useParams<{ bugId: string }>();
  const router = useRouter();
  const bugId = useMemo(() => {
    const value = params?.bugId;
    return Array.isArray(value) ? value[0] || "" : value || "";
  }, [params]);

  const [bug, setBug] = useState<BugReport | null>(null);
  const [status, setStatus] = useState<BugStatus>("open");
  const [priority, setPriority] = useState<BugPriority>("normal");
  const [adminNotes, setAdminNotes] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<DetailedError | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [statusUpdatePopup, setStatusUpdatePopup] =
    useState<StatusUpdatePopup | null>(null);

  const loadBug = useCallback(async () => {
    if (!bugId) {
      setError(
        createDetailedError({
          title: "Bug report ID is missing",
          fallbackMessage: "The page URL does not contain a valid bug report ID.",
          operation: "Load bug report",
          code: "BUG_TRACKER_MISSING_ID",
        }),
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage("");

    try {
      const response = await fetch(`/api/admin/bug-tracker/${encodeURIComponent(bugId)}`, {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw createDetailedError({
          title: "Bug report could not be loaded",
          fallbackMessage: `Unable to load this bug report. The server returned HTTP ${response.status}.`,
          operation: "GET /api/admin/bug-tracker/[bugId]",
          bugId,
          payload,
          response,
        });
      }

      const loadedBug = extractBug(payload);
      if (!loadedBug) {
        throw createDetailedError({
          title: "Invalid bug report response",
          fallbackMessage: "The server responded successfully, but the bug report data was missing or invalid.",
          operation: "Parse bug report response",
          bugId,
          payload,
          code: "BUG_TRACKER_INVALID_RESPONSE",
        });
      }

      setBug(loadedBug);
      setStatus(loadedBug.status || "open");
      setPriority(loadedBug.priority || "normal");
      setAdminNotes(loadedBug.admin_notes || "");
      setResolutionNotes(loadedBug.resolution_notes || "");
    } catch (caughtError) {
      console.error("Failed to load bug report", { bugId, error: caughtError });
      setBug(null);
      setError(
        isRecord(caughtError) && typeof caughtError.code === "string" && typeof caughtError.message === "string"
          ? (caughtError as DetailedError)
          : createDetailedError({
              title: "Unexpected loading error",
              fallbackMessage: "An unexpected error occurred while loading the bug report.",
              operation: "Load bug report",
              bugId,
              caughtError,
            }),
      );
    } finally {
      setLoading(false);
    }
  }, [bugId]);

  useEffect(() => {
    void loadBug();
  }, [loadBug]);

  async function saveChanges() {
    if (!bug) return;

    const previousStatus = bug.status;

    setSaving(true);
    setError(null);
    setSuccessMessage("");

    try {
      const response = await fetch(`/api/admin/bug-tracker/${encodeURIComponent(bug.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          priority,
          admin_notes: adminNotes.trim() || null,
          resolution_notes: resolutionNotes.trim() || null,
        }),
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw createDetailedError({
          title: "Changes could not be saved",
          fallbackMessage: `The server returned HTTP ${response.status}.`,
          operation: "PATCH /api/admin/bug-tracker/[bugId]",
          bugId: bug.id,
          payload,
          response,
        });
      }

      const updatedBug = extractBug(payload);
      if (updatedBug) {
        setBug(updatedBug);
        setStatus(updatedBug.status);
        setPriority(updatedBug.priority);
        setAdminNotes(updatedBug.admin_notes || "");
        setResolutionNotes(updatedBug.resolution_notes || "");
      } else {
        setBug({
          ...bug,
          status,
          priority,
          admin_notes: adminNotes.trim() || null,
          resolution_notes: resolutionNotes.trim() || null,
          updated_at: new Date().toISOString(),
        });
      }
      const responseMessage = readApiMessage(
        payload,
        "The bug report was updated successfully.",
      );

      setSuccessMessage(responseMessage);

      const emailNotification: EmailNotificationResult =
        isRecord(payload) && isRecord(payload.email_notification)
          ? {
              required:
                payload.email_notification.required === true,
              sent: payload.email_notification.sent === true,
              recipient:
                typeof payload.email_notification.recipient === "string"
                  ? payload.email_notification.recipient
                  : null,
              email_id:
                typeof payload.email_notification.email_id === "string"
                  ? payload.email_notification.email_id
                  : null,
              error:
                typeof payload.email_notification.error === "string"
                  ? payload.email_notification.error
                  : null,
              error_code:
                typeof payload.email_notification.error_code === "string"
                  ? payload.email_notification.error_code
                  : typeof payload.email_notification.code === "string"
                    ? payload.email_notification.code
                    : null,
              provider:
                typeof payload.email_notification.provider === "string"
                  ? payload.email_notification.provider
                  : "Resend",
              operation:
                typeof payload.email_notification.operation === "string"
                  ? payload.email_notification.operation
                  : "sendBugFixedEmail",
              request_id:
                typeof payload.email_notification.request_id === "string"
                  ? payload.email_notification.request_id
                  : typeof payload.email_notification.requestId === "string"
                    ? payload.email_notification.requestId
                    : response.headers.get("x-request-id"),
              http_status:
                typeof payload.email_notification.http_status === "number"
                  ? payload.email_notification.http_status
                  : typeof payload.email_notification.status === "number"
                    ? payload.email_notification.status
                    : null,
              timestamp:
                typeof payload.email_notification.timestamp === "string"
                  ? payload.email_notification.timestamp
                  : typeof payload.timestamp === "string"
                    ? payload.timestamp
                    : new Date().toISOString(),
              details:
                typeof payload.email_notification.details === "string"
                  ? payload.email_notification.details
                  : null,
              hint:
                typeof payload.email_notification.hint === "string"
                  ? payload.email_notification.hint
                  : null,
            }
          : {
              required:
                status === "resolved" || status === "closed",
              sent: false,
              recipient: bug.reporter_email || null,
              error:
                status === "resolved" || status === "closed"
                  ? "The API did not return an email_notification object."
                  : null,
              error_code: "BUG_EMAIL_RESULT_MISSING",
              provider: "Resend",
              operation: "PATCH /api/admin/bug-tracker/[bugId]",
              request_id: response.headers.get("x-request-id"),
              http_status: response.status,
              timestamp: new Date().toISOString(),
              details:
                status === "resolved" || status === "closed"
                  ? `Response payload keys: ${
                      isRecord(payload)
                        ? Object.keys(payload).join(", ") || "none"
                        : "payload was not a JSON object"
                    }`
                  : null,
              hint:
                status === "resolved" || status === "closed"
                  ? "Update the PATCH API response so it includes email_notification with required, sent, recipient, email_id, error, error_code, request_id and details."
                  : null,
            };

      const statusChanged = previousStatus !== status;

      if (statusChanged) {
        setStatusUpdatePopup({
          open: true,
          title:
            emailNotification.required && emailNotification.sent
              ? "Status updated and email sent"
              : emailNotification.required
                ? "Status updated, but email failed"
                : "Bug status updated",
          message: responseMessage,
          previousStatus,
          newStatus: status,
          recipient:
            emailNotification.recipient ||
            bug.reporter_email ||
            null,
          emailRequired: emailNotification.required,
          emailSent: emailNotification.sent,
          emailError: emailNotification.error || null,
          emailErrorCode: emailNotification.error_code || null,
          emailId: emailNotification.email_id || null,
          provider: emailNotification.provider || "Resend",
          operation: emailNotification.operation || null,
          requestId: emailNotification.request_id || null,
          httpStatus: emailNotification.http_status || null,
          timestamp:
            emailNotification.timestamp ||
            new Date().toISOString(),
          details: emailNotification.details || null,
          hint: emailNotification.hint || null,
          bugId: bug.id,
        });
      }
    } catch (caughtError) {
      setError(
        isRecord(caughtError) && typeof caughtError.code === "string" && typeof caughtError.message === "string"
          ? (caughtError as DetailedError)
          : createDetailedError({
              title: "Unexpected save error",
              fallbackMessage: "An unexpected error occurred while saving the bug report.",
              operation: "Save bug report changes",
              bugId: bug.id,
              caughtError,
            }),
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteBug() {
    if (!bug) return;
    if (!window.confirm(`Delete \"${bug.title}\"?\n\nThis cannot be undone.`)) return;

    setDeleting(true);
    setError(null);
    setSuccessMessage("");

    try {
      const response = await fetch(`/api/admin/bug-tracker/${encodeURIComponent(bug.id)}`, {
        method: "DELETE",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw createDetailedError({
          title: "Bug report could not be deleted",
          fallbackMessage: `The server returned HTTP ${response.status}.`,
          operation: "DELETE /api/admin/bug-tracker/[bugId]",
          bugId: bug.id,
          payload,
          response,
        });
      }
      router.push("/Admin/BugTracker");
      router.refresh();
    } catch (caughtError) {
      setError(
        isRecord(caughtError) && typeof caughtError.code === "string" && typeof caughtError.message === "string"
          ? (caughtError as DetailedError)
          : createDetailedError({
              title: "Unexpected delete error",
              fallbackMessage: "An unexpected error occurred while deleting the bug report.",
              operation: "Delete bug report",
              bugId: bug.id,
              caughtError,
            }),
      );
      setDeleting(false);
    }
  }

  async function copyBugId() {
    try {
      await navigator.clipboard.writeText(bugId);
      setSuccessMessage("The bug report ID was copied.");
    } catch {
      setError(
        createDetailedError({
          title: "Bug report ID could not be copied",
          fallbackMessage: "The browser blocked clipboard access.",
          operation: "Copy bug report ID",
          bugId,
          code: "BUG_TRACKER_CLIPBOARD_ERROR",
        }),
      );
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#272729] px-4 py-8 text-white sm:px-6">
        <div className="flex min-h-[70vh] w-full items-center justify-center">
          <div className="rounded-2xl border border-white/10 bg-[#303033] px-8 py-7 text-center shadow-2xl shadow-black/25">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-fuchsia-300" />
            <p className="mt-4 text-sm font-bold text-white/70">Loading bug report...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!bug) {
    return (
      <main className="min-h-screen bg-[#272729] px-4 py-8 text-white sm:px-6">
        <div className="w-full">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/Admin"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 text-sm font-black text-violet-100 transition hover:bg-violet-500/20"
            >
              <LayoutDashboard className="h-4 w-4" />
              Admin dashboard
            </Link>

            <Link
              href="/Admin/BugTracker"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Bug Tracker
            </Link>
          </div>
          <div className="mt-6">{error ? <DetailedErrorMessage error={error} /> : null}</div>
          <div className="mt-4 flex gap-3">
            <button onClick={() => void loadBug()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-black">
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
            <Link
              href="/Admin/BugTracker"
              className="inline-flex h-10 items-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white"
            >
              Return to Bug Tracker
            </Link>

            <Link
              href="/Admin"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 text-sm font-black text-violet-100"
            >
              <LayoutDashboard className="h-4 w-4" />
              Admin dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const tone = priorityTone(bug.priority);
  const displayReference = bug.reference?.trim() || `BUG-${bug.id.slice(0, 8).toUpperCase()}`;

  return (
    <>
      {statusUpdatePopup ? (
        <StatusUpdateEmailPopup
          popup={statusUpdatePopup}
          onClose={() => setStatusUpdatePopup(null)}
        />
      ) : null}

      <main className="min-h-screen w-full bg-[#272729] px-2 py-4 text-white sm:px-3 lg:px-4">
      <div className="w-full max-w-none space-y-4">
        <section className="overflow-hidden rounded-[22px] border border-white/10 bg-gradient-to-r from-fuchsia-700 via-purple-700 to-indigo-700 shadow-2xl shadow-black/20">
          <div className="flex flex-col justify-between gap-7 px-6 py-6 sm:px-8 lg:flex-row lg:items-center lg:px-10 lg:py-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/80">
                <Shield className="h-3.5 w-3.5" /> Platform support
              </div>
              <div className="mt-4 flex items-start gap-3">
                <div className="rounded-xl bg-white/10 p-2.5">
                  <Bug className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white/65">Admin Portal Bug Tracker</p>
                  <h1 className="mt-1 max-w-4xl text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">{bug.title}</h1>
                  <p className="mt-3 max-w-4xl text-sm leading-6 text-white/70">{bug.description || "No description was supplied for this report."}</p>
                </div>
              </div>
            </div>

            <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:w-[410px]">
              <div className="rounded-xl border border-white/15 bg-white/15 px-4 py-3 backdrop-blur-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/55">Priority target</p>
                <p className="mt-2 text-base font-black">{bug.priority === "critical" || bug.priority === "senior" ? "1–2 days" : bug.priority === "normal" ? "Development cycle" : "When scheduled"}</p>
              </div>
              <div className="rounded-xl border border-white/15 bg-white/15 px-4 py-3 backdrop-blur-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/55">Reported by</p>
                <p className="mt-2 break-all text-xs font-black leading-5">{bug.reporter_email || bug.reporter_name || "Not recorded"}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className={`rounded-2xl border ${tone.border} ${tone.background} p-4 shadow-lg ${tone.shadow}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-black text-white/55">Priority</p>
                <p className={`mt-2 text-xl font-black ${tone.text}`}>{normaliseLabel(bug.priority)}</p>
              </div>
              <div className="rounded-xl bg-white/8 p-2"><AlertTriangle className={`h-4 w-4 ${tone.icon}`} /></div>
            </div>
            <p className="mt-3 text-[11px] leading-5 text-white/40">Current development priority for this report.</p>
          </div>

          <div className="rounded-2xl border border-purple-400/20 bg-purple-500/8 p-4 shadow-lg shadow-black/15">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-black text-white/55">Status</p>
                <p className="mt-2 text-xl font-black text-purple-100">{normaliseLabel(bug.status)}</p>
              </div>
              <div className="rounded-xl bg-white/8 p-2"><Clock3 className="h-4 w-4 text-purple-300" /></div>
            </div>
            <p className="mt-3 text-[11px] leading-5 text-white/40">Current investigation and resolution state.</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#303033] p-4 shadow-lg shadow-black/15">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-black text-white/55">Application</p>
                <p className="mt-2 text-xl font-black text-white">{bug.app_name || "Not recorded"}</p>
              </div>
              <div className="rounded-xl bg-white/8 p-2"><Monitor className="h-4 w-4 text-sky-300" /></div>
            </div>
            <p className="mt-3 text-[11px] leading-5 text-white/40">Area of the platform affected by the bug.</p>
          </div>

          <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/8 p-4 shadow-lg shadow-black/15">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-black text-white/55">Last updated</p>
                <p className="mt-2 text-xl font-black text-emerald-100">{formatRelativeDate(bug.updated_at || bug.created_at)}</p>
              </div>
              <div className="rounded-xl bg-white/8 p-2"><RefreshCw className="h-4 w-4 text-emerald-300" /></div>
            </div>
            <p className="mt-3 text-[11px] leading-5 text-white/40">Most recent change made to this report.</p>
          </div>
        </div>

        <section className="rounded-[22px] border border-white/10 bg-[#303033] p-4 shadow-xl shadow-black/20 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/Admin"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 text-sm font-black text-violet-100 transition hover:bg-violet-500/20"
              >
                <LayoutDashboard className="h-4 w-4" />
                Admin dashboard
              </Link>

              <Link
                href="/Admin/BugTracker"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white/75 transition hover:bg-white/10 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to reports
              </Link>

              <div className="hidden h-8 w-px bg-white/10 sm:block" />

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.17em] text-white/35">
                  Reference
                </p>

                <button
                  type="button"
                  onClick={() => void copyBugId()}
                  className="mt-1 inline-flex items-center gap-2 font-mono text-xs font-black text-violet-200 hover:text-white"
                >
                  {displayReference}
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-black ${tone.border} ${tone.background} ${tone.text}`}>{normaliseLabel(bug.priority)}</span>
              <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-black ${statusTone(bug.status)}`}>{normaliseLabel(bug.status)}</span>
              <button onClick={() => void loadBug()} disabled={saving || deleting} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-bold transition hover:bg-white/10 disabled:opacity-50">
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
            </div>
          </div>
        </section>

        {error ? <DetailedErrorMessage error={error} /> : null}
        {successMessage ? (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-5 py-4 text-sm font-bold text-emerald-100">
            <CheckCircle2 className="h-5 w-5" /> {successMessage}
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-4">
            <Panel title="Bug investigation" description="Information supplied to help reproduce and diagnose the problem." icon={<Wrench className="h-5 w-5" />}>
              <div className="grid gap-3 md:grid-cols-2">
                <InfoBox label="Steps to reproduce" value={bug.steps_to_reproduce} />
                <InfoBox label="Expected result" value={bug.expected_result} />
                <InfoBox label="Actual result" value={bug.actual_result} />
                <InfoBox label="Error message" value={bug.error_message} />
              </div>
              <div className="mt-3">
                <InfoBox label="Error code" value={bug.error_code} mono />
              </div>
            </Panel>

            {bug.screenshot_url ? (
              <Panel title="Screenshot evidence" description="Image attached to the original report." icon={<FileText className="h-5 w-5" />}>
                <div className="flex justify-end">
                  <a href={bug.screenshot_url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-bold hover:bg-white/10">
                    Open full image <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={bug.screenshot_url} alt={`Screenshot for ${bug.title}`} className="mt-4 max-h-[720px] w-full rounded-xl border border-white/10 bg-black object-contain" />
              </Panel>
            ) : null}

            <Panel title="Admin management" description="Update progress, priority and internal technical notes." icon={<ShieldAlert className="h-5 w-5" />}>
              <div className="grid gap-4 md:grid-cols-2">
                <label>
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">Status</span>
                  <select value={status} onChange={(event) => setStatus(event.target.value as BugStatus)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-sm font-bold text-white outline-none focus:border-fuchsia-400/40 focus:ring-2 focus:ring-fuchsia-500/15">
                    {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value} className="bg-black text-white">{option.label}</option>)}
                  </select>
                </label>
                <label>
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">Priority</span>
                  <select value={priority} onChange={(event) => setPriority(event.target.value as BugPriority)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black px-3 text-sm font-bold text-white outline-none focus:border-fuchsia-400/40 focus:ring-2 focus:ring-fuchsia-500/15">
                    {PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value} className="bg-black text-white">{option.label}</option>)}
                  </select>
                </label>
              </div>

              <label className="mt-4 block">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">Internal admin notes</span>
                <textarea value={adminNotes} onChange={(event) => setAdminNotes(event.target.value)} rows={6} placeholder="Add technical findings, work completed or follow-up actions..." className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-[#222224] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/25 focus:border-fuchsia-400/40 focus:ring-2 focus:ring-fuchsia-500/15" />
              </label>

              <label className="mt-4 block">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">Resolution notes</span>
                <textarea value={resolutionNotes} onChange={(event) => setResolutionNotes(event.target.value)} rows={5} placeholder="Explain how the issue was fixed, tested or closed..." className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-[#222224] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/25 focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-500/15" />
              </label>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
                <button onClick={() => void deleteBug()} disabled={saving || deleting} className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-4 text-sm font-black text-red-100 hover:bg-red-500/20 disabled:opacity-50">
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {deleting ? "Deleting..." : "Delete report"}
                </button>
                <button onClick={() => void saveChanges()} disabled={saving || deleting} className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-5 text-sm font-black text-white shadow-lg shadow-fuchsia-950/30 hover:brightness-110 disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Saving changes..." : "Save changes"}
                </button>
              </div>
            </Panel>
          </div>

          <aside className="space-y-4">
            <Panel title="Report information" icon={<FileText className="h-5 w-5" />}>
              <SideRow icon={<UserRound className="h-4 w-4" />} label="Reported by" value={bug.reporter_name || bug.reporter_email} />
              <SideRow icon={<Mail className="h-4 w-4" />} label="Reporter email" value={bug.reporter_email} />
              <SideRow icon={<ShieldAlert className="h-4 w-4" />} label="Assigned to" value={bug.assigned_to_name || bug.assigned_to_email} />
              <SideRow icon={<CalendarDays className="h-4 w-4" />} label="Created" value={formatDate(bug.created_at)} />
              <SideRow icon={<Clock3 className="h-4 w-4" />} label="Last updated" value={formatDate(bug.updated_at)} />
              {bug.resolved_at ? <SideRow icon={<CheckCircle2 className="h-4 w-4" />} label="Resolved" value={formatDate(bug.resolved_at)} /> : null}
            </Panel>

            <Panel title="Technical environment" icon={<Monitor className="h-5 w-5" />}>
              <SideRow icon={<Bug className="h-4 w-4" />} label="Application" value={bug.app_name} />
              <SideRow icon={<ChevronRight className="h-4 w-4" />} label="Page" value={bug.page_name} />
              <SideRow icon={<Monitor className="h-4 w-4" />} label="Device" value={bug.device_type} />
              <SideRow icon={<Monitor className="h-4 w-4" />} label="Browser" value={bug.browser} />
              <SideRow icon={<Monitor className="h-4 w-4" />} label="Operating system" value={bug.operating_system} />
              {bug.page_url ? (
                <a href={bug.page_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/10 text-sm font-black text-violet-100 hover:bg-violet-500/20">
                  Open affected page <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
            </Panel>

            <section className="rounded-[22px] border border-amber-400/20 bg-amber-500/8 p-5 shadow-xl shadow-black/15">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-300" />
                <div>
                  <h2 className="text-sm font-black text-amber-100">Report reference</h2>
                  <p className="mt-2 break-all font-mono text-xs leading-6 text-amber-50/70">{bug.id}</p>
                  <button onClick={() => void copyBugId()} className="mt-3 inline-flex items-center gap-2 text-xs font-black text-amber-200 hover:text-white">
                    <Copy className="h-3.5 w-3.5" /> Copy full ID
                  </button>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
      </main>
    </>
  );
}
