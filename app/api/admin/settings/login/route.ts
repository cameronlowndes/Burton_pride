import {
  createHash,
  randomBytes,
  randomInt,
} from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { Resend } from "resend";

import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE_NAME = "POST /api/admin/settings/login";

const ADMIN_ID_COOKIE = "burton_admin_id";
const ADMIN_EMAIL_COOKIE = "burton_admin_email";
const ADMIN_SESSION_COOKIE = "burton_admin_session";
const ADMIN_ROLE_COOKIE = "burton_admin_role";
const ADMIN_PERMISSIONS_COOKIE = "burton_admin_permissions";

const PENDING_TWO_FACTOR_COOKIE = "burton_admin_2fa_pending";
const SESSION_MAX_AGE = 60 * 60 * 12;
const TWO_FACTOR_MAX_AGE = 60 * 10;
const MAX_TWO_FACTOR_ATTEMPTS = 5;
const MAX_TWO_FACTOR_RESENDS = 3;

type TwoFactorMethod = "email" | "totp";

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
  two_factor_enabled?: boolean | null;
  two_factor_preferred_method?: TwoFactorMethod | null;
  two_factor_email_enabled?: boolean | null;
  two_factor_totp_enabled?: boolean | null;
  two_factor_totp_factor_id?: string | null;
};

