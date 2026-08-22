import type { Metadata } from "next";

import TermsHub from "../../components/event-hub/TermsHubPage";

export const metadata: Metadata = {
  title: "Application Terms",
  description:
    "Manage Event Hub application terms and acceptance records.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function TermsHubPage() {
  return <TermsHub />;
}
