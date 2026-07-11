import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import {
  actorHasPermission,
  applyEventAuditFilters,
  eventAuditApiError,
  noStoreJson,
  parseEventAuditFilters,
  requireEventAuditPermission,
  resolveAuditEventScope,
} from "@/lib/event-hub-app/event-audit/index";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await requireEventAuditPermission("event_audit:view");
    const filters = parseEventAuditFilters(new URL(request.url));
    const eventScope = await resolveAuditEventScope(actor, filters.eventId);

    async function countWith(configure?: (query: any) => any) {
      let query = supabaseAdmin
        .from("event_audit_logs")
        .select("id", { count: "exact", head: true });
      query = applyEventAuditFilters(query, filters, eventScope, actor);
      if (configure) query = configure(query);
      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    }

    const [total, successful, failed, highRisk, documentsChanged, changesToday] =
      await Promise.all([
        countWith(),
        countWith((query) => query.eq("status", "success")),
        countWith((query) => query.in("status", ["failed", "partial_success"])),
        countWith((query) => query.in("risk_level", ["high", "critical"])),
        countWith((query) => query.eq("area", "documents")),
        countWith((query) => {
          const now = new Date();
          now.setHours(0, 0, 0, 0);
          return query.gte("created_at", now.toISOString());
        }),
      ]);

    let activeAdminsQuery = supabaseAdmin
      .from("event_audit_logs")
      .select("admin_id,admin_email")
      .limit(5000);
    activeAdminsQuery = applyEventAuditFilters(
      activeAdminsQuery,
      filters,
      eventScope,
      actor,
    );
    const { data: adminRows } = await activeAdminsQuery;
    const activeAdmins = new Set(
      (adminRows || []).map((row: any) => row.admin_id || row.admin_email).filter(Boolean),
    ).size;

    let securityAlerts: number | null = null;
    if (actorHasPermission(actor, "event_audit:view_security")) {
      let alertsQuery = supabaseAdmin
        .from("event_audit_alerts")
        .select("id", { count: "exact", head: true })
        .in("status", ["new", "reviewing"]);
      if (eventScope === "system") alertsQuery = alertsQuery.is("event_id", null);
      else if (eventScope === "__NO_ACTIVE_EVENT__") {
        alertsQuery = alertsQuery.eq("id", "00000000-0000-0000-0000-000000000000");
      } else if (eventScope) alertsQuery = alertsQuery.eq("event_id", eventScope);
      const { count } = await alertsQuery;
      securityAlerts = count || 0;
    }

    return noStoreJson({
      ok: true,
      summary: {
        total,
        successful,
        failed,
        highRisk,
        activeAdmins,
        securityAlerts,
        documentsChanged,
        changesToday,
      },
      refreshedAt: new Date().toISOString(),
    });
  } catch (error) {
    return eventAuditApiError(error);
  }
}
