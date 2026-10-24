import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedAdmin, getAuditServiceClient, hasLotteryPermission } from "@/lib/lottery/audit-server";
import type { LotteryPermission } from "@/lib/lottery/audit-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


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
    const abort = () => reject(new Error("Ticket read timed out."));
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
    return { ok: false as const, status: 403, error: "You do not have permission to perform this ticket action." };
  }
  return { ok: true as const, db };
}

class RequestError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

async function readRequest(request: NextRequest, signal: AbortSignal) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") throw new RequestError("An application/json request is required.", 415);
  if (!request.body) throw new RequestError("A JSON request body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await boundedRead(reader.read(), signal);
      if (done) break;
      size += value.byteLength;
      if (size > 8 * 1024) {
        void reader.cancel().catch(() => undefined);
        throw new RequestError("The request body exceeds the size limit.", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let parsed: unknown;
  try { parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new RequestError("The request body is not valid JSON."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new RequestError("A JSON object is required.");
  const body = parsed as Record<string, unknown>;
  if (Object.keys(body).some(key => key !== "orderId" && key !== "reason")) throw new RequestError("The request contains unsupported fields.");
  if (typeof body.orderId !== "string" || !isUuid(body.orderId.trim())) throw new RequestError("A valid UUID orderId is required.");
  if ("reason" in body && (typeof body.reason !== "string" || body.reason.trim().length < 5 || body.reason.length > 1000)) {
    throw new RequestError("If provided, the reason must contain 5 to 1000 characters.");
  }

}

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  try {
    const signal = AbortSignal.timeout(10_000);
    const auth = await authorize("lottery:tickets:manage" as LotteryPermission, signal);
    if (!auth.ok) return response({ ok: false, error: auth.error, request_id: requestId }, auth.status);
    const origin = request.headers.get("origin"), fetchSite = request.headers.get("sec-fetch-site");
    if (!origin || origin !== request.nextUrl.origin || (fetchSite && fetchSite !== "same-origin")) {
      return response({ ok: false, error: "A same-origin request is required.", request_id: requestId }, 403);
    }
    await readRequest(request, signal);
    return response({
      ok: false, code: "TICKET_ISSUANCE_TRANSACTION_UNAVAILABLE",
      error: "Random-ticket issuance is unavailable until the audited, atomic paid-order issuance service is configured. No tickets were issued by this request.",
      request_id: requestId,
    }, 503);
  } catch (error) {
    if (error instanceof RequestError) {
      return response({ ok: false, error: error.message, request_id: requestId }, error.status);
    }
    console.error(`[${requestId}] Random ticket issuance rejected:`, error);
    return response({ ok: false, error: "Could not process the ticket issuance request. No tickets were issued by this request.", request_id: requestId }, 503);
  }
}
