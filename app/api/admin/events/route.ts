import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const { userId } = await auth();

  if (!userId) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);

  const email =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ||
    user.emailAddresses[0]?.emailAddress ||
    "";

  const allowed = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (allowed.length === 0) {
    return {
      ok: false as const,
      res: NextResponse.json(
        { error: "Admin emails not configured (ADMIN_EMAILS missing)" },
        { status: 403 }
      ),
    };
  }

  if (!allowed.includes(email.toLowerCase())) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const, userId, email };
}

export async function GET() {
  const check = await requireAdmin();
  if (!check.ok) return check.res;

  try {
    // 1) Load votes
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

    // 2) Load entries for entry_ids (no join needed)
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
    const lb = new Map<
      string,
      { entryId: string; businessName: string; address?: string; votes: number }
    >();

    for (const v of votes) {
      const entryId = String(v.entry_id || "");
      const entry = entryMap.get(entryId);

      const businessName = entry?.business_name || "Unknown company";
      const address = entry?.address || "";

      const key = entryId || businessName;
      const cur = lb.get(key);

      if (!cur) {
        lb.set(key, { entryId, businessName, address: address || undefined, votes: 1 });
      } else {
        cur.votes += 1;
      }
    }

    const leaderboard = Array.from(lb.values()).sort((a, b) => b.votes - a.votes);

    // 5) Shape votes for UI
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