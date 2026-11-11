import "server-only";

import * as webPushExports from "web-push";

import { pushConfiguration, pushSubscription } from "@/lib/notifications/push";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

// Accept the CommonJS export and the newer named ESM exports.
const webPush: typeof webPushExports =
  Reflect.get(webPushExports, "default") ?? webPushExports;

export type Delivery = {
  delivery_id: string;
  attempt: number;
  subscription: unknown;
  is_test: boolean;
};

type Outcome = "accepted" | "failed" | "retry" | "expired";

async function deliver(
  job: Delivery,
  config: NonNullable<ReturnType<typeof pushConfiguration>>,
  kind: string,
): Promise<Outcome> {
  const subscription = pushSubscription.safeParse(job.subscription);
  if (!subscription.success) return "failed";

  try {
    await webPush.sendNotification(
      subscription.data,
      JSON.stringify({
        id: job.delivery_id,
        test: job.is_test,
        summary: kind === "summary",
        kind,
      }),
      {
        vapidDetails: config,
        TTL: 600,
        timeout: 5000,
        topic: job.delivery_id.replaceAll("-", ""),
      },
    );
    return "accepted";
  } catch (error) {
    const code =
      error instanceof webPush.WebPushError ? error.statusCode : null;
    if (code === 404 || code === 410) return "expired";
    if (code === null || code === 429 || code >= 500) return "retry";
    return "failed";
  }
}

export async function processPushDelivery(
  job: Delivery,
  config: NonNullable<ReturnType<typeof pushConfiguration>>,
) {
  const { data: state, error: stateError } = await supabaseAdmin.rpc(
    "admin_notification_push_send_state",
    {
      p_delivery: job.delivery_id,
      p_attempt: job.attempt,
    },
  );
  if (stateError) return { outcome: "retry" as const, error: stateError };
  if (
    ![
      "send",
      "summary",
      "urgent_review",
      "high_review",
      "system_alert",
      "dashboard_alert",
    ].includes(state)
  )
    return { outcome: "skipped" as const, error: null };

  const outcome = await deliver(job, config, state);
  const { error } = await supabaseAdmin.rpc("admin_notification_finish_push", {
    p_delivery: job.delivery_id,
    p_attempt: job.attempt,
    p_result: outcome,
  });
  return { outcome, error };
}
