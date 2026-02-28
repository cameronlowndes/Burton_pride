import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const supabase = supabaseAdmin(); // 👈 FIX HERE

  const { data, error } = await supabase
    .from("entries")
    .select("image_url, created_at")
    .eq("image_status", "approved")
    .not("image_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(24);

  if (error) {
    console.error("Showcase error:", error);
    return NextResponse.json({ images: [] });
  }

  return NextResponse.json({
    images: (data || []).map((row: any) => row.image_url),
  });
}