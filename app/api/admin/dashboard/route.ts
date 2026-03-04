import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ✅ change this to match your real table name
const WOH_TABLE =
  process.env.WOH_TABLE_NAME || "competition_entries"; // try this first

async function countFromAnyTable(tableNames: string[]) {
  for (const t of tableNames) {
    const { count, error } = await supabase
      .from(t)
      .select("id", { count: "exact", head: true });

    // if table doesn't exist, Supabase returns an error — try next
    if (!error) return { table: t, count: count ?? 0 };
  }
  return { table: null, count: 0 };
}

export async function GET() {
  try {
    const nowIso = new Date().toISOString();

    // Upcoming events count
    const { count: upcomingCount, error: countErr } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .gte("start_at", nowIso);

    if (countErr) throw countErr;

    // Next 3 upcoming events
    const { data: nextEvents, error: nextErr } = await supabase
      .from("events")
      .select("id,title,start_at,location,is_published")
      .gte("start_at", nowIso)
      .order("start_at", { ascending: true })
      .limit(3);

    if (nextErr) throw nextErr;

    // ✅ Windows of Hope entries count (tries common table names too)
    const woh = await countFromAnyTable([
      WOH_TABLE,
      "window_entries",
      "competition_entries",
      "windows_hope_entries",
      "windows_of_hope",
    ]);

    return NextResponse.json({
      stats: {
        upcomingEvents: upcomingCount ?? 0,
        emailsSent30d: null,
        competitionEntries: woh.count, // ✅ now live
        websiteMessages: null,
      },
      nextEvents: nextEvents ?? [],
      windowsOfHope: {
        tableUsed: woh.table, // handy for debugging
        count: woh.count,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to load dashboard" },
      { status: 500 }
    );
  }
}