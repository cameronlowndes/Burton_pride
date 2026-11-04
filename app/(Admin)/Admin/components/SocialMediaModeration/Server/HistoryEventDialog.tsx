"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

export default function HistoryEventDialog({ closeHref, children }: {
  closeHref: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    const element = dialog.current;
    if (!element || element.open) return;
    element.showModal();
    return () => element.close();
  }, []);

  function dismiss() {
    router.replace(closeHref, { scroll: false });
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="event-detail-heading"
      onCancel={event => { event.preventDefault(); dismiss(); }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto border border-white/15 bg-slate-950 p-0 text-white backdrop:bg-slate-950/80 sm:m-auto sm:h-fit sm:max-h-[85dvh] sm:max-w-2xl sm:rounded-2xl sm:shadow-2xl"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-white/15 bg-slate-950 px-5 py-2">
        <p className="text-sm font-semibold text-purple-200">History event</p>
        <button type="button" onClick={dismiss} className="min-h-11 rounded-lg border border-white/20 px-4 text-sm font-semibold hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-300">
          Close
        </button>
      </div>
      {children}
    </dialog>
  );
}
