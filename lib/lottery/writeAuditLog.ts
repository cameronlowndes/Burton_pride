import "server-only";

import { isIP } from "node:net";

import {
  supabaseAdmin,
} from "@/lib/supabase/supabaseAdmin";

export const LOTTERY_AUDIT_GROUPS = [
  "lottery",
  "ticket",
  "payment",
  "prize",
  "draw",
  "winner",
  "compliance",
  "security",
  "export",
] as const;

export const LOTTERY_AUDIT_RISK_LEVELS = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export type LotteryAuditGroup =
  (typeof LOTTERY_AUDIT_GROUPS)[number];

export type LotteryAuditRiskLevel =
  (typeof LOTTERY_AUDIT_RISK_LEVELS)[number];

export type LotteryAuditActor = {
  id?: string | null;
  email?: string | null;
  name?: string | null;
};

type AuditRequest = Pick<
  Request,
  "headers" | "method" | "url"
>;

export type WriteLotteryAuditLogInput = {
  request?: AuditRequest | null;
  actor?: LotteryAuditActor | null;
  lotteryId?: string | null;
  lotteryTitle?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  actionCode: string;
  actionLabel: string;
  actionGroup: LotteryAuditGroup;
  riskLevel?: LotteryAuditRiskLevel;
  reason?: string | null;
  metadata?: unknown;
  beforeData?: unknown;
  afterData?: unknown;
};

export type LotteryAuditLogResult = {
  id: string;
  createdAt: string;
};

const groupSet = new Set<string>(
  LOTTERY_AUDIT_GROUPS,
);

const riskLevelSet = new Set<string>(
  LOTTERY_AUDIT_RISK_LEVELS,
);

const secretKeyPattern =
  /(?:^|_)(?:password|passcode|secret|token|authorization|cookie|api[_-]?key|service[_-]?role|stripe[_-]?signature|session[_-]?id|client[_-]?secret|access[_-]?token|refresh[_-]?token)(?:$|_)/i;

const maxDepth = 8;
const maxStringLength = 5_000;

function cleanOptionalText(
  value: string | null | undefined,
  maxLength: number,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  if (!cleaned) {
    return null;
  }

  return cleaned.slice(0, maxLength);
}

function cleanRequiredText(
  value: string,
  fieldName: string,
  maxLength: number,
): string {
  const cleaned = cleanOptionalText(
    value,
    maxLength,
  );

  if (!cleaned) {
    throw new Error(
      `${fieldName} is required for the lottery audit log.`,
    );
  }

  return cleaned;
}

function sanitiseForAudit(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (value === null || value === undefined) {
    return value ?? null;
  }

  if (typeof value === "string") {
    return value.length > maxStringLength
      ? `${value.slice(0, maxStringLength)}…`
      : value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (
    typeof value === "function" ||
    typeof value === "symbol"
  ) {
    return "[unsupported]";
  }

  if (depth >= maxDepth) {
    return "[maximum depth reached]";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value !== "object") {
    return String(value);
  }

  if (seen.has(value)) {
    return "[circular]";
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) =>
      sanitiseForAudit(item, depth + 1, seen),
    );
  }

  const output: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value)) {
    output[key] = secretKeyPattern.test(key)
      ? "[redacted]"
      : sanitiseForAudit(
          item,
          depth + 1,
          seen,
        );
  }

  return output;
}

function normaliseIp(value: string): string | null {
  let candidate = value.trim();

  if (!candidate) {
    return null;
  }

  if (
    candidate.startsWith("[") &&
    candidate.includes("]")
  ) {
    candidate = candidate.slice(
      1,
      candidate.indexOf("]"),
    );
  } else if (
    candidate.includes(".") &&
    candidate.includes(":")
  ) {
    candidate = candidate.split(":", 1)[0];
  }

  return isIP(candidate) ? candidate : null;
}

function getRequestIp(
  request?: AuditRequest | null,
): string | null {
  if (!request) {
    return null;
  }

  const candidates = [
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-real-ip"),
    request.headers
      .get("x-forwarded-for")
      ?.split(",")[0],
  ];

  for (const value of candidates) {
    if (!value) {
      continue;
    }

    const ip = normaliseIp(value);

    if (ip) {
      return ip;
    }
  }

  return null;
}

