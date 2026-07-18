import { type NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE_NAME = "/api/admin/stock-management/inventory";
const STOCK_ITEMS_TABLE = "stock_items";
const AUDIT_TABLE = "admin_audit_logs";

type AdminIdentity = {
  id: string;
  email?: string | null;
  name?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  role?: string | null;
};

type StockItemRow = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  category: string | null;
  location: string | null;
  supplier: string | null;
  quantity: number | null;
  reorder_level: number | null;
  target_level: number | null;
  unit_cost: number | null;
  sale_price: number | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  created_by_name: string | null;
  updated_by: string | null;
  updated_by_name: string | null;
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
};

type InventoryItemResponse = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  category: string | null;
  location: string | null;
  supplier: string | null;
  quantity: number;
  reorderLevel: number;
  targetLevel: number | null;
  unitCost: number | null;
  salePrice: number | null;
  stockValue: number;
  status: "in_stock" | "low_stock" | "out_of_stock" | "archived";
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  createdByName: string | null;
  updatedByName: string | null;
};

function json(
  body: Record<string, unknown>,
  status = 200,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nullableString(value: unknown): string | null {
  const cleaned = cleanString(value);
  return cleaned || null;
}

function finiteNumber(
  value: unknown,
  options?: {
    minimum?: number;
    allowNull?: boolean;
  },
): number | null {
  if (
    options?.allowNull &&
    (value === null || value === undefined || value === "")
  ) {
    return null;
  }

  const parsed =
    typeof value === "number"
      ? value
      : Number(typeof value === "string" ? value.trim() : value);

  if (!Number.isFinite(parsed)) {
    return options?.allowNull ? null : 0;
  }

  if (
    typeof options?.minimum === "number" &&
    parsed < options.minimum
  ) {
    return options.minimum;
  }

  return parsed;
}

function booleanValue(value: unknown, fallback = true): boolean {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const normalised = value.trim().toLowerCase();

    if (["true", "1", "yes", "on"].includes(normalised)) return true;
    if (["false", "0", "no", "off"].includes(normalised)) return false;
  }

  if (typeof value === "number") return value !== 0;

  return fallback;
}

function adminDisplayName(admin: AdminIdentity): string {
  const explicit =
    cleanString(admin.full_name) ||
    cleanString(admin.name);

  if (explicit) return explicit;

  const combined = [
    cleanString(admin.first_name),
    cleanString(admin.last_name),
  ]
    .filter(Boolean)
    .join(" ");

  return combined || cleanString(admin.email) || "Administrator";
}

function itemStatus(
  quantity: number,
  reorderLevel: number,
  isActive: boolean,
): InventoryItemResponse["status"] {
  if (!isActive) return "archived";
  if (quantity <= 0) return "out_of_stock";
  if (quantity <= reorderLevel) return "low_stock";
  return "in_stock";
}

function mapItem(row: StockItemRow): InventoryItemResponse {
  const quantity = Number(row.quantity || 0);
  const reorderLevel = Number(row.reorder_level || 0);
  const unitCost =
    row.unit_cost === null || row.unit_cost === undefined
      ? null
      : Number(row.unit_cost);
  const isActive = row.is_active !== false;

  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    barcode: row.barcode,
    description: row.description,
    category: row.category,
    location: row.location,
    supplier: row.supplier,
    quantity,
    reorderLevel,
    targetLevel:
      row.target_level === null || row.target_level === undefined
        ? null
        : Number(row.target_level),
    unitCost,
    salePrice:
      row.sale_price === null || row.sale_price === undefined
        ? null
        : Number(row.sale_price),
    stockValue: quantity * Number(unitCost || 0),
    status: itemStatus(quantity, reorderLevel, isActive),
    isActive,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdByName: row.created_by_name,
    updatedByName: row.updated_by_name,
  };
}

function buildSummary(items: InventoryItemResponse[]) {
  const activeItems = items.filter((item) => item.isActive);

  return {
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
    totalValue: activeItems.reduce(
      (total, item) => total + item.stockValue,
      0,
    ),
  };
}

async function requireAdmin(): Promise<AdminIdentity | null> {
  const admin = (await getCurrentAdmin()) as AdminIdentity | null;

  if (!admin?.id) return null;

  return admin;
}

