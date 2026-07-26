import { NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { writeStockAuditLog } from "@/lib/stockManagement/writeStockAuditLog";
import {
  calculateOrderTotals,
  mapOrder,
  mapOrderLine,
} from "@/lib/stockManagement/orders/helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminIdentity = {
  id?: string | null;
  name?: string | null;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
};

type UpdateLineBody = {
  id?: unknown;
  stockItemId?: unknown;
  itemName?: unknown;
  sku?: unknown;
  quantityOrdered?: unknown;
  estimatedUnitCost?: unknown;
  destinationLocationId?: unknown;
  notes?: unknown;
};

type UpdateBody = {
  title?: unknown;
  supplierName?: unknown;
  supplierReference?: unknown;
  moneyBudgetId?: unknown;
  expectedDeliveryDate?: unknown;
  reason?: unknown;
  notes?: unknown;
  estimatedDelivery?: unknown;
  estimatedVat?: unknown;
  estimatedDiscount?: unknown;
  lines?: unknown;
};

function clean(value: unknown, max = 2000) {
  const result =
    typeof value === "string"
      ? value.trim()
      : "";

  return result.slice(0, max);
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Number(parsed.toFixed(2));
}

function positiveInteger(value: unknown) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : null;
}

function adminName(admin: AdminIdentity) {
  return (
    clean(admin.full_name, 250) ||
    clean(admin.name, 250) ||
    clean(admin.email, 250) ||
    "Administrator"
  );
}

