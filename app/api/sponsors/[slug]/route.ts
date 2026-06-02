import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const { data, error } = await supabaseAdmin
      .from("sponsors")
      .select("id, sponsor_name, sponsorship_type, logo_link, story, slug")
      .eq("slug", slug)
      .eq("status", "approved")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: "Sponsor not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      sponsor: data,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Failed to load sponsor." },
      { status: 500 }
    );
  }
}