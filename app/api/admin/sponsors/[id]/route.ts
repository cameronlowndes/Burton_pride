import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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
      .select("*")
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
      sponsor: data,
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
    const formData = await req.formData();

    const sponsor_name = String(formData.get("sponsor_name") ?? "").trim();
    const contact_name = String(formData.get("contact_name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const phone = String(formData.get("phone") ?? "").trim();
    const sponsorship_type = String(formData.get("sponsorship_type") ?? "").trim();
    const website = String(formData.get("website") ?? "").trim();
    const story = String(formData.get("story") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const slug = String(formData.get("slug") ?? "").trim();
    const address_line1 = String(formData.get("address_line1") ?? "").trim();
    const address_line2 = String(formData.get("address_line2") ?? "").trim();
    const city = String(formData.get("city") ?? "").trim();
    const county = String(formData.get("county") ?? "").trim();
    const postcode = String(formData.get("postcode") ?? "").trim();
    const country = String(formData.get("country") ?? "").trim();

    const updatePayload = {
      sponsor_name,
      contact_name,
      email,
      phone: phone || null,
      sponsorship_type: sponsorship_type || null,
      website: website || null,
      story: story || null,
      notes: notes || null,
      slug: slug || null,
      address_line1: address_line1 || null,
      address_line2: address_line2 || null,
      city: city || null,
      county: county || null,
      postcode: postcode || null,
      country: country || "United Kingdom",
    };

    const { data, error } = await supabaseAdmin
      .from("sponsor_applications")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to update sponsor." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      sponsor: data,
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