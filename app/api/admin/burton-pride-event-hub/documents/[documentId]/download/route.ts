import { randomUUID } from "crypto";

import { NextRequest, NextResponse } from "next/server";

import {
  createEventAuditLog,
  requireEventAuditPermission,
} from "@/lib/event-hub-app/event-audit";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOCUMENTS_TABLE = "event_documents";
const SIGNED_URL_EXPIRY_SECONDS = 60 * 10;

/*
 * Replace this with a dedicated document permission when one exists, such as:
 * event_documents:view
 *
 * Using the central Event Audit permission resolver also gives
 * createEventAuditLog a trusted server-side actor.
 */
const REQUIRED_PERMISSION = "event_audit:view";

type RouteContext = {
  params: Promise<{ documentId: string }>;
};

type JsonRecord = Record<string, unknown>;

type AuditActor = Awaited<
  ReturnType<typeof requireEventAuditPermission>
>;

type DocumentRecord = {
  id: string;
  event_id: string | null;
  title: string;
  original_file_name: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number;
  is_confidential: boolean;
  is_archived: boolean;
  is_current_version: boolean;
  status: string;
  version_number: number;
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
      "X-Robots-Tag": "noindex, noarchive",
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
  details?: unknown;
  hint?: string | null;
}) {
  return json(
    {
      ok: false,
      error,
      code,
      message,
      details: details ?? null,
      hint: hint || null,
      requestId,
    },
    status,
    requestId,
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function safeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 1000);
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    return String(
      (error as { message?: unknown }).message || "",
    ).slice(0, 1000);
  }

  return String(error || "Unknown error").slice(0, 1000);
}

function statusFromAuthError(error: unknown) {
  const message = safeErrorMessage(error).toLowerCase();

  if (
    message.includes("unauthorized") ||
    message.includes("sign in") ||
    message.includes("session")
  ) {
    return 401;
  }

  if (
    message.includes("permission") ||
    message.includes("access") ||
    message.includes("forbidden")
  ) {
    return 403;
  }

  return 500;
}

function auditRecord(document: DocumentRecord) {
  return {
    type: "event_document",
    id: document.id,
    title: document.title,
  };
}

/*
 * This snapshot deliberately excludes:
 * - storage_path
 * - signed URL
 * - file contents
 * - session/cookie information
 */
function safeDocumentSnapshot(document: DocumentRecord) {
  return {
    id: document.id,
    event_id: document.event_id,
    title: document.title,
    original_file_name: document.original_file_name,
    mime_type: document.mime_type,
    file_size_bytes: document.file_size_bytes,
    is_confidential: document.is_confidential,
    is_archived: document.is_archived,
    is_current_version: document.is_current_version,
    status: document.status,
    version_number: document.version_number,
  };
}

