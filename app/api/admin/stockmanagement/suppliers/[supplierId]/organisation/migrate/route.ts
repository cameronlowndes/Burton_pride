import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import {
  TABLES,
  adminDisplayName,
  apiError,
  getSupplierOrThrow,
  isMainAdmin,
  jsonOk,
  nullableText,
  readJsonBody,
  requireAdmin,
  writeAuditLog,
} from "../../../_lib/supplierApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ supplierId: string }> };

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  const { supplierId } = await context.params;
  const endpoint =
    `POST /api/admin/stockmanagement/suppliers/${supplierId}/organisation/migrate`;

  try {
    const admin = await requireAdmin();
    if (!isMainAdmin(admin)) {
      throw new Error(
        "Main admin permission is required to migrate a supplier organisation.",
      );
    }

    const supplier = await getSupplierOrThrow(supplierId);
    const body = await readJsonBody<{
      organisation_id?: unknown;
      organisation_name?: unknown;
      reason?: unknown;
    }>(request, { allowEmpty: true });

    const organisationName =
      nullableText(body.organisation_name) ||
      String(supplier.display_name || "Unnamed organisation");

    const payload = {
      stock_supplier_profile_id: supplierId,
      organisation_id: nullableText(body.organisation_id),
      organisation_name: organisationName,
      migration_status: "completed",
      migrated_at: new Date().toISOString(),
      migrated_by: admin.id || null,
      migrated_by_name: adminDisplayName(admin),
    };

    const { data, error } = await supabaseAdmin
      .from(TABLES.organisationLinks)
      .upsert(payload as never, {
        onConflict: "stock_supplier_profile_id",
      })
      .select("*")
      .single();

    if (error) throw error;

    await writeAuditLog({
      admin,
      action: "supplier_organisation_migrated",
      actionLabel: "Supplier organisation migrated",
      summary: `Migrated ${organisationName} to the central organisation model.`,
      supplierId,
      afterData: data,
      reason: nullableText(body.reason),
      route: endpoint.replace("POST ", ""),
      httpMethod: "POST",
      riskLevel: "high",
    });

    return jsonOk({
      message: "The supplier was migrated to the organisation model.",
      organisation: data,
    });
  } catch (error) {
    return apiError(
      error,
      endpoint,
      "The supplier organisation could not be migrated.",
    );
  }
}
