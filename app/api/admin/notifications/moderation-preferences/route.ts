import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { priorityOptions, type ModerationPreferenceUpdate } from "@/lib/notifications/moderation-preferences";

export const dynamic = "force-dynamic";

const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const localDate = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/;
const uuid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;

function validate(value: unknown): ModerationPreferenceUpdate | null {
  if (!value || typeof value !== "object") return null;
  const { enabled, quietEnabled, quietStart, quietEnd, awayUntil, holidayStart, holidayEnd, revision, quietDays, catchUp, expectedAdminId } =
    value as Record<string, unknown>;

  if (
    typeof enabled !== "boolean" || typeof quietEnabled !== "boolean" ||
    typeof quietStart !== "string" || !time.test(quietStart) ||
    typeof quietEnd !== "string" || !time.test(quietEnd) ||
    typeof awayUntil !== "string" || (awayUntil !== "" && !localDate.test(awayUntil)) ||
    typeof holidayStart !== "string" || (holidayStart !== "" && !localDate.test(holidayStart)) ||
    typeof holidayEnd !== "string" || (holidayEnd !== "" && !localDate.test(holidayEnd)) ||
    (quietDays !== undefined && (!Array.isArray(quietDays) || quietDays.length > 7 ||
      !quietDays.every((day) => Number.isInteger(day) && day >= 1 && day <= 7))) ||
    (catchUp !== undefined && typeof catchUp !== "boolean") ||
    (expectedAdminId !== undefined && (typeof expectedAdminId !== "string" || !uuid.test(expectedAdminId))) ||
    (revision !== null && (typeof revision !== "string" || !uuid.test(revision)))
  ) return null;

  const result: ModerationPreferenceUpdate = {
    enabled, quietEnabled, quietStart, quietEnd, awayUntil, holidayStart, holidayEnd, revision, quietDays, catchUp, expectedAdminId,
  };
  for (const key of priorityOptions) {
    const option = (value as Record<string, unknown>)[key];
    if (option === undefined) continue;
    if (typeof option !== "boolean") return null;
    result[key] = option;
  }
  return result;
}

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

async function preferences(settings: ModerationPreferenceUpdate | null) {
  const admin = await getCurrentAdmin();
  if (!admin?.security_session_id) return reply({ error: "Your admin session expired. Sign in again." }, 401);

  if (settings?.expectedAdminId && settings.expectedAdminId !== admin.id) {
    return reply({ error: "The signed-in admin changed. Reload before saving." }, 409);
  }

  const { data, error } = await supabaseAdmin.rpc("admin_moderation_notification_preferences", {
    p_admin: admin.id,
    p_session: admin.security_session_id,
    p_settings: settings,
  });
  if (error || !data) return reply({ error: "Settings are temporarily unavailable. Try again." }, 503);
  if (data.result === "forbidden") return reply({ error: "Your account does not have access to moderation notification settings." }, 403);
  if (data.result === "conflict") return reply({ error: "Settings changed in another tab. Reload to see the latest settings." }, 409);
  if (data.result === "invalid") return reply({ error: data.message }, 400);
  return reply({ preferences: data.preferences, status: data.status, admin: data.admin });
}

export async function GET() {
  return preferences(null);
}

export async function PUT(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return reply({ error: "This request must come from the Admin Portal." }, 403);
  }
  const settings = validate(await request.json().catch(() => null));
  if (!settings) return reply({ error: "Check the notification settings and try again." }, 400);
  return preferences(settings);
}
