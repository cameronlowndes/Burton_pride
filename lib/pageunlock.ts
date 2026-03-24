import crypto from "node:crypto";

const SECRET =
  process.env.SITE_PAGE_UNLOCK_SECRET || "dev-fallback-secret-change-me";

type UnlockPayload = {
  route: string;
  exp: number;
};

function base64url(input: string) {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

function unbase64url(input: string) {
  const normalized = input.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

export function createUnlockToken(route: string, maxAgeSeconds = 1800) {
  const payload: UnlockPayload = {
    route,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
  };

  const payloadEncoded = base64url(JSON.stringify(payload));

  const signature = crypto
    .createHmac("sha256", SECRET)
    .update(payloadEncoded)
    .digest("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");

  return `${payloadEncoded}.${signature}`;
}

export function verifyUnlockToken(token: string, route: string) {
  try {
    const [payloadEncoded, signature] = token.split(".");
    if (!payloadEncoded || !signature) return false;

    const expected = crypto
      .createHmac("sha256", SECRET)
      .update(payloadEncoded)
      .digest("base64")
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/g, "");

    const sigA = Buffer.from(signature, "utf8");
    const sigB = Buffer.from(expected, "utf8");

    if (sigA.length !== sigB.length) return false;
    if (!crypto.timingSafeEqual(sigA, sigB)) return false;

    const payload = JSON.parse(unbase64url(payloadEncoded)) as UnlockPayload;

    if (!payload?.route || !payload?.exp) return false;
    if (payload.route !== route) return false;
    if (payload.exp < Math.floor(Date.now() / 1000)) return false;

    return true;
  } catch {
    return false;
  }
}