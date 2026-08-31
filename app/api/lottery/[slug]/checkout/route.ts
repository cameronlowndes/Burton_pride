import {
  NextRequest,
  NextResponse,
} from "next/server";

import Stripe from "stripe";

import {
  supabaseAdmin,
} from "@/lib/supabase/supabaseAdmin";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

const stripe =
  new Stripe(
    process.env.STRIPE_SECRET_KEY!,
  );

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

function createOrderReference() {
  return `LOT-${new Date()
    .getFullYear()}-${crypto
    .randomUUID()
    .replaceAll(
      "-",
      "",
    )
    .slice(
      0,
      10,
    )
    .toUpperCase()}`;
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  let orderId:
    | string
    | null =
    null;

  try {
    /*
     * =====================================================
     * SLUG
     * =====================================================
     */
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
            "LOTTERY_CHECKOUT_INVALID_SLUG",

          error:
            "The lottery address is invalid.",
        },
        400,
      );
    }

    /*
     * =====================================================
     * REQUEST BODY
     * =====================================================
     */
    let body: Record<
      string,
      unknown
    >;

    try {
      body =
        await request.json();
    } catch {
      return response(
        {
          ok: false,

          code:
            "LOTTERY_CHECKOUT_INVALID_JSON",

          error:
            "The checkout request is invalid.",
        },
        400,
      );
    }

    const fullName =
      String(
        body.full_name ??
          "",
      ).trim();

    const email =
      String(
        body.email ??
          "",
      )
        .trim()
        .toLowerCase();

    const phone =
      String(
        body.phone ??
          "",
      ).trim();

    const quantity =
      Number(
        body.quantity ??
          0,
      );

    /*
     * =====================================================
     * VALIDATION
     * =====================================================
     */
    if (!fullName) {
      return response(
        {
          ok: false,

          code:
            "LOTTERY_CHECKOUT_NAME_REQUIRED",

          error:
            "Your full name is required.",
        },
        400,
      );
    }

    if (
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email,
      )
    ) {
      return response(
        {
          ok: false,

          code:
            "LOTTERY_CHECKOUT_EMAIL_INVALID",

          error:
            "Please enter a valid email address.",
        },
        400,
      );
    }

    if (
      !Number.isInteger(
        quantity,
      ) ||
      quantity < 1 ||
      quantity > 100
    ) {
      return response(
        {
          ok: false,

          code:
            "LOTTERY_CHECKOUT_INVALID_QUANTITY",

          error:
            "Ticket quantity must be between 1 and 100.",
        },
        400,
      );
    }

    if (
      body.age_confirmed !==
      true
    ) {
      return response(
        {
          ok: false,

          code:
            "LOTTERY_CHECKOUT_AGE_NOT_CONFIRMED",

          error:
            "You must confirm that you meet the minimum age requirement.",
        },
        400,
      );
    }

    if (
      body.eligibility_confirmed !==
      true
    ) {
      return response(
        {
          ok: false,

          code:
            "LOTTERY_CHECKOUT_ELIGIBILITY_NOT_CONFIRMED",

          error:
            "You must confirm that you meet the lottery eligibility requirements.",
        },
        400,
      );
    }

    if (
      body.terms_accepted !==
      true
    ) {
      return response(
        {
          ok: false,

          code:
            "LOTTERY_CHECKOUT_TERMS_NOT_ACCEPTED",

          error:
            "You must accept the lottery terms.",
        },
        400,
      );
    }

    /*
     * =====================================================
     * LOAD LOTTERY BY SLUG
     *
     * This is the critical part.
     *
     * /api/lottery/test/checkout
     *
     * resolves:
     *
     * slug = test
     *
     * and then finds:
     *
     * lotteries.slug = test
     * =====================================================
     */
    const {
      data: lottery,
      error:
        lotteryError,
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
          status,
          ticket_price,
          ticket_price_pence,
          currency,
          minimum_age,
          max_tickets,
          sales_open_at,
          sales_close_at,
          draw_at,
          terms_version,
          privacy_notice_version,
          show_in_directory,
          show_in_public_directory,
          is_active
          `,
        )
        .eq(
          "slug",
          slug,
        )
        .maybeSingle();

    if (
      lotteryError
    ) {
      console.error(
        "Lottery checkout slug lookup failed:",
        {
          code:
            lotteryError.code,

          message:
            lotteryError.message,

          details:
            lotteryError.details,

          hint:
            lotteryError.hint,

          slug,
        },
      );

      return response(
        {
          ok: false,

          code:
            "LOTTERY_CHECKOUT_DATABASE_LOOKUP_FAILED",

          error:
            "Unable to load this lottery.",

          details: {
            slug,

            database_code:
              lotteryError.code ??
              null,

            database_message:
              lotteryError.message ??
              null,
          },
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
            "LOTTERY_CHECKOUT_NOT_FOUND",

          error:
            "Lottery not found.",

          details: {
            slug,
          },
        },
        404,
      );
    }

    /*
     * =====================================================
     * PUBLIC VISIBILITY
     * =====================================================
     */
    const publicVisible =
      lottery.show_in_directory ===
        true ||
      lottery.show_in_public_directory ===
        true;

    if (
      !publicVisible
    ) {
      return response(
        {
          ok: false,

          code:
            "LOTTERY_CHECKOUT_NOT_PUBLIC",

          error:
            "This lottery is not currently available to the public.",
        },
        409,
      );
    }

    /*
     * =====================================================
     * STATUS
     * =====================================================
     */
    if (
      lottery.status !==
        "live" ||
      lottery.is_active !==
        true
    ) {
      return response(
        {
          ok: false,

          code:
            "LOTTERY_CHECKOUT_NOT_OPEN",

          error:
            "This lottery is not currently accepting ticket purchases.",

          details: {
            status:
              lottery.status,

            is_active:
              lottery.is_active,
          },
        },
        409,
      );
    }

    /*
     * =====================================================
     * MINIMUM AGE
     * =====================================================
     */
    const minimumAge =
      Number(
        lottery.minimum_age ??
          16,
      );

    if (
      minimumAge < 0
    ) {
      return response(
        {
          ok: false,

          code:
            "LOTTERY_CHECKOUT_INVALID_MINIMUM_AGE",

          error:
            "The lottery minimum age is not configured correctly.",
        },
        500,
      );
    }

    /*
     * =====================================================
     * SALES WINDOW
     * =====================================================
     */
    const now =
      Date.now();

    if (
      lottery.sales_open_at
    ) {
      const opens =
        new Date(
          lottery.sales_open_at,
        ).getTime();

      if (
        Number.isFinite(
          opens,
        ) &&
        now < opens
      ) {
        return response(
          {
            ok: false,

            code:
              "LOTTERY_CHECKOUT_NOT_OPEN_YET",

            error:
              "Ticket sales have not opened yet.",

            details: {
              sales_open_at:
                lottery.sales_open_at,
            },
          },
          409,
        );
      }
    }

    if (
      lottery.sales_close_at
    ) {
      const closes =
        new Date(
          lottery.sales_close_at,
        ).getTime();

      if (
        Number.isFinite(
          closes,
        ) &&
        now >= closes
      ) {
        return response(
          {
            ok: false,

            code:
              "LOTTERY_CHECKOUT_SALES_CLOSED",

            error:
              "Ticket sales have closed.",

            details: {
              sales_close_at:
                lottery.sales_close_at,
            },
          },
          409,
        );
      }
    }

    /*
     * =====================================================
     * PRICE
     * =====================================================
     */
    const unitPricePence =
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

    if (
      !Number.isFinite(
        unitPricePence,
      ) ||
      unitPricePence <=
        0
    ) {
      return response(
        {
          ok: false,

          code:
            "LOTTERY_CHECKOUT_INVALID_PRICE",

          error:
            "The lottery ticket price is not configured correctly.",

          details: {
            ticket_price:
              lottery.ticket_price,

            ticket_price_pence:
              lottery.ticket_price_pence,
          },
        },
        500,
      );
    }

    /*
     * =====================================================
     * MAXIMUM TICKETS
     * =====================================================
     */
    if (
      typeof lottery.max_tickets ===
        "number" &&
      lottery.max_tickets >
        0
    ) {
      const {
        count,
        error:
          countError,
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
        countError
      ) {
        console.error(
          "Lottery ticket availability check failed:",
          countError,
        );

        return response(
          {
            ok: false,

            code:
              "LOTTERY_CHECKOUT_TICKET_COUNT_FAILED",

            error:
              "Unable to check ticket availability.",
          },
          500,
        );
      }

      const issued =
        count ??
        0;

      const remaining =
        Math.max(
          0,
          lottery.max_tickets -
            issued,
        );

      if (
        quantity >
        remaining
      ) {
        return response(
          {
            ok: false,

            code:
              "LOTTERY_CHECKOUT_NOT_ENOUGH_TICKETS",

            error:
              remaining ===
              0
                ? "This lottery has sold out."
                : `Only ${remaining} ticket${
                    remaining ===
                    1
                      ? ""
                      : "s"
                  } remain.`,

            details: {
              requested:
                quantity,

              remaining,
            },
          },
          409,
        );
      }
    }

    /*
     * =====================================================
     * TOTAL
     * =====================================================
     */
    const totalPence =
      unitPricePence *
      quantity;

    const orderReference =
      createOrderReference();

    /*
     * =====================================================
     * CREATE PENDING ORDER
     * =====================================================
     */
    const {
      data: order,
      error:
        orderError,
    } =
      await supabaseAdmin
        .from(
          "lottery_orders",
        )
        .insert({
          lottery_id:
            lottery.id,

          order_reference:
            orderReference,

          purchaser_name:
            fullName,

          purchaser_email:
            email,

          purchaser_phone:
            phone ||
            null,

          quantity,

          total_amount:
            totalPence /
            100,

          currency:
            lottery.currency ||
            "GBP",

          payment_status:
            "pending",

          eligibility_accepted:
            true,

          terms_version:
            lottery.terms_version,

          privacy_notice_version:
            lottery.privacy_notice_version,

          marketing_opt_in:
            body.marketing_opt_in ===
            true,
        })
        .select(
          "id",
        )
        .single();

    if (
      orderError ||
      !order
    ) {
      console.error(
        "Lottery order creation failed:",
        {
          orderError,
          slug,
          lotteryId:
            lottery.id,
        },
      );

      return response(
        {
          ok: false,

          code:
            "LOTTERY_CHECKOUT_ORDER_CREATE_FAILED",

          error:
            "Unable to create your lottery order.",

          details: {
            database_code:
              orderError?.code ??
              null,

            database_message:
              orderError?.message ??
              null,
          },
        },
        500,
      );
    }

    orderId =
      order.id;

    /*
     * =====================================================
     * STRIPE
     * =====================================================
     */
    const origin =
      new URL(
        request.url,
      ).origin;

    const session =
      await stripe.checkout.sessions.create(
        {
          mode:
            "payment",

          customer_email:
            email,

          success_url:
            `${origin}/lottery/${encodeURIComponent(
              lottery.slug,
            )}?payment=success&session_id={CHECKOUT_SESSION_ID}`,

          cancel_url:
            `${origin}/lottery/${encodeURIComponent(
              lottery.slug,
            )}?payment=cancelled`,

          line_items: [
            {
              quantity,

              price_data: {
                currency:
                  (
                    lottery.currency ||
                    "GBP"
                  ).toLowerCase(),

                unit_amount:
                  unitPricePence,

                product_data: {
                  name:
                    `${lottery.title} Lottery Ticket`,

                  description:
                    "Burton Pride lottery ticket",
                },
              },
            },
          ],

          metadata: {
            type:
              "burton_pride_lottery",

            lottery_id:
              lottery.id,

            lottery_slug:
              lottery.slug,

            order_id:
              order.id,

            order_reference:
              orderReference,

            quantity:
              String(
                quantity,
              ),
          },

          payment_intent_data: {
            metadata: {
              type:
                "burton_pride_lottery",

              lottery_id:
                lottery.id,

              order_id:
                order.id,

              order_reference:
                orderReference,
            },
          },
        },
      );

    /*
     * =====================================================
     * SAVE STRIPE SESSION
     * =====================================================
     */
    await supabaseAdmin
      .from(
        "lottery_orders",
      )
      .update({
        payment_reference:
          session.id,
      })
      .eq(
        "id",
        order.id,
      );

    if (
      !session.url
    ) {
      return response(
        {
          ok: false,

          code:
            "LOTTERY_CHECKOUT_NO_STRIPE_URL",

          error:
            "The payment service did not return a checkout page.",
        },
        500,
      );
    }

    /*
     * =====================================================
     * SUCCESS
     * =====================================================
     */
    return response({
      ok: true,

      lottery: {
        id:
          lottery.id,

        slug:
          lottery.slug,

        title:
          lottery.title,
      },

      order_id:
        order.id,

      order_reference:
        orderReference,

      quantity,

      amount_pence:
        totalPence,

      checkout_url:
        session.url,
    });
  } catch (
    error
  ) {
    console.error(
      "Lottery slug checkout error:",
      error,
    );

    /*
     * If an order was created before Stripe failed,
     * mark it as failed.
     */
    if (
      orderId
    ) {
      await supabaseAdmin
        .from(
          "lottery_orders",
        )
        .update({
          payment_status:
            "failed",

          failed_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          orderId,
        );
    }

    return response(
      {
        ok: false,

        code:
          "LOTTERY_CHECKOUT_UNEXPECTED_ERROR",

        error:
          "Unable to start the secure lottery payment.",

        details: {
          error_name:
            error instanceof
            Error
              ? error.name
              : "UnknownError",

          error_message:
            error instanceof
            Error
              ? error.message
              : "Unknown error",
        },
      },
      500,
    );
  }
}