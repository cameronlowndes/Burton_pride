import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export async function GET() {
  try {
    const supabase = supabaseAdmin;

    const { data, error } = await supabase
      .from("email_templates")
      .select("id, name, subject, message, html")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      templates: data || [],
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Failed to load templates." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const name = String(body.name || "").trim();
    const subject = String(body.subject || "").trim();
    const message = String(body.message || "").trim();
    const html = String(body.html || "").trim();

    if (!name) {
      return NextResponse.json(
        { ok: false, error: "Template name is required." },
        { status: 400 }
      );
    }

    if (!html && !message) {
      return NextResponse.json(
        { ok: false, error: "Template content is required." },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin;

    const { data, error } = await supabase
      .from("email_templates")
      .insert([
        {
          name,
          subject,
          message,
          html,
        },
      ])
      .select("id, name, subject, message, html")
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Template saved successfully.",
      template: data,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Failed to save template." },
      { status: 500 }
    );
  }
}