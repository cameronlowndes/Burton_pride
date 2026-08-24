"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  FileClock,
  FileText,
  Gift,
  History,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Ticket,
  Trophy,
  Users,
  WalletCards,
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
  success: boolean;
  summary?: Partial<DashboardSummary>;
  upcoming?: UpcomingItem[];
  complianceWarnings?: ComplianceWarning[];
  recentActivity?: RecentActivity[];
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

  useEffect(() => {
    void loadDashboard(false);
  }, []);

  async function loadDashboard(isRefresh: boolean) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);
    setDetails(null);

    try {
      const response = await fetch(
        "/api/admin/lottery/dashboard",
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        },
      );

      const body = (await response.json().catch(() => null)) as
        | DashboardResponse
        | null;

      if (!response.ok || !body?.success) {
        throw new Error(
          body?.details ||
            body?.error ||
            `Dashboard request failed with HTTP ${response.status}`,
        );
      }

      setSummary({
        ...EMPTY_SUMMARY,
        ...(body.summary ?? {}),
      });
      setUpcoming(body.upcoming ?? []);
      setWarnings(body.complianceWarnings ?? []);
      setRecentActivity(body.recentActivity ?? []);
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

            <Link
              href="/Admin/LotteryManagement/Lotteries/New"
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
            </Link>
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
                        /lottery/{item.slug}
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
                        /lottery/{item.slug}
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
    </div>
  );
}
