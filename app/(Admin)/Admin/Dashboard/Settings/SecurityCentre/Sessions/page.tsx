import type { Metadata } from "next";

import SessionsClient from "../../../../components/Dashboard/Settings/security/SessionsClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Active Sessions | Burton Pride Admin Portal",
  description:
    "Review Burton Pride Admin Portal session security, MFA state, presence checks and trusted-device information.",
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

export default function SessionsPage() {
  return <SessionsClient />;
}