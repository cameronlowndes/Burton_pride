/**
 * Burton Pride Admin Portal
 *
 * CORRECT ROUTE:
 *   app/api/admin/settings/login/route.ts
 *
 * This is the PASSWORD LOGIN endpoint.
 * It accepts:
 *   { email, password, next }
 *
 * Do NOT replace this file with the two-factor verify route.
 * Two-factor verification belongs at:
 *   app/api/admin/settings/login/two-factor/verify/route.ts
 */

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
const TRUSTED_DEVICE_COOKIE = "burton_admin_trusted_device";

const SESSION_MAX_AGE = 60 * 60 * 12;
const TWO_FACTOR_MAX_AGE = 60 * 10;
const TRUSTED_DEVICE_MAX_AGE = 60 * 60 * 24 * 90;

const MAX_TWO_FACTOR_ATTEMPTS = 5;
const MAX_TWO_FACTOR_RESENDS = 3;
const MAX_TRUSTED_DEVICES = 3;

type TwoFactorMethod = "email" | "totp";
type AuditRiskLevel = "low" | "medium" | "high" | "critical";

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

type RequestSecurityContext = {
  ipAddress: string;
  ipHash: string | null;
  userAgent: string;
  userAgentHash: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  approximateLocation: string | null;
  deviceLabel: string;
};

type TrustedDeviceRecord = {
  id: string;
  admin_id: string;
  device_name?: string | null;
  browser?: string | null;
  operating_system?: string | null;
  device_type?: string | null;
  device_token_hash?: string | null;
  revoked_at?: string | null;
  last_seen_at?: string | null;
};

type DeviceSecurityState = {
  supported: boolean;
  newDevice: boolean;
  deviceTrusted: boolean;
  requiresDeviceApproval: boolean;
  trustedDeviceCount: number;
  maxTrustedDevices: number;
  trustedDeviceId: string | null;
  deviceLabel: string;
  approximateLocation: string | null;
  riskLevel: AuditRiskLevel;
  riskReasons: string[];
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
    sameSite: "strict",
    path: "/",
    maxAge: TWO_FACTOR_MAX_AGE,
  });
}

