import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export type StockAuditStatus =
  | "success"
  | "failed"
  | "blocked"
  | "warning"
  | "pending"
  | "cancelled";

export type StockAuditRisk =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type StockAuditAdmin = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

export type WriteStockAuditLogInput = {
  actionKey: string;
  actionLabel: string;
  actionCategory: string;
  module: string;

  status?: StockAuditStatus;
  riskLevel?: StockAuditRisk;

  admin: StockAuditAdmin;

  permissionKey?: string | null;

  recordType?: string | null;
  recordId?: string | null;
  recordName?: string | null;
  recordReference?: string | null;

  stockItemId?: string | null;
  stockItemName?: string | null;
  stockItemSku?: string | null;

  locationId?: string | null;
  locationName?: string | null;

  sourceLocationId?: string | null;
  sourceLocationName?: string | null;
  destinationLocationId?: string | null;
  destinationLocationName?: string | null;

  supplierId?: string | null;
  supplierName?: string | null;

  movementId?: string | null;
  movementType?: string | null;
  quantityChange?: number | null;
  quantityBefore?: number | null;
  quantityAfter?: number | null;

  orderId?: string | null;
  orderReference?: string | null;

  description?: string | null;
  reason?: string | null;
  notes?: string | null;

  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  changedFields?: string[];

  request?: Request;
  responseStatus?: number | null;
  durationMs?: number | null;
  requestId?: string | null;
  correlationId?: string | null;
  sessionId?: string | null;
  pagePath?: string | null;
  apiEndpoint?: string | null;
  httpMethod?: string | null;

  error?: unknown;
  metadata?: Record<string, unknown>;

  /**
   * When true, throw if the audit insert fails.
   * Use this for critical destructive actions.
   */
  required?: boolean;
};

const SENSITIVE_KEYS = new Set([
  "password",
  "mainadminpassword",
  "main_admin_password",
  "token",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "secret",
  "service_role_key",
  "supabase_service_role_key",
  "authorization",
  "cookie",
  "sessioncookie",
  "session_cookie",
  "twofactorsecret",
  "two_factor_secret",
  "recoverycode",
  "recovery_code",
]);

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(value: unknown) {
  const result = clean(value);
  return result || null;
}

function validUuid(value: unknown) {
  const text = clean(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    text,
  )
    ? text
    : null;
}

function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[MAX_DEPTH_REACHED]";

  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry, depth + 1));
  }

  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(
      value as Record<string, unknown>,
    )) {
      const normalisedKey = key.replace(/[^a-z0-9_]/gi, "").toLowerCase();

      result[key] = SENSITIVE_KEYS.has(normalisedKey)
        ? "[REDACTED]"
        : redactValue(entry, depth + 1);
    }

    return result;
  }

  if (typeof value === "string" && value.length > 5000) {
    return `${value.slice(0, 5000)}…`;
  }

  return value;
}

function errorDetails(error: unknown) {
  if (!error) {
    return {
      code: null,
      message: null,
      details: null,
      hint: null,
    };
  }

  if (error instanceof Error) {
    const candidate = error as Error & {
      code?: string;
      details?: string;
      hint?: string;
      cause?: unknown;
    };

    return {
      code: nullableText(candidate.code),
      message: nullableText(candidate.message),
      details: nullableText(candidate.details),
      hint: nullableText(candidate.hint),
    };
  }

  if (typeof error === "object") {
    const candidate = error as Record<string, unknown>;

    return {
      code: nullableText(candidate.code),
      message:
        nullableText(candidate.message) ||
        nullableText(candidate.error) ||
        "Unknown server error",
      details: nullableText(candidate.details),
      hint: nullableText(candidate.hint),
    };
  }

  return {
    code: null,
    message: nullableText(error),
    details: null,
    hint: null,
  };
}

