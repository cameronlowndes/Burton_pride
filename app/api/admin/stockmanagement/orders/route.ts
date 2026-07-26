import { NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { writeStockAuditLog } from "@/lib/stockManagement/writeStockAuditLog";
import {
  calculateOrderTotals,
  createOrderNumber,
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

type CreateBody = {
  title?: unknown;
  supplierId?: unknown;
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

type CreateLineBody = {
  stockItemId?: unknown;
  itemName?: unknown;
  sku?: unknown;
  quantityOrdered?: unknown;
  estimatedUnitCost?: unknown;
  destinationLocationId?: unknown;
  notes?: unknown;
};

function clean(value: unknown, max = 1000) {
  const result = typeof value === "string" ? value.trim() : "";
  return result ? result.slice(0, max) : "";
}

function amount(value: unknown) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Number(parsed.toFixed(2));
}

function whole(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function adminName(admin: AdminIdentity) {
  return (
    clean(admin.full_name, 250) ||
    clean(admin.name, 250) ||
    clean(admin.email, 250) ||
    "Administrator"
  );
}

async function requireAdmin() {
  const admin = (await getCurrentAdmin()) as AdminIdentity | null;
  return admin?.id || admin?.email ? admin : null;
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();

  if (!admin) {
    return json({ ok: false, error: "Unauthorised." }, 401);
  }

  const params = request.nextUrl.searchParams;
  const search = clean(params.get("search"), 250);
  const status = clean(params.get("status"), 100);

  let query = supabaseAdmin
    .from("stock_orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (search) {
    const safe = search.replaceAll(",", " ");
    query = query.or(
      [
        `order_number.ilike.%${safe}%`,
        `title.ilike.%${safe}%`,
        `supplier_name.ilike.%${safe}%`,
        `supplier_reference.ilike.%${safe}%`,
        `invoice_number.ilike.%${safe}%`,
      ].join(","),
    );
  }

  const { data: orderRows, error } = await query;

  if (error) {
    return json(
      {
        ok: false,
        error: "Orders could not be loaded.",
        code: error.code,
        details: error.details,
        hint: error.hint,
      },
      500,
    );
  }

  const orderIds = (orderRows || []).map((row) => row.id);

  const { data: lineRows, error: lineError } = orderIds.length
    ? await supabaseAdmin
        .from("stock_order_items")
        .select("*")
        .in("order_id", orderIds)
        .order("created_at", { ascending: true })
    : { data: [], error: null };

  if (lineError) {
    return json(
      {
        ok: false,
        error: "Orders loaded, but their items could not be loaded.",
        code: lineError.code,
        details: lineError.details,
        hint: lineError.hint,
      },
      500,
    );
  }

  const linesByOrder = new Map<string, ReturnType<typeof mapOrderLine>[]>();

  for (const row of lineRows || []) {
    const line = mapOrderLine(row);
    const current = linesByOrder.get(line.orderId) || [];
    current.push(line);
    linesByOrder.set(line.orderId, current);
  }

  const orders = (orderRows || []).map((row) =>
    mapOrder(row, linesByOrder.get(String(row.id)) || []),
  );

  const today = new Date().toISOString().slice(0, 10);

  const summary = {
    draft: orders.filter((order) => order.status === "draft").length,
    awaitingApproval: orders.filter(
      (order) => order.status === "awaiting_approval",
    ).length,
    approved: orders.filter((order) => order.status === "approved").length,
    ordered: orders.filter((order) => order.status === "ordered").length,
    partiallyReceived: orders.filter(
      (order) => order.status === "partially_received",
    ).length,
    overdue: orders.filter(
      (order) =>
        ["ordered", "partially_received"].includes(order.status) &&
        Boolean(order.expectedDeliveryDate) &&
        String(order.expectedDeliveryDate) < today,
    ).length,
    outstandingEstimatedCost: Number(
      orders
        .filter(
          (order) =>
            !["received", "cancelled"].includes(order.status),
        )
        .reduce((total, order) => total + order.estimatedTotal, 0)
        .toFixed(2),
    ),
  };

  return json({ ok: true, orders, summary });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();

  if (!admin) {
    return json({ ok: false, error: "Unauthorised." }, 401);
  }

  const body = (await request.json().catch(() => null)) as CreateBody | null;

  if (!body) {
    return json({ ok: false, error: "Valid JSON is required." }, 400);
  }

  const title = clean(body.title, 250);
  const supplierName = clean(body.supplierName, 250);
  const rawLines = Array.isArray(body.lines)
    ? (body.lines as CreateLineBody[])
    : [];

  if (!title) {
    return json({ ok: false, error: "Order title is required." }, 400);
  }

  if (!supplierName) {
    return json({ ok: false, error: "Supplier name is required." }, 400);
  }

  const lines = rawLines
    .map((line) => ({
      stockItemId: clean(line.stockItemId, 100) || null,
      itemName: clean(line.itemName, 250),
      sku: clean(line.sku, 150) || null,
      quantityOrdered: whole(line.quantityOrdered),
      estimatedUnitCost:
        line.estimatedUnitCost === null ||
        line.estimatedUnitCost === undefined ||
        line.estimatedUnitCost === ""
          ? null
          : amount(line.estimatedUnitCost),
      destinationLocationId:
        clean(line.destinationLocationId, 100) || null,
      notes: clean(line.notes, 1000) || null,
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
        error: "Add at least one valid item to the order.",
      },
      400,
    );
  }

  const totals = calculateOrderTotals(
    lines.map((line) => ({
      quantityOrdered: Number(line.quantityOrdered),
      estimatedUnitCost: line.estimatedUnitCost,
    })),
    amount(body.estimatedDelivery),
    amount(body.estimatedVat),
    amount(body.estimatedDiscount),
  );

  const { count, error: countError } = await supabaseAdmin
    .from("stock_orders")
    .select("id", { count: "exact", head: true });

  if (countError) {
    return json(
      {
        ok: false,
        error: "The next order number could not be generated.",
        code: countError.code,
        details: countError.details,
        hint: countError.hint,
      },
      500,
    );
  }

  const orderNumber = createOrderNumber(Number(count || 0) + 1);
  const now = new Date().toISOString();
  const name = adminName(admin);

  const { data: orderRow, error: orderError } = await supabaseAdmin
    .from("stock_orders")
    .insert({
      order_number: orderNumber,
      title,
      supplier_id: clean(body.supplierId, 100) || null,
      supplier_name: supplierName,
      supplier_reference: clean(body.supplierReference, 250) || null,
      status: "draft",
      money_budget_id: clean(body.moneyBudgetId, 100) || null,
      estimated_subtotal: totals.subtotal,
      estimated_delivery: totals.delivery,
      estimated_vat: totals.vat,
      estimated_discount: totals.discount,
      estimated_total: totals.total,
      expected_delivery_date:
        clean(body.expectedDeliveryDate, 20) || null,
      reason: clean(body.reason, 2000) || null,
      notes: clean(body.notes, 5000) || null,
      created_at: now,
      created_by: admin.id || null,
      created_by_name: name,
      updated_at: now,
      updated_by: admin.id || null,
      updated_by_name: name,
    })
    .select("*")
    .single();

  if (orderError || !orderRow) {
    return json(
      {
        ok: false,
        error: "The stock order could not be created.",
        code: orderError?.code,
        details: orderError?.details,
        hint: orderError?.hint,
      },
      500,
    );
  }

  const lineInsert = lines.map((line) => ({
    order_id: orderRow.id,
    stock_item_id: line.stockItemId,
    item_name: line.itemName,
    sku: line.sku,
    quantity_ordered: line.quantityOrdered,
    quantity_received: 0,
    estimated_unit_cost: line.estimatedUnitCost,
    actual_unit_cost: null,
    destination_location_id: line.destinationLocationId,
    notes: line.notes,
    created_at: now,
    updated_at: now,
  }));

  const { data: createdLines, error: lineError } = await supabaseAdmin
    .from("stock_order_items")
    .insert(lineInsert)
    .select("*");

  if (lineError) {
    await supabaseAdmin
      .from("stock_orders")
      .delete()
      .eq("id", orderRow.id);

    return json(
      {
        ok: false,
        error: "The order was started, but its items could not be saved.",
        code: lineError.code,
        details: lineError.details,
        hint: lineError.hint,
      },
      500,
    );
  }

  await writeStockAuditLog({
    actionKey: "stock_order_created",
    actionLabel: "Stock order created",
    actionCategory: "create",
    module: "orders",
    status: "success",
    riskLevel: "low",
    admin: {
      id: admin.id || null,
      name,
      email: admin.email || null,
      role: admin.role || null,
    },
    description: `${orderNumber} was created for ${supplierName}.`,
    reason: clean(body.reason, 2000) || null,
    recordType: "stock_order",
    recordId: orderRow.id,
    recordName: title,
    recordReference: orderNumber,
    newValues: {
      ...orderRow,
      lines: createdLines,
    },
    changedFields: [
      "title",
      "supplier_name",
      "status",
      "estimated_total",
      "lines",
    ],
    request,
    responseStatus: 201,
    apiEndpoint: request.nextUrl.pathname,
    metadata: {
      source: "stock_orders_api",
      lineCount: createdLines?.length || 0,
      estimatedTotal: totals.total,
      moneyBudgetId: clean(body.moneyBudgetId, 100) || null,
    },
  });

  return json(
    {
      ok: true,
      order: mapOrder(
        orderRow,
        (createdLines || []).map(mapOrderLine),
      ),
      message: `${orderNumber} was created successfully.`,
    },
    201,
  );
}
