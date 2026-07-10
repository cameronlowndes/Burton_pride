import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import {
  createEventAuditLog,
  eventAuditApiError,
  noStoreJson,
  requireEventAuditPermission,
} from "@/lib/admin/event-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };
const ALLOWED_STATUSES = new Set(["new", "reviewing", "resolved", "dismissed"]);

export async function PATCH(request: Request, { params }: Context) {
  try {
    const actor = await requireEventAuditPermission("event_audit:manage_alerts");
    const { id } = await params;
    const body = await request.json();

    const { data: before, error: readError } = await supabaseAdmin
      .from("event_audit_alerts")
      .select("*")
      .eq("id", id)
      .single();
    if (readError) throw readError;

    const status = body.status ? String(body.status) : before.status;
    if (!ALLOWED_STATUSES.has(status)) {
      return noStoreJson({ ok: false, error: "Invalid alert status." }, 400);
    }

    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
      status,
      assigned_to: body.assigned_to || null,
      investigation_notes:
        body.investigation_notes === undefined
          ? before.investigation_notes
          : String(body.investigation_notes || "").trim() || null,
      resolution_notes:
        body.resolution_notes === undefined
          ? before.resolution_notes
          : String(body.resolution_notes || "").trim() || null,
      reviewed_at: ["reviewing", "resolved", "dismissed"].includes(status)
        ? before.reviewed_at || now
        : before.reviewed_at,
      resolved_at: ["resolved", "dismissed"].includes(status) ? now : null,
      resolved_by: ["resolved", "dismissed"].includes(status) ? actor.id : null,
    };

    const { data: after, error } = await supabaseAdmin
      .from("event_audit_alerts")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;

    await createEventAuditLog({
      eventId: after.event_id,
      actor,
      action: "audit.alert_updated",
      area: "security",
      status: "success",
      riskLevel: "medium",
      record: { type: "audit_alert", id: after.id, title: after.title },
      before,
      after,
      reason: body.reason || body.resolution_notes || null,
      request,
      responseStatus: 200,
      isSecurityEvent: true,
      strict: true,
    });

    return noStoreJson({ ok: true, alert: after });
  } catch (error) {
    return eventAuditApiError(error);
  }
}
