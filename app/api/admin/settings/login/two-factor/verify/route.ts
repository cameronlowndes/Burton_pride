import {
  createHash,
  randomBytes,
  randomUUID,
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
const TRUSTED_DEVICE_COOKIE = "burton_admin_trusted_device";
const ADMIN_SECURITY_SESSION_COOKIE =
  "burton_admin_security_session";

const SESSION_MAX_AGE = 60 * 60 * 12;
const TRUSTED_DEVICE_MAX_AGE = 60 * 60 * 24 * 90;
const TWO_FACTOR_CODE_LENGTH = 6;
const MAX_TRUSTED_DEVICES = 3;

type TwoFactorMethod = "email" | "totp";
type AuditRiskLevel = "low" | "medium" | "high" | "critical";

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

type TrustedDeviceRecord = {
  id: string;
  admin_id: string;
  device_token_hash: string;
  device_name?: string | null;
  browser?: string | null;
  operating_system?: string | null;
  device_type?: string | null;
  trusted_at?: string | null;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
  revoked_at?: string | null;
};

type SecurityContext = {
  ipAddress: string;
  ipHash: string | null;
  userAgent: string;
  userAgentHash: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  approximateLocation: string | null;
  browser: string;
  operatingSystem: string;
  deviceType: string;
  deviceLabel: string;
};

type TrustedDeviceResult = {
  supported: boolean;
  created: boolean;
  reused: boolean;
  trusted: boolean;
  deviceId: string | null;
  rawDeviceToken: string | null;
  trustedDeviceCount: number;
  maxTrustedDevices: number;
  deviceLabel: string;
  approximateLocation: string | null;
  riskLevel: AuditRiskLevel;
};

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanEmail(value: unknown): string {
  return cleanString(value).toLowerCase();
}

function cleanCode(value: unknown): string {
  return cleanString(value)
    .replace(/\D/g, "")
    .slice(0, TWO_FACTOR_CODE_LENGTH);
}

function isTwoFactorMethod(
  value: unknown,
): value is TwoFactorMethod {
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
        cookie.options?.secure ??
        process.env.NODE_ENV === "production",
      path: cookie.options?.path ?? "/",
    });
  }
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

  applyPendingCookies(response, pendingCookies);

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

function setTrustedDeviceCookie(
  response: NextResponse,
  token: string,
): void {
  response.cookies.set({
    name: TRUSTED_DEVICE_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: TRUSTED_DEVICE_MAX_AGE,
  });
}

