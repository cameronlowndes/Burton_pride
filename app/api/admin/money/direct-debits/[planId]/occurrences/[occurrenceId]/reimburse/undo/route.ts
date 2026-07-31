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

function asBoolean(value: unknown): boolean {
  return (
    value === true ||
    value === "true" ||
    value === 1 ||
    value === "1" ||
    value === "yes" ||
    value === "on"
  );
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
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    null
  );
}

function databaseError(
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

  if (code === "23505") resolvedStatus = 409;

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
          ? "Check that the reimbursement and Personal Funds columns exist, then reload the Supabase schema cache."
          : null),
      endpoint:
        "/api/admin/money/direct-debits/[planId]/occurrences/[occurrenceId]/reimburse/undo",
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
  reason: string;
  repaymentTransactionDeleted: boolean;
  status: "success" | "failed";
  errorMessage?: string;
}): Promise<void> {
  const payload = {
    action:
      args.status === "success"
        ? "money.direct_debit.person_reimbursement_undone"
        : "money.direct_debit.person_reimbursement_undo_failed",
    action_label:
      args.status === "success"
        ? "Personal Direct Debit repayment undone"
        : "Personal Direct Debit repayment undo failed",
    module: "money_management",
    area: "direct_debits",
    status: args.status,
    risk_level: "high",
    admin_id: args.admin.id,
    admin_name:
      args.admin.name ||
      args.admin.email ||
      "Unknown admin",
    admin_email: args.admin.email,
    admin_role: args.admin.role,
    record_type: "money_direct_debit_occurrence",
    record_id: args.occurrenceId,
    description:
      args.status === "success"
        ? `Undid a Direct Debit personal repayment of £${(
            args.amountPence / 100
          ).toFixed(2)}.`
        : "Failed to undo a Direct Debit personal repayment.",
    metadata: {
      plan_id: args.planId,
      occurrence_id: args.occurrenceId,
      original_transaction_id: args.originalTransactionId,
      repayment_transaction_id: args.repaymentTransactionId,
      amount_pence: args.amountPence,
      reason: args.reason,
      repayment_transaction_deleted:
        args.repaymentTransactionDeleted,
      error_message: args.errorMessage || null,
      request_method: args.request.method,
      request_path: args.request.nextUrl.pathname,
    },
    ip_address: getRequestIp(args.request),
    user_agent: args.request.headers.get("user-agent"),
    created_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from(AUDIT_LOGS_TABLE)
    .insert(payload);

  if (error) {
    console.error(
      "Direct Debit repayment undo audit log failed",
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
  const { planId, occurrenceId } = await context.params;
  const admin = getAdminIdentity(request);

  if (!isUuid(planId)) {
    return json(
      {
        success: false,
        error: "INVALID_PLAN_ID",
        message: "The Direct Debit plan ID is invalid.",
        field: "planId",
      },
      400,
    );
  }

  if (!isUuid(occurrenceId)) {
    return json(
      {
        success: false,
        error: "INVALID_OCCURRENCE_ID",
        message: "The Direct Debit occurrence ID is invalid.",
        field: "occurrenceId",
      },
      400,
    );
  }

  const body = await readBody(request);
  const reason = cleanText(body.reason);
  const deleteRepaymentTransaction =
    body.delete_repayment_transaction === undefined
      ? true
      : asBoolean(body.delete_repayment_transaction);

  if (!reason) {
    return json(
      {
        success: false,
        error: "UNDO_REASON_REQUIRED",
        message:
          "Enter a reason for undoing the repayment.",
        field: "reason",
      },
      400,
    );
  }

  const {
    data: plan,
    error: planError,
  } = await supabaseAdmin
    .from(PLANS_TABLE)
    .select("id,title,account_source,account_holder")
    .eq("id", planId)
    .maybeSingle();

  if (planError) {
    return databaseError(
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

  if (cleanText(plan.account_source) !== "personal") {
    return json(
      {
        success: false,
        error: "NOT_PERSONAL_DIRECT_DEBIT",
        message:
          "Only a Direct Debit paid from a personal account can have its repayment undone.",
      },
      409,
    );
  }

  const {
    data: occurrence,
    error: occurrenceError,
  } = await supabaseAdmin
    .from(OCCURRENCES_TABLE)
    .select("*")
    .eq("id", occurrenceId)
    .eq("plan_id", planId)
    .maybeSingle();

  if (occurrenceError) {
    return databaseError(
      occurrenceError,
      "The Direct Debit payment could not be loaded.",
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

  const reimbursementStatus = cleanText(
    occurrence.reimbursement_status,
  ).toLowerCase();

  if (reimbursementStatus !== "reimbursed") {
    return json(
      {
        success: false,
        error: "REPAYMENT_NOT_RECORDED",
        message:
          "This Direct Debit payment is not currently marked as reimbursed.",
        occurrence,
      },
      409,
    );
  }

  const originalTransactionId = cleanText(
    occurrence.transaction_id,
  ) || null;

  const repaymentTransactionId = cleanText(
    occurrence.reimbursement_transaction_id,
  ) || null;

  const amountPence = Number(
    occurrence.reimbursement_amount_pence ||
      occurrence.amount_pence ||
      0,
  );

  const now = new Date().toISOString();
  let repaymentTransactionDeleted = false;

  try {
    /*
     * First restore the original Personal Funds transaction so the Money
     * Tracker immediately shows repayment due again.
     */
    if (originalTransactionId && isUuid(originalTransactionId)) {
      const {
        error: originalTransactionError,
      } = await supabaseAdmin
        .from(TRANSACTIONS_TABLE)
        .update({
          personal_funds_repaid: false,
          personal_funds_repaid_at: null,
          reimbursement_status: "awaiting_reimbursement",
          reimbursement_id: null,
          updated_at: now,
        })
        .eq("id", originalTransactionId);

      if (originalTransactionError) {
        return databaseError(
          originalTransactionError,
          "The linked Money Tracker transaction could not be returned to awaiting repayment.",
        );
      }
    }

    /*
     * Remove the separate repayment transaction when it is a real linked
     * Money Transaction UUID and the admin selected that option.
     */
    if (
      deleteRepaymentTransaction &&
      repaymentTransactionId &&
      isUuid(repaymentTransactionId)
    ) {
      const {
        error: deleteTransactionError,
      } = await supabaseAdmin
        .from(TRANSACTIONS_TABLE)
        .delete()
        .eq("id", repaymentTransactionId);

      if (deleteTransactionError) {
        /*
         * Restore the original transaction before returning, preventing the
         * Money Tracker and occurrence from disagreeing.
         */
        if (originalTransactionId && isUuid(originalTransactionId)) {
          await supabaseAdmin
            .from(TRANSACTIONS_TABLE)
            .update({
              personal_funds_repaid: true,
              personal_funds_repaid_at:
                occurrence.reimbursed_at || now,
              reimbursement_status: "reimbursed",
              reimbursement_id: repaymentTransactionId,
              updated_at: now,
            })
            .eq("id", originalTransactionId);
        }

        return databaseError(
          deleteTransactionError,
          "The linked repayment transaction could not be removed.",
        );
      }

      repaymentTransactionDeleted = true;
    }

    const {
      data: updatedOccurrence,
      error: updateOccurrenceError,
    } = await supabaseAdmin
      .from(OCCURRENCES_TABLE)
      .update({
        reimbursement_status: "awaiting_reimbursement",
        reimbursement_transaction_id: null,
        reimbursement_payment_method: null,
        reimbursement_amount_pence: null,
        reimbursement_notes: null,
        reimbursed_at: null,
        reimbursement_recorded_by: null,
        updated_at: now,
      })
      .eq("id", occurrenceId)
      .eq("plan_id", planId)
      .select("*")
      .single();

    if (updateOccurrenceError) {
      /*
       * Best-effort restoration if clearing the occurrence fails.
       */
      if (originalTransactionId && isUuid(originalTransactionId)) {
        await supabaseAdmin
          .from(TRANSACTIONS_TABLE)
          .update({
            personal_funds_repaid: true,
            personal_funds_repaid_at:
              occurrence.reimbursed_at || now,
            reimbursement_status: "reimbursed",
            reimbursement_id: repaymentTransactionId,
            updated_at: now,
          })
          .eq("id", originalTransactionId);
      }

      return databaseError(
        updateOccurrenceError,
        "The repayment could not be undone on the Direct Debit payment.",
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
      reason,
      repaymentTransactionDeleted,
      status: "success",
    });

    return json({
      success: true,
      message:
        `The £${(amountPence / 100).toFixed(
          2,
        )} repayment was undone and is awaiting repayment again.`,
      plan_id: planId,
      occurrence_id: occurrenceId,
      original_transaction_id: originalTransactionId,
      repayment_transaction_id: repaymentTransactionId,
      repayment_transaction_deleted:
        repaymentTransactionDeleted,
      reason,
      occurrence: updatedOccurrence,
      reimbursement: {
        status: "awaiting_reimbursement",
        amount_pence: amountPence,
        amount: amountPence / 100,
      },
      endpoint:
        "/api/admin/money/direct-debits/[planId]/occurrences/[occurrenceId]/reimburse/undo",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "An unknown server error occurred.";

    console.error(
      "Direct Debit repayment undo failed",
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
      reason,
      repaymentTransactionDeleted,
      status: "failed",
      errorMessage: message,
    });

    return json(
      {
        success: false,
        error: "REPAYMENT_UNDO_FAILED",
        message:
          "The Direct Debit repayment could not be undone.",
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

export async function GET() {
  return json(
    {
      success: false,
      error: "METHOD_NOT_ALLOWED",
      message:
        "Use POST, PUT or PATCH to undo this repayment.",
    },
    405,
    {
      Allow: "POST, PUT, PATCH",
    },
  );
}

export async function DELETE() {
  return GET();
}
