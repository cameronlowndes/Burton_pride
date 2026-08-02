import type { Metadata } from "next";

import WindowsOfHopeVotesClient from "../../../components/Dashboard/WindowsOfHope/WindowsOfHopeVotesClient";

export const metadata: Metadata = {
  title: "Windows of Hope Votes",
  description:
    "Restricted Burton Pride Admin Portal page for reviewing Windows of Hope votes, voter details and the competition leaderboard.",
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

export default function WindowsOfHopeVotesPage() {
  return <WindowsOfHopeVotesClient />;
}