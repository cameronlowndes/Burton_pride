import type { Metadata } from "next";

import VolunteerAdminListClient from "../../../../components/Dashboard/Forms/Volunteer/VolunteerAdminListClient";

export const metadata: Metadata = {
  title: "Volunteer Applications List",
  description:
    "Restricted Burton Pride Admin Portal page for reviewing, creating, editing, filtering and exporting volunteer applications.",
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

export default function VolunteerApplicationsListPage() {
  return <VolunteerAdminListClient />;
}