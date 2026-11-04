import "server-only";

import { db } from "./Documents/evidence";

export const HISTORY = "/Admin/SocialMediaModeration/History";
export const PAGE_SIZE = 25;
export const TABS = { all: "All activity", social: "Social media", admin: "Admin changes" } as const;
export const SOURCES = {
  event: "Recorded action", job: "Comment job", decision: "Moderation decision",
  service: "Service history", audit: "Admin security audit",
} as const;
export const PLATFORMS = { facebook: "Facebook", instagram: "Instagram" } as const;
export const FIELDS = {
  case_ref: "Case reference", job_id: "Job ID", comment_id: "Comment ID",
  admin_id: "Admin ID", admin_name: "Admin name", account_ref: "Account reference",
} as const;

export type Parameters = Record<string, string | string[] | undefined>;
export type HistoryEvent = {
  event_id: string;
  occurred_at: string;
  source: keyof typeof SOURCES;
  kind: string;
  outcome: string;
  platform: keyof typeof PLATFORMS | null;
  account_ref: string | null;
  job_id: string | null;
  case_ref: string | null;
  comment_id: string | null;
  actor_kind: string;
  admin_id: string | null;
  attempts: number | null;
  before_state: string | null;
  after_state: string | null;
  reason_code: string | null;
  related_event_key: string | null;
};

function option<T extends object>(options: T, value: unknown): keyof T | undefined {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(options, value)
    ? value as keyof T : undefined;
}

export function filters(params: Parameters) {
  const text = (key: string) => {
    const value = params[key];
    return typeof value === "string" ? value.trim() : "";
  };
  const field = option(FIELDS, params.field) ?? "job_id";
  const q = text("q");
  const result = text("result");
  return {
    tab: option(TABS, params.tab) ?? "all",
    platform: option(PLATFORMS, params.platform),
    source: option(SOURCES, params.source),
    days: ["7", "30", "90", "all"].includes(text("days")) ? text("days") : "7",
    field,
    account: /^[a-zA-Z0-9:_-]{1,120}$/.test(text("account")) ? text("account") : "",
    kind: /^[a-z][a-z0-9_]{0,79}$/.test(text("kind")) ? text("kind") : "",
    q: q.slice(0, 120),
    invalid: !!q && !(field === "admin_name" ? /^[\p{L}\p{M}\p{N} .’'-]{1,120}$/u : /^[a-zA-Z0-9:_-]{1,120}$/).test(q),
    result: /^[a-z][a-z0-9_]{0,79}$/.test(result) ? result : "",
    page: /^[1-9]\d{0,3}$/.test(text("page")) ? Number(text("page")) : 1,
  };
}

export type Filters = ReturnType<typeof filters>;

export function historyLink(f: Filters, changes: Partial<Filters> = {}) {
  const v = { ...f, ...changes };
  const params = new URLSearchParams();
  for (const key of ["tab", "platform", "source", "days", "account", "kind", "field", "q", "result", "page"] as const) {
    if (v[key]) params.set(key, String(v[key]));
  }
  return HISTORY + "?" + params;
}

const select = "event_id,occurred_at,source,kind,outcome,platform,account_ref,job_id,case_ref,comment_id,actor_kind,admin_id,attempts,before_state,after_state,reason_code,related_event_key";

export async function loadHistory(f: Filters) {
  const since = f.days === "all" ? null : new Date(Date.now() - Number(f.days) * 86400000).toISOString();
  let query = db.from("moderation_activity_feed").select(select);
  if (since) query = query.gte("occurred_at", since);
  if (f.tab === "admin") query = query.eq("is_admin", true);
  if (f.tab === "social") query = query.eq("is_social", true);
  if (f.platform) query = query.eq("platform", f.platform);
  if (f.source) query = query.eq("source", f.source);
  if (f.account) query = query.eq("account_ref", f.account);
  if (f.kind) query = query.eq("kind", f.kind);
  if (f.q && f.field === "admin_name") {
    const [fullNames, names] = await Promise.all([
      db.from("admin_users").select("id").ilike("full_name", f.q),
      db.from("admin_users").select("id").ilike("name", f.q),
    ]);
    if (fullNames.error || names.error) throw new Error("Admin name search is unavailable.");
    const ids = [...new Set([...(fullNames.data ?? []), ...(names.data ?? [])].map(row => String(row.id)))];
    query = ids.length ? query.in("admin_id", ids) : query.eq("event_id", "");
  } else if (f.q) {
    query = query.eq(f.field, f.q);
  }
  if (f.result) query = query.eq("outcome", f.result);

  const first = (f.page - 1) * PAGE_SIZE;
  let confirmed = db.from("moderation_activity_events")
    .select("event_key", { count: "exact", head: true })
    .eq("outcome", "confirmed").eq("kind", "platform_action").not("platform", "is", null);
  if (since) confirmed = confirmed.gte("occurred_at", since);

  return Promise.all([
    query.order("occurred_at", { ascending: false }).order("event_id", { ascending: false })
      .range(first, first + PAGE_SIZE).returns<HistoryEvent[]>(),
    db.from("moderation_decisions").select("job_id", { count: "exact", head: true }).eq("action_status", "review"),
    db.from("moderation_jobs").select("id", { count: "exact", head: true }).eq("status", "failed"),
    confirmed,
  ]);
}

export async function relatedHistory(event: HistoryEvent) {
  let query = db.from("moderation_activity_feed").select(select);
  if (event.case_ref) query = query.eq("case_ref", event.case_ref);
  else if (event.job_id) query = query.eq("job_id", event.job_id);
  else return null;
  return query.order("occurred_at", { ascending: false }).order("event_id", { ascending: false })
    .limit(21).returns<HistoryEvent[]>();
}
