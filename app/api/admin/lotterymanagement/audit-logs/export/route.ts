import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedAdmin,
  getAuditServiceClient,
  hasLotteryPermission,
  writeLotteryAudit,
} from "@/lib/lottery/audit-server";

export const dynamic = "force-dynamic";

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

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  let text =
    typeof value === "object"
      ? JSON.stringify(value)
      : String(value);

  /*
   * Prevent spreadsheet formula injection when the CSV
   * is opened in Excel/LibreOffice.
   */
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  try {
    const admin = await getAuthenticatedAdmin();

    if (!admin) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 },
      );
    }

    if (!hasLotteryPermission(admin, "lottery:export")) {
      try {
        await writeLotteryAudit({
          admin,
          actionCode:
            "security.audit_export.permission_denied",
          actionLabel: "Audit export denied",
          actionGroup: "security",
          riskLevel: "high",
          entityType: "audit_export",
          reason:
            "Administrator attempted to export lottery audit logs without the required permission.",
          metadata: {
            requiredPermission: "lottery:export",
          },
        });
      } catch (auditError) {
        console.error(
          "Unable to write export permission denial:",
          auditError,
        );
      }

      return NextResponse.json(
        {
          error:
            "You do not have permission to export lottery audit logs.",
        },
        { status: 403 },
      );
    }

    /*
     * Viewing audit logs is also required. An export permission
     * should not accidentally bypass the normal audit-view control.
     */
    if (
      !hasLotteryPermission(admin, "lottery:audit:view")
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to view lottery audit logs.",
        },
        { status: 403 },
      );
    }

    const params = request.nextUrl.searchParams;

    const search = params.get("search")?.trim() ?? "";
    const group = params.get("group")?.trim() ?? "";
    const risk = params.get("risk")?.trim() ?? "";
    const from = params.get("from")?.trim() ?? "";
    const to = params.get("to")?.trim() ?? "";

    if (group && !ALLOWED_GROUPS.has(group)) {
      return NextResponse.json(
        { error: "Invalid action group." },
        { status: 400 },
      );
    }

    if (risk && !ALLOWED_RISK_LEVELS.has(risk)) {
      return NextResponse.json(
        { error: "Invalid risk level." },
        { status: 400 },
      );
    }

    const db = getAuditServiceClient();

    let query = db
      .from("lottery_audit_logs")
      .select(`
        id,
        created_at,
        admin_id,
        admin_email,
        admin_name,
        action_group,
        action_code,
        action_label,
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
      `)
      .order("created_at", {
        ascending: false,
      })
      .limit(10000);

    if (group) {
      query = query.eq("action_group", group);
    }

    if (risk) {
      query = query.eq("risk_level", risk);
    }

    if (from) {
      const fromDate = new Date(
        `${from}T00:00:00.000Z`,
      );

      if (Number.isNaN(fromDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid from date." },
          { status: 400 },
        );
      }

      query = query.gte(
        "created_at",
        fromDate.toISOString(),
      );
    }

    if (to) {
      const toDate = new Date(
        `${to}T23:59:59.999Z`,
      );

      if (Number.isNaN(toDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid to date." },
          { status: 400 },
        );
      }

      query = query.lte(
        "created_at",
        toDate.toISOString(),
      );
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

    const { data, error } = await query;

    if (error) {
      console.error(
        "Lottery audit export query error:",
        error,
      );

      return NextResponse.json(
        { error: "Unable to export lottery audit logs." },
        { status: 500 },
      );
    }

    const rows = data ?? [];

    const headings = [
      "Audit ID",
      "Date / Time",
      "Admin ID",
      "Admin Name",
      "Admin Email",
      "Action Group",
      "Action Code",
      "Action",
      "Risk",
      "Lottery ID",
      "Lottery",
      "Entity Type",
      "Entity ID",
      "Reason",
      "IP Address",
      "Device Context",
      "Before Data",
      "After Data",
      "Metadata",
    ];

    const csvRows = [
      headings.map(csvEscape).join(","),
      ...rows.map((row) =>
        [
          row.id,
          row.created_at,
          row.admin_id,
          row.admin_name,
          row.admin_email,
          row.action_group,
          row.action_code,
          row.action_label,
          row.risk_level,
          row.lottery_id,
          row.lottery_title,
          row.entity_type,
          row.entity_id,
          row.reason,
          row.ip_address,
          row.device_context,
          row.before_data,
          row.after_data,
          row.metadata,
        ]
          .map(csvEscape)
          .join(","),
      ),
    ];

    const csv = `\uFEFF${csvRows.join("\r\n")}`;

    /*
     * Write the export audit record AFTER the data has
     * successfully been built.
     */
    await writeLotteryAudit({
      admin,
      actionCode: "export.audit_logs.csv",
      actionLabel: "Lottery audit logs exported",
      actionGroup: "export",
      riskLevel: "high",
      entityType: "audit_logs",
      reason:
        "Administrator exported Lottery Management audit records.",
      metadata: {
        format: "csv",
        exportedRows: rows.length,
        filters: {
          search: search || null,
          group: group || null,
          risk: risk || null,
          from: from || null,
          to: to || null,
        },
      },
    });

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type":
          "text/csv; charset=utf-8",
        "Content-Disposition":
          `attachment; filename="burton-pride-lottery-audit-${timestamp}.csv"`,
        "Cache-Control":
          "no-store, no-cache, must-revalidate, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(
      "Lottery audit export API error:",
      error,
    );

    return NextResponse.json(
      { error: "Unable to export lottery audit logs." },
      { status: 500 },
    );
  }
}