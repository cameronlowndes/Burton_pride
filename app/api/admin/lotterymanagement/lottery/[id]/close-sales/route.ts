import { NextRequest, NextResponse } from "next/server";

import {
  getAuthenticatedAdmin,
  getAuditServiceClient,
  hasLotteryPermission,
  writeLotteryAuditSafe,
} from "@/lib/lottery/audit-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function POST(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const admin = await getAuthenticatedAdmin();

    if (!admin) {
      return response(
        { ok: false, error: "You must be signed in to close lottery sales." },
        401,
      );
    }

    if (!hasLotteryPermission(admin, "lottery:view")) {
      return response(
        { ok: false, error: "You do not have permission to close lottery sales." },
        403,
      );
    }

    const { id: rawId } = await context.params;
    const id = decodeURIComponent(rawId).trim();

    if (!isValidUuid(id)) {
      return response({ ok: false, error: "The lottery ID is invalid." }, 400);
    }

    const db = getAuditServiceClient();
    const { data: existing, error: lookupError } = await db
      .from("lotteries")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (lookupError) {
      console.error("Close lottery sales lookup error:", lookupError);
      return response({ ok: false, error: "Unable to load the lottery." }, 500);
    }

    if (!existing) {
      return response({ ok: false, error: "Lottery not found." }, 404);
    }

    if (existing.status === "sales_closed") {
      return response({
        ok: true,
        message: "Lottery sales are already closed.",
        item: existing,
      });
    }

    if (["archived", "cancelled", "completed"].includes(existing.status)) {
      return response(
        {
          ok: false,
          error: `Sales cannot be closed while the lottery status is ${existing.status}.`,
        },
        409,
      );
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await db
      .from("lotteries")
      .update({
        status: "sales_closed",
        sales_close_at: now,
        updated_at: now,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      console.error("Close lottery sales update error:", updateError);
      return response(
        {
          ok: false,
          error: "Unable to close lottery sales.",
          code: updateError.code,
        },
        500,
      );
    }

    await writeLotteryAuditSafe({
      admin,
      actionCode: "lottery.sales.closed",
      actionLabel: "Lottery sales closed",
      actionGroup: "lottery",
      riskLevel: "high",
      entityType: "lottery",
      entityId: updated.id,
      reason: `Ticket sales for lottery "${updated.title}" were closed.`,
    });

    return response({
      ok: true,
      message: "Lottery sales closed successfully.",
      item: updated,
    });
  } catch (error) {
    console.error("Close lottery sales API error:", error);
    return response({ ok: false, error: "Unable to close lottery sales." }, 500);
  }
}
