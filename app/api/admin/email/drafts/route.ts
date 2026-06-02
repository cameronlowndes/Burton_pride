import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export async function GET() {
  try {
    const supabase = supabaseAdmin;

    const { data, error } = await supabase
      .from("email_drafts")
      .select(`
        id,
        to,
        cc,
        bcc,
        subject,
        message,
        html,
        created_at,
        updated_at,
        signature_id
      `)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Draft list error:", error);
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to load drafts." },
        { status: 500 }
      );
    }

    const items = (data || []).map((item) => ({
      ...item,
      attachment_count: 0,
    }));

    return NextResponse.json({
      ok: true,
      items,
    });
  } catch (error) {
    console.error("Draft GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to load drafts." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = supabaseAdmin;
    const formData = await req.formData();

    const to = String(formData.get("to") || "").trim();
    const cc = String(formData.get("cc") || "").trim();
    const bcc = String(formData.get("bcc") || "").trim();
    const subject = String(formData.get("subject") || "").trim();
    const message = String(formData.get("message") || "").trim();
    const html = String(formData.get("html") || "").trim();
    const signatureId = String(formData.get("signatureId") || "").trim() || null;

    if (!to) {
      return NextResponse.json(
        { ok: false, error: "To is required." },
        { status: 400 }
      );
    }

    if (!subject) {
      return NextResponse.json(
        { ok: false, error: "Subject is required." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("email_drafts")
      .insert({
        to,
        cc: cc || null,
        bcc: bcc || null,
        subject,
        message: message || null,
        html: html || null,
        signature_id: signatureId,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Draft save error:", error);
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to save draft." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      id: data.id,
      message: "Draft saved successfully.",
    });
  } catch (error) {
    console.error("Draft POST error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to save draft." },
      { status: 500 }
    );
  }
}