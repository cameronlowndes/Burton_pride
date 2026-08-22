"use client";

import {
  AlertTriangle,
  Clock3,
  ShieldCheck,
  TimerReset,
} from "lucide-react";
import { useEffect, useState } from "react";

const STATUS_API =
  "/api/admin/settings/security/session/status";

type SessionStatus = {
  authenticated?: boolean;
  requires_reauthentication?: boolean;
  last_mfa_at?: string | null;
  next_presence_check_at?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

export default function SecuritySessionTestPage() {
  const [status, setStatus] =
    useState<SessionStatus | null>(null);
  const [error, setError] =
    useState("");
  const [loading, setLoading] =
    useState(true);

  async function loadStatus() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        STATUS_API,
        {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        },
      );

      const data =
        (await response.json()) as SessionStatus & {
          error?: string;
          message?: string;
        };

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            `Status request failed (${response.status}).`,
        );
      }

      setStatus(data);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load session status.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  function runSafePresenceTest() {
    if (process.env.NODE_ENV === "production") {
      setError(
        "The manual presence test is disabled in production.",
      );
      return;
    }

    /*
     * This is deliberately client-only.
     * No Supabase row, reauthentication flag, MFA time or session
     * timestamp is changed.
     */
    window.dispatchEvent(
      new Event(
        "burton-admin:test-presence-check",
      ),
    );
  }

  return (
    <div className="min-h-screen bg-[#050816] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur-xl sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-500/15">
              <ShieldCheck className="h-6 w-6 text-purple-200" />
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-purple-200/70">
                Admin Security
              </p>
              <h1 className="mt-1 text-3xl font-black">
                Six-hour security check test
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">
                Test the real 60-second “Are you still here?”
                interface without changing or locking the real
                server-side admin session.
              </p>
            </div>
          </div>

          {error ? (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm text-red-50">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              {error}
            </div>
          ) : null}

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/45">
                Authentication
              </p>
              <p className="mt-2 text-xl font-black">
                {loading
                  ? "Checking..."
                  : status?.authenticated === false
                    ? "Not authenticated"
                    : "Authenticated"}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/45">
                Reauthentication
              </p>
              <p className="mt-2 text-xl font-black">
                {loading
                  ? "Checking..."
                  : status?.requires_reauthentication
                    ? "Required"
                    : "Not required"}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-white/45">
                <ShieldCheck className="h-4 w-4" />
                Last MFA
              </div>
              <p className="mt-2 text-lg font-black">
                {formatDate(status?.last_mfa_at)}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-white/45">
                <Clock3 className="h-4 w-4" />
                Real next check
              </div>
              <p className="mt-2 text-lg font-black">
                {formatDate(
                  status?.next_presence_check_at,
                )}
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-emerald-300/15 bg-emerald-500/[0.08] p-5">
            <div className="flex items-start gap-3">
              <TimerReset className="mt-1 h-6 w-6 shrink-0 text-emerald-200" />

              <div>
                <h2 className="text-xl font-black">
                  Safe development test
                </h2>

                <p className="mt-2 text-sm leading-6 text-white/65">
                  This opens the same 60-second security popup,
                  but it does not change next_presence_check_at,
                  requires_reauthentication, last_mfa_at or any
                  Supabase security-session row.
                </p>

                <button
                  type="button"
                  onClick={runSafePresenceTest}
                  className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-300 px-5 text-sm font-black text-black hover:bg-emerald-200"
                >
                  <TimerReset className="h-4 w-4" />
                  Test six-hour popup now
                </button>
              </div>
            </div>
          </div>

          <p className="mt-6 text-xs leading-5 text-white/40">
            Development only. The manual test is blocked by the
            client in production and never changes real session
            security state.
          </p>
        </div>
      </div>
    </div>
  );
}
