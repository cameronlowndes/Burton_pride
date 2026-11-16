import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { syncEmailNotifications } from "@/lib/notifications/email-sync";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (
    !secret ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    // One connection per invocation keeps the deadline bounded. Oldest due runs first.
    return NextResponse.json(await syncEmailNotifications(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Email check failed; the stored cursor was retained." },
      { status: 503 },
    );
  }
}
