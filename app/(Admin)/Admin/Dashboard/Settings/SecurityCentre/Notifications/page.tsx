import type { Metadata } from "next";

import LoginHistoryClient from "../../../../components/Dashboard/Settings/security/Notifications";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Security Notifications ",
  description:
    "Review Burton Pride Admin Portal security notifications, MFA status, device information, approximate location and security risk.",
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

export default function LoginHistoryPage() {
  return <LoginHistoryClient />;
}