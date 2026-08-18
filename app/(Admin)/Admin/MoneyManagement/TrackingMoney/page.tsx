import type { Metadata } from "next";

import TrackingMoney from "../../components/money/TrackingMoney/TrackingMoneyClient";

export const metadata: Metadata = {
  title: "Tracking Money   | Burton Pride Admin",
  description:
    "This page is the Tracking Money page.",

  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function DocumentsPage() {
  return <TrackingMoney />;
}