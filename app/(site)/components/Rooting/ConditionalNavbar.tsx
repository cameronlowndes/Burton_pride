"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar"; // change path to your actual Navbar component

export default function ConditionalNavbar() {
  const pathname = usePathname();

  // Hide on admin routes
  if (pathname?.startsWith("/admin")) return null;

  return <Navbar />;
}
