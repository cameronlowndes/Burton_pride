import { NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const admin = await getCurrentAdmin();
    const userId = admin?.id;

    if (!userId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Not authenticated.",
        },
        { status: 401 }
      );
    }

    const { data: existing, error: lookupError } = await supabaseAdmin
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
          details: lookupError,
          likelyFix:
            "Check the google_connections table exists and user_id stores your Supabase admin/auth user id.",
        },
        { status: 500 }
      );
    }

    if (!existing) {
      return NextResponse.json({
        ok: true,
        deleted: 0,
        message: "No Google connection found.",
      });
    }

    const { error: deleteError, count } = await supabaseAdmin
      .from("google_connections")
      .delete({ count: "exact" })
      .eq("user_id", userId);

    if (deleteError) {
      console.error("Disconnect delete error:", deleteError);

      return NextResponse.json(
        {
          ok: false,
          error: deleteError.message || "Failed to disconnect Google account.",
          details: deleteError,
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
        likelyFix:
          "Make sure getCurrentAdmin() uses your Supabase login system and returns the current admin record.",
      },
      { status: 500 }
    );
  }
}