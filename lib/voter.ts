export function getOrCreateVoterId(): string {
  const key = "voter_id";

  const existing = document.cookie
    .split("; ")
    .find((x) => x.startsWith(key + "="))
    ?.split("=")[1];

  if (existing) return decodeURIComponent(existing);

  const id =
    (globalThis.crypto?.randomUUID?.() as string | undefined) ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  document.cookie = `${key}=${encodeURIComponent(id)}; Path=/; Max-Age=${
    60 * 60 * 24 * 365
  }; SameSite=Lax`;

  return id;
}