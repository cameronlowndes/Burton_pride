import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { isPortalOrigin } from "@/lib/notifications/request-origin";

export const dynamic = "force-dynamic";
const command = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("preview-delete"),
      expectedAdminId: z.string().uuid(),
      scope: z.enum(["one", "read", "all"]),
      id: z.string().uuid().optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("delete"),
      expectedAdminId: z.string().uuid(),
      token: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      action: z.literal("refresh"),
      expectedAdminId: z.string().uuid(),
      enabled: z.boolean(),
    })
    .strict(),
]);
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
    return reply(
      { error: "Use the Admin Portal to change notifications." },
      403,
    );
  const admin = await getCurrentAdmin();
  if (!admin?.security_session_id)
    return reply({ error: "Your session expired. Sign in again." }, 401);
  const text = await request.text();
  if (text.length > 2000) return reply({ error: "Request is too large." }, 413);
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    return reply({ error: "Invalid request." }, 400);
  }
  const parsed = command.safeParse(input);
  if (!parsed.success)
    return reply(
      { error: "Check the notification action and try again." },
      400,
    );
  const data = parsed.data;
  if (data.expectedAdminId !== admin.id)
    return reply(
      {
        error: "The signed-in administrator changed. Reload before continuing.",
      },
      409,
    );
  const identity = { p_admin: admin.id, p_session: admin.security_session_id };
  const result =
    data.action === "preview-delete"
      ? await supabaseAdmin.rpc("admin_notifications_delete_preview", {
          ...identity,
          p_scope: data.scope,
          p_alert: data.id ?? null,
        })
      : data.action === "delete"
        ? await supabaseAdmin.rpc("admin_notifications_delete_commit", {
            ...identity,
            p_token: data.token,
          })
        : await supabaseAdmin.rpc("admin_notifications_refresh_preference", {
            ...identity,
            p_enabled: data.enabled,
          });
  if (result.error || !result.data)
    return reply(
      {
        error:
          data.action === "delete"
            ? "Deletion could not be confirmed. Refresh the inbox before trying again."
            : "The notification action is unavailable. Check the notification controls SQL has been installed.",
      },
      503,
    );
  if (result.data.result === "forbidden")
    return reply(
      { error: "Your account cannot change these notifications." },
      403,
    );
  if (result.data.result === "expired")
    return reply(
      {
        error:
          "This confirmation expired or was replaced. Refresh the inbox and confirm again.",
      },
      409,
    );
  if (result.data.result !== "ok")
    return reply({ error: "The notification action was not accepted." }, 400);
  return reply(result.data);
}
