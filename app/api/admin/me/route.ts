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

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normaliseEmail(value: unknown) {
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

function uniqueStrings(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean))
  );
}

function permissionValueIsAllowed(value: unknown) {
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
}) {
  const { role, isMainAdmin } = args;

  if (isMainAdmin || role === "main_admin") {
    return ALL_PERMISSION_KEYS;
  }

  const next = [...args.permissions];

  /**
   * This keeps normal admins able to enter the dashboard if they have
   * any admin access but their old permissions object missed this key.
   */
  if (!next.includes("admin:dashboard:view")) {
    next.unshift("admin:dashboard:view");
  }

  return uniqueStrings(next);
}

function isExpiredDate(value: unknown) {
  const dateValue = getString(value);

  if (!dateValue) return false;

  const timestamp = Date.parse(dateValue);

  if (Number.isNaN(timestamp)) return false;

  return timestamp <= Date.now();
}

function clearCookie(response: NextResponse, name: string) {
  response.cookies.set({
    name,
    value: "",
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

function clearAdminCookies(response: NextResponse, cookieNames: string[] = []) {
  const names = uniqueStrings([...ADMIN_COOKIE_NAMES, ...cookieNames]);

  for (const name of names) {
    clearCookie(response, name);
  }
}

function noStoreHeaders() {
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
    clearCookies?: boolean;
    extraCookieNamesToClear?: string[];
  }
) {
  const response = NextResponse.json(body, {
    status,
    headers: noStoreHeaders(),
  });

  if (options?.clearCookies) {
    clearAdminCookies(response, options.extraCookieNamesToClear);
  }

  return response;
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected server error.";
}

function getStoredSessionTokens(admin: Record<string, unknown>) {
  return uniqueStrings([
    getString(admin.session_token),
    getString(admin.admin_session_token),
    getString(admin.current_session_token),
    getString(admin.active_session_token),
  ]);
}

function getSessionExpiry(admin: Record<string, unknown>) {
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

export async function GET() {
  let extraCookieNamesToClear: string[] = [];

  try {
    const cookieStore = await getCookieStore();

    extraCookieNamesToClear = cookieStore
      .getAll()
      .map((cookie) => cookie.name)
      .filter((name) => {
        return (
          name.startsWith("sb-") ||
          name.toLowerCase().includes("supabase") ||
          name.toLowerCase().includes("auth-token")
        );
      });

    const adminId = getString(cookieStore.get(ADMIN_ID_COOKIE)?.value);
    const adminEmailCookie = normaliseEmail(
      cookieStore.get(ADMIN_EMAIL_COOKIE)?.value
    );
    const sessionToken = getString(cookieStore.get(SESSION_COOKIE)?.value);

    if (!adminId || !adminEmailCookie || !sessionToken) {
      return jsonResponse(
        {
          ok: false,
          authenticated: false,
          error: "Unauthorized",
          reason: "missing_custom_admin_session",
          message:
            "No active Burton Pride admin session was received by the admin API.",
          likelyFix:
            "Sign out and sign back in using the Admin Portal login page.",
          route: ROUTE_NAME,
        },
        401,
        {
          clearCookies: true,
          extraCookieNamesToClear,
        }
      );
    }

    const { data: admin, error: adminError } = await supabaseAdmin
      .from("admin_users")
      .select("*")
      .eq("id", adminId)
      .maybeSingle();

    if (adminError) {
      console.error(`${ROUTE_NAME} database error:`, adminError);

      return jsonResponse(
        {
          ok: false,
          authenticated: false,
          error: adminError.message,
          reason: "admin_database_error",
          message: "The admin API could not read the admin_users table.",
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
            "The admin session cookie exists, but no matching admin row was found.",
          likelyFix:
            "The session is stale. Sign in again using the Admin Portal login page.",
          route: ROUTE_NAME,
        },
        401,
        {
          clearCookies: true,
          extraCookieNamesToClear,
        }
      );
    }

    const adminRecord = admin as Record<string, unknown>;
    const adminEmail = normaliseEmail(adminRecord.email);

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
            "Ask a main admin to check public.admin_users and make sure is_active is true.",
          route: ROUTE_NAME,
        },
        403,
        {
          clearCookies: true,
          extraCookieNamesToClear,
        }
      );
    }

    if (!adminEmail || adminEmail !== adminEmailCookie) {
      return jsonResponse(
        {
          ok: false,
          authenticated: false,
          error: "Admin session email mismatch",
          reason: "admin_cookie_email_mismatch",
          message:
            "The admin session cookies do not match the active admin account.",
          likelyFix:
            "The session is stale. Sign out and sign back in.",
          route: ROUTE_NAME,
        },
        401,
        {
          clearCookies: true,
          extraCookieNamesToClear,
        }
      );
    }

    /**
     * If your admin_users table stores a session token, validate it.
     * This keeps backwards compatibility: if no token column exists in the row,
     * the old cookie session still works.
     */
    const storedSessionTokens = getStoredSessionTokens(adminRecord);

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
            "The admin session token no longer matches the active admin account.",
          likelyFix: "Sign in again using the Admin Portal login page.",
          route: ROUTE_NAME,
        },
        401,
        {
          clearCookies: true,
          extraCookieNamesToClear,
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
          likelyFix: "Sign in again using the Admin Portal login page.",
          route: ROUTE_NAME,
        },
        401,
        {
          clearCookies: true,
          extraCookieNamesToClear,
        }
      );
    }

    const role = normaliseRole(adminRecord.role);
    const isMainAdmin =
      adminRecord.is_main_admin === true || role === "main_admin";

    const permissions = addDefaultPermissions({
      role,
      isMainAdmin,
      permissions: permissionsToKeys(adminRecord.permissions),
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
        message: "The admin API crashed while checking the admin account.",
        likelyFix:
          "Check the cookies set by the login route and check public.admin_users.",
        route: ROUTE_NAME,
      },
      500
    );
  }
}
