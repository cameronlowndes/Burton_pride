import { requireModerationScreen } from "@/lib/moderation/access";
import type { Metadata } from "next";

import HistoryPage from "../../components/SocialMediaModeration/client/HistoryPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "History For Burton Pride Social Media Moderation App",
  description: "History for the Burton Pride Social Media Moderation app.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

type HistoryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HistoryRoute({ searchParams }: HistoryPageProps) {
  await requireModerationScreen();
  return <HistoryPage searchParams={searchParams} />;
}
