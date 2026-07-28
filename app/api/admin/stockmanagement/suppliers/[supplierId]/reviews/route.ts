import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import {
  TABLES,
  adminDisplayName,
  apiError,
  getSupplierOrThrow,
  jsonOk,
  nullableText,
  parseRating,
  readJsonBody,
  requireAdmin,
  writeAuditLog,
} from "../../_lib/supplierApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ supplierId: string }> };

type Body = {
  rating?: unknown;
  delivery_rating?: unknown;
  quality_rating?: unknown;
  communication_rating?: unknown;
  value_rating?: unknown;
  notes?: unknown;
  event_name?: unknown;
};

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  const { supplierId } = await context.params;
  const endpoint =
    `POST /api/admin/stockmanagement/suppliers/${supplierId}/reviews`;

  try {
    const admin = await requireAdmin();
    await getSupplierOrThrow(supplierId);
    const body = await readJsonBody<Body>(request);

    const rating = nullableText(body.rating);
    if (!rating) throw new Error("rating is required.");

    const payload = {
      stock_supplier_profile_id: supplierId,
      rating,
      delivery_rating: parseRating(
        body.delivery_rating,
        "delivery_rating",
      ),
      quality_rating: parseRating(body.quality_rating, "quality_rating"),
      communication_rating: parseRating(
        body.communication_rating,
        "communication_rating",
      ),
      value_rating: parseRating(body.value_rating, "value_rating"),
      notes: nullableText(body.notes),
      event_name: nullableText(body.event_name),
      admin_id: admin.id || null,
      admin_name: adminDisplayName(admin),
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from(TABLES.reviews)
      .insert(payload as never)
      .select("*")
      .single();

    if (error) throw error;

    await writeAuditLog({
      admin,
      action: "supplier_review_added",
      actionLabel: "Supplier review added",
      summary: `Added a ${rating} supplier review.`,
      supplierId,
      recordType: "stock_supplier_review",
      recordId: data.id,
      afterData: data,
      route: endpoint.replace("POST ", ""),
      httpMethod: "POST",
      riskLevel: "low",
    });

    return jsonOk(
      {
        message: "The supplier review was added.",
        review: data,
      },
      201,
    );
  } catch (error) {
    return apiError(error, endpoint, "The supplier review could not be added.");
  }
}
