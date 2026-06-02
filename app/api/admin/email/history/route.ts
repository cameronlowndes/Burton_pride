import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export async function GET() {
  try {
    const supabase = supabaseAdmin;

    const { data, error } = await supabase
      .from("email_history")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("email_history GET error:", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    const items =
      data?.map((item) => ({
        id: item.id,
        to: item.to_email ?? item.to ?? "",
        cc: item.cc_email ?? null,
        bcc: item.bcc_email ?? null,
        subject: item.subject ?? "",
        message: item.message ?? null,
        html: item.html ?? null,
        created_at: item.created_at,
        status: item.status ?? "unknown",
      })) ?? [];

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error("email_history GET crash:", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to load email history.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest) {
  try {
    const supabase = supabaseAdmin;

    const { error } = await supabase
      .from("email_history")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (error) {
      console.error("email_history DELETE error:", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "All email history deleted.",
    });
  } catch (error) {
    console.error("email_history DELETE crash:", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to delete email history.",
      },
      { status: 500 }
    );
  }
}