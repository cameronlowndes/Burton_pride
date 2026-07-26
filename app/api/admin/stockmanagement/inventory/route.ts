import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminIdentity = {
  id?: string | null;
  name?: string | null;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
};

type StockItemRow = {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  description?: string | null;
  category?: string | null;
  location?: string | null;
  location_id?: string | null;
  supplier?: string | null;
  quantity?: number | string | null;
  reorder_level?: number | string | null;
  target_level?: number | string | null;
  unit_cost?: number | string | null;
  sale_price?: number | string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
  updated_by_name?: string | null;
};

type StockLocationRow = {
  id: string;
  name: string;
  code?: string | null;
  is_active?: boolean | null;
};

type InventoryBody = {
  id?: unknown;
  name?: unknown;
  sku?: unknown;
  barcode?: unknown;
  description?: unknown;
  category?: unknown;
  location?: unknown;
  supplier?: unknown;
  quantity?: unknown;
  reorderLevel?: unknown;
  targetLevel?: unknown;
  unitCost?: unknown;
  salePrice?: unknown;
  isActive?: unknown;
  password?: unknown;
  action?: unknown;
  permanentDelete?: unknown;
};

function cleanString(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function resolveLocation(
  value: unknown,
): Promise<StockLocationRow | null> {
  const input = cleanString(value, 250);

  if (!input) return null;

  let query = supabaseAdmin
    .from("stock_locations")
    .select("id,name,code,is_active");

  if (isUuid(input)) {
    query = query.eq("id", input);
  } else {
    const escaped = input
      .replaceAll("\\", "\\\\")
      .replaceAll("%", "\\%")
      .replaceAll("_", "\\_")
      .replaceAll(",", " ");

    query = query.or(
      `name.ilike.${escaped},code.ilike.${escaped}`,
    );
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw Object.assign(
      new Error(
        `The storage location "${input}" could not be found. Choose an existing location.`,
      ),
      {
        status: 400,
        field: "location",
        code: "STOCK_LOCATION_NOT_FOUND",
      },
    );
  }

  const location = data as StockLocationRow;

  if (location.is_active === false) {
    throw Object.assign(
      new Error(
        `The storage location "${location.name}" is archived and cannot be assigned to stock.`,
      ),
      {
        status: 409,
        field: "location",
        code: "STOCK_LOCATION_INACTIVE",
      },
    );
  }

  return location;
}

function requiredString(value: unknown, field: string, maxLength = 500) {
  const cleaned = cleanString(value, maxLength);

  if (!cleaned) {
    throw new Error(`${field} is required.`);
  }

  return cleaned;
}

function nonNegativeInteger(value: unknown, field: string) {
  const number = Number(value);

  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`${field} must be a whole number of zero or more.`);
  }

  return number;
}

