import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function uploadSponsorLogo(file: File, sponsorId: string) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const originalName = file.name || "logo";
  const extension = originalName.includes(".")
    ? originalName.split(".").pop()?.toLowerCase() || "png"
    : "png";

  const safeExtension = extension.replace(/[^a-z0-9]/g, "") || "png";
  const filePath = `sponsors/${sponsorId}/${Date.now()}-logo.${safeExtension}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("sponsor-logos")
    .upload(filePath, buffer, {
      contentType: file.type || "image/png",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(uploadError.message || "Failed to upload logo");
  }

  const { data: publicUrlData } = supabaseAdmin.storage
    .from("sponsor-logos")
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const { data, error } = await supabaseAdmin
      .from("sponsor_applications")
      .select(
        `
          id,
          sponsor_name,
          contact_name,
          email,
          phone,
          sponsorship_type,
          logo_link,
          message
        `
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        {
          ok: false,
          error: error?.message || "Sponsor not found",
        },
        { status: 404 }
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
        error: error instanceof Error ? error.message : "Something went wrong",
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const formData = await req.formData();

    const sponsor_name = String(formData.get("sponsor_name") || "").trim();
    const contact_name = String(formData.get("contact_name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const phone = String(formData.get("phone") || "").trim();
    const sponsorship_type = String(formData.get("sponsorship_type") || "").trim();
    const message = String(formData.get("message") || "").trim();
    const logo = formData.get("logo");

    if (!sponsor_name) {
      return NextResponse.json(
        { ok: false, error: "Sponsor name is required" },
        { status: 400 }
      );
    }

    if (!contact_name) {
      return NextResponse.json(
        { ok: false, error: "Contact name is required" },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { ok: false, error: "Email is required" },
        { status: 400 }
      );
    }

    if (!sponsorship_type) {
      return NextResponse.json(
        { ok: false, error: "Sponsorship type is required" },
        { status: 400 }
      );
    }

    let logo_link: string | undefined;

    if (logo instanceof File && logo.size > 0) {
      logo_link = await uploadSponsorLogo(logo, id);
    }

    const updates: Record<string, unknown> = {
      sponsor_name,
      contact_name,
      email,
      phone: phone || null,
      sponsorship_type,
      message: message || null,
    };

    if (logo_link) {
      updates.logo_link = logo_link;
    }

    const { data, error } = await supabaseAdmin
      .from("sponsor_applications")
      .update(updates)
      .eq("id", id)
      .select(
        `
          id,
          sponsor_name,
          contact_name,
          email,
          phone,
          sponsorship_type,
          logo_link,
          message
        `
      )
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Failed to update sponsor",
        },
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
        error: error instanceof Error ? error.message : "Something went wrong",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const { error } = await supabaseAdmin
      .from("sponsor_applications")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Failed to delete sponsor application",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
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