function safePathname(url: string): string | null {
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
}

function getDeviceContext(
  request?: AuditRequest | null,
): Record<string, unknown> | null {
  if (!request) {
    return null;
  }

  return {
    method: request.method,
    pathname: safePathname(request.url),
    user_agent:
      request.headers.get("user-agent"),
    request_id:
      request.headers.get("x-vercel-id") ??
      request.headers.get("cf-ray"),
    country:
      request.headers.get("x-vercel-ip-country") ??
      request.headers.get("cf-ipcountry"),
  };
}

/**
 * Writes one server-side Lottery Management event to lottery_audit_logs.
 * Call this after a successful mutation. Use tryWriteLotteryAuditLog inside
 * an error handler so the original business error is not hidden.
 */
export async function writeLotteryAuditLog(
  input: WriteLotteryAuditLogInput,
): Promise<LotteryAuditLogResult> {
  if (!groupSet.has(input.actionGroup)) {
    throw new Error(
      `Unsupported lottery audit action group: ${input.actionGroup}`,
    );
  }

  const riskLevel = input.riskLevel ?? "low";

  if (!riskLevelSet.has(riskLevel)) {
    throw new Error(
      `Unsupported lottery audit risk level: ${riskLevel}`,
    );
  }

  const actionCode = cleanRequiredText(
    input.actionCode,
    "actionCode",
    160,
  );
  const actionLabel = cleanRequiredText(
    input.actionLabel,
    "actionLabel",
    240,
  );

  const { data, error } = await supabaseAdmin
    .from("lottery_audit_logs")
    .insert({
      lottery_id: cleanOptionalText(
        input.lotteryId,
        100,
      ),
      lottery_title: cleanOptionalText(
        input.lotteryTitle,
        300,
      ),
      entity_type: cleanOptionalText(
        input.entityType,
        100,
      ),
      entity_id: cleanOptionalText(
        input.entityId,
        200,
      ),
      admin_id: cleanOptionalText(
        input.actor?.id,
        100,
      ),
      admin_email: cleanOptionalText(
        input.actor?.email,
        320,
      ),
      admin_name: cleanOptionalText(
        input.actor?.name,
        200,
      ),
      action_code: actionCode,
      action_label: actionLabel,
      action_group: input.actionGroup,
      risk_level: riskLevel,
      reason: cleanOptionalText(
        input.reason,
        2_000,
      ),
      metadata: sanitiseForAudit(
        input.metadata,
      ),
      before_data: sanitiseForAudit(
        input.beforeData,
      ),
      after_data: sanitiseForAudit(
        input.afterData,
      ),
      ip_address: getRequestIp(input.request),
      device_context: sanitiseForAudit(
        getDeviceContext(input.request),
      ),
    })
    .select("id, created_at")
    .single();

  if (error || !data) {
    throw new Error(
      `Lottery audit log insert failed: ${
        error?.message ?? "No row was returned."
      }`,
    );
  }

  return {
    id: String(data.id),
    createdAt: String(data.created_at),
  };
}

/**
 * Best-effort variant for catch blocks and failure reporting.
 */
export async function tryWriteLotteryAuditLog(
  input: WriteLotteryAuditLogInput,
): Promise<
  | {
      ok: true;
      result: LotteryAuditLogResult;
    }
  | {
      ok: false;
      error: string;
    }
> {
  try {
    return {
      ok: true,
      result: await writeLotteryAuditLog(input),
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown lottery audit log error.";

    console.error(
      "Lottery audit log write failed:",
      message,
    );

    return {
      ok: false,
      error: message,
    };
  }
}

/**
 * Produces a short, safe reason value for a failed API action.
 */
export function getLotteryAuditErrorReason(
  error: unknown,
): string {
  const message =
    error instanceof Error
      ? error.message
      : "Unknown error";

  return message.slice(0, 2_000);
}
