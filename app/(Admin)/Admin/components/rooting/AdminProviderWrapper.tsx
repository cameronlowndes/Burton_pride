"use client";

import { AdminProvider } from "@/src/contexts/AdminContext";

export default function AdminProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminProvider>{children}</AdminProvider>;
}