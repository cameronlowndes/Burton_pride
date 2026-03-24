import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const supabase = supabaseAdmin;

    const { data, error } = await supabase
      .from("site_pages")
      .select("id, title, route, nav_label, sort_order, password_protected")
      .eq("show_in_nav", true)
      .eq("is_enabled", true)
      .eq("status", "live")
      .order("sort_order", { ascending: true })
      .order("title", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
      pages: data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to load nav pages",
      },
      { status: 500 }
    );
  }
}