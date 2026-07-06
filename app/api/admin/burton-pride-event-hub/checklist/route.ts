import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";

const CONTACTS_TABLE = "event_stallholder_checklist_contacts";
const YEARS_TABLE = "event_hub_years";

type ContactPayload = {
  id?: unknown;
  event_year?: unknown;
  organisation_name?: unknown;
  contact_name?: unknown;
  email?: unknown;
  phone?: unknown;
  organisation_type?: unknown;
  pitch_number?: unknown;
  arrival_time?: unknown;
  checklist_sent?: unknown;
  checklist_confirmed?: unknown;
  notes?: unknown;
  bring_gazebo?: unknown;
  bring_gazebo_weights?: unknown;
  bring_table?: unknown;
  bring_chairs?: unknown;
  bring_display_materials?: unknown;
  bring_leaflets?: unknown;
  bring_stock?: unknown;
  bring_donation_bucket?: unknown;
  bring_card_reader?: unknown;
  bring_cash_float?: unknown;
  bring_tablecloth?: unknown;
  bring_signage?: unknown;
  bring_weather_protection?: unknown;
  bring_waste_bags?: unknown;
  bring_activity_equipment?: unknown;
  bring_pli_documents?: unknown;
  bring_approved_electricals?: unknown;
  reminder_no_tables_chairs?: unknown;
  reminder_no_gazebos?: unknown;
  reminder_no_weights?: unknown;
  reminder_no_power?: unknown;
  reminder_fit_pitch?: unknown;
  is_active?: unknown;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function nullableText(value: unknown) {
  const text = clean(value);
  return text.length ? text : null;
}

function bool(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;

  const text = clean(value).toLowerCase();

  if (["true", "yes", "y", "1", "sent", "confirmed", "active"].includes(text)) {
    return true;
  }

  if (["false", "no", "n", "0", "inactive"].includes(text)) {
    return false;
  }

  return fallback;
}

function numberValue(value: unknown, fallback = 2027) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

async function getYearLock(eventYear: number) {
  const { data, error } = await supabaseAdmin
    .from(YEARS_TABLE)
    .select("event_year, is_locked")
    .eq("event_year", eventYear)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    const { data: created, error: createError } = await supabaseAdmin
      .from(YEARS_TABLE)
      .insert({
        event_year: eventYear,
        is_locked: false,
      })
      .select("event_year, is_locked")
      .single();

    if (createError) {
      throw new Error(createError.message);
    }

    return created;
  }

  return data;
}

async function ensureYearIsUnlocked(eventYear: number) {
  const year = await getYearLock(eventYear);

  if (year.is_locked) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          ok: false,
          error: `${eventYear} is locked. Unlock this year with the main admin password before making changes.`,
          code: "YEAR_LOCKED",
          event_year: eventYear,
        },
        { status: 423 }
      ),
    };
  }

  return { ok: true as const };
}

function toRow(body: ContactPayload) {
  return {
    event_year: numberValue(body.event_year),
    organisation_name: clean(body.organisation_name),
    contact_name: nullableText(body.contact_name),
    email: nullableText(body.email),
    phone: nullableText(body.phone),
    organisation_type: nullableText(body.organisation_type),
    pitch_number: nullableText(body.pitch_number),
    arrival_time: nullableText(body.arrival_time),
    checklist_sent: bool(body.checklist_sent),
    checklist_confirmed: bool(body.checklist_confirmed),
    notes: nullableText(body.notes),
    bring_gazebo: bool(body.bring_gazebo),
    bring_gazebo_weights: bool(body.bring_gazebo_weights),
    bring_table: bool(body.bring_table),
    bring_chairs: bool(body.bring_chairs),
    bring_display_materials: bool(body.bring_display_materials),
    bring_leaflets: bool(body.bring_leaflets),
    bring_stock: bool(body.bring_stock),
    bring_donation_bucket: bool(body.bring_donation_bucket),
    bring_card_reader: bool(body.bring_card_reader),
    bring_cash_float: bool(body.bring_cash_float),
    bring_tablecloth: bool(body.bring_tablecloth),
    bring_signage: bool(body.bring_signage),
    bring_weather_protection: bool(body.bring_weather_protection),
    bring_waste_bags: bool(body.bring_waste_bags),
    bring_activity_equipment: bool(body.bring_activity_equipment),
    bring_pli_documents: bool(body.bring_pli_documents),
    bring_approved_electricals: bool(body.bring_approved_electricals),
    reminder_no_tables_chairs: bool(body.reminder_no_tables_chairs, true),
    reminder_no_gazebos: bool(body.reminder_no_gazebos, true),
    reminder_no_weights: bool(body.reminder_no_weights, true),
    reminder_no_power: bool(body.reminder_no_power, true),
    reminder_fit_pitch: bool(body.reminder_fit_pitch, true),
    is_active: bool(body.is_active, true),
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const eventYear = numberValue(url.searchParams.get("event_year"));

  await getYearLock(eventYear);

  const { data, error } = await supabaseAdmin
    .from(CONTACTS_TABLE)
    .select("*")
    .eq("event_year", eventYear)
    .order("organisation_name", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    event_year: eventYear,
    contacts: data || [],
  });
}

export async function POST(req: Request) {
  const body = await req.json();

  if (Array.isArray(body?.contacts)) {
    const eventYear = numberValue(body.event_year);

    const lockCheck = await ensureYearIsUnlocked(eventYear);
    if (!lockCheck.ok) return lockCheck.response;

    const rows: ReturnType<typeof toRow>[] = body.contacts.map((item: ContactPayload) =>
      toRow({
        ...item,
        event_year: eventYear,
      })
    );

    const missing = rows.findIndex((row) => !row.organisation_name);

    if (missing >= 0) {
      return NextResponse.json(
        { ok: false, error: `Row ${missing + 1} is missing an organisation name.` },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from(CONTACTS_TABLE)
      .insert(rows)
      .select("*");

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, contacts: data || [] });
  }

  const row = toRow(body);

  const lockCheck = await ensureYearIsUnlocked(row.event_year);
  if (!lockCheck.ok) return lockCheck.response;

  if (!row.organisation_name) {
    return NextResponse.json(
      { ok: false, error: "Organisation name is required." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from(CONTACTS_TABLE)
    .insert(row)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, contact: data });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const id = clean(body.id);
  const row = toRow(body);

  if (!id) {
    return NextResponse.json(
      { ok: false, error: "Contact ID is required." },
      { status: 400 }
    );
  }

  const lockCheck = await ensureYearIsUnlocked(row.event_year);
  if (!lockCheck.ok) return lockCheck.response;

  if (!row.organisation_name) {
    return NextResponse.json(
      { ok: false, error: "Organisation name is required." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from(CONTACTS_TABLE)
    .update({
      ...row,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("event_year", row.event_year)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, contact: data });
}

export async function DELETE(req: Request) {
  const body = await req.json();
  const id = clean(body.id);
  const eventYear = numberValue(body.event_year);

  if (!id) {
    return NextResponse.json(
      { ok: false, error: "Contact ID is required." },
      { status: 400 }
    );
  }

  const lockCheck = await ensureYearIsUnlocked(eventYear);
  if (!lockCheck.ok) return lockCheck.response;

  const { error } = await supabaseAdmin
    .from(CONTACTS_TABLE)
    .delete()
    .eq("id", id)
    .eq("event_year", eventYear);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}