"use client";

import { AlertTriangle, Lock, Trash2, X } from "lucide-react";

type HidePaymentModalProps = {
  open: boolean;
  deleting: boolean;
  lockReason?: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

export default function HidePaymentModal({
  open,
  deleting,
  lockReason = "",
  onCancel,
  onConfirm,
}: HidePaymentModalProps) {
  if (!open) return null;

  const locked = Boolean(lockReason);

  async function handleConfirm() {
    if (locked || deleting) return;
    await onConfirm();
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[1.8rem] border border-white/15 bg-[#080817] p-6 shadow-2xl shadow-black sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-white">Hide payment?</h2>
            <p className="mt-3 text-sm leading-6 text-white/70">
              Are you sure you want to hide this transaction? It will be soft
              deleted and hidden from the money tracker, totals, Excel exports,
              and print reports.
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl bg-white/10 p-2 text-white/70 transition hover:bg-white/20 hover:text-white"
            aria-label="Close hide payment popup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {locked ? (
          <div className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-black">This payment cannot be hidden</p>
                <p className="mt-1 font-semibold">{lockReason}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
            This will not permanently remove the transaction from Supabase. It
            will only mark it as deleted and hide it from this page.
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={locked || deleting}
            title={locked ? lockReason : "Hide payment"}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-500 px-5 py-3 text-sm font-black text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-red-500/30 disabled:text-white/45 disabled:opacity-60"
          >
            {locked ? (
              <Lock className="h-4 w-4" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {locked ? "Payment locked" : deleting ? "Hiding..." : "Hide Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
