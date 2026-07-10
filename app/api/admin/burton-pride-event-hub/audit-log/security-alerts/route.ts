import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import {
  eventAuditApiError,
  noStoreJson,
  requireEventAuditPermission,
} from "@/lib/Event-Hub-App/event-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireEventAuditPermission("event_audit:view_security");
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "open";
    const eventId = url.searchParams.get("event_id") || "";

    let query = supabaseAdmin
      .from("event_audit_alerts")
      .select(
        "*, event_audit_logs(action,action_label,admin_name,record_title,created_at,request_id)",
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (status === "open") query = query.in("status", ["new", "reviewing"]);
    else if (status !== "all") query = query.eq("status", status);
    if (eventId === "system") query = query.is("event_id", null);
    else if (eventId && eventId !== "all") query = query.eq("event_id", eventId);

    const { data, error } = await query;
    if (error) throw error;
    return noStoreJson({ ok: true, alerts: data || [] });
  } catch (error) {
    return eventAuditApiError(error);
  }
}
