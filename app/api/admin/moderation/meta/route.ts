import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as db } from "@/lib/supabase/supabaseAdmin";
import { normalizeEvents } from "@/supabase/functions/_shared/moderation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
  const supplied = p.get("hub.verify_token") || "";
  if (
    !expected ||
    p.get("hub.mode") !== "subscribe" ||
    expected.length !== supplied.length ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))
  )
    return new NextResponse("Forbidden", { status: 403 });
  return new NextResponse(p.get("hub.challenge") || "", {
    headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
  });
}
export async function POST(request: NextRequest) {
  const secret = process.env.META_APP_SECRET;
  if (!secret)
    return new NextResponse("Webhook not configured", { status: 503 });
  if (Number(request.headers.get("content-length") || 0) > 1000000)
    return new NextResponse("Payload too large", { status: 413 });
  const raw = Buffer.from(await request.arrayBuffer());
  if (raw.length > 1000000)
    return new NextResponse("Payload too large", { status: 413 });
  const signature = request.headers.get("x-hub-signature-256") || "";
  const expected = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  if (
    !/^sha256=[a-f0-9]{64}$/.test(signature) ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    return new NextResponse("Forbidden", { status: 403 });
  let payload: unknown;
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch {
    return new NextResponse("Invalid payload", { status: 400 });
  }
  const events = normalizeEvents(payload, {
    facebook: process.env.META_FACEBOOK_PAGE_ID || "",
    instagram: process.env.META_INSTAGRAM_ACCOUNT_ID || "",
  });
  if (events.length) {
    const rows = events.map((event) => ({
      ...event,
      event_key: createHash("sha256")
        .update(
          JSON.stringify([
            event.platform,
            event.account_id,
            event.comment_id,
            event.content,
          ]),
        )
        .digest("hex"),
    }));
    const { error } = await db
      .from("moderation_jobs")
      .upsert(rows, { onConflict: "event_key", ignoreDuplicates: true });
    // Acknowledge only after durable storage. Paused service still preserves received events.
    if (error)
      return new NextResponse("Event storage unavailable; retry delivery", {
        status: 503,
      });
  }
  return NextResponse.json({ received: true });
}
