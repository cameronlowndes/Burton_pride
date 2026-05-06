"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Lock, Loader2 } from "lucide-react";

type AccessStatus = {
  ok: boolean;
  showRelockButton?: boolean;
  pageId?: string;
  route?: string;
  error?: string;
};

export default function GlobalRelockPageButton() {
  const pathname = usePathname();
  const router = useRouter();

  const [showButton, setShowButton] = useState(false);
  const [pageRoute, setPageRoute] = useState("");
  const [checking, setChecking] = useState(true);
  const [locking, setLocking] = useState(false);
  const [error, setError] = useState("");

  async function checkAccessStatus() {
    try {
      setChecking(true);
      setError("");

      if (
        !pathname ||
        pathname.startsWith("/admin") ||
        pathname.startsWith("/api") ||
        pathname.startsWith("/page-status")
      ) {
        setShowButton(false);
        return;
      }

      const res = await fetch("/api/admin/site-pages/access-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          route: pathname,
        }),
      });

      const text = await res.text();

      let json: AccessStatus = { ok: false };

      try {
        json = text ? JSON.parse(text) : { ok: false };
      } catch {
        setShowButton(false);
        return;
      }

      if (!res.ok || !json.ok) {
        setShowButton(false);
        return;
      }

      setShowButton(Boolean(json.showRelockButton));
      setPageRoute(json.route || pathname);
    } catch {
      setShowButton(false);
    } finally {
      setChecking(false);
    }
  }

  async function handleRelock() {
    try {
      setLocking(true);
      setError("");

      const routeToLock = pageRoute || pathname;

      const res = await fetch("/api/admin/site-pages/lock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          route: routeToLock,
        }),
      });

      const text = await res.text();

      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        throw new Error("Lock API did not return JSON.");
      }

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to lock page again.");
      }

      router.replace(
        `/page-status?mode=locked&from=${encodeURIComponent(routeToLock)}`
      );
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to lock page again."
      );
    } finally {
      setLocking(false);
    }
  }

  useEffect(() => {
    checkAccessStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (checking || !showButton) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-2">
      {error ? (
        <div className="max-w-xs rounded-2xl border border-red-300/30 bg-red-500/90 px-4 py-3 text-sm font-semibold text-white shadow-xl">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleRelock}
        disabled={locking}
        className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-black/75 px-5 py-3 text-sm font-bold text-white shadow-2xl backdrop-blur-md transition hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {locking ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Locking...
          </>
        ) : (
          <>
            <Lock className="h-4 w-4" />
            Lock page again
          </>
        )}
      </button>
    </div>
  );
}