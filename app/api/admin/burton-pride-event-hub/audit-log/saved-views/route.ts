import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import {
  createEventAuditLog,
  eventAuditApiError,
  noStoreJson,
  requireEventAuditPermission,
} from "@/lib/Event-Hub-App/event-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await requireEventAuditPermission("event_audit:view");
    const { data, error } = await supabaseAdmin
      .from("event_audit_saved_views")
      .select("*")
      .or(`admin_id.eq.${actor.id},is_shared.eq.true`)
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });

    if (error) throw error;
    return noStoreJson({ ok: true, views: data || [] });
  } catch (error) {
    return eventAuditApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireEventAuditPermission("event_audit:view");
    const body = await request.json();
    const name = String(body.name || "").trim();

    if (name.length < 2 || name.length > 80) {
      return noStoreJson(
        { ok: false, error: "Saved-view name must be 2 to 80 characters." },
        400,
      );
    }

    const { data, error } = await supabaseAdmin
      .from("event_audit_saved_views")
      .insert({
        admin_id: actor.id,
        name,
        filters: body.filters || {},
        visible_columns: Array.isArray(body.visible_columns)
          ? body.visible_columns
          : [],
        sort_field: body.sort_field || "created_at",
        sort_direction: body.sort_direction === "asc" ? "asc" : "desc",
        is_shared: actor.role === "main_admin" && Boolean(body.is_shared),
        is_default: Boolean(body.is_default),
      })
      .select("*")
      .single();
    if (error) throw error;

    await createEventAuditLog({
      actor,
      action: "audit.saved_view_created",
      area: "system",
      status: "success",
      record: { type: "audit_saved_view", id: data.id, title: data.name },
      metadata: { shared: data.is_shared, default: data.is_default },
      request,
      responseStatus: 201,
    });

    return noStoreJson({ ok: true, view: data }, 201);
  } catch (error) {
    return eventAuditApiError(error);
  }
}
