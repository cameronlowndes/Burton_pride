"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import CreateLotteryModal from "../Lotteries/CreateLotteryModal";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bug,
  Check,
  ChevronRight,
  CircleDollarSign,
  FileClock,
  FileText,
  Gift,
  History,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trophy,
  Users,
  WalletCards,
  X,
} from "lucide-react";

type DashboardSummary = {
  totalActiveLotteries: number | null;
  liveLotterySalesPence: number | null;
  grossTicketProceedsPence: number | null;
  paidEntries: number | null;
  ticketsIssued: number | null;
  pendingOrFailedPayments: number | null;
  unclaimedPrizes: number | null;
  complianceWarnings: number | null;
};

type UpcomingItem = {
  id: string;
  lotteryId: string;
  title: string;
  slug: string;
  kind: "sales_close" | "draw";
  dateTime: string;
  status?: string;
};

type ComplianceWarning = {
  id: string;
  lotteryId?: string | null;
  lotteryTitle?: string | null;
  severity: "info" | "warning" | "critical";
  message: string;
  createdAt?: string | null;
};

type RecentActivity = {
  id: string;
  actionLabel: string;
  adminName?: string | null;
  adminEmail?: string | null;
  lotteryTitle?: string | null;
  createdAt: string;
};

type AuditLogsResponse = {
  logs?: unknown;
  error?: string;
};

type DashboardResponse = {
  ok?: boolean;
  success?: boolean;
  dashboard?: unknown;
  data?: unknown;
  stats?: unknown;
  summary?: unknown;
  upcoming?: unknown;
  upcomingSalesClosingDates?: unknown;
  upcomingSalesClosings?: unknown;
  upcoming_sales_closing_dates?: unknown;
  upcomingDraws?: unknown;
  upcoming_draws?: unknown;
  complianceWarnings?: unknown;
  warningItems?: unknown;
  warnings?: unknown;
  recentActivity?: unknown;
  recent_activity?: unknown;
  error?: string;
  details?: string;
};

const EMPTY_SUMMARY: DashboardSummary = {
  totalActiveLotteries: null,
  liveLotterySalesPence: null,
  grossTicketProceedsPence: null,
  paidEntries: null,
  ticketsIssued: null,
  pendingOrFailedPayments: null,
  unclaimedPrizes: null,
  complianceWarnings: null,
};

const DASHBOARD_API_ROUTE = "/api/admin/lotterymanagement/dashboard";
const AUDIT_LOGS_API_ROUTE = "/api/admin/lotterymanagement/audit-logs";
const DEVELOPMENT_REQUESTS_API_ROUTE = "/api/admin/developmentrequests";

/**
 * Review dependencies: the API must derive accurate paid-order/entry metrics,
 * enforce verified sessions and dataset-specific permissions, and use bounded
 * aggregate queries rather than loading whole tables. UI totals do not prove
 * payment/ticket eligibility, draw readiness, or compliance approval.
 * Audit activity is loaded only from its own authorised endpoint. No fallback
 * to dashboard data when audit access is denied. Mutations, audit/outbox writes,
 * 2FA, CSRF, rate limits and idempotency belong on the server. Request forms here
 * retain the existing payload contracts and do not automatically retry POSTs.
 * Native priority selects retain platform-owned popup behaviour.
 */
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_LIST_ITEMS = 100;

async function readResponse(res: Response): Promise<UnknownRecord> {
  if (!res.body) throw new Error("Empty response.");
  if (Number(res.headers.get("Content-Length")) > MAX_RESPONSE_BYTES) {
    await res.body.cancel();
    throw new Error("Response too large.");
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("Response too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const value: unknown = JSON.parse(
    await new Blob(chunks as BlobPart[]).text(),
  );
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid response.");
  return value as UnknownRecord;
}

function safePageUrl(value: string) {
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol)) return "";
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value) && value.length > MAX_LIST_ITEMS)
    throw new Error("Too many dashboard records.");
  return Array.isArray(value) ? value : [];
}

function firstArray(...values: unknown[]) {
  for (const value of values) {
    if (Array.isArray(value)) return asArray(value);
  }

  return [];
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    if (
      typeof value !== "number" &&
      !(typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value.trim()))
    )
      continue;
    const number = Number(value);
    if (
      Number.isFinite(number) &&
      number >= 0 &&
      number <= Number.MAX_SAFE_INTEGER
    )
      return number;
  }

  return undefined;
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "";
}

function poundsToPence(value: unknown) {
  const amount = firstNumber(value);
  if (amount == null) return null;
  const result = Math.round(amount * 100);
  return Number.isSafeInteger(result) ? result : null;
}

function countValue(...values: unknown[]) {
  const value = firstNumber(...values);
  return value != null && Number.isSafeInteger(value) ? value : null;
}

function normaliseSummary(body: DashboardResponse): DashboardSummary {
  const dashboard = asRecord(body.dashboard || body.data);
  const stats = asRecord(body.stats || dashboard.stats);
  const summary = asRecord(body.summary || dashboard.summary);

  return {
    totalActiveLotteries:
      countValue(
        summary.totalActiveLotteries,
        summary.active_lotteries,
        stats.activeLotteries,
        dashboard.activeLotteries,
      ) ?? null,
    liveLotterySalesPence:
      countValue(
        summary.liveLotterySalesPence,
        summary.live_lottery_sales_pence,
      ) ??
      poundsToPence(
        firstNumber(
          summary.current_live_sales,
          stats.currentLiveSales,
          dashboard.currentLiveSales,
        ),
      ),
    grossTicketProceedsPence:
      countValue(
        summary.grossTicketProceedsPence,
        summary.gross_ticket_proceeds_pence,
      ) ??
      poundsToPence(
        firstNumber(
          summary.gross_ticket_proceeds,
          stats.grossTicketProceeds,
          dashboard.grossTicketProceeds,
          dashboard.totalRevenue,
        ),
      ),
    paidEntries:
      countValue(
        summary.paidEntries,
        summary.paid_entries,
        stats.paidEntries,
        dashboard.paidEntries,
      ) ?? null,
    ticketsIssued:
      countValue(
        summary.ticketsIssued,
        summary.tickets_issued,
        stats.ticketsIssued,
        dashboard.ticketsIssued,
      ) ?? null,
    pendingOrFailedPayments:
      countValue(
        summary.pendingOrFailedPayments,
        summary.pending_or_failed_payments,
        summary.payment_attention,
        stats.paymentAttention,
        dashboard.paymentAttention,
      ) ?? null,
    unclaimedPrizes:
      countValue(
        summary.unclaimedPrizes,
        summary.unclaimed_prizes,
        stats.unclaimedPrizes,
        dashboard.unclaimedPrizes,
      ) ?? null,
    complianceWarnings:
      countValue(
        summary.complianceWarnings,
        summary.compliance_warnings,
        stats.complianceWarnings,
        dashboard.complianceWarnings,
      ) ?? null,
  };
}

