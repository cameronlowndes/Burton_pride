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

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

type QueryResult<T = unknown> = {
  data: T | null;
  error: SupabaseErrorLike | null;
};

type WorkspaceWarning = {
  section: string;
  table: string;
  code: string;
  message: string;
  details: string | null;
  hint: string | null;
};

function isMissingDatabaseResource(error: SupabaseErrorLike | null) {
  if (!error) return false;

  const code = String(error.code || "").toUpperCase();
  const text = [
    error.message,
    error.details,
    error.hint,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    code === "PGRST205" ||
    code === "PGRST204" ||
    code === "42P01" ||
    code === "42703" ||
    text.includes("could not find the table") ||
    text.includes("could not find the column") ||
    text.includes("schema cache") ||
    text.includes("relation") &&
      text.includes("does not exist")
  );
}

function createWorkspaceWarning({
  section,
  table,
  error,
}: {
  section: string;
  table: string;
  error: SupabaseErrorLike;
}): WorkspaceWarning {
  return {
    section,
    table,
    code: String(error.code || "WORKSPACE_SECTION_UNAVAILABLE"),
    message:
      error.message ||
      `The ${section} section could not be loaded.`,
    details: error.details || null,
    hint:
      error.hint ||
      `Confirm that public.${table} exists and that the API uses the correct table and column names.`,
  };
}

/**
 * Optional workspace queries should not take down the whole page.
 *
 * Missing tables and columns return an empty/default result plus a warning.
 * Other unexpected database errors are still thrown.
 */
function readOptionalResult<T>({
  result,
  section,
  table,
  warnings,
  fallback,
}: {
  result: QueryResult<T>;
  section: string;
  table: string;
  warnings: WorkspaceWarning[];
  fallback: T;
}): T {
  if (!result.error) {
    return result.data ?? fallback;
  }

  if (isMissingDatabaseResource(result.error)) {
    const warning = createWorkspaceWarning({
      section,
      table,
      error: result.error,
    });

    warnings.push(warning);

    console.warn("Optional supplier workspace section unavailable", {
      section,
      table,
      code: warning.code,
      message: warning.message,
      details: warning.details,
      hint: warning.hint,
    });

    return fallback;
  }

  throw Object.assign(
    new Error(
      result.error.message ||
        `The ${section} section could not be loaded.`,
    ),
    {
      code:
        result.error.code ||
        "SUPPLIER_WORKSPACE_QUERY_FAILED",
      details: result.error.details || null,
      hint: result.error.hint || null,
      table,
      section,
    },
  );
}

function safeArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function safeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function safeNullableNumber(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normaliseSearchText(value: unknown) {
  return String(value || "")
    .trim()
    .replaceAll("%", "")
    .replaceAll("_", "")
    .slice(0, 120);
}

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  const { supplierId } = await context.params;

  const endpoint =
    `GET /api/admin/stockmanagement/suppliers/${supplierId}/workspace`;

  try {
    if (!supplierId) {
      return Response.json(
        {
          ok: false,
          error: "Supplier ID is required.",
          code: "SUPPLIER_ID_REQUIRED",
          details:
            "The supplier workspace route was opened without a supplier ID.",
          hint:
            "Open the workspace from a valid Stock Management supplier record.",
          endpoint,
        },
        { status: 400 },
      );
    }

    const admin = await requireAdmin();

    /*
     * This is the only required supplier query.
     * getSupplierOrThrow should query TABLES.suppliers, which must point to:
     *
     * stock_supplier_profiles
     */
    const supplier = await getSupplierOrThrow(supplierId);

    const warnings: WorkspaceWarning[] = [];

    const supplierNameSearch =
      normaliseSearchText(supplier.display_name);

    /*
     * Every query below is for an optional workspace section.
     * A missing optional table no longer prevents the whole workspace loading.
     */
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
        .select(`
          *,
          stock_items (
            id,
            name,
            sku
          )
        `)
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

      supplierNameSearch
        ? supabaseAdmin
            .from(TABLES.suppliers)
            .select(`
              id,
              display_name,
              event_record_id,
              money_supplier_id
            `)
            .neq("id", supplierId)
            .ilike(
              "display_name",
              `%${supplierNameSearch}%`,
            )
            .limit(20)
        : Promise.resolve({
            data: [],
            error: null,
          }),

      supplier.event_record_id
        ? supabaseAdmin
            .from(TABLES.eventContacts)
            .select("*")
            .eq("id", supplier.event_record_id)
            .maybeSingle()
        : Promise.resolve({
            data: null,
            error: null,
          }),
    ]);

    const itemLinkRows = readOptionalResult<any[]>({
      result: itemLinksResult as QueryResult<any[]>,
      section: "Stock item supplier links",
      table: TABLES.itemLinks,
      warnings,
      fallback: [],
    });

    const orderRows = readOptionalResult<any[]>({
      result: ordersResult as QueryResult<any[]>,
      section: "Supplier orders",
      table: TABLES.orders,
      warnings,
      fallback: [],
    });

    const reviewRows = readOptionalResult<any[]>({
      result: reviewsResult as QueryResult<any[]>,
      section: "Supplier reviews",
      table: TABLES.reviews,
      warnings,
      fallback: [],
    });

    const complianceRow = readOptionalResult<any>({
      result: complianceResult as QueryResult<any>,
      section: "Supplier compliance",
      table: TABLES.compliance,
      warnings,
      fallback: {},
    });

    const organisationRow = readOptionalResult<any>({
      result: organisationResult as QueryResult<any>,
      section: "Organisation connection",
      table: TABLES.organisationLinks,
      warnings,
      fallback: {},
    });

    const overrideRow = readOptionalResult<any>({
      result: overridesResult as QueryResult<any>,
      section: "Main-admin override",
      table: TABLES.overrides,
      warnings,
      fallback: null,
    });

    const auditRows = readOptionalResult<any[]>({
      result: auditResult as QueryResult<any[]>,
      section: "Supplier audit history",
      table: TABLES.audit,
      warnings,
      fallback: [],
    });

    const duplicateRows = readOptionalResult<any[]>({
      result: duplicateResult as QueryResult<any[]>,
      section: "Duplicate supplier search",
      table: TABLES.suppliers,
      warnings,
      fallback: [],
    });

    const eventRow = readOptionalResult<any>({
      result: eventResult as QueryResult<any>,
      section: "Event Hub contact",
      table: TABLES.eventContacts,
      warnings,
      fallback: null,
    });

    const itemLinks = safeArray(itemLinkRows).map(
      (row: any) => ({
        id: row.id,
        stockItemId: row.stock_item_id,
        stockItemName:
          row.stock_items?.name ||
          row.stock_item_name ||
          "Unknown stock item",
        sku:
          row.stock_items?.sku ||
          row.stock_item_sku ||
          null,
        supplierRole: row.is_preferred
          ? "preferred"
          : "alternative",
        supplierSku:
          row.supplier_product_code ||
          row.supplier_sku ||
          null,
        unitCostPence:
          safeNullableNumber(
            row.usual_unit_cost_pence ??
              row.unit_cost_pence,
          ),
        minimumOrderQuantity:
          safeNullableNumber(
            row.minimum_order_quantity,
          ),
        leadTimeDays:
          safeNullableNumber(
            row.usual_delivery_days ??
              row.lead_time_days,
          ),
        isActive: row.is_active !== false,
      }),
    );

    const orders = safeArray(orderRows).map(
      (row: any) => ({
        id: row.id,
        orderNumber: row.order_number || "",
        status: row.status || "draft",
        orderDate: row.order_date || null,
        expectedDeliveryDate:
          row.expected_delivery_date || null,
        deliveredAt: row.delivered_at || null,
        estimatedTotalPence: safeNumber(
          row.estimated_total_pence,
        ),
        actualTotalPence: safeNumber(
          row.actual_total_pence,
        ),
        receivedQuantity: safeNumber(
          row.received_quantity,
        ),
        missingQuantity: safeNumber(
          row.missing_quantity,
        ),
        damagedQuantity: safeNumber(
          row.damaged_quantity,
        ),
        refundRequired: Boolean(
          row.refund_required,
        ),
        replacementRequired: Boolean(
          row.replacement_required,
        ),
        notes: row.notes || null,
      }),
    );

    const reviews = safeArray(reviewRows).map(
      (row: any) => ({
        id: row.id,
        createdAt: row.created_at || null,
        adminName: row.admin_name || null,
        eventName: row.event_name || null,
        rating: row.rating || "not_recorded",
        deliveryRating:
          row.delivery_rating || null,
        qualityRating:
          row.quality_rating || null,
        communicationRating:
          row.communication_rating || null,
        valueRating: row.value_rating || null,
        notes: row.notes || null,
      }),
    );

    /*
     * event_business_contacts may not contain event_name,
     * event_year or event_date. These fallbacks keep the
     * workspace compatible with either a contact view or a
     * richer Event Hub record.
     */
    const historicEvents = eventRow
      ? [
          {
            id: eventRow.id,
            eventName:
              eventRow.event_name ||
              eventRow.business_name ||
              eventRow.organisation_name ||
              eventRow.name ||
              "Burton Pride event contact",
            eventYear:
              eventRow.event_year || null,
            eventDate:
              eventRow.event_date || null,
            relationshipRating:
              eventRow.rating || null,
            notes:
              eventRow.notes ||
              eventRow.internal_notes ||
              null,
          },
        ]
      : [];

    return jsonOk({
      supplier: {
        id: supplier.id,
        displayName:
          supplier.display_name ||
          "Unnamed supplier",
        eventRecordId:
          supplier.event_record_id || null,
        moneySupplierId:
          supplier.money_supplier_id || null,
      },

      workspace: {
        itemLinks,
        orders,
        reviews,

        auditLogs: safeArray(auditRows).map(
          (row: any) => ({
            id: row.id,
            createdAt: row.created_at || null,
            adminName:
              row.admin_name ||
              row.actor_name ||
              null,
            action:
              row.action ||
              row.action_key ||
              "unknown",
            summary:
              row.summary ||
              row.action_label ||
              null,
            status: row.status || null,
          }),
        ),

        historicEvents,

        compliance: {
          publicLiabilityStatus:
            complianceRow?.public_liability_status ||
            "not_recorded",
          publicLiabilityExpiry:
            complianceRow?.public_liability_expiry ||
            null,
          insuranceDocumentUrl:
            complianceRow?.insurance_document_url ||
            null,
          foodHygieneStatus:
            complianceRow?.food_hygiene_status ||
            "not_required",
          foodHygieneRating:
            complianceRow?.food_hygiene_rating ||
            null,
          foodHygieneAuthority:
            complianceRow?.food_hygiene_authority ||
            null,
          foodHygieneCheckedAt:
            complianceRow?.food_hygiene_checked_at ||
            null,
        },

        organisation: {
          organisationId:
            organisationRow?.organisation_id ||
            null,
          organisationName:
            organisationRow?.organisation_name ||
            null,
          migrationStatus:
            organisationRow?.migration_status ||
            "not_started",
        },

        duplicateCandidates: safeArray(
          duplicateRows,
        ).map((row: any) => ({
          id: row.id,
          displayName:
            row.display_name ||
            "Unnamed supplier",
          source: "Stock Management",
          reason: "Similar supplier name",
        })),

        canMainAdminOverride:
          admin.is_main_admin === true ||
          admin.role === "main_admin",

        activeOverride: overrideRow
          ? {
              enabled: true,
              reason:
                overrideRow.reason || null,
              expiresAt:
                overrideRow.expires_at || null,
            }
          : null,
      },

      connectionStatus: {
        fullyLoaded: warnings.length === 0,
        warningCount: warnings.length,
        warnings,
      },
    });
  } catch (error) {
    console.error("Supplier workspace route failed", {
      supplierId,
      endpoint,
      error,
    });

    return apiError(
      error,
      endpoint,
      "The supplier workspace could not be loaded.",
    );
  }
}