import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

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

    const sponsors = Array.isArray(data) ? data : [];

    return NextResponse.json({
      ok: true,
      sponsors,
      stats: {
        totalApplications: sponsors.length,
        newApplications: sponsors.filter((row) => row.status === "new").length,
        inProgressApplications: sponsors.filter((row) => row.status === "in_progress").length,
        doneApplications: sponsors.filter((row) => row.status === "done").length,
      },
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