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
type LiveStatus = "not_started" | "live" | "paused" | "completed";
type BroadcastMode = "facebook_live" | "in_person" | "results_only";
const QUERY_TIMEOUT_MS = 15_000;
const RECENT_MFA_SECONDS = 5 * 60;
const MAX_BODY_BYTES = 8 * 1024;
const SETTINGS_COLUMNS = "status,broadcast_mode,facebook_live_url,public_message,started_at,ended_at,updated_at";
const TRANSITIONS: Record<LiveStatus, readonly LiveStatus[]> = {
  not_started: ["live", "completed"], live: ["paused", "completed"],
  paused: ["live", "completed"], completed: [],
};
function json(body: unknown, status = 200, etag?: string) {
  return NextResponse.json(body, { status, headers: {
    "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache", "Expires": "0", "X-Content-Type-Options": "nosniff",
    ...(etag ? { ETag: etag } : {}),
  }});
}
function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function isStatus(value: unknown): value is LiveStatus {
  return typeof value === "string" && Object.hasOwn(TRANSITIONS, value);
}
function isMode(value: unknown): value is BroadcastMode {
  return value === "facebook_live" || value === "in_person" || value === "results_only";
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
function facebookUrl(value: string) {
  if (!value || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port ||
        !["facebook.com", "www.facebook.com", "fb.watch", "www.fb.watch"].includes(url.hostname.toLowerCase()) ||
        url.pathname === "/") return null;
    return url.href;
  } catch { return null; }
}
function etagFor(settings: { updated_at?: unknown } | null) {
  if (!settings) return '"new"';
  if (typeof settings.updated_at !== "string" || !Number.isFinite(Date.parse(settings.updated_at))) return null;
  return `"${new Date(settings.updated_at).toISOString()}"`;
}
function validSettings(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (!isStatus(item.status) || !isMode(item.broadcast_mode)) return false;
  if (item.public_message !== null && (typeof item.public_message !== "string" || item.public_message.length > 2000)) return false;
  if (item.broadcast_mode === "facebook_live") {
    if (typeof item.facebook_live_url !== "string" || !facebookUrl(item.facebook_live_url)) return false;
  } else if (item.facebook_live_url !== null) return false;
  for (const field of ["started_at", "ended_at"]) {
    if (item[field] !== null && (typeof item[field] !== "string" || !Number.isFinite(Date.parse(item[field] as string)))) return false;
  }
  if (item.status === "not_started" && (item.started_at !== null || item.ended_at !== null)) return false;
  if ((item.status === "live" || item.status === "paused") && (item.started_at === null || item.ended_at !== null)) return false;
  if (item.status === "completed" && item.ended_at === null) return false;
  if (item.started_at && item.ended_at && Date.parse(item.ended_at as string) < Date.parse(item.started_at as string)) return false;
  return etagFor(item) !== null;
}
async function readBody(request: NextRequest) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > MAX_BODY_BYTES) { await reader.cancel(); throw new Error("Body too large"); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Object required");
  return value as Record<string, unknown>;
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


export async function GET(_request: NextRequest, context: RouteContext) {
  const requestId = `LOT-LIVE-${crypto.randomUUID()}`;
  const fail = (code: string, error: string, status: number) => json({ ok: false, code, error, request_id: requestId }, status);
  try {
    const access = await authenticate();
    if (!access) return fail("LOTTERY_AUTH_REQUIRED", "A verified administrator session is required.", 401);
    if (!hasLotteryPermission(access.admin, "lottery:draw")) return fail("LOTTERY_PERMISSION_DENIED", "You do not have permission to view live draw settings.", 403);
    const { id: rawId } = await context.params;
    const id = typeof rawId === "string" ? rawId.trim() : "";
    if (!isValidUuid(id)) return fail("LOTTERY_INVALID_ID", "Invalid lottery ID.", 400);
    const db = getAuditServiceClient();
    const parent = await db.from("lotteries").select("id").eq("id", id)
      .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS)).maybeSingle();
    if (parent.error) {
      console.error(`[${requestId}] Live draw parent lookup failed:`, parent.error);
      return fail("LOTTERY_LOOKUP_FAILED", "Unable to load the lottery.", 503);
    }
    if (!parent.data) return fail("LOTTERY_NOT_FOUND", "Lottery not found.", 404);
    const { data, error } = await db.from("lottery_live_draws").select(SETTINGS_COLUMNS).eq("lottery_id", id)
      .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS)).maybeSingle();
    if (error || (data && !validSettings(data))) {
      console.error(`[${requestId}] Invalid/unavailable live draw settings:`, error);
      return fail("LOTTERY_LIVE_SETTINGS_UNAVAILABLE", "Unable to load valid live draw settings.", 503);
    }
    return json({ ok: true, request_id: requestId, settings: data ?? {
      status: "not_started", broadcast_mode: "in_person", facebook_live_url: null,
      public_message: null, started_at: null, ended_at: null, updated_at: null,
    }}, 200, etagFor(data)!);
  } catch (error) {
    console.error(`[${requestId}] Live draw GET failed:`, error);
    return fail("LOTTERY_LIVE_SETTINGS_UNAVAILABLE", "Unable to load live draw settings.", 503);
  }
}

