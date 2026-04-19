"use client";

import { useState } from "react";
import {
  CreditCard,
  ExternalLink,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";

export default function MoneyStripePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startStripeOnboarding() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/admin/money/stripe/onboard", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to start Stripe onboarding");
      }

      window.location.href = data.url;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start Stripe onboarding"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.10),_transparent_28%),linear-gradient(135deg,_#020617_0%,_#0f172a_45%,_#020617_100%)] text-white">
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                <CreditCard className="h-7 w-7" />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-medium text-emerald-300">
                  Money App
                </p>
                <h1 className="mt-1 text-3xl font-black tracking-tight">
                  Connect Stripe
                </h1>
                <p className="mt-3 max-w-2xl text-sm text-white/70 sm:text-base">
                  Connect your Stripe account so you can handle onboarding,
                  payments, and payouts inside the Money system.
                </p>
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
              <h2 className="mb-4 text-xl font-bold">What this does</h2>

              <div className="space-y-3 text-sm text-white/75">
                <div className="rounded-2xl bg-black/20 px-4 py-3">
                  Creates or reuses your connected Stripe account
                </div>
                <div className="rounded-2xl bg-black/20 px-4 py-3">
                  Sends you to Stripe’s secure onboarding flow
                </div>
                <div className="rounded-2xl bg-black/20 px-4 py-3">
                  Returns you back here when setup is complete
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
              <h2 className="mb-4 text-xl font-bold">Start setup</h2>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={startStripeOnboarding}
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 font-bold text-black transition hover:bg-emerald-400 disabled:opacity-60"
                >
                  <ExternalLink className="h-4 w-4" />
                  {loading ? "Starting..." : "Connect Stripe"}
                </button>

                <button
                  type="button"
                  onClick={startStripeOnboarding}
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Resume onboarding
                </button>
              </div>

              <div className="mt-4 rounded-2xl bg-black/20 px-4 py-3 text-sm text-white/70">
                Stripe onboarding is hosted by Stripe, and onboarding links are
                single-use. If a link expires, you create a new one and send the
                user back through the flow.
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                <ShieldCheck className="h-5 w-5" />
              </div>

              <div className="text-sm text-white/75">
                Stripe’s hosted onboarding collects the information needed to
                activate the connected account. After setup, you can build a
                status check page to show whether charges, payouts, and account
                details are fully enabled.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}