import { NextRequest } from "next/server";

export const EVENT_HUB_AUDIT_ENDPOINT =
  "/api/admin/burton-pride-event-hub/audit-log";

export type EventDocumentAuditStatus =
  | "started"
  | "success"
  | "failed"
  | "denied";

export type EventDocumentAuditInput = {
  action: string;
  actionLabel: string;
  description: string;
  status: EventDocumentAuditStatus;
  requestId: string;

  eventId?: string | null;
  documentId?: string | null;
  documentTitle?: string | null;

  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

export type EventDocumentAuditResult = {
  ok: boolean;
  status?: number;
  error?: string;
  response?: unknown;
};

function requestMetadata(request: NextRequest) {
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
 * Reports Event Document actions through the existing Event Hub audit API.
 *
 * Never place passwords, password hashes, signed URLs, file bytes, access
 * tokens, cookies, or other secrets in beforeData, afterData, or metadata.
 */
export async function reportEventDocumentAudit({
  request,
  input,
}: {
  request: NextRequest;
  input: EventDocumentAuditInput;
}): Promise<EventDocumentAuditResult> {
  try {
    const url = new URL(
      EVENT_HUB_AUDIT_ENDPOINT,
      request.nextUrl.origin,
    );

    const cookies = request.headers.get("cookie") || "";
    const requestInfo = requestMetadata(request);

    const response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(cookies ? { Cookie: cookies } : {}),
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
          source: "event_documents_api",
          route: requestInfo.route,
          method: requestInfo.method,
        },

        ipAddress: requestInfo.ipAddress,
        ip_address: requestInfo.ipAddress,

        userAgent: requestInfo.userAgent,
        user_agent: requestInfo.userAgent,
      }),
    });

    const payload = await response
      .json()
      .catch(async () => ({
        raw: await response.text().catch(() => ""),
      }));

    if (!response.ok) {
      console.error("Event document audit rejected", {
        action: input.action,
        parentRequestId: input.requestId,
        auditStatus: response.status,
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
    console.error("Event document audit request failed", {
      action: input.action,
      parentRequestId: input.requestId,
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
