import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  getAuthenticatedAdmin,
  getAuditServiceClient,
  hasLotteryPermission,
} from "@/lib/lottery/audit-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };
const QUERY_TIMEOUT_MS = 15_000;
const RECENT_MFA_SECONDS = 5 * 60;

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function originAllowed(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  const origin = request.headers.get("origin");
  if (!configured || !origin || request.headers.get("sec-fetch-site") === "cross-site") return false;
  try {
    const trusted = new URL(configured);
    return ["https:", "http:"].includes(trusted.protocol) && new URL(origin).origin === trusted.origin;
  } catch { return false; }
}

async function authenticate() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase authentication configuration is missing.");
  const store = await cookies();
  const auth = createServerClient(url, key, {
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(QUERY_TIMEOUT_MS) }),
    },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => {
        for (const { name, value, options } of values) store.set(name, value, options);
      },
    },
  });
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user?.email || !user.email_confirmed_at || user.is_anonymous) return null;

  // The legacy helper must still enforce active-account and custom-session
  // revocation checks. Bind its selected admin to a server-verified identity;
  // a separate admin ID/email/session-marker cookie cannot establish identity.
  const admin = await getAuthenticatedAdmin();
  if (!admin || typeof admin.email !== "string" ||
      admin.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) return null;
  if (!isValidUuid(admin.id)) return null;

  // Use verified claims, never a body field, user_metadata, cookie MFA flag,
  // token issue time, or a remembered-device marker as proof of recent MFA.
  const verified = await auth.auth.getClaims();
  if (verified.error || !verified.data || verified.data.claims.sub !== user.id) return null;
  const claims = verified.data.claims;
  const now = Math.floor(Date.now() / 1000);
  let mfaTimestamp: number | null = null;
  if (claims.aal === "aal2" && Array.isArray(claims.amr)) {
    for (const entry of claims.amr as unknown[]) {
      if (!entry || typeof entry !== "object") continue;
      const item = entry as { method?: unknown; timestamp?: unknown };
      // Supabase TOTP MFA is supported here. Custom email 2FA requires its
      // own server-side verifier; primary email OTP is not a second factor.
      if (item.method === "totp" && typeof item.timestamp === "number" &&
          Number.isSafeInteger(item.timestamp) && item.timestamp <= now &&
          now - item.timestamp <= RECENT_MFA_SECONDS) {
        mfaTimestamp = Math.max(mfaTimestamp ?? 0, item.timestamp);
      }
    }
  }
  return { admin, mfaTimestamp };
}
export async function POST(request: NextRequest, context: RouteContext) {
  const requestId = `LOT-CLOSE-${crypto.randomUUID()}`;
  const fail = (code: string, error: string, status: number) =>
    response({ ok: false, code, error, request_id: requestId }, status);
  try {
    const access = await authenticate();
    if (!access) return fail("LOTTERY_AUTH_REQUIRED", "A verified administrator session is required.", 401);
    if (!hasLotteryPermission(access.admin, "lottery:close-sales")) {
      return fail("LOTTERY_PERMISSION_DENIED", "You do not have permission to close lottery sales.", 403);
    }
    if (!originAllowed(request)) return fail("LOTTERY_ORIGIN_DENIED", "The request origin is not allowed.", 403);
    const { id: rawId } = await context.params;
    const id = typeof rawId === "string" ? rawId.trim() : "";
    if (!isValidUuid(id)) return fail("LOTTERY_INVALID_ID", "The lottery ID is invalid.", 400);
    if (access.mfaTimestamp === null) {
      return fail("LOTTERY_RECENT_MFA_REQUIRED", "Verify your authenticator again before closing sales.", 403);
    }

    const db = getAuditServiceClient();
    const { data: existing, error: lookupError } = await db.from("lotteries")
      .select("*").eq("id", id)
      .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS)).maybeSingle();
    if (lookupError) {
      console.error(`[${requestId}] Close sales lookup failed:`, lookupError);
      return fail("LOTTERY_LOOKUP_FAILED", "Unable to load the lottery.", 503);
    }
    if (!existing) return fail("LOTTERY_NOT_FOUND", "Lottery not found.", 404);
    if (existing.status === "sales_closed" || existing.status === "draw_ready") {
      return response({ ok: true, message: "Lottery sales are already closed.",
        item: existing, request_id: requestId });
    }
    if (existing.status !== "live" && existing.status !== "paused") {
      return fail("LOTTERY_INVALID_STATE", "Sales can only be closed for a live or paused lottery.", 409);
    }
    if (typeof existing.updated_at !== "string" || !Number.isFinite(Date.parse(existing.updated_at))) {
      return fail("LOTTERY_VERSION_UNAVAILABLE", "The lottery version could not be verified. No changes were made.", 409);
    }
    const open = typeof existing.sales_open_at === "string" ? Date.parse(existing.sales_open_at) : NaN;
    const close = existing.sales_close_at == null ? null :
      (typeof existing.sales_close_at === "string" ? Date.parse(existing.sales_close_at) : NaN);
    if (!Number.isFinite(open) || open > Date.now() ||
        (close !== null && (!Number.isFinite(close) || close <= open))) {
      return fail("LOTTERY_INVALID_DATES", "The lottery sales dates must be corrected through the controlled workflow.", 409);
    }

    const { data: result, error: transactionError } = await db.rpc("lottery_close_sales_atomic", {
      p_lottery_id: id,
      p_admin_id: access.admin.id,
      p_expected_updated_at: existing.updated_at,
      p_request_id: requestId,
      p_mfa_verified_at: new Date(access.mfaTimestamp * 1000).toISOString(),
    }).abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS));
    if (transactionError) {
      console.error(`[${requestId}] Atomic close sales failed:`, transactionError);
      if (transactionError.code === "PGRST202" || transactionError.code === "42883") {
        return fail("LOTTERY_CLOSE_WORKFLOW_UNAVAILABLE",
          "The secure close-sales workflow is not configured. No fallback change was attempted.", 503);
      }
      // A timeout can happen after commit: never claim that no change was made.
      return fail("LOTTERY_CLOSE_OUTCOME_UNCONFIRMED",
        "The result could not be confirmed. Reload the lottery before trying again.", 503);
    }
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      return fail("LOTTERY_CLOSE_OUTCOME_UNCONFIRMED", "Reload the lottery to confirm whether sales closed.", 503);
    }
    if (result.ok !== true) {
      const errors: Record<string, [string, number]> = {
        NOT_FOUND: ["Lottery not found.", 404],
        CONFLICT: ["The lottery changed during this request. Reload before trying again.", 409],
        INVALID_STATE: ["The lottery cannot close sales in its current state.", 409],
        INVALID_DATES: ["The lottery sales dates need correction.", 409],
        PERMISSION_DENIED: ["You do not have permission to close lottery sales.", 403],
        MFA_REQUIRED: ["Verify your authenticator again before closing sales.", 403],
      };
      const publicError = typeof result.code === "string" && Object.hasOwn(errors, result.code) ? errors[result.code] : undefined;
      if (publicError) return fail(`LOTTERY_CLOSE_${result.code}`, publicError[0], publicError[1]);
      return fail("LOTTERY_CLOSE_OUTCOME_UNCONFIRMED", "Reload the lottery to confirm whether sales closed.", 503);
    }
    if (!result.item || result.item.id !== id ||
        !["sales_closed", "draw_ready"].includes(result.item.status) ||
        typeof result.already_closed !== "boolean") {
      console.error(`[${requestId}] Close sales returned an invalid response.`);
      return fail("LOTTERY_CLOSE_OUTCOME_UNCONFIRMED", "Reload the lottery to confirm whether sales closed.", 503);
    }
    return response({ ok: true,
      message: result.already_closed ? "Lottery sales are already closed." : "Lottery sales closed successfully.",
      item: result.item, request_id: requestId });
  } catch (error) {
    console.error(`[${requestId}] Close sales API error:`, error);
    return fail("LOTTERY_CLOSE_OUTCOME_UNCONFIRMED",
      "Unable to confirm the result. Reload the lottery before trying again.", 503);
  }
}
