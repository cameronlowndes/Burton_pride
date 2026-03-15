import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUrl(value: string) {
  if (!value) return true;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const sponsor_name = String(body?.sponsor_name || "").trim();
    const contact_name = String(body?.contact_name || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const phone = String(body?.phone || "").trim();
    const sponsorship_type = String(body?.sponsorship_type || "").trim();
    const address_line1 = String(body?.address_line1 || "").trim();
    const address_line2 = String(body?.address_line2 || "").trim();
    const city = String(body?.city || "").trim();
    const county = String(body?.county || "").trim();
    const postcode = String(body?.postcode || "").trim();
    const country = String(body?.country || "").trim();
    const logo_link = String(body?.logo_link || "").trim();
    const message = String(body?.message || "").trim();

    if (!sponsor_name) {
      return NextResponse.json(
        { ok: false, error: "Sponsor name is required" },
        { status: 400 }
      );
    }

    if (!contact_name) {
      return NextResponse.json(
        { ok: false, error: "Contact name is required" },
        { status: 400 }
      );
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "A valid email is required" },
        { status: 400 }
      );
    }

    if (
      sponsorship_type !== "Normal Sponsor" &&
      sponsorship_type !== "Sponsorship in Kind"
    ) {
      return NextResponse.json(
        { ok: false, error: "Please select a valid sponsorship type" },
        { status: 400 }
      );
    }

    if (logo_link && !isValidUrl(logo_link)) {
      return NextResponse.json(
        { ok: false, error: "Logo link must be a valid URL" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.from("sponsor_applications").insert({
      sponsor_name,
      contact_name,
      email,
      phone: phone || null,
      sponsorship_type,
      address_line1: address_line1 || null,
      address_line2: address_line2 || null,
      city: city || null,
      county: county || null,
      postcode: postcode || null,
      country: country || null,
      logo_link: logo_link || null,
      message: message || null,
      status: "new",
      is_read: false,
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to save sponsor application" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Something went wrong",
      },
      { status: 500 }
    );
  }
}