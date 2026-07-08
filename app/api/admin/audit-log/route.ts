import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { createAdminAuditLog } from "@/lib/admin/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_ID_COOKIE = "burton_admin_id";
const ADMIN_EMAIL_COOKIE = "burton_admin_email";

function noStoreHeaders() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  };
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: noStoreHeaders(),
  });
}

function cleanString(value: unknown, maxLength = 500) {
  return String(value ?? "").trim().slice(0, maxLength);
}

async function getCurrentAdmin(request: NextRequest) {
  const adminId = request.cookies.get(ADMIN_ID_COOKIE)?.value || "";
  const adminEmail = request.cookies.get(ADMIN_EMAIL_COOKIE)?.value || "";

  if (!adminId || !adminEmail) return null;

  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("id,email,full_name,role,is_active,permissions,is_main_admin")
    .eq("id", adminId)
    .eq("email", adminEmail)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("Audit API current admin lookup failed:", error);
    return null;
  }

  return data;
}

function permissionListFromValue(value: unknown) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "object") {
    return Object.entries(value)
      .filter(([, allowed]) => allowed === true || allowed === "true" || allowed === 1)
      .map(([key]) => key);
  }

  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

function canViewAuditLogs(admin: Record<string, unknown>) {
  if (admin.role === "main_admin" || admin.is_main_admin === true) return true;

  const permissions = permissionListFromValue(admin.permissions);

  return permissions.includes("audit_logs:view");
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin(request);

    if (!admin) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const body = await request.json().catch(() => ({}));

    const action = cleanString(body.action, 120);

    if (!action) {
      return json({ ok: false, error: "Missing audit action." }, 400);
    }

    const result = await createAdminAuditLog({
      adminId: String(admin.id),
      adminEmail: String(admin.email),
      adminName: typeof admin.full_name === "string" ? admin.full_name : null,
      adminRole: typeof admin.role === "string" ? admin.role : null,

      action,
      area: cleanString(body.area || "admin_portal", 120),
      route: cleanString(body.route || "", 500) || null,
      method: cleanString(body.method || "CLIENT", 20) || null,
      status: cleanString(body.status || "info", 30) as any,
      riskLevel: cleanString(body.riskLevel || "low", 30) as any,

      targetType: cleanString(body.targetType || "", 120) || null,
      targetId: cleanString(body.targetId || "", 200) || null,
      targetLabel: cleanString(body.targetLabel || "", 300) || null,

      metadata:
        body.metadata && typeof body.metadata === "object"
          ? (body.metadata as Record<string, unknown>)
          : {},
    });

    if (!result.ok) {
      return json({ ok: false, error: result.error }, 500);
    }

    return json({ ok: true });
  } catch (error) {
    console.error("POST /api/admin/audit-log error:", error);

    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Audit log failed.",
      },
      500
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin(request);

    if (!admin) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    if (!canViewAuditLogs(admin as Record<string, unknown>)) {
      return json({ ok: false, error: "Forbidden" }, 403);
    }

    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") || 100), 250);
    const area = cleanString(url.searchParams.get("area") || "", 120);
    const action = cleanString(url.searchParams.get("action") || "", 120);
    const risk = cleanString(url.searchParams.get("risk") || "", 30);
    const email = cleanString(url.searchParams.get("email") || "", 254);
    const route = cleanString(url.searchParams.get("route") || "", 500);

    let query = supabaseAdmin
      .from("admin_portal_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (area) query = query.eq("area", area);
    if (action) query = query.eq("action", action);
    if (risk) query = query.eq("risk_level", risk);
    if (email) query = query.ilike("admin_email", `%${email}%`);
    if (route) query = query.ilike("route", `%${route}%`);

    const { data, error } = await query;

    if (error) {
      return json({ ok: false, error: error.message }, 500);
    }

    return json({
      ok: true,
      logs: data || [],
    });
  } catch (error) {
    console.error("GET /api/admin/audit-log error:", error);

    return json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to load audit logs.",
      },
      500
    );
  }
}
