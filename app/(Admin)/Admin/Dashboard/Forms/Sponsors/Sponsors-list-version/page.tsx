import type { Metadata } from "next";

import SponsorAdminListClient from "../../../../components/Dashboard/Forms/Sponsor/SponsorAdminListClient";

export const metadata: Metadata = {
  title: "Sponsor Applications List",
  description:
    "Restricted Burton Pride Admin Portal page for reviewing, filtering and exporting sponsor applications.",
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

export default function SponsorApplicationsListPage() {
  return <SponsorAdminListClient />;
}