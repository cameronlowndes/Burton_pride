import { NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const TABLES = {
  suppliers: "stock_supplier_profiles",
  itemLinks: "stock_item_suppliers",
  orders: "stock_supplier_orders",
  reviews: "stock_supplier_reviews",
  compliance: "stock_supplier_compliance",
  overrides: "stock_supplier_overrides",
  organisationLinks: "stock_supplier_organisation_links",
  audit: "admin_audit_logs",
  stockItems: "stock_items",
  eventContacts: "event_business_contacts",
  eventChecklistContacts: "event_stallholder_checklist_contacts",
  moneySuppliers: "money_suppliers",
  moneyTransactions: "money_transactions",
  events: "burton_pride_events",
} as const;

export type UnknownRow = Record<string, unknown>;

export type AdminIdentity = {
  id?: string | null;
  email?: string | null;
  name?: string | null;
  full_name?: string | null;
  role?: string | null;
  is_main_admin?: boolean | null;
  permissions?: unknown;
};

type ApiErrorLike = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

export function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

export function nullableText(value: unknown) {
  const cleaned = cleanText(value);
  return cleaned || null;
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function parseBoolean(value: unknown, fieldName: string) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${fieldName} must be true or false.`);
}

export function parseNullableInteger(
  value: unknown,
  fieldName: string,
  maximum?: number,
) {
  if (value === undefined || value === null || value === "") return null;

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a whole number of zero or more.`);
  }

  if (maximum !== undefined && parsed > maximum) {
    throw new Error(`${fieldName} must not be greater than ${maximum}.`);
  }

  return parsed;
}

export function parseNullablePence(value: unknown, fieldName: string) {
  if (value === undefined || value === null || value === "") return null;

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(
      `${fieldName} must be a non-negative whole amount in pence.`,
    );
  }

  return parsed;
}

export function parseNullableDate(value: unknown, fieldName: string) {
  const text = nullableText(value);
  if (!text) return null;

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} must be a valid date.`);
  }

  return text;
}

export function parseRating(
  value: unknown,
  fieldName: string,
  minimum = 1,
  maximum = 5,
) {
  if (value === undefined || value === null || value === "") return null;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(
      `${fieldName} must be a whole number between ${minimum} and ${maximum}.`,
    );
  }

  return parsed;
}

export async function readJsonBody<T extends Record<string, unknown>>(
  request: NextRequest,
  options: { allowEmpty?: boolean } = {},
): Promise<T> {
  const raw = await request.text();

  if (!raw.trim()) {
    if (options.allowEmpty) return {} as T;
    throw new Error("A JSON request body is required.");
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
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

export async function requireAdmin() {
  const admin = (await getCurrentAdmin()) as AdminIdentity | null;

  if (!admin) {
    throw new Error(
      "Unauthorised. Sign in to the Burton Pride Admin Portal.",
    );
  }

  return admin;
}

export function adminDisplayName(admin: AdminIdentity) {
  return (
    cleanText(admin.name) ||
    cleanText(admin.full_name) ||
    cleanText(admin.email) ||
    "Admin"
  );
}

export function isMainAdmin(admin: AdminIdentity) {
  return (
    admin.is_main_admin === true ||
    cleanText(admin.role).toLowerCase() === "main_admin"
  );
}

export function errorStatus(error: unknown) {
  const source = error as ApiErrorLike;
  const code = cleanText(source?.code).toUpperCase();
  const message =
    error instanceof Error ? error.message.toLowerCase() : "";

  if (
    message.includes("unauthorised") ||
    message.includes("unauthorized") ||
    message.includes("sign in") ||
    message.includes("session")
  ) return 401;

  if (
    message.includes("permission") ||
    message.includes("access denied") ||
    message.includes("main admin")
  ) return 403;

  if (
    code === "PGRST116" ||
    message.includes("not found") ||
    message.includes("does not exist")
  ) return 404;

  if (
    code === "23503" ||
    code === "23505" ||
    message.includes("foreign key") ||
    message.includes("already exists") ||
    message.includes("duplicate") ||
    message.includes("linked records")
  ) return 409;

  if (
    message.includes("required") ||
    message.includes("must be") ||
    message.includes("invalid") ||
    message.includes("unsupported") ||
    message.includes("not allowed")
  ) return 400;

  return 500;
}

export function apiError(
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
        error instanceof Error && error.message ? error.message : fallback,
      code: source?.code || `STOCK_SUPPLIER_${status}`,
      details:
        source?.details ||
        "The Stock Management supplier API could not complete the request.",
      hint:
        source?.hint ||
        "Check request fields, supplier IDs, administrator permissions, Supabase tables and server logs.",
      endpoint,
      status,
    },
    { status },
  );
}

export async function getSupplierOrThrow(supplierId: string) {
  if (!isUuid(supplierId)) {
    throw new Error("supplierId must be a valid UUID.");
  }

  const { data, error } = await supabaseAdmin
    .from(TABLES.suppliers)
    .select("*")
    .eq("id", supplierId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Stock Management supplier was not found.");

  return data as UnknownRow;
}

export async function writeAuditLog(input: {
  admin: AdminIdentity;
  action: string;
  actionLabel: string;
  summary: string;
  supplierId?: string | null;
  recordType?: string;
  recordId?: string | null;
  beforeData?: UnknownRow | null;
  afterData?: UnknownRow | null;
  reason?: string | null;
  route: string;
  httpMethod: string;
  riskLevel?: "low" | "medium" | "high" | "critical";
  relatedOrderId?: string | null;
  relatedItemId?: string | null;
}) {
  const { error } = await supabaseAdmin.from(TABLES.audit).insert({
    admin_id: input.admin.id || null,
    admin_name: adminDisplayName(input.admin),
    admin_email: input.admin.email || null,
    admin_role: input.admin.role || null,
    area: "stock_management",
    action: input.action,
    action_label: input.actionLabel,
    status: "success",
    risk_level: input.riskLevel || "low",
    summary: input.summary,
    reason: input.reason || null,
    record_type: input.recordType || "stock_supplier",
    record_id: input.recordId || input.supplierId || null,
    supplier_id: input.supplierId || null,
    related_order_id: input.relatedOrderId || null,
    related_item_id: input.relatedItemId || null,
    before_data: input.beforeData || null,
    after_data: input.afterData || null,
    route: input.route,
    http_method: input.httpMethod,
  } as never);

  if (error) {
    console.error("Stock supplier audit log failed", {
      action: input.action,
      supplierId: input.supplierId,
      error,
    });
  }
}

export function jsonOk(payload: UnknownRow, status = 200) {
  return NextResponse.json(
    { ok: true, ...payload },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function deleteByIdOrThrow(
  table: string,
  id: string,
  label: string,
) {
  const { data, error } = await supabaseAdmin
    .from(table)
    .delete()
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error(`${label} was not found.`);

  return data as UnknownRow;
}
