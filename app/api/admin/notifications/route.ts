import { NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/adminPermissions";
import { isNotificationSource } from "@/lib/notifications/sources";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const dynamic = "force-dynamic";

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin?.security_session_id) return response({ error: "Sign in again." }, 401);

  const params = request.nextUrl.searchParams;
  const page = params.get("page");
  const source = params.get("source");
  if ((page !== null && !/^(?:[1-9]\d{0,2}|1000)$/.test(page)) ||
      (source !== null && !isNotificationSource(source))) {
    return response({ error: "Invalid notification filters." }, 400);
  }

  const { data, error } = await supabaseAdmin.rpc("admin_notifications_inbox", {
    p_admin: admin.id,
    p_session: admin.security_session_id,
    p_page: page === null ? null : Number(page),
    p_unread_only: params.get("unread") === "1",
    p_source: source,
  });
  if (error) return response({ error: "Notifications are temporarily unavailable." }, 503);
  return response(data);
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return response({ error: "This request must come from the Admin Portal." }, 403);
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) {
    return response({ error: "Invalid notification ID." }, 400);
  }

  const admin = await getCurrentAdmin();
  if (!admin?.security_session_id) return response({ error: "Sign in again." }, 401);

  const { data, error } = await supabaseAdmin.rpc("admin_notifications_mark_read", {
    p_admin: admin.id,
    p_session: admin.security_session_id,
    p_alert: id,
  });
  if (error) return response({ error: "Could not mark the notification as read." }, 503);
  if (!data) return response({ error: "Notification unavailable." }, 404);
  return response({ ok: true });
}
