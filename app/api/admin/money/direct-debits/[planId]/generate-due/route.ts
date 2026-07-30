import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PLANS_TABLE = "money_direct_debit_plans";
const OCCURRENCES_TABLE = "money_direct_debit_occurrences";
const TRANSACTIONS_TABLE = "money_transactions";

type RouteContext = {
  params: Promise<{
    planId: string;
  }>;
};

type JsonRecord = Record<string, unknown>;

type AuthenticatedAdmin = {
  id: string;
  email: string;
  name: string;
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

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function nameFromEmail(email: string) {
  if (!email.includes("@")) return "";

  return email
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function todayDateKey() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60 * 1000;

  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function transactionReference(
  planId: string,
  paymentNumber: number,
  dueDate: string,
) {
  return `DD-${planId.slice(0, 8).toUpperCase()}-${String(
    paymentNumber,
  ).padStart(2, "0")}-${dueDate.replaceAll("-", "")}`;
}

async function readBody(request: NextRequest): Promise<JsonRecord> {
  try {
    const body = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return {};
    }

    return body as JsonRecord;
  } catch {
    return {};
  }
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

  return json(
    {
      success: false,
      error: cleanText(error.message) || fallbackMessage,
      message: fallbackMessage,
      code: code || "DIRECT_DEBIT_DATABASE_ERROR",
      details: cleanText(error.details) || null,
      hint: cleanText(error.hint) || null,
      endpoint:
        "/api/admin/money/direct-debits/[planId]/generate-due",
    },
    resolvedStatus,
  );
}

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
    throw new Error("Not signed in. Please sign in again.");
  }

  let query = supabaseAdmin.from("admin_users").select("*").limit(1);

  if (cookieAdminId && isUuid(cookieAdminId)) {
    query = query.eq("id", cookieAdminId);
  } else {
    query = query.ilike("email", cookieAdminEmail);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(
      [
        "The signed-in admin could not be checked.",
        error.message,
        error.code ? `Code: ${error.code}` : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  if (!data) {
    throw new Error("The signed-in admin account could not be found.");
  }

  if (
    data.is_active === false ||
    cleanText(data.status).toLowerCase() === "inactive" ||
    cleanText(data.status).toLowerCase() === "disabled"
  ) {
    throw new Error("This admin account is inactive.");
  }

  const email = cleanText(data.email || data.admin_email);
  const name =
    cleanText(
      data.full_name ||
        data.name ||
        data.display_name ||
        data.admin_name,
    ) ||
    nameFromEmail(email) ||
    "Admin";

  return {
    id: cleanText(data.id || data.admin_id),
    email,
    name,
  };
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const admin = await requireAuthenticatedAdmin(request);
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
    const requestedOccurrenceId = cleanText(body.occurrence_id);

    if (requestedOccurrenceId && !isUuid(requestedOccurrenceId)) {
      return json(
        {
          success: false,
          error: "The Direct Debit occurrence ID is invalid.",
          code: "INVALID_OCCURRENCE_ID",
        },
        400,
      );
    }

    const { data: plan, error: planError } = await supabaseAdmin
      .from(PLANS_TABLE)
      .select("*")
      .eq("id", planId)
      .maybeSingle();

    if (planError) {
      return databaseErrorResponse(
        planError,
        "The Direct Debit plan could not be loaded.",
      );
    }

    if (!plan) {
      return json(
        {
          success: false,
          error: "The Direct Debit plan could not be found.",
          code: "DIRECT_DEBIT_PLAN_NOT_FOUND",
        },
        404,
      );
    }

    if (plan.status !== "active") {
      return json(
        {
          success: false,
          error:
            "Only an active Direct Debit plan can make a payment.",
          code: "DIRECT_DEBIT_NOT_ACTIVE",
          details: `Current status: ${plan.status}`,
        },
        409,
      );
    }

    let occurrenceQuery = supabaseAdmin
      .from(OCCURRENCES_TABLE)
      .select("*")
      .eq("plan_id", planId)
      .eq("status", "scheduled")
      .order("due_date", { ascending: true })
      .limit(1);

    if (requestedOccurrenceId) {
      occurrenceQuery = occurrenceQuery.eq("id", requestedOccurrenceId);
    } else {
      occurrenceQuery = occurrenceQuery.lte("due_date", todayDateKey());
    }

    const { data: occurrence, error: occurrenceError } =
      await occurrenceQuery.maybeSingle();

    if (occurrenceError) {
      return databaseErrorResponse(
        occurrenceError,
        "The due Direct Debit payment could not be loaded.",
      );
    }

    if (!occurrence) {
      return json(
        {
          success: false,
          error:
            "No scheduled Direct Debit payment is due for this plan.",
          code: "NO_DUE_OCCURRENCE",
        },
        404,
      );
    }

    if (
      occurrence.transaction_id &&
      isUuid(cleanText(occurrence.transaction_id))
    ) {
      return json({
        success: true,
        already_posted: true,
        message:
          "This Direct Debit payment already has a linked Money Transaction.",
        transaction_id: occurrence.transaction_id,
        occurrence,
      });
    }

    if (occurrence.due_date > todayDateKey()) {
      return json(
        {
          success: false,
          error:
            "This Direct Debit payment is not due yet.",
          code: "PAYMENT_NOT_DUE",
          details: `Due date: ${occurrence.due_date}`,
        },
        409,
      );
    }

    const accountSource =
      plan.account_source === "personal"
        ? "personal"
        : "organisation";

    const accountHolder =
      accountSource === "personal"
        ? cleanText(plan.account_holder) || "Personal account"
        : null;

    const amountPence = Number(
      occurrence.amount_pence || plan.amount_pence || 0,
    );

    if (!Number.isInteger(amountPence) || amountPence <= 0) {
      return json(
        {
          success: false,
          error:
            "The Direct Debit payment amount is invalid.",
          code: "INVALID_PAYMENT_AMOUNT",
          details: amountPence,
        },
        400,
      );
    }

    const paymentNumber = Number(occurrence.payment_number || 1);
    const totalPayments = plan.is_open_ended
      ? null
      : Number(plan.total_payments || 0) || null;

    const reference = transactionReference(
      planId,
      paymentNumber,
      occurrence.due_date,
    );

    const transactionPayload = {
      title: cleanText(plan.title) || "Direct Debit payment",
      description:
        cleanText(plan.description) ||
        `Monthly Direct Debit payment${
          cleanText(plan.supplier_name)
            ? ` to ${cleanText(plan.supplier_name)}`
            : ""
        }.`,
      type: "expense",
      category: "Direct Debit",
      amount_pence: amountPence,
      payment_method:
        accountSource === "personal"
          ? "Personal Funds"
          : "Direct Debit",
      transaction_date: occurrence.due_date,
      transaction_reference: reference,

      supplier_id: plan.supplier_id || null,
      supplier_name: cleanText(plan.supplier_name) || null,

      budget_category_key:
        cleanText(plan.budget_category_key) || null,
      budget_category_label:
        cleanText(plan.budget_category_label) || null,

      is_personal_funds: accountSource === "personal",
      personal_funds_name: accountHolder,
      personal_funds_repaid: false,

      direct_debit_plan_id: planId,
      direct_debit_occurrence_id: occurrence.id,
      direct_debit_account_source: accountSource,
      direct_debit_account_holder: accountHolder,
      direct_debit_reference:
        cleanText(plan.mandate_reference) || reference,
      direct_debit_plan_note: cleanText(plan.notes) || null,
      direct_debit_payment_number: paymentNumber,
      direct_debit_total_payments: totalPayments,

      reimbursement_status:
        accountSource === "personal"
          ? "awaiting_reimbursement"
          : "not_required",

      source: "direct_debit",
      created_by: admin.id,
      created_by_name: admin.name,
      created_by_email: admin.email,
    };

    const { data: transaction, error: transactionError } =
      await supabaseAdmin
        .from(TRANSACTIONS_TABLE)
        .insert(transactionPayload)
        .select("*")
        .single();

    if (transactionError) {
      return databaseErrorResponse(
        transactionError,
        "The Direct Debit payment could not be added to Money Transactions.",
      );
    }

    const now = new Date().toISOString();

    const { data: updatedOccurrence, error: updateOccurrenceError } =
      await supabaseAdmin
        .from(OCCURRENCES_TABLE)
        .update({
          status: "posted",
          transaction_id: transaction.id,
          posted_at: now,
          reimbursement_status:
            accountSource === "personal"
              ? "awaiting_reimbursement"
              : "not_required",
          updated_at: now,
        })
        .eq("id", occurrence.id)
        .eq("status", "scheduled")
        .select("*")
        .single();

    if (updateOccurrenceError) {
      await supabaseAdmin
        .from(TRANSACTIONS_TABLE)
        .delete()
        .eq("id", transaction.id);

      return databaseErrorResponse(
        updateOccurrenceError,
        "The Money Transaction was created, but the Direct Debit occurrence could not be updated. The transaction was rolled back.",
      );
    }

    const { data: remainingOccurrences, error: remainingError } =
      await supabaseAdmin
        .from(OCCURRENCES_TABLE)
        .select("id,due_date,status")
        .eq("plan_id", planId)
        .eq("status", "scheduled")
        .order("due_date", { ascending: true });

    if (remainingError) {
      return databaseErrorResponse(
        remainingError,
        "The payment was created, but the next collection date could not be refreshed.",
      );
    }

    const nextCollectionDate =
      Array.isArray(remainingOccurrences) &&
      remainingOccurrences.length > 0
        ? remainingOccurrences[0].due_date
        : null;

    const shouldComplete =
      !plan.is_open_ended &&
      (!remainingOccurrences || remainingOccurrences.length === 0);

    const { error: planUpdateError } = await supabaseAdmin
      .from(PLANS_TABLE)
      .update({
        payments_created: Number(plan.payments_created || 0) + 1,
        next_collection_date: nextCollectionDate,
        status: shouldComplete ? "completed" : plan.status,
        updated_at: now,
      })
      .eq("id", planId);

    if (planUpdateError) {
      return databaseErrorResponse(
        planUpdateError,
        "The payment was created, but the Direct Debit plan totals could not be refreshed.",
      );
    }

    return json(
      {
        success: true,
        message:
          accountSource === "personal"
            ? `The payment was added to Money Transactions as Personal Funds for ${accountHolder}.`
            : "The Direct Debit payment was added to Money Transactions.",
        plan_id: planId,
        occurrence: updatedOccurrence,
        transaction,
        next_collection_date: nextCollectionDate,
        plan_completed: shouldComplete,
      },
      201,
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "The Direct Debit payment could not be processed.";

    const unauthorised =
      message.toLowerCase().includes("not signed in") ||
      message.toLowerCase().includes("session");

    return json(
      {
        success: false,
        error: message,
        code: unauthorised
          ? "DIRECT_DEBIT_UNAUTHORISED"
          : "DIRECT_DEBIT_PAYMENT_FAILED",
        details: null,
        hint: unauthorised
          ? "Sign in to the Admin Portal again, then retry the payment."
          : null,
      },
      unauthorised ? 401 : 500,
    );
  }
}

export async function GET() {
  return json(
    {
      success: false,
      error: "Method not allowed.",
      message: "Use POST to make a Direct Debit payment.",
      code: "METHOD_NOT_ALLOWED",
    },
    405,
    {
      Allow: "POST",
    },
  );
}

export async function PATCH() {
  return GET();
}

export async function PUT() {
  return GET();
}

export async function DELETE() {
  return GET();
}
