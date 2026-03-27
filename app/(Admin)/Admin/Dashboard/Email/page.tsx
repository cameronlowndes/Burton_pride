"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail, RefreshCw, Link2, Unlink, ShieldCheck, AlertCircle } from "lucide-react";

type GoogleStatusResponse = {
  ok: boolean;
  connected: boolean;
  googleEmail?: string | null;
  expiresAt?: number | null;
  error?: string;
};

function formatExpiry(expiresAt?: number | null) {
  if (!expiresAt) return "Unknown";

  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminEmailPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [status, setStatus] = useState<GoogleStatusResponse | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function loadStatus(showSpinner = false) {
    try {
      if (showSpinner) setRefreshing(true);
      else setLoading(true);

      const res = await fetch("/api/admin/google/status", {
        method: "GET",
        cache: "no-store",
      });

      const data: GoogleStatusResponse = await res.json();
      setStatus(data);
    } catch {
      setStatus({
        ok: false,
        connected: false,
        error: "Failed to load Google connection status.",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function handleDisconnect() {
    const confirmed = window.confirm("Are you sure you want to disconnect this Google account?");
    if (!confirmed) return;

    try {
      setDisconnecting(true);
      setNotice(null);

      const res = await fetch("/api/admin/google/disconnect", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data?.error || "Failed to disconnect account.");
      }

      setNotice({
        type: "success",
        message: "Google account disconnected successfully.",
      });

      await loadStatus();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to disconnect account.",
      });
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#1e1b4b,_#0f172a_45%,_#020617_100%)] text-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-200">
                <Mail className="h-4 w-4" />
                Admin Email
              </div>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Email Settings</h1>
              <p className="mt-2 max-w-3xl text-sm text-white/70 md:text-base">
                Connect your Burton Pride Google account so you can later send emails through the
                admin portal using your own email address.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => loadStatus(true)}
                disabled={refreshing || loading}
                className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </button>

              {!status?.connected ? (
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = "/api/admin/google/connect";
                  }}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-pink-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-fuchsia-900/30 transition hover:scale-[1.01] hover:from-fuchsia-500 hover:to-pink-500"
                >
                  <Link2 className="h-4 w-4" />
                  Connect Google Account
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Unlink className="h-4 w-4" />
                  {disconnecting ? "Disconnecting..." : "Disconnect Google"}
                </button>
              )}
            </div>
          </div>

          {notice ? (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                notice.type === "success"
                  ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                  : "border-rose-400/30 bg-rose-500/10 text-rose-100"
              }`}
            >
              {notice.message}
            </div>
          ) : null}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-indigo-500/15 p-3">
                <ShieldCheck className="h-6 w-6 text-indigo-200" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Google Connection</h2>
                <p className="text-sm text-white/60">
                  This controls whether your Burton Pride account is linked to the admin portal.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/70">
                Loading connection status...
              </div>
            ) : status?.connected ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-5">
                  <div className="mb-2 flex items-center gap-2 text-emerald-100">
                    <ShieldCheck className="h-5 w-5" />
                    <span className="font-semibold">Connected</span>
                  </div>
                  <p className="text-sm text-emerald-50/90">
                    Your Google account is connected and ready for later email sending features.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/40">Connected email</p>
                    <p className="mt-2 break-all text-base font-semibold text-white">
                      {status.googleEmail || "Unknown email"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/40">Token expiry</p>
                    <p className="mt-2 text-base font-semibold text-white">
                      {formatExpiry(status.expiresAt)}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-5">
                  <div className="mb-2 flex items-center gap-2 text-amber-100">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-semibold">Not connected</span>
                  </div>
                  <p className="text-sm text-amber-50/90">
                    You have not linked your Google account yet. Click the connect button above to
                    continue.
                  </p>
                </div>

                {status?.error ? (
                  <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
                    {status.error}
                  </div>
                ) : null}
              </div>
            )}
          </section>

          <aside className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
            <h2 className="text-xl font-semibold">Coming next</h2>
            <p className="mt-2 text-sm text-white/65">
              This page is the base for the full admin email system.
            </p>

            <div className="mt-5 space-y-3">
              {[
                "Send single emails from the portal",
                "Create email templates for forms and competitions",
                "Keep an email history log",
                "Send test emails",
                "Add bulk email tools for approved contacts",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/80"
                >
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 p-4 text-sm text-fuchsia-100">
              Once the Google account is connected, the next step is building the send email form
              and Gmail sending route.
            </div>

            <div className="mt-6">
              <Link
                href="/Admin/Dashboard"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15"
              >
                Back to dashboard
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}