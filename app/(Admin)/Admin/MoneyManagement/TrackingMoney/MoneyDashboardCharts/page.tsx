
import type { Metadata } from "next";

import Dashboard from "../../../components/money/Clients/MoneyDashboard/MoneyDashboardClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Money Dashboad",
  description:
    "Money Dashboard page",

  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function MoneyDashboardPage() {
  return <Dashboard />;
}