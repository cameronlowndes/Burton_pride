import type { Metadata } from "next";

import ContactPage from "../../components/event-hub/ContactPge";

export const metadata: Metadata = {
  title: "Contacts Hub | Burton Pride Admin",
  description:
    "This page allows you to manage and view contacts within the Burton Pride Admin Event Hub.",

  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function DocumentsPage() {
  return <ContactPage />;
}