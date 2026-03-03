import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("events")
    .select(
      "id,title,slug,description,location,start_at,end_at,image_url,ticket_url,website_url,is_published,repeat_rule,price_type,price_gbp,is_free"
    )
    .eq("is_published", true)
    // ✅ show only events that are NOT expired:
    // - end_at >= now
    // OR
    // - end_at is null AND start_at >= now
    .or(`end_at.gte.${nowIso},and(end_at.is.null,start_at.gte.${nowIso})`)
    .order("start_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: data || [] });
}