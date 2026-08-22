import { createHash } from "node:crypto";
import { cookies } from "next/headers";

import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export type AdminRole = "main_admin" | "admin" | "editor";
export type MfaAssuranceLevel = "aal1" | "aal2";

export type CurrentAdmin = {
  id: string;
  supabase_user_id: string | null;
  clerk_user_id?: string | null;
  role: AdminRole;
  is_active: boolean;
  email?: string | null;
  full_name?: string | null;

  /**
   * Security context resolved by trusted server code.
   * Never accept these values from the browser.
   */
  security_session_id?: string | null;
  trusted_device_id?: string | null;
  mfa_assurance?: MfaAssuranceLevel | null;
};

export const ALL_PERMISSION_KEYS = [
  // Admin Portal
  "admin:dashboard:view",
  "admin:users:view",
  "admin:users:manage",
  "admin:users:manage_2fa",
  "admin:sidebar:manage",

  // Money Management
  "money:view",
  "money:add_transactions",
  "money:edit_transactions",
  "money:hide_transactions",
  "money:restore_transactions",
  "money:edit_old_years",
  "money:manage_month_locks",
  "money:manage_year_locks",
  "money:delete_year",
  "money:delete_all",
  "money:budgets:view",
  "money:budgets:manage",
  "money:sponsors:view",
  "money:sponsors:manage",
  "money:sponsors:change_totals",
  "money:suppliers:view",
  "money:suppliers:manage",
  "money:refunds:view",
  "money:manage_refunds",
  "money:direct_debits:view",
  "money:direct_debits:manage",
  "money:reconciliation:view",
  "money:reconciliation:manage",
  "money:saving_targets:manage",
  "money:csv_import",
  "money:sync_website_payments",
  "money:receipts:manage",
  "money:print_reports",
  "money:export_reports",

  // Event Hub
  "event_hub:view",
  "event_hub:events:manage",
  "event_hub:contacts:view",
  "event_hub:contacts:manage",
  "event_hub:checklists:view",
  "event_hub:checklists:manage",
  "event_hub:applications:view",
  "event_hub:applications:manage",
  "event_hub:files:view",
  "event_hub:files:manage",
  "event_hub:email",
  "event_hub:export",
  "event_audit:view",
  "event_audit:view_all_events",
  "event_audit:view_security",

  // Stock Management
  "stock:view",
  "stock:items:view",
  "stock:items:manage",
  "stock:items:delete",
  "stock:quantity:adjust",
  "stock:movements:view",
  "stock:movements:create",
  "stock:locations:view",
  "stock:locations:manage",
  "stock:locations:delete",
  "stock:low_stock:view",
  "stock:orders:view",
  "stock:orders:manage",
  "stock:deliveries:manage",
  "stock:suppliers:view",
  "stock:suppliers:manage",
  "stock:suppliers:override_block",
  "stock:export",
  "stock:audit:view",

  // Community Art
  "community_art:view",
  "community_art:manage",
  "community_art:add",
  "community_art:files",

  // Donations
  "donations:view",
  "donations:manage",
  "donations:export",

  // Raffle
  "raffle:view",
  "raffle:manage",
  "raffle:draw_winners",

  // Website
  "site_pages:view",
  "site_pages:manage",
  "site_pages:hide",
  "website:sponsors:view",
  "website:sponsors:manage",
  "website:forms:view",
  "website:forms:manage",

  // Email
  "email:view",
  "email:send",
  "email:templates:manage",

  // Audit & Security
  "audit_logs:view",
  "audit_logs:view_security",
  "audit_logs:export",
  "security:settings:view",
  "security:settings:manage",
] as const;

export type AdminPermissionKey = (typeof ALL_PERMISSION_KEYS)[number];
export type MoneyPermissionKey = AdminPermissionKey;

