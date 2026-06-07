import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export type AdminRole = "main_admin" | "admin" | "editor";

export type CurrentAdmin = {
  id: string;
  supabase_user_id: string | null;
  clerk_user_id?: string | null;
  role: AdminRole;
  is_active: boolean;
  email?: string | null;
  full_name?: string | null;
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
    | { permission_key: string }
    | { permission_key: string }[]
    | null;
};

type AdminLookupReason =
  | "ok"
  | "missing_custom_admin_session"
  | "admin_users_query_failed"
  | "admin_record_missing"
  | "admin_record_inactive"
  | "admin_record_duplicate"
  | "admin_role_invalid";

export type AdminLookupResult =
  | {
      ok: true;
      reason: "ok";
      userId: string | null;
      sessionId: string | null;
      email: string | null;
      admin: CurrentAdmin;
    }
  | {
      ok: false;
      reason: Exclude<AdminLookupReason, "ok">;
      userId: string | null;
      sessionId: string | null;
      email: string | null;
      message: string;
      likelyFix: string;
      details?: Record<string, unknown>;
    };

const ADMIN_ID_COOKIES = [
  "burton_admin_id",
  "admin_user_id",
  "admin_id",
  "adminId",
  "bp_admin_id",
];

const ADMIN_EMAIL_COOKIES = [
  "burton_admin_email",
  "admin_email",
  "adminEmail",
  "bp_admin_email",
];

const SESSION_COOKIES = [
  "burton_admin_session",
  "admin_session",
  "bp_admin_session",
];

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

function clean(value: unknown) {
  return String(value || "").trim();
}

function normaliseEmail(value: unknown) {
  return clean(value).toLowerCase();
}

