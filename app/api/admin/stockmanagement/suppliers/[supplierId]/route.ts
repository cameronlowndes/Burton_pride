import { NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STOCK_SUPPLIER_TABLE = "stock_supplier_profiles";
const AUDIT_LOG_TABLE = "admin_audit_logs";

const ALLOWED_SUPPLIER_USES = new Set([
  "stock",
  "service",
  "event_trader",
  "performer",
  "venue",
  "mixed",
]);

const PROFILE_EDITABLE_FIELDS = new Set([
  "display_name",
  "supplier_use",
  "usual_delivery_days",
  "minimum_order_value_pence",
  "usual_delivery_cost_pence",
  "stock_notes",
  "is_active",
  "needs_review",
  "do_not_use",
  "reason",
]);

type RouteContext = {
  params: Promise<{
    supplierId: string;
  }>;
};

type AdminIdentity = {
  id?: string | null;
  email?: string | null;
  name?: string | null;
  full_name?: string | null;
  role?: string | null;
  is_main_admin?: boolean | null;
  permissions?: unknown;
};

type SupplierUpdateBody = {
  display_name?: unknown;
  supplier_use?: unknown;
  usual_delivery_days?: unknown;
  minimum_order_value_pence?: unknown;
  usual_delivery_cost_pence?: unknown;
  stock_notes?: unknown;
  is_active?: unknown;
  needs_review?: unknown;
  do_not_use?: unknown;
  reason?: unknown;

  /*
   * These fields are intentionally recognised but rejected by this route.
   * Link changes must use the dedicated link/unlink APIs so they receive
   * separate validation, permissions and audit events.
   */
  event_record_type?: unknown;
  event_record_id?: unknown;
  money_supplier_id?: unknown;
};

type DeleteBody = {
  reason?: unknown;
  permanent?: unknown;
};

type UnknownRow = Record<string, unknown>;

type ApiErrorLike = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

type AuditLogInput = {
  admin: AdminIdentity;
  action: string;
  actionLabel: string;
  summary: string;
  supplierId: string;
  beforeData?: UnknownRow | null;
  afterData?: UnknownRow | null;
  reason?: string | null;
  httpMethod: "PATCH" | "DELETE";
  riskLevel?: "low" | "medium" | "high" | "critical";
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function nullableText(value: unknown) {
  const cleaned = cleanText(value);
  return cleaned || null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function parseBoolean(value: unknown, fieldName: string) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`${fieldName} must be true or false.`);
}

function parseNullableInteger(
  value: unknown,
  fieldName: string,
  maximum?: number,
) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(
      `${fieldName} must be a whole number of zero or more.`,
    );
  }

  if (maximum !== undefined && parsed > maximum) {
    throw new Error(
      `${fieldName} must not be greater than ${maximum}.`,
    );
  }

  return parsed;
}

function parseNullablePence(
  value: unknown,
  fieldName: string,
) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(
      `${fieldName} must be a non-negative whole amount in pence.`,
    );
  }

  return parsed;
}

function errorStatus(error: unknown) {
  const source = error as ApiErrorLike;
  const code = cleanText(source?.code).toUpperCase();
  const message =
    error instanceof Error ? error.message.toLowerCase() : "";

  if (
    code === "PGRST116" ||
    message.includes("not found") ||
    message.includes("does not exist")
  ) {
    return 404;
  }

  if (
    message.includes("unauthorised") ||
    message.includes("unauthorized") ||
    message.includes("sign in") ||
    message.includes("session")
  ) {
    return 401;
  }

  if (
    message.includes("permission") ||
    message.includes("access denied") ||
    message.includes("main admin")
  ) {
    return 403;
  }

  if (
    code === "23503" ||
    message.includes("foreign key") ||
    message.includes("still linked") ||
    message.includes("linked records")
  ) {
    return 409;
  }

  if (
    code === "23505" ||
    message.includes("already exists") ||
    message.includes("duplicate")
  ) {
    return 409;
  }

  if (
    message.includes("required") ||
    message.includes("must be") ||
    message.includes("invalid") ||
    message.includes("not allowed") ||
    message.includes("unsupported")
  ) {
    return 400;
  }

  return 500;
}

