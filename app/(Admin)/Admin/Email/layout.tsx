import type { ReactNode } from "react";
import EmailSidebar from "../components/rooting/EmailSidebar";

export default function AdminEmailLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <EmailSidebar>{children}</EmailSidebar>;
}