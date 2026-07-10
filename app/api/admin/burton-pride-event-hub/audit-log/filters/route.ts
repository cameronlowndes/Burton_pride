import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import {
  actorHasPermission,
  eventAuditApiError,
  noStoreJson,
  requireEventAuditPermission,
} from "@/lib/admin/event-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await requireEventAuditPermission("event_audit:view");
    const canViewAllEvents = actorHasPermission(actor, "event_audit:view_all_events");
    const canViewSecurity = actorHasPermission(actor, "event_audit:view_security");

    let eventsQuery = supabaseAdmin
      .from("burton_pride_events")
      .select("id,event_name,event_year,event_date,is_active,is_archived")
      .order("event_year", { ascending: false });
    if (!canViewAllEvents) eventsQuery = eventsQuery.eq("is_active", true);

    let adminsQuery = supabaseAdmin
      .from("event_audit_logs")
      .select("admin_id,admin_name,admin_email,admin_role")
      .not("admin_id", "is", null)
      .order("admin_name", { ascending: true })
      .limit(2000);
    let actionsQuery = supabaseAdmin
      .from("event_audit_logs")
      .select("action,action_label")
      .order("action", { ascending: true })
      .limit(5000);
    let areasQuery = supabaseAdmin
      .from("event_audit_logs")
      .select("area")
      .order("area", { ascending: true })
      .limit(5000);

    if (!canViewSecurity) {
      adminsQuery = adminsQuery.eq("is_security_event", false);
      actionsQuery = actionsQuery.eq("is_security_event", false);
      areasQuery = areasQuery.eq("is_security_event", false);
    }

    const [eventsResult, adminsResult, actionsResult, areasResult] = await Promise.all([
      eventsQuery,
      adminsQuery,
      actionsQuery,
      areasQuery,
    ]);

    for (const result of [eventsResult, adminsResult, actionsResult, areasResult]) {
      if (result.error) throw result.error;
    }

    const uniqueBy = <T,>(items: T[], key: (item: T) => string) =>
      Array.from(new Map(items.map((item) => [key(item), item])).values());

    return noStoreJson({
      ok: true,
      events: eventsResult.data || [],
      admins: uniqueBy(adminsResult.data || [], (row: any) => String(row.admin_id)),
      actions: uniqueBy(actionsResult.data || [], (row: any) => String(row.action)),
      areas: Array.from(
        new Set((areasResult.data || []).map((row: any) => String(row.area))),
      ),
      canViewAllEvents,
      canViewSecurity,
    });
  } catch (error) {
    return eventAuditApiError(error);
  }
}
