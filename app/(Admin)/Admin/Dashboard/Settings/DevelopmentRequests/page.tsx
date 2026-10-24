import type { Metadata } from "next";

import DevelopmentRequests from "../../../components/Dashboard/Settings/DevelopmentRequests/DevelopmentRequestsClient";

export const metadata: Metadata = {
  title: "Development Requests",
  description:
    "This page allow you to Request new development features for the public website or the Admin Portal",
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

export default function DevelopmentRequestsPage() {
  return <DevelopmentRequests />;
}