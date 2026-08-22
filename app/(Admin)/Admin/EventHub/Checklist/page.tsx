import type { Metadata } from "next";

import ApplicationsHub from "../../components/event-hub/CheckListPage";

export const metadata: Metadata = {
  title: "Checklist Hub | Burton Pride Admin",
  description:
    "Restricted Burton Pride Event Hub page for managing event checklists for stalls, vendors, charities and Community Interest Companies.",

  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function DocumentsPage() {
  return <ApplicationsHub />;
}