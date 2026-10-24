import { normaliseLotteryPermissions } from "./permissions";
import "server-only";

import { headers } from "next/headers";
import { isIP } from "node:net";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
// Local structural types keep this server helper independent of audit-types.
// Shared display types belong in audit-types.ts and must not import this module.
type LotteryAuditRiskLevel = "low" | "medium" | "high" | "critical";
type LotteryAuditDeviceContext = {
  userAgent: string | null;
  platform: string | null;
  deviceType: "mobile" | "desktop" | null;
};
// Action groups are checked for non-empty bounded text before insertion.
// The database must enforce its canonical group constraint.
type LotteryAuditActionGroup = string;

export type LotteryPermission =
  | "lottery:view"
  | "lottery:create"
  | "lottery:edit"
  | "lottery:publish"
  | "lottery:entries:view"
  | "lottery:finance:view"
  | "lottery:refund"
  | "lottery:draw"
  | "lottery:draw_override"
  | "lottery:winners:manage"
  | "lottery:export"
  | "lottery:compliance"
  | "lottery:audit:view"
  | "lottery:audit:export"
  | "lottery:orders:view"
  | "lottery:orders:manage"
  | "lottery:close-sales"
  | "lottery:prizes:manage"
  | "lottery:tickets:manage"
  | "lottery:tickets:issue_random"
  | "lottery:settings:manage";

export interface AuthenticatedLotteryAdmin {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null;
  permissions: string[];
}

interface WriteLotteryAuditOptions {
  admin?: AuthenticatedLotteryAdmin | null;

  lotteryId?: string | null;
  lotteryTitle?: string | null;

  entityType?: string | null;
  entityId?: string | null;

  actionCode: string;
  actionLabel: string;
  actionGroup: LotteryAuditActionGroup;

  riskLevel?: LotteryAuditRiskLevel;

  reason?: string | null;

  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;

  metadata?: Record<string, unknown> | null;

  ipAddress?: string | null;
  deviceContext?: LotteryAuditDeviceContext | null;
}

function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url) {
    throw new Error(
      "Lottery service is unavailable.",
    );
  }

  return url;
}

function getSupabaseServiceKey(): string {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY;

  if (!key) {
    throw new Error(
      "Lottery service is unavailable.",
    );
  }

  return key;
}

// Privileged database factory; callers still need their own authorization guard.
export function getAuditServiceClient() {
  try {
  return createClient(
    getSupabaseUrl(),
    getSupabaseServiceKey(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );
  } catch {
    throw Object.assign(new Error("Lottery service is unavailable."), { status: 503 });
  }
}

// No identity or permission authority comes from custom cookies/user metadata.
const AUTH_TIMEOUT_MS = 10_000;

function boundedRead<T>(operation: PromiseLike<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error("Administrator verification is unavailable."));
    if (signal.aborted) { abort(); return; }
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(operation).then(
      value => { signal.removeEventListener("abort", abort); resolve(value); },
      () => { signal.removeEventListener("abort", abort); reject(new Error("Administrator verification is unavailable.")); },
    );
  });
}

export async function getAuthenticatedAdmin(): Promise<AuthenticatedLotteryAdmin | null> {
  try {
    const signal = AbortSignal.timeout(AUTH_TIMEOUT_MS);
    const client = await boundedRead(createSessionClient(), signal);
    const { data: userData, error: authError } = await boundedRead(client.auth.getUser(), signal);
    if (authError || !userData?.user?.id) return null;
    const userId = userData.user.id;
    const { data, error } = await boundedRead(
      getAuditServiceClient()
        .from("admin_users")
        .select("id,supabase_user_id,email,name,role,permissions,is_active,is_main_admin")
        .eq("supabase_user_id", userId)
        .eq("is_active", true)
        .maybeSingle(),
      signal,
    );
    // Duplicate/missing mappings and null activity flags fail closed.
    if (error || !data || data.supabase_user_id !== userId || data.is_active !== true ||
        typeof data.id !== "string" || !data.id) return null;
    return {
      id: data.id,
      email: typeof data.email === "string" ? data.email : null,
      name: typeof data.name === "string" ? data.name : null,
      role: data.is_main_admin === true ? "main_admin" : typeof data.role === "string" ? data.role : null,
      permissions: normaliseLotteryPermissions(data.permissions),
    };
  } catch {
    console.error("Lottery administrator verification failed.");
    return null;
  }
}

