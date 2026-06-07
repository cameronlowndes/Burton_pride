import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return String(value || "").trim();
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("money_audit_risk_rules")
    .select("*")
    .eq("is_active", true)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, rules: data || [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const label = clean(body.label);
  const risk_level = clean(body.risk_level);
  const match_type = clean(body.match_type);
  const match_value = clean(body.match_value);
  const priority = Number(body.priority || 100);

  if (!label || !risk_level || !match_type || !match_value) {
    return NextResponse.json(
      { ok: false, error: "Please fill in all risk rule fields." },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("money_audit_risk_rules")
    .insert({
      label,
      risk_level,
      match_type,
      match_value: match_value.toLowerCase(),
      priority: Number.isFinite(priority) ? priority : 100,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, rule: data });
}