function clearPendingTwoFactorCookie(response: NextResponse): void {
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

  clearPendingTwoFactorCookie(response);
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
  extra?: Record<string, unknown>,
): NextResponse {
  const response = createJsonResponse(
    {
      ok: false,
      authenticated: false,
      message: "Sign in failed.",
      reason,
      ...(extra || {}),
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

  // Prefer authenticator if both exist.
  if (methods.includes("totp")) return "totp";

  return methods[0] ?? "email";
}

function firstHeader(
  request: NextRequest,
  names: string[],
): string {
  for (const name of names) {
    const value = cleanString(request.headers.get(name));
    if (value) return value;
  }

  return "";
}

function getRequestIp(request: NextRequest): string {
  const direct = firstHeader(request, [
    "cf-connecting-ip",
    "x-real-ip",
    "x-client-ip",
  ]);

  if (direct) return direct;

  const forwarded = cleanString(
    request.headers.get("x-forwarded-for"),
  );

  if (!forwarded) return "";

  return cleanString(forwarded.split(",")[0]);
}

function decodeHeaderValue(value: string): string {
  if (!value) return "";

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function detectDeviceLabel(userAgent: string): string {
  const ua = userAgent.toLowerCase();

  let browser = "Browser";
  let os = "Device";

  if (ua.includes("edg/")) browser = "Microsoft Edge";
  else if (ua.includes("chrome/") && !ua.includes("chromium/")) {
    browser = "Chrome";
  } else if (ua.includes("firefox/")) browser = "Firefox";
  else if (ua.includes("safari/") && !ua.includes("chrome/")) {
    browser = "Safari";
  }

  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";
  else if (ua.includes("mac os") || ua.includes("macintosh")) os = "macOS";
  else if (ua.includes("linux")) os = "Linux";

  return `${browser} on ${os}`;
}

function buildApproximateLocation(
  city: string,
  region: string,
  country: string,
): string | null {
  const parts = [city, region, country]
    .map((item) => cleanString(item))
    .filter(Boolean);

  return parts.length ? Array.from(new Set(parts)).join(", ") : null;
}

function getRequestSecurityContext(
  request: NextRequest,
): RequestSecurityContext {
  const ipAddress = getRequestIp(request);
  const userAgent = cleanString(request.headers.get("user-agent"));

  // These headers are populated by some trusted hosting/proxy providers.
  // They are only context; never treat them as exact physical location.
  const city = decodeHeaderValue(
    firstHeader(request, [
      "x-vercel-ip-city",
      "cf-ipcity",
      "x-appengine-city",
    ]),
  );

  const region = decodeHeaderValue(
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
    ) || "";

  const countryCode =
    cleanString(
      firstHeader(request, [
        "x-vercel-ip-country",
        "cf-ipcountry",
      ]),
    ).toUpperCase() || null;

  return {
    ipAddress,
    ipHash: ipAddress ? hashWithPepper(ipAddress) : null,
    userAgent,
    userAgentHash: userAgent ? hashWithPepper(userAgent) : null,
    city: city || null,
    region: region || null,
    country: country || null,
    countryCode,
    approximateLocation: buildApproximateLocation(
      city,
      region,
      country,
    ),
    deviceLabel: detectDeviceLabel(userAgent),
  };
}

function isMissingTableOrColumn(error: {
  code?: string | null;
  message?: string | null;
} | null | undefined, names: string[]): boolean {
  if (!error) return false;

  const message = cleanString(error.message).toLowerCase();

  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    error.code === "PGRST204" ||
    error.code === "PGRST205" ||
    names.some((name) => message.includes(name.toLowerCase()))
  );
}

function getTrustedDeviceCookieToken(
  request: NextRequest,
): string {
  return cleanString(request.cookies.get(TRUSTED_DEVICE_COOKIE)?.value);
}

async function resolveDeviceSecurityState(params: {
  request: NextRequest;
  adminId: string;
  security: RequestSecurityContext;
}): Promise<DeviceSecurityState> {
  const rawDeviceToken = getTrustedDeviceCookieToken(params.request);
  const tokenHash = rawDeviceToken
    ? hashWithPepper(rawDeviceToken)
    : null;

  const fallback: DeviceSecurityState = {
    supported: false,
    newDevice: true,
    deviceTrusted: false,
    requiresDeviceApproval: false,
    trustedDeviceCount: 0,
    maxTrustedDevices: MAX_TRUSTED_DEVICES,
    trustedDeviceId: null,
    deviceLabel: params.security.deviceLabel,
    approximateLocation: params.security.approximateLocation,
    riskLevel: "medium",
    riskReasons: ["trusted_device_storage_not_available"],
  };

  const countResult = await supabaseAdmin
    .from("admin_trusted_devices")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("admin_id", params.adminId)
    .is("revoked_at", null);

  if (countResult.error) {
    if (
      isMissingTableOrColumn(countResult.error, [
        "admin_trusted_devices",
        "revoked_at",
      ])
    ) {
      return fallback;
    }

    throw new Error(
      `Could not count trusted devices: ${countResult.error.message}`,
    );
  }

  const trustedDeviceCount = countResult.count || 0;

  let trustedDevice: TrustedDeviceRecord | null = null;

  if (tokenHash) {
    const deviceResult = await supabaseAdmin
      .from("admin_trusted_devices")
      .select(
        [
          "id",
          "admin_id",
          "device_name",
          "browser",
          "operating_system",
          "device_type",
          "device_token_hash",
          "revoked_at",
          "last_seen_at",
        ].join(","),
      )
      .eq("admin_id", params.adminId)
      .eq("device_token_hash", tokenHash)
      .is("revoked_at", null)
      .maybeSingle<TrustedDeviceRecord>();

    if (deviceResult.error) {
      if (
        isMissingTableOrColumn(deviceResult.error, [
          "admin_trusted_devices",
          "device_token_hash",
          "revoked_at",
        ])
      ) {
        return fallback;
      }

      throw new Error(
        `Could not resolve trusted device: ${deviceResult.error.message}`,
      );
    }

    trustedDevice = deviceResult.data || null;
  }

  const deviceTrusted = Boolean(trustedDevice);
  const newDevice = !deviceTrusted;
  const requiresDeviceApproval =
    newDevice && trustedDeviceCount >= MAX_TRUSTED_DEVICES;

  const riskReasons: string[] = [];

  if (newDevice) riskReasons.push("new_device");
  if (requiresDeviceApproval) {
    riskReasons.push("trusted_device_limit_reached");
  }

  const riskLevel: AuditRiskLevel =
    requiresDeviceApproval
      ? "high"
      : newDevice
        ? "medium"
        : "low";

  if (trustedDevice?.id) {
    const updateResult = await supabaseAdmin
      .from("admin_trusted_devices")
      .update({
        last_seen_at: new Date().toISOString(),
        last_ip: params.security.ipAddress || null,
        last_city: params.security.city,
        last_region: params.security.region,
        last_country: params.security.country,
      })
      .eq("id", trustedDevice.id);

    if (
      updateResult.error &&
      !isMissingTableOrColumn(updateResult.error, [
        "last_ip",
        "last_city",
        "last_region",
        "last_country",
      ])
    ) {
      console.warn(
        `${ROUTE_NAME} trusted device context update failed:`,
        updateResult.error.message,
      );
    }
  }

  return {
    supported: true,
    newDevice,
    deviceTrusted,
    requiresDeviceApproval,
    trustedDeviceCount,
    maxTrustedDevices: MAX_TRUSTED_DEVICES,
    trustedDeviceId: trustedDevice?.id || null,
    deviceLabel:
      cleanString(trustedDevice?.device_name) ||
      params.security.deviceLabel,
    approximateLocation: params.security.approximateLocation,
    riskLevel,
    riskReasons,
  };
}

async function invalidateOldChallenges(
  adminId: string,
): Promise<void> {
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
  security: RequestSecurityContext;
  deviceSecurity: DeviceSecurityState;
}): Promise<ChallengeRecord> {
  const expiresAt = new Date(
    Date.now() + TWO_FACTOR_MAX_AGE * 1000,
  ).toISOString();

  const insertPayload: Record<string, unknown> = {
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
    ip_hash: params.security.ipHash,
    user_agent_hash: params.security.userAgentHash,
  };

  const { data, error } = await supabaseAdmin
    .from("admin_two_factor_challenges")
    .insert(insertPayload)
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
  riskLevel: AuditRiskLevel;
  security?: RequestSecurityContext;
  deviceSecurity?: DeviceSecurityState;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const securityMetadata: Record<string, unknown> = params.security
      ? {
          ip_hash: params.security.ipHash,
          approximate_city: params.security.city,
          approximate_region: params.security.region,
          approximate_country: params.security.country,
          approximate_location: params.security.approximateLocation,
          device_label: params.security.deviceLabel,
          user_agent_hash: params.security.userAgentHash,
        }
      : {};

    const deviceMetadata: Record<string, unknown> =
      params.deviceSecurity
        ? {
            trusted_device_supported:
              params.deviceSecurity.supported,
            trusted_device_id:
              params.deviceSecurity.trustedDeviceId,
            new_device:
              params.deviceSecurity.newDevice,
            device_trusted:
              params.deviceSecurity.deviceTrusted,
            requires_device_approval:
              params.deviceSecurity.requiresDeviceApproval,
            trusted_device_count:
              params.deviceSecurity.trustedDeviceCount,
            max_trusted_devices:
              params.deviceSecurity.maxTrustedDevices,
            risk_reasons:
              params.deviceSecurity.riskReasons,
          }
        : {};

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
        metadata: {
          ...securityMetadata,
          ...deviceMetadata,
          ...(params.metadata || {}),
        },
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.warn(
        `${ROUTE_NAME} audit insert failed:`,
        error.message,
      );
    }
  } catch (error) {
    console.warn(`${ROUTE_NAME} audit insert threw:`, error);
  }
}

