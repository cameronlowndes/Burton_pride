import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { sendBugFixedEmail } from "@/lib/bugsReporting/sendBugReportEmail";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUGS_TABLE = "admin_bug_reports";

type RouteContext = {
  params: Promise<{
    bugId: string;
  }>;
};

type JsonRecord = Record<string, unknown>;

type BugPriority =
  | "minor"
  | "normal"
  | "senior"
  | "critical";

type BugStatus =
  | "reported"
  | "open"
  | "investigating"
  | "in_progress"
  | "waiting"
  | "fix"
  | "resolved"
  | "closed"
  | "rejected";

type EmailNotification = {
  required: boolean;
  sent: boolean;
  recipient: string | null;
  email_id: string | null;
  provider: "Resend";
  operation: "sendBugFixedEmail";
  request_id: string;
  http_status: number | null;
  error: string | null;
  error_code: string | null;
  details: string | null;
  hint: string | null;
  timestamp: string;
};

const ALLOWED_PRIORITIES = new Set<BugPriority>([
  "minor",
  "normal",
  "senior",
  "critical",
]);

const ALLOWED_STATUSES = new Set<BugStatus>([
  "reported",
  "open",
  "investigating",
  "in_progress",
  "waiting",
  "fix",
  "resolved",
  "closed",
  "rejected",
]);

const COMPLETED_STATUSES = new Set<BugStatus>([
  "fix",
  "resolved",
  "closed",
]);

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

function createErrorCode(
  operation: string,
  status: number,
) {
  return `BUG-TRACKER-${operation}-${status}-${Date.now()
    .toString(36)
    .toUpperCase()}`;
}

function errorResponse({
  status,
  operation,
  message,
  bugId,
  details,
  hint,
  databaseCode,
  requestId,
}: {
  status: number;
  operation: string;
  message: string;
  bugId?: string;
  details?: string | null;
  hint?: string | null;
  databaseCode?: string | null;
  requestId: string;
}) {
  return json(
    {
      success: false,
      error: message,
      message,
      error_code: createErrorCode(
        operation,
        status,
      ),
      operation,
      bug_id: bugId || null,
      database_code: databaseCode || null,
      details: details || null,
      hint: hint || null,
      request_id: requestId,
      timestamp: new Date().toISOString(),
    },
    status,
    {
      "x-request-id": requestId,
    },
  );
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function readOptionalString(
  value: unknown,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  return trimmed || null;
}

function readString(
  record: Record<string, unknown>,
  ...keys: string[]
) {
  for (const key of keys) {
    const value = record[key];

    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return null;
}

function isPriority(
  value: unknown,
): value is BugPriority {
  return (
    typeof value === "string" &&
    ALLOWED_PRIORITIES.has(
      value as BugPriority,
    )
  );
}

function isStatus(
  value: unknown,
): value is BugStatus {
  return (
    typeof value === "string" &&
    ALLOWED_STATUSES.has(
      value as BugStatus,
    )
  );
}

function isCompletedStatus(
  value: unknown,
) {
  return (
    typeof value === "string" &&
    COMPLETED_STATUSES.has(
      value as BugStatus,
    )
  );
}

function createEmailNotification({
  required,
  recipient,
  requestId,
}: {
  required: boolean;
  recipient: string | null;
  requestId: string;
}): EmailNotification {
  return {
    required,
    sent: false,
    recipient,
    email_id: null,
    provider: "Resend",
    operation: "sendBugFixedEmail",
    request_id: requestId,
    http_status: null,
    error: null,
    error_code: null,
    details: null,
    hint: null,
    timestamp: new Date().toISOString(),
  };
}

function getEmailError(
  error: unknown,
) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack:
        process.env.NODE_ENV ===
        "development"
          ? error.stack || null
          : null,
    };
  }

  if (isRecord(error)) {
    return {
      message:
        readString(
          error,
          "message",
          "error",
          "details",
          "detail",
        ) ||
        "The email provider returned an unknown error.",
      name:
        readString(
          error,
          "name",
          "code",
        ) || "UnknownEmailError",
      stack: null,
    };
  }

  return {
    message: String(
      error || "Unknown email error",
    ),
    name: "UnknownEmailError",
    stack: null,
  };
}

async function resolveBugId(
  context: RouteContext,
) {
  const params = await context.params;
  return String(
    params?.bugId || "",
  ).trim();
}

