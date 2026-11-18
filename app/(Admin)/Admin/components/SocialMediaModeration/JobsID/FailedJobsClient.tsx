"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
type Job = {
  id: string; platform: string; comment_id: string; content: string;
  attempts: number; retry_cycles: number; last_error: string | null; received_at: string;
};
type Retry = {
  job_id: string; cycle: number; previous_attempts: number;
  previous_error: string | null; reason: string; retried_at: string;
};
type Health = {
  counts: Record<string, number>; oldestQueuedAt: string | null;
  expiredLeases: number; worker: { enabled: boolean; status: string } | null;
};
const API = "/api/admin/social-media-moderation/failed-jobs";
export default function FailedJobsClient() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [history, setHistory] = useState<Retry[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [health, setHealth] = useState<Health | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const response = await fetch(`${API}?page=${page}`, { credentials: "same-origin", cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Unable to load failed jobs.");
    setJobs(data.jobs ?? []); setHistory(data.history ?? []); setTotal(data.total ?? 0);
    setHealth(data.health ?? null);
  }, [page]);
  useEffect(() => { void load().catch((cause) => setError(cause.message)); }, [load]);
  async function retry(jobId: string) {
    setError(""); setMessage(""); setBusy(jobId);
    try {
      const response = await fetch(API, {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, reason: reasons[jobId] ?? "" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not retry this job.");
      setMessage(`Job queued for another attempt. Manual retry ${data.cycle} of 3 was recorded.`);
      setReasons((value) => ({ ...value, [jobId]: "" }));
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not retry this job."); }
    finally { setBusy(""); }
  }
  return <main className="w-full min-w-0 space-y-6 px-4 py-7 text-white sm:px-6">
    <header>
      <Link href="/Admin/SocialMediaModeration/JobsID" className="text-sm text-fuchsia-200 hover:underline">← Back to Jobs</Link>
      <h1 className="mt-3 text-3xl font-bold">Failed job recovery</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
        Main Admins can retry a failed automatic job after investigating its error.
        Each retry is recorded with a reason, and each job has a maximum of three manual retries.
        Requeueing does not run the job until the moderation worker is ready.
      </p>
    </header>
    {error && <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-red-100">{error}</div>}
    {message && <div role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-emerald-100">{message}</div>}
    {health && <section aria-label="Queue health" className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="font-bold">Queue health</h2>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        {(["queued", "processing", "done", "failed"] as const).map((status) =>
          <span key={status} className="rounded-lg border border-white/10 px-3 py-2 capitalize">{status}: {health.counts[status] ?? 0}</span>)}
      </div>
      <p className="mt-3 text-sm text-slate-300">Worker: {health.worker?.status ?? "Unknown"}{health.worker && !health.worker.enabled ? " (stopped)" : ""}
        {" · "}Oldest queued: {health.oldestQueuedAt ? new Date(health.oldestQueuedAt).toLocaleString("en-GB") : "None"}
        {" · "}Expired processing leases: {health.expiredLeases}
      </p>
      {health.expiredLeases > 0 && <p className="mt-2 text-sm text-amber-200">Expired leases are recovered by the next worker invocation. Check the worker schedule if this count stays above zero.</p>}
    </section>}
    <section className="space-y-4">
      {!jobs.length && <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-slate-300">No failed jobs on this page.</div>}
      {jobs.map((job) => <article key={job.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-wrap justify-between gap-2">
          <h2 className="font-bold capitalize">{job.platform} · Comment {job.comment_id}</h2>
          <span className="text-sm text-amber-200">{job.attempts} attempts · {job.retry_cycles} of 3 manual retries</span>
        </div>
        <p className="mt-1 break-all text-xs text-slate-400">Job ID: {job.id}</p>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-200">{job.content}</p>
        <p className="mt-3 text-sm text-amber-200">Last error: {job.last_error || "No error recorded"}</p>
        <p className="mt-1 text-xs text-slate-400">Received {new Date(job.received_at).toLocaleString("en-GB")}</p>
        <label className="mt-4 block text-sm font-semibold">
          Reason for retry
          <textarea value={reasons[job.id] ?? ""} onChange={(event) => setReasons((value) => ({ ...value, [job.id]: event.target.value }))}
            maxLength={1000} rows={3} placeholder="Explain what was fixed or checked before retrying."
            className="mt-2 w-full rounded-xl border border-white/20 bg-slate-900 p-3 text-white" />
        </label>
        <button type="button" onClick={() => void retry(job.id)}
          disabled={Boolean(busy) || job.retry_cycles >= 3 || (reasons[job.id] ?? "").trim().length < 10}
          className="mt-3 min-h-11 rounded-xl bg-fuchsia-600 px-5 font-semibold hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-50">
          {busy === job.id ? "Requeueing…" : "Record reason and retry"}
        </button>
        {history.filter((entry) => entry.job_id === job.id).length > 0 && <details className="mt-4 text-sm text-slate-300">
          <summary className="cursor-pointer font-semibold">Previous manual retries</summary>
          <ul className="mt-2 space-y-2">
            {history.filter((entry) => entry.job_id === job.id).map((entry) =>
              <li key={entry.cycle} className="rounded-lg border border-white/10 p-3">
                Cycle {entry.cycle} · {new Date(entry.retried_at).toLocaleString("en-GB")}
                <div>Reason: {entry.reason}</div>
                <div>Previous failure: {entry.previous_error || "Not recorded"} ({entry.previous_attempts} attempts)</div>
              </li>)}
          </ul>
        </details>}
      </article>)}
    </section>
    <div className="flex items-center gap-4 text-sm">
      <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-white/20 px-4 py-2 disabled:opacity-50">Previous</button>
      <span>Page {page} · {total} failed jobs</span>
      <button type="button" disabled={page * 20 >= total} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-white/20 px-4 py-2 disabled:opacity-50">Next</button>
    </div>
  </main>;
}
