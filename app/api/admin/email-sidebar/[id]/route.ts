import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireMainAdmin } from "@/lib/isMainAdmin";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  await requireMainAdmin();

  const body = await req.json();
  const supabase = supabaseAdmin;

  const { error } = await supabase
    .from("admin_email_sidebar")
    .update(body)
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  await requireMainAdmin();

  const supabase = supabaseAdmin;

  const { error } = await supabase
    .from("admin_email_sidebar")
    .delete()
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message });
  }

  return NextResponse.json({ ok: true });
}