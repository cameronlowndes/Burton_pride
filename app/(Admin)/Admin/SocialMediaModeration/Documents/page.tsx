
import type { Metadata } from "next";

import DocumentServerPage from "../../components/SocialMediaModeration/Server/Documents/DocumentsServer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Documents for Burton Pride Social Media Moderation App",
  description:
    "Documents for the Burton Pride Social Media Moderation app.",

  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default async function DocumentServerPageServer({
  searchParams,
}: {
  searchParams: Promise<{ job?: string; result?: string }>;
}) {
  return <DocumentServerPage searchParams={searchParams} />;
}