"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer"; // change path to your actual Footer component

export default function ConditionalFooter() {
  const pathname = usePathname();

  // Hide on admin routes
  if (pathname?.startsWith("/admin")) return null;

  return <Footer />;
}
