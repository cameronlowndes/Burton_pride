import type { NextRequest } from "next/server";

type AuditAdmin = {
  id?: string | null;
  email?: string | null;
  role?: string | null;
};

type AuditPayload = {
  action: string;
  actionLabel: string;
  description: string;
  status?: "success" | "failed" | "warning" | "started";
  area?: string;
  category?: string;
  recordTitle?: string | null;
  entityType?: string;
  entityId?: string | null;
  eventId?: string | null;
  applicationId?: string | null;
  transactionId?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
  metadata?: Record<string, unknown>;
};

type AuditResult = {
  eventAuditOk: boolean;
  moneyAuditOk: boolean;
  eventAuditError?: string;
  moneyAuditError?: string;
};

const EVENT_AUDIT_API =
  process.env.EVENT_HUB_AUDIT_API_PATH ||
  "/api/admin/burton-pride-event-hub/audit-log";

const MONEY_AUDIT_API = "/api/admin/money/audit-logs";

function clean(value: unknown) {
  return value === undefined ? null : value;
}

function getRequestOrigin(request: NextRequest) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host");

  if (host) {
    return `${forwardedProto || request.nextUrl.protocol.replace(":", "")}://${host}`;
  }

  return request.nextUrl.origin;
}

async function postAudit(
  request: NextRequest,
  path: string,
  body: Record<string, unknown>,
) {
  const origin = getRequestOrigin(request);
  const cookie = request.headers.get("cookie") || "";

  const response = await fetch(new URL(path, origin), {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      cookie,
      "x-audit-source": "event-hub",
    },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      responseText ||
        `${path} returned HTTP ${response.status} while writing the audit log.`,
    );
  }
}

export async function reportEventHubAudit(
  request: NextRequest,
  admin: AuditAdmin,
  payload: AuditPayload,
  options: {
    alsoReportToMoney?: boolean;
  } = {},
): Promise<AuditResult> {
  const now = new Date().toISOString();
  const status = payload.status || "success";

  const commonPayload = {
    action: payload.action,
    action_label: payload.actionLabel,
    description: payload.description,
    summary: payload.description,
    status,

    // Event application actions belong under Applications Hub.
    area: payload.area || "application_hub",
    category: payload.category || "applications",
    module: payload.area || "application_hub",
    source: "event_hub",

    record_type:
      payload.entityType || "event_vendor_application",
    record_id: clean(payload.entityId),
    record_title: clean(payload.recordTitle),

    entity_type:
      payload.entityType || "event_vendor_application",
    entity_id: clean(payload.entityId),
    event_id: clean(payload.eventId),
    application_id: clean(payload.applicationId),
    transaction_id: clean(payload.transactionId),
    admin_id: clean(admin.id),
    admin_email: clean(admin.email),
    admin_role: clean(admin.role),
    before_data: clean(payload.beforeData),
    after_data: clean(payload.afterData),
    metadata: {
      ...(payload.metadata || {}),
      audit_recorded_at: now,
      request_method: request.method,
      request_path: request.nextUrl.pathname,
    },
  };

  const result: AuditResult = {
    eventAuditOk: false,
    moneyAuditOk: !options.alsoReportToMoney,
  };

  try {
    await postAudit(request, EVENT_AUDIT_API, {
      ...commonPayload,
      audit_area: payload.area || "application_hub",
    });
    result.eventAuditOk = true;
  } catch (error) {
    result.eventAuditError =
      error instanceof Error ? error.message : "Event audit log failed.";
    console.error("Event Hub audit log failed", {
      action: payload.action,
      error,
    });
  }

  if (options.alsoReportToMoney) {
    try {
      await postAudit(request, MONEY_AUDIT_API, {
        ...commonPayload,
        module: "money_management",
        source: "event_hub",
        audit_area: "money_management",
        money_action: payload.action,
      });
      result.moneyAuditOk = true;
    } catch (error) {
      result.moneyAuditError =
        error instanceof Error ? error.message : "Money audit log failed.";
      console.error("Money audit log failed", {
        action: payload.action,
        error,
      });
    }
  }

  return result;
}
