import type { Metadata } from "next";
import LiveDrawClient from "../../../components/Client/LotteryManagement/LiveDrawClient";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  context: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await context.params;
  return {
    title: "Watch the live lottery draw | Burton Pride",
    robots: { index: true, follow: true },
    alternates: { canonical: `/Lottery/${encodeURIComponent(slug)}/LiveDraw` },
  };
}

export default async function LiveDrawPage(
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  return <LiveDrawClient slug={slug} />;
}
