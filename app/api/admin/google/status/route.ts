import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        {
          ok: false,
          connected: false,
          error: "Not authenticated.",
        },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          },
        }
      );
    }

    const supabase = supabaseAdmin;

    const { data, error } = await supabase
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
        },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          },
        }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        connected: !!data,
        googleEmail: data?.google_email || data?.email || null,
        expiresAt: data?.expires_at ?? null,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
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
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  }
}