async function writeDownloadAudit({
  actor,
  request,
  requestId,
  document,
  status,
  responseStatus,
  actionLabel,
  summary,
  metadata,
  strict,
}: {
  actor: AuditActor;
  request: NextRequest;
  requestId: string;
  document: DocumentRecord;
  status: "success" | "failed" | "blocked";
  responseStatus: number;
  actionLabel: string;
  summary: string;
  metadata?: Record<string, unknown>;
  strict: boolean;
}) {
  return createEventAuditLog({
    actor,
    eventId: document.event_id,
    action:
      status === "success"
        ? "event_document_downloaded"
        : "event_document_download_failed",
    actionLabel,
    area: "documents",
    status,
    riskLevel: document.is_confidential ? "high" : "medium",
    record: auditRecord(document),
    summary,
    after:
      status === "success"
        ? safeDocumentSnapshot(document)
        : null,
    metadata: {
      source: "event_documents_download_api",
      request_id: requestId,
      original_file_name: document.original_file_name,
      mime_type: document.mime_type,
      file_size_bytes: document.file_size_bytes,
      document_status: document.status,
      document_version: document.version_number,
      is_confidential: document.is_confidential,
      signed_url_expiry_seconds:
        SIGNED_URL_EXPIRY_SECONDS,
      ...metadata,
    },
    request,
    responseStatus,
    isConfidential: document.is_confidential,
    requiresReview: document.is_confidential,
    strict,
  });
}

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  const requestId = randomUUID();

  let actor: AuditActor;

  try {
    actor = await requireEventAuditPermission(
      REQUIRED_PERMISSION,
    );
  } catch (error) {
    const status = statusFromAuthError(error);

    return apiError({
      requestId,
      status,
      error:
        status === 401
          ? "Authentication required"
          : status === 403
            ? "Document access denied"
            : "Admin session check failed",
      code:
        status === 401
          ? "ADMIN_SESSION_REQUIRED"
          : status === 403
            ? "EVENT_DOCUMENT_ACCESS_DENIED"
            : "EVENT_DOCUMENT_ADMIN_CHECK_FAILED",
      message:
        status === 401
          ? "You must be signed in to view Event Hub documents."
          : status === 403
            ? "Your account does not have permission to view this document."
            : safeErrorMessage(error),
      hint:
        status === 401
          ? "Sign out and sign back in."
          : status === 403
            ? "Ask a main admin to grant the required Event Hub permission."
            : "Check the server logs for the admin session error.",
    });
  }

  try {
    const { documentId } = await context.params;

    if (!documentId || !isUuid(documentId)) {
      return apiError({
        requestId,
        status: 400,
        error: "Invalid document ID",
        code: "DOCUMENT_ID_INVALID",
        message:
          "The supplied document ID is not a valid UUID.",
        details: {
          documentId: documentId || null,
        },
      });
    }

    const { data, error: lookupError } =
      await supabaseAdmin
        .from(DOCUMENTS_TABLE)
        .select(
          [
            "id",
            "event_id",
            "title",
            "original_file_name",
            "storage_bucket",
            "storage_path",
            "mime_type",
            "file_size_bytes",
            "is_confidential",
            "is_archived",
            "is_current_version",
            "status",
            "version_number",
          ].join(","),
        )
        .eq("id", documentId)
        .maybeSingle();

    if (lookupError) {
      /*
       * There is no trusted document snapshot when lookup itself fails,
       * so log the server error and return the detailed Supabase response.
       */
      console.error("Event document lookup failed", {
        requestId,
        documentId,
        error: lookupError,
      });

      return apiError({
        requestId,
        status: 500,
        error: "Document lookup failed",
        code:
          lookupError.code || "DOCUMENT_LOOKUP_FAILED",
        message:
          lookupError.message ||
          "The Event Hub document could not be loaded.",
        details: lookupError.details || null,
        hint: lookupError.hint || null,
      });
    }

    if (!data) {
      return apiError({
        requestId,
        status: 404,
        error: "Document not found",
        code: "DOCUMENT_NOT_FOUND",
        message:
          "The requested Event Hub document could not be found.",
        details: {
          documentId,
        },
      });
    }

    const document =
      data as unknown as DocumentRecord;

    if (
      !document.storage_bucket ||
      !document.storage_path
    ) {
      try {
        await writeDownloadAudit({
          actor,
          request,
          requestId,
          document,
          status: "failed",
          responseStatus: 409,
          actionLabel:
            "Event document download failed",
          summary:
            "The document could not be downloaded because its Storage details were missing.",
          metadata: {
            failure_stage: "storage_details",
            failure_code:
              "DOCUMENT_STORAGE_DETAILS_MISSING",
          },
          strict: false,
        });
      } catch (auditError) {
        console.error(
          "Failed to audit missing document Storage details",
          {
            requestId,
            documentId,
            error: auditError,
          },
        );
      }

      return apiError({
        requestId,
        status: 409,
        error: "Document Storage details are missing",
        code: "DOCUMENT_STORAGE_DETAILS_MISSING",
        message:
          "This document record does not contain a valid Storage bucket and path.",
        hint:
          "Check storage_bucket and storage_path in event_documents.",
      });
    }

    const {
      data: signedUrlData,
      error: signedUrlError,
    } = await supabaseAdmin.storage
      .from(document.storage_bucket)
      .createSignedUrl(
        document.storage_path,
        SIGNED_URL_EXPIRY_SECONDS,
        {
          download:
            document.original_file_name || undefined,
        },
      );

    if (
      signedUrlError ||
      !signedUrlData?.signedUrl
    ) {
      try {
        await writeDownloadAudit({
          actor,
          request,
          requestId,
          document,
          status: "failed",
          responseStatus: 500,
          actionLabel:
            "Event document download failed",
          summary:
            "A secure download link could not be created for an Event Hub document.",
          metadata: {
            failure_stage: "signed_url",
            failure_code:
              signedUrlError?.name ||
              "DOCUMENT_SIGNED_URL_FAILED",
            failure_message:
              signedUrlError?.message || null,
          },
          strict: false,
        });
      } catch (auditError) {
        console.error(
          "Failed to audit signed URL error",
          {
            requestId,
            documentId,
            error: auditError,
          },
        );
      }

      return apiError({
        requestId,
        status: 500,
        error:
          "Secure document link could not be created",
        code:
          signedUrlError?.name ||
          "DOCUMENT_SIGNED_URL_FAILED",
        message:
          signedUrlError?.message ||
          "Supabase Storage did not return a signed URL.",
        hint:
          "Confirm the private Storage bucket and stored file path exist.",
      });
    }

    /*
     * Write the audit directly through the trusted server helper.
     *
     * strict: true means the signed URL is not returned if the
     * confidential-access audit cannot be saved.
     */
    let auditLog: Awaited<
      ReturnType<typeof createEventAuditLog>
    >;

    try {
      auditLog = await writeDownloadAudit({
        actor,
        request,
        requestId,
        document,
        status: "success",
        responseStatus: 200,
        actionLabel:
          "Event document downloaded",
        summary:
          "An admin requested a secure preview or download link for an Event Hub document.",
        metadata: {
          access_type: "signed_url",
          preview_or_download: true,
        },
        strict: true,
      });
    } catch (auditError) {
      console.error(
        "Event document download audit failed",
        {
          requestId,
          documentId,
          error: auditError,
        },
      );

      return apiError({
        requestId,
        status: 502,
        error:
          "Document access audit could not be recorded",
        code: "DOCUMENT_DOWNLOAD_AUDIT_FAILED",
        message:
          "The secure document link was not released because the audit record could not be saved.",
        details: safeErrorMessage(auditError),
        hint:
          "Check createEventAuditLog, the event_audit_logs table, and the Event Hub audit migration.",
      });
    }

    return json(
      {
        ok: true,
        success: true,
        url: signedUrlData.signedUrl,
        expiresIn: SIGNED_URL_EXPIRY_SECONDS,
        document: {
          id: document.id,
          eventId: document.event_id,
          title: document.title,
          originalFileName:
            document.original_file_name,
          mimeType: document.mime_type,
          fileSizeBytes:
            document.file_size_bytes,
          isConfidential:
            document.is_confidential,
          isArchived: document.is_archived,
          isCurrentVersion:
            document.is_current_version,
          status: document.status,
          versionNumber:
            document.version_number,
        },
        auditLogged: true,
        auditLogId:
          auditLog &&
          typeof auditLog === "object" &&
          "id" in auditLog
            ? String(
                (auditLog as { id?: unknown }).id ||
                  "",
              ) || null
            : null,
        requestId,
      },
      200,
      requestId,
    );
  } catch (error) {
    console.error(
      "Unexpected Event document download error",
      {
        requestId,
        error,
      },
    );

    return apiError({
      requestId,
      status: 500,
      error:
        "Unexpected document download error",
      code: "DOCUMENT_DOWNLOAD_UNEXPECTED",
      message: safeErrorMessage(error),
      hint:
        "Check the Next.js server logs using the request ID.",
    });
  }
}
