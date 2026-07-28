import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import {
  TABLES,
  apiError,
  getSupplierOrThrow,
  isUuid,
  jsonOk,
  nullableText,
  parseBoolean,
  parseNullableDate,
  parseNullableInteger,
  parseNullablePence,
  readJsonBody,
  requireAdmin,
  writeAuditLog,
} from "../../../_lib/supplierApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ supplierId: string; orderId: string }>;
};

type Body = {
  order_number?: unknown;
  status?: unknown;
  order_date?: unknown;
  expected_delivery_date?: unknown;
  delivered_at?: unknown;
  estimated_total_pence?: unknown;
  actual_total_pence?: unknown;
  received_quantity?: unknown;
  missing_quantity?: unknown;
  damaged_quantity?: unknown;
  refund_required?: unknown;
  replacement_required?: unknown;
  notes?: unknown;
  reason?: unknown;
};

async function getOrderOrThrow(supplierId: string, orderId: string) {
  if (!isUuid(orderId)) throw new Error("orderId must be a valid UUID.");

  const { data, error } = await supabaseAdmin
    .from(TABLES.orders)
    .select("*")
    .eq("id", orderId)
    .eq("stock_supplier_profile_id", supplierId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("The supplier order was not found.");

  return data;
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  const { supplierId, orderId } = await context.params;
  const endpoint =
    `PATCH /api/admin/stockmanagement/suppliers/${supplierId}/orders/${orderId}`;

  try {
    const admin = await requireAdmin();
    await getSupplierOrThrow(supplierId);
    const beforeData = await getOrderOrThrow(supplierId, orderId);
    const body = await readJsonBody<Body>(request);

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: admin.id || null,
    };

    if (body.order_number !== undefined)
      payload.order_number = nullableText(body.order_number);
    if (body.status !== undefined)
      payload.status = nullableText(body.status) || "draft";
    if (body.order_date !== undefined)
      payload.order_date = parseNullableDate(body.order_date, "order_date");
    if (body.expected_delivery_date !== undefined)
      payload.expected_delivery_date = parseNullableDate(
        body.expected_delivery_date,
        "expected_delivery_date",
      );
    if (body.delivered_at !== undefined)
      payload.delivered_at = parseNullableDate(
        body.delivered_at,
        "delivered_at",
      );
    if (body.estimated_total_pence !== undefined)
      payload.estimated_total_pence =
        parseNullablePence(
          body.estimated_total_pence,
          "estimated_total_pence",
        ) || 0;
    if (body.actual_total_pence !== undefined)
      payload.actual_total_pence =
        parseNullablePence(
          body.actual_total_pence,
          "actual_total_pence",
        ) || 0;
    if (body.received_quantity !== undefined)
      payload.received_quantity =
        parseNullableInteger(
          body.received_quantity,
          "received_quantity",
        ) || 0;
    if (body.missing_quantity !== undefined)
      payload.missing_quantity =
        parseNullableInteger(body.missing_quantity, "missing_quantity") || 0;
    if (body.damaged_quantity !== undefined)
      payload.damaged_quantity =
        parseNullableInteger(body.damaged_quantity, "damaged_quantity") || 0;
    if (body.refund_required !== undefined)
      payload.refund_required = parseBoolean(
        body.refund_required,
        "refund_required",
      );
    if (body.replacement_required !== undefined)
      payload.replacement_required = parseBoolean(
        body.replacement_required,
        "replacement_required",
      );
    if (body.notes !== undefined)
      payload.notes = nullableText(body.notes);

    const { data, error } = await supabaseAdmin
      .from(TABLES.orders)
      .update(payload as never)
      .eq("id", orderId)
      .eq("stock_supplier_profile_id", supplierId)
      .select("*")
      .single();

    if (error) throw error;

    await writeAuditLog({
      admin,
      action: "stock_supplier_order_updated",
      actionLabel: "Purchase order updated",
      summary: `Updated purchase order ${data.order_number || orderId}.`,
      supplierId,
      recordType: "stock_supplier_order",
      recordId: orderId,
      beforeData,
      afterData: data,
      reason: nullableText(body.reason),
      relatedOrderId: orderId,
      route: endpoint.replace("PATCH ", ""),
      httpMethod: "PATCH",
      riskLevel: "medium",
    });

    return jsonOk({
      message: "The purchase order was updated.",
      order: data,
    });
  } catch (error) {
    return apiError(error, endpoint, "The purchase order could not be updated.");
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
) {
  const { supplierId, orderId } = await context.params;
  const endpoint =
    `DELETE /api/admin/stockmanagement/suppliers/${supplierId}/orders/${orderId}`;

  try {
    const admin = await requireAdmin();
    await getSupplierOrThrow(supplierId);
    const beforeData = await getOrderOrThrow(supplierId, orderId);
    const body = await readJsonBody<{ reason?: unknown }>(request, {
      allowEmpty: true,
    });
    const reason = nullableText(body.reason);

    if (!reason || reason.length < 10) {
      throw new Error(
        "A reason of at least 10 characters is required to delete an order.",
      );
    }

    const { error } = await supabaseAdmin
      .from(TABLES.orders)
      .delete()
      .eq("id", orderId)
      .eq("stock_supplier_profile_id", supplierId);

    if (error) throw error;

    await writeAuditLog({
      admin,
      action: "stock_supplier_order_deleted",
      actionLabel: "Purchase order deleted",
      summary: `Deleted purchase order ${beforeData.order_number || orderId}.`,
      supplierId,
      recordType: "stock_supplier_order",
      recordId: orderId,
      beforeData,
      reason,
      relatedOrderId: orderId,
      route: endpoint.replace("DELETE ", ""),
      httpMethod: "DELETE",
      riskLevel: "high",
    });

    return jsonOk({
      message: "The purchase order was deleted.",
    });
  } catch (error) {
    return apiError(error, endpoint, "The purchase order could not be deleted.");
  }
}
