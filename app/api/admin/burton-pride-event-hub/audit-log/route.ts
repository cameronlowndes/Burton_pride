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
} from "@/lib/Event-Hub-App/event-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Keep this as a literal string rather than using Array.join().
 *
 * Supabase uses the literal select string to calculate the returned row type.
 * Building the string dynamically can cause incorrect TypeScript inference.
 */
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

export async function GET(request: Request) {
  try {
    /*
     * Authentication and permission enforcement must happen before any
     * filters or database queries are processed.
     */
    const actor = await requireEventAuditPermission("event_audit:view");

    const requestUrl = new URL(request.url);
    const filters = parseEventAuditFilters(requestUrl);

    /*
     * resolveAuditEventScope prevents event-scoped administrators from
     * changing event_id in the URL to access another event.
     */
    const eventScope = await resolveAuditEventScope(
      actor,
      filters.eventId,
    );

    const page = Math.max(1, filters.page);
    const pageSize = Math.min(
      200,
      Math.max(1, filters.pageSize),
    );

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
      /*
       * ID is used as a secondary sort to keep pagination stable when
       * multiple entries have the same created_at or other sort value.
       */
      .order("id", {
        ascending: filters.sortDirection === "asc",
      })
      .range(from, to);

    const {
      data,
      count,
      error,
    } = await query;

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

    /*
     * The explicit cast protects this route from Supabase returning a
     * SelectQueryError type when generated database types are temporarily
     * out of date after running a migration.
     */
    const rows = Array.isArray(data)
      ? (data as unknown as EventAuditListRow[])
      : [];

    const total = count ?? 0;
    const totalPages = Math.max(
      1,
      Math.ceil(total / pageSize),
    );

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
      export: actorHasPermission(
        actor,
        "event_audit:export",
      ),
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

      logs: rows.map((row) =>
        maskAuditRowForActor(row, actor),
      ),

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
      message:
        error instanceof Error
          ? error.message
          : String(error),
    });

    return eventAuditApiError(error);
  }
}