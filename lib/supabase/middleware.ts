import { createHash } from "node:crypto";

import { createServerClient } from "@supabase/ssr";
import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import {
  type NextRequest,
  NextResponse,
} from "next/server";

type AdminUser = {
  id: string;
  email: string;
  role: string | null;
  is_active: boolean;
  supabase_user_id: string | null;
};

type TrustedDevice = {
  id: string;
  admin_id: string;
  device_token_hash: string;
  trusted_at: string;
  revoked_at: string | null;
};

type SecuritySession = {
  id: string;
  admin_id: string;
  trusted_device_id: string | null;
  auth_session_ref: string;
  aal: string | null;
  expires_at: string | null;
  revoked_at: string | null;
};

type LookupResult<T> =
  | {
      data: T;
      failed: false;
    }
  | {
      data: null;
      failed: false;
    }
  | {
      data: null;
      failed: true;
    };

const ADMIN_LOGIN_PATH = "/Admin/Login";

const ADMIN_DEVICE_COOKIE =
  "burton_admin_trusted_device";

const ADMIN_SECURITY_SESSION_COOKIE =
  "burton_admin_security_session";

const PUBLIC_ADMIN_PAGE_PATHS = new Set([
  "/admin/login",
]);

const PUBLIC_ADMIN_API_PATHS = new Set([
  "/api/admin/settings/login",
  "/api/admin/settings/login/two-factor/verify",
  "/api/admin/settings/login/two-factor/resend",
  "/api/admin/logout",
]);

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag":
    "noindex, nofollow, noarchive",
  "Cache-Control":
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=()",
};

function normalisePath(pathname: string) {
  if (!pathname || pathname === "/") {
    return "/";
  }

  const cleanPath = pathname
    .split("?")[0]
    .split("#")[0]
    .trim();

  if (!cleanPath || cleanPath === "/") {
    return "/";
  }

  const withSlash =
    cleanPath.startsWith("/")
      ? cleanPath
      : `/${cleanPath}`;

  return withSlash.endsWith("/") &&
    withSlash !== "/"
    ? withSlash.slice(0, -1)
    : withSlash;
}

function isAdminPage(pathname: string) {
  const path =
    normalisePath(pathname).toLowerCase();

  return (
    path === "/admin" ||
    path.startsWith("/admin/")
  );
}

function isAdminApi(pathname: string) {
  return normalisePath(pathname)
    .toLowerCase()
    .startsWith("/api/admin");
}

function isPublicAdminPath(
  pathname: string,
) {
  const path =
    normalisePath(pathname).toLowerCase();

  return (
    PUBLIC_ADMIN_PAGE_PATHS.has(path) ||
    PUBLIC_ADMIN_API_PATHS.has(path)
  );
}

function isApiRequest(pathname: string) {
  return isAdminApi(pathname);
}

function addAdminSecurityHeaders(
  response: NextResponse,
) {
  for (const [name, value] of Object.entries(
    SECURITY_HEADERS,
  )) {
    response.headers.set(name, value);
  }

  if (
    process.env.NODE_ENV === "production"
  ) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }

  return response;
}

function jsonBlocked(
  message: string,
  status: number,
  reason?: string,
) {
  return addAdminSecurityHeaders(
    NextResponse.json(
      {
        ok: false,
        message,
        ...(reason ? { reason } : {}),
      },
      {
        status,
      },
    ),
  );
}

function redirectToLogin(
  request: NextRequest,
  reason?: string,
) {
  const loginUrl =
    request.nextUrl.clone();

  loginUrl.pathname = ADMIN_LOGIN_PATH;
  loginUrl.search = "";

  const currentPath =
    `${request.nextUrl.pathname}` +
    `${request.nextUrl.search}`;

  if (
    currentPath &&
    !normalisePath(currentPath)
      .toLowerCase()
      .startsWith("/admin/login")
  ) {
    loginUrl.searchParams.set(
      "next",
      currentPath,
    );
  }

  if (reason) {
    loginUrl.searchParams.set(
      "reason",
      reason,
    );
  }

  return addAdminSecurityHeaders(
    NextResponse.redirect(loginUrl),
  );
}

