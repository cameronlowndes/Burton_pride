import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getSupabaseClient() {
  return typeof supabaseAdmin === "function" ? supabaseAdmin : supabaseAdmin;
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseClient();
    const formData = await req.formData();

    const sponsor_name = String(formData.get("sponsor_name") || "").trim();
    const contact_name = String(formData.get("contact_name") || "").trim();
    const email =
      String(formData.get("email") || "").trim().toLowerCase() ||
      `no-email+${Date.now()}@burtonpride.local`;
    const phone = String(formData.get("phone") || "").trim();
    const sponsorship_type = String(formData.get("sponsorship_type") || "").trim();
    const website = String(formData.get("website") || "").trim();
    const story = String(formData.get("story") || "").trim();
    const notes = String(formData.get("notes") || "").trim();
    const slug = String(formData.get("slug") || "").trim();
    const address_line1 = String(formData.get("address_line1") || "").trim();
    const address_line2 = String(formData.get("address_line2") || "").trim();
    const city = String(formData.get("city") || "").trim();
    const county = String(formData.get("county") || "").trim();
    const postcode = String(formData.get("postcode") || "").trim();
    const country = String(formData.get("country") || "").trim();
    const logoFile = formData.get("logo");

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

    if (!sponsorship_type) {
      return NextResponse.json(
        { ok: false, error: "Sponsorship type is required." },
        { status: 400 }
      );
    }

    let logo_link: string | null = null;

    if (logoFile instanceof File && logoFile.size > 0) {
      const safeName = slugify(sponsor_name || "sponsor");
      const originalName = logoFile.name || "logo.png";
      const ext = originalName.includes(".")
        ? originalName.split(".").pop()?.toLowerCase() || "png"
        : "png";

      const filePath = `sponsors/${Date.now()}-${safeName}.${ext}`;
      const arrayBuffer = await logoFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabase.storage
        .from("sponsor-logos")
        .upload(filePath, buffer, {
          contentType: logoFile.type || "image/png",
          upsert: true,
        });

      if (uploadError) {
        return NextResponse.json(
          { ok: false, error: uploadError.message },
          { status: 400 }
        );
      }

      const { data: publicUrlData } = supabase.storage
        .from("sponsor-logos")
        .getPublicUrl(filePath);

      logo_link = publicUrlData.publicUrl;
    }

    const finalSlug = slug || slugify(sponsor_name);

    const insertPayload = {
      sponsor_name,
      contact_name,
      email,
      phone: phone || null,
      sponsorship_type,
      website: website || null,
      story: story || null,
      notes: notes || null,
      slug: finalSlug || null,
      logo_link,
      address_line1: address_line1 || null,
      address_line2: address_line2 || null,
      city: city || null,
      county: county || null,
      postcode: postcode || null,
      country: country || null,
      status: "approved",
      is_read: true,
      display_order: 9999,
    };

    console.log("Insert sponsor payload:", insertPayload);

    const { data, error } = await supabase
      .from("sponsor_applications")
      .insert(insertPayload)
      .select(`
        id,
        sponsor_name,
        sponsorship_type,
        logo_link,
        story,
        slug,
        display_order
      `)
      .single();

    if (error) {
      console.error("Insert sponsor error:", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, sponsor: data });
  } catch (error) {
    console.error("Create sponsor API error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Something went wrong",
      },
      { status: 500 }
    );
  }
}