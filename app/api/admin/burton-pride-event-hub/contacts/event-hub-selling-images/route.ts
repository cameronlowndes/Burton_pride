import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { createEventAuditLog } from "@/lib/event-hub-app/event-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET_NAME = "event-hub-selling-images";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const AUDIT_ACTION = "business_contact.selling_image_uploaded";
const AUDIT_AREA = "contacts";

type UploadResponse = {
  ok: boolean;
  error?: string;
  details?: string;
  url?: string;
  path?: string;
  audit_logged?: boolean;
};

type AdminUserRow = {
  id: string;
  email: string | null;
  role: string | null;
  is_active: boolean | null;
};

type AuditActor = Parameters<
  typeof createEventAuditLog
>[0]["actor"];

type AdminCheckResult =
  | {
      ok: true;
      actor: AuditActor;
    }
  | {
      ok: false;
      error: string;
      details: string;
    };

type UploadAuditContext = {
  actor: AuditActor;
  request: NextRequest;
  eventId?: string | null;
  contactId?: string | null;
  businessName?: string | null;
  fileName?: string | null;
  filePath?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
};

function jsonResponse(
  body: UploadResponse,
  status = 200,
) {
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
  const text = clean(value);
  return text.length > 0 ? text : null;
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

function createAuditActor(
  admin: AdminUserRow,
): AuditActor {
  /*
   * Your audit actor currently uses id, email, role and name.
   * The name falls back to the administrator's email because the
   * existing admin_users query does not require a name column.
   */
  return {
    id: clean(admin.id),
    email: clean(admin.email),
    role: clean(admin.role) || "admin",
    name: clean(admin.email) || "Administrator",
  } as AuditActor;
}

async function findActiveAdminById(
  adminId: string,
): Promise<AdminUserRow | null> {
  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("id,email,role,is_active")
    .eq("id", adminId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error(
      "Selling-image admin lookup by ID failed:",
      error,
    );

    return null;
  }

  return data as AdminUserRow | null;
}

async function findActiveAdminByEmail(
  adminEmail: string,
): Promise<AdminUserRow | null> {
  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("id,email,role,is_active")
    .ilike("email", adminEmail)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error(
      "Selling-image admin lookup by email failed:",
      error,
    );

    return null;
  }

  return data as AdminUserRow | null;
}

async function checkAdminCookie(
  request: NextRequest,
): Promise<AdminCheckResult> {
  /*
   * Never JSON.parse these cookie values.
   *
   * They are plain cookie strings and may contain values that are not
   * valid JSON.
   */
  const adminId =
    request.cookies.get("burton_admin_id")?.value || "";

  const adminEmail =
    request.cookies.get("burton_admin_email")?.value || "";

  const adminSession =
    request.cookies.get("burton_admin_session")?.value ||
    "";

  if (!adminSession && !adminId && !adminEmail) {
    return {
      ok: false,
      error: "You must be logged in to upload images.",
      details:
        "No Burton admin login cookies were found. Sign out, sign back in and try again.",
    };
  }

  if (adminId) {
    const admin = await findActiveAdminById(adminId);

    if (admin) {
      return {
        ok: true,
        actor: createAuditActor(admin),
      };
    }
  }

  if (adminEmail) {
    const admin = await findActiveAdminByEmail(
      adminEmail,
    );

    if (admin) {
      return {
        ok: true,
        actor: createAuditActor(admin),
      };
    }
  }

  return {
    ok: false,
    error:
      "You do not have permission to upload images.",
    details:
      "The app found admin cookies but could not match them to an active admin_users account. Check burton_admin_id, burton_admin_email and admin_users.is_active.",
  };
}

async function writeAuditSafely(
  input: Parameters<typeof createEventAuditLog>[0],
): Promise<boolean> {
  try {
    await createEventAuditLog(input);
    return true;
  } catch (error) {
    /*
     * A temporary audit failure should not leave a successfully
     * uploaded image unusable.
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
    actionLabel:
      "Selling image upload rejected",

    area: AUDIT_AREA,
    status: "blocked",
    riskLevel: "medium",

    record: {
      type: "event_business_contact_selling_image",
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
    actionLabel:
      "Selling image upload failed",

    area: AUDIT_AREA,
    status: "failed",
    riskLevel: "medium",

    record: {
      type: "event_business_contact_selling_image",
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
      type: "event_business_contact_selling_image",
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

    /*
     * The full public URL is deliberately not copied into the audit
     * snapshot. The storage path is enough to identify the file.
     */
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

export async function POST(
  request: NextRequest,
) {
  let actor: AuditActor | null = null;

  let eventId: string | null = null;
  let contactId: string | null = null;
  let businessName: string | null = null;

  let fileName: string | null = null;
  let filePath: string | null = null;
  let mimeType: string | null = null;
  let fileSize: number | null = null;

  try {
    const adminCheck =
      await checkAdminCookie(request);

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

    /*
     * These fields are optional. Existing frontend code that only
     * sends the file will continue to work.
     *
     * Sending these values gives the audit record better context.
     */
    eventId = nullableText(
      formData.get("event_id"),
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
      contactId,
      businessName,
      fileName,
      filePath,
      mimeType,
      fileSize,
    };

    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
    ];

    if (!allowedTypes.includes(file.type)) {
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
        400,
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Image must be smaller than 5MB.",
          details: reason,
        },
        400,
      );
    }

    const fileExtension =
      getImageExtension(file.type);

    const safeOriginalName =
      cleanFileNamePart(
        file.name.replace(/\.[^/.]+$/, ""),
      );

    filePath =
      `contacts/${new Date().getFullYear()}/` +
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

    if (!publicUrlData?.publicUrl) {
      /*
       * Remove the uploaded object if the response cannot provide the
       * required URL. This avoids leaving an unused file behind.
       */
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

      const error = new Error(
        "Supabase did not return a public URL after the image was uploaded.",
      );

      await auditFailedUpload(
        auditContext,
        error,
        500,
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Image uploaded, but no public URL was returned.",
          details:
            "Check that the bucket exists and is configured as a public bucket.",
        },
        500,
      );
    }

    const auditLogged =
      await auditSuccessfulUpload(
        auditContext,
      );

    return jsonResponse(
      {
        ok: true,
        url: publicUrlData.publicUrl,
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