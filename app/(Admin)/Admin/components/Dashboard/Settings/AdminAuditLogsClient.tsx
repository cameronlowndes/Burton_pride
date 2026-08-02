"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BadgeCheck,
  BellRing,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Clipboard,
  Clock,
  Copy,
  Database,
  Download,
  Eye,
  FileJson,
  Filter,
  Fingerprint,
  Globe2,
  Info,
  Layers3,
  ListFilter,
  Loader2,
  Lock,
  Monitor,
  Radio,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";

type RiskLevel = "low" | "medium" | "high" | "critical";

type AuditLog = {
  id: string;
  created_at: string;
  admin_email: string | null;
  admin_name: string | null;
  admin_role: string | null;
  action: string;
  area: string;
  route: string | null;
  method: string | null;
  status: string;
  risk_level: RiskLevel;
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
};

type ApiErrorResponse = {
  ok?: false;
  error?: string;
  code?: string;
  status?: number;
  hint?: string;
  suggestion?: string;
  details?: unknown;
  request_id?: string;
};

type ApiSuccessResponse = {
  ok: true;
  logs: AuditLog[];
  count?: number;
  table?: string;
  request_id?: string;
};

type DetailedError = {
  message: string;
  status?: number;
  code?: string;
  hint?: string;
  suggestion?: string;
  details?: string;
  requestId?: string;
};

type AuditReportInput = {
  action: string;
  area?: string;
  route?: string | null;
  method?: string;
  status?: string;
  risk_level?: RiskLevel;
  target_type?: string | null;
  target_id?: string | null;
  target_label?: string | null;
  metadata?: Record<string, unknown>;
};

type Toast = {
  id: string;
  tone: "success" | "error" | "info";
  message: string;
};

type SortKey =
  | "created_at"
  | "risk_level"
  | "admin_email"
  | "action"
  | "area"
  | "status";

type SortDirection = "asc" | "desc";
type ReviewMode = "all" | "security" | "stock_control" | "failed" | "my_activity";

const DEFAULT_LIMIT = "150";
const AUTO_REFRESH_MS = 30000;

const fallbackAreas = [
  "auth",
  "dashboard",
  "money",
  "email",
  "event_hub",
  "stock_control",
  "contacts",
  "admin_users",
  "audit_logs",
  "donations",
  "raffle",
  "site_pages",
  "admin_portal",
];

const fallbackStatuses = ["success", "failed", "blocked", "error", "unknown"];
const fallbackMethods = ["CLIENT", "GET", "POST", "PATCH", "PUT", "DELETE"];

const riskWeight: Record<RiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const riskClassNames: Record<RiskLevel, string> = {
  low: "border-emerald-300/25 bg-emerald-500/10 text-emerald-100",
  medium: "border-sky-300/25 bg-sky-500/10 text-sky-100",
  high: "border-amber-300/25 bg-amber-500/10 text-amber-100",
  critical: "border-red-300/30 bg-red-500/15 text-red-100",
};

const statusClassNames: Record<string, string> = {
  success: "border-emerald-300/20 bg-emerald-500/10 text-emerald-100",
  failed: "border-red-300/20 bg-red-500/10 text-red-100",
  blocked: "border-amber-300/20 bg-amber-500/10 text-amber-100",
  error: "border-red-300/25 bg-red-500/15 text-red-50",
  unknown: "border-white/10 bg-white/10 text-white/70",
};

const areaLabels: Record<string, string> = {
  auth: "Auth",
  dashboard: "Dashboard",
  money: "Money",
  email: "Email",
  event_hub: "Event Hub",
  stock_control: "Stock Control",
  contacts: "Contacts",
  admin_users: "Admin Users",
  audit_logs: "Audit Logs",
  donations: "Donations",
  raffle: "Raffle",
  site_pages: "Site Pages",
  admin_portal: "Admin Portal",
};

function normalise(value: unknown) {
  return String(value ?? "").trim();
}

function lower(value: unknown) {
  return normalise(value).toLowerCase();
}

function titleCase(value: unknown) {
  const text = normalise(value)
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .toLowerCase();

  if (!text) return "Unknown";

  return text.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getRisk(value: unknown): RiskLevel {
  const risk = lower(value);

  if (
    risk === "low" ||
    risk === "medium" ||
    risk === "high" ||
    risk === "critical"
  ) {
    return risk;
  }

  return "low";
}

function formatDateTime(value: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatShortDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatRelativeTime(value: string) {
  const date = new Date(value).getTime();

  if (!Number.isFinite(date)) return "Unknown time";

  const diffMs = Date.now() - date;
  const diffSeconds = Math.round(diffMs / 1000);
  const absSeconds = Math.abs(diffSeconds);

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
    ["second", 1],
  ];

  const formatter = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });

  for (const [unit, secondsInUnit] of units) {
    if (absSeconds >= secondsInUnit || unit === "second") {
      return formatter.format(Math.round(-diffSeconds / secondsInUnit), unit);
    }
  }

  return "Just now";
}