async function writeAudit(params: {
  admin: AdminIdentity;
  action: string;
  status: string;
  riskLevel: "low" | "medium" | "high";
  targetId?: string | null;
  targetLabel?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from(AUDIT_TABLE)
      .insert({
        admin_id: params.admin.id,
        admin_name: adminDisplayName(params.admin),
        admin_email: params.admin.email || null,
        admin_role: params.admin.role || null,
        action: params.action,
        area: "stock_control",
        route: ROUTE_NAME,
        method: "SERVER",
        status: params.status,
        risk_level: params.riskLevel,
        target_type: "stock_item",
        target_id: params.targetId || null,
        target_label: params.targetLabel || null,
        metadata: params.metadata || {},
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.warn(`${ROUTE_NAME} audit insert failed:`, error.message);
    }
  } catch (error) {
    console.warn(`${ROUTE_NAME} audit insert threw:`, error);
  }
}

async function parseBody(
  request: NextRequest,
): Promise<InventoryBody | null> {
  try {
    return (await request.json()) as InventoryBody;
  } catch {
    return null;
  }
}

function validateItemBody(body: InventoryBody) {
  const name = cleanString(body.name);
  const sku = cleanString(body.sku);

  if (!name) {
    return {
      ok: false as const,
      error: "Item name is required.",
    };
  }

  if (!sku) {
    return {
      ok: false as const,
      error: "SKU is required.",
    };
  }

  if (name.length > 160) {
    return {
      ok: false as const,
      error: "Item name must be 160 characters or fewer.",
    };
  }

  if (sku.length > 100) {
    return {
      ok: false as const,
      error: "SKU must be 100 characters or fewer.",
    };
  }

  const quantity = finiteNumber(body.quantity, {
    minimum: 0,
  });

  const reorderLevel = finiteNumber(body.reorderLevel, {
    minimum: 0,
  });

  const targetLevel = finiteNumber(body.targetLevel, {
    minimum: 0,
    allowNull: true,
  });

  const unitCost = finiteNumber(body.unitCost, {
    minimum: 0,
    allowNull: true,
  });

  const salePrice = finiteNumber(body.salePrice, {
    minimum: 0,
    allowNull: true,
  });

  return {
    ok: true as const,
    values: {
      name,
      sku,
      barcode: nullableString(body.barcode),
      description: nullableString(body.description),
      category: nullableString(body.category),
      location: nullableString(body.location),
      supplier: nullableString(body.supplier),
      quantity: quantity ?? 0,
      reorder_level: reorderLevel ?? 0,
      target_level: targetLevel,
      unit_cost: unitCost,
      sale_price: salePrice,
      is_active: booleanValue(body.isActive, true),
    },
  };
}

async function skuExists(
  sku: string,
  excludeId?: string,
): Promise<boolean> {
  let query = supabaseAdmin
    .from(STOCK_ITEMS_TABLE)
    .select("id", {
      count: "exact",
      head: true,
    })
    .ilike("sku", sku);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(`Could not validate SKU: ${error.message}`);
  }

  return Number(count || 0) > 0;
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  const admin = await requireAdmin();

  if (!admin) {
    return json(
      {
        ok: false,
        error: "Unauthorised.",
      },
      401,
    );
  }

  const includeArchived =
    request.nextUrl.searchParams.get("includeArchived") === "true";

  let query = supabaseAdmin
    .from(STOCK_ITEMS_TABLE)
    .select(
      [
        "id",
        "name",
        "sku",
        "barcode",
        "description",
        "category",
        "location",
        "supplier",
        "quantity",
        "reorder_level",
        "target_level",
        "unit_cost",
        "sale_price",
        "is_active",
        "created_at",
        "updated_at",
        "created_by",
        "created_by_name",
        "updated_by",
        "updated_by_name",
      ].join(","),
    )
    .order("name", {
      ascending: true,
    });

  if (!includeArchived) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    console.error(`${ROUTE_NAME} GET failed:`, error);

    return json(
      {
        ok: false,
        error: "Unable to load inventory.",
      },
      500,
    );
  }

  const items = ((data || []) as unknown as StockItemRow[]).map(mapItem);

  await writeAudit({
    admin,
    action: "stock_inventory_viewed",
    status: "success",
    riskLevel: "low",
    metadata: {
      item_count: items.length,
      include_archived: includeArchived,
    },
  });

  return json({
    ok: true,
    items,
    summary: buildSummary(items),
  });
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  const admin = await requireAdmin();

  if (!admin) {
    return json(
      {
        ok: false,
        error: "Unauthorised.",
      },
      401,
    );
  }

  const body = await parseBody(request);

  if (!body) {
    return json(
      {
        ok: false,
        error: "Invalid request body.",
      },
      400,
    );
  }

  const validation = validateItemBody(body);

  if (!validation.ok) {
    return json(
      {
        ok: false,
        error: validation.error,
      },
      400,
    );
  }

  try {
    if (await skuExists(validation.values.sku)) {
      return json(
        {
          ok: false,
          error: "A stock item with this SKU already exists.",
        },
        409,
      );
    }

    const now = new Date().toISOString();
    const displayName = adminDisplayName(admin);

    const { data, error } = await supabaseAdmin
      .from(STOCK_ITEMS_TABLE)
      .insert({
        ...validation.values,
        created_at: now,
        updated_at: now,
        created_by: admin.id,
        created_by_name: displayName,
        updated_by: admin.id,
        updated_by_name: displayName,
      })
      .select(
        [
          "id",
          "name",
          "sku",
          "barcode",
          "description",
          "category",
          "location",
          "supplier",
          "quantity",
          "reorder_level",
          "target_level",
          "unit_cost",
          "sale_price",
          "is_active",
          "created_at",
          "updated_at",
          "created_by",
          "created_by_name",
          "updated_by",
          "updated_by_name",
        ].join(","),
      )
      .single<StockItemRow>();

    if (error || !data) {
      console.error(`${ROUTE_NAME} POST failed:`, error);

      return json(
        {
          ok: false,
          error: "The stock item could not be created.",
        },
        500,
      );
    }

    const item = mapItem(data);

    await writeAudit({
      admin,
      action: "stock_item_created",
      status: "success",
      riskLevel: "medium",
      targetId: item.id,
      targetLabel: item.name,
      metadata: {
        sku: item.sku,
        quantity: item.quantity,
        reorder_level: item.reorderLevel,
        category: item.category,
        location: item.location,
      },
    });

    return json(
      {
        ok: true,
        item,
        message: "Stock item created.",
      },
      201,
    );
  } catch (error) {
    console.error(`${ROUTE_NAME} POST threw:`, error);

    return json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "The stock item could not be created.",
      },
      500,
    );
  }
}