function normaliseUpcomingItem(
  value: unknown,
  kind: "sales_close" | "draw",
): UpcomingItem | null {
  const item = asRecord(value);
  const lotteryId = firstText(item.lotteryId, item.lottery_id, item.id);
  const dateTime =
    kind === "sales_close"
      ? firstText(item.dateTime, item.sales_close_at, item.ends_at)
      : firstText(item.dateTime, item.draw_at, item.scheduled_at);

  if (!lotteryId || !dateTime || !Number.isFinite(Date.parse(dateTime)))
    return null;

  return {
    id: firstText(item.id, item.draw_id) || `${kind}-${lotteryId}-${dateTime}`,
    lotteryId,
    title:
      firstText(item.title, item.lotteryTitle, item.lottery_title) ||
      "Untitled lottery",
    slug: firstText(item.slug, item.lottery_slug),
    kind,
    dateTime,
    status: firstText(item.status) || undefined,
  };
}

function normaliseUpcoming(body: DashboardResponse) {
  const dashboard = asRecord(body.dashboard || body.data);
  const legacyUpcoming = asArray(body.upcoming || dashboard.upcoming);

  if (legacyUpcoming.length > 0) {
    return legacyUpcoming
      .map((value) => {
        const item = asRecord(value);
        const kind = item.kind === "draw" ? "draw" : "sales_close";
        return normaliseUpcomingItem(value, kind);
      })
      .filter((item): item is UpcomingItem => Boolean(item));
  }

  const closingRows = firstArray(
    body.upcomingSalesClosingDates,
    body.upcomingSalesClosings,
    body.upcoming_sales_closing_dates,
    dashboard.upcomingSalesClosingDates,
    dashboard.upcomingSalesClosings,
  );
  const drawRows = firstArray(
    body.upcomingDraws,
    body.upcoming_draws,
    dashboard.upcomingDraws,
  );

  return [
    ...closingRows.map((item) => normaliseUpcomingItem(item, "sales_close")),
    ...drawRows.map((item) => normaliseUpcomingItem(item, "draw")),
  ].filter((item): item is UpcomingItem => Boolean(item));
}

function normaliseSeverity(value: unknown): ComplianceWarning["severity"] {
  const severity = firstText(value).toLowerCase();

  if (["critical", "high", "error", "blocker"].includes(severity)) {
    return "critical";
  }

  if (["warning", "warn", "medium"].includes(severity)) {
    return "warning";
  }

  return ["info", "low"].includes(severity) ? "info" : "warning";
}

function normaliseWarnings(body: DashboardResponse) {
  const dashboard = asRecord(body.dashboard || body.data);
  const rows = firstArray(
    body.complianceWarnings,
    body.warningItems,
    body.warnings,
    dashboard.warningItems,
    dashboard.warnings,
  );

  return rows.map((value, index): ComplianceWarning => {
    const item = asRecord(value);

    return {
      id: firstText(item.id) || `warning-${index}`,
      lotteryId: firstText(item.lotteryId, item.lottery_id) || null,
      lotteryTitle: firstText(item.lotteryTitle, item.lottery_title) || null,
      severity: normaliseSeverity(item.severity),
      message:
        firstText(item.message, item.title, item.warning_code) ||
        "Lottery compliance warning",
      createdAt: firstText(item.createdAt, item.created_at) || null,
    };
  });
}

function normaliseAuditActivity(body: AuditLogsResponse) {
  return asArray(body.logs).map((value, index): RecentActivity => {
    const item = asRecord(value);

    return {
      id: firstText(item.id) || `audit-activity-${index}`,
      actionLabel:
        firstText(item.action_label, item.actionLabel, item.action_code) ||
        "Lottery change",
      adminName: firstText(item.admin_name, item.adminName) || null,
      adminEmail: firstText(item.admin_email, item.adminEmail) || null,
      lotteryTitle: firstText(item.lottery_title, item.lotteryTitle) || null,
      createdAt: firstText(item.created_at, item.createdAt) || "",
    };
  });
}

function formatMoney(pence: number | null) {
  if (pence == null || !Number.isSafeInteger(pence)) return "Unavailable";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100);
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(date);
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  warning = false,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  warning?: boolean;
}) {
  return (
    <div
      className={`
        rounded-3xl
        border
        p-5
        shadow-xl
        backdrop-blur-xl
        ${
          warning
            ? "border-amber-500/20 bg-amber-500/[0.07]"
            : "border-white/10 bg-white/[0.04]"
        }
      `}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-white/55">{title}</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-white">
            {value}
          </p>
          <p className="mt-2 text-xs leading-5 text-white/40">{description}</p>
        </div>

        <div
          className={`
            flex
            h-11
            w-11
            shrink-0
            items-center
            justify-center
            rounded-2xl
            ${
              warning
                ? "bg-amber-500/15 text-amber-200"
                : "bg-purple-500/15 text-purple-200"
            }
          `}
        >
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur-xl sm:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-white">{title}</h2>
          {description && (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">
              {description}
            </p>
          )}
        </div>

        {action}
      </div>

      {children}
    </section>
  );
}

