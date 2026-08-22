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
const REQUIRED_PERMISSION = "event_audit:view";

type RouteContext = {
  params: Promise<{ documentId: string }>;
};

type ReviewBody = {
  decision?: "approved" | "rejected";
  reviewNotes?: string;
  rejectionReason?: string;
  issueDate?: string | null;
  expiryDate?: string | null;
  organisationName?: string | null;
};

type JsonRecord = Record<string, unknown>;

type AuditActor = Awaited<
  ReturnType<typeof requireEventAuditPermission>
>;

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
      message,
      code,
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

function isDateOrEmpty(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value))
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

function documentRecord(document: Record<string, unknown>) {
  return {
    type: "event_document",
    id: String(document.id || ""),
    title: String(document.title || "Event document"),
  };
}

function safeDocumentSnapshot(
  document: Record<string, unknown>,
) {
  return {
    id: document.id || null,
    event_id: document.event_id || null,
    title: document.title || null,
    description: document.description || null,
    category: document.category || null,
    organisation_name:
      document.organisation_name || null,
    document_reference:
      document.document_reference || null,
    original_file_name:
      document.original_file_name || null,
    mime_type: document.mime_type || null,
    file_size_bytes:
      document.file_size_bytes || null,
    issue_date: document.issue_date || null,
    expiry_date: document.expiry_date || null,
    status: document.status || null,
    is_required:
      Boolean(document.is_required),
    is_confidential:
      Boolean(document.is_confidential),
    is_current_version:
      Boolean(document.is_current_version),
    is_archived:
      Boolean(document.is_archived),
    version_number:
      document.version_number || null,
    review_notes:
      document.review_notes || null,
    rejection_reason:
      document.rejection_reason || null,
    reviewed_at:
      document.reviewed_at || null,
    updated_at:
      document.updated_at || null,
  };
}

async function writeReviewAudit({
  actor,
  request,
  requestId,
  existing,
  updated,
  action,
  actionLabel,
  status,
  responseStatus,
  summary,
  metadata,
  strict = false,
}: {
  actor: AuditActor;
  request: NextRequest;
  requestId: string;
  existing: Record<string, unknown>;
  updated?: Record<string, unknown> | null;
  action: string;
  actionLabel: string;
  status: "success" | "failed" | "blocked";
  responseStatus: number;
  summary: string;
  metadata?: Record<string, unknown>;
  strict?: boolean;
}) {
  return createEventAuditLog({
    actor,
    eventId:
      String(
        updated?.event_id ||
          existing.event_id ||
          "",
      ) || null,
    action,
    actionLabel,
    area: "documents",
    status,
    riskLevel:
      Boolean(
        updated?.is_confidential ??
          existing.is_confidential,
      )
        ? "high"
        : "medium",
    record: documentRecord(
      updated || existing,
    ),
    summary,
    before: safeDocumentSnapshot(existing),
    after: updated
      ? safeDocumentSnapshot(updated)
      : null,
    metadata: {
      request_id: requestId,
      source: "event_document_review_api",
      ...metadata,
    },
    request,
    responseStatus,
    isConfidential: Boolean(
      updated?.is_confidential ??
        existing.is_confidential,
    ),
    requiresReview: false,
    strict,
  });
}

