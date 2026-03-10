import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const full_name = String(body?.full_name || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const phone = String(body?.phone || "").trim();
    const date_of_birth = String(body?.date_of_birth || "").trim();
    const availability = String(body?.availability || "").trim();
    const experience = String(body?.experience || "").trim();
    const why_volunteer = String(body?.why_volunteer || "").trim();

    const emergency_contact_name = String(
      body?.emergency_contact_name || ""
    ).trim();
    const emergency_contact_phone = String(
      body?.emergency_contact_phone || ""
    ).trim();
    const emergency_contact_relationship = String(
      body?.emergency_contact_relationship || ""
    ).trim();

    if (
      !full_name ||
      !email ||
      !date_of_birth ||
      !why_volunteer ||
      !emergency_contact_name ||
      !emergency_contact_phone ||
      !emergency_contact_relationship
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Full name, email, date of birth, why you want to volunteer, and all emergency contact fields are required.",
        },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.from("volunteer_applications").insert([
      {
        full_name,
        email,
        phone: phone || null,
        date_of_birth: date_of_birth || null,
        availability: availability || null,
        experience: experience || null,
        why_volunteer,
        emergency_contact_name,
        emergency_contact_phone,
        emergency_contact_relationship,
        status: "new",
        is_read: false,
      },
    ]);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Failed to save volunteer application.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Volunteer application submitted successfully.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected server error",
      },
      { status: 500 }
    );
  }
}