"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";

export default function ConditionalFooter() {
  const pathname = usePathname();

  // List paths where you want to hide the footer
  const hideFooterOnPaths = ["/PlanYourVist", "/another-path"];

  if (hideFooterOnPaths.includes(pathname)) {
    return null; // Hide footer on these paths
  }

  return <Footer />;
}
