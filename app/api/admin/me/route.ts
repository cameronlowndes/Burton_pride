import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE_NAME = "GET /api/admin/me";

const ADMIN_ID_COOKIE = "burton_admin_id";
const ADMIN_EMAIL_COOKIE = "burton_admin_email";
const SESSION_COOKIE = "burton_admin_session";

const ADMIN_COOKIE_NAMES = [
  ADMIN_ID_COOKIE,
  ADMIN_EMAIL_COOKIE,
  SESSION_COOKIE,
  "burton_admin_role",
  "burton_admin_permissions",
  "admin_session",
  "admin_id",
  "admin_email",
];

type AdminRole = "main_admin" | "admin" | "editor";

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
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean))
  );
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

function permissionsToKeys(permissions: unknown): string[] {
  if (!permissions) return [];

  if (Array.isArray(permissions)) {
    return uniqueStrings(
      permissions.filter((item): item is string => typeof item === "string")
    );
  }

  if (typeof permissions === "string") {
    return uniqueStrings(
      permissions
        .split(",")
        .map((permission) => permission.trim())
        .filter(Boolean)
    );
  }

  if (typeof permissions !== "object") return [];

  return uniqueStrings(
    Object.entries(permissions)
      .filter(([, allowed]) => permissionValueIsAllowed(allowed))
      .map(([key]) => key)
  );
}

function addDefaultPermissions(args: {
  role: AdminRole | null;
  isMainAdmin: boolean;
  permissions: string[];
}): string[] {
  const { role, isMainAdmin } = args;

  if (isMainAdmin || role === "main_admin") {
    return ALL_PERMISSION_KEYS;
  }

  const next = [...args.permissions];

  if (!next.includes("admin:dashboard:view")) {
    next.unshift("admin:dashboard:view");
  }

  return uniqueStrings(next);
}

function isExpiredDate(value: unknown): boolean {
  const dateValue = getString(value);

  if (!dateValue) return false;

  const timestamp = Date.parse(dateValue);

  if (Number.isNaN(timestamp)) return false;

  return timestamp <= Date.now();
}

function clearCookie(response: NextResponse, name: string): void {
  response.cookies.set({
    name,
    value: "",
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  });
}

function clearAdminCookies(response: NextResponse): void {
  for (const name of ADMIN_COOKIE_NAMES) {
    clearCookie(response, name);
  }
}

function noStoreHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  };
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  options?: {
    clearAdminCookies?: boolean;
  }
): NextResponse {
  const response = NextResponse.json(body, {
    status,
    headers: noStoreHeaders(),
  });

  /*
   * Only clear Burton Pride custom admin cookies.
   * Never clear sb-* or other Supabase authentication cookies here.
   */
  if (options?.clearAdminCookies) {
    clearAdminCookies(response);
  }

  return response;
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected server error.";
}

function getStoredSessionTokens(
  admin: Record<string, unknown>
): string[] {
  return uniqueStrings([
    getString(admin.session_token),
    getString(admin.admin_session_token),
    getString(admin.current_session_token),
    getString(admin.active_session_token),
  ]);
}

function getSessionExpiry(admin: Record<string, unknown>): unknown {
  return (
    admin.session_expires_at ??
    admin.admin_session_expires_at ??
    admin.current_session_expires_at ??
    null
  );
}

function buildAdminPayload(args: {
  admin: Record<string, unknown>;
  role: AdminRole | null;
  isMainAdmin: boolean;
  permissions: string[];
}) {
  const { admin, role, isMainAdmin, permissions } = args;

  return {
    id: getString(admin.id),
    email: normaliseEmail(admin.email),
    full_name:
      getString(admin.full_name) ||
      getString(admin.fullName) ||
      getString(admin.name) ||
      null,
    role,
    is_active: admin.is_active === true,
    is_main_admin: isMainAdmin,
    permissions,
  };
}

async function getCookieStore() {
  return await cookies();
}

