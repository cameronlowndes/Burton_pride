import { type NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE_NAME =
  "/api/admin/stock-management/inventory/movements";

const STOCK_ITEMS_TABLE = "stock_items";
const STOCK_MOVEMENTS_TABLE = "stock_movements";
const AUDIT_TABLE = "admin_audit_logs";

type MovementType = "add" | "remove" | "set";

type AdminIdentity = {
  id: string;
  email?: string | null;
  name?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  role?: string | null;
};

type MovementBody = {
  stockItemId?: unknown;
  movementType?: unknown;
  quantity?: unknown;
  reason?: unknown;
  notes?: unknown;
};

type StockItemRow = {
  id: string;
  name: string;
  sku: string;
  quantity: number | null;
  reorder_level: number | null;
  unit_cost: number | null;
  is_active: boolean | null;
  updated_at: string | null;
};

type StockMovementRow = {
  id: string;
  stock_item_id: string;
  movement_type: MovementType;
  quantity: number;
  quantity_before: number;
  quantity_after: number;
  reason: string;
  notes: string | null;
  admin_id: string | null;
  admin_name: string | null;
  admin_email: string | null;
  created_at: string;
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

function finiteNumber(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : Number(typeof value === "string" ? value.trim() : value);

  return Number.isFinite(parsed) ? parsed : null;
}

function isMovementType(value: unknown): value is MovementType {
  return value === "add" || value === "remove" || value === "set";
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
        method: "POST",
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

function calculateQuantityAfter(params: {
  movementType: MovementType;
  currentQuantity: number;
  quantity: number;
}): number {
  if (params.movementType === "add") {
    return params.currentQuantity + params.quantity;
  }

  if (params.movementType === "remove") {
    return params.currentQuantity - params.quantity;
  }

  return params.quantity;
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

  let body: MovementBody;

  try {
    body = (await request.json()) as MovementBody;
  } catch {
    return json(
      {
        ok: false,
        error: "Invalid request body.",
      },
      400,
    );
  }

  const stockItemId = cleanString(body.stockItemId);
  const movementType = body.movementType;
  const quantity = finiteNumber(body.quantity);
  const reason = cleanString(body.reason);
  const notes = nullableString(body.notes);

  if (!stockItemId) {
    return json(
      {
        ok: false,
        error: "Stock item ID is required.",
      },
      400,
    );
  }

  if (!isMovementType(movementType)) {
    return json(
      {
        ok: false,
        error: "Movement type must be add, remove or set.",
      },
      400,
    );
  }

  if (quantity === null || quantity < 0) {
    return json(
      {
        ok: false,
        error: "Quantity must be zero or more.",
      },
      400,
    );
  }

  if (
    movementType !== "set" &&
    quantity === 0
  ) {
    return json(
      {
        ok: false,
        error: "Quantity must be greater than zero.",
      },
      400,
    );
  }

  if (!reason) {
    return json(
      {
        ok: false,
        error: "A reason is required for every stock movement.",
      },
      400,
    );
  }

  if (reason.length > 250) {
    return json(
      {
        ok: false,
        error: "Reason must be 250 characters or fewer.",
      },
      400,
    );
  }

  if (notes && notes.length > 2000) {
    return json(
      {
        ok: false,
        error: "Notes must be 2,000 characters or fewer.",
      },
      400,
    );
  }

  try {
    const { data: item, error: itemError } =
      await supabaseAdmin
        .from(STOCK_ITEMS_TABLE)
        .select(
          [
            "id",
            "name",
            "sku",
            "quantity",
            "reorder_level",
            "unit_cost",
            "is_active",
            "updated_at",
          ].join(","),
        )
        .eq("id", stockItemId)
        .maybeSingle<StockItemRow>();

    if (itemError) {
      console.error(
        `${ROUTE_NAME} stock item lookup failed:`,
        itemError,
      );

      return json(
        {
          ok: false,
          error: "Unable to load the stock item.",
        },
        500,
      );
    }

    if (!item) {
      return json(
        {
          ok: false,
          error: "Stock item not found.",
        },
        404,
      );
    }

    if (item.is_active === false) {
      return json(
        {
          ok: false,
          error: "Archived stock items cannot be adjusted.",
        },
        409,
      );
    }

    const quantityBefore = Number(item.quantity || 0);
    const quantityAfter = calculateQuantityAfter({
      movementType,
      currentQuantity: quantityBefore,
      quantity,
    });

    if (quantityAfter < 0) {
      return json(
        {
          ok: false,
          error:
            "This adjustment would make the stock quantity negative.",
        },
        409,
      );
    }

    const now = new Date().toISOString();
    const displayName = adminDisplayName(admin);

    /*
     * Update the item first. The optimistic guard on quantity and updated_at
     * helps reduce the chance of two admins silently overwriting each other.
     */
    let updateQuery = supabaseAdmin
      .from(STOCK_ITEMS_TABLE)
      .update({
        quantity: quantityAfter,
        updated_at: now,
        updated_by: admin.id,
        updated_by_name: displayName,
      })
      .eq("id", stockItemId)
      .eq("quantity", quantityBefore);

    if (item.updated_at) {
      updateQuery = updateQuery.eq(
        "updated_at",
        item.updated_at,
      );
    }

    const { data: updatedItem, error: updateError } =
      await updateQuery
        .select(
          [
            "id",
            "name",
            "sku",
            "quantity",
            "reorder_level",
            "unit_cost",
            "is_active",
            "updated_at",
          ].join(","),
        )
        .maybeSingle<StockItemRow>();

    if (updateError) {
      console.error(
        `${ROUTE_NAME} stock item update failed:`,
        updateError,
      );

      return json(
        {
          ok: false,
          error: "The stock quantity could not be updated.",
        },
        500,
      );
    }

    if (!updatedItem) {
      return json(
        {
          ok: false,
          error:
            "This stock item was changed by another administrator. Refresh the inventory and try again.",
        },
        409,
      );
    }

    const movementQuantity =
      movementType === "set"
        ? Math.abs(quantityAfter - quantityBefore)
        : quantity;

    const { data: movement, error: movementError } =
      await supabaseAdmin
        .from(STOCK_MOVEMENTS_TABLE)
        .insert({
          stock_item_id: stockItemId,
          movement_type: movementType,
          quantity: movementQuantity,
          quantity_before: quantityBefore,
          quantity_after: quantityAfter,
          reason,
          notes,
          admin_id: admin.id,
          admin_name: displayName,
          admin_email: admin.email || null,
          created_at: now,
        })
        .select(
          [
            "id",
            "stock_item_id",
            "movement_type",
            "quantity",
            "quantity_before",
            "quantity_after",
            "reason",
            "notes",
            "admin_id",
            "admin_name",
            "admin_email",
            "created_at",
          ].join(","),
        )
        .single<StockMovementRow>();

    if (movementError || !movement) {
      console.error(
        `${ROUTE_NAME} movement insert failed:`,
        movementError,
      );

      /*
       * Best-effort rollback so the quantity and movement history do not drift.
       */
      const rollback = await supabaseAdmin
        .from(STOCK_ITEMS_TABLE)
        .update({
          quantity: quantityBefore,
          updated_at: new Date().toISOString(),
          updated_by: admin.id,
          updated_by_name: displayName,
        })
        .eq("id", stockItemId)
        .eq("quantity", quantityAfter);

      if (rollback.error) {
        console.error(
          `${ROUTE_NAME} rollback failed:`,
          rollback.error,
        );
      }

      return json(
        {
          ok: false,
          error:
            "The movement record could not be saved. The stock quantity was restored where possible.",
        },
        500,
      );
    }

    await writeAudit({
      admin,
      action: "stock_quantity_adjusted",
      status: "success",
      riskLevel:
        movementType === "remove" ? "high" : "medium",
      targetId: stockItemId,
      targetLabel: item.name,
      metadata: {
        sku: item.sku,
        movement_id: movement.id,
        movement_type: movementType,
        movement_quantity: movementQuantity,
        quantity_before: quantityBefore,
        quantity_after: quantityAfter,
        reason,
        notes_present: Boolean(notes),
      },
    });

    return json(
      {
        ok: true,
        item: {
          id: updatedItem.id,
          name: updatedItem.name,
          sku: updatedItem.sku,
          quantity: Number(updatedItem.quantity || 0),
          reorderLevel: Number(
            updatedItem.reorder_level || 0,
          ),
          unitCost:
            updatedItem.unit_cost === null ||
            updatedItem.unit_cost === undefined
              ? null
              : Number(updatedItem.unit_cost),
          updatedAt: updatedItem.updated_at,
          updatedByName: displayName,
        },
        movement: {
          id: movement.id,
          stockItemId: movement.stock_item_id,
          movementType: movement.movement_type,
          quantity: movement.quantity,
          quantityBefore: movement.quantity_before,
          quantityAfter: movement.quantity_after,
          reason: movement.reason,
          notes: movement.notes,
          adminId: movement.admin_id,
          adminName: movement.admin_name,
          adminEmail: movement.admin_email,
          createdAt: movement.created_at,
        },
        message: "Stock quantity updated.",
      },
      201,
    );
  } catch (error) {
    console.error(`${ROUTE_NAME} failed:`, error);

    return json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "The stock movement could not be completed.",
      },
      500,
    );
  }
}