export function hasLotteryPermission(
  admin: AuthenticatedLotteryAdmin | null,
  permission: LotteryPermission,
): boolean {
  if (!admin || !permission || !/^lottery:[a-z][a-z0-9_-]*(?::[a-z][a-z0-9_-]*)*$/.test(permission)) {
    return false;
  }

  /*
   * Main admins keep full lottery access.
   */
  if (admin.role === "main_admin") {
    return true;
  }

  return admin.permissions.includes(permission);
}

export function requireLotteryPermission(
  admin: AuthenticatedLotteryAdmin | null,
  permission: LotteryPermission,
): void {
  if (!hasLotteryPermission(admin, permission)) {
    throw Object.assign(new Error("You do not have permission to perform this action."), { status: admin ? 403 : 401 });
  }
}

function getFirstForwardedIp(
  forwardedFor: string | null,
): string | null {
  if (!forwardedFor) {
    return null;
  }

  const first = forwardedFor
    .split(",")[0]
    ?.trim();

  if (!first) {
    return null;
  }

  return first;
}

function normaliseIpAddress(
  value: string | null,
): string | null {
  if (!value) {
    return null;
  }

  let ip = value.trim();

  /*
   * IPv6-mapped IPv4.
   */
  if (ip.startsWith("::ffff:")) {
    ip = ip.slice(7);
  }

  /*
   * Strip brackets from IPv6 proxy formats.
   */
  if (ip.startsWith("[") && ip.includes("]")) {
    ip = ip.slice(1, ip.indexOf("]"));
  }

  /*
   * Remove IPv4 port if one was included.
   */
  const ipv4WithPort =
    /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/;

  const match = ip.match(ipv4WithPort);

  if (match?.[1]) {
    ip = match[1];
  }

  return isIP(ip) ? ip : null;
}

export async function getLotteryRequestContext(): Promise<{
  ipAddress: string | null;
  deviceContext: LotteryAuditDeviceContext;
}> {
  const headerStore = await headers();

  const forwardedIp =
    getFirstForwardedIp(
      headerStore.get("x-forwarded-for"),
    );

  const ipAddress = normaliseIpAddress(
    forwardedIp ??
      headerStore.get("x-real-ip") ??
      headerStore.get("cf-connecting-ip"),
  );

  // Request headers are untrusted context hints, never authentication evidence.
  const userAgent =
    headerStore.get("user-agent")?.slice(0, 2048) ?? null;

  const platform =
    headerStore.get("sec-ch-ua-platform")?.slice(0, 256) ?? null;

  const mobile =
    headerStore.get("sec-ch-ua-mobile");

  const deviceContext: LotteryAuditDeviceContext = {
    userAgent,
    platform: platform
      ? platform.replace(/^"|"$/g, "")
      : null,
    deviceType:
      mobile === "?1"
        ? "mobile"
        : mobile === "?0"
          ? "desktop"
          : null,
  };

  return {
    ipAddress,
    deviceContext,
  };
}

function sanitiseAuditObject(
  value: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid audit object.");
  }
  const blockedKeys = new Set([
    "password",
    "password_hash",
    "secret",
    "token",
    "access_token",
    "refresh_token",
    "service_role",
    "service_role_key",
    "api_key",
    "card_number",
    "cvv",
    "cvc",
    "authorization",
    "cookie",
  ]);

  let visited = 0;
  function clean(
    input: unknown,
    depth = 0,
  ): unknown {
    if (++visited > 5000) throw new Error("Audit payload exceeds its size limit.");
    if (depth > 6) {
      return "[depth-limit]";
    }

    if (Array.isArray(input)) {
      return input.map((item) =>
        clean(item, depth + 1),
      );
    }

    if (
      input &&
      typeof input === "object"
    ) {
      const result: Record<string, unknown> = Object.create(null);

      for (const [
        key,
        nestedValue,
      ] of Object.entries(
        input as Record<string, unknown>,
      )) {
        if (
          blockedKeys.has(key.toLowerCase()) ||
          /password|secret|token|apikey|privatekey|credential|authorization|cookie|cardnumber|cvv|cvc/.test(key.toLowerCase().replace(/[^a-z0-9]/g, ""))
        ) {
          result[key] = "[REDACTED]";
          continue;
        }

        result[key] = clean(
          nestedValue,
          depth + 1,
        );
      }

      return result;
    }

    if (
      typeof input === "string" &&
      input.length > 10000
    ) {
      return `${input.slice(0, 10000)}…`;
    }

    return input;
  }

  return clean(value) as Record<
    string,
    unknown
  >;
}

