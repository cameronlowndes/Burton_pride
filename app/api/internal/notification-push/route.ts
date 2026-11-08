import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import webPush from "web-push";

import { pushConfiguration, pushSubscription } from "@/lib/notifications/push";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Delivery = {
  delivery_id: string;
  attempt: number;
  subscription: unknown;
  is_test: boolean;
};

type Outcome = "accepted" | "failed" | "retry" | "expired";

async function deliver(job: Delivery, config: NonNullable<ReturnType<typeof pushConfiguration>>): Promise<Outcome> {
  const subscription = pushSubscription.safeParse(job.subscription);
  if (!subscription.success) return "failed";

  try {
    await webPush.sendNotification(
      subscription.data,
      JSON.stringify({ id: job.delivery_id, test: job.is_test }),
      {
        vapidDetails: config,
        TTL: 600,
        timeout: 5000,
        topic: job.delivery_id.replaceAll("-", ""),
      },
    );
    return "accepted";
  } catch (error) {
    const code = error instanceof webPush.WebPushError ? error.statusCode : null;
    if (code === 404 || code === 410) return "expired";
    if (code === null || code === 429 || code >= 500) return "retry";
    return "failed";
  }
}

export async function POST(request: NextRequest) {
  const match = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.get("authorization") ?? "");
  if (!match) return new NextResponse(null, { status: 401 });
  const config = pushConfiguration();
  if (!config) return new NextResponse(null, { status: 503 });

  const { data, error } = await supabaseAdmin.rpc("admin_notification_claim_push", {
    p_token_hash: createHash("sha256").update(match[1]).digest("hex"),
  });
  if (error) return new NextResponse(null, { status: 503 });

  const results = await Promise.all((data as Delivery[]).map(async (job) => {
    const result = await deliver(job, config);
    return supabaseAdmin.rpc("admin_notification_finish_push", {
      p_delivery: job.delivery_id,
      p_attempt: job.attempt,
      p_result: result,
    });
  }));

  return new NextResponse(null, { status: results.some((result) => result.error) ? 503 : 204 });
}
