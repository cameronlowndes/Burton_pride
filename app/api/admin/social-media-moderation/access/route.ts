import { NextResponse } from "next/server";
import { requireModeration, ModerationAccessError } from "@/lib/moderation/access";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie, Authorization", "X-Content-Type-Options": "nosniff" };
export async function GET() {
  try {
    const actor = await requireModeration();
    // No session/device token or security-session identifier is returned.
    return NextResponse.json({ ok: true, fingerprint: JSON.stringify([actor.id, actor.role, actor.displayName, [...actor.permissionKeys].sort()]) }, { headers });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof ModerationAccessError ? error.message : "Access checks are unavailable." }, { status: error instanceof ModerationAccessError ? error.status : 503, headers });
  }
}
