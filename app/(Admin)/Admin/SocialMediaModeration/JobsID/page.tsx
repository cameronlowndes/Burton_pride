
import type { Metadata } from "next";

import JobID from "../../components/SocialMediaModeration/client/JobsID";

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
  const resolvedSearchParams = ((await searchParams) ?? {}) as Query;

  return <JobID searchParams={Promise.resolve(resolvedSearchParams)} />;
}