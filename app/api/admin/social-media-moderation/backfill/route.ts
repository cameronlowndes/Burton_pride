import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireModerationOperation, ModerationAccessError } from "@/lib/moderation/access";
import { supabaseAdmin as db } from "@/lib/supabase/supabaseAdmin";
import {
  MAX_CATALOG_PAGES, MAX_PAGES, commentRows, graphPath, nextCursor,
  records, validId, windowDates, type Platform, type Target,
} from "@/lib/moderation/backfill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Run = {
  id: string; platform: Platform; account_id: string; mode: string;
  since_at: string; until_at: string; status: string; pending: Target[];
  pages_scanned: number; catalog_pages: number; records_skipped: number;
  coverage_limited: boolean; lease_token: string | null;
};
const json = (value: unknown, status = 200) => NextResponse.json(value, {
  status, headers: { "Cache-Control": "private, no-store" },
});
const fail = (error: unknown) => {
  if (error instanceof ModerationAccessError) return json({ error: error.message }, error.status);
  console.error("Moderation backfill failed", error instanceof Error ? error.name : "unknown");
  return json({ error: "Recovery could not complete this step. Check Meta access and database availability, then retry." }, 503);
};
function account(platform: Platform) {
  return {
    id: process.env[platform === "facebook" ? "META_FACEBOOK_PAGE_ID" : "META_INSTAGRAM_ACCOUNT_ID"] || "",
    token: process.env[platform === "facebook" ? "META_FACEBOOK_PAGE_TOKEN" : "META_INSTAGRAM_TOKEN"] || "",
  };
}
async function graph(platform: Platform, target: Target, accountId: string) {
  const token = account(platform).token;
  if (!token) throw new Error("Meta token unavailable");
  const url = graphPath(platform, target, accountId);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store", signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`Meta returned HTTP ${response.status}`);
  return response.json() as Promise<unknown>;
}
async function bodyOf(request: NextRequest): Promise<Record<string, unknown> | null> {
  const text = await request.text();
  if (Buffer.byteLength(text) > 12000) return null;
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown> : null;
  } catch { return null; }
}
export async function GET() {
  try {
    await requireModerationOperation("createManual");
    const result = await db.from("moderation_backfill_runs")
      .select("id,platform,mode,since_at,until_at,status,pending,pages_scanned,catalog_pages,records_skipped,coverage_limited,last_error,created_at,updated_at,finished_at")
      .order("created_at", { ascending: false }).limit(10);
    if (result.error) throw result.error;
    const runs = await Promise.all((result.data ?? []).map(async (run) => {
      const count = await db.from("moderation_backfill_events")
        .select("event_key", { count: "exact", head: true }).eq("run_id", run.id);
      if (count.error) throw count.error;
      return { ...run, found: count.count ?? 0, remaining_targets: Array.isArray(run.pending) ? run.pending.length : 0, pending: undefined };
    }));
    return json({ runs });
  } catch (error) { return fail(error); }
}
export async function POST(request: NextRequest) {
  try {
    const actor = await requireModerationOperation("createManual");
    if (request.headers.get("origin") !== request.nextUrl.origin ||
      request.headers.get("sec-fetch-site") === "cross-site")
      return json({ error: "Use the Admin Portal to start or continue recovery." }, 403);
    const body = await bodyOf(request);
    if (!body) return json({ error: "Invalid request." }, 400);
    if (body.action === "start") {
      if (body.platform !== "facebook" && body.platform !== "instagram")
        return json({ error: "Choose Facebook or Instagram." }, 400);
      const platform = body.platform;
      const window = windowDates(body.since, body.until);
      if (!window) return json({ error: "Choose a historical date range of up to 31 days." }, 400);
      const configured = account(platform);
      if (!validId(configured.id) || !configured.token || !/^v\d+\.\d+$/.test(process.env.META_GRAPH_VERSION || ""))
        return json({ error: "The configured Meta account, token or Graph version is missing." }, 503);
      const mode = body.mode === "specific_media" ? "specific_media" : body.mode === "recent_media" ? "recent_media" : null;
      if (!mode || (mode === "specific_media" && !validId(body.media_id)))
        return json({ error: "Choose a valid scan mode and media ID." }, 400);
      const pending: Target[] = mode === "recent_media"
        ? [{ kind: "catalog", id: configured.id }]
        : [{ kind: "verify", id: body.media_id as string }];
      const result = await db.from("moderation_backfill_runs").insert({
        created_by: actor.id, platform, account_id: configured.id, mode,
        ...window, pending,
      }).select("id").single();
      if (result.error) {
        if (result.error.code === "23505")
          return json({ error: "Finish or cancel the existing scan for this platform first." }, 409);
        throw result.error;
      }
      return json({ id: result.data.id }, 201);
    }
    if (typeof body.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id))
      return json({ error: "Invalid recovery run ID." }, 400);
    if (body.action === "cancel") {
      const result = await db.from("moderation_backfill_runs")
        .update({ status: "cancelled", pending: [], lease_token: null, lease_until: null,
          finished_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", body.id).in("status", ["ready", "running"]).select("id").maybeSingle();
      if (result.error) throw result.error;
      return json({ cancelled: Boolean(result.data) });
    }
    if (body.action !== "step") return json({ error: "Unsupported action." }, 400);
    const lease = randomUUID(), now = new Date(), leaseUntil = new Date(now.getTime() + 30000);
    const claimed = await db.from("moderation_backfill_runs")
      .update({ status: "running", lease_token: lease, lease_until: leaseUntil.toISOString(),
        updated_at: now.toISOString() })
      .eq("id", body.id).in("status", ["ready", "running"])
      .or(`lease_until.is.null,lease_until.lt.${now.toISOString()}`)
      .select("*").maybeSingle();
    if (claimed.error) throw claimed.error;
    if (!claimed.data) return json({ error: "This scan is busy or already finished. Refresh its status." }, 409);
    const run = claimed.data as Run;
    try {
      if (run.account_id !== account(run.platform).id)
        throw new Error("Configured Meta account changed");
      if (!Array.isArray(run.pending) || !run.pending.length)
        throw new Error("Recovery progress is invalid");
      const [target, ...remaining] = run.pending;
      if (!target || !["catalog", "verify", "media", "replies"].includes(target.kind) ||
        !validId(target.id)) throw new Error("Recovery target is invalid");
      const payload = await graph(run.platform, target, run.account_id);
      let next = remaining, pages = run.pages_scanned, catalogPages = run.catalog_pages;
      let skipped = run.records_skipped, limited = run.coverage_limited;
      if (target.kind === "verify") {
        const object = payload as { id?: unknown; from?: { id?: unknown }; owner?: { id?: unknown } };
        const owner = run.platform === "facebook" ? object.from?.id : object.owner?.id;
        if (object.id !== target.id || owner !== run.account_id)
          throw new Error("Media is not owned by the configured account");
        next = [{ kind: "media", id: target.id }, ...remaining];
      } else if (target.kind === "catalog") {
        const items = records(payload);
        catalogPages++;
        pages++;
        next = [...remaining, ...items.filter((item) => validId(item.id))
          .map((item) => ({ kind: "media" as const, id: item.id as string }))];
        const cursor = nextCursor(payload);
        if (cursor && catalogPages < MAX_CATALOG_PAGES)
          next.push({ kind: "catalog", id: run.account_id, after: cursor });
        else if (cursor) limited = true;
      } else {
        const items = records(payload);
        const found = commentRows(items, run.platform, run.account_id,
          run.since_at, run.until_at, target.id);
        skipped += found.skipped;
        if (found.rows.length) {
          const jobs = await db.from("moderation_jobs").upsert(found.rows.map((row) => ({
            event_key: row.event_key, platform: row.platform, account_id: row.account_id,
            comment_id: row.comment_id, content: row.content,
          })),
            { onConflict: "event_key", ignoreDuplicates: true });
          if (jobs.error) throw jobs.error;
          const evidence = await db.from("moderation_backfill_events").upsert(
            found.rows.map((row) => ({
              run_id: run.id, event_key: row.event_key, comment_id: row.comment_id, source_id: row.source_id,
            })), { onConflict: "run_id,event_key", ignoreDuplicates: true });
          if (evidence.error) throw evidence.error;
        }
        pages++;
        next = [...remaining];
        if (target.kind === "media")
          next.push(...items.filter((item) => validId(item.id))
            .map((item) => ({ kind: "replies" as const, id: item.id as string })));
        const cursor = nextCursor(payload);
        if (cursor) next.push({ ...target, after: cursor });
      }
      if (next.length > 1000) { next = next.slice(0, 1000); limited = true; }
      const stopped = !next.length || pages >= MAX_PAGES;
      const status = stopped ? (limited || skipped || next.length ? "partial" : "completed") : "ready";
      const update = await db.from("moderation_backfill_runs").update({
        pending: stopped ? [] : next, status, pages_scanned: pages, catalog_pages: catalogPages,
        records_skipped: skipped, coverage_limited: limited || Boolean(stopped && next.length),
        lease_token: null, lease_until: null, last_error: null, updated_at: new Date().toISOString(),
        finished_at: stopped ? new Date().toISOString() : null,
      }).eq("id", run.id).eq("lease_token", lease).eq("status", "running").select("id").maybeSingle();
      if (update.error) throw update.error;
      if (!update.data) return json({ error: "This scan was cancelled while the page was being processed." }, 409);
      return json({ status, pages_scanned: pages, remaining_targets: stopped ? 0 : next.length });
    } catch (error) {
      const reason = error instanceof Error && /Meta returned HTTP \d{3}/.test(error.message)
        ? error.message : "Could not read this Meta page or save its comments. Check account access and retry.";
      await db.from("moderation_backfill_runs").update({
        status: "ready", lease_token: null, lease_until: null, last_error: reason,
        updated_at: new Date().toISOString(),
      }).eq("id", run.id).eq("lease_token", lease);
      return json({ error: reason }, 503);
    }
  } catch (error) { return fail(error); }
}
