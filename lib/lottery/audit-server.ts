import "server-only";

import { cookies, headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import type {
  CreateLotteryAuditLogInput,
  LotteryAuditActionGroup,
  LotteryAuditDeviceContext,
  LotteryAuditRiskLevel,
} from "@/lib/lottery/audit-types";

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
  | "lottery:audit:view";

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
      "NEXT_PUBLIC_SUPABASE_URL is not configured.",
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
      "Supabase server secret/service role key is not configured.",
    );
  }

  return key;
}

export function getAuditServiceClient() {
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
}

function normalizePermissions(value: unknown): string[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter(
      (permission): permission is string =>
        typeof permission === "string",
    );
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed.filter(
          (permission): permission is string =>
            typeof permission === "string",
        );
      }
    } catch {
      return value
        .split(",")
        .map((permission) => permission.trim())
        .filter(Boolean);
    }
  }

  if (typeof value === "object") {
    return Object.entries(
      value as Record<string, unknown>,
    )
      .filter(([, enabled]) => enabled === true)
      .map(([permission]) => permission);
  }

  return [];
}

function readPossibleCookie(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  names: string[],
): string | null {
  for (const name of names) {
    const value = cookieStore.get(name)?.value;

    if (value) {
      return value;
    }
  }

  return null;
}

export async function getAuthenticatedAdmin():
  Promise<AuthenticatedLotteryAdmin | null> {
  try {
    const cookieStore = await cookies();

    /*
     * Your Admin Portal already uses these custom cookies.
     *
     * burton_admin_session
     * burton_admin_id
     * burton_admin_email
     */
    const adminId = readPossibleCookie(cookieStore, [
      "burton_admin_id",
      "admin_id",
    ]);

    const adminEmail = readPossibleCookie(cookieStore, [
      "burton_admin_email",
      "admin_email",
    ]);

    const session = readPossibleCookie(cookieStore, [
      "burton_admin_session",
      "admin_session",
    ]);

    /*
     * Require the Admin Portal session marker as well as an
     * admin identifier. A browser-provided admin ID alone must
     * never be enough to authorise access.
     */
    if (!session || (!adminId && !adminEmail)) {
      return null;
    }

    const supabase = getAuditServiceClient();

    let query = supabase
      .from("admin_users")
      .select("*")
      .limit(1);

    if (adminId) {
      query = query.eq("id", adminId);
    } else if (adminEmail) {
      query = query.eq("email", adminEmail);
    }

    const {
      data,
      error,
    } = await query.maybeSingle();

    if (error) {
      console.error(
        "Lottery admin authentication query failed:",
        error,
      );

      return null;
    }

    if (!data) {
      return null;
    }

    /*
     * Support the common active-state column names without
     * forcing your existing Admin Portal schema to change.
     */
    if (
      data.is_active === false ||
      data.active === false ||
      data.disabled === true
    ) {
      return null;
    }

    const permissions = normalizePermissions(
      data.permissions ??
        data.permission ??
        data.permission_list,
    );

    return {
      id: String(data.id),
      email:
        typeof data.email === "string"
          ? data.email
          : adminEmail,
      name:
        typeof data.name === "string"
          ? data.name
          : typeof data.full_name === "string"
            ? data.full_name
            : typeof data.display_name === "string"
              ? data.display_name
              : null,
      role:
        typeof data.role === "string"
          ? data.role
          : null,
      permissions,
    };
  } catch (error) {
    console.error(
      "Lottery admin authentication error:",
      error,
    );

    return null;
  }
}

export function hasLotteryPermission(
  admin: AuthenticatedLotteryAdmin | null,
  permission: LotteryPermission,
): boolean {
  if (!admin) {
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
    throw new Error(
      `Missing required lottery permission: ${permission}`,
    );
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

  return ip || null;
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

  const userAgent =
    headerStore.get("user-agent");

  const platform =
    headerStore.get("sec-ch-ua-platform");

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

  function clean(
    input: unknown,
    depth = 0,
  ): unknown {
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
      const result: Record<string, unknown> = {};

      for (const [
        key,
        nestedValue,
      ] of Object.entries(
        input as Record<string, unknown>,
      )) {
        if (
          blockedKeys.has(
            key.toLowerCase(),
          )
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

  const payload: CreateLotteryAuditLogInput = {
    lotteryId:
      options.lotteryId ?? null,

    lotteryTitle:
      options.lotteryTitle ?? null,

    entityType:
      options.entityType ?? null,

    entityId:
      options.entityId ?? null,

    adminId:
      options.admin?.id ?? null,

    adminEmail:
      options.admin?.email ?? null,

    adminName:
      options.admin?.name ?? null,

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
      options.ipAddress ??
      requestIp,

    deviceContext:
      options.deviceContext ??
      requestDevice,

    metadata,
  };

  const { data, error } =
    await supabase
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
      .single();

  if (error) {
    console.error(
      "Failed to write Lottery Audit Log:",
      error,
    );

    throw new Error(
      "Unable to record lottery audit activity.",
    );
  }

  return data.id;
}

export async function writeLotteryAuditSafe(
  options: WriteLotteryAuditOptions,
): Promise<void> {
  try {
    await writeLotteryAudit(options);
  } catch (error) {
    console.error(
      "Non-blocking Lottery Audit write failed:",
      error,
    );
  }
}