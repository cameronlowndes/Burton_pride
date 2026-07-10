import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import {
  createEventAuditLog,
  eventAuditApiError,
  noStoreJson,
  requireEventAuditPermission,
} from "@/lib/Event-Hub-App/event-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    const actor = await requireEventAuditPermission(
      "event_audit:add_investigation_notes",
    );
    const { id } = await params;
    const body = await request.json();
    const note = String(body.note || "").trim();

    if (note.length < 3 || note.length > 5000) {
      return noStoreJson(
        { ok: false, error: "The investigation note must be 3 to 5,000 characters." },
        400,
      );
    }

    const { data: log, error: logError } = await supabaseAdmin
      .from("event_audit_logs")
      .select("id,event_id,action_label,record_title")
      .eq("id", id)
      .single();
    if (logError) throw logError;

    const { data: created, error } = await supabaseAdmin
      .from("event_audit_investigation_notes")
      .insert({
        alert_id: body.alert_id || null,
        audit_log_id: id,
        admin_id: actor.id,
        admin_name: actor.name,
        admin_email: actor.email,
        note,
        is_confidential: Boolean(body.is_confidential),
      })
      .select("*")
      .single();
    if (error) throw error;

    await createEventAuditLog({
      eventId: log.event_id,
      actor,
      action: "audit.investigation_note_added",
      area: "security",
      status: "success",
      riskLevel: body.is_confidential ? "high" : "medium",
      record: {
        type: "audit_log",
        id,
        title: log.record_title || log.action_label,
      },
      summary: "An investigation note was added to an audit event.",
      metadata: {
        note_id: created.id,
        alert_id: body.alert_id || null,
        confidential: Boolean(body.is_confidential),
      },
      request,
      responseStatus: 201,
      isSecurityEvent: true,
      isConfidential: Boolean(body.is_confidential),
      strict: true,
    });

    return noStoreJson({ ok: true, note: created }, 201);
  } catch (error) {
    return eventAuditApiError(error);
  }
}
