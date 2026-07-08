import { createHash, randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";

/**
 * File location:
 * app/api/admin/audit-log/report/route.ts
 *
 * Purpose:
 * This route writes security and admin activity events into public.admin_audit_logs.
 * It supports authenticated admin events AND unauthenticated login-page security events.
 *
 * Security rules:
 * - Never store passwords.
 * - Never store full input values except safe route/action strings.
 * - Login emails are stored as redacted labels plus a hash for investigation.
 * - Admin cookie identity is trusted only after checking admin_users.
 * - Client reports are useful for visibility, but login success/failure must still
 *   also be recorded inside the real login API because client reports can be blocked.
 */

const AUDIT_LOG_TABLE = "admin_audit_logs";
const ADMIN_USERS_TABLE = "admin_users";

const MAX_ACTION_LENGTH = 120;
const MAX_AREA_LENGTH = 80;
const MAX_ROUTE_LENGTH = 500;
const MAX_STATUS_LENGTH = 80;
const MAX_TARGET_LENGTH = 220;
const MAX_METADATA_DEPTH = 4;
const MAX_METADATA_KEYS = 80;
const MAX_STRING_VALUE_LENGTH = 1000;

const ALLOWED_RISKS = ["low", "medium", "high", "critical"] as const;
type AuditRiskLevel = (typeof ALLOWED_RISKS)[number];

const ALLOWED_AREAS = new Set([
  "auth",
  "dashboard",
  "money",
  "email",
  "event_hub",
  "contacts",
  "admin_users",
  "audit_logs",
  "donations",
  "raffle",
  "site_pages",
  "admin_portal",
  "security",
  "unknown",
]);

/**
 * These are the client-side event names we intentionally accept from admin pages.
 * Keeping this list explicit makes the audit log cleaner and stops random spammy
 * event names from being inserted by mistake.
 */
const ALLOWED_ACTIONS = new Set([
  "admin_page_view",
  "admin_page_hidden",
  "admin_page_visible",
  "admin_route_change",
  "admin_access_check_failed",
  "permission_denied",
  "unauthenticated_admin_access",

  "login_page_opened",
  "login_page_ready",
  "login_page_unloaded",
  "login_next_path_detected",
  "login_next_path_rejected",
  "login_logout_notice_seen",

  "login_existing_session_check_started",
  "login_existing_session_found",
  "login_existing_session_not_found",
  "login_existing_session_check_failed",

  "login_email_field_focused",
  "login_email_field_blurred",
  "login_password_field_focused",
  "login_password_field_blurred",
  "login_password_visibility_toggled",
  "login_public_back_link_clicked",

  "login_submit_clicked",
  "login_validation_failed",
  "login_attempt_started",
  "login_attempt_failed_client",
  "login_attempt_success_client",
  "login_attempt_connection_failed_client",
  "login_local_lockout_started",
  "login_local_lockout_ended",
  "login_local_lockout_blocked_submit",

  "admin_security_notice_viewed",
  "admin_security_notice_actioned",
]);

type AdminRow = {
  id: string;
  email: string | null;
  role: string | null;
  is_active: boolean | null;
  permissions?: unknown;
};

type AuditReportBody = {
  action?: string;
  area?: string;
  route?: string | null;
  method?: string | null;
  status?: string;
  risk_level?: AuditRiskLevel;
  target_type?: string | null;
  target_id?: string | null;
  target_label?: string | null;
  metadata?: Record<string, unknown>;
};

type ApiError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function lower(value: unknown) {
  return clean(value).toLowerCase();
}

function clampText(value: unknown, maxLength: number) {
  const text = clean(value);
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}

function nullIfEmpty(value: unknown, maxLength = MAX_TARGET_LENGTH) {
  const text = clampText(value, maxLength);
  return text || null;
}

function normaliseRisk(value: unknown): AuditRiskLevel {
  const risk = lower(value);
  return ALLOWED_RISKS.includes(risk as AuditRiskLevel)
    ? (risk as AuditRiskLevel)
    : "low";
}

function normaliseArea(value: unknown) {
  const area = lower(value).replaceAll("-", "_").replace(/\s+/g, "_");
  if (!area) return "admin_portal";
  if (ALLOWED_AREAS.has(area)) return area;
  return "unknown";
}

function normaliseAction(value: unknown) {
  const action = lower(value).replaceAll("-", "_").replace(/\s+/g, "_");
  if (!action) return "admin_page_view";
  if (action.length > MAX_ACTION_LENGTH) return "invalid_long_action";
  if (ALLOWED_ACTIONS.has(action)) return action;

  /**
   * Unknown client actions should not create unlimited arbitrary audit types.
   * They still get recorded, but under one safe action name with the original
   * value stored in metadata by the caller if needed.
   */
  return "admin_security_notice_viewed";
}

function getIpAddress(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    null
  );
}

function getUserAgent(request: NextRequest) {
  return request.headers.get("user-agent") || null;
}

