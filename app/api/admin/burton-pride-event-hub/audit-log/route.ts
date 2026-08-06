import "server-only";

import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import {
  actorHasPermission,
  applyEventAuditFilters,
  eventAuditApiError,
  maskAuditRowForActor,
  noStoreJson,
  parseEventAuditFilters,
  requireEventAuditPermission,
  resolveAuditEventScope,
} from "@/lib/event-hub-app/event-audit/index";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const TABLE_COLUMNS =
  "id,created_at,event_id,admin_id,admin_email,admin_name,admin_role,action,action_label,area,category,status,risk_level,record_type,record_id,record_title,route,http_method,response_status,request_id,browser,operating_system,device_type,ip_address,is_confidential,is_security_event,requires_review,summary" as const;

type EventAuditListRow = {
  id: string;
  created_at: string;
  event_id: string | null;
  admin_id: string | null;
  admin_email: string | null;
  admin_name: string | null;
  admin_role: string | null;
  action: string;
  action_label: string | null;
  area: string;
  category: string | null;
  status: string;
  risk_level: string;
  record_type: string | null;
  record_id: string | null;
  record_title: string | null;
  route: string | null;
  http_method: string | null;
  response_status: number | null;
  request_id: string | null;
  browser: string | null;
  operating_system: string | null;
  device_type: string | null;
  ip_address: string | null;
  is_confidential: boolean;
  is_security_event: boolean;
  requires_review: boolean;
  summary: string | null;
};

type EventAuditPostBody = {
  action?: unknown;
  action_label?: unknown;
  description?: unknown;
  summary?: unknown;
  area?: unknown;
  category?: unknown;
  status?: unknown;
  risk_level?: unknown;
  event_id?: unknown;
  record_type?: unknown;
  record_id?: unknown;
  record_title?: unknown;
  route?: unknown;
  http_method?: unknown;
  response_status?: unknown;
  request_id?: unknown;
  browser?: unknown;
  operating_system?: unknown;
  device_type?: unknown;
  ip_address?: unknown;
  is_confidential?: unknown;
  is_security_event?: unknown;
  requires_review?: unknown;
  before_data?: unknown;
  after_data?: unknown;
  metadata?: unknown;

  entity_type?: unknown;
  entity_id?: unknown;
  application_id?: unknown;
  transaction_id?: unknown;
  admin_id?: unknown;
  admin_email?: unknown;
  admin_role?: unknown;
};

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function requiredString(value: unknown, fieldName: string): string {
  const parsed = optionalString(value);

  if (!parsed) {
    throw new Error(`${fieldName} is required.`);
  }

  return parsed;
}

function optionalBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function optionalInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (
    typeof value === "string" &&
    value.trim() &&
    Number.isInteger(Number(value))
  ) {
    return Number(value);
  }

  return null;
}

function titleCaseAction(action: string) {
  return action
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    null
  );
}

function getRequestId(request: Request): string {
  return (
    request.headers.get("x-request-id") ||
    request.headers.get("x-vercel-id") ||
    crypto.randomUUID()
  );
}

function getBrowser(request: Request, suppliedValue: unknown): string | null {
  return (
    optionalString(suppliedValue) ||
    request.headers.get("sec-ch-ua") ||
    request.headers.get("user-agent") ||
    null
  );
}

function getOperatingSystem(
  request: Request,
  suppliedValue: unknown,
): string | null {
  return (
    optionalString(suppliedValue) ||
    request.headers.get("sec-ch-ua-platform") ||
    null
  );
}

function getDeviceType(
  request: Request,
  suppliedValue: unknown,
): string | null {
  const supplied = optionalString(suppliedValue);

  if (supplied) return supplied;

  return request.headers.get("sec-ch-ua-mobile") === "?1"
    ? "mobile"
    : "desktop";
}

