import type { Metadata } from "next";
import ComplianceClient from "../../components/LotteryManagement/Compliance/ComplianceClient";

export const metadata: Metadata = {
  title: "Compliance | Burton Pride Lottery Management",
  robots: {
    index: false,
    follow: false,
  },
  referrer: "no-referrer",
};

export default function CompliancePage() {
  return <ComplianceClient />;
}