/**
 * Legacy boolean permission object kept so existing pages do not have to be
 * rewritten immediately. New code should prefer permissionKeys +
 * requireAdminPermission("permission:key").
 */
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

type SecuritySessionRow = {
  id: string;
  admin_id: string;
  trusted_device_id: string | null;
  auth_session_ref: string | null;
  aal: string | null;
  created_at: string | null;
  last_seen_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
};

type AdminLookupReason =
  | "ok"
  | "missing_admin_session"
  | "invalid_admin_session"
  | "expired_admin_session"
  | "revoked_admin_session"
  | "mfa_required"
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
      email: string | null;
      admin: CurrentAdmin;
    }
  | {
      ok: false;
      reason: Exclude<AdminLookupReason, "ok">;
      userId: string | null;
      sessionId: string | null;
      email: string | null;
      /**
       * Safe internal diagnostic string.
       * API routes should return a generic 401/403 response instead of this.
       */
      message: string;
    };

const ADMIN_SESSION_COOKIE = "burton_admin_session";

/**
 * Temporary migration compatibility only.
 *
 * Older MFA verify code used a separate security-session cookie. Keep reading
 * it during migration so already-issued strong sessions do not get trapped in
 * a login redirect loop. Remove this fallback after every admin has signed in
 * through the new verify route.
 */
const LEGACY_SECURITY_SESSION_COOKIE =
  "burton_admin_security_session";

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
  canManageSponsors: "money:sponsors:manage",
  canChangeSponsorTotals: "money:sponsors:change_totals",
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
} as const satisfies Record<keyof AdminPermissions, AdminPermissionKey>;

/**
 * Default deny.
 *
 * The old implementation granted dashboard access to a normal admin even when
 * no permission row existed. That creates an implicit permission and conflicts
 * with least-privilege/default-deny requirements.
 */
const NORMAL_ADMIN_DEFAULTS: AdminPermissions = Object.keys(
  PERMISSION_KEYS,
).reduce((permissions, key) => {
  permissions[key as keyof AdminPermissions] = false;
  return permissions;
}, {} as AdminPermissions);

const MAIN_ADMIN_PERMISSIONS: AdminPermissions = Object.keys(
  PERMISSION_KEYS,
).reduce((permissions, key) => {
  permissions[key as keyof AdminPermissions] = true;
  return permissions;
}, {} as AdminPermissions);

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isAdminRole(value: unknown): value is AdminRole {
  return value === "main_admin" || value === "admin" || value === "editor";
}

export function isAdminPermissionKey(
  value: string,
): value is AdminPermissionKey {
  return (ALL_PERMISSION_KEYS as readonly string[]).includes(value);
}

function hashSessionToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

function hashLegacySecuritySessionToken(rawToken: string): string | null {
  const pepper = process.env.ADMIN_2FA_PEPPER;

  if (!pepper || pepper.length < 32) {
    return null;
  }

  return createHash("sha256")
    .update(`${pepper}:${rawToken}`)
    .digest("hex");
}

function safeSessionRef(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.length > 12
    ? `${value.slice(0, 8)}…${value.slice(-4)}`
    : `${value.slice(0, 4)}…`;
}

function isExpired(value: string | null): boolean {
  if (!value) return true;

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return true;

  return timestamp <= Date.now();
}

function permissionKeysToPermissionObject(
  keys: AdminPermissionKey[],
): AdminPermissions {
  const permissions: AdminPermissions = { ...NORMAL_ADMIN_DEFAULTS };

  for (const [uiKey, dbKey] of Object.entries(PERMISSION_KEYS) as [
    keyof AdminPermissions,
    AdminPermissionKey,
  ][]) {
    permissions[uiKey] = keys.includes(dbKey);
  }

  return permissions;
}

function permissionObjectToKeys(
  permissions: AdminPermissions,
): AdminPermissionKey[] {
  return (Object.entries(PERMISSION_KEYS) as [
    keyof AdminPermissions,
    AdminPermissionKey,
  ][])
    .filter(([uiKey]) => permissions[uiKey] === true)
    .map(([, dbKey]) => dbKey);
}

