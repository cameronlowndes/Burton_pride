// app/api/windows/vote/status/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const voterId = cookieStore.get("voter_id")?.value;

    if (!voterId) {
      return NextResponse.json({ ok: true, votedEntryId: null });
    }

    const voterHash = sha256(voterId);

    const { data, error } = await supabaseAdmin
      .from("competition_votes")
      .select("entry_id")
      .eq("voter_hash", voterHash)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, votedEntryId: data?.entry_id || null });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}