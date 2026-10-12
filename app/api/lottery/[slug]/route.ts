import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/supabase/supabaseAdmin";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

function response(
  body: unknown,
  status = 200,
) {
  return NextResponse.json(
    body,
    {
      status,

      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate, max-age=0",

        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const {
      slug: rawSlug,
    } =
      await context.params;

    const slug =
      decodeURIComponent(
        rawSlug,
      )
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

          code:
            "PUBLIC_LOTTERY_INVALID_SLUG",

          error:
            "The lottery address is invalid.",
        },
        400,
      );
    }

    /*
     * =====================================================
     * LOTTERY
     * =====================================================
     */
    const {
      data: lottery,
      error,
    } =
      await supabaseAdmin
        .from(
          "lotteries",
        )
        .select(
          `
          id,
          title,
          slug,
          short_summary,
          description,
          fundraising_purpose,
          hero_image_url,
          status,
          ticket_price,
          ticket_price_pence,
          currency,
          publication_at,
          sales_open_at,
          sales_close_at,
          draw_at,
          results_publish_at,
          minimum_age,
          max_tickets,
          show_in_directory,
          show_in_public_directory,
          allow_page_before_sales,
          show_ticket_count,
          show_amount_raised,
          show_remaining_tickets,
          show_prize_values,
          winner_display_mode,
          countdown_enabled,
          geographic_eligibility,
          terms_version,
          privacy_notice_version,
          responsible_gambling_info,
          is_active
          `,
        )
        .eq(
          "slug",
          slug,
        )
        .maybeSingle();

    if (error) {
      console.error(
        "Public lottery lookup failed:",
        error,
      );

      return response(
        {
          ok: false,

          code:
            "PUBLIC_LOTTERY_DATABASE_ERROR",

          error:
            "Unable to load this lottery.",
        },
        500,
      );
    }

    if (
      !lottery
    ) {
      return response(
        {
          ok: false,

          code:
            "PUBLIC_LOTTERY_NOT_FOUND",

          error:
            "Lottery not found.",
        },
        404,
      );
    }

    /*
     * Must be allowed on the public site.
     */
    const publicVisible =
      lottery.show_in_public_directory ===
        true ||
      lottery.show_in_directory ===
        true;

    if (
      !publicVisible ||
      lottery.status ===
        "draft" ||
      lottery.status ===
        "compliance_review" ||
      lottery.status ===
        "archived" ||
      lottery.status ===
        "cancelled"
    ) {
      return response(
        {
          ok: false,

          code:
            "PUBLIC_LOTTERY_NOT_AVAILABLE",

          error:
            "This lottery is not currently available to the public.",
        },
        404,
      );
    }

    /*
     * =====================================================
     * PRIZES
     * =====================================================
     */
    const {
      data: prizes,
      error:
        prizesError,
    } =
      await supabaseAdmin
        .from(
          "lottery_prizes",
        )
        .select(
          `
          id,
          name,
          description,
          image_url,
          quantity,
          declared_value,
          sponsor_name,
          status,
          display_order
          `,
        )
        .eq(
          "lottery_id",
          lottery.id,
        )
        .neq(
          "status",
          "withdrawn",
        )
        .order(
          "display_order",
          {
            ascending:
              true,
          },
        );

    if (
      prizesError
    ) {
      console.error(
        "Public lottery prizes failed:",
        prizesError,
      );
    }

    /*
     * =====================================================
     * TICKET COUNT
     * =====================================================
     */
    const {
      count:
        ticketCount,
      error:
        ticketCountError,
    } =
      await supabaseAdmin
        .from(
          "lottery_tickets",
        )
        .select(
          "id",
          {
            count:
              "exact",

            head:
              true,
          },
        )
        .eq(
          "lottery_id",
          lottery.id,
        )
        .in(
          "status",
          [
            "issued",
            "winner",
          ],
        );

    if (
      ticketCountError
    ) {
      console.error(
        "Public ticket count failed:",
        ticketCountError,
      );
    }

    const ticketsIssued =
      ticketCount ??
      0;

    /*
     * =====================================================
     * MONEY RAISED
     * =====================================================
     */
    const {
      data: orders,
      error:
        ordersError,
    } =
      await supabaseAdmin
        .from(
          "lottery_orders",
        )
        .select(
          `
          total_amount,
          payment_status
          `,
        )
        .eq(
          "lottery_id",
          lottery.id,
        )
        .eq(
          "payment_status",
          "paid",
        );

    if (
      ordersError
    ) {
      console.error(
        "Public lottery amount raised failed:",
        ordersError,
      );
    }

    const amountRaisedPence =
      (
        orders ??
        []
      ).reduce(
        (
          total,
          order,
        ) =>
          total +
          Math.round(
            Number(
              order.total_amount ??
                0,
            ) *
              100,
          ),
        0,
      );

    /*
     * =====================================================
     * PRICE
     * =====================================================
     */
    const ticketPricePence =
      typeof lottery.ticket_price_pence ===
        "number"
        ? lottery.ticket_price_pence
        : Math.round(
            Number(
              lottery.ticket_price ??
                0,
            ) *
              100,
          );

    /*
     * =====================================================
     * AVAILABILITY
     * =====================================================
     */
    const now =
      Date.now();

    const openAt =
      lottery.sales_open_at
        ? new Date(
            lottery.sales_open_at,
          ).getTime()
        : null;

    const closeAt =
      lottery.sales_close_at
        ? new Date(
            lottery.sales_close_at,
          ).getTime()
        : null;

    let canPurchase =
      lottery.status ===
        "live" &&
      lottery.is_active ===
        true;

    let salesMessage =
      "Tickets are available.";

    if (
      lottery.status ===
        "paused"
    ) {
      canPurchase =
        false;

      salesMessage =
        "Ticket sales are temporarily paused.";
    } else if (
      lottery.status ===
      "sales_closed"
    ) {
      canPurchase =
        false;

      salesMessage =
        "Ticket sales have now closed.";
    } else if (
      lottery.status ===
        "completed" ||
      lottery.status ===
        "draw_ready"
    ) {
      canPurchase =
        false;

      salesMessage =
        "Ticket sales have finished.";
    } else if (
      openAt !== null &&
      now < openAt
    ) {
      canPurchase =
        false;

      salesMessage =
        "Ticket sales have not opened yet.";
    } else if (
      closeAt !== null &&
      now >= closeAt
    ) {
      canPurchase =
        false;

      salesMessage =
        "Ticket sales have closed.";
    }

    const maxTickets =
      lottery.max_tickets;

    const remainingTickets =
      typeof maxTickets ===
      "number"
        ? Math.max(
            0,
            maxTickets -
              ticketsIssued,
          )
        : null;

    if (
      remainingTickets ===
      0
    ) {
      canPurchase =
        false;

      salesMessage =
        "This lottery has sold out.";
    }

    return response({
      ok: true,

      lottery: {
        id:
          lottery.id,

        title:
          lottery.title,

        slug:
          lottery.slug,

        short_summary:
          lottery.short_summary,

        description:
          lottery.description,

        fundraising_purpose:
          lottery.fundraising_purpose,

        hero_image_url:
          lottery.hero_image_url,

        status:
          lottery.status,

        ticket_price_pence:
          ticketPricePence,

        currency:
          lottery.currency ||
          "GBP",

        minimum_age:
          lottery.minimum_age ??
          16,

        max_tickets:
          maxTickets,

        sales_open_at:
          lottery.sales_open_at,

        sales_close_at:
          lottery.sales_close_at,

        draw_at:
          lottery.draw_at,

        geographic_eligibility:
          lottery.geographic_eligibility,

        responsible_gambling_info:
          lottery.responsible_gambling_info,

        terms_version:
          lottery.terms_version,

        privacy_notice_version:
          lottery.privacy_notice_version,

        show_ticket_count:
          lottery.show_ticket_count,

        show_remaining_tickets:
          lottery.show_remaining_tickets,

        show_amount_raised:
          lottery.show_amount_raised,

        show_prize_values:
          lottery.show_prize_values,

        countdown_enabled:
          lottery.countdown_enabled,

        tickets_issued:
          ticketsIssued,

        remaining_tickets:
          remainingTickets,

        amount_raised_pence:
          amountRaisedPence,

        can_purchase:
          canPurchase,

        sales_message:
          salesMessage,

        prizes:
          prizes ??
          [],
      },
    });
  } catch (
    error
  ) {
    console.error(
      "Public lottery API error:",
      error,
    );

    return response(
      {
        ok: false,

        code:
          "PUBLIC_LOTTERY_UNEXPECTED_ERROR",

        error:
          "Unable to load this lottery.",
      },
      500,
    );
  }
}