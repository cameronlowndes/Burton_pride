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
  event_record_type?: unknown;
  event_record_id?: unknown;
  money_supplier_id?: unknown;
  reason?: unknown;
};

type UnknownRow = Record<string, unknown>;

type ApiErrorLike = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
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

function parseBoolean(
  value: unknown,
  fieldName: string,
) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(
    `${fieldName} must be true or false.`,
  );
}

function parseNullableInteger(
  value: unknown,
  fieldName: string,
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 0
  ) {
    throw new Error(
      `${fieldName} must be a whole number of zero or more.`,
    );
  }

  return parsed;
}

function parseNullablePence(
  value: unknown,
  fieldName: string,
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 0
  ) {
    throw new Error(
      `${fieldName} must be a non-negative amount in pence.`,
    );
  }

  return parsed;
}

function errorStatus(error: unknown) {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : "";

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
    message.includes("not found") ||
    message.includes("does not exist")
  ) {
    return 404;
  }

  if (
    message.includes("required") ||
    message.includes("must be") ||
    message.includes("invalid") ||
    message.includes("already exists")
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
      code:
        source?.code ||
        `STOCK_SUPPLIER_${status}`,
      details:
        source?.details ||
        "The Stock Management supplier API could not complete the request.",
      hint:
        source?.hint ||
        "Check the supplier ID, Supabase columns, administrator session and server logs.",
      endpoint,
      status,
    },
    { status },
  );
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
    admin.name ||
    admin.full_name ||
    admin.email ||
    "Admin"
  );
}

async function getSupplierOrThrow(
  supplierId: string,
) {
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
}: {
  admin: AdminIdentity;
  action: string;
  actionLabel: string;
  summary: string;
  supplierId: string;
  beforeData?: UnknownRow | null;
  afterData?: UnknownRow | null;
  reason?: string | null;
  httpMethod: "PATCH" | "DELETE";
}) {
  try {
    await supabaseAdmin
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
          httpMethod === "DELETE"
            ? "high"
            : "low",
        summary,
        reason: reason || null,
        record_type: "stock_supplier",
        record_id: supplierId,
        before_data: beforeData || null,
        after_data: afterData || null,
        route:
          `/api/admin/stockmanagement/suppliers/${supplierId}`,
        http_method: httpMethod,
      } as never);
  } catch {
    // Audit logging must not undo a successful supplier update.
  }
}

