import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STOCK_SUPPLIER_TABLE = "stock_supplier_profiles";
const EVENT_CONTACT_TABLE = "event_business_contacts";
const AUDIT_LOG_TABLE = "admin_audit_logs";

const ALLOWED_SUPPLIER_USES = new Set([
  "stock",
  "service",
  "event_trader",
  "performer",
  "venue",
  "mixed",
]);

const ALLOWED_STOCK_RATINGS = new Set([
  "not_rated",
  "excellent",
  "good",
  "okay",
  "poor",
  "do_not_use",
]);

const STOCK_RATING_DEFAULT_SCORES: Record<string, number | null> = {
  not_rated: null,
  excellent: 5,
  good: 4,
  okay: 3,
  poor: 2,
  do_not_use: 1,
};

const PROFILE_EDITABLE_FIELDS = new Set([
  "display_name",
  "supplier_use",
  "usual_delivery_days",
  "minimum_order_value_pence",
  "usual_delivery_cost_pence",
  "stock_notes",
  "is_active",
  "needs_review",
  "do_not_use",
  "stock_rating",
  "stock_rating_score",
  "stock_rating_notes",
  "reason",
]);

type RouteContext = {
  params: Promise<{
    supplierId: string;
  }>;
};

type AdminIdentity = {
  id?: string | null;
  email?: string | null;
  name?: string | null;
  full_name?: string | null;
  role?: string | null;
  is_main_admin?: boolean | null;
  permissions?: unknown;
};

type SupplierUpdateBody = {
  display_name?: unknown;
  supplier_use?: unknown;
  usual_delivery_days?: unknown;
  minimum_order_value_pence?: unknown;
  usual_delivery_cost_pence?: unknown;
  stock_notes?: unknown;
  is_active?: unknown;
  needs_review?: unknown;
  do_not_use?: unknown;
  stock_rating?: unknown;
  stock_rating_score?: unknown;
  stock_rating_notes?: unknown;
  reason?: unknown;

  /*
   * These fields are intentionally recognised but rejected by this route.
   * Link changes must use the dedicated link/unlink APIs so they receive
   * separate validation, permissions and audit events.
   */
  event_record_type?: unknown;
  event_record_id?: unknown;
  money_supplier_id?: unknown;
};

type DeleteBody = {
  reason?: unknown;
  permanent?: unknown;
  password?: unknown;
  confirmation?: unknown;
};

type UnknownRow = Record<string, unknown>;
type EventWarningState = {
  connected: boolean;
  eventRecordId: string | null;
  doNotUse: boolean;
  needsReview: boolean;
  warningText: string | null;

  /*
   * Explicit display information for the Stock Control page.
   * A linked Event Hub Do-not-invite record should always render red.
   */
  severity: "none" | "review" | "blocked";
  colour: "default" | "amber" | "red";
  badgeLabel: string | null;
  heading: string | null;
  sourceField: string | null;
  sourceValue: string | null;
};


type ApiErrorLike = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
  status?: number;
};

