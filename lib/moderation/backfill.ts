import { createHash } from "node:crypto";

export type Platform = "facebook" | "instagram";
export type Target = { kind: "catalog" | "verify" | "media" | "replies"; id: string; after?: string };
export const MAX_PAGES = 200;
export const MAX_CATALOG_PAGES = 4;
export const PAGE_SIZE = 25;
const ID = /^\d+(?:_\d+)?$/;

export function validId(value: unknown): value is string {
  return typeof value === "string" && value.length <= 80 && ID.test(value);
}
export function validCursor(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 2000 &&
    !/[\u0000-\u001f]/.test(value);
}
export function windowDates(since: unknown, until: unknown, now = Date.now()) {
  if (typeof since !== "string" || typeof until !== "string") return null;
  const start = Date.parse(since), end = Date.parse(until);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end ||
    end > now + 60000 || end - start > 31 * 86400000) return null;
  return { since_at: new Date(start).toISOString(), until_at: new Date(end).toISOString() };
}
export function graphPath(platform: Platform, target: Target, accountId: string): URL {
  if (!validId(target.id) || !validId(accountId) || (target.after && !validCursor(target.after)))
    throw new Error("Invalid scan target.");
  const version = process.env.META_GRAPH_VERSION || "";
  if (!/^v\d+\.\d+$/.test(version)) throw new Error("Meta Graph version is not configured.");
  const edge = target.kind === "catalog" ? (platform === "facebook" ? "posts" : "media")
    : target.kind === "replies" ? (platform === "facebook" ? "comments" : "replies")
    : "comments";
  const path = target.kind === "verify" ? target.id : target.kind === "catalog" ? accountId : target.id;
  const url = new URL(`https://graph.facebook.com/${version}/${path}${target.kind === "verify" ? "" : "/" + edge}`);
  if (target.kind === "verify") url.searchParams.set("fields", platform === "facebook" ? "id,from{id}" : "id,owner{id}");
  else {
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("fields", target.kind === "catalog"
      ? (platform === "facebook" ? "id,created_time" : "id,timestamp")
      : (platform === "facebook" ? "id,message,created_time" : "id,text,timestamp"));
    if (platform === "facebook" && target.kind === "media") url.searchParams.set("filter", "toplevel");
    if (target.after) url.searchParams.set("after", target.after);
  }
  return url;
}
export function nextCursor(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as { paging?: { next?: unknown; cursors?: { after?: unknown } } };
  return p.paging?.next && validCursor(p.paging.cursors?.after) ? p.paging.cursors.after : null;
}
export function records(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== "object") throw new Error("Unexpected Meta response.");
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data) || data.length > PAGE_SIZE) throw new Error("Unexpected Meta result page.");
  return data.filter((item): item is Record<string, unknown> =>
    item !== null && typeof item === "object" && !Array.isArray(item));
}
export function commentRows(
  data: Record<string, unknown>[], platform: Platform, accountId: string,
  since: string, until: string, sourceId: string,
) {
  const rows: { event_key: string; platform: Platform; account_id: string; comment_id: string;
    content: string; source_id: string }[] = [];
  let skipped = 0;
  for (const item of data) {
    const id = item.id, content = platform === "facebook" ? item.message : item.text;
    const timestamp = platform === "facebook" ? item.created_time : item.timestamp;
    const time = typeof timestamp === "string" ? Date.parse(timestamp) : NaN;
    if (!validId(id) || typeof content !== "string" || content.length > 20000 ||
      !Number.isFinite(time)) { skipped++; continue; }
    if (time < Date.parse(since) || time > Date.parse(until)) continue;
    rows.push({
      event_key: createHash("sha256").update(JSON.stringify([platform, accountId, id, content])).digest("hex"),
      platform, account_id: accountId, comment_id: id, content, source_id: sourceId,
    });
  }
  return { rows, skipped };
}
