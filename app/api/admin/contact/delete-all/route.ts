// app/api/contact-messages/delete-all/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function DELETE() {
  try {
    const { data, error } = await supabaseAdmin
      .from("contact_messages")
      .delete()
      .not("id", "is", null)
      .select("id");

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to delete all messages" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      deletedCount: data?.length || 0,
      message: "All contact messages deleted successfully",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected server error",
      },
      { status: 500 }
    );
  }
}