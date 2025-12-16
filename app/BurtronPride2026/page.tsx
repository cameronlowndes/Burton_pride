import type { Metadata } from "next";
import BurtonPrideClient2026 from "../components/Client/BurtonPrideClient2026";

export const metadata: Metadata = {
  title: "Burton Pride 2026",
  description:
    "Join the Burton Pride volunteer team and help create a safe, inclusive, and unforgettable Pride event.",
  openGraph: {
    title: "Volunteer with Burton Pride 2026",
    description:
      "Be part of the Burton Pride volunteer team and help make Pride 2026 amazing.",
    siteName: "Burton Pride",
    type: "website",
  },
};

export default function VolunteerPage() {
  return <BurtonPrideClient2026 />;
}
