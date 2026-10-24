import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { lotteryAdminDb } from "@/lib/lottery/adminAuth";
import { getAuthenticatedAdmin, hasLotteryPermission } from "@/lib/lottery/audit-server";
import { loadDrawReadiness } from "@/lib/lottery/drawReadiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
type RouteContext = { params: Promise<{ id: string }> };
function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "X-Content-Type-Options": "nosniff",
  } });
}

// Read-only: does not change statuses, freeze entries, or select winners.
export async function GET(_request: NextRequest, context: RouteContext) {
  const requestId = `DRAW-READY-${randomUUID()}`;
  try {
    const admin = await getAuthenticatedAdmin();
    if (!admin) return json({ ok: false, error: "Sign in to view draw readiness.", request_id: requestId }, 401);
    if (!hasLotteryPermission(admin, "lottery:view")) {
      return json({ ok: false, error: "You do not have permission to view draw readiness.", request_id: requestId }, 403);
    }
    const { id } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return json({ ok: false, error: "The lottery ID is invalid.", request_id: requestId }, 400);
    }
    const state = await loadDrawReadiness(lotteryAdminDb(), id);
    if (!state) return json({ ok: false, error: "Lottery not found.", request_id: requestId }, 404);
    return json({ ok: true, request_id: requestId, ...state });
  } catch (error) {
    console.error(`[${requestId}] Draw readiness failed`, error);
    return json({ ok: false, code: "DRAW_CHECK_UNAVAILABLE",
      error: "Unable to complete the draw readiness checks. Refresh and quote the request reference if this continues.", request_id: requestId }, 503);
  }
}
