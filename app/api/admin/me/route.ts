import { createHash, randomUUID } from "node:crypto";
import { isIP } from "node:net";

import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE_NAME = "GET /api/admin/me";
const TRUSTED_DEVICE_COOKIE = "burton_admin_trusted_device";
const ADMIN_SECURITY_SESSION_COOKIE =
  "burton_admin_security_session";
const REQUIRED_AAL = "aal2";
const MAX_TRUSTED_DEVICES = 5;
const REQUIRED_PORTAL_PERMISSION = "admin:dashboard:view" as const;


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
  "event_audit:view",
  "event_audit:view_all_events",
  "event_audit:view_security",

  "security:manage_devices",
  "security:manage_mfa",
  "security:manage_admins",
  "security:view_login_history",
] as const;

type PermissionKey = (typeof ALL_PERMISSION_KEYS)[number];
type AdminRole = "main_admin" | "admin" | "editor";
type RiskLevel = "low" | "medium" | "high" | "critical";
type AuditResult = "success" | "denied" | "error";

type AdminRow = {
  id: string;
  auth_user_id: string | null;
  email: string | null;
  full_name: string | null;
  name?: string | null;
  role: string | null;
  is_active: boolean | null;
  is_main_admin: boolean | null;
  permissions: unknown;
};

type TrustedDeviceRow = {
  id: string;
  admin_id: string;
  device_token_hash: string;
  device_name: string | null;
  browser: string | null;
  operating_system: string | null;
  device_type: string | null;
  first_seen_at: string;
  last_seen_at: string;
  trusted_at: string;
  revoked_at: string | null;
};

type SecuritySessionRow = {
  id: string;
  admin_id: string;
  trusted_device_id: string | null;
  auth_session_ref: string;
  aal: string | null;
  created_at: string;
  last_seen_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
};

type RequestContext = {
  ipAddress: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  userAgent: string | null;
};

type DenialReason =
  | "unauthorized"
  | "mfa_required"
  | "admin_not_authorized"
  | "portal_permission_required"
  | "trusted_device_required"
  | "trusted_device_limit_violation"
  | "security_session_required"
  | "session_revoked"
  | "security_service_unavailable";

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normaliseEmail(value: unknown): string {
  return getString(value).toLowerCase();
}

function normaliseRole(value: unknown): AdminRole | null {
  const role = getString(value)
    .toLowerCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");

  if (role === "main_admin" || role === "mainadmin" || role === "owner") {
    return "main_admin";
  }

  if (role === "admin") return "admin";
  if (role === "editor") return "editor";

  return null;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function permissionValueIsAllowed(value: unknown): boolean {
  return (
    value === true ||
    value === "true" ||
    value === 1 ||
    value === "1" ||
    value === "yes" ||
    value === "allowed"
  );
}

function permissionsToKeys(permissions: unknown): PermissionKey[] {
  let values: string[] = [];

  if (Array.isArray(permissions)) {
    values = permissions.filter(
      (item): item is string => typeof item === "string",
    );
  } else if (typeof permissions === "string") {
    values = permissions.split(",");
  } else if (permissions && typeof permissions === "object") {
    values = Object.entries(permissions)
      .filter(([, allowed]) => permissionValueIsAllowed(allowed))
      .map(([key]) => key);
  }

  const allowList = new Set<string>(ALL_PERMISSION_KEYS);

  return uniqueStrings(values).filter(
    (permission): permission is PermissionKey => allowList.has(permission),
  );
}

function hashWithPepper(value: string): string {
  const pepper = process.env.ADMIN_2FA_PEPPER;

  if (!pepper || pepper.length < 32) {
    throw new Error(
      "Admin security hashing configuration is unavailable.",
    );
  }

  return createHash("sha256")
    .update(`${pepper}:${value}`)
    .digest("hex");
}

function safeDecodeHeader(value: string | null): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return decodeURIComponent(trimmed).slice(0, 150);
  } catch {
    return trimmed.slice(0, 150);
  }
}