/**
 * Resolve the authenticated administrator from a cryptographically random
 * server-created session token.
 *
 * SECURITY:
 * - Browser-supplied admin ID/email cookies are deliberately NOT used to
 *   identify the administrator.
 * - The raw session token is never queried/logged. Only its SHA-256 reference
 *   is used.
 * - The session must exist server-side, be unrevoked, unexpired and aal2.
 * - The admin identity is resolved from the session's admin_id.
 */
export async function getCurrentAdminLookup(): Promise<AdminLookupResult> {
  const cookieStore = await cookies();

  const rawAdminSession = clean(
    cookieStore.get(ADMIN_SESSION_COOKIE)?.value,
  );

  const rawLegacySecuritySession = clean(
    cookieStore.get(LEGACY_SECURITY_SESSION_COOKIE)?.value,
  );

  if (!rawAdminSession && !rawLegacySecuritySession) {
    return {
      ok: false,
      reason: "missing_admin_session",
      userId: null,
      sessionId: null,
      email: null,
      message: "No valid administrator session is available.",
    };
  }

  /*
   * New format:
   *   burton_admin_session -> plain SHA-256 -> auth_session_ref
   *
   * Migration formats accepted temporarily:
   *   burton_admin_session -> peppered SHA-256
   *   burton_admin_security_session -> plain SHA-256
   *   burton_admin_security_session -> peppered SHA-256
   *
   * We still never trust an admin ID/email/role from browser cookies. Every
   * candidate is only an opaque random session secret which must resolve to an
   * authoritative, unrevoked, unexpired AAL2 row in Supabase.
   */
  const candidateRefs = new Set<string>();

  if (rawAdminSession) {
    candidateRefs.add(hashSessionToken(rawAdminSession));

    const legacyHash =
      hashLegacySecuritySessionToken(rawAdminSession);

    if (legacyHash) {
      candidateRefs.add(legacyHash);
    }
  }

  if (rawLegacySecuritySession) {
    candidateRefs.add(
      hashSessionToken(rawLegacySecuritySession),
    );

    const legacyHash =
      hashLegacySecuritySessionToken(
        rawLegacySecuritySession,
      );

    if (legacyHash) {
      candidateRefs.add(legacyHash);
    }
  }

  const refs = Array.from(candidateRefs);

  const { data: securitySessionData, error: securitySessionError } =
    await supabaseAdmin
      .from("admin_security_sessions")
      .select(
        [
          "id",
          "admin_id",
          "trusted_device_id",
          "auth_session_ref",
          "aal",
          "created_at",
          "last_seen_at",
          "expires_at",
          "revoked_at",
          "revoke_reason",
        ].join(", "),
      )
      .in("auth_session_ref", refs)
      .limit(2);

  if (securitySessionError) {
    console.error("Admin security session lookup failed", {
      code: securitySessionError.code || null,
      candidateCount: refs.length,
    });

    return {
      ok: false,
      reason: "invalid_admin_session",
      userId: null,
      sessionId: null,
      email: null,
      message: "Administrator session verification failed.",
    };
  }

  const securitySessions =
    (securitySessionData || []) as unknown as SecuritySessionRow[];

  if (securitySessions.length !== 1) {
    if (securitySessions.length > 1) {
      console.error(
        "Multiple admin security-session candidates matched",
        {
          matchingRows: securitySessions.length,
        },
      );
    }

    return {
      ok: false,
      reason: "invalid_admin_session",
      userId: null,
      sessionId: null,
      email: null,
      message: "Administrator session is invalid.",
    };
  }

  const securitySession = securitySessions[0];

  if (securitySession.revoked_at) {
    return {
      ok: false,
      reason: "revoked_admin_session",
      userId: securitySession.admin_id,
      sessionId: securitySession.id,
      email: null,
      message: "Administrator session has been revoked.",
    };
  }

  if (isExpired(securitySession.expires_at)) {
    return {
      ok: false,
      reason: "expired_admin_session",
      userId: securitySession.admin_id,
      sessionId: securitySession.id,
      email: null,
      message: "Administrator session has expired.",
    };
  }

  /**
   * Password-only / aal1 sessions are not allowed into the restricted
   * Admin Portal. Strong MFA must have completed before the login flow creates
   * or upgrades this security session to aal2.
   */
  if (securitySession.aal !== "aal2") {
    return {
      ok: false,
      reason: "mfa_required",
      userId: securitySession.admin_id,
      sessionId: securitySession.id,
      email: null,
      message: "Strong multi-factor authentication is required.",
    };
  }

  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select(
      "id, supabase_user_id, clerk_user_id, email, full_name, role, is_active",
    )
    .eq("id", securitySession.admin_id)
    .limit(2);

  if (error) {
    console.error("Admin user lookup failed", {
      code: error.code || null,
      sessionId: securitySession.id,
    });

    return {
      ok: false,
      reason: "admin_users_query_failed",
      userId: securitySession.admin_id,
      sessionId: securitySession.id,
      email: null,
      message: "Administrator identity verification failed.",
    };
  }

  const rows = (data || []) as CurrentAdmin[];

  if (rows.length > 1) {
    console.error("Duplicate admin user record detected", {
      adminId: securitySession.admin_id,
      matchingRows: rows.length,
    });

    return {
      ok: false,
      reason: "admin_record_duplicate",
      userId: securitySession.admin_id,
      sessionId: securitySession.id,
      email: null,
      message: "Administrator identity verification failed.",
    };
  }

  const admin = rows[0];

  if (!admin) {
    return {
      ok: false,
      reason: "admin_record_missing",
      userId: securitySession.admin_id,
      sessionId: securitySession.id,
      email: null,
      message: "Administrator access is not authorised.",
    };
  }

  if (admin.is_active !== true) {
    return {
      ok: false,
      reason: "admin_record_inactive",
      userId: String(admin.id),
      sessionId: securitySession.id,
      email: admin.email || null,
      message: "Administrator access is disabled.",
    };
  }

  if (!isAdminRole(admin.role)) {
    console.error("Invalid admin role detected", {
      adminId: admin.id,
    });

    return {
      ok: false,
      reason: "admin_role_invalid",
      userId: String(admin.id),
      sessionId: securitySession.id,
      email: admin.email || null,
      message: "Administrator access is not authorised.",
    };
  }

  return {
    ok: true,
    reason: "ok",
    userId: String(admin.id),
    sessionId: securitySession.id,
    email: admin.email || null,
    admin: {
      ...admin,
      id: String(admin.id),
      supabase_user_id: admin.supabase_user_id || null,
      clerk_user_id: admin.clerk_user_id || null,
      email: admin.email || null,
      full_name: admin.full_name || null,
      security_session_id: securitySession.id,
      trusted_device_id: securitySession.trusted_device_id || null,
      mfa_assurance: "aal2",
    },
  };
}

