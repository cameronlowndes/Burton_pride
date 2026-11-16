import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { isPortalOrigin } from "@/lib/notifications/request-origin";
import { syncEmailNotifications } from "@/lib/notifications/email-sync";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin?.security_session_id)
    return reply({ error: "Sign in again." }, 401);
  const { data, error } = await supabaseAdmin.rpc(
    "admin_email_notification_status",
    { p_admin: admin.id, p_session: admin.security_session_id },
  );
  if (error || !data)
    return reply(
      {
        error:
          "Email notification setup is unavailable. Install the Email Centre SQL update.",
      },
      503,
    );
  if (data.result !== "ok")
    return reply(
      { error: "Your account needs Email Centre and dashboard access." },
      403,
    );
  return reply(data);
}
export async function POST(request: NextRequest) {
  if (
    !isPortalOrigin(request) ||
    !request.headers.get("content-type")?.startsWith("application/json")
  )
    return reply({ error: "Use the Admin Portal to check email." }, 403);
  const admin = await getCurrentAdmin();
  if (!admin?.security_session_id)
    return reply({ error: "Sign in again." }, 401);
  const body = await request.text();
  if (body.length > 500) return reply({ error: "Request too large." }, 413);
  try {
    if (JSON.parse(body).expectedAdminId !== admin.id)
      return reply({ error: "Your account changed. Reload the page." }, 409);
  } catch {
    return reply({ error: "Invalid request." }, 400);
  }
  const { data, error } = await supabaseAdmin.rpc(
    "admin_email_notification_status",
    { p_admin: admin.id, p_session: admin.security_session_id },
  );
  if (error)
    return reply({ error: "Email notification setup is unavailable." }, 503);
  if (data?.result !== "ok")
    return reply(
      { error: "Your account needs Email Centre and dashboard access." },
      403,
    );
  try {
    return reply(await syncEmailNotifications(admin.id));
  } catch {
    return reply(
      { error: "The check could not be saved. Try again after a few minutes." },
      503,
    );
  }
}
