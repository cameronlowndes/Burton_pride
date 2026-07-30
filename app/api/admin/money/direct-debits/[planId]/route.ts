import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PLANS_TABLE = "money_direct_debit_plans";
const OCCURRENCES_TABLE = "money_direct_debit_occurrences";

type RouteContext = {
  params: Promise<{ planId: string }>;
};

type JsonRecord = Record<string, unknown>;

function json(body: JsonRecord, status = 200, headers?: HeadersInit) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      ...headers,
    },
  });
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function asBoolean(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}

async function readBody(request: NextRequest): Promise<JsonRecord> {
  try {
    const body = await request.json();

    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as JsonRecord)
      : {};
  } catch {
    return {};
  }
}

function dbError(
  error: {
    message?: string | null;
    code?: string | null;
    details?: string | null;
    hint?: string | null;
  },
  fallback: string,
  status = 400,
) {
  const code = cleanText(error.code);
  let resolvedStatus = status;

  if (code === "23505") resolvedStatus = 409;
  if (code === "23503" || code === "23514" || code === "22P02") {
    resolvedStatus = 400;
  }
  if (code === "PGRST204" || code === "PGRST205") {
    resolvedStatus = 500;
  }

  return json(
    {
      success: false,
      error: cleanText(error.message) || fallback,
      message: fallback,
      code: code || "DIRECT_DEBIT_DATABASE_ERROR",
      details: cleanText(error.details) || null,
      hint:
        cleanText(error.hint) ||
        (code === "PGRST204"
          ? "Check that all required Direct Debit columns exist, then reload the Supabase schema cache."
          : code === "PGRST205"
            ? `Check that ${PLANS_TABLE} and ${OCCURRENCES_TABLE} exist, then reload the Supabase schema cache.`
            : null),
      endpoint: "/api/admin/money/direct-debits/[planId]",
    },
    resolvedStatus,
  );
}

