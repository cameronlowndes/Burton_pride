import type { Metadata } from "next";

import AdminDashboardClient from "../components/LotteryManagement/Dashboard/DashboardPage";

export const metadata: Metadata = {
  title: "Lottery Dashboard",
  description: "Restricted Burton Pride administration dashboard For running the Lottery.",

  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function AdminDashboardPage() {
  return <AdminDashboardClient />;
}