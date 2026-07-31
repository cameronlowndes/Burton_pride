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

type DatabaseErrorLike = {
  message?: string | null;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
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
  if (typeof value === "boolean") return value;

  const normalised = cleanText(value).toLowerCase();

  return ["true", "1", "yes", "on"].includes(normalised);
}

function asSafePence(value: unknown): number {
  const parsed = Number(value ?? 0);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.round(parsed);
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

function databaseError(
  error: DatabaseErrorLike,
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
          ? "Check that the Direct Debit reimbursement columns exist, then reload the Supabase schema cache."
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
  alreadyUndone: boolean;
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

    record_type:
      "money_direct_debit_occurrence",
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
      original_transaction_id:
        args.originalTransactionId,
      repayment_transaction_id:
        args.repaymentTransactionId,
      amount_pence: args.amountPence,
      reason: args.reason,
      repayment_transaction_deleted:
        args.repaymentTransactionDeleted,
      already_undone: args.alreadyUndone,
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
      "Direct Debit repayment undo audit log failed",
      {
        planId: args.planId,
        occurrenceId: args.occurrenceId,
        auditError: error,
      },
    );
  }
}

async function restoreOccurrenceToReimbursed(args: {
  occurrenceId: string;
  planId: string;
  repaymentTransactionId: string | null;
  occurrence: JsonRecord;
  now: string;
}) {
  await supabaseAdmin
    .from(OCCURRENCES_TABLE)
    .update({
      reimbursement_status: "reimbursed",
      reimbursement_transaction_id:
        args.repaymentTransactionId,
      reimbursement_payment_method:
        args.occurrence.reimbursement_payment_method ??
        null,
      reimbursement_amount_pence:
        args.occurrence.reimbursement_amount_pence ??
        args.occurrence.amount_pence ??
        null,
      reimbursement_notes:
        args.occurrence.reimbursement_notes ?? null,
      reimbursed_at:
        args.occurrence.reimbursed_at ?? args.now,
      reimbursement_recorded_by:
        args.occurrence.reimbursement_recorded_by ??
        null,
      updated_at: args.now,
    })
    .eq("id", args.occurrenceId)
    .eq("plan_id", args.planId);
}

