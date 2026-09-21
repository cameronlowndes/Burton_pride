import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  requireLotteryPermission,
  lotteryAdminDb,
} from "@/lib/lottery/adminAuth";
import {
  issueTicketsForPaidOrder,
} from "@/lib/lottery/secureTicketIssuance";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

function json(
  body: unknown,
  status = 200,
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function POST(
  request: NextRequest,
) {
  try {
    await requireLotteryPermission(
      "lottery:tickets:manage",
    );

    const body =
      await request.json().catch(
        () => null,
      );
    const orderId =
      typeof body?.orderId ===
      "string"
        ? body.orderId.trim()
        : "";

    if (
      !orderId
    ) {
      return json(
        {
          ok: false,
          error: "A valid orderId is required.",
        },
        400,
      );
    }

    const supabase =
      lotteryAdminDb();
    const {
      data: order,
      error: orderError,
    } =
      await supabase
        .from(
          "lottery_orders",
        )
        .select(
          "id,lottery_id,quantity,payment_status",
        )
        .eq(
          "id",
          orderId,
        )
        .maybeSingle();

    if (
      orderError
    ) {
      throw new Error(
        `Could not load the order: ${orderError.message}`,
      );
    }

    if (
      !order
    ) {
      return json(
        {
          ok: false,
          error: "Lottery order not found.",
        },
        404,
      );
    }

    const {
      data: lottery,
      error: lotteryError,
    } =
      await supabase
        .from(
          "lotteries",
        )
        .select(
          "id,max_tickets",
        )
        .eq(
          "id",
          order.lottery_id,
        )
        .maybeSingle();

    if (
      lotteryError
    ) {
      throw new Error(
        `Could not load the lottery: ${lotteryError.message}`,
      );
    }

    if (
      !lottery
    ) {
      return json(
        {
          ok: false,
          error: "Lottery for this order was not found.",
        },
        404,
      );
    }

    const tickets =
      await issueTicketsForPaidOrder(
        order,
        lottery,
      );

    return json(
      {
        ok: true,
        orderId: order.id,
        issuedCount: tickets.length,
        tickets,
      },
    );
  } catch (
    error
  ) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not issue random ticket numbers.";

    const forbidden =
      /permission|unauthor/i.test(
        message,
      );

    console.error(
      "Random ticket issue error:",
      error,
    );

    return json(
      {
        ok: false,
        error: forbidden
          ? "You do not have permission to issue lottery tickets."
          : message,
      },
      forbidden
        ? 403
        : 500,
    );
  }
}
