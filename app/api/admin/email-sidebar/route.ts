import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireMainAdmin } from "@/lib/isMainAdmin";

export async function GET() {
  const supabase = supabaseAdmin;

  const { data, error } = await supabase
    .from("admin_email_sidebar")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message });
  }

  return NextResponse.json({ ok: true, items: data });
}

export async function POST(req: Request) {
  await requireMainAdmin();

  const body = await req.json();
  const supabase = supabaseAdmin;

  const { error } = await supabase.from("admin_email_sidebar").insert({
    label: body.label,
    href: body.href,
    icon: body.icon,
    sort_order: body.sort_order ?? 0,
    is_enabled: true,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message });
  }

  return NextResponse.json({ ok: true });
}