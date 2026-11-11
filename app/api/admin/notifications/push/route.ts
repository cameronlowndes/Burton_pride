import { isPortalOrigin } from "@/lib/notifications/request-origin";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentAdmin } from "@/lib/adminPermissions";
import {
  pushConfiguration,
  pushEndpoint,
  pushSubscription,
} from "@/lib/notifications/push";
import {
  processPushDelivery,
  type Delivery,
} from "@/lib/notifications/send-push";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const command = z.discriminatedUnion("action", [
  z.object({ action: z.literal("enable"), subscription: pushSubscription }),
  z.object({
    action: z.enum(["status", "disable", "test"]),
    endpoint: pushEndpoint,
  }),
]);

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin?.security_session_id)
    return reply({ error: "Sign in again." }, 401);
  const deliveryId = request.nextUrl.searchParams.get("delivery");
  if (deliveryId !== null) {
    if (!z.string().uuid().safeParse(deliveryId).success)
      return reply({ allowed: false }, 400);
    const { data, error } = await supabaseAdmin.rpc(
      "admin_notification_can_display_push",
      {
        p_admin: admin.id,
        p_session: admin.security_session_id,
        p_delivery: deliveryId,
      },
    );
    return reply({ allowed: !error && data === true }, error ? 503 : 200);
  }
  const { data: authorized, error } = await supabaseAdmin.rpc(
    "admin_notifications_access",
    {
      p_admin: admin.id,
      p_session: admin.security_session_id,
    },
  );
  if (error) {
    console.error("Phone notification authorization failed", {
      code: error.code,
    });
    return reply(
      {
        error:
          "Phone notification access is temporarily unavailable. Try again.",
      },
      503,
    );
  }
  if (!authorized?.dashboard && !authorized?.moderation) {
    return reply(
      {
        error:
          "Your account needs dashboard or moderation notification access. Sign in again if your session expired.",
      },
      403,
    );
  }
  const config = pushConfiguration();
  if (!config)
    return reply(
      { error: "Phone push keys are missing from the website server." },
      503,
    );
  return reply({ available: true, publicKey: config.publicKey });
}

async function sendTest(admin: string, session: string, endpoint: string) {
  const config = pushConfiguration();
  if (!config)
    return reply(
      { error: "Phone notifications have not been configured on the server." },
      503,
    );

  const { data, error } = await supabaseAdmin.rpc(
    "admin_notification_start_push_test",
    {
      p_admin: admin,
      p_session: session,
      p_endpoint: endpoint,
    },
  );
  if (error)
    return reply(
      { error: "Could not start the test notification. Try again." },
      503,
    );

  switch (data?.result) {
    case "disabled":
      return reply({ result: "disabled" });
    case "forbidden":
      return reply(
        { error: "Dashboard or moderation notification access is required." },
        403,
      );
    case "rate_limited":
      return reply(
        { error: "Wait one minute before sending another test." },
        429,
      );
    case "sending": {
      const job: Delivery = data.delivery;
      const { outcome, error: saveError } = await processPushDelivery(
        job,
        config,
      );
      if (saveError) {
        return reply(
          {
            error:
              "Could not confirm the test status. A retry may still be scheduled.",
          },
          503,
        );
      }
      if (outcome === "accepted") return reply({ result: "sent" });
      if (outcome === "retry") return reply({ result: "queued" }, 202);
      if (outcome === "expired") return reply({ result: "disabled" });
      return reply(
        { error: "The push service rejected the test notification." },
        502,
      );
    }
    default:
      return reply(
        { error: "Could not start the test notification. Try again." },
        503,
      );
  }
}

export async function POST(request: NextRequest) {
  if (
    !isPortalOrigin(request) ||
    !request.headers.get("content-type")?.startsWith("application/json")
  ) {
    return reply(
      { error: "This request must come from the Admin Portal." },
      403,
    );
  }
  const admin = await getCurrentAdmin();
  if (!admin?.security_session_id)
    return reply({ error: "Sign in again." }, 401);

  let input: unknown;
  try {
    const body = await request.text();
    if (body.length > 4096)
      return reply({ error: "Request is too large." }, 413);
    input = JSON.parse(body);
  } catch {
    return reply({ error: "Invalid request." }, 400);
  }
  const parsed = command.safeParse(input);
  if (!parsed.success)
    return reply(
      { error: "This browser’s push subscription is unsupported." },
      400,
    );

  const data = parsed.data;
  if (data.action === "test")
    return sendTest(admin.id, admin.security_session_id, data.endpoint);
  if (data.action === "enable" && !pushConfiguration()) {
    return reply(
      { error: "Phone notifications have not been configured on the server." },
      503,
    );
  }

  const { data: result, error } = await supabaseAdmin.rpc(
    "admin_notification_push_device",
    {
      p_admin: admin.id,
      p_session: admin.security_session_id,
      p_action: data.action,
      p_endpoint:
        data.action === "enable" ? data.subscription.endpoint : data.endpoint,
      p_subscription: data.action === "enable" ? data.subscription : null,
    },
  );
  if (error)
    return reply(
      { error: "Could not update phone notifications. Try again." },
      503,
    );

  switch (result) {
    case "enabled":
    case "disabled":
      return reply({ result });
    case "limit":
      return reply(
        {
          error:
            "You have reached the five-device limit. Disable an existing device first.",
        },
        409,
      );
    case "forbidden":
      return reply(
        { error: "Dashboard or moderation notification access is required." },
        403,
      );
    default:
      return reply({ error: "Could not update this device." }, 400);
  }
}
