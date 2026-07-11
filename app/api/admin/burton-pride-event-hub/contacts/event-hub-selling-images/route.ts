import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/adminPermissions";
import { createEventAuditLog } from "@/lib/event-hub-app/event-audit";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET_NAME = "event-hub-selling-images";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const AUDIT_ACTION = "business_contact.selling_image_uploaded";
const AUDIT_AREA = "contacts";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

type UploadResponse = {
  ok: boolean;
  error?: string;
  details?: string;
  url?: string;
  path?: string;
  audit_logged?: boolean;
};

type AuditActor = Parameters<typeof createEventAuditLog>[0]["actor"];

type UploadAuditContext = {
  actor: AuditActor;
  request: NextRequest;
  eventId?: string | null;
  eventYear?: number | null;
  contactId?: string | null;
  businessName?: string | null;
  fileName?: string | null;
  filePath?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
};

function jsonResponse(body: UploadResponse, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function nullableText(value: unknown): string | null {
  const valueText = clean(value);
  return valueText ? valueText : null;
}

function toEventYear(value: unknown): number | null {
  const year = Number(value);

  if (!Number.isInteger(year) || year < 2024 || year > 2100) {
    return null;
  }

  return year;
}

function getImageExtension(mimeType: string): string {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };

  return extensions[mimeType] || "jpg";
}

function cleanFileNamePart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    return clean(
      (error as { message?: unknown }).message,
    ).slice(0, 500);
  }

  return "Unknown image-upload error.";
}

function createAuditActor(admin: unknown): AuditActor {
  const row = admin as {
    id?: unknown;
    email?: unknown;
    role?: unknown;
    name?: unknown;
    full_name?: unknown;
  };

  const email = clean(row.email);

  return {
    id: clean(row.id),
    email,
    role: clean(row.role) || "admin",
    name:
      clean(row.name) ||
      clean(row.full_name) ||
      email ||
      "Administrator",
  } as AuditActor;
}

async function checkCurrentAdmin(): Promise<
  | { ok: true; actor: AuditActor }
  | { ok: false; error: string; details: string }
> {
  try {
    /*
     * Use the same central admin resolver as the rest of Event Hub.
     * This avoids incorrectly treating burton_admin_id as a specific
     * admin_users primary-key format.
     */
    const admin = await getCurrentAdmin();

    if (!admin) {
      return {
        ok: false,
        error: "You must be logged in to upload images.",
        details:
          "No active Burton Pride administrator session was found. Sign out, sign back in and try again.",
      };
    }

    const isActive =
      (admin as { is_active?: unknown }).is_active;

    if (isActive === false) {
      return {
        ok: false,
        error: "Your administrator account is inactive.",
        details:
          "Ask a main administrator to reactivate your Event Hub account.",
      };
    }

    return {
      ok: true,
      actor: createAuditActor(admin),
    };
  } catch (error) {
    console.error(
      "Selling-image current-admin check failed:",
      error,
    );

    return {
      ok: false,
      error: "Your administrator session could not be checked.",
      details: safeErrorMessage(error),
    };
  }
}

async function checkSellingImagesBucket() {
  const { data, error } =
    await supabaseAdmin.storage.getBucket(BUCKET_NAME);

  if (error) {
    return {
      ok: false as const,
      error:
        "The selling-images bucket could not be loaded.",
      details: error.message,
    };
  }

  if (!data) {
    return {
      ok: false as const,
      error:
        `The Supabase Storage bucket "${BUCKET_NAME}" does not exist.`,
      details:
        "Create a public bucket called event-hub-selling-images in Supabase Storage.",
    };
  }

  if (!data.public) {
    return {
      ok: false as const,
      error:
        `The Supabase Storage bucket "${BUCKET_NAME}" is private.`,
      details:
        "Open Supabase Storage, select event-hub-selling-images, open its settings and enable Public bucket.",
    };
  }

  return { ok: true as const };
}

async function writeAuditSafely(
  input: Parameters<typeof createEventAuditLog>[0],
): Promise<boolean> {
  try {
    await createEventAuditLog(input);
    return true;
  } catch (error) {
    /*
     * An audit failure must not make a successful upload unusable.
     */
    console.error(
      "Selling-image audit log write failed:",
      error,
    );

    return false;
  }
}

