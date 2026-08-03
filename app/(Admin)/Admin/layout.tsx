import type { Metadata } from "next";
import type { ReactNode } from "react";

import AdminLayoutBoundary from "./AdminLayoutClient";

export const metadata: Metadata = {
  title: {
    default: "Burton Pride Admin Portal",
    template: "%s | Burton Pride Admin Portal",
  },
  description: "Restricted Burton Pride administration area.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      nositelinkssearchbox: true,
      "max-image-preview": "none",
      "max-snippet": 0,
      "max-video-preview": 0,
    },
  },
  referrer: "no-referrer",
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <AdminLayoutBoundary>
      {children}
    </AdminLayoutBoundary>
  );
}