function setSecuritySessionCookie(
  response: NextResponse,
  rawSessionRef: string,
): void {
  response.cookies.set({
    name: ADMIN_SECURITY_SESSION_COOKIE,
    value: rawSessionRef,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
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
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

function clearTrustedDeviceCookie(
  response: NextResponse,
): void {
  response.cookies.set({
    name: TRUSTED_DEVICE_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

function clearSecuritySessionCookie(
  response: NextResponse,
): void {
  response.cookies.set({
    name: ADMIN_SECURITY_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
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
          .filter(
            (item): item is string =>
              typeof item === "string",
          )
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) return [];

    try {
      return permissionKeys(
        JSON.parse(trimmed),
      );
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
    return Object.entries(
      value as Record<string, unknown>,
    )
      .filter(([, allowed]) =>
        permissionValueIsAllowed(allowed),
      )
      .map(([key]) => key.trim())
      .filter(Boolean);
  }

  return [];
}

function hashWithPepper(value: string): string {
  const pepper =
    process.env.ADMIN_2FA_PEPPER;

  if (!pepper || pepper.length < 32) {
    throw new Error(
      "ADMIN_2FA_PEPPER must contain at least 32 characters.",
    );
  }

  return createHash("sha256")
    .update(`${pepper}:${value}`)
    .digest("hex");
}

function safeEqualHex(
  left: string,
  right: string,
): boolean {
  try {
    const leftBuffer =
      Buffer.from(left, "hex");
    const rightBuffer =
      Buffer.from(right, "hex");

    return (
      leftBuffer.length > 0 &&
      leftBuffer.length ===
        rightBuffer.length &&
      timingSafeEqual(
        leftBuffer,
        rightBuffer,
      )
    );
  } catch {
    return false;
  }
}

function createSupabaseClient(
  request: NextRequest,
  pendingCookies: PendingCookie[],
) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase public environment variables are missing.",
    );
  }

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
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
    },
  );
}

function firstHeader(
  request: NextRequest,
  names: string[],
): string {
  for (const name of names) {
    const value = cleanString(
      request.headers.get(name),
    );

    if (value) return value;
  }

  return "";
}

function getRequestIp(
  request: NextRequest,
): string {
  const direct = firstHeader(request, [
    "cf-connecting-ip",
    "x-real-ip",
    "x-client-ip",
  ]);

  if (direct) return direct;

  const forwarded = cleanString(
    request.headers.get(
      "x-forwarded-for",
    ),
  );

  if (!forwarded) return "";

  return cleanString(
    forwarded.split(",")[0],
  );
}

function decodeHeaderValue(
  value: string,
): string {
  if (!value) return "";

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function detectBrowser(
  userAgent: string,
): string {
  const ua =
    userAgent.toLowerCase();

  if (ua.includes("edg/")) {
    return "Microsoft Edge";
  }

  if (
    ua.includes("chrome/") &&
    !ua.includes("chromium/")
  ) {
    return "Chrome";
  }

  if (ua.includes("firefox/")) {
    return "Firefox";
  }

  if (
    ua.includes("safari/") &&
    !ua.includes("chrome/")
  ) {
    return "Safari";
  }

  return "Browser";
}

function detectOperatingSystem(
  userAgent: string,
): string {
  const ua =
    userAgent.toLowerCase();

  if (ua.includes("windows")) {
    return "Windows";
  }

  if (ua.includes("android")) {
    return "Android";
  }

  if (
    ua.includes("iphone") ||
    ua.includes("ipad")
  ) {
    return "iOS";
  }

  if (
    ua.includes("mac os") ||
    ua.includes("macintosh")
  ) {
    return "macOS";
  }

  if (ua.includes("linux")) {
    return "Linux";
  }

  return "Device";
}

function detectDeviceType(
  userAgent: string,
): string {
  const ua =
    userAgent.toLowerCase();

  if (
    ua.includes("iphone") ||
    ua.includes("android")
  ) {
    return "mobile";
  }

  if (
    ua.includes("ipad") ||
    ua.includes("tablet")
  ) {
    return "tablet";
  }

  return "desktop";
}

function buildApproximateLocation(
  city: string,
  region: string,
  country: string,
): string | null {
  const parts = [
    city,
    region,
    country,
  ]
    .map(cleanString)
    .filter(Boolean);

  return parts.length
    ? Array.from(new Set(parts)).join(", ")
    : null;
}

function getSecurityContext(
  request: NextRequest,
): SecurityContext {
  const ipAddress =
    getRequestIp(request);
  const userAgent =
    cleanString(
      request.headers.get("user-agent"),
    );

  const city = decodeHeaderValue(
    firstHeader(request, [
      "x-vercel-ip-city",
      "cf-ipcity",
      "x-appengine-city",
    ]),
  );

  const region =
    decodeHeaderValue(
      firstHeader(request, [
        "x-vercel-ip-country-region",
        "cf-region",
        "x-appengine-region",
      ]),
    );

  const country =
    decodeHeaderValue(
      firstHeader(request, [
        "x-vercel-ip-country",
        "cf-ipcountry",
        "x-appengine-country",
      ]),
    );

  const browser =
    detectBrowser(userAgent);
  const operatingSystem =
    detectOperatingSystem(userAgent);
  const deviceType =
    detectDeviceType(userAgent);

  return {
    ipAddress,
    ipHash: ipAddress
      ? hashWithPepper(ipAddress)
      : null,
    userAgent,
    userAgentHash:
      userAgent
        ? hashWithPepper(userAgent)
        : null,
    city: city || null,
    region: region || null,
    country: country || null,
    approximateLocation:
      buildApproximateLocation(
        city,
        region,
        country,
      ),
    browser,
    operatingSystem,
    deviceType,
    deviceLabel:
      `${browser} on ${operatingSystem}`,
  };
}

function isMissingTableOrColumn(
  error:
    | {
        code?: string | null;
        message?: string | null;
      }
    | null
    | undefined,
  names: string[],
): boolean {
  if (!error) return false;

  const message =
    cleanString(
      error.message,
    ).toLowerCase();

  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    error.code === "PGRST204" ||
    error.code === "PGRST205" ||
    names.some((name) =>
      message.includes(
        name.toLowerCase(),
      ),
    )
  );
}

async function recordAudit(params: {
  adminId?: string | null;
  adminEmail?: string | null;
  action: string;
  status: string;
  riskLevel: AuditRiskLevel;
  security?: SecurityContext;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const securityMetadata =
      params.security
        ? {
            ip_hash:
              params.security.ipHash,
            user_agent_hash:
              params.security
                .userAgentHash,
            approximate_city:
              params.security.city,
            approximate_region:
              params.security.region,
            approximate_country:
              params.security.country,
            approximate_location:
              params.security
                .approximateLocation,
            device_label:
              params.security
                .deviceLabel,
            device_type:
              params.security
                .deviceType,
            browser:
              params.security.browser,
            operating_system:
              params.security
                .operatingSystem,
          }
        : {};

    const { error } =
      await supabaseAdmin
        .from("admin_audit_logs")
        .insert({
          admin_id:
            params.adminId || null,
          admin_email:
            params.adminEmail || null,
          action: params.action,
          area: "auth",
          route: ROUTE_NAME,
          method: "POST",
          status: params.status,
          risk_level:
            params.riskLevel,
          target_type:
            "restricted_login",
          target_label:
            "Restricted Login",
          metadata: {
            ...securityMetadata,
            ...(params.metadata || {}),
          },
          created_at:
            new Date().toISOString(),
        });

    if (error) {
      console.warn(
        `${ROUTE_NAME} audit insert failed:`,
        error.message,
      );
    }
  } catch (error) {
    console.warn(
      `${ROUTE_NAME} audit insert threw:`,
      error,
    );
  }
}

async function markChallengeConsumed(
  challengeId: string,
): Promise<void> {
  const { error } =
    await supabaseAdmin
      .from(
        "admin_two_factor_challenges",
      )
      .update({
        consumed_at:
          new Date().toISOString(),
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
  const nextAttempts =
    challenge.attempts + 1;

  const updates:
    Record<string, unknown> = {
      attempts: nextAttempts,
    };

  if (
    nextAttempts >=
    challenge.max_attempts
  ) {
    updates.consumed_at =
      new Date().toISOString();
  }

  const { error } =
    await supabaseAdmin
      .from(
        "admin_two_factor_challenges",
      )
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
  const expiresAt =
    new Date(
      Date.now() +
        SESSION_MAX_AGE * 1000,
    ).toISOString();

  const { error } =
    await supabaseAdmin
      .from("admin_users")
      .update({
        session_token:
          sessionToken,
        session_expires_at:
          expiresAt,
      })
      .eq("id", adminId);

  if (!error) return;

  const message =
    error.message.toLowerCase();

  const missingOptionalColumn =
    error.code === "42703" ||
    error.code === "PGRST204" ||
    message.includes(
      "session_token",
    ) ||
    message.includes(
      "session_expires_at",
    );

  if (!missingOptionalColumn) {
    throw new Error(
      `Could not store admin session: ${error.message}`,
    );
  }

  console.warn(
    `${ROUTE_NAME}: session token columns are unavailable; using cookie-only session.`,
  );
}

type CreatedSecuritySession = {
  id: string;
  rawSessionRef: string;
  expiresAt: string;
};

async function createAdminSecuritySession(params: {
  adminId: string;
  trustedDeviceId: string;
  aal: "aal2";
  security: SecurityContext;
}): Promise<CreatedSecuritySession> {
  const rawSessionRef =
    randomBytes(32).toString(
      "base64url",
    );

  const sessionRefHash =
    hashWithPepper(
      rawSessionRef,
    );

  const sessionId =
    randomUUID();

  const now =
    new Date().toISOString();

  const expiresAt =
    new Date(
      Date.now() +
        SESSION_MAX_AGE * 1000,
    ).toISOString();

  const insertPayload = {
    id: sessionId,
    admin_id: params.adminId,
    trusted_device_id:
      params.trustedDeviceId,
    auth_session_ref:
      sessionRefHash,

    /*
     * Security/session context.
     *
     * Empty IP values are stored as NULL because
     * admin_security_sessions.ip_address may be
     * a Postgres inet column.
     */
    ip_address:
      cleanString(
        params.security.ipAddress,
      ) || null,

    city:
      params.security.city,

    region:
      params.security.region,

    country:
      params.security.country,

    user_agent:
      cleanString(
        params.security.userAgent,
      ) || null,

    aal: params.aal,

    /*
     * A successful two-step verification establishes a fresh AAL2
     * security window. These fields are also used by the six-hour
     * "Are you still here?" session-presence control.
     *
     * IMPORTANT:
     * requires_reauthentication MUST be cleared here. Otherwise the
     * admin can successfully complete MFA, return to the Admin Portal,
     * and immediately be redirected back to MFA again.
     */
    last_mfa_at: now,
    last_presence_at: now,
    next_presence_check_at: new Date(
      Date.now() + 6 * 60 * 60 * 1000,
    ).toISOString(),
    requires_reauthentication: false,
    reauth_reason: null,

    created_at: now,
    last_seen_at: now,
    expires_at: expiresAt,

    revoked_at: null,
    revoke_reason: null,
  };

  const { data, error } =
    await supabaseAdmin
      .from(
        "admin_security_sessions",
      )
      .insert(insertPayload)
      .select("id")
      .single<{ id: string }>();

  if (error) {
    /*
     * Keep the detailed database error server-side.
     * Do not return schema/constraint details to the
     * browser.
     */
    console.error(
      `${ROUTE_NAME} security session create failed`,
      {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        adminId:
          params.adminId,
        trustedDeviceId:
          params.trustedDeviceId,
      },
    );

    throw new Error(
      "Could not create admin security session.",
    );
  }

  if (!data?.id) {
    console.error(
      `${ROUTE_NAME} security session create returned no row`,
      {
        adminId:
          params.adminId,
        trustedDeviceId:
          params.trustedDeviceId,
      },
    );

    throw new Error(
      "Could not create admin security session.",
    );
  }

  return {
    id: data.id,
    rawSessionRef,
    expiresAt,
  };
}

async function verifyEmailCode(params: {
  challenge: ChallengeRecord;
  code: string;
}): Promise<boolean> {
  if (!params.challenge.code_hash) {
    return false;
  }

  const submittedHash =
    hashWithPepper(params.code);

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
}): Promise<{
  verified: boolean;
  assuranceLevel: string | null;
}> {
  const supabase =
    createSupabaseClient(
      params.request,
      params.pendingCookies,
    );

  const { data, error } =
    await supabase.auth.mfa
      .challengeAndVerify({
        factorId:
          params.factorId,
        code: params.code,
      });

  if (error || !data) {
    console.warn(
      `${ROUTE_NAME} TOTP verification rejected:`,
      {
        message:
          error?.message ||
          "No MFA verification data returned",
      },
    );

    return {
      verified: false,
      assuranceLevel: null,
    };
  }

  const {
    data: aalData,
    error: aalError,
  } =
    await supabase.auth.mfa
      .getAuthenticatorAssuranceLevel();

  if (aalError) {
    console.warn(
      `${ROUTE_NAME} could not confirm AAL after TOTP verification:`,
      aalError.message,
    );

    return {
      verified: false,
      assuranceLevel: null,
    };
  }

  const levelData =
    aalData as unknown as {
      currentLevel?: string | null;
      current_level?: string | null;
    };

  const assuranceLevel =
    cleanString(
      levelData.currentLevel ??
        levelData.current_level,
    ) || null;

  /*
   * TOTP is only accepted as fully complete
   * when the Supabase session has actually
   * reached AAL2.
   */
  return {
    verified:
      assuranceLevel === "aal2",
    assuranceLevel,
  };
}

async function verifySupabaseSessionIdentity(
  request: NextRequest,
  pendingCookies: PendingCookie[],
  expectedSupabaseUserId: string,
): Promise<boolean> {
  if (!expectedSupabaseUserId) {
    return false;
  }

  const supabase =
    createSupabaseClient(
      request,
      pendingCookies,
    );

  const {
    data,
    error,
  } = await supabase.auth.getUser();

  if (error || !data.user?.id) {
    return false;
  }

  return (
    data.user.id ===
    expectedSupabaseUserId
  );
}

function getTrustedDeviceCookie(
  request: NextRequest,
): string {
  return cleanString(
    request.cookies.get(
      TRUSTED_DEVICE_COOKIE,
    )?.value,
  );
}

async function countTrustedDevices(
  adminId: string,
): Promise<{
  supported: boolean;
  count: number;
}> {
  const result =
    await supabaseAdmin
      .from(
        "admin_trusted_devices",
      )
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("admin_id", adminId)
      .is("revoked_at", null);

  if (result.error) {
    if (
      isMissingTableOrColumn(
        result.error,
        [
          "admin_trusted_devices",
          "revoked_at",
        ],
      )
    ) {
      return {
        supported: false,
        count: 0,
      };
    }

    throw new Error(
      `Could not count trusted devices: ${result.error.message}`,
    );
  }

  return {
    supported: true,
    count: result.count || 0,
  };
}

async function findTrustedDevice(params: {
  adminId: string;
  rawToken: string;
}): Promise<TrustedDeviceRecord | null> {
  if (!params.rawToken) return null;

  const tokenHash =
    hashWithPepper(params.rawToken);

  const result =
    await supabaseAdmin
      .from(
        "admin_trusted_devices",
      )
      .select(
        [
          "id",
          "admin_id",
          "device_token_hash",
          "device_name",
          "browser",
          "operating_system",
          "device_type",
          "trusted_at",
          "first_seen_at",
          "last_seen_at",
          "revoked_at",
        ].join(","),
      )
      .eq(
        "admin_id",
        params.adminId,
      )
      .eq(
        "device_token_hash",
        tokenHash,
      )
      .is("revoked_at", null)
      .maybeSingle<TrustedDeviceRecord>();

  if (result.error) {
    if (
      isMissingTableOrColumn(
        result.error,
        [
          "admin_trusted_devices",
          "device_token_hash",
          "revoked_at",
        ],
      )
    ) {
      return null;
    }

    throw new Error(
      `Could not resolve trusted device: ${result.error.message}`,
    );
  }

  return result.data || null;
}

async function updateTrustedDeviceContext(params: {
  deviceId: string;
  security: SecurityContext;
}): Promise<void> {
  const { error } =
    await supabaseAdmin
      .from(
        "admin_trusted_devices",
      )
      .update({
        device_name:
          params.security.deviceLabel,
        browser:
          params.security.browser,
        operating_system:
          params.security
            .operatingSystem,
        device_type:
          params.security.deviceType,
        last_seen_at:
          new Date().toISOString(),
        last_ip:
          params.security.ipAddress ||
          null,
        last_city:
          params.security.city,
        last_region:
          params.security.region,
        last_country:
          params.security.country,
      })
      .eq("id", params.deviceId);

  if (
    error &&
    !isMissingTableOrColumn(
      error,
      [
        "last_ip",
        "last_city",
        "last_region",
        "last_country",
        "device_name",
        "browser",
        "operating_system",
        "device_type",
      ],
    )
  ) {
    console.warn(
      `${ROUTE_NAME} trusted device context update failed:`,
      error.message,
    );
  }
}

async function createTrustedDevice(params: {
  adminId: string;
  security: SecurityContext;
}): Promise<{
  record: TrustedDeviceRecord;
  rawToken: string;
}> {
  const rawToken =
    randomBytes(32).toString(
      "base64url",
    );

  const tokenHash =
    hashWithPepper(rawToken);

  const now =
    new Date().toISOString();

  const payload = {
    admin_id: params.adminId,
    device_token_hash:
      tokenHash,
    device_name:
      params.security.deviceLabel,
    browser:
      params.security.browser,
    operating_system:
      params.security
        .operatingSystem,
    device_type:
      params.security.deviceType,
    first_seen_at: now,
    last_seen_at: now,
    trusted_at: now,
    last_ip:
      params.security.ipAddress ||
      null,
    last_city:
      params.security.city,
    last_region:
      params.security.region,
    last_country:
      params.security.country,
    revoked_at: null,
  };

  const { data, error } =
    await supabaseAdmin
      .from(
        "admin_trusted_devices",
      )
      .insert(payload)
      .select(
        [
          "id",
          "admin_id",
          "device_token_hash",
          "device_name",
          "browser",
          "operating_system",
          "device_type",
          "trusted_at",
          "first_seen_at",
          "last_seen_at",
          "revoked_at",
        ].join(","),
      )
      .single<TrustedDeviceRecord>();

  if (error || !data) {
    throw new Error(
      `Could not create trusted device: ${
        error?.message ??
        "No trusted device returned"
      }`,
    );
  }

  return {
    record: data,
    rawToken,
  };
}

async function ensureTrustedDeviceAfterMfa(params: {
  request: NextRequest;
  adminId: string;
  security: SecurityContext;
}): Promise<TrustedDeviceResult> {
  const countState =
    await countTrustedDevices(
      params.adminId,
    );

  if (!countState.supported) {
    return {
      supported: false,
      created: false,
      reused: false,
      trusted: false,
      deviceId: null,
      rawDeviceToken: null,
      trustedDeviceCount: 0,
      maxTrustedDevices:
        MAX_TRUSTED_DEVICES,
      deviceLabel:
        params.security.deviceLabel,
      approximateLocation:
        params.security
          .approximateLocation,
      riskLevel: "medium",
    };
  }

  const existingRawToken =
    getTrustedDeviceCookie(
      params.request,
    );

  const existing =
    await findTrustedDevice({
      adminId: params.adminId,
      rawToken:
        existingRawToken,
    });

  if (existing) {
    await updateTrustedDeviceContext({
      deviceId: existing.id,
      security:
        params.security,
    });

    return {
      supported: true,
      created: false,
      reused: true,
      trusted: true,
      deviceId: existing.id,

      /*
       * Re-issue the existing trusted-device token after every successful
       * MFA verification. The old code returned null here, so
       * setTrustedDeviceCookie() was skipped for reused devices.
       *
       * That could leave /api/admin/me without the
       * burton_admin_trusted_device cookie and cause:
       * "This device must be verified before Admin Portal access is allowed."
       */
      rawDeviceToken: existingRawToken,
      trustedDeviceCount:
        countState.count,
      maxTrustedDevices:
        MAX_TRUSTED_DEVICES,
      deviceLabel:
        cleanString(
          existing.device_name,
        ) ||
        params.security.deviceLabel,
      approximateLocation:
        params.security
          .approximateLocation,
      riskLevel: "low",
    };
  }

  /*
   * Race-safe second check before insertion.
   * If another request has already filled
   * the final device slot, do not create a
   * fourth trusted device.
   */
  const latestCount =
    await countTrustedDevices(
      params.adminId,
    );

  if (
    latestCount.supported &&
    latestCount.count >=
      MAX_TRUSTED_DEVICES
  ) {
    return {
      supported: true,
      created: false,
      reused: false,
      trusted: false,
      deviceId: null,
      rawDeviceToken: null,
      trustedDeviceCount:
        latestCount.count,
      maxTrustedDevices:
        MAX_TRUSTED_DEVICES,
      deviceLabel:
        params.security.deviceLabel,
      approximateLocation:
        params.security
          .approximateLocation,
      riskLevel: "high",
    };
  }

  const created =
    await createTrustedDevice({
      adminId: params.adminId,
      security:
        params.security,
    });

  return {
    supported: true,
    created: true,
    reused: false,
    trusted: true,
    deviceId:
      created.record.id,
    rawDeviceToken:
      created.rawToken,
    trustedDeviceCount:
      latestCount.count + 1,
    maxTrustedDevices:
      MAX_TRUSTED_DEVICES,
    deviceLabel:
      params.security.deviceLabel,
    approximateLocation:
      params.security
        .approximateLocation,
    riskLevel: "medium",
  };
}

function securityResponse(
  trustedDevice:
    TrustedDeviceResult,
): Record<string, unknown> {
  return {
    riskLevel:
      trustedDevice.riskLevel,
    newDevice:
      trustedDevice.created,
    deviceTrusted:
      trustedDevice.trusted,
    trustedDeviceCreated:
      trustedDevice.created,
    trustedDeviceReused:
      trustedDevice.reused,
    trustedDeviceId:
      trustedDevice.deviceId,
    trustedDeviceCount:
      trustedDevice
        .trustedDeviceCount,
    maxTrustedDevices:
      trustedDevice
        .maxTrustedDevices,
    approximateLocation:
      trustedDevice
        .approximateLocation,
    deviceLabel:
      trustedDevice.deviceLabel,
    trustedDeviceSupported:
      trustedDevice.supported,
  };
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  const pendingCookies:
    PendingCookie[] = [];

  const security =
    getSecurityContext(request);

  let body: VerifyBody;

  try {
    body =
      (await request.json()) as VerifyBody;
  } catch {
    await recordAudit({
      action:
        "admin_two_factor_invalid_json",
      status: "blocked",
      riskLevel: "medium",
      security,
      metadata: {
        actor_type:
          "unauthenticated_attempt",
      },
    });

    return failed(
      400,
      "invalid_json_body",
      {},
      pendingCookies,
    );
  }

  const challengeId =
    cleanString(body.challengeId);
  const method =
    body.method;
  const code =
    cleanCode(body.code);

  const pendingToken =
    cleanString(
      request.cookies.get(
        PENDING_TWO_FACTOR_COOKIE,
      )?.value,
    );

  if (
    !challengeId ||
    !isTwoFactorMethod(method)
  ) {
    return failed(
      400,
      "missing_challenge_or_method",
      {},
      pendingCookies,
    );
  }

  if (
    code.length !==
    TWO_FACTOR_CODE_LENGTH
  ) {
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
    const {
      data: challenge,
      error: challengeError,
    } =
      await supabaseAdmin
        .from(
          "admin_two_factor_challenges",
        )
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

    if (
      !challenge ||
      challenge.consumed_at
    ) {
      return failed(
        410,
        "challenge_expired_or_used",
        {},
        pendingCookies,
      );
    }

    if (
      challenge.method !== method
    ) {
      await recordAudit({
        adminId:
          challenge.admin_id,
        action:
          "admin_two_factor_method_mismatch",
        status: "blocked",
        riskLevel: "high",
        security,
        metadata: {
          challenge_id:
            challenge.id,
          expected_method:
            challenge.method,
          submitted_method:
            method,
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
      new Date(
        challenge.expires_at,
      ).getTime() <= Date.now()
    ) {
      await markChallengeConsumed(
        challenge.id,
      );

      return failed(
        410,
        "challenge_expired",
        {},
        pendingCookies,
      );
    }

    if (
      challenge.attempts >=
      challenge.max_attempts
    ) {
      await markChallengeConsumed(
        challenge.id,
      );

      return failed(
        429,
        "maximum_attempts_reached",
        {
          attemptsRemaining: 0,
        },
        pendingCookies,
      );
    }

    const pendingSessionHash =
      hashWithPepper(
        pendingToken,
      );

    if (
      !safeEqualHex(
        pendingSessionHash,
        challenge
          .pending_session_hash,
      )
    ) {
      await recordAudit({
        adminId:
          challenge.admin_id,
        action:
          "admin_two_factor_pending_session_mismatch",
        status: "blocked",
        riskLevel: "critical",
        security,
        metadata: {
          challenge_id:
            challenge.id,
        },
      });

      return failed(
        401,
        "pending_session_mismatch",
        {},
        pendingCookies,
      );
    }

    const {
      data: admin,
      error: adminError,
    } =
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
        .eq(
          "id",
          challenge.admin_id,
        )
        .maybeSingle<AdminUser>();

    if (
      adminError ||
      !admin
    ) {
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

    const adminEmail =
      cleanEmail(admin.email);
    const adminRole =
      cleanString(admin.role) ||
      "editor";

    if (
      admin.is_active !== true ||
      admin.two_factor_enabled !== true
    ) {
      await markChallengeConsumed(
        challenge.id,
      );

      await recordAudit({
        adminId: admin.id,
        adminEmail,
        action:
          "admin_two_factor_admin_not_allowed",
        status: "blocked",
        riskLevel: "high",
        security,
      });

      return failed(
        403,
        "admin_not_allowed",
        {},
        pendingCookies,
      );
    }

    if (
      !admin.supabase_user_id
    ) {
      await markChallengeConsumed(
        challenge.id,
      );

      return failed(
        403,
        "supabase_identity_missing",
        {},
        pendingCookies,
      );
    }

    const identityMatches =
      await verifySupabaseSessionIdentity(
        request,
        pendingCookies,
        admin.supabase_user_id,
      );

    if (!identityMatches) {
      await markChallengeConsumed(
        challenge.id,
      );

      await recordAudit({
        adminId: admin.id,
        adminEmail,
        action:
          "admin_two_factor_supabase_identity_mismatch",
        status: "blocked",
        riskLevel: "critical",
        security,
      });

      return failed(
        403,
        "supabase_identity_mismatch",
        {},
        pendingCookies,
      );
    }

    let verified = false;
    let assuranceLevel:
      string | null = null;

    if (method === "email") {
      if (
        admin
          .two_factor_email_enabled !==
        true
      ) {
        return failed(
          403,
          "email_two_factor_disabled",
          {},
          pendingCookies,
        );
      }

      verified =
        await verifyEmailCode({
          challenge,
          code,
        });

      /*
       * Burton Pride email MFA is an
       * application-level second step,
       * not a Supabase AAL2 factor.
       */
      assuranceLevel =
        verified
          ? "burton_email_mfa"
          : null;
    } else {
      const factorId =
        cleanString(
          admin
            .two_factor_totp_factor_id,
        );

      if (
        admin
          .two_factor_totp_enabled !==
          true ||
        !factorId
      ) {
        return failed(
          403,
          "totp_not_configured",
          {},
          pendingCookies,
        );
      }

      const totpResult =
        await verifyTotpCode({
          request,
          pendingCookies,
          factorId,
          code,
        });

      verified =
        totpResult.verified;
      assuranceLevel =
        totpResult
          .assuranceLevel;
    }

    if (!verified) {
      const attempts =
        await incrementAttempts(
          challenge,
        );

      const attemptsRemaining =
        Math.max(
          0,
          challenge.max_attempts -
            attempts,
        );

      await recordAudit({
        adminId: admin.id,
        adminEmail,
        action:
          "admin_two_factor_verification_failed",
        status:
          attemptsRemaining === 0
            ? "locked"
            : "rejected",
        riskLevel:
          attemptsRemaining === 0
            ? "high"
            : "medium",
        security,
        metadata: {
          challenge_id:
            challenge.id,
          method,
          attempts,
          attempts_remaining:
            attemptsRemaining,
        },
      });

      return failed(
        attemptsRemaining === 0
          ? 429
          : 401,
        attemptsRemaining === 0
          ? "maximum_attempts_reached"
          : "invalid_two_factor_code",
        {
          attemptsRemaining,
        },
        pendingCookies,
      );
    }

    /*
     * The protected middleware requires a real Supabase AAL2 session.
     * Application-level email OTP is retained as a recovery/fallback flow,
     * but it must not mint a normal Admin Portal security session while
     * the middleware requires AAL2.
     */
    if (assuranceLevel !== "aal2") {
      await markChallengeConsumed(
        challenge.id,
      );

      await recordAudit({
        adminId: admin.id,
        adminEmail,
        action:
          "admin_two_factor_strong_assurance_required",
        status: "blocked",
        riskLevel: "high",
        security,
        metadata: {
          challenge_id:
            challenge.id,
          method,
          assurance_level:
            assuranceLevel,
          required_assurance_level:
            "aal2",
        },
      });

      return failed(
        403,
        "strong_mfa_required",
        {
          requiresTwoFactor: true,
          requiredAssuranceLevel:
            "aal2",
        },
        pendingCookies,
      );
    }

    /*
     * MFA succeeded at AAL2. Only now may a new
     * device be trusted.
     */
    const trustedDevice =
      await ensureTrustedDeviceAfterMfa({
        request,
        adminId: admin.id,
        security,
      });

    if (
      trustedDevice.supported &&
      !trustedDevice.trusted
    ) {
      await markChallengeConsumed(
        challenge.id,
      );

      await recordAudit({
        adminId: admin.id,
        adminEmail,
        action:
          "admin_two_factor_verified_device_limit_blocked",
        status: "blocked",
        riskLevel: "high",
        security,
        metadata: {
          challenge_id:
            challenge.id,
          method,
          assurance_level:
            assuranceLevel,
          trusted_device_count:
            trustedDevice
              .trustedDeviceCount,
          max_trusted_devices:
            trustedDevice
              .maxTrustedDevices,
          reason:
            "trusted_device_limit_reached",
        },
      });

      const response =
        failed(
          403,
          "device_approval_required",
          {
            requiresDeviceApproval:
              true,
            security:
              securityResponse(
                trustedDevice,
              ),
          },
          pendingCookies,
        );

      clearTrustedDeviceCookie(
        response,
      );
      clearPendingTwoFactorCookie(
        response,
      );

      return response;
    }

    await markChallengeConsumed(
      challenge.id,
    );

    if (!trustedDevice.deviceId) {
      const response = failed(
        500,
        "trusted_device_session_binding_failed",
        {},
        pendingCookies,
      );

      clearSecuritySessionCookie(
        response,
      );

      return response;
    }

    /*
     * Create the revocable Burton Pride security session expected by
     * lib/supabase/middleware.ts. The browser receives only the raw random
     * reference; the database stores the peppered SHA-256 hash.
     */
    const securitySession =
      await createAdminSecuritySession({
        adminId: admin.id,
        trustedDeviceId:
          trustedDevice.deviceId,
        aal: "aal2",
        security,
      });

    /*
     * Legacy compatibility session. This is no longer the primary security
     * boundary; middleware validates Supabase identity, AAL2, trusted device
     * and admin_security_sessions before protected access is allowed.
     */
    const sessionToken =
      randomBytes(32).toString(
        "hex",
      );

    await storeSessionToken(
      admin.id,
      sessionToken,
    );

    const permissions =
      permissionKeys(
        admin.permissions,
      );

    const response =
      createJsonResponse(
        {
          ok: true,
          authenticated: true,
          requiresTwoFactor:
            false,
          admin: {
            id: admin.id,
            email: adminEmail,
            role: adminRole,
            is_main_admin:
              admin
                .is_main_admin ===
                true ||
              adminRole ===
                "main_admin",
            permissions,
          },
          security: {
            ...securityResponse(
              trustedDevice,
            ),
            assuranceLevel:
              "aal2",
            securitySessionExpiresAt:
              securitySession.expiresAt,
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

    setSecuritySessionCookie(
      response,
      securitySession.rawSessionRef,
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
      encodeURIComponent(
        JSON.stringify(
          permissions,
        ),
      ),
      {
        httpOnly: false,
      },
    );

    /*
     * A successful MFA login must leave the browser with the same raw
     * trusted-device token whose peppered hash exists in
     * admin_trusted_devices. This is required by /api/admin/me.
     *
     * New devices return a new raw token. Reused devices now return the
     * existing raw cookie token so its lifetime is refreshed as well.
     */
    if (trustedDevice.rawDeviceToken) {
      setTrustedDeviceCookie(
        response,
        trustedDevice.rawDeviceToken,
      );
    } else {
      console.error(
        `${ROUTE_NAME}: successful MFA did not provide a trusted-device token`,
        {
          adminId: admin.id,
          trustedDeviceId:
            trustedDevice.deviceId,
          trustedDeviceCreated:
            trustedDevice.created,
          trustedDeviceReused:
            trustedDevice.reused,
        },
      );
    }

    clearPendingTwoFactorCookie(
      response,
    );

    await recordAudit({
      adminId: admin.id,
      adminEmail,
      action:
        trustedDevice.created
          ? "admin_two_factor_login_success_new_trusted_device"
          : trustedDevice.reused
            ? "admin_two_factor_login_success_trusted_device"
            : "admin_two_factor_login_success",
      status: "success",
      riskLevel:
        trustedDevice.riskLevel,
      security,
      metadata: {
        challenge_id:
          challenge.id,
        method,
        assurance_level:
          assuranceLevel,
        security_session_id:
          securitySession.id,
        security_session_expires_at:
          securitySession.expiresAt,
        trusted_device_supported:
          trustedDevice.supported,
        trusted_device_created:
          trustedDevice.created,
        trusted_device_reused:
          trustedDevice.reused,
        trusted_device_id:
          trustedDevice.deviceId,
        trusted_device_count:
          trustedDevice
            .trustedDeviceCount,
        max_trusted_devices:
          trustedDevice
            .maxTrustedDevices,
      },
    });

    console.info(
      `${ROUTE_NAME} successful`,
      {
        adminId: admin.id,
        method,
        trustedDevice:
          trustedDevice.trusted,
        trustedDeviceCreated:
          trustedDevice.created,
      },
    );

    return response;
  } catch (error) {
    console.error(
      `${ROUTE_NAME} failed:`,
      error,
    );

    await recordAudit({
      action:
        "admin_two_factor_unexpected_error",
      status: "service_error",
      riskLevel: "high",
      security,
      metadata: {
        actor_type: "system",
      },
    });

    return failed(
      500,
      "unexpected_verification_error",
      {},
      pendingCookies,
    );
  }
}