function createAuditMetadata(
  context: UploadAuditContext,
  extra?: Record<string, unknown>,
) {
  return {
    source: "event_hub_selling_images_api",
    bucket: BUCKET_NAME,
    event_year: context.eventYear ?? null,
    contact_id:
      nullableText(context.contactId) || null,
    business_name:
      nullableText(context.businessName) || null,
    original_file_name:
      nullableText(context.fileName) || null,
    storage_path:
      nullableText(context.filePath) || null,
    mime_type:
      nullableText(context.mimeType) || null,
    size_bytes:
      typeof context.fileSize === "number"
        ? context.fileSize
        : null,
    ...extra,
  };
}

async function auditRejectedUpload(
  context: UploadAuditContext,
  reason: string,
  responseStatus: number,
): Promise<boolean> {
  return writeAuditSafely({
    actor: context.actor,
    eventId:
      nullableText(context.eventId) || null,
    action: AUDIT_ACTION,
    actionLabel: "Selling image upload rejected",
    area: AUDIT_AREA,
    status: "blocked",
    riskLevel: "medium",
    record: {
      type:
        "event_business_contact_selling_image",
      id:
        nullableText(context.contactId) ||
        nullableText(context.filePath) ||
        "upload",
      title:
        nullableText(context.businessName) ||
        nullableText(context.fileName) ||
        "Selling image upload",
    },
    reason,
    metadata: createAuditMetadata(context, {
      rejected: true,
      rejection_reason: reason,
    }),
    request: context.request,
    responseStatus,
  });
}

async function auditFailedUpload(
  context: UploadAuditContext,
  error: unknown,
  responseStatus: number,
): Promise<boolean> {
  return writeAuditSafely({
    actor: context.actor,
    eventId:
      nullableText(context.eventId) || null,
    action: AUDIT_ACTION,
    actionLabel: "Selling image upload failed",
    area: AUDIT_AREA,
    status: "failed",
    riskLevel: "medium",
    record: {
      type:
        "event_business_contact_selling_image",
      id:
        nullableText(context.contactId) ||
        nullableText(context.filePath) ||
        "upload",
      title:
        nullableText(context.businessName) ||
        nullableText(context.fileName) ||
        "Selling image upload",
    },
    metadata: createAuditMetadata(context, {
      upload_failed: true,
      error_message: safeErrorMessage(error),
    }),
    request: context.request,
    responseStatus,
  });
}

async function auditSuccessfulUpload(
  context: UploadAuditContext,
): Promise<boolean> {
  return writeAuditSafely({
    actor: context.actor,
    eventId:
      nullableText(context.eventId) || null,
    action: AUDIT_ACTION,
    actionLabel: "Selling image uploaded",
    area: AUDIT_AREA,
    status: "success",
    riskLevel: "low",
    record: {
      type:
        "event_business_contact_selling_image",
      id:
        nullableText(context.filePath) ||
        nullableText(context.contactId) ||
        "upload",
      title:
        nullableText(context.businessName) ||
        nullableText(context.fileName) ||
        "Selling image",
    },
    before: null,
    after: {
      bucket: BUCKET_NAME,
      path: nullableText(context.filePath),
      mime_type: nullableText(context.mimeType),
      size_bytes: context.fileSize ?? null,
      contact_id:
        nullableText(context.contactId) || null,
    },
    metadata: createAuditMetadata(context, {
      upload_completed: true,
    }),
    request: context.request,
    responseStatus: 201,
  });
}

