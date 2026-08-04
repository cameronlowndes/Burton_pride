import { randomUUID } from "crypto";

import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

import { requireMainAdmin } from "@/lib/adminPermissions";
import {
  createEventAuditLog,
  requireEventAuditPermission,
} from "@/lib/event-hub-app/event-audit";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOCUMENTS_TABLE = "event_documents";
const DELETE_SETTINGS_TABLE = "admin_delete_settings";
const EVENT_AUDIT_ENDPOINT =
  "/api/admin/burton-pride-event-hub/audit-log";

/**
 * This intentionally uses the same password record as:
 * /api/admin/settings/delete-password
 *
 * Change this only if you later create a separate password for Event Hub
 * document deletion.
 */
const ACTION_KEY = "delete_all_donations";

type RouteContext = {
  params: Promise<{ documentId: string }>;
};

type DeleteRequestBody = {
  mainAdminPassword?: string;
  password?: string;
  adminPassword?: string;
  confirmation?: string;
};

type JsonRecord = Record<string, unknown>;

type DeletePasswordCheck =
  | {
      ok: true;
    }
  | {
      ok: false;
      status: number;
      error: string;
      code: string;
      likelyFix?: string;
      details?: unknown;
    };

type EventAuditStatus =
  | "started"
  | "success"
  | "failed"
  | "denied";

type EventAuditInput = {
  action: string;
  actionLabel: string;
  description: string;
  status: EventAuditStatus;
  eventId?: string | null;
  documentId?: string | null;
  documentTitle?: string | null;
  requestId: string;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

type EventAuditResult = {
  ok: boolean;
  status?: number;
  error?: string;
  response?: unknown;
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

function getStatusFromPermissionError(error: unknown) {
  const message =
    error instanceof Error ? error.message.toLowerCase() : "";

  if (
    message.includes("unauthorized") ||
    message.includes("sign in") ||
    message.includes("session")
  ) {
    return 401;
  }

  if (
    message.includes("main admin") ||
    message.includes("permission") ||
    message.includes("access required")
  ) {
    return 403;
  }

  return 500;
}


function getRequestAuditMetadata(request: NextRequest) {
  const forwardedFor =
    request.headers.get("x-forwarded-for") || "";
  const ipAddress =
    forwardedFor.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;

  return {
    ipAddress,
    userAgent: request.headers.get("user-agent") || null,
    route: request.nextUrl.pathname,
    method: request.method,
  };
}

/**
 * Reports the action through the existing Event Hub audit API.
 *
 * Audit failures are returned to the caller so the main API can include a
 * warning or fail safely where appropriate. Passwords and hashes must never be
 * passed into this function.
 */
async function reportEventAudit({
  request,
  input,
}: {
  request: NextRequest;
  input: EventAuditInput;
}): Promise<EventAuditResult> {
  try {
    const auditUrl = new URL(
      EVENT_AUDIT_ENDPOINT,
      request.nextUrl.origin,
    );

    const cookieHeader =
      request.headers.get("cookie") || "";

    const requestMetadata =
      getRequestAuditMetadata(request);

    const response = await fetch(auditUrl, {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        "x-event-audit-source": "event_documents",
        "x-parent-request-id": input.requestId,
      },
      body: JSON.stringify({
        action: input.action,
        action_key: input.action,
        actionLabel: input.actionLabel,
        action_label: input.actionLabel,
        description: input.description,
        status: input.status,

        eventId: input.eventId || null,
        event_id: input.eventId || null,

        entityType: "event_document",
        entity_type: "event_document",
        entityId: input.documentId || null,
        entity_id: input.documentId || null,

        documentId: input.documentId || null,
        document_id: input.documentId || null,
        documentTitle: input.documentTitle || null,
        document_title: input.documentTitle || null,

        requestId: input.requestId,
        request_id: input.requestId,

        beforeData: input.beforeData || null,
        before_data: input.beforeData || null,
        afterData: input.afterData || null,
        after_data: input.afterData || null,

        metadata: {
          ...(input.metadata || {}),
          ...requestMetadata,
          source: "event_documents_api",
        },

        ipAddress: requestMetadata.ipAddress,
        ip_address: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        user_agent: requestMetadata.userAgent,
      }),
    });

    const payload = await response
      .json()
      .catch(async () => ({
        raw: await response.text().catch(() => ""),
      }));

    if (!response.ok) {
      console.error("Event Hub audit report failed", {
        parentRequestId: input.requestId,
        auditStatus: response.status,
        auditAction: input.action,
        payload,
      });

      return {
        ok: false,
        status: response.status,
        error:
          payload &&
          typeof payload === "object" &&
          "error" in payload
            ? String(
                (payload as Record<string, unknown>).error,
              )
            : "Event Hub audit API rejected the entry.",
        response: payload,
      };
    }

    return {
      ok: true,
      status: response.status,
      response: payload,
    };
  } catch (error) {
    console.error("Event Hub audit request failed", {
      parentRequestId: input.requestId,
      auditAction: input.action,
      error,
    });

    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown Event Hub audit error.",
    };
  }
}

