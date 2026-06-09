"use client";

import { useState } from "react";
import { AlertTriangle, RefreshCcw, X } from "lucide-react";

type ImportPreviewItem = {
  id?: string;
  title?: string;
  name?: string;
  type?: string;
  amount?: number | string;
  date?: string;
  email?: string;
  status?: string;
};

type WebsitePaymentsSyncCardProps = {
  syncing: boolean;
  previewing?: boolean;
  message?: string | null;
  error?: unknown;
  previewItems?: ImportPreviewItem[];
  onPreview: () => void;
  onSync: () => void;
  DetailedErrorBox: React.ComponentType<{
    title: string;
    error: unknown;
  }>;
};

export default function WebsitePaymentsSyncCard({
  syncing,
  previewing = false,
  message,
  error,
  previewItems = [],
  onPreview,
  onSync,
  DetailedErrorBox,
}: WebsitePaymentsSyncCardProps) {
  const [showPreviewWindow, setShowPreviewWindow] = useState(false);

  function openPreviewWindow() {
    setShowPreviewWindow(true);
    onPreview();
  }

  function confirmImport() {
    setShowPreviewWindow(false);
    onSync();
  }

  return (
    <>
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white">
              Website payments sync
            </h2>

            <p className="max-w-3xl text-sm text-white/65">
              Preview website payments before importing them into the money
              tracker. You can check the data first, then confirm the import.
            </p>
          </div>

          <button
            type="button"
            onClick={openPreviewWindow}
            disabled={syncing || previewing}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-400/30 bg-sky-500/10 px-4 py-2.5 text-sm font-semibold text-sky-100 shadow-lg shadow-sky-950/20 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            <RefreshCcw
              className={`h-4 w-4 ${
                syncing || previewing ? "animate-spin" : ""
              }`}
            />
            {previewing ? "Loading preview..." : "Preview Website Payments"}
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

      {showPreviewWindow ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-sky-300/20 bg-[#0b1020] p-5 text-white shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-amber-100">
                  <AlertTriangle className="h-4 w-4" />
                  Check before import
                </div>

                <h2 className="text-2xl font-black text-white">
                  Confirm website payments import
                </h2>

                <p className="mt-2 text-sm leading-6 text-white/65">
                  Check every payment below. Only click confirm if the data
                  looks right.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowPreviewWindow(false)}
                className="rounded-2xl border border-white/10 bg-white/5 p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {previewing ? (
              <div className="rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4 text-sm font-bold text-sky-100">
                Loading website payments preview...
              </div>
            ) : previewItems.length === 0 ? (
              <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm font-bold text-amber-100">
                No website payments found to import.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-white/10">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead className="bg-white/10 text-xs uppercase tracking-[0.14em] text-white/55">
                    <tr>
                      <th className="px-4 py-3">Title</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-white/10">
                    {previewItems.map((item, index) => (
                      <tr key={item.id || index} className="bg-white/[0.03]">
                        <td className="px-4 py-3 font-bold text-white">
                          {item.title || item.name || "Untitled payment"}
                        </td>
                        <td className="px-4 py-3 text-white/70">
                          {item.type || "Website payment"}
                        </td>
                        <td className="px-4 py-3 font-bold text-emerald-100">
                          {item.amount || "£0.00"}
                        </td>
                        <td className="px-4 py-3 text-white/70">
                          {item.date || "No date"}
                        </td>
                        <td className="px-4 py-3 text-white/70">
                          {item.email || "No email"}
                        </td>
                        <td className="px-4 py-3 text-white/70">
                          {item.status || "Ready"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowPreviewWindow(false)}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmImport}
                disabled={syncing || previewing || previewItems.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-400 px-5 py-3 text-sm font-black text-black transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCcw
                  className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`}
                />
                {syncing ? "Importing..." : "Confirm & Import"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}