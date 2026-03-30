import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const supabase = supabaseAdmin;

    const { data, error } = await supabase
      .from("email_templates")
      .select("id, name, subject, message, html, created_at")
      .order("name", { ascending: true });

    if (error) {
      console.error("email_templates query error:", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      templates: data ?? [],
    });
  } catch (error) {
    console.error("email templates route error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to load templates.",
      },
      { status: 500 }
    );
  }
}