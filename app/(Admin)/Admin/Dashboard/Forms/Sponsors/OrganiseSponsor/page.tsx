import type { Metadata } from "next";

import SponsorOrderClient from "../../../../components/Dashboard/Forms/Sponsor/SponsorOrderClient";

export const metadata: Metadata = {
  title: "Manage Sponsor Order",
  description:
    "Restricted Burton Pride Admin Portal page for organising, creating, editing and exporting approved sponsors.",
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

export default function SponsorOrderPage() {
  return <SponsorOrderClient />;
}