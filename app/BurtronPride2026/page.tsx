import type { Metadata } from "next";
import BurtonPrideClient2026 from "../components/Client/BurtonPrideClient2026";

export const metadata: Metadata = {
  title: "Burton Pride 2026",
  description:
    "Join us for Burton Pride 2026 and be part of this amazing event!",
  openGraph: {
    title: " Burton Pride 2026",
    description:
      "Join us for Burton Pride 2026 and be part of this amazing event!",
    siteName: "Burton Pride",
    type: "website",
  },
};

export default function BurtonPride2026() {
  return <BurtonPrideClient2026 />;
}
