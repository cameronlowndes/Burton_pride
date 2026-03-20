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

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const sponsor_name = String(formData.get("sponsor_name") || "").trim();
    const sponsorship_type = String(formData.get("sponsorship_type") || "").trim();
    const website = String(formData.get("website") || "").trim();
    const story = String(formData.get("story") || "").trim();
    const notes = String(formData.get("notes") || "").trim();
    const slug = String(formData.get("slug") || "").trim();
    const logoFile = formData.get("logo");

    if (!sponsor_name) {
      return NextResponse.json(
        { ok: false, error: "Sponsor name is required." },
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

    if (logoFile && logoFile instanceof File && logoFile.size > 0) {
      const safeName = slugify(sponsor_name || "sponsor");
      const ext = logoFile.name.includes(".")
        ? logoFile.name.split(".").pop()?.toLowerCase() || "png"
        : "png";

      const filePath = `sponsors/${Date.now()}-${safeName}.${ext}`;
      const arrayBuffer = await logoFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabaseAdmin.storage
        .from("sponsor-logos")
        .upload(filePath, buffer, {
          contentType: logoFile.type || "image/png",
          upsert: true,
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        return NextResponse.json(
          { ok: false, error: uploadError.message },
          { status: 400 }
        );
      }

      const { data: publicUrlData } = supabaseAdmin.storage
        .from("sponsor-logos")
        .getPublicUrl(filePath);

      logo_link = publicUrlData.publicUrl;
    }

    const finalSlug = slug || slugify(sponsor_name);

    const { error: insertError } = await supabaseAdmin
      .from("sponsors")
      .insert({
        sponsor_name,
        sponsorship_type,
        website: website || null,
        story: story || null,
        notes: notes || null,
        slug: finalSlug || null,
        logo_link,
      });

    if (insertError) {
      console.error("Insert sponsor error:", insertError);
      return NextResponse.json(
        { ok: false, error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Create sponsor API error:", error);
    return NextResponse.json(
      { ok: false, error: "Something went wrong creating sponsor." },
      { status: 500 }
    );
  }
}