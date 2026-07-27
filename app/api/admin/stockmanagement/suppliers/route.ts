import { NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STOCK_SUPPLIER_TABLE = "stock_supplier_profiles";
const EVENT_BUSINESS_CONTACTS_TABLE = "event_business_contacts";
const EVENT_STALLHOLDER_CONTACTS_TABLE =
  "event_stallholder_checklist_contacts";
const MONEY_SUPPLIERS_TABLE = "money_suppliers";
const STOCK_ITEM_SUPPLIERS_TABLE = "stock_item_suppliers";
const STOCK_ORDERS_TABLE = "stock_orders";
const MONEY_TRANSACTIONS_TABLE = "money_transactions";
const AUDIT_LOG_TABLE = "admin_audit_logs";

const ALLOWED_SUPPLIER_USES = new Set([
  "stock",
  "service",
  "event_trader",
  "performer",
  "venue",
  "mixed",
]);

type AdminIdentity = {
  id?: string | null;
  email?: string | null;
  name?: string | null;
  full_name?: string | null;
  role?: string | null;
  is_main_admin?: boolean | null;
};

type UnknownRow = Record<string, unknown>;

type StockSupplierProfileRow = UnknownRow & {
  id: string;
  event_record_type?: string | null;
  event_record_id?: string | null;
  money_supplier_id?: string | null;
  display_name?: string | null;
  supplier_use?: string | null;
  is_active?: boolean | null;
  needs_review?: boolean | null;
  do_not_use?: boolean | null;
  usual_delivery_days?: number | null;
  minimum_order_value_pence?: number | null;
  usual_delivery_cost_pence?: number | null;
  stock_notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type CreateSupplierBody = {
  display_name?: unknown;
  supplier_use?: unknown;
  usual_delivery_days?: unknown;
  minimum_order_value_pence?: unknown;
  usual_delivery_cost_pence?: unknown;
  stock_notes?: unknown;
  event_record_type?: unknown;
  event_record_id?: unknown;
  money_supplier_id?: unknown;
};

type OptionalQueryResult<T> = {
  rows: T[];
  warning?: string;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function nullableText(value: unknown) {
  const cleaned = text(value);
  return cleaned || null;
}

function booleanValue(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableNonNegativeInteger(
  value: unknown,
  fieldName: string,
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 0
  ) {
    throw new Error(
      `${fieldName} must be a whole number of zero or more.`,
    );
  }

  return parsed;
}

function nullableNonNegativeMoney(
  value: unknown,
  fieldName: string,
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 0
  ) {
    throw new Error(
      `${fieldName} must be a non-negative amount in pence.`,
    );
  }

  return parsed;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function pickString(
  row: UnknownRow | null | undefined,
  keys: string[],
) {
  if (!row) return null;

  for (const key of keys) {
    const value = row[key];

    if (
      value !== null &&
      value !== undefined &&
      String(value).trim()
    ) {
      return String(value).trim();
    }
  }

  return null;
}

function pickNumber(
  row: UnknownRow | null | undefined,
  keys: string[],
) {
  if (!row) return 0;

  for (const key of keys) {
    const value = Number(row[key]);
    if (Number.isFinite(value)) return value;
  }

  return 0;
}

function pickBoolean(
  row: UnknownRow | null | undefined,
  keys: string[],
) {
  if (!row) return false;

  for (const key of keys) {
    const value = row[key];

    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
  }

  return false;
}

function lower(value: unknown) {
  return text(value).toLowerCase();
}

function errorStatus(error: unknown) {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : "";

  if (
    message.includes("unauthorised") ||
    message.includes("unauthorized") ||
    message.includes("sign in") ||
    message.includes("session")
  ) {
    return 401;
  }

  if (
    message.includes("permission") ||
    message.includes("access denied") ||
    message.includes("main admin")
  ) {
    return 403;
  }

  if (
    message.includes("required") ||
    message.includes("must be") ||
    message.includes("invalid") ||
    message.includes("already exists")
  ) {
    return 400;
  }

  return 500;
}

function apiError(
  error: unknown,
  endpoint: string,
  fallback: string,
) {
  const status = errorStatus(error);
  const message =
    error instanceof Error && error.message
      ? error.message
      : fallback;

  const source = error as {
    code?: string;
    details?: string;
    hint?: string;
    message?: string;
  };

  return NextResponse.json(
    {
      ok: false,
      error: message,
      code: source?.code || `STOCK_SUPPLIERS_${status}`,
      details:
        source?.details ||
        "The Stock Suppliers API could not complete the request.",
      hint:
        source?.hint ||
        "Check the table names, Supabase columns, administrator session and server logs.",
      endpoint,
      status,
    },
    { status },
  );
}

async function requireAdmin() {
  const admin =
    (await getCurrentAdmin()) as AdminIdentity | null;

  if (!admin) {
    throw new Error(
      "Unauthorised. Sign in to the Burton Pride Admin Portal.",
    );
  }

  return admin;
}

async function optionalSelect<T extends UnknownRow>(
  table: string,
  filterColumn?: string,
  filterValues?: string[],
): Promise<OptionalQueryResult<T>> {
  try {
    let query = supabaseAdmin.from(table).select("*");

    if (
      filterColumn &&
      filterValues &&
      filterValues.length > 0
    ) {
      query = query.in(filterColumn, filterValues);
    }

    const { data, error } = await query;

    if (error) {
      return {
        rows: [],
        warning: `${table}: ${error.message}`,
      };
    }

    return {
      rows: (data || []) as T[],
    };
  } catch (error) {
    return {
      rows: [],
      warning: `${table}: ${
        error instanceof Error
          ? error.message
          : "Unknown query error"
      }`,
    };
  }
}

function eventContactForProfile(
  profile: StockSupplierProfileRow,
  businessContacts: UnknownRow[],
  stallholderContacts: UnknownRow[],
) {
  const recordId = nullableText(
    profile.event_record_id,
  );
  const recordType = lower(
    profile.event_record_type,
  );

  if (!recordId) return null;

  if (
    recordType.includes("stallholder") ||
    recordType.includes("checklist")
  ) {
    return (
      stallholderContacts.find(
        (row) => text(row.id) === recordId,
      ) || null
    );
  }

  return (
    businessContacts.find(
      (row) => text(row.id) === recordId,
    ) ||
    stallholderContacts.find(
      (row) => text(row.id) === recordId,
    ) ||
    null
  );
}

function orderSupplierId(row: UnknownRow) {
  return pickString(row, [
    "stock_supplier_profile_id",
    "supplier_profile_id",
    "stock_supplier_id",
  ]);
}

function orderStatus(row: UnknownRow) {
  return lower(
    pickString(row, [
      "status",
      "order_status",
    ]),
  );
}

function transactionSupplierId(row: UnknownRow) {
  return pickString(row, [
    "money_supplier_id",
    "supplier_id",
  ]);
}

function transactionAmountPence(row: UnknownRow) {
  const directPence = pickNumber(row, [
    "amount_pence",
    "total_pence",
    "paid_amount_pence",
  ]);

  if (directPence !== 0) return directPence;

  const pounds = pickNumber(row, [
    "amount",
    "total",
    "paid_amount",
  ]);

  return Math.round(pounds * 100);
}

function transactionDate(row: UnknownRow) {
  return pickString(row, [
    "transaction_date",
    "date",
    "created_at",
  ]);
}

function isCurrentYear(value: string | null) {
  if (!value) return false;

  const date = new Date(value);

  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === new Date().getFullYear()
  );
}

function buildEventContactList(
  profiles: StockSupplierProfileRow[],
  businessContacts: UnknownRow[],
  stallholderContacts: UnknownRow[],
) {
  const linkedByRecord = new Map<
    string,
    StockSupplierProfileRow
  >();

  for (const profile of profiles) {
    const recordId = nullableText(
      profile.event_record_id,
    );

    if (!recordId) continue;

    linkedByRecord.set(recordId, profile);
  }

  const normalise = (
    row: UnknownRow,
    recordType: string,
  ) => {
    const id = text(row.id);
    const linkedProfile = linkedByRecord.get(id);

    return {
      id,
      recordType,
      organisationName:
        pickString(row, [
          "business_name",
          "organisation_name",
          "organization_name",
          "company_name",
          "name",
        ]) || "Unnamed Event Hub contact",
      contactName: pickString(row, [
        "contact_name",
        "full_name",
        "name",
      ]),
      email: pickString(row, [
        "email",
        "contact_email",
        "business_email",
      ]),
      phone: pickString(row, [
        "phone",
        "telephone",
        "contact_phone",
        "mobile",
      ]),
      website: pickString(row, [
        "website",
        "website_url",
        "url",
      ]),
      rating: pickString(row, [
        "rating",
        "relationship_rating",
        "work_rating",
      ]),
      doNotInvite: pickBoolean(row, [
        "do_not_invite",
        "blocked",
      ]),
      needsReview: pickBoolean(row, [
        "needs_review",
        "requires_review",
      ]),
      linkedStockSupplierId:
        linkedProfile?.id || null,
      linkedStockSupplierName:
        nullableText(
          linkedProfile?.display_name,
        ),
    };
  };

  return [
    ...businessContacts.map((row) =>
      normalise(row, "business_contact"),
    ),
    ...stallholderContacts.map((row) =>
      normalise(
        row,
        "stallholder_checklist_contact",
      ),
    ),
  ]
    .filter((contact) => Boolean(contact.id))
    .sort((left, right) =>
      left.organisationName.localeCompare(
        right.organisationName,
        "en-GB",
      ),
    );
}

function buildSummary(
  suppliers: ReturnType<typeof buildSupplierView>[],
) {
  return suppliers.reduce(
    (summary, supplier) => {
      if (supplier.isActive) {
        summary.activeSuppliers += 1;
      }

      if (supplier.eventHub.connected) {
        summary.connectedToEventHub += 1;
      }

      if (supplier.moneyManagement.connected) {
        summary.connectedToMoneyManagement += 1;
      }

      if (
        supplier.eventHub.connected &&
        supplier.moneyManagement.connected
      ) {
        summary.fullyConnected += 1;
      }

      summary.openOrders +=
        supplier.stockManagement.openOrderCount;

      summary.overdueDeliveries +=
        supplier.stockManagement.overdueOrderCount;

      if (
        supplier.doNotUse ||
        supplier.moneyManagement.doNotUse ||
        supplier.eventHub.doNotInvite
      ) {
        summary.blockedOrDoNotUse += 1;
      }

      if (
        !supplier.eventHub.connected ||
        !supplier.moneyManagement.connected
      ) {
        summary.missingConnections += 1;
      }

      return summary;
    },
    {
      activeSuppliers: 0,
      connectedToEventHub: 0,
      connectedToMoneyManagement: 0,
      fullyConnected: 0,
      openOrders: 0,
      overdueDeliveries: 0,
      blockedOrDoNotUse: 0,
      missingConnections: 0,
    },
  );
}

function buildSupplierView(
  profile: StockSupplierProfileRow,
  businessContacts: UnknownRow[],
  stallholderContacts: UnknownRow[],
  moneySuppliers: UnknownRow[],
  itemLinks: UnknownRow[],
  orders: UnknownRow[],
  transactions: UnknownRow[],
) {
  const eventContact = eventContactForProfile(
    profile,
    businessContacts,
    stallholderContacts,
  );

  const moneySupplierId = nullableText(
    profile.money_supplier_id,
  );

  const moneySupplier =
    moneySuppliers.find(
      (row) => text(row.id) === moneySupplierId,
    ) || null;

  const supplierItemLinks = itemLinks.filter(
    (row) =>
      pickString(row, [
        "stock_supplier_profile_id",
        "supplier_profile_id",
      ]) === profile.id,
  );

  const supplierOrders = orders.filter(
    (row) => orderSupplierId(row) === profile.id,
  );

  const openStatuses = new Set([
    "draft",
    "pending",
    "approved",
    "ordered",
    "partially_received",
    "partial",
    "open",
  ]);

  const openOrders = supplierOrders.filter((row) =>
    openStatuses.has(orderStatus(row)),
  );

  const now = Date.now();

  const overdueOrders = openOrders.filter((row) => {
    const expected = pickString(row, [
      "expected_delivery_date",
      "delivery_due_date",
      "expected_at",
    ]);

    if (!expected) return false;

    const date = new Date(expected);

    return (
      !Number.isNaN(date.getTime()) &&
      date.getTime() < now
    );
  });

  const supplierTransactions = moneySupplierId
    ? transactions.filter(
        (row) =>
          transactionSupplierId(row) ===
          moneySupplierId,
      )
    : [];

  const totalPaidPence =
    supplierTransactions.reduce(
      (total, row) =>
        total + transactionAmountPence(row),
      0,
    );

  const currentYearPaidPence =
    supplierTransactions.reduce(
      (total, row) =>
        isCurrentYear(transactionDate(row))
          ? total + transactionAmountPence(row)
          : total,
      0,
    );

  const sortedOrders = [...supplierOrders].sort(
    (left, right) => {
      const leftDate = new Date(
        pickString(left, [
          "order_date",
          "created_at",
          "updated_at",
        ]) || 0,
      ).getTime();

      const rightDate = new Date(
        pickString(right, [
          "order_date",
          "created_at",
          "updated_at",
        ]) || 0,
      ).getTime();

      return rightDate - leftDate;
    },
  );

  const lastOrder = sortedOrders[0] || null;

  const estimatedSpendPence =
    supplierOrders.reduce(
      (total, row) =>
        total +
        pickNumber(row, [
          "estimated_total_pence",
          "subtotal_pence",
          "expected_total_pence",
        ]),
      0,
    );

  const actualSpendPence =
    supplierOrders.reduce(
      (total, row) =>
        total +
        pickNumber(row, [
          "actual_total_pence",
          "total_pence",
          "final_total_pence",
        ]),
      0,
    );

  const deliveryDays = supplierOrders
    .map((row) =>
      pickNumber(row, [
        "actual_delivery_days",
        "delivery_days",
      ]),
    )
    .filter((value) => value > 0);

  const averageDeliveryDays =
    deliveryDays.length > 0
      ? deliveryDays.reduce(
          (total, value) => total + value,
          0,
        ) / deliveryDays.length
      : nullableNonNegativeInteger(
          profile.usual_delivery_days,
          "usual_delivery_days",
        );

  return {
    id: profile.id,
    displayName:
      nullableText(profile.display_name) ||
      pickString(eventContact, [
        "business_name",
        "organisation_name",
        "organization_name",
        "name",
      ]) ||
      pickString(moneySupplier, [
        "supplier_name",
        "name",
        "business_name",
      ]) ||
      "Unnamed supplier",
    supplierUse:
      nullableText(profile.supplier_use) || "stock",

    isActive: booleanValue(
      profile.is_active,
      true,
    ),
    needsReview: booleanValue(
      profile.needs_review,
    ),
    doNotUse: booleanValue(
      profile.do_not_use,
    ),

    usualDeliveryDays:
      profile.usual_delivery_days ?? null,
    minimumOrderValuePence:
      profile.minimum_order_value_pence ?? null,
    usualDeliveryCostPence:
      profile.usual_delivery_cost_pence ?? null,
    stockNotes:
      nullableText(profile.stock_notes),

    createdAt:
      nullableText(profile.created_at),
    updatedAt:
      nullableText(profile.updated_at),

    eventHub: {
      connected: Boolean(eventContact),
      recordType:
        nullableText(profile.event_record_type),
      recordId:
        nullableText(profile.event_record_id),
      organisationName: pickString(eventContact, [
        "business_name",
        "organisation_name",
        "organization_name",
        "company_name",
      ]),
      contactName: pickString(eventContact, [
        "contact_name",
        "name",
        "full_name",
      ]),
      email: pickString(eventContact, [
        "email",
        "contact_email",
        "business_email",
      ]),
      phone: pickString(eventContact, [
        "phone",
        "telephone",
        "contact_phone",
        "mobile",
      ]),
      lastEvent: pickString(eventContact, [
        "event_name",
        "last_event",
        "event_year",
      ]),
      eventRating: pickString(eventContact, [
        "rating",
        "relationship_rating",
        "work_rating",
      ]),
      doNotInvite: pickBoolean(eventContact, [
        "do_not_invite",
        "blocked",
      ]),
      requiresReview: pickBoolean(eventContact, [
        "needs_review",
        "requires_review",
      ]),
    },

    moneyManagement: {
      connected: Boolean(moneySupplier),
      supplierId: moneySupplierId,
      supplierName: pickString(moneySupplier, [
        "supplier_name",
        "name",
        "business_name",
      ]),
      accountReference: pickString(
        moneySupplier,
        [
          "account_reference",
          "supplier_reference",
          "reference",
        ],
      ),
      totalPaidPence,
      currentYearPaidPence,
      transactionCount:
        supplierTransactions.length,
      missingReceiptCount:
        supplierTransactions.filter((row) =>
          pickBoolean(row, [
            "receipt_missing",
            "missing_receipt",
          ]),
        ).length,
      unreconciledCount:
        supplierTransactions.filter(
          (row) =>
            !pickBoolean(row, [
              "checked",
              "reconciled",
              "is_reconciled",
            ]),
        ).length,
      doNotUse: pickBoolean(moneySupplier, [
        "do_not_use",
        "blocked",
      ]),
    },

    stockManagement: {
      itemCount: supplierItemLinks.length,
      openOrderCount: openOrders.length,
      overdueOrderCount: overdueOrders.length,
      lastOrderDate: pickString(lastOrder, [
        "order_date",
        "created_at",
        "updated_at",
      ]),
      totalEstimatedSpendPence:
        estimatedSpendPence,
      totalActualSpendPence:
        actualSpendPence,
      averageDeliveryDays:
        averageDeliveryDays === null
          ? null
          : Number(
              Number(averageDeliveryDays).toFixed(1),
            ),
    },
  };
}

async function writeAuditLog({
  admin,
  action,
  summary,
  recordId,
  afterData,
}: {
  admin: AdminIdentity;
  action: string;
  summary: string;
  recordId: string;
  afterData: UnknownRow;
}) {
  try {
    await supabaseAdmin
      .from(AUDIT_LOG_TABLE)
      .insert({
        admin_id: admin.id || null,
        admin_name:
          admin.name ||
          admin.full_name ||
          admin.email ||
          "Admin",
        admin_email: admin.email || null,
        admin_role: admin.role || null,
        area: "stock_management",
        action,
        action_label: "Stock supplier created",
        status: "success",
        risk_level: "low",
        summary,
        record_type: "stock_supplier",
        record_id: recordId,
        after_data: afterData,
        route:
          "/api/admin/stockmanagement/suppliers",
        http_method: "POST",
      });
  } catch {
    // Audit failure must not undo a successful supplier creation.
  }
}

export async function GET() {
  const endpoint =
    "GET /api/admin/stockmanagement/suppliers";

  try {
    await requireAdmin();

    const {
      data: profileData,
      error: profileError,
    } = await supabaseAdmin
      .from(STOCK_SUPPLIER_TABLE)
      .select("*")
      .order("display_name", {
        ascending: true,
      });

    if (profileError) {
      throw profileError;
    }

    const profiles =
      (profileData || []) as StockSupplierProfileRow[];

    const moneySupplierIds = profiles
      .map((profile) =>
        text(profile.money_supplier_id),
      )
      .filter(Boolean);

    const profileIds = profiles.map(
      (profile) => profile.id,
    );

    const [
      businessContactsResult,
      stallholderContactsResult,
      moneySuppliersResult,
      itemLinksResult,
      ordersResult,
      transactionsResult,
    ] = await Promise.all([
      optionalSelect<UnknownRow>(
        EVENT_BUSINESS_CONTACTS_TABLE,
      ),
      optionalSelect<UnknownRow>(
        EVENT_STALLHOLDER_CONTACTS_TABLE,
      ),
      optionalSelect<UnknownRow>(
        MONEY_SUPPLIERS_TABLE,
        "id",
        moneySupplierIds,
      ),
      optionalSelect<UnknownRow>(
        STOCK_ITEM_SUPPLIERS_TABLE,
        "stock_supplier_profile_id",
        profileIds,
      ),
      optionalSelect<UnknownRow>(
        STOCK_ORDERS_TABLE,
        "stock_supplier_profile_id",
        profileIds,
      ),
      optionalSelect<UnknownRow>(
        MONEY_TRANSACTIONS_TABLE,
        "money_supplier_id",
        moneySupplierIds,
      ),
    ]);

    const suppliers = profiles.map((profile) =>
      buildSupplierView(
        profile,
        businessContactsResult.rows,
        stallholderContactsResult.rows,
        moneySuppliersResult.rows,
        itemLinksResult.rows,
        ordersResult.rows,
        transactionsResult.rows,
      ),
    );

    const eventContacts = buildEventContactList(
      profiles,
      businessContactsResult.rows,
      stallholderContactsResult.rows,
    );

    const warnings = [
      businessContactsResult.warning,
      stallholderContactsResult.warning,
      moneySuppliersResult.warning,
      itemLinksResult.warning,
      ordersResult.warning,
      transactionsResult.warning,
    ].filter(Boolean);

    return NextResponse.json({
      ok: true,
      suppliers,
      eventContacts,
      summary: buildSummary(suppliers),
      permissions: {
        view: true,
        create: true,
        edit: true,
        linkEventHub: true,
        linkMoney: true,
        manageItemLinks: true,
        review: true,
        export: true,
      },
      integrationWarnings: warnings,
      refreshedAt: new Date().toISOString(),
    });
  } catch (error) {
    return apiError(
      error,
      endpoint,
      "Stock suppliers could not be loaded.",
    );
  }
}

export async function POST(
  request: NextRequest,
) {
  const endpoint =
    "POST /api/admin/stockmanagement/suppliers";

  try {
    const admin = await requireAdmin();

    const body =
      (await request.json()) as CreateSupplierBody;

    const displayName = text(body.display_name);

    if (displayName.length < 2) {
      throw new Error(
        "display_name is required and must contain at least two characters.",
      );
    }

    const supplierUse =
      text(body.supplier_use) || "stock";

    if (
      !ALLOWED_SUPPLIER_USES.has(supplierUse)
    ) {
      throw new Error(
        `supplier_use is invalid. Allowed values: ${Array.from(
          ALLOWED_SUPPLIER_USES,
        ).join(", ")}.`,
      );
    }

    const eventRecordType = nullableText(
      body.event_record_type,
    );
    const eventRecordId = nullableText(
      body.event_record_id,
    );
    const moneySupplierId = nullableText(
      body.money_supplier_id,
    );

    if (
      eventRecordId &&
      !isUuid(eventRecordId)
    ) {
      throw new Error(
        "event_record_id must be a valid UUID.",
      );
    }

    if (
      moneySupplierId &&
      !isUuid(moneySupplierId)
    ) {
      throw new Error(
        "money_supplier_id must be a valid UUID.",
      );
    }

    if (
      eventRecordId &&
      !eventRecordType
    ) {
      throw new Error(
        "event_record_type is required when event_record_id is supplied.",
      );
    }

    const usualDeliveryDays =
      nullableNonNegativeInteger(
        body.usual_delivery_days,
        "usual_delivery_days",
      );

    const minimumOrderValuePence =
      nullableNonNegativeMoney(
        body.minimum_order_value_pence,
        "minimum_order_value_pence",
      );

    const usualDeliveryCostPence =
      nullableNonNegativeMoney(
        body.usual_delivery_cost_pence,
        "usual_delivery_cost_pence",
      );

    const duplicateQuery = supabaseAdmin
      .from(STOCK_SUPPLIER_TABLE)
      .select("id, display_name")
      .ilike("display_name", displayName)
      .limit(1);

    const {
      data: duplicateRows,
      error: duplicateError,
    } = await duplicateQuery;

    if (duplicateError) {
      throw duplicateError;
    }

    if (
      duplicateRows &&
      duplicateRows.length > 0
    ) {
      throw new Error(
        `A Stock Management supplier named "${displayName}" already exists. Review and link the existing supplier instead of creating a duplicate.`,
      );
    }

    const now = new Date().toISOString();

    const insertPayload = {
      event_record_type: eventRecordType,
      event_record_id: eventRecordId,
      money_supplier_id: moneySupplierId,
      display_name: displayName,
      supplier_use: supplierUse,
      is_active: true,
      needs_review: false,
      do_not_use: false,
      usual_delivery_days:
        usualDeliveryDays,
      minimum_order_value_pence:
        minimumOrderValuePence,
      usual_delivery_cost_pence:
        usualDeliveryCostPence,
      stock_notes: nullableText(
        body.stock_notes,
      ),
      created_at: now,
      created_by: admin.id || null,
      created_by_name:
        admin.name ||
        admin.full_name ||
        admin.email ||
        "Admin",
      updated_at: now,
      updated_by: admin.id || null,
      updated_by_name:
        admin.name ||
        admin.full_name ||
        admin.email ||
        "Admin",
    };

    const { data, error } =
      await supabaseAdmin
        .from(STOCK_SUPPLIER_TABLE)
        .insert(insertPayload)
        .select("*")
        .single();

    if (error) {
      throw error;
    }

    const created =
      data as StockSupplierProfileRow;

    await writeAuditLog({
      admin,
      action:
        "stock_supplier_profile_created",
      summary: `Created Stock Management supplier profile for ${displayName}.`,
      recordId: created.id,
      afterData: created,
    });

    return NextResponse.json(
      {
        ok: true,
        message:
          "The Stock Management supplier profile has been created.",
        supplier: created,
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(
      error,
      endpoint,
      "The Stock Management supplier could not be created.",
    );
  }
}
