import { randomBytes } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE_NAME = "POST /api/admin/login";

const ADMIN_ID_COOKIE = "burton_admin_id";
const ADMIN_EMAIL_COOKIE = "burton_admin_email";
const ADMIN_SESSION_COOKIE = "burton_admin_session";
const ADMIN_ROLE_COOKIE = "burton_admin_role";
const ADMIN_PERMISSIONS_COOKIE = "burton_admin_permissions";

const SESSION_MAX_AGE = 60 * 60 * 12; // 12 hours

type PendingCookie = {
  name: string;
  value: string;
  options?: CookieOptions;
};

type LoginBody = {
  email?: unknown;
  password?: unknown;
  next?: unknown;
};

type AdminUser = {
  id: string;
  email: string;
  role: string | null;
  permissions?: unknown;
  is_active: boolean;
  is_main_admin?: boolean | null;
  supabase_user_id: string | null;
};

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanEmail(value: unknown): string {
  return cleanString(value).toLowerCase();
}

function cleanPassword(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function emailLooksValid(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function noStoreHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  };
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

function permissionKeys(value: unknown): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) return [];

    try {
      return permissionKeys(JSON.parse(trimmed));
    } catch {
      return Array.from(
        new Set(
          trimmed
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      );
    }
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, allowed]) => permissionValueIsAllowed(allowed))
      .map(([key]) => key.trim())
      .filter(Boolean);
  }

  return [];
}

function getSafeNextPath(value: unknown): string {
  const next = cleanString(value);

  if (!next || !next.startsWith("/Admin") || next.startsWith("//")) {
    return "/Admin/Dashboard";
  }

  return next;
}

function applyPendingCookies(
  response: NextResponse,
  pendingCookies: PendingCookie[],
): void {
  for (const cookie of pendingCookies) {
    response.cookies.set({
      name: cookie.name,
      value: cookie.value,
      ...cookie.options,
      sameSite: cookie.options?.sameSite ?? "lax",
      secure:
        cookie.options?.secure ?? process.env.NODE_ENV === "production",
      path: cookie.options?.path ?? "/",
    });
  }
}

function setAdminCookie(
  response: NextResponse,
  name: string,
  value: string,
  options?: {
    httpOnly?: boolean;
  },
): void {
  response.cookies.set({
    name,
    value,
    httpOnly: options?.httpOnly ?? true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

function createJsonResponse(
  body: Record<string, unknown>,
  status: number,
  pendingCookies: PendingCookie[],
): NextResponse {
  const response = NextResponse.json(body, {
    status,
    headers: noStoreHeaders(),
  });

  applyPendingCookies(response, pendingCookies);

  return response;
}

function genericFailed(
  pendingCookies: PendingCookie[],
  status = 401,
  reason = "sign_in_failed",
): NextResponse {
  return createJsonResponse(
    {
      ok: false,
      authenticated: false,
      message: "Sign in failed.",
      reason,
    },
    status,
    pendingCookies,
  );
}

function createLoginSupabaseClient(
  request: NextRequest,
  pendingCookies: PendingCookie[],
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase public environment variables are missing.");
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },

      setAll(cookiesToSet) {
        /*
         * Save every Supabase auth-cookie mutation. These cookies are copied
         * onto the exact NextResponse returned at the end of this request.
         */
        for (const cookie of cookiesToSet) {
          pendingCookies.push(cookie);
        }
      },
    },
  });
}

async function clearSupabaseSession(
  supabase: ReturnType<typeof createLoginSupabaseClient>,
): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.error(`${ROUTE_NAME} failed to clear Supabase session:`, error);
  }
}