function requestDetails(request?: Request) {
  if (!request) {
    return {
      endpoint: null,
      method: null,
      pagePath: null,
      userAgent: null,
      ipAddress: null,
    };
  }

  let endpoint: string | null = null;

  try {
    const url = new URL(request.url);
    endpoint = `${url.pathname}${url.search}`;
  } catch {
    endpoint = null;
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  const ipAddress =
    forwardedFor?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    null;

  return {
    endpoint,
    method: request.method || null,
    pagePath:
      request.headers.get("referer") ||
      request.headers.get("x-page-path") ||
      null,
    userAgent: request.headers.get("user-agent"),
    ipAddress,
  };
}

function inferDevice(userAgent: string | null) {
  const value = (userAgent || "").toLowerCase();

  if (!value) {
    return {
      deviceType: null,
      browserName: null,
      operatingSystem: null,
    };
  }

  const deviceType = /mobile|android|iphone|ipad/.test(value)
    ? "mobile"
    : "desktop";

  const browserName = value.includes("edg/")
    ? "Microsoft Edge"
    : value.includes("firefox/")
      ? "Firefox"
      : value.includes("chrome/")
        ? "Chrome"
        : value.includes("safari/")
          ? "Safari"
          : "Other";

  const operatingSystem = value.includes("windows")
    ? "Windows"
    : value.includes("mac os")
      ? "macOS"
      : value.includes("android")
        ? "Android"
        : value.includes("iphone") || value.includes("ipad")
          ? "iOS"
          : value.includes("linux")
            ? "Linux"
            : "Other";

  return {
    deviceType,
    browserName,
    operatingSystem,
  };
}


type AdminDatabaseRow = Record<string, unknown>;

function firstUsefulText(
  row: AdminDatabaseRow,
  keys: string[],
) {
  for (const key of keys) {
    const value = nullableText(row[key]);

    if (value) return value;
  }

  return null;
}

function buildAdminDisplayName(row: AdminDatabaseRow) {
  const directName = firstUsefulText(row, [
    "name",
    "full_name",
    "display_name",
    "admin_name",
    "preferred_name",
    "username",
  ]);

  if (directName) return directName;

  const firstName = firstUsefulText(row, [
    "first_name",
    "firstname",
    "given_name",
  ]);
  const lastName = firstUsefulText(row, [
    "last_name",
    "lastname",
    "family_name",
    "surname",
  ]);

  const combinedName = [firstName, lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return combinedName || null;
}

async function resolveAuditAdmin(
  admin: StockAuditAdmin,
): Promise<StockAuditAdmin> {
  const suppliedName = nullableText(admin.name);
  const suppliedEmail = nullableText(admin.email);
  const suppliedRole = nullableText(admin.role);
  const suppliedId = validUuid(admin.id);

  if (suppliedName) {
    return {
      id: suppliedId,
      name: suppliedName,
      email: suppliedEmail,
      role: suppliedRole,
    };
  }

  let query = supabaseAdmin
    .from("admin_users")
    .select("*")
    .limit(1);

  if (suppliedId) {
    query = query.eq("id", suppliedId);
  } else if (suppliedEmail) {
    query = query.ilike("email", suppliedEmail);
  } else {
    return {
      id: suppliedId,
      name: null,
      email: suppliedEmail,
      role: suppliedRole,
    };
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error(
      "Could not resolve admin name for stock audit log:",
      error,
    );

    return {
      id: suppliedId,
      name: null,
      email: suppliedEmail,
      role: suppliedRole,
    };
  }

  const row = (data || {}) as AdminDatabaseRow;

  return {
    id:
      validUuid(row.id) ||
      validUuid(row.admin_id) ||
      suppliedId,
    name: buildAdminDisplayName(row),
    email:
      firstUsefulText(row, [
        "email",
        "admin_email",
        "user_email",
      ]) || suppliedEmail,
    role:
      firstUsefulText(row, [
        "role",
        "admin_role",
        "user_role",
      ]) || suppliedRole,
  };
}

export async function writeStockAuditLog(
  input: WriteStockAuditLogInput,
) {
  const request = requestDetails(input.request);
  const device = inferDevice(request.userAgent);
  const error = errorDetails(input.error);
  const resolvedAdmin = await resolveAuditAdmin(input.admin);

  const fallbackAdminName = resolvedAdmin.email
    ? resolvedAdmin.email.split("@")[0]?.trim() || null
    : null;

  const payload = {
    action_key: clean(input.actionKey),
    action_label: clean(input.actionLabel),
    action_category: clean(input.actionCategory),
    module: clean(input.module),

    status: input.status || "success",
    risk_level: input.riskLevel || "low",

    description: nullableText(input.description),
    reason: nullableText(input.reason),
    notes: nullableText(input.notes),

    admin_id: validUuid(resolvedAdmin.id),
    admin_name:
      nullableText(resolvedAdmin.name) ||
      nullableText(fallbackAdminName),
    admin_email: nullableText(resolvedAdmin.email),
    admin_role: nullableText(resolvedAdmin.role),
    permission_key: nullableText(input.permissionKey),

    record_type: nullableText(input.recordType),
    record_id: validUuid(input.recordId),
    record_name: nullableText(input.recordName),
    record_reference: nullableText(input.recordReference),

    stock_item_id: validUuid(input.stockItemId),
    stock_item_name: nullableText(input.stockItemName),
    stock_item_sku: nullableText(input.stockItemSku),

    location_id: validUuid(input.locationId),
    location_name: nullableText(input.locationName),

    source_location_id: validUuid(input.sourceLocationId),
    source_location_name: nullableText(input.sourceLocationName),
    destination_location_id: validUuid(input.destinationLocationId),
    destination_location_name: nullableText(
      input.destinationLocationName,
    ),

    supplier_id: validUuid(input.supplierId),
    supplier_name: nullableText(input.supplierName),

    movement_id: validUuid(input.movementId),
    movement_type: nullableText(input.movementType),
    quantity_change:
      typeof input.quantityChange === "number"
        ? input.quantityChange
        : null,
    quantity_before:
      typeof input.quantityBefore === "number"
        ? input.quantityBefore
        : null,
    quantity_after:
      typeof input.quantityAfter === "number"
        ? input.quantityAfter
        : null,

    order_id: validUuid(input.orderId),
    order_reference: nullableText(input.orderReference),

    old_values: input.oldValues
      ? redactValue(input.oldValues)
      : null,
    new_values: input.newValues
      ? redactValue(input.newValues)
      : null,
    changed_fields: Array.isArray(input.changedFields)
      ? input.changedFields.map(clean).filter(Boolean)
      : [],

    request_id:
      nullableText(input.requestId) ||
      input.request?.headers.get("x-request-id") ||
      randomUUID(),
    correlation_id: nullableText(input.correlationId),
    session_id: nullableText(input.sessionId),

    page_path:
      nullableText(input.pagePath) ||
      nullableText(request.pagePath),
    api_endpoint:
      nullableText(input.apiEndpoint) ||
      nullableText(request.endpoint),
    http_method:
      nullableText(input.httpMethod) ||
      nullableText(request.method),
    http_status:
      typeof input.responseStatus === "number"
        ? input.responseStatus
        : null,
    duration_ms:
      typeof input.durationMs === "number"
        ? Math.max(0, Math.round(input.durationMs))
        : null,

    ip_address: nullableText(request.ipAddress),
    user_agent: nullableText(request.userAgent),
    device_type: device.deviceType,
    browser_name: device.browserName,
    operating_system: device.operatingSystem,

    error_code: error.code,
    error_message: error.message,
    error_details: error.details,
    error_hint: error.hint,

    metadata: redactValue(input.metadata || {}),
  };

  if (
    !payload.action_key ||
    !payload.action_label ||
    !payload.action_category ||
    !payload.module
  ) {
    const configurationError = new Error(
      "Audit log requires actionKey, actionLabel, actionCategory and module.",
    );

    if (input.required) throw configurationError;

    console.error(configurationError);
    return { ok: false as const, error: configurationError };
  }

  const { data, error: insertError } = await supabaseAdmin
    .from("stock_audit_logs")
    .insert(payload)
    .select("id")
    .single();

  if (insertError) {
    console.error("Stock audit insert failed:", insertError);

    if (input.required) {
      throw new Error(
        `Critical stock audit insert failed: ${insertError.message}`,
      );
    }

    return { ok: false as const, error: insertError };
  }

  return {
    ok: true as const,
    id: data.id as string,
    requestId: payload.request_id,
  };
}
