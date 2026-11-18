import { NextRequest, NextResponse } from "next/server";
import { requireModerationOperation, ModerationAccessError } from "@/lib/moderation/access";
import { supabaseAdmin as db } from "@/lib/supabase/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reply = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { "Cache-Control": "private, no-store" },
});
function failure(error: unknown) {
  if (error instanceof ModerationAccessError) return reply({ error: error.message }, error.status);
  console.error("Failed-job recovery unavailable", error instanceof Error ? error.name : "unknown");
  return reply({ error: "Failed jobs could not be loaded or retried. Check the recovery migration and database." }, 503);
}
export async function GET(request: NextRequest) {
  try {
    await requireModerationOperation("createManual");
    const raw = request.nextUrl.searchParams.get("page") || "1";
    if (!/^[1-9]\d{0,2}$/.test(raw)) return reply({ error: "Invalid page." }, 400);
    const page = Number(raw), from = (page - 1) * 20;
    const jobs = await db.from("moderation_jobs")
      .select("id,platform,account_id,comment_id,content,attempts,retry_cycles,last_error,received_at,available_at", { count: "exact" })
      .eq("status", "failed").not("event_key", "like", "manual:%")
      .order("received_at", { ascending: false }).range(from, from + 19);
    if (jobs.error) throw jobs.error;
    const ids = (jobs.data ?? []).map((job) => job.id);
    const history = ids.length
      ? await db.from("moderation_job_retry_history")
        .select("job_id,cycle,previous_attempts,previous_error,reason,retried_at")
        .in("job_id", ids).order("retried_at", { ascending: false })
      : { data: [], error: null };
    if (history.error) throw history.error;
    const [counts, oldest, expired, service] = await Promise.all([
      Promise.all(["queued", "processing", "done", "failed"].map(async (status) => {
        const result = await db.from("moderation_jobs").select("id", { count: "exact", head: true }).eq("status", status);
        if (result.error) throw result.error;
        return [status, result.count ?? 0] as const;
      })),
      db.from("moderation_jobs").select("received_at").eq("status", "queued")
        .order("received_at", { ascending: true }).limit(1),
      db.from("moderation_jobs").select("id", { count: "exact", head: true })
        .eq("status", "processing").lt("lease_until", new Date().toISOString()),
      db.from("moderation_service").select("enabled,status").eq("id", true).maybeSingle(),
    ]);
    if (oldest.error || expired.error || service.error) throw new Error("Queue health unavailable");
    return reply({ jobs: jobs.data ?? [], total: jobs.count ?? 0, page, history: history.data ?? [],
      health: { counts: Object.fromEntries(counts), oldestQueuedAt: oldest.data?.[0]?.received_at ?? null,
        expiredLeases: expired.count ?? 0, worker: service.data ?? null } });
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  try {
    const actor = await requireModerationOperation("createManual");
    if (request.headers.get("origin") !== request.nextUrl.origin ||
        request.headers.get("sec-fetch-site") === "cross-site")
      return reply({ error: "Use the Admin Portal to retry a job." }, 403);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 2048) return reply({ error: "Request too large." }, 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return reply({ error: "Invalid request." }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body))
      return reply({ error: "Invalid request." }, 400);
    const { jobId, reason } = body as { jobId?: unknown; reason?: unknown };
    if (typeof jobId !== "string" || !UUID.test(jobId) ||
        typeof reason !== "string" || reason.trim().length < 10 ||
        reason.trim().length > 1000 || reason.includes("\u0000"))
      return reply({ error: "Choose a failed job and give a reason (10–1,000 characters)." }, 400);
    const result = await db.rpc("moderation_retry_failed_job", {
      p_job: jobId, p_actor: actor.id, p_reason: reason.trim(),
    });
    if (result.error) throw result.error;
    const outcome = result.data?.result;
    if (outcome === "queued") return reply({ queued: true, cycle: result.data.cycle });
    if (outcome === "not_found") return reply({ error: "Job not found." }, 404);
    if (outcome === "limit_reached") return reply({ error: "This job has reached the three manual retry limit. Investigate before taking further action." }, 409);
    if (outcome === "not_retryable") return reply({ error: "This job is no longer failed, has a lease or already has a decision. Refresh the list." }, 409);
    if (outcome === "denied") return reply({ error: "Main Admin access is required." }, 403);
    return reply({ error: "The job could not be retried." }, 400);
  } catch (error) { return failure(error); }
}
