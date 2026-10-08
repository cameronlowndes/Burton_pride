import "server-only";

import { isIP } from "node:net";

import {
  getAuthenticatedAdmin,
  getAuditServiceClient,
} from "@/lib/lottery/audit-server";

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
  /password|passcode|secret|token|authorization|cookie|apikey|servicerole|stripesignature|sessionid|privatekey|credential|cardnumber|cvv|cvc/;

function cleanOptionalText(
  value: string | null | undefined,
  maxLength: number,
): string | null {
  if (value == null) return null;
  if (typeof value !== "string" || value.length > maxLength) {
    throw new Error("Invalid lottery audit field.");
  }
  return value.trim() || null;
}

function cleanRequiredText(value: string, fieldName: string, maxLength: number): string {
  const cleaned = cleanOptionalText(value, maxLength);
  if (!cleaned) throw new Error(`${fieldName} is required for the lottery audit log.`);
  return cleaned;
}

/** Secret-field redaction is not a general detector for secrets in free text.
 * Callers must not send credentials, card details or unnecessary personal data.
 */
function sanitiseForAudit(value: unknown): unknown {
  const seen = new WeakSet<object>();
  let visited = 0;
  function clean(input: unknown, depth: number): unknown {
    if (++visited > 5000) throw new Error("Audit payload exceeds its size limit.");
    if (input == null) return null;
    if (typeof input === "string") return input.length > 5000 ? `${input.slice(0, 5000)}…` : input;
    if (typeof input === "boolean") return input;
    if (typeof input === "number") return Number.isFinite(input) ? input : "[non-finite number]";
    if (typeof input === "bigint") return input.toString();
    if (typeof input === "function" || typeof input === "symbol") return "[unsupported]";
    if (depth >= 8) return "[maximum depth reached]";
    if (input instanceof Date) return Number.isFinite(input.getTime()) ? input.toISOString() : "[invalid date]";
    if (typeof input !== "object") return "[unsupported]";
    if (seen.has(input)) return "[circular]";
    seen.add(input);
    if (Array.isArray(input)) return input.map(item => clean(item, depth + 1));
    const output: Record<string, unknown> = Object.create(null);
    for (const [key, item] of Object.entries(input)) {
      output[key] = secretKeyPattern.test(key.toLowerCase().replace(/[^a-z0-9]/g, ""))
        ? "[redacted]" : clean(item, depth + 1);
    }
    return output;
  }
  const result = clean(value, 0);
  if (Buffer.byteLength(JSON.stringify(result), "utf8") > 32 * 1024) {
    throw new Error("Audit payload exceeds its size limit.");
  }
  return result;
}

function normaliseIp(value: string): string | null {
  let candidate = value.trim();

  if (!candidate) {
    return null;
  }

  if (candidate.startsWith("::ffff:")) candidate = candidate.slice(7);

  if (
    candidate.startsWith("[") &&
    candidate.includes("]")
  ) {
    candidate = candidate.slice(
      1,
      candidate.indexOf("]"),
    );
  } else if (
    /^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(candidate)
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

  // Headers are untrusted context hints, never identity or permission evidence.
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

/** Writes an authenticated administrator event to lottery_audit_logs.
 * Caller must authorize the specific action. This insert does not authorize it.
 * Critical mutations and audit must commit inside ONE database transaction;
 * calling this after a mutation cannot roll that mutation back on audit failure.
 * Server/webhook events need a separate verified system-actor transaction.
 * A timeout may have committed: do not blindly retry without idempotency.
 */
export async function writeLotteryAuditLog(
  input: WriteLotteryAuditLogInput,
): Promise<LotteryAuditLogResult> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Invalid lottery audit input.");
  }
  const verifiedAdmin = await getAuthenticatedAdmin();
  if (!verifiedAdmin) {
    throw Object.assign(new Error("Authentication required to record lottery activity."), { status: 401 });
  }
  if (input.actor?.id != null && input.actor.id !== verifiedAdmin.id) {
    throw Object.assign(new Error("Lottery audit actor does not match the authenticated administrator."), { status: 403 });
  }
  if (!groupSet.has(input.actionGroup)) {
    throw new Error(
      "Unsupported lottery audit action group.",
    );
  }

  const riskLevel = input.riskLevel ?? "low";

  if (!riskLevelSet.has(riskLevel)) {
    throw new Error(
      "Unsupported lottery audit risk level.",
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

  const payload = {
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
      verifiedAdmin.id,
      100,
    ),
    admin_email: cleanOptionalText(
      verifiedAdmin.email,
      320,
    ),
    admin_name: cleanOptionalText(
      verifiedAdmin.name,
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
  };
  if (Buffer.byteLength(JSON.stringify(payload), "utf8") > 128 * 1024) {
    throw new Error("Audit payload exceeds its size limit.");
  }
  let result:
    | {
        data?: { id?: string; created_at?: string } | null;
        error?: unknown;
      }
    | undefined;

  try {
    result = await new Promise<{
      data?: { id?: string; created_at?: string } | null;
      error?: unknown;
    }>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(Object.assign(new Error("Lottery audit request timed out."), { status: 504 }));
      }, 10_000);

      getAuditServiceClient()
        .from("lottery_audit_logs")
        .insert(payload)
        .select("id, created_at")
        .single()
        .then(
          (value) => {
            clearTimeout(timeoutId);
            resolve(value as {
              data?: { id?: string; created_at?: string } | null;
              error?: unknown;
            });
          },
          (error) => {
            clearTimeout(timeoutId);
            reject(error);
          },
        );
    });
  } catch {
    throw Object.assign(new Error("Unable to record lottery audit activity."), { status: 503 });
  }

  const { data, error } = result ?? {};
  if (error || !data || typeof data.id !== "string" || !data.id ||
      typeof data.created_at !== "string" || !Number.isFinite(Date.parse(data.created_at))) {
    throw Object.assign(new Error("Unable to confirm lottery audit activity was recorded."), { status: 503 });
  }

  return {
    id: String(data.id),
    createdAt: String(data.created_at),
  };
}

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
  } catch {
    const message = "Unable to record lottery audit activity.";
    console.error(message);
    return { ok: false, error: message };
  }
}

export function getLotteryAuditErrorReason(
  error: unknown,
): string {
  const status = error && typeof error === "object"
    ? (error as { status?: unknown }).status : undefined;
  if (typeof status === "number" && Number.isInteger(status) && status >= 400 && status <= 599) {
    return `Lottery action failed (HTTP ${status}).`;
  }
  return "Lottery action failed.";
}
