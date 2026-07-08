import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";

/**
 * It will try admin_audit_logs first.
 * If that table does not exist, it will try admin_money_audit_logs.
 */
const AUDIT_LOG_TABLES = ["admin_audit_logs", "admin_money_audit_logs"] as const;

type AdminRow = {
  id: string;
  email: string | null;
  role: string | null;
  is_active: boolean | null;
  permissions: unknown;
};

type AdminLookupResult =
  | {
      admin: AdminRow;
      response: null;
    }
  | {
      admin: null;
      response: NextResponse;
    };

type ErrorPayload = {
  ok: false;
  error: string;
  code: string;
  status: number;
  hint?: string;
  suggestion?: string;
  details?: unknown;
  request_id: string;
};

type AuditLogRow = Record<string, unknown>;

function makeRequestId() {
  return randomUUID();
}

function errorResponse(
  status: number,
  code: string,
  error: string,
  options?: {
    hint?: string;
    suggestion?: string;
    details?: unknown;
    requestId?: string;
  }
) {
  const payload: ErrorPayload = {
    ok: false,
    error,
    code,
    status,
    request_id: options?.requestId || makeRequestId(),
  };

  if (options?.hint) payload.hint = options.hint;
  if (options?.suggestion) payload.suggestion = options.suggestion;
  if (options?.details) payload.details = options.details;

  return NextResponse.json(payload, { status });
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function lower(value: unknown) {
  return clean(value).toLowerCase();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function normaliseRole(value: unknown) {
  return lower(value).replaceAll("-", "_").replace(/\s+/g, "_");
}

function normaliseLimit(value: string | null) {
  const parsed = Number.parseInt(value || "150", 10);

  if (!Number.isFinite(parsed)) return 150;
  if (parsed < 1) return 1;
  if (parsed > 500) return 500;

  return parsed;
}

function getIpAddress(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    null
  );
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

function parsePermissions(permissions: unknown): unknown {
  if (!permissions) return null;

  if (typeof permissions === "string") {
    try {
      return JSON.parse(permissions);
    } catch {
      return permissions;
    }
  }

  return permissions;
}

function hasPermission(permissionsValue: unknown, key: string) {
  const permissions = parsePermissions(permissionsValue);

  if (!permissions) return false;

  if (Array.isArray(permissions)) {
    return permissions.includes(key);
  }

  if (typeof permissions !== "object") {
    return false;
  }

  const record = permissions as Record<string, unknown>;

  const directValue = record[key];

  if (
    directValue === true ||
    directValue === "true" ||
    directValue === "yes" ||
    directValue === 1
  ) {
    return true;
  }

  /**
   * Also supports nested permissions like:
   * {
   *   audit_logs: {
   *     view: true
   *   }
   * }
   */
  const [area, action] = key.split(":");

  if (area && action) {
    const nested = record[area];

    if (nested && typeof nested === "object") {
      const nestedRecord = nested as Record<string, unknown>;
      const nestedValue = nestedRecord[action];

      return (
        nestedValue === true ||
        nestedValue === "true" ||
        nestedValue === "yes" ||
        nestedValue === 1
      );
    }
  }

  return false;
}

async function findAdminById(adminId: string) {
  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("id, email, role, is_active, permissions")
    .eq("id", adminId)
    .limit(1)
    .maybeSingle();

  return {
    data: data as AdminRow | null,
    error,
  };
}

async function findAdminByEmail(adminEmail: string) {
  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("id, email, role, is_active, permissions")
    .ilike("email", adminEmail)
    .limit(1)
    .maybeSingle();

  return {
    data: data as AdminRow | null,
    error,
  };
}

async function getCurrentAdmin(
  request: NextRequest,
  requestId: string
): Promise<AdminLookupResult> {
  const adminIdCookie = clean(request.cookies.get("burton_admin_id")?.value);
  const adminEmailCookie = lower(
    request.cookies.get("burton_admin_email")?.value
  );

  const hasAdminId = adminIdCookie && isUuid(adminIdCookie);
  const hasAdminEmail = Boolean(adminEmailCookie);

  if (!hasAdminId && !hasAdminEmail) {
    return {
      admin: null,
      response: errorResponse(
        401,
        "AUTH_MISSING_ADMIN_COOKIE",
        "You are not logged in to the admin portal.",
        {
          requestId,
          hint:
            "The audit API could not find a valid burton_admin_id or burton_admin_email cookie.",
          suggestion:
            "Log out, log back in, then reopen the audit logs page. Also check that the login API is setting burton_admin_id and burton_admin_email.",
          details: {
            has_burton_admin_id_cookie: Boolean(adminIdCookie),
            burton_admin_id_looks_valid_uuid: hasAdminId,
            has_burton_admin_email_cookie: hasAdminEmail,
          },
        }
      ),
    };
  }

  let admin: AdminRow | null = null;
  let lookupError: unknown = null;

  if (hasAdminId) {
    const result = await findAdminById(adminIdCookie);
    admin = result.data;
    lookupError = result.error;
  }

  /**
   * Fallback to email if ID is stale or missing.
   * This helps when old cookies point to an old admin_users row.
   */
  if (!admin && hasAdminEmail) {
    const result = await findAdminByEmail(adminEmailCookie);
    admin = result.data;
    lookupError = result.error;
  }

  if (lookupError) {
    const details = getSupabaseDetails(
      lookupError as {
        code?: string | null;
        message?: string | null;
        details?: string | null;
        hint?: string | null;
      }
    );

    console.error("Audit API current admin lookup failed:", {
      requestId,
      ...details,
    });

    return {
      admin: null,
      response: errorResponse(
        500,
        "ADMIN_LOOKUP_FAILED",
        "The audit API could not check your admin account.",
        {
          requestId,
          hint:
            "This usually means the admin_users table schema does not match what this route is selecting.",
          suggestion:
            "Make sure admin_users has these columns: id, email, role, is_active, permissions. Do not select is_main_admin because that column does not exist.",
          details,
        }
      ),
    };
  }

  if (!admin) {
    return {
      admin: null,
      response: errorResponse(
        401,
        "ADMIN_NOT_FOUND",
        "Your admin account could not be found.",
        {
          requestId,
          hint:
            "The API found your admin cookie, but no matching row exists in admin_users.",
          suggestion:
            "Check Supabase admin_users and make sure your email exists. Then log out and log back in so the cookies refresh.",
          details: {
            cookie_admin_id: adminIdCookie || null,
            cookie_admin_email: adminEmailCookie || null,
          },
        }
      ),
    };
  }

  if (admin.is_active === false) {
    return {
      admin: null,
      response: errorResponse(
        403,
        "ADMIN_INACTIVE",
        "Your admin account is inactive.",
        {
          requestId,
          hint: `The admin_users row exists, but is_active is false for ${
            admin.email || admin.id
          }.`,
          suggestion:
            "A main admin needs to reactivate this account before it can view audit logs.",
        }
      ),
    };
  }

  return {
    admin,
    response: null,
  };
}

function toStringOrNull(value: unknown) {
  const text = clean(value);
  return text || null;
}

function normaliseRisk(value: unknown) {
  const risk = lower(value);

  if (
    risk === "low" ||
    risk === "medium" ||
    risk === "high" ||
    risk === "critical"
  ) {
    return risk;
  }

  return "low";
}

function normaliseAuditLog(row: AuditLogRow, index: number) {
  return {
    id:
      toStringOrNull(row.id) ||
      `${toStringOrNull(row.created_at) || "audit"}-${index}`,
    created_at:
      toStringOrNull(row.created_at) || new Date(0).toISOString(),

    admin_email: toStringOrNull(row.admin_email || row.email),
    admin_name: toStringOrNull(row.admin_name || row.name),
    admin_role: toStringOrNull(row.admin_role || row.role),

    action: toStringOrNull(row.action) || "unknown_action",
    area: toStringOrNull(row.area) || "unknown",
    route: toStringOrNull(row.route || row.path),
    method: toStringOrNull(row.method),
    status: toStringOrNull(row.status) || "unknown",
    risk_level: normaliseRisk(row.risk_level),

    target_type: toStringOrNull(row.target_type),
    target_id: toStringOrNull(row.target_id),
    target_label: toStringOrNull(row.target_label),

    ip_address: toStringOrNull(row.ip_address),
    user_agent: toStringOrNull(row.user_agent),

    metadata:
      row.metadata && typeof row.metadata === "object"
        ? row.metadata
        : null,
  };
}

async function readAuditLogsFromTable(options: {
  table: string;
  limit: number;
  risk: string;
  area: string;
}) {
  let query = supabaseAdmin.from(options.table).select("*");

  /**
   * Important:
   * Filters must be added BEFORE order() and limit().
   * Calling .eq() after .limit() can cause TypeScript/build issues.
   */
  if (options.risk) {
    query = query.eq("risk_level", options.risk);
  }

  if (options.area) {
    query = query.eq("area", options.area);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(options.limit);

  return {
    data: Array.isArray(data) ? (data as AuditLogRow[]) : [],
    error,
  };
}

export async function GET(request: NextRequest) {
  const requestId = makeRequestId();

  try {
    const { searchParams } = new URL(request.url);

    const limit = normaliseLimit(searchParams.get("limit"));
    const risk = lower(searchParams.get("risk"));
    const area = lower(searchParams.get("area"));
    const ipAddress = getIpAddress(request);

    const allowedRisks = ["low", "medium", "high", "critical"];

    if (risk && !allowedRisks.includes(risk)) {
      return errorResponse(
        400,
        "INVALID_RISK_FILTER",
        "The risk filter is not valid.",
        {
          requestId,
          hint: `Received risk="${risk}". Allowed values are low, medium, high, critical.`,
          suggestion:
            "Clear the risk filter or use one of the valid risk levels.",
        }
      );
    }

    const adminLookup = await getCurrentAdmin(request, requestId);

    if (adminLookup.response) {
      return adminLookup.response;
    }

    const admin = adminLookup.admin;

    const isMainAdmin = normaliseRole(admin.role) === "main_admin";

    const canViewAuditLogs =
      isMainAdmin || hasPermission(admin.permissions, "audit_logs:view");

    if (!canViewAuditLogs) {
      return errorResponse(
        403,
        "AUDIT_LOGS_PERMISSION_REQUIRED",
        "You do not have permission to view audit logs.",
        {
          requestId,
          hint: `Your current role is "${admin.role || "unknown"}".`,
          suggestion:
            "Give this admin account the audit_logs:view permission, or log in as a main_admin account.",
          details: {
            admin_id: admin.id,
            admin_email: admin.email,
            admin_role: admin.role,
            permissions: admin.permissions,
          },
        }
      );
    }

    let usedTable = "";
    let rows: AuditLogRow[] = [];
    let lastError: unknown = null;

    for (const table of AUDIT_LOG_TABLES) {
      const result = await readAuditLogsFromTable({
        table,
        limit,
        risk,
        area,
      });

      if (!result.error) {
        usedTable = table;
        rows = result.data;
        lastError = null;
        break;
      }

      lastError = result.error;

      /**
       * 42P01 = undefined_table
       * If admin_audit_logs does not exist, try the fallback table.
       */
      const errorCode = (result.error as { code?: string | null }).code;

      if (errorCode !== "42P01") {
        break;
      }
    }

    if (lastError) {
      const details = getSupabaseDetails(
        lastError as {
          code?: string | null;
          message?: string | null;
          details?: string | null;
          hint?: string | null;
        }
      );

      console.error("Audit API log lookup failed:", {
        requestId,
        triedTables: AUDIT_LOG_TABLES,
        ...details,
      });

      return errorResponse(
        500,
        "AUDIT_LOG_LOOKUP_FAILED",
        "The audit logs could not be loaded from Supabase.",
        {
          requestId,
          hint:
            "This normally means the audit log table does not exist, the table name is wrong, or a filtered column is missing.",
          suggestion:
            "Check Supabase and confirm your audit log table is called admin_audit_logs or admin_money_audit_logs. Also check it has created_at, risk_level and area columns if you want filtering to work.",
          details: {
            tried_tables: AUDIT_LOG_TABLES,
            filters: {
              limit,
              risk: risk || null,
              area: area || null,
            },
            requester_ip: ipAddress,
            ...details,
          },
        }
      );
    }

    const logs = rows.map((row, index) => normaliseAuditLog(row, index));

    return NextResponse.json({
      ok: true,
      logs,
      count: logs.length,
      table: usedTable,
      request_id: requestId,
    });
  } catch (error) {
    console.error("Audit API unexpected failure:", {
      requestId,
      error,
    });

    return errorResponse(
      500,
      "AUDIT_API_UNEXPECTED_ERROR",
      "The audit API failed unexpectedly.",
      {
        requestId,
        hint:
          error instanceof Error
            ? error.message
            : "Unknown server error.",
        suggestion:
          "Check the terminal logs for this request ID and confirm the route file compiles.",
      }
    );
  }
}