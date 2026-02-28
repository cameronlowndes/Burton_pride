import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Status = "pending" | "approved" | "rejected";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const id = params.id;
    const body = await req.json();

    const status = body.status as Status | undefined;
    const featured =
      typeof body.featured === "boolean" ? (body.featured as boolean) : undefined;

    const patch: Record<string, any> = {};
    if (status) patch.status = status;
    if (featured !== undefined) patch.featured = featured;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { ok: false, error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin()
      .from("competition_entries")
      .update(patch)
      .eq("id", id);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}