async function storeSessionToken(
  adminId: string,
  sessionToken: string,
): Promise<void> {
  /*
   * These updates are optional for backwards compatibility.
   * /api/admin/me can use the cookie-only token when these columns do not exist.
   */
  const tokenResult = await supabaseAdmin
    .from("admin_users")
    .update({
      session_token: sessionToken,
    })
    .eq("id", adminId);

  if (tokenResult.error) {
    const message = tokenResult.error.message.toLowerCase();
    const missingColumn =
      tokenResult.error.code === "42703" ||
      tokenResult.error.code === "PGRST204" ||
      message.includes("session_token");

    if (!missingColumn) {
      throw new Error(
        `Could not store admin session token: ${tokenResult.error.message}`,
      );
    }

    console.warn(
      `${ROUTE_NAME}: admin_users.session_token is not available; using cookie-only session.`,
    );

    return;
  }

  const expiresAt = new Date(
    Date.now() + SESSION_MAX_AGE * 1000,
  ).toISOString();

  const expiryResult = await supabaseAdmin
    .from("admin_users")
    .update({
      session_expires_at: expiresAt,
    })
    .eq("id", adminId);

  if (expiryResult.error) {
    const message = expiryResult.error.message.toLowerCase();
    const missingColumn =
      expiryResult.error.code === "42703" ||
      expiryResult.error.code === "PGRST204" ||
      message.includes("session_expires_at");

    if (!missingColumn) {
      throw new Error(
        `Could not store admin session expiry: ${expiryResult.error.message}`,
      );
    }

    console.warn(
      `${ROUTE_NAME}: admin_users.session_expires_at is not available.`,
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const pendingCookies: PendingCookie[] = [];

  let body: LoginBody;

  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return genericFailed(
      pendingCookies,
      400,
      "invalid_json_body",
    );
  }

  const email = cleanEmail(body.email);
  const password = cleanPassword(body.password);
  const nextPath = getSafeNextPath(body.next);

  if (!email || !password) {
    return genericFailed(
      pendingCookies,
      400,
      "missing_email_or_password",
    );
  }

  if (!emailLooksValid(email)) {
    return genericFailed(
      pendingCookies,
      400,
      "invalid_email_format",
    );
  }

  if (email.length > 254 || password.length > 128) {
    return genericFailed(
      pendingCookies,
      400,
      "credentials_too_long",
    );
  }

  try {
    const supabase = createLoginSupabaseClient(
      request,
      pendingCookies,
    );

    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    const user = signInData.user;

    if (signInError || !user) {
      console.warn(`${ROUTE_NAME} Supabase sign-in rejected`, {
        email,
        reason: signInError?.message ?? "No user returned",
      });

      return genericFailed(
        pendingCookies,
        401,
        "invalid_credentials",
      );
    }

    const selectColumns =
      "id,email,role,permissions,is_active,is_main_admin,supabase_user_id";

    let {
      data: adminUser,
      error: adminLookupError,
    } = await supabaseAdmin
      .from("admin_users")
      .select(selectColumns)
      .eq("supabase_user_id", user.id)
      .maybeSingle<AdminUser>();

    if (adminLookupError) {
      console.error(
        `${ROUTE_NAME} admin lookup by Supabase ID failed:`,
        adminLookupError,
      );

      await clearSupabaseSession(supabase);

      return genericFailed(
        pendingCookies,
        500,
        "admin_lookup_failed",
      );
    }

    if (!adminUser) {
      const byEmail = await supabaseAdmin
        .from("admin_users")
        .select(selectColumns)
        .ilike("email", email)
        .maybeSingle<AdminUser>();

      if (byEmail.error) {
        console.error(
          `${ROUTE_NAME} admin lookup by email failed:`,
          byEmail.error,
        );

        await clearSupabaseSession(supabase);

        return genericFailed(
          pendingCookies,
          500,
          "admin_lookup_failed",
        );
      }

      adminUser = byEmail.data;
    }

    if (!adminUser) {
      console.warn(`${ROUTE_NAME} user is not an admin`, {
        email,
        supabaseUserId: user.id,
      });

      await clearSupabaseSession(supabase);

      return genericFailed(
        pendingCookies,
        403,
        "admin_record_missing",
      );
    }

    if (adminUser.is_active !== true) {
      console.warn(`${ROUTE_NAME} inactive admin attempted login`, {
        adminId: adminUser.id,
        email,
      });

      await clearSupabaseSession(supabase);

      return genericFailed(
        pendingCookies,
        403,
        "admin_inactive",
      );
    }

    const adminId = cleanString(adminUser.id);
    const adminEmail =
      cleanEmail(adminUser.email) || cleanEmail(user.email);
    const adminRole = cleanString(adminUser.role) || "editor";
    const permissions = permissionKeys(adminUser.permissions);

    if (!adminId || !adminEmail) {
      await clearSupabaseSession(supabase);

      return genericFailed(
        pendingCookies,
        500,
        "admin_identity_missing",
      );
    }

    /*
     * Link an existing admin record to its Supabase Auth user.
     */
    if (!adminUser.supabase_user_id) {
      const linkResult = await supabaseAdmin
        .from("admin_users")
        .update({
          supabase_user_id: user.id,
        })
        .eq("id", adminId);

      if (linkResult.error) {
        console.error(
          `${ROUTE_NAME} failed to link Supabase user:`,
          linkResult.error,
        );

        await clearSupabaseSession(supabase);

        return genericFailed(
          pendingCookies,
          500,
          "admin_link_failed",
        );
      }
    } else if (adminUser.supabase_user_id !== user.id) {
      console.error(`${ROUTE_NAME} Supabase identity mismatch`, {
        adminId,
        storedSupabaseUserId: adminUser.supabase_user_id,
        signedInSupabaseUserId: user.id,
      });

      await clearSupabaseSession(supabase);

      return genericFailed(
        pendingCookies,
        403,
        "supabase_identity_mismatch",
      );
    }

    const sessionToken = randomBytes(32).toString("hex");

    try {
      await storeSessionToken(adminId, sessionToken);
    } catch (error) {
      console.error(`${ROUTE_NAME} session storage failed:`, error);

      await clearSupabaseSession(supabase);

      return genericFailed(
        pendingCookies,
        500,
        "session_storage_failed",
      );
    }

    const response = createJsonResponse(
      {
        ok: true,
        authenticated: true,
        redirectTo: nextPath,
        admin: {
          id: adminId,
          email: adminEmail,
          role: adminRole,
          is_main_admin:
            adminUser.is_main_admin === true ||
            adminRole === "main_admin",
          permissions,
        },
      },
      200,
      pendingCookies,
    );

    /*
     * These three cookies are required by GET /api/admin/me.
     */
    setAdminCookie(
      response,
      ADMIN_ID_COOKIE,
      adminId,
    );

    setAdminCookie(
      response,
      ADMIN_EMAIL_COOKIE,
      adminEmail,
    );

    setAdminCookie(
      response,
      ADMIN_SESSION_COOKIE,
      sessionToken,
    );

    /*
     * Optional client-readable UI cookies.
     * Server-side access must still be checked through /api/admin/me.
     */
    setAdminCookie(
      response,
      ADMIN_ROLE_COOKIE,
      adminRole,
      {
        httpOnly: false,
      },
    );

    setAdminCookie(
      response,
      ADMIN_PERMISSIONS_COOKIE,
      encodeURIComponent(JSON.stringify(permissions)),
      {
        httpOnly: false,
      },
    );

    console.log(`${ROUTE_NAME} successful`, {
      adminId,
      adminEmail,
      adminRole,
      supabaseAuthCookiesSet: pendingCookies.map(
        (cookie) => cookie.name,
      ),
      customAdminCookiesSet: [
        ADMIN_ID_COOKIE,
        ADMIN_EMAIL_COOKIE,
        ADMIN_SESSION_COOKIE,
      ],
    });

    return response;
  } catch (error) {
    console.error(`${ROUTE_NAME} failed`, {
      reason:
        error instanceof Error
          ? error.message
          : "Unknown error",
    });

    return genericFailed(
      pendingCookies,
      500,
      "unexpected_login_error",
    );
  }
}
