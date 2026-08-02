import type { Metadata } from "next";

import ProfileSettingsClient from "../../../components/Dashboard/Settings/ProfileSettingsClient";

export const metadata: Metadata = {
  title: "Profile Settings",
  description:
    "Restricted Burton Pride Admin Portal page for managing the signed-in administrator profile and password.",
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

export default function ProfileSettingsPage() {
  return <ProfileSettingsClient />;
}