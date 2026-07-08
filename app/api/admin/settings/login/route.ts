import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_COOKIE = "burton_admin_session";
const ADMIN_ID_COOKIE = "burton_admin_id";
const ADMIN_EMAIL_COOKIE = "burton_admin_email";

const AUDIT_LOG_TABLE = "admin_audit_logs";
const LOGIN_ROUTE = "/api/admin/settings/login";

const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 128;

const SERVER_MAX_FAILED_ATTEMPTS = 8;
const SERVER_WINDOW_MS = 15 * 60 * 1000;
const SERVER_LOCKOUT_MS = 10 * 60 * 1000;

type LoginMethod = "admin_users_password_hash" | "supabase_auth_password";

type AdminUserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  password_hash: string | null;
  is_active: boolean | null;
  role: string | null;
  supabase_user_id: string | null;
};

type JsonErrorInput = {
  status: number;
  code: string;
  error: string;
  likelyFix?: string;
  debug?: unknown;
  requestId: string;
};

type LoginRateRecord = {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
};

const globalForLoginRateLimit = globalThis as typeof globalThis & {
  __burtonAdminLoginAttempts?: Map<string, LoginRateRecord>;
};

const serverLoginAttempts =
  globalForLoginRateLimit.__burtonAdminLoginAttempts ??
  new Map<string, LoginRateRecord>();

globalForLoginRateLimit.__burtonAdminLoginAttempts = serverLoginAttempts;

function makeRequestId() {
  return randomUUID();
}

function cleanEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function cleanPassword(value: unknown) {
  return String(value || "");
}

function cleanText(value: unknown, maxLength = 500) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function getEmailDomain(email: string) {
  const parts = email.split("@");
  return parts.length === 2 ? parts[1] || null : null;
}

function getPasswordLengthBucket(password: string) {
  const length = password.length;

  if (length <= 0) return "empty";
  if (length < 8) return "under_8";
  if (length <= 16) return "8_to_16";
  if (length <= 32) return "17_to_32";
  if (length <= 64) return "33_to_64";
  return "over_64";
}

function getIpAddress(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    null
  );
}

function getUserAgent(req: NextRequest) {
  return req.headers.get("user-agent") || null;
}

function getReferer(req: NextRequest) {
  return req.headers.get("referer") || null;
}

function getOrigin(req: NextRequest) {
  return req.headers.get("origin") || null;
}

function getCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  };
}

function createSessionToken() {
  const random = randomUUID();
  return Buffer.from(`${Date.now()}:${random}`).toString("base64url");
}

function getSupabaseDetails(error: {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}) {
  return {
    supabase_code: error.code || null,
    supabase_message: error.message || null,
    supabase_details: error.details || null,
    supabase_hint: error.hint || null,
  };
}

function getSafeDebug(debug: unknown) {
  if (process.env.NODE_ENV !== "development") return undefined;
  return debug;
}

function jsonError({
  status,
  code,
  error,
  likelyFix,
  debug,
  requestId,
}: JsonErrorInput) {
  return NextResponse.json(
    {
      ok: false,
      code,
      error,
      likelyFix,
      requestId,
      debug: getSafeDebug(debug),
    },
    { status }
  );
}

function buildRateLimitKey(email: string, ipAddress: string | null) {
  const emailPart = email || "unknown_email";
  const ipPart = ipAddress || "unknown_ip";

  return `${emailPart}|${ipPart}`;
}

function getRateLimitState(email: string, ipAddress: string | null) {
  const key = buildRateLimitKey(email, ipAddress);
  const now = Date.now();
  const existing = serverLoginAttempts.get(key);

  if (!existing) {
    return {
      key,
      blocked: false,
      lockedUntil: null,
      remainingMs: 0,
      record: null as LoginRateRecord | null,
    };
  }

  if (existing.lockedUntil && existing.lockedUntil > now) {
    return {
      key,
      blocked: true,
      lockedUntil: existing.lockedUntil,
      remainingMs: existing.lockedUntil - now,
      record: existing,
    };
  }

  if (now - existing.firstAttemptAt > SERVER_WINDOW_MS) {
    serverLoginAttempts.delete(key);

    return {
      key,
      blocked: false,
      lockedUntil: null,
      remainingMs: 0,
      record: null as LoginRateRecord | null,
    };
  }

  return {
    key,
    blocked: false,
    lockedUntil: existing.lockedUntil,
    remainingMs: 0,
    record: existing,
  };
}

