import type { Metadata } from "next";

import SocialMedia from "../../../../components/Dashboard/Settings/PageEditor/SocialMediaModerationSidebarAdminPage";

export const metadata: Metadata = {
  title: "Social Media Moderation Sidebar | Burton Pride Admin Portal",
  description:
    "Restricted Burton Pride Admin Portal page for setting up and managing the navigation bar content and layout.",
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

export default function SocialMediaPage() {
  return <SocialMedia />;
}