type ChallengeRecord = {
  id: string;
  admin_id: string;
  method: TwoFactorMethod;
  expires_at: string;
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

  if (
    !next ||
    !next.startsWith("/Admin") ||
    next.startsWith("//") ||
    next.includes("\\") ||
    next.toLowerCase().startsWith("/admin/login") ||
    next.toLowerCase().startsWith("/admin/logout") ||
    next.length > 300
  ) {
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

function setPendingTwoFactorCookie(
  response: NextResponse,
  pendingToken: string,
): void {
  response.cookies.set({
    name: PENDING_TWO_FACTOR_COOKIE,
    value: pendingToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TWO_FACTOR_MAX_AGE,
  });
}

function clearAdminCookies(response: NextResponse): void {
  const names = [
    ADMIN_ID_COOKIE,
    ADMIN_EMAIL_COOKIE,
    ADMIN_SESSION_COOKIE,
    ADMIN_ROLE_COOKIE,
    ADMIN_PERMISSIONS_COOKIE,
  ];

  for (const name of names) {
    response.cookies.set({
      name,
      value: "",
      httpOnly:
        name !== ADMIN_ROLE_COOKIE &&
        name !== ADMIN_PERMISSIONS_COOKIE,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
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
  const response = createJsonResponse(
    {
      ok: false,
      authenticated: false,
      message: "Sign in failed.",
      reason,
    },
    status,
    pendingCookies,
  );

  clearAdminCookies(response);

  return response;
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

function hashWithPepper(value: string): string {
  const pepper = process.env.ADMIN_2FA_PEPPER;

  if (!pepper || pepper.length < 32) {
    throw new Error(
      "ADMIN_2FA_PEPPER must be configured with at least 32 characters.",
    );
  }

  return createHash("sha256")
    .update(`${pepper}:${value}`)
    .digest("hex");
}

function createSixDigitCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function maskEmail(email: string): string {
  const [localPart, domain] = email.split("@");

  if (!localPart || !domain) return "your approved email address";

  const visible =
    localPart.length <= 2
      ? localPart.slice(0, 1)
      : localPart.slice(0, 2);

  return `${visible}${"•".repeat(
    Math.max(4, localPart.length - visible.length),
  )}@${domain}`;
}

function enabledTwoFactorMethods(
  admin: AdminUser,
): TwoFactorMethod[] {
  const methods: TwoFactorMethod[] = [];

  if (admin.two_factor_email_enabled === true) {
    methods.push("email");
  }

  if (
    admin.two_factor_totp_enabled === true &&
    cleanString(admin.two_factor_totp_factor_id)
  ) {
    methods.push("totp");
  }

  return methods;
}

function preferredTwoFactorMethod(
  admin: AdminUser,
  methods: TwoFactorMethod[],
): TwoFactorMethod {
  const preferred = admin.two_factor_preferred_method;

  if (preferred && methods.includes(preferred)) {
    return preferred;
  }

  return methods[0] ?? "email";
}

async function invalidateOldChallenges(adminId: string): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("admin_two_factor_challenges")
    .update({
      consumed_at: now,
    })
    .eq("admin_id", adminId)
    .is("consumed_at", null);

  if (error) {
    throw new Error(
      `Could not invalidate previous two-factor challenges: ${error.message}`,
    );
  }
}

async function createChallenge(params: {
  adminId: string;
  method: TwoFactorMethod;
  codeHash: string | null;
  pendingSessionHash: string;
  request: NextRequest;
}): Promise<ChallengeRecord> {
  const expiresAt = new Date(
    Date.now() + TWO_FACTOR_MAX_AGE * 1000,
  ).toISOString();

  const forwardedFor = params.request.headers.get("x-forwarded-for");
  const ipAddress = forwardedFor?.split(",")[0]?.trim() || "";
  const userAgent = params.request.headers.get("user-agent") || "";

  const { data, error } = await supabaseAdmin
    .from("admin_two_factor_challenges")
    .insert({
      admin_id: params.adminId,
      method: params.method,
      code_hash: params.codeHash,
      pending_session_hash: params.pendingSessionHash,
      expires_at: expiresAt,
      attempts: 0,
      max_attempts: MAX_TWO_FACTOR_ATTEMPTS,
      resend_count: 0,
      consumed_at: null,
      last_sent_at:
        params.method === "email"
          ? new Date().toISOString()
          : null,
      ip_hash: ipAddress ? hashWithPepper(ipAddress) : null,
      user_agent_hash: userAgent
        ? hashWithPepper(userAgent)
        : null,
    })
    .select("id,admin_id,method,expires_at")
    .single<ChallengeRecord>();

  if (error || !data) {
    throw new Error(
      `Could not create two-factor challenge: ${
        error?.message ?? "No challenge returned"
      }`,
    );
  }

  return data;
}

function buildSecurityCodeEmailHtml(code: string): string {
  return `
    <div style="font-family:Arial,sans-serif;background:#071126;padding:32px;color:#ffffff">
      <div style="max-width:560px;margin:0 auto;background:#111c35;border:1px solid #33456f;border-radius:24px;padding:32px">
        <p style="margin:0 0 12px;color:#a9c8ff;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase">
          Burton Pride Admin Portal
        </p>
        <h1 style="margin:0 0 16px;font-size:28px">Your security code</h1>
        <p style="margin:0 0 24px;color:#d6def1;line-height:1.6">
          Enter this code to complete your secure admin sign-in.
        </p>
        <div style="background:#071126;border:1px solid #4f6ca5;border-radius:18px;padding:22px;text-align:center;font-size:36px;font-weight:800;letter-spacing:10px">
          ${code}
        </div>
        <p style="margin:24px 0 0;color:#aebbd5;line-height:1.6">
          This code expires in 10 minutes. Burton Pride will never ask you
          to share this code by phone, email or message.
        </p>
        <p style="margin:16px 0 0;color:#aebbd5;line-height:1.6">
          If you did not try to sign in, contact an authorised admin lead.
        </p>
      </div>
    </div>
  `;
}

async function sendSecurityCodeEmail(params: {
  email: string;
  code: string;
  challengeId: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.ADMIN_2FA_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    throw new Error(
      "RESEND_API_KEY or ADMIN_2FA_FROM_EMAIL is missing.",
    );
  }

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: params.email,
    subject: "Your Burton Pride admin security code",
    text:
      `Your Burton Pride admin security code is ${params.code}. ` +
      "It expires in 10 minutes. Never share this code. " +
      "If you did not try to sign in, contact an authorised admin lead.",
    html: buildSecurityCodeEmailHtml(params.code),
    headers: {
      "X-Burton-Pride-Security": "admin-two-factor",
    },
    tags: [
      {
        name: "category",
        value: "admin_two_factor",
      },
    ],
  });

  if (error) {
    throw new Error(
      `The two-factor email could not be sent: ${error.message}`,
    );
  }

  console.info(`${ROUTE_NAME} two-factor email sent`, {
    challengeId: params.challengeId,
  });
}

async function recordLoginAudit(params: {
  adminId?: string | null;
  adminEmail?: string | null;
  action: string;
  status: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from("admin_audit_logs")
      .insert({
        admin_id: params.adminId || null,
        admin_email: params.adminEmail || null,
        action: params.action,
        area: "auth",
        route: ROUTE_NAME,
        method: "POST",
        status: params.status,
        risk_level: params.riskLevel,
        target_type: "restricted_login",
        target_label: "Restricted Login",
        metadata: params.metadata || {},
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.warn(`${ROUTE_NAME} audit insert failed:`, error.message);
    }
  } catch (error) {
    console.warn(`${ROUTE_NAME} audit insert threw:`, error);
  }
}

async function storeSessionToken(
  adminId: string,
  sessionToken: string,
): Promise<void> {
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

function completeLoginResponse(params: {
  pendingCookies: PendingCookie[];
  admin: AdminUser;
  adminId: string;
  adminEmail: string;
  adminRole: string;
  permissions: string[];
  nextPath: string;
  sessionToken: string;
}): NextResponse {
  const response = createJsonResponse(
    {
      ok: true,
      authenticated: true,
      requiresTwoFactor: false,
      redirectTo: params.nextPath,
      admin: {
        id: params.adminId,
        email: params.adminEmail,
        role: params.adminRole,
        is_main_admin:
          params.admin.is_main_admin === true ||
          params.adminRole === "main_admin",
        permissions: params.permissions,
      },
    },
    200,
    params.pendingCookies,
  );

  setAdminCookie(response, ADMIN_ID_COOKIE, params.adminId);
  setAdminCookie(response, ADMIN_EMAIL_COOKIE, params.adminEmail);
  setAdminCookie(
    response,
    ADMIN_SESSION_COOKIE,
    params.sessionToken,
  );

  setAdminCookie(
    response,
    ADMIN_ROLE_COOKIE,
    params.adminRole,
    {
      httpOnly: false,
    },
  );

  setAdminCookie(
    response,
    ADMIN_PERMISSIONS_COOKIE,
    encodeURIComponent(JSON.stringify(params.permissions)),
    {
      httpOnly: false,
    },
  );

  return response;
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
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
      await recordLoginAudit({
        action: "admin_login_password_failed",
        status: "rejected",
        riskLevel: "medium",
        metadata: {
          reason: "invalid_credentials",
        },
      });

      return genericFailed(
        pendingCookies,
        401,
        "invalid_credentials",
      );
    }

    const selectColumns = [
      "id",
      "email",
      "role",
      "permissions",
      "is_active",
      "is_main_admin",
      "supabase_user_id",
      "two_factor_enabled",
      "two_factor_preferred_method",
      "two_factor_email_enabled",
      "two_factor_totp_enabled",
      "two_factor_totp_factor_id",
    ].join(",");

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
      await clearSupabaseSession(supabase);

      return genericFailed(
        pendingCookies,
        403,
        "admin_record_missing",
      );
    }

    if (adminUser.is_active !== true) {
      await recordLoginAudit({
        adminId: adminUser.id,
        adminEmail: adminUser.email,
        action: "admin_login_inactive_account",
        status: "blocked",
        riskLevel: "high",
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
      await clearSupabaseSession(supabase);

      return genericFailed(
        pendingCookies,
        403,
        "supabase_identity_mismatch",
      );
    }

    const methods = enabledTwoFactorMethods(adminUser);
    const requiresTwoFactor =
      adminUser.two_factor_enabled === true &&
      methods.length > 0;

    if (adminUser.two_factor_enabled === true && methods.length === 0) {
      await recordLoginAudit({
        adminId,
        adminEmail,
        action: "admin_login_two_factor_misconfigured",
        status: "blocked",
        riskLevel: "high",
      });

      await clearSupabaseSession(supabase);

      return genericFailed(
        pendingCookies,
        403,
        "two_factor_not_configured",
      );
    }

    if (requiresTwoFactor) {
      const preferredMethod = preferredTwoFactorMethod(
        adminUser,
        methods,
      );
      const pendingToken = randomBytes(32).toString("base64url");
      const pendingSessionHash = hashWithPepper(pendingToken);

      await invalidateOldChallenges(adminId);

      let rawEmailCode: string | null = null;
      let codeHash: string | null = null;

      if (preferredMethod === "email") {
        rawEmailCode = createSixDigitCode();
        codeHash = hashWithPepper(rawEmailCode);
      }

      const challenge = await createChallenge({
        adminId,
        method: preferredMethod,
        codeHash,
        pendingSessionHash,
        request,
      });

      if (preferredMethod === "email" && rawEmailCode) {
        try {
          await sendSecurityCodeEmail({
            email: adminEmail,
            code: rawEmailCode,
            challengeId: challenge.id,
          });
        } catch (error) {
          console.error(`${ROUTE_NAME} email challenge failed:`, error);

          await supabaseAdmin
            .from("admin_two_factor_challenges")
            .update({
              consumed_at: new Date().toISOString(),
            })
            .eq("id", challenge.id);

          await clearSupabaseSession(supabase);

          return genericFailed(
            pendingCookies,
            503,
            "two_factor_email_failed",
          );
        }
      }

      const response = createJsonResponse(
        {
          ok: true,
          authenticated: false,
          requiresTwoFactor: true,
          challengeId: challenge.id,
          methods,
          preferredMethod,
          maskedEmail: methods.includes("email")
            ? maskEmail(adminEmail)
            : undefined,
          expiresInSeconds: TWO_FACTOR_MAX_AGE,
          redirectTo: nextPath,
        },
        200,
        pendingCookies,
      );

      clearAdminCookies(response);
      setPendingTwoFactorCookie(response, pendingToken);

      await recordLoginAudit({
        adminId,
        adminEmail,
        action: "admin_login_two_factor_required",
        status: "challenge_created",
        riskLevel: "medium",
        metadata: {
          method: preferredMethod,
          available_methods: methods,
          challenge_id: challenge.id,
        },
      });

      return response;
    }

    /*
     * Compatibility path for admins who have not yet been enrolled in
     * two-step verification. Remove this path when two-factor becomes
     * mandatory for every administrator.
     */
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

    const response = completeLoginResponse({
      pendingCookies,
      admin: adminUser,
      adminId,
      adminEmail,
      adminRole,
      permissions,
      nextPath,
      sessionToken,
    });

    await recordLoginAudit({
      adminId,
      adminEmail,
      action: "admin_login_success_without_two_factor",
      status: "success",
      riskLevel: "medium",
      metadata: {
        two_factor_enabled: false,
      },
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
