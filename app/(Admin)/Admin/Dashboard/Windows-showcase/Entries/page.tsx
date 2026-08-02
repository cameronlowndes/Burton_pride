import type { Metadata } from "next";

import WindowsOfHopeEntriesClient from "../../../components/Dashboard/WindowsOfHope/WindowsOfHopeEntriesClient";

export const metadata: Metadata = {
  title: "Windows of Hope Entries",
  description:
    "Restricted Burton Pride Admin Portal page for reviewing and managing Windows of Hope competition entries.",
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

export default function WindowsOfHopeEntriesPage() {
  return <WindowsOfHopeEntriesClient />;
}