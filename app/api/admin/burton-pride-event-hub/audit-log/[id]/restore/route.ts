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

function eventInsertFromSnapshot(snapshot: Record<string, any>, id: string) {
  return {
    id,
    event_name: snapshot.event_name || "Burton Pride",
    event_year: Number(snapshot.event_year),
    event_date: snapshot.event_date || null,
    event_start_time: snapshot.event_start_time || null,
    event_end_time: snapshot.event_end_time || null,
    setup_start_time: snapshot.setup_start_time || null,
    venue_name: snapshot.venue_name || null,
    venue_address: snapshot.venue_address || null,
    theme: snapshot.theme || null,
    status: "planning",
    is_active: false,
    is_locked: false,
    is_archived: false,
    locked_at: null,
    locked_by: null,
  };
}

export async function POST(request: Request, { params }: Context) {
  try {
    const actor = await requireEventAuditPermission("event_audit:restore_records");
    const { id } = await params;
    const body = await request.json();
    const reason = String(body.reason || "").trim();

    if (reason.length < 10) {
      return noStoreJson(
        { ok: false, error: "A restoration reason of at least 10 characters is required." },
        400,
      );
    }

    const { data: sourceLog, error: sourceError } = await supabaseAdmin
      .from("event_audit_logs")
      .select("*")
      .eq("id", id)
      .single();
    if (sourceError) throw sourceError;

    const supportedAction = ["event.archived", "event.deleted"].includes(
      String(sourceLog.action),
    );

    if (
      sourceLog.record_type !== "event" ||
      !sourceLog.record_id ||
      !supportedAction
    ) {
      await createEventAuditLog({
        eventId: sourceLog.event_id,
        actor,
        action: "auth.access_denied",
        actionLabel: "Unsupported restoration blocked",
        area: "security",
        status: "blocked",
        riskLevel: "high",
        record: {
          type: sourceLog.record_type,
          id: sourceLog.record_id,
          title: sourceLog.record_title,
        },
        reason,
        summary:
          "Only an event.archived or event.deleted audit event can be used for controlled event restoration.",
        request,
        responseStatus: 409,
        isSecurityEvent: true,
        requiresReview: true,
      });

      return noStoreJson(
        {
          ok: false,
          error:
            "This audit event is not a supported restoration point. Restore other record types from their own Event Hub page.",
        },
        409,
      );
    }

    let before: Record<string, any> | null = null;
    let after: Record<string, any>;

    if (sourceLog.action === "event.archived") {
      const current = await supabaseAdmin
        .from("burton_pride_events")
        .select("*")
        .eq("id", sourceLog.record_id)
        .single();
      if (current.error) throw current.error;
      before = current.data;

      if (!before.is_archived && before.status !== "archived") {
        return noStoreJson(
          { ok: false, error: "This event is not currently archived." },
          409,
        );
      }

      const restored = await supabaseAdmin
        .from("burton_pride_events")
        .update({ is_archived: false, status: "planning" })
        .eq("id", sourceLog.record_id)
        .select("*")
        .single();
      if (restored.error) throw restored.error;
      after = restored.data;
    } else {
      const snapshot = sourceLog.before_data as Record<string, any> | null;
      if (!snapshot || !snapshot.event_year) {
        return noStoreJson(
          {
            ok: false,
            error:
              "The deleted event cannot be restored because its safe before snapshot is missing.",
          },
          409,
        );
      }

      const existing = await supabaseAdmin
        .from("burton_pride_events")
        .select("id")
        .eq("id", sourceLog.record_id)
        .maybeSingle();
      if (existing.data) {
        return noStoreJson(
          { ok: false, error: "An event with this ID already exists." },
          409,
        );
      }

      const restored = await supabaseAdmin
        .from("burton_pride_events")
        .insert(eventInsertFromSnapshot(snapshot, sourceLog.record_id))
        .select("*")
        .single();
      if (restored.error) throw restored.error;
      after = restored.data;
    }

    const restorationLog = await createEventAuditLog({
      eventId: after.id,
      actor,
      action: "event.restored",
      area: "events",
      status: "success",
      riskLevel: "high",
      record: {
        type: "event",
        id: after.id,
        title: `${after.event_name} ${after.event_year}`,
      },
      before,
      after,
      reason,
      summary: `Event restored from audit event ${sourceLog.id}.`,
      parentAuditLogId: sourceLog.id,
      request,
      responseStatus: 200,
      requiresReview: true,
      strict: true,
    });

    return noStoreJson({ ok: true, record: after, auditLog: restorationLog });
  } catch (error) {
    return eventAuditApiError(error);
  }
}
