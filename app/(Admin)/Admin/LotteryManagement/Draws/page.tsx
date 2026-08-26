import type { Metadata } from "next";
import DrawsClient from "../../components/LotteryManagement/Draws/DrawsClient";

export const metadata: Metadata = {
  title: "Draws | Burton Pride Lottery Management",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function DrawsPage() {
  return <DrawsClient />;
}
