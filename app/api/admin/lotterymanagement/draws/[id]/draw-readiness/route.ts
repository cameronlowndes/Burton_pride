import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedAdmin,
  getAuditServiceClient,
  hasLotteryPermission,
} from "@/lib/lottery/audit-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function failedResponse(error: unknown, requestId: string) {
  console.error(`[${requestId}] Draw readiness API error:`, error);
  return json(
    {
      ok: false,
      error: "Unable to complete the draw readiness checks.",
      request_id: requestId,
      details: {
        error_name: error instanceof Error ? error.name : "UnknownError",
        error_message: error instanceof Error ? error.message : "Unknown error",
      },
    },
    500,
  );
}

/*
 * GET /api/admin/lottery/draws/[id]/draw-readiness
 *
 * Read-only pre-draw check. It does not freeze tickets, select winners,
 * write an audit row, or change lottery status. The draw POST route must
 * repeat these checks immediately before it freezes the ticket pool.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  const requestId = `DRAW-READY-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

  try {
    const admin = await getAuthenticatedAdmin();

    if (!admin) {
      return json(
        { ok: false, error: "You must be signed in to view draw readiness.", request_id: requestId },
        401,
      );
    }

    if (!hasLotteryPermission(admin, "lottery:view")) {
      return json(
        { ok: false, error: "You do not have permission to view draw readiness.", request_id: requestId },
        403,
      );
    }

    const { id: rawId } = await context.params;
    const lotteryId = decodeURIComponent(rawId).trim();

    if (!isUuid(lotteryId)) {
      return json(
        { ok: false, error: "The lottery ID is invalid.", request_id: requestId },
        400,
      );
    }

    const db = getAuditServiceClient();
    const { data: lottery, error: lotteryError } = await db
      .from("lotteries")
      .select("id,title,internal_reference,status,draw_at,sales_close_at")
      .eq("id", lotteryId)
      .maybeSingle();

    if (lotteryError) {
      return failedResponse(lotteryError, requestId);
    }

    if (!lottery) {
      return json(
        { ok: false, error: "Lottery not found.", request_id: requestId },
        404,
      );
    }

    const [ordersResult, ticketsResult, prizesResult, warningsResult, drawsResult] =
      await Promise.all([
        db
          .from("lottery_orders")
          .select("id,payment_status")
          .eq("lottery_id", lotteryId),
        db.from("lottery_tickets").select("id,status").eq("lottery_id", lotteryId),
        db.from("lottery_prizes").select("id,status").eq("lottery_id", lotteryId),
        db
          .from("lottery_integrity_warnings")
          // This table records active warnings only. Do not query a status
          // field here: older Lottery Management schemas do not have one.
          .select("id,severity")
          .eq("lottery_id", lotteryId),
        db
          .from("lottery_draws")
          .select("id,status,completed_at")
          .eq("lottery_id", lotteryId),
      ]);

    const queryError = [ordersResult, ticketsResult, prizesResult, warningsResult, drawsResult]
      .find((result) => result.error)?.error;

    if (queryError) {
      return failedResponse(queryError, requestId);
    }

    const paidOrders = (ordersResult.data ?? []).filter(
      (order) => order.payment_status === "paid",
    );
    const eligibleTickets = (ticketsResult.data ?? []).filter(
      (ticket) => !["void", "cancelled", "invalid", "excluded"].includes(ticket.status ?? ""),
    );
    const excludedTickets = (ticketsResult.data ?? []).length - eligibleTickets.length;
    const availablePrizes = (prizesResult.data ?? []).filter(
      (prize) => ["confirmed", "available_for_draw"].includes(prize.status ?? ""),
    );
    const unresolvedWarnings = warningsResult.data ?? [];
    const completedDraw = (drawsResult.data ?? []).find(
      (draw) => draw.status === "completed" || Boolean(draw.completed_at),
    );

    const now = Date.now();
    const salesClosedAt = lottery.sales_close_at
      ? new Date(lottery.sales_close_at).getTime()
      : Number.NaN;
    const salesAreClosed =
      ["sales_closed", "draw_ready"].includes(lottery.status) ||
      (Number.isFinite(salesClosedAt) && salesClosedAt <= now);
    const drawStateAllowsRun = !["paused", "cancelled", "under_review", "archived", "completed"].includes(
      lottery.status,
    );
    const drawTimeSet = Boolean(lottery.draw_at);

    const checks = [
      {
        key: "sales_closed",
        label: "Ticket sales are closed",
        ok: salesAreClosed,
        detail: salesAreClosed
          ? "The sales window is closed."
          : "Sales must close before the draw can run.",
      },
      {
        key: "lottery_state",
        label: "Lottery is in a drawable state",
        ok: drawStateAllowsRun,
        detail: drawStateAllowsRun
          ? `Current lottery status: ${lottery.status.replaceAll("_", " ")}.`
          : `The lottery is ${lottery.status.replaceAll("_", " ")} and cannot be drawn.`,
      },
      {
        key: "draw_time",
        label: "A draw date and time is set",
        ok: drawTimeSet,
        detail: drawTimeSet ? "A draw date is recorded." : "Set the draw date before running the draw.",
      },
      {
        key: "payments",
        label: "At least one paid order exists",
        ok: paidOrders.length > 0,
        detail: paidOrders.length ? `${paidOrders.length} paid order(s) found.` : "No paid orders were found.",
      },
      {
        key: "tickets",
        label: "Eligible issued tickets are available",
        ok: eligibleTickets.length > 0,
        detail: eligibleTickets.length
          ? `${eligibleTickets.length} eligible ticket(s) found.`
          : "No eligible issued tickets were found.",
      },
      {
        key: "prizes",
        label: "Available prizes are ready for the draw",
        ok: availablePrizes.length > 0,
        detail: availablePrizes.length
          ? `${availablePrizes.length} available prize(s) found.`
          : "Add and confirm at least one prize before drawing.",
      },
      {
        key: "integrity_warnings",
        label: "No unresolved integrity warnings",
        ok: unresolvedWarnings.length === 0,
        detail: unresolvedWarnings.length
          ? `${unresolvedWarnings.length} unresolved warning(s) must be reviewed.`
          : "No unresolved integrity warnings were found.",
      },
      {
        key: "previous_draw",
        label: "No completed draw already exists",
        ok: !completedDraw,
        detail: completedDraw
          ? "A completed draw already exists for this lottery. Use the redraw process if appropriate."
          : "No completed draw exists.",
      },
    ];

    return json({
      ok: true,
      request_id: requestId,
      lottery: {
        id: lottery.id,
        title: lottery.title,
        internal_reference: lottery.internal_reference,
        draw_at: lottery.draw_at,
        sales_close_at: lottery.sales_close_at,
      },
      metrics: {
        paid_orders: paidOrders.length,
        eligible_tickets: eligibleTickets.length,
        excluded_tickets: excludedTickets,
        prizes_available: availablePrizes.length,
      },
      ready: checks.every((check) => check.ok),
      checks,
    });
  } catch (error) {
    return failedResponse(error, requestId);
  }
}