async function restoreOriginalTransactionToReimbursed(args: {
  originalTransactionId: string | null;
  occurrence: JsonRecord;
  now: string;
}) {
  if (
    !args.originalTransactionId ||
    !isUuid(args.originalTransactionId)
  ) {
    return;
  }

  /*
   * Do not write reimbursement_id here.
   *
   * money_transactions.reimbursement_id belongs to the separate
   * money_personal_fund_reimbursements foreign key and cannot contain another
   * money_transactions ID.
   */
  await supabaseAdmin
    .from(TRANSACTIONS_TABLE)
    .update({
      personal_funds_repaid: true,
      personal_funds_repaid_at:
        args.occurrence.reimbursed_at ?? args.now,
      reimbursement_status: "reimbursed",
      updated_at: args.now,
    })
    .eq("id", args.originalTransactionId);
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
        message:
          "The Direct Debit occurrence ID is invalid.",
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
      : asBoolean(
          body.delete_repayment_transaction,
        );

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
        "id,title,account_source,account_holder",
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
    return databaseError(
      planError,
      "The Direct Debit plan could not be loaded.",
    );
  }

  if (occurrenceError) {
    return databaseError(
      occurrenceError,
      "The Direct Debit payment could not be loaded.",
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

  const planRow = plan as JsonRecord;
  const occurrenceRow = occurrence as JsonRecord;

  if (
    cleanText(
      planRow.account_source,
    ).toLowerCase() !== "personal"
  ) {
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

  const reimbursementStatus =
    cleanText(
      occurrenceRow.reimbursement_status,
    ).toLowerCase();

  const originalTransactionId =
    cleanText(
      occurrenceRow.transaction_id,
    ) || null;

  const repaymentTransactionId =
    cleanText(
      occurrenceRow.reimbursement_transaction_id,
    ) || null;

  const amountPence = asSafePence(
    occurrenceRow.reimbursement_amount_pence ??
      occurrenceRow.amount_pence,
  );

  /*
   * Idempotent recovery:
   *
   * A previous request may have cleared the occurrence but failed afterwards.
   * Treat that as already undone rather than returning HTTP 409.
   */
  if (
    reimbursementStatus !== "reimbursed" &&
    !repaymentTransactionId
  ) {
    if (
      originalTransactionId &&
      isUuid(originalTransactionId)
    ) {
      const {
        error: originalResetError,
      } = await supabaseAdmin
        .from(TRANSACTIONS_TABLE)
        .update({
          personal_funds_repaid: false,
          personal_funds_repaid_at: null,
          reimbursement_status:
            "awaiting_reimbursement",
          updated_at: new Date().toISOString(),
        })
        .eq("id", originalTransactionId);

      if (originalResetError) {
        return databaseError(
          originalResetError,
          "The repayment was already undone, but the original Money Tracker transaction could not be reset.",
        );
      }
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
      repaymentTransactionDeleted: false,
      alreadyUndone: true,
      status: "success",
    });

    return json({
      success: true,
      already_undone: true,
      message:
        "The personal repayment had already been undone.",
      plan_id: planId,
      occurrence_id: occurrenceId,
      original_transaction_id:
        originalTransactionId,
      repayment_transaction_id:
        repaymentTransactionId,
      repayment_transaction_deleted: false,
      occurrence: occurrenceRow,
    });
  }

  if (reimbursementStatus !== "reimbursed") {
    return json(
      {
        success: false,
        error: "REPAYMENT_NOT_RECORDED",
        message:
          "This Direct Debit payment is not currently marked as reimbursed.",
        occurrence: occurrenceRow,
      },
      409,
    );
  }

  const now = new Date().toISOString();

  let repaymentTransactionDeleted = false;
  let occurrenceWasCleared = false;
  let originalTransactionWasReset = false;

  try {
    /*
     * Step 1: clear the occurrence link first.
     *
     * This is essential because reimbursement_transaction_id may have a
     * foreign key to the repayment transaction. Deleting the transaction
     * before clearing this link can fail with code 23503.
     */
    const {
      data: updatedOccurrence,
      error: updateOccurrenceError,
    } = await supabaseAdmin
      .from(OCCURRENCES_TABLE)
      .update({
        reimbursement_status:
          "awaiting_reimbursement",
        reimbursement_transaction_id: null,
        reimbursement_payment_method: null,
        reimbursement_amount_pence: null,
        reimbursement_notes: reason,
        reimbursed_at: null,
        reimbursement_recorded_by: null,
        updated_at: now,
      })
      .eq("id", occurrenceId)
      .eq("plan_id", planId)
      .select("*")
      .single();

    if (updateOccurrenceError) {
      return databaseError(
        updateOccurrenceError,
        "The repayment could not be reset on the Direct Debit payment.",
      );
    }

    occurrenceWasCleared = true;

    /*
     * Step 2: restore the original personal-funds transaction to awaiting
     * repayment.
     *
     * reimbursement_id is deliberately not touched because it belongs to
     * money_personal_fund_reimbursements, not money_transactions.
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
          personal_funds_repaid: false,
          personal_funds_repaid_at: null,
          reimbursement_status:
            "awaiting_reimbursement",
          updated_at: now,
        })
        .eq("id", originalTransactionId);

      if (originalTransactionError) {
        await restoreOccurrenceToReimbursed({
          occurrenceId,
          planId,
          repaymentTransactionId,
          occurrence: occurrenceRow,
          now,
        });

        return databaseError(
          originalTransactionError,
          "The Direct Debit repayment was reset, but the original Money Tracker transaction could not be returned to awaiting repayment.",
        );
      }

      originalTransactionWasReset = true;
    }

    /*
     * Step 3: remove received-payment proof attachments from the original
     * Personal Funds transaction. These are identified by the prefix used by
     * the reimbursement route.
     */
    if (
      originalTransactionId &&
      isUuid(originalTransactionId)
    ) {
      const {
        data: repaymentProofAttachments,
        error: proofLookupError,
      } = await supabaseAdmin
        .from("money_transaction_attachments")
        .select("id,file_url,file_name")
        .eq("transaction_id", originalTransactionId)
        .ilike("file_name", "Repayment proof - %");

      if (proofLookupError) {
        await restoreOriginalTransactionToReimbursed({
          originalTransactionId,
          occurrence: occurrenceRow,
          now,
        });

        await restoreOccurrenceToReimbursed({
          occurrenceId,
          planId,
          repaymentTransactionId,
          occurrence: occurrenceRow,
          now,
        });

        return databaseError(
          proofLookupError,
          "The repayment was reset, but its received-payment proof could not be loaded for removal.",
        );
      }

      if (
        Array.isArray(repaymentProofAttachments) &&
        repaymentProofAttachments.length > 0
      ) {
        const attachmentIds = repaymentProofAttachments
          .map((attachment) => cleanText(attachment.id))
          .filter(Boolean);

        if (attachmentIds.length > 0) {
          const {
            error: proofDeleteError,
          } = await supabaseAdmin
            .from("money_transaction_attachments")
            .delete()
            .in("id", attachmentIds);

          if (proofDeleteError) {
            await restoreOriginalTransactionToReimbursed({
              originalTransactionId,
              occurrence: occurrenceRow,
              now,
            });

            await restoreOccurrenceToReimbursed({
              occurrenceId,
              planId,
              repaymentTransactionId,
              occurrence: occurrenceRow,
              now,
            });

            return databaseError(
              proofDeleteError,
              "The repayment was reset, but its received-payment proof attachment could not be removed.",
            );
          }
        }

        const storagePaths = repaymentProofAttachments
          .map((attachment) => {
            const fileUrl = cleanText(attachment.file_url);
            const marker = "/money-invoices/";

            if (!fileUrl.includes(marker)) return "";

            return decodeURIComponent(
              fileUrl.split(marker)[1] || "",
            );
          })
          .filter(Boolean);

        if (storagePaths.length > 0) {
          await supabaseAdmin.storage
            .from("money-invoices")
            .remove(storagePaths);
        }
      }
    }

    /*
     * Step 4: delete the separate Burton Pride repayment transaction only
     * after all links to it have been released.
     */
    if (
      deleteRepaymentTransaction &&
      repaymentTransactionId &&
      isUuid(repaymentTransactionId)
    ) {
      const {
        data: deletedRows,
        error: deleteTransactionError,
      } = await supabaseAdmin
        .from(TRANSACTIONS_TABLE)
        .delete()
        .eq("id", repaymentTransactionId)
        .select("id");

      if (deleteTransactionError) {
        if (originalTransactionWasReset) {
          await restoreOriginalTransactionToReimbursed({
            originalTransactionId,
            occurrence: occurrenceRow,
            now,
          });
        }

        if (occurrenceWasCleared) {
          await restoreOccurrenceToReimbursed({
            occurrenceId,
            planId,
            repaymentTransactionId,
            occurrence: occurrenceRow,
            now,
          });
        }

        return databaseError(
          deleteTransactionError,
          "The repayment was reset, but the linked Burton Pride repayment transaction could not be removed.",
        );
      }

      repaymentTransactionDeleted =
        Array.isArray(deletedRows) &&
        deletedRows.length > 0;
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
      alreadyUndone: false,
      status: "success",
    });

    return json({
      success: true,

      message:
        deleteRepaymentTransaction
          ? `The £${(
              amountPence / 100
            ).toFixed(
              2,
            )} repayment was undone and its linked Burton Pride repayment transaction was removed.`
          : `The £${(
              amountPence / 100
            ).toFixed(
              2,
            )} repayment was undone and is awaiting repayment again.`,

      plan_id: planId,
      occurrence_id: occurrenceId,

      original_transaction_id:
        originalTransactionId,

      repayment_transaction_id:
        repaymentTransactionId,

      repayment_transaction_deleted:
        repaymentTransactionDeleted,

      reason,
      occurrence: updatedOccurrence,

      reimbursement: {
        status: "awaiting_reimbursement",
        amount_pence: amountPence,
        amount: amountPence / 100,
      },

      next_action: {
        can_undo_direct_debit_payment: true,
        message:
          "The personal repayment has been removed. The original Direct Debit payment can now be undone.",
      },

      endpoint:
        "/api/admin/money/direct-debits/[planId]/occurrences/[occurrenceId]/reimburse/undo",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : isRecord(error)
          ? cleanText(error.message) ||
            "An unknown server error occurred."
          : "An unknown server error occurred.";

    console.error(
      "Direct Debit repayment undo failed",
      {
        planId,
        occurrenceId,
        error,
      },
    );

    /*
     * Best-effort recovery if an unexpected error happened after state was
     * changed.
     */
    if (originalTransactionWasReset) {
      await restoreOriginalTransactionToReimbursed({
        originalTransactionId,
        occurrence: occurrenceRow,
        now,
      });
    }

    if (occurrenceWasCleared) {
      await restoreOccurrenceToReimbursed({
        occurrenceId,
        planId,
        repaymentTransactionId,
        occurrence: occurrenceRow,
        now,
      });
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
      alreadyUndone: false,
      status: "failed",
      errorMessage: message,
    });

    if (isRecord(error)) {
      return databaseError(
        error as DatabaseErrorLike,
        "The Direct Debit repayment could not be undone.",
      );
    }

    return json(
      {
        success: false,
        error: "REPAYMENT_UNDO_FAILED",
        message:
          "The Direct Debit repayment could not be undone.",
        reason: message,
        plan_id: planId,
        occurrence_id: occurrenceId,
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
