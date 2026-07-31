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

function json(body: JsonRecord, status = 200, headers?: HeadersInit) {
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
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function asPositiveInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed =
    typeof value === "number"
      ? value
      : Number(String(value).replace(/[^0-9-]/g, ""));

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

type ReimbursementRequestData = {
  fields: JsonRecord;
  proofFile: File | null;
};

async function readReimbursementRequest(
  request: NextRequest,
): Promise<ReimbursementRequestData> {
  const contentType = cleanText(
    request.headers.get("content-type"),
  ).toLowerCase();

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const fields: JsonRecord = {};

    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") {
        fields[key] = value;
      }
    }

    const proofValue = formData.get("proof_file");

    return {
      fields,
      proofFile:
        proofValue instanceof File && proofValue.size > 0
          ? proofValue
          : null,
    };
  }

  try {
    const body = await request.json();

    return {
      fields: isRecord(body) ? body : {},
      proofFile: null,
    };
  } catch {
    return {
      fields: {},
      proofFile: null,
    };
  }
}

function getAdminIdentity(request: NextRequest): AdminIdentity {
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

function getRequestIp(request: NextRequest): string | null {
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
  error: DatabaseErrorLike,
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
          ? "Check that the Direct Debit reimbursement columns exist, then reload the Supabase schema cache."
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
  alreadyExisted: boolean;
  status: "success" | "failed";
  errorMessage?: string;
}) {
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
    record_type: "money_direct_debit_occurrence",
    record_id: args.occurrenceId,
    description:
      args.status === "success"
        ? `Recorded a personal Direct Debit reimbursement of £${(
            args.amountPence / 100
          ).toFixed(2)}.`
        : "Failed to record a personal Direct Debit reimbursement.",
    metadata: {
      plan_id: args.planId,
      occurrence_id: args.occurrenceId,
      original_transaction_id: args.originalTransactionId,
      repayment_transaction_id: args.repaymentTransactionId,
      amount_pence: args.amountPence,
      payment_method: args.paymentMethod,
      reference: args.reference,
      already_existed: args.alreadyExisted,
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
    console.error("Direct Debit reimbursement audit log failed", {
      planId: args.planId,
      occurrenceId: args.occurrenceId,
      auditError: error,
    });
  }
}

async function findRepaymentTransaction(args: {
  planId: string;
  occurrence: JsonRecord;
  lookupReference: string;
}) {
  const linkedTransactionId = cleanText(
    args.occurrence.reimbursement_transaction_id,
  );

  if (linkedTransactionId && isUuid(linkedTransactionId)) {
    const { data, error } = await supabaseAdmin
      .from(TRANSACTIONS_TABLE)
      .select("*")
      .eq("id", linkedTransactionId)
      .maybeSingle();

    if (error) throw error;
    if (data) return data as JsonRecord;
  }

  /*
   * The repayment row does not use direct_debit_occurrence_id because older
   * databases have a global unique constraint on that column. The original
   * Direct Debit transaction already owns that occurrence ID.
   */
  const { data, error } = await supabaseAdmin
    .from(TRANSACTIONS_TABLE)
    .select("*")
    .eq("direct_debit_plan_id", args.planId)
    .eq("transaction_reference", args.lookupReference)
    .eq("category", "Personal Funds Repayment")
    .maybeSingle();

  if (error) throw error;

  return (data as JsonRecord | null) || null;
}

