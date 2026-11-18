import Link from "next/link";
import type { Metadata } from "next";
import { requireModerationOperationScreen } from "@/lib/moderation/access";
import BackfillClient from "../../components/SocialMediaModeration/client/BackfillClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Recover missed comments | Burton Pride Admin",
  robots: { index: false, follow: false } };
export default async function Page() {
  await requireModerationOperationScreen("createManual");
  return <main className="w-full min-w-0 space-y-6 px-4 py-8 text-white sm:px-6">
    <div>
      <Link href="/Admin/SocialMediaModeration/JobsID" className="text-sm text-fuchsia-200 hover:underline">← Back to Jobs</Link>
      <h1 className="mt-3 text-3xl font-bold">Recover missed comments</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
        Scan comments on your configured Facebook Page or Instagram professional account.
        The scan saves one page at a time and can be resumed. It does not prove every old
        post is covered: choose a specific post or media ID for older content.
      </p>
    </div>
    <BackfillClient />
  </main>;
}
