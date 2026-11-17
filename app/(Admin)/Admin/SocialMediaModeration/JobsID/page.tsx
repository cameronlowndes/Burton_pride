import { requireModerationScreen } from "@/lib/moderation/access";

import type { Metadata } from "next";

import JobID from "../../components/SocialMediaModeration/JobsID/page";

type Query = {
  [key: string]: string | string[] | undefined;
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Jobs ID Page For Burton Pride Social Media Moderation App",
  description:
    "Jobs ID page for the Burton Pride Social Media Moderation app.",

  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default async function JobsIDPage({
  searchParams,
}: {
  searchParams?: Promise<Query>;
}) {
  await requireModerationScreen();
  const resolvedSearchParams = ((await searchParams) ?? {}) as Query;

  return <JobID searchParams={Promise.resolve(resolvedSearchParams)} />;
}
