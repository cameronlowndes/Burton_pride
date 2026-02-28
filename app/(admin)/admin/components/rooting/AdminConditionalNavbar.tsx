"use client";

import { usePathname } from "next/navigation";
import AdminSidebar from "./AdminSidebar";

export default function AdminConditionalNavbar() {
  const pathname = usePathname();

  // show only on dashboard routes
  if (!pathname?.startsWith("/admin/dashboard")) return null;

  return <AdminSidebar />;
}
