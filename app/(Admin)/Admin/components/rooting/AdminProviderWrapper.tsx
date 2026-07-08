"use client";

import type { ReactNode } from "react";

import { AdminProvider } from "@/src/contexts/AdminContext";

type AdminProviderWrapperProps = {
  children: ReactNode;
};

export default function AdminProviderWrapper({
  children,
}: AdminProviderWrapperProps) {
  return <AdminProvider>{children}</AdminProvider>;
}