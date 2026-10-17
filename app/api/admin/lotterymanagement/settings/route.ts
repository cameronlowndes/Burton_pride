import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedAdmin, getAuditServiceClient, hasLotteryPermission } from "@/lib/lottery/audit-server";
import { loadLotterySettings, saveLotterySettingsGroup } from "@/lib/lottery/settings-server";
import type { UpdateLotterySettingsRequest } from "@/lib/lottery/settings-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const MAX_BYTES = 32 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: {
    "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
    "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow, noarchive",
    Vary: "Cookie, Authorization",
  } });
}
function fail(message: string, status: number, code: string): never {
  throw Object.assign(new Error(message), { status, code });
}
async function authorize() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) fail("Sign in again to access Lottery Settings.", 401, "AUTHENTICATION_REQUIRED");
  const { data: verified, error: readError } = await getAuditServiceClient().from("admin_users")
    .select("id,supabase_user_id,role,is_active,is_main_admin")
    .eq("supabase_user_id", user.id).eq("is_active", true)
    .abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
  if (readError) fail("Administrator verification is unavailable.", 503, "AUTH_SERVICE_UNAVAILABLE");
  if (!verified || (verified.role !== "main_admin" && verified.is_main_admin !== true))
    fail("An active Main Admin account is required.", 403, "MAIN_ADMIN_REQUIRED");
  const admin = await getAuthenticatedAdmin();
  if (!admin || admin.id !== verified.id || !hasLotteryPermission(admin, "lottery:settings:manage"))
    fail("Main Admin settings permission is required.", 403, "MAIN_ADMIN_REQUIRED");
  return { admin, userId: user.id };
}
async function payload(mutationsAvailable: boolean) {
  const loaded = await loadLotterySettings();
  return {
    success: true, settings: loaded.settings, versions: loaded.versions,
    persisted_groups: loaded.persistedGroups, defaults_used: loaded.defaultsUsed,
    status: {
      paymentProvider: "not_verified", compliance: "not_verified", notifications: "not_verified",
      security: "not_verified", lastUpdatedAt: loaded.lastUpdatedAt, lastUpdatedBy: loaded.lastUpdatedBy,
    },
    permissions: {
      canView: true, canManageSettings: mutationsAvailable, canManagePayments: mutationsAvailable,
      canEditSettings: mutationsAvailable, canEditGeneral: mutationsAvailable,
      canEditFinance: mutationsAvailable, canEditCompliance: mutationsAvailable,
      canEditSecurity: mutationsAvailable, canEditTickets: mutationsAvailable,
      canEditDraws: mutationsAvailable, canEditWinners: mutationsAvailable,
      canEditNotifications: mutationsAvailable,
    },
    mutations_available: mutationsAvailable,
    verification: {
      persisted_settings_verified: !loaded.defaultsUsed,
      payment_provider_verified: false, compliance_approval_verified: false,
      notification_delivery_verified: false, security_enforcement_verified: false,
    },
    message: mutationsAvailable
      ? "Main Admins can save settings. Sensitive changes require two-step verification within 15 minutes. Saving configuration does not verify payment processing or approve a lottery."
      : "Settings saving is not configured. Install the audited settings database service before editing.",
  };
}
function errorResponse(error: unknown, requestId: string) {
  const known = error instanceof Error && "status" in error;
  const status = known ? Number(error.status) : 503;
  const code = known && "code" in error ? String(error.code) : "SETTINGS_SERVICE_UNAVAILABLE";
  // Never log the request body, session cookie or database error details.
  console.error("Lottery settings request failed", { requestId, code });
  return json({ success: false, code, error: known ? error.message : "The settings request could not be confirmed. Reload before trying again.", request_id: requestId }, status);
}
export async function GET() {
  const requestId = randomUUID();
  try {
    await authorize();
    const { data, error } = await getAuditServiceClient().rpc("lottery_settings_service_status")
      .abortSignal(AbortSignal.timeout(5_000));
    return json(await payload(!error && data === 1));
  } catch (error) { return errorResponse(error, requestId); }
}
async function readBody(request: NextRequest): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
    fail("Send settings as JSON.", 415, "INVALID_CONTENT_TYPE");
  const reader = request.body?.getReader();
  if (!reader) fail("Settings are required.", 400, "INVALID_SETTINGS");
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) { await reader.cancel(); fail("Settings request is too large.", 413, "REQUEST_TOO_LARGE"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let body: unknown;
  try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { fail("Settings must contain valid JSON.", 400, "INVALID_SETTINGS"); }
  if (!body || typeof body !== "object" || Array.isArray(body)) fail("Invalid settings request.", 422, "INVALID_SETTINGS");
  return body as Record<string, unknown>;
}
export async function PATCH(request: NextRequest) {
  const requestId = randomUUID();
  try {
    const origin = request.headers.get("origin");
    const site = request.headers.get("sec-fetch-site");
    if (!origin || origin !== request.nextUrl.origin || (site && site !== "same-origin"))
      fail("A same-origin request is required.", 403, "SAME_ORIGIN_REQUIRED");
    const { admin, userId } = await authorize();
    const body = await readBody(request);
    if (Object.keys(body).some(key => !["group", "value", "reason", "expectedUpdatedAt"].includes(key)))
      fail("Unsupported settings fields.", 422, "INVALID_SETTINGS");
    const idempotencyKey = request.headers.get("idempotency-key");
    if (!idempotencyKey || !UUID.test(idempotencyKey)) fail("A save request ID is required. Reload settings.", 400, "REQUEST_ID_REQUIRED");
    if (!(body.expectedUpdatedAt === null || (typeof body.expectedUpdatedAt === "string" && Number.isFinite(Date.parse(body.expectedUpdatedAt)))))
      fail("Reload settings before saving.", 409, "VERSION_REQUIRED");
    const rawSession = request.cookies.get("burton_admin_security_session")?.value;
    if (!rawSession || rawSession.length > 4096) fail("Sign in again and complete two-step verification.", 403, "SECURITY_SESSION_REQUIRED");
    const pepper = process.env.ADMIN_2FA_PEPPER;
    if (!pepper || pepper.length < 32) fail("Admin security configuration is unavailable.", 503, "SECURITY_SERVICE_UNAVAILABLE");
    const securitySessionHash = createHash("sha256").update(`${pepper}:${rawSession}`).digest("hex");
    await saveLotterySettingsGroup(admin, {
      group: body.group, value: body.value, reason: body.reason,
    } as UpdateLotterySettingsRequest, {
      userId, securitySessionHash, requestId: idempotencyKey,
      expectedUpdatedAt: body.expectedUpdatedAt as string | null,
    });
    return json(await payload(true));
  } catch (error) { return errorResponse(error, requestId); }
}