function normaliseIp(value: string | null): string | null {
  if (!value) return null;

  const candidate = value.split(",")[0]?.trim() ?? "";
  if (!candidate) return null;

  const withoutPort =
    candidate.startsWith("[") && candidate.includes("]")
      ? candidate.slice(1, candidate.indexOf("]"))
      : candidate;

  return isIP(withoutPort) ? withoutPort : null;
}

async function getRequestContext(): Promise<RequestContext> {
  const headerStore = await headers();

  /*
   * Only trust these forwarding/location headers when your production proxy or
   * hosting platform overwrites them. Never accept IP/location from request
   * body/query parameters as authoritative security data.
   */
  const ipAddress =
    normaliseIp(headerStore.get("x-real-ip")) ??
    normaliseIp(headerStore.get("x-forwarded-for"));

  return {
    ipAddress,
    city: safeDecodeHeader(headerStore.get("x-vercel-ip-city")),
    region: safeDecodeHeader(headerStore.get("x-vercel-ip-country-region")),
    country: safeDecodeHeader(headerStore.get("x-vercel-ip-country")),
    userAgent: getString(headerStore.get("user-agent")).slice(0, 1000) || null,
  };
}

function securityHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    Pragma: "no-cache",
    Expires: "0",
    Vary: "Cookie",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  };
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: securityHeaders(),
  });
}

function denied(
  status: number,
  reason: DenialReason,
  extra: Record<string, unknown> = {},
): NextResponse {
  const messages: Record<DenialReason, string> = {
    unauthorized: "Your admin session is not valid.",
    mfa_required: "Multi-factor authentication is required.",
    admin_not_authorized: "This account is not authorised for the Admin Portal.",
    portal_permission_required: "You do not have permission to access the Admin Portal.",
    trusted_device_required:
      "This device must be verified before Admin Portal access is allowed.",
    trusted_device_limit_violation:
      "The trusted-device security limit requires administrator review.",
    security_session_required:
      "Your Admin Portal security session must be verified.",
    session_revoked: "This admin session is no longer active.",
    security_service_unavailable:
      "The security service could not verify this request.",
  };

  return jsonResponse(
    {
      ok: false,
      authenticated: !["unauthorized", "session_revoked"].includes(reason),
      authorized: false,
      error: messages[reason],
      reason,
      ...extra,
    },
    status,
  );
}

async function createAuthenticatedSupabaseClient() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase public authentication configuration is missing.");
  }

  const client = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          try {
            cookieStore.set(name, value, options);
          } catch {
            /*
             * Do not weaken authentication if a read-only cookie context is
             * encountered. getUser() remains the authoritative verification.
             */
          }
        }
      },
    },
  });

  return { client, cookieStore };
}

