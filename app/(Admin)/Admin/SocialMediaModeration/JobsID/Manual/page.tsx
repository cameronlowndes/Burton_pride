import { requireModerationOperationScreen } from "@/lib/moderation/access";
import type { Metadata } from "next";
import { manualAdmin } from "@/lib/moderation/manual-jobs-server";
import { JOBS_PAGE } from "@/lib/moderation/manual-job-input";
import ManualJobForm from "../../../components/SocialMediaModeration/JobsID/ManualJobForm";
import { control, panel } from "../../../components/SocialMediaModeration/JobsID/manual-styles";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Create manual moderation job | Burton Pride Admin",
};
export default async function Page() {
  await requireModerationOperationScreen("createManual");
  let admin: Awaited<ReturnType<typeof manualAdmin>> = null,
    error = "";
  try {
    admin = await manualAdmin();
  } catch (e) {
    error = e instanceof Error ? e.message : "Manual jobs are unavailable.";
  }
  return (
    <main className="w-full min-w-0 space-y-6 px-4 py-6 text-white sm:px-6">
      <header>
        <p className="text-sm text-slate-300">Social Media Moderation · Jobs</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          Create manual job
        </h1>
        <p className="mt-2 max-w-3xl text-slate-300">
          Record a missed Facebook or Instagram comment for human review. The
          report stays clearly labelled as a manual capture and does not depend
          on the moderation server being online.
        </p>
      </header>
      {admin ? (
        <ManualJobForm adminId={admin.id} />
      ) : (
        <section className={panel}>
          <p role="alert">
            {error ||
              "Manual jobs require an active Main Admin security session. Sign in again if your session expired."}
          </p>
          <a
            className={control + " mt-4 inline-flex items-center"}
            href={JOBS_PAGE}
          >
            Back to Jobs
          </a>
        </section>
      )}
    </main>
  );
}