export async function GET(): Promise<NextResponse> {
  try {
    const cookieStore = await getCookieStore();

    const adminId = getString(
      cookieStore.get(ADMIN_ID_COOKIE)?.value
    );

    const adminEmailCookie = normaliseEmail(
      cookieStore.get(ADMIN_EMAIL_COOKIE)?.value
    );

    const sessionToken = getString(
      cookieStore.get(SESSION_COOKIE)?.value
    );

    console.log(`${ROUTE_NAME} cookie check`, {
      hasAdminId: Boolean(adminId),
      hasAdminEmail: Boolean(adminEmailCookie),
      hasSessionToken: Boolean(sessionToken),
    });

    /*
     * The custom session token is required.
     * Do not clear cookies immediately here because the login response may
     * still be completing when the frontend makes its first /api/admin/me call.
     */
    if (!sessionToken) {
      return jsonResponse(
        {
          ok: false,
          authenticated: false,
          error: "Unauthorized",
          reason: "missing_admin_session_cookie",
          message:
            "The Burton Pride admin session cookie was not received.",
          likelyFix:
            "Check that the login route sets burton_admin_session with path '/'.",
          route: ROUTE_NAME,
        },
        401
      );
    }

    /*
     * We need at least one identity cookie.
     * The API can recover using email if the ID cookie is missing.
     */
    if (!adminId && !adminEmailCookie) {
      return jsonResponse(
        {
          ok: false,
          authenticated: false,
          error: "Unauthorized",
          reason: "missing_admin_identity_cookies",
          message:
            "The admin session exists, but no admin ID or email cookie was received.",
          likelyFix:
            "Check that the login route sets burton_admin_id or burton_admin_email with path '/'.",
          route: ROUTE_NAME,
        },
        401
      );
    }

    let adminQuery = supabaseAdmin
      .from("admin_users")
      .select("*");

    if (adminId) {
      adminQuery = adminQuery.eq("id", adminId);
    } else {
      adminQuery = adminQuery.ilike(
        "email",
        adminEmailCookie
      );
    }

    const { data: admin, error: adminError } =
      await adminQuery.maybeSingle();

    if (adminError) {
      console.error(
        `${ROUTE_NAME} database error:`,
        adminError
      );

      return jsonResponse(
        {
          ok: false,
          authenticated: false,
          error: adminError.message,
          reason: "admin_database_error",
          message:
            "The admin API could not read the admin_users table.",
          route: ROUTE_NAME,
        },
        500
      );
    }

    if (!admin) {
      return jsonResponse(
        {
          ok: false,
          authenticated: false,
          error: "Admin account was not found",
          reason: "admin_record_missing",
          message:
            "The session cookie exists, but no matching admin row was found.",
          likelyFix:
            "Check that the login route stores the correct admin ID or email.",
          route: ROUTE_NAME,
        },
        401,
        {
          clearAdminCookies: true,
        }
      );
    }

    const adminRecord =
      admin as Record<string, unknown>;

    const adminEmail =
      normaliseEmail(adminRecord.email);

    if (adminRecord.is_active !== true) {
      return jsonResponse(
        {
          ok: false,
          authenticated: false,
          error: "Admin account is inactive",
          reason: "admin_record_inactive",
          message:
            "Your admin account exists, but it is not currently active.",
          likelyFix:
            "Check public.admin_users and make sure is_active is true.",
          route: ROUTE_NAME,
        },
        403,
        {
          clearAdminCookies: true,
        }
      );
    }

    /*
     * Only compare the email when an email cookie was actually supplied.
     */
    if (
      adminEmailCookie &&
      (!adminEmail || adminEmail !== adminEmailCookie)
    ) {
      return jsonResponse(
        {
          ok: false,
          authenticated: false,
          error: "Admin session email mismatch",
          reason: "admin_cookie_email_mismatch",
          message:
            "The admin email cookie does not match the active admin account.",
          likelyFix:
            "Sign out, clear the custom Burton Pride admin cookies and sign in again.",
          route: ROUTE_NAME,
        },
        401,
        {
          clearAdminCookies: true,
        }
      );
    }

    /*
     * Validate a stored database session token only when the admin row
     * actually contains one. This preserves compatibility with older rows.
     */
    const storedSessionTokens =
      getStoredSessionTokens(adminRecord);

    if (
      storedSessionTokens.length > 0 &&
      !storedSessionTokens.includes(sessionToken)
    ) {
      return jsonResponse(
        {
          ok: false,
          authenticated: false,
          error: "Admin session has expired",
          reason: "admin_session_token_mismatch",
          message:
            "The session cookie no longer matches the active database session.",
          likelyFix:
            "Sign out and sign back in to create a new session.",
          route: ROUTE_NAME,
        },
        401,
        {
          clearAdminCookies: true,
        }
      );
    }

    if (isExpiredDate(getSessionExpiry(adminRecord))) {
      return jsonResponse(
        {
          ok: false,
          authenticated: false,
          error: "Admin session has expired",
          reason: "admin_session_expired",
          message: "Your admin session has expired.",
          likelyFix:
            "Sign out and sign back in to create a new session.",
          route: ROUTE_NAME,
        },
        401,
        {
          clearAdminCookies: true,
        }
      );
    }

    const role =
      normaliseRole(adminRecord.role);

    const isMainAdmin =
      adminRecord.is_main_admin === true ||
      role === "main_admin";

    const permissions = addDefaultPermissions({
      role,
      isMainAdmin,
      permissions: permissionsToKeys(
        adminRecord.permissions
      ),
    });

    const adminPayload = buildAdminPayload({
      admin: adminRecord,
      role,
      isMainAdmin,
      permissions,
    });

    return jsonResponse({
      ok: true,
      authenticated: true,
      admin: adminPayload,
      user: adminPayload,
      permissions,
      route: ROUTE_NAME,
    });
  } catch (error: unknown) {
    console.error(`${ROUTE_NAME} error:`, error);

    return jsonResponse(
      {
        ok: false,
        authenticated: false,
        error: safeErrorMessage(error),
        reason: "unexpected_admin_api_error",
        message:
          "The admin API crashed while checking the admin account.",
        likelyFix:
          "Check the login cookies and the public.admin_users table.",
        route: ROUTE_NAME,
      },
      500
    );
  }
}