function hashWithPepper(
  value: string,
): string {
  const pepper =
    process.env.ADMIN_2FA_PEPPER;

  if (
    !pepper ||
    pepper.length < 32
  ) {
    throw new Error(
      "Admin security hashing configuration is unavailable.",
    );
  }

  return createHash("sha256")
    .update(`${pepper}:${value}`)
    .digest("hex");
}

function isExpired(
  value: string | null | undefined,
) {
  // Fail closed: a restricted admin session must always have a valid expiry.
  if (!value) {
    return true;
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return true;
  }

  return timestamp <= Date.now();
}

function createSecurityAdminClient(): SupabaseClient | null {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Admin security configuration missing",
      {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasServiceRoleKey:
          Boolean(serviceRoleKey),
      },
    );

    return null;
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}

async function getAdminUserBySupabaseId(
  securityAdmin: SupabaseClient,
  supabaseUserId: string,
): Promise<LookupResult<AdminUser>> {
  const { data, error } =
    await securityAdmin
      .from("admin_users")
      .select(
        `
          id,
          email,
          role,
          is_active,
          supabase_user_id
        `,
      )
      .eq(
        "supabase_user_id",
        supabaseUserId,
      )
      .eq("is_active", true)
      .maybeSingle();

  if (error) {
    console.error(
      "Admin user lookup failed",
      {
        reason:
          "admin_user_lookup_failed",
        code: error.code,
      },
    );

    return {
      data: null,
      failed: true,
    };
  }

  return {
    data: (data as AdminUser | null) ?? null,
    failed: false,
  };
}

async function getCurrentAal(
  supabase: ReturnType<
    typeof createServerClient
  >,
) {
  const { data, error } =
    await supabase.auth.mfa
      .getAuthenticatorAssuranceLevel();

  if (error) {
    console.error(
      "Admin MFA assurance check failed",
      {
        reason: "aal_lookup_failed",
      },
    );

    return null;
  }

  return {
    currentLevel:
      data.currentLevel ?? null,
    nextLevel:
      data.nextLevel ?? null,
  };
}

async function getTrustedDevice(
  securityAdmin: SupabaseClient,
  adminId: string,
  rawDeviceToken: string,
): Promise<LookupResult<TrustedDevice>> {
  const tokenHash =
    hashWithPepper(rawDeviceToken);

  const { data, error } =
    await securityAdmin
      .from("admin_trusted_devices")
      .select(
        `
          id,
          admin_id,
          device_token_hash,
          trusted_at,
          revoked_at
        `,
      )
      .eq("admin_id", adminId)
      .eq(
        "device_token_hash",
        tokenHash,
      )
      .is("revoked_at", null)
      .maybeSingle();

  if (error) {
    console.error(
      "Trusted device lookup failed",
      {
        reason:
          "trusted_device_lookup_failed",
        code: error.code,
      },
    );

    return {
      data: null,
      failed: true,
    };
  }

  return {
    data:
      (data as TrustedDevice | null) ??
      null,
    failed: false,
  };
}

async function getSecuritySession(
  securityAdmin: SupabaseClient,
  adminId: string,
  trustedDeviceId: string,
  rawSessionRef: string,
): Promise<LookupResult<SecuritySession>> {
  // The browser holds the raw session reference; the database stores only its hash.
  const sessionRefHash =
    hashWithPepper(rawSessionRef);

  const { data, error } =
    await securityAdmin
      .from("admin_security_sessions")
      .select(
        `
          id,
          admin_id,
          trusted_device_id,
          auth_session_ref,
          aal,
          expires_at,
          revoked_at
        `,
      )
      .eq("admin_id", adminId)
      .eq(
        "trusted_device_id",
        trustedDeviceId,
      )
      .eq(
        "auth_session_ref",
        sessionRefHash,
      )
      .is("revoked_at", null)
      .maybeSingle();

  if (error) {
    console.error(
      "Security session lookup failed",
      {
        reason:
          "security_session_lookup_failed",
        code: error.code,
      },
    );

    return {
      data: null,
      failed: true,
    };
  }

  return {
    data:
      (data as SecuritySession | null) ??
      null,
    failed: false,
  };
}

