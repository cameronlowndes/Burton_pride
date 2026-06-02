import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";

export async function DELETE() {
  try {
    const { error } = await supabaseAdmin
      .from("volunteer_applications")
      .delete()
      .not("id", "is", null);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Failed to delete all volunteer applications.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "All volunteer applications deleted successfully.",
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