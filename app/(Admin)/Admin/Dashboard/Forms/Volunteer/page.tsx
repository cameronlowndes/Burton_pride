import type { Metadata } from "next";

import VolunteerApplicationsClient from "../../../components/Dashboard/Forms/Volunteer/VolunteerApplicationsClient";

export const metadata: Metadata = {
  title: "Volunteer Applications",
  description:
    "Restricted Burton Pride Admin Portal page for reviewing and managing volunteer applications.",
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

export default function VolunteerApplicationsPage() {
  return <VolunteerApplicationsClient />;
}