import type { Metadata } from "next";
import RaffleTerms from "../../components/Client/RaffleTremsClient";

export const metadata: Metadata = {
  title: "Burton Pride Raffle 2026 – Terms & Conditions",
  description:
    "Read the official Terms & Conditions for the Burton Pride Raffle 2026. Learn about raffle rules, ticket payments, winner announcements, data protection, and entry requirements.",
  openGraph: {
    title: "Burton Pride Raffle 2026 – Terms & Conditions",
    description:
      "Official Terms & Conditions for the Burton Pride Raffle 2026.",
    siteName: "Burton Pride",
    type: "website",
  },
};

export default function BurtonPrideRaffleTermsPage() {
  return <RaffleTerms />;
}