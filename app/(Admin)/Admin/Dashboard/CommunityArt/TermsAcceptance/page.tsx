import type { Metadata } from "next";

import CommunityArtTermsAcceptanceClient from "../../../components/Dashboard/CommunityArt/CommunityArtTermsAcceptanceClient";

export const metadata: Metadata = {
  title: "Community Art Terms Acceptance",
  description:
    "Restricted Burton Pride Admin Portal page for reviewing Community Art declarations and permissions.",
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

export default function CommunityArtTermsAcceptancePage() {
  return <CommunityArtTermsAcceptanceClient />;
}