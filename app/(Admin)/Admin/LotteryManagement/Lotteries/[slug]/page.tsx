import type { Metadata } from "next";
import LotteryDetailClient from "../../../components/LotteryManagement/Lotteries/LotteryDetailClient";

export const metadata: Metadata = {
  title: "Lottery Details | Burton Pride Admin",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
  referrer: "no-referrer",
};

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function LotteryDetailPage({
  params,
}: PageProps) {
  const { slug } = await params;

  return <LotteryDetailClient slug={slug} />;
}