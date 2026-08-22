import type { Metadata } from "next";

import DashboardHub from "../components/event-hub/DashboardPage";

export const metadata: Metadata = {
  title: "Dashboard For Event Hub | Burton Pride Admin",
  description:
    "This page allows you to manage and view contacts within the Burton Pride Admin Event Hub.",

  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function DocumentsPage() {
  return <DashboardHub />;
}