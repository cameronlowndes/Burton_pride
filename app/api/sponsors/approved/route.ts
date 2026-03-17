import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("sponsor_applications")
      .select(`
        id,
        sponsor_name,
        sponsorship_type,
        logo_link,
        website,
        status
      `)
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    const sponsors =
      data?.map((row) => ({
        id: row.id,
        sponsor_name: row.sponsor_name,
        sponsorship_type: row.sponsorship_type,
        website: row.website ?? null,
        logo_url: row.logo_link ?? null,
      })) ?? [];

    return NextResponse.json({
      ok: true,
      sponsors,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Something went wrong",
      },
      { status: 500 }
    );
  }
}