import { NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { writeStockAuditLog } from "@/lib/stockManagement/writeStockAuditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminIdentity = {
  id?: string | null;
  name?: string | null;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
};

type ReceiveBody = {
  deliveryReference?: unknown;
  notes?: unknown;
  items?: unknown;
};

type ReceiveItemBody = {
  orderLineId?: unknown;
  quantityReceived?: unknown;
  quantityDamaged?: unknown;
  destinationLocationId?: unknown;
};

function clean(value: unknown, max = 2000) {
  const result = typeof value === "string" ? value.trim() : "";
  return result ? result.slice(0, max) : "";
}

function whole(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function adminName(admin: AdminIdentity) {
  return (
    clean(admin.full_name, 250) ||
    clean(admin.name, 250) ||
    clean(admin.email, 250) ||
    "Administrator"
  );
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const admin = (await getCurrentAdmin()) as AdminIdentity | null;

  if (!admin?.id && !admin?.email) {
    return json({ ok: false, error: "Unauthorised." }, 401);
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as ReceiveBody | null;

  const receiveItems = Array.isArray(body?.items)
    ? (body?.items as ReceiveItemBody[])
    : [];

  if (receiveItems.length === 0) {
    return json(
      { ok: false, error: "Add at least one received item." },
      400,
    );
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from("stock_orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (orderError) {
    return json(
      {
        ok: false,
        error: "The order could not be loaded.",
        code: orderError.code,
        details: orderError.details,
        hint: orderError.hint,
      },
      500,
    );
  }

  if (!order) {
    return json({ ok: false, error: "Stock order not found." }, 404);
  }

  if (!["ordered", "partially_received"].includes(order.status)) {
    return json(
      {
        ok: false,
        error:
          "Only ordered or partially received orders can receive deliveries.",
      },
      409,
    );
  }

  const { data: lines, error: lineError } = await supabaseAdmin
    .from("stock_order_items")
    .select("*")
    .eq("order_id", id);

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

  const lineById = new Map((lines || []).map((line) => [line.id, line]));
  const now = new Date().toISOString();
  const name = adminName(admin);

  const { data: receipt, error: receiptError } = await supabaseAdmin
    .from("stock_order_receipts")
    .insert({
      order_id: id,
      received_at: now,
      received_by: admin.id || null,
      received_by_name: name,
      delivery_reference:
        clean(body?.deliveryReference, 250) || null,
      notes: clean(body?.notes, 2000) || null,
    })
    .select("*")
    .single();

  if (receiptError || !receipt) {
    return json(
      {
        ok: false,
        error: "The delivery record could not be created.",
        code: receiptError?.code,
        details: receiptError?.details,
        hint: receiptError?.hint,
      },
      500,
    );
  }

  const receiptRows: Array<Record<string, unknown>> = [];
  const auditItems: Array<Record<string, unknown>> = [];

  for (const receiveItem of receiveItems) {
    const lineId = clean(receiveItem.orderLineId, 100);
    const line = lineById.get(lineId);

    if (!line) continue;

    const quantityReceived = whole(receiveItem.quantityReceived);
    const quantityDamaged = whole(receiveItem.quantityDamaged) || 0;

    if (!quantityReceived || quantityReceived < 1) continue;

    const remaining =
      Number(line.quantity_ordered || 0) -
      Number(line.quantity_received || 0);

    if (quantityReceived > remaining) {
      await supabaseAdmin
        .from("stock_order_receipts")
        .delete()
        .eq("id", receipt.id);

      return json(
        {
          ok: false,
          error: `Only ${remaining} unit${
            remaining === 1 ? "" : "s"
          } remain outstanding for ${line.item_name}.`,
        },
        409,
      );
    }

    const usableQuantity = Math.max(
      0,
      quantityReceived - quantityDamaged,
    );

    const destinationLocationId =
      clean(receiveItem.destinationLocationId, 100) ||
      line.destination_location_id ||
      null;

    if (line.stock_item_id && usableQuantity > 0) {
      const { data: stockItem, error: stockError } = await supabaseAdmin
        .from("stock_items")
        .select("id,quantity,location_id,name,sku")
        .eq("id", line.stock_item_id)
        .maybeSingle();

      if (stockError || !stockItem) {
        await supabaseAdmin
          .from("stock_order_receipts")
          .delete()
          .eq("id", receipt.id);

        return json(
          {
            ok: false,
            error: `The inventory item for ${line.item_name} could not be updated.`,
            code: stockError?.code,
            details: stockError?.details,
            hint: stockError?.hint,
          },
          500,
        );
      }

      const beforeQuantity = Number(stockItem.quantity || 0);
      const afterQuantity = beforeQuantity + usableQuantity;

      const { error: updateStockError } = await supabaseAdmin
        .from("stock_items")
        .update({
          quantity: afterQuantity,
          location_id: destinationLocationId,
          updated_at: now,
          updated_by: admin.id || null,
          updated_by_name: name,
        })
        .eq("id", stockItem.id);

      if (updateStockError) {
        await supabaseAdmin
          .from("stock_order_receipts")
          .delete()
          .eq("id", receipt.id);

        return json(
          {
            ok: false,
            error: `Inventory could not be updated for ${line.item_name}.`,
            code: updateStockError.code,
            details: updateStockError.details,
            hint: updateStockError.hint,
          },
          500,
        );
      }

      auditItems.push({
        stockItemId: stockItem.id,
        itemName: line.item_name,
        quantityBefore: beforeQuantity,
        quantityReceived: usableQuantity,
        quantityAfter: afterQuantity,
        destinationLocationId,
      });
    }

    const newReceivedTotal =
      Number(line.quantity_received || 0) + quantityReceived;

    await supabaseAdmin
      .from("stock_order_items")
      .update({
        quantity_received: newReceivedTotal,
        destination_location_id: destinationLocationId,
        updated_at: now,
      })
      .eq("id", line.id);

    receiptRows.push({
      receipt_id: receipt.id,
      order_line_id: line.id,
      quantity_received: quantityReceived,
      quantity_damaged: quantityDamaged,
      destination_location_id: destinationLocationId,
    });
  }

  if (receiptRows.length === 0) {
    await supabaseAdmin
      .from("stock_order_receipts")
      .delete()
      .eq("id", receipt.id);

    return json(
      {
        ok: false,
        error: "No valid received quantities were supplied.",
      },
      400,
    );
  }

  const { error: receiptItemError } = await supabaseAdmin
    .from("stock_order_receipt_items")
    .insert(receiptRows);

  if (receiptItemError) {
    return json(
      {
        ok: false,
        error:
          "Inventory was updated, but the delivery item records could not be saved.",
        code: receiptItemError.code,
        details: receiptItemError.details,
        hint: receiptItemError.hint,
      },
      500,
    );
  }

  const { data: updatedLines } = await supabaseAdmin
    .from("stock_order_items")
    .select("quantity_ordered,quantity_received")
    .eq("order_id", id);

  const fullyReceived = (updatedLines || []).every(
    (line) =>
      Number(line.quantity_received || 0) >=
      Number(line.quantity_ordered || 0),
  );

  const nextStatus = fullyReceived
    ? "received"
    : "partially_received";

  await supabaseAdmin
    .from("stock_orders")
    .update({
      status: nextStatus,
      received_date: fullyReceived ? now.slice(0, 10) : null,
      updated_at: now,
      updated_by: admin.id || null,
      updated_by_name: name,
    })
    .eq("id", id);

  await writeStockAuditLog({
    actionKey: fullyReceived
      ? "stock_order_delivery_received"
      : "stock_order_partially_received",
    actionLabel: fullyReceived
      ? "Stock order fully received"
      : "Stock order partially received",
    actionCategory: "adjust",
    module: "orders",
    status: "success",
    riskLevel: "medium",
    admin: {
      id: admin.id || null,
      name,
      email: admin.email || null,
      role: admin.role || null,
    },
    description: `${order.order_number} received ${receiptRows.length} delivery line${
      receiptRows.length === 1 ? "" : "s"
    }.`,
    reason: clean(body?.notes, 2000) || null,
    recordType: "stock_order",
    recordId: id,
    recordName: order.title,
    recordReference: order.order_number,
    oldValues: order,
    newValues: {
      status: nextStatus,
      receipt,
      items: receiptRows,
      inventoryChanges: auditItems,
    },
    changedFields: [
      "status",
      "quantity_received",
      "inventory_quantity",
    ],
    request,
    responseStatus: 200,
    apiEndpoint: request.nextUrl.pathname,
    metadata: {
      source: "stock_order_receive_api",
      fullyReceived,
      receiptId: receipt.id,
      receiptLineCount: receiptRows.length,
    },
  });

  return json({
    ok: true,
    status: nextStatus,
    receipt,
    message: fullyReceived
      ? `${order.order_number} has been fully received.`
      : `${order.order_number} has been partially received.`,
  });
}
