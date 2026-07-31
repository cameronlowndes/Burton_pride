import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PLANS_TABLE = "money_direct_debit_plans";
const OCCURRENCES_TABLE = "money_direct_debit_occurrences";
const TRANSACTIONS_TABLE = "money_transactions";
const AUDIT_LOGS_TABLE = "admin_audit_logs";

type RouteContext = {
  params: Promise<{
    planId: string;
    occurrenceId: string;
  }>;
};

type JsonRecord = Record<string, unknown>;

type AdminIdentity = {
  id: string | null;
  name: string | null;
  email: string | null;
  role: string | null;
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

function isRecord(value: unknown): value is JsonRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function asPositiveInteger(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    typeof value === "number"
      ? value
      : Number(String(value).replace(/[^0-9-]/g, ""));

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

async function readBody(
  request: NextRequest,
): Promise<JsonRecord> {
  try {
    const body = await request.json();
    return isRecord(body) ? body : {};
  } catch {
    return {};
  }
}

function getAdminIdentity(
  request: NextRequest,
): AdminIdentity {
  return {
    id:
      request.cookies.get("burton_admin_id")?.value?.trim() ||
      request.headers.get("x-admin-id")?.trim() ||
      null,

    name:
      request.cookies.get("burton_admin_name")?.value?.trim() ||
      request.headers.get("x-admin-name")?.trim() ||
      null,

    email:
      request.cookies.get("burton_admin_email")?.value?.trim() ||
      request.headers.get("x-admin-email")?.trim() ||
      null,

    role:
      request.cookies.get("burton_admin_role")?.value?.trim() ||
      request.headers.get("x-admin-role")?.trim() ||
      null,
  };
}

function getRequestIp(
  request: NextRequest,
): string | null {
  const forwardedFor =
    request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    null
  );
}

function dbError(
  error: {
    message?: string | null;
    code?: string | null;
    details?: string | null;
    hint?: string | null;
  },
  fallback: string,
  status = 500,
) {
  const code = cleanText(error.code);
  let resolvedStatus = status;

  if (code === "23505") {
    resolvedStatus = 409;
  }

  if (
    code === "23503" ||
    code === "23514" ||
    code === "22P02"
  ) {
    resolvedStatus = 400;
  }

  return json(
    {
      success: false,
      error: fallback,
      message: cleanText(error.message) || fallback,
      code: code || "DIRECT_DEBIT_DATABASE_ERROR",
      details: cleanText(error.details) || null,
      hint:
        cleanText(error.hint) ||
        (code === "PGRST204" || code === "42703"
          ? "Check that all Direct Debit reimbursement and Money Transaction columns exist, then reload the Supabase schema cache."
          : null),
      endpoint:
        "/api/admin/money/direct-debits/[planId]/occurrences/[occurrenceId]/reimburse",
    },
    resolvedStatus,
  );
}

async function writeAuditLog(args: {
  request: NextRequest;
  admin: AdminIdentity;
  planId: string;
  occurrenceId: string;
  originalTransactionId: string | null;
  repaymentTransactionId: string | null;
  amountPence: number;
  paymentMethod: string;
  reference: string | null;
  status: "success" | "failed";
  errorMessage?: string;
}): Promise<void> {
  const payload = {
    action:
      args.status === "success"
        ? "money.direct_debit.person_reimbursed"
        : "money.direct_debit.person_reimbursement_failed",

    action_label:
      args.status === "success"
        ? "Personal Direct Debit reimbursed"
        : "Personal Direct Debit reimbursement failed",

    module: "money_management",
    area: "direct_debits",
    status: args.status,
    risk_level:
      args.status === "success" ? "high" : "critical",

    admin_id: args.admin.id,
    admin_name:
      args.admin.name ||
      args.admin.email ||
      "Unknown admin",
    admin_email: args.admin.email,
    admin_role: args.admin.role,

    record_type:
      "money_direct_debit_occurrence",
    record_id: args.occurrenceId,

    description:
      args.status === "success"
        ? `Recorded a personal Direct Debit reimbursement of £${(
            args.amountPence / 100
          ).toFixed(2)} and created the linked Burton Pride Money Tracker transaction.`
        : "Failed to record the personal Direct Debit reimbursement.",

    metadata: {
      plan_id: args.planId,
      occurrence_id: args.occurrenceId,
      original_transaction_id:
        args.originalTransactionId,
      repayment_transaction_id:
        args.repaymentTransactionId,
      amount_pence: args.amountPence,
      payment_method: args.paymentMethod,
      reference: args.reference,
      error_message: args.errorMessage || null,
      request_method: args.request.method,
      request_path: args.request.nextUrl.pathname,
    },

    ip_address: getRequestIp(args.request),
    user_agent:
      args.request.headers.get("user-agent"),
    created_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from(AUDIT_LOGS_TABLE)
    .insert(payload);

  if (error) {
    console.error(
      "Direct Debit reimbursement audit log failed",
      {
        planId: args.planId,
        occurrenceId: args.occurrenceId,
        auditError: error,
      },
    );
  }
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  const { planId, occurrenceId } =
    await context.params;

  const admin = getAdminIdentity(request);

  if (!isUuid(planId)) {
    return json(
      {
        success: false,
        error: "INVALID_PLAN_ID",
        message:
          "The Direct Debit plan ID is invalid.",
      },
      400,
    );
  }

  if (!isUuid(occurrenceId)) {
    return json(
      {
        success: false,
        error: "INVALID_OCCURRENCE_ID",
        message:
          "The Direct Debit occurrence ID is invalid.",
      },
      400,
    );
  }

  const body = await readBody(request);

  const paymentMethod =
    cleanText(
      body.payment_method ??
        body.reimbursement_payment_method,
    ) || "Bank Transfer";

  const reference =
    cleanText(
      body.reference ??
        body.transaction_reference ??
        body.reimbursement_reference,
    ) || null;

  const notes =
    cleanText(
      body.notes ??
        body.reimbursement_notes,
    ) || null;

  const requestedAmountPence =
    asPositiveInteger(
      body.amount_pence ??
        body.reimbursement_amount_pence,
    );

  const reimbursedAtInput = cleanText(
    body.reimbursed_at ??
      body.reimbursement_paid_at,
  );

  let reimbursedAt = new Date().toISOString();

  if (reimbursedAtInput) {
    const parsed = new Date(reimbursedAtInput);

    if (Number.isNaN(parsed.getTime())) {
      return json(
        {
          success: false,
          error: "INVALID_REIMBURSED_DATE",
          message:
            "The reimbursement date is invalid.",
          field: "reimbursed_at",
        },
        400,
      );
    }

    reimbursedAt = parsed.toISOString();
  }

  const [
    {
      data: plan,
      error: planError,
    },
    {
      data: occurrence,
      error: occurrenceError,
    },
  ] = await Promise.all([
    supabaseAdmin
      .from(PLANS_TABLE)
      .select(
        [
          "id",
          "title",
          "description",
          "amount_pence",
          "account_source",
          "account_holder",
          "supplier_name",
          "budget_category_key",
          "budget_category_label",
          "reimbursement_payment_method",
          "status",
        ].join(","),
      )
      .eq("id", planId)
      .maybeSingle(),

    supabaseAdmin
      .from(OCCURRENCES_TABLE)
      .select("*")
      .eq("id", occurrenceId)
      .eq("plan_id", planId)
      .maybeSingle(),
  ]);

  if (planError) {
    return dbError(
      planError,
      "The Direct Debit plan could not be loaded.",
    );
  }

  if (!plan) {
    return json(
      {
        success: false,
        error: "DIRECT_DEBIT_NOT_FOUND",
        message:
          "The Direct Debit plan could not be found.",
      },
      404,
    );
  }

  // plan may be a GenericStringError type from supabase typings; cast to any for property access
  const planAny = plan as Record<string, any>;

  if (
    cleanText(planAny.account_source).toLowerCase() !==
    "personal"
  ) {
    return json(
      {
        success: false,
        error: "NOT_PERSONAL_DIRECT_DEBIT",
        message:
          "This Direct Debit is not paid from a personal account, so no personal reimbursement is required.",
      },
      409,
    );
  }

  if (occurrenceError) {
    return dbError(
      occurrenceError,
      "The Direct Debit payment occurrence could not be loaded.",
    );
  }

  if (!occurrence) {
    return json(
      {
        success: false,
        error: "OCCURRENCE_NOT_FOUND",
        message:
          "The Direct Debit payment occurrence could not be found.",
      },
      404,
    );
  }

  if (
    !["posted", "paid"].includes(
      cleanText(occurrence.status).toLowerCase(),
    )
  ) {
    return json(
      {
        success: false,
        error: "OCCURRENCE_NOT_REIMBURSABLE",
        message:
          "Only a posted or paid Direct Debit payment can be reimbursed.",
      },
      409,
    );
  }

  if (
    cleanText(
      occurrence.reimbursement_status,
    ).toLowerCase() === "reimbursed"
  ) {
    return json(
      {
        success: true,
        already_reimbursed: true,
        message:
          "This Direct Debit payment has already been reimbursed.",
        occurrence,
      },
      200,
    );
  }

  const amountPence =
    requestedAmountPence ||
    asPositiveInteger(
      occurrence.amount_pence,
    ) ||
    asPositiveInteger(planAny.amount_pence) ||
    0;

  if (amountPence <= 0) {
    return json(
      {
        success: false,
        error: "INVALID_REIMBURSEMENT_AMOUNT",
        message:
          "The reimbursement amount must be greater than zero.",
      },
      400,
    );
  }

  const originalTransactionId =
    cleanText(occurrence.transaction_id) || null;

  const now = new Date().toISOString();

  /*
   * This is the separate Burton Pride Money Out transaction.
   * It records the money leaving Burton Pride to repay the person.
   */
  const repaymentTransactionPayload: JsonRecord = {
    transaction_type: "expense",
    type: "expense",

    title:
      `Repayment to ${
        cleanText(planAny.account_holder) ||
        "personal account holder"
      } - ${cleanText(planAny.title) || "Direct Debit"}`,

    description:
      notes ||
      `Reimbursement for Direct Debit payment ${
        occurrence.payment_number ||
        ""
      } for ${cleanText(planAny.title) || "Direct Debit"}.`,

    amount_pence: amountPence,
    transaction_date:
      reimbursedAt.slice(0, 10),

    payment_method: paymentMethod,
    transaction_reference:
      reference ||
      `DD-REPAY-${occurrenceId
        .slice(0, 8)
        .toUpperCase()}`,

    category: "Personal Funds Repayment",

    supplier_name:
      cleanText(planAny.account_holder) ||
      null,

    budget_category_key:
      cleanText(planAny.budget_category_key) ||
      null,

    budget_category_label:
      cleanText(planAny.budget_category_label) ||
      null,

    personal_funds_name:
      cleanText(planAny.account_holder) ||
      null,

    personal_funds_repaid: true,
    personal_funds_repaid_at: reimbursedAt,

    reimbursement_status: "reimbursed",

    direct_debit_plan_id: planId,
    direct_debit_occurrence_id:
      occurrenceId,

    direct_debit_account_source:
      "personal",

    direct_debit_account_holder:
      cleanText(planAny.account_holder) ||
      null,

    direct_debit_reference:
      reference ||
      cleanText(planAny.title) ||
      null,

    direct_debit_occurrence_status:
      cleanText(occurrence.status) ||
      "posted",

    direct_debit_payment_number:
      occurrence.payment_number || null,

    created_by: admin.id,
    created_at: now,
    updated_at: now,
  };

  let repaymentTransactionId: string | null = null;

  try {
    const {
      data: repaymentTransaction,
      error: repaymentTransactionError,
    } = await supabaseAdmin
      .from(TRANSACTIONS_TABLE)
      .insert(repaymentTransactionPayload)
      .select("*")
      .single();

    if (repaymentTransactionError) {
      return dbError(
        repaymentTransactionError,
        "The Burton Pride repayment transaction could not be created.",
      );
    }

    repaymentTransactionId =
      cleanText(repaymentTransaction.id) ||
      null;

    /*
     * Mark the original personal-funds transaction as repaid.
     */
    if (
      originalTransactionId &&
      isUuid(originalTransactionId)
    ) {
      const {
        error: originalTransactionError,
      } = await supabaseAdmin
        .from(TRANSACTIONS_TABLE)
        .update({
          personal_funds_repaid: true,
          personal_funds_repaid_at:
            reimbursedAt,
          reimbursement_status:
            "reimbursed",
          reimbursement_id:
            repaymentTransactionId,
          updated_at: now,
        })
        .eq("id", originalTransactionId);

      if (originalTransactionError) {
        if (
          repaymentTransactionId &&
          isUuid(repaymentTransactionId)
        ) {
          await supabaseAdmin
            .from(TRANSACTIONS_TABLE)
            .delete()
            .eq("id", repaymentTransactionId);
        }

        return dbError(
          originalTransactionError,
          "The repayment transaction was created, but the original Money Tracker transaction could not be marked as repaid.",
        );
      }
    }

    /*
     * Update the Direct Debit occurrence last so every table agrees.
     */
    const {
      data: updatedOccurrence,
      error: occurrenceUpdateError,
    } = await supabaseAdmin
      .from(OCCURRENCES_TABLE)
      .update({
        reimbursement_status:
          "reimbursed",

        reimbursement_transaction_id:
          repaymentTransactionId,

        reimbursement_payment_method:
          paymentMethod,

        reimbursement_amount_pence:
          amountPence,

        reimbursement_notes: notes,

        reimbursed_at: reimbursedAt,

        reimbursement_recorded_by:
          admin.id,

        updated_at: now,
      })
      .eq("id", occurrenceId)
      .eq("plan_id", planId)
      .select("*")
      .single();

    if (occurrenceUpdateError) {
      if (
        originalTransactionId &&
        isUuid(originalTransactionId)
      ) {
        await supabaseAdmin
          .from(TRANSACTIONS_TABLE)
          .update({
            personal_funds_repaid: false,
            personal_funds_repaid_at: null,
            reimbursement_status:
              "awaiting_reimbursement",
            reimbursement_id: null,
            updated_at: now,
          })
          .eq("id", originalTransactionId);
      }

      if (
        repaymentTransactionId &&
        isUuid(repaymentTransactionId)
      ) {
        await supabaseAdmin
          .from(TRANSACTIONS_TABLE)
          .delete()
          .eq("id", repaymentTransactionId);
      }

      return dbError(
        occurrenceUpdateError,
        "The Money Tracker transaction was created, but the Direct Debit occurrence could not be updated.",
      );
    }

    await writeAuditLog({
      request,
      admin,
      planId,
      occurrenceId,
      originalTransactionId,
      repaymentTransactionId,
      amountPence,
      paymentMethod,
      reference,
      status: "success",
    });

    return json({
      success: true,

      message:
        `The £${(
          amountPence / 100
        ).toFixed(
          2,
        )} repayment was recorded and deducted from Burton Pride money.`,

      plan_id: planId,
      occurrence_id: occurrenceId,

      original_transaction_id:
        originalTransactionId,

      repayment_transaction_id:
        repaymentTransactionId,

      repayment_transaction:
        repaymentTransaction,

      occurrence: updatedOccurrence,

      reimbursement: {
        status: "reimbursed",
        amount_pence: amountPence,
        amount: amountPence / 100,
        payment_method: paymentMethod,
        reference,
        reimbursed_at: reimbursedAt,
        account_holder:
          cleanText(planAny.account_holder) ||
          null,
      },

      connected_tables: {
        direct_debit_plans: PLANS_TABLE,
        direct_debit_occurrences:
          OCCURRENCES_TABLE,
        money_tracker_transactions:
          TRANSACTIONS_TABLE,
      },

      endpoint:
        "/api/admin/money/direct-debits/[planId]/occurrences/[occurrenceId]/reimburse",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "An unknown server error occurred.";

    console.error(
      "Direct Debit reimbursement failed",
      {
        planId,
        occurrenceId,
        error,
      },
    );

    await writeAuditLog({
      request,
      admin,
      planId,
      occurrenceId,
      originalTransactionId,
      repaymentTransactionId,
      amountPence,
      paymentMethod,
      reference,
      status: "failed",
      errorMessage: message,
    });

    return json(
      {
        success: false,
        error: "REIMBURSEMENT_FAILED",
        message:
          "The reimbursement could not be recorded.",
        reason: message,
        planId,
        occurrenceId,
      },
      500,
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: RouteContext,
) {
  return POST(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  return POST(request, context);
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  const { planId, occurrenceId } =
    await context.params;

  if (
    !isUuid(planId) ||
    !isUuid(occurrenceId)
  ) {
    return json(
      {
        success: false,
        error: "INVALID_ID",
        message:
          "The plan ID or occurrence ID is invalid.",
      },
      400,
    );
  }

  const {
    data: occurrence,
    error,
  } = await supabaseAdmin
    .from(OCCURRENCES_TABLE)
    .select("*")
    .eq("id", occurrenceId)
    .eq("plan_id", planId)
    .maybeSingle();

  if (error) {
    return dbError(
      error,
      "The reimbursement details could not be loaded.",
    );
  }

  if (!occurrence) {
    return json(
      {
        success: false,
        error: "OCCURRENCE_NOT_FOUND",
        message:
          "The Direct Debit occurrence could not be found.",
      },
      404,
    );
  }

  let repaymentTransaction: JsonRecord | null = null;

  const repaymentTransactionId =
    cleanText(
      occurrence.reimbursement_transaction_id,
    );

  if (
    repaymentTransactionId &&
    isUuid(repaymentTransactionId)
  ) {
    const {
      data,
      error: transactionError,
    } = await supabaseAdmin
      .from(TRANSACTIONS_TABLE)
      .select("*")
      .eq("id", repaymentTransactionId)
      .maybeSingle();

    if (!transactionError && data) {
      repaymentTransaction = data;
    }
  }

  return json({
    success: true,
    occurrence,
    repayment_transaction:
      repaymentTransaction,
    connected_tables: {
      direct_debit_plans: PLANS_TABLE,
      direct_debit_occurrences:
        OCCURRENCES_TABLE,
      money_tracker_transactions:
        TRANSACTIONS_TABLE,
    },
  });
}
