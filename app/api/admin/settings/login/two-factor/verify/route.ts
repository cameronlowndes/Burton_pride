import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE_NAME =
  "POST /api/admin/settings/login/two-factor/verify";

const ADMIN_ID_COOKIE = "burton_admin_id";
const ADMIN_EMAIL_COOKIE = "burton_admin_email";
const ADMIN_SESSION_COOKIE = "burton_admin_session";
const ADMIN_ROLE_COOKIE = "burton_admin_role";
const ADMIN_PERMISSIONS_COOKIE = "burton_admin_permissions";
const PENDING_TWO_FACTOR_COOKIE = "burton_admin_2fa_pending";

const SESSION_MAX_AGE = 60 * 60 * 12;
const TWO_FACTOR_CODE_LENGTH = 6;

type TwoFactorMethod = "email" | "totp";

type PendingCookie = {
  name: string;
  value: string;
  options?: CookieOptions;
};

type VerifyBody = {
  challengeId?: unknown;
  method?: unknown;
  code?: unknown;
};

type ChallengeRecord = {
  id: string;
  admin_id: string;
  method: TwoFactorMethod;
  code_hash: string | null;
  pending_session_hash: string;
  expires_at: string;
  attempts: number;
  max_attempts: number;
  consumed_at: string | null;
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
  two_factor_email_enabled?: boolean | null;
  two_factor_totp_enabled?: boolean | null;
  two_factor_totp_factor_id?: string | null;
};

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanEmail(value: unknown): string {
  return cleanString(value).toLowerCase();
}

function cleanCode(value: unknown): string {
  return cleanString(value).replace(/\D/g, "").slice(0, 6);
}

function isTwoFactorMethod(value: unknown): value is TwoFactorMethod {
  return value === "email" || value === "totp";
}

function noStoreHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  };
}

function createJsonResponse(
  body: Record<string, unknown>,
  status: number,
  pendingCookies: PendingCookie[] = [],
): NextResponse {
  const response = NextResponse.json(body, {
    status,
    headers: noStoreHeaders(),
  });

  for (const cookie of pendingCookies) {
    response.cookies.set({
      name: cookie.name,
      value: cookie.value,
      ...cookie.options,
      sameSite: cookie.options?.sameSite ?? "lax",
      secure:
        cookie.options?.secure ??
        process.env.NODE_ENV === "production",
      path: cookie.options?.path ?? "/",
    });
  }

  return response;
}

