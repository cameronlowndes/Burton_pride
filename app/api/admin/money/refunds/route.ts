import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RefundType = "money_received_back" | "money_sent_back";
type RefundStatus = "pending" | "completed" | "cancelled";

type RefundPatchAction =
  | "update"
  | "hide"
  | "restore"
  | "cancel"
  | "mark_completed"
  | "mark_pending";

type RefundRecord = {
  id: string;
  year: number;
  refund_date: string;
  refund_type: RefundType;
  amount_pence: number;
  title: string;
  notes: string | null;
  original_transaction_id: string | null;
  supplier_id: string | null;
  reference_number: string | null;
  status: RefundStatus;
  created_by_name: string | null;
  created_by_email: string | null;
  updated_by_name: string | null;
  updated_by_email: string | null;
  is_hidden: boolean;
  hidden_at: string | null;
  hidden_by_name: string | null;
  hidden_by_email: string | null;
  created_at: string;
  updated_at: string;
};

type SupplierLink = {
  id: string;
  supplier_name: string;
};

type TransactionLink = {
  id: string;
  title: string;
  amount_pence: number;
  transaction_type: string;
  transaction_date: string;
};

type HydratedRefundRecord = RefundRecord & {
  supplier: SupplierLink | null;
  original_transaction: TransactionLink | null;
};

type Actor = {
  name: string;
  email: string;
};

type JsonObject = Record<string, unknown>;

type SupabaseErrorLike = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

type AdminLike = {
  id?: string | null;
  admin_id?: string | null;
  user_id?: string | null;
  name?: string | null;
  full_name?: string | null;
  display_name?: string | null;
  email?: string | null;
};

const REFUND_SELECT = `
  id,
  year,
  refund_date,
  refund_type,
  amount_pence,
  title,
  notes,
  original_transaction_id,
  supplier_id,
  reference_number,
  status,
  created_by_name,
  created_by_email,
  updated_by_name,
  updated_by_email,
  is_hidden,
  hidden_at,
  hidden_by_name,
  hidden_by_email,
  created_at,
  updated_at
`;

function getErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") return error ?? null;

  const record = error as SupabaseErrorLike;

  return {
    message: record.message || null,
    details: record.details || null,
    hint: record.hint || null,
    code: record.code || null,
  };
}

function getLikelyFix(error: unknown) {
  const details = getErrorDetails(error);

  const combinedText = JSON.stringify(details || error || "")
    .toLowerCase()
    .trim();

  if (
    combinedText.includes("money_refunds") &&
    (combinedText.includes("does not exist") ||
      combinedText.includes("could not find") ||
      combinedText.includes("schema cache") ||
      combinedText.includes("relation"))
  ) {
    return "Create the public.money_refunds table in Supabase. If the table already exists, confirm that the name is exactly money_refunds and reload the Supabase schema cache.";
  }

  if (
    combinedText.includes("money_suppliers") &&
    (combinedText.includes("does not exist") ||
      combinedText.includes("could not find") ||
      combinedText.includes("schema cache"))
  ) {
    return "The supplier table could not be loaded. Check whether the supplier tracker uses public.money_suppliers and confirm its column names.";
  }

  if (
    combinedText.includes("money_transactions") &&
    (combinedText.includes("does not exist") ||
      combinedText.includes("could not find") ||
      combinedText.includes("schema cache"))
  ) {
    return "The transactions table could not be loaded. Confirm that public.money_transactions exists and that its columns match the money tracker API.";
  }

  if (
    combinedText.includes("transaction_type") &&
    combinedText.includes("column")
  ) {
    return "The transactions table uses the column type rather than transaction_type. Update the refund API route to select type and map it to transaction_type for the user interface.";
  }

  if (
    combinedText.includes("relationship") ||
    combinedText.includes("foreign key")
  ) {
    return "Supabase could not detect a relationship between the tables. The refund API should load linked records separately instead of relying on nested relationship queries.";
  }

  if (
    combinedText.includes("column") &&
    (combinedText.includes("does not exist") ||
      combinedText.includes("could not find") ||
      combinedText.includes("schema cache"))
  ) {
    return "A database column is missing or has a different name. Compare the Supabase table columns with the refund tracker SQL and update the API route where needed.";
  }

  return "Check the terminal or Vercel logs for the full Supabase error. Expand Show server details in the Refund Tracker to see the database response.";
}