/**
 * GET /api/admin/bug-tracker/[bugId]
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  const requestId = randomUUID();
  const bugId =
    await resolveBugId(context);

  if (!bugId) {
    return errorResponse({
      status: 400,
      operation: "GET",
      message:
        "The bug report ID is missing from the request URL.",
      bugId,
      requestId,
    });
  }

  if (!isUuid(bugId)) {
    return errorResponse({
      status: 400,
      operation: "GET",
      message:
        "The supplied bug report ID is not a valid UUID.",
      bugId,
      requestId,
      details: `Received bug ID: ${bugId}`,
    });
  }

  try {
    const { data, error } =
      await supabaseAdmin
        .from(BUGS_TABLE)
        .select("*")
        .eq("id", bugId)
        .maybeSingle();

    if (error) {
      console.error(
        "Bug Tracker GET database error",
        {
          requestId,
          bugId,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        },
      );

      return errorResponse({
        status: 500,
        operation: "GET",
        message:
          "The bug report could not be loaded because the database request failed.",
        bugId,
        requestId,
        databaseCode: error.code,
        details:
          error.details ||
          error.message,
        hint: error.hint,
      });
    }

    if (!data) {
      return errorResponse({
        status: 404,
        operation: "GET",
        message:
          "The requested bug report could not be found.",
        bugId,
        requestId,
      });
    }

    return json(
      {
        success: true,
        bug: data,
        data,
        message:
          "The bug report was loaded successfully.",
        request_id: requestId,
        timestamp:
          new Date().toISOString(),
      },
      200,
      {
        "x-request-id": requestId,
      },
    );
  } catch (caughtError) {
    console.error(
      "Bug Tracker GET unexpected error",
      {
        requestId,
        bugId,
        error: caughtError,
      },
    );

    return errorResponse({
      status: 500,
      operation: "GET",
      message:
        "An unexpected server error occurred while loading the bug report.",
      bugId,
      requestId,
      details:
        caughtError instanceof Error
          ? caughtError.message
          : "Unknown server error",
    });
  }
}

/**
 * PATCH /api/admin/bug-tracker/[bugId]
 *
 * Updates the report and sends the reporter an email
 * when the status first moves to fix, resolved or closed.
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  const requestId = randomUUID();
  const bugId =
    await resolveBugId(context);

  if (!bugId) {
    return errorResponse({
      status: 400,
      operation: "PATCH",
      message:
        "The bug report ID is missing from the request URL.",
      bugId,
      requestId,
    });
  }

  if (!isUuid(bugId)) {
    return errorResponse({
      status: 400,
      operation: "PATCH",
      message:
        "The supplied bug report ID is not a valid UUID.",
      bugId,
      requestId,
      details: `Received bug ID: ${bugId}`,
    });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return errorResponse({
      status: 400,
      operation: "PATCH",
      message:
        "The request body does not contain valid JSON.",
      bugId,
      requestId,
    });
  }

  if (!isRecord(payload)) {
    return errorResponse({
      status: 400,
      operation: "PATCH",
      message:
        "The request body must be a JSON object.",
      bugId,
      requestId,
    });
  }

  /*
   * Read the existing report before updating it.
   * This prevents duplicate fixed-email notifications.
   */
  const {
    data: existingBug,
    error: existingError,
  } = await supabaseAdmin
    .from(BUGS_TABLE)
    .select("*")
    .eq("id", bugId)
    .maybeSingle();

  if (existingError) {
    console.error(
      "Bug Tracker PATCH lookup error",
      {
        requestId,
        bugId,
        code: existingError.code,
        message:
          existingError.message,
        details:
          existingError.details,
        hint: existingError.hint,
      },
    );

    return errorResponse({
      status: 500,
      operation: "PATCH_LOOKUP",
      message:
        "The current bug report could not be checked before saving.",
      bugId,
      requestId,
      databaseCode:
        existingError.code,
      details:
        existingError.details ||
        existingError.message,
      hint: existingError.hint,
    });
  }

  if (
    !existingBug ||
    !isRecord(existingBug)
  ) {
    return errorResponse({
      status: 404,
      operation: "PATCH_LOOKUP",
      message:
        "The bug report was not found and could not be updated.",
      bugId,
      requestId,
    });
  }

  const updates: Record<
    string,
    unknown
  > = {};

  if (payload.status !== undefined) {
    if (!isStatus(payload.status)) {
      return errorResponse({
        status: 400,
        operation: "PATCH",
        message:
          "The selected bug status is not valid.",
        bugId,
        requestId,
        details: `Received status: ${String(
          payload.status,
        )}`,
        hint: `Allowed statuses: ${Array.from(
          ALLOWED_STATUSES,
        ).join(", ")}.`,
      });
    }

    updates.status = payload.status;
  }

  if (
    payload.priority !== undefined
  ) {
    if (
      !isPriority(payload.priority)
    ) {
      return errorResponse({
        status: 400,
        operation: "PATCH",
        message:
          "The selected bug priority is not valid.",
        bugId,
        requestId,
        details: `Received priority: ${String(
          payload.priority,
        )}`,
      });
    }

    updates.priority =
      payload.priority;
  }

  if (
    payload.admin_notes !== undefined
  ) {
    const value = readOptionalString(
      payload.admin_notes,
    );

    if (
      value === undefined &&
      payload.admin_notes !== undefined
    ) {
      return errorResponse({
        status: 400,
        operation: "PATCH",
        message:
          "Admin notes must be text or null.",
        bugId,
        requestId,
      });
    }

    updates.admin_notes = value;
  }

  if (
    payload.resolution_notes !==
    undefined
  ) {
    const value = readOptionalString(
      payload.resolution_notes,
    );

    if (
      value === undefined &&
      payload.resolution_notes !==
        undefined
    ) {
      return errorResponse({
        status: 400,
        operation: "PATCH",
        message:
          "Resolution notes must be text or null.",
        bugId,
        requestId,
      });
    }

    updates.resolution_notes =
      value;
  }

  if (
    Object.keys(updates).length === 0
  ) {
    return errorResponse({
      status: 400,
      operation: "PATCH",
      message:
        "No supported bug report changes were supplied.",
      bugId,
      requestId,
    });
  }

  const previousStatus =
    readString(
      existingBug,
      "status",
    ) as BugStatus | null;

  const nextStatus =
    typeof updates.status ===
    "string"
      ? (updates.status as BugStatus)
      : previousStatus;

  const wasCompleted =
    isCompletedStatus(
      previousStatus,
    );

  const isCompleted =
    isCompletedStatus(nextStatus);

  const shouldSendFixedEmail =
    !wasCompleted && isCompleted;

  const now =
    new Date().toISOString();

  updates.updated_at = now;

  if (isCompleted) {
    updates.resolved_at = now;
  } else if (
    typeof updates.status ===
    "string"
  ) {
    updates.resolved_at = null;
  }

  try {
    const {
      data: updatedBug,
      error: updateError,
    } = await supabaseAdmin
      .from(BUGS_TABLE)
      .update(updates)
      .eq("id", bugId)
      .select("*")
      .maybeSingle();

    if (updateError) {
      console.error(
        "Bug Tracker PATCH database error",
        {
          requestId,
          bugId,
          updates,
          code: updateError.code,
          message:
            updateError.message,
          details:
            updateError.details,
          hint: updateError.hint,
        },
      );

      return errorResponse({
        status: 500,
        operation: "PATCH",
        message:
          "The bug report could not be updated because the database request failed.",
        bugId,
        requestId,
        databaseCode:
          updateError.code,
        details:
          updateError.details ||
          updateError.message,
        hint: updateError.hint,
      });
    }

    if (
      !updatedBug ||
      !isRecord(updatedBug)
    ) {
      return errorResponse({
        status: 404,
        operation: "PATCH",
        message:
          "The bug report was not found after the update was attempted.",
        bugId,
        requestId,
      });
    }

    const reporterEmail =
      readString(
        updatedBug,
        "reporter_email",
      );

    const emailNotification =
      createEmailNotification({
        required:
          shouldSendFixedEmail,
        recipient: reporterEmail,
        requestId,
      });

    if (shouldSendFixedEmail) {
      if (!reporterEmail) {
        emailNotification.error =
          "The reporter could not be notified because reporter_email is empty.";
        emailNotification.error_code =
          "BUG_EMAIL_REPORTER_ADDRESS_MISSING";
        emailNotification.http_status =
          422;
        emailNotification.details =
          "The report was saved, but no reporter_email was found on the updated database row.";
        emailNotification.hint =
          "Add a valid reporter_email, move the report back to an open status, save it, then mark it resolved again.";
      } else {
        try {
          const result =
            await sendBugFixedEmail(
              updatedBug as Parameters<
                typeof sendBugFixedEmail
              >[0],
            );

          emailNotification.sent = true;
          emailNotification.email_id =
            result?.id || null;
          emailNotification.http_status =
            200;
        } catch (emailError) {
          const parsed =
            getEmailError(
              emailError,
            );

          emailNotification.sent =
            false;
          emailNotification.error =
            parsed.message;
          emailNotification.error_code =
            "BUG_EMAIL_PROVIDER_ERROR";
          emailNotification.http_status =
            502;
          emailNotification.details = [
            `Provider error: ${parsed.name}`,
            parsed.stack
              ? `Stack: ${parsed.stack}`
              : null,
          ]
            .filter(Boolean)
            .join("\n");
          emailNotification.hint =
            "Check RESEND_API_KEY, BUG_REPORT_FROM_EMAIL, sender-domain verification in Resend, and the reporter email address.";

          console.error(
            "Bug Tracker fixed email failed",
            {
              requestId,
              bugId,
              reporterEmail,
              error: emailError,
            },
          );
        }
      }
    }

    const message =
      shouldSendFixedEmail
        ? emailNotification.sent
          ? "The bug report was marked as fixed and the reporter was notified by email."
          : "The bug report was marked as fixed, but the reporter email could not be sent."
        : "The bug report was updated successfully.";

    return json(
      {
        success: true,
        bug: updatedBug,
        data: updatedBug,
        message,
        previous_status:
          previousStatus,
        current_status: nextStatus,
        updated_fields:
          Object.keys(updates),
        email_notification:
          emailNotification,
        request_id: requestId,
        timestamp:
          new Date().toISOString(),
      },
      200,
      {
        "x-request-id": requestId,
      },
    );
  } catch (caughtError) {
    console.error(
      "Bug Tracker PATCH unexpected error",
      {
        requestId,
        bugId,
        updates,
        error: caughtError,
      },
    );

    return errorResponse({
      status: 500,
      operation: "PATCH",
      message:
        "An unexpected server error occurred while updating the bug report.",
      bugId,
      requestId,
      details:
        caughtError instanceof Error
          ? caughtError.message
          : "Unknown server error",
    });
  }
}

