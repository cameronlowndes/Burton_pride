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

export async function PATCH(request: Request, { params }: Context) {
  try {
    const actor = await requireEventAuditPermission("event_audit:view");
    const { id } = await params;
    const body = await request.json();

    const { data: existing, error: readError } = await supabaseAdmin
      .from("event_audit_saved_views")
      .select("*")
      .eq("id", id)
      .single();
    if (readError) throw readError;
    if (String(existing.admin_id) !== String(actor.id) && actor.role !== "main_admin") {
      return noStoreJson({ ok: false, error: "You cannot edit this saved view." }, 403);
    }

    const update = {
      name: body.name === undefined ? existing.name : String(body.name).trim(),
      filters: body.filters === undefined ? existing.filters : body.filters,
      visible_columns:
        body.visible_columns === undefined
          ? existing.visible_columns
          : body.visible_columns,
      sort_field: body.sort_field || existing.sort_field,
      sort_direction:
        body.sort_direction === undefined
          ? existing.sort_direction
          : body.sort_direction === "asc"
            ? "asc"
            : "desc",
      is_shared:
        actor.role === "main_admin" && body.is_shared !== undefined
          ? Boolean(body.is_shared)
          : existing.is_shared,
      is_default:
        body.is_default === undefined
          ? existing.is_default
          : Boolean(body.is_default),
    };

    const { data, error } = await supabaseAdmin
      .from("event_audit_saved_views")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return noStoreJson({ ok: true, view: data });
  } catch (error) {
    return eventAuditApiError(error);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    const actor = await requireEventAuditPermission("event_audit:view");
    const { id } = await params;

    const { data: existing, error: readError } = await supabaseAdmin
      .from("event_audit_saved_views")
      .select("*")
      .eq("id", id)
      .single();
    if (readError) throw readError;
    if (String(existing.admin_id) !== String(actor.id) && actor.role !== "main_admin") {
      return noStoreJson({ ok: false, error: "You cannot delete this saved view." }, 403);
    }

    const { error } = await supabaseAdmin
      .from("event_audit_saved_views")
      .delete()
      .eq("id", id);
    if (error) throw error;

    await createEventAuditLog({
      actor,
      action: "audit.saved_view_deleted",
      area: "system",
      status: "success",
      record: { type: "audit_saved_view", id, title: existing.name },
      request,
      responseStatus: 200,
    });

    return noStoreJson({ ok: true });
  } catch (error) {
    return eventAuditApiError(error);
  }
}
