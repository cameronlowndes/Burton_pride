import type { Metadata } from "next";
import PrizesClient from "../../components/LotteryManagement/Prizes/PrizesClient";

export const metadata: Metadata = {
  title: "Prizes | Burton Pride Admin",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  referrer: "no-referrer",
};

export default function PrizesPage() {
  return <PrizesClient />;
}