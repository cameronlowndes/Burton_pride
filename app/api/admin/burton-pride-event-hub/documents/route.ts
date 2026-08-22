import { randomUUID } from "crypto";

import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { reportEventDocumentAudit } from "@/lib/event-hub-app/event-audit/eventDocumentAudit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOCUMENTS_TABLE = "event_documents";
const EVENTS_TABLE = "burton_pride_events";
const STORAGE_BUCKET = "event-documents";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const ALLOWED_CATEGORIES = new Set([
  "public_liability_insurance",
  "event_insurance",
  "employers_liability_insurance",
  "risk_assessment",
  "fire_risk_assessment",
  "event_management_plan",
  "emergency_plan",
  "security_plan",
  "medical_plan",
  "safeguarding_policy",
  "lost_child_policy",
  "accessibility_plan",
  "noise_management_plan",
  "waste_management_plan",
  "traffic_management_plan",
  "site_plan",
  "premises_licence",
  "temporary_event_notice",
  "music_licence",
  "food_hygiene_document",
  "gas_safety_certificate",
  "electrical_safety_certificate",
  "equipment_safety_certificate",
  "supplier_insurance",
  "contract",
  "invoice",
  "council_document",
  "police_document",
  "security_document",
  "first_aid_document",
  "volunteer_document",
  "other",
]);

type JsonRecord = Record<string, unknown>;

type AdminIdentity = {
  id: string | null;
  name: string | null;
  email: string | null;
};

type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

function json(
  body: JsonRecord,
  status = 200,
  requestId?: string,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      ...(requestId ? { "x-request-id": requestId } : {}),
    },
  });
}

function apiError({
  requestId,
  status,
  error,
  code,
  message,
  details,
  hint,
}: {
  requestId: string;
  status: number;
  error: string;
  code: string;
  message: string;
  details?: string | null;
  hint?: string | null;
}) {
  return json(
    {
      error,
      message,
      code,
      details: details || null,
      hint: hint || null,
      requestId,
    },
    status,
    requestId,
  );
}

function supabaseErrorResponse({
  requestId,
  status,
  error,
  fallbackCode,
  fallbackMessage,
  supabaseError,
}: {
  requestId: string;
  status: number;
  error: string;
  fallbackCode: string;
  fallbackMessage: string;
  supabaseError: SupabaseLikeError | null | undefined;
}) {
  return apiError({
    requestId,
    status,
    error,
    code: supabaseError?.code || fallbackCode,
    message: supabaseError?.message || fallbackMessage,
    details: supabaseError?.details || null,
    hint: supabaseError?.hint || null,
  });
}

function asTrimmedString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function parseBoolean(value: FormDataEntryValue | null, fallback = false) {
  if (typeof value !== "string") return fallback;

  const normalised = value.trim().toLowerCase();

  if (["true", "1", "yes", "on"].includes(normalised)) return true;
  if (["false", "0", "no", "off"].includes(normalised)) return false;

  return fallback;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function cleanFileName(value: string) {
  const safe = value
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 180);

  return safe || "document";
}

function getFileExtension(fileName: string) {
  const safeName = cleanFileName(fileName);
  const lastDot = safeName.lastIndexOf(".");

  if (lastDot <= 0 || lastDot === safeName.length - 1) {
    return "";
  }

  return safeName.slice(lastDot + 1).toLowerCase();
}

