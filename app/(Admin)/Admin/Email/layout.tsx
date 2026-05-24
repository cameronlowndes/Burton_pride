"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import EmailSidebar from "../components/rooting/EmailSidebar";

export default function AdminEmailLayout({
  children,
}: {
  children: ReactNode;
}) {
  useEffect(() => {
    document.title = "Burton Pride Emailing APP";
  }, []);

  return <EmailSidebar>{children}</EmailSidebar>;
}