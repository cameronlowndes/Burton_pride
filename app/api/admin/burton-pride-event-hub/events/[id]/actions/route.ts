import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";

async function supabaseAdmin() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );
}

function normaliseEvent(row: any) {
  return {
    ...row,
    event_start_time: row.event_start_time ?? null,
    event_end_time: row.event_end_time ?? null,
    theme: row.theme ?? null,
  };
}

function jsonError(message: string, status = 500) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const action = String(body.action || "").trim();

    if (!id) return jsonError("Event id is required.", 400);
    if (!action) return jsonError("Event action is required.", 400);

    const supabase = await supabaseAdmin();

    if (action === "set_active") {
      const { error: clearError } = await supabase
        .from("burton_pride_events")
        .update({ is_active: false })
        .eq("is_active", true);

      if (clearError) throw clearError;

      const { data, error } = await supabase
        .from("burton_pride_events")
        .update({ is_active: true, is_archived: false })
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw error;
      return NextResponse.json({ ok: true, event: normaliseEvent(data) });
    }

    if (action === "lock") {
      const { data, error } = await supabase
        .from("burton_pride_events")
        .update({ is_locked: true, locked_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw error;
      return NextResponse.json({ ok: true, event: normaliseEvent(data) });
    }

    if (action === "unlock") {
      const { data, error } = await supabase
        .from("burton_pride_events")
        .update({ is_locked: false, locked_at: null, locked_by: null })
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw error;
      return NextResponse.json({ ok: true, event: normaliseEvent(data) });
    }

    if (action === "archive") {
      const { data, error } = await supabase
        .from("burton_pride_events")
        .update({ is_archived: true, is_active: false, status: "archived" })
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw error;
      return NextResponse.json({ ok: true, event: normaliseEvent(data) });
    }

    if (action === "restore") {
      const { data, error } = await supabase
        .from("burton_pride_events")
        .update({ is_archived: false, status: "planning" })
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw error;
      return NextResponse.json({ ok: true, event: normaliseEvent(data) });
    }

    if (action === "clone") {
      const { data: existing, error: readError } = await supabase
        .from("burton_pride_events")
        .select("*")
        .eq("id", id)
        .single();

      if (readError) throw readError;

      const clone = {
        event_name: existing.event_name,
        event_year: Number(existing.event_year) + 1,
        event_date: existing.event_date,
        event_start_time: existing.event_start_time,
        event_end_time: existing.event_end_time,
        setup_start_time: existing.setup_start_time,
        venue_name: existing.venue_name,
        venue_address: existing.venue_address,
        theme: existing.theme,
        status: "planning",
        is_active: false,
        is_locked: false,
        is_archived: false,
      };

      const { data, error } = await supabase
        .from("burton_pride_events")
        .insert(clone)
        .select("*")
        .single();

      if (error) throw error;
      return NextResponse.json({ ok: true, event: normaliseEvent(data) });
    }

    if (action === "delete") {
      // Allows deleting active events too. After deleting the active event,
      // the app will have no active event until another event is created or set active.
      const { error } = await supabase
        .from("burton_pride_events")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return NextResponse.json({ ok: true, deleted_event_id: id });
    }

    return jsonError(`Unknown event action: ${action}`, 400);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to run event action.",
      500
    );
  }
}
