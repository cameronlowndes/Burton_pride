import "server-only";

import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { actorHasPermission } from "./auth";
import { maskIpAddress, maskSensitiveChanges } from "./redaction";
import type { EventAuditActor, EventAuditFilters } from "./types";

const SORT_FIELDS = new Set([
  "created_at",
  "admin_name",
  "area",
  "status",
  "risk_level",
]);

function clean(value: string | null) {
  return String(value || "").trim();
}

function list(value: string | null) {
  return clean(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function positiveInt(value: string | null, fallback: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

export function parseEventAuditFilters(url: URL): EventAuditFilters {
  const sortField = clean(url.searchParams.get("sort"));
  const direction = clean(url.searchParams.get("direction"));

  return {
    q: clean(url.searchParams.get("q")),
    eventId: clean(url.searchParams.get("event_id")),
    adminId: clean(url.searchParams.get("admin_id")),
    area: clean(url.searchParams.get("area")),
    status: list(url.searchParams.get("status")),
    risk: list(url.searchParams.get("risk")),
    recordType: clean(url.searchParams.get("record_type")),
    recordId: clean(url.searchParams.get("record_id")),
    action: clean(url.searchParams.get("action")),
    dateFrom: clean(url.searchParams.get("date_from")),
    dateTo: clean(url.searchParams.get("date_to")),
    securityOnly: url.searchParams.get("security_only") === "true",
    reviewOnly: url.searchParams.get("review_only") === "true",
    page: positiveInt(url.searchParams.get("page"), 1, 100_000),
    pageSize: positiveInt(url.searchParams.get("page_size"), 50, 200),
    sortField: SORT_FIELDS.has(sortField)
      ? (sortField as EventAuditFilters["sortField"])
      : "created_at",
    sortDirection: direction === "asc" ? "asc" : "desc",
  };
}

export async function getActiveEventId() {
  const { data } = await supabaseAdmin
    .from("burton_pride_events")
    .select("id")
    .eq("is_active", true)
    .eq("is_archived", false)
    .limit(1)
    .maybeSingle();

  return data?.id ? String(data.id) : null;
}

export async function resolveAuditEventScope(
  actor: EventAuditActor,
  requestedEventId: string,
) {
  const canViewAll = actorHasPermission(actor, "event_audit:view_all_events");
  if (requestedEventId === "all" && canViewAll) return null;
  if (requestedEventId === "system" && canViewAll) return "system";

  const activeEventId = await getActiveEventId();
  if (requestedEventId && requestedEventId !== "all") {
    if (canViewAll) return requestedEventId;
    // Event-scoped admins may not switch the API to a different event by editing the URL.
    return activeEventId || "__NO_ACTIVE_EVENT__";
  }

  return activeEventId || (canViewAll ? null : "__NO_ACTIVE_EVENT__");
}

function safeSearchTerm(value: string) {
  return value.replace(/[(),%]/g, " ").replace(/\s+/g, " ").trim();
}

export function applyEventAuditFilters(
  query: any,
  filters: EventAuditFilters,
  eventScope: string | null,
  actor: EventAuditActor,
) {
  if (eventScope === "system") query = query.is("event_id", null);
  else if (eventScope === "__NO_ACTIVE_EVENT__") {
    query = query.eq("id", "00000000-0000-0000-0000-000000000000");
  } else if (eventScope) query = query.eq("event_id", eventScope);

  if (!actorHasPermission(actor, "event_audit:view_security")) {
    query = query.eq("is_security_event", false);
  } else if (filters.securityOnly) {
    query = query.eq("is_security_event", true);
  }

  if (filters.adminId) query = query.eq("admin_id", filters.adminId);
  if (filters.area) query = query.eq("area", filters.area);
  if (filters.status.length) query = query.in("status", filters.status);
  if (filters.risk.length) query = query.in("risk_level", filters.risk);
  if (filters.recordType) query = query.eq("record_type", filters.recordType);
  if (filters.recordId) query = query.eq("record_id", filters.recordId);
  if (filters.action) query = query.eq("action", filters.action);
  if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom);
  if (filters.dateTo) query = query.lte("created_at", filters.dateTo);
  if (filters.reviewOnly) query = query.eq("requires_review", true);

  const search = safeSearchTerm(filters.q);
  if (search) {
    query = query.or(
      [
        `action.ilike.%${search}%`,
        `action_label.ilike.%${search}%`,
        `admin_name.ilike.%${search}%`,
        `admin_email.ilike.%${search}%`,
        `record_title.ilike.%${search}%`,
        `request_id.ilike.%${search}%`,
        `summary.ilike.%${search}%`,
      ].join(","),
    );
  }

  return query;
}

export function maskAuditRowForActor(row: any, actor: EventAuditActor) {
  const canSeeIp = actorHasPermission(actor, "event_audit:view_ip_addresses");
  const canSeeSensitive = actorHasPermission(
    actor,
    "event_audit:view_sensitive_changes",
  );

  return {
    ...row,
    ip_address: canSeeIp ? row.ip_address : maskIpAddress(row.ip_address),
    user_agent: canSeeIp ? row.user_agent : null,
    session_reference: canSeeIp ? row.session_reference : null,
    before_data: canSeeSensitive ? row.before_data : null,
    after_data: canSeeSensitive ? row.after_data : null,
    changed_fields: canSeeSensitive
      ? row.changed_fields
      : maskSensitiveChanges(row.changed_fields),
    admin_permissions_snapshot: canSeeSensitive
      ? row.admin_permissions_snapshot
      : [],
    entry_hash: canSeeSensitive ? row.entry_hash : null,
    previous_entry_hash: canSeeSensitive ? row.previous_entry_hash : null,
  };
}

export function isAuditRowVisibleToActor(row: any, actor: EventAuditActor) {
  if (row?.is_security_event && !actorHasPermission(actor, "event_audit:view_security")) {
    return false;
  }
  return true;
}
