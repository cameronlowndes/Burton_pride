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
  parseNullableDate,
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
    `POST /api/admin/stockmanagement/suppliers/${supplierId}/override`;

  try {
    const admin = await requireAdmin();
    if (!isMainAdmin(admin)) {
      throw new Error(
        "Main admin permission is required to create a supplier override.",
      );
    }

    await getSupplierOrThrow(supplierId);
    const body = await readJsonBody<{
      reason?: unknown;
      expires_at?: unknown;
    }>(request);

    const reason = nullableText(body.reason);
    if (!reason || reason.length < 10) {
      throw new Error(
        "An override reason of at least 10 characters is required.",
      );
    }

    await supabaseAdmin
      .from(TABLES.overrides)
      .update({
        is_active: false,
        removed_at: new Date().toISOString(),
        removed_by: admin.id || null,
      } as never)
      .eq("stock_supplier_profile_id", supplierId)
      .eq("is_active", true);

    const payload = {
      stock_supplier_profile_id: supplierId,
      reason,
      expires_at: parseNullableDate(body.expires_at, "expires_at"),
      is_active: true,
      created_at: new Date().toISOString(),
      created_by: admin.id || null,
      created_by_name: adminDisplayName(admin),
    };

    const { data, error } = await supabaseAdmin
      .from(TABLES.overrides)
      .insert(payload as never)
      .select("*")
      .single();

    if (error) throw error;

    await writeAuditLog({
      admin,
      action: "supplier_main_admin_override_created",
      actionLabel: "Supplier override created",
      summary: "Created a temporary main-admin supplier override.",
      supplierId,
      afterData: data,
      reason,
      route: endpoint.replace("POST ", ""),
      httpMethod: "POST",
      riskLevel: "critical",
    });

    return jsonOk(
      {
        message: "The supplier override was enabled.",
        override: data,
      },
      201,
    );
  } catch (error) {
    return apiError(error, endpoint, "The supplier override could not be created.");
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
) {
  const { supplierId } = await context.params;
  const endpoint =
    `DELETE /api/admin/stockmanagement/suppliers/${supplierId}/override`;

  try {
    const admin = await requireAdmin();
    if (!isMainAdmin(admin)) {
      throw new Error(
        "Main admin permission is required to remove a supplier override.",
      );
    }

    await getSupplierOrThrow(supplierId);
    const body = await readJsonBody<{ reason?: unknown }>(request, {
      allowEmpty: true,
    });
    const reason = nullableText(body.reason);

    if (!reason || reason.length < 10) {
      throw new Error(
        "A removal reason of at least 10 characters is required.",
      );
    }

    const { data, error } = await supabaseAdmin
      .from(TABLES.overrides)
      .update({
        is_active: false,
        removed_at: new Date().toISOString(),
        removed_by: admin.id || null,
        removed_reason: reason,
      } as never)
      .eq("stock_supplier_profile_id", supplierId)
      .eq("is_active", true)
      .select("*");

    if (error) throw error;

    await writeAuditLog({
      admin,
      action: "supplier_main_admin_override_removed",
      actionLabel: "Supplier override removed",
      summary: "Removed the active main-admin supplier override.",
      supplierId,
      beforeData: { overrides: data },
      reason,
      route: endpoint.replace("DELETE ", ""),
      httpMethod: "DELETE",
      riskLevel: "critical",
    });

    return jsonOk({
      message: "The supplier override was removed.",
    });
  } catch (error) {
    return apiError(error, endpoint, "The supplier override could not be removed.");
  }
}
