import type { Metadata } from "next";

import AdminDashboardClient from "../components/Dashboard/AdminDashboardClient";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Restricted Burton Pride administration dashboard.",

  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function AdminDashboardPage() {
  return <AdminDashboardClient />;
}