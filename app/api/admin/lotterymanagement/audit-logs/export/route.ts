import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

const EXPORT_LIMIT = 10000;
const EXPORT_BYTES = 8 * 1024 * 1024;
const BATCH_SIZE = 200;
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

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // Account for leading whitespace/BOM/controls, which spreadsheet imports
  // can trim before evaluating a formula. Never export unrestricted JSON.
  if (
    /^[\s\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]*[=+\-@]/u.test(
      text,
    ) ||
    /^[\u0000-\u001f\u007f-\u009f]/u.test(text)
  )
    text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

export async function GET(request: NextRequest) {
  const requestId = randomUUID();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
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
        "You must be signed in to export lottery audit logs.",
      );
    const { supabaseAdmin: db } = await import("@/lib/supabase/supabaseAdmin");
    stage = "authorization";
    const adminResult = await withSignal(
      db
        .from("admin_users")
        .select("id,supabase_user_id,role,is_active,email,full_name")
        .eq("supabase_user_id", data.user.id)
        .eq("is_active", true)
        .abortSignal(controller.signal)
        .maybeSingle(),
      controller.signal,
    );
    if (adminResult.error)
      throw new RouteError(
        503,
        "Lottery audit exports are temporarily unavailable.",
      );
    const admin = adminResult.data;
    // Conservative role restriction: do not use the cookie-trusting audit helper.
    // Integrate BOTH lottery:audit:view and lottery:export with the verified
    // central guard, plus recent second-factor verification, when supplied.
    if (
      !admin ||
      admin.supabase_user_id !== data.user.id ||
      admin.is_active !== true ||
      admin.role !== "main_admin"
    )
      throw new RouteError(
        403,
        "You do not have permission to export lottery audit logs.",
      );

    stage = "validation";
    const params = request.nextUrl.searchParams;
    const search = safeAuditSearch(single(params, "search"));
    const group = single(params, "group"),
      risk = single(params, "risk");
    if (group && !ALLOWED_GROUPS.has(group))
      throw new RouteError(400, "Invalid audit action group.");
    if (risk && !ALLOWED_RISK_LEVELS.has(risk))
      throw new RouteError(400, "Invalid audit risk level.");
    // Export the complete filtered set in a fixed order, not a table page.
    for (const key of [
      "page",
      "pageSize",
      "offset",
      "limit",
      "sort",
      "direction",
    ]) {
      if (params.has(key))
        throw new RouteError(
          400,
          "Exports use the search, group, risk, from and to filters only.",
        );
    }
    const { fromIso, toExclusive } = dateBounds(
      single(params, "from"),
      single(params, "to"),
    );
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
    const snapshot = new Date().toISOString();
    const base = (columns: string, head = false) => {
      let query = db
        .from("lottery_audit_logs")
        .select(columns, { count: "exact", head })
        .lte("created_at", snapshot)
        .abortSignal(controller.signal);
      if (group) query = query.eq("action_group", group);
      if (risk) query = query.eq("risk_level", risk);
      if (fromIso) query = query.gte("created_at", fromIso);
      if (toExclusive) query = query.lt("created_at", toExclusive);
      if (searchFilter) query = query.or(searchFilter);
      return query;
    };
    stage = "export_size";
    const countResult = await withSignal(base("id", true), controller.signal);
    if (countResult.error || countResult.count === null)
      throw new RouteError(503, "Unable to count lottery audit records.");
    const total = countResult.count;
    if (!Number.isSafeInteger(total) || total < 0)
      throw new RouteError(503, "Unable to count lottery audit records.");
    if (total > EXPORT_LIMIT)
      throw new RouteError(
        413,
        "Too many audit records to export. Narrow the date or search filters to 10,000 records or fewer.",
      );

    const headings = [
      "Audit ID",
      "Date / Time (UTC)",
      "Admin ID",
      "Admin Name",
      "Action Group",
      "Action Code",
      "Action",
      "Risk",
      "Lottery ID",
      "Lottery",
      "Entity Type",
      "Entity ID",
    ];
    const lines = [headings.map(csvEscape).join(",")];
    let bytes = Buffer.byteLength(lines[0], "utf8") + 3;
    let exported = 0;
    const seen = new Set<string>();
    stage = "export_records";
    for (let start = 0; start < total; start += BATCH_SIZE) {
      const expected = Math.min(BATCH_SIZE, total - start);
      const result = await withSignal(
        base(
          "id,created_at,admin_id,admin_name,action_code,action_label,action_group,risk_level,lottery_id,lottery_title,entity_type,entity_id",
        )
          .order("created_at", { ascending: false, nullsFirst: false })
          .order("id", { ascending: false })
          .range(start, start + expected - 1),
        controller.signal,
      );
      // Detect row caps and concurrent changes instead of shipping partial data.
      if (
        result.error ||
        result.count !== total ||
        !Array.isArray(result.data) ||
        result.data.length !== expected
      )
        throw new RouteError(
          503,
          "Audit records changed or could not be fully loaded. Please try again.",
        );
      for (const raw of result.data) {
        const row = projectLog(raw);
        if (!row.id || seen.has(row.id))
          throw new RouteError(
            503,
            "Audit records changed while preparing the export. Please try again.",
          );
        seen.add(row.id);
        const line = [
          row.id,
          row.created_at,
          row.admin_id,
          row.admin_name,
          row.action_group,
          row.action_code,
          row.action_label,
          row.risk_level,
          row.lottery_id,
          row.lottery_title,
          row.entity_type,
          row.entity_id,
        ]
          .map(csvEscape)
          .join(",");
        bytes += Buffer.byteLength(line, "utf8") + 2;
        if (bytes > EXPORT_BYTES)
          throw new RouteError(
            413,
            "The export is too large. Narrow the date or search filters.",
          );
        lines.push(line);
        exported++;
      }
    }
    if (exported !== total)
      throw new RouteError(503, "Unable to prepare a complete audit export.");
    const csv = "\uFEFF" + lines.join("\r\n");

    stage = "export_audit";
    // Preserve the existing successful-export audit, bound to the verified DB
    // administrator. Do not call the best-effort helper. Nothing is downloaded
    // unless this write succeeds; denied requests and ordinary views create no log.
    // This records preparation, not proof that the browser completed a download.
    const auditResult = await withSignal(
      db
        .from("lottery_audit_logs")
        .insert({
          admin_id: admin.id,
          admin_email: admin.email ?? null,
          admin_name: admin.full_name ?? null,
          action_code: "export.audit_logs.csv",
          action_label: "Lottery audit CSV prepared for download",
          action_group: "export",
          risk_level: "high",
          entity_type: "audit_logs",
          reason:
            "Administrator prepared a redacted Lottery Management audit export.",
          before_data: {},
          after_data: {},
          device_context: {},
          metadata: {
            format: "csv",
            preparedRows: exported,
            request_id: requestId,
            details_redacted: true,
            date_timezone: "Europe/London",
            snapshot_at: snapshot,
            filters: {
              group: group || null,
              risk: risk || null,
              from: single(params, "from") || null,
              to: single(params, "to") || null,
              search_applied: !!search,
            },
          },
        })
        .abortSignal(controller.signal),
      controller.signal,
    );
    if (auditResult.error)
      throw new RouteError(
        503,
        "Unable to record the audit export. No file has been released.",
      );
    if (controller.signal.aborted)
      throw new RouteError(
        503,
        "Lottery audit exports are temporarily unavailable.",
      );
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="burton-pride-lottery-audit-${stamp}.csv"`,
        "Cache-Control":
          "private, no-store, no-cache, must-revalidate, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "X-Request-ID": requestId,
        Vary: "Cookie, Authorization",
        "X-Export-Row-Count": String(exported),
        "X-Export-Details-Redacted": "true",
      },
    });
  } catch (error) {
    const status = error instanceof RouteError ? error.status : 500;
    if (status >= 500)
      console.error("Lottery audit export request failed", {
        request_id: requestId,
        stage,
        status,
      });
    return json(
      {
        error:
          error instanceof RouteError
            ? error.message
            : "Unable to export lottery audit logs.",
      },
      requestId,
      status,
    );
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", cancel);
  }
}
