import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import {
  TABLES,
  apiError,
  getSupplierOrThrow,
  isUuid,
  jsonOk,
  nullableText,
  readJsonBody,
  requireAdmin,
  writeAuditLog,
} from "../../../_lib/supplierApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ supplierId: string; linkId: string }>;
};

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
) {
  const { supplierId, linkId } = await context.params;
  const endpoint =
    `DELETE /api/admin/stockmanagement/suppliers/${supplierId}/item-links/${linkId}`;

  try {
    const admin = await requireAdmin();
    await getSupplierOrThrow(supplierId);

    if (!isUuid(linkId)) {
      throw new Error("linkId must be a valid UUID.");
    }

    const body = await readJsonBody<{ reason?: unknown }>(request, {
      allowEmpty: true,
    });

    const { data: beforeData, error: loadError } = await supabaseAdmin
      .from(TABLES.itemLinks)
      .select("*")
      .eq("id", linkId)
      .eq("stock_supplier_profile_id", supplierId)
      .maybeSingle();

    if (loadError) throw loadError;
    if (!beforeData) throw new Error("The stock item supplier link was not found.");

    const { error } = await supabaseAdmin
      .from(TABLES.itemLinks)
      .delete()
      .eq("id", linkId)
      .eq("stock_supplier_profile_id", supplierId);

    if (error) throw error;

    await writeAuditLog({
      admin,
      action: "stock_item_supplier_removed",
      actionLabel: "Stock item supplier removed",
      summary: "Removed a stock item supplier link.",
      supplierId,
      recordType: "stock_item_supplier",
      recordId: linkId,
      beforeData,
      reason: nullableText(body.reason),
      relatedItemId: String(beforeData.stock_item_id || "") || null,
      route: endpoint.replace("DELETE ", ""),
      httpMethod: "DELETE",
      riskLevel: "medium",
    });

    return jsonOk({
      message: "The stock item supplier link was removed.",
    });
  } catch (error) {
    return apiError(
      error,
      endpoint,
      "The stock item supplier link could not be removed.",
    );
  }
}
