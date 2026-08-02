import type { Metadata } from "next";

import AdminCommunityArtPage from "../../components/Dashboard/CommunityArt/AdminCommunityArtPage";

export const metadata: Metadata = {
  title: "Community Art Manager",
  description:
    "Restricted Burton Pride Admin Portal page for managing Community Art submissions.",

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

export default function Page() {
  return <AdminCommunityArtPage />;
}