function jsonError(
  message: string,
  status = 400,
  details?: unknown,
  likelyFix?: string
) {
  return NextResponse.json(
    {
      success: false,
      message,
      ...(details !== undefined ? { details: getErrorDetails(details) } : {}),
      ...(likelyFix ? { likelyFix } : {}),
    },
    { status }
  );
}

function cleanText(value: unknown, maxLength = 500): string {
  if (typeof value !== "string") return "";

  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanNullableText(value: unknown, maxLength = 2_000): string | null {
  const cleaned = cleanText(value, maxLength);
  return cleaned || null;
}

function cleanUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const cleaned = value.trim();
  if (!cleaned) return null;

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return uuidPattern.test(cleaned) ? cleaned : null;
}

function parseBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const cleaned = value.toLowerCase().trim();

    if (cleaned === "true" || cleaned === "1" || cleaned === "yes") {
      return true;
    }

    if (cleaned === "false" || cleaned === "0" || cleaned === "no") {
      return false;
    }
  }

  return fallback;
}

function parsePositiveInteger(value: unknown, fallback?: number): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback ?? null;
  }

  return Math.floor(parsed);
}

function parseYear(value: unknown): number | null {
  const year = parsePositiveInteger(value);

  if (!year || year < 2000 || year > 2200) {
    return null;
  }

  return year;
}

