import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const READ_ONLY_ACTION_CODES = [
  "security.audit_logs.viewed",
  "security.audit_logs.permission_denied",
  "security.audit_logs.invalid_filter",
  "security.audit_logs.load_failed",
  "export.audit_logs.csv",
  "report.exported",
  "export.exported",
];
const READ_ONLY_ACTION_CODES_FILTER = `(${READ_ONLY_ACTION_CODES.join(",")})`;
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

export async function GET(request: NextRequest, context: RouteContext) {
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
        "You must be signed in to view lottery audit records.",
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
        "Lottery audit records are temporarily unavailable.",
      );
    const admin = adminResult.data;
    // Same conservative authorization as the list route. Integrate the verified
    // central lottery:audit:view guard when its permission storage is supplied.
    // Do not infer identity from administrator cookies or an email fallback.
    if (
      !admin ||
      admin.supabase_user_id !== data.user.id ||
      admin.is_active !== true ||
      admin.role !== "main_admin"
    )
      throw new RouteError(
        403,
        "You do not have permission to view lottery audit records.",
      );

    stage = "validation";
    const params = await withSignal(context.params, controller.signal);
    if (!params || typeof params.id !== "string" || !UUID.test(params.id))
      throw new RouteError(400, "Provide a valid audit record ID.");
    const id = params.id.toLowerCase();
    stage = "audit_record";
    // No view/denial audit writes. Match the list route's historic read/export
    // exclusions and never retrieve IP/device details or arbitrary JSON payloads.
    const result = await withSignal(
      db
        .from("lottery_audit_logs")
        .select(
          "id,created_at,admin_id,admin_name,action_code,action_label,action_group,risk_level,lottery_id,lottery_title,entity_type,entity_id",
        )
        .eq("id", id)
        .neq("action_group", "export")
        .not("action_code", "in", READ_ONLY_ACTION_CODES_FILTER)
        .not("action_code", "ilike", "%.viewed")
        .not("action_code", "ilike", "%.permission_denied")
        .not("action_code", "ilike", "%.invalid_filter")
        .not("action_code", "ilike", "%.load_failed")
        .not("action_code", "ilike", "%.exported")
        .abortSignal(controller.signal)
        .maybeSingle(),
      controller.signal,
    );
    if (result.error)
      throw new RouteError(503, "Unable to load the audit record.");
    if (!result.data) throw new RouteError(404, "Audit record not found.");
    const row = result.data;
    // Retain the same policy at projection time, so this endpoint cannot be used
    // to bypass the list's exclusions by guessing a historical record ID.
    if (
      row.action_group === "export" ||
      READ_ONLY_ACTION_CODES.includes(row.action_code) ||
      /\.(viewed|permission_denied|invalid_filter|load_failed|exported)$/i.test(
        row.action_code,
      )
    )
      throw new RouteError(404, "Audit record not found.");
    if (typeof row.id !== "string" || row.id.toLowerCase() !== id)
      throw new RouteError(503, "Unable to load the audit record.");
    return json(
      { success: true, data: projectLog(row), details_redacted: true },
      requestId,
    );
  } catch (error) {
    const status = error instanceof RouteError ? error.status : 500;
    if (status >= 500)
      console.error("Lottery individual audit request failed", {
        request_id: requestId,
        stage,
        status,
      });
    return json(
      {
        success: false,
        error:
          error instanceof RouteError
            ? error.message
            : "Unable to load the audit record.",
      },
      requestId,
      status,
    );
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", cancel);
  }
}
