import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getAuthenticatedAdmin,
  getAuditServiceClient,
  hasLotteryPermission,
  writeLotteryAuditSafe,
} from "@/lib/lottery/audit-server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

function response(
  body: unknown,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const admin =
      await getAuthenticatedAdmin();

    if (!admin) {
      return response(
        {
          ok: false,
          error:
            "You must be signed in to view this lottery.",
        },
        401,
      );
    }

    if (
      !hasLotteryPermission(
        admin,
        "lottery:view",
      )
    ) {
      await writeLotteryAuditSafe({
        admin,
        actionCode:
          "security.lottery_detail.permission_denied",
        actionLabel:
          "Lottery detail access denied",
        actionGroup: "security",
        riskLevel: "high",
        entityType: "lottery",
        reason:
          "Administrator attempted to view a lottery without lottery:view.",
      });

      return response(
        {
          ok: false,
          error:
            "You do not have permission to view lottery records.",
        },
        403,
      );
    }

    const { slug: rawSlug } =
      await context.params;

    const slug =
      decodeURIComponent(rawSlug)
        .trim()
        .toLowerCase();

    if (
      !slug ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
        slug,
      )
    ) {
      return response(
        {
          ok: false,
          error:
            "The lottery slug is invalid.",
        },
        400,
      );
    }

    const db =
      getAuditServiceClient();

    /*
     * Resolve by slug, not by status and not by hard-coded ID.
     * This deliberately allows every lifecycle state:
     * draft, review, scheduled, live, closed, completed,
     * archived, paused, cancelled and under review.
     */
    const {
      data: lottery,
      error,
    } = await db
      .from("lotteries")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      console.error(
        "Lottery slug lookup error:",
        error,
      );

      return response(
        {
          ok: false,
          error:
            "Unable to load the lottery.",
        },
        500,
      );
    }

    if (!lottery) {
      return response(
        {
          ok: false,
          error:
            "Lottery not found.",
        },
        404,
      );
    }

    /*
     * Load summary values independently so missing optional tables
     * do not prevent the main lottery record from opening.
     */
    const [
      ordersResult,
      ticketsResult,
      prizesResult,
      winnersResult,
      refundsResult,
    ] = await Promise.all([
      db
        .from("lottery_orders")
        .select(
          "id, status, amount_total",
        )
        .eq(
          "lottery_id",
          lottery.id,
        ),

      db
        .from("lottery_tickets")
        .select("id")
        .eq(
          "lottery_id",
          lottery.id,
        ),

      db
        .from("lottery_prizes")
        .select("id")
        .eq(
          "lottery_id",
          lottery.id,
        ),

      db
        .from("lottery_winners")
        .select("id")
        .eq(
          "lottery_id",
          lottery.id,
        ),

      db
        .from("lottery_refunds")
        .select(
          "amount, status",
        )
        .eq(
          "lottery_id",
          lottery.id,
        ),
    ]);

    const orders =
      ordersResult.error
        ? []
        : ordersResult.data ?? [];

    const paidOrders =
      orders.filter(
        (order: any) =>
          order.status === "paid",
      );

    const revenue =
      paidOrders.reduce(
        (
          total: number,
          order: any,
        ) =>
          total +
          Number(
            order.amount_total ??
              0,
          ),
        0,
      );

    const refunds =
      refundsResult.error
        ? []
        : refundsResult.data ?? [];

    const refundTotal =
      refunds
        .filter(
          (refund: any) =>
            refund.status ===
              "completed" ||
            refund.status ===
              "refunded",
        )
        .reduce(
          (
            total: number,
            refund: any,
          ) =>
            total +
            Number(
              refund.amount ?? 0,
            ),
          0,
        );

    return response({
      ok: true,
      item: {
        ...lottery,

        order_count:
          orders.length,

        paid_order_count:
          paidOrders.length,

        ticket_count:
          ticketsResult.error
            ? 0
            : ticketsResult.data
                ?.length ?? 0,

        prize_count:
          prizesResult.error
            ? 0
            : prizesResult.data
                ?.length ?? 0,

        winner_count:
          winnersResult.error
            ? 0
            : winnersResult.data
                ?.length ?? 0,

        revenue,
        refund_total:
          refundTotal,
      },
    });
  } catch (error) {
    console.error(
      "Lottery slug detail API error:",
      error,
    );

    return response(
      {
        ok: false,
        error:
          "Unable to load the lottery.",
      },
      500,
    );
  }
}