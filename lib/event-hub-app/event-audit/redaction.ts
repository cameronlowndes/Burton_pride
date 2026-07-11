const SENSITIVE_KEY_PATTERN =
  /(password|passcode|secret|token|authorization|cookie|session|api[_-]?key|service[_-]?role|private[_-]?key|client[_-]?secret|signed[_-]?url|access[_-]?key)/i;

const LARGE_TEXT_LIMIT = 4_000;
const MAX_DEPTH = 8;
const MAX_ARRAY_ITEMS = 100;
const REDACTED = "[REDACTED]";

function stablePrimitive(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  return value;
}

export function redactAuditValue(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (value === null || value === undefined) return value;
  if (depth > MAX_DEPTH) return "[MAX_DEPTH_REACHED]";

  const primitive = stablePrimitive(value);
  if (typeof primitive === "string") {
    return primitive.length > LARGE_TEXT_LIMIT
      ? `${primitive.slice(0, LARGE_TEXT_LIMIT)}…[TRUNCATED]`
      : primitive;
  }
  if (typeof primitive !== "object") return primitive;

  if (seen.has(primitive as object)) return "[CIRCULAR]";
  seen.add(primitive as object);

  if (Array.isArray(primitive)) {
    return primitive
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => redactAuditValue(item, depth + 1, seen));
  }

  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(primitive as Record<string, unknown>)) {
    result[key] = SENSITIVE_KEY_PATTERN.test(key)
      ? REDACTED
      : redactAuditValue(child, depth + 1, seen);
  }
  return result;
}

export function redactAuditObject(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  const redacted = redactAuditValue(value);
  if (redacted && typeof redacted === "object" && !Array.isArray(redacted)) {
    return redacted as Record<string, unknown>;
  }
  return { value: redacted };
}

function isEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function calculateChangedFields(
  beforeInput: unknown,
  afterInput: unknown,
): Record<string, { before: unknown; after: unknown }> {
  const before = redactAuditObject(beforeInput) || {};
  const after = redactAuditObject(afterInput) || {};
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  const changed: Record<string, { before: unknown; after: unknown }> = {};

  for (const key of keys) {
    if (!isEqual(before[key], after[key])) {
      changed[key] = {
        before: before[key] ?? null,
        after: after[key] ?? null,
      };
    }
  }

  return changed;
}

export function maskIpAddress(value: string | null | undefined) {
  const ip = String(value || "").trim();
  if (!ip) return null;

  if (ip.includes(":")) {
    const parts = ip.split(":").filter(Boolean);
    return `${parts.slice(0, 3).join(":")}:…`;
  }

  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.x.x`;
  return "Masked";
}

export function maskSensitiveChanges(value: unknown) {
  if (!value || typeof value !== "object") return value;

  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (/email|phone|address|medical|access_need|notes|confidential/i.test(key)) {
      result[key] = { before: "[MASKED]", after: "[MASKED]" };
    } else {
      result[key] = child;
    }
  }
  return result;
}