function apiError(
  error: unknown,
  endpoint: string,
  fallback: string,
) {
  const status = errorStatus(error);
  const source = error as ApiErrorLike;

  return NextResponse.json(
    {
      ok: false,
      error:
        error instanceof Error && error.message
          ? error.message
          : fallback,
      code: source?.code || `STOCK_SUPPLIER_${status}`,
      details:
        source?.details ||
        "The Stock Management supplier API could not complete the request.",
      hint:
        source?.hint ||
        "Check the supplier ID, request fields, administrator permissions, Supabase columns and server logs.",
      endpoint,
      status,
    },
    { status },
  );
}

async function readJsonBody<T extends Record<string, unknown>>(
  request: NextRequest,
  {
    allowEmpty = false,
  }: {
    allowEmpty?: boolean;
  } = {},
): Promise<T> {
  const raw = await request.text();

  if (!raw.trim()) {
    if (allowEmpty) {
      return {} as T;
    }

    throw new Error("A JSON request body is required.");
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      throw new Error("The JSON request body must be an object.");
    }

    return parsed as T;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "The JSON request body must be an object."
    ) {
      throw error;
    }

    throw new Error("The request body contains invalid JSON.");
  }
}

async function requireAdmin() {
  const admin =
    (await getCurrentAdmin()) as AdminIdentity | null;

  if (!admin) {
    throw new Error(
      "Unauthorised. Sign in to the Burton Pride Admin Portal.",
    );
  }

  return admin;
}

function adminDisplayName(admin: AdminIdentity) {
  return (
    cleanText(admin.name) ||
    cleanText(admin.full_name) ||
    cleanText(admin.email) ||
    "Admin"
  );
}

function isMainAdmin(admin: AdminIdentity) {
  return (
    admin.is_main_admin === true ||
    cleanText(admin.role).toLowerCase() === "main_admin"
  );
}

function assertNoUnsupportedFields(body: SupplierUpdateBody) {
  const suppliedFields = Object.keys(body);
  const unsupportedFields = suppliedFields.filter(
    (field) => !PROFILE_EDITABLE_FIELDS.has(field),
  );

  if (unsupportedFields.length > 0) {
    throw new Error(
      `Unsupported field${unsupportedFields.length === 1 ? "" : "s"}: ${unsupportedFields.join(
        ", ",
      )}. Event Hub and Money Management links must be changed through their dedicated connection APIs.`,
    );
  }
}

async function getSupplierOrThrow(supplierId: string) {
  const { data, error } = await supabaseAdmin
    .from(STOCK_SUPPLIER_TABLE)
    .select("*")
    .eq("id", supplierId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      "Stock Management supplier was not found.",
    );
  }

  return data as UnknownRow;
}

function changedFields(
  beforeData: UnknownRow,
  afterData: UnknownRow,
) {
  return Object.keys(afterData).filter((key) => {
    if (
      key === "updated_at" ||
      key === "updated_by" ||
      key === "updated_by_name"
    ) {
      return false;
    }

    return JSON.stringify(beforeData[key]) !== JSON.stringify(afterData[key]);
  });
}

function profileAuditAction(
  beforeData: UnknownRow,
  afterData: UnknownRow,
) {
  const fields = changedFields(beforeData, afterData);

  if (
    fields.includes("do_not_use") &&
    afterData.do_not_use === true
  ) {
    return {
      action: "supplier_marked_do_not_use",
      actionLabel: "Supplier marked do not use",
      riskLevel: "high" as const,
    };
  }

  if (
    fields.includes("is_active") &&
    afterData.is_active === false
  ) {
    return {
      action: "stock_supplier_profile_archived",
      actionLabel: "Stock supplier archived",
      riskLevel: "medium" as const,
    };
  }

  return {
    action: "stock_supplier_profile_updated",
    actionLabel: "Stock supplier updated",
    riskLevel: "low" as const,
  };
}

async function writeAuditLog({
  admin,
  action,
  actionLabel,
  summary,
  supplierId,
  beforeData,
  afterData,
  reason,
  httpMethod,
  riskLevel,
}: AuditLogInput) {
  const { error } = await supabaseAdmin
    .from(AUDIT_LOG_TABLE)
    .insert({
      admin_id: admin.id || null,
      admin_name: adminDisplayName(admin),
      admin_email: admin.email || null,
      admin_role: admin.role || null,
      area: "stock_management",
      action,
      action_label: actionLabel,
      status: "success",
      risk_level:
        riskLevel ||
        (httpMethod === "DELETE" ? "high" : "low"),
      summary,
      reason: reason || null,
      record_type: "stock_supplier",
      record_id: supplierId,
      before_data: beforeData || null,
      after_data: afterData || null,
      route: `/api/admin/stockmanagement/suppliers/${supplierId}`,
      http_method: httpMethod,
    } as never);

  if (error) {
    console.error("Stock supplier audit log failed", {
      supplierId,
      action,
      auditError: error,
    });
  }
}