function getReferer(request: NextRequest) {
  return request.headers.get("referer") || null;
}

function getOrigin(request: NextRequest) {
  return request.headers.get("origin") || null;
}

function getSupabaseDetails(error: ApiError) {
  return {
    supabase_code: error.code || null,
    supabase_message: error.message || null,
    supabase_details: error.details || null,
    supabase_hint: error.hint || null,
  };
}

function safeJsonResponse(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}

function hashForAudit(value: string) {
  const salt =
    process.env.AUDIT_HASH_SALT ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    "burton-pride-local-audit-salt";

  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

function redactEmail(value: unknown) {
  const email = lower(value);
  if (!email || !email.includes("@")) return null;

  const [name, domain] = email.split("@");
  if (!name || !domain) return null;

  const first = name.slice(0, 1);
  const last = name.length > 2 ? name.slice(-1) : "";
  const dots = "*".repeat(Math.min(Math.max(name.length - 2, 2), 8));

  return `${first}${dots}${last}@${domain}`;
}

function emailDomain(value: unknown) {
  const email = lower(value);
  if (!email.includes("@")) return null;
  const domain = email.split("@").pop();
  return domain || null;
}

function removeSensitiveKey(key: string) {
  const lowered = key.toLowerCase();
  return (
    lowered.includes("password") ||
    lowered.includes("passcode") ||
    lowered.includes("secret") ||
    lowered.includes("token") ||
    lowered.includes("service_role") ||
    lowered.includes("authorization") ||
    lowered.includes("cookie") ||
    lowered.includes("session") ||
    lowered.includes("csrf")
  );
}

function sanitiseMetadataValue(
  value: unknown,
  depth: number,
  keyHint = "",
): unknown {
  if (removeSensitiveKey(keyHint)) {
    return "[redacted]";
  }

  if (value === null || value === undefined) return null;

  if (typeof value === "string") {
    return clampText(value, MAX_STRING_VALUE_LENGTH);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    if (depth >= MAX_METADATA_DEPTH) return "[max-depth]";
    return value
      .slice(0, 30)
      .map((item, index) => sanitiseMetadataValue(item, depth + 1, `${keyHint}_${index}`));
  }

  if (typeof value === "object") {
    if (depth >= MAX_METADATA_DEPTH) return "[max-depth]";

    const output: Record<string, unknown> = {};
    let count = 0;

    for (const [key, childValue] of Object.entries(value as Record<string, unknown>)) {
      if (count >= MAX_METADATA_KEYS) {
        output.__truncated = true;
        break;
      }

      const safeKey = clampText(key, 80) || "unknown_key";
      output[safeKey] = sanitiseMetadataValue(childValue, depth + 1, safeKey);
      count += 1;
    }

    return output;
  }

  return clampText(value, MAX_STRING_VALUE_LENGTH);
}

function sanitiseMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  return sanitiseMetadataValue(metadata, 0) as Record<string, unknown>;
}

function getAttemptEmailFromMetadata(metadata: Record<string, unknown>) {
  const raw =
    metadata.email ||
    metadata.clean_email ||
    metadata.email_address ||
    metadata.attempted_email ||
    metadata.submitted_email;

  return lower(raw);
}

async function getCurrentAdmin(request: NextRequest) {
  const adminId = clean(request.cookies.get("burton_admin_id")?.value);
  const adminEmail = lower(request.cookies.get("burton_admin_email")?.value);

  if (!adminId && !adminEmail) {
    return {
      admin: null as AdminRow | null,
      error: null as ApiError | null,
    };
  }

  let query = supabaseAdmin
    .from(ADMIN_USERS_TABLE)
    .select("id, email, role, is_active, permissions")
    .limit(1);

  if (adminId) {
    query = query.eq("id", adminId);
  } else {
    query = query.ilike("email", adminEmail);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    return {
      admin: null as AdminRow | null,
      error: error as ApiError,
    };
  }

  return {
    admin: data as AdminRow | null,
    error: null as ApiError | null,
  };
}

function buildClientContext(request: NextRequest) {
  return {
    request_id: randomUUID(),
    ip_address: getIpAddress(request),
    user_agent: getUserAgent(request),
    referer: getReferer(request),
    origin: getOrigin(request),
  };
}

function isLikelyAdminRoute(route: string | null) {
  if (!route) return false;
  const lowerRoute = route.toLowerCase();
  return lowerRoute.startsWith("/admin") || lowerRoute.startsWith("/api/admin");
}

function isAuthArea(area: string) {
  return area === "auth" || area === "security";
}

