import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1) Votes (no join)
    const { data: rawVotes, error: voteErr } = await supabaseAdmin()
      .from("competition_votes")
      .select(
        `
        id,
        created_at,
        first_name,
        last_name,
        email,
        voter_hash,
        user_agent,
        entry_id
      `
      )
      .order("created_at", { ascending: false })
      .limit(5000);

    if (voteErr) {
      return NextResponse.json({ ok: false, error: voteErr.message }, { status: 500 });
    }

    const votes = (rawVotes as any[]) || [];

    // 2) Load entries for the entry_ids we saw
    const entryIds = Array.from(
      new Set(votes.map((v) => String(v.entry_id || "")).filter(Boolean))
    );

    const entryMap = new Map<string, { business_name: string | null; address: string | null }>();

    if (entryIds.length) {
      const { data: entries, error: entryErr } = await supabaseAdmin()
        .from("competition_entries")
        .select("id,business_name,address")
        .in("id", entryIds);

      if (entryErr) {
        return NextResponse.json({ ok: false, error: entryErr.message }, { status: 500 });
      }

      for (const e of (entries as any[]) || []) {
        entryMap.set(String(e.id), {
          business_name: e.business_name ?? null,
          address: e.address ?? null,
        });
      }
    }

    // 3) Stats
    const totalVotes = votes.length;

    const uniqueEmails = new Set(
      votes.map((v) => String(v.email || "").trim().toLowerCase()).filter(Boolean)
    ).size;

    const uniqueDevices = new Set(
      votes.map((v) => String(v.voter_hash || "")).filter(Boolean)
    ).size;

    // 4) Leaderboard
    const map = new Map<
      string,
      { entryId: string; businessName: string; address?: string; votes: number }
    >();

    for (const v of votes) {
      const entryId = String(v.entry_id || "");
      const entry = entryMap.get(entryId);

      const businessName = entry?.business_name || "Unknown company";
      const address = entry?.address || "";

      const key = entryId || businessName;
      const existing = map.get(key);

      if (!existing) {
        map.set(key, {
          entryId,
          businessName,
          address: address || undefined,
          votes: 1,
        });
      } else {
        existing.votes += 1;
      }
    }

    const leaderboard = Array.from(map.values()).sort((a, b) => b.votes - a.votes);

    // 5) Rows for UI
    const shapedVotes = votes.map((v) => {
      const entryId = String(v.entry_id || "");
      const entry = entryMap.get(entryId);

      return {
        id: v.id,
        createdAt: v.created_at,
        firstName: v.first_name ?? null,
        lastName: v.last_name ?? null,
        email: v.email ?? null,
        voterHash: v.voter_hash ?? null,
        userAgent: v.user_agent ?? null,
        entryId,
        companyName: entry?.business_name || "Unknown company",
        companyAddress: entry?.address || null,
      };
    });

    return NextResponse.json({
      ok: true,
      stats: { totalVotes, uniqueEmails, uniqueDevices },
      leaderboard,
      votes: shapedVotes,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}