function buildUpdatePayload(
  body: SupplierUpdateBody,
  admin: AdminIdentity,
) {
  const updatePayload: UnknownRow = {
    updated_at: new Date().toISOString(),
    updated_by: admin.id || null,
    updated_by_name: adminDisplayName(admin),
  };

  if (body.display_name !== undefined) {
    const displayName = cleanText(
      body.display_name,
    );

    if (displayName.length < 2) {
      throw new Error(
        "display_name is required and must contain at least two characters.",
      );
    }

    updatePayload.display_name =
      displayName;
  }

  if (body.supplier_use !== undefined) {
    const supplierUse = cleanText(
      body.supplier_use,
    );

    if (
      !ALLOWED_SUPPLIER_USES.has(
        supplierUse,
      )
    ) {
      throw new Error(
        `supplier_use is invalid. Allowed values: ${Array.from(
          ALLOWED_SUPPLIER_USES,
        ).join(", ")}.`,
      );
    }

    updatePayload.supplier_use =
      supplierUse;
  }

  if (
    body.usual_delivery_days !==
    undefined
  ) {
    updatePayload.usual_delivery_days =
      parseNullableInteger(
        body.usual_delivery_days,
        "usual_delivery_days",
      );
  }

  if (
    body.minimum_order_value_pence !==
    undefined
  ) {
    updatePayload.minimum_order_value_pence =
      parseNullablePence(
        body.minimum_order_value_pence,
        "minimum_order_value_pence",
      );
  }

  if (
    body.usual_delivery_cost_pence !==
    undefined
  ) {
    updatePayload.usual_delivery_cost_pence =
      parseNullablePence(
        body.usual_delivery_cost_pence,
        "usual_delivery_cost_pence",
      );
  }

  if (body.stock_notes !== undefined) {
    updatePayload.stock_notes =
      nullableText(body.stock_notes);
  }

  if (body.is_active !== undefined) {
    updatePayload.is_active =
      parseBoolean(
        body.is_active,
        "is_active",
      );
  }

  if (body.needs_review !== undefined) {
    updatePayload.needs_review =
      parseBoolean(
        body.needs_review,
        "needs_review",
      );
  }

  if (body.do_not_use !== undefined) {
    updatePayload.do_not_use =
      parseBoolean(
        body.do_not_use,
        "do_not_use",
      );
  }

  if (
    body.event_record_type !==
    undefined
  ) {
    updatePayload.event_record_type =
      nullableText(
        body.event_record_type,
      );
  }

  if (
    body.event_record_id !== undefined
  ) {
    const eventRecordId = nullableText(
      body.event_record_id,
    );

    if (
      eventRecordId &&
      !isUuid(eventRecordId)
    ) {
      throw new Error(
        "event_record_id must be a valid UUID.",
      );
    }

    updatePayload.event_record_id =
      eventRecordId;
  }

  if (
    body.money_supplier_id !== undefined
  ) {
    const moneySupplierId = nullableText(
      body.money_supplier_id,
    );

    if (
      moneySupplierId &&
      !isUuid(moneySupplierId)
    ) {
      throw new Error(
        "money_supplier_id must be a valid UUID.",
      );
    }

    updatePayload.money_supplier_id =
      moneySupplierId;
  }

  return updatePayload;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  const { supplierId } =
    await context.params;

  const endpoint =
    `GET /api/admin/stockmanagement/suppliers/${supplierId}`;

  try {
    await requireAdmin();

    if (!isUuid(supplierId)) {
      throw new Error(
        "supplierId must be a valid UUID.",
      );
    }

    const supplier =
      await getSupplierOrThrow(
        supplierId,
      );

    return NextResponse.json({
      ok: true,
      supplier,
    });
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
  const { supplierId } =
    await context.params;

  const endpoint =
    `PATCH /api/admin/stockmanagement/suppliers/${supplierId}`;

  try {
    const admin = await requireAdmin();

    if (!isUuid(supplierId)) {
      throw new Error(
        "supplierId must be a valid UUID.",
      );
    }

    const beforeData =
      await getSupplierOrThrow(
        supplierId,
      );

    const body =
      (await request.json()) as SupplierUpdateBody;

    const updatePayload =
      buildUpdatePayload(body, admin);

    if (
      Object.keys(updatePayload).length <= 3
    ) {
      throw new Error(
        "At least one supplier field must be supplied for update.",
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

    const afterData =
      updatedData as UnknownRow;

    await writeAuditLog({
      admin,
      action:
        "stock_supplier_profile_updated",
      actionLabel:
        "Stock supplier updated",
      summary: `Updated Stock Management supplier ${cleanText(
        afterData.display_name,
      ) || supplierId}.`,
      supplierId,
      beforeData,
      afterData,
      reason:
        nullableText(body.reason),
      httpMethod: "PATCH",
    });

    return NextResponse.json({
      ok: true,
      message:
        "The Stock Management supplier profile was updated.",
      supplier: afterData,
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
  const { supplierId } =
    await context.params;

  const endpoint =
    `DELETE /api/admin/stockmanagement/suppliers/${supplierId}`;

  try {
    const admin = await requireAdmin();

    if (!isUuid(supplierId)) {
      throw new Error(
        "supplierId must be a valid UUID.",
      );
    }

    const beforeData =
      await getSupplierOrThrow(
        supplierId,
      );

    let body: {
      reason?: unknown;
      permanent?: unknown;
    } = {};

    try {
      body =
        (await request.json()) as {
          reason?: unknown;
          permanent?: unknown;
        };
    } catch {
      body = {};
    }

    const reason = nullableText(
      body.reason,
    );

    if (!reason || reason.length < 10) {
      throw new Error(
        "A deletion or archive reason of at least 10 characters is required.",
      );
    }

    const permanent =
      body.permanent === true ||
      body.permanent === "true";

    if (permanent) {
      if (!admin.is_main_admin) {
        throw new Error(
          "Main admin permission is required to permanently delete a Stock Management supplier.",
        );
      }

      const { error: deleteError } =
        await supabaseAdmin
          .from(STOCK_SUPPLIER_TABLE)
          .delete()
          .eq("id", supplierId);

      if (deleteError) {
        throw deleteError;
      }

      await writeAuditLog({
        admin,
        action:
          "stock_supplier_profile_deleted",
        actionLabel:
          "Stock supplier permanently deleted",
        summary: `Permanently deleted Stock Management supplier ${cleanText(
          beforeData.display_name,
        ) || supplierId}.`,
        supplierId,
        beforeData,
        afterData: null,
        reason,
        httpMethod: "DELETE",
      });

      return NextResponse.json({
        ok: true,
        message:
          "The Stock Management supplier was permanently deleted.",
      });
    }

    const archivePayload: UnknownRow = {
      is_active: false,
      needs_review: true,
      updated_at:
        new Date().toISOString(),
      updated_by: admin.id || null,
      updated_by_name:
        adminDisplayName(admin),
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

    const afterData =
      archivedData as UnknownRow;

    await writeAuditLog({
      admin,
      action:
        "stock_supplier_profile_archived",
      actionLabel:
        "Stock supplier archived",
      summary: `Archived Stock Management supplier ${cleanText(
        afterData.display_name,
      ) || supplierId}.`,
      supplierId,
      beforeData,
      afterData,
      reason,
      httpMethod: "DELETE",
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
