import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SponsorRow = {
  id: string | number;
  sponsor_name?: string | null;
  sponsorship_type?: string | null;
  logo_link?: string | null;
  website?: string | null;
  story?: string | null;
  message?: string | null;
  status?: string | null;
  display_order?: number | null;
  created_at?: string | null;
  slug?: string | null;
  is_main_sponsor?: boolean | null;
};

function formatSponsorType(value?: string | null) {
  const raw = String(value || "").trim();

  if (!raw) return "Sponsor";

  return raw
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

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
        status,
        display_order,
        created_at,
        slug,
        is_main_sponsor
      `)
      .eq("status", "approved")
      .order("is_main_sponsor", { ascending: false })
      .order("display_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase error:", error);

      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Failed to load approved sponsors.",
        },
        { status: 500 }
      );
    }

    const sponsors =
      (data as SponsorRow[] | null)?.map((row) => {
        const isMainSponsor = Boolean(row.is_main_sponsor);
        const story = String(row.story || row.message || "").trim();

        return {
          id: String(row.id),
          sponsor_name: row.sponsor_name ?? "",
          sponsorship_type: row.sponsorship_type ?? null,
          logo_link: row.logo_link ?? null,
          website: row.website ?? null,
          status: row.status ?? null,
          slug: row.slug ?? null,
          display_order:
            typeof row.display_order === "number" ? row.display_order : null,
          created_at: row.created_at ?? null,

          // This is important for the public Main Sponsor styling.
          is_main_sponsor: isMainSponsor,

          // This is important for the story button/modal.
          story: story || null,
          message: row.message ?? null,
          has_story: story.length > 0,

          // This lets SponsorCard show Main Sponsor instead of Normal Sponsorship.
          sponsor_display_type: isMainSponsor
            ? "Main Sponsor"
            : formatSponsorType(row.sponsorship_type),
        };
      }) ?? [];

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