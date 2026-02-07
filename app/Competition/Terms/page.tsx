import type { Metadata } from "next";
import CompetitionTerms from "../../components/Client/CompetitionclientTerms";

export const metadata: Metadata = {
  title: "Terms & Conditions For Windows Of Hope Competition 2026",
  description:
    "Join us for Burton Pride 2026 and be part of this amazing event!",
  openGraph: {
    title: "Burton Pride 2026",
    description:
      "Join us for Burton Pride 2026 and be part of this amazing event!",
    siteName: "Burton Pride",
    type: "website",
  },
};

export default function BurtonPride2026() {
  return <CompetitionTerms />;
}
