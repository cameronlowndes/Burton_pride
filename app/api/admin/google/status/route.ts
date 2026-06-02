import { NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

export async function GET() {
  try {
    const admin = await getCurrentAdmin();

    const userId = admin?.id;

    if (!userId) {
      return NextResponse.json(
        {
          ok: false,
          connected: false,
          error: "Not authenticated. Please sign in with your admin account.",
        },
        {
          status: 401,
          headers: NO_STORE_HEADERS,
        }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("google_connections")
      .select("google_email, email, expires_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Google status route error:", error);

      return NextResponse.json(
        {
          ok: false,
          connected: false,
          error: error.message || "Failed to load Google connection status.",
          details: error,
          likelyFix:
            "Check the google_connections table exists and that user_id stores the Supabase admin/auth user id.",
        },
        {
          status: 500,
          headers: NO_STORE_HEADERS,
        }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        connected: Boolean(data),
        googleEmail: data?.google_email || data?.email || null,
        expiresAt: data?.expires_at ?? null,
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error("Google status unexpected error:", error);

    return NextResponse.json(
      {
        ok: false,
        connected: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load Google connection status.",
        likelyFix:
          "Make sure getCurrentAdmin() uses Supabase auth and returns the current admin record.",
      },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      }
    );
  }
}