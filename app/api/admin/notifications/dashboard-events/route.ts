import { announcementRecipients } from "@/lib/notifications/recipient-labels";
import { isPortalOrigin } from "@/lib/notifications/request-origin";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
export const dynamic = "force-dynamic";
function reply(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
const command = z.discriminatedUnion("action", [
  z.object({ action: z.literal("test"), expectedAdminId: z.string().uuid() }),
  z.object({
    action: z.literal("announce"),
    expectedAdminId: z.string().uuid(),
    key: z.string().uuid(),
    title: z.string().trim().min(1).max(160),
    message: z.string().trim().min(1).max(1500),
    recipients: z.array(z.string().uuid()).min(1).max(500),
  }),
]);
export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin?.security_session_id)
    return reply({ error: "Sign in again." }, 401);
  const { data: access, error: accessError } = await supabaseAdmin.rpc(
    "admin_notifications_access",
    { p_admin: admin.id, p_session: admin.security_session_id },
  );
  if (accessError)
    return reply({ error: "Notification access is unavailable." }, 503);
  if (!access?.dashboard)
    return reply({ error: "Dashboard access is required." }, 403);
  const { data, error } = await supabaseAdmin.rpc(
    "admin_dashboard_notification_audience",
    { p_admin: admin.id, p_session: admin.security_session_id },
  );
  if (error)
    return reply(
      { error: "The announcement audience could not be loaded." },
      503,
    );
  return reply({ adminId: admin.id, audience: announcementRecipients(data) });
}
export async function POST(request: NextRequest) {
  if (
    !isPortalOrigin(request) ||
    !request.headers.get("content-type")?.startsWith("application/json")
  )
    return reply(
      { error: "Use the Admin Portal to create notifications." },
      403,
    );
  const admin = await getCurrentAdmin();
  if (!admin?.security_session_id)
    return reply({ error: "Sign in again." }, 401);
  const body = await request.text();
  if (body.length > 30000)
    return reply({ error: "Request is too large." }, 413);
  let input: unknown;
  try {
    input = JSON.parse(body);
  } catch {
    return reply({ error: "Invalid request." }, 400);
  }
  const parsed = command.safeParse(input);
  if (!parsed.success)
    return reply(
      { error: "Choose recipients and enter a title and message." },
      400,
    );
  if (parsed.data.expectedAdminId !== admin.id)
    return reply(
      { error: "The signed-in administrator changed. Reload before sending." },
      409,
    );
  const { data, error } = await supabaseAdmin.rpc(
    "admin_dashboard_notification_command",
    {
      p_admin: admin.id,
      p_session: admin.security_session_id,
      p_input: parsed.data,
    },
  );
  if (error || !data)
    return reply(
      {
        error:
          "The notification could not be confirmed. Retry using the same details.",
      },
      503,
    );
  if (data.result === "forbidden")
    return reply(
      { error: "You do not have permission to send this notification." },
      403,
    );
  if (data.result === "rate_limited")
    return reply(
      { error: "Wait one minute before adding another dashboard test." },
      429,
    );
  if (data.result !== "ok")
    return reply({ error: "The notification was not created." }, 400);
  return reply({ ok: true, id: data.id });
}
