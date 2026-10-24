import type { Metadata } from "next";
import ReportsClient from "../../components/LotteryManagement/Reports/ReportsClient";

export const metadata: Metadata = {
  title: "Reports | Burton Pride Lottery Management",
  robots: {
    index: false,
    follow: false,
  },
  referrer: "no-referrer",
};

export default function ReportsPage() {
  return <ReportsClient />;
}