export async function GET(request: Request) {
  try {
    const actor = await requireEventAuditPermission("event_audit:view");

    const requestUrl = new URL(request.url);
    const filters = parseEventAuditFilters(requestUrl);

    const eventScope = await resolveAuditEventScope(actor, filters.eventId);

    const page = Math.max(1, filters.page);
    const pageSize = Math.min(200, Math.max(1, filters.pageSize));

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabaseAdmin
      .from("event_audit_logs")
      .select(TABLE_COLUMNS, {
        count: "exact",
        head: false,
      });

    query = applyEventAuditFilters(
      query,
      {
        ...filters,
        page,
        pageSize,
      },
      eventScope,
      actor,
    );

    query = query
      .order(filters.sortField, {
        ascending: filters.sortDirection === "asc",
        nullsFirst: false,
      })
      .order("id", {
        ascending: filters.sortDirection === "asc",
      })
      .range(from, to);

    const { data, count, error } = await query;

    if (error) {
      console.error("Event audit log list query failed:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        eventScope,
        page,
        pageSize,
        sortField: filters.sortField,
        sortDirection: filters.sortDirection,
      });

      throw error;
    }

    const rows = Array.isArray(data)
      ? (data as unknown as EventAuditListRow[])
      : [];

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const permissions = {
      viewSecurity: actorHasPermission(
        actor,
        "event_audit:view_security",
      ),
      viewIpAddresses: actorHasPermission(
        actor,
        "event_audit:view_ip_addresses",
      ),
      viewSensitiveChanges: actorHasPermission(
        actor,
        "event_audit:view_sensitive_changes",
      ),
      export: actorHasPermission(actor, "event_audit:export"),
      manageAlerts: actorHasPermission(
        actor,
        "event_audit:manage_alerts",
      ),
      addNotes: actorHasPermission(
        actor,
        "event_audit:add_investigation_notes",
      ),
      restoreRecords: actorHasPermission(
        actor,
        "event_audit:restore_records",
      ),
      viewAllEvents: actorHasPermission(
        actor,
        "event_audit:view_all_events",
      ),
    };

    return noStoreJson({
      ok: true,
      logs: rows.map((row) => maskAuditRowForActor(row, actor)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        from: total === 0 ? 0 : from + 1,
        to: Math.min(from + rows.length, total),
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      },
      sorting: {
        field: filters.sortField,
        direction: filters.sortDirection,
      },
      scope: {
        eventId: eventScope,
        requestedEventId: filters.eventId || null,
        isAllEvents: eventScope === null,
        isSystemOnly: eventScope === "system",
        hasActiveEvent: eventScope !== "__NO_ACTIVE_EVENT__",
      },
      permissions,
      refreshedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Event audit log GET failed:", {
      message: error instanceof Error ? error.message : String(error),
    });

    return eventAuditApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireEventAuditPermission("event_audit:view");

    let body: EventAuditPostBody;

    try {
      body = (await request.json()) as EventAuditPostBody;
    } catch {
      return noStoreJson(
        {
          ok: false,
          error: "The audit log request contained invalid JSON.",
        },
        400,
      );
    }

    const action = requiredString(body.action, "action");

    const actionLabel =
      optionalString(body.action_label) || titleCaseAction(action);

    const summary =
      optionalString(body.summary) ||
      optionalString(body.description) ||
      actionLabel;

    const requestedEventId = optionalString(body.event_id) || "";

    const eventScope = await resolveAuditEventScope(
      actor,
      requestedEventId,
    );

    if (eventScope === "__NO_ACTIVE_EVENT__") {
      return noStoreJson(
        {
          ok: false,
          error:
            "No active event could be resolved for this audit entry.",
        },
        400,
      );
    }

    const actorRecord = actor as {
      id?: string | null;
      admin_id?: string | null;
      email?: string | null;
      admin_email?: string | null;
      name?: string | null;
      admin_name?: string | null;
      full_name?: string | null;
      role?: string | null;
      admin_role?: string | null;
    };

    const status = optionalString(body.status) || "success";
    const riskLevel = optionalString(body.risk_level) || "low";

    const recordType =
      optionalString(body.record_type) ||
      optionalString(body.entity_type) ||
      (optionalString(body.application_id)
        ? "event_vendor_application"
        : null);

    const recordId =
      optionalString(body.record_id) ||
      optionalString(body.entity_id) ||
      optionalString(body.application_id) ||
      optionalString(body.transaction_id);

    const metadata =
      body.metadata && typeof body.metadata === "object"
        ? body.metadata
        : null;

    const insertPayload = {
      event_id:
        eventScope === "system" || eventScope === null
          ? requestedEventId
          : eventScope,

      admin_id:
        actorRecord.id ||
        actorRecord.admin_id ||
        optionalString(body.admin_id),

      admin_email:
        actorRecord.email ||
        actorRecord.admin_email ||
        optionalString(body.admin_email),

      admin_name:
        actorRecord.name ||
        actorRecord.admin_name ||
        actorRecord.full_name ||
        actorRecord.email ||
        actorRecord.admin_email ||
        "Admin user",

      admin_role:
        actorRecord.role ||
        actorRecord.admin_role ||
        optionalString(body.admin_role),

      action,
      action_label: actionLabel,
      area: optionalString(body.area) || "event_hub",
      category: optionalString(body.category) || "event_management",
      status,
      risk_level: riskLevel,
      record_type: recordType,
      record_id: recordId,
      record_title:
        optionalString(body.record_title) ||
        (metadata &&
        "organisation_name" in metadata &&
        typeof metadata.organisation_name === "string"
          ? metadata.organisation_name
          : null),
      route: optionalString(body.route) || request.headers.get("referer"),
      http_method: optionalString(body.http_method) || "POST",
      response_status: optionalInteger(body.response_status) || 200,
      request_id:
        optionalString(body.request_id) || getRequestId(request),
      browser: getBrowser(request, body.browser),
      operating_system: getOperatingSystem(
        request,
        body.operating_system,
      ),
      device_type: getDeviceType(request, body.device_type),
      ip_address:
        optionalString(body.ip_address) || getClientIp(request),
      is_confidential: optionalBoolean(body.is_confidential),
      is_security_event: optionalBoolean(body.is_security_event),
      requires_review:
        optionalBoolean(body.requires_review) ||
        status === "failed" ||
        status === "warning",
      summary,
    };

    const { data, error } = await supabaseAdmin
      .from("event_audit_logs")
      .insert(insertPayload)
      .select(TABLE_COLUMNS)
      .single();

    if (error) {
      console.error("Event audit log insert failed:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        action,
        eventId: insertPayload.event_id,
        recordType: insertPayload.record_type,
        recordId: insertPayload.record_id,
      });

      throw error;
    }

    return noStoreJson(
      {
        ok: true,
        log: maskAuditRowForActor(
          data as unknown as EventAuditListRow,
          actor,
        ),
        createdAt: new Date().toISOString(),
      },
      201,
    );
  } catch (error) {
    console.error("Event audit log POST failed:", {
      message: error instanceof Error ? error.message : String(error),
    });

    return eventAuditApiError(error);
  }
}
