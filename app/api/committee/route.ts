import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";

const memberSelect =
  "id, full_name, email, image_url, role, pronouns, section_title, story_title, story, display_order, is_published, image_position_x, image_position_y";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("committee_members")
      .select(memberSelect)
      .eq("is_published", true)
      .order("display_order", { ascending: true });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to load committee members" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      members: data || [],
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