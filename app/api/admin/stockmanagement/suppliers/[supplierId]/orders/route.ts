import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import {
  TABLES,
  apiError,
  getSupplierOrThrow,
  jsonOk,
  nullableText,
  parseBoolean,
  parseNullableDate,
  parseNullableInteger,
  parseNullablePence,
  readJsonBody,
  requireAdmin,
  writeAuditLog,
} from "../../_lib/supplierApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ supplierId: string }> };

type Body = {
  order_number?: unknown;
  status?: unknown;
  order_date?: unknown;
  expected_delivery_date?: unknown;
  estimated_total_pence?: unknown;
  actual_total_pence?: unknown;
  received_quantity?: unknown;
  missing_quantity?: unknown;
  damaged_quantity?: unknown;
  refund_required?: unknown;
  replacement_required?: unknown;
  notes?: unknown;
};

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  const { supplierId } = await context.params;
  const endpoint =
    `POST /api/admin/stockmanagement/suppliers/${supplierId}/orders`;

  try {
    const admin = await requireAdmin();
    await getSupplierOrThrow(supplierId);
    const body = await readJsonBody<Body>(request);

    const orderNumber =
      nullableText(body.order_number) ||
      `PO-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    const payload = {
      stock_supplier_profile_id: supplierId,
      order_number: orderNumber,
      status: nullableText(body.status) || "draft",
      order_date: parseNullableDate(body.order_date, "order_date"),
      expected_delivery_date: parseNullableDate(
        body.expected_delivery_date,
        "expected_delivery_date",
      ),
      estimated_total_pence:
        parseNullablePence(
          body.estimated_total_pence,
          "estimated_total_pence",
        ) || 0,
      actual_total_pence:
        parseNullablePence(body.actual_total_pence, "actual_total_pence") ||
        0,
      received_quantity:
        parseNullableInteger(body.received_quantity, "received_quantity") ||
        0,
      missing_quantity:
        parseNullableInteger(body.missing_quantity, "missing_quantity") || 0,
      damaged_quantity:
        parseNullableInteger(body.damaged_quantity, "damaged_quantity") || 0,
      refund_required:
        body.refund_required === undefined
          ? false
          : parseBoolean(body.refund_required, "refund_required"),
      replacement_required:
        body.replacement_required === undefined
          ? false
          : parseBoolean(
              body.replacement_required,
              "replacement_required",
            ),
      notes: nullableText(body.notes),
      created_at: new Date().toISOString(),
      created_by: admin.id || null,
      updated_at: new Date().toISOString(),
      updated_by: admin.id || null,
    };

    const { data, error } = await supabaseAdmin
      .from(TABLES.orders)
      .insert(payload as never)
      .select("*")
      .single();

    if (error) throw error;

    await writeAuditLog({
      admin,
      action: "stock_supplier_order_created",
      actionLabel: "Purchase order created",
      summary: `Created purchase order ${orderNumber}.`,
      supplierId,
      recordType: "stock_supplier_order",
      recordId: data.id,
      afterData: data,
      relatedOrderId: data.id,
      route: endpoint.replace("POST ", ""),
      httpMethod: "POST",
      riskLevel: "medium",
    });

    return jsonOk(
      {
        message: "The purchase order was created.",
        order: data,
      },
      201,
    );
  } catch (error) {
    return apiError(error, endpoint, "The purchase order could not be created.");
  }
}
