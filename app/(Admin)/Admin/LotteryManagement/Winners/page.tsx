import type { Metadata } from "next";
import WinnersClient from "../../components/LotteryManagement/Winners/WinnersClient";

export const metadata: Metadata = {
  title: "Winners | Burton Pride Lottery Management",
  robots: {
    index: false,
    follow: false,
  },
  referrer: "no-referrer",
};

export default function WinnersPage() {
  return <WinnersClient />;
}
