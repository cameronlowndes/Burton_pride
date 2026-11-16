"use client";
import {
  useEffect,
  useRef,
  useState,
  useId,
  type MutableRefObject,
} from "react";
import { control } from "./manual-styles";
export default function ManualDraftGuard({
  dirty,
  allowLeave,
}: {
  dirty: boolean;
  allowLeave: MutableRefObject<boolean>;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [destination, setDestination] = useState("");
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty && !allowLeave.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const intercept = (event: MouseEvent) => {
      if (
        !dirty ||
        allowLeave.current ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        !(event.target instanceof Element)
      )
        return;
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target === "_blank" || link.hasAttribute("download"))
        return;
      const target = new URL(link.href, window.location.href);
      if (target.href === window.location.href) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      opener.current = link;
      setDestination(target.href);
      dialog.current?.showModal();
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", intercept, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", intercept, true);
    };
  }, [dirty, allowLeave]);
  function keep() {
    dialog.current?.close();
    setDestination("");
    opener.current?.focus();
  }
  return (
    <dialog
      ref={dialog}
      onCancel={() => {
        setDestination("");
        opener.current?.focus();
      }}
      aria-labelledby={titleId}
      className="m-auto w-[min(92vw,34rem)] max-h-[85dvh] overflow-y-auto rounded-2xl border border-white/25 bg-slate-900 p-6 text-white backdrop:bg-black/70"
    >
      <h2 id={titleId} className="text-xl font-semibold">
        Leave unsaved work?
      </h2>
      <p className="mt-3 text-slate-300">
        Your current text will be lost. Keep editing or leave this page.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button autoFocus type="button" className={control} onClick={keep}>
          Keep editing
        </button>
        <button
          type="button"
          className={control}
          onClick={() => {
            if (destination) {
              allowLeave.current = true;
              window.location.assign(destination);
            }
          }}
        >
          Leave and discard changes
        </button>
      </div>
    </dialog>
  );
}
