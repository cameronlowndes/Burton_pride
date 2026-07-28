import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import {
  TABLES,
  apiError,
  getSupplierOrThrow,
  isMainAdmin,
  isUuid,
  jsonOk,
  nullableText,
  readJsonBody,
  requireAdmin,
  writeAuditLog,
} from "../../_lib/supplierApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ supplierId: string }> };

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  const { supplierId } = await context.params;
  const endpoint =
    `POST /api/admin/stockmanagement/suppliers/${supplierId}/merge`;

  try {
    const admin = await requireAdmin();
    if (!isMainAdmin(admin)) {
      throw new Error(
        "Main admin permission is required to merge supplier profiles.",
      );
    }

    const source = await getSupplierOrThrow(supplierId);
    const body = await readJsonBody<{
      target_supplier_id?: unknown;
      reason?: unknown;
    }>(request);

    const targetSupplierId = nullableText(body.target_supplier_id);
    const reason = nullableText(body.reason);

    if (!targetSupplierId || !isUuid(targetSupplierId)) {
      throw new Error("target_supplier_id must be a valid UUID.");
    }

    if (targetSupplierId === supplierId) {
      throw new Error("A supplier cannot be merged into itself.");
    }

    if (!reason || reason.length < 10) {
      throw new Error("A merge reason of at least 10 characters is required.");
    }

    const target = await getSupplierOrThrow(targetSupplierId);

    for (const [table, column] of [
      [TABLES.itemLinks, "stock_supplier_profile_id"],
      [TABLES.orders, "stock_supplier_profile_id"],
      [TABLES.reviews, "stock_supplier_profile_id"],
      [TABLES.compliance, "stock_supplier_profile_id"],
      [TABLES.overrides, "stock_supplier_profile_id"],
    ] as const) {
      const { error } = await supabaseAdmin
        .from(table)
        .update({ [column]: targetSupplierId } as never)
        .eq(column, supplierId);

      if (error && error.code !== "23505") throw error;
    }

    const mergedEventRecordId =
      target.event_record_id || source.event_record_id || null;
    const mergedEventRecordType =
      target.event_record_type || source.event_record_type || null;
    const mergedMoneySupplierId =
      target.money_supplier_id || source.money_supplier_id || null;

    const { data: updatedTarget, error: targetError } = await supabaseAdmin
      .from(TABLES.suppliers)
      .update({
        event_record_id: mergedEventRecordId,
        event_record_type: mergedEventRecordType,
        money_supplier_id: mergedMoneySupplierId,
        needs_review:
          Boolean(target.needs_review) || Boolean(source.needs_review),
        do_not_use: Boolean(target.do_not_use) || Boolean(source.do_not_use),
        updated_at: new Date().toISOString(),
        updated_by: admin.id || null,
      } as never)
      .eq("id", targetSupplierId)
      .select("*")
      .single();

    if (targetError) throw targetError;

    const { error: sourceDeleteError } = await supabaseAdmin
      .from(TABLES.suppliers)
      .delete()
      .eq("id", supplierId);

    if (sourceDeleteError) throw sourceDeleteError;

    await writeAuditLog({
      admin,
      action: "stock_supplier_profiles_merged",
      actionLabel: "Supplier profiles merged",
      summary: `Merged ${String(source.display_name)} into ${String(
        target.display_name,
      )}.`,
      supplierId: targetSupplierId,
      beforeData: { source, target },
      afterData: updatedTarget,
      reason,
      route: endpoint.replace("POST ", ""),
      httpMethod: "POST",
      riskLevel: "critical",
    });

    return jsonOk({
      message: "The supplier profiles were merged.",
      survivingSupplier: updatedTarget,
      removedSupplierId: supplierId,
    });
  } catch (error) {
    return apiError(error, endpoint, "The supplier profiles could not be merged.");
  }
}
