import type { Metadata } from "next";

import AdminRaffleClient from "../../components/Dashboard/AdminRaffleClient";

export const metadata: Metadata = {
  title: "Raffle Admin",
  description:
    "Restricted Burton Pride Admin Portal page for managing raffle entries, ticket printing, test data and official prize draws.",
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

export default function RaffleAdminPage() {
  return <AdminRaffleClient />;
}