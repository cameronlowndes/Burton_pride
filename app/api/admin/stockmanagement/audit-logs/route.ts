import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import {
  writeStockAuditLog,
  type StockAuditRisk,
  type StockAuditStatus,
} from "@/lib/stockManagement/writeStockAuditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminIdentity = {
  id?: string | null;
  name?: string | null;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  is_main_admin?: boolean | null;
};

type AuditCreateBody = {
  actionKey?: unknown;
  action?: unknown;
  actionLabel?: unknown;
  actionCategory?: unknown;
  module?: unknown;
  status?: unknown;
  riskLevel?: unknown;

  description?: unknown;
  summary?: unknown;
  reason?: unknown;
  notes?: unknown;

  recordType?: unknown;
  recordId?: unknown;
  recordName?: unknown;
  recordReference?: unknown;

  stockItemId?: unknown;
  stockItemName?: unknown;
  stockItemSku?: unknown;

  locationId?: unknown;
  locationName?: unknown;
  fromLocationId?: unknown;
  fromLocationName?: unknown;
  toLocationId?: unknown;
  toLocationName?: unknown;

  supplierId?: unknown;
  supplierName?: unknown;

  movementId?: unknown;
  movementType?: unknown;
  quantityBefore?: unknown;
  quantityAfter?: unknown;
  quantityChanged?: unknown;

  beforeData?: unknown;
  afterData?: unknown;
  changedFields?: unknown;
  metadata?: unknown;

  responseStatus?: unknown;
  durationMs?: unknown;
  errorCode?: unknown;
  errorMessage?: unknown;
  errorDetails?: unknown;
  errorHint?: unknown;
  apiEndpoint?: unknown;
  requestId?: unknown;
};

const ALLOWED_STATUSES = new Set<StockAuditStatus>([
  "success",
  "failed",
  "blocked",
  "warning",
  "pending",
  "cancelled",
]);

const ALLOWED_RISKS = new Set<StockAuditRisk>([
  "low",
  "medium",
  "high",
  "critical",
]);

const ALLOWED_SORTS = new Set([
  "newest",
  "oldest",
  "risk",
  "failed",
  "admin",
  "action",
  "module",
]);

const ALLOWED_ACTION_CATEGORIES = new Set([
  "create",
  "update",
  "delete",
  "move",
  "adjust",
  "export",
  "security",
  "system",
  "other",
]);

const ALLOWED_RECORD_TYPES = new Set([
  "stock_item",
  "stock_movement",
  "stock_location",
  "inventory_report",
  "stock_report",
  "supplier",
]);

const ALLOWED_POST_ACTIONS = new Set([
  "stock.item.created",
  "stock.item.updated",
  "stock.item.deleted",
  "stock.item.test_created",
  "stock.quantity.adjusted",
  "stock.location.moved",
  "stock.report.exported",

  "stock_item_created",
  "stock_item_updated",
  "stock_item_deleted",
  "test_stock_item_created",
  "stock_quantity_adjusted",
  "stock_location_moved",
  "inventory_report_exported",
]);

function clean(value: unknown, maxLength = 2_000) {
  const result = String(value ?? "").trim();
  return result ? result.slice(0, maxLength) : "";
}

function nullableClean(value: unknown, maxLength = 2_000) {
  const result = clean(value, maxLength);
  return result || null;
}

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : fallback;
}

function optionalInteger(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);

  return Number.isInteger(parsed) ? parsed : null;
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function safeDate(value: string | null) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString();
}

function safeObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function safeChangedFields(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((field) => clean(field, 250))
      .filter(Boolean);
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .map((field) => clean(field, 250))
      .filter(Boolean);
  }

  return [];
}

function escapeSearchTerm(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_")
    .replaceAll(",", " ");
}

