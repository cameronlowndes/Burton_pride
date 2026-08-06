import type { Metadata } from "next";

import ApplicationsHub from "../../components/event-hub/ApplicationHub";

export const metadata: Metadata = {
  title: "Applications Hub | Burton Pride Admin",
  description:
    "Restricted Burton Pride Event Hub page for managing event applications, stalls, vendors, charities and Community Interest Companies.",

  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function ApplicationsHubPage() {
  return <ApplicationsHub />;
}