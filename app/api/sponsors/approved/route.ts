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
        story,
        message,
        slug,
        status,
        display_order,
        created_at
      `)
      .eq("status", "approved")
      .order("display_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    const sponsors =
      data?.map((row) => ({
        id: String(row.id),
        sponsor_name: row.sponsor_name ?? "",
        sponsorship_type: row.sponsorship_type ?? null,
        logo_link: row.logo_link ?? null,
        website: row.website ?? null,
        story: row.story ?? row.message ?? null,
        slug: row.slug ?? null,
        status: row.status ?? null,
        display_order:
          typeof row.display_order === "number" ? row.display_order : null,
      })) ?? [];

    return NextResponse.json({
      ok: true,
      sponsors,
    });
  } catch (error) {
    console.error("Sponsors approved route error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Something went wrong",
      },
      { status: 500 }
    );
  }
}