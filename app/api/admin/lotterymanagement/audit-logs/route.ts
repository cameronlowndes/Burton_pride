import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_SORT_FIELDS = new Set([
  "created_at",
  "action_group",
  "action_label",
  "risk_level",
]);
const ALLOWED_GROUPS = new Set([
  "lottery",
  "ticket",
  "payment",
  "prize",
  "draw",
  "winner",
  "compliance",
  "security",
  "export",
]);
const ALLOWED_RISK_LEVELS = new Set(["low", "medium", "high", "critical"]);

const MAX_OFFSET = 100000;
class RouteError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function json(body: Record<string, unknown>, requestId: string, status = 200) {
  return NextResponse.json(
    { ...body, request_id: requestId },
    {
      status,
      headers: {
        "Cache-Control":
          "private, no-store, no-cache, must-revalidate, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "X-Request-ID": requestId,
        Vary: "Cookie, Authorization",
      },
    },
  );
}
function withSignal<T>(
  promise: PromiseLike<T>,
  signal: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () =>
      reject(
        new RouteError(503, "Lottery audit logs are temporarily unavailable."),
      );
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(promise)
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}
function single(params: URLSearchParams, name: string, fallback = ""): string {
  if (params.getAll(name).length > 1)
    throw new RouteError(400, `Provide ${name} only once.`);
  return params.get(name) ?? fallback;
}
function positiveInt(value: string, max: number): number {
  if (!/^[1-9]\d{0,5}$/.test(value) || Number(value) > max)
    throw new RouteError(400, "Invalid audit pagination.");
  return Number(value);
}
function safeAuditSearch(value: string): string {
  if (value.length > 120)
    throw new RouteError(
      400,
      "Audit search must be no longer than 120 characters.",
    );
  // PostgREST OR expressions are constructed below. Reject their grammar,
  // quote characters, and percent wildcards rather than interpolating them.
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!/^[\p{L}\p{N}\s@._+-]*$/u.test(trimmed))
    throw new RouteError(
      400,
      "Use letters, numbers, spaces, @, dots, underscores, + or - in audit search.",
    );
  return trimmed;
}
function calendarDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new RouteError(400, "Invalid audit date.");
  const date = new Date(value + "T00:00:00Z");
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    throw new RouteError(400, "Invalid audit date.");
  return date;
}
function londonMidnight(value: string): string {
  const date = calendarDate(value);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
  for (const offset of [0, 3600000]) {
    const candidate = new Date(date.getTime() - offset);
    const parts = Object.fromEntries(
      formatter.formatToParts(candidate).map((part) => [part.type, part.value]),
    );
    if (
      `${parts.year.padStart(4, "0")}-${parts.month}-${parts.day}` === value &&
      parts.hour === "00"
    )
      return candidate.toISOString();
  }
  throw new RouteError(400, "Unsupported audit date.");
}
function dateBounds(from: string, to: string) {
  if (from && to && calendarDate(from).getTime() > calendarDate(to).getTime())
    throw new RouteError(
      400,
      "The from date must be before or equal to the to date.",
    );
  let toExclusive: string | null = null;
  if (to) {
    const next = calendarDate(to);
    next.setUTCDate(next.getUTCDate() + 1);
    toExclusive = londonMidnight(next.toISOString().slice(0, 10));
  }
  return { fromIso: from ? londonMidnight(from) : null, toExclusive };
}

function projectLog(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new RouteError(503, "Unable to load lottery audit logs.");
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.created_at !== "string" ||
    typeof row.action_code !== "string"
  )
    throw new RouteError(503, "Unable to load lottery audit logs.");
  const field = (key: string, max = 300): string | null =>
    typeof row[key] === "string" && row[key].length <= max ? row[key] : null;
  return {
    id: field("id", 200),
    created_at: field("created_at", 50),
    admin_id: field("admin_id", 200),
    admin_name: field("admin_name"),
    action_code: field("action_code"),
    action_label: field("action_label", 1000),
    action_group: field("action_group", 100),
    risk_level: field("risk_level", 50),
    lottery_id: field("lottery_id", 200),
    lottery_title: field("lottery_title"),
    entity_type: field("entity_type", 100),
    entity_id: field("entity_id", 200),
    // Details are deliberately omitted from the SELECT, as well as redacted here.
    admin_email: null,
    reason: null,
    ip_address: null,
    device_context: null,
    before_data: null,
    after_data: null,
    metadata: {},
  };
}

