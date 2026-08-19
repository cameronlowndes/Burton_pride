import type { Metadata } from "next";

import TrackingMoneyClient from "../../components/money/TrackingMoney/TrackingMoneyClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Tracking Money | Burton Pride Admin",
  description: "This page is the Burton Pride Tracking Money page.",

  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function TrackingMoneyPage() {
  return <TrackingMoneyClient />;
}