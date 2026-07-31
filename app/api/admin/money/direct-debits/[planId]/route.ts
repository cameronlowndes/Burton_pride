import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PLANS_TABLE = "money_direct_debit_plans";
const OCCURRENCES_TABLE = "money_direct_debit_occurrences";
const STORAGE_BUCKET = "money-invoices";

const MAX_REPAYMENT_IMAGE_SIZE = 8 * 1024 * 1024;

const ALLOWED_REPAYMENT_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

type RouteContext = {
  params: Promise<{
    planId: string;
  }>;
};

type JsonRecord = Record<string, unknown>;

type ParsedRequestBody = {
  body: JsonRecord;
  repaymentImage: File | null;
  removeRepaymentImage: boolean;
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
    value === "on" ||
    value === "yes"
  );
}

function asNullableBoolean(value: unknown): boolean | null {
  if (
    value === true ||
    value === "true" ||
    value === 1 ||
    value === "1" ||
    value === "on" ||
    value === "yes"
  ) {
    return true;
  }

  if (
    value === false ||
    value === "false" ||
    value === 0 ||
    value === "0" ||
    value === "off" ||
    value === "no"
  ) {
    return false;
  }

  return null;
}

function formDataToRecord(formData: FormData): JsonRecord {
  const result: JsonRecord = {};

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      continue;
    }

    result[key] = value;
  }

  return result;
}

async function parseRequestBody(
  request: NextRequest,
): Promise<ParsedRequestBody> {
  const contentType = cleanText(
    request.headers.get("content-type"),
  ).toLowerCase();

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();

    const possibleFile =
      formData.get("repayment_image") ??
      formData.get("repaymentImage") ??
      formData.get("file") ??
      formData.get("image");

    const repaymentImage =
      possibleFile instanceof File &&
      possibleFile.size > 0
        ? possibleFile
        : null;

    const removeRepaymentImage =
      asBoolean(formData.get("remove_repayment_image")) ||
      asBoolean(formData.get("removeRepaymentImage"));

    return {
      body: formDataToRecord(formData),
      repaymentImage,
      removeRepaymentImage,
    };
  }

  try {
    const parsed = await request.json();

    const body = isRecord(parsed) ? parsed : {};

    return {
      body,
      repaymentImage: null,
      removeRepaymentImage:
        asBoolean(body.remove_repayment_image) ||
        asBoolean(body.removeRepaymentImage),
    };
  } catch {
    return {
      body: {},
      repaymentImage: null,
      removeRepaymentImage: false,
    };
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

  if (
    code === "PGRST204" ||
    code === "PGRST205" ||
    code === "42703"
  ) {
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
        (code === "PGRST204" || code === "42703"
          ? "Check that all required Direct Debit columns exist, then reload the Supabase schema cache."
          : code === "PGRST205"
            ? `Check that ${PLANS_TABLE} and ${OCCURRENCES_TABLE} exist, then reload the Supabase schema cache.`
            : null),
      endpoint: "/api/admin/money/direct-debits/[planId]",
    },
    resolvedStatus,
  );
}

function getAdminId(request: NextRequest): string | null {
  const adminId = cleanText(
    request.cookies.get("burton_admin_id")?.value ||
      request.headers.get("x-admin-id"),
  );

  return isUuid(adminId) ? adminId : null;
}

function safeFileExtension(file: File): string {
  const extensionByType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };

  const extensionFromName = file.name
    .split(".")
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  return (
    extensionByType[file.type] ||
    extensionFromName ||
    "jpg"
  );
}

function storagePathFromPublicUrl(
  publicUrl: string | null,
): string | null {
  if (!publicUrl) {
    return null;
  }

  const marker =
    `/storage/v1/object/public/${STORAGE_BUCKET}/`;

  const markerIndex = publicUrl.indexOf(marker);

  if (markerIndex === -1) {
    return null;
  }

  const encodedPath = publicUrl.slice(
    markerIndex + marker.length,
  );

  if (!encodedPath) {
    return null;
  }

  try {
    return decodeURIComponent(encodedPath);
  } catch {
    return encodedPath;
  }
}

