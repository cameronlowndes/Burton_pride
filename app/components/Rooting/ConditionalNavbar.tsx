"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";

export default function ConditionalNavbar() {
  const pathname = usePathname();

  // List paths where you want to hide the navbar
  const hideNavbarOnPaths = ["/PlanYourVist", "/another-path"];

  if (hideNavbarOnPaths.includes(pathname)) {
    return null; // Do not render navbar on these paths
  }

  return <Navbar />;
}