async function writeSecurityEvent(args: {
  actorType: "authenticated_admin" | "authenticated_user" | "system";
  admin?: AdminRow | null;
  authUserId?: string | null;
  action: string;
  result: AuditResult;
  riskLevel: RiskLevel;
  context: RequestContext;
  trustedDeviceId?: string | null;
  sessionId?: string | null;
  aal?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const role = args.admin ? normaliseRole(args.admin.role) : null;

  const { error } = await supabaseAdmin.from("admin_security_events").insert({
    id: randomUUID(),
    actor_type: args.actorType,
    admin_id: args.admin?.id ?? null,
    auth_user_id: args.authUserId ?? args.admin?.auth_user_id ?? null,
    admin_name: args.admin?.full_name ?? args.admin?.name ?? null,
    admin_role: role,
    action: args.action,
    area: "admin_permissions",
    route: ROUTE_NAME,
    http_method: "GET",
    result: args.result,
    risk_level: args.riskLevel,
    ip_address: args.context.ipAddress,
    city: args.context.city,
    region: args.context.region,
    country: args.context.country,
    user_agent: args.context.userAgent,
    trusted_device_id: args.trustedDeviceId ?? null,
    security_session_id: args.sessionId ?? null,
    aal: args.aal ?? null,
    metadata: args.metadata ?? {},
  });

  if (error) {
    // Deliberately log only the provider error code, not raw DB details to users.
    console.error(`${ROUTE_NAME} security audit write failed`, {
      code: error.code,
    });
  }
}

function isExpired(isoDate: string | null): boolean {
  if (!isoDate) return false;

  const timestamp = Date.parse(isoDate);
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

function sessionExpiresAt(expiresAtSeconds: number | undefined): string | null {
  if (!expiresAtSeconds || !Number.isFinite(expiresAtSeconds)) return null;
  return new Date(expiresAtSeconds * 1000).toISOString();
}

function buildAdminPayload(args: {
  admin: AdminRow;
  role: AdminRole;
  permissions: PermissionKey[];
}) {
  const { admin, role, permissions } = args;

  return {
    id: admin.id,
    email: normaliseEmail(admin.email),
    full_name: getString(admin.full_name) || getString(admin.name) || null,
    role,
    is_active: admin.is_active === true,
    is_main_admin: admin.is_main_admin === true || role === "main_admin",
    permissions,
  };
}

export async function GET(): Promise<NextResponse> {
  const context = await getRequestContext();

  try {
    const { client: supabase, cookieStore } =
      await createAuthenticatedSupabaseClient();

    /*
     * 1. AUTHORITATIVE IDENTITY
     * Validate the actual Supabase Auth user on the server. Legacy Burton
     * admin-id/email/role/permissions cookies are intentionally ignored.
     */
    /*
     * Ask Supabase to restore/refresh the cookie-backed session first.
     * We DO NOT trust getSession() as the authorization decision; getUser()
     * below remains the authoritative server-side identity check.
     */
    await supabase.auth.getSession();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      await writeSecurityEvent({
        actorType: "system",
        action: "permission_context_denied",
        result: "denied",
        riskLevel: "medium",
        context,
        metadata: { reason: "no_valid_supabase_user" },
      });

      return jsonResponse({
        ok: true,
        authenticated: false,
        authorized: false,
        admin: null,
        user: null,
        permissions: [],
        reason: "unauthorized",
        requires_login: true,
        route: ROUTE_NAME,
      });
    }

    /* 2. MANDATORY MFA / AAL2 */
    const { data: aalData, error: aalError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aalError) {
      console.error(`${ROUTE_NAME} AAL check failed`, { code: aalError.code });
      return denied(503, "security_service_unavailable");
    }

    const currentAal = aalData?.currentLevel ?? null;

    if (currentAal !== REQUIRED_AAL) {
      await writeSecurityEvent({
        actorType: "authenticated_user",
        authUserId: user.id,
        action: "permission_context_denied",
        result: "denied",
        riskLevel: "medium",
        context,
        aal: currentAal,
        metadata: { reason: "mfa_assurance_too_low" },
      });

      return denied(403, "mfa_required", {
        requires_mfa: true,
        current_aal: currentAal,
        required_aal: REQUIRED_AAL,
      });
    }

    /*
     * 3. SERVER-SIDE ADMIN MAPPING
     * Resolve the Burton Pride admin exclusively through auth_user_id.
     */
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from("admin_users")
      .select(
        "id, auth_user_id, email, full_name, name, role, is_active, is_main_admin, permissions",
      )
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (adminError) {
      console.error(`${ROUTE_NAME} admin lookup failed`, {
        code: adminError.code,
      });
      return denied(503, "security_service_unavailable");
    }

    const admin = (adminData ?? null) as AdminRow | null;

    if (!admin || admin.is_active !== true) {
      await writeSecurityEvent({
        actorType: "authenticated_user",
        authUserId: user.id,
        admin,
        action: "permission_context_denied",
        result: "denied",
        riskLevel: "high",
        context,
        aal: currentAal,
        metadata: {
          reason: !admin ? "admin_mapping_missing" : "admin_inactive",
        },
      });

      return denied(403, "admin_not_authorized");
    }

    const role = normaliseRole(admin.role);

    if (!role) {
      await writeSecurityEvent({
        actorType: "authenticated_admin",
        authUserId: user.id,
        admin,
        action: "permission_context_denied",
        result: "denied",
        riskLevel: "high",
        context,
        aal: currentAal,
        metadata: { reason: "invalid_admin_role" },
      });

      return denied(403, "admin_not_authorized");
    }

    /*
     * 4. EXPLICIT PERMISSIONS ONLY
     * No role wildcard and no automatic dashboard permission are granted.
     */
    const permissions = permissionsToKeys(admin.permissions);

    if (!permissions.includes(REQUIRED_PORTAL_PERMISSION)) {
      await writeSecurityEvent({
        actorType: "authenticated_admin",
        authUserId: user.id,
        admin,
        action: "permission_context_denied",
        result: "denied",
        riskLevel: "medium",
        context,
        aal: currentAal,
        metadata: { reason: "dashboard_permission_missing" },
      });

      return denied(403, "portal_permission_required");
    }

    /* 5. ENFORCE MAXIMUM THREE ACTIVE TRUSTED DEVICES */
    const { count: activeTrustedDeviceCount, error: countError } =
      await supabaseAdmin
        .from("admin_trusted_devices")
        .select("id", { count: "exact", head: true })
        .eq("admin_id", admin.id)
        .is("revoked_at", null);

    if (countError) {
      console.error(`${ROUTE_NAME} trusted-device count failed`, {
        code: countError.code,
      });
      return denied(503, "security_service_unavailable");
    }

    if ((activeTrustedDeviceCount ?? 0) > MAX_TRUSTED_DEVICES) {
      await writeSecurityEvent({
        actorType: "authenticated_admin",
        authUserId: user.id,
        admin,
        action: "trusted_device_limit_violation",
        result: "denied",
        riskLevel: "critical",
        context,
        aal: currentAal,
        metadata: {
          active_trusted_devices: activeTrustedDeviceCount,
          maximum_allowed: MAX_TRUSTED_DEVICES,
        },
      });

      return denied(403, "trusted_device_limit_violation");
    }

    /* 6. VERIFY CRYPTOGRAPHIC TRUSTED-DEVICE TOKEN */
    const trustedDeviceToken = getString(
      cookieStore.get(TRUSTED_DEVICE_COOKIE)?.value,
    );

    if (!trustedDeviceToken) {
      await writeSecurityEvent({
        actorType: "authenticated_admin",
        authUserId: user.id,
        admin,
        action: "new_device_detected",
        result: "denied",
        riskLevel: "medium",
        context,
        aal: currentAal,
        metadata: {
          reason: "trusted_device_cookie_missing",
          active_trusted_devices: activeTrustedDeviceCount ?? 0,
        },
      });

      return denied(403, "trusted_device_required", {
        requires_trusted_device: true,
        trusted_devices_used: activeTrustedDeviceCount ?? 0,
        trusted_devices_max: MAX_TRUSTED_DEVICES,
      });
    }

    const trustedDeviceHash =
      hashWithPepper(trustedDeviceToken);

    const { data: trustedDeviceData, error: trustedDeviceError } =
      await supabaseAdmin
        .from("admin_trusted_devices")
        .select(
          "id, admin_id, device_token_hash, device_name, browser, operating_system, device_type, first_seen_at, last_seen_at, trusted_at, revoked_at",
        )
        .eq("admin_id", admin.id)
        .eq("device_token_hash", trustedDeviceHash)
        .is("revoked_at", null)
        .maybeSingle();

    if (trustedDeviceError) {
      console.error(`${ROUTE_NAME} trusted-device lookup failed`, {
        code: trustedDeviceError.code,
      });
      return denied(503, "security_service_unavailable");
    }

    const trustedDevice =
      (trustedDeviceData ?? null) as TrustedDeviceRow | null;

    if (!trustedDevice) {
      await writeSecurityEvent({
        actorType: "authenticated_admin",
        authUserId: user.id,
        admin,
        action: "new_device_detected",
        result: "denied",
        riskLevel: "high",
        context,
        aal: currentAal,
        metadata: { reason: "trusted_device_not_recognised" },
      });

      return denied(403, "trusted_device_required", {
        requires_trusted_device: true,
        trusted_devices_used: activeTrustedDeviceCount ?? 0,
        trusted_devices_max: MAX_TRUSTED_DEVICES,
      });
    }

    /*
     * 7. SESSION REFERENCE + SERVER-SIDE REVOCATION
     *
     * IMPORTANT:
     * The two-factor verify route creates a cryptographically random
     * raw session reference, stores hashWithPepper(rawSessionRef) in
     * admin_security_sessions, and sends the raw reference in the
     * burton_admin_security_session HttpOnly cookie.
     *
     * This permissions route MUST validate that same cookie. It must
     * not derive auth_session_ref from the Supabase access token,
     * because that creates a second incompatible session identity and
     * can cause an Admin -> 2FA -> Admin redirect loop.
     */
    const rawSecuritySessionRef = getString(
      cookieStore.get(
        ADMIN_SECURITY_SESSION_COOKIE,
      )?.value,
    );

    if (!rawSecuritySessionRef) {
      await writeSecurityEvent({
        actorType: "authenticated_admin",
        authUserId: user.id,
        admin,
        action: "security_session_cookie_missing",
        result: "denied",
        riskLevel: "medium",
        context,
        trustedDeviceId: trustedDevice.id,
        aal: currentAal,
        metadata: {
          reason: "security_session_cookie_missing",
        },
      });

      return denied(403, "security_session_required", {
        authenticated: true,
        requires_security_session: true,
        requires_mfa: false,
        requires_trusted_device: false,
      });
    }

    const authSessionRef = hashWithPepper(
      rawSecuritySessionRef,
    );

    const {
      data: securitySessionData,
      error: securitySessionError,
    } = await supabaseAdmin
      .from("admin_security_sessions")
      .select(
        "id, admin_id, trusted_device_id, auth_session_ref, aal, created_at, last_seen_at, expires_at, revoked_at, revoke_reason",
      )
      .eq("admin_id", admin.id)
      .eq("trusted_device_id", trustedDevice.id)
      .eq("auth_session_ref", authSessionRef)
      .is("revoked_at", null)
      .maybeSingle();

    if (securitySessionError) {
      console.error(
        `${ROUTE_NAME} security-session lookup failed`,
        {
          code: securitySessionError.code,
        },
      );

      return denied(
        503,
        "security_service_unavailable",
      );
    }

    const securitySession =
      (securitySessionData ??
        null) as SecuritySessionRow | null;

    if (!securitySession) {
      await writeSecurityEvent({
        actorType: "authenticated_admin",
        authUserId: user.id,
        admin,
        action: "security_session_not_found",
        result: "denied",
        riskLevel: "high",
        context,
        trustedDeviceId: trustedDevice.id,
        aal: currentAal,
      });

      return denied(403, "security_session_required", {
        authenticated: true,
        requires_login: false,
        requires_security_session: true,
        requires_mfa: true,
        requires_trusted_device: false,
      });
    }

    if (
      securitySession.admin_id !== admin.id ||
      securitySession.trusted_device_id !== trustedDevice.id
    ) {
      await writeSecurityEvent({
        actorType: "authenticated_admin",
        authUserId: user.id,
        admin,
        action: "security_session_binding_mismatch",
        result: "denied",
        riskLevel: "critical",
        context,
        trustedDeviceId: trustedDevice.id,
        sessionId: securitySession.id,
        aal: currentAal,
      });

      return denied(403, "security_session_required", {
        authenticated: true,
        requires_login: false,
        requires_security_session: true,
        requires_mfa: true,
        requires_trusted_device: true,
      });
    }

    if (
      securitySession.revoked_at ||
      isExpired(securitySession.expires_at)
    ) {
      await writeSecurityEvent({
        actorType: "authenticated_admin",
        authUserId: user.id,
        admin,
        action: "session_revoked_access_denied",
        result: "denied",
        riskLevel: "high",
        context,
        trustedDeviceId: trustedDevice.id,
        sessionId: securitySession.id,
        aal: currentAal,
      });

      return denied(403, "security_session_required", {
        authenticated: true,
        requires_login: false,
        requires_security_session: true,
        requires_mfa: true,
        requires_trusted_device: false,
      });
    }

    if (securitySession.aal !== "aal2") {
      await writeSecurityEvent({
        actorType: "authenticated_admin",
        authUserId: user.id,
        admin,
        action: "security_session_aal_invalid",
        result: "denied",
        riskLevel: "high",
        context,
        trustedDeviceId: trustedDevice.id,
        sessionId: securitySession.id,
        aal: currentAal,
        metadata: {
          stored_aal: securitySession.aal,
          required_aal: "aal2",
        },
      });

      return denied(403, "mfa_required", {
        requires_mfa: true,
        current_aal: currentAal,
        required_aal: "aal2",
      });
    }

    const nowIso = new Date().toISOString();

    const { error: updateSessionError } =
      await supabaseAdmin
        .from("admin_security_sessions")
        .update({
          trusted_device_id: trustedDevice.id,
          ip_address: context.ipAddress,
          city: context.city,
          region: context.region,
          country: context.country,
          user_agent: context.userAgent,
          aal: "aal2",
          last_seen_at: nowIso,
        })
        .eq("id", securitySession.id)
        .eq("admin_id", admin.id)
        .eq(
          "trusted_device_id",
          trustedDevice.id,
        )
        .is("revoked_at", null);

    if (updateSessionError) {
      console.error(
        `${ROUTE_NAME} security-session update failed`,
        {
          code: updateSessionError.code,
        },
      );

      return denied(
        503,
        "security_service_unavailable",
      );
    }

    /* 8. UPDATE TRUSTED-DEVICE ACTIVITY AFTER ALL SECURITY CHECKS PASS */
    const { error: deviceUpdateError } = await supabaseAdmin
      .from("admin_trusted_devices")
      .update({
        last_seen_at: nowIso,
        last_ip: context.ipAddress,
        last_city: context.city,
        last_region: context.region,
        last_country: context.country,
        last_session_id: securitySession.id,
        updated_at: nowIso,
      })
      .eq("id", trustedDevice.id)
      .eq("admin_id", admin.id)
      .is("revoked_at", null);

    if (deviceUpdateError) {
      // Access has already been securely verified; activity write failure should
      // be visible to operators but must not expose DB details to the client.
      console.error(`${ROUTE_NAME} trusted-device activity update failed`, {
        code: deviceUpdateError.code,
      });
    }

    const adminPayload = buildAdminPayload({ admin, role, permissions });

    /*
     * Avoid logging every successful permission poll to prevent audit flooding.
     * Successful verification is still represented by the security-session and
     * trusted-device last_seen_at values. Denials/errors above are audited.
     */

    return jsonResponse({
      ok: true,
      authenticated: true,
      authorized: true,
      admin: adminPayload,
      user: adminPayload,
      permissions,
      security: {
        aal: currentAal,
        mfa_verified: true,
        trusted_device_id: trustedDevice.id,
        trusted_devices_used: activeTrustedDeviceCount ?? 0,
        trusted_devices_max: MAX_TRUSTED_DEVICES,
        session_id: securitySession.id,
        session_expires_at: securitySession.expires_at,
        session_revoked: false,
      },
      route: ROUTE_NAME,
    });
  } catch (error: unknown) {
    console.error(`${ROUTE_NAME} unexpected error`, {
      name: error instanceof Error ? error.name : "UnknownError",
    });

    await writeSecurityEvent({
      actorType: "system",
      action: "permission_context_error",
      result: "error",
      riskLevel: "high",
      context,
      metadata: { reason: "unexpected_server_error" },
    }).catch(() => undefined);

    return denied(503, "security_service_unavailable");
  }
}