function permissionKeysToPermissionObject(
  keys: AdminPermissionKey[]
): AdminPermissions {
  const permissions: AdminPermissions = { ...NORMAL_ADMIN_DEFAULTS };

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

function maskValue(value: string | null | undefined) {
  if (!value) return null;
  if (value.length <= 12) return `${value.slice(0, 4)}…`;
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function getFirstCookie(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  names: string[]
) {
  for (const name of names) {
    const value = cookieStore.get(name)?.value;
    if (value) return value;
  }

  return "";
}

export async function getCurrentAdminLookup(): Promise<AdminLookupResult> {
  const cookieStore = await cookies();

  const adminId = clean(getFirstCookie(cookieStore, ADMIN_ID_COOKIES));
  const adminEmail = normaliseEmail(
    getFirstCookie(cookieStore, ADMIN_EMAIL_COOKIES)
  );
  const sessionToken = clean(getFirstCookie(cookieStore, SESSION_COOKIES));

  if (!adminId && !adminEmail) {
    return {
      ok: false,
      reason: "missing_custom_admin_session",
      userId: null,
      sessionId: null,
      email: null,
      message: "No active Burton Pride admin session was received.",
      likelyFix:
        "Sign in again using the Admin Portal login page. The login route must set burton_admin_id, burton_admin_email and burton_admin_session cookies.",
      details: {
        hasAdminIdCookie: Boolean(adminId),
        hasAdminEmailCookie: Boolean(adminEmail),
        hasSessionCookie: Boolean(sessionToken),
        acceptedIdCookies: ADMIN_ID_COOKIES,
        acceptedEmailCookies: ADMIN_EMAIL_COOKIES,
        acceptedSessionCookies: SESSION_COOKIES,
      },
    };
  }

  let query = supabaseAdmin
    .from("admin_users")
    .select(
      "id, supabase_user_id, clerk_user_id, email, full_name, role, is_active"
    )
    .limit(2);

  if (adminId && adminEmail) {
    query = query.eq("id", adminId).eq("email", adminEmail);
  } else if (adminId) {
    query = query.eq("id", adminId);
  } else {
    query = query.eq("email", adminEmail);
  }

  const { data, error } = await query;

  if (error) {
    console.error("getCurrentAdminLookup admin_users query failed:", error);

    return {
      ok: false,
      reason: "admin_users_query_failed",
      userId: adminId || null,
      sessionId: maskValue(sessionToken),
      email: adminEmail || null,
      message: "The admin user lookup failed in Supabase.",
      likelyFix:
        "Check public.admin_users exists and includes id, email, full_name, role and is_active.",
      details: {
        supabaseMessage: error.message,
        supabaseCode: error.code || null,
        supabaseHint: error.hint || null,
        supabaseDetails: error.details || null,
        maskedAdminId: maskValue(adminId),
      },
    };
  }

  const rows = (data || []) as CurrentAdmin[];

  if (rows.length > 1) {
    return {
      ok: false,
      reason: "admin_record_duplicate",
      userId: adminId || null,
      sessionId: maskValue(sessionToken),
      email: adminEmail || null,
      message: "More than one admin record matched this login session.",
      likelyFix:
        "Remove duplicate rows from public.admin_users. Keep one row per admin account.",
      details: {
        maskedAdminId: maskValue(adminId),
        signedInEmail: adminEmail,
        matchingRows: rows.length,
      },
    };
  }

  const admin = rows[0];

  if (!admin) {
    return {
      ok: false,
      reason: "admin_record_missing",
      userId: adminId || null,
      sessionId: maskValue(sessionToken),
      email: adminEmail || null,
      message:
        "Your admin session exists, but no matching admin record exists.",
      likelyFix:
        "Check public.admin_users. Make sure the id/email in the cookies matches the admin_users row and is_active is true.",
      details: {
        signedInEmail: adminEmail,
        maskedAdminId: maskValue(adminId),
      },
    };
  }

  if (admin.is_active !== true) {
    return {
      ok: false,
      reason: "admin_record_inactive",
      userId: String(admin.id),
      sessionId: maskValue(sessionToken),
      email: admin.email || adminEmail || null,
      message: "Your admin record exists but is inactive.",
      likelyFix: "Set public.admin_users.is_active to true for this user.",
      details: {
        adminId: admin.id,
        email: admin.email,
      },
    };
  }

  if (!isAdminRole(admin.role)) {
    return {
      ok: false,
      reason: "admin_role_invalid",
      userId: String(admin.id),
      sessionId: maskValue(sessionToken),
      email: admin.email || adminEmail || null,
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
    userId: String(admin.id),
    sessionId: maskValue(sessionToken),
    email: admin.email || adminEmail,
    admin: {
      ...admin,
      id: String(admin.id),
      supabase_user_id: admin.supabase_user_id || null,
      clerk_user_id: admin.clerk_user_id || null,
      email: admin.email || adminEmail,
      full_name: admin.full_name || null,
    },
  };
}

export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const result = await getCurrentAdminLookup();

  if (!result.ok) {
    console.warn("getCurrentAdmin denied access:", {
      reason: result.reason,
      message: result.message,
      likelyFix: result.likelyFix,
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
    const lookup = await getCurrentAdminLookup();

    if (!lookup.ok) {
      throw new Error(`${lookup.message} ${lookup.likelyFix}`);
    }

    throw new Error("Unauthorized. Burton Pride admin session was not found.");
  }

  return admin;
}

export async function requireMainAdmin() {
  const admin = await requireAdmin();

  if (admin.role !== "main_admin") {
    throw new Error("Main admin access required.");
  }

  return admin;
}

export async function requirePermission(permissionKey: keyof AdminPermissions) {
  const admin = await requireAdmin();

  if (admin.role === "main_admin") return admin;

  if (admin.permissions[permissionKey] !== true) {
    throw new Error("You do not have permission to do this.");
  }

  return admin;
}

export async function requireAdminPermission(permissionKey: AdminPermissionKey) {
  const admin = await requireAdmin();

  if (admin.role === "main_admin") return admin;

  if (admin.permissionKeys.includes(permissionKey)) return admin;

  const allowed = await hasPermission(permissionKey);

  if (!allowed) {
    throw new Error("You do not have permission to do this.");
  }

  return admin;
}

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