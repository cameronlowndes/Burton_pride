"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const AUDIT_API = "/api/admin/audit-log";

function shouldTrackPath(pathname: string | null) {
  const path = String(pathname || "").toLowerCase();

  if (!path.startsWith("/admin")) return false;
  if (path.startsWith("/admin/login")) return false;
  if (path.startsWith("/admin/logout")) return false;

  return true;
}

function getAreaFromPath(pathname: string) {
  const path = pathname.toLowerCase();

  if (path.includes("/moneymanagement") || path.includes("/money")) return "money";
  if (path.includes("/email")) return "email";
  if (path.includes("/burtonprideeventhub")) return "event_hub";
  if (path.includes("/dashboard/users")) return "admin_users";
  if (path.includes("/dashboard/logs")) return "audit_logs";
  if (path.includes("/dashboard/donations")) return "donations";
  if (path.includes("/dashboard/raffle")) return "raffle";
  if (path.includes("/dashboard")) return "dashboard";

  return "admin_portal";
}

function sendAuditLog(payload: Record<string, unknown>) {
  const body = JSON.stringify(payload);

  if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    const blob = new Blob([body], { type: "application/json" });
    const sent = navigator.sendBeacon(AUDIT_API, blob);

    if (sent) return;
  }

  void fetch(AUDIT_API, {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body,
  }).catch(() => null);
}

export default function AdminAuditTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const lastTrackedRef = useRef("");

  const route = useMemo(() => {
    const query = searchParams?.toString();
    return query ? `${pathname}?${query}` : String(pathname || "");
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!shouldTrackPath(pathname)) return;
    if (!route) return;
    if (lastTrackedRef.current === route) return;

    lastTrackedRef.current = route;

    sendAuditLog({
      action: "page_view",
      area: getAreaFromPath(route),
      route,
      method: "CLIENT",
      status: "success",
      riskLevel: "low",
      metadata: {
        title: typeof document !== "undefined" ? document.title : null,
        screenWidth: typeof window !== "undefined" ? window.innerWidth : null,
        screenHeight: typeof window !== "undefined" ? window.innerHeight : null,
      },
    });
  }, [pathname, route]);

  return null;
}
