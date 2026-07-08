"use client";

import { usePathname } from "next/navigation";
import AdminSidebar from "./AdminSidebar";

const DASHBOARD_PREFIX = "/admin/dashboard";

const BLOCKED_DASHBOARD_PATHS = [
  "/admin/dashboard/login",
  "/admin/dashboard/logout",
];

function cleanPath(pathname: string | null) {
  const path = String(pathname || "")
    .trim()
    .toLowerCase()
    .replace(/\/+$/, "");

  return path || "/";
}

function shouldShowDashboardSidebar(pathname: string | null) {
  const path = cleanPath(pathname);

  if (BLOCKED_DASHBOARD_PATHS.some((blocked) => path === blocked)) {
    return false;
  }

  return path === DASHBOARD_PREFIX || path.startsWith(`${DASHBOARD_PREFIX}/`);
}

export default function AdminConditionalNavbar() {
  const pathname = usePathname();

  if (!shouldShowDashboardSidebar(pathname)) return null;

  return <AdminSidebar />;
}