export default function LotteryManagementDashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [upcoming, setUpcoming] = useState<UpcomingItem[]>([]);
  const [warnings, setWarnings] = useState<ComplianceWarning[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const bugRequestRef = useRef<AbortController | null>(null);
  const featureRequestRef = useRef<AbortController | null>(null);
  const bugBusyRef = useRef(false);
  const featureBusyRef = useRef(false);
  const bugTriggerRef = useRef<HTMLButtonElement | null>(null);
  const featureTriggerRef = useRef<HTMLButtonElement | null>(null);
  const bugFormRef = useRef<HTMLFormElement>(null);
  const featureFormRef = useRef<HTMLFormElement>(null);

  const [createOpen, setCreateOpen] = useState(false);

  const [bugReportOpen, setBugReportOpen] = useState(false);
  const [bugSubmitting, setBugSubmitting] = useState(false);
  const [bugError, setBugError] = useState<string | null>(null);
  const [bugSuccess, setBugSuccess] = useState<{
    reference: string;
    message: string;
    emailSent: boolean;
  } | null>(null);
  const [bugForm, setBugForm] = useState({
    priority: "normal",
    title: "",
    description: "",
    affected_feature: "Lottery Management Dashboard",
    page_url: "",
    steps_to_reproduce: "",
    expected_result: "",
    actual_result: "",
  });

  const [featureRequestOpen, setFeatureRequestOpen] = useState(false);
  const [featureSubmitting, setFeatureSubmitting] = useState(false);
  const [featureError, setFeatureError] = useState<string | null>(null);
  const [featureSuccess, setFeatureSuccess] = useState<{
    reference: string;
    message: string;
  } | null>(null);
  const [featureForm, setFeatureForm] = useState({
    priority: "normal",
    title: "",
    description: "",
    why_needed: "",
    problem_solved: "",
    who_will_use: "",
    example_workflow: "",
  });

  const loadDashboard = useCallback(async (isRefresh: boolean) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    setActivityError(null);
    setSummary(EMPTY_SUMMARY);
    setUpcoming([]);
    setWarnings([]);
    setRecentActivity([]);
    const fetchData = async (url: string) => {
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });
      if (res.status === 401 || res.status === 403)
        throw new Error("Access unavailable");
      if (!res.ok) throw new Error("Request failed");
      return readResponse(res);
    };
    try {
      const results = await Promise.allSettled([
        fetchData(DASHBOARD_API_ROUTE).then((body) => {
          if (
            body.ok === false ||
            body.success === false ||
            (body.ok !== true && body.success !== true)
          )
            throw new Error("Invalid dashboard response");
          return {
            summary: normaliseSummary(body),
            upcoming: normaliseUpcoming(body),
            warnings: normaliseWarnings(body),
          };
        }),
        fetchData(
          `${AUDIT_LOGS_API_ROUTE}?page=1&pageSize=10&sort=created_at&direction=desc`,
        ).then((body) => {
          if (
            !Array.isArray(body.logs) ||
            body.ok === false ||
            body.success === false
          )
            throw new Error("Invalid audit response");
          return normaliseAuditActivity(body);
        }),
      ]);
      if (requestRef.current !== controller) return;
      const [dashboard, audit] = results;
      if (controller.signal.aborted) {
        setError("Dashboard loading timed out. Try Refresh.");
        setActivityError("Audit activity could not be loaded. Try Refresh.");
        return;
      }
      if (dashboard.status === "fulfilled") {
        setSummary(dashboard.value.summary);
        setUpcoming(dashboard.value.upcoming);
        setWarnings(dashboard.value.warnings);
      } else {
        setError(
          "Dashboard data is unavailable. Check your session and access, then try Refresh.",
        );
      }
      if (audit.status === "fulfilled") setRecentActivity(audit.value);
      else
        setActivityError(
          "Audit activity is unavailable. Check your audit access or open Audit Logs.",
        );
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === controller) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadDashboard(false);
    return () => {
      requestRef.current?.abort();
      requestRef.current = null;
      bugRequestRef.current?.abort();
      bugRequestRef.current = null;
      featureRequestRef.current?.abort();
      featureRequestRef.current = null;
    };
  }, [loadDashboard]);

  function openBugReport(event: React.MouseEvent<HTMLButtonElement>) {
    bugTriggerRef.current = event.currentTarget;
    setBugError(null);
    setBugSuccess(null);
    setBugForm({
      priority: "normal",
      title: "",
      description: "",
      affected_feature: "Lottery Management Dashboard",
      page_url:
        typeof window !== "undefined" ? safePageUrl(window.location.href) : "",
      steps_to_reproduce: "",
      expected_result: "",
      actual_result: "",
    });
    setBugReportOpen(true);
  }

  function openFeatureRequest(event: React.MouseEvent<HTMLButtonElement>) {
    featureTriggerRef.current = event.currentTarget;
    setFeatureError(null);
    setFeatureSuccess(null);
    setFeatureForm({
      priority: "normal",
      title: "",
      description: "",
      why_needed: "",
      problem_solved: "",
      who_will_use: "",
      example_workflow: "",
    });
    setFeatureRequestOpen(true);
  }

  function closeFeatureRequest() {
    if (featureBusyRef.current) return;

    setFeatureRequestOpen(false);
    setFeatureError(null);
    setFeatureSuccess(null);
  }

  function updateFeatureField(name: keyof typeof featureForm, value: string) {
    setFeatureForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function submitFeatureRequest() {
    if (featureBusyRef.current) return;
    const title = featureForm.title.trim();
    const description = featureForm.description.trim();

    if (!title) {
      setFeatureError("Enter a title for the requested feature.");
      featureFormRef.current
        ?.querySelector<HTMLElement>('[name="title"]')
        ?.focus();
      return;
    }

    if (!description) {
      setFeatureError("Explain what you would like added or changed.");
      featureFormRef.current
        ?.querySelector<HTMLElement>('[name="description"]')
        ?.focus();
      return;
    }

    featureBusyRef.current = true;
    const controller = new AbortController();
    featureRequestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 45_000);
    setFeatureSubmitting(true);
    setFeatureError(null);
    setFeatureSuccess(null);

    try {
      const response = await fetch(DEVELOPMENT_REQUESTS_API_ROUTE, {
        method: "POST",
        credentials: "same-origin",
        signal: controller.signal,
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          application: "lottery_management",
          priority: featureForm.priority,
          title,
          description,
          why_needed: featureForm.why_needed.trim() || null,
          problem_solved: featureForm.problem_solved.trim() || null,
          who_will_use: featureForm.who_will_use.trim() || null,
          example_workflow: featureForm.example_workflow.trim() || null,
          page_url:
            typeof window !== "undefined"
              ? safePageUrl(window.location.href)
              : null,
        }),
      });

      const result = await readResponse(response);
      const savedRequest = asRecord(
        result.request || result.developmentRequest || result.data,
      );
      const reference = firstText(
        savedRequest.reference_number,
        savedRequest.reference,
        savedRequest.id,
      );
      if (
        !response.ok ||
        result.ok === false ||
        result.success === false ||
        !reference
      )
        throw new Error("Feature request not confirmed.");
      if (featureRequestRef.current !== controller) return;
      setFeatureSuccess({
        reference,
        message: "Your feature request was saved.",
      });
    } catch {
      if (featureRequestRef.current === controller)
        setFeatureError(
          "Could not confirm the feature request was saved. Check Development Requests before trying again.",
        );
    } finally {
      window.clearTimeout(timeout);
      featureBusyRef.current = false;
      if (featureRequestRef.current === controller) {
        featureRequestRef.current = null;
        setFeatureSubmitting(false);
      }
    }
  }

  function closeBugReport() {
    if (bugBusyRef.current) return;

    setBugReportOpen(false);
    setBugError(null);
    setBugSuccess(null);
  }

  function updateBugField(name: keyof typeof bugForm, value: string) {
    setBugForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function submitBugReport() {
    if (bugBusyRef.current) return;
    const title = bugForm.title.trim();
    const description = bugForm.description.trim();
    const actualResult = bugForm.actual_result.trim();

    if (!title) {
      setBugError("Enter a short title for the bug.");
      bugFormRef.current?.querySelector<HTMLElement>('[name="title"]')?.focus();
      return;
    }

    if (!description) {
      setBugError(
        "Explain what the bug is and how it affects Lottery Management.",
      );
      bugFormRef.current
        ?.querySelector<HTMLElement>('[name="description"]')
        ?.focus();
      return;
    }

    if (!actualResult) {
      setBugError("Explain what actually happened.");
      bugFormRef.current
        ?.querySelector<HTMLElement>('[name="actual_result"]')
        ?.focus();
      return;
    }

    bugBusyRef.current = true;
    const controller = new AbortController();
    bugRequestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 45_000);
    setBugSubmitting(true);
    setBugError(null);
    setBugSuccess(null);

    try {
      const response = await fetch("/api/admin/bug-tracker", {
        method: "POST",
        credentials: "same-origin",
        signal: controller.signal,
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          // Lottery Management currently sits inside the Admin Portal
          // application group in the central Bug Tracker.
          application: "admin_portal",
          priority: bugForm.priority,
          title,
          description,
          affected_feature:
            bugForm.affected_feature.trim() || "Lottery Management",
          page_url: safePageUrl(bugForm.page_url.trim()) || null,
          steps_to_reproduce: bugForm.steps_to_reproduce.trim() || null,
          expected_result: bugForm.expected_result.trim() || null,
          actual_result: actualResult,
          browser_name:
            typeof navigator !== "undefined" ? navigator.userAgent : null,
          device_type:
            typeof window !== "undefined" &&
            window.matchMedia("(pointer: coarse)").matches
              ? "Touch device"
              : "Desktop or laptop",
          operating_system:
            typeof navigator !== "undefined" ? navigator.platform : null,
        }),
      });

      const result = await readResponse(response);

      const report = asRecord(result.report);
      const reference = firstText(report.reference_number, report.id);
      if (!response.ok || result.ok !== true || !reference)
        throw new Error("Bug report not confirmed.");
      if (bugRequestRef.current !== controller) return;
      setBugSuccess({
        reference,
        message: "Your bug report was saved.",
        emailSent: result.emailSent === true,
      });
    } catch {
      if (bugRequestRef.current === controller)
        setBugError(
          "Could not confirm the bug report was saved. Check Bug Tracker before trying again.",
        );
    } finally {
      window.clearTimeout(timeout);
      bugBusyRef.current = false;
      if (bugRequestRef.current === controller) {
        bugRequestRef.current = null;
        setBugSubmitting(false);
      }
    }
  }

  const upcomingClosures = useMemo(
    () => upcoming.filter((item) => item.kind === "sales_close"),
    [upcoming],
  );

  const upcomingDraws = useMemo(
    () => upcoming.filter((item) => item.kind === "draw"),
    [upcoming],
  );

  if (loading) {
    return (
      <div
        role="status"
        className="flex min-h-[50vh] w-full items-center justify-center"
      >
        <div className="flex items-center gap-3 text-white/65">
          <Loader2 className="animate-spin" size={23} />
          <span className="font-bold">Loading Lottery Management…</span>
        </div>
      </div>
    );
  }

  return (
    <main aria-busy={refreshing} className="w-full">
      <div className="mb-7 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="pt-6 pl-5 text-sm font-black uppercase tracking-[0.22em] text-purple-300 sm:pt-7 sm:pl-7 lg:pt-8 lg:pl-8">
            Burton Pride Admin Portal
          </p>

          <h1 className="pl-5 mt-2 text-3xl font-black tracking-tight sm:pl-7 sm:text-4xl lg:pl-8">
            Lottery Management
          </h1>
          <p className="pl-5 mt-3 max-w-4xl text-sm leading-6 text-white/55 sm:pl-7 sm:text-base lg:pl-8">
            Manage lotteries, entries, tickets, prizes, draws, winners,
            reporting, compliance and audit history from one application.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void loadDashboard(true)}
            disabled={refreshing}
            className="
                inline-flex
                h-12
                items-center
                gap-2
                rounded-2xl
                border
                border-white/10
                bg-white/5
                px-5
                text-sm
                font-black
                text-white
                transition
                hover:bg-white/10
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
          >
            {refreshing ? (
              <Loader2 className="animate-spin" size={17} />
            ) : (
              <RefreshCw size={17} />
            )}
            Refresh
          </button>

          <button
            type="button"
            onClick={openBugReport}
            className="
                inline-flex
                h-12
                items-center
                gap-2
                rounded-2xl
                border
                border-white/10
                bg-white/5
                px-5
                text-sm
                font-black
                text-white
                transition
                hover:border-pink-400/25
                hover:bg-pink-500/10
              "
          >
            <Bug size={18} />
            Report a bug
          </button>

          <button
            type="button"
            onClick={openFeatureRequest}
            className="
                inline-flex
                h-12
                items-center
                gap-2
                rounded-2xl
                border
                border-purple-400/20
                bg-purple-500/10
                px-5
                text-sm
                font-black
                text-purple-100
                transition
                hover:border-purple-300/35
                hover:bg-purple-500/20
              "
          >
            <Sparkles size={18} />
            Request a feature
          </button>

          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="
                inline-flex
                h-12
                items-center
                gap-2
                rounded-2xl
                bg-purple-500
                px-6
                text-sm
                font-black
                text-white
                shadow-lg
                transition
                hover:bg-purple-400
              "
          >
            <Plus size={18} />
            Create lottery
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-7 rounded-3xl border border-red-500/25 bg-red-500/10 p-5"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 shrink-0 text-red-300" size={21} />

            <div className="min-w-0 flex-1">
              <p className="font-black text-red-200">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Active lotteries"
          value={summary.totalActiveLotteries ?? "Unavailable"}
          description="Current lotteries not completed or archived."
          icon={Ticket}
        />

        <StatCard
          title="Current live sales"
          value={formatMoney(summary.liveLotterySalesPence)}
          description="Ticket proceeds from lotteries currently live."
          icon={CircleDollarSign}
        />

        <StatCard
          title="Gross ticket proceeds"
          value={formatMoney(summary.grossTicketProceedsPence)}
          description="Total paid lottery income before refunds and fees."
          icon={BarChart3}
        />

        <StatCard
          title="Paid entries"
          value={summary.paidEntries ?? "Unavailable"}
          description="Reported paid entries. This figure does not establish draw eligibility."
          icon={Users}
        />

        <StatCard
          title="Tickets issued"
          value={summary.ticketsIssued ?? "Unavailable"}
          description="Individual valid ticket records issued."
          icon={WalletCards}
        />

        <StatCard
          title="Payment attention"
          value={summary.pendingOrFailedPayments ?? "Unavailable"}
          description="Pending, failed or incomplete payments needing review."
          icon={FileClock}
          warning={(summary.pendingOrFailedPayments ?? 0) > 0}
        />

        <StatCard
          title="Unclaimed prizes"
          value={summary.unclaimedPrizes ?? "Unavailable"}
          description="Selected prizes still awaiting claim or fulfilment."
          icon={Gift}
          warning={(summary.unclaimedPrizes ?? 0) > 0}
        />

        <StatCard
          title="Compliance warnings"
          value={summary.complianceWarnings ?? "Unavailable"}
          description="Configuration or threshold warnings requiring attention."
          icon={ShieldCheck}
          warning={(summary.complianceWarnings ?? 0) > 0}
        />
      </div>

      <div className="mt-7 grid gap-6 2xl:grid-cols-2">
        <SectionCard
          title="Upcoming sales closing dates"
          description="Lottery sales that are scheduled to close soon."
          action={
            <Link
              href="/Admin/LotteryManagement/Lotteries"
              className="inline-flex items-center gap-1 text-sm font-black text-purple-300 hover:text-purple-200"
            >
              View lotteries
              <ChevronRight size={15} />
            </Link>
          }
        >
          {upcomingClosures.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-black/15 p-6 text-center text-sm text-white/40">
              {error || refreshing
                ? "Sales closing dates are unavailable."
                : "No sales closing dates were returned."}
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingClosures.slice(0, 8).map((item) => (
                <Link
                  key={item.id}
                  href={`/Admin/LotteryManagement/Lotteries/${encodeURIComponent(item.lotteryId)}`}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:bg-white/[0.05]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-black text-white">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs text-white/40">
                      /Lottery/{item.slug}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-white/75">
                      {formatDateTime(item.dateTime)}
                    </p>
                    <p className="mt-1 text-xs font-black text-amber-300">
                      Sales close
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Upcoming draws"
          description="Scheduled lottery draw dates."
          action={
            <Link
              href="/Admin/LotteryManagement/Draws"
              className="inline-flex items-center gap-1 text-sm font-black text-purple-300 hover:text-purple-200"
            >
              Open draws
              <ChevronRight size={15} />
            </Link>
          }
        >
          {upcomingDraws.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-black/15 p-6 text-center text-sm text-white/40">
              {error || refreshing
                ? "Draw dates are unavailable."
                : "No draw dates were returned."}
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingDraws.slice(0, 8).map((item) => (
                <Link
                  key={item.id}
                  href={`/Admin/LotteryManagement/Lotteries/${encodeURIComponent(item.lotteryId)}`}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:bg-white/[0.05]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-black text-white">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs text-white/40">
                      /Lottery/{item.slug}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-white/75">
                      {formatDateTime(item.dateTime)}
                    </p>
                    <p className="mt-1 text-xs font-black text-purple-300">
                      Draw
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-7 grid gap-6 2xl:grid-cols-[1fr_1.2fr]">
        <SectionCard
          title="Compliance warnings"
          description="Issues that may block publication, sales or drawing."
          action={
            <Link
              href="/Admin/LotteryManagement/Compliance"
              className="inline-flex items-center gap-1 text-sm font-black text-purple-300 hover:text-purple-200"
            >
              Compliance
              <ChevronRight size={15} />
            </Link>
          }
        >
          {warnings.length === 0 ? (
            <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-5">
              <div className="flex items-center gap-3">
                <AlertTriangle size={20} className="text-white/65" />
                <p className="text-sm font-bold text-white/65">
                  {error || refreshing
                    ? "Compliance warning data is unavailable."
                    : "No warnings were returned. Open Compliance to verify the checks."}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {warnings.slice(0, 8).map((warning) => (
                <div
                  key={warning.id}
                  className={`
                      rounded-2xl
                      border
                      p-4
                      ${
                        warning.severity === "critical"
                          ? "border-red-500/20 bg-red-500/[0.07]"
                          : warning.severity === "warning"
                            ? "border-amber-500/20 bg-amber-500/[0.07]"
                            : "border-blue-500/20 bg-blue-500/[0.06]"
                      }
                    `}
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      size={18}
                      className={
                        warning.severity === "critical"
                          ? "text-red-300"
                          : warning.severity === "warning"
                            ? "text-amber-300"
                            : "text-blue-300"
                      }
                    />

                    <div>
                      {warning.lotteryTitle && (
                        <p className="text-sm font-black text-white">
                          {warning.lotteryTitle}
                        </p>
                      )}

                      <p className="mt-1 text-sm leading-6 text-white/65">
                        {warning.message}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Recent admin activity"
          description="Latest lottery actions recorded by the Admin Portal."
          action={
            <Link
              href="/Admin/LotteryManagement/AuditLogs"
              className="inline-flex items-center gap-1 text-sm font-black text-purple-300 hover:text-purple-200"
            >
              Audit logs
              <ChevronRight size={15} />
            </Link>
          }
        >
          {recentActivity.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-black/15 p-6 text-center text-sm text-white/40">
              {activityError ||
                (refreshing
                  ? "Loading audit activity…"
                  : "No audit activity was returned.")}
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {recentActivity.slice(0, 10).map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-300">
                    <Activity size={17} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-white">
                      {activity.actionLabel}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-white/40">
                      {activity.adminName || activity.adminEmail || "Admin"}
                      {activity.lotteryTitle
                        ? ` • ${activity.lotteryTitle}`
                        : ""}
                    </p>
                  </div>

                  <p className="shrink-0 text-right text-xs font-bold text-white/35">
                    {formatDateTime(activity.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Quick access"
        description="Jump to the main Lottery Management areas."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {[
            {
              label: "Lotteries",
              href: "/Admin/LotteryManagement/Lotteries",
              icon: Ticket,
            },
            {
              label: "Orders & Entries",
              href: "/Admin/LotteryManagement/Orders",
              icon: Users,
            },
            {
              label: "Tickets",
              href: "/Admin/LotteryManagement/Tickets",
              icon: WalletCards,
            },
            {
              label: "Prizes",
              href: "/Admin/LotteryManagement/Prizes",
              icon: Gift,
            },
            {
              label: "Draws",
              href: "/Admin/LotteryManagement/Draws",
              icon: Trophy,
            },
            {
              label: "Winners",
              href: "/Admin/LotteryManagement/Winners",
              icon: Trophy,
            },
            {
              label: "Reports & Exports",
              href: "/Admin/LotteryManagement/Reports",
              icon: FileText,
            },
            {
              label: "Compliance",
              href: "/Admin/LotteryManagement/Compliance",
              icon: ShieldCheck,
            },
            {
              label: "Audit Logs",
              href: "/Admin/LotteryManagement/AuditLogs",
              icon: History,
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-purple-500/25 hover:bg-purple-500/[0.07]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-purple-300 transition group-hover:bg-purple-500/15">
                    <Icon size={18} />
                  </div>

                  <span className="text-sm font-black text-white/75 group-hover:text-white">
                    {item.label}
                  </span>
                </div>

                <ChevronRight
                  size={16}
                  className="text-white/25 transition group-hover:text-purple-300"
                />
              </Link>
            );
          })}
        </div>
      </SectionCard>

      {featureRequestOpen ? (
        <DashboardDialog
          titleId="lottery-feature-request-title"
          busy={featureSubmitting}
          onClose={closeFeatureRequest}
          triggerRef={featureTriggerRef}
          maxWidth="5xl"
        >
          <div className="relative max-h-[94dvh] w-full max-w-5xl overflow-y-auto rounded-[1.5rem] border border-white/10 bg-[#11111f] shadow-2xl sm:rounded-[2rem]">
            <div className="h-1 bg-gradient-to-r from-purple-500 via-pink-400 to-emerald-400" />

            <form
              ref={featureFormRef}
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void submitFeatureRequest();
              }}
              className="p-5 sm:p-8"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-white/55">
                    <Sparkles className="h-4 w-4" />
                    Burton Pride Development Requests
                  </div>

                  <h2
                    id="lottery-feature-request-title"
                    className="mt-3 text-2xl font-black text-white sm:text-3xl"
                  >
                    Request a new feature
                  </h2>

                  <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
                    This request is sent directly to the Admin Portal
                    Development Requests system. Add enough detail so the
                    feature can be reviewed and planned.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeFeatureRequest}
                  disabled={featureSubmitting}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white/10 px-4 py-3 text-sm font-bold text-white/70 transition hover:bg-white/20 hover:text-white disabled:opacity-50"
                >
                  Close
                  <X className="h-4 w-4" />
                </button>
              </div>

              {featureError ? (
                <div
                  role="alert"
                  className="mt-6 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      <p className="font-black">
                        Feature request could not be submitted
                      </p>
                      <p className="mt-1 leading-6 text-red-100/80">
                        {featureError}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {featureSuccess ? (
                <div
                  role="status"
                  className="mt-6 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-5 text-emerald-50"
                >
                  <div className="flex items-start gap-3">
                    <Check className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      <p className="font-black">Feature request submitted</p>
                      <p className="mt-1 text-sm leading-6 text-emerald-50/80">
                        {featureSuccess.message}
                      </p>
                      <p className="mt-3 text-sm font-black">
                        Reference: {featureSuccess.reference}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-8 space-y-6">
                  <div className="grid gap-5 md:grid-cols-2">
                    <Field label="Application">
                      <select
                        value="lottery_management"
                        disabled
                        className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-80`}
                      >
                        <option value="lottery_management">
                          Lottery Management
                        </option>
                      </select>
                    </Field>

                    <Field label="Priority">
                      <select
                        name="priority"
                        disabled={featureSubmitting}
                        value={featureForm.priority}
                        onChange={(event) =>
                          updateFeatureField("priority", event.target.value)
                        }
                        className={inputClass}
                      >
                        <option value="minor">Minor</option>
                        <option value="normal">Normal</option>
                        <option value="senior">Senior / Critical</option>
                      </select>
                    </Field>

                    <Field label="Feature title" full required>
                      <input
                        name="title"
                        maxLength={200}
                        disabled={featureSubmitting}
                        aria-invalid={Boolean(
                          featureError && !featureForm.title.trim(),
                        )}
                        value={featureForm.title}
                        onChange={(event) =>
                          updateFeatureField("title", event.target.value)
                        }
                        className={inputClass}
                        placeholder="Example: Add a lottery performance comparison report"
                      />
                    </Field>

                    <Field
                      label="What would you like added or changed?"
                      full
                      required
                    >
                      <textarea
                        onInput={growTextarea}
                        name="description"
                        maxLength={5000}
                        disabled={featureSubmitting}
                        aria-invalid={Boolean(
                          featureError && !featureForm.description.trim(),
                        )}
                        value={featureForm.description}
                        onChange={(event) =>
                          updateFeatureField("description", event.target.value)
                        }
                        className={`${inputClass} min-h-36 resize-none`}
                        placeholder="Explain the feature, where it should appear and what you would like it to do."
                      />
                    </Field>

                    <Field label="Why is this needed?">
                      <textarea
                        onInput={growTextarea}
                        name="why_needed"
                        maxLength={5000}
                        disabled={featureSubmitting}
                        value={featureForm.why_needed}
                        onChange={(event) =>
                          updateFeatureField("why_needed", event.target.value)
                        }
                        className={`${inputClass} min-h-28 resize-none`}
                        placeholder="How would this help Burton Pride or the admins using Lottery Management?"
                      />
                    </Field>

                    <Field label="What problem does it solve?">
                      <textarea
                        onInput={growTextarea}
                        name="problem_solved"
                        maxLength={5000}
                        disabled={featureSubmitting}
                        value={featureForm.problem_solved}
                        onChange={(event) =>
                          updateFeatureField(
                            "problem_solved",
                            event.target.value,
                          )
                        }
                        className={`${inputClass} min-h-28 resize-none`}
                        placeholder="Explain the current problem, limitation or extra work this would remove."
                      />
                    </Field>

                    <Field label="Who will use it?" full>
                      <input
                        name="who_will_use"
                        maxLength={200}
                        disabled={featureSubmitting}
                        value={featureForm.who_will_use}
                        onChange={(event) =>
                          updateFeatureField("who_will_use", event.target.value)
                        }
                        className={inputClass}
                        placeholder="Example: Main admins or all Lottery Management users"
                      />
                    </Field>

                    <Field label="Example of how it should work" full>
                      <textarea
                        onInput={growTextarea}
                        name="example_workflow"
                        maxLength={5000}
                        disabled={featureSubmitting}
                        value={featureForm.example_workflow}
                        onChange={(event) =>
                          updateFeatureField(
                            "example_workflow",
                            event.target.value,
                          )
                        }
                        className={`${inputClass} min-h-36 resize-none`}
                        placeholder={
                          "1. Open Lottery Management\n2. Go to the relevant page\n3. Select the new option\n4. The requested feature does ..."
                        }
                      />
                    </Field>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-xs leading-5 text-white/50">
                    This request is automatically recorded under Lottery
                    Management. The signed-in administrator is recorded by the
                    Development Requests API.
                  </div>
                </div>
              )}

              <div className="mt-7 flex flex-col-reverse gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <Link
                  href="/Admin/DevelopmentRequests"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  Open Development Requests
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={closeFeatureRequest}
                    disabled={featureSubmitting}
                    className="min-h-11 rounded-2xl bg-white/10 px-5 py-3 text-sm font-black text-white/70 transition hover:bg-white/20 hover:text-white disabled:opacity-50"
                  >
                    {featureSuccess ? "Close" : "Cancel"}
                  </button>

                  {!featureSuccess ? (
                    <button
                      type="button"
                      onClick={submitFeatureRequest}
                      disabled={featureSubmitting}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-500 to-fuchsia-500 px-6 py-3 text-sm font-black text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {featureSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      {featureSubmitting
                        ? "Submitting..."
                        : "Submit feature request"}
                    </button>
                  ) : null}
                </div>
              </div>
            </form>
          </div>
        </DashboardDialog>
      ) : null}

      {bugReportOpen ? (
        <DashboardDialog
          titleId="lottery-bug-report-title"
          busy={bugSubmitting}
          onClose={closeBugReport}
          triggerRef={bugTriggerRef}
          maxWidth="3xl"
        >
          <div className="relative max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-[1.5rem] border border-white/10 bg-[#11111f] shadow-2xl sm:rounded-[2rem]">
            <div className="bg-gradient-to-r from-red-500 via-pink-500 to-purple-500 p-1" />

            <form
              ref={bugFormRef}
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void submitBugReport();
              }}
              className="p-4 sm:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-red-100/70">
                    <Bug className="h-4 w-4" />
                    Burton Pride Bug Tracker
                  </div>

                  <h2
                    id="lottery-bug-report-title"
                    className="mt-2 text-2xl font-black text-white"
                  >
                    Report a bug
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
                    This report is sent directly to the Admin Portal Bug
                    Tracker. It will be recorded as a Lottery Management issue
                    so you can report problems without leaving this application.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeBugReport}
                  disabled={bugSubmitting}
                  className="shrink-0 rounded-full bg-white/10 px-3 py-2 text-xs font-black text-white/65 transition hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Close
                </button>
              </div>

              {bugError ? (
                <div
                  role="alert"
                  className="mt-5 rounded-2xl border border-red-300/25 bg-red-500/10 p-4 text-red-50"
                >
                  <div className="flex gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />

                    <div className="min-w-0">
                      <p className="font-black">
                        Bug report could not be submitted
                      </p>

                      <p className="mt-1 break-words text-sm leading-6 text-red-50/80">
                        {bugError}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {bugSuccess ? (
                <div
                  role="status"
                  className="mt-5 rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-5 text-emerald-50"
                >
                  <div className="flex gap-3">
                    <Check className="mt-0.5 h-5 w-5 shrink-0" />

                    <div className="min-w-0">
                      <p className="font-black">Bug report submitted</p>

                      <p className="mt-1 text-sm leading-6 text-emerald-50/80">
                        {bugSuccess.message}
                      </p>

                      <div className="mt-3 rounded-xl border border-emerald-200/15 bg-black/15 px-4 py-3">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-100/55">
                          Reference
                        </p>
                        <p className="mt-1 font-black text-emerald-50">
                          {bugSuccess.reference}
                        </p>
                      </div>

                      <p className="mt-3 text-xs leading-5 text-emerald-50/55">
                        {bugSuccess.emailSent
                          ? "The Bug Tracker notification email was sent."
                          : "The report was saved. Email delivery was not confirmed by the API."}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-6 space-y-5">
                  <div className="rounded-2xl border border-purple-300/15 bg-purple-500/[0.07] p-4">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-purple-300" />

                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-purple-200/60">
                          Application
                        </p>

                        <p className="mt-1 font-black text-white">
                          Lottery Management
                        </p>

                        <p className="mt-1 text-xs leading-5 text-white/45">
                          The central Bug Tracker currently stores this under
                          Admin Portal, with Lottery Management recorded as the
                          affected feature.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Priority" required>
                      <select
                        name="priority"
                        disabled={bugSubmitting}
                        value={bugForm.priority}
                        onChange={(event) =>
                          updateBugField("priority", event.target.value)
                        }
                        className={inputClass}
                      >
                        <option value="minor">Minor Bug</option>
                        <option value="normal">Normal Issue</option>
                        <option value="senior">Senior / Critical</option>
                      </select>
                    </Field>

                    <Field label="Affected feature">
                      <input
                        name="affected_feature"
                        maxLength={200}
                        disabled={bugSubmitting}
                        value={bugForm.affected_feature}
                        onChange={(event) =>
                          updateBugField("affected_feature", event.target.value)
                        }
                        className={inputClass}
                        placeholder="e.g. Dashboard, Tickets, Draws"
                      />
                    </Field>

                    <Field label="Bug title" full required>
                      <input
                        name="title"
                        maxLength={200}
                        disabled={bugSubmitting}
                        aria-invalid={Boolean(
                          bugError && !bugForm.title.trim(),
                        )}
                        value={bugForm.title}
                        onChange={(event) =>
                          updateBugField("title", event.target.value)
                        }
                        className={inputClass}
                        placeholder="Give the problem a short clear title"
                      />
                    </Field>

                    <Field label="Bug description" full required>
                      <textarea
                        onInput={growTextarea}
                        name="description"
                        maxLength={5000}
                        disabled={bugSubmitting}
                        aria-invalid={Boolean(
                          bugError && !bugForm.description.trim(),
                        )}
                        value={bugForm.description}
                        onChange={(event) =>
                          updateBugField("description", event.target.value)
                        }
                        className={`${inputClass} min-h-28 resize-none`}
                        placeholder="Explain what happened and how it affects Lottery Management."
                      />
                    </Field>

                    <Field label="Steps to reproduce" full>
                      <textarea
                        onInput={growTextarea}
                        name="steps_to_reproduce"
                        maxLength={5000}
                        disabled={bugSubmitting}
                        value={bugForm.steps_to_reproduce}
                        onChange={(event) =>
                          updateBugField(
                            "steps_to_reproduce",
                            event.target.value,
                          )
                        }
                        className={`${inputClass} min-h-24 resize-none`}
                        placeholder="1. Open... 2. Click... 3. The problem appears..."
                      />
                    </Field>

                    <Field label="Expected result">
                      <textarea
                        onInput={growTextarea}
                        name="expected_result"
                        maxLength={5000}
                        disabled={bugSubmitting}
                        value={bugForm.expected_result}
                        onChange={(event) =>
                          updateBugField("expected_result", event.target.value)
                        }
                        className={`${inputClass} min-h-24 resize-none`}
                        placeholder="What should have happened?"
                      />
                    </Field>

                    <Field label="Actual result" required>
                      <textarea
                        onInput={growTextarea}
                        name="actual_result"
                        maxLength={5000}
                        disabled={bugSubmitting}
                        aria-invalid={Boolean(
                          bugError && !bugForm.actual_result.trim(),
                        )}
                        value={bugForm.actual_result}
                        onChange={(event) =>
                          updateBugField("actual_result", event.target.value)
                        }
                        className={`${inputClass} min-h-24 resize-none`}
                        placeholder="What happened instead?"
                      />
                    </Field>

                    <Field
                      label="Page URL"
                      full
                      hint="This is filled in automatically from the Lottery Management page you are using."
                    >
                      <input
                        name="page_url"
                        maxLength={5000}
                        disabled={bugSubmitting}
                        value={bugForm.page_url}
                        onChange={(event) =>
                          updateBugField("page_url", event.target.value)
                        }
                        className={inputClass}
                      />
                    </Field>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-5 text-white/45">
                    Browser, device type and operating system are added
                    automatically to help reproduce the problem.
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <Link
                  href="/Admin/BugTracker"
                  className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  Open full Bug Tracker
                </Link>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={closeBugReport}
                    disabled={bugSubmitting}
                    className="min-h-11 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                  >
                    {bugSuccess ? "Close" : "Cancel"}
                  </button>

                  {!bugSuccess ? (
                    <button
                      type="button"
                      onClick={submitBugReport}
                      disabled={bugSubmitting}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-500 via-pink-500 to-purple-500 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {bugSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Bug className="h-4 w-4" />
                      )}

                      {bugSubmitting ? "Submitting..." : "Submit bug report"}
                    </button>
                  ) : null}
                </div>
              </div>
            </form>
          </div>
        </DashboardDialog>
      ) : null}

      <CreateLotteryModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => loadDashboard(true)}
      />
    </main>
  );
}

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/25 focus-visible:ring-2 focus-visible:ring-purple-400";

function Field({
  label,
  hint,
  required,
  full,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={full ? "md:col-span-2" : ""}>
      <span className="mb-2 block text-sm font-semibold text-white/80">
        {label}
        {required ? <span className="ml-1 text-red-300">*</span> : null}
      </span>
      {children}
      {hint ? (
        <span className="mt-2 block text-xs text-white/40">{hint}</span>
      ) : null}
    </label>
  );
}

function DashboardDialog({
  titleId,
  busy,
  onClose,
  triggerRef,
  maxWidth,
  children,
}: {
  titleId: string;
  busy: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  maxWidth: "3xl" | "5xl";
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    if (!mounted || !dialogRef.current) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!dialogRef.current.open) dialogRef.current.showModal();
    return () => {
      document.body.style.overflow = previous;
      if (triggerRef.current?.isConnected) triggerRef.current.focus();
    };
  }, [mounted, triggerRef]);
  return mounted
    ? createPortal(
        <dialog
          ref={dialogRef}
          aria-labelledby={titleId}
          onClose={onClose}
          onCancel={(event) => {
            if (busy) event.preventDefault();
          }}
          className={`fixed left-1/2 top-1/2 m-0 max-h-[92dvh] w-[calc(100%_-_1.5rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-white/10 bg-[#11111f] p-0 text-white shadow-2xl backdrop:bg-black/75 ${maxWidth === "5xl" ? "max-w-5xl" : "max-w-3xl"}`}
        >
          {children}
        </dialog>,
        document.body,
      )
    : null;
}

function growTextarea(event: React.FormEvent<HTMLTextAreaElement>) {
  const element = event.currentTarget;
  element.style.height = "auto";
  element.style.height = `${Math.min(480, element.scrollHeight)}px`;
}
