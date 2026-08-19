
import type { Metadata } from "next";

import CashTracking from "../../../components/money/Clients/CashTracker/CashTrackerClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cash Tracking",
  description:
    "This is PAge for doing Cash pot day",

  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function CashTrackingPage() {
  return <CashTracking />;
}