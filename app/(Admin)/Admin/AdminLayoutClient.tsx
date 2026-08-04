"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import {
  AdminProvider,
  useAdmin,
  type AdminRole,
} from "./components/providers/AdminProvider";
import AdminSidebar from "./components/rooting/AdminSidebar";

const ALL_PERMISSION_KEYS = [
  "admin:dashboard:view",
  "admin:users:manage",

  "event_hub:view",
  "event_hub:manage",

  "contacts:view",
  "contacts:manage",

  "email:view",
  "email:send",
  "email:manage_templates",

  "money:view",
  "money:add_transactions",
  "money:edit_transactions",
  "money:edit_old_years",
  "money:hide_transactions",
  "money:delete_all",
  "money:delete_year",
  "money:manage_year_locks",
  "money:manage_sponsors",
  "money:change_sponsor_totals",
  "money:sync_website_payments",
  "money:print_reports",
  "money:export_reports",
  "money:manage_refunds",

  "donations:view",
  "donations:manage",

  "raffle:view",
  "raffle:manage",
  "raffle:draw_winners",

  "site_pages:view",
  "site_pages:manage",

  "audit_logs:view",
];

const AUTH_ROUTES = [
  "/admin/login",
  "/admin/logout",
  "/admin/forgot-password",
  "/admin/reset-password",
  "/admin/change-password",
];

const EVENT_HUB_PREFIX = "/admin/eventhub";
const DASHBOARD_PREFIX = "/admin/dashboard";
const EMAIL_PREFIX = "/admin/email";
const MONEY_PREFIX = "/admin/money";
const MONEY_MANAGEMENT_PREFIX = "/admin/moneymanagement";
const STOCK_MANAGEMENT_PREFIX = "/admin/stockmanagement";
const BUG_TRACKER_PREFIX = "/admin/bugtracker";

type AuditRiskLevel = "low" | "medium" | "high" | "critical";

type AuditReportInput = {
  action: string;
  area: string;
  route?: string | null;
  method?: string;
  status?: string;
  risk_level?: AuditRiskLevel;
  target_type?: string | null;
  target_id?: string | null;
  target_label?: string | null;
  metadata?: Record<string, unknown>;
};

function normalisePath(pathname: string | null | undefined) {
  const path = String(pathname || "")
    .trim()
    .toLowerCase()
    .replace(/\/+$/, "");

  return path || "/";
}