export async function PATCH(
  request: NextRequest,
): Promise<NextResponse> {
  const admin = await requireAdmin();

  if (!admin) {
    return json(
      {
        ok: false,
        error: "Unauthorised.",
      },
      401,
    );
  }

  const body = await parseBody(request);

  if (!body) {
    return json(
      {
        ok: false,
        error: "Invalid request body.",
      },
      400,
    );
  }

  const id = cleanString(body.id);

  if (!id) {
    return json(
      {
        ok: false,
        error: "Stock item ID is required.",
      },
      400,
    );
  }

  const validation = validateItemBody(body);

  if (!validation.ok) {
    return json(
      {
        ok: false,
        error: validation.error,
      },
      400,
    );
  }

  try {
    const { data: existing, error: existingError } =
      await supabaseAdmin
        .from(STOCK_ITEMS_TABLE)
        .select(
          [
            "id",
            "name",
            "sku",
            "barcode",
            "description",
            "category",
            "location",
            "supplier",
            "quantity",
            "reorder_level",
            "target_level",
            "unit_cost",
            "sale_price",
            "is_active",
            "created_at",
            "updated_at",
            "created_by",
            "created_by_name",
            "updated_by",
            "updated_by_name",
          ].join(","),
        )
        .eq("id", id)
        .maybeSingle<StockItemRow>();

    if (existingError) {
      throw new Error(
        `Could not read stock item: ${existingError.message}`,
      );
    }

    if (!existing) {
      return json(
        {
          ok: false,
          error: "Stock item not found.",
        },
        404,
      );
    }

    if (await skuExists(validation.values.sku, id)) {
      return json(
        {
          ok: false,
          error: "Another stock item already uses this SKU.",
        },
        409,
      );
    }

    const displayName = adminDisplayName(admin);

    const { data, error } = await supabaseAdmin
      .from(STOCK_ITEMS_TABLE)
      .update({
        ...validation.values,
        updated_at: new Date().toISOString(),
        updated_by: admin.id,
        updated_by_name: displayName,
      })
      .eq("id", id)
      .select(
        [
          "id",
          "name",
          "sku",
          "barcode",
          "description",
          "category",
          "location",
          "supplier",
          "quantity",
          "reorder_level",
          "target_level",
          "unit_cost",
          "sale_price",
          "is_active",
          "created_at",
          "updated_at",
          "created_by",
          "created_by_name",
          "updated_by",
          "updated_by_name",
        ].join(","),
      )
      .single<StockItemRow>();

    if (error || !data) {
      console.error(`${ROUTE_NAME} PATCH failed:`, error);

      return json(
        {
          ok: false,
          error: "The stock item could not be updated.",
        },
        500,
      );
    }

    const before = mapItem(existing);
    const item = mapItem(data);

    await writeAudit({
      admin,
      action: "stock_item_updated",
      status: "success",
      riskLevel: "medium",
      targetId: item.id,
      targetLabel: item.name,
      metadata: {
        before: {
          name: before.name,
          sku: before.sku,
          quantity: before.quantity,
          reorder_level: before.reorderLevel,
          is_active: before.isActive,
        },
        after: {
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          reorder_level: item.reorderLevel,
          is_active: item.isActive,
        },
      },
    });

    return json({
      ok: true,
      item,
      message: "Stock item updated.",
    });
  } catch (error) {
    console.error(`${ROUTE_NAME} PATCH threw:`, error);

    return json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "The stock item could not be updated.",
      },
      500,
    );
  }
}

