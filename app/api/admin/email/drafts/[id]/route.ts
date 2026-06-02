import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
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
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: "Draft not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      item: {
        ...data,
        attachment_count: 0,
      },
    });
  } catch (error) {
    console.error("Draft read error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to load draft." },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = supabaseAdmin;

    const { error } = await supabase
      .from("email_drafts")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to delete draft." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Draft deleted successfully.",
    });
  } catch (error) {
    console.error("Draft delete error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to delete draft." },
      { status: 500 }
    );
  }
}