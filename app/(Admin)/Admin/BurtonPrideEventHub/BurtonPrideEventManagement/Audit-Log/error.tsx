"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function EventHubAuditLogError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-[#100918] p-5 text-white">
      <div className="w-full max-w-xl rounded-[28px] border border-red-300/20 bg-red-500/10 p-6 text-center shadow-2xl">
        <AlertTriangle className="mx-auto h-10 w-10 text-red-200" />
        <h2 className="mt-4 text-2xl font-black">Event Hub Audit Log could not open</h2>
        <p className="mt-2 text-sm leading-6 text-red-50/70">
          {error.message || "An unexpected page error occurred."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-red-100 px-4 py-2.5 text-sm font-black text-red-950"
        >
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      </div>
    </div>
  );
}
