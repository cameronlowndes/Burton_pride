import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { writeStockAuditLog } from "@/lib/stockManagement/writeStockAuditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminIdentity = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  is_main_admin?: boolean | null;
};

const ALLOWED_STATUSES = new Set([
  "success",
  "failed",
  "blocked",
  "warning",
  "pending",
  "cancelled",
]);

const ALLOWED_RISKS = new Set([
  "low",
  "medium",
  "high",
  "critical",
]);

const ALLOWED_SORTS = new Set([
  "newest",
  "oldest",
  "risk",
  "failed",
  "admin",
  "action",
  "module",
]);

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : fallback;
}

function safeDate(value: string | null) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString();
}

function escapeSearchTerm(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_")
    .replaceAll(",", " ");
}

function riskRank(value: string) {
  if (value === "critical") return 4;
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function adminCanViewAudit(admin: AdminIdentity) {
  const role = clean(admin.role).toLowerCase();

  return (
    Boolean(admin.is_main_admin) ||
    role === "main_admin" ||
    role === "admin"
  );
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const admin = (await getCurrentAdmin()) as AdminIdentity | null;

  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Unauthorised" },
      { status: 401 },
    );
  }

  if (!adminCanViewAudit(admin)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Main administrator or administrator access is required to view stock audit logs.",
      },
      { status: 403 },
    );
  }

  const params = request.nextUrl.searchParams;

  const search = clean(params.get("search"));
  const module = clean(params.get("module"));
  const action = clean(params.get("action"));
  const status = clean(params.get("status"));
  const risk = clean(params.get("risk"));
  const adminId = clean(params.get("adminId"));
  const recordType = clean(params.get("recordType"));
  const recordId = clean(params.get("recordId"));
  const dateFrom = safeDate(params.get("dateFrom"));
  const dateTo = safeDate(params.get("dateTo"));
  const sort = ALLOWED_SORTS.has(clean(params.get("sort")))
    ? clean(params.get("sort"))
    : "newest";

  const page = positiveInteger(params.get("page"), 1);
  const pageSize = Math.min(
    positiveInteger(params.get("pageSize"), 50),
    200,
  );

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabaseAdmin
    .from("stock_audit_logs")
    .select("*", { count: "exact" });

  if (module && module !== "all") {
    query = query.eq("module", module);
  }

  if (action && action !== "all") {
    query = query.eq("action_key", action);
  }

  if (status && status !== "all" && ALLOWED_STATUSES.has(status)) {
    query = query.eq("status", status);
  }

  if (risk && risk !== "all" && ALLOWED_RISKS.has(risk)) {
    query = query.eq("risk_level", risk);
  }

  if (adminId && adminId !== "all") {
    query = query.eq("admin_id", adminId);
  }

  if (recordType && recordType !== "all") {
    query = query.eq("record_type", recordType);
  }

  if (recordId) {
    query = query.eq("record_id", recordId);
  }

  if (dateFrom) {
    query = query.gte("occurred_at", dateFrom);
  }

  if (dateTo) {
    query = query.lte("occurred_at", dateTo);
  }

  if (search) {
    const term = escapeSearchTerm(search);

    query = query.or(
      [
        `admin_name.ilike.%${term}%`,
        `admin_email.ilike.%${term}%`,
        `action_label.ilike.%${term}%`,
        `action_key.ilike.%${term}%`,
        `module.ilike.%${term}%`,
        `record_name.ilike.%${term}%`,
        `record_reference.ilike.%${term}%`,
        `stock_item_name.ilike.%${term}%`,
        `stock_item_sku.ilike.%${term}%`,
        `location_name.ilike.%${term}%`,
        `supplier_name.ilike.%${term}%`,
        `description.ilike.%${term}%`,
        `reason.ilike.%${term}%`,
        `notes.ilike.%${term}%`,
        `error_code.ilike.%${term}%`,
        `error_message.ilike.%${term}%`,
        `api_endpoint.ilike.%${term}%`,
        `request_id.ilike.%${term}%`,
      ].join(","),
    );
  }

  if (sort === "oldest") {
    query = query.order("occurred_at", { ascending: true });
  } else if (sort === "admin") {
    query = query
      .order("admin_name", { ascending: true })
      .order("occurred_at", { ascending: false });
  } else if (sort === "action") {
    query = query
      .order("action_label", { ascending: true })
      .order("occurred_at", { ascending: false });
  } else if (sort === "module") {
    query = query
      .order("module", { ascending: true })
      .order("occurred_at", { ascending: false });
  } else if (sort === "failed") {
    query = query
      .order("status", { ascending: true })
      .order("occurred_at", { ascending: false });
  } else {
    query = query.order("occurred_at", { ascending: false });
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    await writeStockAuditLog({
      actionKey: "audit_logs_view_failed",
      actionLabel: "Audit logs view failed",
      actionCategory: "view",
      module: "audit",
      status: "failed",
      riskLevel: "medium",
      admin,
      description:
        "The Stock Management audit log page failed to load.",
      request,
      responseStatus: 500,
      durationMs: Date.now() - startedAt,
      error,
    });

    return NextResponse.json(
      {
        ok: false,
        error: "Audit logs could not be loaded",
        code: error.code,
        details: error.details,
        hint: error.hint,
      },
      { status: 500 },
    );
  }

  let logs = Array.isArray(data) ? data : [];

  if (sort === "risk") {
    logs = [...logs].sort(
      (left, right) =>
        riskRank(String(right.risk_level)) -
          riskRank(String(left.risk_level)) ||
        new Date(String(right.occurred_at)).getTime() -
          new Date(String(left.occurred_at)).getTime(),
    );
  }

  const totalRows = Number(count || 0);
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  const summary = {
    totalActions: totalRows,
    successful: logs.filter((log) => log.status === "success").length,
    failed: logs.filter((log) => log.status === "failed").length,
    blocked: logs.filter((log) => log.status === "blocked").length,
    activeAdmins: new Set(
      logs
        .map((log) => log.admin_id || log.admin_email)
        .filter(Boolean),
    ).size,
    highRisk: logs.filter(
      (log) =>
        log.risk_level === "high" ||
        log.risk_level === "critical",
    ).length,
  };

  const [adminsResult, modulesResult, actionsResult] =
    await Promise.all([
      supabaseAdmin
        .from("stock_audit_logs")
        .select("admin_id, admin_name, admin_email")
        .not("admin_email", "is", null)
        .order("admin_name", { ascending: true })
        .limit(500),
      supabaseAdmin
        .from("stock_audit_logs")
        .select("module")
        .not("module", "is", null)
        .limit(500),
      supabaseAdmin
        .from("stock_audit_logs")
        .select("action_key, action_label")
        .not("action_key", "is", null)
        .limit(1000),
    ]);

  const admins = Array.from(
    new Map(
      (adminsResult.data || []).map((row) => [
        row.admin_id || row.admin_email,
        row,
      ]),
    ).values(),
  );

  const modules = Array.from(
    new Set(
      (modulesResult.data || [])
        .map((row) => clean(row.module))
        .filter(Boolean),
    ),
  ).sort();

  const actions = Array.from(
    new Map(
      (actionsResult.data || []).map((row) => [
        row.action_key,
        row,
      ]),
    ).values(),
  ).sort((a, b) =>
    clean(a.action_label).localeCompare(clean(b.action_label)),
  );

  await writeStockAuditLog({
    actionKey: "audit_logs_viewed",
    actionLabel: "Viewed audit logs",
    actionCategory: "view",
    module: "audit",
    status: "success",
    riskLevel: "low",
    admin,
    description:
      "Viewed the Stock Management audit log page.",
    request,
    responseStatus: 200,
    durationMs: Date.now() - startedAt,
    metadata: {
      filters: {
        search,
        module,
        action,
        status,
        risk,
        adminId,
        recordType,
        dateFrom,
        dateTo,
        sort,
        page,
        pageSize,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    logs,
    summary,
    filterOptions: {
      admins,
      modules,
      actions,
    },
    pagination: {
      page,
      pageSize,
      totalRows,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  });
}
