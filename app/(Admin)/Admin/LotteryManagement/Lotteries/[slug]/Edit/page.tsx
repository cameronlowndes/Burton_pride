import type { Metadata } from "next";
import LotteryEdit from "../../../../components/LotteryManagement/Lotteries/LotteriesEditClient";

export const metadata: Metadata = {
  title: "Lottery Editor | Burton Pride Admin",
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

export default async function LotteryEditPage({
  params,
}: PageProps) {
  const { slug } = await params;

  return <LotteryEdit params={Promise.resolve({ id: slug })} />;
}