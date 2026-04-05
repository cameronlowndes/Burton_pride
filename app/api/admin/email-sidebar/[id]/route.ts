import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireMainAdmin } from "@/lib/isMainAdmin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(req: Request, context: RouteContext) {
  await requireMainAdmin();

  const { id } = await context.params;
  const body = await req.json();
  const supabase = supabaseAdmin;

  const { error } = await supabase
    .from("admin_email_sidebar")
    .update(body)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, context: RouteContext) {
  await requireMainAdmin();

  const { id } = await context.params;
  const supabase = supabaseAdmin;

  const { error } = await supabase
    .from("admin_email_sidebar")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}