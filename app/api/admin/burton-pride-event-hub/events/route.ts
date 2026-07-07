import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";

type EventPayload = Record<string, unknown>;

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

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normaliseEvent(row: any) {
  return {
    ...row,
    event_start_time: row.event_start_time ?? row.public_start_time ?? null,
    event_end_time: row.event_end_time ?? row.public_end_time ?? null,
    theme: row.theme ?? row.event_theme ?? null,
  };
}

function makeError(error: unknown, fallback: string, status = 500) {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : fallback;

  return NextResponse.json(
    {
      ok: false,
      error: message,
      details: {
        fallback,
        status,
        table: "burton_pride_events",
      },
    },
    { status }
  );
}

export async function GET() {
  try {
    const supabase = await supabaseAdmin();

    const { data, error } = await supabase
      .from("burton_pride_events")
      .select("*")
      .order("event_year", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      events: (data || []).map(normaliseEvent),
    });
  } catch (error) {
    return makeError(error, "Failed to load events.");
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as EventPayload;
    const supabase = await supabaseAdmin();

    const eventYear = Number(body.event_year);
    const eventDate = clean(body.event_date);

    if (!Number.isInteger(eventYear) || eventYear < 2024 || eventYear > 2100) {
      return makeError("Please enter a valid event year.", "Invalid event year.", 400);
    }

    if (!eventDate) {
      return makeError("Please enter the event date.", "Missing event date.", 400);
    }

    const payload = {
      event_name: clean(body.event_name) || `Burton Pride ${eventYear}`,
      event_year: eventYear,
      event_date: eventDate,
      event_start_time: clean(body.event_start_time || body.public_start_time) || null,
      event_end_time: clean(body.event_end_time || body.public_end_time) || null,
      setup_start_time: clean(body.setup_start_time) || null,
      venue_name: clean(body.venue_name) || null,
      venue_address: clean(body.venue_address) || null,
      theme: clean(body.theme || body.event_theme) || null,
      status: clean(body.status) || "planning",
      is_active: Boolean(body.is_active),
      is_locked: false,
      is_archived: false,
    };

    if (payload.is_active) {
      const { error: activeError } = await supabase
        .from("burton_pride_events")
        .update({ is_active: false })
        .eq("is_active", true);

      if (activeError) throw activeError;
    }

    const { data, error } = await supabase
      .from("burton_pride_events")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      event: normaliseEvent(data),
    });
  } catch (error) {
    return makeError(error, "Failed to create event.");
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as EventPayload;
    const supabase = await supabaseAdmin();

    const id = clean(body.id);
    const action = clean(body.action);

    if (!id) {
      return makeError("Event id is required.", "Missing event id.", 400);
    }

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

      return NextResponse.json({
        ok: true,
        event: normaliseEvent(data),
      });
    }

    if (action === "lock" || action === "unlock") {
      const update =
        action === "lock"
          ? {
              is_locked: true,
              locked_at: new Date().toISOString(),
            }
          : {
              is_locked: false,
              locked_at: null,
              locked_by: null,
            };

      const { data, error } = await supabase
        .from("burton_pride_events")
        .update(update)
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw error;

      return NextResponse.json({
        ok: true,
        event: normaliseEvent(data),
      });
    }

    const update: Record<string, unknown> = {};

    if ("event_name" in body) update.event_name = clean(body.event_name);
    if ("event_year" in body) update.event_year = Number(body.event_year);
    if ("event_date" in body) update.event_date = clean(body.event_date) || null;
    if ("event_start_time" in body || "public_start_time" in body) {
      update.event_start_time = clean(body.event_start_time || body.public_start_time) || null;
    }
    if ("event_end_time" in body || "public_end_time" in body) {
      update.event_end_time = clean(body.event_end_time || body.public_end_time) || null;
    }
    if ("setup_start_time" in body) update.setup_start_time = clean(body.setup_start_time) || null;
    if ("venue_name" in body) update.venue_name = clean(body.venue_name) || null;
    if ("venue_address" in body) update.venue_address = clean(body.venue_address) || null;
    if ("theme" in body || "event_theme" in body) {
      update.theme = clean(body.theme || body.event_theme) || null;
    }
    if ("status" in body) update.status = clean(body.status) || "planning";
    if ("is_archived" in body) update.is_archived = Boolean(body.is_archived);
    if ("is_active" in body) update.is_active = Boolean(body.is_active);

    if (Object.keys(update).length === 0) {
      return makeError("No event fields were sent to update.", "Nothing to update.", 400);
    }

    if (update.is_active === true) {
      const { error: activeError } = await supabase
        .from("burton_pride_events")
        .update({ is_active: false })
        .eq("is_active", true);

      if (activeError) throw activeError;
    }

    const { data, error } = await supabase
      .from("burton_pride_events")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      event: normaliseEvent(data),
    });
  } catch (error) {
    return makeError(error, "Failed to update event.");
  }
}