async function loadPlan(planId: string) {
  return supabaseAdmin
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
          reimbursement_status,
          reimbursement_transaction_id,
          invoice_url,
          invoice_file_name,
          invoice_uploaded_at,
          created_at,
          updated_at
        )
      `,
    )
    .eq("id", planId)
    .order("due_date", {
      ascending: true,
      referencedTable: OCCURRENCES_TABLE,
    })
    .maybeSingle();
}

export async function GET(
  _request: NextRequest,
  { params }: RouteContext,
) {
  const { planId } = await params;

  if (!isUuid(planId)) {
    return json(
      {
        success: false,
        error: "The Direct Debit plan ID is invalid.",
        code: "INVALID_PLAN_ID",
      },
      400,
    );
  }

  const { data, error } = await loadPlan(planId);

  if (error) {
    return dbError(error, "The Direct Debit could not be loaded.");
  }

  if (!data) {
    return json(
      {
        success: false,
        error: "The Direct Debit plan could not be found.",
        code: "DIRECT_DEBIT_NOT_FOUND",
      },
      404,
    );
  }

  return json({
    success: true,
    plan: data,
    endpoint: "/api/admin/money/direct-debits/[planId]",
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
) {
  const { planId } = await params;

  if (!isUuid(planId)) {
    return json(
      {
        success: false,
        error: "The Direct Debit plan ID is invalid.",
        code: "INVALID_PLAN_ID",
      },
      400,
    );
  }

  const body = await readBody(request);
  const action = cleanText(body.action);

  const { data: existing, error: existingError } = await supabaseAdmin
    .from(PLANS_TABLE)
    .select("*")
    .eq("id", planId)
    .maybeSingle();

  if (existingError) {
    return dbError(existingError, "The Direct Debit could not be checked.");
  }

  if (!existing) {
    return json(
      {
        success: false,
        error: "The Direct Debit plan could not be found.",
        code: "DIRECT_DEBIT_NOT_FOUND",
      },
      404,
    );
  }

  if (existing.status === "cancelled" || existing.status === "completed") {
    return json(
      {
        success: false,
        error: "Cancelled or completed Direct Debits cannot be edited.",
        code: "DIRECT_DEBIT_READ_ONLY",
      },
      409,
    );
  }

  const now = new Date().toISOString();

  if (action === "edit_plan") {
    const title = cleanText(body.title);
    const amountPence = Number(body.amount_pence);
    const accountSource = cleanText(body.account_source);
    const accountHolder = cleanText(body.account_holder);

    if (!title) {
      return json(
        {
          success: false,
          error: "Enter a Direct Debit title.",
          code: "TITLE_REQUIRED",
        },
        400,
      );
    }

    if (!Number.isInteger(amountPence) || amountPence <= 0) {
      return json(
        {
          success: false,
          error: "The monthly amount must be greater than zero.",
          code: "INVALID_AMOUNT",
        },
        400,
      );
    }

    if (!["organisation", "personal"].includes(accountSource)) {
      return json(
        {
          success: false,
          error: "Choose a valid paying account.",
          code: "INVALID_ACCOUNT_SOURCE",
        },
        400,
      );
    }

    if (accountSource === "personal" && !accountHolder) {
      return json(
        {
          success: false,
          error: "Enter the person whose account pays this Direct Debit.",
          code: "ACCOUNT_HOLDER_REQUIRED",
        },
        400,
      );
    }

    const autoReimbursePerson =
      accountSource === "personal" &&
      asBoolean(body.auto_reimburse_person);

    const reimbursementPaymentMethod = autoReimbursePerson
      ? cleanText(body.reimbursement_payment_method) || "Bank Transfer"
      : null;

    const planUpdate = {
      title,
      description: cleanText(body.description) || null,
      amount_pence: amountPence,
      account_source: accountSource,
      account_holder: accountSource === "personal" ? accountHolder : null,
      supplier_name: cleanText(body.supplier_name) || null,
      budget_category_key: cleanText(body.budget_category_key) || null,
      budget_category_label: cleanText(body.budget_category_label) || null,
      mandate_reference: cleanText(body.mandate_reference) || null,
      notes: cleanText(body.notes) || null,

      // Automatic personal-account repayment settings.
      auto_reimburse_person: autoReimbursePerson,
      reimbursement_payment_method: reimbursementPaymentMethod,

      updated_at: now,
    };

    const { data: updatedPlan, error: updateError } = await supabaseAdmin
      .from(PLANS_TABLE)
      .update(planUpdate)
      .eq("id", planId)
      .select("*")
      .single();

    if (updateError) {
      return dbError(updateError, "The Direct Debit could not be updated.");
    }

    if (body.update_future_scheduled_occurrences !== false) {
      const reimbursementStatus =
        accountSource === "personal"
          ? "awaiting_reimbursement"
          : "not_required";

      const { error: occurrenceError } = await supabaseAdmin
        .from(OCCURRENCES_TABLE)
        .update({
          amount_pence: amountPence,
          reimbursement_status: reimbursementStatus,
          updated_at: now,
        })
        .eq("plan_id", planId)
        .eq("status", "scheduled");

      if (occurrenceError) {
        return dbError(
          occurrenceError,
          "The plan was updated, but future scheduled payments could not be updated.",
          500,
        );
      }
    }

    const { data: reloadedPlan, error: reloadError } = await loadPlan(planId);

    if (reloadError) {
      return dbError(
        reloadError,
        "The Direct Debit was updated, but the saved plan could not be reloaded.",
        500,
      );
    }

    return json({
      success: true,
      message: autoReimbursePerson
        ? "The Direct Debit and future scheduled payments were updated. Automatic repayment is enabled."
        : "The Direct Debit and future scheduled payments were updated.",
      plan: reloadedPlan || updatedPlan,
      saved_settings: {
        auto_reimburse_person: autoReimbursePerson,
        reimbursement_payment_method: reimbursementPaymentMethod,
      },
      endpoint: "/api/admin/money/direct-debits/[planId]",
    });
  }

  const requestedStatus = cleanText(body.status);

  if (requestedStatus && ["active", "paused"].includes(requestedStatus)) {
    const { data, error } = await supabaseAdmin
      .from(PLANS_TABLE)
      .update({
        status: requestedStatus,
        updated_at: now,
      })
      .eq("id", planId)
      .select("*")
      .single();

    if (error) {
      return dbError(
        error,
        "The Direct Debit status could not be updated.",
      );
    }

    return json({
      success: true,
      message:
        requestedStatus === "active"
          ? "The Direct Debit was resumed."
          : "The Direct Debit was paused.",
      plan: data,
      endpoint: "/api/admin/money/direct-debits/[planId]",
    });
  }

  return json(
    {
      success: false,
      error: "No supported Direct Debit update was supplied.",
      code: "NO_SUPPORTED_UPDATE",
      endpoint: "/api/admin/money/direct-debits/[planId]",
    },
    400,
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext,
) {
  const { planId } = await params;

  if (!isUuid(planId)) {
    return json(
      {
        success: false,
        error: "The Direct Debit plan ID is invalid.",
        code: "INVALID_PLAN_ID",
      },
      400,
    );
  }

  const body = await readBody(request);
  const reason = cleanText(body.reason);

  if (!reason) {
    return json(
      {
        success: false,
        error: "Enter a cancellation reason.",
        code: "CANCELLATION_REASON_REQUIRED",
      },
      400,
    );
  }

  const now = new Date().toISOString();

  const { data: existing, error: existingError } = await supabaseAdmin
    .from(PLANS_TABLE)
    .select("id,status")
    .eq("id", planId)
    .maybeSingle();

  if (existingError) {
    return dbError(existingError, "The Direct Debit could not be checked.");
  }

  if (!existing) {
    return json(
      {
        success: false,
        error: "The Direct Debit plan could not be found.",
        code: "DIRECT_DEBIT_NOT_FOUND",
      },
      404,
    );
  }

  if (existing.status === "cancelled") {
    return json({
      success: true,
      message: "The Direct Debit was already cancelled.",
      already_cancelled: true,
      endpoint: "/api/admin/money/direct-debits/[planId]",
    });
  }

  const { error: occurrenceError } = await supabaseAdmin
    .from(OCCURRENCES_TABLE)
    .update({
      status: "cancelled",
      updated_at: now,
    })
    .eq("plan_id", planId)
    .eq("status", "scheduled");

  if (occurrenceError) {
    return dbError(
      occurrenceError,
      "Future Direct Debit payments could not be cancelled.",
    );
  }

  const { data, error } = await supabaseAdmin
    .from(PLANS_TABLE)
    .update({
      status: "cancelled",
      cancelled_at: now,
      cancellation_reason: reason,
      next_collection_date: null,
      auto_reimburse_person: false,
      updated_at: now,
    })
    .eq("id", planId)
    .select("*")
    .single();

  if (error) {
    return dbError(error, "The Direct Debit could not be cancelled.");
  }

  return json({
    success: true,
    message:
      "Future payments were cancelled. Posted and paid history was retained.",
    plan: data,
    endpoint: "/api/admin/money/direct-debits/[planId]",
  });
}

export async function POST() {
  return json(
    {
      success: false,
      error: "Method not allowed.",
      message: "Use GET, PATCH or DELETE for this Direct Debit plan.",
      code: "METHOD_NOT_ALLOWED",
      endpoint: "/api/admin/money/direct-debits/[planId]",
    },
    405,
    {
      Allow: "GET, PATCH, DELETE",
    },
  );
}

export async function PUT() {
  return POST();
}
