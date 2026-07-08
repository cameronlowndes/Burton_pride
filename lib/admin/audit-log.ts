import { cookies, headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

type AuditRiskLevel = "low" | "medium" | "high" | "critical";
type AuditStatus = "info" | "success" | "warning" | "failed" | "blocked";

export type CreateAdminAuditLogInput = {
  adminId?: string | null;
  adminEmail?: string | null;
  adminName?: string | null;
  adminRole?: string | null;

  action: string;
  area?: string;
  route?: string | null;
  method?: string | null;
  status?: AuditStatus;
  riskLevel?: AuditRiskLevel;

  targetType?: string | null;
  targetId?: string | null;
  targetLabel?: string | null;

  ipAddress?: string | null;
  userAgent?: string | null;
  referrer?: string | null;

  metadata?: Record<string, unknown>;
};

const ADMIN_ID_COOKIE = "burton_admin_id";
const ADMIN_EMAIL_COOKIE = "burton_admin_email";

function cleanString(value: unknown, maxLength = 500) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function cleanEmail(value: unknown) {
  return cleanString(value, 254).toLowerCase();
}

function removeSensitiveMetadata(value: Record<string, unknown> | undefined) {
  const metadata = { ...(value || {}) };

  const blockedKeys = [
    "password",
    "newPassword",
    "oldPassword",
    "currentPassword",
    "confirmPassword",
    "token",
    "access_token",
    "refresh_token",
    "session",
    "sessionToken",
    "secret",
    "service_role",
    "apiKey",
    "apikey",
  ];

  for (const key of Object.keys(metadata)) {
    if (blockedKeys.some((blocked) => key.toLowerCase().includes(blocked.toLowerCase()))) {
      metadata[key] = "[redacted]";
    }
  }

  return metadata;
}

export async function getAuditRequestInfo() {
  const headerStore = await headers();

  const forwardedFor = headerStore.get("x-forwarded-for") || "";
  const realIp = headerStore.get("x-real-ip") || "";
  const cfConnectingIp = headerStore.get("cf-connecting-ip") || "";

  const ipAddress =
    cfConnectingIp ||
    realIp ||
    forwardedFor.split(",")[0]?.trim() ||
    null;

  return {
    ipAddress,
    userAgent: headerStore.get("user-agent") || null,
    referrer: headerStore.get("referer") || null,
  };
}

export async function getAuditCookieAdmin() {
  const cookieStore = await cookies();

  return {
    adminId: cookieStore.get(ADMIN_ID_COOKIE)?.value || null,
    adminEmail: cookieStore.get(ADMIN_EMAIL_COOKIE)?.value || null,
  };
}

export async function createAdminAuditLog(input: CreateAdminAuditLogInput) {
  try {
    const requestInfo = await getAuditRequestInfo();
    const cookieAdmin = await getAuditCookieAdmin();

    const row = {
      admin_id: input.adminId || cookieAdmin.adminId || null,
      admin_email: cleanEmail(input.adminEmail || cookieAdmin.adminEmail || ""),
      admin_name: cleanString(input.adminName || "", 200) || null,
      admin_role: cleanString(input.adminRole || "", 50) || null,

      action: cleanString(input.action, 120),
      area: cleanString(input.area || "admin_portal", 120),
      route: cleanString(input.route || "", 500) || null,
      method: cleanString(input.method || "", 20) || null,
      status: cleanString(input.status || "info", 30),
      risk_level: cleanString(input.riskLevel || "low", 30),

      target_type: cleanString(input.targetType || "", 120) || null,
      target_id: cleanString(input.targetId || "", 200) || null,
      target_label: cleanString(input.targetLabel || "", 300) || null,

      ip_address: cleanString(input.ipAddress || requestInfo.ipAddress || "", 100) || null,
      user_agent: cleanString(input.userAgent || requestInfo.userAgent || "", 700) || null,
      referrer: cleanString(input.referrer || requestInfo.referrer || "", 700) || null,

      metadata: removeSensitiveMetadata(input.metadata),
    };

    if (!row.action) return { ok: false, error: "Missing audit action." };

    const { error } = await supabaseAdmin
      .from("admin_portal_audit_logs")
      .insert(row);

    if (error) {
      console.error("Admin audit log insert failed:", error);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error) {
    console.error("Admin audit log crashed:", error);

    return {
      ok: false,
      error: error instanceof Error ? error.message : "Audit log failed.",
    };
  }
}

export async function auditLoginAttempt(input: {
  email: string;
  ok: boolean;
  reason?: string;
  adminId?: string | null;
  adminRole?: string | null;
}) {
  return createAdminAuditLog({
    adminId: input.adminId || null,
    adminEmail: input.email,
    adminRole: input.adminRole || null,
    action: input.ok ? "login_success" : "login_failed",
    area: "auth",
    route: "/Admin/Login",
    method: "POST",
    status: input.ok ? "success" : "failed",
    riskLevel: input.ok ? "medium" : "high",
    metadata: {
      reason: input.reason || null,
    },
  });
}

export async function auditLogout(input?: {
  adminId?: string | null;
  adminEmail?: string | null;
  adminRole?: string | null;
}) {
  return createAdminAuditLog({
    adminId: input?.adminId || null,
    adminEmail: input?.adminEmail || null,
    adminRole: input?.adminRole || null,
    action: "logout",
    area: "auth",
    route: "/api/admin/logout",
    method: "POST",
    status: "success",
    riskLevel: "medium",
  });
}
