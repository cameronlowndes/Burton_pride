import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await req.json();

    const fullName = String(body.fullName || "").trim();
    const supporterStory = String(body.supporterStory || "").trim();
    const supporterImageUrl = String(body.supporterImageUrl || "").trim();
    const pronouns = String(body.pronouns || "").trim();
    const identityLabel = String(body.identityLabel || "").trim();

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Donation ID is required" },
        { status: 400 }
      );
    }

    if (!fullName) {
      return NextResponse.json(
        { ok: false, error: "Supporter name is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("donations")
      .update({
        full_name: fullName,
        supporter_story: supporterStory || null,
        supporter_image_url: supporterImageUrl || null,
        pronouns: pronouns || null,
        identity_label: identityLabel || null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      donation: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Server error",
      },
      { status: 500 }
    );
  }
}