import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("donations")
      .select(
        `
        id,
        full_name,
        supporter_story,
        supporter_image_url,
        supporter_story_status,
        supporter_wall_approved,
        donation_type,
        created_at
      `
      )
      .eq("donation_type", "monthly")
      .eq("supporter_story_status", "approved")
      .eq("supporter_wall_approved", true)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: true, supporters: data || [] },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Server error",
      },
      { status: 500 }
    );
  }
}