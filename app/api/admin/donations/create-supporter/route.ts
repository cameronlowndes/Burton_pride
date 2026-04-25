import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim();
    const supporterStory = String(body.supporterStory || "").trim();
    const supporterImageUrl = String(body.supporterImageUrl || "").trim();

    if (!fullName) {
      return NextResponse.json(
        { ok: false, error: "Supporter name is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("donations")
      .insert({
        full_name: fullName,
        email: email || null,
        message: "Manually added by admin",
        donation_type: "monthly",
        amount_pence: 0,
        currency: "gbp",
        status: "paid",
        supporter_story: supporterStory || null,
        supporter_image_url: supporterImageUrl || null,
        supporter_story_status: "approved",
        supporter_wall_approved: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, donation: data });
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