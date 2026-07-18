import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/adminPermissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_AUDIT_REPORT_API = "/api/admin/audit-log/report";
const STOCK_HOME_ROUTE = "/Admin/StockManagement";

type AdminIdentity = {
  id?: string | null;
  email?: string | null;
  name?: string | null;
  full_name?: string | null;
  role?: string | null;
  permissions?: unknown;
  is_active?: boolean | null;
};

type StockHomeRequestBody = {
  action?: unknown;
  route?: unknown;
  page?: unknown;
};

type AuditReportBody = {
  action: string;
  area: string;
  route: string;
  method: string;
  status: string;
  risk_level: "low" | "medium" | "high" | "critical";
  target_type: string;
  target_id: string | null;
  target_label: string;
  metadata: Record<string, unknown>;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getAdminName(admin: AdminIdentity) {
  return (
    cleanString(admin.name) ||
    cleanString(admin.full_name) ||
    cleanString(admin.email) ||
    "Admin user"
  );
}

function getPermissionKeys(admin: AdminIdentity) {
  if (Array.isArray(admin.permissions)) {
    return admin.permissions
      .map((permission) => cleanString(permission))
      .filter(Boolean);
  }

  if (admin.permissions && typeof admin.permissions === "object") {
    return Object.entries(admin.permissions as Record<string, unknown>)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([permission]) => permission);
  }

  return [];
}

function isMainAdmin(admin: AdminIdentity) {
  return cleanString(admin.role).toLowerCase() === "main_admin";
}

function canUseStockControl(admin: AdminIdentity) {
  if (isMainAdmin(admin)) return true;

  const permissions = getPermissionKeys(admin);

  return (
    permissions.includes("stock:view") ||
    permissions.includes("stock:manage") ||
    permissions.includes("admin:dashboard:view")
  );
}

function getClientIp(requestHeaders: Headers) {
  const forwardedFor = requestHeaders.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return (
    requestHeaders.get("x-real-ip") ||
    requestHeaders.get("cf-connecting-ip") ||
    null
  );
}

function getSafeStockRoute(value: unknown) {
  const route = cleanString(value);

  if (!route) return STOCK_HOME_ROUTE;
  if (!route.startsWith("/Admin/StockManagement")) return STOCK_HOME_ROUTE;
  if (route.startsWith("//")) return STOCK_HOME_ROUTE;
  if (route.includes("\\")) return STOCK_HOME_ROUTE;

  return route;
}

function getSafeAction(value: unknown) {
  const action = cleanString(value).toLowerCase();

  if (action === "heartbeat") return "stock_control_heartbeat";
  if (action === "leave") return "stock_control_closed";

  return "stock_control_opened";
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

async function reportToAdminAuditLog(args: {
  admin: AdminIdentity;
  action: string;
  route: string;
  page: string;
  requestHeaders: Headers;
}) {
  const { admin, action, route, page, requestHeaders } = args;

  const host = requestHeaders.get("host");

  if (!host) {
    return {
      ok: false,
      error: "Request host was missing.",
    };
  }

  const protocol =
    requestHeaders.get("x-forwarded-proto") ||
    (process.env.NODE_ENV === "development" ? "http" : "https");

  const cookieStore = await cookies();
  const adminName = getAdminName(admin);
  const adminEmail = cleanString(admin.email) || null;
  const adminRole = cleanString(admin.role) || null;

  const body: AuditReportBody = {
    action,
    area: "stock_control",
    route,
    method: "CLIENT",
    status: "success",
    risk_level: "low",
    target_type: "stock_control_app",
    target_id: cleanString(admin.id) || null,
    target_label: "Burton Pride Stock Control",
    metadata: {
      message: `${adminName} is using Stock Control`,
      stock_page: page,
      admin_id: cleanString(admin.id) || null,
      admin_name: adminName,
      admin_email: adminEmail,
      admin_role: adminRole,
      is_main_admin: isMainAdmin(admin),
      client_ip: getClientIp(requestHeaders),
      user_agent: requestHeaders.get("user-agent"),
      recorded_at: new Date().toISOString(),
    },
  };

  try {
    const response = await fetch(
      `${protocol}://${host}${ADMIN_AUDIT_REPORT_API}`,
      {
        method: "POST",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          cookie: cookieStore.toString(),
        },
        body: JSON.stringify(body),
      },
    );

    const responseText = await response.text();

    let responseData: unknown = null;

    try {
      responseData = responseText ? JSON.parse(responseText) : null;
    } catch {
      responseData = responseText || null;
    }

    if (!response.ok) {
      console.error("Stock Control audit report failed:", {
        status: response.status,
        response: responseData,
      });

      return {
        ok: false,
        status: response.status,
        error: "The Admin Portal audit endpoint rejected the report.",
        details:
          process.env.NODE_ENV === "development" ? responseData : undefined,
      };
    }

    return {
      ok: true,
      status: response.status,
    };
  } catch (error) {
    console.error("Stock Control audit request failed:", error);

    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not contact the Admin Portal audit endpoint.",
    };
  }
}

async function handleStockHomeRequest(body: StockHomeRequestBody = {}) {
  const admin = (await getCurrentAdmin()) as AdminIdentity | null;

  if (!admin) {
    return json(
      {
        ok: false,
        error: "Unauthorised",
        message: "You must be signed in to use Stock Control.",
      },
      401,
    );
  }

  if (admin.is_active === false) {
    return json(
      {
        ok: false,
        error: "Admin account inactive",
        message: "This admin account is not active.",
      },
      403,
    );
  }

  if (!canUseStockControl(admin)) {
    return json(
      {
        ok: false,
        error: "Forbidden",
        message:
          "Your admin account does not have permission to use Stock Control.",
        requiredPermission: "stock:view",
      },
      403,
    );
  }

  const requestHeaders = await headers();
  const route = getSafeStockRoute(body.route);
  const page = cleanString(body.page) || "Stock Control Home";
  const action = getSafeAction(body.action);

  const audit = await reportToAdminAuditLog({
    admin,
    action,
    route,
    page,
    requestHeaders,
  });

  return json({
    ok: true,
    admin: {
      id: cleanString(admin.id) || null,
      name: getAdminName(admin),
      email: cleanString(admin.email) || null,
      role: cleanString(admin.role) || "admin",
      isMainAdmin: isMainAdmin(admin),
    },
    permissions: {
      canView: true,
      canManage:
        isMainAdmin(admin) ||
        getPermissionKeys(admin).includes("stock:manage"),
    },
    usage: {
      action,
      route,
      page,
      recordedAt: new Date().toISOString(),
      auditReported: audit.ok,
    },
    auditWarning: audit.ok
      ? null
      : "Stock Control loaded, but the usage entry could not be added to the Admin Portal audit log.",
  });
}

export async function GET() {
  return handleStockHomeRequest({
    action: "open",
    route: STOCK_HOME_ROUTE,
    page: "Stock Control Home",
  });
}

export async function POST(request: Request) {
  let body: StockHomeRequestBody = {};

  try {
    const text = await request.text();
    body = text ? (JSON.parse(text) as StockHomeRequestBody) : {};
  } catch {
    return json(
      {
        ok: false,
        error: "Invalid JSON",
        message: "The Stock Control home API received invalid JSON.",
      },
      400,
    );
  }

  return handleStockHomeRequest(body);
}
