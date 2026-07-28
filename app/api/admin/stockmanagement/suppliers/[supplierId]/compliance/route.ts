import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import {
  TABLES,
  apiError,
  getSupplierOrThrow,
  jsonOk,
  nullableText,
  parseNullableDate,
  readJsonBody,
  requireAdmin,
  writeAuditLog,
} from "../../_lib/supplierApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ supplierId: string }> };

type Body = {
  public_liability_status?: unknown;
  public_liability_expiry?: unknown;
  insurance_document_url?: unknown;
  food_hygiene_status?: unknown;
  food_hygiene_rating?: unknown;
  food_hygiene_authority?: unknown;
  food_hygiene_checked_at?: unknown;
  reason?: unknown;
};

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  const { supplierId } = await context.params;
  const endpoint =
    `PATCH /api/admin/stockmanagement/suppliers/${supplierId}/compliance`;

  try {
    const admin = await requireAdmin();
    await getSupplierOrThrow(supplierId);
    const body = await readJsonBody<Body>(request);

    const { data: beforeData, error: beforeError } = await supabaseAdmin
      .from(TABLES.compliance)
      .select("*")
      .eq("stock_supplier_profile_id", supplierId)
      .maybeSingle();

    if (beforeError) throw beforeError;

    const payload = {
      stock_supplier_profile_id: supplierId,
      public_liability_status:
        nullableText(body.public_liability_status) || "not_recorded",
      public_liability_expiry: parseNullableDate(
        body.public_liability_expiry,
        "public_liability_expiry",
      ),
      insurance_document_url: nullableText(body.insurance_document_url),
      food_hygiene_status:
        nullableText(body.food_hygiene_status) || "not_required",
      food_hygiene_rating: nullableText(body.food_hygiene_rating),
      food_hygiene_authority: nullableText(body.food_hygiene_authority),
      food_hygiene_checked_at: parseNullableDate(
        body.food_hygiene_checked_at,
        "food_hygiene_checked_at",
      ),
      updated_at: new Date().toISOString(),
      updated_by: admin.id || null,
    };

    const { data, error } = await supabaseAdmin
      .from(TABLES.compliance)
      .upsert(payload as never, {
        onConflict: "stock_supplier_profile_id",
      })
      .select("*")
      .single();

    if (error) throw error;

    await writeAuditLog({
      admin,
      action: "stock_supplier_compliance_updated",
      actionLabel: "Supplier compliance updated",
      summary: "Updated supplier insurance and food-hygiene information.",
      supplierId,
      beforeData,
      afterData: data,
      reason: nullableText(body.reason),
      route: endpoint.replace("PATCH ", ""),
      httpMethod: "PATCH",
      riskLevel: "medium",
    });

    return jsonOk({
      message: "Supplier compliance information was updated.",
      compliance: data,
    });
  } catch (error) {
    return apiError(
      error,
      endpoint,
      "Supplier compliance could not be updated.",
    );
  }
}