async function storeLoginAttempt(params: {
  security: RequestSecurityContext;
  result:
    | "success"
    | "failed"
    | "rate_limited"
    | "blocked";
  riskLevel: AuditRiskLevel;
  attemptedIdentity?: string | null;
  adminId?: string | null;
  reason?: string | null;
}): Promise<void> {
  const attemptedIdentityHash = params.attemptedIdentity
    ? hashWithPepper(params.attemptedIdentity.toLowerCase())
    : null;

  const { error } = await supabaseAdmin
    .from("admin_login_attempts")
    .insert({
      admin_id: params.adminId || null,
      attempted_identity_hash: attemptedIdentityHash,
      ip_hash: params.security.ipHash,
      user_agent_hash: params.security.userAgentHash,
      approximate_city: params.security.city,
      approximate_region: params.security.region,
      approximate_country: params.security.country,
      result: params.result,
      risk_level: params.riskLevel,
      reason: params.reason || null,
      created_at: new Date().toISOString(),
    });

  if (
    error &&
    !isMissingTableOrColumn(error, [
      "admin_login_attempts",
      "attempted_identity_hash",
      "approximate_city",
    ])
  ) {
    console.warn(
      `${ROUTE_NAME} login attempt insert failed:`,
      error.message,
    );
  }
}

