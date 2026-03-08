import type { Metadata } from "next";
import CompetitionTerms from "../../components/Client/CompetitionclientTerms";

export const metadata: Metadata = {
  title: "Windows Of Hope Competition 2026 – Terms & Conditions",
  description:
    "Read the official Terms & Conditions for the Burton Pride Windows Of Hope Competition 2026. Learn the rules, eligibility, judging criteria, and entry requirements.",
  openGraph: {
    title: "Windows Of Hope Competition 2026 – Terms & Conditions",
    description:
      "Official Terms & Conditions for the Burton Pride Windows Of Hope Competition 2026.",
    siteName: "Burton Pride",
    type: "website",
  },
};

export default function WindowsOfHopeTermsPage() {
  return <CompetitionTerms />;
}