function validateDate(value: string) {
  if (!value) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Replace this helper with your existing requireAdmin/session helper if you
 * already have one. This fallback reads the Burton Pride admin cookies used by
 * the current admin portal.
 */
function getAdminIdentity(request: NextRequest): AdminIdentity {
  const id =
    request.cookies.get("burton_admin_id")?.value?.trim() || null;
  const email =
    request.cookies.get("burton_admin_email")?.value?.trim() || null;

  const name =
    request.cookies.get("burton_admin_name")?.value?.trim() ||
    email ||
    null;

  return {
    id,
    name,
    email,
  };
}

async function ensureStorageBucket() {
  const { data, error } = await supabaseAdmin.storage.getBucket(
    STORAGE_BUCKET,
  );

  if (data && !error) return null;

  const { error: createError } =
    await supabaseAdmin.storage.createBucket(STORAGE_BUCKET, {
      public: false,
      fileSizeLimit: MAX_FILE_SIZE,
      allowedMimeTypes: Array.from(ALLOWED_MIME_TYPES),
    });

  return createError || null;
}

export async function GET(request: NextRequest) {
  const requestId = randomUUID();

  try {
    const admin = getAdminIdentity(request);

    if (!admin.id && !admin.email) {
      return apiError({
        requestId,
        status: 401,
        error: "Unauthorised",
        code: "ADMIN_SESSION_REQUIRED",
        message:
          "You must be signed in to the Burton Pride Admin Portal to view event documents.",
        hint: "Sign in again and then reload the Event Documents page.",
      });
    }

    const { searchParams } = new URL(request.url);

    const eventId = searchParams.get("eventId")?.trim() || "";
    const includeArchived =
      searchParams.get("includeArchived") === "true";

    if (eventId && !isUuid(eventId)) {
      return apiError({
        requestId,
        status: 400,
        error: "Invalid event ID",
        code: "EVENT_ID_INVALID",
        message: "The supplied event ID is not a valid UUID.",
        details: `Received eventId: ${eventId}`,
      });
    }

    const { data: events, error: eventsError } = await supabaseAdmin
      .from(EVENTS_TABLE)
      .select(
        "id,event_name,event_year,event_date,is_active,is_archived",
      )
      .order("event_year", { ascending: false })
      .order("event_date", { ascending: false });

    if (eventsError) {
      return supabaseErrorResponse({
        requestId,
        status: 500,
        error: "Events query failed",
        fallbackCode: "EVENTS_QUERY_FAILED",
        fallbackMessage: "Unable to load Event Hub events.",
        supabaseError: eventsError,
      });
    }

    let documentsQuery = supabaseAdmin
      .from(DOCUMENTS_TABLE)
      .select(
        [
          "id",
          "event_id",
          "title",
          "description",
          "category",
          "organisation_name",
          "document_reference",
          "original_file_name",
          "mime_type",
          "file_size_bytes",
          "issue_date",
          "expiry_date",
          "status",
          "is_required",
          "is_confidential",
          "is_current_version",
          "is_archived",
          "version_number",
          "uploaded_by_name",
          "uploaded_by_email",
          "created_at",
          "updated_at",
        ].join(","),
      )
      .order("created_at", { ascending: false });

    if (eventId) {
      documentsQuery = documentsQuery.eq("event_id", eventId);
    }

    if (!includeArchived) {
      documentsQuery = documentsQuery.eq("is_archived", false);
    }

    const { data: documents, error: documentsError } =
      await documentsQuery;

    if (documentsError) {
      return supabaseErrorResponse({
        requestId,
        status: 500,
        error: "Documents query failed",
        fallbackCode: "EVENT_DOCUMENTS_QUERY_FAILED",
        fallbackMessage: "Unable to load event documents.",
        supabaseError: documentsError,
      });
    }

    const eventNameById = new Map(
      (events || []).map((event) => [
        String(event.id),
        String(event.event_name || "Event"),
      ]),
    );

    const documentsWithEventNames = (documents || []).map((document) => {
      const docRecord = document as unknown as Record<string, unknown>;
      return {
        ...docRecord,
        event_name: eventNameById.get(String(docRecord.event_id)) || null,
      };
    });

    return json(
      {
        documents: documentsWithEventNames,
        events: events || [],
        requestId,
      },
      200,
      requestId,
    );
  } catch (error) {
    console.error("GET event documents failed", {
      requestId,
      error,
    });

    return apiError({
      requestId,
      status: 500,
      error: "Unexpected server error",
      code: "EVENT_DOCUMENTS_GET_UNEXPECTED",
      message:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while loading event documents.",
      hint:
        "Check the server logs using the request ID shown in this response.",
    });
  }
}

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  let uploadedStoragePath: string | null = null;

  try {
    const admin = getAdminIdentity(request);

    if (!admin.id && !admin.email) {
      return apiError({
        requestId,
        status: 401,
        error: "Unauthorised",
        code: "ADMIN_SESSION_REQUIRED",
        message:
          "You must be signed in to the Burton Pride Admin Portal to upload event documents.",
        hint: "Sign in again and retry the upload.",
      });
    }

    const contentType = request.headers.get("content-type") || "";

    if (!contentType.includes("multipart/form-data")) {
      return apiError({
        requestId,
        status: 415,
        error: "Unsupported content type",
        code: "MULTIPART_FORM_REQUIRED",
        message:
          "Event documents must be uploaded using multipart form data.",
        details: `Received content-type: ${contentType || "not supplied"}`,
      });
    }

    const formData = await request.formData();

    const eventId = asTrimmedString(formData.get("eventId"));
    const title = asTrimmedString(formData.get("title"));
    const category = asTrimmedString(formData.get("category"));
    const organisationName = asTrimmedString(
      formData.get("organisationName"),
    );
    const documentReference = asTrimmedString(
      formData.get("documentReference"),
    );
    const description = asTrimmedString(
      formData.get("description"),
    );
    const issueDate = asTrimmedString(formData.get("issueDate"));
    const expiryDate = asTrimmedString(formData.get("expiryDate"));
    const notes = asTrimmedString(formData.get("notes"));

    const isRequired = parseBoolean(
      formData.get("isRequired"),
      false,
    );
    const isConfidential = parseBoolean(
      formData.get("isConfidential"),
      true,
    );

    const fileEntry = formData.get("file");
    const file = fileEntry instanceof File ? fileEntry : null;

    if (!eventId) {
      return apiError({
        requestId,
        status: 400,
        error: "Event is required",
        code: "DOCUMENT_EVENT_REQUIRED",
        message:
          "Select the event this document belongs to before uploading.",
      });
    }

    if (!isUuid(eventId)) {
      return apiError({
        requestId,
        status: 400,
        error: "Invalid event ID",
        code: "EVENT_ID_INVALID",
        message: "The selected event ID is not a valid UUID.",
        details: `Received eventId: ${eventId}`,
      });
    }

    if (!title) {
      return apiError({
        requestId,
        status: 400,
        error: "Document title is required",
        code: "DOCUMENT_TITLE_REQUIRED",
        message:
          "Enter a clear title so admins can identify this document.",
      });
    }

    if (title.length > 180) {
      return apiError({
        requestId,
        status: 400,
        error: "Document title is too long",
        code: "DOCUMENT_TITLE_TOO_LONG",
        message:
          "The document title must be 180 characters or fewer.",
        details: `Received title length: ${title.length}`,
      });
    }

    if (!ALLOWED_CATEGORIES.has(category)) {
      return apiError({
        requestId,
        status: 400,
        error: "Invalid document category",
        code: "DOCUMENT_CATEGORY_INVALID",
        message:
          "The selected document category is not supported.",
        details: `Received category: ${category || "empty"}`,
      });
    }

    if (!file) {
      return apiError({
        requestId,
        status: 400,
        error: "Document file is required",
        code: "DOCUMENT_FILE_REQUIRED",
        message:
          "Choose a PDF, Word, Excel or supported image file to upload.",
      });
    }

    if (file.size <= 0) {
      return apiError({
        requestId,
        status: 400,
        error: "Document file is empty",
        code: "DOCUMENT_FILE_EMPTY",
        message:
          "The selected file does not contain any data.",
      });
    }

    if (file.size > MAX_FILE_SIZE) {
      return apiError({
        requestId,
        status: 413,
        error: "Document is too large",
        code: "DOCUMENT_FILE_TOO_LARGE",
        message:
          "The selected file is larger than the 25MB upload limit.",
        details: `Selected file size: ${file.size} bytes. Maximum allowed: ${MAX_FILE_SIZE} bytes.`,
        hint:
          "Compress the file or split it into smaller documents before uploading.",
      });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return apiError({
        requestId,
        status: 415,
        error: "Unsupported document type",
        code: "DOCUMENT_MIME_TYPE_NOT_ALLOWED",
        message:
          "This file type is not allowed for Event Hub documents.",
        details: `Received MIME type: ${file.type || "not supplied"}`,
        hint:
          "Upload a PDF, Word document, Excel workbook, JPG, PNG or WEBP file.",
      });
    }

    if (!validateDate(issueDate)) {
      return apiError({
        requestId,
        status: 400,
        error: "Invalid issue date",
        code: "DOCUMENT_ISSUE_DATE_INVALID",
        message:
          "The issue date must use the YYYY-MM-DD format.",
        details: `Received issue date: ${issueDate}`,
      });
    }

    if (!validateDate(expiryDate)) {
      return apiError({
        requestId,
        status: 400,
        error: "Invalid expiry date",
        code: "DOCUMENT_EXPIRY_DATE_INVALID",
        message:
          "The expiry date must use the YYYY-MM-DD format.",
        details: `Received expiry date: ${expiryDate}`,
      });
    }

    if (issueDate && expiryDate && expiryDate < issueDate) {
      return apiError({
        requestId,
        status: 400,
        error: "Document dates are invalid",
        code: "DOCUMENT_DATE_RANGE_INVALID",
        message:
          "The expiry date cannot be earlier than the issue date.",
        details: `Issue date: ${issueDate}. Expiry date: ${expiryDate}.`,
      });
    }

    const { data: eventRecord, error: eventError } =
      await supabaseAdmin
        .from(EVENTS_TABLE)
        .select("id,event_name,event_year,event_date,is_active,is_archived")
        .eq("id", eventId)
        .maybeSingle();

    if (eventError) {
      await reportEventDocumentAudit({
        request,
        input: {
          action: "event_document_create_failed",
          actionLabel: "Event document upload failed",
          description:
            "An Event Hub document could not be uploaded because the selected event could not be loaded.",
          status: "failed",
          eventId,
          requestId,
          metadata: {
            failureStage: "event_lookup",
            errorCode: eventError.code,
            errorMessage: eventError.message,
          },
        },
      });

      return supabaseErrorResponse({
        requestId,
        status: 500,
        error: "Event lookup failed",
        fallbackCode: "EVENT_LOOKUP_FAILED",
        fallbackMessage:
          "Unable to confirm that the selected event exists.",
        supabaseError: eventError,
      });
    }

    if (!eventRecord) {
      await reportEventDocumentAudit({
        request,
        input: {
          action: "event_document_create_failed",
          actionLabel: "Event document upload failed",
          description:
            "An Event Hub document upload was attempted for an event that does not exist.",
          status: "failed",
          eventId,
          requestId,
          metadata: {
            failureStage: "event_lookup",
            failureCode: "EVENT_NOT_FOUND",
            documentTitle: title,
            category,
            originalFileName: file.name,
          },
        },
      });

      return apiError({
        requestId,
        status: 404,
        error: "Event not found",
        code: "EVENT_NOT_FOUND",
        message:
          "The selected Event Hub event does not exist.",
        details: `No event was found with ID ${eventId}.`,
      });
    }

    const bucketError = await ensureStorageBucket();

    if (bucketError) {
      await reportEventDocumentAudit({
        request,
        input: {
          action: "event_document_create_failed",
          actionLabel: "Event document upload failed",
          description:
            "An Event Hub document could not be uploaded because the private Storage bucket was unavailable.",
          status: "failed",
          eventId,
          documentTitle: title,
          requestId,
          metadata: {
            failureStage: "storage_bucket",
            errorCode: bucketError.name || null,
            errorMessage: bucketError.message || null,
            category,
            originalFileName: file.name,
          },
        },
      });

      return supabaseErrorResponse({
        requestId,
        status: 500,
        error: "Storage bucket unavailable",
        fallbackCode: "EVENT_DOCUMENT_BUCKET_FAILED",
        fallbackMessage:
          "The private event document storage bucket could not be created or accessed.",
        supabaseError: bucketError,
      });
    }

    const documentId = randomUUID();
    const safeOriginalName = cleanFileName(file.name);
    const extension = getFileExtension(file.name);
    const storedFileName = extension
      ? `document.${extension}`
      : "document";

    uploadedStoragePath = `${eventId}/${documentId}/version-1/${storedFileName}`;

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(uploadedStoragePath, fileBuffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      await reportEventDocumentAudit({
        request,
        input: {
          action: "event_document_create_failed",
          actionLabel: "Event document upload failed",
          description:
            "The Event Hub document file could not be uploaded to private Supabase Storage.",
          status: "failed",
          eventId,
          documentId,
          documentTitle: title,
          requestId,
          metadata: {
            failureStage: "storage_upload",
            errorCode: uploadError.name || null,
            errorMessage: uploadError.message || null,
            category,
            originalFileName: safeOriginalName,
            mimeType: file.type,
            fileSizeBytes: file.size,
          },
        },
      });

      return supabaseErrorResponse({
        requestId,
        status: 500,
        error: "Storage upload failed",
        fallbackCode: "EVENT_DOCUMENT_STORAGE_UPLOAD_FAILED",
        fallbackMessage:
          "The document file could not be uploaded to private storage.",
        supabaseError: uploadError,
      });
    }

    const { data: insertedDocument, error: insertError } =
      await supabaseAdmin
        .from(DOCUMENTS_TABLE)
        .insert({
          id: documentId,
          event_id: eventId,
          title,
          description: description || null,
          category,
          organisation_name: organisationName || null,
          document_reference: documentReference || null,
          file_name: storedFileName,
          original_file_name: safeOriginalName,
          storage_bucket: STORAGE_BUCKET,
          storage_path: uploadedStoragePath,
          mime_type: file.type,
          file_size_bytes: file.size,
          issue_date: issueDate || null,
          expiry_date: expiryDate || null,
          status: "awaiting_review",
          is_required: isRequired,
          is_confidential: isConfidential,
          is_current_version: true,
          is_archived: false,
          version_number: 1,
          uploaded_by: admin.id,
          uploaded_by_name: admin.name,
          uploaded_by_email: admin.email,
          notes: notes || null,
        })
        .select(
          [
            "id",
            "event_id",
            "title",
            "description",
            "category",
            "organisation_name",
            "document_reference",
            "original_file_name",
            "mime_type",
            "file_size_bytes",
            "issue_date",
            "expiry_date",
            "status",
            "is_required",
            "is_confidential",
            "is_current_version",
            "is_archived",
            "version_number",
            "uploaded_by_name",
            "uploaded_by_email",
            "created_at",
            "updated_at",
          ].join(","),
        )
        .single();

    if (insertError) {
      await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .remove([uploadedStoragePath]);

      await reportEventDocumentAudit({
        request,
        input: {
          action: "event_document_create_failed",
          actionLabel: "Event document creation failed",
          description:
            "The file was uploaded, but the Event Hub document database record could not be created. The stored file was removed.",
          status: "failed",
          eventId,
          documentId,
          documentTitle: title,
          requestId,
          metadata: {
            failureStage: "database_insert",
            errorCode: insertError.code,
            errorMessage: insertError.message,
            category,
            originalFileName: safeOriginalName,
            storageCleanupAttempted: true,
          },
        },
      });

      uploadedStoragePath = null;

      return supabaseErrorResponse({
        requestId,
        status: 500,
        error: "Document record creation failed",
        fallbackCode: "EVENT_DOCUMENT_INSERT_FAILED",
        fallbackMessage:
          "The file was uploaded, but the document record could not be saved. The uploaded file was removed.",
        supabaseError: insertError,
      });
    }

    const createdDocument = {
      ...((insertedDocument ?? {}) as unknown as Record<string, unknown>),
      event_name: eventRecord.event_name,
    };

    const audit = await reportEventDocumentAudit({
      request,
      input: {
        action: "event_document_created",
        actionLabel: "Event document created",
        description:
          "A new Event Hub document was uploaded and created with awaiting-review status.",
        status: "success",
        eventId,
        documentId,
        documentTitle: title,
        requestId,
        afterData: createdDocument,
        metadata: {
          category,
          originalFileName: safeOriginalName,
          mimeType: file.type,
          fileSizeBytes: file.size,
          confidential: isConfidential,
          required: isRequired,
          versionNumber: 1,
        },
      },
    });

    return json(
      {
        success: true,
        message:
          "Document uploaded successfully and is awaiting review.",
        document: createdDocument,
        auditLogged: audit.ok,
        auditWarning: audit.ok
          ? null
          : {
              status: audit.status || null,
              error: audit.error || null,
            },
        requestId,
      },
      201,
      requestId,
    );
  } catch (error) {
    console.error("POST event document failed", {
      requestId,
      uploadedStoragePath,
      error,
    });

    if (uploadedStoragePath) {
      await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .remove([uploadedStoragePath])
        .catch(() => undefined);
    }

    return apiError({
      requestId,
      status: 500,
      error: "Unexpected upload error",
      code: "EVENT_DOCUMENT_POST_UNEXPECTED",
      message:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while uploading the document.",
      hint:
        "Check the server logs using the request ID shown in this response.",
    });
  }
}
