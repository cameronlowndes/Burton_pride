import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import {
  actorHasPermission,
  eventAuditApiError,
  isAuditRowVisibleToActor,
  maskAuditRowForActor,
  noStoreJson,
  requireEventAuditPermission,
} from "@/lib/admin/event-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const actor = await requireEventAuditPermission("event_audit:view");
    const { id } = await params;

    const { data: log, error } = await supabaseAdmin
      .from("event_audit_logs")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!log || !isAuditRowVisibleToActor(log, actor)) {
      return noStoreJson({ ok: false, error: "Audit event not found." }, 404);
    }

    const canViewAll = actorHasPermission(actor, "event_audit:view_all_events");
    if (!canViewAll) {
      if (!log.event_id) {
        return noStoreJson(
          { ok: false, error: "You do not have permission to view system-wide audit history." },
          403,
        );
      }

      const { data: activeEvent } = await supabaseAdmin
        .from("burton_pride_events")
        .select("id")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (!activeEvent || String(activeEvent.id) !== String(log.event_id)) {
        return noStoreJson(
          { ok: false, error: "You do not have permission to view this event's history." },
          403,
        );
      }
    }

    const [{ data: alerts }, { data: notes }] = await Promise.all([
      supabaseAdmin
        .from("event_audit_alerts")
        .select("*")
        .eq("audit_log_id", id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("event_audit_investigation_notes")
        .select("*")
        .eq("audit_log_id", id)
        .order("created_at", { ascending: false }),
    ]);

    return noStoreJson({
      ok: true,
      log: maskAuditRowForActor(log, actor),
      alerts: actorHasPermission(actor, "event_audit:view_security") ? alerts || [] : [],
      notes: (notes || []).filter(
        (note: any) =>
          !note.is_confidential || actorHasPermission(actor, "event_audit:view_security"),
      ),
    });
  } catch (error) {
    return eventAuditApiError(error);
  }
}
