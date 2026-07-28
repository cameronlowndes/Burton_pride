import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import {
  TABLES,
  apiError,
  getSupplierOrThrow,
  jsonOk,
  nullableText,
  readJsonBody,
  requireAdmin,
  writeAuditLog,
} from "../../../_lib/supplierApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ supplierId: string }> };

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
) {
  const { supplierId } = await context.params;
  const endpoint =
    `DELETE /api/admin/stockmanagement/suppliers/${supplierId}/connections/event-hub`;

  try {
    const admin = await requireAdmin();
    const beforeData = await getSupplierOrThrow(supplierId);
    const body = await readJsonBody<{ reason?: unknown }>(request, {
      allowEmpty: true,
    });
    const reason = nullableText(body.reason);

    if (!reason || reason.length < 10) {
      throw new Error(
        "A reason of at least 10 characters is required to unlink Event Hub.",
      );
    }

    if (!beforeData.event_record_id) {
      return jsonOk({
        message: "This supplier is not linked to Event Hub.",
        supplier: beforeData,
      });
    }

    const { data, error } = await supabaseAdmin
      .from(TABLES.suppliers)
      .update({
        event_record_type: null,
        event_record_id: null,
        updated_at: new Date().toISOString(),
        updated_by: admin.id || null,
      } as never)
      .eq("id", supplierId)
      .select("*")
      .single();

    if (error) throw error;

    await writeAuditLog({
      admin,
      action: "event_contact_unlinked",
      actionLabel: "Event Hub contact unlinked",
      summary: "Unlinked the Event Hub contact without deleting it.",
      supplierId,
      beforeData,
      afterData: data,
      reason,
      route: endpoint.replace("DELETE ", ""),
      httpMethod: "DELETE",
      riskLevel: "high",
    });

    return jsonOk({
      message: "The Event Hub contact was unlinked.",
      supplier: data,
    });
  } catch (error) {
    return apiError(error, endpoint, "Event Hub could not be unlinked.");
  }
}
