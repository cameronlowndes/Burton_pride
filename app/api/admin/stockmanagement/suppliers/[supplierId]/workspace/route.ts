import {
  TABLES,
  apiError,
  getSupplierOrThrow,
  jsonOk,
  requireAdmin,
} from "../../_lib/supplierApi";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ supplierId: string }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  const { supplierId } = await context.params;
  const endpoint =
    `GET /api/admin/stockmanagement/suppliers/${supplierId}/workspace`;

  try {
    const admin = await requireAdmin();
    const supplier = await getSupplierOrThrow(supplierId);

    const [
      itemLinksResult,
      ordersResult,
      reviewsResult,
      complianceResult,
      organisationResult,
      overridesResult,
      auditResult,
      duplicateResult,
      eventResult,
    ] = await Promise.all([
      supabaseAdmin
        .from(TABLES.itemLinks)
        .select("*, stock_items(id,name,sku)")
        .eq("stock_supplier_profile_id", supplierId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from(TABLES.orders)
        .select("*")
        .eq("stock_supplier_profile_id", supplierId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from(TABLES.reviews)
        .select("*")
        .eq("stock_supplier_profile_id", supplierId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from(TABLES.compliance)
        .select("*")
        .eq("stock_supplier_profile_id", supplierId)
        .maybeSingle(),
      supabaseAdmin
        .from(TABLES.organisationLinks)
        .select("*")
        .eq("stock_supplier_profile_id", supplierId)
        .maybeSingle(),
      supabaseAdmin
        .from(TABLES.overrides)
        .select("*")
        .eq("stock_supplier_profile_id", supplierId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from(TABLES.audit)
        .select("*")
        .eq("supplier_id", supplierId)
        .order("created_at", { ascending: false })
        .limit(250),
      supabaseAdmin
        .from(TABLES.suppliers)
        .select("id,display_name,event_record_id,money_supplier_id")
        .neq("id", supplierId)
        .ilike("display_name", `%${String(supplier.display_name || "")}%`)
        .limit(20),
      supplier.event_record_id
        ? supabaseAdmin
            .from(TABLES.eventContacts)
            .select("*")
            .eq("id", supplier.event_record_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    for (const result of [
      itemLinksResult,
      ordersResult,
      reviewsResult,
      complianceResult,
      organisationResult,
      overridesResult,
      auditResult,
      duplicateResult,
      eventResult,
    ]) {
      if (result.error) throw result.error;
    }

    const itemLinks = (itemLinksResult.data || []).map((row: any) => ({
      id: row.id,
      stockItemId: row.stock_item_id,
      stockItemName:
        row.stock_items?.name || row.stock_item_name || "Unknown stock item",
      sku: row.stock_items?.sku || row.stock_item_sku || null,
      supplierRole: row.is_preferred ? "preferred" : "alternative",
      supplierSku: row.supplier_product_code || row.supplier_sku || null,
      unitCostPence: row.usual_unit_cost_pence || row.unit_cost_pence || null,
      minimumOrderQuantity: row.minimum_order_quantity || null,
      leadTimeDays: row.usual_delivery_days || row.lead_time_days || null,
      isActive: row.is_active !== false,
    }));

    const orders = (ordersResult.data || []).map((row: any) => ({
      id: row.id,
      orderNumber: row.order_number || "",
      status: row.status || "draft",
      orderDate: row.order_date || null,
      expectedDeliveryDate: row.expected_delivery_date || null,
      deliveredAt: row.delivered_at || null,
      estimatedTotalPence: Number(row.estimated_total_pence || 0),
      actualTotalPence: Number(row.actual_total_pence || 0),
      receivedQuantity: Number(row.received_quantity || 0),
      missingQuantity: Number(row.missing_quantity || 0),
      damagedQuantity: Number(row.damaged_quantity || 0),
      refundRequired: Boolean(row.refund_required),
      replacementRequired: Boolean(row.replacement_required),
      notes: row.notes || null,
    }));

    const reviews = (reviewsResult.data || []).map((row: any) => ({
      id: row.id,
      createdAt: row.created_at,
      adminName: row.admin_name || null,
      eventName: row.event_name || null,
      rating: row.rating || "not_recorded",
      deliveryRating: row.delivery_rating || null,
      qualityRating: row.quality_rating || null,
      communicationRating: row.communication_rating || null,
      valueRating: row.value_rating || null,
      notes: row.notes || null,
    }));

    const eventRow: any = eventResult.data;
    const historicEvents = eventRow
      ? [
          {
            id: eventRow.id,
            eventName: eventRow.event_name || "Burton Pride event",
            eventYear: eventRow.event_year || null,
            eventDate: eventRow.event_date || null,
            relationshipRating: eventRow.rating || null,
            notes: eventRow.notes || null,
          },
        ]
      : [];

    const complianceRow: any = complianceResult.data || {};
    const organisationRow: any = organisationResult.data || {};
    const overrideRow: any = overridesResult.data || null;

    return jsonOk({
      workspace: {
        itemLinks,
        orders,
        reviews,
        auditLogs: (auditResult.data || []).map((row: any) => ({
          id: row.id,
          createdAt: row.created_at,
          adminName: row.admin_name || null,
          action: row.action,
          summary: row.summary || null,
          status: row.status || null,
        })),
        historicEvents,
        compliance: {
          publicLiabilityStatus:
            complianceRow.public_liability_status || "not_recorded",
          publicLiabilityExpiry:
            complianceRow.public_liability_expiry || null,
          insuranceDocumentUrl:
            complianceRow.insurance_document_url || null,
          foodHygieneStatus:
            complianceRow.food_hygiene_status || "not_required",
          foodHygieneRating:
            complianceRow.food_hygiene_rating || null,
          foodHygieneAuthority:
            complianceRow.food_hygiene_authority || null,
          foodHygieneCheckedAt:
            complianceRow.food_hygiene_checked_at || null,
        },
        organisation: {
          organisationId: organisationRow.organisation_id || null,
          organisationName: organisationRow.organisation_name || null,
          migrationStatus:
            organisationRow.migration_status || "not_started",
        },
        duplicateCandidates: (duplicateResult.data || []).map((row: any) => ({
          id: row.id,
          displayName: row.display_name,
          source: "Stock Management",
          reason: "Similar supplier name",
        })),
        canMainAdminOverride:
          admin.is_main_admin === true || admin.role === "main_admin",
        activeOverride: overrideRow
          ? {
              enabled: true,
              reason: overrideRow.reason || null,
              expiresAt: overrideRow.expires_at || null,
            }
          : null,
      },
    });
  } catch (error) {
    return apiError(
      error,
      endpoint,
      "The supplier workspace could not be loaded.",
    );
  }
}
