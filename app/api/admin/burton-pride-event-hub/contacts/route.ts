import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("event_business_contacts")
    .select("*")
    .order("business_name", { ascending: true });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, contacts: data });
}

export async function POST(req: Request) {
  const body = await req.json();

  const business_name = clean(body.business_name);

  if (!business_name) {
    return NextResponse.json(
      { ok: false, error: "Business name is required." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("event_business_contacts")
    .insert({
      business_name,
      contact_name: clean(body.contact_name) || null,
      email: clean(body.email) || null,
      phone: clean(body.phone) || null,
      website: clean(body.website) || null,
      address: clean(body.address) || null,
      service_type: clean(body.service_type) || null,
      notes: clean(body.notes) || null,
      is_active: Boolean(body.is_active ?? true),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, contact: data });
}

export async function PATCH(req: Request) {
  const body = await req.json();

  const id = clean(body.id);
  const business_name = clean(body.business_name);

  if (!id) {
    return NextResponse.json(
      { ok: false, error: "Contact ID is required." },
      { status: 400 }
    );
  }

  if (!business_name) {
    return NextResponse.json(
      { ok: false, error: "Business name is required." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("event_business_contacts")
    .update({
      business_name,
      contact_name: clean(body.contact_name) || null,
      email: clean(body.email) || null,
      phone: clean(body.phone) || null,
      website: clean(body.website) || null,
      address: clean(body.address) || null,
      service_type: clean(body.service_type) || null,
      notes: clean(body.notes) || null,
      is_active: Boolean(body.is_active),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, contact: data });
}

export async function DELETE(req: Request) {
  const body = await req.json();
  const id = clean(body.id);

  if (!id) {
    return NextResponse.json(
      { ok: false, error: "Contact ID is required." },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("event_business_contacts")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}