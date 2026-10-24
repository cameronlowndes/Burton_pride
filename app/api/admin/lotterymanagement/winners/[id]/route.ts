import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedAdmin, getAuditServiceClient, hasLotteryPermission } from "@/lib/lottery/audit-server";
import type { LotteryPermission } from "@/lib/lottery/audit-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: {
    "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
    "X-Content-Type-Options": "nosniff", "Vary": "Cookie, Authorization",
  } });
}
function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function boundedRead<T>(operation: PromiseLike<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error("Winner read timed out."));
    if (signal.aborted) { abort(); return; }
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(operation).then(
      value => { signal.removeEventListener("abort", abort); resolve(value); },
      error => { signal.removeEventListener("abort", abort); reject(error); },
    );
  });
}
async function authorize(permission: LotteryPermission, signal: AbortSignal) {
  const client = await createClient();
  const { data: { user }, error } = await boundedRead(client.auth.getUser(), signal);
  if (error || !user) return { ok: false as const, status: 401, error: "Unauthorized." };
  const db = getAuditServiceClient();
  const lookup = await db.from("admin_users").select("id,supabase_user_id,role,is_active,is_main_admin")
    .eq("supabase_user_id", user.id).eq("is_active", true).abortSignal(signal).maybeSingle();
  if (lookup.error) throw new Error("Administrator verification unavailable.");
  const verified = lookup.data;
  if (!verified || verified.supabase_user_id !== user.id || verified.is_active !== true ||
      (verified.role !== "main_admin" && verified.is_main_admin !== true)) {
    return { ok: false as const, status: 403, error: "An active main administrator account is required." };
  }
  const admin = await boundedRead(getAuthenticatedAdmin(), signal);
  if (!admin || admin.id !== verified.id || !hasLotteryPermission(admin, permission)) {
    return { ok: false as const, status: 403, error: "You do not have permission to perform this winner action." };
  }
  return { ok: true as const, db };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ winnerId?: string; id?: string }> },
) {
  const requestId = randomUUID();
  try {
    const signal = AbortSignal.timeout(10_000);
    const auth = await authorize("lottery:winners:manage", signal);
    if (!auth.ok) return response({ ok: false, error: auth.error, request_id: requestId }, auth.status);

    const origin = request.headers.get("origin");
    const fetchSite = request.headers.get("sec-fetch-site");
    if (!origin || origin !== request.nextUrl.origin || (fetchSite && fetchSite !== "same-origin")) {
      return response({ ok: false, error: "A same-origin request is required.", request_id: requestId }, 403);
    }

    const routeParams = await boundedRead(params, signal);
    const winnerId = routeParams.winnerId ?? routeParams.id;
    if (typeof winnerId !== "string" || !isUuid(winnerId) ||
        (routeParams.winnerId !== undefined && routeParams.id !== undefined && routeParams.winnerId !== routeParams.id)) {
      return response({ ok: false, error: "A valid, unambiguous winner UUID is required.", request_id: requestId }, 400);
    }

    return response({
      ok: false,
      code: "WINNER_WORKFLOW_TRANSACTION_UNAVAILABLE",
      error: "Winner changes and publication are unavailable until the audited, atomic winner workflow is configured. No changes were saved by this request.",
      request_id: requestId,
    }, 503);
  } catch (error) {
    console.error(`[${requestId}] Winner mutation rejected:`, error);
    return response({ ok: false, error: "Could not process the winner request. No changes were saved by this request.", request_id: requestId }, 503);
  }
}
