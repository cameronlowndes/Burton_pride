import type { Metadata } from "next";

import AdminEventsClient from "../../components/Dashboard/AdminEventsClient";

export const metadata: Metadata = {
  title: "Events Manager",
  description:
    "Restricted Burton Pride Admin Portal page for creating and managing events.",
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

export default function EventsPage() {
  return <AdminEventsClient />;
}