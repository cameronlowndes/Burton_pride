import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedAdmin, getAuditServiceClient, hasLotteryPermission } from "@/lib/lottery/audit-server";
import { loadLotterySettings } from "@/lib/lottery/settings-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: {
    "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "Vary": "Cookie, Authorization",
  } });
}
function boundedRead<T>(operation: PromiseLike<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error("Settings read timed out."));
    if (signal.aborted) { abort(); return; }
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(operation).then(
      value => { signal.removeEventListener("abort", abort); resolve(value); },
      error => { signal.removeEventListener("abort", abort); reject(error); },
    );
  });
}

async function authorize(permission: string, signal: AbortSignal) {
  const client = await createClient();
  const { data: { user }, error } = await boundedRead(client.auth.getUser(), signal);
  if (error || !user) return { ok: false as const, status: 401, error: "You must be signed in to access Lottery Settings." };
  const db = getAuditServiceClient();
  const result = await db.from("admin_users")
    .select("id,supabase_user_id,role,is_active,is_main_admin")
    .eq("supabase_user_id", user.id).eq("is_active", true).abortSignal(signal).maybeSingle();
  if (result.error) throw new Error("Administrator verification unavailable.");
  const verified = result.data;
  if (!verified || verified.supabase_user_id !== user.id || verified.is_active !== true ||
      (verified.role !== "main_admin" && verified.is_main_admin !== true)) {
    return { ok: false as const, status: 403, error: "An active main administrator account is required." };
  }
  const admin = await boundedRead(getAuthenticatedAdmin(), signal);
  if (!admin || admin.id !== verified.id || !hasLotteryPermission(admin, permission as Parameters<typeof hasLotteryPermission>[1])) {
    return { ok: false as const, status: 403, error: "You do not have permission to perform this settings action." };
  }
  return { ok: true as const };
}

const GROUPS = ["payments", "notifications", "compliance"] as const;

function validateSettingsResponse(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Settings are unavailable.");
  const settings = value as Record<string, unknown>;
  for (const group of GROUPS) {
    if (!settings[group] || typeof settings[group] !== "object" || Array.isArray(settings[group])) {
      throw new Error("Settings group is incomplete.");
    }
  }
  // Reject an unexpected secret-bearing response instead of returning partially
  // redacted settings that a client might accidentally save back as defaults.
  const inspect = (node: unknown, depth: number): void => {
    if (depth > 10) throw new Error("Settings nesting exceeds the response limit.");
    if (node === null || typeof node === "boolean" || typeof node === "string") return;
    if (typeof node === "number") {
      if (!Number.isFinite(node)) throw new Error("Invalid numeric settings.");
      return;
    }
    if (!node || typeof node !== "object") throw new Error("Invalid settings response.");
    if (Array.isArray(node)) { for (const item of node) inspect(item, depth + 1); return; }
    for (const [key, child] of Object.entries(node)) {
      if (/password|secret|token|api[_-]?key|private[_-]?key|credential|authorization|cookie/i.test(key) &&
          child !== null && typeof child !== "boolean" && typeof child !== "number") {
        throw new Error("Settings response unexpectedly contains a sensitive field.");
      }
      inspect(child, depth + 1);
    }
  };
  inspect(settings, 0);
  if (Buffer.byteLength(JSON.stringify(settings), "utf8") > 128 * 1024) throw new Error("Settings response exceeds its size limit.");
}

export async function GET() {
  const requestId = randomUUID();
  try {
    const signal = AbortSignal.timeout(15_000);
    const auth = await authorize("lottery:view", signal);
    if (!auth.ok) return json({ success: false, error: auth.error, request_id: requestId }, auth.status);
    const loaded = await boundedRead(loadLotterySettings(), signal);
    validateSettingsResponse(loaded.settings);
    // Defaults returned by the helper do not prove that persisted rows exist.
    const candidate = loaded.lastUpdatedAt;
    const lastUpdatedAt = typeof candidate === "string" && Number.isFinite(Date.parse(candidate)) ? candidate : null;
    return json({
      success: true,
      settings: loaded.settings,
      status: {
        paymentProvider: "not_verified", compliance: "not_verified",
        notifications: "not_verified", security: "not_verified",
        lastUpdatedAt, lastUpdatedBy: null,
      },
      permissions: {
        canView: true, canEditSettings: false, canEditGeneral: false,
        canEditFinance: false, canEditCompliance: false, canEditSecurity: false,
        canEditTickets: false, canEditDraws: false, canEditWinners: false,
        canEditNotifications: false,
      },
      mutations_available: false,
      verification: {
        persisted_settings_verified: false,
        payment_provider_verified: false,
        compliance_approval_verified: false,
        notification_delivery_verified: false,
        security_enforcement_verified: false,
      },
      message: "Settings are read-only until the audited settings transaction service is configured. Configuration flags do not establish operational readiness.",
    });
  } catch (error) {
    console.error(`[${requestId}] Lottery settings read failed:`, error);
    return json({ success: false, error: "Unable to load complete Lottery Settings. Refresh and try again.", request_id: requestId }, 503);
  }
}

export async function PATCH(request: NextRequest) {
  const requestId = randomUUID();
  try {
    // No finance-view/compliance role can substitute for this write permission.
    const auth = await authorize("lottery:settings:manage", AbortSignal.timeout(10_000));
    if (!auth.ok) return json({ success: false, error: auth.error, request_id: requestId }, auth.status);
    const origin = request.headers.get("origin");
    const fetchSite = request.headers.get("sec-fetch-site");
    if (!origin || origin !== request.nextUrl.origin || (fetchSite && fetchSite !== "same-origin")) {
      return json({ success: false, error: "A same-origin request is required.", request_id: requestId }, 403);
    }
    // Do not parse/save settings or mutate audit history while the transactional
    // write service is absent. No request-body values appear in errors or logs.
    return json({
      success: false, code: "SETTINGS_TRANSACTION_SERVICE_UNAVAILABLE",
      error: "Saving Lottery Settings is unavailable until the audited database transaction service is configured.",
      request_id: requestId,
    }, 503);
  } catch (error) {
    console.error(`[${requestId}] Lottery settings action rejected:`, error);
    return json({ success: false, error: "The settings action is unavailable.", request_id: requestId }, 503);
  }
}
