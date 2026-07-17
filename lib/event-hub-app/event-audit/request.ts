import { createHash, randomUUID } from "crypto";

export function makeRequestId(request?: Request | null, explicit?: string | null) {
  const supplied =
    explicit ||
    request?.headers.get("x-request-id") ||
    request?.headers.get("x-vercel-id");

  return supplied?.trim() || `req_${randomUUID().replaceAll("-", "")}`;
}

export function requestRoute(request?: Request | null) {
  if (!request) return null;
  try {
    return new URL(request.url).pathname;
  } catch {
    return null;
  }
}

export function requestIp(request?: Request | null) {
  if (!request) return null;
  const forwarded = request.headers.get("x-forwarded-for");
  return (
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    null
  );
}

export function parseUserAgent(userAgent: string | null) {
  const ua = String(userAgent || "");
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : ua
            ? "Other"
            : null;

  const operatingSystem = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad|iOS/.test(ua)
        ? "iOS / iPadOS"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : ua
              ? "Other"
              : null;

  const deviceType = /Mobile|Android|iPhone/.test(ua)
    ? "mobile"
    : /iPad|Tablet/.test(ua)
      ? "tablet"
      : ua
        ? "desktop"
        : null;

  return { browser, operatingSystem, deviceType };
}

export function hashSessionReference(sessionReference?: string | null) {
  if (!sessionReference) return null;
  return createHash("sha256").update(sessionReference).digest("hex").slice(0, 20);
}
