import type { Metadata } from "next";
import DashboardClient from "../components/LotteryManagement/Dashboard/DashboardPage";

export const metadata: Metadata = {
  title: "Dashboard | Burton Pride Lottery Management",
  robots: {
    index: false,
    follow: false,
  },
  referrer: "no-referrer",
};

export default function DashboardPage() {
  return <DashboardClient />;
}
