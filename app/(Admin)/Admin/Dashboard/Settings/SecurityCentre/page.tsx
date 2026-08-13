import type { Metadata } from "next";

import SecurityCentreClient from "../../../components/Dashboard/Settings/security/SecurityCentreClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Security Centre",
  description:
    "Burton Pride Admin Portal Security Centre for account protection, trusted devices, sessions and security activity.",
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

export default function SecurityCentrePage() {
  return <SecurityCentreClient />;
}
