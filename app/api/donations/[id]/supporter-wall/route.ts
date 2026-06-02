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
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const supporterStoryStatus =
      body.supporterStoryStatus === "approved" ||
      body.supporterStoryStatus === "rejected" ||
      body.supporterStoryStatus === "pending"
        ? body.supporterStoryStatus
        : "pending";

    const supporterWallApproved = Boolean(body.supporterWallApproved);

    const { data, error } = await supabaseAdmin
      .from("donations")
      .update({
        supporter_story_status: supporterStoryStatus,
        supporter_wall_approved: supporterWallApproved,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
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