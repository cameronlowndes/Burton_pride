import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLANS_TABLE = "money_direct_debit_plans";
const STORAGE_BUCKET = "money-invoices";

const MAX_FILE_SIZE = 8 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set([
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

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isRecord(value: unknown): value is JsonRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getAdminIdentity(request: NextRequest): AdminIdentity {
  return {
    id:
      request.cookies.get("burton_admin_id")?.value?.trim() ||
      null,
    name:
      request.cookies.get("burton_admin_name")?.value?.trim() ||
      request.headers.get("x-admin-name")?.trim() ||
      null,
    email:
      request.cookies
        .get("burton_admin_email")
        ?.value?.trim() ||
      request.headers.get("x-admin-email")?.trim() ||
      null,
    role:
      request.cookies.get("burton_admin_role")?.value?.trim() ||
      request.headers.get("x-admin-role")?.trim() ||
      null,
  };
}

function safeExtension(file: File): string {
  const extensionFromName = file.name
    .split(".")
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  const extensionByType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };

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

  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
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

async function removeStoredImage(
  publicUrl: string | null,
): Promise<void> {
  const storagePath = storagePathFromPublicUrl(publicUrl);

  if (!storagePath) {
    return;
  }

  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .remove([storagePath]);

  if (error) {
    console.warn("Could not remove previous repayment image", {
      storagePath,
      error,
    });
  }
}

async function ensurePlanExists(planId: string): Promise<JsonRecord> {
  const { data, error } = await supabaseAdmin
    .from(PLANS_TABLE)
    .select(
      [
        "id",
        "name",
        "repayment_image_url",
        "repayment_image_path",
        "repayment_image_name",
      ].join(","),
    )
    .eq("id", planId)
    .maybeSingle();

  if (error) {
    throw Object.assign(
      new Error("The direct-debit plan could not be loaded."),
      {
        apiCode: "PLAN_LOOKUP_FAILED",
        statusCode: 500,
        supabaseError: error,
      },
    );
  }

  if (!isRecord(data)) {
    throw Object.assign(
      new Error("The direct-debit plan was not found."),
      {
        apiCode: "PLAN_NOT_FOUND",
        statusCode: 404,
      },
    );
  }

  return data;
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  const { planId } = await context.params;
  const admin = getAdminIdentity(request);

  if (!isUuid(planId)) {
    return json(
      {
        ok: false,
        error: "INVALID_PLAN_ID",
        message:
          "The direct-debit plan ID is not a valid UUID.",
        field: "planId",
      },
      400,
    );
  }

  let uploadedStoragePath: string | null = null;

  try {
    const plan = await ensurePlanExists(planId);

    const contentType =
      request.headers.get("content-type") || "";

    if (
      !contentType
        .toLowerCase()
        .includes("multipart/form-data")
    ) {
      return json(
        {
          ok: false,
          error: "INVALID_CONTENT_TYPE",
          message:
            "The repayment image must be uploaded using multipart/form-data.",
          expectedContentType: "multipart/form-data",
        },
        415,
      );
    }

    const formData = await request.formData();

    const fileEntry =
      formData.get("file") || formData.get("image");

    const altTextEntry =
      formData.get("altText") ||
      formData.get("alt_text") ||
      formData.get("description");

    if (!(fileEntry instanceof File)) {
      return json(
        {
          ok: false,
          error: "IMAGE_REQUIRED",
          message:
            "Select an image before uploading.",
          field: "file",
        },
        400,
      );
    }

    const file = fileEntry;

    if (file.size <= 0) {
      return json(
        {
          ok: false,
          error: "EMPTY_IMAGE",
          message:
            "The selected repayment image is empty.",
          field: "file",
        },
        400,
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return json(
        {
          ok: false,
          error: "IMAGE_TOO_LARGE",
          message:
            "The repayment image must be 8MB or smaller.",
          field: "file",
          maximumBytes: MAX_FILE_SIZE,
          receivedBytes: file.size,
        },
        413,
      );
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return json(
        {
          ok: false,
          error: "UNSUPPORTED_IMAGE_TYPE",
          message:
            "The image must be a JPEG, PNG, WEBP or GIF file.",
          field: "file",
          receivedType: file.type || "unknown",
          allowedTypes: Array.from(ALLOWED_IMAGE_TYPES),
        },
        415,
      );
    }

    const fileExtension = safeExtension(file);
    const uniqueName = `${crypto.randomUUID()}.${fileExtension}`;

    uploadedStoragePath = `direct-debits/${planId}/repayment/${uniqueName}`;

    const bytes = await file.arrayBuffer();

    const { error: uploadError } =
      await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .upload(
          uploadedStoragePath,
          Buffer.from(bytes),
          {
            contentType: file.type,
            cacheControl: "3600",
            upsert: false,
          },
        );

    if (uploadError) {
      console.error("Repayment image upload failed", {
        planId,
        storagePath: uploadedStoragePath,
        error: uploadError,
      });

      return json(
        {
          ok: false,
          error: "IMAGE_UPLOAD_FAILED",
          message:
            "The repayment image could not be uploaded.",
          code: uploadError.name,
          reason: uploadError.message,
        },
        500,
      );
    }

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(uploadedStoragePath);

    const altText =
      typeof altTextEntry === "string"
        ? altTextEntry.trim().slice(0, 500)
        : "";

    const now = new Date().toISOString();

    const updatePayload = {
      repayment_image_url: publicUrl,
      repayment_image_path: uploadedStoragePath,
      repayment_image_name: file.name,
      repayment_image_type: file.type,
      repayment_image_size: file.size,
      repayment_image_alt_text: altText || null,
      repayment_image_uploaded_at: now,
      repayment_image_uploaded_by: admin.id,
      updated_at: now,
    };

    const { data: updatedPlan, error: updateError } =
      await supabaseAdmin
        .from(PLANS_TABLE)
        .update(updatePayload)
        .eq("id", planId)
        .select("*")
        .single();

    if (updateError) {
      await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .remove([uploadedStoragePath]);

      uploadedStoragePath = null;

      console.error(
        "Repayment image plan update failed",
        {
          planId,
          error: updateError,
        },
      );

      return json(
        {
          ok: false,
          error: "PLAN_UPDATE_FAILED",
          message:
            "The image uploaded, but it could not be connected to the direct-debit plan.",
          code: updateError.code,
          details: updateError.details,
          hint: updateError.hint,
          reason: updateError.message,
        },
        500,
      );
    }

    const oldImageUrl =
      typeof plan.repayment_image_url === "string"
        ? plan.repayment_image_url
        : null;

    if (oldImageUrl && oldImageUrl !== publicUrl) {
      await removeStoredImage(oldImageUrl);
    }

    return json(
      {
        ok: true,
        message:
          "The repayment image was uploaded successfully.",
        planId,
        image: {
          url: publicUrl,
          path: uploadedStoragePath,
          name: file.name,
          type: file.type,
          size: file.size,
          altText: altText || null,
          uploadedAt: now,
        },
        plan: updatedPlan,
      },
      200,
    );
  } catch (error) {
    if (uploadedStoragePath) {
      await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .remove([uploadedStoragePath]);
    }

    const details =
      isRecord(error) && isRecord(error.supabaseError)
        ? error.supabaseError
        : null;

    const statusCode =
      isRecord(error) &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : 500;

    const apiCode =
      isRecord(error) &&
      typeof error.apiCode === "string"
        ? error.apiCode
        : "REPAYMENT_IMAGE_UPLOAD_FAILED";

    const message =
      error instanceof Error
        ? error.message
        : "The repayment image could not be uploaded.";

    console.error("Repayment image API failed", {
      planId,
      error,
    });

    return json(
      {
        ok: false,
        error: apiCode,
        message,
        code:
          details &&
          typeof details.code === "string"
            ? details.code
            : null,
        details:
          details &&
          typeof details.details === "string"
            ? details.details
            : null,
        hint:
          details &&
          typeof details.hint === "string"
            ? details.hint
            : null,
      },
      statusCode,
    );
  }
}

/**
 * DELETE
 *
 * Removes the repayment image from the plan and Storage.
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext,
) {
  const { planId } = await context.params;

  if (!isUuid(planId)) {
    return json(
      {
        ok: false,
        error: "INVALID_PLAN_ID",
        message:
          "The direct-debit plan ID is not a valid UUID.",
        field: "planId",
      },
      400,
    );
  }

  try {
    const plan = await ensurePlanExists(planId);

    const oldImageUrl =
      typeof plan.repayment_image_url === "string"
        ? plan.repayment_image_url
        : null;

    const now = new Date().toISOString();

    const { data: updatedPlan, error: updateError } =
      await supabaseAdmin
        .from(PLANS_TABLE)
        .update({
          repayment_image_url: null,
          repayment_image_path: null,
          repayment_image_name: null,
          repayment_image_type: null,
          repayment_image_size: null,
          repayment_image_alt_text: null,
          repayment_image_uploaded_at: null,
          repayment_image_uploaded_by: null,
          updated_at: now,
        })
        .eq("id", planId)
        .select("*")
        .single();

    if (updateError) {
      return json(
        {
          ok: false,
          error: "IMAGE_REMOVAL_FAILED",
          message:
            "The repayment image could not be removed from the direct-debit plan.",
          code: updateError.code,
          details: updateError.details,
          hint: updateError.hint,
          reason: updateError.message,
        },
        500,
      );
    }

    await removeStoredImage(oldImageUrl);

    return json({
      ok: true,
      message:
        "The repayment image was removed successfully.",
      planId,
      plan: updatedPlan,
    });
  } catch (error) {
    const statusCode =
      isRecord(error) &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : 500;

    return json(
      {
        ok: false,
        error:
          isRecord(error) &&
          typeof error.apiCode === "string"
            ? error.apiCode
            : "IMAGE_REMOVAL_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "The repayment image could not be removed.",
      },
      statusCode,
    );
  }
}