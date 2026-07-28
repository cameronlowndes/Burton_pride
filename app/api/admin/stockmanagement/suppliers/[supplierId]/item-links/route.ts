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
  stock_item_id?: unknown;
  stock_item_name?: unknown;
  supplier_role?: unknown;
  supplier_sku?: unknown;
  unit_cost_pence?: unknown;
  minimum_order_quantity?: unknown;
  lead_time_days?: unknown;
  is_active?: unknown;
};

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  const { supplierId } = await context.params;
  const endpoint =
    `POST /api/admin/stockmanagement/suppliers/${supplierId}/item-links`;

  try {
    const admin = await requireAdmin();
    await getSupplierOrThrow(supplierId);
    const body = await readJsonBody<Body>(request);

    const stockItemId = nullableText(body.stock_item_id);
    if (!stockItemId || !isUuid(stockItemId)) {
      throw new Error("stock_item_id must be a valid UUID.");
    }

    const role = nullableText(body.supplier_role) || "alternative";
    if (!["preferred", "alternative"].includes(role)) {
      throw new Error(
        "supplier_role must be preferred or alternative.",
      );
    }

    const { data: stockItem, error: stockItemError } = await supabaseAdmin
      .from(TABLES.stockItems)
      .select("id,name,sku")
      .eq("id", stockItemId)
      .maybeSingle();

    if (stockItemError) throw stockItemError;
    if (!stockItem) throw new Error("The selected stock item was not found.");

    if (role === "preferred") {
      const { error: clearError } = await supabaseAdmin
        .from(TABLES.itemLinks)
        .update({ is_preferred: false } as never)
        .eq("stock_item_id", stockItemId)
        .neq("stock_supplier_profile_id", supplierId);

      if (clearError) throw clearError;
    }

    const payload = {
      stock_supplier_profile_id: supplierId,
      stock_item_id: stockItemId,
      stock_item_name: stockItem.name,
      stock_item_sku: stockItem.sku,
      is_preferred: role === "preferred",
      supplier_product_code: nullableText(body.supplier_sku),
      usual_unit_cost_pence: parseNullablePence(
        body.unit_cost_pence,
        "unit_cost_pence",
      ),
      minimum_order_quantity: parseNullableInteger(
        body.minimum_order_quantity,
        "minimum_order_quantity",
      ),
      usual_delivery_days: parseNullableInteger(
        body.lead_time_days,
        "lead_time_days",
        3650,
      ),
      is_active:
        body.is_active === undefined
          ? true
          : parseBoolean(body.is_active, "is_active"),
      created_at: new Date().toISOString(),
      created_by: admin.id || null,
      updated_at: new Date().toISOString(),
      updated_by: admin.id || null,
    };

    const { data, error } = await supabaseAdmin
      .from(TABLES.itemLinks)
      .upsert(payload as never, {
        onConflict: "stock_supplier_profile_id,stock_item_id",
      })
      .select("*")
      .single();

    if (error) throw error;

    await writeAuditLog({
      admin,
      action:
        role === "preferred"
          ? "preferred_supplier_changed"
          : "stock_item_supplier_added",
      actionLabel:
        role === "preferred"
          ? "Preferred supplier changed"
          : "Stock item supplier added",
      summary: `${stockItem.name} was linked as a ${role} supplier item.`,
      supplierId,
      recordType: "stock_item_supplier",
      recordId: data.id,
      afterData: data,
      relatedItemId: stockItemId,
      route: endpoint.replace("POST ", ""),
      httpMethod: "POST",
      riskLevel: role === "preferred" ? "medium" : "low",
    });

    return jsonOk(
      {
        message: "The stock item supplier link was saved.",
        itemLink: data,
      },
      201,
    );
  } catch (error) {
    return apiError(
      error,
      endpoint,
      "The stock item supplier link could not be created.",
    );
  }
}
