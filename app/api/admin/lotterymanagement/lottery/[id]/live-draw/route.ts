import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedAdmin,
  getAuditServiceClient,
  hasLotteryPermission,
  writeLotteryAuditSafe,
} from "@/lib/lottery/audit-server";

export const dynamic = "force-dynamic";

const STATUSES = new Set(["not_started", "live", "paused", "completed"]);
const BROADCAST_MODES = new Set(["facebook_live", "in_person", "results_only"]);

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function authorisedAdmin() {
  const admin = await getAuthenticatedAdmin();
  if (!admin) return { admin: null, error: json({ ok: false, error: "Unauthorised." }, 401) };
  if (!hasLotteryPermission(admin, "lottery:draw")) {
    return { admin: null, error: json({ ok: false, error: "You do not have permission to manage a live draw." }, 403) };
  }
  return { admin, error: null };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorisedAdmin();
  if (auth.error) return auth.error;
  const { id } = await context.params;
  if (!isUuid(id)) return json({ ok: false, error: "Invalid lottery ID." }, 400);

  const db = getAuditServiceClient();
  const { data, error } = await db
    .from("lottery_live_draws")
    .select("status,broadcast_mode,facebook_live_url,public_message,started_at,ended_at")
    .eq("lottery_id", id)
    .maybeSingle();

  if (error) return json({ ok: false, error: "Unable to load live draw settings." }, 500);
  return json({ ok: true, settings: data ?? { status: "not_started", broadcast_mode: "in_person", facebook_live_url: null, public_message: null } });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorisedAdmin();
  if (auth.error || !auth.admin) return auth.error!;
  const { id } = await context.params;
  if (!isUuid(id)) return json({ ok: false, error: "Invalid lottery ID." }, 400);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json({ ok: false, error: "Invalid request body." }, 400);

  const status = String(body.status || "");
  const broadcastMode = String(body.broadcast_mode || "");
  const facebookLiveUrl = typeof body.facebook_live_url === "string" ? body.facebook_live_url.trim() || null : null;
  const publicMessage = typeof body.public_message === "string" ? body.public_message.trim() || null : null;

  if (!STATUSES.has(status) || !BROADCAST_MODES.has(broadcastMode)) {
    return json({ ok: false, error: "Invalid live draw status or broadcast mode." }, 400);
  }
  if (broadcastMode === "facebook_live" && !/^https:\/\/(www\.)?(facebook\.com|fb\.watch)\//i.test(facebookLiveUrl || "")) {
    return json({ ok: false, error: "A public Facebook Live URL is required for Facebook Live mode." }, 400);
  }

  const db = getAuditServiceClient();
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("lottery_live_draws")
    .upsert({
      lottery_id: id,
      status,
      broadcast_mode: broadcastMode,
      facebook_live_url: broadcastMode === "facebook_live" ? facebookLiveUrl : null,
      public_message: publicMessage,
      started_at: status === "live" ? now : null,
      ended_at: status === "completed" ? now : null,
      updated_at: now,
    }, { onConflict: "lottery_id" })
    .select("status,broadcast_mode,facebook_live_url,public_message,started_at,ended_at")
    .single();

  if (error) return json({ ok: false, error: "Unable to save live draw settings." }, 500);

  await writeLotteryAuditSafe({
    admin: auth.admin,
    actionCode: "draw.live_page.updated",
    actionLabel: "Live draw page updated",
    actionGroup: "draw",
    riskLevel: status === "live" ? "high" : "medium",
    entityType: "lottery",
    entityId: id,
    reason: `Live draw set to ${status} using ${broadcastMode}.`,
  });

  return json({ ok: true, settings: data });
}