export async function DELETE(
  request: NextRequest,
): Promise<NextResponse> {
  const admin = await requireAdmin();

  if (!admin) {
    return json(
      {
        ok: false,
        error: "Unauthorised.",
      },
      401,
    );
  }

  const body = await parseBody(request);

  if (!body) {
    return json(
      {
        ok: false,
        error: "Invalid request body.",
      },
      400,
    );
  }

  const id = cleanString(body.id);

  if (!id) {
    return json(
      {
        ok: false,
        error: "Stock item ID is required.",
      },
      400,
    );
  }

  try {
    const { data: existing, error: existingError } =
      await supabaseAdmin
        .from(STOCK_ITEMS_TABLE)
        .select(
          [
            "id",
            "name",
            "sku",
            "barcode",
            "description",
            "category",
            "location",
            "supplier",
            "quantity",
            "reorder_level",
            "target_level",
            "unit_cost",
            "sale_price",
            "is_active",
            "created_at",
            "updated_at",
            "created_by",
            "created_by_name",
            "updated_by",
            "updated_by_name",
          ].join(","),
        )
        .eq("id", id)
        .maybeSingle<StockItemRow>();

    if (existingError) {
      throw new Error(
        `Could not read stock item: ${existingError.message}`,
      );
    }

    if (!existing) {
      return json(
        {
          ok: false,
          error: "Stock item not found.",
        },
        404,
      );
    }

    const displayName = adminDisplayName(admin);

    const { data, error } = await supabaseAdmin
      .from(STOCK_ITEMS_TABLE)
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
        updated_by: admin.id,
        updated_by_name: displayName,
      })
      .eq("id", id)
      .select(
        [
          "id",
          "name",
          "sku",
          "barcode",
          "description",
          "category",
          "location",
          "supplier",
          "quantity",
          "reorder_level",
          "target_level",
          "unit_cost",
          "sale_price",
          "is_active",
          "created_at",
          "updated_at",
          "created_by",
          "created_by_name",
          "updated_by",
          "updated_by_name",
        ].join(","),
      )
      .single<StockItemRow>();

    if (error || !data) {
      console.error(`${ROUTE_NAME} DELETE failed:`, error);

      return json(
        {
          ok: false,
          error: "The stock item could not be archived.",
        },
        500,
      );
    }

    const item = mapItem(data);

    await writeAudit({
      admin,
      action: "stock_item_archived",
      status: "success",
      riskLevel: "high",
      targetId: item.id,
      targetLabel: item.name,
      metadata: {
        sku: item.sku,
        quantity: item.quantity,
        previous_active_state: existing.is_active !== false,
      },
    });

    return json({
      ok: true,
      item,
      message: "Stock item archived.",
    });
  } catch (error) {
    console.error(`${ROUTE_NAME} DELETE threw:`, error);

    return json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "The stock item could not be archived.",
      },
      500,
    );
  }
}
