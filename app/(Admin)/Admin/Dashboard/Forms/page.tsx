import type { Metadata } from "next";

import AdminFormsDashboardClient from "../../components/Dashboard/Forms/AdminFormsDashboardClient";

export const metadata: Metadata = {
  title: "Forms Dashboard",
  description:
    "Restricted Burton Pride Admin Portal page for accessing website forms and reviewing responses.",
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

export default function FormsDashboardPage() {
  return <AdminFormsDashboardClient />;
}