async function verifyMainAdminDeletePassword(
  suppliedPassword: string,
): Promise<DeletePasswordCheck> {
  const { data: setting, error } = await supabaseAdmin
    .from(DELETE_SETTINGS_TABLE)
    .select("id,action_key,password_hash,updated_at")
    .eq("action_key", ACTION_KEY)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      status: 500,
      error: "Failed to read the main-admin delete password.",
      code: error.code || "DELETE_PASSWORD_LOOKUP_FAILED",
      likelyFix:
        "Check admin_delete_settings exists and contains action_key and password_hash columns.",
      details: {
        message: error.message,
        details: error.details,
        hint: error.hint,
        table: DELETE_SETTINGS_TABLE,
        actionKey: ACTION_KEY,
      },
    };
  }

  if (!setting?.password_hash) {
    return {
      ok: false,
      status: 400,
      error:
        "No main-admin delete password has been configured.",
      code: "MAIN_ADMIN_DELETE_PASSWORD_NOT_SET",
      likelyFix:
        "Open Main Admin Delete Password settings and set the password first.",
      details: {
        table: DELETE_SETTINGS_TABLE,
        actionKey: ACTION_KEY,
      },
    };
  }

  let passwordMatches = false;

  try {
    passwordMatches = await bcrypt.compare(
      suppliedPassword,
      setting.password_hash,
    );
  } catch (error) {
    return {
      ok: false,
      status: 500,
      error:
        "The saved main-admin password hash could not be checked.",
      code: "DELETE_PASSWORD_HASH_COMPARE_FAILED",
      likelyFix:
        "Reset the main-admin delete password so a valid bcrypt hash is saved.",
      details:
        error instanceof Error ? error.message : String(error),
    };
  }

  if (!passwordMatches) {
    return {
      ok: false,
      status: 403,
      error: "Main-admin password is incorrect.",
      code: "MAIN_ADMIN_PASSWORD_INCORRECT",
      likelyFix:
        "Check the password and try again. Nothing has been deleted.",
    };
  }

  return {
    ok: true,
  };
}

async function removeStoredDocumentFile({
  bucket,
  path,
}: {
  bucket: string;
  path: string;
}) {
  if (!bucket || !path) {
    return {
      ok: true as const,
      skipped: true,
    };
  }

  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .remove([path]);

  if (error) {
    return {
      ok: false as const,
      error,
    };
  }

  return {
    ok: true as const,
    skipped: false,
  };
}


type PatchRouteContext = {
  params: Promise<{ documentId: string }>;
};

type PatchBody = {
  event_id?: string;
  title?: string;
  description?: string | null;
  category?: string;
  organisation_name?: string | null;
  document_reference?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  status?: string;
  version_number?: number;
  is_required?: boolean;
  is_confidential?: boolean;
  is_current_version?: boolean;
  is_archived?: boolean;
  notes?: string | null;
};

const ALLOWED_DOCUMENT_STATUSES = new Set([
  "draft",
  "uploaded",
  "awaiting_review",
  "approved",
  "rejected",
  "expired",
  "replaced",
  "archived",
]);

const ALLOWED_DOCUMENT_CATEGORIES = new Set([
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

function cleanNullableString(value: unknown) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).trim();
  return cleaned || null;
}

function validDateOrNull(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value))
  );
}