/**
 * DELETE /api/admin/bug-tracker/[bugId]
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  const requestId = randomUUID();
  const bugId =
    await resolveBugId(context);

  if (!bugId) {
    return errorResponse({
      status: 400,
      operation: "DELETE",
      message:
        "The bug report ID is missing from the request URL.",
      bugId,
      requestId,
    });
  }

  if (!isUuid(bugId)) {
    return errorResponse({
      status: 400,
      operation: "DELETE",
      message:
        "The supplied bug report ID is not a valid UUID.",
      bugId,
      requestId,
      details: `Received bug ID: ${bugId}`,
    });
  }

  try {
    const {
      data: existingBug,
      error: lookupError,
    } = await supabaseAdmin
      .from(BUGS_TABLE)
      .select("id, title")
      .eq("id", bugId)
      .maybeSingle();

    if (lookupError) {
      return errorResponse({
        status: 500,
        operation: "DELETE",
        message:
          "The bug report could not be checked before deletion.",
        bugId,
        requestId,
        databaseCode:
          lookupError.code,
        details:
          lookupError.details ||
          lookupError.message,
        hint: lookupError.hint,
      });
    }

    if (!existingBug) {
      return errorResponse({
        status: 404,
        operation: "DELETE",
        message:
          "The bug report was not found and could not be deleted.",
        bugId,
        requestId,
      });
    }

    const { error: deleteError } =
      await supabaseAdmin
        .from(BUGS_TABLE)
        .delete()
        .eq("id", bugId);

    if (deleteError) {
      return errorResponse({
        status: 500,
        operation: "DELETE",
        message:
          "The bug report could not be deleted because the database request failed.",
        bugId,
        requestId,
        databaseCode:
          deleteError.code,
        details:
          deleteError.details ||
          deleteError.message,
        hint: deleteError.hint,
      });
    }

    return json(
      {
        success: true,
        deleted: true,
        bug_id: bugId,
        bug_title:
          existingBug.title,
        message:
          "The bug report was deleted successfully.",
        request_id: requestId,
        timestamp:
          new Date().toISOString(),
      },
      200,
      {
        "x-request-id": requestId,
      },
    );
  } catch (caughtError) {
    return errorResponse({
      status: 500,
      operation: "DELETE",
      message:
        "An unexpected server error occurred while deleting the bug report.",
      bugId,
      requestId,
      details:
        caughtError instanceof Error
          ? caughtError.message
          : "Unknown server error",
    });
  }
}
