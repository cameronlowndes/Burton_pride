import type { Metadata } from "next";
import LotteriesClient from "../../components/LotteryManagement/Lotteries/LotteriesClient";

export const metadata: Metadata = {
  title: "Lotteries | Burton Pride Admin",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  referrer: "no-referrer",
};

export default function LotteriesPage() {
  return <LotteriesClient />;
}