function json(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function requireAdmin() {
  const admin =
    (await getCurrentAdmin()) as AdminIdentity | null;

  return admin?.id || admin?.email
    ? admin
    : null;
}

export async function GET(
  _request: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const admin = await requireAdmin();

  if (!admin) {
    return json(
      {
        ok: false,
        error: "Unauthorised.",
        code: "UNAUTHORISED",
      },
      401,
    );
  }

  const { id } = await context.params;

  const { data: orderRow, error } =
    await supabaseAdmin
      .from("stock_orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();

  if (error) {
    return json(
      {
        ok: false,
        error: "The stock order could not be loaded.",
        code: error.code,
        details: error.details,
        hint: error.hint,
      },
      500,
    );
  }

  if (!orderRow) {
    return json(
      {
        ok: false,
        error: "Stock order not found.",
        code: "STOCK_ORDER_NOT_FOUND",
      },
      404,
    );
  }

  const { data: lineRows, error: lineError } =
    await supabaseAdmin
      .from("stock_order_items")
      .select("*")
      .eq("order_id", id)
      .order("created_at", {
        ascending: true,
      });

  if (lineError) {
    return json(
      {
        ok: false,
        error: "The order items could not be loaded.",
        code: lineError.code,
        details: lineError.details,
        hint: lineError.hint,
      },
      500,
    );
  }

  return json({
    ok: true,
    order: mapOrder(
      orderRow,
      (lineRows || []).map(mapOrderLine),
    ),
  });
}

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const admin = await requireAdmin();

  if (!admin) {
    return json(
      {
        ok: false,
        error: "Unauthorised.",
        code: "UNAUTHORISED",
      },
      401,
    );
  }

  const { id } = await context.params;
  const body =
    (await request.json().catch(() => null)) as
      | UpdateBody
      | null;

  if (!body) {
    return json(
      {
        ok: false,
        error: "Valid JSON is required.",
        code: "INVALID_JSON",
      },
      400,
    );
  }

  const { data: existingOrder, error: existingError } =
    await supabaseAdmin
      .from("stock_orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();

  if (existingError) {
    return json(
      {
        ok: false,
        error: "The existing order could not be loaded.",
        code: existingError.code,
        details: existingError.details,
        hint: existingError.hint,
      },
      500,
    );
  }

  if (!existingOrder) {
    return json(
      {
        ok: false,
        error: "Stock order not found.",
        code: "STOCK_ORDER_NOT_FOUND",
      },
      404,
    );
  }

  if (
    !["draft", "awaiting_approval"].includes(
      existingOrder.status,
    )
  ) {
    return json(
      {
        ok: false,
        error:
          "Only draft orders or orders awaiting approval can be edited.",
        code: "STOCK_ORDER_EDIT_NOT_ALLOWED",
        field: "status",
        details: `Current status: ${existingOrder.status}`,
      },
      409,
    );
  }

  const title = clean(body.title, 250);
  const supplierName = clean(
    body.supplierName,
    250,
  );

  if (!title) {
    return json(
      {
        ok: false,
        error: "Order title is required.",
        code: "ORDER_TITLE_REQUIRED",
        field: "title",
      },
      400,
    );
  }

  if (!supplierName) {
    return json(
      {
        ok: false,
        error: "Supplier name is required.",
        code: "SUPPLIER_REQUIRED",
        field: "supplierName",
      },
      400,
    );
  }

  const rawLines = Array.isArray(body.lines)
    ? (body.lines as UpdateLineBody[])
    : [];

  const lines = rawLines
    .map((line) => ({
      id: clean(line.id, 100) || null,
      stockItemId:
        clean(line.stockItemId, 100) || null,
      itemName:
        clean(line.itemName, 250),
      sku:
        clean(line.sku, 150) || null,
      quantityOrdered:
        positiveInteger(line.quantityOrdered),
      estimatedUnitCost:
        line.estimatedUnitCost === null ||
        line.estimatedUnitCost === undefined ||
        line.estimatedUnitCost === ""
          ? null
          : numberValue(
              line.estimatedUnitCost,
            ),
      destinationLocationId:
        clean(
          line.destinationLocationId,
          100,
        ) || null,
      notes:
        clean(line.notes, 2000) || null,
    }))
    .filter(
      (line) =>
        line.itemName &&
        line.quantityOrdered !== null,
    );

  if (lines.length === 0) {
    return json(
      {
        ok: false,
        error:
          "Add at least one valid item to the order.",
        code: "ORDER_ITEMS_REQUIRED",
        field: "lines",
      },
      400,
    );
  }

  const totals = calculateOrderTotals(
    lines.map((line) => ({
      quantityOrdered:
        Number(line.quantityOrdered),
      estimatedUnitCost:
        line.estimatedUnitCost,
    })),
    numberValue(body.estimatedDelivery),
    numberValue(body.estimatedVat),
    numberValue(body.estimatedDiscount),
  );

  const now = new Date().toISOString();
  const name = adminName(admin);

  const orderUpdate = {
    title,
    supplier_name: supplierName,
    supplier_reference:
      clean(body.supplierReference, 250) || null,
    money_budget_id:
      clean(body.moneyBudgetId, 100) || null,
    expected_delivery_date:
      clean(body.expectedDeliveryDate, 20) || null,
    reason:
      clean(body.reason, 3000) || null,
    notes:
      clean(body.notes, 5000) || null,
    estimated_subtotal:
      totals.subtotal,
    estimated_delivery:
      totals.delivery,
    estimated_vat:
      totals.vat,
    estimated_discount:
      totals.discount,
    estimated_total:
      totals.total,
    updated_at: now,
    updated_by:
      admin.id || null,
    updated_by_name: name,
  };

  const { data: updatedOrder, error: updateError } =
    await supabaseAdmin
      .from("stock_orders")
      .update(orderUpdate)
      .eq("id", id)
      .select("*")
      .single();

  if (updateError || !updatedOrder) {
    return json(
      {
        ok: false,
        error: "The order details could not be updated.",
        code:
          updateError?.code ||
          "ORDER_UPDATE_FAILED",
        details:
          updateError?.details || null,
        hint:
          updateError?.hint || null,
      },
      500,
    );
  }

  const { data: existingLines, error: existingLinesError } =
    await supabaseAdmin
      .from("stock_order_items")
      .select("*")
      .eq("order_id", id);

  if (existingLinesError) {
    return json(
      {
        ok: false,
        error:
          "The order was updated, but existing items could not be checked.",
        code: existingLinesError.code,
        details: existingLinesError.details,
        hint: existingLinesError.hint,
      },
      500,
    );
  }

  const existingLineIds = new Set(
    (existingLines || []).map((line) =>
      String(line.id),
    ),
  );

  const incomingExistingIds = new Set(
    lines
      .map((line) => line.id)
      .filter(
        (lineId): lineId is string =>
          Boolean(
            lineId &&
              existingLineIds.has(lineId),
          ),
      ),
  );

  const removedLineIds =
    (existingLines || [])
      .map((line) => String(line.id))
      .filter(
        (lineId) =>
          !incomingExistingIds.has(lineId),
      );

  if (removedLineIds.length > 0) {
    const { error: deleteLineError } =
      await supabaseAdmin
        .from("stock_order_items")
        .delete()
        .eq("order_id", id)
        .in("id", removedLineIds);

    if (deleteLineError) {
      return json(
        {
          ok: false,
          error:
            "The order details were updated, but removed items could not be deleted.",
          code: deleteLineError.code,
          details: deleteLineError.details,
          hint: deleteLineError.hint,
        },
        500,
      );
    }
  }

  for (const line of lines) {
    const lineData = {
      stock_item_id:
        line.stockItemId,
      item_name:
        line.itemName,
      sku:
        line.sku,
      quantity_ordered:
        line.quantityOrdered,
      estimated_unit_cost:
        line.estimatedUnitCost,
      destination_location_id:
        line.destinationLocationId,
      notes:
        line.notes,
      updated_at:
        now,
    };

    if (
      line.id &&
      existingLineIds.has(line.id)
    ) {
      const { error: lineUpdateError } =
        await supabaseAdmin
          .from("stock_order_items")
          .update(lineData)
          .eq("order_id", id)
          .eq("id", line.id);

      if (lineUpdateError) {
        return json(
          {
            ok: false,
            error:
              `The order item "${line.itemName}" could not be updated.`,
            code: lineUpdateError.code,
            details: lineUpdateError.details,
            hint: lineUpdateError.hint,
            field: "lines",
          },
          500,
        );
      }
    } else {
      const { error: lineInsertError } =
        await supabaseAdmin
          .from("stock_order_items")
          .insert({
            order_id: id,
            ...lineData,
            quantity_received: 0,
            created_at: now,
          });

      if (lineInsertError) {
        return json(
          {
            ok: false,
            error:
              `The new order item "${line.itemName}" could not be added.`,
            code: lineInsertError.code,
            details: lineInsertError.details,
            hint: lineInsertError.hint,
            field: "lines",
          },
          500,
        );
      }
    }
  }

  const { data: finalLines, error: finalLinesError } =
    await supabaseAdmin
      .from("stock_order_items")
      .select("*")
      .eq("order_id", id)
      .order("created_at", {
        ascending: true,
      });

  if (finalLinesError) {
    return json(
      {
        ok: false,
        error:
          "The order was updated, but the final item list could not be loaded.",
        code: finalLinesError.code,
        details: finalLinesError.details,
        hint: finalLinesError.hint,
      },
      500,
    );
  }

  const finalOrder = mapOrder(
    updatedOrder,
    (finalLines || []).map(mapOrderLine),
  );

  await writeStockAuditLog({
    actionKey:
      "stock_order_updated",
    actionLabel:
      "Stock order updated",
    actionCategory:
      "update",
    module:
      "orders",
    status:
      "success",
    riskLevel:
      existingOrder.status ===
      "awaiting_approval"
        ? "medium"
        : "low",
    admin: {
      id:
        admin.id || null,
      name,
      email:
        admin.email || null,
      role:
        admin.role || null,
    },
    description:
      `${existingOrder.order_number} was edited. It now contains ${finalOrder.lines.length} item line${finalOrder.lines.length === 1 ? "" : "s"} with an estimated total of £${totals.total.toFixed(2)}.`,
    reason:
      clean(body.reason, 3000) || null,
    recordType:
      "stock_order",
    recordId:
      id,
    recordName:
      title,
    recordReference:
      existingOrder.order_number,
    oldValues: {
      order:
        existingOrder,
      lines:
        existingLines,
    },
    newValues: {
      order:
        updatedOrder,
      lines:
        finalLines,
    },
    changedFields: [
      "title",
      "supplier_name",
      "supplier_reference",
      "money_budget_id",
      "expected_delivery_date",
      "reason",
      "notes",
      "estimated_total",
      "lines",
    ],
    request,
    responseStatus:
      200,
    apiEndpoint:
      request.nextUrl.pathname,
    metadata: {
      source:
        "stock_order_edit_api",
      status:
        existingOrder.status,
      lineCount:
        finalOrder.lines.length,
      removedLineCount:
        removedLineIds.length,
      estimatedTotal:
        totals.total,
    },
  });

  return json({
    ok: true,
    order:
      finalOrder,
    message:
      `${existingOrder.order_number} was updated successfully.`,
  });
}
