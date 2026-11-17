import { requireModerationScreen } from "@/lib/moderation/access";

import type { Metadata } from "next";

import TermsPage from "../../components/SocialMediaModeration/client/TermsPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Terms and Conditions for Burton Pride Social Media Moderation App",
  description:
    "Terms and conditions for the Burton Pride Social Media Moderation app.",

  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default async function TermsPageClient({
  searchParams,
}: {
  searchParams: Promise<{
    version?: string;
    result?: string;
  }>;
}) {
  await requireModerationScreen();
  return <TermsPage searchParams={searchParams} />;
}
