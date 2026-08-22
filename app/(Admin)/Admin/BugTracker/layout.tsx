import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    default: "Bug Tracker | Burton Pride Admin Portal",
    template: "%s | Burton Pride Admin Portal",
  },
  description:
    "Report, investigate and manage bugs across the Burton Pride platform.",
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

export default function BugTrackerLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div className="min-h-screen w-full bg-[#050816] text-white">
      <div className="min-h-screen w-full">
        {children}
      </div>
    </div>
  );
}