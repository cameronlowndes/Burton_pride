import type { Metadata } from "next";

import DashboardHub from "../../components/event-hub/EventDocumentsPage";

export const metadata: Metadata = {
  title: "Documents Hub | Burton Pride Admin",
  description:
    "This page allows you to manage all documents within the Burton Pride Admin Event Hub.",

  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function DocumentsPage() {
  return <DashboardHub />;
}