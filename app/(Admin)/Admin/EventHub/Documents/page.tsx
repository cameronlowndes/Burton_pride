import type { Metadata } from "next";

import EventDocumentsPage from "../../components/event-hub/EventDocumentsPage";

export const metadata: Metadata = {
  title: "Event Documents | Burton Pride Admin",
  description:
    "Restricted Burton Pride Event Hub page for managing event documents, insurance, licences, risk assessments and event plans.",

  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function DocumentsPage() {
  return <EventDocumentsPage />;
}