async function countRecentFailedAttempts(params: {
  email: string;
  security: RequestSecurityContext;
}): Promise<{
  supported: boolean;
  accountFailures: number;
  ipFailures: number;
}> {
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const attemptedIdentityHash = hashWithPepper(
    params.email.toLowerCase(),
  );

  const accountResult = await supabaseAdmin
    .from("admin_login_attempts")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("attempted_identity_hash", attemptedIdentityHash)
    .eq("result", "failed")
    .gte("created_at", since);

  if (accountResult.error) {
    if (
      isMissingTableOrColumn(accountResult.error, [
        "admin_login_attempts",
        "attempted_identity_hash",
      ])
    ) {
      return {
        supported: false,
        accountFailures: 0,
        ipFailures: 0,
      };
    }

    throw new Error(
      `Could not check account login rate: ${accountResult.error.message}`,
    );
  }

  let ipFailures = 0;

  if (params.security.ipHash) {
    const ipResult = await supabaseAdmin
      .from("admin_login_attempts")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("ip_hash", params.security.ipHash)
      .eq("result", "failed")
      .gte("created_at", since);

    if (
      ipResult.error &&
      !isMissingTableOrColumn(ipResult.error, [
        "admin_login_attempts",
        "ip_hash",
      ])
    ) {
      throw new Error(
        `Could not check IP login rate: ${ipResult.error.message}`,
      );
    }

    ipFailures = ipResult.count || 0;
  }

  return {
    supported: true,
    accountFailures: accountResult.count || 0,
    ipFailures,
  };
}

function rateLimitExceeded(state: {
  accountFailures: number;
  ipFailures: number;
}): boolean {
  return (
    state.accountFailures >= 5 ||
    state.ipFailures >= 10
  );
}

