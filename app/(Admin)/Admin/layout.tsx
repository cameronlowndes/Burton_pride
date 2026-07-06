"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AdminProvider } from "./components/providers/AdminProvider";
import AdminSidebar from "./components/rooting/AdminSidebar";

type AdminRole = "main_admin" | "admin" | "editor";

type AdminPermissionResponse = {
  ok: boolean;
  admin?: {
    id: string;
    email: string | null;
    role: AdminRole;
    is_active: boolean;
    permissions: string[];
  };
  permissions?: string[];
  error?: string;
};

const ALL_PERMISSION_KEYS = [
  "admin:dashboard:view",
  "admin:users:manage",
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
  "donations:view",
  "donations:manage",
  "raffle:view",
  "raffle:manage",
  "raffle:draw_winners",
  "site_pages:view",
  "site_pages:manage",
  "audit_logs:view",
];

function hasPermission(
  permissions: string[],
  adminRole: AdminRole | null,
  permission: string,
) {
  if (adminRole === "main_admin") return true;
  return permissions.includes(permission);
}

function normalisePath(pathname: string | null) {
  return String(pathname || "").toLowerCase();
}

function getRequiredPermission(pathname: string | null) {
  const path = normalisePath(pathname);

  if (!path || path === "/admin/login") return null;

  /**
   * IMPORTANT:
   * Burton Pride Event Hub must not be controlled by this Admin layout.
   * It should use its own layout, sidebar, title, permissions and routing.
   */
  if (path.startsWith("/admin/burtonprideeventhub")) {
    return null;
  }

  if (path.startsWith("/admin/dashboard/settings/pageeditor")) {
    return "site_pages:manage";
  }

  if (path.startsWith("/admin/dashboard/pageeditor")) {
    return "site_pages:manage";
  }

  if (path.startsWith("/admin/dashboard/logs")) return "audit_logs:view";
  if (path.startsWith("/admin/dashboard/donations")) return "donations:view";
  if (path.startsWith("/admin/dashboard/raffle")) return "raffle:view";

  /**
   * Covers:
   * /Admin/Money
   * /Admin/MoneyManagement
   * /Admin/MoneyManagement/TrackingMoney
   */
  if (path.startsWith("/admin/money")) return "money:view";

  if (path.startsWith("/admin/dashboard/money")) return "money:view";
  if (path.startsWith("/admin/dashboard/users")) return "admin:users:manage";
  if (path.startsWith("/admin/dashboard")) return "admin:dashboard:view";

  return null;
}

function getFirstAllowedPage(
  permissions: string[],
  adminRole: AdminRole | null,
) {
  if (adminRole === "main_admin") return "/Admin/Dashboard";
  if (permissions.includes("admin:dashboard:view")) return "/Admin/Dashboard";
  if (permissions.includes("money:view")) return "/Admin/Money";
  if (permissions.includes("donations:view")) return "/Admin/Dashboard/Donations";
  if (permissions.includes("raffle:view")) return "/Admin/Dashboard/Raffle";

  if (
    permissions.includes("site_pages:view") ||
    permissions.includes("site_pages:manage")
  ) {
    return "/Admin/Dashboard/Settings/PageEditor";
  }

  if (permissions.includes("audit_logs:view")) return "/Admin/Dashboard/Logs";

  return null;
}

function LoadingPermissionsScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 text-white">
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="rounded-3xl border border-white/15 bg-white/10 p-6 text-center shadow-2xl shadow-black/20 backdrop-blur-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/60">
            Admin Portal
          </p>
          <h1 className="mt-2 text-2xl font-black text-white">
            Loading permissions...
          </h1>
        </div>
      </div>
    </div>
  );
}

function PermissionErrorScreen({
  permissionsError,
}: {
  permissionsError: string;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 text-white">
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-lg rounded-3xl border border-red-300/25 bg-red-500/10 p-6 text-center shadow-2xl shadow-black/20 backdrop-blur-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-100/70">
            Admin Portal
          </p>

          <h1 className="mt-2 text-2xl font-black text-white">
            Could not load permissions
          </h1>

          <p className="mt-3 text-sm leading-6 text-white/70">
            {permissionsError}
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-2xl bg-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/25"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

function RedirectingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 text-white">
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="rounded-3xl border border-white/15 bg-white/10 p-6 text-center shadow-2xl shadow-black/20 backdrop-blur-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/60">
            Restricted Access
          </p>
          <h1 className="mt-2 text-2xl font-black text-white">
            Redirecting...
          </h1>
        </div>
      </div>
    </div>
  );
}

function NoAccessScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 text-white">
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-lg rounded-3xl border border-white/15 bg-white/10 p-6 text-center shadow-2xl shadow-black/20 backdrop-blur-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/60">
            Restricted Access
          </p>

          <h1 className="mt-2 text-2xl font-black text-white">
            You do not have access to any admin pages
          </h1>

          <p className="mt-3 text-sm leading-6 text-white/70">
            Ask a main admin to update your permissions in Admin Users.
          </p>
        </div>
      </div>
    </div>
  );
}

function AdminLayoutInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [permissions, setPermissions] = useState<string[]>([]);
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
  const [adminEmail, setAdminEmail] = useState<string>("");
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [permissionsError, setPermissionsError] = useState("");

  const path = normalisePath(pathname);

  const isLoginPage = path === "/admin/login";
  const isDashboardRoute = path.startsWith("/admin/dashboard");
  const isEmailRoute = path.startsWith("/admin/email");
  const isMoneyRoute = path.startsWith("/admin/money");
  const isEventHubRoute = path.startsWith("/admin/burtonprideeventhub");

  /**
   * Money pages have their own layout/sidebar, so we do not add the old Admin shell.
   * But they still NEED AdminProvider, because pages inside Money use useAdmin().
   */
  const leaveMoneyLayoutUntouched = Boolean(isMoneyRoute);

  /**
   * Burton Pride Event Hub is fully separate.
   * This layout does not control it or wrap it.
   */
  const leaveEventHubLayoutUntouched = Boolean(isEventHubRoute);

  const showAdminNav = Boolean(isDashboardRoute);
  const useFullWidthLayout = Boolean(isEmailRoute);

  const displayName = adminEmail || "Committee Member";

  useEffect(() => {
    if (leaveEventHubLayoutUntouched) return;

    document.title = "Burton Pride Admin Portal APP";
  }, [leaveEventHubLayoutUntouched]);

  const requiredPermission = useMemo(
    () => getRequiredPermission(pathname),
    [pathname],
  );

  const safePermissions = useMemo(() => {
    return adminRole === "main_admin" ? ALL_PERMISSION_KEYS : permissions;
  }, [adminRole, permissions]);

  const canAccessCurrentPage = useMemo(() => {
    if (!requiredPermission) return true;
    return hasPermission(safePermissions, adminRole, requiredPermission);
  }, [adminRole, requiredPermission, safePermissions]);

  useEffect(() => {
    let cancelled = false;

    async function loadPermissions() {
      /**
       * Login, Money and Event Hub do not use this old permission loading screen.
       * Money still gets AdminProvider lower down.
       * Event Hub stays fully separate.
       */
      if (
        isLoginPage ||
        leaveMoneyLayoutUntouched ||
        leaveEventHubLayoutUntouched
      ) {
        setPermissionsLoaded(true);
        setPermissionsError("");
        setPermissions([]);
        setAdminRole(null);
        setAdminEmail("");
        return;
      }

      try {
        setPermissionsLoaded(false);
        setPermissionsError("");

        const res = await fetch(`/api/admin/me/permissions?t=${Date.now()}`, {
          cache: "no-store",
          credentials: "include",
        });

        const data = (await res
          .json()
          .catch(() => ({}))) as AdminPermissionResponse;

        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Failed to load admin permissions.");
        }

        if (cancelled) return;

        setAdminRole(data.admin?.role || null);
        setAdminEmail(data.admin?.email || "");
        setPermissions(data.permissions || data.admin?.permissions || []);
      } catch (error: any) {
        if (cancelled) return;

        setPermissionsError(
          error?.message || "Failed to load admin permissions.",
        );
        setPermissions([]);
        setAdminRole(null);
        setAdminEmail("");
      } finally {
        if (!cancelled) {
          setPermissionsLoaded(true);
        }
      }
    }

    void loadPermissions();

    return () => {
      cancelled = true;
    };
  }, [isLoginPage, leaveMoneyLayoutUntouched, leaveEventHubLayoutUntouched]);

  useEffect(() => {
    if (isLoginPage) return;
    if (leaveMoneyLayoutUntouched) return;
    if (leaveEventHubLayoutUntouched) return;
    if (!permissionsLoaded) return;
    if (permissionsError) return;
    if (canAccessCurrentPage) return;

    const fallback = getFirstAllowedPage(safePermissions, adminRole);

    if (fallback && pathname !== fallback) {
      router.replace(fallback);
    }
  }, [
    adminRole,
    canAccessCurrentPage,
    isLoginPage,
    leaveMoneyLayoutUntouched,
    leaveEventHubLayoutUntouched,
    permissionsError,
    permissionsLoaded,
    pathname,
    router,
    safePermissions,
  ]);

  /**
   * Event Hub stays fully separate.
   */
  if (leaveEventHubLayoutUntouched) {
    return <>{children}</>;
  }

  /**
   * Money pages keep their own layout, but still receive AdminProvider.
   * This fixes:
   * useAdmin must be used inside AdminProvider.
   */
  if (leaveMoneyLayoutUntouched) {
    return <AdminProvider>{children}</AdminProvider>;
  }

  if (isLoginPage) {
    return (
      <AdminProvider>
        <div className="min-h-screen bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 text-white">
          {children}
        </div>
      </AdminProvider>
    );
  }

  if (!permissionsLoaded) {
    return (
      <AdminProvider>
        <LoadingPermissionsScreen />
      </AdminProvider>
    );
  }

  if (permissionsError) {
    return (
      <AdminProvider>
        <PermissionErrorScreen permissionsError={permissionsError} />
      </AdminProvider>
    );
  }

  if (!canAccessCurrentPage) {
    const fallback = getFirstAllowedPage(safePermissions, adminRole);

    if (fallback) {
      return (
        <AdminProvider>
          <RedirectingScreen />
        </AdminProvider>
      );
    }

    return (
      <AdminProvider>
        <NoAccessScreen />
      </AdminProvider>
    );
  }

  return (
    <AdminProvider>
      <div className="min-h-screen bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 text-white">
        <div className="flex min-h-screen flex-col md:flex-row">
          {showAdminNav && (
            <AdminSidebar permissions={safePermissions} adminRole={adminRole} />
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            {showAdminNav && (
              <header className="hidden h-16 items-center justify-between bg-white/10 px-8 shadow-sm backdrop-blur-xl md:flex">
                <div className="font-semibold text-white/90">Admin Portal</div>

                <div className="text-sm text-white/80">
                  Signed in as{" "}
                  <span className="font-semibold">{displayName}</span>
                </div>
              </header>
            )}

            {useFullWidthLayout ? (
              <main className="min-w-0 flex-1">{children}</main>
            ) : (
              <main className="flex-1 px-4 py-6 md:px-8 md:py-10">
                <div className="mx-auto max-w-6xl">{children}</div>
              </main>
            )}
          </div>
        </div>
      </div>
    </AdminProvider>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminLayoutInner>{children}</AdminLayoutInner>;
}