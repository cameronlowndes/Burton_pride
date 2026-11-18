"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
type Run = {
  id: string; platform: string; mode: string; since_at: string; until_at: string;
  status: string; pages_scanned: number; records_skipped: number;
  coverage_limited: boolean; last_error: string | null; found: number;
  remaining_targets: number; created_at: string;
};
const API = "/api/admin/social-media-moderation/backfill";
const field = "mt-2 min-h-11 w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-2 text-white";
function localDate(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
async function api(body?: Record<string, unknown>) {
  const response = await fetch(API, body ? {
    method: "POST", credentials: "same-origin",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  } : { credentials: "same-origin", cache: "no-store" });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Recovery request failed.");
  return result;
}
export default function BackfillClient() {
  const [platform, setPlatform] = useState<"facebook" | "instagram">("facebook");
  const [mode, setMode] = useState<"recent_media" | "specific_media">("recent_media");
  const [mediaId, setMediaId] = useState("");
  const [since, setSince] = useState(() => localDate(new Date(Date.now() - 7 * 86400000)));
  const [until, setUntil] = useState(() => localDate(new Date()));
  const [runs, setRuns] = useState<Run[]>([]);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const stop = useRef(false);
  const load = useCallback(async () => {
    const result = await api();
    setRuns(result.runs || []);
  }, []);
  useEffect(() => { void load().catch((cause) => setError(cause.message)); return () => { stop.current = true; }; }, [load]);
  async function process(id: string) {
    stop.current = false;
    setWorking(id); setError(""); setMessage("");
    try {
      for (let step = 0; step < 201 && !stop.current; step++) {
        const result = await api({ action: "step", id });
        await load();
        if (result.status === "completed" || result.status === "partial") {
          setMessage(result.status === "partial"
            ? "The scan reached a coverage limit or skipped records. Review the run and scan a specific media ID if needed."
            : "Scan completed. Review the recovered comments in Jobs.");
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The scan stopped.");
      await load().catch(() => {});
    } finally { setWorking(""); }
  }
  async function start() {
    setError(""); setMessage("");
    const a = new Date(since), b = new Date(until);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) { setError("Choose valid dates."); return; }
    try {
      const result = await api({ action: "start", platform, mode, media_id: mediaId.trim(),
        since: a.toISOString(), until: b.toISOString() });
      await load();
      await process(result.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not start."); }
  }
  async function cancel(id: string) {
    stop.current = true;
    try { await api({ action: "cancel", id }); await load(); setMessage("Scan cancelled. A page already in flight may have saved comments."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not cancel."); }
  }
  return <>
    {error && <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-red-100">{error}</div>}
    {message && <div role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-emerald-100">{message}</div>}
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="text-xl font-bold">New recovery scan</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Platform<select className={field} value={platform} onChange={(e) => setPlatform(e.target.value as typeof platform)}><option value="facebook">Facebook Page</option><option value="instagram">Instagram professional account</option></select></label>
        <label className="text-sm">Coverage<select className={field} value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}><option value="recent_media">Latest 100 posts/media (maximum)</option><option value="specific_media">Specific post/media ID</option></select></label>
        {mode === "specific_media" && <label className="text-sm sm:col-span-2">Post or media ID<input className={field} inputMode="numeric" value={mediaId} onChange={(e) => setMediaId(e.target.value)} placeholder="Numeric Meta post or media ID" /></label>}
        <label className="text-sm">Comments from<input className={field} type="datetime-local" value={since} onChange={(e) => setSince(e.target.value)} /></label>
        <label className="text-sm">Comments until<input className={field} type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} /></label>
      </div>
      <p className="mt-4 text-sm text-slate-300">Each run covers up to 31 days of comment dates and at most 200 Meta result pages. It scans comments and replies. Older posts outside the latest 100 need a separate scan by media ID.</p>
      <button type="button" onClick={() => void start()} disabled={Boolean(working)} className="mt-5 min-h-11 rounded-xl bg-fuchsia-600 px-5 font-semibold hover:bg-fuchsia-500 disabled:opacity-50">Start scan</button>
    </section>
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">Recent recovery runs</h2><button type="button" className="text-sm text-fuchsia-200 hover:underline" onClick={() => void load().catch((cause) => setError(cause.message))}>Refresh</button></div>
      <div className="mt-4 space-y-3">
        {!runs.length && <p className="text-slate-300">No scans yet.</p>}
        {runs.map((run) => <article key={run.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
          <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{run.platform === "facebook" ? "Facebook" : "Instagram"} · {run.mode === "specific_media" ? "Specific media" : "Latest media"}</h3><span className="capitalize text-fuchsia-200">{run.status}</span></div>
          <p className="mt-2 text-xs text-slate-400">{new Date(run.since_at).toLocaleString("en-GB")} to {new Date(run.until_at).toLocaleString("en-GB")}</p>
          <p className="mt-2 text-sm text-slate-300">{run.found} matching comments found · {run.pages_scanned} pages scanned · {run.remaining_targets} targets left · {run.records_skipped} records skipped</p>
          {run.coverage_limited && <p className="mt-2 text-sm text-amber-200">Coverage limit reached. Scan specific media separately.</p>}
          {run.last_error && <p className="mt-2 text-sm text-amber-200">{run.last_error}</p>}
          <div className="mt-3 flex flex-wrap gap-3">
            {(run.status === "ready" || run.status === "running") && <>
              <button type="button" disabled={Boolean(working)} onClick={() => void process(run.id)} className="rounded-lg bg-fuchsia-600 px-4 py-2 text-sm font-semibold disabled:opacity-50">{working === run.id ? "Scanning…" : "Resume"}</button>
              <button type="button" onClick={() => void cancel(run.id)} className="rounded-lg border border-white/20 px-4 py-2 text-sm">Cancel</button>
            </>}
            <Link href="/Admin/SocialMediaModeration/JobsID" className="rounded-lg border border-white/20 px-4 py-2 text-sm">View Jobs</Link>
          </div>
        </article>)}
      </div>
    </section>
    <p className="text-sm text-slate-400">For a comment that Meta no longer exposes, use the <Link className="text-fuchsia-200 underline" href="/Admin/SocialMediaModeration/JobsID/Manual">manual capture form</Link>.</p>
  </>;
}
