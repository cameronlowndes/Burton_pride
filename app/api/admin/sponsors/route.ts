import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("sponsor_applications")
      .select(`
        id,
        sponsor_name,
        contact_name,
        email,
        phone,
        sponsorship_type,
        address_line1,
        address_line2,
        city,
        county,
        postcode,
        country,
        logo_link,
        message,
        story,
        status,
        is_read,
        created_at
      `)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to load sponsor applications" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      sponsors: data ?? [],
    });
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