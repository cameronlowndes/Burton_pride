"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export const NOTIFICATION_API = "/api/admin/notifications";
export const NOTIFICATIONS_CHANGED = "admin-notifications-changed";

export default function NotificationBell() {
  const pathname = usePathname();
  const [unread, setUnread] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    let request: AbortController | undefined;
    const refresh = async () => {
      request?.abort();
      const next = new AbortController();
      request = next;
      try {
        const response = await fetch(NOTIFICATION_API, { signal: next.signal, cache: "no-store" });
        const data = response.ok ? await response.json() : null;
        if (active && !next.signal.aborted) {
          setUnread(data?.enabled ? data.unreadCount : null);
        }
      } catch {
        if (active && !next.signal.aborted) setUnread(null);
      }
    };

    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30_000);
    window.addEventListener("focus", refresh);
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh);
    return () => {
      active = false;
      request?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(NOTIFICATIONS_CHANGED, refresh);
    };
  }, [pathname]);

  if (unread === null) return null;

  const source = pathname?.toLowerCase().startsWith("/admin/socialmediamoderation")
    ? "?source=moderation"
    : "";

  return (
    <div className="flex shrink-0 justify-end border-b border-white/10 bg-slate-950 px-4 py-1 text-white">
      <Link
        href={`/Admin/Notifications${source}`}
        aria-label={`Notifications, ${unread} unread`}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-300"
      >
        <Bell aria-hidden="true" size={18} />
        Notifications
        {unread > 0 && (
          <span aria-hidden="true" className="rounded-full bg-purple-200 px-2 text-xs text-slate-950">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Link>
    </div>
  );
}
