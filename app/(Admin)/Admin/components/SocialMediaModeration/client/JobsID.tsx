import { db, evidenceAdmin, londonDate, PAGE as DOCUMENTS_PAGE, UUID } from "../Server/Documents/evidence";

export const dynamic = "force-dynamic";

const PAGE = "/Admin/SocialMediaModeration/JobsID";
const PAGE_SIZE = 25;
const STATUSES = {
  queued: "Queued",
  processing: "Processing",
  done: "Completed",
  failed: "Failed",
} as const;
const PLATFORMS = { facebook: "Facebook", instagram: "Instagram" } as const;
const panel = "min-w-0 rounded-2xl border border-white/15 bg-slate-900/70 p-4 sm:p-5";
const control = "min-h-11 rounded-xl border border-white/25 bg-slate-950 px-3 py-2 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-300";

type Query = { job?: string; status?: string; platform?: string; page?: string };

function member<T extends object>(values: T, value: unknown): value is keyof T {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(values, value);
}

function date(value: string | null) {
  return value ? londonDate.format(new Date(value)) : "Not recorded";
}

export default async function ModerationJobsPage({ searchParams }: { searchParams: Promise<Query> }) {
  if (!(await evidenceAdmin())) {
    return <main className="p-6"><h1>Jobs are restricted to main admins</h1></main>;
  }

  const params = await searchParams;
  const jobId = typeof params.job === "string" ? params.job.trim().toLowerCase() : "";
  const validId = !jobId || UUID.test(jobId);
  const platform = member(PLATFORMS, params.platform) ? params.platform : "";
  const status = member(STATUSES, params.status) ? params.status : "";
  const page = !jobId && typeof params.page === "string" && /^[1-9]\d{0,3}$/.test(params.page)
    ? Number(params.page) : 1;

  function pageLink(number: number) {
    const query = new URLSearchParams({ page: String(number) });
    if (platform) query.set("platform", platform);
    if (status) query.set("status", status);
    return PAGE + "?" + query;
  }

  let query = db.from("moderation_jobs")
    .select("id,platform,comment_id,status,attempts,received_at,available_at,completed_at,last_error");
  if (jobId) {
    query = query.eq("id", jobId);
  } else {
    if (platform) query = query.eq("platform", platform);
    if (status) query = query.eq("status", status);
  }
  const from = (page - 1) * PAGE_SIZE;
  const result = validId
    ? await query.order("received_at", { ascending: false }).order("id", { ascending: false })
      .range(from, from + PAGE_SIZE)
    : null;
  const jobs = result?.data?.slice(0, PAGE_SIZE) ?? [];
  const decisions = jobs.length
    ? await db.from("moderation_decisions").select("job_id,decision,action_status,reviewed_at")
      .in("job_id", jobs.map(job => job.id))
    : null;
  const byJob = new Map((decisions?.data ?? []).map(decision => [decision.job_id, decision]));

  return (
    <main className="w-full min-w-0 space-y-6 px-4 py-6 text-white sm:px-6">
      <header>
        <p className="text-sm text-slate-300">Social Media Moderation</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Jobs</h1>
        <p className="mt-2 max-w-3xl text-slate-300">
          Find a captured Facebook or Instagram event, track its processing status and open the evidence attached to it.
        </p>
      </header>

      <section className={panel} aria-labelledby="job-search">
        <h2 id="job-search" className="text-lg font-semibold">Find a job</h2>
        <form action={PAGE} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="grid w-full gap-1 text-sm sm:max-w-md">
            Exact Job ID
            <input name="job" defaultValue={jobId} className={control} placeholder="Paste the Job ID from Documents" />
          </label>
          <label className="grid gap-1 text-sm">
            Platform
            <select name="platform" defaultValue={platform} className={control}>
              <option value="">All platforms</option>
              {Object.entries(PLATFORMS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Status
            <select name="status" defaultValue={status} className={control}>
              <option value="">All statuses</option>
              {Object.entries(STATUSES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <button className={control}>Search</button>
          <a href={PAGE} className="inline-flex min-h-11 items-center px-2 text-sm underline">Clear filters</a>
        </form>
        <p className="mt-3 text-sm text-slate-300">An exact Job ID search takes priority over platform and status filters.</p>
      </section>

      <section aria-labelledby="saved-jobs">
        <h2 id="saved-jobs" className="mb-3 text-xl font-semibold">Saved jobs</h2>
        {!validId ? <p className={panel} role="alert">Enter the full Job ID, including its hyphens.</p>
          : result?.error ? <p className={panel} role="alert">Jobs could not be loaded. Refresh this page to try again.</p>
          : !jobs.length ? <p className={panel}>{jobId ? "No job matches that ID." : "No jobs found on this page."}</p>
          : <>
            {decisions?.error && <p className="mb-3 text-amber-200" role="alert">Decision details are temporarily unavailable.</p>}
            <ul className="space-y-3">
              {jobs.map(job => {
                const decision = byJob.get(job.id);
                return (
                  <li key={job.id} className={panel}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold capitalize">{job.platform} comment</h3>
                        <p className="mt-1 break-all text-sm text-slate-300">Job ID <code className="select-all text-white">{job.id}</code></p>
                        <p className="mt-1 break-all text-sm text-slate-300">Meta comment ID {job.comment_id}</p>
                      </div>
                      <span className="rounded-lg border border-white/20 px-3 py-1 text-sm">
                        {member(STATUSES, job.status) ? STATUSES[job.status] : job.status}
                      </span>
                    </div>
                    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <div><dt className="text-slate-300">Received</dt><dd>{date(job.received_at)}</dd></div>
                      <div><dt className="text-slate-300">Processing attempts</dt><dd>{job.attempts}</dd></div>
                      <div><dt className="text-slate-300">{job.status === "queued" ? "Eligible to run from" : "Completed"}</dt>
                        <dd>{date(job.status === "queued" ? job.available_at : job.completed_at)}</dd></div>
                      <div><dt className="text-slate-300">Moderation decision</dt>
                        <dd className="capitalize">{decisions?.error ? "Unavailable" : decision?.reviewed_at ? `${decision.decision} · Reviewed` : decision?.decision ?? "Not recorded"}</dd></div>
                    </dl>
                    {job.last_error && (job.status === "failed" || job.status === "queued") && (
                      <p className="mt-3 break-words text-sm text-amber-200">Last processing error: {job.last_error}</p>
                    )}
                    <a href={DOCUMENTS_PAGE + "?job=" + job.id}
                      aria-label={`Open evidence for job ${job.id}`}
                      className="mt-4 inline-block text-sm font-semibold text-purple-200 underline">
                      Open evidence
                    </a>
                  </li>
                );
              })}
            </ul>
          </>}
        {!jobId && (page > 1 || (result?.data?.length ?? 0) > PAGE_SIZE) && (
          <nav aria-label="Job pages" className="mt-4 flex items-center gap-4 text-sm">
            {page > 1 && <a className="underline" href={pageLink(page - 1)}>Previous</a>}
            <span>Page {page}</span>
            {(result?.data?.length ?? 0) > PAGE_SIZE && page < 9999 && <a className="underline" href={pageLink(page + 1)}>Next</a>}
          </nav>
        )}
      </section>
    </main>
  );
}
