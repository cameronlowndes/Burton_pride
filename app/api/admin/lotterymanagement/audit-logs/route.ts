import { NextRequest, NextResponse } from "next/server";

import {
  getAuthenticatedAdmin,
  getAuditServiceClient,
  hasLotteryPermission,
} from "@/lib/lottery/audit-server";
import type {
  LotteryAuditResponse,
} from "@/lib/lottery/audit-types";

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
]);

const ALLOWED_RISK_LEVELS = new Set([
  "low",
  "medium",
  "high",
  "critical",
]);

// Historical read-only entries are kept in the database, but this endpoint
// only returns actions that changed lottery data.
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

function safeAuditSearch(value: string): string {
  return value
    .replace(/[^\p{L}\p{N}\s@._+-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function parseDateBoundary(
  value: string,
  endOfDay: boolean,
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0,
    ),
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date.toISOString();
}

export async function GET(request: NextRequest) {
  try {
    const admin = await getAuthenticatedAdmin();

    if (!admin) {
      return NextResponse.json(
        {
          error:
            "You must be signed in to view lottery audit logs.",
        },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (
      !hasLotteryPermission(
        admin,
        "lottery:audit:view",
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to view lottery audit logs.",
        },
        {
          status: 403,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const searchParams = request.nextUrl.searchParams;

    const page = positiveInt(
      searchParams.get("page"),
      1,
    );
    const pageSize = positiveInt(
      searchParams.get("pageSize"),
      25,
      100,
    );

    const search =
      searchParams.get("search")?.trim() ?? "";
    const safeSearch = safeAuditSearch(search);
    const group =
      searchParams.get("group")?.trim() ?? "";
    const risk =
      searchParams.get("risk")?.trim() ?? "";
    const from =
      searchParams.get("from")?.trim() ?? "";
    const to =
      searchParams.get("to")?.trim() ?? "";

    const requestedSort =
      searchParams.get("sort")?.trim() ??
      "created_at";

    const sort = ALLOWED_SORT_FIELDS.has(
      requestedSort,
    )
      ? requestedSort
      : "created_at";

    const direction =
      searchParams.get("direction") === "asc"
        ? "asc"
        : "desc";

    if (group && !ALLOWED_GROUPS.has(group)) {
      return NextResponse.json(
        { error: "Invalid audit action group." },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (risk && !ALLOWED_RISK_LEVELS.has(risk)) {
      return NextResponse.json(
        { error: "Invalid audit risk level." },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const fromIso = from
      ? parseDateBoundary(from, false)
      : null;
    const toIso = to
      ? parseDateBoundary(to, true)
      : null;

    if (from && !fromIso) {
      return NextResponse.json(
        { error: "Invalid from date." },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (to && !toIso) {
      return NextResponse.json(
        { error: "Invalid to date." },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (
      fromIso &&
      toIso &&
      new Date(fromIso).getTime() >
        new Date(toIso).getTime()
    ) {
      return NextResponse.json(
        {
          error:
            "The from date must be before the to date.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const searchFilter = safeSearch
      ? [
          `action_code.ilike.%${safeSearch}%`,
          `action_label.ilike.%${safeSearch}%`,
          `admin_name.ilike.%${safeSearch}%`,
          `admin_email.ilike.%${safeSearch}%`,
          `lottery_title.ilike.%${safeSearch}%`,
          `entity_type.ilike.%${safeSearch}%`,
          `entity_id.ilike.%${safeSearch}%`,
          `reason.ilike.%${safeSearch}%`,
        ].join(",")
      : "";

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
      )
      .neq("action_group", "export")
      .not(
        "action_code",
        "in",
        READ_ONLY_ACTION_CODES_FILTER,
      );

    if (group) {
      query = query.eq("action_group", group);
    }

    if (risk) {
      query = query.eq("risk_level", risk);
    }

    if (fromIso) {
      query = query.gte("created_at", fromIso);
    }

    if (toIso) {
      query = query.lte("created_at", toIso);
    }

    if (searchFilter) {
      query = query.or(searchFilter);
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
      throw new Error(
        `Lottery audit logs query failed: ${error.message}`,
      );
    }

    /*
     * Summary cards use the same group, risk, date and search filters
     * as the table results.
     */
    let summaryBase = db
      .from("lottery_audit_logs")
      .select(
        "id, created_at, action_group, action_code, risk_level",
      )
      .neq("action_group", "export")
      .not(
        "action_code",
        "in",
        READ_ONLY_ACTION_CODES_FILTER,
      );

    if (group) {
      summaryBase = summaryBase.eq(
        "action_group",
        group,
      );
    }

    if (risk) {
      summaryBase = summaryBase.eq(
        "risk_level",
        risk,
      );
    }

    if (fromIso) {
      summaryBase = summaryBase.gte(
        "created_at",
        fromIso,
      );
    }

    if (toIso) {
      summaryBase = summaryBase.lte(
        "created_at",
        toIso,
      );
    }

    if (searchFilter) {
      summaryBase = summaryBase.or(searchFilter);
    }

    const {
      data: summaryRows,
      error: summaryError,
    } = await summaryBase;

    if (summaryError) {
      throw new Error(
        `Lottery audit summary query failed: ${summaryError.message}`,
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
        denied: 0,
        exports: 0,
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
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
