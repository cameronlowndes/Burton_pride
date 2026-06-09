"use client";

import { useState } from "react";
import { RefreshCcw, X, AlertTriangle } from "lucide-react";

type WebsitePaymentsSyncCardProps = {
  syncing: boolean;
  message?: string | null;
  error?: unknown;
  onSync: () => void;
  DetailedErrorBox: React.ComponentType<{
    title: string;
    error: unknown;
  }>;
};

export default function WebsitePaymentsSyncCard({
  syncing,
  message,
  error,
  onSync,
  DetailedErrorBox,
}: WebsitePaymentsSyncCardProps) {
  const [showCheckWindow, setShowCheckWindow] = useState(false);

  const [syncTitle, setSyncTitle] = useState("Website payments sync");
  const [syncInfo, setSyncInfo] = useState(
    "Website payments are not synced automatically when this page loads. Use this button when you want to pull Stripe website payments into the money tracker, including donations, raffle, Windows of Hope, vendor fees, sponsorship and future payment types. Manual entries will stay separate."
  );

  function handleStartSync() {
    setShowCheckWindow(true);
  }

  function handleConfirmSync() {
    setShowCheckWindow(false);
    onSync();
  }

  return (
    <>
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white">{syncTitle}</h2>

            <p className="max-w-3xl text-sm text-white/65">{syncInfo}</p>
          </div>

          <button
            type="button"
            onClick={handleStartSync}
            disabled={syncing}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-400/30 bg-sky-500/10 px-4 py-2.5 text-sm font-semibold text-sky-100 shadow-lg shadow-sky-950/20 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            <RefreshCcw
              className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`}
            />

            {syncing ? "Syncing website payments..." : "Sync Website Payments"}
          </button>
        </div>

        {message ? (
          <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-100">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mt-4">
            <DetailedErrorBox
              title="Website payments sync error"
              error={error}
            />
          </div>
        ) : null}
      </section>

      {showCheckWindow ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-sky-300/20 bg-[#0b1020] p-5 text-white shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-amber-100">
                  <AlertTriangle className="h-4 w-4" />
                  Check before import
                </div>

                <h2 className="text-2xl font-black text-white">
                  Confirm website payment sync
                </h2>

                <p className="mt-2 text-sm leading-6 text-white/65">
                  Before importing, check the title and information below. If
                  anything is wrong, edit it here first.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCheckWindow(false)}
                className="rounded-2xl border border-white/10 bg-white/5 p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-white/80">
                  Title
                </span>

                <input
                  value={syncTitle}
                  onChange={(event) => setSyncTitle(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-sky-300/50"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-white/80">
                  Information
                </span>

                <textarea
                  value={syncInfo}
                  onChange={(event) => setSyncInfo(event.target.value)}
                  rows={6}
                  className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/35 focus:border-sky-300/50"
                />
              </label>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">
                  Preview
                </p>

                <h3 className="mt-2 text-lg font-black text-white">
                  {syncTitle || "Website payments sync"}
                </h3>

                <p className="mt-2 text-sm leading-6 text-white/65">
                  {syncInfo ||
                    "Website payments are not synced automatically when this page loads."}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowCheckWindow(false)}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmSync}
                disabled={syncing}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-400 px-5 py-3 text-sm font-black text-black transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCcw
                  className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`}
                />

                {syncing ? "Syncing..." : "Confirm & Import"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}