async function removeStorageFile(
  storagePath: string | null,
): Promise<void> {
  if (!storagePath) {
    return;
  }

  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .remove([storagePath]);

  if (error) {
    console.warn("Direct Debit image removal failed", {
      bucket: STORAGE_BUCKET,
      storagePath,
      error,
    });
  }
}

async function uploadRepaymentImage(args: {
  planId: string;
  file: File;
}): Promise<{
  publicUrl: string;
  storagePath: string;
  originalName: string;
  mimeType: string;
  size: number;
}> {
  const { planId, file } = args;

  if (!ALLOWED_REPAYMENT_IMAGE_TYPES.has(file.type)) {
    throw Object.assign(
      new Error(
        "The repayment picture must be a JPG, PNG, WEBP or GIF image.",
      ),
      {
        apiCode: "INVALID_REPAYMENT_IMAGE_TYPE",
        statusCode: 415,
      },
    );
  }

  if (file.size <= 0) {
    throw Object.assign(
      new Error("The selected repayment picture is empty."),
      {
        apiCode: "EMPTY_REPAYMENT_IMAGE",
        statusCode: 400,
      },
    );
  }

  if (file.size > MAX_REPAYMENT_IMAGE_SIZE) {
    throw Object.assign(
      new Error(
        "The repayment picture must be 8MB or smaller.",
      ),
      {
        apiCode: "REPAYMENT_IMAGE_TOO_LARGE",
        statusCode: 413,
      },
    );
  }

  const extension = safeFileExtension(file);
  const uniqueName = `${crypto.randomUUID()}.${extension}`;

  const storagePath =
    `direct-debits/${planId}/repayment-images/${uniqueName}`;

  const fileBuffer = Buffer.from(
    await file.arrayBuffer(),
  );

  const { error: uploadError } =
    await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

  if (uploadError) {
    throw Object.assign(
      new Error(
        uploadError.message ||
          "The repayment picture could not be uploaded.",
      ),
      {
        apiCode: "REPAYMENT_IMAGE_UPLOAD_FAILED",
        statusCode: 500,
        supabaseError: uploadError,
      },
    );
  }

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath);

  return {
    publicUrl,
    storagePath,
    originalName: file.name,
    mimeType: file.type,
    size: file.size,
  };
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
    return dbError(
      error,
      "The Direct Debit could not be loaded.",
    );
  }

  if (!data) {
    return json(
      {
        success: false,
        error:
          "The Direct Debit plan could not be found.",
        code: "DIRECT_DEBIT_NOT_FOUND",
      },
      404,
    );
  }

  return json({
    success: true,
    plan: data,
    endpoint:
      "/api/admin/money/direct-debits/[planId]",
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

  const {
    body,
    repaymentImage,
    removeRepaymentImage,
  } = await parseRequestBody(request);

  const action = cleanText(body.action);

  const { data: existing, error: existingError } =
    await supabaseAdmin
      .from(PLANS_TABLE)
      .select("*")
      .eq("id", planId)
      .maybeSingle();

  if (existingError) {
    return dbError(
      existingError,
      "The Direct Debit could not be checked.",
    );
  }

  if (!existing) {
    return json(
      {
        success: false,
        error:
          "The Direct Debit plan could not be found.",
        code: "DIRECT_DEBIT_NOT_FOUND",
      },
      404,
    );
  }

  if (
    existing.status === "cancelled" ||
    existing.status === "completed"
  ) {
    return json(
      {
        success: false,
        error:
          "Cancelled or completed Direct Debits cannot be edited.",
        code: "DIRECT_DEBIT_READ_ONLY",
      },
      409,
    );
  }

  const now = new Date().toISOString();

  if (action === "edit_plan") {
    const title = cleanText(body.title);
    const amountPence = Number(body.amount_pence);
    const accountSource = cleanText(
      body.account_source,
    );
    const accountHolder = cleanText(
      body.account_holder,
    );

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

    if (
      !Number.isInteger(amountPence) ||
      amountPence <= 0
    ) {
      return json(
        {
          success: false,
          error:
            "The monthly amount must be greater than zero.",
          code: "INVALID_AMOUNT",
        },
        400,
      );
    }

    if (
      !["organisation", "personal"].includes(
        accountSource,
      )
    ) {
      return json(
        {
          success: false,
          error: "Choose a valid paying account.",
          code: "INVALID_ACCOUNT_SOURCE",
        },
        400,
      );
    }

    if (
      accountSource === "personal" &&
      !accountHolder
    ) {
      return json(
        {
          success: false,
          error:
            "Enter the person whose account pays this Direct Debit.",
          code: "ACCOUNT_HOLDER_REQUIRED",
        },
        400,
      );
    }

    const autoReimbursePerson =
      accountSource === "personal" &&
      asBoolean(body.auto_reimburse_person);

    const reimbursementPaymentMethod =
      autoReimbursePerson
        ? cleanText(
            body.reimbursement_payment_method,
          ) || "Bank Transfer"
        : null;

    const imageAltText =
      cleanText(
        body.repayment_image_alt_text ||
          body.repaymentImageAltText,
      ) ||
      `Repayment picture for ${title}`;

    let uploadedImage:
      | Awaited<
          ReturnType<typeof uploadRepaymentImage>
        >
      | null = null;

    try {
      if (repaymentImage) {
        uploadedImage = await uploadRepaymentImage({
          planId,
          file: repaymentImage,
        });
      }
    } catch (error) {
      const statusCode =
        isRecord(error) &&
        typeof error.statusCode === "number"
          ? error.statusCode
          : 500;

      return json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "The repayment picture could not be uploaded.",
          message:
            "The Direct Debit was not changed because its repayment picture could not be uploaded.",
          code:
            isRecord(error) &&
            typeof error.apiCode === "string"
              ? error.apiCode
              : "REPAYMENT_IMAGE_UPLOAD_FAILED",
        },
        statusCode,
      );
    }

    const planUpdate: JsonRecord = {
      title,
      description:
        cleanText(body.description) || null,
      amount_pence: amountPence,
      account_source: accountSource,
      account_holder:
        accountSource === "personal"
          ? accountHolder
          : null,
      supplier_name:
        cleanText(body.supplier_name) || null,
      budget_category_key:
        cleanText(body.budget_category_key) || null,
      budget_category_label:
        cleanText(body.budget_category_label) || null,
      mandate_reference:
        cleanText(body.mandate_reference) || null,
      notes: cleanText(body.notes) || null,

      auto_reimburse_person: autoReimbursePerson,
      reimbursement_payment_method:
        reimbursementPaymentMethod,

      updated_at: now,
    };

    if (uploadedImage) {
      planUpdate.repayment_image_url =
        uploadedImage.publicUrl;
      planUpdate.repayment_image_path =
        uploadedImage.storagePath;
      planUpdate.repayment_image_name =
        uploadedImage.originalName;
      planUpdate.repayment_image_type =
        uploadedImage.mimeType;
      planUpdate.repayment_image_size =
        uploadedImage.size;
      planUpdate.repayment_image_alt_text =
        imageAltText;
      planUpdate.repayment_image_uploaded_at = now;
      planUpdate.repayment_image_uploaded_by =
        getAdminId(request);
    } else if (removeRepaymentImage) {
      planUpdate.repayment_image_url = null;
      planUpdate.repayment_image_path = null;
      planUpdate.repayment_image_name = null;
      planUpdate.repayment_image_type = null;
      planUpdate.repayment_image_size = null;
      planUpdate.repayment_image_alt_text = null;
      planUpdate.repayment_image_uploaded_at = null;
      planUpdate.repayment_image_uploaded_by = null;
    }

    const { data: updatedPlan, error: updateError } =
      await supabaseAdmin
        .from(PLANS_TABLE)
        .update(planUpdate)
        .eq("id", planId)
        .select("*")
        .single();

    if (updateError) {
      if (uploadedImage) {
        await removeStorageFile(
          uploadedImage.storagePath,
        );
      }

      return dbError(
        updateError,
        "The Direct Debit could not be updated.",
      );
    }

    const oldImagePath =
      cleanText(existing.repayment_image_path) ||
      storagePathFromPublicUrl(
        cleanText(existing.repayment_image_url) ||
          null,
      );

    if (
      uploadedImage &&
      oldImagePath &&
      oldImagePath !== uploadedImage.storagePath
    ) {
      await removeStorageFile(oldImagePath);
    }

    if (removeRepaymentImage && oldImagePath) {
      await removeStorageFile(oldImagePath);
    }

    const shouldUpdateFutureOccurrences =
      asNullableBoolean(
        body.update_future_scheduled_occurrences,
      ) !== false;

    if (shouldUpdateFutureOccurrences) {
      const reimbursementStatus =
        accountSource === "personal"
          ? "awaiting_reimbursement"
          : "not_required";

      const { error: occurrenceError } =
        await supabaseAdmin
          .from(OCCURRENCES_TABLE)
          .update({
            amount_pence: amountPence,
            reimbursement_status:
              reimbursementStatus,
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

    const {
      data: reloadedPlan,
      error: reloadError,
    } = await loadPlan(planId);

    if (reloadError) {
      return dbError(
        reloadError,
        "The Direct Debit was updated, but the saved plan could not be reloaded.",
        500,
      );
    }

    let message =
      autoReimbursePerson
        ? "The Direct Debit and future scheduled payments were updated. Automatic repayment is enabled."
        : "The Direct Debit and future scheduled payments were updated.";

    if (uploadedImage) {
      message +=
        " The repayment picture was uploaded successfully.";
    }

    if (removeRepaymentImage) {
      message +=
        " The repayment picture was removed.";
    }

    return json({
      success: true,
      message,
      plan: reloadedPlan || updatedPlan,
      repayment_image: uploadedImage
        ? {
            url: uploadedImage.publicUrl,
            path: uploadedImage.storagePath,
            name: uploadedImage.originalName,
            type: uploadedImage.mimeType,
            size: uploadedImage.size,
            alt_text: imageAltText,
            uploaded_at: now,
          }
        : removeRepaymentImage
          ? null
          : {
              url:
                updatedPlan.repayment_image_url ||
                null,
              path:
                updatedPlan.repayment_image_path ||
                null,
              name:
                updatedPlan.repayment_image_name ||
                null,
            },
      saved_settings: {
        auto_reimburse_person:
          autoReimbursePerson,
        reimbursement_payment_method:
          reimbursementPaymentMethod,
      },
      endpoint:
        "/api/admin/money/direct-debits/[planId]",
    });
  }

  const requestedStatus = cleanText(body.status);

  if (
    requestedStatus &&
    ["active", "paused"].includes(requestedStatus)
  ) {
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
      endpoint:
        "/api/admin/money/direct-debits/[planId]",
    });
  }

  return json(
    {
      success: false,
      error:
        "No supported Direct Debit update was supplied.",
      code: "NO_SUPPORTED_UPDATE",
      endpoint:
        "/api/admin/money/direct-debits/[planId]",
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

  const { body } = await parseRequestBody(request);
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

  const { data: existing, error: existingError } =
    await supabaseAdmin
      .from(PLANS_TABLE)
      .select("id,status")
      .eq("id", planId)
      .maybeSingle();

  if (existingError) {
    return dbError(
      existingError,
      "The Direct Debit could not be checked.",
    );
  }

  if (!existing) {
    return json(
      {
        success: false,
        error:
          "The Direct Debit plan could not be found.",
        code: "DIRECT_DEBIT_NOT_FOUND",
      },
      404,
    );
  }

  if (existing.status === "cancelled") {
    return json({
      success: true,
      message:
        "The Direct Debit was already cancelled.",
      already_cancelled: true,
      endpoint:
        "/api/admin/money/direct-debits/[planId]",
    });
  }

  const { error: occurrenceError } =
    await supabaseAdmin
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
    return dbError(
      error,
      "The Direct Debit could not be cancelled.",
    );
  }

  return json({
    success: true,
    message:
      "Future payments were cancelled. Posted and paid history was retained.",
    plan: data,
    endpoint:
      "/api/admin/money/direct-debits/[planId]",
  });
}

export async function POST() {
  return json(
    {
      success: false,
      error: "Method not allowed.",
      message:
        "Use GET, PATCH or DELETE for this Direct Debit plan.",
      code: "METHOD_NOT_ALLOWED",
      endpoint:
        "/api/admin/money/direct-debits/[planId]",
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