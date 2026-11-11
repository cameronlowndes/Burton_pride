import { isPortalOrigin } from "@/lib/notifications/request-origin";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { dashboardCategories } from "@/lib/notifications/dashboard";
export const dynamic = "force-dynamic";
const localDate = z
  .string()
  .regex(/^(?:\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d)?$/);
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const categorySchema = z
  .object(
    Object.fromEntries(
      Object.keys(dashboardCategories).map((key) => [key, z.boolean()]),
    ),
  )
  .strict();
const update = z
  .object({
    expectedAdminId: z.string().uuid(),
    revision: z.string().uuid(),
    enabled: z.boolean(),
    categories: categorySchema,
    quietEnabled: z.boolean(),
    quietStart: time,
    quietEnd: time,
    awayUntil: localDate,
    holidayStart: localDate,
    holidayEnd: localDate,
    urgentBypass: z.boolean(),
  })
  .strict();
function reply(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
async function run(settings: z.infer<typeof update> | null) {
  const admin = await getCurrentAdmin();
  if (!admin?.security_session_id)
    return reply({ error: "Your session expired. Sign in again." }, 401);
  if (settings && settings.expectedAdminId !== admin.id)
    return reply(
      { error: "The signed-in administrator changed. Reload before saving." },
      409,
    );
  const { data, error } = await supabaseAdmin.rpc(
    "admin_dashboard_notification_preferences",
    {
      p_admin: admin.id,
      p_session: admin.security_session_id,
      p_settings: settings,
    },
  );
  if (error || !data)
    return reply(
      {
        error:
          "Dashboard settings are unavailable. Check the database update has been installed.",
      },
      503,
    );
  if (data.result === "forbidden")
    return reply(
      { error: "Your account needs dashboard notification access." },
      403,
    );
  if (data.result === "conflict")
    return reply(
      {
        error:
          "Settings changed in another tab. Discard changes and reload before saving.",
      },
      409,
    );
  if (data.result !== "ok")
    return reply(
      { error: data.message || "Check the settings and try again." },
      400,
    );
  return reply(data);
}
export async function GET() {
  return run(null);
}
export async function PUT(request: NextRequest) {
  if (
    !isPortalOrigin(request) ||
    !request.headers.get("content-type")?.startsWith("application/json")
  )
    return reply({ error: "Use the Admin Portal to change settings." }, 403);
  const body = await request.text();
  if (body.length > 8000) return reply({ error: "Request is too large." }, 413);
  let input: unknown;
  try {
    input = JSON.parse(body);
  } catch {
    return reply({ error: "Invalid settings." }, 400);
  }
  const parsed = update.safeParse(input);
  if (!parsed.success)
    return reply(
      { error: "Check the category switches and dates and times." },
      400,
    );
  return run(parsed.data);
}
