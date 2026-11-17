"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

/** Complements server guards: removes an open workspace after failed revalidation. */
export default function ModerationSessionBoundary({ children, initialFingerprint }: { children: ReactNode; initialFingerprint: string }) {
  const router = useRouter();
  const fingerprint = useRef(initialFingerprint);
  const pending = useRef<AbortController | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { fingerprint.current = initialFingerprint; }, [initialFingerprint]);
  const check = useCallback(async () => {
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    const timeout = window.setTimeout(() => controller.abort("timeout"), 12000);
    try {
      const response = await fetch("/api/admin/social-media-moderation/access", { cache: "no-store", credentials: "include", signal: controller.signal });
      if (pending.current !== controller || controller.signal.aborted) return;
      if (response.status === 401 || response.status === 403) {
        setBlocked(true); setMessage("Your moderation session or access changed. Sign in again or ask a Main Admin to check your permissions.");
        router.replace(response.status === 401 ? "/Admin/Login?next=%2FAdmin%2FSocialMediaModeration%2FHome" : "/Admin/ModerationAccessDenied");
        return;
      }
      const body = await response.json() as { ok?: boolean; fingerprint?: string };
      if (pending.current !== controller || controller.signal.aborted) return;
      if (!response.ok || !body?.ok || typeof body.fingerprint !== "string") throw new Error("Your secure access could not be confirmed. Try again.");
      if (body.fingerprint !== fingerprint.current) { fingerprint.current = body.fingerprint; router.refresh(); }
      setBlocked(false); setMessage("");
    } catch {
      if (pending.current !== controller || controller.signal.reason === "unmount") return;
      setBlocked(true); setMessage("Your secure access could not be confirmed. Check your connection and try again.");
    } finally { window.clearTimeout(timeout); }
  }, [router]);
  useEffect(() => {
    const focus = () => { void check(); };
    const timer = window.setInterval(focus, 30000);
    window.addEventListener("focus", focus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", focus); pending.current?.abort("unmount"); pending.current = null; };
  }, [check]);
  if (blocked) return <section role="alert" className="w-full space-y-4 p-6 text-white"><h2 className="text-xl font-bold">Moderation access needs checking</h2><p>{message}</p><button type="button" onClick={() => void check()} className="min-h-11 rounded-xl border px-4 py-2">Check access again</button><a href="/Admin/Login" className="ml-4 underline">Sign in again</a></section>;
  return children;
}