export async function POST(request: NextRequest) {
  const context = buildClientContext(request);

  try {
    const body = (await request.json().catch(() => null)) as AuditReportBody | null;

    if (!body || typeof body !== "object") {
      return safeJsonResponse(
        {
          ok: false,
          error: "Missing audit report body.",
          code: "AUDIT_REPORT_BODY_MISSING",
          request_id: context.request_id,
        },
        400,
      );
    }

    const rawMetadata = sanitiseMetadata(body.metadata);
    const attemptedEmail = getAttemptEmailFromMetadata(rawMetadata);

    const action = normaliseAction(body.action);
    const area = normaliseArea(body.area);
    const route = nullIfEmpty(body.route, MAX_ROUTE_LENGTH);
    const method = clampText(body.method || "CLIENT", 20).toUpperCase() || "CLIENT";
    const status = clampText(body.status || "success", MAX_STATUS_LENGTH) || "success";
    const riskLevel = normaliseRisk(body.risk_level);

    /**
     * Only accept unauthenticated audit reports for auth/login/security areas.
     * Normal admin pages should have a valid admin cookie.
     */
    const { admin, error: adminLookupError } = await getCurrentAdmin(request);

    if (adminLookupError) {
      console.error("Audit report admin lookup failed:", {
        requestId: context.request_id,
        ...getSupabaseDetails(adminLookupError),
      });
    }

    const canWriteWithoutAdmin = isAuthArea(area) || action.startsWith("login_");

    if (!admin && !canWriteWithoutAdmin) {
      return safeJsonResponse(
        {
          ok: false,
          error: "Admin could not be confirmed for this audit report.",
          code: "AUDIT_REPORT_ADMIN_REQUIRED",
          request_id: context.request_id,
        },
        401,
      );
    }

    if (admin && admin.is_active === false) {
      return safeJsonResponse(
        {
          ok: false,
          error: "Admin account is inactive.",
          code: "AUDIT_REPORT_ADMIN_INACTIVE",
          request_id: context.request_id,
        },
        403,
      );
    }

    if (route && !isLikelyAdminRoute(route)) {
      return safeJsonResponse(
        {
          ok: false,
          error: "Audit route rejected because it is not an Admin route.",
          code: "AUDIT_REPORT_ROUTE_REJECTED",
          request_id: context.request_id,
        },
        400,
      );
    }

    const attemptedEmailRedacted = attemptedEmail ? redactEmail(attemptedEmail) : null;
    const attemptedEmailHash = attemptedEmail ? hashForAudit(attemptedEmail) : null;

    const metadata = {
      ...rawMetadata,
      /** Remove any raw attempted email keys after deriving safe values. */
      email: attemptedEmail ? "[redacted]" : rawMetadata.email,
      clean_email: attemptedEmail ? "[redacted]" : rawMetadata.clean_email,
      email_address: attemptedEmail ? "[redacted]" : rawMetadata.email_address,
      attempted_email: attemptedEmail ? "[redacted]" : rawMetadata.attempted_email,
      submitted_email: attemptedEmail ? "[redacted]" : rawMetadata.submitted_email,

      attempted_email_redacted: attemptedEmailRedacted,
      attempted_email_hash: attemptedEmailHash,
      attempted_email_domain: attemptedEmail ? emailDomain(attemptedEmail) : null,

      reported_from: "admin_client_security_report",
      report_request_id: context.request_id,
      referer: context.referer,
      origin: context.origin,
      client_report_version: "2026-07-security-audit-v1",
    };

    const adminEmailForRow = admin?.email || attemptedEmailRedacted;
    const adminNameForRow = admin?.email || attemptedEmailRedacted;
    const adminRoleForRow = admin?.role || (attemptedEmail ? "unauthenticated_login_attempt" : "unauthenticated");

    const { error } = await supabaseAdmin.from(AUDIT_LOG_TABLE).insert({
      admin_id: admin?.id || null,
      admin_email: adminEmailForRow,
      admin_name: adminNameForRow,
      admin_role: adminRoleForRow,

      action,
      area,
      route,
      method,
      status,
      risk_level: riskLevel,

      target_type: nullIfEmpty(body.target_type),
      target_id: nullIfEmpty(body.target_id),
      target_label: nullIfEmpty(body.target_label),

      ip_address: context.ip_address,
      user_agent: context.user_agent,
      metadata,
    });

    if (error) {
      const details = getSupabaseDetails(error);

      console.error("Audit report insert failed:", {
        requestId: context.request_id,
        table: AUDIT_LOG_TABLE,
        ...details,
      });

      return safeJsonResponse(
        {
          ok: false,
          error: "Audit log could not be saved.",
          code: "AUDIT_REPORT_INSERT_FAILED",
          details,
          request_id: context.request_id,
        },
        500,
      );
    }

    return safeJsonResponse({
      ok: true,
      request_id: context.request_id,
    });
  } catch (error) {
    console.error("Audit report unexpected error:", {
      requestId: context.request_id,
      error,
    });

    return safeJsonResponse(
      {
        ok: false,
        error: "Audit report failed unexpectedly.",
        code: "AUDIT_REPORT_UNEXPECTED_ERROR",
        details: error instanceof Error ? error.message : "Unknown error",
        request_id: context.request_id,
      },
      500,
    );
  }
}