export async function POST(request: NextRequest) {
  let actor: AuditActor | null = null;

  let eventId: string | null = null;
  let eventYear: number | null = null;
  let contactId: string | null = null;
  let businessName: string | null = null;

  let fileName: string | null = null;
  let filePath: string | null = null;
  let mimeType: string | null = null;
  let fileSize: number | null = null;

  try {
    const adminCheck = await checkCurrentAdmin();

    if (!adminCheck.ok) {
      return jsonResponse(
        {
          ok: false,
          error: adminCheck.error,
          details: adminCheck.details,
        },
        401,
      );
    }

    actor = adminCheck.actor;

    const bucketCheck =
      await checkSellingImagesBucket();

    if (!bucketCheck.ok) {
      await auditFailedUpload(
        {
          actor,
          request,
        },
        new Error(bucketCheck.details),
        500,
      );

      return jsonResponse(
        {
          ok: false,
          error: bucketCheck.error,
          details: bucketCheck.details,
        },
        500,
      );
    }

    let formData: FormData;

    try {
      formData = await request.formData();
    } catch (error) {
      const details =
        error instanceof Error
          ? error.message
          : "The browser did not send valid multipart/form-data.";

      await auditRejectedUpload(
        {
          actor,
          request,
        },
        details,
        400,
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "The image upload request could not be read.",
          details,
        },
        400,
      );
    }

    eventId = nullableText(
      formData.get("event_id"),
    );

    eventYear = toEventYear(
      formData.get("event_year"),
    );

    contactId = nullableText(
      formData.get("contact_id"),
    );

    businessName = nullableText(
      formData.get("business_name"),
    );

    const uploadedFile = formData.get("file");

    if (
      !uploadedFile ||
      typeof uploadedFile === "string"
    ) {
      await auditRejectedUpload(
        {
          actor,
          request,
          eventId,
          eventYear,
          contactId,
          businessName,
        },
        "The request did not contain a file field called 'file'.",
        400,
      );

      return jsonResponse(
        {
          ok: false,
          error: "No image file was uploaded.",
          details:
            "The API route was reached, but the request did not contain a file field called 'file'.",
        },
        400,
      );
    }

    const file = uploadedFile as File;

    fileName = file.name;
    mimeType = file.type;
    fileSize = file.size;

    const auditContext: UploadAuditContext = {
      actor,
      request,
      eventId,
      eventYear,
      contactId,
      businessName,
      fileName,
      filePath,
      mimeType,
      fileSize,
    };

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      const reason =
        `Unsupported file type: ${
          file.type || "unknown"
        }.`;

      await auditRejectedUpload(
        auditContext,
        reason,
        400,
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Only JPG, PNG, WEBP or GIF images are allowed.",
          details: reason,
        },
        400,
      );
    }

    if (file.size <= 0) {
      const reason =
        "The selected image file was empty.";

      await auditRejectedUpload(
        auditContext,
        reason,
        400,
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "The selected image file is empty.",
          details:
            "Choose a valid image and try again.",
        },
        400,
      );
    }

    if (file.size > MAX_IMAGE_SIZE) {
      const fileSizeMb = (
        file.size /
        1024 /
        1024
      ).toFixed(2);

      const reason =
        `The selected file was ${fileSizeMb}MB, which exceeds the 5MB limit.`;

      await auditRejectedUpload(
        auditContext,
        reason,
        413,
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Image must be smaller than 5MB.",
          details: reason,
        },
        413,
      );
    }

    const fileExtension =
      getImageExtension(file.type);

    const safeOriginalName =
      cleanFileNamePart(
        file.name.replace(/\.[^/.]+$/, ""),
      );

    const storageYear =
      eventYear || new Date().getFullYear();

    filePath =
      `contacts/${storageYear}/` +
      `${safeOriginalName || "selling-image"}-` +
      `${randomUUID()}.${fileExtension}`;

    auditContext.filePath = filePath;

    const arrayBuffer =
      await file.arrayBuffer();

    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } =
      await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(filePath, buffer, {
          contentType: file.type,
          cacheControl: "3600",
          upsert: false,
        });

    if (uploadError) {
      await auditFailedUpload(
        auditContext,
        uploadError,
        500,
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Failed to upload image to Supabase Storage.",
          details: uploadError.message,
        },
        500,
      );
    }

    const { data: publicUrlData } =
      supabaseAdmin.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

    const publicUrl =
      clean(publicUrlData?.publicUrl);

    if (!publicUrl) {
      const { error: cleanupError } =
        await supabaseAdmin.storage
          .from(BUCKET_NAME)
          .remove([filePath]);

      if (cleanupError) {
        console.error(
          "Failed to clean up selling image:",
          cleanupError,
        );
      }

      const publicUrlError = new Error(
        "Supabase did not return a public URL after the image was uploaded.",
      );

      await auditFailedUpload(
        auditContext,
        publicUrlError,
        500,
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Image uploaded, but no public URL was returned.",
          details:
            "Check that event-hub-selling-images exists and is configured as a public bucket.",
        },
        500,
      );
    }

    /*
     * Do not perform a server-side HEAD request against the public URL.
     * Some storage/CDN configurations reject HEAD even though the image
     * loads correctly in a browser. That previously caused valid uploads
     * to be deleted and reported as failed.
     */

    const auditLogged =
      await auditSuccessfulUpload(
        auditContext,
      );

    return jsonResponse(
      {
        ok: true,
        url: publicUrl,
        path: filePath,
        audit_logged: auditLogged,
      },
      201,
    );
  } catch (error) {
    if (actor) {
      await auditFailedUpload(
        {
          actor,
          request,
          eventId,
          eventYear,
          contactId,
          businessName,
          fileName,
          filePath,
          mimeType,
          fileSize,
        },
        error,
        500,
      );
    }

    return jsonResponse(
      {
        ok: false,
        error:
          "Something went wrong while uploading the image.",
        details: safeErrorMessage(error),
      },
      500,
    );
  }
}
