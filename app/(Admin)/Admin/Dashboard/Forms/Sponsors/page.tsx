import type { Metadata } from "next";

import SponsorApplicationsClient from "../../../components/Dashboard/Forms/Sponsor/SponsorApplicationsClient";

export const metadata: Metadata = {
  title: "Sponsor Applications",
  description:
    "Restricted Burton Pride Admin Portal page for reviewing and managing sponsor applications.",
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

export default function SponsorApplicationsPage() {
  return <SponsorApplicationsClient />;
}