async function countActiveTrustedDevices(
  securityAdmin: SupabaseClient,
  adminId: string,
) {
  const { count, error } =
    await securityAdmin
      .from("admin_trusted_devices")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("admin_id", adminId)
      .is("revoked_at", null);

  if (error) {
    console.error(
      "Trusted-device count failed",
      {
        reason:
          "trusted_device_count_failed",
        code: error.code,
      },
    );

    return null;
  }

  return count ?? 0;
}

function denyAdminRequest(
  request: NextRequest,
  status: 401 | 403,
  message: string,
  reason: string,
) {
  if (
    isApiRequest(
      request.nextUrl.pathname,
    )
  ) {
    return jsonBlocked(
      message,
      status,
      reason,
    );
  }

  return redirectToLogin(
    request,
    reason,
  );
}

function securityServiceUnavailable(
  request: NextRequest,
) {
  if (
    isApiRequest(
      request.nextUrl.pathname,
    )
  ) {
    return jsonBlocked(
      "Security service unavailable.",
      503,
      "security_check_failed",
    );
  }

  return addAdminSecurityHeaders(
    new NextResponse(
      "Security service unavailable.",
      {
        status: 503,
      },
    ),
  );
}

export async function updateSession(
  request: NextRequest,
) {
  const pathname =
    normalisePath(
      request.nextUrl.pathname,
    );

  const apiRequest =
    isApiRequest(pathname);

  const adminRequest =
    isAdminPage(pathname) ||
    isAdminApi(pathname);

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (
    !supabaseUrl ||
    !supabaseAnonKey
  ) {
    console.error(
      "Admin authentication configuration missing",
      {
        hasSupabaseUrl:
          Boolean(supabaseUrl),
        hasAnonKey:
          Boolean(supabaseAnonKey),
      },
    );

    if (apiRequest) {
      return jsonBlocked(
        "Service unavailable.",
        503,
      );
    }

    return addAdminSecurityHeaders(
      new NextResponse(
        "Service unavailable.",
        {
          status: 503,
        },
      ),
    );
  }

  let response =
    NextResponse.next({
      request,
    });

  /**
   * Authenticated SSR client.
   *
   * Use this ONLY for the user's Supabase authentication state and MFA/AAL.
   * Do not use it for privileged security-table verification because RLS applies.
   */
  const supabase =
    createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },

          setAll(cookiesToSet) {
            for (const {
              name,
              value,
              options,
            } of cookiesToSet) {
              request.cookies.set(
                name,
                value,
              );

              response.cookies.set(
                name,
                value,
                {
                  ...options,
                  sameSite:
                    options?.sameSite ??
                    "lax",
                  secure:
                    process.env.NODE_ENV ===
                      "production" ||
                    options?.secure === true,
                },
              );
            }
          },
        },
      },
    );

  /**
   * Keep Supabase session refresh working even on non-admin pages.
   */
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (!adminRequest) {
    return response;
  }

  /**
   * Login and MFA endpoints must remain reachable before authentication completes.
   */
  if (isPublicAdminPath(pathname)) {
    return addAdminSecurityHeaders(
      response,
    );
  }

  /**
   * 1. AUTHENTICATED SUPABASE USER
   */
  if (userError || !user) {
    return denyAdminRequest(
      request,
      401,
      "Unauthorised.",
      "authentication_required",
    );
  }

  /**
   * 2. MANDATORY MFA / AAL2
   */
  const assurance =
    await getCurrentAal(supabase);

  if (
    !assurance ||
    assurance.currentLevel !== "aal2"
  ) {
    return denyAdminRequest(
      request,
      403,
      "Multi-factor authentication is required.",
      "mfa_required",
    );
  }

  /**
   * Privileged server-only client.
   *
   * This client has no browser session attached and is used only after getUser()
   * and AAL2 have already proved the caller's identity and MFA state.
   */
  const securityAdmin =
    createSecurityAdminClient();

  if (!securityAdmin) {
    return securityServiceUnavailable(
      request,
    );
  }

  /**
   * 3. ACTIVE BURTON PRIDE ADMIN
   *
   * Identity comes exclusively from Supabase user.id.
   * No browser-supplied admin ID, email, role or permission is trusted.
   */
  const adminLookup =
    await getAdminUserBySupabaseId(
      securityAdmin,
      user.id,
    );

  if (adminLookup.failed) {
    return securityServiceUnavailable(
      request,
    );
  }

  const adminUser =
    adminLookup.data;

  if (
    !adminUser ||
    !adminUser.is_active
  ) {
    return denyAdminRequest(
      request,
      403,
      "Forbidden.",
      "admin_access_denied",
    );
  }

  /**
   * 4. TRUSTED DEVICE
   */
  const rawDeviceToken =
    request.cookies.get(
      ADMIN_DEVICE_COOKIE,
    )?.value?.trim();

  if (!rawDeviceToken) {
    return denyAdminRequest(
      request,
      403,
      "Trusted device verification is required.",
      "trusted_device_required",
    );
  }

  const trustedDeviceLookup =
    await getTrustedDevice(
      securityAdmin,
      adminUser.id,
      rawDeviceToken,
    );

  if (trustedDeviceLookup.failed) {
    // Database/RLS/configuration failure must not be treated as an invalid device.
    // Returning 503 prevents redirect loops when the security table cannot be read.
    return securityServiceUnavailable(
      request,
    );
  }

  const trustedDevice =
    trustedDeviceLookup.data;

  if (!trustedDevice) {
    return denyAdminRequest(
      request,
      403,
      "This device is not authorised.",
      "trusted_device_invalid",
    );
  }

  /**
   * Defence in depth: reject inconsistent state if more than 3 active devices exist.
   * The actual fourth-device prevention should also be enforced atomically during enrolment.
   */
  const trustedDeviceCount =
    await countActiveTrustedDevices(
      securityAdmin,
      adminUser.id,
    );

  if (trustedDeviceCount === null) {
    return securityServiceUnavailable(
      request,
    );
  }

  if (trustedDeviceCount > 3) {
    console.error(
      "Trusted-device limit exceeded",
      {
        adminId: adminUser.id,
        count: trustedDeviceCount,
      },
    );

    return denyAdminRequest(
      request,
      403,
      "Account security verification is required.",
      "trusted_device_limit_exceeded",
    );
  }

  /**
   * 5. REVOCABLE BURTON PRIDE SECURITY SESSION
   */
  const rawSessionRef =
    request.cookies.get(
      ADMIN_SECURITY_SESSION_COOKIE,
    )?.value?.trim();

  if (!rawSessionRef) {
    return denyAdminRequest(
      request,
      401,
      "Your security session is no longer valid.",
      "security_session_required",
    );
  }

  const securitySessionLookup =
    await getSecuritySession(
      securityAdmin,
      adminUser.id,
      trustedDevice.id,
      rawSessionRef,
    );

  if (securitySessionLookup.failed) {
    return securityServiceUnavailable(
      request,
    );
  }

  const securitySession =
    securitySessionLookup.data;

  if (!securitySession) {
    return denyAdminRequest(
      request,
      401,
      "Your security session is no longer valid.",
      "security_session_invalid",
    );
  }

  if (securitySession.revoked_at) {
    return denyAdminRequest(
      request,
      401,
      "Your security session has been revoked.",
      "security_session_revoked",
    );
  }

  if (
    isExpired(
      securitySession.expires_at,
    )
  ) {
    return denyAdminRequest(
      request,
      401,
      "Your security session has expired.",
      "security_session_expired",
    );
  }

  /**
   * Fail closed. The Burton security-session record itself must explicitly be AAL2.
   */
  if (
    securitySession.aal !== "aal2"
  ) {
    return denyAdminRequest(
      request,
      403,
      "Multi-factor authentication is required.",
      "security_session_aal_invalid",
    );
  }

  /**
   * SECURITY BOUNDARY COMPLETE
   *
   * At this point:
   * - Supabase user is valid
   * - Supabase MFA/AAL2 is valid
   * - admin_users mapping is valid
   * - admin is active
   * - trusted device token hash matches
   * - trusted device is not revoked
   * - <= 3 active devices exist
   * - Burton security-session reference hash matches
   * - security session is not revoked
   * - security session has a valid future expiry
   * - security session explicitly records AAL2
   *
   * IMPORTANT:
   * Individual protected API routes must STILL enforce their specific permission
   * and step-up authentication for high-risk operations.
   */

  return addAdminSecurityHeaders(
    response,
  );
}
