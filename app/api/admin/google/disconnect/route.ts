import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Not authenticated.",
        },
        { status: 401 }
      );
    }

    const supabase = supabaseAdmin;

    const { data: existing, error: lookupError } = await supabase
      .from("google_connections")
      .select("user_id, email, google_email")
      .eq("user_id", userId)
      .maybeSingle();

    if (lookupError) {
      console.error("Disconnect lookup error:", lookupError);

      return NextResponse.json(
        {
          ok: false,
          error: "Failed to load Google connection before disconnect.",
        },
        { status: 500 }
      );
    }

    if (!existing) {
      return NextResponse.json({
        ok: true,
        message: "No Google connection found.",
      });
    }

    const { error: deleteError, count } = await supabase
      .from("google_connections")
      .delete({ count: "exact" })
      .eq("user_id", userId);

    if (deleteError) {
      console.error("Disconnect delete error:", deleteError);

      return NextResponse.json(
        {
          ok: false,
          error: deleteError.message || "Failed to disconnect Google account.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      deleted: count ?? 0,
      message: "Google account disconnected successfully.",
    });
  } catch (error) {
    console.error("Disconnect route error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to disconnect Google account.",
      },
      { status: 500 }
    );
  }
}