export async function GET(request: NextRequest) {
  const requestId = randomUUID();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const cancel = () => controller.abort();
  request.signal.addEventListener("abort", cancel, { once: true });
  if (request.signal.aborted) controller.abort();
  let stage = "session";
  try {
    const client = await withSignal(createClient(), controller.signal);
    const { data, error: authError } = await withSignal(
      client.auth.getUser(),
      controller.signal,
    );
    if (authError || !data.user?.id || data.user.is_anonymous === true)
      throw new RouteError(
        401,
        "You must be signed in to view lottery audit logs.",
      );
    const { supabaseAdmin: db } = await import("@/lib/supabase/supabaseAdmin");
    stage = "authorization";
    const adminResult = await withSignal(
      db
        .from("admin_users")
        .select("id,supabase_user_id,role,is_active")
        .eq("supabase_user_id", data.user.id)
        .eq("is_active", true)
        .abortSignal(controller.signal)
        .maybeSingle(),
      controller.signal,
    );
    if (adminResult.error)
      throw new RouteError(
        503,
        "Lottery audit logs are temporarily unavailable.",
      );
    const admin = adminResult.data;
    // Temporary, conservative restriction using the supplied administrator schema.
    // Integrate lottery:audit:view through the verified central permission guard
    // when that guard and its permission storage are supplied. Never infer identity
    // from administrator ID/email/session-marker cookies or an email fallback.
    if (
      !admin ||
      admin.supabase_user_id !== data.user.id ||
      admin.is_active !== true ||
      admin.role !== "main_admin"
    )
      throw new RouteError(
        403,
        "You do not have permission to view lottery audit logs.",
      );

    stage = "validation";
    const params = request.nextUrl.searchParams;
    const page = positiveInt(single(params, "page", "1"), MAX_OFFSET + 1);
    const pageSize = positiveInt(single(params, "pageSize", "25"), 100);
    const start = (page - 1) * pageSize;
    if (start > MAX_OFFSET)
      throw new RouteError(
        400,
        "Audit page is beyond the supported range. Narrow the date or search filters.",
      );
    const search = safeAuditSearch(single(params, "search"));
    const group = single(params, "group"),
      risk = single(params, "risk");
    const sort = single(params, "sort", "created_at"),
      direction = single(params, "direction", "desc");
    if (group && !ALLOWED_GROUPS.has(group))
      throw new RouteError(400, "Invalid audit action group.");
    if (risk && !ALLOWED_RISK_LEVELS.has(risk))
      throw new RouteError(400, "Invalid audit risk level.");
    if (!ALLOWED_SORT_FIELDS.has(sort))
      throw new RouteError(400, "Invalid audit sort field.");
    if (direction !== "asc" && direction !== "desc")
      throw new RouteError(400, "Invalid audit sort direction.");
    const { fromIso, toExclusive } = dateBounds(
      single(params, "from"),
      single(params, "to"),
    );
    // entity_id is commonly a UUID; ilike against that column is not supported.
    const searchFilter = search
      ? [
          "action_code",
          "action_label",
          "admin_name",
          "lottery_title",
          "entity_type",
        ]
          .map((field) => `${field}.ilike.%${search}%`)
          .join(",")
      : "";

    // Every table/count query shares exactly the same filters. GET never inserts
    // audit entries; historic read/export/denied entries remain in the database.
    const base = (columns: string, head = false) => {
      let query = db
        .from("lottery_audit_logs")
        .select(columns, { count: "exact", head })
        .abortSignal(controller.signal);
      if (group) query = query.eq("action_group", group);
      if (risk) query = query.eq("risk_level", risk);
      if (fromIso) query = query.gte("created_at", fromIso);
      if (toExclusive) query = query.lt("created_at", toExclusive);
      if (searchFilter) query = query.or(searchFilter);
      return query;
    };
    stage = "audit_queries";
    let pageQuery = base(
      "id,created_at,admin_id,admin_name,action_code,action_label,action_group,risk_level,lottery_id,lottery_title,entity_type,entity_id",
    ).order(sort, { ascending: direction === "asc", nullsFirst: false });
    if (sort !== "created_at")
      pageQuery = pageQuery.order("created_at", {
        ascending: false,
        nullsFirst: false,
      });
    pageQuery = pageQuery
      .order("id", { ascending: false })
      .range(start, start + pageSize - 1);
    const [pageResult, highResult, drawResult] = await Promise.all([
      withSignal(pageQuery, controller.signal),
      withSignal(
        base("id", true).in("risk_level", ["high", "critical"]),
        controller.signal,
      ),
      withSignal(
        base("id", true).eq("action_group", "draw"),
        controller.signal,
      ),
    ]);
    if (
      pageResult.error ||
      highResult.error ||
      drawResult.error ||
      !Array.isArray(pageResult.data) ||
      pageResult.count === null ||
      highResult.count === null ||
      drawResult.count === null
    )
      throw new RouteError(503, "Unable to load lottery audit logs.");
    const logs = pageResult.data.map(projectLog);
    const total = pageResult.count;
    // Independent count statements are not a transaction snapshot; flag races
    // visibly rather than presenting contradictory summary figures.
    if (highResult.count > total || drawResult.count > total)
      throw new RouteError(
        503,
        "Audit records changed while loading. Please refresh.",
      );
    return json(
      {
        logs,
        total,
        page,
        pageSize,
        summary: {
          total,
          highRisk: highResult.count,
          denied: 0,
          exports: 0,
          draws: drawResult.count,
        },
        details_redacted: true,
        date_timezone: "Europe/London",
        summary_scope: "filtered_mutation_records",
        pagination: {
          has_more: start + logs.length < total,
          next_page:
            start + pageSize < total && start + pageSize <= MAX_OFFSET
              ? page + 1
              : null,
        },
      },
      requestId,
    );
  } catch (error) {
    const status = error instanceof RouteError ? error.status : 500;
    if (status >= 500)
      console.error("Lottery audit request failed", {
        request_id: requestId,
        stage,
        status,
      });
    return json(
      {
        error:
          error instanceof RouteError
            ? error.message
            : "Unable to load lottery audit logs.",
      },
      requestId,
      status,
    );
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", cancel);
  }
}
