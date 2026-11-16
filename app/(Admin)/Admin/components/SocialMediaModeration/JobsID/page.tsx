import type { Metadata } from "next";
import {
  db,
  evidenceAdmin,
  londonDate,
  PAGE as DOCUMENTS_PAGE,
  UUID,
} from "../Server/Documents/evidence";
import { manualSummaries } from "@/lib/moderation/manual-jobs-server";
import {
  cleanSourceUrl,
  JOBS_PAGE as PAGE,
  MANUAL_PAGE,
  reviewOutcomes,
} from "@/lib/moderation/manual-job-input";
import ManualReviewForm from "./ManualReviewForm";
import { panel, control } from "./manual-styles";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Moderation jobs | Burton Pride Admin",
};
const PAGE_SIZE = 25;
const STATUSES = {
  queued: "Queued",
  processing: "Processing",
  done: "Processing complete",
  failed: "Failed",
} as const;
const PLATFORMS = { facebook: "Facebook", instagram: "Instagram" } as const;
const ORIGINS = {
  automatic: "Automatic captures",
  manual: "Manual captures",
} as const;
type Query = {
  job?: string;
  status?: string;
  platform?: string;
  page?: string;
  origin?: string;
  created?: string;
};
type Job = {
  id: string;
  event_key: string;
  platform: string;
  comment_id: string;
  content: string;
  status: string;
  attempts: number;
  received_at: string | null;
  available_at: string | null;
  completed_at: string | null;
  last_error: string | null;
};
type Decision = {
  job_id: string;
  decision: string;
  action_status: string;
  reviewed_at: string | null;
};
function member<T extends object>(values: T, value: unknown): value is keyof T {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(values, value)
  );
}
function date(value: string | null) {
  if (!value) return "Not recorded";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "Time unavailable" : londonDate.format(d);
}
export default async function ModerationJobsPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  if (!(await evidenceAdmin()))
    return (
      <main className="p-6">
        <h1>Jobs are restricted to main admins</h1>
      </main>
    );
  const params = await searchParams;
  const jobId =
    typeof params.job === "string" ? params.job.trim().toLowerCase() : "";
  const validId = !jobId || UUID.test(jobId);
  const platform = member(PLATFORMS, params.platform) ? params.platform : "";
  const status = member(STATUSES, params.status) ? params.status : "";
  const origin = member(ORIGINS, params.origin) ? params.origin : "";
  const page =
    !jobId &&
    typeof params.page === "string" &&
    /^[1-9]\d{0,3}$/.test(params.page)
      ? Number(params.page)
      : 1;
  function pageLink(number: number) {
    const q = new URLSearchParams({ page: String(number) });
    if (platform) q.set("platform", platform);
    if (status) q.set("status", status);
    if (origin) q.set("origin", origin);
    return PAGE + "?" + q;
  }
  let query = db
    .from("moderation_jobs")
    .select(
      "id,event_key,platform,comment_id,content,status,attempts,received_at,available_at,completed_at,last_error",
    );
  if (jobId) query = query.eq("id", jobId);
  else {
    if (platform) query = query.eq("platform", platform);
    if (status) query = query.eq("status", status);
    if (origin === "manual") query = query.like("event_key", "manual:%");
    if (origin === "automatic")
      query = query.not("event_key", "like", "manual:%");
  }
  const from = (page - 1) * PAGE_SIZE;
  const result = validId
    ? await query
        .order("received_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + PAGE_SIZE)
    : null;
  const jobs = (result?.data?.slice(0, PAGE_SIZE) ?? []) as Job[];
  const [decisions, manual] = await Promise.all([
    jobs.length
      ? db
          .from("moderation_decisions")
          .select("job_id,decision,action_status,reviewed_at")
          .in(
            "job_id",
            jobs.map((j) => j.id),
          )
      : null,
    manualSummaries(
      jobs.filter((j) => j.event_key.startsWith("manual:")).map((j) => j.id),
    ),
  ]);
  const byJob = new Map(
    ((decisions?.data ?? []) as Decision[]).map((d) => [d.job_id, d]),
  );
  const byManual = new Map(manual.items.map((m) => [m.jobId, m]));
  return (
    <main className="w-full min-w-0 space-y-6 px-4 py-6 text-white sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-300">Social Media Moderation</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Jobs</h1>
          <p className="mt-2 max-w-3xl text-slate-300">
            Find captured Facebook or Instagram comments, track processing and
            review, or record a missed comment manually.
          </p>
        </div>
        <a
          href={MANUAL_PAGE}
          className={
            control + " inline-flex items-center bg-purple-500/20 font-semibold"
          }
        >
          Create manual job
        </a>
      </header>
      <section className={panel} aria-labelledby="job-search">
        <h2 id="job-search" className="text-lg font-semibold">
          Find a job
        </h2>
        <form
          noValidate
          action={PAGE}
          className="mt-3 flex flex-wrap items-end gap-3"
        >
          <label className="grid w-full gap-1 text-sm sm:max-w-md">
            Exact Job ID
            <input
              name="job"
              defaultValue={jobId}
              className={control}
              placeholder="Paste the Job ID from Documents"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Platform
            <select name="platform" defaultValue={platform} className={control}>
              <option value="">All platforms</option>
              {Object.entries(PLATFORMS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Processing status
            <select name="status" defaultValue={status} className={control}>
              <option value="">All statuses</option>
              {Object.entries(STATUSES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Capture source
            <select name="origin" defaultValue={origin} className={control}>
              <option value="">All captures</option>
              {Object.entries(ORIGINS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <button className={control}>Search</button>
          <a
            href={PAGE}
            className="inline-flex min-h-11 items-center px-2 text-sm underline"
          >
            Clear filters
          </a>
        </form>
        <p className="mt-3 text-sm text-slate-300">
          An exact Job ID takes priority over other filters. Processing complete
          does not mean human review is complete.
        </p>
      </section>
      <section aria-labelledby="saved-jobs">
        <h2 id="saved-jobs" className="mb-3 text-xl font-semibold">
          Saved jobs
        </h2>
        {!validId ? (
          <p className={panel} role="alert">
            Enter the full Job ID, including its hyphens.
          </p>
        ) : result?.error ? (
          <p className={panel} role="alert">
            Jobs could not be loaded. Refresh this page to try again.
          </p>
        ) : !jobs.length ? (
          <p className={panel}>
            {jobId ? "No job matches that ID." : "No jobs found on this page."}
          </p>
        ) : (
          <>
            {decisions?.error && (
              <p className="mb-3 text-amber-200" role="alert">
                Decision details are temporarily unavailable.
              </p>
            )}
            {manual.error && (
              <p className="mb-3 text-amber-200" role="alert">
                {manual.error}
              </p>
            )}
            <ul className="space-y-3">
              {jobs.map((job) => {
                const decision = byJob.get(job.id),
                  capture = byManual.get(job.id),
                  isManual = job.event_key.startsWith("manual:");
                let source = "";
                try {
                  if (capture?.sourceUrl && member(PLATFORMS, job.platform))
                    source = cleanSourceUrl(capture.sourceUrl, job.platform);
                } catch {
                  /* Display no unsafe URL. */
                }
                return (
                  <li key={job.id} className={panel}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold">
                          {member(PLATFORMS, job.platform)
                            ? PLATFORMS[job.platform]
                            : job.platform}{" "}
                          comment{isManual ? " · Manual capture" : ""}
                        </h3>
                        <p className="mt-1 break-all text-sm text-slate-300">
                          Job ID{" "}
                          <code className="select-all text-white">
                            {job.id}
                          </code>
                        </p>
                        <p className="mt-1 break-all text-sm text-slate-300">
                          {isManual
                            ? capture?.commentId
                              ? "Supplied comment ID (unverified): " +
                                capture.commentId
                              : "No real comment ID supplied. This is a reference-only capture."
                            : "Meta comment ID " + job.comment_id}
                        </p>
                      </div>
                      <span className="rounded-lg border border-white/20 px-3 py-1 text-sm">
                        {isManual
                          ? capture
                            ? capture.reviewedAt
                              ? "Review recorded"
                              : "Needs human review"
                            : "Manual details unavailable"
                          : member(STATUSES, job.status)
                            ? STATUSES[job.status]
                            : job.status}
                      </span>
                    </div>
                    {params.created === "1" && capture && (
                      <p
                        role="status"
                        className="mt-3 text-sm text-emerald-200"
                      >
                        Manual capture saved. No platform action was performed.
                      </p>
                    )}
                    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <dt className="text-slate-300">
                          {isManual ? "Captured" : "Received"}
                        </dt>
                        <dd>{date(job.received_at)}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-300">
                          {isManual ? "Capture source" : "Processing attempts"}
                        </dt>
                        <dd>
                          {isManual
                            ? "Administrator · No AI assessment"
                            : job.attempts}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-300">
                          {isManual
                            ? "Created by"
                            : job.status === "queued"
                              ? "Eligible to run from"
                              : "Completed"}
                        </dt>
                        <dd>
                          {isManual
                            ? (capture?.createdBy ?? "Unavailable")
                            : date(
                                job.status === "queued"
                                  ? job.available_at
                                  : job.completed_at,
                              )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-300">
                          {isManual ? "Human review" : "Moderation decision"}
                        </dt>
                        <dd>
                          {isManual
                            ? capture?.reviewedAt
                              ? "Recorded " + date(capture.reviewedAt)
                              : "Pending"
                            : decisions?.error
                              ? "Unavailable"
                              : decision?.reviewed_at
                                ? `${decision.decision} · Reviewed`
                                : (decision?.decision ?? "Not recorded")}
                        </dd>
                      </div>
                    </dl>
                    {!isManual &&
                      job.last_error &&
                      (job.status === "failed" || job.status === "queued") && (
                        <p className="mt-3 break-words text-sm text-amber-200">
                          Last processing error: {job.last_error}
                        </p>
                      )}
                    {capture && (
                      <section
                        className="mt-4 space-y-3 border-t border-white/15 pt-4"
                        aria-label="Manual capture details"
                      >
                        <blockquote className="whitespace-pre-wrap break-words rounded-xl bg-slate-950/70 p-4 text-sm">
                          {job.content}
                        </blockquote>
                        <p className="text-sm text-slate-300">
                          Administrator-supplied evidence. The app has not
                          verified this account, text or identifier against
                          Meta.
                        </p>
                        {capture.context && (
                          <p className="break-words text-sm">
                            <strong>Context: </strong>
                            {capture.context}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap break-words text-sm">
                          <strong>Reported reason: </strong>
                          {capture.reason}
                        </p>
                        {source && (
                          <a
                            href={source}
                            target="_blank"
                            rel="noopener noreferrer"
                            referrerPolicy="no-referrer"
                            className="inline-block text-sm text-purple-200 underline"
                          >
                            Open supplied source reference (new tab)
                          </a>
                        )}
                        {capture.relatedJobId && (
                          <p className="text-sm">
                            <a
                              className="text-purple-200 underline"
                              href={PAGE + "?job=" + capture.relatedJobId}
                            >
                              Open related automatic capture
                            </a>
                          </p>
                        )}
                        {capture.reviewedAt ? (
                          <div className="text-sm">
                            <p>
                              Reviewed by {capture.reviewedBy ?? "Moderator"} ·{" "}
                              {date(capture.reviewedAt)}
                            </p>
                            <p>
                              {capture.outcome &&
                              member(reviewOutcomes, capture.outcome)
                                ? reviewOutcomes[capture.outcome]
                                : "Review recorded"}
                            </p>
                            <p className="mt-2 whitespace-pre-wrap break-words">
                              {capture.reviewNote}
                            </p>
                          </div>
                        ) : jobId === job.id && manual.adminId ? (
                          <ManualReviewForm
                            adminId={manual.adminId}
                            jobId={job.id}
                            revision={capture.revision}
                          />
                        ) : (
                          <a
                            href={PAGE + "?job=" + job.id}
                            className="inline-block text-sm font-semibold text-purple-200 underline"
                          >
                            Open manual review
                          </a>
                        )}
                      </section>
                    )}
                    <a
                      href={DOCUMENTS_PAGE + "?job=" + job.id}
                      aria-label={`Open evidence for job ${job.id}`}
                      className="mt-4 inline-block text-sm font-semibold text-purple-200 underline"
                    >
                      Open evidence
                    </a>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        {!jobId && (page > 1 || (result?.data?.length ?? 0) > PAGE_SIZE) && (
          <nav
            aria-label="Job pages"
            className="mt-4 flex items-center gap-4 text-sm"
          >
            {page > 1 && (
              <a className="underline" href={pageLink(page - 1)}>
                Previous
              </a>
            )}
            <span>Page {page}</span>
            {(result?.data?.length ?? 0) > PAGE_SIZE && page < 9999 && (
              <a className="underline" href={pageLink(page + 1)}>
                Next
              </a>
            )}
          </nav>
        )}
      </section>
    </main>
  );
}
