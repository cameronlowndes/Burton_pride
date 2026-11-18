import Link from "next/link";
import { requireModerationScreen } from "@/lib/moderation/access";
import type { Metadata } from "next";
import JobID from "../../components/SocialMediaModeration/JobsID/page";
type Query = { [key: string]: string | string[] | undefined };
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Jobs ID Page For Burton Pride Social Media Moderation App",
  description: "Jobs ID page for the Burton Pride Social Media Moderation app.",
  robots: { index: false, follow: false, nocache: true },
};
export default async function JobsIDPage({ searchParams }: { searchParams?: Promise<Query> }) {
  const actor = await requireModerationScreen();
  const resolvedSearchParams = ((await searchParams) ?? {}) as Query;
  return <>
    {actor.role === "main_admin" && <div className="px-4 pt-4 sm:px-6">
      <Link href="/Admin/SocialMediaModeration/Backfill" className="inline-flex min-h-11 items-center rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/10 px-4 text-sm font-semibold text-fuchsia-100 hover:bg-fuchsia-500/20">
        Recover missed comments
      </Link>
    </div>}
    <JobID searchParams={Promise.resolve(resolvedSearchParams)} />
  </>;
}
