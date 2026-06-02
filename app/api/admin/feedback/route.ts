import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("feedback_messages")
      .select("id, name, email, message, status, is_read, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to load feedback" },
        { status: 500 }
      );
    }

    const feedback = data || [];

    const stats = {
      total: feedback.length,
      unread: feedback.filter((item) => !item.is_read).length,
      newCount: feedback.filter((item) => item.status === "new").length,
      reviewedCount: feedback.filter((item) => item.status === "reviewed").length,
      archivedCount: feedback.filter((item) => item.status === "archived").length,
    };

    return NextResponse.json({
      ok: true,
      feedback,
      stats,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Unexpected server error",
      },
      { status: 500 }
    );
  }
}