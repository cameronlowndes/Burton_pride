import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { pushConfiguration } from "@/lib/notifications/push";
import { processPushDelivery, type Delivery } from "@/lib/notifications/send-push";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const match = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.get("authorization") ?? "");
  if (!match) return new NextResponse(null, { status: 401 });
  const config = pushConfiguration();
  if (!config) return new NextResponse(null, { status: 503 });

  const { data, error } = await supabaseAdmin.rpc("admin_notification_claim_push", {
    p_token_hash: createHash("sha256").update(match[1]).digest("hex"),
  });
  if (error) return new NextResponse(null, { status: 503 });

  const results = await Promise.all((data as Delivery[]).map((job) => processPushDelivery(job, config)));

  return new NextResponse(null, { status: results.some((result) => result.error) ? 503 : 204 });
}
