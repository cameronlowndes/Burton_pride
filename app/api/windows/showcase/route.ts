import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const db = supabaseAdmin;

    const { data, error } = await db
      .from("competition_entries")
      .select("image_url, created_at")
      .eq("status", "approved")
      .not("image_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(12);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const images = (data || []).map((r: any) => r.image_url).filter(Boolean);

    return NextResponse.json({ ok: true, images });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}