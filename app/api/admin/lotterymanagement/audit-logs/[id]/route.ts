import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedAdmin,
  getAuditServiceClient,
  hasLotteryPermission,
  writeLotteryAudit,
} from "@/lib/lottery/audit-server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const admin = await getAuthenticatedAdmin();

    if (!admin) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 },
      );
    }

    if (!hasLotteryPermission(admin, "lottery:audit:view")) {
      try {
        await writeLotteryAudit({
          admin,
          actionCode:
            "security.audit_log_record.permission_denied",
          actionLabel: "Audit record access denied",
          actionGroup: "security",
          riskLevel: "high",
          entityType: "audit_log",
          reason:
            "Administrator attempted to view a Lottery Audit Log record without permission.",
        });
      } catch (auditError) {
        console.error(
          "Unable to write audit permission denial:",
          auditError,
        );
      }

      return NextResponse.json(
        {
          error:
            "You do not have permission to view lottery audit records.",
        },
        { status: 403 },
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Audit log ID is required." },
        { status: 400 },
      );
    }

    const db = getAuditServiceClient();

    const { data, error } = await db
      .from("lottery_audit_logs")
      .select(`
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
      `)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error(
        "Lottery individual audit query error:",
        error,
      );

      return NextResponse.json(
        { error: "Unable to load the audit record." },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Audit record not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        data,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error(
      "Lottery individual audit API error:",
      error,
    );

    return NextResponse.json(
      { error: "Unable to load the audit record." },
      { status: 500 },
    );
  }
}