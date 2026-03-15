"use client";

import { usePathname } from "next/navigation";
import AdminSidebar from "./AdminSidebar";

export default function AdminConditionalNavbar() {
  const pathname = usePathname();

  const normalisedPath = pathname?.toLowerCase() || "";

  if (!normalisedPath.startsWith("/admin/dashboard")) return null;

  return <AdminSidebar />;
}