function stringifyDetails(value: unknown) {
  if (!value) return "";

  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function toCsvValue(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function getFallbackMessage(status: number) {
  if (status === 401) {
    return "You are not logged in, your admin session has expired, or the audit API could not find your admin account.";
  }

  if (status === 403) {
    return "Your admin account does not have permission to view audit logs.";
  }

  if (status === 404) {
    return "The audit log API route was not found.";
  }

  if (status >= 500) {
    return "The server failed while loading audit logs.";
  }

  return "Failed to load audit logs.";
}

function buildDetailedError(
  response: Response,
  json: ApiErrorResponse | null,
): DetailedError {
  const details = stringifyDetails(json?.details);

  return {
    message: json?.error || getFallbackMessage(response.status),
    status: json?.status || response.status,
    code: json?.code,
    hint: json?.hint,
    suggestion: json?.suggestion,
    details,
    requestId: json?.request_id,
  };
}

function getAreaLabel(area: unknown) {
  const key = lower(area);
  return areaLabels[key] || titleCase(key);
}

function getStatusClassName(status: unknown) {
  const key = lower(status) || "unknown";
  return statusClassNames[key] || statusClassNames.unknown;
}

function getActionLabel(action: unknown) {
  const key = lower(action);

  const labels: Record<string, string> = {
    stock_control_opened: "Opened Stock Control",
    stock_control_heartbeat: "Using Stock Control",
    stock_control_closed: "Closed Stock Control",
    stock_control_page_view: "Viewed Stock Control Page",
    stock_item_created: "Created Stock Item",
    stock_item_updated: "Updated Stock Item",
    stock_item_deleted: "Deleted Stock Item",
    stock_quantity_adjusted: "Adjusted Stock Quantity",
    stock_movement_recorded: "Recorded Stock Movement",
    stock_order_created: "Created Purchase Order",
    stock_order_updated: "Updated Purchase Order",
    stock_delivery_received: "Received Stock Delivery",
    stock_report_exported: "Exported Stock Report",
  };

  return labels[key] || titleCase(action);
}

function getAdminLabel(log: AuditLog) {
  return log.admin_name || log.admin_email || "Unknown admin";
}

function getAuditActivitySummary(log: AuditLog) {
  const action = lower(log.action);
  const admin = getAdminLabel(log);

  if (action === "stock_control_opened") {
    return `${admin} opened Stock Control`;
  }

  if (action === "stock_control_heartbeat") {
    return `${admin} is using Stock Control`;
  }

  if (action === "stock_control_closed") {
    return `${admin} left Stock Control`;
  }

  const metadataMessage = normalise(log.metadata?.message);

  if (metadataMessage) {
    return metadataMessage;
  }

  return getActionLabel(log.action);
}

function getIpLabel(ip: string | null) {
  return ip || "Unknown IP";
}

function getUserAgentSummary(userAgent: string | null) {
  const value = normalise(userAgent);

  if (!value) return "Unknown device";

  if (value.includes("Chrome")) return "Chrome / Chromium browser";
  if (value.includes("Firefox")) return "Firefox browser";
  if (value.includes("Safari") && !value.includes("Chrome")) {
    return "Safari browser";
  }
  if (value.includes("Edge")) return "Microsoft Edge browser";

  return value.length > 80 ? `${value.slice(0, 80)}...` : value;
}

function getSecurityMeaning(log: AuditLog) {
  const action = lower(log.action);
  const status = lower(log.status);
  const risk = getRisk(log.risk_level);

  if (risk === "critical") {
    return "Critical event. This should be reviewed urgently.";
  }

  if (risk === "high") {
    return "High-risk event. Check whether this was expected.";
  }

  if (action.includes("permission_denied")) {
    return "An admin tried to open a page they were not allowed to use.";
  }

  if (action.includes("login_invalid") || action.includes("not_matched")) {
    return "A login attempt failed because the details did not match.";
  }

  if (action.includes("lockout")) {
    return "The sign-in protection paused further attempts after repeated failures.";
  }

  if (status === "blocked") {
    return "The system blocked this action for security reasons.";
  }

  if (action === "stock_control_opened") {
    return `${getAdminLabel(log)} opened the Stock Control app.`;
  }

  if (action === "stock_control_heartbeat") {
    return `${getAdminLabel(log)} is actively using the Stock Control app.`;
  }

  if (action === "stock_control_closed") {
    return `${getAdminLabel(log)} closed or left the Stock Control app.`;
  }

  if (action.startsWith("stock_")) {
    return `Stock Control activity completed by ${getAdminLabel(log)}.`;
  }

  if (status === "error") {
    return "The system hit an error while processing this action.";
  }

  return "Normal admin activity record.";
}

function makeDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function redactAuditLog(log: AuditLog): AuditLog {
  return {
    ...log,
    ip_address: log.ip_address ? "REDACTED" : null,
    user_agent: log.user_agent ? "REDACTED" : null,
    metadata: log.metadata
      ? {
          ...log.metadata,
          client_ip:
            "client_ip" in log.metadata ? "REDACTED" : undefined,
          user_agent:
            "user_agent" in log.metadata ? "REDACTED" : undefined,
        }
      : null,
  };
}

function downloadCsv(logs: AuditLog[], redactSensitive = false) {
  const exportLogs = redactSensitive ? logs.map(redactAuditLog) : logs;
  const headers: Array<keyof AuditLog | "metadata_json"> = [
    "created_at",
    "admin_email",
    "admin_name",
    "admin_role",
    "action",
    "area",
    "route",
    "method",
    "status",
    "risk_level",
    "target_type",
    "target_id",
    "target_label",
    "ip_address",
    "user_agent",
    "metadata_json",
  ];

  const rows = exportLogs.map((log) =>
    headers
      .map((key) => {
        if (key === "metadata_json") return toCsvValue(stringifyDetails(log.metadata));
        return toCsvValue(log[key]);
      })
      .join(","),
  );

  const csv = [headers.join(","), ...rows].join("\n");
  makeDownload(
    `admin-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`,
    csv,
    "text/csv;charset=utf-8",
  );
}

function downloadJson(logs: AuditLog[], redactSensitive = false) {
  const exportLogs = redactSensitive ? logs.map(redactAuditLog) : logs;

  const json = JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      count: exportLogs.length,
      sensitive_fields_redacted: redactSensitive,
      logs: exportLogs,
    },
    null,
    2,
  );

  makeDownload(
    `admin-audit-logs-${new Date().toISOString().slice(0, 10)}.json`,
    json,
    "application/json;charset=utf-8",
  );
}

async function copyToClipboard(value: string) {
  if (!navigator.clipboard) {
    throw new Error("Clipboard is not available in this browser.");
  }

  await navigator.clipboard.writeText(value);
}

async function reportAuditEvent(input: AuditReportInput) {
  try {
    await fetch("/api/admin/audit-log/report", {
      method: "POST",
      cache: "no-store",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        area: "audit_logs",
        method: "CLIENT",
        status: "success",
        risk_level: "low",
        route: typeof window !== "undefined" ? window.location.pathname : null,
        ...input,
      }),
    });
  } catch {
    // Audit reporting must never break the audit page itself.
  }
}

function makeToastId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function StatCard({
  title,
  value,
  helper,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: string | number;
  helper: string;
  icon: typeof ShieldCheck;
  tone?: "default" | "green" | "amber" | "red" | "blue";
}) {
  const toneClass = {
    default: "border-white/10 bg-white/10",
    green: "border-emerald-300/20 bg-emerald-500/10",
    amber: "border-amber-300/20 bg-amber-500/10",
    red: "border-red-300/20 bg-red-500/10",
    blue: "border-sky-300/20 bg-sky-500/10",
  }[tone];

  return (
    <div className={["rounded-3xl border p-5 shadow-xl backdrop-blur-xl", toneClass].join(" ")}>      
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-white/50">
            {title}
          </p>
          <p className="mt-3 text-3xl font-black text-white">{value}</p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10">
          <Icon className="h-6 w-6 text-white/80" />
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-white/58">{helper}</p>
    </div>
  );
}

function Pill({
  children,
  className = "border-white/10 bg-white/10 text-white/75",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={["inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black uppercase tracking-wide", className].join(" ")}>      
      {children}
    </span>
  );
}

function RiskPill({ risk }: { risk: RiskLevel }) {
  return <Pill className={riskClassNames[risk] || riskClassNames.low}>{risk}</Pill>;
}