function registerServerFailedAttempt(email: string, ipAddress: string | null) {
  const key = buildRateLimitKey(email, ipAddress);
  const now = Date.now();
  const existing = serverLoginAttempts.get(key);

  if (!existing || now - existing.firstAttemptAt > SERVER_WINDOW_MS) {
    const record: LoginRateRecord = {
      count: 1,
      firstAttemptAt: now,
      lockedUntil: null,
    };

    serverLoginAttempts.set(key, record);

    return {
      count: record.count,
      locked: false,
      lockedUntil: null,
    };
  }

  const nextCount = existing.count + 1;
  const shouldLock = nextCount >= SERVER_MAX_FAILED_ATTEMPTS;

  const nextRecord: LoginRateRecord = {
    count: nextCount,
    firstAttemptAt: existing.firstAttemptAt,
    lockedUntil: shouldLock ? now + SERVER_LOCKOUT_MS : existing.lockedUntil,
  };

  serverLoginAttempts.set(key, nextRecord);

  return {
    count: nextCount,
    locked: shouldLock,
    lockedUntil: nextRecord.lockedUntil,
  };
}

function clearServerFailedAttempts(email: string, ipAddress: string | null) {
  serverLoginAttempts.delete(buildRateLimitKey(email, ipAddress));
}

async function writeAuditLog(input: {
  req: NextRequest;
  requestId: string;
  admin?: AdminUserRow | null;
  attemptedEmail?: string | null;
  action: string;
  status: "success" | "failed" | "blocked" | "error";
  riskLevel: "low" | "medium" | "high" | "critical";
  targetType?: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const attemptedEmail = cleanEmail(input.attemptedEmail);
    const adminEmail = cleanEmail(input.admin?.email || attemptedEmail);
    const adminName =
      cleanText(input.admin?.full_name) || adminEmail || "Unknown admin";

    const { error } = await supabaseAdmin.from(AUDIT_LOG_TABLE).insert({
      admin_id: input.admin?.id || null,
      admin_email: adminEmail || null,
      admin_name: adminName || null,
      admin_role: input.admin?.role || null,

      action: input.action,
      area: "auth",
      route: LOGIN_ROUTE,
      method: "POST",
      status: input.status,
      risk_level: input.riskLevel,

      target_type: input.targetType || "admin_login",
      target_id: input.targetId || input.admin?.id || null,
      target_label: input.targetLabel || adminEmail || null,

      ip_address: getIpAddress(input.req),
      user_agent: getUserAgent(input.req),

      metadata: {
        request_id: input.requestId,
        source: "admin_login_api",
        email_domain: adminEmail ? getEmailDomain(adminEmail) : null,
        referer: getReferer(input.req),
        origin: getOrigin(input.req),
        ...input.metadata,
      },
    });

    if (error) {
      console.error("Admin login audit insert failed:", {
        requestId: input.requestId,
        ...getSupabaseDetails(error),
      });
    }
  } catch (error) {
    console.error("Admin login audit insert crashed:", {
      requestId: input.requestId,
      error,
    });
  }
}

async function checkSupabaseAuthPassword(email: string, password: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      ok: false,
      skipped: true,
      error:
        "Supabase Auth check skipped because NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.",
      supabaseUserId: null as string | null,
      supabaseEmail: null as string | null,
    };
  }

  const supabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabaseAuthClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return {
      ok: false,
      skipped: false,
      error: error?.message || "Supabase Auth login failed.",
      supabaseUserId: null as string | null,
      supabaseEmail: null as string | null,
    };
  }

  await supabaseAuthClient.auth.signOut().catch(() => undefined);

  return {
    ok: true,
    skipped: false,
    error: null,
    supabaseUserId: data.user.id,
    supabaseEmail: data.user.email || email,
  };
}