function failed(
  status: number,
  reason: string,
  extra: Record<string, unknown> = {},
  pendingCookies: PendingCookie[] = [],
): NextResponse {
  return createJsonResponse(
    {
      ok: false,
      authenticated: false,
      error: "Two-step verification failed.",
      reason,
      ...extra,
    },
    status,
    pendingCookies,
  );
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

function clearPendingTwoFactorCookie(
  response: NextResponse,
): void {
  response.cookies.set({
    name: PENDING_TWO_FACTOR_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
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

function hashWithPepper(value: string): string {
  const pepper = process.env.ADMIN_2FA_PEPPER;

  if (!pepper || pepper.length < 32) {
    throw new Error(
      "ADMIN_2FA_PEPPER must contain at least 32 characters.",
    );
  }

  return createHash("sha256")
    .update(`${pepper}:${value}`)
    .digest("hex");
}

function safeEqualHex(left: string, right: string): boolean {
  try {
    const leftBuffer = Buffer.from(left, "hex");
    const rightBuffer = Buffer.from(right, "hex");

    return (
      leftBuffer.length > 0 &&
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  } catch {
    return false;
  }
}

function createSupabaseClient(
  request: NextRequest,
  pendingCookies: PendingCookie[],
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase public environment variables are missing.",
    );
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

async function recordAudit(params: {
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

async function markChallengeConsumed(
  challengeId: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("admin_two_factor_challenges")
    .update({
      consumed_at: new Date().toISOString(),
    })
    .eq("id", challengeId)
    .is("consumed_at", null);

  if (error) {
    throw new Error(
      `Could not consume two-factor challenge: ${error.message}`,
    );
  }
}

async function incrementAttempts(
  challenge: ChallengeRecord,
): Promise<number> {
  const nextAttempts = challenge.attempts + 1;

  const updates: Record<string, unknown> = {
    attempts: nextAttempts,
  };

  if (nextAttempts >= challenge.max_attempts) {
    updates.consumed_at = new Date().toISOString();
  }

  const { error } = await supabaseAdmin
    .from("admin_two_factor_challenges")
    .update(updates)
    .eq("id", challenge.id)
    .is("consumed_at", null);

  if (error) {
    throw new Error(
      `Could not update challenge attempts: ${error.message}`,
    );
  }

  return nextAttempts;
}

async function storeSessionToken(
  adminId: string,
  sessionToken: string,
): Promise<void> {
  const expiresAt = new Date(
    Date.now() + SESSION_MAX_AGE * 1000,
  ).toISOString();

  const { error } = await supabaseAdmin
    .from("admin_users")
    .update({
      session_token: sessionToken,
      session_expires_at: expiresAt,
    })
    .eq("id", adminId);

  if (!error) return;

  const message = error.message.toLowerCase();
  const missingOptionalColumn =
    error.code === "42703" ||
    error.code === "PGRST204" ||
    message.includes("session_token") ||
    message.includes("session_expires_at");

  if (!missingOptionalColumn) {
    throw new Error(
      `Could not store admin session: ${error.message}`,
    );
  }

  console.warn(
    `${ROUTE_NAME}: session token columns are unavailable; using cookie-only session.`,
  );
}

async function verifyEmailCode(params: {
  challenge: ChallengeRecord;
  code: string;
}): Promise<boolean> {
  if (!params.challenge.code_hash) {
    return false;
  }

  const submittedHash = hashWithPepper(params.code);

  return safeEqualHex(
    submittedHash,
    params.challenge.code_hash,
  );
}

async function verifyTotpCode(params: {
  request: NextRequest;
  pendingCookies: PendingCookie[];
  factorId: string;
  code: string;
}): Promise<boolean> {
  const supabase = createSupabaseClient(
    params.request,
    params.pendingCookies,
  );

  const { data, error } =
    await supabase.auth.mfa.challengeAndVerify({
      factorId: params.factorId,
      code: params.code,
    });

  if (error) {
    console.warn(`${ROUTE_NAME} TOTP verification rejected:`, {
      message: error.message,
    });

    return false;
  }

  return Boolean(data);
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  const pendingCookies: PendingCookie[] = [];

  let body: VerifyBody;

  try {
    body = (await request.json()) as VerifyBody;
  } catch {
    return failed(
      400,
      "invalid_json_body",
      {},
      pendingCookies,
    );
  }

  const challengeId = cleanString(body.challengeId);
  const method = body.method;
  const code = cleanCode(body.code);
  const pendingToken =
    request.cookies.get(PENDING_TWO_FACTOR_COOKIE)?.value || "";

  if (!challengeId || !isTwoFactorMethod(method)) {
    return failed(
      400,
      "missing_challenge_or_method",
      {},
      pendingCookies,
    );
  }

  if (code.length !== TWO_FACTOR_CODE_LENGTH) {
    return failed(
      400,
      "invalid_code_format",
      {},
      pendingCookies,
    );
  }

  if (!pendingToken) {
    return failed(
      401,
      "pending_login_cookie_missing",
      {},
      pendingCookies,
    );
  }

  try {
    const { data: challenge, error: challengeError } =
      await supabaseAdmin
        .from("admin_two_factor_challenges")
        .select(
          [
            "id",
            "admin_id",
            "method",
            "code_hash",
            "pending_session_hash",
            "expires_at",
            "attempts",
            "max_attempts",
            "consumed_at",
          ].join(","),
        )
        .eq("id", challengeId)
        .maybeSingle<ChallengeRecord>();

    if (challengeError) {
      console.error(
        `${ROUTE_NAME} challenge lookup failed:`,
        challengeError,
      );

      return failed(
        500,
        "challenge_lookup_failed",
        {},
        pendingCookies,
      );
    }

    if (!challenge || challenge.consumed_at) {
      return failed(
        410,
        "challenge_expired_or_used",
        {},
        pendingCookies,
      );
    }

    if (challenge.method !== method) {
      await recordAudit({
        adminId: challenge.admin_id,
        action: "admin_two_factor_method_mismatch",
        status: "blocked",
        riskLevel: "high",
        metadata: {
          challenge_id: challenge.id,
          expected_method: challenge.method,
          submitted_method: method,
        },
      });

      return failed(
        400,
        "method_mismatch",
        {},
        pendingCookies,
      );
    }

    if (
      new Date(challenge.expires_at).getTime() <= Date.now()
    ) {
      await markChallengeConsumed(challenge.id);

      return failed(
        410,
        "challenge_expired",
        {},
        pendingCookies,
      );
    }

    if (challenge.attempts >= challenge.max_attempts) {
      await markChallengeConsumed(challenge.id);

      return failed(
        429,
        "maximum_attempts_reached",
        {
          attemptsRemaining: 0,
        },
        pendingCookies,
      );
    }

    const pendingSessionHash = hashWithPepper(pendingToken);

    if (
      !safeEqualHex(
        pendingSessionHash,
        challenge.pending_session_hash,
      )
    ) {
      await recordAudit({
        adminId: challenge.admin_id,
        action: "admin_two_factor_pending_session_mismatch",
        status: "blocked",
        riskLevel: "critical",
        metadata: {
          challenge_id: challenge.id,
        },
      });

      return failed(
        401,
        "pending_session_mismatch",
        {},
        pendingCookies,
      );
    }

    const { data: admin, error: adminError } =
      await supabaseAdmin
        .from("admin_users")
        .select(
          [
            "id",
            "email",
            "role",
            "permissions",
            "is_active",
            "is_main_admin",
            "supabase_user_id",
            "two_factor_enabled",
            "two_factor_email_enabled",
            "two_factor_totp_enabled",
            "two_factor_totp_factor_id",
          ].join(","),
        )
        .eq("id", challenge.admin_id)
        .maybeSingle<AdminUser>();

    if (adminError || !admin) {
      console.error(
        `${ROUTE_NAME} admin lookup failed:`,
        adminError,
      );

      return failed(
        500,
        "admin_lookup_failed",
        {},
        pendingCookies,
      );
    }

    const adminEmail = cleanEmail(admin.email);
    const adminRole = cleanString(admin.role) || "editor";

    if (
      admin.is_active !== true ||
      admin.two_factor_enabled !== true
    ) {
      await markChallengeConsumed(challenge.id);

      return failed(
        403,
        "admin_not_allowed",
        {},
        pendingCookies,
      );
    }

    let verified = false;

    if (method === "email") {
      if (admin.two_factor_email_enabled !== true) {
        return failed(
          403,
          "email_two_factor_disabled",
          {},
          pendingCookies,
        );
      }

      verified = await verifyEmailCode({
        challenge,
        code,
      });
    } else {
      const factorId = cleanString(
        admin.two_factor_totp_factor_id,
      );

      if (
        admin.two_factor_totp_enabled !== true ||
        !factorId
      ) {
        return failed(
          403,
          "totp_not_configured",
          {},
          pendingCookies,
        );
      }

      verified = await verifyTotpCode({
        request,
        pendingCookies,
        factorId,
        code,
      });
    }

    if (!verified) {
      const attempts = await incrementAttempts(challenge);
      const attemptsRemaining = Math.max(
        0,
        challenge.max_attempts - attempts,
      );

      await recordAudit({
        adminId: admin.id,
        adminEmail,
        action: "admin_two_factor_verification_failed",
        status:
          attemptsRemaining === 0
            ? "locked"
            : "rejected",
        riskLevel:
          attemptsRemaining === 0
            ? "high"
            : "medium",
        metadata: {
          challenge_id: challenge.id,
          method,
          attempts,
          attempts_remaining: attemptsRemaining,
        },
      });

      return failed(
        attemptsRemaining === 0 ? 429 : 401,
        attemptsRemaining === 0
          ? "maximum_attempts_reached"
          : "invalid_two_factor_code",
        {
          attemptsRemaining,
        },
        pendingCookies,
      );
    }

    await markChallengeConsumed(challenge.id);

    const sessionToken = randomBytes(32).toString("hex");
    await storeSessionToken(admin.id, sessionToken);

    const permissions = permissionKeys(admin.permissions);

    const response = createJsonResponse(
      {
        ok: true,
        authenticated: true,
        requiresTwoFactor: false,
        admin: {
          id: admin.id,
          email: adminEmail,
          role: adminRole,
          is_main_admin:
            admin.is_main_admin === true ||
            adminRole === "main_admin",
          permissions,
        },
      },
      200,
      pendingCookies,
    );

    setAdminCookie(
      response,
      ADMIN_ID_COOKIE,
      admin.id,
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

    clearPendingTwoFactorCookie(response);

    await recordAudit({
      adminId: admin.id,
      adminEmail,
      action: "admin_two_factor_login_success",
      status: "success",
      riskLevel: "low",
      metadata: {
        challenge_id: challenge.id,
        method,
      },
    });

    console.info(`${ROUTE_NAME} successful`, {
      adminId: admin.id,
      adminEmail,
      method,
    });

    return response;
  } catch (error) {
    console.error(`${ROUTE_NAME} failed:`, error);

    return failed(
      500,
      "unexpected_verification_error",
      {},
      pendingCookies,
    );
  }
}