async function handleReimbursement(
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
      },
      400,
    );
  }

  const {
    fields: body,
    proofFile,
  } = await readReimbursementRequest(request);

  if (!proofFile) {
    return json(
      {
        success: false,
        error: "REPAYMENT_PROOF_REQUIRED",
        message:
          "Upload a picture showing that the person received the repayment.",
        field: "proof_file",
      },
      400,
    );
  }

  if (proofFile.size > 10 * 1024 * 1024) {
    return json(
      {
        success: false,
        error: "REPAYMENT_PROOF_TOO_LARGE",
        message:
          "The repayment proof picture must be 10 MB or smaller.",
        field: "proof_file",
      },
      400,
    );
  }

  const allowedProofTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ]);

  if (
    proofFile.type &&
    !allowedProofTypes.has(proofFile.type)
  ) {
    return json(
      {
        success: false,
        error: "INVALID_REPAYMENT_PROOF_TYPE",
        message:
          "Upload a JPG, PNG, WebP or GIF repayment proof picture.",
        field: "proof_file",
      },
      400,
    );
  }

  const paymentMethod =
    cleanText(
      body.payment_method ??
        body.reimbursement_payment_method,
    ) || "Bank Transfer";

  const suppliedReference =
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

  const requestedAmountPence = asPositiveInteger(
    body.amount_pence ??
      body.reimbursement_amount_pence,
  );

  const reimbursedAtInput = cleanText(
    body.reimbursed_at ??
      body.reimbursement_paid_at,
  );

  let reimbursedAt = new Date().toISOString();

  if (reimbursedAtInput) {
    const parsedDate = new Date(reimbursedAtInput);

    if (Number.isNaN(parsedDate.getTime())) {
      return json(
        {
          success: false,
          error: "INVALID_REIMBURSED_DATE",
          message: "The reimbursement date is invalid.",
          field: "reimbursed_at",
        },
        400,
      );
    }

    reimbursedAt = parsedDate.toISOString();
  }

  const [
    { data: plan, error: planError },
    { data: occurrence, error: occurrenceError },
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
    return databaseError(
      planError,
      "The Direct Debit plan could not be loaded.",
    );
  }

  if (occurrenceError) {
    return databaseError(
      occurrenceError,
      "The Direct Debit payment occurrence could not be loaded.",
    );
  }

  if (!plan) {
    return json(
      {
        success: false,
        error: "DIRECT_DEBIT_NOT_FOUND",
        message: "The Direct Debit plan could not be found.",
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

  const planRow = isRecord(plan) ? plan : ({} as JsonRecord);
  const occurrenceRow = isRecord(occurrence) ? occurrence : ({} as JsonRecord);

  if (
    cleanText(planRow.account_source).toLowerCase() !==
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

  if (
    !["posted", "paid"].includes(
      cleanText(occurrenceRow.status).toLowerCase(),
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

  const amountPence =
    requestedAmountPence ||
    asPositiveInteger(occurrenceRow.amount_pence) ||
    asPositiveInteger(planRow.amount_pence) ||
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
    cleanText(occurrenceRow.transaction_id) || null;

  /*
   * Full occurrence ID makes this stable across repay -> undo -> repay.
   * Undo deletes the previous repayment row, so the same reference can safely
   * be reused when repayment is recorded again.
   */
  const lookupReference =
    `DD-REPAY-${occurrenceId
      .replace(/-/g, "")
      .toUpperCase()}`;

  const displayReference =
    suppliedReference || lookupReference;

  const now = new Date().toISOString();

  let repaymentTransaction: JsonRecord | null = null;
  let repaymentTransactionId: string | null = null;
  let alreadyExisted = false;

  try {
    repaymentTransaction = await findRepaymentTransaction({
      planId,
      occurrence: occurrenceRow,
      lookupReference,
    });

    if (repaymentTransaction) {
      alreadyExisted = true;
      repaymentTransactionId =
        cleanText(repaymentTransaction.id) || null;
    }

    if (!repaymentTransaction) {
      const repaymentPayload: JsonRecord = {
        transaction_type: "expense",
        type: "expense",

        title:
          `Repayment to ${
            cleanText(planRow.account_holder) ||
            "personal account holder"
          } - ${cleanText(planRow.title) || "Direct Debit"}`,

        description:
          notes ||
          `Reimbursement for Direct Debit payment ${
            occurrenceRow.payment_number || ""
          } for ${cleanText(planRow.title) || "Direct Debit"}.`,

        amount_pence: amountPence,
        transaction_date: reimbursedAt.slice(0, 10),
        payment_method: paymentMethod,

        /*
         * This deterministic reference is used for idempotent lookup.
         * The admin-entered reference is stored separately below.
         */
        transaction_reference: lookupReference,
        direct_debit_reference: displayReference,

        category: "Personal Funds Repayment",

        supplier_name:
          cleanText(planRow.account_holder) || null,

        budget_category_key:
          cleanText(planRow.budget_category_key) || null,

        budget_category_label:
          cleanText(planRow.budget_category_label) || null,

        personal_funds_name:
          cleanText(planRow.account_holder) || null,

        personal_funds_repaid: true,
        personal_funds_repaid_at: reimbursedAt,
        reimbursement_status: "reimbursed",

        direct_debit_plan_id: planId,

        /*
         * CRITICAL:
         * Leave this null. The original Direct Debit transaction already owns
         * the occurrence ID and older schemas enforce global uniqueness.
         */
        direct_debit_occurrence_id: null,

        direct_debit_account_source: "personal",

        direct_debit_account_holder:
          cleanText(planRow.account_holder) || null,

        direct_debit_occurrence_status:
          cleanText(occurrenceRow.status) || "posted",

        direct_debit_payment_number:
          occurrenceRow.payment_number || null,

        created_by: admin.id,
        created_at: now,
        updated_at: now,
      };

      const {
        data: insertedTransaction,
        error: insertError,
      } = await supabaseAdmin
        .from(TRANSACTIONS_TABLE)
        .insert(repaymentPayload)
        .select("*")
        .single();

      if (insertError) {
        /*
         * Concurrent clicks can race. Re-query by deterministic reference
         * before returning an error.
         */
        if (cleanText(insertError.code) === "23505") {
          repaymentTransaction =
            await findRepaymentTransaction({
              planId,
              occurrence: occurrenceRow,
              lookupReference,
            });

          if (!repaymentTransaction) {
            return databaseError(
              insertError,
              "The Burton Pride repayment transaction could not be created.",
              409,
            );
          }

          alreadyExisted = true;
        } else {
          return databaseError(
            insertError,
            "The Burton Pride repayment transaction could not be created.",
          );
        }
      } else {
        repaymentTransaction =
          insertedTransaction as JsonRecord;
      }

      repaymentTransactionId =
        cleanText(repaymentTransaction?.id) || null;
    }

    if (
      !repaymentTransactionId ||
      !isUuid(repaymentTransactionId)
    ) {
      return json(
        {
          success: false,
          error: "INVALID_REPAYMENT_TRANSACTION_ID",
          message:
            "The Burton Pride repayment transaction exists but has no valid ID.",
        },
        500,
      );
    }

    /*
     * Upload the required received-payment proof picture.
     *
     * It is attached to the original Personal Funds transaction so the main
     * Money Transactions table shows it directly on the row admins already
     * use. The file name is prefixed so the table and undo route can identify
     * it as repayment proof rather than an ordinary supplier receipt.
     */
    const safeOriginalName =
      proofFile.name
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 120) || "repayment-proof";

    const extension =
      safeOriginalName.includes(".")
        ? safeOriginalName.split(".").pop()
        : proofFile.type.split("/")[1] || "jpg";

    const storagePath =
      `transactions/${originalTransactionId || repaymentTransactionId}` +
      `/repayment-proof/${occurrenceId}-${Date.now()}.${extension}`;

    const proofBytes = new Uint8Array(
      await proofFile.arrayBuffer(),
    );

    const {
      error: proofUploadError,
    } = await supabaseAdmin.storage
      .from("money-invoices")
      .upload(storagePath, proofBytes, {
        contentType: proofFile.type || "image/jpeg",
        upsert: false,
      });

    if (proofUploadError) {
      if (
        !alreadyExisted &&
        repaymentTransactionId &&
        isUuid(repaymentTransactionId)
      ) {
        await supabaseAdmin
          .from(TRANSACTIONS_TABLE)
          .delete()
          .eq("id", repaymentTransactionId);
      }

      return databaseError(
        proofUploadError,
        "The repayment transaction could not be completed because the received-payment proof picture could not be uploaded.",
      );
    }

    const {
      data: publicUrlData,
    } = supabaseAdmin.storage
      .from("money-invoices")
      .getPublicUrl(storagePath);

    const proofFileUrl =
      cleanText(publicUrlData.publicUrl);

    const attachmentTransactionId =
      originalTransactionId &&
      isUuid(originalTransactionId)
        ? originalTransactionId
        : repaymentTransactionId;

    const {
      data: proofAttachment,
      error: proofAttachmentError,
    } = await supabaseAdmin
      .from("money_transaction_attachments")
      .insert({
        transaction_id: attachmentTransactionId,
        file_name: `Repayment proof - ${proofFile.name}`,
        file_url: proofFileUrl,
        file_type: proofFile.type || null,
        file_size: proofFile.size,
        created_at: now,
      })
      .select("*")
      .single();

    if (proofAttachmentError) {
      await supabaseAdmin.storage
        .from("money-invoices")
        .remove([storagePath]);

      if (
        !alreadyExisted &&
        repaymentTransactionId &&
        isUuid(repaymentTransactionId)
      ) {
        await supabaseAdmin
          .from(TRANSACTIONS_TABLE)
          .delete()
          .eq("id", repaymentTransactionId);
      }

      return databaseError(
        proofAttachmentError,
        "The repayment proof picture was uploaded, but it could not be linked to the Money Tracker transaction.",
      );
    }

    /*
     * Link the occurrence to the repayment transaction.
     */
    const {
      data: updatedOccurrence,
      error: occurrenceUpdateError,
    } = await supabaseAdmin
      .from(OCCURRENCES_TABLE)
      .update({
        reimbursement_status: "reimbursed",
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
      await supabaseAdmin
        .from("money_transaction_attachments")
        .delete()
        .eq("id", proofAttachment.id);

      await supabaseAdmin.storage
        .from("money-invoices")
        .remove([storagePath]);

      if (
        !alreadyExisted &&
        repaymentTransactionId &&
        isUuid(repaymentTransactionId)
      ) {
        await supabaseAdmin
          .from(TRANSACTIONS_TABLE)
          .delete()
          .eq("id", repaymentTransactionId);
      }

      return databaseError(
        occurrenceUpdateError,
        "The repayment transaction was created, but the Direct Debit occurrence could not be linked to it.",
      );
    }

    /*
     * Mark the original personal-funds transaction as repaid.
     *
     * Do not write reimbursement_id. That column belongs to
     * money_personal_fund_reimbursements and cannot contain a transaction ID.
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
          updated_at: now,
        })
        .eq("id", originalTransactionId);

      if (originalTransactionError) {
        return databaseError(
          originalTransactionError,
          "The repayment was linked, but the original Money Tracker transaction could not be marked as repaid.",
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
      paymentMethod,
      reference: displayReference,
      alreadyExisted,
      status: "success",
    });

    return json({
      success: true,
      already_existed: alreadyExisted,
      message: alreadyExisted
        ? `The £${(amountPence / 100).toFixed(
            2,
          )} repayment already existed and has been linked correctly.`
        : `The £${(amountPence / 100).toFixed(
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
      proof_attachment: proofAttachment,
      proof_storage_path: storagePath,
      occurrence: updatedOccurrence,
      reimbursement: {
        status: "reimbursed",
        amount_pence: amountPence,
        amount: amountPence / 100,
        payment_method: paymentMethod,
        reference: displayReference,
        transaction_lookup_reference:
          lookupReference,
        reimbursed_at: reimbursedAt,
        account_holder:
          cleanText(planRow.account_holder) || null,
      },
      connection_method: {
        occurrence_column:
          "reimbursement_transaction_id",
        original_transaction_status_fields: [
          "personal_funds_repaid",
          "personal_funds_repaid_at",
          "reimbursement_status",
        ],
        repayment_direct_debit_occurrence_id:
          null,
      },
      endpoint:
        "/api/admin/money/direct-debits/[planId]/occurrences/[occurrenceId]/reimburse",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : isRecord(error)
          ? cleanText(error.message) ||
            "An unknown server error occurred."
          : "An unknown server error occurred.";

    console.error("Direct Debit reimbursement failed", {
      planId,
      occurrenceId,
      error,
    });

    await writeAuditLog({
      request,
      admin,
      planId,
      occurrenceId,
      originalTransactionId,
      repaymentTransactionId,
      amountPence,
      paymentMethod,
      reference: displayReference,
      alreadyExisted,
      status: "failed",
      errorMessage: message,
    });

    if (isRecord(error)) {
      return databaseError(
        error as DatabaseErrorLike,
        "The reimbursement could not be recorded.",
      );
    }

    return json(
      {
        success: false,
        error: "REIMBURSEMENT_FAILED",
        message:
          "The reimbursement could not be recorded.",
        reason: message,
        plan_id: planId,
        occurrence_id: occurrenceId,
      },
      500,
    );
  }
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  return handleReimbursement(request, context);
}

export async function PUT(
  request: NextRequest,
  context: RouteContext,
) {
  return handleReimbursement(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  return handleReimbursement(request, context);
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  const { planId, occurrenceId } =
    await context.params;

  if (!isUuid(planId) || !isUuid(occurrenceId)) {
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

  const { data: occurrence, error } =
    await supabaseAdmin
      .from(OCCURRENCES_TABLE)
      .select("*")
      .eq("id", occurrenceId)
      .eq("plan_id", planId)
      .maybeSingle();

  if (error) {
    return databaseError(
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

  let repaymentTransaction:
    | JsonRecord
    | null = null;

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
      error: repaymentError,
    } = await supabaseAdmin
      .from(TRANSACTIONS_TABLE)
      .select("*")
      .eq("id", repaymentTransactionId)
      .maybeSingle();

    if (repaymentError) {
      return databaseError(
        repaymentError,
        "The linked repayment transaction could not be loaded.",
      );
    }

    repaymentTransaction =
      (data as JsonRecord | null) || null;
  }

  return json({
    success: true,
    occurrence,
    repayment_transaction:
      repaymentTransaction,
    connection_method: {
      occurrence_column:
        "reimbursement_transaction_id",
      repayment_direct_debit_occurrence_id:
        null,
    },
  });
}
