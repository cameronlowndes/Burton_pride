import { NextResponse } from "next/server";
import {
  lotteryAdminDb,
  requireLotteryPermission,
} from "@/lib/lottery/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type DrawStatus =
  | "upcoming"
  | "ready"
  | "running"
  | "completed"
  | "under_review"
  | "blocked";

type BlockReason = {
  code: string;
  message: string;
};

const LIST_STATUSES = [
  "scheduled",
  "live",
  "sales_closed",
  "draw_ready",
  "completed",
  "under_review",
];

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

class DrawListQueryError extends Error {
  constructor(
    readonly queryName: string,
    readonly lotteryId: string | null,
    readonly databaseError: unknown,
  ) {
    super(`Could not load ${queryName}.`);
    this.name = "DrawListQueryError";
  }
}

function errorResponse(error: unknown) {
  if (error instanceof DrawListQueryError) {
    console.error("[lottery draw list] Database query failed", {
      query: error.queryName,
      lotteryId: error.lotteryId,
      error: error.databaseError,
    });

    return json(
      {
        error: error.message,
        code: "DRAW_LIST_QUERY_FAILED",
        failed_check: error.queryName,
        lottery_id: error.lotteryId,
      },
      503,
    );
  }

  const candidate =
    typeof error === "object" && error !== null && "status" in error
      ? Number(error.status)
      : 500;

  const status =
    Number.isInteger(candidate) && candidate >= 400 && candidate <= 599
      ? candidate
      : 500;

  if (status >= 500) {
    console.error("[lottery draw list] Request failed", error);
  }

  return json(
    {
      error:
        status >= 500
          ? "The lottery draw list could not be loaded."
          : error instanceof Error
            ? error.message
            : "The request could not be completed.",
    },
    status,
  );
}

