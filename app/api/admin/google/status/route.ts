import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { ok: false, connected: false, error: "Unauthorised." },
        { status: 401 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("admin_google_accounts")
      .select("google_email, expires_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { ok: false, connected: false, error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({
        ok: true,
        connected: false,
        googleEmail: null,
        expiresAt: null,
      });
    }

    return NextResponse.json({
      ok: true,
      connected: true,
      googleEmail: data.google_email,
      expiresAt: data.expires_at,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        connected: false,
        error: error instanceof Error ? error.message : "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}