import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";

const CONTACTS_TABLE = "event_business_contacts";

type ContactRequestBody = {
  id?: unknown;
  business_name?: unknown;
  contact_name?: unknown;
  email?: unknown;
  phone?: unknown;
  website?: unknown;
  address?: unknown;
  service_type?: unknown;
  selling?: unknown;
  selling_image_url?: unknown;
  notes?: unknown;
  is_active?: unknown;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function nullableText(value: unknown) {
  const cleaned = clean(value);
  return cleaned || null;
}

function jsonError(error: string, status = 500, details?: string) {
  return NextResponse.json(
    {
      ok: false,
      error,
      details,
    },
    { status }
  );
}

function getSupabaseDetails(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("selling_image_url")) {
    return [
      "The app is trying to save the image URL, but Supabase says the selling_image_url column is missing or not available.",
      "",
      "Run this SQL in Supabase SQL Editor:",
      "alter table public.event_business_contacts add column if not exists selling_image_url text;",
    ].join("\n");
  }

  if (lower.includes("selling")) {
    return [
      "The app is trying to save the selling text, but Supabase says the selling column is missing or not available.",
      "",
      "Run this SQL in Supabase SQL Editor:",
      "alter table public.event_business_contacts add column if not exists selling text;",
    ].join("\n");
  }

  if (lower.includes("column")) {
    return [
      "Supabase says a database column is missing.",
      "",
      "Make sure event_business_contacts has these columns:",
      "- selling text",
      "- selling_image_url text",
    ].join("\n");
  }

  return "Check the server terminal logs and the Supabase event_business_contacts table.";
}

async function readBody(req: Request): Promise<ContactRequestBody> {
  try {
    return (await req.json()) as ContactRequestBody;
  } catch {
    throw new Error("The contacts API received invalid JSON.");
  }
}

function contactPayload(body: ContactRequestBody, business_name: string) {
  return {
    business_name,
    contact_name: nullableText(body.contact_name),
    email: nullableText(body.email),
    phone: nullableText(body.phone),
    website: nullableText(body.website),
    address: nullableText(body.address),
    service_type: nullableText(body.service_type),
    selling: nullableText(body.selling),
    selling_image_url: nullableText(body.selling_image_url),
    notes: nullableText(body.notes),
    is_active: Boolean(body.is_active ?? true),
  };
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from(CONTACTS_TABLE)
    .select("*")
    .order("business_name", { ascending: true });

  if (error) {
    return jsonError(
      "Failed to load business contacts.",
      500,
      `${error.message}\n\n${getSupabaseDetails(error.message)}`
    );
  }

  return NextResponse.json({ ok: true, contacts: data || [] });
}

export async function POST(req: Request) {
  let body: ContactRequestBody;

  try {
    body = await readBody(req);
  } catch (error) {
    return jsonError(
      "Invalid request body.",
      400,
      error instanceof Error ? error.message : "The request body could not be read."
    );
  }

  const business_name = clean(body.business_name);

  if (!business_name) {
    return jsonError(
      "Business name is required.",
      400,
      "Please enter a business name before adding this contact."
    );
  }

  const { data, error } = await supabaseAdmin
    .from(CONTACTS_TABLE)
    .insert(contactPayload(body, business_name))
    .select("*")
    .single();

  if (error) {
    return jsonError(
      "Failed to add business contact.",
      500,
      `${error.message}\n\n${getSupabaseDetails(error.message)}`
    );
  }

  return NextResponse.json({ ok: true, contact: data });
}

export async function PATCH(req: Request) {
  let body: ContactRequestBody;

  try {
    body = await readBody(req);
  } catch (error) {
    return jsonError(
      "Invalid request body.",
      400,
      error instanceof Error ? error.message : "The request body could not be read."
    );
  }

  const id = clean(body.id);
  const business_name = clean(body.business_name);

  if (!id) {
    return jsonError(
      "Contact ID is required.",
      400,
      "The app tried to update a contact but no contact ID was sent."
    );
  }

  if (!business_name) {
    return jsonError(
      "Business name is required.",
      400,
      "Please enter a business name before updating this contact."
    );
  }

  const { data, error } = await supabaseAdmin
    .from(CONTACTS_TABLE)
    .update({
      ...contactPayload(body, business_name),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return jsonError(
      "Failed to update business contact.",
      500,
      `${error.message}\n\n${getSupabaseDetails(error.message)}`
    );
  }

  if (!data) {
    return jsonError(
      "Contact was not found.",
      404,
      "The contact may have been deleted or the ID may be wrong. Refresh and try again."
    );
  }

  return NextResponse.json({ ok: true, contact: data });
}

export async function DELETE(req: Request) {
  let body: ContactRequestBody;

  try {
    body = await readBody(req);
  } catch (error) {
    return jsonError(
      "Invalid request body.",
      400,
      error instanceof Error ? error.message : "The request body could not be read."
    );
  }

  const id = clean(body.id);

  if (!id) {
    return jsonError(
      "Contact ID is required.",
      400,
      "The app tried to delete a contact but no contact ID was sent."
    );
  }

  const { error } = await supabaseAdmin
    .from(CONTACTS_TABLE)
    .delete()
    .eq("id", id);

  if (error) {
    return jsonError(
      "Failed to delete business contact.",
      500,
      `${error.message}\n\n${getSupabaseDetails(error.message)}`
    );
  }

  return NextResponse.json({ ok: true });
}
