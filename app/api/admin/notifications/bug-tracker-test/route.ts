import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { isPortalOrigin } from "@/lib/notifications/request-origin";
export const dynamic = "force-dynamic";
function reply(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export async function POST(request: NextRequest) {
  if (
    !isPortalOrigin(request) ||
    !request.headers.get("content-type")?.startsWith("application/json")
  )
    return reply({ error: "Use the Admin Portal to send a test." }, 403);
  const admin = await getCurrentAdmin();
  if (!admin?.security_session_id)
    return reply({ error: "Sign in again." }, 401);
  const body = await request.text();
  if (body.length > 500) return reply({ error: "Request is too large." }, 413);
  let expected: unknown;
  try {
    expected = JSON.parse(body).expectedAdminId;
  } catch {
    return reply({ error: "Invalid request." }, 400);
  }
  if (expected !== admin.id)
    return reply(
      {
        error:
          "The signed-in administrator changed. Reload before adding a test.",
      },
      409,
    );
  const { data, error } = await supabaseAdmin.rpc(
    "admin_bug_notification_test",
    { p_admin: admin.id, p_session: admin.security_session_id },
  );
  if (error || !data)
    return reply(
      {
        error:
          "The test could not be confirmed. Check the Bug Tracker notification SQL is installed.",
      },
      503,
    );
  if (data.result === "forbidden")
    return reply(
      {
        error:
          "Bug Tracker notification tests are available to Main Admins only.",
      },
      403,
    );
  if (data.result === "rate_limited")
    return reply(
      { error: "Wait one minute before adding another Bug Tracker test." },
      429,
    );
  if (data.result !== "ok")
    return reply({ error: "The test could not be confirmed." }, 503);
  return reply({ ok: true });
}