export async function POST(
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
            ? "Document review access denied"
            : "Admin permission check failed",
      code:
        status === 401
          ? "ADMIN_SESSION_REQUIRED"
          : status === 403
            ? "EVENT_DOCUMENT_REVIEW_DENIED"
            : "EVENT_DOCUMENT_REVIEW_PERMISSION_FAILED",
      message:
        status === 401
          ? "You must be signed in to review Event Hub documents."
          : status === 403
            ? "Your account does not have permission to review this document."
            : safeErrorMessage(error),
      hint:
        status === 401
          ? "Sign out and sign back in."
          : status === 403
            ? "Ask a main admin to grant the required Event Hub permission."
            : "Check the server logs for the permission error.",
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

    const body = (await request
      .json()
      .catch(() => null)) as
      | ReviewBody
      | null;

    if (!body) {
      return apiError({
        requestId,
        status: 400,
        error: "Invalid request body",
        code: "DOCUMENT_REVIEW_BODY_INVALID",
        message:
          "The review request must contain valid JSON.",
      });
    }

    if (
      body.decision !== "approved" &&
      body.decision !== "rejected"
    ) {
      return apiError({
        requestId,
        status: 400,
        error: "Invalid review decision",
        code: "DOCUMENT_REVIEW_DECISION_INVALID",
        message:
          "The review decision must be approved or rejected.",
      });
    }

    if (
      body.decision === "rejected" &&
      !String(body.rejectionReason || "").trim()
    ) {
      return apiError({
        requestId,
        status: 400,
        error: "Rejection reason is required",
        code: "DOCUMENT_REJECTION_REASON_REQUIRED",
        message:
          "Enter a reason before rejecting the document.",
      });
    }

    if (
      !isDateOrEmpty(body.issueDate) ||
      !isDateOrEmpty(body.expiryDate)
    ) {
      return apiError({
        requestId,
        status: 400,
        error: "Invalid document date",
        code: "DOCUMENT_REVIEW_DATE_INVALID",
        message:
          "Issue and expiry dates must use YYYY-MM-DD.",
      });
    }

    const issueDate =
      typeof body.issueDate === "string" &&
      body.issueDate
        ? body.issueDate
        : null;

    const expiryDate =
      typeof body.expiryDate === "string" &&
      body.expiryDate
        ? body.expiryDate
        : null;

    if (
      issueDate &&
      expiryDate &&
      expiryDate < issueDate
    ) {
      return apiError({
        requestId,
        status: 400,
        error: "Document dates are invalid",
        code: "DOCUMENT_REVIEW_DATE_RANGE_INVALID",
        message:
          "The expiry date cannot be earlier than the issue date.",
        details: {
          issueDate,
          expiryDate,
        },
      });
    }

    const { data: existingData, error: lookupError } =
      await supabaseAdmin
        .from(DOCUMENTS_TABLE)
        .select("*")
        .eq("id", documentId)
        .maybeSingle();

    if (lookupError) {
      return apiError({
        requestId,
        status: 500,
        error: "Document lookup failed",
        code:
          lookupError.code ||
          "DOCUMENT_LOOKUP_FAILED",
        message:
          lookupError.message ||
          "The Event Hub document could not be loaded.",
        details: lookupError.details || null,
        hint: lookupError.hint || null,
      });
    }

    if (!existingData) {
      return apiError({
        requestId,
        status: 404,
        error: "Document not found",
        code: "DOCUMENT_NOT_FOUND",
        message:
          "The Event Hub document could not be found.",
      });
    }

    const existing =
      existingData as unknown as Record<
        string,
        unknown
      >;

    if (
      Boolean(existing.is_archived) ||
      !Boolean(existing.is_current_version)
    ) {
      try {
        await writeReviewAudit({
          actor,
          request,
          requestId,
          existing,
          action:
            "event_document_review_denied",
          actionLabel:
            "Event document review denied",
          status: "blocked",
          responseStatus: 409,
          summary:
            "A document review was blocked because the document was archived or was not the current version.",
          metadata: {
            requested_decision:
              body.decision,
            is_archived:
              Boolean(existing.is_archived),
            is_current_version:
              Boolean(
                existing.is_current_version,
              ),
            failure_code:
              "DOCUMENT_REVIEW_NOT_ALLOWED",
          },
          strict: false,
        });
      } catch (auditError) {
        console.error(
          "Failed to audit blocked document review",
          {
            requestId,
            documentId,
            auditError,
          },
        );
      }

      return apiError({
        requestId,
        status: 409,
        error: "Document cannot be reviewed",
        code: "DOCUMENT_REVIEW_NOT_ALLOWED",
        message:
          "Only a current, non-archived document can be reviewed.",
      });
    }

    const reviewNotes =
      typeof body.reviewNotes === "string" &&
      body.reviewNotes.trim()
        ? body.reviewNotes.trim()
        : null;

    const rejectionReason =
      body.decision === "rejected"
        ? String(
            body.rejectionReason || "",
          ).trim()
        : null;

    const organisationName =
      typeof body.organisationName === "string" &&
      body.organisationName.trim()
        ? body.organisationName.trim()
        : null;

    const now = new Date().toISOString();

    const updatePayload = {
      status: body.decision,
      issue_date: issueDate,
      expiry_date: expiryDate,
      organisation_name:
        organisationName,
      review_notes: reviewNotes,
      rejection_reason:
        rejectionReason,
      reviewed_at: now,
      updated_at: now,
    };

    const { data: updatedData, error: updateError } =
      await supabaseAdmin
        .from(DOCUMENTS_TABLE)
        .update(updatePayload)
        .eq("id", documentId)
        .select("*")
        .single();

    if (updateError) {
      try {
        await writeReviewAudit({
          actor,
          request,
          requestId,
          existing,
          action:
            "event_document_review_failed",
          actionLabel:
            "Event document review failed",
          status: "failed",
          responseStatus: 500,
          summary:
            "An Event Hub document review could not be saved.",
          metadata: {
            requested_decision:
              body.decision,
            error_code:
              updateError.code || null,
            error_message:
              updateError.message || null,
          },
          strict: false,
        });
      } catch (auditError) {
        console.error(
          "Failed to audit document review failure",
          {
            requestId,
            documentId,
            auditError,
          },
        );
      }

      return apiError({
        requestId,
        status: 500,
        error:
          "Document review update failed",
        code:
          updateError.code ||
          "DOCUMENT_REVIEW_UPDATE_FAILED",
        message:
          updateError.message ||
          "The document review could not be saved.",
        details:
          updateError.details || null,
        hint:
          updateError.hint || null,
      });
    }

    const updated =
      updatedData as unknown as Record<
        string,
        unknown
      >;

    const action =
      body.decision === "approved"
        ? "event_document_approved"
        : "event_document_rejected";

    const actionLabel =
      body.decision === "approved"
        ? "Event document approved"
        : "Event document rejected";

    const summary =
      body.decision === "approved"
        ? "An Event Hub document was reviewed and approved."
        : "An Event Hub document was reviewed and rejected.";

    let auditLogged = true;
    let auditWarning: {
      error: string;
    } | null = null;

    try {
      await writeReviewAudit({
        actor,
        request,
        requestId,
        existing,
        updated,
        action,
        actionLabel,
        status: "success",
        responseStatus: 200,
        summary,
        metadata: {
          decision: body.decision,
          has_review_notes:
            Boolean(reviewNotes),
          has_rejection_reason:
            Boolean(rejectionReason),
          issue_date_changed:
            existing.issue_date !==
            updated.issue_date,
          expiry_date_changed:
            existing.expiry_date !==
            updated.expiry_date,
          organisation_changed:
            existing.organisation_name !==
            updated.organisation_name,
        },
        strict: false,
      });
    } catch (auditError) {
      auditLogged = false;
      auditWarning = {
        error: safeErrorMessage(auditError),
      };

      console.error(
        "Event document review audit failed",
        {
          requestId,
          documentId,
          action,
          auditError,
        },
      );
    }

    return json(
      {
        ok: true,
        success: true,
        message:
          body.decision === "approved"
            ? "Document approved successfully."
            : "Document rejected successfully.",
        document: updated,
        auditLogged,
        auditWarning,
        requestId,
      },
      200,
      requestId,
    );
  } catch (error) {
    console.error(
      "Unexpected Event document review error",
      {
        requestId,
        error,
      },
    );

    return apiError({
      requestId,
      status: 500,
      error:
        "Unexpected document review error",
      code:
        "DOCUMENT_REVIEW_UNEXPECTED",
      message: safeErrorMessage(error),
      hint:
        "Check the Next.js server logs using the request ID.",
    });
  }
}
