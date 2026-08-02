import type { Metadata } from "next";

import AdminFeedbackClient from "../../../components/Dashboard/Forms/AdminFeedbackClient";

export const metadata: Metadata = {
  title: "Feedback Management",
  description:
    "Restricted Burton Pride Admin Portal page for reviewing and managing website feedback submissions.",
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

export default function FeedbackManagementPage() {
  return <AdminFeedbackClient />;
}