import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { requireAdmin } from "@/lib/adminPermissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await requireAdmin();

    if (!admin) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorised",
        },
        {
          status: 401,
        }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("competition_entries")
      .select(`
        id,
        business_name,
        contact_name,
        email,
        phone,
        address,
        website,
        image_url,
        payment_status,
        status,
        featured,
        created_at
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Competition entries error:", error);

      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      ok: true,
      entries: data || [],
      total: data?.length || 0,
    });
  } catch (error) {
    console.error("Competition entries route failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to load competition entries.",
      },
      {
        status: 500,
      }
    );
  }
}