import { NextRequest, NextResponse } from "next/server";

import {
  DirectDebitValidationError,
  validateDirectDebitInput,
  type DirectDebitCreateInput,
} from "@/lib/money/directDebit";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PLANS_TABLE = "money_direct_debit_plans";
const OCCURRENCES_TABLE = "money_direct_debit_occurrences";
const CREATE_PLAN_FUNCTION = "create_money_direct_debit_plan";

type JsonRecord = Record<string, unknown>;

type AuthenticatedAdmin = {
  id: string;
  email: string;
  name: string;
  role: string | null;
};

type DirectDebitRequestBody = DirectDebitCreateInput & {
  auto_reimburse_person?: boolean | null;
  reimbursement_payment_method?: string | null;
  admin_id?: string | null;
  admin_name?: string | null;
  admin_email?: string | null;
};

function json(
  body: JsonRecord,
  status = 200,
  headers?: HeadersInit,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      ...headers,
    },
  });
}

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function nameFromEmail(email: string): string {
  if (!email.includes("@")) return "";

  return email
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function errorStatus(error: unknown, fallback = 500): number {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : cleanText(error).toLowerCase();

  if (
    message.includes("not signed in") ||
    message.includes("unauthorised") ||
    message.includes("unauthorized") ||
    message.includes("session")
  ) {
    return 401;
  }

  if (
    message.includes("permission") ||
    message.includes("forbidden") ||
    message.includes("inactive")
  ) {
    return 403;
  }

  if (
    message.includes("invalid") ||
    message.includes("required") ||
    message.includes("must be") ||
    message.includes("between")
  ) {
    return 400;
  }

  return fallback;
}

function databaseErrorResponse(
  error: {
    message?: string | null;
    code?: string | null;
    details?: string | null;
    hint?: string | null;
  },
  fallbackMessage: string,
  status = 500,
) {
  const code = cleanText(error.code);

  let resolvedStatus = status;

  if (code === "23505") resolvedStatus = 409;
  if (code === "23503" || code === "23514" || code === "22P02") {
    resolvedStatus = 400;
  }

  if (code === "PGRST202" || code === "PGRST205") {
    resolvedStatus = 500;
  }

  return json(
    {
      success: false,
      error: cleanText(error.message) || fallbackMessage,
      message: fallbackMessage,
      code: code || "DIRECT_DEBIT_DATABASE_ERROR",
      details: cleanText(error.details) || null,
      hint:
        cleanText(error.hint) ||
        (code === "PGRST202"
          ? `Check that the Supabase function public.${CREATE_PLAN_FUNCTION} exists, then reload the Supabase schema cache.`
          : code === "PGRST205"
            ? `Check that ${PLANS_TABLE} and ${OCCURRENCES_TABLE} exist in the public schema, then reload the Supabase schema cache.`
            : null),
      endpoint: "/api/admin/money/direct-debits",
    },
    resolvedStatus,
  );
}

async function readJsonBody(request: NextRequest): Promise<DirectDebitRequestBody> {
  const contentType = request.headers.get("content-type") || "";

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error("The request must use application/json.");
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new Error("The request body is not valid JSON.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("The Direct Debit request body must be a JSON object.");
  }

  return body as DirectDebitRequestBody;
}

function adminFromRow(row: JsonRecord): AuthenticatedAdmin {
  const email = cleanText(row.email || row.admin_email);
  const name =
    cleanText(
      row.full_name ||
        row.name ||
        row.display_name ||
        row.admin_name,
    ) || nameFromEmail(email) || "Admin";

  return {
    id: cleanText(row.id || row.admin_id),
    email,
    name,
    role: cleanText(row.role || row.admin_role) || null,
  };
}

/**
 * Uses the same Burton Pride admin cookies already used across the portal.
 *
 * We deliberately do not trust admin_id/admin_name/admin_email sent by the
 * client. Those values are display data only. The authenticated admin identity
 * is resolved from the server-side cookie and admin_users table.
 */
async function requireAuthenticatedAdmin(
  request: NextRequest,
): Promise<AuthenticatedAdmin> {
  const cookieAdminId = cleanText(
    request.cookies.get("burton_admin_id")?.value,
  );
  const cookieAdminEmail = cleanText(
    request.cookies.get("burton_admin_email")?.value,
  ).toLowerCase();

  if (!cookieAdminId && !cookieAdminEmail) {
    throw new Error("Not signed in. Please sign in to the Admin Portal again.");
  }

  let query = supabaseAdmin.from("admin_users").select("*").limit(1);

  if (cookieAdminId && isUuid(cookieAdminId)) {
    query = query.eq("id", cookieAdminId);
  } else if (cookieAdminEmail) {
    query = query.ilike("email", cookieAdminEmail);
  } else {
    throw new Error("The admin session is invalid. Please sign in again.");
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(
      [
        "The signed-in admin could not be checked.",
        error.message,
        error.code ? `Code: ${error.code}` : "",
        error.details ? `Details: ${error.details}` : "",
        error.hint ? `Hint: ${error.hint}` : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  if (!data) {
    throw new Error("The signed-in admin account could not be found.");
  }

  const row = data as JsonRecord;

  if (
    row.is_active === false ||
    cleanText(row.status).toLowerCase() === "inactive" ||
    cleanText(row.status).toLowerCase() === "disabled"
  ) {
    throw new Error("This admin account is inactive.");
  }

  const admin = adminFromRow(row);

  if (!admin.id || !admin.email) {
    throw new Error("The admin account is missing its ID or email address.");
  }

  return admin;
}

async function loadPlanById(planId: string) {
  const { data, error } = await supabaseAdmin
    .from(PLANS_TABLE)
    .select(
      `
        *,
        money_direct_debit_occurrences (
          id,
          plan_id,
          due_date,
          period_month,
          payment_number,
          amount_pence,
          status,
          transaction_id,
          failure_reason,
          reimbursement_status,
          reimbursement_transaction_id,
          invoice_url,
          invoice_file_name,
          invoice_uploaded_at,
          posted_at,
          paid_at,
          created_at,
          updated_at
        )
      `,
    )
    .eq("id", planId)
    .order("due_date", {
      ascending: true,
      referencedTable: "money_direct_debit_occurrences",
    })
    .maybeSingle();

  return { data, error };
}

export async function GET(request: NextRequest) {
  try {
    await requireAuthenticatedAdmin(request);

    const url = new URL(request.url);
    const status = cleanText(url.searchParams.get("status"));
    const accountSource = cleanText(url.searchParams.get("account_source"));
    const search = cleanText(url.searchParams.get("search"));
    const limitValue = Number(url.searchParams.get("limit") || 250);
    const limit = Number.isFinite(limitValue)
      ? Math.min(500, Math.max(1, Math.trunc(limitValue)))
      : 250;

    let query = supabaseAdmin
      .from(PLANS_TABLE)
      .select(
        `
          *,
          money_direct_debit_occurrences (
            id,
            plan_id,
            due_date,
            period_month,
            payment_number,
            amount_pence,
            status,
            transaction_id,
            failure_reason,
            posted_at,
            paid_at,
            created_at,
            updated_at
          )
        `,
      )
      .order("next_collection_date", {
        ascending: true,
        nullsFirst: false,
      })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (
      status &&
      ["draft", "active", "paused", "cancelled", "completed"].includes(status)
    ) {
      query = query.eq("status", status);
    }

    if (
      accountSource &&
      ["organisation", "personal"].includes(accountSource)
    ) {
      query = query.eq("account_source", accountSource);
    }

    if (search) {
      const escaped = search.replace(/[%_,()]/g, " ");
      query = query.or(
        [
          `title.ilike.%${escaped}%`,
          `description.ilike.%${escaped}%`,
          `supplier_name.ilike.%${escaped}%`,
          `account_holder.ilike.%${escaped}%`,
          `mandate_reference.ilike.%${escaped}%`,
        ].join(","),
      );
    }

    const { data, error } = await query;

    if (error) {
      return databaseErrorResponse(
        error,
        "Direct Debit plans could not be loaded.",
      );
    }

    const plans = Array.isArray(data) ? data : [];

    return json({
      success: true,
      plans,
      count: plans.length,
      endpoint: "/api/admin/money/direct-debits",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Direct Debit plans could not be loaded.";

    return json(
      {
        success: false,
        error: message,
        message,
        code:
          errorStatus(error) === 401
            ? "DIRECT_DEBIT_UNAUTHORISED"
            : errorStatus(error) === 403
              ? "DIRECT_DEBIT_FORBIDDEN"
              : "DIRECT_DEBIT_GET_FAILED",
        details: null,
        hint:
          errorStatus(error) === 401
            ? "Sign in to the Admin Portal again, then refresh this page."
            : null,
        endpoint: "/api/admin/money/direct-debits",
      },
      errorStatus(error),
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAuthenticatedAdmin(request);
    const body = await readJsonBody(request);

    const input = validateDirectDebitInput({
      ...body,

      // Never trust the browser for the audit identity.
      created_by: admin.id,
      created_by_name: admin.name,
      created_by_email: admin.email,
    });

    const isPersonalAccount = input.account_source === "personal";
    const autoReimbursePerson =
      isPersonalAccount && body.auto_reimburse_person === true;
    const reimbursementPaymentMethod = autoReimbursePerson
      ? cleanText(body.reimbursement_payment_method) || "Bank Transfer"
      : null;

    const { data: planId, error: createError } = await supabaseAdmin.rpc(
      CREATE_PLAN_FUNCTION,
      {
        p_title: input.title,
        p_description: input.description,
        p_amount_pence: input.amount_pence,
        p_first_collection_date: input.first_collection_date,
        p_total_payments: input.total_payments,
        p_is_open_ended: input.is_open_ended,
        p_account_source: input.account_source,
        p_account_holder: input.account_holder,
        p_supplier_id: input.supplier_id,
        p_supplier_name: input.supplier_name,
        p_budget_category_key: input.budget_category_key,
        p_budget_category_label: input.budget_category_label,
        p_mandate_reference: input.mandate_reference,
        p_notes: input.notes,
        p_created_by: admin.id,
        p_created_by_name: admin.name,
        p_created_by_email: admin.email,
      },
    );

    if (createError) {
      return databaseErrorResponse(
        createError,
        "The Direct Debit plan could not be created.",
        400,
      );
    }

    const createdPlanId = cleanText(planId);

    if (!createdPlanId || !isUuid(createdPlanId)) {
      return json(
        {
          success: false,
          error:
            "The database created the Direct Debit but did not return a valid plan ID.",
          message:
            "The Direct Debit plan response was incomplete. Check the Supabase function return type.",
          code: "DIRECT_DEBIT_INVALID_PLAN_ID",
          details: planId ?? null,
          hint: `The function public.${CREATE_PLAN_FUNCTION} must return the new plan UUID.`,
          endpoint: "/api/admin/money/direct-debits",
        },
        500,
      );
    }

    /*
     * The existing create_money_direct_debit_plan function creates the plan
     * and occurrence schedule. Save the newer automatic-repayment fields
     * immediately afterwards so this route remains compatible with the
     * existing function signature.
     */
    const { error: repaymentSettingsError } = await supabaseAdmin
      .from(PLANS_TABLE)
      .update({
        auto_reimburse_person: autoReimbursePerson,
        reimbursement_payment_method: reimbursementPaymentMethod,
        updated_at: new Date().toISOString(),
      })
      .eq("id", createdPlanId);

    if (repaymentSettingsError) {
      return databaseErrorResponse(
        repaymentSettingsError,
        "The Direct Debit was created, but its automatic repayment setting could not be saved.",
      );
    }

    const { data: plan, error: loadError } =
      await loadPlanById(createdPlanId);

    if (loadError) {
      return databaseErrorResponse(
        loadError,
        "The Direct Debit was created, but its completed record could not be reloaded.",
      );
    }

    return json(
      {
        success: true,
        message: autoReimbursePerson
          ? "The monthly Direct Debit plan was created with automatic repayment enabled."
          : "The monthly Direct Debit plan was created successfully.",
        plan_id: createdPlanId,
        plan,
        endpoint: "/api/admin/money/direct-debits",
      },
      201,
    );
  } catch (error) {
    if (error instanceof DirectDebitValidationError) {
      return json(
        {
          success: false,
          error: error.message,
          message: "Check the Direct Debit details and try again.",
          code: error.code,
          details: error.issues,
          issues: error.issues,
          hint: null,
          endpoint: "/api/admin/money/direct-debits",
        },
        400,
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : "The Direct Debit request could not be processed.";

    return json(
      {
        success: false,
        error: message,
        message,
        code:
          errorStatus(error) === 401
            ? "DIRECT_DEBIT_UNAUTHORISED"
            : errorStatus(error) === 403
              ? "DIRECT_DEBIT_FORBIDDEN"
              : "DIRECT_DEBIT_CREATE_FAILED",
        details: null,
        hint:
          errorStatus(error) === 401
            ? "Sign in to the Admin Portal again, then try creating the plan."
            : null,
        endpoint: "/api/admin/money/direct-debits",
      },
      errorStatus(error, 400),
    );
  }
}

/**
 * Return JSON for unsupported methods as well, rather than allowing an HTML
 * error page to reach the Direct Debits dashboard.
 */
export async function PUT() {
  return json(
    {
      success: false,
      error: "Method not allowed.",
      message: "Use GET to list Direct Debits or POST to create one.",
      code: "METHOD_NOT_ALLOWED",
      endpoint: "/api/admin/money/direct-debits",
    },
    405,
    { Allow: "GET, POST" },
  );
}

export async function PATCH() {
  return PUT();
}

export async function DELETE() {
  return PUT();
}
