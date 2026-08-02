import type { Metadata } from "next";

import AuthenticatorSetupClient from "../../../../components/Dashboard/Settings/PageEditor/MoneySidebarAdminClient";

export const metadata: Metadata = {
  title: "Money Sidebar Manager",
  description:
    "Restricted Burton Pride Admin Portal page for setting up and managing the money sidebar content and layout.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      nositelinkssearchbox: true,
      "max-image-preview": "none",
      "max-snippet": 0,
      "max-video-preview": 0,
    },
  },
  referrer: "no-referrer",
};

export default function AuthenticatorSetupPage() {
  return <AuthenticatorSetupClient />;
}