type AuditLogInput = {
  admin: AdminIdentity;
  action: string;
  actionLabel: string;
  summary: string;
  supplierId: string;
  beforeData?: UnknownRow | null;
  afterData?: UnknownRow | null;
  reason?: string | null;
  httpMethod: "PATCH" | "DELETE";
  riskLevel?: "low" | "medium" | "high" | "critical";
  status?: "success" | "failed" | "blocked";
  error?: unknown;
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function nullableText(value: unknown) {
  const cleaned = cleanText(value);
  return cleaned || null;
}
function normaliseDatabaseValue(value: unknown) {
  return cleanText(value)
    .toLowerCase()
    .replaceAll("-", "_")
    .replace(/\s+/g, "_");
}

function databaseBoolean(value: unknown) {
  if (value === true || value === 1) {
    return true;
  }

  const normalised =
    normaliseDatabaseValue(value);

  return [
    "true",
    "1",
    "yes",
    "y",
    "blocked",
    "do_not_use",
    "do_not_invite",
    "not_invited",
    "never_use",
    "needs_review",
    "review",
  ].includes(normalised);
}

const EVENT_BLOCKED_VALUES = new Set([
  "blocked",
  "do_not_use",
  "do_not_invite",
  "not_invited",
  "never_use",
  "blacklisted",
]);

const EVENT_REVIEW_VALUES = new Set([
  "needs_review",
  "review",
  "review_required",
  "requires_review",
]);

function eventWarningCandidates(
  row: UnknownRow | null,
) {
  if (!row) {
    return [] as Array<{
      field: string;
      rawValue: unknown;
      normalisedValue: string;
    }>;
  }

  const fields = [
    "do_not_use",
    "do_not_invite",
    "is_do_not_use",
    "is_blocked",
    "blocked",
    "blocked_status",
    "warning_status",
    "status",
    "rating",
    "relationship_rating",
    "contact_rating",
    "invite_status",
    "supplier_status",
    "needs_review",
    "requires_review",
    "is_review_required",
  ];

  return fields.map((field) => ({
    field,
    rawValue: row[field],
    normalisedValue:
      normaliseDatabaseValue(row[field]),
  }));
}

function findEventBlockedSource(
  row: UnknownRow | null,
) {
  return (
    eventWarningCandidates(row).find(
      ({ rawValue, normalisedValue }) =>
        databaseBoolean(rawValue) &&
        (
          EVENT_BLOCKED_VALUES.has(
            normalisedValue,
          ) ||
          normalisedValue === "true" ||
          normalisedValue === "1" ||
          normalisedValue === "yes" ||
          normalisedValue === "y"
        ),
    ) || null
  );
}

function findEventReviewSource(
  row: UnknownRow | null,
) {
  return (
    eventWarningCandidates(row).find(
      ({ rawValue, normalisedValue }) =>
        databaseBoolean(rawValue) &&
        (
          EVENT_REVIEW_VALUES.has(
            normalisedValue,
          ) ||
          normalisedValue === "true" ||
          normalisedValue === "1" ||
          normalisedValue === "yes" ||
          normalisedValue === "y"
        ),
    ) || null
  );
}

function eventContactIsBlocked(
  row: UnknownRow | null,
) {
  if (!row) return false;

  const directBooleanFields = [
    row.do_not_use,
    row.do_not_invite,
    row.is_do_not_use,
    row.is_blocked,
    row.blocked,
  ];

  if (
    directBooleanFields.some(
      (value) => value === true || value === 1,
    )
  ) {
    return true;
  }

  return Boolean(findEventBlockedSource(row));
}

function eventContactNeedsReview(
  row: UnknownRow | null,
) {
  if (!row) return false;

  return (
    eventContactIsBlocked(row) ||
    Boolean(findEventReviewSource(row))
  );
}

function eventWarningText(
  state: EventWarningState,
) {
  if (state.doNotUse) {
    return "Do not invite this contact. Event Hub has blocked invitation and checklist actions. Review the saved Event Hub notes before creating orders, linking stock items or using this supplier.";
  }

  if (state.needsReview) {
    return "This Event Hub contact requires review before it is used in Stock Management.";
  }

  return null;
}


function buildEventWarningState({
  connected,
  eventRecordId,
  row,
}: {
  connected: boolean;
  eventRecordId: string | null;
  row: UnknownRow | null;
}): EventWarningState {
  const blockedSource =
    findEventBlockedSource(row);
  const reviewSource =
    findEventReviewSource(row);

  const doNotUse =
    eventContactIsBlocked(row);
  const needsReview =
    eventContactNeedsReview(row);

  const state: EventWarningState = {
    connected,
    eventRecordId,
    doNotUse,
    needsReview,
    warningText: null,
    severity: doNotUse
      ? "blocked"
      : needsReview
        ? "review"
        : "none",
    colour: doNotUse
      ? "red"
      : needsReview
        ? "amber"
        : "default",
    badgeLabel: doNotUse
      ? "Do not use"
      : needsReview
        ? "Needs review"
        : null,
    heading: doNotUse
      ? "Do not invite this contact"
      : needsReview
        ? "Review this contact"
        : null,
    sourceField:
      blockedSource?.field ||
      reviewSource?.field ||
      null,
    sourceValue:
      blockedSource
        ? cleanText(blockedSource.rawValue)
        : reviewSource
          ? cleanText(reviewSource.rawValue)
          : null,
  };

  state.warningText =
    eventWarningText(state);

  return state;
}


function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function parseBoolean(value: unknown, fieldName: string) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`${fieldName} must be true or false.`);
}

function parseNullableInteger(
  value: unknown,
  fieldName: string,
  maximum?: number,
) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(
      `${fieldName} must be a whole number of zero or more.`,
    );
  }

  if (maximum !== undefined && parsed > maximum) {
    throw new Error(
      `${fieldName} must not be greater than ${maximum}.`,
    );
  }

  return parsed;
}

function parseNullablePence(
  value: unknown,
  fieldName: string,
) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(
      `${fieldName} must be a non-negative whole amount in pence.`,
    );
  }

  return parsed;
}

function parseStockRating(value: unknown) {
  const rating = cleanText(value)
    .toLowerCase()
    .replaceAll("-", "_")
    .replace(/\s+/g, "_");

  if (!ALLOWED_STOCK_RATINGS.has(rating)) {
    throw new Error(
      `stock_rating is invalid. Allowed values: ${Array.from(
        ALLOWED_STOCK_RATINGS,
      ).join(", ")}.`,
    );
  }

  return rating;
}

function parseNullableRatingScore(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 1 ||
    parsed > 5
  ) {
    throw new Error(
      "stock_rating_score must be a whole number between 1 and 5.",
    );
  }

  return parsed;
}

function effectiveStockRatingScore(
  rating: string,
  suppliedScore: number | null,
) {
  if (rating === "not_rated") {
    return null;
  }

  return (
    suppliedScore ??
    STOCK_RATING_DEFAULT_SCORES[rating] ??
    null
  );
}

