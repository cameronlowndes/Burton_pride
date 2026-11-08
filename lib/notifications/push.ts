import "server-only";

import { z } from "zod";

export const pushEndpoint = z.string().max(2048).refine((value) => {
  try {
    const endpoint = new URL(value);
    const host = endpoint.hostname;
    return endpoint.protocol === "https:" && !endpoint.port && !endpoint.username &&
      !endpoint.password && !endpoint.hash && (
        host === "fcm.googleapis.com" ||
        host === "updates.push.services.mozilla.com" ||
        host === "push.services.mozilla.com" ||
        host.endsWith(".push.apple.com") ||
        host.endsWith(".notify.windows.com")
      );
  } catch {
    return false;
  }
}, "Unsupported push service");

export const pushSubscription = z.object({
  endpoint: pushEndpoint,
  keys: z.object({
    p256dh: z.string().regex(/^[\w-]{87}$/),
    auth: z.string().regex(/^[\w-]{22}$/),
  }),
});

export function pushConfiguration() {
  const subject = process.env.NOTIFICATION_PUSH_SUBJECT;
  const publicKey = process.env.NOTIFICATION_PUSH_PUBLIC_KEY;
  const privateKey = process.env.NOTIFICATION_PUSH_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) return null;
  return { subject, publicKey, privateKey };
}