/** REQUIRED NEW DATABASE CONTRACT -- the supplied code does not include this RPC.
 * lottery_update_live_draw_atomic(
 *   p_lottery_id uuid, p_admin_id uuid, p_expected_updated_at timestamptz,
 *   p_status text, p_broadcast_mode text, p_facebook_live_url text,
 *   p_public_message text, p_mfa_verified_at timestamptz, p_request_id text
 * ) -> jsonb
 *
 * Implement against the real schema, with server-role-only execution. In ONE
 * transaction, recheck active actor/lottery:draw and recent MFA; lock the parent
 * lottery and its settings, including initial-row creation; verify the expected
 * version (NULL means no settings row was present). Revalidate enums, URL, message
 * and allowed transitions. Enforce canonical visibility, compliance and publication
 * timing for live/public content. Results-only display must honor completed draw,
 * consent and configured results-release timing, without publishing winners itself.
 *
 * Preserve started_at after the first transition to live, including pause/resume
 * and metadata edits. Set ended_at only on the first transition to completed.
 * Never reset a completed broadcast. For a direct not_started -> completed update,
 * require results_only plus a completed underlying draw; leave started_at NULL.
 * Do not change lottery lifecycle, ticket eligibility, snapshots or winners here.
 * Broadcast status is not proof of a secure draw or authorization to publish results.
 * Use DB time for timestamps. Enforce one settings row per lottery.
 *
 * If nothing changed, return the same row WITHOUT an audit or timestamp change.
 * Otherwise insert settings + mandatory lottery_audit_logs entry (non-null group
 * and risk), or roll back both. Return ONLY the selected settings columns.
 * Success: { ok: true, settings: {...}, changed: boolean }
 * Rejection: { ok: false, code: NOT_FOUND | CONFLICT | INVALID_STATE |
 *   PUBLICATION_BLOCKED | PERMISSION_DENIED | MFA_REQUIRED }
 * No direct upsert or best-effort audit fallback exists in this route.
 *
 * CLIENT CHANGE REQUIRED: GET the settings and send its ETag back as If-Match on
 * PUT. On 409/412 or uncertain results, GET again before deciding to retry.
 * Custom email 2FA requires the actual server-side verifier; this route uses
 * recent Supabase TOTP MFA and does not accept a client-supplied MFA flag.
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  const requestId = `LOT-LIVE-${crypto.randomUUID()}`;
  const fail = (code: string, error: string, status: number) => json({ ok: false, code, error, request_id: requestId }, status);
  try {
    const access = await authenticate();
    if (!access) return fail("LOTTERY_AUTH_REQUIRED", "A verified administrator session is required.", 401);
    if (!hasLotteryPermission(access.admin, "lottery:draw")) return fail("LOTTERY_PERMISSION_DENIED", "You do not have permission to manage live draw settings.", 403);
    if (!originAllowed(request)) return fail("LOTTERY_ORIGIN_DENIED", "The request origin is not allowed.", 403);
    const { id: rawId } = await context.params;
    const id = typeof rawId === "string" ? rawId.trim() : "";
    if (!isValidUuid(id)) return fail("LOTTERY_INVALID_ID", "Invalid lottery ID.", 400);
    if (access.mfaTimestamp === null) return fail("LOTTERY_RECENT_MFA_REQUIRED", "Verify your authenticator again before changing live draw settings.", 403);
    const expectedTag = request.headers.get("if-match");
    if (!expectedTag) return fail("LOTTERY_SETTINGS_VERSION_REQUIRED", "Reload the live draw settings before saving.", 428);
    let body: Record<string, unknown>;
    try { body = await readBody(request); } catch {
      return fail("LOTTERY_INVALID_BODY", "The request must contain a JSON object no larger than 8 KB.", 400);
    }
    if (Object.keys(body).some((key) => !["status", "broadcast_mode", "facebook_live_url", "public_message"].includes(key))) {
      return fail("LOTTERY_UNSUPPORTED_FIELDS", "The request contains unsupported settings.", 400);
    }
    if (!isStatus(body.status) || !isMode(body.broadcast_mode)) return fail("LOTTERY_INVALID_SETTINGS", "Invalid live draw status or broadcast mode.", 400);
    for (const field of ["facebook_live_url", "public_message"]) {
      if (body[field] !== undefined && body[field] !== null && typeof body[field] !== "string") {
        return fail("LOTTERY_INVALID_TEXT", `${field} must be text or null.`, 400);
      }
    }
    const message = typeof body.public_message === "string" ? body.public_message.trim() || null : null;
    if (message && message.length > 2000) return fail("LOTTERY_MESSAGE_TOO_LONG", "The public message must be 2,000 characters or fewer.", 400);
    const rawUrl = typeof body.facebook_live_url === "string" ? body.facebook_live_url.trim() : "";
    if (rawUrl.length > 2048) return fail("LOTTERY_INVALID_FACEBOOK_URL", "The Facebook URL is too long.", 400);
    const url = body.broadcast_mode === "facebook_live" ? facebookUrl(rawUrl) : null;
    if (body.broadcast_mode === "facebook_live" && !url) return fail("LOTTERY_INVALID_FACEBOOK_URL", "Enter a valid HTTPS Facebook Live or fb.watch URL.", 400);

    const db = getAuditServiceClient();
    const current = await db.from("lottery_live_draws").select(SETTINGS_COLUMNS).eq("lottery_id", id)
      .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS)).maybeSingle();
    if (current.error || (current.data && !validSettings(current.data))) {
      console.error(`[${requestId}] Current settings unavailable:`, current.error);
      return fail("LOTTERY_LIVE_SETTINGS_UNAVAILABLE", "Unable to verify current live draw settings.", 503);
    }
    const currentTag = etagFor(current.data);
    if (!currentTag || expectedTag !== currentTag) return fail("LOTTERY_SETTINGS_CONFLICT", "Settings changed. Reload them before saving.", 412);
    const oldStatus: LiveStatus = current.data?.status ?? "not_started";
    if (body.status !== oldStatus && (!TRANSITIONS[oldStatus].includes(body.status) ||
        (oldStatus === "not_started" && body.status === "completed" && body.broadcast_mode !== "results_only"))) {
      return fail("LOTTERY_INVALID_TRANSITION", "This broadcast status change is not allowed.", 409);
    }
    const { data: result, error } = await db.rpc("lottery_update_live_draw_atomic", {
      p_lottery_id: id, p_admin_id: access.admin.id,
      p_expected_updated_at: current.data?.updated_at ?? null,
      p_status: body.status, p_broadcast_mode: body.broadcast_mode,
      p_facebook_live_url: url, p_public_message: message,
      p_mfa_verified_at: new Date(access.mfaTimestamp * 1000).toISOString(), p_request_id: requestId,
    }).abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS));
    if (error) {
      console.error(`[${requestId}] Live draw transaction failed:`, error);
      if (error.code === "PGRST202" || error.code === "42883") return fail("LOTTERY_LIVE_WORKFLOW_UNAVAILABLE", "The secure live draw settings workflow is not configured. No fallback save was attempted.", 503);
      return fail("LOTTERY_LIVE_OUTCOME_UNCONFIRMED", "Reload the settings to confirm whether the change was saved.", 503);
    }
    if (!result || typeof result !== "object" || Array.isArray(result)) return fail("LOTTERY_LIVE_OUTCOME_UNCONFIRMED", "Reload the settings to confirm the result.", 503);
    if (result.ok !== true) {
      const errors: Record<string, [string, number]> = {
        NOT_FOUND: ["Lottery not found.", 404], CONFLICT: ["Settings changed. Reload before saving.", 409],
        INVALID_STATE: ["This broadcast status change is not allowed.", 409],
        PUBLICATION_BLOCKED: ["The lottery has not met the requirements for public broadcast or results display.", 409],
        PERMISSION_DENIED: ["You do not have permission to manage this live draw.", 403],
        MFA_REQUIRED: ["Verify your authenticator again before saving.", 403],
      };
      const publicError = typeof result.code === "string" && Object.hasOwn(errors, result.code) ? errors[result.code] : undefined;
      if (publicError) return fail(`LOTTERY_LIVE_${result.code}`, publicError[0], publicError[1]);
      return fail("LOTTERY_LIVE_OUTCOME_UNCONFIRMED", "Reload the settings to confirm the result.", 503);
    }
    if (!validSettings(result.settings) || typeof result.changed !== "boolean" ||
        result.settings.status !== body.status || result.settings.broadcast_mode !== body.broadcast_mode ||
        result.settings.facebook_live_url !== url || result.settings.public_message !== message ||
        (current.data?.started_at != null && result.settings.started_at !== current.data.started_at) ||
        (current.data?.ended_at != null && result.settings.ended_at !== current.data.ended_at)) {
      console.error(`[${requestId}] Invalid live draw transaction result.`);
      return fail("LOTTERY_LIVE_OUTCOME_UNCONFIRMED", "Reload the settings to confirm the result.", 503);
    }
    return json({ ok: true, settings: result.settings, changed: result.changed, request_id: requestId }, 200, etagFor(result.settings)!);
  } catch (error) {
    console.error(`[${requestId}] Live draw PUT failed:`, error);
    return fail("LOTTERY_LIVE_OUTCOME_UNCONFIRMED", "Reload the settings to confirm whether the change was saved.", 503);
  }
}