export async function POST(req: NextRequest) {
  const requestId = makeRequestId();
  const ipAddress = getIpAddress(req);

  let attemptedEmail = "";
  let admin: AdminUserRow | null = null;

  try {
    const body = await req.json().catch(() => null);

    attemptedEmail = cleanEmail(body?.email);
    const password = cleanPassword(body?.password);

    await writeAuditLog({
      req,
      requestId,
      attemptedEmail,
      action: "login_attempt_received",
      status: "success",
      riskLevel: "low",
      metadata: {
        has_email: Boolean(attemptedEmail),
        has_password: Boolean(password),
        email_length: attemptedEmail.length,
        password_length_bucket: getPasswordLengthBucket(password),
      },
    });

    if (!attemptedEmail || !password) {
      await writeAuditLog({
        req,
        requestId,
        attemptedEmail,
        action: "login_missing_email_or_password",
        status: "blocked",
        riskLevel: "medium",
        metadata: {
          has_email: Boolean(attemptedEmail),
          has_password: Boolean(password),
        },
      });

      return jsonError({
        status: 400,
        code: "LOGIN_MISSING_DETAILS",
        error: "Email address and password are required.",
        likelyFix: "Enter your admin email and password, then try again.",
        requestId,
      });
    }

    if (attemptedEmail.length > MAX_EMAIL_LENGTH) {
      await writeAuditLog({
        req,
        requestId,
        attemptedEmail,
        action: "login_email_too_long",
        status: "blocked",
        riskLevel: "medium",
        metadata: {
          email_length: attemptedEmail.length,
          max_email_length: MAX_EMAIL_LENGTH,
        },
      });

      return jsonError({
        status: 400,
        code: "LOGIN_EMAIL_TOO_LONG",
        error: "Email address is too long.",
        likelyFix: "Check the email address and try again.",
        requestId,
      });
    }

    if (password.length > MAX_PASSWORD_LENGTH) {
      await writeAuditLog({
        req,
        requestId,
        attemptedEmail,
        action: "login_password_too_long",
        status: "blocked",
        riskLevel: "medium",
        metadata: {
          password_length_bucket: getPasswordLengthBucket(password),
          max_password_length: MAX_PASSWORD_LENGTH,
        },
      });

      return jsonError({
        status: 400,
        code: "LOGIN_PASSWORD_TOO_LONG",
        error: "Password is too long.",
        likelyFix: "Check the password and try again.",
        requestId,
      });
    }

    const rateLimitState = getRateLimitState(attemptedEmail, ipAddress);

    if (rateLimitState.blocked) {
      await writeAuditLog({
        req,
        requestId,
        attemptedEmail,
        action: "login_server_lockout_blocked",
        status: "blocked",
        riskLevel: "high",
        metadata: {
          locked_until: rateLimitState.lockedUntil
            ? new Date(rateLimitState.lockedUntil).toISOString()
            : null,
          remaining_ms: rateLimitState.remainingMs,
          max_failed_attempts: SERVER_MAX_FAILED_ATTEMPTS,
          window_ms: SERVER_WINDOW_MS,
        },
      });

      return jsonError({
        status: 429,
        code: "LOGIN_TEMPORARILY_LOCKED",
        error: "Too many failed sign-in attempts. Please wait before trying again.",
        likelyFix:
          "Wait around 10 minutes, then try again. If this was not you, contact a main admin.",
        requestId,
      });
    }

    const { data, error: adminError } = await supabaseAdmin
      .from("admin_users")
      .select(
        `
          id,
          email,
          full_name,
          password_hash,
          is_active,
          role,
          supabase_user_id
        `
      )
      .eq("email", attemptedEmail)
      .maybeSingle();

    if (adminError) {
      console.error("Admin login database error:", {
        requestId,
        ...getSupabaseDetails(adminError),
      });

      await writeAuditLog({
        req,
        requestId,
        attemptedEmail,
        action: "login_admin_lookup_failed",
        status: "error",
        riskLevel: "critical",
        metadata: {
          ...getSupabaseDetails(adminError),
        },
      });

      return jsonError({
        status: 500,
        code: "ADMIN_LOGIN_DATABASE_ERROR",
        error: "The admin login system could not read the admin_users table.",
        likelyFix:
          "Check Supabase. Make sure the admin_users table exists and has id, email, full_name, password_hash, role, is_active and supabase_user_id columns.",
        debug: getSupabaseDetails(adminError),
        requestId,
      });
    }

    admin = data as AdminUserRow | null;

    if (!admin) {
      const failedState = registerServerFailedAttempt(attemptedEmail, ipAddress);

      await writeAuditLog({
        req,
        requestId,
        attemptedEmail,
        action: failedState.locked
          ? "login_unknown_admin_locked"
          : "login_unknown_admin",
        status: "failed",
        riskLevel: failedState.locked ? "high" : "medium",
        metadata: {
          reason: "no_admin_users_row_found",
          failed_attempt_count: failedState.count,
          server_locked: failedState.locked,
          locked_until: failedState.lockedUntil
            ? new Date(failedState.lockedUntil).toISOString()
            : null,
        },
      });

      return jsonError({
        status: failedState.locked ? 429 : 401,
        code: failedState.locked
          ? "LOGIN_TEMPORARILY_LOCKED"
          : "INVALID_LOGIN_CREDENTIALS",
        error: "Invalid login credentials.",
        likelyFix:
          process.env.NODE_ENV === "development"
            ? "No admin account was found with that email address in admin_users."
            : "Check your email address and password, then try again.",
        requestId,
      });
    }

    await writeAuditLog({
      req,
      requestId,
      admin,
      attemptedEmail,
      action: "login_admin_found",
      status: "success",
      riskLevel: "low",
      targetType: "admin_user",
      targetId: admin.id,
      targetLabel: admin.email,
      metadata: {
        admin_role: admin.role,
        is_active: admin.is_active,
        has_password_hash: Boolean(admin.password_hash),
        has_supabase_user_id: Boolean(admin.supabase_user_id),
      },
    });

    if (admin.is_active === false) {
      const failedState = registerServerFailedAttempt(attemptedEmail, ipAddress);

      await writeAuditLog({
        req,
        requestId,
        admin,
        attemptedEmail,
        action: "login_inactive_admin_blocked",
        status: "blocked",
        riskLevel: "high",
        targetType: "admin_user",
        targetId: admin.id,
        targetLabel: admin.email,
        metadata: {
          failed_attempt_count: failedState.count,
          server_locked: failedState.locked,
          locked_until: failedState.lockedUntil
            ? new Date(failedState.lockedUntil).toISOString()
            : null,
        },
      });

      return jsonError({
        status: 403,
        code: "ADMIN_ACCOUNT_DISABLED",
        error: "This admin account is disabled.",
        likelyFix:
          "Open the admin_users table in Supabase and set is_active to true for this admin.",
        requestId,
      });
    }

    let passwordOk = false;
    let loginMethod: LoginMethod | null = null;

    if (admin.password_hash) {
      try {
        passwordOk = await bcrypt.compare(password, admin.password_hash);

        await writeAuditLog({
          req,
          requestId,
          admin,
          attemptedEmail,
          action: passwordOk
            ? "login_password_hash_matched"
            : "login_password_hash_not_matched",
          status: passwordOk ? "success" : "failed",
          riskLevel: passwordOk ? "low" : "medium",
          targetType: "admin_user",
          targetId: admin.id,
          targetLabel: admin.email,
          metadata: {
            password_check_method: "admin_users_password_hash",
          },
        });

        if (passwordOk) {
          loginMethod = "admin_users_password_hash";
        }
      } catch (error) {
        console.error("Admin login bcrypt compare failed:", {
          requestId,
          error,
        });

        await writeAuditLog({
          req,
          requestId,
          admin,
          attemptedEmail,
          action: "login_password_hash_check_error",
          status: "error",
          riskLevel: "critical",
          targetType: "admin_user",
          targetId: admin.id,
          targetLabel: admin.email,
          metadata: {
            error: error instanceof Error ? error.message : "Unknown bcrypt error",
          },
        });

        return jsonError({
          status: 500,
          code: "PASSWORD_HASH_CHECK_FAILED",
          error: "The admin login system could not verify the password.",
          likelyFix:
            "Check that bcryptjs is installed and that password_hash values are valid bcrypt hashes.",
          debug: error instanceof Error ? error.message : error,
          requestId,
        });
      }
    } else {
      await writeAuditLog({
        req,
        requestId,
        admin,
        attemptedEmail,
        action: "login_password_hash_missing",
        status: "success",
        riskLevel: "medium",
        targetType: "admin_user",
        targetId: admin.id,
        targetLabel: admin.email,
        metadata: {
          next_check: "supabase_auth_password",
        },
      });
    }

    if (!passwordOk) {
      const supabaseAuthResult = await checkSupabaseAuthPassword(
        attemptedEmail,
        password
      );

      await writeAuditLog({
        req,
        requestId,
        admin,
        attemptedEmail,
        action: supabaseAuthResult.ok
          ? "login_supabase_auth_matched"
          : supabaseAuthResult.skipped
            ? "login_supabase_auth_skipped"
            : "login_supabase_auth_not_matched",
        status: supabaseAuthResult.ok
          ? "success"
          : supabaseAuthResult.skipped
            ? "error"
            : "failed",
        riskLevel: supabaseAuthResult.ok
          ? "low"
          : supabaseAuthResult.skipped
            ? "medium"
            : "medium",
        targetType: "admin_user",
        targetId: admin.id,
        targetLabel: admin.email,
        metadata: {
          supabase_auth_ok: supabaseAuthResult.ok,
          supabase_auth_skipped: supabaseAuthResult.skipped,
          supabase_auth_error:
            process.env.NODE_ENV === "development"
              ? supabaseAuthResult.error
              : supabaseAuthResult.ok
                ? null
                : "Supabase Auth did not validate the password.",
          returned_supabase_email: supabaseAuthResult.supabaseEmail || null,
        },
      });

      if (supabaseAuthResult.ok && supabaseAuthResult.supabaseUserId) {
        passwordOk = true;
        loginMethod = "supabase_auth_password";

        if (supabaseAuthResult.supabaseUserId !== admin.supabase_user_id) {
          const { error: updateError } = await supabaseAdmin
            .from("admin_users")
            .update({
              supabase_user_id: supabaseAuthResult.supabaseUserId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", admin.id);

          await writeAuditLog({
            req,
            requestId,
            admin: {
              ...admin,
              supabase_user_id: supabaseAuthResult.supabaseUserId,
            },
            attemptedEmail,
            action: updateError
              ? "login_supabase_user_id_update_failed"
              : "login_supabase_user_id_updated",
            status: updateError ? "error" : "success",
            riskLevel: updateError ? "medium" : "low",
            targetType: "admin_user",
            targetId: admin.id,
            targetLabel: admin.email,
            metadata: updateError
              ? getSupabaseDetails(updateError)
              : {
                  old_supabase_user_id_exists: Boolean(admin.supabase_user_id),
                  new_supabase_user_id: supabaseAuthResult.supabaseUserId,
                },
          });

          if (!updateError) {
            admin = {
              ...admin,
              supabase_user_id: supabaseAuthResult.supabaseUserId,
            };
          }
        }
      }
    }

    if (!passwordOk) {
      const failedState = registerServerFailedAttempt(attemptedEmail, ipAddress);

      await writeAuditLog({
        req,
        requestId,
        admin,
        attemptedEmail,
        action: failedState.locked
          ? "login_invalid_password_locked"
          : "login_invalid_password",
        status: "failed",
        riskLevel: failedState.locked ? "high" : "medium",
        targetType: "admin_user",
        targetId: admin.id,
        targetLabel: admin.email,
        metadata: {
          failed_attempt_count: failedState.count,
          server_locked: failedState.locked,
          locked_until: failedState.lockedUntil
            ? new Date(failedState.lockedUntil).toISOString()
            : null,
          checked_admin_users_password_hash: Boolean(admin.password_hash),
          checked_supabase_auth: true,
        },
      });

      return jsonError({
        status: failedState.locked ? 429 : 401,
        code: failedState.locked
          ? "LOGIN_TEMPORARILY_LOCKED"
          : "INVALID_LOGIN_CREDENTIALS",
        error: failedState.locked
          ? "Too many failed sign-in attempts. Please wait before trying again."
          : "Invalid login credentials.",
        likelyFix:
          process.env.NODE_ENV === "development"
            ? "Password did not match admin_users.password_hash or Supabase Auth."
            : "Check your email address and password, then try again.",
        requestId,
      });
    }

    clearServerFailedAttempts(attemptedEmail, ipAddress);

    const cookieStore = await cookies();
    const sessionToken = createSessionToken();
    const cookieOptions = getCookieOptions();
    const adminId = String(admin.id);
    const adminEmail = cleanEmail(admin.email);

    cookieStore.set(SESSION_COOKIE, sessionToken, cookieOptions);
    cookieStore.set(ADMIN_ID_COOKIE, adminId, cookieOptions);
    cookieStore.set(ADMIN_EMAIL_COOKIE, adminEmail, cookieOptions);

    /**
     * Compatibility cookies for older admin routes.
     * Keep these while your app still has mixed route checks.
     */
    cookieStore.set("admin_user_id", adminId, cookieOptions);
    cookieStore.set("admin_id", adminId, cookieOptions);
    cookieStore.set("admin_email", adminEmail, cookieOptions);
    cookieStore.set("bp_admin_id", adminId, cookieOptions);
    cookieStore.set("bp_admin_email", adminEmail, cookieOptions);

    await writeAuditLog({
      req,
      requestId,
      admin,
      attemptedEmail,
      action: "login_success",
      status: "success",
      riskLevel: "low",
      targetType: "admin_user",
      targetId: admin.id,
      targetLabel: admin.email,
      metadata: {
        login_method: loginMethod,
        session_cookie_set: true,
        admin_id_cookie_set: true,
        admin_email_cookie_set: true,
        compatibility_cookies_set: true,
        session_max_age_seconds: cookieOptions.maxAge,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Signed in successfully.",
      requestId,
      loginMethod,
      admin: {
        id: adminId,
        email: adminEmail,
        full_name: admin.full_name ?? null,
        role: admin.role ?? null,
      },
    });
  } catch (error: unknown) {
    console.error("Admin login route error:", {
      requestId,
      error,
    });

    await writeAuditLog({
      req,
      requestId,
      admin,
      attemptedEmail,
      action: "login_route_unexpected_error",
      status: "error",
      riskLevel: "critical",
      targetType: admin ? "admin_user" : "admin_login",
      targetId: admin?.id || null,
      targetLabel: admin?.email || attemptedEmail || null,
      metadata: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return jsonError({
      status: 500,
      code: "ADMIN_LOGIN_UNEXPECTED_ERROR",
      error:
        error instanceof Error
          ? error.message
          : "Something went wrong while signing in.",
      likelyFix:
        "Check the Next.js terminal logs. Make sure bcryptjs is installed, Supabase env vars are set, and admin_audit_logs exists.",
      debug: error,
      requestId,
    });
  }
}