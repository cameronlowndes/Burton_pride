
import type { Metadata } from "next";

import WelcomePageClient from "../components/money/WelcomePage/WelcomePageClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Welcome To Burton Pride Money Management App",
  description:
    "Welcome page for the Burton Pride Money Management app.",

  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function MoneyManagementWelcomePage() {
  return <WelcomePageClient />;
}