function deviceSecurityResponse(
  state: DeviceSecurityState,
): Record<string, unknown> {
  return {
    riskLevel: state.riskLevel,
    newDevice: state.newDevice,
    deviceTrusted: state.deviceTrusted,
    requiresDeviceApproval: state.requiresDeviceApproval,
    trustedDeviceCount: state.trustedDeviceCount,
    maxTrustedDevices: state.maxTrustedDevices,
    approximateLocation: state.approximateLocation,
    deviceLabel: state.deviceLabel,
    trustedDeviceSupported: state.supported,
  };
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  const pendingCookies: PendingCookie[] = [];
  const security = getRequestSecurityContext(request);

  let body: LoginBody;

  try {
    body = (await request.json()) as LoginBody;
  } catch {
    await recordLoginAudit({
      action: "admin_login_invalid_json",
      status: "blocked",
      riskLevel: "medium",
      security,
      metadata: {
        actor_type: "unauthenticated_attempt",
        reason: "invalid_json_body",
      },
    });

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
    await recordLoginAudit({
      action: "admin_login_validation_failed",
      status: "blocked",
      riskLevel: "medium",
      security,
      metadata: {
        actor_type: "unauthenticated_attempt",
        reason: "missing_email_or_password",
      },
    });

    return genericFailed(
      pendingCookies,
      400,
      "missing_email_or_password",
    );
  }

  if (!emailLooksValid(email)) {
    await recordLoginAudit({
      action: "admin_login_validation_failed",
      status: "blocked",
      riskLevel: "medium",
      security,
      metadata: {
        actor_type: "unauthenticated_attempt",
        reason: "invalid_email_format",
      },
    });

    return genericFailed(
      pendingCookies,
      400,
      "invalid_email_format",
    );
  }

  if (email.length > 254 || password.length > 128) {
    await recordLoginAudit({
      action: "admin_login_validation_failed",
      status: "blocked",
      riskLevel: "medium",
      security,
      metadata: {
        actor_type: "unauthenticated_attempt",
        reason: "credentials_too_long",
      },
    });

    return genericFailed(
      pendingCookies,
      400,
      "credentials_too_long",
    );
  }

  try {
    const rateState = await countRecentFailedAttempts({
      email,
      security,
    });

    if (
      rateState.supported &&
      rateLimitExceeded(rateState)
    ) {
      await storeLoginAttempt({
        security,
        attemptedIdentity: email,
        result: "rate_limited",
        riskLevel: "high",
        reason: "server_rate_limit",
      });

      await recordLoginAudit({
        action: "admin_login_rate_limited",
        status: "rate_limited",
        riskLevel: "high",
        security,
        metadata: {
          actor_type: "unauthenticated_attempt",
          account_failures_5m: rateState.accountFailures,
          ip_failures_5m: rateState.ipFailures,
        },
      });

      return genericFailed(
        pendingCookies,
        429,
        "rate_limited",
      );
    }

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
      await storeLoginAttempt({
        security,
        attemptedIdentity: email,
        result: "failed",
        riskLevel: "medium",
        reason: "invalid_credentials",
      });

      await recordLoginAudit({
        action: "admin_login_password_failed",
        status: "rejected",
        riskLevel: "medium",
        security,
        metadata: {
          actor_type: "unauthenticated_attempt",
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
      await storeLoginAttempt({
        security,
        attemptedIdentity: email,
        result: "blocked",
        riskLevel: "high",
        reason: "admin_record_missing",
      });

      await recordLoginAudit({
        action: "admin_login_admin_record_missing",
        status: "blocked",
        riskLevel: "high",
        security,
        metadata: {
          actor_type: "unauthenticated_attempt",
          reason: "admin_record_missing",
        },
      });

      await clearSupabaseSession(supabase);

      return genericFailed(
        pendingCookies,
        403,
        "admin_record_missing",
      );
    }

    if (adminUser.is_active !== true) {
      await storeLoginAttempt({
        security,
        attemptedIdentity: email,
        adminId: adminUser.id,
        result: "blocked",
        riskLevel: "high",
        reason: "admin_inactive",
      });

      await recordLoginAudit({
        adminId: adminUser.id,
        adminEmail: adminUser.email,
        action: "admin_login_inactive_account",
        status: "blocked",
        riskLevel: "high",
        security,
        metadata: {
          actor_type: "authenticated_identity_blocked",
        },
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
    const adminRole =
      cleanString(adminUser.role) || "editor";
    const permissions = permissionKeys(
      adminUser.permissions,
    );

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
      await recordLoginAudit({
        adminId,
        adminEmail,
        action: "admin_login_identity_mismatch",
        status: "blocked",
        riskLevel: "critical",
        security,
        metadata: {
          actor_type: "authenticated_identity_blocked",
        },
      });

      await clearSupabaseSession(supabase);

      return genericFailed(
        pendingCookies,
        403,
        "supabase_identity_mismatch",
      );
    }

    const methods = enabledTwoFactorMethods(adminUser);

    // New policy: MFA is mandatory for every administrator.
    if (
      adminUser.two_factor_enabled !== true ||
      methods.length === 0
    ) {
      await storeLoginAttempt({
        security,
        attemptedIdentity: email,
        adminId,
        result: "blocked",
        riskLevel: "high",
        reason: "two_factor_required",
      });

      await recordLoginAudit({
        adminId,
        adminEmail,
        action: "admin_login_two_factor_required_but_missing",
        status: "blocked",
        riskLevel: "high",
        security,
        metadata: {
          actor_type: "authenticated_identity_blocked",
          two_factor_enabled:
            adminUser.two_factor_enabled === true,
          available_methods: methods,
        },
      });

      await clearSupabaseSession(supabase);

      return genericFailed(
        pendingCookies,
        403,
        "two_factor_required",
        {
          requiresTwoFactor: true,
          methods: [],
        },
      );
    }

    const deviceSecurity =
      await resolveDeviceSecurityState({
        request,
        adminId,
        security,
      });

    if (deviceSecurity.requiresDeviceApproval) {
      await storeLoginAttempt({
        security,
        attemptedIdentity: email,
        adminId,
        result: "blocked",
        riskLevel: "high",
        reason: "trusted_device_limit_reached",
      });

      await recordLoginAudit({
        adminId,
        adminEmail,
        action: "admin_login_new_device_blocked",
        status: "blocked",
        riskLevel: "high",
        security,
        deviceSecurity,
        metadata: {
          actor_type: "authenticated_identity_blocked",
          reason: "trusted_device_limit_reached",
        },
      });

      await clearSupabaseSession(supabase);

      return genericFailed(
        pendingCookies,
        403,
        "device_approval_required",
        {
          requiresDeviceApproval: true,
          security: deviceSecurityResponse(
            deviceSecurity,
          ),
        },
      );
    }

    const preferredMethod = preferredTwoFactorMethod(
      adminUser,
      methods,
    );

    const pendingToken =
      randomBytes(32).toString("base64url");
    const pendingSessionHash =
      hashWithPepper(pendingToken);

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
      security,
      deviceSecurity,
    });

    if (preferredMethod === "email" && rawEmailCode) {
      try {
        await sendSecurityCodeEmail({
          email: adminEmail,
          code: rawEmailCode,
          challengeId: challenge.id,
        });
      } catch (error) {
        console.error(
          `${ROUTE_NAME} email challenge failed:`,
          error,
        );

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
        security: deviceSecurityResponse(
          deviceSecurity,
        ),
      },
      200,
      pendingCookies,
    );

    clearAdminCookies(response);
    setPendingTwoFactorCookie(
      response,
      pendingToken,
    );

    await storeLoginAttempt({
      security,
      attemptedIdentity: email,
      adminId,
      result: "success",
      riskLevel: deviceSecurity.riskLevel,
      reason: "password_accepted_mfa_required",
    });

    await recordLoginAudit({
      adminId,
      adminEmail,
      action: deviceSecurity.newDevice
        ? "admin_login_new_device_two_factor_required"
        : "admin_login_two_factor_required",
      status: "challenge_created",
      riskLevel: deviceSecurity.riskLevel,
      security,
      deviceSecurity,
      metadata: {
        actor_type: "authenticated_admin",
        method: preferredMethod,
        available_methods: methods,
        challenge_id: challenge.id,
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

    await recordLoginAudit({
      action: "admin_login_unexpected_error",
      status: "service_error",
      riskLevel: "high",
      security,
      metadata: {
        actor_type: "system",
      },
    });

    return genericFailed(
      pendingCookies,
      500,
      "unexpected_login_error",
    );
  }
}
