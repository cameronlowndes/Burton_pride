//update
import { auth, currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type AdminRole = "main_admin" | "admin" | "editor";

export type CurrentAdmin = {
  id: string;
  clerk_user_id: string;
  role: AdminRole;
  is_active: boolean;
  email?: string | null;
};

export type AdminPermissionKey =
  | "admin:dashboard:view"
  | "admin:users:manage"
  | "money:view"
  | "money:add_transactions"
  | "money:edit_transactions"
  | "money:edit_old_years"
  | "money:hide_transactions"
  | "money:delete_all"
  | "money:delete_year"
  | "money:manage_year_locks"
  | "money:manage_sponsors"
  | "money:change_sponsor_totals"
  | "money:sync_website_payments"
  | "money:print_reports"
  | "money:export_reports"
  | "money:manage_refunds"
  | "donations:view"
  | "donations:manage"
  | "raffle:view"
  | "raffle:manage"
  | "raffle:draw_winners"
  | "site_pages:view"
  | "site_pages:manage"
  | "audit_logs:view";

/**
 * Keep this alias so older money files that import MoneyPermissionKey
 * do not break.
 */
export type MoneyPermissionKey = AdminPermissionKey;

export type AdminPermissions = {
  canViewAdminDashboard: boolean;
  canManageAdminUsers: boolean;

  canViewMoney: boolean;
  canAddTransactions: boolean;
  canEditTransactions: boolean;
  canEditOldYears: boolean;
  canHideTransactions: boolean;
  canDeleteAllTransactions: boolean;
  canDeleteSelectedYear: boolean;
  canManageYearLocks: boolean;
  canManageSponsors: boolean;
  canChangeSponsorTotals: boolean;
  canSyncWebsitePayments: boolean;
  canPrintReports: boolean;
  canExportReports: boolean;
  canManageRefunds: boolean;

  canViewDonations: boolean;
  canManageDonations: boolean;

  canViewRaffle: boolean;
  canManageRaffle: boolean;
  canDrawRaffleWinners: boolean;

  canViewSitePages: boolean;
  canManageSitePages: boolean;

  canViewAuditLogs: boolean;
};

export type CurrentAdminWithPermissions = CurrentAdmin & {
  permissions: AdminPermissions;
  permissionKeys: AdminPermissionKey[];
};

type PermissionRow = {
  is_allowed: boolean | null;
  admin_permissions:
    | {
        permission_key: string;
      }
    | {
        permission_key: string;
      }[]
    | null;
};

type AdminLookupReason =
  | "ok"
  | "missing_clerk_session"
  | "admin_users_query_failed"
  | "admin_record_missing"
  | "admin_record_inactive"
  | "admin_record_duplicate"
  | "admin_role_invalid";

export type AdminLookupResult =
  | {
      ok: true;
      reason: "ok";
      userId: string;
      sessionId: string;
      admin: CurrentAdmin;
    }
  | {
      ok: false;
      reason: Exclude<AdminLookupReason, "ok">;
      userId: string | null;
      sessionId: string | null;
      message: string;
      likelyFix: string;
      details?: Record<string, unknown>;
    };

export const ALL_PERMISSION_KEYS = [
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
  "money:manage_refunds",

  "donations:view",
  "donations:manage",

  "raffle:view",
  "raffle:manage",
  "raffle:draw_winners",

  "site_pages:view",
  "site_pages:manage",

  "audit_logs:view",
] as const satisfies readonly AdminPermissionKey[];

const PERMISSION_KEYS = {
  canViewAdminDashboard: "admin:dashboard:view",
  canManageAdminUsers: "admin:users:manage",

  canViewMoney: "money:view",
  canAddTransactions: "money:add_transactions",
  canEditTransactions: "money:edit_transactions",
  canEditOldYears: "money:edit_old_years",
  canHideTransactions: "money:hide_transactions",
  canDeleteAllTransactions: "money:delete_all",
  canDeleteSelectedYear: "money:delete_year",
  canManageYearLocks: "money:manage_year_locks",
  canManageSponsors: "money:manage_sponsors",
  canChangeSponsorTotals: "money:change_sponsor_totals",
  canSyncWebsitePayments: "money:sync_website_payments",
  canPrintReports: "money:print_reports",
  canExportReports: "money:export_reports",
  canManageRefunds: "money:manage_refunds",

  canViewDonations: "donations:view",
  canManageDonations: "donations:manage",

  canViewRaffle: "raffle:view",
  canManageRaffle: "raffle:manage",
  canDrawRaffleWinners: "raffle:draw_winners",

  canViewSitePages: "site_pages:view",
  canManageSitePages: "site_pages:manage",

  canViewAuditLogs: "audit_logs:view",
} satisfies Record<keyof AdminPermissions, AdminPermissionKey>;

const NORMAL_ADMIN_DEFAULTS: AdminPermissions = {
  canViewAdminDashboard: true,
  canManageAdminUsers: false,

  canViewMoney: false,
  canAddTransactions: false,
  canEditTransactions: false,
  canEditOldYears: false,
  canHideTransactions: false,
  canDeleteAllTransactions: false,
  canDeleteSelectedYear: false,
  canManageYearLocks: false,
  canManageSponsors: false,
  canChangeSponsorTotals: false,
  canSyncWebsitePayments: false,
  canPrintReports: false,
  canExportReports: false,
  canManageRefunds: false,

  canViewDonations: false,
  canManageDonations: false,

  canViewRaffle: false,
  canManageRaffle: false,
  canDrawRaffleWinners: false,

  canViewSitePages: false,
  canManageSitePages: false,

  canViewAuditLogs: false,
};

const MAIN_ADMIN_PERMISSIONS: AdminPermissions = Object.keys(
  PERMISSION_KEYS
).reduce((acc, key) => {
  acc[key as keyof AdminPermissions] = true;
  return acc;
}, {} as AdminPermissions);

function permissionKeysToPermissionObject(
  keys: AdminPermissionKey[]
): AdminPermissions {
  const permissions: AdminPermissions = {
    ...NORMAL_ADMIN_DEFAULTS,
  };

  for (const [uiKey, dbKey] of Object.entries(PERMISSION_KEYS) as [
    keyof AdminPermissions,
    AdminPermissionKey
  ][]) {
    permissions[uiKey] = keys.includes(dbKey);
  }

  return permissions;
}

function permissionObjectToKeys(
  permissions: AdminPermissions
): AdminPermissionKey[] {
  return (Object.entries(PERMISSION_KEYS) as [
    keyof AdminPermissions,
    AdminPermissionKey
  ][])
    .filter(([uiKey]) => permissions[uiKey] === true)
    .map(([, dbKey]) => dbKey);
}

function isAdminPermissionKey(value: string): value is AdminPermissionKey {
  return (ALL_PERMISSION_KEYS as readonly string[]).includes(value);
}

function isAdminRole(value: unknown): value is AdminRole {
  return value === "main_admin" || value === "admin" || value === "editor";
}

function maskClerkUserId(value: string | null | undefined) {
  if (!value) return null;

  if (value.length <= 12) {
    return `${value.slice(0, 4)}…`;
  }

  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

async function getSignedInEmail() {
  try {
    const user = await currentUser();

    return (
      user?.primaryEmailAddress?.emailAddress ||
      user?.emailAddresses?.[0]?.emailAddress ||
      null
    );
  } catch (error) {
    console.warn("Could not load Clerk user email for admin diagnostics:", error);
    return null;
  }
}

/**
 * Load the current signed-in admin with detailed failure information.
 *
 * This is deliberately stricter than the old helper:
 * - A missing Clerk session is reported separately.
 * - A Supabase query problem is reported separately.
 * - Missing and inactive admin rows are reported separately.
 * - A matching email with a different Clerk user ID is reported as a likely
 *   development-to-production Clerk migration issue.
 *
 * Never automatically grant access by email. The Clerk user ID remains the
 * security boundary.
 */
export async function getCurrentAdminLookup(): Promise<AdminLookupResult> {
  const { userId, sessionId } = await auth();

  if (!userId || !sessionId) {
    return {
      ok: false,
      reason: "missing_clerk_session",
      userId: userId || null,
      sessionId: sessionId || null,
      message: "No active Clerk login session was received.",
      likelyFix:
        "Sign out and sign back in. If this only fails on one device, check Clerk production keys, the Clerk production domain and browser session cookies.",
    };
  }

  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("id, clerk_user_id, email, role, is_active")
    .eq("clerk_user_id", userId)
    .limit(2);

  if (error) {
    console.error("getCurrentAdminLookup admin_users query failed:", error);

    return {
      ok: false,
      reason: "admin_users_query_failed",
      userId,
      sessionId,
      message: "The admin user lookup failed in Supabase.",
      likelyFix:
        "Check that public.admin_users exists and includes id, clerk_user_id, email, role and is_active.",
      details: {
        supabaseMessage: error.message,
        supabaseCode: error.code || null,
        maskedClerkUserId: maskClerkUserId(userId),
      },
    };
  }

  const rows = (data || []) as CurrentAdmin[];

  if (rows.length > 1) {
    console.error("Duplicate admin_users rows found for Clerk user ID:", {
      maskedClerkUserId: maskClerkUserId(userId),
      count: rows.length,
    });

    return {
      ok: false,
      reason: "admin_record_duplicate",
      userId,
      sessionId,
      message: "More than one admin record exists for this Clerk user ID.",
      likelyFix:
        "Remove duplicate rows from public.admin_users and add a unique constraint to clerk_user_id.",
      details: {
        maskedClerkUserId: maskClerkUserId(userId),
        matchingRows: rows.length,
      },
    };
  }

  const admin = rows[0];

  if (!admin) {
    const signedInEmail = await getSignedInEmail();

    let matchingEmailRow:
      | {
          id: string;
          clerk_user_id: string;
          email: string | null;
          role: string;
          is_active: boolean;
        }
      | undefined;

    if (signedInEmail) {
      const { data: emailMatches, error: emailLookupError } =
        await supabaseAdmin
          .from("admin_users")
          .select("id, clerk_user_id, email, role, is_active")
          .ilike("email", signedInEmail)
          .limit(1);

      if (emailLookupError) {
        console.warn(
          "Could not check whether an admin_users row matches the signed-in email:",
          emailLookupError
        );
      } else {
        matchingEmailRow = (emailMatches || [])[0] as
          | {
              id: string;
              clerk_user_id: string;
              email: string | null;
              role: string;
              is_active: boolean;
            }
          | undefined;
      }
    }

    const hasDifferentClerkId =
      Boolean(matchingEmailRow?.clerk_user_id) &&
      matchingEmailRow?.clerk_user_id !== userId;

    return {
      ok: false,
      reason: "admin_record_missing",
      userId,
      sessionId,
      message: hasDifferentClerkId
        ? "You are signed in, but the Supabase admin row still uses a different Clerk user ID."
        : "You are signed in, but no matching admin record exists in Supabase.",
      likelyFix: hasDifferentClerkId
        ? "Update public.admin_users.clerk_user_id to the Clerk production user ID for this account. Do not grant access by email alone."
        : "Create or update the public.admin_users row so clerk_user_id matches the current Clerk production user ID and is_active is true.",
      details: {
        signedInEmail: signedInEmail || null,
        maskedCurrentClerkUserId: maskClerkUserId(userId),
        hasEmailMatchWithDifferentClerkId: hasDifferentClerkId,
        maskedStoredClerkUserId: matchingEmailRow
          ? maskClerkUserId(matchingEmailRow.clerk_user_id)
          : null,
        matchingEmailRowIsActive: matchingEmailRow?.is_active ?? null,
      },
    };
  }

  if (admin.is_active !== true) {
    return {
      ok: false,
      reason: "admin_record_inactive",
      userId,
      sessionId,
      message: "Your admin record exists but is inactive.",
      likelyFix:
        "Set public.admin_users.is_active to true for this Clerk production user ID.",
      details: {
        adminId: admin.id,
        maskedClerkUserId: maskClerkUserId(userId),
      },
    };
  }

  if (!isAdminRole(admin.role)) {
    return {
      ok: false,
      reason: "admin_role_invalid",
      userId,
      sessionId,
      message: "Your admin record has an invalid role value.",
      likelyFix:
        'Set public.admin_users.role to "main_admin", "admin" or "editor".',
      details: {
        adminId: admin.id,
        receivedRole: admin.role,
      },
    };
  }

  return {
    ok: true,
    reason: "ok",
    userId,
    sessionId,
    admin,
  };
}

/**
 * Backwards-compatible helper used by existing files.
 *
 * Existing pages and API routes can keep importing getCurrentAdmin().
 * New diagnostic API routes should prefer getCurrentAdminLookup().
 */
export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const result = await getCurrentAdminLookup();

  if (!result.ok) {
    console.warn("getCurrentAdmin denied access:", {
      reason: result.reason,
      message: result.message,
      details: result.details || null,
    });

    return null;
  }

  return result.admin;
}

export async function hasPermission(
  permissionKey: AdminPermissionKey | string
): Promise<boolean> {
  const admin = await getCurrentAdmin();

  if (!admin) return false;

  if (admin.role === "main_admin") return true;

  const { data, error } = await supabaseAdmin
    .from("admin_user_permissions")
    .select(
      `
      is_allowed,
      admin_permissions!inner (
        permission_key
      )
      `
    )
    .eq("admin_user_id", admin.id)
    .eq("admin_permissions.permission_key", permissionKey)
    .maybeSingle();

  if (error) {
    console.error("hasPermission error:", error);
    return false;
  }

  if (!data) return false;

  const row = data as PermissionRow;

  return row.is_allowed === true;
}

export async function getCurrentAdminPermissions(): Promise<CurrentAdminWithPermissions | null> {
  const admin = await getCurrentAdmin();

  if (!admin) return null;

  if (admin.role === "main_admin") {
    return {
      ...admin,
      permissions: MAIN_ADMIN_PERMISSIONS,
      permissionKeys: [...ALL_PERMISSION_KEYS],
    };
  }

  const { data, error } = await supabaseAdmin
    .from("admin_user_permissions")
    .select(
      `
      is_allowed,
      admin_permissions!inner (
        permission_key
      )
      `
    )
    .eq("admin_user_id", admin.id);

  if (error) {
    console.error("getCurrentAdminPermissions error:", error);

    const defaultKeys = permissionObjectToKeys(NORMAL_ADMIN_DEFAULTS);

    return {
      ...admin,
      permissions: NORMAL_ADMIN_DEFAULTS,
      permissionKeys: defaultKeys,
    };
  }

  const rows = (data || []) as PermissionRow[];
  const permissionKeys = new Set<AdminPermissionKey>();

  /**
   * Safety default:
   * Admins/editors should always be able to land on the dashboard.
   * This prevents redirect loops when an account has no permissions selected.
   */
  permissionKeys.add("admin:dashboard:view");

  for (const row of rows) {
    if (row.is_allowed !== true) continue;

    const permissionData = Array.isArray(row.admin_permissions)
      ? row.admin_permissions[0]
      : row.admin_permissions;

    const permissionKey = permissionData?.permission_key;

    if (!permissionKey || !isAdminPermissionKey(permissionKey)) continue;

    permissionKeys.add(permissionKey);
  }

  const permissionKeyList = Array.from(permissionKeys);

  return {
    ...admin,
    permissions: permissionKeysToPermissionObject(permissionKeyList),
    permissionKeys: permissionKeyList,
  };
}

export async function requireAdmin() {
  const admin = await getCurrentAdminPermissions();

  if (!admin) {
    throw new Error("Unauthorized");
  }

  return admin;
}

export async function requireMainAdmin() {
  const admin = await requireAdmin();

  if (admin.role !== "main_admin") {
    throw new Error("Main admin access required");
  }

  return admin;
}

/**
 * Old UI-style permission checker.
 * Example: requirePermission("canDeleteAllTransactions")
 */
export async function requirePermission(permissionKey: keyof AdminPermissions) {
  const admin = await requireAdmin();

  if (admin.role === "main_admin") {
    return admin;
  }

  if (admin.permissions[permissionKey] !== true) {
    throw new Error("You do not have permission to do this.");
  }

  return admin;
}

/**
 * New portal-wide permission checker.
 * Use this for all admin portal pages and API routes.
 * Examples:
 * - requireAdminPermission("site_pages:manage")
 * - requireAdminPermission("raffle:view")
 * - requireAdminPermission("money:delete_all")
 * - requireAdminPermission("money:manage_refunds")
 */
export async function requireAdminPermission(permissionKey: AdminPermissionKey) {
  const admin = await requireAdmin();

  if (admin.role === "main_admin") {
    return admin;
  }

  if (admin.permissionKeys.includes(permissionKey)) {
    return admin;
  }

  const allowed = await hasPermission(permissionKey);

  if (!allowed) {
    throw new Error("You do not have permission to do this.");
  }

  return admin;
}

/**
 * Backwards-compatible alias.
 * Existing money tracker files can keep importing requireMoneyPermission.
 */
export const requireMoneyPermission = requireAdminPermission;

export function isMainAdmin(admin: CurrentAdmin | null | undefined) {
  return admin?.role === "main_admin";
}

export function canEditYear(admin: CurrentAdminWithPermissions, year: string) {
  const currentYear = new Date().getFullYear().toString();

  if (admin.role === "main_admin") return true;

  if (year === currentYear) {
    return admin.permissions.canEditTransactions;
  }

  return admin.permissions.canEditOldYears;
}

export function getPermissionKeysFromAdmin(admin: CurrentAdminWithPermissions) {
  return admin.permissionKeys;
}