function errorStatus(error: unknown) {
  const source = error as ApiErrorLike;
  const explicitStatus = Number(source?.status);

  if (
    Number.isInteger(explicitStatus) &&
    explicitStatus >= 400 &&
    explicitStatus <= 599
  ) {
    return explicitStatus;
  }

  const code = cleanText(source?.code).toUpperCase();
  const message =
    error instanceof Error ? error.message.toLowerCase() : "";

  if (
    code === "PGRST116" ||
    message.includes("not found") ||
    message.includes("does not exist")
  ) {
    return 404;
  }

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
    message.includes("main admin") ||
    code === "MAIN_ADMIN_REQUIRED" ||
    code === "MAIN_ADMIN_PASSWORD_INCORRECT"
  ) {
    return 403;
  }

  if (
    code === "23503" ||
    message.includes("foreign key") ||
    message.includes("still linked") ||
    message.includes("linked records")
  ) {
    return 409;
  }

  if (
    code === "23505" ||
    message.includes("already exists") ||
    message.includes("duplicate")
  ) {
    return 409;
  }

  if (
    message.includes("required") ||
    message.includes("must be") ||
    message.includes("invalid") ||
    message.includes("not allowed") ||
    message.includes("unsupported") ||
    message.includes("confirmation")
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
  const source = error as ApiErrorLike;

  return NextResponse.json(
    {
      ok: false,
      error:
        error instanceof Error && error.message
          ? error.message
          : fallback,
      code: source?.code || `STOCK_SUPPLIER_${status}`,
      details:
        source?.details ||
        "The Stock Management supplier API could not complete the request.",
      hint:
        source?.hint ||
        "Check the supplier ID, request fields, administrator permissions, Supabase columns and server logs.",
      endpoint,
      status,
    },
    { status },
  );
}

async function readJsonBody<T extends Record<string, unknown>>(
  request: NextRequest,
  {
    allowEmpty = false,
  }: {
    allowEmpty?: boolean;
  } = {},
): Promise<T> {
  const raw = await request.text();

  if (!raw.trim()) {
    if (allowEmpty) {
      return {} as T;
    }

    throw new Error("A JSON request body is required.");
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      throw new Error("The JSON request body must be an object.");
    }

    return parsed as T;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "The JSON request body must be an object."
    ) {
      throw error;
    }

    throw new Error("The request body contains invalid JSON.");
  }
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

function adminDisplayName(admin: AdminIdentity) {
  return (
    cleanText(admin.name) ||
    cleanText(admin.full_name) ||
    cleanText(admin.email) ||
    "Admin"
  );
}

function isMainAdmin(admin: AdminIdentity) {
  return (
    admin.is_main_admin === true ||
    cleanText(admin.role).toLowerCase() === "main_admin"
  );
}

function assertNoUnsupportedFields(body: SupplierUpdateBody) {
  const suppliedFields = Object.keys(body);
  const unsupportedFields = suppliedFields.filter(
    (field) => !PROFILE_EDITABLE_FIELDS.has(field),
  );

  if (unsupportedFields.length > 0) {
    throw new Error(
      `Unsupported field${unsupportedFields.length === 1 ? "" : "s"}: ${unsupportedFields.join(
        ", ",
      )}. Event Hub and Money Management links must be changed through their dedicated connection APIs.`,
    );
  }
}

async function getSupplierOrThrow(supplierId: string) {
  const { data, error } = await supabaseAdmin
    .from(STOCK_SUPPLIER_TABLE)
    .select("*")
    .eq("id", supplierId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      "Stock Management supplier was not found.",
    );
  }

  return data as UnknownRow;
}
async function getEventWarningState(
  supplier: UnknownRow,
): Promise<EventWarningState> {
  const eventRecordId =
    nullableText(supplier.event_record_id);

  if (!eventRecordId) {
    return buildEventWarningState({
      connected: false,
      eventRecordId: null,
      row: null,
    });
  }

  const { data, error } = await supabaseAdmin
    .from(EVENT_CONTACT_TABLE)
    .select("*")
    .eq("id", eventRecordId)
    .maybeSingle();

  if (error) {
    throw Object.assign(
      new Error(
        "The linked Event Hub contact warning could not be checked.",
      ),
      {
        status: 500,
        code:
          error.code ||
          "EVENT_HUB_WARNING_LOOKUP_FAILED",
        details: error.details || null,
        hint:
          error.hint ||
          `Confirm public.${EVENT_CONTACT_TABLE} exists and contains the linked contact.`,
      },
    );
  }

  const row = data as UnknownRow | null;

  return buildEventWarningState({
    connected: Boolean(row),
    eventRecordId,
    row,
  });
}

function appendEventWarningToNotes(
  currentNotes: unknown,
  warningText: string | null,
) {
  const existing = nullableText(currentNotes);

  if (!warningText) {
    return existing;
  }

  if (existing?.includes(warningText)) {
    return existing;
  }

  return existing
    ? `${existing}\n\n${warningText}`
    : warningText;
}

