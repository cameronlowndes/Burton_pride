import type { Metadata } from "next";

import AdminContactClient from "../../../components/Dashboard/Forms/AdminContactClient";

export const metadata: Metadata = {
  title: "Contact Messages",
  description:
    "Restricted Burton Pride Admin Portal page for reviewing and managing website contact messages.",
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

export default function ContactMessagesPage() {
  return <AdminContactClient />;
}