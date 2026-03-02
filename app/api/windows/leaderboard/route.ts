import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1) Load approved entries (public-safe fields only)
    const { data: entries, error: entryErr } = await supabaseAdmin
      .from("competition_entries")
      .select("id,business_name,address,image_url,status")
      .eq("status", "approved")
      .limit(5000);

    if (entryErr) {
      return NextResponse.json({ ok: false, error: entryErr.message }, { status: 500 });
    }

    const safeEntries = (entries as any[]) || [];

    // 2) Load votes (entry_id only) and count in JS
    const { data: votes, error: voteErr } = await supabaseAdmin
      .from("competition_votes")
      .select("entry_id")
      .limit(200000); // plenty for normal use; raise if needed

    if (voteErr) {
      return NextResponse.json({ ok: false, error: voteErr.message }, { status: 500 });
    }

    const voteRows = (votes as any[]) || [];

    const counts = new Map<string, number>();
    for (const v of voteRows) {
      const id = String(v.entry_id || "");
      if (!id) continue;
      counts.set(id, (counts.get(id) || 0) + 1);
    }

    // 3) Build leaderboard rows for approved entries only
    const leaderboard = safeEntries
      .map((e) => {
        const id = String(e.id);
        return {
          entryId: id,
          businessName: e.business_name || "Unnamed business",
          address: e.address || null,
          imageUrl: e.image_url || null,
          votes: counts.get(id) || 0,
        };
      })
      .sort((a, b) => b.votes - a.votes);

    const totalVotes = leaderboard.reduce((sum, r) => sum + r.votes, 0);

    return NextResponse.json({
      ok: true,
      totalVotes,
      leaderboard,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}