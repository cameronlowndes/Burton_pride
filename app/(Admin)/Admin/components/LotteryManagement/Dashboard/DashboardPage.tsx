"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bug,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  FileClock,
  FileText,
  Gift,
  History,
  Loader2,
  Plus,
  PoundSterling,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Ticket,
  Trophy,
  Users,
  WalletCards,
  X,
} from "lucide-react";

type DashboardSummary = {
  totalActiveLotteries: number;
  liveLotterySalesPence: number;
  grossTicketProceedsPence: number;
  paidEntries: number;
  ticketsIssued: number;
  pendingOrFailedPayments: number;
  unclaimedPrizes: number;
  complianceWarnings: number;
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
  totalActiveLotteries: 0,
  liveLotterySalesPence: 0,
  grossTicketProceedsPence: 0,
  paidEntries: 0,
  ticketsIssued: 0,
  pendingOrFailedPayments: 0,
  unclaimedPrizes: 0,
  complianceWarnings: 0,
};

const LOTTERY_API_ROUTE = "/api/admin/lotterymanagement/lottery";
const DASHBOARD_API_ROUTE = "/api/admin/lotterymanagement/dashboard";
const REQUIRED_MINIMUM_AGE = 18;

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function firstArray(...values: unknown[]) {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }

  return [];
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
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
  const amount = firstNumber(value) ?? 0;
  return Math.round(amount * 100);
}

function normaliseSummary(body: DashboardResponse): DashboardSummary {
  const dashboard = asRecord(body.dashboard || body.data);
  const stats = asRecord(body.stats || dashboard.stats);
  const summary = asRecord(body.summary || dashboard.summary);

  return {
    totalActiveLotteries:
      firstNumber(
        summary.totalActiveLotteries,
        summary.active_lotteries,
        stats.activeLotteries,
        dashboard.activeLotteries,
      ) ?? 0,
    liveLotterySalesPence:
      firstNumber(
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
      firstNumber(
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
      firstNumber(
        summary.paidEntries,
        summary.paid_entries,
        stats.paidEntries,
        dashboard.paidEntries,
        dashboard.paidOrders,
      ) ?? 0,
    ticketsIssued:
      firstNumber(
        summary.ticketsIssued,
        summary.tickets_issued,
        stats.ticketsIssued,
        dashboard.ticketsIssued,
      ) ?? 0,
    pendingOrFailedPayments:
      firstNumber(
        summary.pendingOrFailedPayments,
        summary.pending_or_failed_payments,
        summary.payment_attention,
        stats.paymentAttention,
        dashboard.paymentAttention,
      ) ?? 0,
    unclaimedPrizes:
      firstNumber(
        summary.unclaimedPrizes,
        summary.unclaimed_prizes,
        stats.unclaimedPrizes,
        dashboard.unclaimedPrizes,
      ) ?? 0,
    complianceWarnings:
      firstNumber(
        summary.complianceWarnings,
        summary.compliance_warnings,
        stats.complianceWarnings,
        dashboard.complianceWarnings,
      ) ?? 0,
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

  if (!lotteryId || !dateTime) return null;

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

  return "info";
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
      lotteryTitle:
        firstText(item.lotteryTitle, item.lottery_title) || null,
      severity: normaliseSeverity(item.severity),
      message:
        firstText(item.message, item.title, item.warning_code) ||
        "Lottery compliance warning",
      createdAt: firstText(item.createdAt, item.created_at) || null,
    };
  });
}

function normaliseRecentActivity(body: DashboardResponse) {
  const dashboard = asRecord(body.dashboard || body.data);
  const rows = firstArray(
    body.recentActivity,
    body.recent_activity,
    dashboard.recentActivity,
  );

  return rows.map((value, index): RecentActivity => {
    const item = asRecord(value);

    return {
      id: firstText(item.id) || `activity-${index}`,
      actionLabel:
        firstText(
          item.actionLabel,
          item.action_label,
          item.title,
          item.action_code,
        ) || "Lottery activity",
      adminName:
        firstText(item.adminName, item.admin_name, item.admin) || null,
      adminEmail: firstText(item.adminEmail, item.admin_email) || null,
      lotteryTitle:
        firstText(item.lotteryTitle, item.lottery_title) || null,
      createdAt:
        firstText(item.createdAt, item.created_at) || new Date().toISOString(),
    };
  });
}


