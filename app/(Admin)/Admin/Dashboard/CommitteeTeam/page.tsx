import type { Metadata } from "next";

import CommitteeStoryClient from "../../components/Dashboard/BurtonPrideCommittee";

export const metadata: Metadata = {
  title: "Committee Member Manager",
  description:
    "Restricted Burton Pride Admin Portal page for managing committee member profiles and stories.",
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
};

export default function CommitteeStoryPage() {
  return <CommitteeStoryClient />;
}