function buildUpdatePayload(
  body: SupplierUpdateBody,
  admin: AdminIdentity,
) {
  assertNoUnsupportedFields(body);

  const updatePayload: UnknownRow = {};

  if (body.display_name !== undefined) {
    const displayName = cleanText(body.display_name);

    if (displayName.length < 2) {
      throw new Error(
        "display_name is required and must contain at least two characters.",
      );
    }

    if (displayName.length > 200) {
      throw new Error(
        "display_name must not contain more than 200 characters.",
      );
    }

    updatePayload.display_name = displayName;
  }

  if (body.supplier_use !== undefined) {
    const supplierUse = cleanText(body.supplier_use);

    if (!ALLOWED_SUPPLIER_USES.has(supplierUse)) {
      throw new Error(
        `supplier_use is invalid. Allowed values: ${Array.from(
          ALLOWED_SUPPLIER_USES,
        ).join(", ")}.`,
      );
    }

    updatePayload.supplier_use = supplierUse;
  }

  if (body.usual_delivery_days !== undefined) {
    updatePayload.usual_delivery_days =
      parseNullableInteger(
        body.usual_delivery_days,
        "usual_delivery_days",
        3650,
      );
  }

  if (body.minimum_order_value_pence !== undefined) {
    updatePayload.minimum_order_value_pence =
      parseNullablePence(
        body.minimum_order_value_pence,
        "minimum_order_value_pence",
      );
  }

  if (body.usual_delivery_cost_pence !== undefined) {
    updatePayload.usual_delivery_cost_pence =
      parseNullablePence(
        body.usual_delivery_cost_pence,
        "usual_delivery_cost_pence",
      );
  }

  if (body.stock_notes !== undefined) {
    const stockNotes = nullableText(body.stock_notes);

    if (stockNotes && stockNotes.length > 10_000) {
      throw new Error(
        "stock_notes must not contain more than 10,000 characters.",
      );
    }

    updatePayload.stock_notes = stockNotes;
  }

  if (body.is_active !== undefined) {
    updatePayload.is_active = parseBoolean(
      body.is_active,
      "is_active",
    );
  }

  if (body.needs_review !== undefined) {
    updatePayload.needs_review = parseBoolean(
      body.needs_review,
      "needs_review",
    );
  }

  if (body.do_not_use !== undefined) {
    updatePayload.do_not_use = parseBoolean(
      body.do_not_use,
      "do_not_use",
    );
  }

  if (Object.keys(updatePayload).length === 0) {
    throw new Error(
      "At least one editable supplier field must be supplied for update.",
    );
  }

  updatePayload.updated_at = new Date().toISOString();
  updatePayload.updated_by = admin.id || null;
  updatePayload.updated_by_name = adminDisplayName(admin);

  return updatePayload;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  const { supplierId } = await context.params;
  const endpoint =
    `GET /api/admin/stockmanagement/suppliers/${supplierId}`;

  try {
    await requireAdmin();

    if (!isUuid(supplierId)) {
      throw new Error(
        "supplierId must be a valid UUID.",
      );
    }

    const supplier = await getSupplierOrThrow(supplierId);

    return NextResponse.json(
      {
        ok: true,
        supplier,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return apiError(
      error,
      endpoint,
      "The Stock Management supplier could not be loaded.",
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  const { supplierId } = await context.params;
  const endpoint =
    `PATCH /api/admin/stockmanagement/suppliers/${supplierId}`;

  try {
    const admin = await requireAdmin();

    if (!isUuid(supplierId)) {
      throw new Error(
        "supplierId must be a valid UUID.",
      );
    }

    const beforeData = await getSupplierOrThrow(supplierId);
    const body = await readJsonBody<SupplierUpdateBody>(request);
    const updatePayload = buildUpdatePayload(body, admin);

    if (
      updatePayload.do_not_use === true &&
      !nullableText(body.reason)
    ) {
      throw new Error(
        "A reason is required when marking a supplier as do not use.",
      );
    }

    const {
      data: updatedData,
      error: updateError,
    } = await supabaseAdmin
      .from(STOCK_SUPPLIER_TABLE)
      .update(updatePayload as never)
      .eq("id", supplierId)
      .select("*")
      .single();

    if (updateError) {
      throw updateError;
    }

    const afterData = updatedData as UnknownRow;
    const fields = changedFields(beforeData, afterData);

    if (fields.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No supplier values changed.",
        supplier: afterData,
        changedFields: [],
      });
    }

    const audit = profileAuditAction(beforeData, afterData);

    await writeAuditLog({
      admin,
      ...audit,
      summary: `Updated Stock Management supplier ${
        cleanText(afterData.display_name) || supplierId
      }. Changed fields: ${fields.join(", ")}.`,
      supplierId,
      beforeData,
      afterData,
      reason: nullableText(body.reason),
      httpMethod: "PATCH",
    });

    return NextResponse.json({
      ok: true,
      message:
        "The Stock Management supplier profile was updated.",
      supplier: afterData,
      changedFields: fields,
    });
  } catch (error) {
    return apiError(
      error,
      endpoint,
      "The Stock Management supplier could not be updated.",
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
) {
  const { supplierId } = await context.params;
  const endpoint =
    `DELETE /api/admin/stockmanagement/suppliers/${supplierId}`;

  try {
    const admin = await requireAdmin();

    if (!isUuid(supplierId)) {
      throw new Error(
        "supplierId must be a valid UUID.",
      );
    }

    const beforeData = await getSupplierOrThrow(supplierId);
    const body = await readJsonBody<DeleteBody>(request, {
      allowEmpty: true,
    });

    const reason = nullableText(body.reason);

    if (!reason || reason.length < 10) {
      throw new Error(
        "A deletion or archive reason of at least 10 characters is required.",
      );
    }

    const permanent =
      body.permanent === true ||
      body.permanent === "true";

    if (permanent) {
      if (!isMainAdmin(admin)) {
        throw new Error(
          "Main admin permission is required to permanently delete a Stock Management supplier.",
        );
      }

      const { error: deleteError } = await supabaseAdmin
        .from(STOCK_SUPPLIER_TABLE)
        .delete()
        .eq("id", supplierId);

      if (deleteError) {
        if (deleteError.code === "23503") {
          throw Object.assign(
            new Error(
              "This supplier cannot be permanently deleted because linked stock items, orders, reviews, audit records or other supplier data still exist. Archive the supplier instead, or move/remove the linked records first.",
            ),
            {
              code: deleteError.code,
              details: deleteError.details,
              hint:
                "Use the supplier workspace to review item links, orders and connected records before permanent deletion.",
            },
          );
        }

        throw deleteError;
      }

      await writeAuditLog({
        admin,
        action: "stock_supplier_profile_deleted",
        actionLabel: "Stock supplier permanently deleted",
        summary: `Permanently deleted Stock Management supplier ${
          cleanText(beforeData.display_name) || supplierId
        }.`,
        supplierId,
        beforeData,
        afterData: null,
        reason,
        httpMethod: "DELETE",
        riskLevel: "critical",
      });

      return NextResponse.json({
        ok: true,
        message:
          "The Stock Management supplier was permanently deleted.",
      });
    }

    if (beforeData.is_active === false) {
      return NextResponse.json({
        ok: true,
        message:
          "The Stock Management supplier is already archived.",
        supplier: beforeData,
      });
    }

    const archivePayload: UnknownRow = {
      is_active: false,
      needs_review: true,
      updated_at: new Date().toISOString(),
      updated_by: admin.id || null,
      updated_by_name: adminDisplayName(admin),
    };

    const {
      data: archivedData,
      error: archiveError,
    } = await supabaseAdmin
      .from(STOCK_SUPPLIER_TABLE)
      .update(archivePayload as never)
      .eq("id", supplierId)
      .select("*")
      .single();

    if (archiveError) {
      throw archiveError;
    }

    const afterData = archivedData as UnknownRow;

    await writeAuditLog({
      admin,
      action: "stock_supplier_profile_archived",
      actionLabel: "Stock supplier archived",
      summary: `Archived Stock Management supplier ${
        cleanText(afterData.display_name) || supplierId
      }.`,
      supplierId,
      beforeData,
      afterData,
      reason,
      httpMethod: "DELETE",
      riskLevel: "high",
    });

    return NextResponse.json({
      ok: true,
      message:
        "The Stock Management supplier was archived.",
      supplier: afterData,
    });
  } catch (error) {
    return apiError(
      error,
      endpoint,
      "The Stock Management supplier could not be archived or deleted.",
    );
  }
}
