import type { Metadata } from "next";

import AdminDonationsClient from "../../components/Dashboard/AdminDonationsClient";

export const metadata: Metadata = {
  title: "Donations Manager",
  description:
    "Restricted Burton Pride Admin Portal page for managing donations, monthly supporters and supporter wall records.",
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

export default function DonationsPage() {
  return <AdminDonationsClient />;
}