function StatusPill({ status }: { status: string }) {
  return <Pill className={getStatusClassName(status)}>{status || "unknown"}</Pill>;
}

function ErrorPanel({
  error,
  onRetry,
}: {
  error: DetailedError;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-3xl border border-red-300/25 bg-red-500/10 p-6 text-red-50 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-red-100" />

          <div>
            <p className="text-lg font-black">Could not load audit logs</p>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-red-50/85">
              {error.message}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {error.status ? (
                <Pill className="border-red-100/20 bg-red-950/30 text-red-50">
                  HTTP {error.status}
                </Pill>
              ) : null}

              {error.code ? (
                <Pill className="border-red-100/20 bg-red-950/30 text-red-50">
                  {error.code}
                </Pill>
              ) : null}

              {error.requestId ? (
                <Pill className="border-red-100/20 bg-red-950/30 text-red-50">
                  Request {error.requestId}
                </Pill>
              ) : null}
            </div>

            {error.suggestion ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-red-50/55">
                  What to do
                </p>
                <p className="mt-2 text-sm leading-6 text-red-50/85">
                  {error.suggestion}
                </p>
              </div>
            ) : null}

            {error.hint ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-red-50/55">
                  Technical hint
                </p>
                <p className="mt-2 text-sm leading-6 text-red-50/85">
                  {error.hint}
                </p>
              </div>
            ) : null}

            {error.details ? (
              <details className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
                <summary className="cursor-pointer text-sm font-black">
                  Show server details
                </summary>

                <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/30 p-3 text-xs leading-5 text-red-50/80">
                  {error.details}
                </pre>
              </details>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={onRetry}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-red-700 hover:bg-white/90"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-white/40">
        {label}
      </p>
      <div
        className={[
          "mt-2 break-words text-sm leading-6 text-white/82",
          mono ? "font-mono text-xs" : "font-semibold",
        ].join(" ")}
      >
        {value || "—"}
      </div>
    </div>
  );
}

function LogDetailDrawer({
  log,
  onClose,
  onToast,
}: {
  log: AuditLog | null;
  onClose: () => void;
  onToast: (toast: Omit<Toast, "id">) => void;
}) {
  if (!log) return null;

  const currentLog = log;
  const metadataJson = stringifyDetails(currentLog.metadata || {});
  const fullJson = stringifyDetails(currentLog);
  const risk = getRisk(currentLog.risk_level);

  async function handleCopyMetadata() {
    try {
      await copyToClipboard(metadataJson);
      onToast({ tone: "success", message: "Metadata copied." });
      void reportAuditEvent({
        action: "audit_log_metadata_copied",
        target_type: "audit_log",
        target_id: currentLog.id,
        target_label: currentLog.action,
        metadata: {
          copied_log_id: currentLog.id,
          copied_log_action: currentLog.action,
        },
      });
    } catch (error) {
      onToast({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not copy metadata.",
      });
    }
  }

  async function handleCopyLogJson() {
    try {
      await copyToClipboard(fullJson);
      onToast({ tone: "success", message: "Full log JSON copied." });
      void reportAuditEvent({
        action: "audit_log_json_copied",
        target_type: "audit_log",
        target_id: currentLog.id,
        target_label: currentLog.action,
        metadata: {
          copied_log_id: currentLog.id,
          copied_log_action: currentLog.action,
        },
      });
    } catch (error) {
      onToast({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Could not copy log JSON.",
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/55 p-3 backdrop-blur-sm lg:p-6">
      <button
        type="button"
        aria-label="Close log details"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />

      <aside className="relative flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#101827]/95 text-white shadow-2xl">
        <div className="border-b border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap gap-2">
                <RiskPill risk={risk} />
                <StatusPill status={log.status} />
                <Pill>{getAreaLabel(log.area)}</Pill>
              </div>

              <h2 className="mt-4 text-2xl font-black">
                {getAuditActivitySummary(log)}
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
                {getSecurityMeaning(log)}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl bg-white/10 p-3 text-white/70 hover:bg-white/20 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <DetailRow label="Time" value={formatDateTime(log.created_at)} />
            <DetailRow label="Relative time" value={formatRelativeTime(log.created_at)} />
            <DetailRow label="Admin" value={getAdminLabel(log)} />
            <DetailRow label="Admin email" value={log.admin_email || "—"} mono />
            <DetailRow label="Admin role" value={log.admin_role || "—"} />
            <DetailRow label="Area" value={getAreaLabel(log.area)} />
            <DetailRow label="Route" value={log.route || "—"} mono />
            <DetailRow label="Method" value={log.method || "—"} />
            <DetailRow label="IP address" value={getIpLabel(log.ip_address)} mono />
            <DetailRow
              label="Device summary"
              value={getUserAgentSummary(log.user_agent)}
            />
            <DetailRow label="Target type" value={log.target_type || "—"} />
            <DetailRow label="Target label" value={log.target_label || "—"} />
            <DetailRow label="Target ID" value={log.target_id || "—"} mono />
            <DetailRow label="Audit log ID" value={log.id} mono />
          </div>

          <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-white/40">
                  Metadata
                </p>
                <p className="mt-1 text-sm text-white/55">
                  Full extra event details saved with this audit record.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopyMetadata()}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-xs font-black text-white hover:bg-white/20"
                >
                  <Copy className="h-4 w-4" />
                  Copy metadata
                </button>

                <button
                  type="button"
                  onClick={() => void handleCopyLogJson()}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-xs font-black text-white hover:bg-white/20"
                >
                  <Clipboard className="h-4 w-4" />
                  Copy full JSON
                </button>
              </div>
            </div>

            <pre className="mt-4 max-h-[26rem] overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-black/30 p-4 text-xs leading-6 text-white/72">
              {metadataJson || "{}"}
            </pre>
          </div>
        </div>
      </aside>
    </div>
  );
}

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/10 p-8 text-center shadow-xl backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
        <Database className="h-7 w-7 text-white/65" />
      </div>
      <p className="mt-4 text-lg font-black">No audit logs found</p>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-white/60">
        {hasFilters
          ? "No logs match your current filters. Clear some filters or increase the load limit."
          : "Once login, page tracking or admin actions are recorded, they will show here."}
      </p>

      {hasFilters ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-purple-700 hover:bg-white/90"
        >
          <X className="h-4 w-4" />
          Clear filters
        </button>
      ) : null}
    </div>
  );
}

