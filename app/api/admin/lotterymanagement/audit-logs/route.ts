import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedAdmin,
  getAuditServiceClient,
  hasLotteryPermission,
  writeLotteryAudit,
} from "@/lib/lottery/audit-server";
import type { LotteryAuditResponse } from "@/lib/lottery/audit-types";

export const dynamic = "force-dynamic";

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

const ALLOWED_RISK_LEVELS = new Set([
  "low",
  "medium",
  "high",
  "critical",
]);

function positiveInt(
  value: string | null,
  fallback: number,
  max?: number,
) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return max ? Math.min(parsed, max) : parsed;
}

export async function GET(request: NextRequest) {
  try {
    const admin = await getAuthenticatedAdmin();

    if (!admin) {
      return NextResponse.json(
        { error: "You must be signed in to view lottery audit logs." },
        { status: 401 },
      );
    }

    if (!hasLotteryPermission(admin, "lottery:audit:view")) {
      try {
        await writeLotteryAudit({
          admin,
          actionCode: "security.audit_logs.permission_denied",
          actionLabel: "Audit log access denied",
          actionGroup: "security",
          riskLevel: "high",
          entityType: "audit_logs",
          reason:
            "Administrator attempted to access Lottery Audit Logs without the required permission.",
          metadata: {
            requiredPermission: "lottery:audit:view",
          },
        });
      } catch (auditError) {
        console.error(
          "Unable to record lottery audit permission denial:",
          auditError,
        );
      }

      return NextResponse.json(
        { error: "You do not have permission to view lottery audit logs." },
        { status: 403 },
      );
    }

    const searchParams = request.nextUrl.searchParams;

    const page = positiveInt(searchParams.get("page"), 1);
    const pageSize = positiveInt(
      searchParams.get("pageSize"),
      25,
      100,
    );

    const search = searchParams.get("search")?.trim() ?? "";
    const group = searchParams.get("group")?.trim() ?? "";
    const risk = searchParams.get("risk")?.trim() ?? "";
    const from = searchParams.get("from")?.trim() ?? "";
    const to = searchParams.get("to")?.trim() ?? "";

    const requestedSort =
      searchParams.get("sort")?.trim() ?? "created_at";

    const sort = ALLOWED_SORT_FIELDS.has(requestedSort)
      ? requestedSort
      : "created_at";

    const direction =
      searchParams.get("direction") === "asc" ? "asc" : "desc";

    if (group && !ALLOWED_GROUPS.has(group)) {
      return NextResponse.json(
        { error: "Invalid audit action group." },
        { status: 400 },
      );
    }

    if (risk && !ALLOWED_RISK_LEVELS.has(risk)) {
      return NextResponse.json(
        { error: "Invalid audit risk level." },
        { status: 400 },
      );
    }

    const db = getAuditServiceClient();

    let query = db
      .from("lottery_audit_logs")
      .select(
        `
          id,
          created_at,
          admin_id,
          admin_email,
          admin_name,
          action_code,
          action_label,
          action_group,
          risk_level,
          lottery_id,
          lottery_title,
          entity_type,
          entity_id,
          reason,
          ip_address,
          device_context,
          before_data,
          after_data,
          metadata
        `,
        { count: "exact" },
      );

    if (group) {
      query = query.eq("action_group", group);
    }

    if (risk) {
      query = query.eq("risk_level", risk);
    }

    if (from) {
      const fromDate = new Date(`${from}T00:00:00.000Z`);

      if (Number.isNaN(fromDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid from date." },
          { status: 400 },
        );
      }

      query = query.gte("created_at", fromDate.toISOString());
    }

    if (to) {
      const toDate = new Date(`${to}T23:59:59.999Z`);

      if (Number.isNaN(toDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid to date." },
          { status: 400 },
        );
      }

      query = query.lte("created_at", toDate.toISOString());
    }

    if (search) {
      const safeSearch = search
        .replace(/[%_]/g, "")
        .replace(/[(),]/g, " ")
        .trim();

      if (safeSearch) {
        query = query.or(
          [
            `action_code.ilike.%${safeSearch}%`,
            `action_label.ilike.%${safeSearch}%`,
            `admin_name.ilike.%${safeSearch}%`,
            `admin_email.ilike.%${safeSearch}%`,
            `lottery_title.ilike.%${safeSearch}%`,
            `entity_type.ilike.%${safeSearch}%`,
            `entity_id.ilike.%${safeSearch}%`,
            `reason.ilike.%${safeSearch}%`,
          ].join(","),
        );
      }
    }

    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;

    const {
      data: logs,
      error,
      count,
    } = await query
      .order(sort, {
        ascending: direction === "asc",
      })
      .range(start, end);

    if (error) {
      console.error("Lottery audit logs query error:", error);

      return NextResponse.json(
        { error: "Unable to load lottery audit logs." },
        { status: 500 },
      );
    }

    /*
     * Summary cards deliberately respect the currently applied filters
     * except for the risk/group-specific summary calculations.
     */
    let summaryBase = db
      .from("lottery_audit_logs")
      .select("id, action_group, action_code, risk_level");

    if (group) {
      summaryBase = summaryBase.eq("action_group", group);
    }

    if (risk) {
      summaryBase = summaryBase.eq("risk_level", risk);
    }

    if (from) {
      summaryBase = summaryBase.gte(
        "created_at",
        new Date(`${from}T00:00:00.000Z`).toISOString(),
      );
    }

    if (to) {
      summaryBase = summaryBase.lte(
        "created_at",
        new Date(`${to}T23:59:59.999Z`).toISOString(),
      );
    }

    const { data: summaryRows, error: summaryError } =
      await summaryBase;

    if (summaryError) {
      console.error(
        "Lottery audit summary query error:",
        summaryError,
      );
    }

    const rows = summaryRows ?? [];

    const response: LotteryAuditResponse = {
      logs: logs ?? [],
      total: count ?? 0,
      page,
      pageSize,
      summary: {
        total: count ?? 0,

        highRisk: rows.filter(
          (row) =>
            row.risk_level === "high" ||
            row.risk_level === "critical",
        ).length,

        denied: rows.filter(
          (row) =>
            row.action_group === "security" &&
            row.action_code
              ?.toLowerCase()
              .includes("permission_denied"),
        ).length,

        exports: rows.filter(
          (row) => row.action_group === "export",
        ).length,

        draws: rows.filter(
          (row) => row.action_group === "draw",
        ).length,
      },
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  } catch (error) {
    console.error("Lottery audit logs API error:", error);

    return NextResponse.json(
      { error: "Unable to load lottery audit logs." },
      { status: 500 },
    );
  }
}