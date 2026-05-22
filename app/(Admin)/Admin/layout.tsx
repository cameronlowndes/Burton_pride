"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import AdminSidebar from "./components/rooting/AdminSidebar";

type AdminRole = "main_admin" | "admin" | "editor";

type AdminPermissionResponse = {
  ok: boolean;
  admin?: {
    id: string;
    clerk_user_id: string | null;
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

  if (!path) return null;

  if (path === "/admin/login") return null;

  if (path.startsWith("/admin/dashboard/pageeditor")) {
    return "site_pages:manage";
  }

  if (path.startsWith("/admin/dashboard/logs")) {
    return "audit_logs:view";
  }

  if (path.startsWith("/admin/dashboard/donations")) {
    return "donations:view";
  }

  if (path.startsWith("/admin/dashboard/raffle")) {
    return "raffle:view";
  }

  if (path.startsWith("/admin/money")) {
    return "money:view";
  }

  if (path.startsWith("/admin/dashboard/money")) {
    return "money:view";
  }

  if (path.startsWith("/admin/dashboard/users")) {
    return "admin:users:manage";
  }

  if (path.startsWith("/admin/dashboard")) {
    return "admin:dashboard:view";
  }

  return null;
}

function getFirstAllowedPage(
  permissions: string[],
  adminRole: AdminRole | null,
) {
  if (adminRole === "main_admin") return "/Admin/Dashboard";

  if (permissions.includes("admin:dashboard:view")) return "/Admin/Dashboard";
  if (permissions.includes("money:view")) return "/Admin/Money";
  if (permissions.includes("donations:view")) {
    return "/Admin/Dashboard/Donations";
  }
  if (permissions.includes("raffle:view")) return "/Admin/Dashboard/Raffle";
  if (
    permissions.includes("site_pages:view") ||
    permissions.includes("site_pages:manage")
  ) {
    return "/Admin/Dashboard/PageEditor";
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

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoaded } = useUser();

  const [permissions, setPermissions] = useState<string[]>([]);
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [permissionsError, setPermissionsError] = useState("");

  const path = normalisePath(pathname);

  const isLoginPage = path === "/admin/login";
  const isDashboardRoute = path.startsWith("/admin/dashboard");
  const isEmailRoute = path.startsWith("/admin/email");
  const isMoneyRoute = path.startsWith("/admin/money");

  /*
    FIX:
    No hooks can be placed after a conditional return.
    The old version returned early for /Admin/Login before useMemo/useEffect hooks,
    then called those hooks on the next page. That changed the hook order and caused:
    "React has detected a change in the order of Hooks called by AdminLayout".
  */
  const leaveMoneyLayoutUntouched = Boolean(isMoneyRoute);
  const showAdminNav = Boolean(isDashboardRoute);
  const useFullWidthLayout = Boolean(isEmailRoute);

  const displayName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.primaryEmailAddress?.emailAddress ||
    "Committee Member";

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
      /*
        Login page should not wait for permissions or call the admin API,
        but this must live inside the effect, not before the hooks.
      */
      if (isLoginPage) {
        setPermissionsLoaded(true);
        setPermissionsError("");
        setPermissions([]);
        setAdminRole(null);
        return;
      }

      try {
        setPermissionsLoaded(false);
        setPermissionsError("");

        const res = await fetch(`/api/admin/me/permissions?t=${Date.now()}`, {
          cache: "no-store",
        });

        const data = (await res
          .json()
          .catch(() => ({}))) as AdminPermissionResponse;

        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Failed to load admin permissions.");
        }

        if (cancelled) return;

        setAdminRole(data.admin?.role || null);
        setPermissions(data.permissions || data.admin?.permissions || []);
      } catch (error: any) {
        if (cancelled) return;

        setPermissionsError(
          error?.message || "Failed to load admin permissions.",
        );
        setPermissions([]);
        setAdminRole(null);
      } finally {
        if (!cancelled) {
          setPermissionsLoaded(true);
        }
      }
    }

    loadPermissions();

    return () => {
      cancelled = true;
    };
  }, [isLoginPage]);

  useEffect(() => {
    if (isLoginPage) return;
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
    permissionsError,
    permissionsLoaded,
    pathname,
    router,
    safePermissions,
  ]);

  /*
    Returns are now AFTER every hook above.
    That keeps hook order stable on every render.
  */
  if (isLoginPage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 text-white">
        {children}
      </div>
    );
  }

  if (!permissionsLoaded) {
    return <LoadingPermissionsScreen />;
  }

  if (permissionsError) {
    return <PermissionErrorScreen permissionsError={permissionsError} />;
  }

  if (!canAccessCurrentPage) {
    const fallback = getFirstAllowedPage(safePermissions, adminRole);

    if (fallback) {
      return <RedirectingScreen />;
    }

    return <NoAccessScreen />;
  }

  /*
    Money Management has its own full page layout.
    This Admin layout only protects /Admin/Money with money:view,
    then leaves the Money UI untouched.
  */
  if (leaveMoneyLayoutUntouched) {
    return <>{children}</>;
  }

  return (
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
                <span className="font-semibold">
                  {isLoaded ? displayName : "Loading..."}
                </span>
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
  );
}