function nullableNumber(value: unknown, field: string) {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${field} must be a number of zero or more.`);
  }

  return number;
}

function normaliseAdminName(admin: AdminIdentity) {
  return (
    cleanString(admin.name, 250) ||
    cleanString(admin.full_name, 250) ||
    cleanString(admin.email, 250) ||
    "Admin"
  );
}

function statusFor(quantity: number, reorderLevel: number, isActive: boolean) {
  if (!isActive) return "archived";
  if (quantity <= 0) return "out_of_stock";
  if (quantity <= reorderLevel) return "low_stock";
  return "in_stock";
}

function normaliseStockItem(row: StockItemRow) {
  const quantity = Number(row.quantity || 0);
  const reorderLevel = Number(row.reorder_level || 0);
  const unitCost =
    row.unit_cost === null || row.unit_cost === undefined
      ? null
      : Number(row.unit_cost);
  const salePrice =
    row.sale_price === null || row.sale_price === undefined
      ? null
      : Number(row.sale_price);
  const targetLevel =
    row.target_level === null || row.target_level === undefined
      ? null
      : Number(row.target_level);
  const isActive = row.is_active !== false;

  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    barcode: row.barcode || null,
    description: row.description || null,
    category: row.category || null,
    location: row.location_id || row.location || null,
    supplier: row.supplier || null,
    quantity,
    reorderLevel,
    targetLevel,
    unitCost,
    salePrice,
    stockValue: Number((quantity * Number(unitCost || 0)).toFixed(2)),
    status: statusFor(quantity, reorderLevel, isActive),
    isActive,
    updatedAt: row.updated_at || row.created_at || null,
    updatedByName: row.updated_by_name || null,
  };
}

function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) {
  const changes: Record<
    string,
    {
      before: unknown;
      after: unknown;
    }
  > = {};

  for (const key of Object.keys(after)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes[key] = {
        before: before[key] ?? null,
        after: after[key] ?? null,
      };
    }
  }

  return changes;
}

async function writeAuditLog(params: {
  request: NextRequest;
  admin: AdminIdentity;
  action: string;
  actionLabel: string;
  summary: string;
  recordId?: string | null;
  recordTitle?: string | null;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  reason?: string | null;
  riskLevel?: "low" | "medium" | "high" | "critical";
  isSecurityEvent?: boolean;
}) {
  const requestId =
    params.request.headers.get("x-request-id") ||
    params.request.headers.get("x-vercel-id") ||
    crypto.randomUUID();

  const beforeData = params.beforeData || null;
  const afterData = params.afterData || null;

  const row = {
    event_id: null,
    admin_id: params.admin.id || null,
    admin_name: normaliseAdminName(params.admin),
    admin_email: params.admin.email || null,
    admin_role: params.admin.role || "admin",
    area: "Stock Management",
    action: params.action,
    action_label: params.actionLabel,
    summary: params.summary,
    reason: params.reason || null,
    record_type: "stock_item",
    record_id: params.recordId || null,
    record_title: params.recordTitle || null,
    before_data: beforeData,
    after_data: afterData,
    changed_fields:
      beforeData && afterData ? changedFields(beforeData, afterData) : null,
    metadata: {
      app: "stock_management",
      audit_source: "inventory_api",
    },
    route: params.request.nextUrl.pathname,
    http_method: params.request.method,
    response_status: 200,
    request_id: requestId,
    ip_address:
      params.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      params.request.headers.get("x-real-ip") ||
      null,
    user_agent: params.request.headers.get("user-agent"),
    is_security_event: params.isSecurityEvent || false,
    risk_level: params.riskLevel || "low",
    status: "success",
  };

  const { error } = await supabaseAdmin.from("event_audit_logs").insert(row);

  if (error) {
    console.error("Stock Management audit insert failed", {
      action: params.action,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
  }
}

async function requireAdmin() {
  const admin = (await getCurrentAdmin()) as AdminIdentity | null;

  if (!admin?.id && !admin?.email) {
    return null;
  }

  return admin;
}

function errorStatus(error: unknown) {
  const candidate = error as {
    status?: number;
    code?: string;
    message?: string;
  };

  if (
    typeof candidate?.status === "number" &&
    candidate.status >= 400 &&
    candidate.status <= 599
  ) {
    return candidate.status;
  }

  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(candidate?.message || "").toLowerCase();

  if (
    message.includes("required") ||
    message.includes("must be") ||
    message.includes("invalid") ||
    candidate?.code === "22P02"
  ) {
    return 400;
  }

  if (
    candidate?.code === "23505" ||
    message.includes("duplicate")
  ) {
    return 409;
  }

  if (
    candidate?.code === "23503" ||
    message.includes("foreign key")
  ) {
    return 409;
  }

  return 500;
}

function errorResponse(error: unknown, fallback: string) {
  const anyError = error as {
    code?: string;
    message?: string;
    details?: string | null;
    hint?: string | null;
    field?: string | null;
  };

  return NextResponse.json(
    {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : anyError?.message || fallback,
      code: anyError?.code,
      details: anyError?.details || null,
      hint: anyError?.hint || null,
      field: anyError?.field || null,
    },
    { status: errorStatus(error) },
  );
}

export async function GET() {
  try {
    const admin = await requireAdmin();

    if (!admin) {
      return NextResponse.json(
        { ok: false, error: "Unauthorised. Sign in as an administrator." },
        { status: 401 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("stock_items")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;

    const items = ((data || []) as StockItemRow[]).map(normaliseStockItem);

    const activeItems = items.filter((item) => item.isActive);

    const summary = {
      totalItems: activeItems.length,
      totalUnits: activeItems.reduce(
        (total, item) => total + item.quantity,
        0,
      ),
      lowStockItems: activeItems.filter(
        (item) => item.status === "low_stock",
      ).length,
      outOfStockItems: activeItems.filter(
        (item) => item.status === "out_of_stock",
      ).length,
      totalValue: Number(
        activeItems
          .reduce((total, item) => total + item.stockValue, 0)
          .toFixed(2),
      ),
    };

    /*
     * Do not write an audit entry here.
     * Opening or refreshing the inventory page is not a data change.
     */
    return NextResponse.json({
      ok: true,
      items,
      summary,
    });
  } catch (error) {
    return errorResponse(error, "Inventory could not be loaded.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();

    if (!admin) {
      return NextResponse.json(
        { ok: false, error: "Unauthorised. Sign in as an administrator." },
        { status: 401 },
      );
    }

    const body = (await request.json()) as InventoryBody;

    const name = requiredString(body.name, "Item name", 250);
    const sku = requiredString(body.sku, "SKU", 150);
    const quantity = nonNegativeInteger(body.quantity, "Quantity");
    const reorderLevel = nonNegativeInteger(
      body.reorderLevel,
      "Reorder level",
    );

    const location = await resolveLocation(body.location);

    const insertData = {
      name,
      sku,
      barcode: cleanString(body.barcode, 250),
      description: cleanString(body.description, 5_000),
      category: cleanString(body.category, 250),
      location_id: location?.id || null,
      supplier: cleanString(body.supplier, 500),
      quantity,
      reorder_level: reorderLevel,
      target_level: nullableNumber(body.targetLevel, "Target level"),
      unit_cost: nullableNumber(body.unitCost, "Unit cost"),
      sale_price: nullableNumber(body.salePrice, "Sale price"),
      is_active: body.isActive !== false,
      updated_by: admin.id || null,
      updated_by_name: normaliseAdminName(admin),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("stock_items")
      .insert(insertData)
      .select("*")
      .single();

    if (error) throw error;

    const item = normaliseStockItem(data as StockItemRow);
    const isTestItem =
      sku.toLowerCase().startsWith("test-") ||
      name.toLowerCase().includes("test item");

    await writeAuditLog({
      request,
      admin,
      action: isTestItem
        ? "stock.item.test_created"
        : "stock.item.created",
      actionLabel: isTestItem
        ? "Test stock item created"
        : "Stock item created",
      summary: `${normaliseAdminName(admin)} created ${name} (${sku}).`,
      recordId: item.id,
      recordTitle: item.name,
      afterData: {
        ...item,
        locationId: location?.id || null,
        locationName: location?.name || null,
        locationCode: location?.code || null,
      },
      reason: isTestItem
        ? "Created from the Stock Management test-item action."
        : "Created from the Stock Management inventory page.",
    });

    return NextResponse.json(
      {
        ok: true,
        item,
        message: `${name} was created successfully.`,
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error, "Stock item could not be created.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdmin();

    if (!admin) {
      return NextResponse.json(
        { ok: false, error: "Unauthorised. Sign in as an administrator." },
        { status: 401 },
      );
    }

    const body = (await request.json()) as InventoryBody;
    const id = requiredString(body.id, "Stock item ID", 180);

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("stock_items")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (existingError) throw existingError;

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "The stock item could not be found." },
        { status: 404 },
      );
    }

    const name = requiredString(body.name, "Item name", 250);
    const sku = requiredString(body.sku, "SKU", 150);

    const location = await resolveLocation(body.location);

    const updateData = {
      name,
      sku,
      barcode: cleanString(body.barcode, 250),
      description: cleanString(body.description, 5_000),
      category: cleanString(body.category, 250),
      location_id: location?.id || null,
      supplier: cleanString(body.supplier, 500),
      quantity: nonNegativeInteger(body.quantity, "Quantity"),
      reorder_level: nonNegativeInteger(
        body.reorderLevel,
        "Reorder level",
      ),
      target_level: nullableNumber(body.targetLevel, "Target level"),
      unit_cost: nullableNumber(body.unitCost, "Unit cost"),
      sale_price: nullableNumber(body.salePrice, "Sale price"),
      is_active: body.isActive !== false,
      updated_by: admin.id || null,
      updated_by_name: normaliseAdminName(admin),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("stock_items")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;

    const before = normaliseStockItem(existing as StockItemRow);
    const item = normaliseStockItem(data as StockItemRow);

    await writeAuditLog({
      request,
      admin,
      action: "stock.item.updated",
      actionLabel: "Stock item updated",
      summary: `${normaliseAdminName(admin)} updated ${item.name} (${item.sku}).`,
      recordId: item.id,
      recordTitle: item.name,
      beforeData: before,
      afterData: {
        ...item,
        locationId: location?.id || null,
        locationName: location?.name || null,
        locationCode: location?.code || null,
      },
      reason: "Stock item details were changed from the inventory page.",
    });

    return NextResponse.json({
      ok: true,
      item,
      message: `${item.name} was updated successfully.`,
    });
  } catch (error) {
    return errorResponse(error, "Stock item could not be updated.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await requireAdmin();

    if (!admin) {
      return NextResponse.json(
        { ok: false, error: "Unauthorised. Sign in as an administrator." },
        { status: 401 },
      );
    }

    const body = (await request.json()) as InventoryBody;
    const id = requiredString(body.id, "Stock item ID", 180);

    if (body.permanentDelete !== true || body.action !== "delete") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "The permanent-delete confirmation was not included in the request.",
        },
        { status: 400 },
      );
    }

    const role = String(admin.role || "").toLowerCase();

    if (!["main_admin", "main admin", "owner"].includes(role)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Main administrator access is required to delete stock items.",
        },
        { status: 403 },
      );
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("stock_items")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (existingError) throw existingError;

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "The stock item could not be found." },
        { status: 404 },
      );
    }

    const before = normaliseStockItem(existing as StockItemRow);

    const { error } = await supabaseAdmin
      .from("stock_items")
      .delete()
      .eq("id", id);

    if (error) throw error;

    await writeAuditLog({
      request,
      admin,
      action: "stock.item.deleted",
      actionLabel: "Stock item permanently deleted",
      summary: `${normaliseAdminName(admin)} permanently deleted ${before.name} (${before.sku}).`,
      recordId: before.id,
      recordTitle: before.name,
      beforeData: before,
      afterData: null,
      reason: "Permanent deletion confirmed through Stock Management.",
      riskLevel: "high",
      isSecurityEvent: true,
    });

    return NextResponse.json({
      ok: true,
      message: `${before.name} was permanently deleted.`,
    });
  } catch (error) {
    return errorResponse(error, "Stock item could not be deleted.");
  }
}