function parseAmountPence(body: JsonObject): number | null {
  const directPence = parsePositiveInteger(body.amount_pence);

  if (directPence) return directPence;

  const poundsValue =
    typeof body.amount === "number"
      ? body.amount
      : typeof body.amount === "string"
        ? Number.parseFloat(body.amount)
        : Number.NaN;

  if (!Number.isFinite(poundsValue) || poundsValue <= 0) {
    return null;
  }

  return Math.round(poundsValue * 100);
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== "string") return false;

  const cleaned = value.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return false;

  const date = new Date(`${cleaned}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime());
}

function isRefundType(value: unknown): value is RefundType {
  return value === "money_received_back" || value === "money_sent_back";
}

function isRefundStatus(value: unknown): value is RefundStatus {
  return value === "pending" || value === "completed" || value === "cancelled";
}

function isPatchAction(value: unknown): value is RefundPatchAction {
  return (
    value === "update" ||
    value === "hide" ||
    value === "restore" ||
    value === "cancel" ||
    value === "mark_completed" ||
    value === "mark_pending"
  );
}

function formatMoney(amountPence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amountPence / 100);
}

async function getActor(): Promise<Actor | null> {
  try {
    const admin = (await requireAdmin()) as AdminLike | null;

    if (!admin) return null;

    const email = cleanText(admin.email || "", 250);

    const name =
      cleanText(admin.full_name || "", 250) ||
      cleanText(admin.name || "", 250) ||
      cleanText(admin.display_name || "", 250) ||
      email ||
      "Authenticated admin";

    return {
      name,
      email,
    };
  } catch (error) {
    console.error("Refund route auth error:", error);
    return null;
  }
}

async function writeAuditLog({
  actor,
  action,
  refundId,
  description,
  metadata,
}: {
  actor: Actor;
  action: string;
  refundId: string;
  description: string;
  metadata?: JsonObject;
}) {
  const createdAt = new Date().toISOString();

  const attempts: JsonObject[] = [
    {
      action,
      entity_type: "refund",
      entity_id: refundId,
      description,
      actor_name: actor.name,
      actor_email: actor.email,
      metadata: metadata ?? {},
      created_at: createdAt,
    },
    {
      action,
      record_type: "refund",
      record_id: refundId,
      details: description,
      actor_name: actor.name,
      actor_email: actor.email,
      metadata: metadata ?? {},
      created_at: createdAt,
    },
    {
      action,
      transaction_id: null,
      transaction_title: description,
      actor_name: actor.name,
      actor_email: actor.email,
      metadata: {
        ...(metadata ?? {}),
        refund_id: refundId,
        refund_description: description,
      },
      created_at: createdAt,
    },
  ];

  for (const payload of attempts) {
    const { error } = await supabaseAdmin
      .from("admin_money_audit_logs")
      .insert(payload);

    if (!error) return;
  }

  console.warn(
    "Refund action completed, but the audit-log entry could not be created. Check the admin_money_audit_logs columns."
  );
}

async function hydrateRefundLinks(
  refunds: RefundRecord[]
): Promise<HydratedRefundRecord[]> {
  if (refunds.length === 0) return [];

  const supplierIds = Array.from(
    new Set(
      refunds
        .map((refund) => refund.supplier_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  const transactionIds = Array.from(
    new Set(
      refunds
        .map((refund) => refund.original_transaction_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  const supplierMap = new Map<string, SupplierLink>();
  const transactionMap = new Map<string, TransactionLink>();

  if (supplierIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("money_suppliers")
      .select("id, supplier_name")
      .in("id", supplierIds);

    if (error) {
      console.warn(
        "Refunds loaded, but linked suppliers could not be loaded:",
        getErrorDetails(error)
      );
    }

    for (const supplier of data ?? []) {
      supplierMap.set(String(supplier.id), {
        id: String(supplier.id),
        supplier_name:
          typeof supplier.supplier_name === "string"
            ? supplier.supplier_name
            : "Unnamed supplier",
      });
    }
  }

  if (transactionIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("money_transactions")
      .select(
        `
          id,
          title,
          amount_pence,
          type,
          transaction_date
        `
      )
      .in("id", transactionIds);

    if (error) {
      console.warn(
        "Refunds loaded, but linked transactions could not be loaded:",
        getErrorDetails(error)
      );
    }

    for (const transaction of data ?? []) {
      transactionMap.set(String(transaction.id), {
        id: String(transaction.id),
        title:
          typeof transaction.title === "string"
            ? transaction.title
            : "Untitled transaction",
        amount_pence: Number(transaction.amount_pence || 0),
        transaction_type:
          typeof transaction.type === "string"
            ? transaction.type
            : "transaction",
        transaction_date:
          typeof transaction.transaction_date === "string"
            ? transaction.transaction_date
            : "",
      });
    }
  }

  return refunds.map((refund) => ({
    ...refund,
    supplier: refund.supplier_id
      ? supplierMap.get(refund.supplier_id) ?? null
      : null,
    original_transaction: refund.original_transaction_id
      ? transactionMap.get(refund.original_transaction_id) ?? null
      : null,
  }));
}

async function verifyLinkedRecord(
  table: "money_transactions" | "money_suppliers",
  id: string | null
) {
  if (!id) {
    return {
      exists: true,
      error: null,
    };
  }

  const { data, error } = await supabaseAdmin
    .from(table)
    .select("id")
    .eq("id", id)
    .maybeSingle();

  return {
    exists: !error && Boolean(data),
    error,
  };
}

function getPatchDescription(
  action: RefundPatchAction,
  refund: RefundRecord,
  changes: JsonObject
) {
  if (action === "hide") {
    return `Soft-deleted refund "${refund.title}" for ${formatMoney(
      refund.amount_pence
    )}.`;
  }

  if (action === "restore") {
    return `Restored refund "${refund.title}" for ${formatMoney(
      refund.amount_pence
    )}.`;
  }

  if (action === "cancel") {
    return `Cancelled refund "${refund.title}" for ${formatMoney(
      refund.amount_pence
    )}.`;
  }

  if (action === "mark_completed") {
    return `Marked refund "${refund.title}" as completed.`;
  }

  if (action === "mark_pending") {
    return `Marked refund "${refund.title}" as pending.`;
  }

  return `Updated refund "${refund.title}". Changed fields: ${Object.keys(
    changes
  ).join(", ")}.`;
}

export async function GET(request: NextRequest) {
  const actor = await getActor();

  if (!actor) {
    return jsonError(
      "You must be signed in as an admin to view refunds.",
      401,
      undefined,
      "Sign in again using the admin login page and confirm your Supabase admin session is active."
    );
  }

  try {
    const { searchParams } = new URL(request.url);

    const yearParam = searchParams.get("year");
    const statusParam = searchParams.get("status");
    const supplierIdParam = searchParams.get("supplierId");
    const transactionIdParam = searchParams.get("originalTransactionId");

    const includeHidden = parseBoolean(
      searchParams.get("includeHidden"),
      false
    );

    const limit = Math.min(
      parsePositiveInteger(searchParams.get("limit"), 200) ?? 200,
      500
    );

    let query = supabaseAdmin
      .from("money_refunds")
      .select(REFUND_SELECT)
      .order("refund_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!includeHidden) {
      query = query.eq("is_hidden", false);
    }

    if (yearParam) {
      const year = parseYear(yearParam);

      if (!year) {
        return jsonError("The selected refund year is invalid.", 400);
      }

      query = query.eq("year", year);
    }

    if (statusParam) {
      if (!isRefundStatus(statusParam)) {
        return jsonError("The selected refund status is invalid.", 400);
      }

      query = query.eq("status", statusParam);
    }

    if (supplierIdParam) {
      const supplierId = cleanUuid(supplierIdParam);

      if (!supplierId) {
        return jsonError("The supplier ID is invalid.", 400);
      }

      query = query.eq("supplier_id", supplierId);
    }

    if (transactionIdParam) {
      const originalTransactionId = cleanUuid(transactionIdParam);

      if (!originalTransactionId) {
        return jsonError("The original transaction ID is invalid.", 400);
      }

      query = query.eq("original_transaction_id", originalTransactionId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to load refunds:", error);

      return jsonError(
        "Refunds could not be loaded.",
        500,
        error,
        getLikelyFix(error)
      );
    }

    const refunds = await hydrateRefundLinks((data ?? []) as RefundRecord[]);

    const visibleCompletedRefunds = refunds.filter(
      (refund) => !refund.is_hidden && refund.status === "completed"
    );

    const moneyReceivedBackPence = visibleCompletedRefunds
      .filter((refund) => refund.refund_type === "money_received_back")
      .reduce(
        (total, refund) => total + Number(refund.amount_pence || 0),
        0
      );

    const moneySentBackPence = visibleCompletedRefunds
      .filter((refund) => refund.refund_type === "money_sent_back")
      .reduce(
        (total, refund) => total + Number(refund.amount_pence || 0),
        0
      );

    return NextResponse.json(
      {
        success: true,
        refunds,
        summary: {
          total_records: refunds.length,
          completed_records: visibleCompletedRefunds.length,
          money_received_back_pence: moneyReceivedBackPence,
          money_sent_back_pence: moneySentBackPence,
          net_refunds_pence: moneyReceivedBackPence - moneySentBackPence,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Unexpected refund GET error:", error);

    return jsonError(
      "An unexpected error occurred while loading refunds.",
      500,
      error,
      getLikelyFix(error)
    );
  }
}

export async function POST(request: NextRequest) {
  const actor = await getActor();

  if (!actor) {
    return jsonError(
      "You must be signed in as an admin to add a refund.",
      401,
      undefined,
      "Sign in again using the admin login page and confirm your Supabase admin session is active."
    );
  }

  try {
    const body = (await request.json()) as JsonObject;

    const year = parseYear(body.year);
    const refundDate = body.refund_date;
    const refundType = body.refund_type;
    const amountPence = parseAmountPence(body);
    const title = cleanText(body.title, 250);
    const notes = cleanNullableText(body.notes, 4_000);
    const referenceNumber = cleanNullableText(body.reference_number, 150);

    const originalTransactionId =
      body.original_transaction_id === null || body.original_transaction_id === ""
        ? null
        : cleanUuid(body.original_transaction_id);

    const supplierId =
      body.supplier_id === null || body.supplier_id === ""
        ? null
        : cleanUuid(body.supplier_id);

    const status: RefundStatus = isRefundStatus(body.status)
      ? body.status
      : "completed";

    if (!year) {
      return jsonError("Please select a valid refund year.", 400);
    }

    if (!isValidDate(refundDate)) {
      return jsonError("Please enter a valid refund date.", 400);
    }

    if (!isRefundType(refundType)) {
      return jsonError(
        "Please select whether money was received back or sent back.",
        400
      );
    }

    if (!amountPence) {
      return jsonError("Please enter a refund amount greater than £0.00.", 400);
    }

    if (!title) {
      return jsonError("Please enter a refund title.", 400);
    }

    if (body.original_transaction_id && !originalTransactionId) {
      return jsonError("The original transaction ID is invalid.", 400);
    }

    if (body.supplier_id && !supplierId) {
      return jsonError("The supplier ID is invalid.", 400);
    }

    const transactionCheck = await verifyLinkedRecord(
      "money_transactions",
      originalTransactionId
    );

    if (!transactionCheck.exists) {
      return jsonError(
        "The selected original transaction could not be found.",
        400,
        transactionCheck.error,
        "Select another original transaction or save the refund without linking an original transaction."
      );
    }

    const supplierCheck = await verifyLinkedRecord("money_suppliers", supplierId);

    if (!supplierCheck.exists) {
      return jsonError(
        "The selected supplier could not be found.",
        400,
        supplierCheck.error,
        "Select another supplier or save the refund without linking a supplier."
      );
    }

    const now = new Date().toISOString();

    const insertPayload = {
      year,
      refund_date: refundDate,
      refund_type: refundType,
      amount_pence: amountPence,
      title,
      notes,
      original_transaction_id: originalTransactionId,
      supplier_id: supplierId,
      reference_number: referenceNumber,
      status,
      created_by_name: actor.name,
      created_by_email: actor.email,
      updated_by_name: actor.name,
      updated_by_email: actor.email,
      is_hidden: false,
      hidden_at: null,
      hidden_by_name: null,
      hidden_by_email: null,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabaseAdmin
      .from("money_refunds")
      .insert(insertPayload)
      .select(REFUND_SELECT)
      .single();

    if (error || !data) {
      console.error("Failed to create refund:", error);

      return jsonError(
        "The refund could not be saved.",
        500,
        error,
        getLikelyFix(error)
      );
    }

    const [hydratedRefund] = await hydrateRefundLinks([data as RefundRecord]);

    await writeAuditLog({
      actor,
      action: "refund_created",
      refundId: data.id,
      description: `Added refund "${title}" for ${formatMoney(
        amountPence
      )}. Refund type: ${refundType}.`,
      metadata: {
        refund_type: refundType,
        amount_pence: amountPence,
        status,
        original_transaction_id: originalTransactionId,
        supplier_id: supplierId,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Refund added successfully.",
        refund: hydratedRefund ?? data,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected refund POST error:", error);

    return jsonError(
      "An unexpected error occurred while saving the refund.",
      500,
      error,
      getLikelyFix(error)
    );
  }
}

export async function PATCH(request: NextRequest) {
  const actor = await getActor();

  if (!actor) {
    return jsonError(
      "You must be signed in as an admin to update a refund.",
      401,
      undefined,
      "Sign in again using the admin login page and confirm your Supabase admin session is active."
    );
  }

  try {
    const body = (await request.json()) as JsonObject;

    const id = cleanUuid(body.id);

    const action: RefundPatchAction = isPatchAction(body.action)
      ? body.action
      : "update";

    if (!id) {
      return jsonError("A valid refund ID is required.", 400);
    }

    const { data: existingRefund, error: existingError } = await supabaseAdmin
      .from("money_refunds")
      .select(REFUND_SELECT)
      .eq("id", id)
      .maybeSingle();

    if (existingError) {
      console.error("Failed to find refund:", existingError);

      return jsonError(
        "The refund could not be loaded before updating it.",
        500,
        existingError,
        getLikelyFix(existingError)
      );
    }

    if (!existingRefund) {
      return jsonError(
        "The selected refund could not be found.",
        404,
        undefined,
        "Refresh the Refund Tracker. The refund may already have been removed."
      );
    }

    const now = new Date().toISOString();

    const changes: JsonObject = {
      updated_by_name: actor.name,
      updated_by_email: actor.email,
      updated_at: now,
    };

    if (action === "hide") {
      changes.is_hidden = true;
      changes.hidden_at = now;
      changes.hidden_by_name = actor.name;
      changes.hidden_by_email = actor.email;
    }

    if (action === "restore") {
      changes.is_hidden = false;
      changes.hidden_at = null;
      changes.hidden_by_name = null;
      changes.hidden_by_email = null;
    }

    if (action === "cancel") {
      changes.status = "cancelled";
    }

    if (action === "mark_completed") {
      changes.status = "completed";
    }

    if (action === "mark_pending") {
      changes.status = "pending";
    }

    if (action === "update") {
      if (body.year !== undefined) {
        const year = parseYear(body.year);

        if (!year) {
          return jsonError("Please select a valid refund year.", 400);
        }

        changes.year = year;
      }

      if (body.refund_date !== undefined) {
        if (!isValidDate(body.refund_date)) {
          return jsonError("Please enter a valid refund date.", 400);
        }

        changes.refund_date = body.refund_date;
      }

      if (body.refund_type !== undefined) {
        if (!isRefundType(body.refund_type)) {
          return jsonError("The selected refund type is invalid.", 400);
        }

        changes.refund_type = body.refund_type;
      }

      if (body.amount !== undefined || body.amount_pence !== undefined) {
        const amountPence = parseAmountPence(body);

        if (!amountPence) {
          return jsonError(
            "Please enter a refund amount greater than £0.00.",
            400
          );
        }

        changes.amount_pence = amountPence;
      }

      if (body.title !== undefined) {
        const title = cleanText(body.title, 250);

        if (!title) {
          return jsonError("Please enter a refund title.", 400);
        }

        changes.title = title;
      }

      if (body.notes !== undefined) {
        changes.notes = cleanNullableText(body.notes, 4_000);
      }

      if (body.reference_number !== undefined) {
        changes.reference_number = cleanNullableText(
          body.reference_number,
          150
        );
      }

      if (body.status !== undefined) {
        if (!isRefundStatus(body.status)) {
          return jsonError("The selected refund status is invalid.", 400);
        }

        changes.status = body.status;
      }

      if (body.original_transaction_id !== undefined) {
        const originalTransactionId =
          body.original_transaction_id === null ||
          body.original_transaction_id === ""
            ? null
            : cleanUuid(body.original_transaction_id);

        if (body.original_transaction_id && !originalTransactionId) {
          return jsonError("The original transaction ID is invalid.", 400);
        }

        const transactionCheck = await verifyLinkedRecord(
          "money_transactions",
          originalTransactionId
        );

        if (!transactionCheck.exists) {
          return jsonError(
            "The selected original transaction could not be found.",
            400,
            transactionCheck.error,
            "Select another original transaction or remove the linked transaction."
          );
        }

        changes.original_transaction_id = originalTransactionId;
      }

      if (body.supplier_id !== undefined) {
        const supplierId =
          body.supplier_id === null || body.supplier_id === ""
            ? null
            : cleanUuid(body.supplier_id);

        if (body.supplier_id && !supplierId) {
          return jsonError("The supplier ID is invalid.", 400);
        }

        const supplierCheck = await verifyLinkedRecord(
          "money_suppliers",
          supplierId
        );

        if (!supplierCheck.exists) {
          return jsonError(
            "The selected supplier could not be found.",
            400,
            supplierCheck.error,
            "Select another supplier or remove the linked supplier."
          );
        }

        changes.supplier_id = supplierId;
      }
    }

    const { data, error } = await supabaseAdmin
      .from("money_refunds")
      .update(changes)
      .eq("id", id)
      .select(REFUND_SELECT)
      .single();

    if (error || !data) {
      console.error("Failed to update refund:", error);

      return jsonError(
        "The refund could not be updated.",
        500,
        error,
        getLikelyFix(error)
      );
    }

    const [hydratedRefund] = await hydrateRefundLinks([data as RefundRecord]);

    await writeAuditLog({
      actor,
      action: `refund_${action}`,
      refundId: id,
      description: getPatchDescription(
        action,
        existingRefund as RefundRecord,
        changes
      ),
      metadata: {
        action,
        changes,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        action === "hide"
          ? "Refund moved to Deleted Refunds."
          : action === "restore"
            ? "Refund restored successfully."
            : action === "cancel"
              ? "Refund cancelled successfully."
              : action === "mark_completed"
                ? "Refund marked as completed."
                : action === "mark_pending"
                  ? "Refund marked as pending."
                  : "Refund updated successfully.",
      refund: hydratedRefund ?? data,
    });
  } catch (error) {
    console.error("Unexpected refund PATCH error:", error);

    return jsonError(
      "An unexpected error occurred while updating the refund.",
      500,
      error,
      getLikelyFix(error)
    );
  }
}

export async function DELETE(request: NextRequest) {
  const actor = await getActor();

  if (!actor) {
    return jsonError(
      "You must be signed in as an admin to permanently delete a refund.",
      401,
      undefined,
      "Sign in again using the admin login page and confirm your Supabase admin session is active."
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as JsonObject;

    const id = cleanUuid(body.id);
    const confirmation = cleanText(body.confirmation, 20).toUpperCase();

    if (!id) {
      return jsonError("A valid refund ID is required.", 400);
    }

    if (confirmation !== "DELETE") {
      return jsonError(
        'Type DELETE to confirm that this refund should be permanently removed.',
        400
      );
    }

    const { data: existingRefund, error: existingError } = await supabaseAdmin
      .from("money_refunds")
      .select(REFUND_SELECT)
      .eq("id", id)
      .maybeSingle();

    if (existingError) {
      console.error(
        "Failed to load refund before permanent deletion:",
        existingError
      );

      return jsonError(
        "The refund could not be loaded before permanent deletion.",
        500,
        existingError,
        getLikelyFix(existingError)
      );
    }

    if (!existingRefund) {
      return jsonError(
        "The selected refund could not be found.",
        404,
        undefined,
        "Refresh Deleted Refunds. The refund may already have been permanently removed."
      );
    }

    if (!existingRefund.is_hidden) {
      return jsonError(
        "Only refunds already moved to Deleted Refunds can be permanently deleted.",
        400,
        undefined,
        "Move the refund to Deleted Refunds first, then delete it permanently from the deleted-refunds page."
      );
    }

    await writeAuditLog({
      actor,
      action: "refund_permanently_deleted",
      refundId: existingRefund.id,
      description: `Permanently deleted refund "${
        existingRefund.title
      }" for ${formatMoney(existingRefund.amount_pence)}.`,
      metadata: {
        delete_type: "permanent_delete",
        deleted_refund: existingRefund,
      },
    });

    const { error: deleteError } = await supabaseAdmin
      .from("money_refunds")
      .delete()
      .eq("id", id)
      .eq("is_hidden", true);

    if (deleteError) {
      console.error("Failed to permanently delete refund:", deleteError);

      return jsonError(
        "The refund could not be permanently deleted.",
        500,
        deleteError,
        getLikelyFix(deleteError)
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Refund permanently deleted from Supabase. This action cannot be undone.",
      deletedRefundId: id,
    });
  } catch (error) {
    console.error("Unexpected refund DELETE error:", error);

    return jsonError(
      "An unexpected error occurred while permanently deleting the refund.",
      500,
      error,
      getLikelyFix(error)
    );
  }
}