function parseDate(value: string | null | undefined): number | null {
  if (!value) return null;

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export async function GET() {
  try {
    await requireLotteryPermission("lottery:view");

    const db = lotteryAdminDb();
    const now = Date.now();

    const { data: lotteries, error } = await db
      .from("lotteries")
      .select(
        "id,title,slug,internal_reference,status,sales_close_at,draw_at",
      )
      .in("status", LIST_STATUSES)
      .order("draw_at", {
        ascending: true,
        nullsFirst: false,
      });

    if (error) {
      throw new DrawListQueryError("lotteries", null, error);
    }

    const items = await Promise.all(
      (lotteries ?? []).map(async (lottery) => {
        const [
          paidOrders,
          eligibleTickets,
          excludedTickets,
          prizes,
          warnings,
          latestDraw,
        ] = await Promise.all([
          db
            .from("lottery_orders")
            .select("id", { count: "exact", head: true })
            .eq("lottery_id", lottery.id)
            .eq("payment_status", "paid"),

          db
            .from("lottery_tickets")
            .select("id", { count: "exact", head: true })
            .eq("lottery_id", lottery.id)
            .eq("status", "issued"),

          db
            .from("lottery_tickets")
            .select("id", { count: "exact", head: true })
            .eq("lottery_id", lottery.id)
            .in("status", ["void", "refunded", "test"]),

          db
            .from("lottery_prizes")
            .select("id", { count: "exact", head: true })
            .eq("lottery_id", lottery.id)
            .eq("status", "available_for_draw"),

          db
            .from("lottery_integrity_warnings")
            .select("id", { count: "exact", head: true })
            .eq("lottery_id", lottery.id)
            .eq("resolved", false),

          db
            .from("lottery_draws")
            .select("id,status,completed_at")
            .eq("lottery_id", lottery.id)
            .order("created_at", { ascending: false })
            .limit(1),
        ]);

        // Never interpret a failed query as zero tickets or zero warnings.
        const queries = [
          { name: "paid orders", result: paidOrders },
          { name: "issued ticket count", result: eligibleTickets },
          { name: "excluded ticket count", result: excludedTickets },
          { name: "available prizes", result: prizes },
          { name: "integrity warnings", result: warnings },
          { name: "latest draw", result: latestDraw },
        ];

        for (const query of queries) {
          if (query.result.error) {
            throw new DrawListQueryError(
              query.name,
              lottery.id,
              query.result.error,
            );
          }
        }

        const paidOrderCount = paidOrders.count;
        const ticketCount = eligibleTickets.count;
        const excludedTicketCount = excludedTickets.count;
        const prizeCount = prizes.count;
        const warningCount = warnings.count;

        // A missing exact count is unknown, rather than a confirmed zero.
        const counts = [
          { name: "paid orders", value: paidOrderCount },
          { name: "issued ticket count", value: ticketCount },
          { name: "excluded ticket count", value: excludedTicketCount },
          { name: "available prizes", value: prizeCount },
          { name: "integrity warnings", value: warningCount },
        ];

        for (const count of counts) {
          if (count.value === null) {
            throw new DrawListQueryError(
              count.name,
              lottery.id,
              new Error("The database returned no exact count."),
            );
          }
        }

        const latest = latestDraw.data?.[0] ?? null;
        const salesCloseTime = parseDate(lottery.sales_close_at);
        const drawTime = parseDate(lottery.draw_at);

        const salesClosed =
          lottery.status === "sales_closed" ||
          lottery.status === "draw_ready" ||
          (salesCloseTime !== null && salesCloseTime <= now);

        const drawTimeReached =
          drawTime !== null && drawTime <= now;

        const blockReasons: BlockReason[] = [];

        if (lottery.status === "under_review") {
          blockReasons.push({
            code: "LOTTERY_UNDER_REVIEW",
            message: "This lottery is marked as under review.",
          });
        }

        if ((warningCount ?? 0) > 0) {
          blockReasons.push({
            code: "UNRESOLVED_INTEGRITY_WARNINGS",
            message:
              `${warningCount} unresolved integrity warning(s) require review.`,
          });
        }

        if (!salesClosed) {
          blockReasons.push({
            code: "SALES_NOT_CLOSED",
            message: "Sales have not been reported as closed.",
          });
        }

        if (lottery.sales_close_at && salesCloseTime === null) {
          blockReasons.push({
            code: "INVALID_SALES_CLOSE_DATE",
            message: "The sales closing date is invalid.",
          });
        }

        if (lottery.draw_at && drawTime === null) {
          blockReasons.push({
            code: "INVALID_DRAW_DATE",
            message: "The draw date is invalid.",
          });
        } else if (drawTime !== null && !drawTimeReached) {
          blockReasons.push({
            code: "DRAW_TIME_NOT_REACHED",
            message: "The scheduled draw time has not been reached.",
          });
        }

        if ((ticketCount ?? 0) === 0) {
          blockReasons.push({
            code: "NO_ISSUED_TICKETS",
            message: "No issued tickets were found.",
          });
        }

        if ((prizeCount ?? 0) === 0) {
          blockReasons.push({
            code: "NO_AVAILABLE_PRIZES",
            message: "No prizes are available for the draw.",
          });
        }

        // An existing draw must be inspected before another is requested.
        // Do not assume an unfamiliar status means it is safe to retry.
        if (
          latest &&
          latest.status !== "completed" &&
          latest.status !== "running" &&
          latest.status !== "failed"
        ) {
          blockReasons.push({
            code: "EXISTING_DRAW_REQUIRES_REVIEW",
            message:
              "An existing draw record requires review before another draw can be requested.",
          });
        }

        if (lottery.status === "completed" && latest?.status !== "completed") {
          blockReasons.push({
            code: "COMPLETED_STATE_MISMATCH",
            message:
              "The lottery is completed but its latest draw is not reported as completed.",
          });
        }

        let drawStatus: DrawStatus;

        if (latest?.status === "completed") {
          drawStatus = "completed";
        } else if (latest?.status === "running") {
          drawStatus = "running";
        } else if (
          lottery.status === "under_review" ||
          (warningCount ?? 0) > 0
        ) {
          drawStatus = "under_review";
        } else if (blockReasons.length === 0) {
          drawStatus = "ready";
        } else {
          const onlyWaitingForDates = blockReasons.every(
            (reason) =>
              reason.code === "SALES_NOT_CLOSED" ||
              reason.code === "DRAW_TIME_NOT_REACHED",
          );

          drawStatus = onlyWaitingForDates ? "upcoming" : "blocked";
        }

        return {
          id: lottery.id,
          title: lottery.title,
          slug: lottery.slug,
          internal_reference: lottery.internal_reference,
          lottery_status: lottery.status,
          draw_at: lottery.draw_at,
          sales_close_at: lottery.sales_close_at,

          paid_orders: paidOrderCount,
          // Display count only: the draw transaction must validate
          // paid, non-refunded tickets before selecting winners.
          eligible_tickets: ticketCount,
          excluded_tickets: excludedTicketCount,
          prizes_available: prizeCount,
          unresolved_warnings: warningCount,

          draw_status: drawStatus,
          latest_draw_id: latest?.id ?? null,
          latest_draw_status: latest?.status ?? null,

          sales_closed: salesClosed,
          draw_time_reached: drawTimeReached,
          block_reasons: blockReasons,

          // These listing checks do not authorise winner selection.
          requires_draw_readiness_check: true,
        };
      }),
    );

    return json({
      items,
      summary: {
        ready: items.filter((item) => item.draw_status === "ready").length,
        upcoming: items.filter((item) => item.draw_status === "upcoming").length,
        running: items.filter((item) => item.draw_status === "running").length,
        completed: items.filter((item) => item.draw_status === "completed").length,
        blocked: items.filter(
          (item) =>
            item.draw_status === "blocked" ||
            item.draw_status === "under_review",
        ).length,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}