export async function writeLotteryAudit(
  options: WriteLotteryAuditOptions,
): Promise<string> {
  // Never accept actor identity from a supplied object without verifying it.
  const verifiedAdmin = await getAuthenticatedAdmin();
  if (!verifiedAdmin || (options.admin && options.admin.id !== verifiedAdmin.id)) {
    throw Object.assign(new Error("An authenticated administrator is required to record this activity."), { status: verifiedAdmin ? 403 : 401 });
  }
  const requiredText = (value: unknown, max: number): value is string =>
    typeof value === "string" && !!value.trim() && value.length <= max;
  if (!requiredText(options.actionGroup, 80) || !requiredText(options.actionCode, 160) ||
      !requiredText(options.actionLabel, 500) ||
      (options.riskLevel !== undefined && !["low", "medium", "high", "critical"].includes(options.riskLevel))) {
    throw new Error("Invalid lottery audit classification.");
  }
  for (const value of [options.lotteryId, options.lotteryTitle, options.entityType, options.entityId, options.reason]) {
    if (value != null && (typeof value !== "string" || value.length > 4000)) {
      throw new Error("Invalid lottery audit field.");
    }
  }
  const {
    ipAddress: requestIp,
    deviceContext: requestDevice,
  } = await getLotteryRequestContext();

  const supabase = getAuditServiceClient();

  const beforeData = sanitiseAuditObject(
    options.beforeData,
  );

  const afterData = sanitiseAuditObject(
    options.afterData,
  );

  const metadata = sanitiseAuditObject(
    options.metadata,
  );

  const payload = {
    lotteryId:
      options.lotteryId ?? null,

    lotteryTitle:
      options.lotteryTitle ?? null,

    entityType:
      options.entityType ?? null,

    entityId:
      options.entityId ?? null,

    adminId:
      verifiedAdmin.id,

    adminEmail:
      verifiedAdmin.email,

    adminName:
      verifiedAdmin.name,

    actionGroup:
      options.actionGroup,

    actionCode:
      options.actionCode,

    actionLabel:
      options.actionLabel,

    riskLevel:
      options.riskLevel ?? "low",

    reason:
      options.reason ?? null,

    beforeData,
    afterData,

    ipAddress:
      normaliseIpAddress(options.ipAddress ?? requestIp),

    deviceContext:
      options.deviceContext ??
      requestDevice,

    metadata,
  };

  if (Buffer.byteLength(JSON.stringify(payload), "utf8") > 128 * 1024) {
    throw new Error("Audit payload exceeds its size limit.");
  }

  let insertResult;
  try {
    insertResult = await supabase
      .from("lottery_audit_logs")
      .insert({
        lottery_id:
          payload.lotteryId,

        lottery_title:
          payload.lotteryTitle,

        entity_type:
          payload.entityType,

        entity_id:
          payload.entityId,

        admin_id:
          payload.adminId,

        admin_email:
          payload.adminEmail,

        admin_name:
          payload.adminName,

        action_group:
          payload.actionGroup,

        action_code:
          payload.actionCode,

        action_label:
          payload.actionLabel,

        risk_level:
          payload.riskLevel,

        reason:
          payload.reason,

        before_data:
          payload.beforeData,

        after_data:
          payload.afterData,

        ip_address:
          payload.ipAddress,

        device_context:
          payload.deviceContext,

        metadata:
          payload.metadata,
      })
      .select("id")
      .abortSignal(AbortSignal.timeout(10_000))
      .single();

  } catch {
    throw new Error("Unable to record lottery audit activity.");
  }
  const { data, error } = insertResult;

  if (error || !data || typeof data.id !== "string" || !data.id) {
    console.error("Lottery audit insert failed.");

    throw new Error(
      "Unable to record lottery audit activity.",
    );
  }

  return data.id;
}

/** Compatibility export. Audit failures now propagate; they are not suppressed.
 * This standalone insert is NOT atomic with a preceding business mutation.
 * Critical writes still need a database transaction/RPC containing both writes.
 * Do not blindly retry timed-out inserts: commit status may be uncertain.
 */
export async function writeLotteryAuditSafe(options: WriteLotteryAuditOptions): Promise<void> {
  await writeLotteryAudit(options);
}