function formatMoney(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format((Number.isFinite(pence) ? pence : 0) / 100);
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
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
          <p className="mt-2 text-xs leading-5 text-white/40">
            {description}
          </p>
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
  const [summary, setSummary] =
    useState<DashboardSummary>(EMPTY_SUMMARY);
  const [upcoming, setUpcoming] = useState<UpcomingItem[]>([]);
  const [warnings, setWarnings] = useState<ComplianceWarning[]>([]);
  const [recentActivity, setRecentActivity] =
    useState<RecentActivity[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    title: "",
    slug: "",
    internal_reference: "",
    lottery_type: "small_society",
    short_summary: "",
    description: "",
    fundraising_purpose: "",
    publication_at: "",
    sales_open_at: "",
    sales_close_at: "",
    draw_at: "",
    results_publish_at: "",
    timezone: "Europe/London",
    ticket_price: "1.00",
    currency: "GBP",
    max_tickets: "",
    minimum_age: "18",
    promoting_society_legal_name: "Burton Pride C.I.C.",
    registration_licence_type: "",
    registration_licence_number: "",
    licensing_authority: "",
    responsible_promoter_name: "",
    responsible_promoter_address: "",
    geographic_eligibility: "Great Britain",
    terms_version: "",
    privacy_notice_version: "",
    responsible_gambling_info: "",
    required_ticket_wording: "",
    maximum_proceeds: "",
    maximum_prize_value: "",
    show_in_directory: true,
    allow_page_before_sales: false,
    show_ticket_count: false,
    show_amount_raised: false,
    show_remaining_tickets: false,
    show_prize_values: true,
    winner_display_mode: "first_name",
    countdown_enabled: true,
  });

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


  useEffect(() => {
    void loadDashboard(false);
  }, []);

  useEffect(() => {
    if (!bugReportOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleBugKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !bugSubmitting) {
        setBugReportOpen(false);
        setBugError(null);
        setBugSuccess(null);
      }
    }

    window.addEventListener("keydown", handleBugKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleBugKeyDown);
    };
  }, [bugReportOpen, bugSubmitting]);

  useEffect(() => {
    if (!createOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !creating) {
        closeCreateModal();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [createOpen, creating]);

  async function loadDashboard(isRefresh: boolean) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);
    setDetails(null);

    try {
      const response = await fetch(DASHBOARD_API_ROUTE, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          credentials: "include",
          cache: "no-store",
        });

      const body = (await response.json().catch(() => null)) as
        | DashboardResponse
        | null;

      if (!response.ok || (!body?.success && !body?.ok)) {
        throw new Error(
          body?.details ||
            body?.error ||
            `Dashboard request failed with HTTP ${response.status}`,
        );
      }

      setSummary(normaliseSummary(body));
      setUpcoming(normaliseUpcoming(body));
      setWarnings(normaliseWarnings(body));
      setRecentActivity(normaliseRecentActivity(body));
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Unknown Lottery Management dashboard error.";

      setError("Unable to load Lottery Management dashboard.");
      setDetails(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function openBugReport() {
    setBugError(null);
    setBugSuccess(null);
    setBugForm({
      priority: "normal",
      title: "",
      description: "",
      affected_feature: "Lottery Management Dashboard",
      page_url:
        typeof window !== "undefined"
          ? window.location.href
          : "",
      steps_to_reproduce: "",
      expected_result: "",
      actual_result: "",
    });
    setBugReportOpen(true);
  }

  function closeBugReport() {
    if (bugSubmitting) return;

    setBugReportOpen(false);
    setBugError(null);
    setBugSuccess(null);
  }

  function updateBugField(
    name: keyof typeof bugForm,
    value: string,
  ) {
    setBugForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function submitBugReport() {
    const title = bugForm.title.trim();
    const description = bugForm.description.trim();
    const actualResult = bugForm.actual_result.trim();

    if (!title) {
      setBugError("Enter a short title for the bug.");
      return;
    }

    if (!description) {
      setBugError("Explain what the bug is and how it affects Lottery Management.");
      return;
    }

    if (!actualResult) {
      setBugError("Explain what actually happened.");
      return;
    }

    setBugSubmitting(true);
    setBugError(null);
    setBugSuccess(null);

    try {
      const response = await fetch("/api/admin/bug-tracker", {
        method: "POST",
        credentials: "include",
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
            bugForm.affected_feature.trim() ||
            "Lottery Management",
          page_url:
            bugForm.page_url.trim() ||
            null,
          steps_to_reproduce:
            bugForm.steps_to_reproduce.trim() ||
            null,
          expected_result:
            bugForm.expected_result.trim() ||
            null,
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

      const result = await response.json().catch(() => null);

      if (
        !response.ok ||
        !result?.ok ||
        !result?.report
      ) {
        throw new Error(
          [
            result?.error ||
              result?.message ||
              "The bug report could not be submitted.",
            result?.code
              ? `Error code: ${result.code}.`
              : null,
            result?.hint || null,
          ]
            .filter(Boolean)
            .join(" "),
        );
      }

      setBugSuccess({
        reference:
          result.report.reference_number ||
          result.report.id ||
          "Saved",
        message:
          result.message ||
          "Your bug report has been saved successfully.",
        emailSent: Boolean(result.emailSent),
      });
    } catch (submitError) {
      setBugError(
        submitError instanceof Error
          ? submitError.message
          : "The bug report could not be submitted.",
      );
    } finally {
      setBugSubmitting(false);
    }
  }

  function slugify(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function updateCreateField(name: string, value: string | boolean) {
    setCreateForm((prev) => {
      const next = { ...prev, [name]: value };

      if (name === "title" && !prev.slug) {
        next.slug = slugify(String(value));
      }

      return next;
    });
  }

  function closeCreateModal() {
    if (creating) return;
    setCreateOpen(false);
    setCreateStep(1);
    setCreateError(null);
  }

  function validateCreateStep(step: number) {
    if (step === 1) {
      if (!createForm.title.trim()) return "Enter a lottery title.";
      if (!createForm.slug.trim()) return "Enter a slug.";

      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(createForm.slug)) {
        return "Slug must use lowercase letters, numbers and hyphens only.";
      }

      if (!createForm.lottery_type) return "Select a lottery type.";
    }

    if (step === 2) {
      if (!createForm.sales_open_at) return "Set the sales opening date and time.";
      if (!createForm.sales_close_at) return "Set the sales closing date and time.";
      if (!createForm.draw_at) return "Set the draw date and time.";

      const open = new Date(createForm.sales_open_at).getTime();
      const close = new Date(createForm.sales_close_at).getTime();
      const draw = new Date(createForm.draw_at).getTime();

      if (close <= open) return "Sales closing time must be after sales opening time.";
      if (draw < close) return "Draw time must be on or after the sales closing time.";
    }

    if (step === 3) {
      if (Number(createForm.ticket_price) <= 0) return "Ticket price must be more than £0.";
      if (Number(createForm.minimum_age) !== REQUIRED_MINIMUM_AGE) return "All Burton Pride lotteries must be 18+.";

      if (createForm.max_tickets && Number(createForm.max_tickets) <= 0) {
        return "Maximum tickets must be more than 0.";
      }
    }

    if (step === 4) {
      if (!createForm.promoting_society_legal_name.trim()) {
        return "Enter the promoting society legal name.";
      }

      if (!createForm.registration_licence_type.trim()) {
        return "Enter the registration or licence type.";
      }

      if (!createForm.licensing_authority.trim()) {
        return "Enter the licensing authority.";
      }

      if (!createForm.responsible_promoter_name.trim()) {
        return "Enter the responsible promoter name.";
      }

      if (!createForm.responsible_promoter_address.trim()) {
        return "Enter the responsible promoter address.";
      }

      if (!createForm.geographic_eligibility.trim()) {
        return "Enter geographic eligibility.";
      }
    }

    return null;
  }

  function nextCreateStep() {
    const validation = validateCreateStep(createStep);

    if (validation) {
      setCreateError(validation);
      return;
    }

    setCreateError(null);
    setCreateStep((step) => Math.min(5, step + 1));
  }

  function resetCreateForm() {
    setCreateForm((prev) => ({
      ...prev,
      title: "",
      slug: "",
      internal_reference: "",
      short_summary: "",
      description: "",
      fundraising_purpose: "",
      publication_at: "",
      sales_open_at: "",
      sales_close_at: "",
      draw_at: "",
      results_publish_at: "",
    }));
  }

  async function submitCreateLottery() {
    const validation = validateCreateStep(4);

    if (validation) {
      setCreateError(validation);
      setCreateStep(4);
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const payload = {
        ...createForm,
        ticket_price: Number(createForm.ticket_price),
        minimum_age: REQUIRED_MINIMUM_AGE,
        max_tickets: createForm.max_tickets ? Number(createForm.max_tickets) : null,
        maximum_proceeds: createForm.maximum_proceeds
          ? Number(createForm.maximum_proceeds)
          : null,
        maximum_prize_value: createForm.maximum_prize_value
          ? Number(createForm.maximum_prize_value)
          : null,
        publication_at: createForm.publication_at || null,
        sales_open_at: createForm.sales_open_at || null,
        sales_close_at: createForm.sales_close_at || null,
        draw_at: createForm.draw_at || null,
        results_publish_at: createForm.results_publish_at || null,
      };

      const res = await fetch(LOTTERY_API_ROUTE, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const raw = await res.text();
      let data: any = null;

      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }

      if (!res.ok || !data?.ok) {
        throw new Error(
          data?.error || data?.message || "Failed to create lottery.",
        );
      }

      setCreateOpen(false);
      setCreateStep(1);
      resetCreateForm();
      await loadDashboard(true);
    } catch (err: any) {
      setCreateError(err?.message || "Failed to create lottery.");
    } finally {
      setCreating(false);
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
      <div className="flex min-h-[50vh] w-full items-center justify-center">
        <div className="flex items-center gap-3 text-white/65">
          <Loader2 className="animate-spin" size={23} />
          <span className="font-bold">
            Loading Lottery Management…
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
        <div className="mb-7 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
          <p className="pt-6 pl-5 text-sm font-black uppercase tracking-[0.22em] text-purple-300 sm:pt-7 sm:pl-7 lg:pt-8 lg:pl-8">
        Burton Pride Admin Portal
            </p>
            
            <h1 className="pl-5 mt-2 text-3xl font-black tracking-tight sm:pl-7 sm:text-4xl lg:pl-8">
                Lottery Management
                </h1>
                <p className="pl-5 mt-3 max-w-4xl text-sm leading-6 text-white/55 sm:pl-7 sm:text-base lg:pl-8">
                Manage lotteries, entries, tickets, prizes, draws,
                winners, reporting, compliance and audit history from
                one application.
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
          <div className="mb-7 rounded-3xl border border-red-500/25 bg-red-500/10 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="mt-0.5 shrink-0 text-red-300"
                size={21}
              />

              <div className="min-w-0 flex-1">
                <p className="font-black text-red-200">{error}</p>

                {details && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-red-300">
                      Detailed admin error
                    </p>

                    <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-red-500/15 bg-black/40 p-4 text-xs leading-5 text-red-100">
                      {details}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Active lotteries"
            value={summary.totalActiveLotteries}
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
            value={summary.paidEntries}
            description="Orders confirmed as paid and eligible for ticket issue."
            icon={Users}
          />

          <StatCard
            title="Tickets issued"
            value={summary.ticketsIssued}
            description="Individual valid ticket records issued."
            icon={WalletCards}
          />

          <StatCard
            title="Payment attention"
            value={summary.pendingOrFailedPayments}
            description="Pending, failed or incomplete payments needing review."
            icon={FileClock}
            warning={summary.pendingOrFailedPayments > 0}
          />

          <StatCard
            title="Unclaimed prizes"
            value={summary.unclaimedPrizes}
            description="Selected prizes still awaiting claim or fulfilment."
            icon={Gift}
            warning={summary.unclaimedPrizes > 0}
          />

          <StatCard
            title="Compliance warnings"
            value={summary.complianceWarnings}
            description="Configuration or threshold warnings requiring attention."
            icon={ShieldCheck}
            warning={summary.complianceWarnings > 0}
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
                No upcoming sales closing dates.
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingClosures.slice(0, 8).map((item) => (
                  <Link
                    key={item.id}
                    href={`/Admin/LotteryManagement/Lotteries/${item.lotteryId}`}
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
                No upcoming draw dates.
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingDraws.slice(0, 8).map((item) => (
                  <Link
                    key={item.id}
                    href={`/Admin/LotteryManagement/Lotteries/${item.lotteryId}`}
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
              <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.05] p-5">
                <div className="flex items-center gap-3">
                  <ClipboardCheck
                    size={20}
                    className="text-emerald-300"
                  />
                  <p className="text-sm font-bold text-emerald-100">
                    No compliance warnings reported.
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
                No recent lottery activity.
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
                        {activity.adminName ||
                          activity.adminEmail ||
                          "Admin"}
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
              { label: "Lotteries", href: "/Admin/LotteryManagement/Lotteries", icon: Ticket },
              { label: "Orders & Entries", href: "/Admin/LotteryManagement/Orders", icon: Users },
              { label: "Tickets", href: "/Admin/LotteryManagement/Tickets", icon: WalletCards },
              { label: "Prizes", href: "/Admin/LotteryManagement/Prizes", icon: Gift },
              { label: "Draws", href: "/Admin/LotteryManagement/Draws", icon: Trophy },
              { label: "Winners", href: "/Admin/LotteryManagement/Winners", icon: Trophy },
              { label: "Reports & Exports", href: "/Admin/LotteryManagement/Reports", icon: FileText },
              { label: "Compliance", href: "/Admin/LotteryManagement/Compliance", icon: ShieldCheck },
              { label: "Audit Logs", href: "/Admin/LotteryManagement/AuditLogs", icon: History },
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

      {bugReportOpen ? (
        <div
          className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/70 p-3 backdrop-blur-xl sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lottery-bug-report-title"
        >
          <button
            type="button"
            aria-label="Close bug report"
            className="absolute inset-0 cursor-default"
            disabled={bugSubmitting}
            onClick={closeBugReport}
          />

          <div className="relative max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-[1.5rem] border border-white/10 bg-[#11111f] shadow-2xl sm:rounded-[2rem]">
            <div className="bg-gradient-to-r from-red-500 via-pink-500 to-purple-500 p-1" />

            <div className="p-4 sm:p-6">
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
                    This report is sent directly to the Admin Portal Bug Tracker.
                    It will be recorded as a Lottery Management issue so you can
                    report problems without leaving this application.
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
                <div className="mt-5 rounded-2xl border border-red-300/25 bg-red-500/10 p-4 text-red-50">
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
                <div className="mt-5 rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-5 text-emerald-50">
                  <div className="flex gap-3">
                    <Check className="mt-0.5 h-5 w-5 shrink-0" />

                    <div className="min-w-0">
                      <p className="font-black">
                        Bug report submitted
                      </p>

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
                        value={bugForm.priority}
                        onChange={(event) =>
                          updateBugField(
                            "priority",
                            event.target.value,
                          )
                        }
                        className={inputClass}
                      >
                        <option value="minor">
                          Minor Bug
                        </option>
                        <option value="normal">
                          Normal Issue
                        </option>
                        <option value="senior">
                          Senior / Critical
                        </option>
                      </select>
                    </Field>

                    <Field label="Affected feature">
                      <input
                        value={bugForm.affected_feature}
                        onChange={(event) =>
                          updateBugField(
                            "affected_feature",
                            event.target.value,
                          )
                        }
                        className={inputClass}
                        placeholder="e.g. Dashboard, Tickets, Draws"
                      />
                    </Field>

                    <Field label="Bug title" full required>
                      <input
                        value={bugForm.title}
                        onChange={(event) =>
                          updateBugField(
                            "title",
                            event.target.value,
                          )
                        }
                        className={inputClass}
                        placeholder="Give the problem a short clear title"
                      />
                    </Field>

                    <Field label="Bug description" full required>
                      <textarea
                        value={bugForm.description}
                        onChange={(event) =>
                          updateBugField(
                            "description",
                            event.target.value,
                          )
                        }
                        className={`${inputClass} min-h-28 resize-y`}
                        placeholder="Explain what happened and how it affects Lottery Management."
                      />
                    </Field>

                    <Field label="Steps to reproduce" full>
                      <textarea
                        value={bugForm.steps_to_reproduce}
                        onChange={(event) =>
                          updateBugField(
                            "steps_to_reproduce",
                            event.target.value,
                          )
                        }
                        className={`${inputClass} min-h-24 resize-y`}
                        placeholder="1. Open... 2. Click... 3. The problem appears..."
                      />
                    </Field>

                    <Field label="Expected result">
                      <textarea
                        value={bugForm.expected_result}
                        onChange={(event) =>
                          updateBugField(
                            "expected_result",
                            event.target.value,
                          )
                        }
                        className={`${inputClass} min-h-24 resize-y`}
                        placeholder="What should have happened?"
                      />
                    </Field>

                    <Field label="Actual result" required>
                      <textarea
                        value={bugForm.actual_result}
                        onChange={(event) =>
                          updateBugField(
                            "actual_result",
                            event.target.value,
                          )
                        }
                        className={`${inputClass} min-h-24 resize-y`}
                        placeholder="What happened instead?"
                      />
                    </Field>

                    <Field
                      label="Page URL"
                      full
                      hint="This is filled in automatically from the Lottery Management page you are using."
                    >
                      <input
                        value={bugForm.page_url}
                        onChange={(event) =>
                          updateBugField(
                            "page_url",
                            event.target.value,
                          )
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

                      {bugSubmitting
                        ? "Submitting..."
                        : "Submit bug report"}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {createOpen ? (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm md:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-lottery-title"
        >
          <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#15172a] shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5 md:p-6">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                    <Plus className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 id="create-lottery-title" className="text-xl font-extrabold text-white">
                      Create new lottery
                    </h2>
                    <p className="mt-1 text-sm text-white/55">
                      Create the campaign as a draft. It will not go live until the compliance checks are completed.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={closeCreateModal}
                disabled={creating}
                className="rounded-xl border border-white/10 p-2 text-white/70 hover:bg-white/10 disabled:opacity-50"
                aria-label="Close create lottery"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-white/10 px-5 py-4 md:px-6">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                {[
                  ["1", "Basic"],
                  ["2", "Dates"],
                  ["3", "Tickets"],
                  ["4", "Compliance"],
                  ["5", "Public settings"],
                ].map(([number, label]) => {
                  const active = Number(number) === createStep;
                  const complete = Number(number) < createStep;

                  return (
                    <button
                      key={number}
                      type="button"
                      onClick={() => Number(number) < createStep && setCreateStep(Number(number))}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-bold ${
                        active
                          ? "border-white/30 bg-white text-black"
                          : complete
                            ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                            : "border-white/10 bg-white/5 text-white/45"
                      }`}
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-current/20">
                        {complete ? <Check className="h-3.5 w-3.5" /> : number}
                      </span>
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="overflow-y-auto p-5 md:p-6">
              {createError ? (
                <div className="mb-5 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
                  {createError}
                </div>
              ) : null}

              {createStep === 1 ? (
                <CreateSection
                  icon={<Ticket className="h-5 w-5" />}
                  title="Basic information"
                  description="Set the identity of this reusable lottery campaign."
                >
                  <Field label="Lottery title" required>
                    <input
                      value={createForm.title}
                      onChange={(e) => updateCreateField("title", e.target.value)}
                      className={inputClass}
                      placeholder="e.g. Christmas Raffle 2026"
                    />
                  </Field>

                  <Field label="Unique slug" required hint="Used for the public /Lottery/[slug] page.">
                    <input
                      value={createForm.slug}
                      onChange={(e) => updateCreateField("slug", slugify(e.target.value))}
                      className={inputClass}
                      placeholder="christmas-raffle-2026"
                    />
                  </Field>

                  <Field label="Internal reference / code">
                    <input
                      value={createForm.internal_reference}
                      onChange={(e) => updateCreateField("internal_reference", e.target.value)}
                      className={inputClass}
                      placeholder="BP-LOT-2026-001"
                    />
                  </Field>

                  <Field label="Lottery type / compliance profile" required>
                    <select
                      value={createForm.lottery_type}
                      onChange={(e) => updateCreateField("lottery_type", e.target.value)}
                      className={inputClass}
                    >
                      <option value="small_society">Small society lottery</option>
                      <option value="incidental_event">Incidental event lottery</option>
                      <option value="large_society">Large society lottery</option>
                      <option value="free_draw">Free draw / prize competition</option>
                    </select>
                  </Field>

                  <Field label="Short summary" full>
                    <textarea
                      value={createForm.short_summary}
                      onChange={(e) => updateCreateField("short_summary", e.target.value)}
                      className={`${inputClass} min-h-24`}
                      placeholder="Short summary shown in admin and public previews."
                    />
                  </Field>

                  <Field label="Full description" full>
                    <textarea
                      value={createForm.description}
                      onChange={(e) => updateCreateField("description", e.target.value)}
                      className={`${inputClass} min-h-32`}
                      placeholder="Full lottery description."
                    />
                  </Field>

                  <Field label="Fundraising purpose / good cause" full>
                    <textarea
                      value={createForm.fundraising_purpose}
                      onChange={(e) => updateCreateField("fundraising_purpose", e.target.value)}
                      className={`${inputClass} min-h-24`}
                      placeholder="Explain what the money raised will support."
                    />
                  </Field>
                </CreateSection>
              ) : null}

              {createStep === 2 ? (
                <CreateSection
                  icon={<CalendarDays className="h-5 w-5" />}
                  title="Dates and times"
                  description="Configure publication, sales, draw and result timing."
                >
                  <Field label="Publication date/time">
                    <input
                      type="datetime-local"
                      value={createForm.publication_at}
                      onChange={(e) => updateCreateField("publication_at", e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Sales opening date/time" required>
                    <input
                      type="datetime-local"
                      value={createForm.sales_open_at}
                      onChange={(e) => updateCreateField("sales_open_at", e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Sales closing date/time" required>
                    <input
                      type="datetime-local"
                      value={createForm.sales_close_at}
                      onChange={(e) => updateCreateField("sales_close_at", e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Draw date/time" required>
                    <input
                      type="datetime-local"
                      value={createForm.draw_at}
                      onChange={(e) => updateCreateField("draw_at", e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Results publication date/time">
                    <input
                      type="datetime-local"
                      value={createForm.results_publish_at}
                      onChange={(e) => updateCreateField("results_publish_at", e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Timezone">
                    <select
                      value={createForm.timezone}
                      onChange={(e) => updateCreateField("timezone", e.target.value)}
                      className={inputClass}
                    >
                      <option value="Europe/London">Europe/London (UK)</option>
                    </select>
                  </Field>
                </CreateSection>
              ) : null}

              {createStep === 3 ? (
                <CreateSection
                  icon={<PoundSterling className="h-5 w-5" />}
                  title="Ticket setup"
                  description="Set fixed ticket pricing and entry limits."
                >
                  <Field label="Ticket price" required>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={createForm.ticket_price}
                      onChange={(e) => updateCreateField("ticket_price", e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Currency">
                    <select
                      value={createForm.currency}
                      onChange={(e) => updateCreateField("currency", e.target.value)}
                      className={inputClass}
                    >
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </Field>

                  <Field label="Maximum tickets">
                    <input
                      type="number"
                      min="1"
                      value={createForm.max_tickets}
                      onChange={(e) => updateCreateField("max_tickets", e.target.value)}
                      className={inputClass}
                      placeholder="Optional"
                    />
                  </Field>

                  <Field label="Minimum participant age">
                    <div className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3">
                      <div>
                        <div className="text-base font-extrabold text-emerald-100">
                          18+ only
                        </div>
                        <div className="mt-1 text-xs font-medium text-emerald-100/65">
                          Fixed for every Burton Pride lottery and cannot be changed.
                        </div>
                      </div>
                      <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-200" />
                    </div>
                  </Field>

                  <div className="md:col-span-2 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
                    For profiles that require equal ticket pricing, quantity options must use the same individual ticket price. The system should not create discounted per-ticket bundles.
                  </div>
                </CreateSection>
              ) : null}

              {createStep === 4 ? (
                <CreateSection
                  icon={<ShieldCheck className="h-5 w-5" />}
                  title="Compliance"
                  description="Record the legal and operational details required before publication."
                >
                  <Field label="Promoting society legal name" required>
                    <input
                      value={createForm.promoting_society_legal_name}
                      onChange={(e) => updateCreateField("promoting_society_legal_name", e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Registration / licence type" required>
                    <input
                      value={createForm.registration_licence_type}
                      onChange={(e) => updateCreateField("registration_licence_type", e.target.value)}
                      className={inputClass}
                      placeholder="e.g. Local authority registration"
                    />
                  </Field>

                  <Field label="Registration / licence number">
                    <input
                      value={createForm.registration_licence_number}
                      onChange={(e) => updateCreateField("registration_licence_number", e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Licensing authority" required>
                    <input
                      value={createForm.licensing_authority}
                      onChange={(e) => updateCreateField("licensing_authority", e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Responsible promoter name" required>
                    <input
                      value={createForm.responsible_promoter_name}
                      onChange={(e) => updateCreateField("responsible_promoter_name", e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Geographic eligibility" required>
                    <input
                      value={createForm.geographic_eligibility}
                      onChange={(e) => updateCreateField("geographic_eligibility", e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Responsible promoter address" full required>
                    <textarea
                      value={createForm.responsible_promoter_address}
                      onChange={(e) => updateCreateField("responsible_promoter_address", e.target.value)}
                      className={`${inputClass} min-h-24`}
                    />
                  </Field>

                  <Field label="Terms version">
                    <input
                      value={createForm.terms_version}
                      onChange={(e) => updateCreateField("terms_version", e.target.value)}
                      className={inputClass}
                      placeholder="e.g. 2026-08-v1"
                    />
                  </Field>

                  <Field label="Privacy notice version">
                    <input
                      value={createForm.privacy_notice_version}
                      onChange={(e) => updateCreateField("privacy_notice_version", e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Maximum proceeds">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={createForm.maximum_proceeds}
                      onChange={(e) => updateCreateField("maximum_proceeds", e.target.value)}
                      className={inputClass}
                      placeholder="Profile limit"
                    />
                  </Field>

                  <Field label="Maximum prize value">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={createForm.maximum_prize_value}
                      onChange={(e) => updateCreateField("maximum_prize_value", e.target.value)}
                      className={inputClass}
                      placeholder="Profile limit"
                    />
                  </Field>

                  <Field label="Required ticket wording" full>
                    <textarea
                      value={createForm.required_ticket_wording}
                      onChange={(e) => updateCreateField("required_ticket_wording", e.target.value)}
                      className={`${inputClass} min-h-24`}
                    />
                  </Field>

                  <Field label="Responsible gambling information" full>
                    <textarea
                      value={createForm.responsible_gambling_info}
                      onChange={(e) => updateCreateField("responsible_gambling_info", e.target.value)}
                      className={`${inputClass} min-h-24`}
                    />
                  </Field>

                  <div className="md:col-span-2 rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4 text-sm leading-6 text-blue-100">
                    Creating the lottery does not approve compliance. The campaign will be saved as a Draft and must pass the publication compliance gate before it can be made Live.
                  </div>
                </CreateSection>
              ) : null}

              {createStep === 5 ? (
                <CreateSection
                  icon={<Settings2 className="h-5 w-5" />}
                  title="Public settings"
                  description="Choose what the public lottery page may display."
                >
                  <ToggleField
                    label="Show in public lottery directory"
                    checked={createForm.show_in_directory}
                    onChange={(v) => updateCreateField("show_in_directory", v)}
                  />
                  <ToggleField
                    label="Allow page before sales open"
                    checked={createForm.allow_page_before_sales}
                    onChange={(v) => updateCreateField("allow_page_before_sales", v)}
                  />
                  <ToggleField
                    label="Show tickets sold"
                    checked={createForm.show_ticket_count}
                    onChange={(v) => updateCreateField("show_ticket_count", v)}
                  />
                  <ToggleField
                    label="Show amount raised"
                    checked={createForm.show_amount_raised}
                    onChange={(v) => updateCreateField("show_amount_raised", v)}
                  />
                  <ToggleField
                    label="Show remaining tickets"
                    checked={createForm.show_remaining_tickets}
                    onChange={(v) => updateCreateField("show_remaining_tickets", v)}
                  />
                  <ToggleField
                    label="Show prize values"
                    checked={createForm.show_prize_values}
                    onChange={(v) => updateCreateField("show_prize_values", v)}
                  />
                  <ToggleField
                    label="Enable sales-close countdown"
                    checked={createForm.countdown_enabled}
                    onChange={(v) => updateCreateField("countdown_enabled", v)}
                  />

                  <Field label="Public winner display">
                    <select
                      value={createForm.winner_display_mode}
                      onChange={(e) => updateCreateField("winner_display_mode", e.target.value)}
                      className={inputClass}
                    >
                      <option value="full_name">Full name</option>
                      <option value="first_name">First name only</option>
                      <option value="ticket_number">Ticket number only</option>
                      <option value="none">Do not show winner identity</option>
                    </select>
                  </Field>

                  <div className="md:col-span-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-5">
                    <div className="flex items-start gap-3">
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200" />
                      <div>
                        <h3 className="font-bold text-emerald-100">Ready to create the draft</h3>
                        <p className="mt-1 text-sm leading-6 text-emerald-100/75">
                          This will create the lottery record and reserve the slug. It will remain Draft until the separate compliance approval and publishing process is completed.
                        </p>
                      </div>
                    </div>
                  </div>
                </CreateSection>
              ) : null}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between md:px-6">
              <button
                type="button"
                onClick={() => {
                  setCreateError(null);
                  setCreateStep((step) => Math.max(1, step - 1));
                }}
                disabled={createStep === 1 || creating}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 px-5 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={creating}
                  className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-bold text-white/80 hover:bg-white/10 disabled:opacity-50"
                >
                  Cancel
                </button>

                {createStep < 5 ? (
                  <button
                    type="button"
                    onClick={nextCreateStep}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-black hover:opacity-90"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={submitCreateLottery}
                    disabled={creating}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-black hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    {creating ? "Creating draft..." : "Create draft lottery"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


const inputClass =
  "w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/25";

function CreateSection({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white">
          {icon}
        </div>
        <div>
          <h3 className="text-lg font-extrabold text-white">{title}</h3>
          <p className="mt-1 text-sm text-white/50">{description}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

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
      {hint ? <span className="mt-2 block text-xs text-white/40">{hint}</span> : null}
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-4">
      <span className="text-sm font-semibold text-white/80">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5"
      />
    </label>
  );
}