export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const result = await getCurrentAdminLookup();

  if (!result.ok) {
    /**
     * Keep logs useful without logging raw cookies/tokens, database hints,
     * e-mail addresses or other unnecessary personal data.
     */
    console.warn("Admin access denied", {
      reason: result.reason,
      sessionId: result.sessionId,
      userId: result.userId,
    });

    return null;
  }

  return result.admin;
}

export async function hasPermission(
  permissionKey: AdminPermissionKey,
): Promise<boolean> {
  if (!isAdminPermissionKey(permissionKey)) return false;

  const admin = await getCurrentAdmin();

  if (!admin) return false;

  /**
   * main_admin is the explicit full-access role in the Burton Pride model.
   * Every other role remains deny-by-default.
   */
  if (admin.role === "main_admin") return true;

  const { data, error } = await supabaseAdmin
    .from("admin_user_permissions")
    .select(
      `
        is_allowed,
        admin_permissions!inner (
          permission_key
        )
      `,
    )
    .eq("admin_user_id", admin.id)
    .eq("admin_permissions.permission_key", permissionKey)
    .maybeSingle();

  if (error) {
    console.error("Permission lookup failed", {
      code: error.code || null,
      adminId: admin.id,
      permissionKey,
    });

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
      `,
    )
    .eq("admin_user_id", admin.id);

  if (error) {
    console.error("Admin permission list lookup failed", {
      code: error.code || null,
      adminId: admin.id,
    });

    /**
     * Fail closed. A database/permission lookup error must never produce a
     * useful default permission set.
     */
    return {
      ...admin,
      permissions: { ...NORMAL_ADMIN_DEFAULTS },
      permissionKeys: [],
    };
  }

  const rows = (data || []) as PermissionRow[];
  const permissionKeys = new Set<AdminPermissionKey>();

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

/**
 * Generic protected-admin requirement.
 *
 * API routes should catch this and return their own generic 401 response.
 * Do not send internal lookup/database diagnostics to the browser.
 */
export async function requireAdmin() {
  const admin = await getCurrentAdminPermissions();

  if (!admin) {
    throw new Error("UNAUTHORIZED_ADMIN");
  }

  return admin;
}

export async function requireMainAdmin() {
  const admin = await requireAdmin();

  if (admin.role !== "main_admin") {
    throw new Error("FORBIDDEN_MAIN_ADMIN");
  }

  return admin;
}

/**
 * Legacy boolean permission check.
 * Prefer requireAdminPermission() for new protected routes.
 */
export async function requirePermission(
  permissionKey: keyof AdminPermissions,
) {
  const admin = await requireAdmin();

  if (admin.role === "main_admin") return admin;

  if (admin.permissions[permissionKey] !== true) {
    throw new Error("FORBIDDEN_PERMISSION");
  }

  return admin;
}

export async function requireAdminPermission(
  permissionKey: AdminPermissionKey,
) {
  if (!isAdminPermissionKey(permissionKey)) {
    throw new Error("FORBIDDEN_PERMISSION");
  }

  const admin = await requireAdmin();

  if (admin.role === "main_admin") return admin;

  if (!admin.permissionKeys.includes(permissionKey)) {
    throw new Error("FORBIDDEN_PERMISSION");
  }

  return admin;
}

/**
 * Step-up helper for sensitive actions such as:
 * - changing another admin's role/permissions;
 * - MFA/security changes;
 * - destructive money operations;
 * - sensitive exports.
 *
 * The normal Admin Portal session is already required to be aal2. For a true
 * "recent authentication" check, the route should additionally verify a
 * short-lived server-side step-up timestamp/challenge created by the login/MFA
 * security flow. This helper deliberately does not pretend that an old aal2
 * session is recent enough.
 */
export async function requireStrongAdminSession() {
  const admin = await requireAdmin();

  if (admin.mfa_assurance !== "aal2") {
    throw new Error("STEP_UP_REQUIRED");
  }

  return admin;
}

export const requireMoneyPermission = requireAdminPermission;

export function isMainAdmin(admin: CurrentAdmin | null | undefined) {
  return admin?.role === "main_admin";
}

export function canEditYear(
  admin: CurrentAdminWithPermissions,
  year: string,
) {
  const currentYear = new Date().getFullYear().toString();

  if (admin.role === "main_admin") return true;

  if (year === currentYear) {
    return admin.permissions.canEditTransactions;
  }

  return admin.permissions.canEditOldYears;
}

export function getPermissionKeysFromAdmin(
  admin: CurrentAdminWithPermissions,
) {
  return admin.permissionKeys;
}
