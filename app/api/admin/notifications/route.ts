import { stockNotificationCategories } from "@/lib/notifications/stock";
import { moneyNotificationCategories } from "@/lib/notifications/money";
import { lotteryNotificationCategories } from "@/lib/notifications/lottery";
import { eventHubNotificationCategories } from "@/lib/notifications/event-hub";
import { emailNotificationCategories } from "@/lib/notifications/email";
import { bugNotificationCategories } from "@/lib/notifications/bug-tracker";
import { isPortalOrigin } from "@/lib/notifications/request-origin";
import { NextRequest, NextResponse } from "next/server";

import { requireSecureAdmin, moderationCan, ModerationAccessError } from "@/lib/moderation/access";
import { filterModerationFeed } from "@/lib/moderation/notification-access";
import { dashboardCategories } from "@/lib/notifications/dashboard";
import { isNotificationSource } from "@/lib/notifications/sources";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const dynamic = "force-dynamic";

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

async function readFeed(request: NextRequest) {
  const admin = await requireSecureAdmin();
  if (!admin?.security_session_id)
    return response({ error: "Sign in again." }, 401);

  const params = request.nextUrl.searchParams;
  const page = params.get("page");
  const source = params.get("source");
  const canModeration = moderationCan(admin, "moderation:view");
  if (source === "moderation" && !canModeration) return response({ error: "Moderation viewing permission is required." }, 403);
  const category = params.get("category");
  const priority = params.get("priority");
  if (
    (category !== null &&
      !Object.hasOwn(dashboardCategories, category) &&
      !Object.hasOwn(bugNotificationCategories, category) &&
      !Object.hasOwn(emailNotificationCategories, category) &&
      !Object.hasOwn(eventHubNotificationCategories, category) &&
      !Object.hasOwn(lotteryNotificationCategories, category) &&
      !Object.hasOwn(moneyNotificationCategories, category) &&
      !Object.hasOwn(stockNotificationCategories, category)) ||
    (priority !== null && !["routine", "action", "urgent"].includes(priority))
  )
    return response({ error: "Invalid notification filters." }, 400);
  if (
    (page !== null && !/^(?:[1-9]\d{0,2}|1000)$/.test(page)) ||
    (source !== null && !isNotificationSource(source))
  ) {
    return response({ error: "Invalid notification filters." }, 400);
  }

  const { data, error } = await supabaseAdmin.rpc("admin_notifications_feed", {
    p_admin: admin.id,
    p_session: admin.security_session_id,
    p_page: page === null ? null : Number(page),
    p_unread_only: params.get("unread") === "1",
    p_source: source,
    p_category: category,
    p_priority: priority,
  });
  if (error)
    return response(
      { error: "Notifications are temporarily unavailable." },
      503,
    );
  return response(filterModerationFeed(data, canModeration));
}

async function markRead(request: NextRequest) {
  if (!isPortalOrigin(request)) {
    return response(
      { error: "This request must come from the Admin Portal." },
      403,
    );
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) {
    return response({ error: "Invalid notification ID." }, 400);
  }

  const admin = await requireSecureAdmin();
  if (!admin?.security_session_id)
    return response({ error: "Sign in again." }, 401);

  const body = await request.text();
  if (body.length > 500) return response({ error: "Request too large." }, 413);
  let expected: unknown;
  if (body) {
    try {
      expected = JSON.parse(body).expectedAdminId;
    } catch {
      return response({ error: "Invalid request." }, 400);
    }
    if (typeof expected !== "string" || expected !== admin.id)
      return response(
        { error: "The signed-in account changed. Reload this page." },
        409,
      );
  }
  const { data, error } = await supabaseAdmin.rpc(
    "admin_notifications_mark_read",
    {
      p_admin: admin.id,
      p_session: admin.security_session_id,
      p_alert: id,
    },
  );
  if (error)
    return response({ error: "Could not mark the notification as read." }, 503);
  if (!data) return response({ error: "Notification unavailable." }, 404);
  return response({ ok: true });
}


async function safely(operation: () => Promise<NextResponse>) {
  try { return await operation(); }
  catch (error) { return response({ error: error instanceof ModerationAccessError ? error.message : "Notifications are temporarily unavailable." }, error instanceof ModerationAccessError ? error.status : 503); }
}
export async function GET(request: NextRequest) { return safely(() => readFeed(request)); }
export async function POST(request: NextRequest) { return safely(() => markRead(request)); }