function Toasts({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[60] grid w-[min(24rem,calc(100vw-2rem))] gap-2">
      {toasts.map((toast) => {
        const className =
          toast.tone === "success"
            ? "border-emerald-300/25 bg-emerald-500/15 text-emerald-50"
            : toast.tone === "error"
              ? "border-red-300/25 bg-red-500/15 text-red-50"
              : "border-sky-300/25 bg-sky-500/15 text-sky-50";

        return (
          <div
            key={toast.id}
            className={[
              "flex items-start justify-between gap-3 rounded-2xl border p-4 text-sm font-bold shadow-2xl backdrop-blur-xl",
              className,
            ].join(" ")}
          >
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="rounded-lg p-1 opacity-70 hover:bg-white/10 hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminAuditLogsClient() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<DetailedError | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [sourceTable, setSourceTable] = useState<string | null>(null);
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [risk, setRisk] = useState("");
  const [area, setArea] = useState("");
  const [status, setStatus] = useState("");
  const [method, setMethod] = useState("");
  const [adminRole, setAdminRole] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [reviewMode, setReviewMode] = useState<ReviewMode>("all");
  const [redactSensitiveExports, setRedactSensitiveExports] = useState(true);

  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const tableMouseDownXRef = useRef(0);
  const tableScrollLeftRef = useRef(0);
  const tableIsDraggingRef = useRef(false);
  const tableDragMovedRef = useRef(false);
  const [tableIsDragging, setTableIsDragging] = useState(false);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = makeToastId();
    setToasts((current) => [...current, { id, ...toast }].slice(-4));

    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const loadLogs = useCallback(
    async (reason: "initial" | "refresh" | "auto" | "filter" = "refresh") => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.set("limit", limit);

        if (risk) params.set("risk", risk);
        if (area) params.set("area", area);

        const response = await fetch(`/api/admin/audit-log?${params.toString()}`, {
          cache: "no-store",
          credentials: "include",
        });

        const json = (await response.json().catch(() => null)) as
          | ApiSuccessResponse
          | ApiErrorResponse
          | null;

        if (!response.ok || !json || json.ok !== true) {
          throw buildDetailedError(response, json as ApiErrorResponse | null);
        }

        const safeLogs = Array.isArray(json.logs)
          ? json.logs.map((log) => ({
              ...log,
              risk_level: getRisk(log.risk_level),
            }))
          : [];

        setLogs(safeLogs);
        setSourceTable(json.table || null);
        setLastRequestId(json.request_id || null);
        setLastLoadedAt(new Date().toISOString());

        if (reason !== "auto") {
          void reportAuditEvent({
            action: "audit_logs_loaded",
            status: "success",
            risk_level: "low",
            metadata: {
              reason,
              loaded_count: safeLogs.length,
              api_count: json.count ?? safeLogs.length,
              source_table: json.table || null,
              request_id: json.request_id || null,
              filters: {
                limit,
                risk: risk || null,
                area: area || null,
                review_mode: reviewMode,
              },
            },
          });
        }
      } catch (err) {
        if (
          err &&
          typeof err === "object" &&
          "message" in err &&
          "status" in err
        ) {
          setError(err as DetailedError);
        } else {
          setError({
            message:
              err instanceof Error ? err.message : "Failed to load audit logs.",
            code: "CLIENT_FETCH_FAILED",
            suggestion:
              "Check that the API route exists at /api/admin/audit-log and that you are logged into the admin portal.",
          });
        }

        setLogs([]);

        void reportAuditEvent({
          action: "audit_logs_load_failed",
          status: "error",
          risk_level: "medium",
          metadata: {
            reason,
            error: err instanceof Error ? err.message : "Unknown client error",
            filters: {
              limit,
              risk: risk || null,
              area: area || null,
            },
          },
        });
      } finally {
        setLoading(false);
      }
    },
    [area, limit, risk],
  );

  useEffect(() => {
    void loadLogs("initial");
  }, [loadLogs]);

  useEffect(() => {
    if (!autoRefresh) return;

    const timer = window.setInterval(() => {
      void loadLogs("auto");
    }, AUTO_REFRESH_MS);

    return () => window.clearInterval(timer);
  }, [autoRefresh, loadLogs]);

  const areas = useMemo(() => {
    const values = new Set<string>(fallbackAreas);
    logs.forEach((log) => {
      if (log.area) values.add(log.area);
    });
    return Array.from(values).sort((a, b) => getAreaLabel(a).localeCompare(getAreaLabel(b)));
  }, [logs]);

  const statuses = useMemo(() => {
    const values = new Set<string>(fallbackStatuses);
    logs.forEach((log) => {
      if (log.status) values.add(log.status);
    });
    return Array.from(values).sort();
  }, [logs]);

  const methods = useMemo(() => {
    const values = new Set<string>(fallbackMethods);
    logs.forEach((log) => {
      if (log.method) values.add(log.method);
    });
    return Array.from(values).sort();
  }, [logs]);

  const adminRoles = useMemo(() => {
    const values = new Set<string>();
    logs.forEach((log) => {
      if (log.admin_role) values.add(log.admin_role);
    });
    return Array.from(values).sort();
  }, [logs]);

  const visibleLogs = useMemo(() => {
    const query = lower(search);
    const fromTime = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const toTime = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null;

    const filtered = logs.filter((log) => {
      const createdAt = new Date(log.created_at).getTime();
      const logArea = lower(log.area);
      const logAction = lower(log.action);
      const logStatus = lower(log.status);
      const logRisk = getRisk(log.risk_level);

      if (
        reviewMode === "security" &&
        !(
          logRisk === "high" ||
          logRisk === "critical" ||
          logStatus === "blocked" ||
          logStatus === "failed" ||
          logStatus === "error" ||
          logAction.includes("permission_denied") ||
          logAction.includes("login") ||
          logAction.includes("lockout")
        )
      ) {
        return false;
      }

      if (
        reviewMode === "stock_control" &&
        !(
          logArea === "stock_control" ||
          logAction.startsWith("stock_")
        )
      ) {
        return false;
      }

      if (
        reviewMode === "failed" &&
        !["failed", "blocked", "error"].includes(logStatus)
      ) {
        return false;
      }

      if (
        reviewMode === "my_activity" &&
        !Boolean(log.admin_email || log.admin_name)
      ) {
        return false;
      }

      if (query) {
        const haystack = [
          log.id,
          log.admin_email,
          log.admin_name,
          log.admin_role,
          log.action,
          log.area,
          log.route,
          log.method,
          log.status,
          log.risk_level,
          log.target_type,
          log.target_id,
          log.target_label,
          log.ip_address,
          log.user_agent,
          stringifyDetails(log.metadata),
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(query)) return false;
      }

      if (status && lower(log.status) !== lower(status)) return false;
      if (method && lower(log.method) !== lower(method)) return false;
      if (adminRole && lower(log.admin_role) !== lower(adminRole)) return false;
      if (fromTime && Number.isFinite(createdAt) && createdAt < fromTime) return false;
      if (toTime && Number.isFinite(createdAt) && createdAt > toTime) return false;

      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      let result = 0;

      if (sortKey === "created_at") {
        result = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortKey === "risk_level") {
        result = riskWeight[getRisk(a.risk_level)] - riskWeight[getRisk(b.risk_level)];
      } else {
        result = lower(a[sortKey]).localeCompare(lower(b[sortKey]));
      }

      return sortDirection === "asc" ? result : -result;
    });

    return sorted;
  }, [
    adminRole,
    fromDate,
    logs,
    method,
    reviewMode,
    search,
    sortDirection,
    sortKey,
    status,
    toDate,
  ]);

  const stats = useMemo(() => {
    const source = visibleLogs;
    const critical = source.filter((log) => getRisk(log.risk_level) === "critical").length;
    const high = source.filter((log) => getRisk(log.risk_level) === "high").length;
    const failedOrBlocked = source.filter((log) => {
      const itemStatus = lower(log.status);
      return itemStatus === "failed" || itemStatus === "blocked" || itemStatus === "error";
    }).length;
    const authEvents = source.filter((log) => lower(log.area) === "auth").length;
    const stockControlEvents = source.filter(
      (log) =>
        lower(log.area) === "stock_control" ||
        lower(log.action).startsWith("stock_"),
    ).length;
    const stockControlAdmins = new Set(
      source
        .filter(
          (log) =>
            lower(log.area) === "stock_control" ||
            lower(log.action).startsWith("stock_"),
        )
        .map((log) => lower(log.admin_email || log.admin_name))
        .filter(Boolean),
    ).size;
    const uniqueAdmins = new Set(source.map((log) => lower(log.admin_email)).filter(Boolean)).size;
    const uniqueIps = new Set(source.map((log) => lower(log.ip_address)).filter(Boolean)).size;

    const latestCriticalOrHigh = source.find((log) => {
      const riskLevel = getRisk(log.risk_level);
      return riskLevel === "critical" || riskLevel === "high";
    });

    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const activeStockAdmins = new Set(
      source
        .filter((log) => {
          const action = lower(log.action);
          const createdAt = new Date(log.created_at).getTime();

          return (
            (action === "stock_control_opened" ||
              action === "stock_control_heartbeat") &&
            Number.isFinite(createdAt) &&
            createdAt >= fiveMinutesAgo
          );
        })
        .map((log) => lower(log.admin_email || log.admin_name))
        .filter(Boolean),
    ).size;

    const securityScore = Math.max(
      0,
      100 -
        critical * 25 -
        high * 10 -
        failedOrBlocked * 3,
    );

    return {
      total: source.length,
      critical,
      high,
      criticalHigh: critical + high,
      failedOrBlocked,
      authEvents,
      stockControlEvents,
      stockControlAdmins,
      activeStockAdmins,
      securityScore,
      uniqueAdmins,
      uniqueIps,
      latestCriticalOrHigh,
    };
  }, [visibleLogs]);

  const hasFilters = Boolean(
    search ||
      risk ||
      area ||
      status ||
      method ||
      adminRole ||
      fromDate ||
      toDate ||
      limit !== DEFAULT_LIMIT ||
      reviewMode !== "all",
  );

  function clearFilters() {
    setSearch("");
    setRisk("");
    setArea("");
    setStatus("");
    setMethod("");
    setAdminRole("");
    setFromDate("");
    setToDate("");
    setLimit(DEFAULT_LIMIT);
    setReviewMode("all");

    void reportAuditEvent({
      action: "audit_logs_filters_cleared",
      status: "success",
      risk_level: "low",
    });
  }

  function changeServerFilter(next: { risk?: string; area?: string; limit?: string }) {
    if (typeof next.risk === "string") setRisk(next.risk);
    if (typeof next.area === "string") setArea(next.area);
    if (typeof next.limit === "string") setLimit(next.limit);

    void reportAuditEvent({
      action: "audit_logs_server_filter_changed",
      status: "success",
      risk_level: "low",
      metadata: next,
    });
  }

  function changeSort(nextSortKey: SortKey) {
    setSortKey((currentKey) => {
      if (currentKey === nextSortKey) {
        setSortDirection((currentDirection) =>
          currentDirection === "asc" ? "desc" : "asc",
        );
        return currentKey;
      }

      setSortDirection(nextSortKey === "created_at" ? "desc" : "asc");
      return nextSortKey;
    });
  }

  function openLog(log: AuditLog) {
    setSelectedLog(log);

    void reportAuditEvent({
      action: "audit_log_detail_opened",
      status: "success",
      risk_level: getRisk(log.risk_level),
      target_type: "audit_log",
      target_id: log.id,
      target_label: log.action,
      metadata: {
        opened_log_id: log.id,
        opened_log_action: log.action,
        opened_log_area: log.area,
        opened_log_risk: log.risk_level,
      },
    });
  }

  function closeLog() {
    setSelectedLog(null);
  }

  function handleCsvExport() {
    downloadCsv(visibleLogs, redactSensitiveExports);
    addToast({ tone: "success", message: `CSV exported with ${visibleLogs.length} logs.` });

    void reportAuditEvent({
      action: "audit_logs_exported_csv",
      status: "success",
      risk_level: "medium",
      metadata: {
        exported_count: visibleLogs.length,
        filters_active: hasFilters,
        sensitive_fields_redacted: redactSensitiveExports,
      },
    });
  }

  function handleJsonExport() {
    downloadJson(visibleLogs, redactSensitiveExports);
    addToast({ tone: "success", message: `JSON exported with ${visibleLogs.length} logs.` });

    void reportAuditEvent({
      action: "audit_logs_exported_json",
      status: "success",
      risk_level: "medium",
      metadata: {
        exported_count: visibleLogs.length,
        filters_active: hasFilters,
        sensitive_fields_redacted: redactSensitiveExports,
      },
    });
  }

  async function handleCopyVisibleIds() {
    try {
      const ids = visibleLogs.map((log) => log.id).join("\n");
      await copyToClipboard(ids);
      addToast({ tone: "success", message: "Visible audit log IDs copied." });

      void reportAuditEvent({
        action: "audit_log_ids_copied",
        status: "success",
        risk_level: "low",
        metadata: {
          copied_count: visibleLogs.length,
        },
      });
    } catch (error) {
      addToast({
        tone: "error",
        message: error instanceof Error ? error.message : "Could not copy IDs.",
      });
    }
  }

  function handleTableMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    if (event.button !== 0) return;

    const target = event.target as HTMLElement | null;

    /**
     * Keep normal buttons/inputs working.
     * The drag-scroll starts from table rows/cells only.
     */
    if (
      target?.closest(
        "button, a, input, select, textarea, summary, [role='button']",
      )
    ) {
      return;
    }

    const container = tableScrollRef.current;

    if (!container) return;

    tableIsDraggingRef.current = true;
    tableDragMovedRef.current = false;
    tableMouseDownXRef.current = event.clientX;
    tableScrollLeftRef.current = container.scrollLeft;
    setTableIsDragging(true);
  }

  function handleTableMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (!tableIsDraggingRef.current) return;

    const container = tableScrollRef.current;

    if (!container) return;

    const moveX = event.clientX - tableMouseDownXRef.current;

    if (Math.abs(moveX) > 4) {
      tableDragMovedRef.current = true;
    }

    container.scrollLeft = tableScrollLeftRef.current - moveX;

    if (tableDragMovedRef.current) {
      event.preventDefault();
    }
  }

  function stopTableMouseDrag() {
    if (!tableIsDraggingRef.current) return;

    tableIsDraggingRef.current = false;
    setTableIsDragging(false);

    /**
     * Keep this flag until after the browser fires the click event.
     * That stops a dragged row accidentally opening the detail drawer.
     */
    window.setTimeout(() => {
      tableDragMovedRef.current = false;
    }, 0);
  }

  function handleTableClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    if (!tableDragMovedRef.current) return;

    event.preventDefault();
    event.stopPropagation();
    tableDragMovedRef.current = false;
  }

  function handleTableWheel(event: React.WheelEvent<HTMLDivElement>) {
    const container = tableScrollRef.current;

    if (!container) return;

    /**
     * Hold Shift and use the mouse wheel to move sideways.
     * Normal wheel scrolling still moves the page up/down.
     */
    if (!event.shiftKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
      return;
    }

    event.preventDefault();
    container.scrollLeft += event.deltaY;
  }

  const sortLabel = `${titleCase(sortKey)} ${sortDirection.toUpperCase()}`;

  return (
    <main className="min-h-screen w-full max-w-none overflow-x-visible text-white">
      <Toasts toasts={toasts} removeToast={removeToast} />
      <LogDetailDrawer log={selectedLog} onClose={closeLog} onToast={addToast} />

      <div className="mb-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 shadow-2xl backdrop-blur-xl">
        <div className="relative p-6 lg:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(236,72,153,0.2),transparent_30%),radial-gradient(circle_at_85%_10%,rgba(59,130,246,0.18),transparent_32%)]" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-white/65">
                <ShieldCheck className="h-4 w-4" />
                Admin security centre
              </div>

              <h1 className="mt-4 text-3xl font-black lg:text-4xl">
                Admin Portal Audit Logs
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">
                Review login attempts, lockouts, permission denials, page views,
                Stock Control usage, exports and sensitive admin actions across
                Burton Pride admin apps. The Stock Control records show which
                administrator opened or used the app.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <Pill className="border-white/10 bg-black/20 text-white/65">
                  Loaded: {lastLoadedAt ? formatRelativeTime(lastLoadedAt) : "not yet"}
                </Pill>
                {sourceTable ? (
                  <Pill className="border-white/10 bg-black/20 text-white/65">
                    Table: {sourceTable}
                  </Pill>
                ) : null}
                {lastRequestId ? (
                  <Pill className="border-white/10 bg-black/20 text-white/65">
                    Request: {lastRequestId.slice(0, 8)}...
                  </Pill>
                ) : null}
                <Pill className="border-white/10 bg-black/20 text-white/65">
                  Sort: {sortLabel}
                </Pill>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  void loadLogs("refresh");
                  void reportAuditEvent({
                    action: "audit_logs_manual_refresh_clicked",
                    status: "success",
                    risk_level: "low",
                  });
                }}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                Refresh
              </button>

              <button
                type="button"
                onClick={handleCsvExport}
                disabled={visibleLogs.length === 0}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-purple-700 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>

              <button
                type="button"
                onClick={handleJsonExport}
                disabled={visibleLogs.length === 0}
                className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileJson className="h-4 w-4" />
                Export JSON
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        <StatCard
          title="Visible logs"
          value={stats.total}
          helper={`${logs.length} loaded from the server before local filters.`}
          icon={Activity}
          tone="blue"
        />
        <StatCard
          title="High security risk"
          value={stats.criticalHigh}
          helper={`${stats.critical} critical and ${stats.high} high-risk records visible.`}
          icon={ShieldAlert}
          tone={stats.criticalHigh > 0 ? "red" : "green"}
        />
        <StatCard
          title="Failed / blocked"
          value={stats.failedOrBlocked}
          helper="Failed, blocked or error statuses in the current result set."
          icon={ShieldX}
          tone={stats.failedOrBlocked > 0 ? "amber" : "green"}
        />
        <StatCard
          title="Stock Control use"
          value={stats.stockControlEvents}
          helper={`${stats.stockControlAdmins} admin${
            stats.stockControlAdmins === 1 ? "" : "s"
          } used Stock Control in the visible records.`}
          icon={Database}
          tone="blue"
        />
        <StatCard
          title="Security health"
          value={`${stats.securityScore}%`}
          helper="Calculated from visible critical, high-risk, blocked and failed activity."
          icon={BadgeCheck}
          tone={
            stats.securityScore >= 90
              ? "green"
              : stats.securityScore >= 70
                ? "amber"
                : "red"
          }
        />
        <StatCard
          title="Stock admins online"
          value={stats.activeStockAdmins}
          helper="Admins with a Stock Control open or heartbeat event in the last five minutes."
          icon={Radio}
          tone={stats.activeStockAdmins > 0 ? "green" : "default"}
        />
        <StatCard
          title="Unique admins / IPs"
          value={`${stats.uniqueAdmins} / ${stats.uniqueIps}`}
          helper={`${stats.authEvents} authentication-related records are visible.`}
          icon={Fingerprint}
          tone="default"
        />
      </div>

      {stats.latestCriticalOrHigh ? (
        <div className="mb-6 rounded-3xl border border-amber-300/20 bg-amber-500/10 p-5 shadow-xl backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-3">
              <BellRing className="mt-1 h-6 w-6 shrink-0 text-amber-100" />
              <div>
                <p className="font-black text-amber-50">Security attention needed</p>
                <p className="mt-1 text-sm leading-6 text-amber-50/75">
                  Latest visible high-risk record: {getActionLabel(stats.latestCriticalOrHigh.action)} by {getAdminLabel(stats.latestCriticalOrHigh)} {formatRelativeTime(stats.latestCriticalOrHigh.created_at)}.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => openLog(stats.latestCriticalOrHigh!)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-100 px-4 py-3 text-sm font-black text-amber-950 hover:bg-amber-50"
            >
              <Eye className="h-4 w-4" />
              Review log
            </button>
          </div>
        </div>
      ) : null}

      <section className="mb-6 rounded-[2rem] border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
        <div className="mb-5 rounded-3xl border border-white/10 bg-black/20 p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-white/55">
                <BookOpenCheck className="h-4 w-4" />
                Review workspace
              </div>
              <p className="mt-2 text-sm leading-6 text-white/55">
                Switch between all activity, security incidents, Stock Control,
                unsuccessful actions and administrator-focused review.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                ["all", "All activity"],
                ["security", "Security review"],
                ["stock_control", "Stock Control"],
                ["failed", "Failed / blocked"],
                ["my_activity", "Admin activity"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setReviewMode(value as ReviewMode)}
                  className={[
                    "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-black transition",
                    reviewMode === value
                      ? "bg-white text-purple-700"
                      : "bg-white/10 text-white hover:bg-white/20",
                  ].join(" ")}
                >
                  <ListFilter className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-white/55">
              <Filter className="h-4 w-4" />
              Filters and review tools
            </div>
            <p className="mt-2 text-sm text-white/55">
              Server filters reload data. Search, date, status, method and role filters apply locally to the loaded logs.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setAutoRefresh((value) => !value);
                void reportAuditEvent({
                  action: autoRefresh
                    ? "audit_logs_auto_refresh_disabled"
                    : "audit_logs_auto_refresh_enabled",
                  status: "success",
                  risk_level: "low",
                });
              }}
              className={[
                "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-black",
                autoRefresh
                  ? "bg-emerald-400 text-emerald-950"
                  : "bg-white/10 text-white hover:bg-white/20",
              ].join(" ")}
            >
              <RefreshCw className={autoRefresh ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Auto refresh {autoRefresh ? "on" : "off"}
            </button>

            <button
              type="button"
              onClick={() => void handleCopyVisibleIds()}
              disabled={visibleLogs.length === 0}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-xs font-black text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Copy className="h-4 w-4" />
              Copy IDs
            </button>

            <button
              type="button"
              onClick={() => setRedactSensitiveExports((value) => !value)}
              className={[
                "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-black",
                redactSensitiveExports
                  ? "bg-sky-400 text-sky-950"
                  : "bg-white/10 text-white hover:bg-white/20",
              ].join(" ")}
              title="When enabled, exported IP addresses and user-agent details are redacted."
            >
              <SlidersHorizontal className="h-4 w-4" />
              Safe exports {redactSensitiveExports ? "on" : "off"}
            </button>

            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasFilters}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-xs font-black text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              Clear filters
            </button>
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-[1.3fr_repeat(4,0.7fr)]">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <Search className="h-4 w-4 text-white/50" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onBlur={() => {
                if (!search.trim()) return;
                void reportAuditEvent({
                  action: "audit_logs_search_used",
                  status: "success",
                  risk_level: "low",
                  metadata: {
                    query_length: search.trim().length,
                  },
                });
              }}
              placeholder="Search admin, action, route, IP, metadata..."
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/35"
            />
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <ShieldAlert className="h-4 w-4 text-white/50" />
            <select
              value={risk}
              onChange={(event) => changeServerFilter({ risk: event.target.value })}
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none"
            >
              <option className="text-slate-950" value="">All risk</option>
              <option className="text-slate-950" value="low">Low</option>
              <option className="text-slate-950" value="medium">Medium</option>
              <option className="text-slate-950" value="high">High</option>
              <option className="text-slate-950" value="critical">Critical</option>
            </select>
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <Layers3 className="h-4 w-4 text-white/50" />
            <select
              value={area}
              onChange={(event) => changeServerFilter({ area: event.target.value })}
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none"
            >
              <option className="text-slate-950" value="">All areas</option>
              {areas.map((item) => (
                <option key={item} className="text-slate-950" value={item}>
                  {getAreaLabel(item)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <Database className="h-4 w-4 text-white/50" />
            <select
              value={limit}
              onChange={(event) => changeServerFilter({ limit: event.target.value })}
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none"
            >
              <option className="text-slate-950" value="50">Last 50</option>
              <option className="text-slate-950" value="150">Last 150</option>
              <option className="text-slate-950" value="300">Last 300</option>
              <option className="text-slate-950" value="500">Last 500</option>
            </select>
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <CheckCircle2 className="h-4 w-4 text-white/50" />
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none"
            >
              <option className="text-slate-950" value="">All statuses</option>
              {statuses.map((item) => (
                <option key={item} className="text-slate-950" value={item}>
                  {titleCase(item)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-4">
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <Monitor className="h-4 w-4 text-white/50" />
            <select
              value={method}
              onChange={(event) => setMethod(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none"
            >
              <option className="text-slate-950" value="">All methods</option>
              {methods.map((item) => (
                <option key={item} className="text-slate-950" value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <UserRound className="h-4 w-4 text-white/50" />
            <select
              value={adminRole}
              onChange={(event) => setAdminRole(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none"
            >
              <option className="text-slate-950" value="">All roles</option>
              {adminRoles.map((item) => (
                <option key={item} className="text-slate-950" value={item}>
                  {titleCase(item)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <CalendarDays className="h-4 w-4 text-white/50" />
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none [color-scheme:dark]"
            />
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <CalendarDays className="h-4 w-4 text-white/50" />
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none [color-scheme:dark]"
            />
          </label>
        </div>

        {hasFilters ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {reviewMode !== "all" ? (
              <Pill>Review: {titleCase(reviewMode)}</Pill>
            ) : null}
            {search ? <Pill>Search active</Pill> : null}
            {risk ? <RiskPill risk={getRisk(risk)} /> : null}
            {area ? <Pill>{getAreaLabel(area)}</Pill> : null}
            {status ? <StatusPill status={status} /> : null}
            {method ? <Pill>{method}</Pill> : null}
            {adminRole ? <Pill>{titleCase(adminRole)}</Pill> : null}
            {fromDate ? <Pill>From {fromDate}</Pill> : null}
            {toDate ? <Pill>To {toDate}</Pill> : null}
          </div>
        ) : null}
      </section>

      {loading ? (
        <div className="rounded-3xl border border-white/10 bg-white/10 p-8 text-center shadow-xl backdrop-blur-xl">
          <Loader2 className="mx-auto h-8 w-8 animate-spin" />
          <p className="mt-3 font-black">Loading audit logs...</p>
          <p className="mt-2 text-sm text-white/55">
            Checking your admin access and loading the latest security records.
          </p>
        </div>
      ) : error ? (
        <ErrorPanel error={error} onRetry={() => void loadLogs("refresh")} />
      ) : visibleLogs.length === 0 ? (
        <EmptyState hasFilters={hasFilters} onClear={clearFilters} />
      ) : (
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/10 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-3 border-b border-white/10 bg-black/15 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-black">
                Showing {visibleLogs.length} of {logs.length} loaded audit logs
              </p>
              <p className="mt-1 text-xs text-white/50">
                Click any row to open details. Drag the table sideways with your mouse, or hold Shift and use the mouse wheel.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => changeSort("created_at")}
                className="rounded-2xl bg-white/10 px-3 py-2 text-xs font-black text-white hover:bg-white/20"
              >
                Sort time
              </button>
              <button
                type="button"
                onClick={() => changeSort("risk_level")}
                className="rounded-2xl bg-white/10 px-3 py-2 text-xs font-black text-white hover:bg-white/20"
              >
                Sort risk
              </button>
              <button
                type="button"
                onClick={() => changeSort("status")}
                className="rounded-2xl bg-white/10 px-3 py-2 text-xs font-black text-white hover:bg-white/20"
              >
                Sort status
              </button>
            </div>
          </div>

          <div
            ref={tableScrollRef}
            onClickCapture={handleTableClickCapture}
            onMouseDown={handleTableMouseDown}
            onMouseMove={handleTableMouseMove}
            onMouseUp={stopTableMouseDrag}
            onMouseLeave={stopTableMouseDrag}
            onWheel={handleTableWheel}
            className={[
              "overflow-x-auto overscroll-x-contain rounded-b-3xl [scrollbar-color:rgba(255,255,255,0.38)_rgba(255,255,255,0.08)] [scrollbar-width:thin]",
              tableIsDragging ? "cursor-grabbing select-none" : "cursor-grab",
            ].join(" ")}
          >
            <table className="w-full min-w-[1500px] table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[145px]" />
                <col className="w-[275px]" />
                <col className="w-[250px]" />
                <col className="w-[140px]" />
                <col className="w-[330px]" />
                <col className="w-[130px]" />
                <col className="w-[115px]" />
                <col className="w-[215px]" />
              </colgroup>
              <thead className="border-b border-white/10 bg-black/20 text-xs uppercase tracking-[0.16em] text-white/55">
                <tr>
                  <th className="px-5 py-4">
                    <button type="button" onClick={() => changeSort("created_at")}>
                      Time
                    </button>
                  </th>
                  <th className="px-5 py-4">
                    <button type="button" onClick={() => changeSort("admin_email")}>
                      Admin
                    </button>
                  </th>
                  <th className="px-5 py-4">
                    <button type="button" onClick={() => changeSort("action")}>
                      Action
                    </button>
                  </th>
                  <th className="px-5 py-4">
                    <button type="button" onClick={() => changeSort("area")}>
                      Area
                    </button>
                  </th>
                  <th className="px-5 py-4">Route / Target</th>
                  <th className="px-5 py-4">
                    <button type="button" onClick={() => changeSort("status")}>
                      Status
                    </button>
                  </th>
                  <th className="px-5 py-4">
                    <button type="button" onClick={() => changeSort("risk_level")}>
                      Risk
                    </button>
                  </th>
                  <th className="px-5 py-4">IP / Device</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {visibleLogs.map((log) => {
                  const riskLevel = getRisk(log.risk_level);
                  const isDanger = riskLevel === "critical" || riskLevel === "high";

                  return (
                    <tr
                      key={log.id}
                      onClick={() => openLog(log)}
                      className={[
                        "cursor-pointer align-top transition hover:bg-white/[0.06]",
                        isDanger ? "bg-red-500/[0.035]" : "",
                      ].join(" ")}
                    >
                      <td className="whitespace-nowrap px-5 py-5 text-white/75">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-white/35" />
                          <div>
                            <div className="font-bold">{formatShortDate(log.created_at)}</div>
                            <div className="mt-1 text-xs text-white/40">
                              {formatRelativeTime(log.created_at)}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-5">
                        <div className="truncate font-black text-white" title={getAdminLabel(log)}>
                          {getAdminLabel(log)}
                        </div>
                        {log.admin_email ? (
                          <div className="mt-1 max-w-[15rem] truncate text-xs text-white/45" title={log.admin_email || undefined}>
                            {log.admin_email}
                          </div>
                        ) : null}
                        {log.admin_role ? (
                          <div className="mt-1 text-xs font-bold text-white/35">
                            {titleCase(log.admin_role)}
                          </div>
                        ) : null}
                      </td>

                      <td className="px-5 py-5">
                        <div className="max-w-[220px] font-black leading-5 text-white">
                          {getAuditActivitySummary(log)}
                        </div>
                        <div className="mt-1 max-w-xs text-xs leading-5 text-white/45">
                          {getSecurityMeaning(log)}
                        </div>
                      </td>

                      <td className="px-5 py-5 text-white/75">
                        <Pill>{getAreaLabel(log.area)}</Pill>
                      </td>

                      <td className="px-5 py-5">
                        <div className="max-w-[300px] overflow-hidden text-ellipsis break-words text-xs leading-5 text-white/65" title={log.route || log.target_label || ""}>
                          {log.method ? (
                            <span className="mr-2 rounded-lg bg-white/10 px-2 py-1 font-black text-white/70">
                              {log.method}
                            </span>
                          ) : null}
                          {log.route || log.target_label || "—"}
                        </div>
                        {log.target_type || log.target_id ? (
                          <div className="mt-2 text-xs text-white/35">
                            {log.target_type || "target"}: {log.target_id || log.target_label || "—"}
                          </div>
                        ) : null}
                      </td>

                      <td className="px-5 py-5">
                        <StatusPill status={log.status} />
                      </td>

                      <td className="px-5 py-5">
                        <RiskPill risk={riskLevel} />
                      </td>

                      <td className="px-5 py-5 text-xs text-white/55">
                        <div className="flex items-center gap-2">
                          <Globe2 className="h-4 w-4 text-white/35" />
                          <span>{getIpLabel(log.ip_address)}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-white/35">
                          <Monitor className="h-4 w-4" />
                          <span className="max-w-[12rem] truncate" title={getUserAgentSummary(log.user_agent)}>
                            {getUserAgentSummary(log.user_agent)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.06] p-5 text-sm leading-6 text-white/55">
        <div className="flex gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-white/50" />
          <p>
            Security note: exports and detailed log views are themselves reported
            back into the audit system. Safe exports are enabled by default and
            redact IP addresses and browser details. Only disable redaction when
            an authorised security investigation genuinely requires those fields.
          </p>
        </div>
      </div>
    </main>
  );
}