async function synchroniseEventWarning({
  supplier,
  admin,
  supplierId,
  audit = true,
}: {
  supplier: UnknownRow;
  admin: AdminIdentity;
  supplierId: string;
  audit?: boolean;
}) {
  const warning = await getEventWarningState(supplier);

  if (!warning.connected) {
    return {
      supplier,
      warning,
      changed: false,
    };
  }

  const desiredDoNotUse = warning.doNotUse;
  const desiredNeedsReview = warning.needsReview;

  const currentDoNotUse =
    supplier.do_not_use === true;
  const currentNeedsReview =
    supplier.needs_review === true;

  const currentNotes =
    nullableText(supplier.stock_notes);
  const desiredNotes = appendEventWarningToNotes(
    currentNotes,
    warning.warningText,
  );

  const changed =
    currentDoNotUse !== desiredDoNotUse ||
    currentNeedsReview !== desiredNeedsReview ||
    currentNotes !== desiredNotes;

  if (!changed) {
    return {
      supplier,
      warning,
      changed: false,
    };
  }

  const updatePayload: UnknownRow = {
    do_not_use: desiredDoNotUse,
    needs_review: desiredNeedsReview,
    stock_notes: desiredNotes,
    updated_at: new Date().toISOString(),
    updated_by: admin.id || null,
    updated_by_name: adminDisplayName(admin),
  };

  const { data, error } = await supabaseAdmin
    .from(STOCK_SUPPLIER_TABLE)
    .update(updatePayload as never)
    .eq("id", supplierId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const updated = data as UnknownRow;

  if (audit) {
    await writeAuditLog({
      admin,
      action:
        warning.doNotUse
          ? "stock_supplier_event_warning_synced"
          : "stock_supplier_event_review_synced",
      actionLabel:
        warning.doNotUse
          ? "Event Hub do-not-use warning synchronised"
          : "Event Hub review warning synchronised",
      summary:
        warning.doNotUse
          ? `Synchronised Event Hub Do not use / Do not invite warning for supplier ${cleanText(updated.display_name) || supplierId}.`
          : `Synchronised Event Hub Needs review warning for supplier ${cleanText(updated.display_name) || supplierId}.`,
      supplierId,
      beforeData: supplier,
      afterData: updated,
      reason:
        warning.sourceField
          ? `The linked Event Hub contact controls this warning through ${warning.sourceField}=${warning.sourceValue || "true"}.`
          : "The linked Event Hub contact controls this warning.",
      httpMethod: "PATCH",
      riskLevel: warning.doNotUse
        ? "high"
        : "medium",
      status: "success",
    });
  }

  return {
    supplier: updated,
    warning,
    changed: true,
  };
}

function changedFields(
  beforeData: UnknownRow,
  afterData: UnknownRow,
) {
  return Object.keys(afterData).filter((key) => {
    if (
      key === "updated_at" ||
      key === "updated_by" ||
      key === "updated_by_name"
    ) {
      return false;
    }

    return JSON.stringify(beforeData[key]) !== JSON.stringify(afterData[key]);
  });
}

function profileAuditAction(
  beforeData: UnknownRow,
  afterData: UnknownRow,
) {
  const fields = changedFields(beforeData, afterData);

  if (
    fields.includes("stock_rating") ||
    fields.includes("stock_rating_score") ||
    fields.includes("stock_rating_notes")
  ) {
    const rating = cleanText(afterData.stock_rating) || "not_rated";

    return {
      action:
        rating === "do_not_use"
          ? "stock_supplier_rating_blocked"
          : rating === "poor"
            ? "stock_supplier_rating_review_required"
            : "stock_supplier_rating_updated",
      actionLabel:
        rating === "do_not_use"
          ? "Stock supplier rated do not use"
          : rating === "poor"
            ? "Stock supplier rated poor"
            : "Stock supplier rating updated",
      riskLevel:
        rating === "do_not_use"
          ? "high" as const
          : rating === "poor"
            ? "medium" as const
            : "low" as const,
    };
  }

  if (
    fields.includes("do_not_use") &&
    afterData.do_not_use === true
  ) {
    return {
      action: "supplier_marked_do_not_use",
      actionLabel: "Supplier marked do not use",
      riskLevel: "high" as const,
    };
  }

  if (
    fields.includes("is_active") &&
    afterData.is_active === false
  ) {
    return {
      action: "stock_supplier_profile_archived",
      actionLabel: "Stock supplier archived",
      riskLevel: "medium" as const,
    };
  }

  return {
    action: "stock_supplier_profile_updated",
    actionLabel: "Stock supplier updated",
    riskLevel: "low" as const,
  };
}

async function writeAuditLog({
  admin,
  action,
  actionLabel,
  summary,
  supplierId,
  beforeData,
  afterData,
  reason,
  httpMethod,
  riskLevel,
  status = "success",
  error: actionError,
}: AuditLogInput) {
  const source = actionError as ApiErrorLike;

  const { error } = await supabaseAdmin
    .from(AUDIT_LOG_TABLE)
    .insert({
      admin_id: admin.id || null,
      admin_name: adminDisplayName(admin),
      admin_email: admin.email || null,
      admin_role: admin.role || null,
      area: "stock_management",
      module: "stock_suppliers",
      action,
      action_label: actionLabel,
      status,
      risk_level:
        riskLevel ||
        (httpMethod === "DELETE" ? "high" : "low"),
      summary,
      reason: reason || null,
      record_type: "stock_supplier",
      record_id: supplierId,
      before_data: beforeData || null,
      after_data: afterData || null,
      route: `/api/admin/stockmanagement/suppliers/${supplierId}`,
      http_method: httpMethod,
      error_code: source?.code || null,
      error_message:
        actionError instanceof Error
          ? actionError.message
          : null,
    } as never);

  if (error) {
    console.error("Stock supplier audit log failed", {
      supplierId,
      action,
      auditError: error,
    });
  }
}

async function verifyMainAdminPassword(
  admin: AdminIdentity,
  password: string,
) {
  if (!isMainAdmin(admin)) {
    throw Object.assign(
      new Error(
        "Main admin permission is required to permanently delete a Stock Management supplier.",
      ),
      {
        status: 403,
        code: "MAIN_ADMIN_REQUIRED",
      },
    );
  }

  const email = cleanText(admin.email);

  if (!email) {
    throw Object.assign(
      new Error(
        "The signed-in main admin account does not have an email address.",
      ),
      {
        status: 403,
        code: "ADMIN_EMAIL_MISSING",
      },
    );
  }

  if (!password) {
    throw Object.assign(
      new Error(
        "Enter the signed-in main admin password to permanently delete this supplier.",
      ),
      {
        status: 400,
        code: "MAIN_ADMIN_PASSWORD_REQUIRED",
      },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !publicKey) {
    throw Object.assign(
      new Error(
        "Supabase password verification is not configured on the server.",
      ),
      {
        status: 500,
        code: "SUPABASE_AUTH_CONFIG_MISSING",
        hint:
          "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      },
    );
  }

  const verifier = createClient(
    supabaseUrl,
    publicKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

  const { error } =
    await verifier.auth.signInWithPassword({
      email,
      password,
    });

  if (error) {
    throw Object.assign(
      new Error(
        "The main admin password is incorrect.",
      ),
      {
        status: 403,
        code: "MAIN_ADMIN_PASSWORD_INCORRECT",
        details:
          "Supabase Auth rejected the supplied password.",
      },
    );
  }

  await verifier.auth.signOut();
}

function buildUpdatePayload(
  body: SupplierUpdateBody,
  admin: AdminIdentity,
) {
  assertNoUnsupportedFields(body);

  const updatePayload: UnknownRow = {};

  if (body.display_name !== undefined) {
    const displayName = cleanText(body.display_name);

    if (displayName.length < 2) {
      throw new Error(
        "display_name is required and must contain at least two characters.",
      );
    }

    if (displayName.length > 200) {
      throw new Error(
        "display_name must not contain more than 200 characters.",
      );
    }

    updatePayload.display_name = displayName;
  }

  if (body.supplier_use !== undefined) {
    const supplierUse = cleanText(body.supplier_use);

    if (!ALLOWED_SUPPLIER_USES.has(supplierUse)) {
      throw new Error(
        `supplier_use is invalid. Allowed values: ${Array.from(
          ALLOWED_SUPPLIER_USES,
        ).join(", ")}.`,
      );
    }

    updatePayload.supplier_use = supplierUse;
  }

  if (body.usual_delivery_days !== undefined) {
    updatePayload.usual_delivery_days =
      parseNullableInteger(
        body.usual_delivery_days,
        "usual_delivery_days",
        3650,
      );
  }

  if (body.minimum_order_value_pence !== undefined) {
    updatePayload.minimum_order_value_pence =
      parseNullablePence(
        body.minimum_order_value_pence,
        "minimum_order_value_pence",
      );
  }

  if (body.usual_delivery_cost_pence !== undefined) {
    updatePayload.usual_delivery_cost_pence =
      parseNullablePence(
        body.usual_delivery_cost_pence,
        "usual_delivery_cost_pence",
      );
  }

  if (body.stock_notes !== undefined) {
    const stockNotes = nullableText(body.stock_notes);

    if (stockNotes && stockNotes.length > 10_000) {
      throw new Error(
        "stock_notes must not contain more than 10,000 characters.",
      );
    }

    updatePayload.stock_notes = stockNotes;
  }

  if (body.is_active !== undefined) {
    updatePayload.is_active = parseBoolean(
      body.is_active,
      "is_active",
    );
  }

  if (body.needs_review !== undefined) {
    updatePayload.needs_review = parseBoolean(
      body.needs_review,
      "needs_review",
    );
  }

  if (body.do_not_use !== undefined) {
    updatePayload.do_not_use = parseBoolean(
      body.do_not_use,
      "do_not_use",
    );
  }

  const ratingWasSupplied =
    body.stock_rating !== undefined;
  const scoreWasSupplied =
    body.stock_rating_score !== undefined;
  const notesWereSupplied =
    body.stock_rating_notes !== undefined;

  if (
    ratingWasSupplied ||
    scoreWasSupplied ||
    notesWereSupplied
  ) {
    const rating = ratingWasSupplied
      ? parseStockRating(body.stock_rating)
      : null;

    const suppliedScore = scoreWasSupplied
      ? parseNullableRatingScore(
          body.stock_rating_score,
        )
      : null;

    if (ratingWasSupplied && rating) {
      updatePayload.stock_rating = rating;
      updatePayload.stock_rating_score =
        effectiveStockRatingScore(
          rating,
          suppliedScore,
        );

      if (rating === "poor") {
        updatePayload.needs_review = true;
      }

      if (rating === "do_not_use") {
        updatePayload.do_not_use = true;
        updatePayload.needs_review = true;
      }

      if (
        rating === "not_rated" &&
        suppliedScore !== null
      ) {
        throw new Error(
          "stock_rating_score must be empty when stock_rating is not_rated.",
        );
      }
    } else if (scoreWasSupplied) {
      updatePayload.stock_rating_score =
        suppliedScore;
    }

    if (notesWereSupplied) {
      const ratingNotes = nullableText(
        body.stock_rating_notes,
      );

      if (
        ratingNotes &&
        ratingNotes.length > 5_000
      ) {
        throw new Error(
          "stock_rating_notes must not contain more than 5,000 characters.",
        );
      }

      updatePayload.stock_rating_notes =
        ratingNotes;
    }

    updatePayload.stock_rating_updated_at =
      new Date().toISOString();
    updatePayload.stock_rating_updated_by =
      admin.id || null;
    updatePayload.stock_rating_updated_by_name =
      adminDisplayName(admin);
  }

  if (Object.keys(updatePayload).length === 0) {
    throw new Error(
      "At least one editable supplier field must be supplied for update.",
    );
  }

  updatePayload.updated_at = new Date().toISOString();
  updatePayload.updated_by = admin.id || null;
  updatePayload.updated_by_name = adminDisplayName(admin);

  return updatePayload;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  const { supplierId } = await context.params;
  const endpoint =
    `GET /api/admin/stockmanagement/suppliers/${supplierId}`;

  try {
    const admin = await requireAdmin();

    if (!isUuid(supplierId)) {
      throw new Error(
        "supplierId must be a valid UUID.",
      );
    }

    const supplier =
      await getSupplierOrThrow(supplierId);

    const synchronised =
      await synchroniseEventWarning({
        supplier,
        admin,
        supplierId,
      });

    return NextResponse.json(
      {
        ok: true,
        supplier: synchronised.supplier,
        eventHubWarning: synchronised.warning,
        warningSynchronised:
          synchronised.changed,

        /*
         * The page can use this object directly:
         * eventHubPresentation.isRed === true means the
         * card, badge, warning panel and action button
         * should use the red blocked style.
         */
        stockRating: {
          rating:
            nullableText(
              synchronised.supplier.stock_rating,
            ) || "not_rated",
          score:
            synchronised.supplier
              .stock_rating_score ?? null,
          notes:
            nullableText(
              synchronised.supplier
                .stock_rating_notes,
            ),
          updatedAt:
            nullableText(
              synchronised.supplier
                .stock_rating_updated_at,
            ),
          updatedByName:
            nullableText(
              synchronised.supplier
                .stock_rating_updated_by_name,
            ),
          isPoor:
            synchronised.supplier
              .stock_rating === "poor",
          isDoNotUse:
            synchronised.supplier
              .stock_rating === "do_not_use",
        },

        eventHubPresentation: {
          isRed:
            synchronised.warning.colour === "red",
          colour:
            synchronised.warning.colour,
          severity:
            synchronised.warning.severity,
          badgeLabel:
            synchronised.warning.badgeLabel,
          heading:
            synchronised.warning.heading,
          message:
            synchronised.warning.warningText,
          sourceField:
            synchronised.warning.sourceField,
          sourceValue:
            synchronised.warning.sourceValue,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return apiError(
      error,
      endpoint,
      "The Stock Management supplier could not be loaded.",
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  const { supplierId } = await context.params;
  const endpoint =
    `PATCH /api/admin/stockmanagement/suppliers/${supplierId}`;

  try {
    const admin = await requireAdmin();

    if (!isUuid(supplierId)) {
      throw new Error(
        "supplierId must be a valid UUID.",
      );
    }

    const loadedSupplier =
      await getSupplierOrThrow(supplierId);

    const preUpdateSync =
      await synchroniseEventWarning({
        supplier: loadedSupplier,
        admin,
        supplierId,
      });

    const beforeData =
      preUpdateSync.supplier;
    const eventWarning =
      preUpdateSync.warning;

    const body =
      await readJsonBody<SupplierUpdateBody>(
        request,
      );
    const updatePayload =
      buildUpdatePayload(body, admin);

    if (
      eventWarning.doNotUse &&
      updatePayload.do_not_use === false
    ) {
      throw Object.assign(
        new Error(
          "This supplier cannot be unblocked in Stock Management because the linked Event Hub contact is still marked Do not use / Do not invite.",
        ),
        {
          status: 409,
          code:
            "EVENT_HUB_DO_NOT_USE_STILL_ACTIVE",
          details:
            "The warning is controlled by Event Hub.",
          hint:
            "Remove the Do not use / Do not invite warning in Event Hub first, then refresh this supplier.",
        },
      );
    }

    if (
      eventWarning.needsReview &&
      updatePayload.needs_review === false
    ) {
      throw Object.assign(
        new Error(
          "This supplier cannot have Needs review cleared because the linked Event Hub contact still requires review.",
        ),
        {
          status: 409,
          code:
            "EVENT_HUB_REVIEW_STILL_ACTIVE",
          details:
            "The review warning is controlled by Event Hub.",
          hint:
            "Clear the review warning in Event Hub first, then refresh this supplier.",
        },
      );
    }

    if (eventWarning.doNotUse) {
      updatePayload.do_not_use = true;
      updatePayload.needs_review = true;
      updatePayload.stock_notes =
        appendEventWarningToNotes(
          updatePayload.stock_notes ??
            beforeData.stock_notes,
          eventWarning.warningText,
        );
    } else if (eventWarning.needsReview) {
      updatePayload.needs_review = true;
      updatePayload.stock_notes =
        appendEventWarningToNotes(
          updatePayload.stock_notes ??
            beforeData.stock_notes,
          eventWarning.warningText,
        );
    }

    if (
      (
        updatePayload.do_not_use === true ||
        updatePayload.stock_rating === "do_not_use"
      ) &&
      !nullableText(body.reason) &&
      !eventWarning.doNotUse
    ) {
      throw new Error(
        "A reason is required when marking a supplier as do not use.",
      );
    }

    const {
      data: updatedData,
      error: updateError,
    } = await supabaseAdmin
      .from(STOCK_SUPPLIER_TABLE)
      .update(updatePayload as never)
      .eq("id", supplierId)
      .select("*")
      .single();

    if (updateError) {
      throw updateError;
    }

    const afterData = updatedData as UnknownRow;
    const fields = changedFields(beforeData, afterData);

    if (fields.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No supplier values changed.",
        supplier: afterData,
        changedFields: [],
      });
    }

    const audit = profileAuditAction(beforeData, afterData);

    await writeAuditLog({
      admin,
      ...audit,
      summary: `Updated Stock Management supplier ${
        cleanText(afterData.display_name) || supplierId
      }. Changed fields: ${fields.join(", ")}.`,
      supplierId,
      beforeData,
      afterData,
      reason: nullableText(body.reason),
      httpMethod: "PATCH",
    });

    return NextResponse.json({
      ok: true,
      message:
        "The Stock Management supplier profile was updated.",
      supplier: afterData,
      changedFields: fields,
      stockRating: {
        rating:
          nullableText(afterData.stock_rating) ||
          "not_rated",
        score:
          afterData.stock_rating_score ?? null,
        notes:
          nullableText(
            afterData.stock_rating_notes,
          ),
        updatedAt:
          nullableText(
            afterData.stock_rating_updated_at,
          ),
        updatedByName:
          nullableText(
            afterData.stock_rating_updated_by_name,
          ),
        isPoor:
          afterData.stock_rating === "poor",
        isDoNotUse:
          afterData.stock_rating ===
          "do_not_use",
      },
      eventHubWarning: eventWarning,
      eventHubPresentation: {
        isRed:
          eventWarning.colour === "red",
        colour: eventWarning.colour,
        severity: eventWarning.severity,
        badgeLabel:
          eventWarning.badgeLabel,
        heading: eventWarning.heading,
        message: eventWarning.warningText,
        sourceField:
          eventWarning.sourceField,
        sourceValue:
          eventWarning.sourceValue,
      },
    });
  } catch (error) {
    return apiError(
      error,
      endpoint,
      "The Stock Management supplier could not be updated.",
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
) {
  const { supplierId } = await context.params;
  const endpoint =
    `DELETE /api/admin/stockmanagement/suppliers/${supplierId}`;

  let admin: AdminIdentity | null = null;
  let beforeData: UnknownRow | null = null;
  let reason: string | null = null;
  let permanent = false;

  try {
    admin = await requireAdmin();

    if (!isUuid(supplierId)) {
      throw Object.assign(
        new Error(
          "supplierId must be a valid UUID.",
        ),
        {
          status: 400,
          code: "INVALID_SUPPLIER_ID",
        },
      );
    }

    beforeData = await getSupplierOrThrow(supplierId);

    const body = await readJsonBody<DeleteBody>(
      request,
      {
        allowEmpty: true,
      },
    );

    reason = nullableText(body.reason);

    if (!reason || reason.length < 10) {
      throw Object.assign(
        new Error(
          "A deletion or archive reason of at least 10 characters is required.",
        ),
        {
          status: 400,
          code: "DELETE_REASON_REQUIRED",
        },
      );
    }

    permanent =
      body.permanent === true ||
      body.permanent === "true";

    if (permanent) {
      const expectedConfirmation =
        cleanText(beforeData.display_name);

      const confirmation =
        cleanText(body.confirmation);

      const password =
        cleanText(body.password);

      if (!isMainAdmin(admin)) {
        const blockedError = Object.assign(
          new Error(
            "Main admin permission is required to permanently delete a Stock Management supplier.",
          ),
          {
            status: 403,
            code: "MAIN_ADMIN_REQUIRED",
          },
        );

        await writeAuditLog({
          admin,
          action: "stock_supplier_delete_blocked",
          actionLabel:
            "Stock supplier deletion blocked",
          summary: `Blocked permanent deletion of Stock Management supplier ${
            expectedConfirmation || supplierId
          } because the signed-in administrator is not a main admin.`,
          supplierId,
          beforeData,
          afterData: null,
          reason,
          httpMethod: "DELETE",
          riskLevel: "critical",
          status: "blocked",
          error: blockedError,
        });

        throw blockedError;
      }

      if (!expectedConfirmation) {
        throw Object.assign(
          new Error(
            "The supplier does not have a valid display name for deletion confirmation.",
          ),
          {
            status: 409,
            code: "SUPPLIER_CONFIRMATION_NAME_MISSING",
          },
        );
      }

      if (confirmation !== expectedConfirmation) {
        const blockedError = Object.assign(
          new Error(
            `Type the supplier name exactly: ${expectedConfirmation}`,
          ),
          {
            status: 400,
            code: "DELETE_CONFIRMATION_INCORRECT",
          },
        );

        await writeAuditLog({
          admin,
          action: "stock_supplier_delete_blocked",
          actionLabel:
            "Stock supplier deletion blocked",
          summary: `Blocked permanent deletion of Stock Management supplier ${expectedConfirmation} because the confirmation name was incorrect.`,
          supplierId,
          beforeData,
          afterData: null,
          reason,
          httpMethod: "DELETE",
          riskLevel: "critical",
          status: "blocked",
          error: blockedError,
        });

        throw blockedError;
      }

      try {
        await verifyMainAdminPassword(
          admin,
          password,
        );
      } catch (passwordError) {
        await writeAuditLog({
          admin,
          action: "stock_supplier_delete_blocked",
          actionLabel:
            "Stock supplier deletion blocked",
          summary: `Blocked permanent deletion of Stock Management supplier ${expectedConfirmation} because main-admin password verification failed.`,
          supplierId,
          beforeData,
          afterData: null,
          reason,
          httpMethod: "DELETE",
          riskLevel: "critical",
          status: "blocked",
          error: passwordError,
        });

        throw passwordError;
      }

      const { error: deleteError } =
        await supabaseAdmin
          .from(STOCK_SUPPLIER_TABLE)
          .delete()
          .eq("id", supplierId);

      if (deleteError) {
        if (deleteError.code === "23503") {
          throw Object.assign(
            new Error(
              "This supplier cannot be permanently deleted because linked stock items, orders, reviews, audit records or other supplier data still exist. Archive the supplier instead, or move/remove the linked records first.",
            ),
            {
              status: 409,
              code: deleteError.code,
              details: deleteError.details,
              hint:
                "Use the supplier workspace to review item links, orders and connected records before permanent deletion.",
            },
          );
        }

        throw deleteError;
      }

      await writeAuditLog({
        admin,
        action:
          "stock_supplier_profile_deleted",
        actionLabel:
          "Stock supplier permanently deleted",
        summary: `Permanently deleted Stock Management supplier ${expectedConfirmation}.`,
        supplierId,
        beforeData,
        afterData: null,
        reason,
        httpMethod: "DELETE",
        riskLevel: "critical",
        status: "success",
      });

      return NextResponse.json({
        ok: true,
        message:
          "The Stock Management supplier was permanently deleted. Linked Event Hub and Money Management source records were not deleted.",
        deletedSupplierId: supplierId,
      });
    }

    if (beforeData.is_active === false) {
      return NextResponse.json({
        ok: true,
        message:
          "The Stock Management supplier is already archived.",
        supplier: beforeData,
      });
    }

    const archivePayload: UnknownRow = {
      is_active: false,
      needs_review: true,
      updated_at: new Date().toISOString(),
      updated_by: admin.id || null,
      updated_by_name:
        adminDisplayName(admin),
    };

    const {
      data: archivedData,
      error: archiveError,
    } = await supabaseAdmin
      .from(STOCK_SUPPLIER_TABLE)
      .update(archivePayload as never)
      .eq("id", supplierId)
      .select("*")
      .single();

    if (archiveError) {
      throw archiveError;
    }

    const afterData =
      archivedData as UnknownRow;

    await writeAuditLog({
      admin,
      action:
        "stock_supplier_profile_archived",
      actionLabel:
        "Stock supplier archived",
      summary: `Archived Stock Management supplier ${
        cleanText(afterData.display_name) ||
        supplierId
      }.`,
      supplierId,
      beforeData,
      afterData,
      reason,
      httpMethod: "DELETE",
      riskLevel: "high",
      status: "success",
    });

    return NextResponse.json({
      ok: true,
      message:
        "The Stock Management supplier was archived.",
      supplier: afterData,
    });
  } catch (error) {
    if (
      admin &&
      ![
        "MAIN_ADMIN_REQUIRED",
        "MAIN_ADMIN_PASSWORD_INCORRECT",
        "DELETE_CONFIRMATION_INCORRECT",
      ].includes(
        cleanText(
          (error as ApiErrorLike)?.code,
        ),
      )
    ) {
      await writeAuditLog({
        admin,
        action: permanent
          ? "stock_supplier_delete_failed"
          : "stock_supplier_archive_failed",
        actionLabel: permanent
          ? "Stock supplier deletion failed"
          : "Stock supplier archive failed",
        summary: permanent
          ? "A permanent Stock Management supplier deletion failed."
          : "A Stock Management supplier archive failed.",
        supplierId,
        beforeData,
        afterData: null,
        reason,
        httpMethod: "DELETE",
        riskLevel: permanent
          ? "critical"
          : "high",
        status: "failed",
        error,
      });
    }

    return apiError(
      error,
      endpoint,
      "The Stock Management supplier could not be archived or deleted.",
    );
  }
}

