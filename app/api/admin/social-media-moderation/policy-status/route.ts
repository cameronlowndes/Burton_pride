import { NextResponse } from "next/server";
import { requireModeration, ModerationAccessError } from "@/lib/moderation/access";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET() {
  try {
    await requireModeration();

    const { data, error } = await supabaseAdmin
      .from("moderation_policy_versions")
      .select("id,version,approved_at")
      .not("approved_at", "is", null)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return json({ ok: true, policy: data });
  } catch (error) {
    if (error instanceof ModerationAccessError) return json({ ok: false, error: error.message }, error.status);
    console.error("Could not load moderation policy approval", error);
    return json({ ok: false, error: "Policy approval status unavailable." }, 503);
  }
}

