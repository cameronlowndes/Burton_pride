import type { Metadata } from "next";

import TrackingMoney from "../components/money/WelcomePage/WelcomePageClient";

export const metadata: Metadata = {
  title: "Welcome To Burton Pride Money Management App",
  description:
    "This page is Welcome page for the money management app for Burton Pride",

  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function DocumentsPage() {
  return <TrackingMoney />;
}