function isPathOrChild(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

function isAuthRoute(path: string) {
  return AUTH_ROUTES.some((route) => isPathOrChild(path, route));
}

function getSafeNextPath(pathname: string | null | undefined) {
  const raw = String(pathname || "/Admin/Dashboard").trim();

  if (!raw.startsWith("/Admin")) return "/Admin/Dashboard";
  if (raw.startsWith("//")) return "/Admin/Dashboard";
  if (raw.includes("\\")) return "/Admin/Dashboard";
  if (raw.toLowerCase().startsWith("/admin/login")) return "/Admin/Dashboard";

  return raw;
}

function getLoginPath(pathname: string | null | undefined) {
  const next = getSafeNextPath(pathname);

  return `/Admin/Login?next=${encodeURIComponent(next)}`;
}

function getAuditArea(pathname: string | null | undefined) {
  const path = normalisePath(pathname);

  if (isAuthRoute(path)) return "auth";
  if (isPathOrChild(path, EVENT_HUB_PREFIX)) return "event_hub";
  if (isPathOrChild(path, EMAIL_PREFIX)) return "email";

  if (
    isPathOrChild(path, MONEY_PREFIX) ||
    isPathOrChild(path, MONEY_MANAGEMENT_PREFIX) ||
    isPathOrChild(path, "/admin/dashboard/money")
  ) {
    return "money";
  }

  if (isPathOrChild(path, "/admin/dashboard/users")) return "admin_users";
  if (isPathOrChild(path, "/admin/dashboard/logs")) return "audit_logs";
  if (isPathOrChild(path, "/admin/dashboard/donations")) return "donations";
  if (isPathOrChild(path, "/admin/dashboard/raffle")) return "raffle";
  if (isPathOrChild(path, "/admin/dashboard/settings/pageeditor")) {
    return "site_pages";
  }
  if (isPathOrChild(path, "/admin/dashboard/pageeditor")) {
    return "site_pages";
  }
  if (isPathOrChild(path, DASHBOARD_PREFIX)) return "dashboard";

  return "admin_portal";
}

function getRequiredPermission(pathname: string | null | undefined) {
  const path = normalisePath(pathname);

  if (!path || path === "/") return null;
  if (isAuthRoute(path)) return null;

  /**
   * Event Hub keeps its own layout/sidebar,
   * but it is still protected and reported by this Admin layout.
   */
  if (isPathOrChild(path, EVENT_HUB_PREFIX)) {
    return "event_hub:view";
  }

  if (isPathOrChild(path, "/admin/dashboard/settings/pageeditor")) {
    return "site_pages:manage";
  }

  if (isPathOrChild(path, "/admin/dashboard/pageeditor")) {
    return "site_pages:manage";
  }

  if (isPathOrChild(path, "/admin/dashboard/users")) {
    return "admin:users:manage";
  }

  if (isPathOrChild(path, "/admin/dashboard/logs")) {
    return "audit_logs:view";
  }

  if (isPathOrChild(path, "/admin/dashboard/donations")) {
    return "donations:view";
  }

  if (isPathOrChild(path, "/admin/dashboard/raffle")) {
    return "raffle:view";
  }

  if (isPathOrChild(path, EMAIL_PREFIX)) {
    return "email:view";
  }

  if (
    isPathOrChild(path, MONEY_PREFIX) ||
    isPathOrChild(path, MONEY_MANAGEMENT_PREFIX) ||
    isPathOrChild(path, "/admin/dashboard/money")
  ) {
    return "money:view";
  }

  if (isPathOrChild(path, DASHBOARD_PREFIX)) {
    return "admin:dashboard:view";
  }

  return null;
}

function getFirstAllowedPage(
  permissions: string[],
  adminRole: AdminRole | null,
) {
  if (adminRole === "main_admin") return "/Admin/Dashboard";

  if (permissions.includes("admin:dashboard:view")) {
    return "/Admin/Dashboard";
  }

  if (permissions.includes("money:view")) {
    return "/Admin/MoneyManagement/TrackingMoney";
  }

  if (permissions.includes("email:view")) {
    return "/Admin/Email/Sending";
  }

  if (permissions.includes("event_hub:view")) {
    return "/Admin/BurtonPrideEventHub";
  }

  if (permissions.includes("donations:view")) {
    return "/Admin/Dashboard/Donations";
  }

  if (permissions.includes("raffle:view")) {
    return "/Admin/Dashboard/Raffle";
  }

  if (
    permissions.includes("site_pages:view") ||
    permissions.includes("site_pages:manage")
  ) {
    return "/Admin/Dashboard/Settings/PageEditor";
  }

  if (permissions.includes("audit_logs:view")) {
    return "/Admin/Dashboard/Logs";
  }

  return null;
}

function hasPermission(
  permissions: string[],
  adminRole: AdminRole | null,
  permission: string,
) {
  if (adminRole === "main_admin") return true;
  return permissions.includes(permission);
}

async function reportAdminAudit(input: AuditReportInput) {
  try {
    await fetch("/api/admin/audit-log/report", {
      method: "POST",
      cache: "no-store",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  } catch (error) {
    console.warn("Audit report failed:", error);
  }
}

function AdminStatusScreen({
  label,
  title,
  message,
  tone = "default",
  children,
}: {
  label: string;
  title: string;
  message?: string;
  tone?: "default" | "error" | "warning" | "success";
  children?: ReactNode;
}) {
  const toneClasses = {
    default: "border-white/15 bg-white/10 text-white",
    error: "border-red-300/25 bg-red-500/10 text-red-50",
    warning: "border-amber-300/25 bg-amber-500/10 text-amber-50",
    success: "border-emerald-300/25 bg-emerald-500/10 text-emerald-50",
  };

  const Icon =
    tone === "error"
      ? AlertTriangle
      : tone === "warning"
        ? Lock
        : tone === "success"
          ? ShieldCheck
          : Loader2;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 text-white">
      <div className="flex min-h-screen items-center justify-center px-4">
        <div
          className={[
            "max-w-lg rounded-3xl border p-6 text-center shadow-2xl shadow-black/20 backdrop-blur-xl",
            toneClasses[tone],
          ].join(" ")}
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
            <Icon
              className={[
                "h-6 w-6",
                tone === "default" ? "animate-spin" : "",
              ].join(" ")}
            />
          </div>

          <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-white/65">
            {label}
          </p>

          <h1 className="mt-2 text-2xl font-black text-white">{title}</h1>

          {message ? (
            <p className="mt-3 text-sm leading-6 text-white/75">{message}</p>
          ) : null}

          {children ? <div className="mt-5">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}

function LoadingPermissionsScreen() {
  return (
    <AdminStatusScreen
      label="Admin Portal"
      title="Loading admin access..."
      message="Checking your admin session and permissions."
    />
  );
}

function PermissionErrorScreen({
  error,
  refreshAdmin,
}: {
  error: string;
  refreshAdmin: () => Promise<void>;
}) {
  return (
    <AdminStatusScreen
      label="Admin Portal"
      title="Could not load admin access"
      message={error}
      tone="error"
    >
      <button
        type="button"
        onClick={() => void refreshAdmin()}
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/25"
      >
        <RefreshCw className="h-4 w-4" />
        Try again
      </button>
    </AdminStatusScreen>
  );
}

function RedirectingScreen() {
  return (
    <AdminStatusScreen
      label="Restricted Access"
      title="Redirecting..."
      message="You do not have access to this page, so we are sending you to a page you can use."
      tone="warning"
    />
  );
}

function NoAccessScreen() {
  return (
    <AdminStatusScreen
      label="Restricted Access"
      title="You do not have access to any admin pages"
      message="Ask a main admin to update your permissions in Admin Users."
      tone="warning"
    >
      <Link
        href="/Admin/Login"
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/25"
      >
        Back to login
        <ArrowRight className="h-4 w-4" />
      </Link>
    </AdminStatusScreen>
  );
}

function AdminLayoutGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const lastPageViewAuditRef = useRef("");
  const lastPermissionDeniedAuditRef = useRef("");
  const lastUnauthenticatedAuditRef = useRef("");
  const lastAccessErrorAuditRef = useRef("");

  const {
    admin,
    adminEmail,
    adminName,
    adminRole,
    permissions,
    isMainAdmin,
    loading,
    refreshing,
    status,
    error,
    refreshAdmin,
  } = useAdmin();

  const path = normalisePath(pathname);

  const isAuthPage = isAuthRoute(path);
  const isDashboardRoute = isPathOrChild(path, DASHBOARD_PREFIX);
  const isEmailRoute = isPathOrChild(path, EMAIL_PREFIX);
  const isMoneyRoute =
    isPathOrChild(path, MONEY_PREFIX) ||
    isPathOrChild(path, MONEY_MANAGEMENT_PREFIX);
  const isEventHubRoute = isPathOrChild(path, EVENT_HUB_PREFIX);

  const requiredPermission = useMemo(
    () => getRequiredPermission(pathname),
    [pathname],
  );

  const safePermissions = useMemo(() => {
    return isMainAdmin || adminRole === "main_admin"
      ? ALL_PERMISSION_KEYS
      : permissions;
  }, [adminRole, isMainAdmin, permissions]);

  const canAccessCurrentPage = useMemo(() => {
    if (!requiredPermission) return true;

    return hasPermission(safePermissions, adminRole, requiredPermission);
  }, [adminRole, requiredPermission, safePermissions]);

  const fallbackPage = useMemo(() => {
    return getFirstAllowedPage(safePermissions, adminRole);
  }, [adminRole, safePermissions]);

  useEffect(() => {
    document.title = isDashboardRoute
      ? "Burton Pride Admin Portal"
      : isEmailRoute
        ? "Burton Pride Email Centre"
        : isMoneyRoute
          ? "Burton Pride Money Management"
          : isEventHubRoute
            ? "Burton Pride Event Hub"
            : "Burton Pride Admin Portal";
  }, [isDashboardRoute, isEmailRoute, isMoneyRoute, isEventHubRoute]);

  /**
   * Report successful admin page views.
   */
  useEffect(() => {
    if (isAuthPage) return;
    if (loading) return;
    if (status !== "authenticated") return;
    if (!admin) return;
    if (!canAccessCurrentPage) return;

    const route = pathname || "/Admin/Dashboard";
    const auditKey = [
      "page_view",
      route,
      adminEmail || "unknown",
      requiredPermission || "none",
    ].join("|");

    if (lastPageViewAuditRef.current === auditKey) return;
    lastPageViewAuditRef.current = auditKey;

    void reportAdminAudit({
      action: "page_view",
      area: getAuditArea(route),
      route,
      method: "CLIENT",
      status: "success",
      risk_level: "low",
      metadata: {
        required_permission: requiredPermission,
        admin_role: adminRole,
        admin_email: adminEmail,
        admin_name: adminName,
        is_main_admin: isMainAdmin,
      },
    });
  }, [
    admin,
    adminEmail,
    adminName,
    adminRole,
    canAccessCurrentPage,
    isAuthPage,
    isMainAdmin,
    loading,
    pathname,
    requiredPermission,
    status,
  ]);

  /**
   * Report unauthenticated attempts to open admin pages.
   */
  useEffect(() => {
    if (isAuthPage) return;
    if (loading) return;
    if (status === "loading") return;
    if (status !== "unauthenticated") return;

    const route = pathname || "/Admin/Dashboard";
    const auditKey = ["unauthenticated", route].join("|");

    if (lastUnauthenticatedAuditRef.current === auditKey) return;
    lastUnauthenticatedAuditRef.current = auditKey;

    void reportAdminAudit({
      action: "unauthenticated_admin_access",
      area: getAuditArea(route),
      route,
      method: "CLIENT",
      status: "blocked",
      risk_level: "high",
      metadata: {
        reason: "admin_session_missing_or_expired",
      },
    });

    router.replace(getLoginPath(pathname));
  }, [isAuthPage, loading, pathname, router, status]);

  /**
   * Report admin permission loading errors.
   */
  useEffect(() => {
    if (isAuthPage) return;
    if (loading) return;
    if (status !== "error") return;

    const route = pathname || "/Admin/Dashboard";
    const auditKey = ["access_error", route, error || "unknown"].join("|");

    if (lastAccessErrorAuditRef.current === auditKey) return;
    lastAccessErrorAuditRef.current = auditKey;

    void reportAdminAudit({
      action: "admin_access_check_failed",
      area: getAuditArea(route),
      route,
      method: "CLIENT",
      status: "error",
      risk_level: "medium",
      metadata: {
        error: error || "Failed to load admin access.",
      },
    });
  }, [error, isAuthPage, loading, pathname, status]);

  /**
   * Report permission denied and then redirect to the first allowed page.
   */
  useEffect(() => {
    if (isAuthPage) return;
    if (loading) return;
    if (status !== "authenticated") return;
    if (!admin) return;
    if (canAccessCurrentPage) return;

    const route = pathname || "/Admin/Dashboard";
    const auditKey = [
      "permission_denied",
      route,
      adminEmail || "unknown",
      requiredPermission || "none",
    ].join("|");

    if (lastPermissionDeniedAuditRef.current !== auditKey) {
      lastPermissionDeniedAuditRef.current = auditKey;

      void reportAdminAudit({
        action: "permission_denied",
        area: getAuditArea(route),
        route,
        method: "CLIENT",
        status: "blocked",
        risk_level: "medium",
        metadata: {
          required_permission: requiredPermission,
          fallback_page: fallbackPage,
          admin_role: adminRole,
          admin_email: adminEmail,
          admin_name: adminName,
          is_main_admin: isMainAdmin,
        },
      });
    }

    if (fallbackPage && normalisePath(pathname) !== normalisePath(fallbackPage)) {
      router.replace(fallbackPage);
    }
  }, [
    admin,
    adminEmail,
    adminName,
    adminRole,
    canAccessCurrentPage,
    fallbackPage,
    isAuthPage,
    isMainAdmin,
    loading,
    pathname,
    requiredPermission,
    router,
    status,
  ]);

  /**
   * Auth pages should render without the admin shell.
   */
  if (isAuthPage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 text-white">
        {children}
      </div>
    );
  }

  if (loading || status === "loading") {
    return <LoadingPermissionsScreen />;
  }

  if (status === "unauthenticated") {
    return (
      <AdminStatusScreen
        label="Admin Portal"
        title="Redirecting to login..."
        message="Your admin session has expired or you are not signed in."
      />
    );
  }

  if (status === "error") {
    return (
      <PermissionErrorScreen
        error={error || "Failed to load admin access."}
        refreshAdmin={refreshAdmin}
      />
    );
  }

  if (!admin) {
    return (
      <AdminStatusScreen
        label="Admin Portal"
        title="Admin session missing"
        message="Please log in again to continue."
        tone="warning"
      >
        <Link
          href={getLoginPath(pathname)}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/25"
        >
          Go to login
          <ArrowRight className="h-4 w-4" />
        </Link>
      </AdminStatusScreen>
    );
  }

  if (!canAccessCurrentPage) {
    if (fallbackPage) {
      return <RedirectingScreen />;
    }

    return <NoAccessScreen />;
  }

  /**
   * Money, Email and Event Hub have their own layouts/sidebars.
   * This layout now protects them and reports audit logs,
   * but does not force the dashboard sidebar onto them.
   */
  if (isMoneyRoute || isEmailRoute || isEventHubRoute) {
    return <>{children}</>;
  }

  const showAdminNav = Boolean(isDashboardRoute);
  const displayName = adminName || adminEmail || "Committee Member";

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 text-white">
      <div className="flex min-h-screen flex-col md:flex-row">
        {showAdminNav ? (
          <AdminSidebar
            permissions={safePermissions}
            adminRole={adminRole}
            adminEmail={adminEmail}
            adminName={displayName}
          />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          {showAdminNav ? (
            <header className="hidden h-16 items-center justify-between border-b border-white/10 bg-white/10 px-8 shadow-sm backdrop-blur-xl md:flex">
              <div>
                <div className="font-semibold text-white/90">Admin Portal</div>
                {refreshing ? (
                  <div className="text-xs font-semibold text-white/45">
                    Refreshing admin access...
                  </div>
                ) : null}
              </div>

              <div className="text-sm text-white/80">
                Signed in as{" "}
                <span className="font-semibold">{displayName}</span>
              </div>
            </header>
          ) : null}

          <main className="flex-1 px-4 py-6 md:px-8 md:py-10">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default function AdminLayoutClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const path = normalisePath(pathname);

  /**
   * Stock Management and Bug Tracker are fully separate admin apps.
   *
   * Nothing in this main Admin layout controls routes under:
   * /Admin/StockManagement
   * /Admin/BugTracker
   *
   * These sections use their own page or nested layout for their sidebar,
   * authentication, permissions, audit logging, page title, width,
   * background and styling.
   */
  const usesSeparateAdminLayout =
    isPathOrChild(path, STOCK_MANAGEMENT_PREFIX) ||
    isPathOrChild(path, BUG_TRACKER_PREFIX);

  if (usesSeparateAdminLayout) {
    return <>{children}</>;
  }

  return (
    <AdminProvider>
      <AdminLayoutGate>{children}</AdminLayoutGate>
    </AdminProvider>
  );
}