function riskRank(value: string) {
  if (value === "critical") return 4;
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function adminCanViewAudit(admin: AdminIdentity) {
  const role = clean(admin.role).toLowerCase();

  return (
    Boolean(admin.is_main_admin) ||
    role === "main_admin" ||
    role === "main admin" ||
    role === "admin"
  );
}

function adminCanCreateAudit(admin: AdminIdentity) {
  const role = clean(admin.role).toLowerCase();

  return Boolean(
    admin.id ||
    admin.email ||
    admin.is_main_admin ||
    role === "main_admin" ||
    role === "main admin" ||
    role === "admin" ||
    role === "editor",
  );
}

function inferActionCategory(actionKey: string) {
  const action = actionKey.toLowerCase();

  if (action.includes("created") || action.includes("create")) return "create";
  if (action.includes("deleted") || action.includes("delete")) return "delete";
  if (action.includes("moved") || action.includes("move")) return "move";
  if (action.includes("adjusted") || action.includes("quantity")) return "adjust";
  if (action.includes("exported") || action.includes("export")) return "export";
  if (action.includes("updated") || action.includes("update")) return "update";

  return "other";
}

function inferModule(actionKey: string) {
  const action = actionKey.toLowerCase();

  if (action.includes("location") || action.includes("moved")) {
    return "locations";
  }

  if (action.includes("report") || action.includes("export")) {
    return "reports";
  }

  if (action.includes("quantity") || action.includes("movement")) {
    return "movements";
  }

  return "inventory";
}

function inferRiskLevel(actionKey: string): StockAuditRisk {
  const action = actionKey.toLowerCase();

  if (action.includes("deleted") || action.includes("delete")) return "high";
  if (action.includes("move") || action.includes("adjust")) return "medium";

  return "low";
}

function normalisePostAction(rawAction: string) {
  const aliases: Record<string, string> = {
    "stock.item.created": "stock_item_created",
    "stock.item.updated": "stock_item_updated",
    "stock.item.deleted": "stock_item_deleted",
    "stock.item.test_created": "test_stock_item_created",
    "stock.quantity.adjusted": "stock_quantity_adjusted",
    "stock.location.moved": "stock_location_moved",
    "stock.report.exported": "inventory_report_exported",
  };

  return aliases[rawAction] || rawAction;
}

function actionLabelFallback(actionKey: string) {
  const labels: Record<string, string> = {
    stock_item_created: "Stock item created",
    stock_item_updated: "Stock item updated",
    stock_item_deleted: "Stock item deleted",
    test_stock_item_created: "Test stock item created",
    stock_quantity_adjusted: "Stock quantity adjusted",
    stock_location_moved: "Stock moved",
    inventory_report_exported: "Inventory report exported",
  };

  return labels[actionKey] || actionKey.replaceAll("_", " ");
}

function normaliseAdmin(admin: AdminIdentity) {
  return {
    id: admin.id || null,
    name:
      nullableClean(admin.name, 250) ||
      nullableClean(admin.full_name, 250) ||
      nullableClean(admin.email, 250),
    email: admin.email || null,
    role: admin.role || null,
  };
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  try {
    const admin = (await getCurrentAdmin()) as AdminIdentity | null;

    if (!admin) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorised. Sign in as an administrator.",
        },
        { status: 401 },
      );
    }

    if (!adminCanCreateAudit(admin)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Your administrator account cannot create Stock Management audit entries.",
        },
        { status: 403 },
      );
    }

    const body = (await request.json().catch(() => null)) as
      | AuditCreateBody
      | null;

    if (!body) {
      return NextResponse.json(
        {
          ok: false,
          error: "A valid JSON audit payload is required.",
        },
        { status: 400 },
      );
    }

    const suppliedAction = clean(body.actionKey || body.action, 160);

    if (!suppliedAction) {
      return NextResponse.json(
        {
          ok: false,
          error: "An audit action key is required.",
          field: "actionKey",
        },
        { status: 400 },
      );
    }

    if (!ALLOWED_POST_ACTIONS.has(suppliedAction)) {
      return NextResponse.json(
        {
          ok: false,
          error: `The Stock Management audit action "${suppliedAction}" is not allowed.`,
          field: "actionKey",
        },
        { status: 400 },
      );
    }

    const actionKey = normalisePostAction(suppliedAction);

    const suppliedStatus = clean(body.status, 40).toLowerCase();
    const status: StockAuditStatus = ALLOWED_STATUSES.has(
      suppliedStatus as StockAuditStatus,
    )
      ? (suppliedStatus as StockAuditStatus)
      : "success";

    const suppliedRisk = clean(body.riskLevel, 40).toLowerCase();
    const riskLevel: StockAuditRisk = ALLOWED_RISKS.has(
      suppliedRisk as StockAuditRisk,
    )
      ? (suppliedRisk as StockAuditRisk)
      : inferRiskLevel(actionKey);

    const suppliedCategory = clean(body.actionCategory, 60).toLowerCase();
    const actionCategory = ALLOWED_ACTION_CATEGORIES.has(suppliedCategory)
      ? suppliedCategory
      : inferActionCategory(actionKey);

    const moduleName =
      clean(body.module, 100).toLowerCase() ||
      inferModule(actionKey);

    const recordTypeValue = clean(body.recordType, 100).toLowerCase();
    const recordType =
      ALLOWED_RECORD_TYPES.has(recordTypeValue)
        ? recordTypeValue
        : actionKey === "inventory_report_exported"
          ? "inventory_report"
          : actionKey === "stock_location_moved"
            ? "stock_movement"
            : "stock_item";

    const actionLabel =
      clean(body.actionLabel, 250) ||
      actionLabelFallback(actionKey);

    const description =
      clean(body.description || body.summary, 4_000) ||
      `${actionLabel} in Stock Management.`;

    const responseStatus =
      optionalInteger(body.responseStatus) ??
      (status === "success" ? 201 : 500);

    const durationMs =
      optionalInteger(body.durationMs) ??
      (Date.now() - startedAt);

    const beforeData = safeObject(body.beforeData);
    const afterData = safeObject(body.afterData);
    const changedFields = safeChangedFields(body.changedFields);

    const metadata: Record<string, unknown> = {
      ...(safeObject(body.metadata) || {}),
      source: "stock_management_client",
      fromLocationId: nullableClean(body.fromLocationId, 250),
      fromLocationName: nullableClean(body.fromLocationName, 500),
      toLocationId: nullableClean(body.toLocationId, 250),
      toLocationName: nullableClean(body.toLocationName, 500),
    };

    const errorPayload =
      body.errorCode || body.errorMessage || body.errorDetails || body.errorHint
        ? {
            code: nullableClean(body.errorCode, 250),
            message: nullableClean(body.errorMessage, 4_000),
            details: nullableClean(body.errorDetails, 4_000),
            hint: nullableClean(body.errorHint, 4_000),
          }
        : undefined;

    const auditResult = await writeStockAuditLog({
      actionKey,
      actionLabel,
      actionCategory,
      module: moduleName,
      status,
      riskLevel,
      admin: normaliseAdmin(admin),

      description,
      reason: nullableClean(body.reason, 4_000),
      notes: nullableClean(body.notes, 4_000),

      recordType,
      recordId: nullableClean(body.recordId, 250),
      recordName:
        nullableClean(body.recordName, 500) ||
        nullableClean(body.stockItemName, 500),
      recordReference:
        nullableClean(body.recordReference, 500) ||
        nullableClean(body.stockItemSku, 250),

      stockItemId:
        nullableClean(body.stockItemId, 250) ||
        nullableClean(body.recordId, 250),
      stockItemName:
        nullableClean(body.stockItemName, 500) ||
        nullableClean(body.recordName, 500),
      stockItemSku:
        nullableClean(body.stockItemSku, 250) ||
        nullableClean(body.recordReference, 250),

      locationId: nullableClean(body.locationId, 250),
      locationName: nullableClean(body.locationName, 500),

      sourceLocationId: nullableClean(body.fromLocationId, 250),
      sourceLocationName: nullableClean(body.fromLocationName, 500),
      destinationLocationId: nullableClean(body.toLocationId, 250),
      destinationLocationName: nullableClean(body.toLocationName, 500),

      supplierId: nullableClean(body.supplierId, 250),
      supplierName: nullableClean(body.supplierName, 500),

      movementId: nullableClean(body.movementId, 250),
      movementType: nullableClean(body.movementType, 100),
      quantityBefore: optionalNumber(body.quantityBefore),
      quantityAfter: optionalNumber(body.quantityAfter),
      quantityChange: optionalNumber(body.quantityChanged),

      oldValues: beforeData,
      newValues: afterData,
      changedFields,

      request,
      responseStatus,
      durationMs,
      apiEndpoint:
        nullableClean(body.apiEndpoint, 1_000) ||
        request.nextUrl.pathname,
      requestId:
        nullableClean(body.requestId, 250) ||
        request.headers.get("x-request-id") ||
        request.headers.get("x-vercel-id") ||
        crypto.randomUUID(),
      error: errorPayload,
      metadata,
    });

    if (!auditResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "The Stock Management audit entry could not be saved.",
          details:
            auditResult.error instanceof Error
              ? auditResult.error.message
              : String(auditResult.error || ""),
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Stock Management audit entry created.",
        auditId: auditResult.id,
        requestId: auditResult.requestId,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Stock Management audit POST failed", error);

    const databaseError = error as {
      code?: string;
      message?: string;
      details?: string | null;
      hint?: string | null;
    };

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : databaseError?.message ||
              "The Stock Management audit entry could not be created.",
        code: databaseError?.code,
        details: databaseError?.details || null,
        hint: databaseError?.hint || null,
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const admin = (await getCurrentAdmin()) as AdminIdentity | null;

  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Unauthorised" },
      { status: 401 },
    );
  }

  if (!adminCanViewAudit(admin)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Main administrator or administrator access is required to view stock audit logs.",
      },
      { status: 403 },
    );
  }

  const params = request.nextUrl.searchParams;

  const search = clean(params.get("search"));
  const moduleName = clean(params.get("module"));
  const action = clean(params.get("action"));
  const status = clean(params.get("status"));
  const risk = clean(params.get("risk"));
  const adminId = clean(params.get("adminId"));
  const recordType = clean(params.get("recordType"));
  const recordId = clean(params.get("recordId"));
  const dateFrom = safeDate(params.get("dateFrom"));
  const dateTo = safeDate(params.get("dateTo"));

  const requestedSort = clean(params.get("sort"));

  const sort = ALLOWED_SORTS.has(requestedSort)
    ? requestedSort
    : "newest";

  const page = positiveInteger(params.get("page"), 1);
  const pageSize = Math.min(
    positiveInteger(params.get("pageSize"), 50),
    200,
  );

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabaseAdmin
    .from("stock_audit_logs")
    .select("*", { count: "exact" });

  if (moduleName && moduleName !== "all") {
    query = query.eq("module", moduleName);
  }

  if (action && action !== "all") {
    query = query.eq("action_key", action);
  }

  if (
    status &&
    status !== "all" &&
    ALLOWED_STATUSES.has(status as StockAuditStatus)
  ) {
    query = query.eq("status", status);
  }

  if (
    risk &&
    risk !== "all" &&
    ALLOWED_RISKS.has(risk as StockAuditRisk)
  ) {
    query = query.eq("risk_level", risk);
  }

  if (adminId && adminId !== "all") {
    query = query.eq("admin_id", adminId);
  }

  if (recordType && recordType !== "all") {
    query = query.eq("record_type", recordType);
  }

  if (recordId) {
    query = query.eq("record_id", recordId);
  }

  if (dateFrom) {
    query = query.gte("occurred_at", dateFrom);
  }

  if (dateTo) {
    query = query.lte("occurred_at", dateTo);
  }

  if (search) {
    const term = escapeSearchTerm(search);

    query = query.or(
      [
        `admin_name.ilike.%${term}%`,
        `admin_email.ilike.%${term}%`,
        `action_label.ilike.%${term}%`,
        `action_key.ilike.%${term}%`,
        `module.ilike.%${term}%`,
        `record_name.ilike.%${term}%`,
        `record_reference.ilike.%${term}%`,
        `stock_item_name.ilike.%${term}%`,
        `stock_item_sku.ilike.%${term}%`,
        `location_name.ilike.%${term}%`,
        `supplier_name.ilike.%${term}%`,
        `description.ilike.%${term}%`,
        `reason.ilike.%${term}%`,
        `notes.ilike.%${term}%`,
        `error_code.ilike.%${term}%`,
        `error_message.ilike.%${term}%`,
        `api_endpoint.ilike.%${term}%`,
        `request_id.ilike.%${term}%`,
      ].join(","),
    );
  }

  if (sort === "oldest") {
    query = query.order("occurred_at", { ascending: true });
  } else if (sort === "admin") {
    query = query
      .order("admin_name", { ascending: true })
      .order("occurred_at", { ascending: false });
  } else if (sort === "action") {
    query = query
      .order("action_label", { ascending: true })
      .order("occurred_at", { ascending: false });
  } else if (sort === "module") {
    query = query
      .order("module", { ascending: true })
      .order("occurred_at", { ascending: false });
  } else if (sort === "failed") {
    query = query
      .order("status", { ascending: true })
      .order("occurred_at", { ascending: false });
  } else {
    query = query.order("occurred_at", { ascending: false });
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Audit logs could not be loaded",
        code: error.code,
        details: error.details,
        hint: error.hint,
      },
      { status: 500 },
    );
  }

  let logs = Array.isArray(data) ? data : [];

  if (sort === "risk") {
    logs = [...logs].sort(
      (left, right) =>
        riskRank(String(right.risk_level)) -
          riskRank(String(left.risk_level)) ||
        new Date(String(right.occurred_at)).getTime() -
          new Date(String(left.occurred_at)).getTime(),
    );
  }

  const totalRows = Number(count || 0);
  const totalPages = Math.max(
    1,
    Math.ceil(totalRows / pageSize),
  );

  const summary = {
    totalActions: totalRows,
    successful: logs.filter(
      (log) => log.status === "success",
    ).length,
    failed: logs.filter(
      (log) => log.status === "failed",
    ).length,
    blocked: logs.filter(
      (log) => log.status === "blocked",
    ).length,
    activeAdmins: new Set(
      logs
        .map((log) => log.admin_id || log.admin_email)
        .filter(Boolean),
    ).size,
    highRisk: logs.filter(
      (log) =>
        log.risk_level === "high" ||
        log.risk_level === "critical",
    ).length,
  };

  const [adminsResult, modulesResult, actionsResult] =
    await Promise.all([
      supabaseAdmin
        .from("stock_audit_logs")
        .select("admin_id, admin_name, admin_email")
        .not("admin_email", "is", null)
        .order("admin_name", { ascending: true })
        .limit(500),

      supabaseAdmin
        .from("stock_audit_logs")
        .select("module")
        .not("module", "is", null)
        .limit(500),

      supabaseAdmin
        .from("stock_audit_logs")
        .select("action_key, action_label")
        .not("action_key", "is", null)
        .limit(1_000),
    ]);

  const admins = Array.from(
    new Map(
      (adminsResult.data || []).map((row) => [
        row.admin_id || row.admin_email,
        row,
      ]),
    ).values(),
  );

  const modules = Array.from(
    new Set(
      (modulesResult.data || [])
        .map((row) => clean(row.module))
        .filter(Boolean),
    ),
  ).sort();

  const actions = Array.from(
    new Map(
      (actionsResult.data || []).map((row) => [
        row.action_key,
        row,
      ]),
    ).values(),
  ).sort((a, b) =>
    clean(a.action_label).localeCompare(
      clean(b.action_label),
    ),
  );

  return NextResponse.json({
    ok: true,
    logs,
    summary,
    filterOptions: {
      admins,
      modules,
      actions,
    },
    pagination: {
      page,
      pageSize,
      totalRows,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  });
}
