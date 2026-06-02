import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const { entryId, imageUrl } = await req.json();

    if (!entryId || !imageUrl) {
      return NextResponse.json(
        { ok: false, error: "Missing entryId or imageUrl" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("competition_entries")
      .update({ image_url: imageUrl })
      .eq("id", entryId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}