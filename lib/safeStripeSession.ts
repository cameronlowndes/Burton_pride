// src/lib/safeStripeSession.ts

import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";

export const stripe =
  stripeSecretKey.length > 0
    ? new Stripe(stripeSecretKey, {
        apiVersion: "2023-08-16" as any,
      })
    : null;

function stripeKeyMode() {
  if (stripeSecretKey.startsWith("sk_live_")) return "live";
  if (stripeSecretKey.startsWith("sk_test_")) return "test";
  return "unknown";
}

function stripeSessionMode(sessionId: string) {
  if (sessionId.startsWith("cs_live_")) return "live";
  if (sessionId.startsWith("cs_test_")) return "test";
  return "unknown";
}

export async function safeRetrieveStripeSession(
  sessionId: string | null | undefined
) {
  const cleanSessionId = String(sessionId || "").trim();

  if (!cleanSessionId) return null;
  if (!stripe) return null;

  const keyMode = stripeKeyMode();
  const sessionMode = stripeSessionMode(cleanSessionId);

  // Stops live/test key mismatch errors.
  if (
    keyMode !== "unknown" &&
    sessionMode !== "unknown" &&
    keyMode !== sessionMode
  ) {
    return null;
  }

  try {
    return await stripe.checkout.sessions.retrieve(cleanSessionId);
  } catch (err: any) {
    // This removes the big console error.
    if (
      err?.type === "StripeInvalidRequestError" ||
      err?.code === "resource_missing" ||
      err?.statusCode === 404
    ) {
      return null;
    }

    // Only log real unexpected Stripe errors.
    console.error("Unexpected Stripe session error:", err?.message || err);
    return null;
  }
}