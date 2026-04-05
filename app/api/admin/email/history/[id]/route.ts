import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(
  _req: NextRequest,
  context: RouteContext
) {
  try {
    const supabase = supabaseAdmin;
    const { id } = await context.params;

    if (!id || id.trim() === "") {
      return NextResponse.json(
        { ok: false, error: "Invalid ID" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("email_history")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Email deleted.",
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Delete failed",
      },
      { status: 500 }
    );
  }
}