export async function PATCH(
  request: NextRequest,
  context: PatchRouteContext,
) {
  const requestId = randomUUID();

  let actor: Awaited<
    ReturnType<typeof requireEventAuditPermission>
  >;

  try {
    actor = await requireEventAuditPermission(
      "event_audit:view",
    );
  } catch (error) {
    const status = getStatusFromPermissionError(error);

    return apiError({
      requestId,
      status,
      error:
        status === 401
          ? "Authentication required"
          : "Document update access denied",
      code:
        status === 401
          ? "ADMIN_SESSION_REQUIRED"
          : "EVENT_DOCUMENT_UPDATE_DENIED",
      message:
        error instanceof Error
          ? error.message
          : "You do not have permission to update Event Hub documents.",
      hint:
        status === 401
          ? "Sign out and sign back in."
          : "Ask a main admin to grant Event Hub document access.",
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

    const body = (await request.json().catch(() => null)) as
      | PatchBody
      | null;

    if (!body) {
      return apiError({
        requestId,
        status: 400,
        error: "Invalid request body",
        code: "DOCUMENT_UPDATE_BODY_INVALID",
        message:
          "The update request must contain valid JSON.",
      });
    }

    const { data: existing, error: lookupError } =
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
          lookupError.code || "DOCUMENT_LOOKUP_FAILED",
        message:
          lookupError.message ||
          "The Event Hub document could not be loaded.",
        details: lookupError.details || null,
        hint: lookupError.hint || null,
      });
    }

    if (!existing) {
      return apiError({
        requestId,
        status: 404,
        error: "Document not found",
        code: "DOCUMENT_NOT_FOUND",
        message:
          "The Event Hub document could not be found.",
      });
    }

    const title =
      body.title !== undefined
        ? String(body.title).trim()
        : String(existing.title || "");

    if (!title) {
      return apiError({
        requestId,
        status: 400,
        error: "Document title is required",
        code: "DOCUMENT_TITLE_REQUIRED",
        message:
          "Enter a title before saving the document.",
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
        details: {
          titleLength: title.length,
        },
      });
    }

    const eventId =
      body.event_id !== undefined
        ? String(body.event_id).trim()
        : String(existing.event_id || "");

    if (!eventId || !isUuid(eventId)) {
      return apiError({
        requestId,
        status: 400,
        error: "Invalid event ID",
        code: "EVENT_ID_INVALID",
        message:
          "Select a valid Event Hub event.",
        details: {
          eventId: eventId || null,
        },
      });
    }

    const category =
      body.category !== undefined
        ? String(body.category).trim()
        : String(existing.category || "");

    if (!ALLOWED_DOCUMENT_CATEGORIES.has(category)) {
      return apiError({
        requestId,
        status: 400,
        error: "Invalid document category",
        code: "DOCUMENT_CATEGORY_INVALID",
        message:
          "The selected document category is not supported.",
        details: {
          category,
        },
      });
    }

    const statusValue =
      body.status !== undefined
        ? String(body.status).trim()
        : String(existing.status || "");

    if (!ALLOWED_DOCUMENT_STATUSES.has(statusValue)) {
      return apiError({
        requestId,
        status: 400,
        error: "Invalid document status",
        code: "DOCUMENT_STATUS_INVALID",
        message:
          "The selected document status is not supported.",
        details: {
          status: statusValue,
        },
      });
    }

    if (
      !validDateOrNull(body.issue_date) ||
      !validDateOrNull(body.expiry_date)
    ) {
      return apiError({
        requestId,
        status: 400,
        error: "Invalid document date",
        code: "DOCUMENT_DATE_INVALID",
        message:
          "Issue and expiry dates must use YYYY-MM-DD.",
      });
    }

    const issueDate =
      body.issue_date !== undefined
        ? cleanNullableString(body.issue_date)
        : existing.issue_date;

    const expiryDate =
      body.expiry_date !== undefined
        ? cleanNullableString(body.expiry_date)
        : existing.expiry_date;

    if (
      issueDate &&
      expiryDate &&
      String(expiryDate) < String(issueDate)
    ) {
      return apiError({
        requestId,
        status: 400,
        error: "Document dates are invalid",
        code: "DOCUMENT_DATE_RANGE_INVALID",
        message:
          "The expiry date cannot be earlier than the issue date.",
        details: {
          issueDate,
          expiryDate,
        },
      });
    }

    const versionNumber =
      body.version_number !== undefined
        ? Number(body.version_number)
        : Number(existing.version_number || 1);

    if (
      !Number.isInteger(versionNumber) ||
      versionNumber < 1 ||
      versionNumber > 999
    ) {
      return apiError({
        requestId,
        status: 400,
        error: "Invalid version number",
        code: "DOCUMENT_VERSION_INVALID",
        message:
          "The version number must be a whole number between 1 and 999.",
      });
    }

    const updatePayload = {
      event_id: eventId,
      title,
      description:
        body.description !== undefined
          ? cleanNullableString(body.description)
          : existing.description,
      category,
      organisation_name:
        body.organisation_name !== undefined
          ? cleanNullableString(body.organisation_name)
          : existing.organisation_name,
      document_reference:
        body.document_reference !== undefined
          ? cleanNullableString(body.document_reference)
          : existing.document_reference,
      issue_date: issueDate,
      expiry_date: expiryDate,
      status: statusValue,
      version_number: versionNumber,
      is_required:
        body.is_required !== undefined
          ? Boolean(body.is_required)
          : Boolean(existing.is_required),
      is_confidential:
        body.is_confidential !== undefined
          ? Boolean(body.is_confidential)
          : Boolean(existing.is_confidential),
      is_current_version:
        body.is_current_version !== undefined
          ? Boolean(body.is_current_version)
          : Boolean(existing.is_current_version),
      is_archived:
        body.is_archived !== undefined
          ? Boolean(body.is_archived)
          : Boolean(existing.is_archived),
      notes:
        body.notes !== undefined
          ? cleanNullableString(body.notes)
          : existing.notes,
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error: updateError } =
      await supabaseAdmin
        .from(DOCUMENTS_TABLE)
        .update(updatePayload)
        .eq("id", documentId)
        .select("*")
        .single();

    if (updateError) {
      try {
        await createEventAuditLog({
          actor,
          eventId: existing.event_id,
          action: "event_document_update_failed",
          actionLabel: "Event document update failed",
          area: "documents",
          status: "failed",
          riskLevel: existing.is_confidential
            ? "high"
            : "medium",
          record: {
            type: "event_document",
            id: documentId,
            title: existing.title,
          },
          summary:
            "Changes to an Event Hub document could not be saved.",
          before: existing,
          metadata: {
            request_id: requestId,
            error_code: updateError.code || null,
            error_message: updateError.message || null,
            changed_fields: Object.keys(updatePayload),
          },
          request,
          responseStatus: 500,
          isConfidential:
            Boolean(existing.is_confidential),
          requiresReview: false,
          strict: false,
        });
      } catch (auditError) {
        console.error(
          "Failed to audit Event document update failure",
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
        error: "Document update failed",
        code:
          updateError.code || "DOCUMENT_UPDATE_FAILED",
        message:
          updateError.message ||
          "The Event Hub document could not be updated.",
        details: updateError.details || null,
        hint: updateError.hint || null,
      });
    }

    let auditLogged = true;
    let auditWarning: string | null = null;

    try {
      await createEventAuditLog({
        actor,
        eventId: updated.event_id,
        action: "event_document_updated",
        actionLabel: "Event document updated",
        area: "documents",
        status: "success",
        riskLevel: updated.is_confidential
          ? "high"
          : "medium",
        record: {
          type: "event_document",
          id: documentId,
          title: updated.title,
        },
        summary:
          "An Event Hub document record was updated.",
        before: existing,
        after: updated,
        metadata: {
          request_id: requestId,
          changed_fields: Object.keys(updatePayload).filter(
            (field) => field !== "updated_at",
          ),
        },
        request,
        responseStatus: 200,
        isConfidential:
          Boolean(updated.is_confidential),
        requiresReview: false,
        strict: false,
      });
    } catch (auditError) {
      auditLogged = false;
      auditWarning =
        auditError instanceof Error
          ? auditError.message
          : "The update succeeded but the audit log failed.";

      console.error(
        "Event document update audit failed",
        {
          requestId,
          documentId,
          auditError,
        },
      );
    }

    return json(
      {
        ok: true,
        success: true,
        message:
          "Document details updated successfully.",
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
      "Unexpected Event document PATCH error",
      {
        requestId,
        error,
      },
    );

    return apiError({
      requestId,
      status: 500,
      error: "Unexpected document update error",
      code: "DOCUMENT_UPDATE_UNEXPECTED",
      message:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while updating the document.",
      hint:
        "Check the Next.js server logs using the request ID.",
    });
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
) {
  const requestId = randomUUID();

  try {
    await requireMainAdmin();
  } catch (error) {
    const status = getStatusFromPermissionError(error);
    const message =
      error instanceof Error
        ? error.message
        : "Main-admin access is required.";

    return apiError({
      requestId,
      status,
      error:
        status === 401
          ? "Authentication required"
          : status === 403
            ? "Main-admin access required"
            : "Admin permission check failed",
      code:
        status === 401
          ? "ADMIN_SESSION_REQUIRED"
          : status === 403
            ? "MAIN_ADMIN_REQUIRED"
            : "MAIN_ADMIN_CHECK_FAILED",
      message,
      hint:
        status === 401
          ? "Sign out and sign back in."
          : status === 403
            ? "Only a main_admin account can permanently delete documents."
            : "Check the server logs for the full permission error.",
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

    const body = (await request.json().catch(() => null)) as
      | DeleteRequestBody
      | null;

    if (!body) {
      return apiError({
        requestId,
        status: 400,
        error: "Invalid request body",
        code: "DOCUMENT_DELETE_BODY_INVALID",
        message:
          "The permanent-delete request must contain valid JSON.",
      });
    }

    const confirmation = String(
      body.confirmation || "",
    ).trim();

    if (confirmation !== "DELETE") {
      return apiError({
        requestId,
        status: 400,
        error: "Delete confirmation is incorrect",
        code: "DELETE_CONFIRMATION_INVALID",
        message:
          'Type the word "DELETE" exactly in capital letters.',
        details: {
          receivedConfirmation: confirmation || null,
        },
      });
    }

    const suppliedPassword = String(
      body.mainAdminPassword ||
        body.password ||
        body.adminPassword ||
        "",
    );

    if (!suppliedPassword) {
      return apiError({
        requestId,
        status: 400,
        error: "Main-admin password is required",
        code: "MAIN_ADMIN_PASSWORD_REQUIRED",
        message:
          "Enter the main-admin delete password before continuing.",
      });
    }

    const passwordCheck =
      await verifyMainAdminDeletePassword(suppliedPassword);

    if (!passwordCheck.ok) {
      await reportEventAudit({
        request,
        input: {
          action: "event_document_delete_denied",
          actionLabel: "Event document deletion denied",
          description:
            "A permanent document deletion was denied because the main-admin password check failed.",
          status: "denied",
          documentId,
          requestId,
          metadata: {
            failureCode: passwordCheck.code,
            httpStatus: passwordCheck.status,
            passwordWasSupplied: true,
          },
        },
      });

      return apiError({
        requestId,
        status: passwordCheck.status,
        error: "Document deletion password check failed",
        code: passwordCheck.code,
        message: passwordCheck.error,
        details: passwordCheck.details,
        hint: passwordCheck.likelyFix || null,
      });
    }

    const { data: document, error: documentError } =
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
          ].join(","),
        )
        .eq("id", documentId)
        .maybeSingle();

    if (documentError) {
      return apiError({
        requestId,
        status: 500,
        error: "Document lookup failed",
        code:
          documentError.code || "DOCUMENT_LOOKUP_FAILED",
        message:
          documentError.message ||
          "Unable to load the document before deletion.",
        details: {
          message: documentError.message,
          details: documentError.details,
          hint: documentError.hint,
          documentId,
        },
        hint: documentError.hint || null,
      });
    }

    if (!document) {
      await reportEventAudit({
        request,
        input: {
          action: "event_document_delete_failed",
          actionLabel: "Event document deletion failed",
          description:
            "A permanent document deletion was requested, but the document could not be found.",
          status: "failed",
          documentId,
          requestId,
          metadata: {
            failureCode: "DOCUMENT_NOT_FOUND",
          },
        },
      });

      return apiError({
        requestId,
        status: 404,
        error: "Document not found",
        code: "DOCUMENT_NOT_FOUND",
        message:
          "The Event Hub document could not be found.",
        details: {
          documentId,
        },
      });
    }

    const documentRecord =
      document as unknown as Record<string, unknown>;

    const storageBucket =
      typeof documentRecord.storage_bucket === "string"
        ? documentRecord.storage_bucket
        : "";

    const storagePath =
      typeof documentRecord.storage_path === "string"
        ? documentRecord.storage_path
        : "";

    const deletionStartedAudit =
      await reportEventAudit({
        request,
        input: {
          action: "event_document_delete_started",
          actionLabel: "Event document deletion started",
          description:
            "A main admin confirmed permanent deletion of an Event Hub document.",
          status: "started",
          eventId:
            typeof documentRecord.event_id === "string"
              ? documentRecord.event_id
              : null,
          documentId,
          documentTitle:
            typeof documentRecord.title === "string"
              ? documentRecord.title
              : null,
          requestId,
          beforeData: {
            id: documentId,
            event_id: documentRecord.event_id || null,
            title: documentRecord.title || null,
            original_file_name:
              documentRecord.original_file_name || null,
            storage_bucket: storageBucket || null,
            storage_path: storagePath || null,
          },
          metadata: {
            passwordActionKey: ACTION_KEY,
            confirmationMatched: true,
          },
        },
      });

    if (!deletionStartedAudit.ok) {
      return apiError({
        requestId,
        status: 502,
        error: "Audit logging failed",
        code: "EVENT_DOCUMENT_DELETE_AUDIT_START_FAILED",
        message:
          "The document was not deleted because the Event Hub audit entry could not be recorded.",
        details: deletionStartedAudit.response || {
          error: deletionStartedAudit.error,
          status: deletionStartedAudit.status,
        },
        hint:
          "Check /api/admin/burton-pride-event-hub/audit-log and retry. No document data has been removed.",
      });
    }

    const storageDeleteResult =
      await removeStoredDocumentFile({
        bucket: storageBucket,
        path: storagePath,
      });

    if (!storageDeleteResult.ok) {
      await reportEventAudit({
        request,
        input: {
          action: "event_document_delete_failed",
          actionLabel: "Event document deletion failed",
          description:
            "Permanent deletion failed while removing the document from Supabase Storage.",
          status: "failed",
          eventId:
            typeof documentRecord.event_id === "string"
              ? documentRecord.event_id
              : null,
          documentId,
          documentTitle:
            typeof documentRecord.title === "string"
              ? documentRecord.title
              : null,
          requestId,
          beforeData: {
            id: documentId,
            storage_bucket: storageBucket || null,
            storage_path: storagePath || null,
          },
          metadata: {
            failureStage: "storage_delete",
            failureCode:
              storageDeleteResult.error.name ||
              "DOCUMENT_STORAGE_DELETE_FAILED",
            failureMessage:
              storageDeleteResult.error.message || null,
          },
        },
      });

      return apiError({
        requestId,
        status: 500,
        error: "Stored document file deletion failed",
        code:
          storageDeleteResult.error.name ||
          "DOCUMENT_STORAGE_DELETE_FAILED",
        message:
          storageDeleteResult.error.message ||
          "The private document file could not be deleted.",
        details: {
          bucket: storageBucket,
          path: storagePath,
        },
        hint:
          "The database row has not been deleted. Check the Supabase Storage path and try again.",
      });
    }

    const { data: deletedRows, error: deleteError } =
      await supabaseAdmin
        .from(DOCUMENTS_TABLE)
        .delete()
        .eq("id", documentId)
        .select("id");

    if (deleteError) {
      await reportEventAudit({
        request,
        input: {
          action: "event_document_delete_failed",
          actionLabel: "Event document deletion failed",
          description:
            "The stored file was removed, but permanent deletion of the Event Hub database row failed.",
          status: "failed",
          eventId:
            typeof documentRecord.event_id === "string"
              ? documentRecord.event_id
              : null,
          documentId,
          documentTitle:
            typeof documentRecord.title === "string"
              ? documentRecord.title
              : null,
          requestId,
          beforeData: {
            id: documentId,
            event_id: documentRecord.event_id || null,
            title: documentRecord.title || null,
          },
          metadata: {
            failureStage: "database_delete",
            failureCode:
              deleteError.code ||
              "DOCUMENT_DATABASE_DELETE_FAILED",
            failureMessage: deleteError.message || null,
            storageFileAlreadyDeleted:
              !storageDeleteResult.skipped,
          },
        },
      });

      return apiError({
        requestId,
        status: 500,
        error: "Document database deletion failed",
        code:
          deleteError.code ||
          "DOCUMENT_DATABASE_DELETE_FAILED",
        message:
          deleteError.message ||
          "The Event Hub document row could not be deleted.",
        details: {
          message: deleteError.message,
          details: deleteError.details,
          hint: deleteError.hint,
          documentId,
          storageFileAlreadyDeleted:
            !storageDeleteResult.skipped,
        },
        hint:
          deleteError.hint ||
          "Check for foreign-key references to this document.",
      });
    }

    if (!deletedRows || deletedRows.length === 0) {
      await reportEventAudit({
        request,
        input: {
          action: "event_document_delete_failed",
          actionLabel: "Event document deletion failed",
          description:
            "The permanent delete query completed, but no Event Hub document row was removed.",
          status: "failed",
          eventId:
            typeof documentRecord.event_id === "string"
              ? documentRecord.event_id
              : null,
          documentId,
          documentTitle:
            typeof documentRecord.title === "string"
              ? documentRecord.title
              : null,
          requestId,
          metadata: {
            failureStage: "database_delete",
            failureCode: "DOCUMENT_DELETE_NO_ROWS",
            storageFileAlreadyDeleted:
              !storageDeleteResult.skipped,
          },
        },
      });

      return apiError({
        requestId,
        status: 409,
        error: "Document was not deleted",
        code: "DOCUMENT_DELETE_NO_ROWS",
        message:
          "The delete query completed but no document row was removed.",
        details: {
          documentId,
          storageFileAlreadyDeleted:
            !storageDeleteResult.skipped,
        },
        hint:
          "Check the document ID, service-role Supabase client, and Row Level Security configuration.",
      });
    }

    const deletionCompletedAudit =
      await reportEventAudit({
        request,
        input: {
          action: "event_document_deleted",
          actionLabel: "Event document permanently deleted",
          description:
            "A main admin permanently deleted an Event Hub document and its private stored file.",
          status: "success",
          eventId:
            typeof documentRecord.event_id === "string"
              ? documentRecord.event_id
              : null,
          documentId,
          documentTitle:
            typeof documentRecord.title === "string"
              ? documentRecord.title
              : null,
          requestId,
          beforeData: {
            id: documentId,
            event_id: documentRecord.event_id || null,
            title: documentRecord.title || null,
            original_file_name:
              documentRecord.original_file_name || null,
            storage_bucket: storageBucket || null,
            storage_path: storagePath || null,
          },
          afterData: {
            deleted: true,
            databaseRowDeleted: true,
            storageFileDeleted:
              !storageDeleteResult.skipped,
          },
          metadata: {
            passwordActionKey: ACTION_KEY,
            deletionType: "permanent",
          },
        },
      });

    console.info("Event document permanently deleted", {
      requestId,
      documentId,
      eventId: documentRecord.event_id || null,
      title: documentRecord.title || null,
      originalFileName:
        documentRecord.original_file_name || null,
      passwordActionKey: ACTION_KEY,
      storageFileDeleted:
        !storageDeleteResult.skipped,
    });

    return json(
      {
        ok: true,
        success: true,
        message:
          "The document and its stored file were permanently deleted.",
        deletedDocumentId: documentId,
        deletedDocument: {
          id: documentId,
          eventId: documentRecord.event_id || null,
          title: documentRecord.title || null,
          originalFileName:
            documentRecord.original_file_name || null,
        },
        passwordActionKey: ACTION_KEY,
        auditLogged: deletionCompletedAudit.ok,
        auditWarning: deletionCompletedAudit.ok
          ? null
          : {
              status: deletionCompletedAudit.status || null,
              error: deletionCompletedAudit.error || null,
            },
        requestId,
      },
      200,
      requestId,
    );
  } catch (error) {
    console.error(
      "Permanent Event Hub document deletion failed",
      {
        requestId,
        error,
      },
    );

    return apiError({
      requestId,
      status: 500,
      error: "Unexpected deletion error",
      code: "DOCUMENT_DELETE_UNEXPECTED",
      message:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while permanently deleting the document.",
      hint:
        "Check the Next.js server logs using the request ID returned by this response.",
    });
  }
}
