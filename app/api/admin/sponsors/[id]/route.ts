import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function formBoolean(value: FormDataEntryValue | null) {
  const text = String(value || "").trim().toLowerCase();

  return (
    text === "true" ||
    text === "1" ||
    text === "yes" ||
    text === "on"
  );
}

function normalizeSponsorType(value: string) {
  const raw = String(value || "").trim();

  if (!raw) return "normal_sponsorship";

  const lower = raw.toLowerCase();

  if (
    lower === "story" ||
    lower === "sponsor_story" ||
    lower === "sponsor-story"
  ) {
    return "Story";
  }

  if (
    lower === "sponsorship_in_kind" ||
    lower === "sponsorship in kind" ||
    lower === "in_kind" ||
    lower === "inkind"
  ) {
    return "sponsorship_in_kind";
  }

  return "normal_sponsorship";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function mapSponsorForResponse(data: any) {
  const isMainSponsor = Boolean(data?.is_main_sponsor);

  return {
    ...data,
    story: data?.story ?? null,
    is_main_sponsor: isMainSponsor,
    sponsor_display_type: isMainSponsor
      ? "Main Sponsor"
      : data?.sponsorship_type ?? "Sponsor",
  };
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Sponsor id is required." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("sponsor_applications")
      .select(`
        id,
        sponsor_name,
        contact_name,
        email,
        phone,
        sponsorship_type,
        website,
        logo_link,
        story,
        notes,
        slug,
        display_order,
        is_main_sponsor,
        address_line1,
        address_line2,
        city,
        county,
        postcode,
        country,
        created_at
      `)
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to load sponsor." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      sponsor: mapSponsorForResponse(data),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected error.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Sponsor id is required." },
        { status: 400 }
      );
    }

    const formData = await req.formData();

    const sponsor_name = String(formData.get("sponsor_name") ?? "").trim();
    const contact_name = String(formData.get("contact_name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const phone = String(formData.get("phone") ?? "").trim();

    const sponsorship_type = normalizeSponsorType(
      String(formData.get("sponsorship_type") ?? "").trim()
    );

    const website = String(formData.get("website") ?? "").trim();

    // Saves normal Sponsor Story AND Main Sponsor Story / Message.
    const story = String(formData.get("story") ?? "").trim();

    const notes = String(formData.get("notes") ?? "").trim();
    const slug = String(formData.get("slug") ?? "").trim();

    const address_line1 = String(formData.get("address_line1") ?? "").trim();
    const address_line2 = String(formData.get("address_line2") ?? "").trim();
    const city = String(formData.get("city") ?? "").trim();
    const county = String(formData.get("county") ?? "").trim();
    const postcode = String(formData.get("postcode") ?? "").trim();
    const country = String(formData.get("country") ?? "").trim();

    const is_main_sponsor = formBoolean(formData.get("is_main_sponsor"));

    if (!sponsor_name) {
      return NextResponse.json(
        { ok: false, error: "Sponsor name is required." },
        { status: 400 }
      );
    }

    if (!contact_name) {
      return NextResponse.json(
        { ok: false, error: "Contact name is required." },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { ok: false, error: "Email is required." },
        { status: 400 }
      );
    }

    const finalSlug =
      sponsorship_type === "Story"
        ? slug || slugify(sponsor_name)
        : slug || null;

    const updatePayload = {
      sponsor_name,
      contact_name,
      email,
      phone: phone || null,
      sponsorship_type,
      website: website || null,

      // Important: this saves the optional story/message for main sponsors.
      story: story || null,

      notes: notes || null,
      slug: finalSlug,
      address_line1: address_line1 || null,
      address_line2: address_line2 || null,
      city: city || null,
      county: county || null,
      postcode: postcode || null,
      country: country || "United Kingdom",
      is_main_sponsor,
      display_order: is_main_sponsor ? 1 : 9999,
    };

    const { data, error } = await supabaseAdmin
      .from("sponsor_applications")
      .update(updatePayload)
      .eq("id", id)
      .select(`
        id,
        sponsor_name,
        contact_name,
        email,
        phone,
        sponsorship_type,
        website,
        logo_link,
        story,
        notes,
        slug,
        display_order,
        is_main_sponsor,
        address_line1,
        address_line2,
        city,
        county,
        postcode,
        country,
        created_at
      `)
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to update sponsor." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      sponsor: mapSponsorForResponse(data),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected error.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Sponsor id is required." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("sponsor_applications")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to delete sponsor." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected error.",
      },
      { status: 500 }
    );
  }
}