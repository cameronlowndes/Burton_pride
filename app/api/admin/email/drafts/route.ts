import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const to = String(formData.get("to") || "").trim();
    const cc = String(formData.get("cc") || "").trim();
    const bcc = String(formData.get("bcc") || "").trim();
    const subject = String(formData.get("subject") || "").trim();
    const message = String(formData.get("message") || "").trim();
    const html = String(formData.get("html") || "").trim();
    const editorMode = String(formData.get("editorMode") || "plain").trim();

    const attachmentFiles = formData.getAll("attachments") as File[];
    const attachmentNames = attachmentFiles
      .filter((file) => file && typeof file.name === "string")
      .map((file) => file.name);

    const supabase = supabaseAdmin;

    const { error } = await supabase.from("email_drafts").insert({
      to_email: to,
      cc_email: cc || null,
      bcc_email: bcc || null,
      subject,
      message,
      html,
      editor_mode: editorMode,
      attachment_names: attachmentNames,
      created_at: new Date().toISOString(),
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Draft saved successfully.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to save draft.",
      },
      { status: 500 }
    );
  }
}