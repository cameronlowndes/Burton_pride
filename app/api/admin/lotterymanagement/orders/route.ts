import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  randomInt,
} from "node:crypto";

import Stripe from "stripe";
import bcrypt from "bcryptjs";
import { Resend } from "resend";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  supabaseAdmin,
} from "@/lib/supabase/supabaseAdmin";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

const stripe =
  new Stripe(
    process.env.STRIPE_SECRET_KEY!,
  );

const resend =
  new Resend(
    process.env.RESEND_API_KEY,
  );

const LOTTERY_FROM_EMAIL =
  "Burton Pride Lotteries <Lotteries@burtonpride.co.uk>";

const LOTTERY_INFO_EMAIL =
  "info@burtonpride.co.uk";

const DELETE_SETTINGS_TABLE =
  "admin_delete_settings";

/*
 * This is the same saved password used by:
 * /api/admin/settings/delete-password
 */
const MAIN_ADMIN_PASSWORD_ACTION_KEY =
  "delete_all_donations";

type PendingOrderForSync = {
  id: string;
  lottery_id: string;
  order_reference: string;
  total_amount: number | string | null;
  currency: string | null;
  payment_status: string | null;
  payment_reference: string | null;
  created_at: string | null;
};

type LotteryForSync = {
  id: string;
  slug: string;
};

type StripeSyncSummary = {
  checked: number;
  paid_found: number;
  finalised: number;
  failed: number;
  skipped: number;
};

function jsonResponse(
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

/**
 * Reconcile stale pending orders with Stripe before the
 * admin order register is returned.
 *
 * Stripe is checked first. When Stripe confirms a payment is paid,
 * this API finalises the order directly through Supabase:
 *
 * 1. Verifies Stripe says the session is paid.
 * 2. Verifies Stripe metadata belongs to the Supabase order.
 * 3. Verifies the paid amount matches the Supabase order total.
 * 4. Updates lottery_orders.payment_status to "paid".
 * 5. Sets paid_at and keeps the Stripe session reference.
 * 6. Creates missing lottery_tickets directly in Supabase.
 * 7. Sends the customer confirmation through Resend.
 * 8. Sends the internal Burton Pride notification through Resend.
 *
 * There is no server-to-server request to a Vercel deployment.
 */
async function finaliseStripePaidOrderInSupabase({
  session,
  pendingOrder,
}: {
  session: Stripe.Checkout.Session;
  pendingOrder: PendingOrderForSync;
}) {
  /*
   * Load the complete order directly from Supabase.
   * No request is made back through Vercel.
   */
  const {
    data:
      orderData,
    error:
      orderError,
  } =
    await supabaseAdmin
      .from(
        "lottery_orders",
      )
      .select(
        `
        id,
        lottery_id,
        order_reference,
        purchaser_name,
        purchaser_email,
        purchaser_phone,
        quantity,
        total_amount,
        currency,
        payment_status,
        payment_reference,
        paid_at
        `,
      )
      .eq(
        "id",
        pendingOrder.id,
      )
      .single();

  if (
    orderError ||
    !orderData
  ) {
    throw new Error(
      `Unable to load the lottery order from Supabase: ${
        orderError?.message ||
        "Order not found"
      }`,
    );
  }

  const order =
    orderData as ManualPaidOrder;

  if (
    order.payment_status ===
    "paid"
  ) {
    return {
      alreadyPaid:
        true,

      ticketCount:
        0,

      emailSent:
        false,
    };
  }

  if (
    order.payment_status !==
    "pending"
  ) {
    throw new Error(
      `The order is ${order.payment_status || "unknown"} and cannot be finalised as a pending payment.`,
    );
  }

  if (
    session.metadata?.type !==
      "burton_pride_lottery" ||
    session.metadata?.order_id !==
      order.id ||
    session.metadata?.lottery_id !==
      order.lottery_id
  ) {
    throw new Error(
      "The Stripe session metadata does not match the Supabase lottery order.",
    );
  }

  const {
    data:
      lotteryData,
    error:
      lotteryError,
  } =
    await supabaseAdmin
      .from(
        "lotteries",
      )
      .select(
        "id,title,slug,draw_at,max_tickets",
      )
      .eq(
        "id",
        order.lottery_id,
      )
      .single();

  if (
    lotteryError ||
    !lotteryData
  ) {
    throw new Error(
      `Unable to load the lottery from Supabase: ${
        lotteryError?.message ||
        "Lottery not found"
      }`,
    );
  }

  const lottery =
    lotteryData as ManualPaidLottery;

  if (
    session.metadata
      ?.lottery_slug &&
    session.metadata
      .lottery_slug !==
      lottery.slug
  ) {
    throw new Error(
      "The Stripe session belongs to a different lottery slug.",
    );
  }

  const expectedAmountPence =
    Math.round(
      Number(
        order.total_amount ||
        0,
      ) *
        100,
    );

  if (
    typeof session.amount_total ===
      "number" &&
    session.amount_total !==
      expectedAmountPence
  ) {
    throw new Error(
      "The Stripe payment amount does not match the Supabase order total.",
    );
  }

  /*
   * Claim the pending order directly in Supabase.
   * The payment status is only changed after Stripe has returned "paid".
   */
  const paidAt =
    new Date()
      .toISOString();

  const {
    data:
      paidRow,
    error:
      paymentUpdateError,
  } =
    await supabaseAdmin
      .from(
        "lottery_orders",
      )
      .update({
        payment_status:
          "paid",

        payment_reference:
          session.id,

        paid_at:
          paidAt,

        updated_at:
          paidAt,
      })
      .eq(
        "id",
        order.id,
      )
      .eq(
        "payment_status",
        "pending",
      )
      .select(
        "id,payment_status,paid_at",
      )
      .maybeSingle();

  if (
    paymentUpdateError
  ) {
    throw new Error(
      `Supabase could not mark the lottery order as paid: ${paymentUpdateError.message}`,
    );
  }

  /*
   * If another request completed it at the same time, verify that
   * Supabase now says paid and then continue idempotently.
   */
  if (
    !paidRow
  ) {
    const {
      data:
        currentOrder,
      error:
        currentOrderError,
    } =
      await supabaseAdmin
        .from(
          "lottery_orders",
        )
        .select(
          "payment_status,paid_at,payment_reference",
        )
        .eq(
          "id",
          order.id,
        )
        .single();

    if (
      currentOrderError ||
      currentOrder
        ?.payment_status !==
        "paid"
    ) {
      throw new Error(
        "The Supabase order changed before the paid status could be saved.",
      );
    }

    order.payment_reference =
      currentOrder.payment_reference ||
      session.id;

    order.paid_at =
      currentOrder.paid_at ||
      paidAt;
  } else {
    order.payment_reference =
      session.id;

    order.paid_at =
      paidAt;
  }

  order.payment_status =
    "paid";

  /*
   * Create any missing ticket numbers in lottery_tickets.
   * Existing tickets are reused, so a refresh does not create
   * a second set of lottery numbers.
   */
  const {
    tickets,
  } =
    await createMissingManualPaidTickets(
      order,
      lottery,
    );

  let emailSent =
    false;

  let emailError:
    string |
    null =
    null;

  try {
    await sendPaidOrderEmails({
      order,
      lottery,
      tickets,
      source:
        "stripe",
    });

    emailSent =
      true;
  } catch (
    error
  ) {
    emailError =
      error instanceof
      Error
        ? error.message
        : "The lottery confirmation email could not be sent.";

    console.error(
      "Lottery Stripe-paid Resend email failed:",
      error,
    );
  }

  return {
    alreadyPaid:
      false,

    ticketCount:
      tickets.length,

    emailSent,

    emailError,
  };
}


async function reconcilePendingStripeOrders(): Promise<StripeSyncSummary> {
  const summary: StripeSyncSummary = {
    checked: 0,
    paid_found: 0,
    finalised: 0,
    failed: 0,
    skipped: 0,
  };

  if (
    !process.env.STRIPE_SECRET_KEY
  ) {
    console.error(
      "Lottery admin order sync skipped: STRIPE_SECRET_KEY is not configured.",
    );

    return summary;
  }

  const {
    data: pendingOrders,
    error:
      pendingOrdersError,
  } =
    await supabaseAdmin
      .from(
        "lottery_orders",
      )
      .select(
        `
        id,
        lottery_id,
        order_reference,
        total_amount,
        currency,
        payment_status,
        payment_reference,
        created_at
        `,
      )
      .eq(
        "payment_status",
        "pending",
      )
      .not(
        "payment_reference",
        "is",
        null,
      )
      .order(
        "created_at",
        {
          ascending:
            false,
        },
      )
      .limit(
        50,
      );

  if (
    pendingOrdersError
  ) {
    console.error(
      "Lottery admin pending payment sync lookup failed:",
      pendingOrdersError,
    );

    return summary;
  }

  const candidates =
    (
      pendingOrders ||
      []
    ) as PendingOrderForSync[];

  if (
    candidates.length ===
    0
  ) {
    return summary;
  }

  const lotteryIds =
    [
      ...new Set(
        candidates
          .map(
            (
              order,
            ) =>
              order.lottery_id,
          )
          .filter(
            Boolean,
          ),
      ),
    ];

  const {
    data:
      lotteryRows,
    error:
      lotteryRowsError,
  } =
    lotteryIds.length
      ? await supabaseAdmin
          .from(
            "lotteries",
          )
          .select(
            "id,slug",
          )
          .in(
            "id",
            lotteryIds,
          )
      : {
          data:
            [] as LotteryForSync[],
          error:
            null,
        };

  if (
    lotteryRowsError
  ) {
    console.error(
      "Lottery admin payment sync lottery lookup failed:",
      lotteryRowsError,
    );

    return summary;
  }

  const lotteryById =
    new Map<
      string,
      LotteryForSync
    >(
      (
        lotteryRows ||
        []
      ).map(
        (
          lottery,
        ) => [
          lottery.id,
          lottery as LotteryForSync,
        ],
      ),
    );

  /*
   * Run sequentially instead of starting dozens of Stripe
   * requests at the same time. The admin register normally has
   * only a small number of stale pending orders.
   */
  for (
    const order of
    candidates
  ) {
    const sessionId =
      String(
        order.payment_reference ||
        "",
      ).trim();

    const lottery =
      lotteryById.get(
        order.lottery_id,
      );

    if (
      !sessionId ||
      !sessionId.startsWith(
        "cs_",
      ) ||
      !lottery?.slug
    ) {
      summary.skipped +=
        1;

      continue;
    }

    summary.checked +=
      1;

    try {
      const session =
        await stripe
          .checkout
          .sessions
          .retrieve(
            sessionId,
          );

      /*
       * A pending or unpaid Stripe session must remain pending
       * in the Burton Pride system.
       */
      if (
        session.payment_status !==
        "paid"
      ) {
        continue;
      }

      /*
       * Do quick checks here before asking the finaliser to run.
       * The finaliser repeats the important checks server-side.
       */
      if (
        session.metadata?.type !==
          "burton_pride_lottery" ||
        session.metadata
          ?.order_id !==
          order.id ||
        (
          session.metadata
            ?.lottery_id &&
          session.metadata
            .lottery_id !==
            order.lottery_id
        )
      ) {
        console.error(
          "Lottery admin payment sync rejected mismatched Stripe metadata:",
          {
            orderId:
              order.id,

            orderReference:
              order.order_reference,

            stripeSession:
              session.id,
          },
        );

        summary.failed +=
          1;

        continue;
      }

      const expectedAmountPence =
        Math.round(
          Number(
            order.total_amount ||
            0,
          ) *
            100,
        );

      if (
        typeof session.amount_total ===
          "number" &&
        session.amount_total !==
          expectedAmountPence
      ) {
        console.error(
          "Lottery admin payment sync rejected amount mismatch:",
          {
            orderId:
              order.id,

            orderReference:
              order.order_reference,

            expectedAmountPence,

            stripeAmountPence:
              session.amount_total,
          },
        );

        summary.failed +=
          1;

        continue;
      }

      summary.paid_found +=
        1;

      const completion =
        await finaliseStripePaidOrderInSupabase({
          session,
          pendingOrder:
            order,
        });

      if (
        completion.alreadyPaid
      ) {
        summary.skipped +=
          1;

        continue;
      }

      summary.finalised +=
        1;
    } catch (
      error
    ) {
      console.error(
        "Lottery admin Stripe payment reconciliation error:",
        {
          orderId:
            order.id,

          orderReference:
            order.order_reference,

          stripeSession:
            sessionId,

          error,
        },
      );

      summary.failed +=
        1;
    }
  }

  return summary;
}

export async function GET(
  request: NextRequest,
) {
  try {
    /*
     * =====================================================
     * AUTHENTICATION
     * =====================================================
     */
    const authClient =
      await createClient();

    const {
      data: {
        user,
      },
      error:
        authError,
    } =
      await authClient
        .auth
        .getUser();

    if (
      authError ||
      !user
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Unauthorized.",
        },
        401,
      );
    }

    /*
     * =====================================================
     * PAYMENT RECONCILIATION
     * =====================================================
     *
     * If a Stripe test/live payment succeeded but the browser
     * did not finish the public confirmation request, this
     * gives the admin register another safe opportunity to
     * complete the order.
     */
    const stripeSync =
      await reconcilePendingStripeOrders();

    /*
     * =====================================================
     * LOAD ORDERS AFTER STRIPE SYNC
     * =====================================================
     *
     * This query happens AFTER reconciliation so an order that
     * was just completed will already return payment_status=paid.
     */
    const {
      data:
        orders,
      error:
        ordersError,
    } =
      await supabaseAdmin
        .from(
          "lottery_orders",
        )
        .select(
          `
          id,
          lottery_id,
          order_reference,
          purchaser_name,
          purchaser_email,
          purchaser_phone,
          quantity,
          total_amount,
          currency,
          payment_status,
          payment_reference,
          eligibility_accepted,
          terms_version,
          privacy_notice_version,
          marketing_opt_in,
          created_at,
          updated_at,
          paid_at
          `,
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          },
        );

    if (
      ordersError
    ) {
      console.error(
        "Lottery orders load error:",
        ordersError,
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Unable to load lottery orders.",

          supabaseCode:
            ordersError.code,

          supabaseDetails:
            ordersError.details,

          supabaseHint:
            ordersError.hint,
        },
        500,
      );
    }

    const orderRows =
      orders ||
      [];

    const lotteryIds =
      [
        ...new Set(
          orderRows
            .map(
              (
                item,
              ) =>
                item.lottery_id,
            )
            .filter(
              Boolean,
            ),
        ),
      ];

    const orderIds =
      orderRows
        .map(
          (
            item,
          ) =>
            item.id,
        );

    /*
     * =====================================================
     * SUPPORTING DATA
     * =====================================================
     */
    const [
      lotteriesResult,
      ticketsResult,
      refundsResult,
      acceptancesResult,
      notificationsResult,
      winnersResult,
      entriesResult,
    ] =
      await Promise.all(
        [
          lotteryIds.length
            ? supabaseAdmin
                .from(
                  "lotteries",
                )
                .select(
                  "id,title,slug",
                )
                .in(
                  "id",
                  lotteryIds,
                )
            : Promise.resolve(
                {
                  data:
                    [],
                  error:
                    null,
                },
              ),

          orderIds.length
            ? supabaseAdmin
                .from(
                  "lottery_tickets",
                )
                .select(
                  "id,order_id,ticket_number,status,issued_at",
                )
                .in(
                  "order_id",
                  orderIds,
                )
                .order(
                  "issued_at",
                  {
                    ascending:
                      true,
                  },
                )
            : Promise.resolve(
                {
                  data:
                    [],
                  error:
                    null,
                },
              ),

          orderIds.length
            ? supabaseAdmin
                .from(
                  "lottery_refunds",
                )
                .select(
                  "id,order_id,amount,currency,status,reason,provider_reference,requested_at,completed_at",
                )
                .in(
                  "order_id",
                  orderIds,
                )
                .order(
                  "requested_at",
                  {
                    ascending:
                      false,
                  },
                )
            : Promise.resolve(
                {
                  data:
                    [],
                  error:
                    null,
                },
              ),

          orderIds.length
            ? supabaseAdmin
                .from(
                  "lottery_acceptances",
                )
                .select(
                  "id,order_id,acceptance_type,version,accepted,accepted_at",
                )
                .in(
                  "order_id",
                  orderIds,
                )
                .order(
                  "accepted_at",
                  {
                    ascending:
                      false,
                  },
                )
            : Promise.resolve(
                {
                  data:
                    [],
                  error:
                    null,
                },
              ),

          orderIds.length
            ? supabaseAdmin
                .from(
                  "lottery_notifications",
                )
                .select(
                  "id,order_id,notification_type,recipient,status,sent_at,failed_at,error_message,created_at",
                )
                .in(
                  "order_id",
                  orderIds,
                )
                .order(
                  "created_at",
                  {
                    ascending:
                      false,
                  },
                )
            : Promise.resolve(
                {
                  data:
                    [],
                  error:
                    null,
                },
              ),

          lotteryIds.length
            ? supabaseAdmin
                .from(
                  "lottery_winners",
                )
                .select(
                  "id,lottery_id,entry_id,claimed,created_at",
                )
                .in(
                  "lottery_id",
                  lotteryIds,
                )
            : Promise.resolve(
                {
                  data:
                    [],
                  error:
                    null,
                },
              ),

          orderIds.length
            ? supabaseAdmin
                .from(
                  "lottery_entries",
                )
                .select(
                  "id,order_id",
                )
                .in(
                  "order_id",
                  orderIds,
                )
            : Promise.resolve(
                {
                  data:
                    [],
                  error:
                    null,
                },
              ),
        ],
      );

    const supportingError =
      lotteriesResult.error ||
      ticketsResult.error ||
      refundsResult.error ||
      acceptancesResult.error ||
      notificationsResult.error ||
      winnersResult.error ||
      entriesResult.error;

    if (
      supportingError
    ) {
      console.error(
        "Lottery order supporting data error:",
        supportingError,
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Unable to load complete order history.",
        },
        500,
      );
    }

    /*
     * =====================================================
     * LOOKUP MAPS
     * =====================================================
     */
    const lotteries =
      new Map(
        (
          lotteriesResult.data ||
          []
        ).map(
          (
            row,
          ) => [
            row.id,
            row,
          ],
        ),
      );

    const ticketsByOrder =
      new Map<
        string,
        any[]
      >();

    for (
      const ticket of
      ticketsResult.data ||
      []
    ) {
      const list =
        ticketsByOrder.get(
          ticket.order_id,
        ) ||
        [];

      list.push(
        ticket,
      );

      ticketsByOrder.set(
        ticket.order_id,
        list,
      );
    }

    const refundsByOrder =
      new Map<
        string,
        any[]
      >();

    for (
      const refund of
      refundsResult.data ||
      []
    ) {
      const list =
        refundsByOrder.get(
          refund.order_id,
        ) ||
        [];

      list.push(
        refund,
      );

      refundsByOrder.set(
        refund.order_id,
        list,
      );
    }

    const acceptancesByOrder =
      new Map<
        string,
        any[]
      >();

    for (
      const acceptance of
      acceptancesResult.data ||
      []
    ) {
      const list =
        acceptancesByOrder.get(
          acceptance.order_id,
        ) ||
        [];

      list.push(
        acceptance,
      );

      acceptancesByOrder.set(
        acceptance.order_id,
        list,
      );
    }

    const notificationsByOrder =
      new Map<
        string,
        any[]
      >();

    for (
      const notification of
      notificationsResult.data ||
      []
    ) {
      if (
        !notification.order_id
      ) {
        continue;
      }

      const list =
        notificationsByOrder.get(
          notification.order_id,
        ) ||
        [];

      list.push(
        notification,
      );

      notificationsByOrder.set(
        notification.order_id,
        list,
      );
    }

    const entryToOrder =
      new Map(
        (
          entriesResult.data ||
          []
        ).map(
          (
            entry,
          ) => [
            entry.id,
            entry.order_id,
          ],
        ),
      );

    const winnerCountByOrder =
      new Map<
        string,
        number
      >();

    for (
      const winner of
      winnersResult.data ||
      []
    ) {
      const orderId =
        winner.entry_id
          ? entryToOrder.get(
              winner.entry_id,
            )
          : null;

      if (
        !orderId
      ) {
        continue;
      }

      winnerCountByOrder.set(
        orderId,
        (
          winnerCountByOrder.get(
            orderId,
          ) ||
          0
        ) +
          1,
      );
    }

    /*
     * =====================================================
     * RESPONSE ITEMS
     * =====================================================
     */
    const items =
      orderRows.map(
        (
          order,
        ) => {
          const lottery =
            lotteries.get(
              order.lottery_id,
            );

          const tickets =
            ticketsByOrder.get(
              order.id,
            ) ||
            [];

          const refunds =
            refundsByOrder.get(
              order.id,
            ) ||
            [];

          const acceptances =
            acceptancesByOrder.get(
              order.id,
            ) ||
            [];

          const notifications =
            notificationsByOrder.get(
              order.id,
            ) ||
            [];

          const refundedAmount =
            refunds
              .filter(
                (
                  refund,
                ) =>
                  refund.status ===
                  "completed",
              )
              .reduce(
                (
                  sum,
                  refund,
                ) =>
                  sum +
                  Number(
                    refund.amount ||
                    0,
                  ),
                0,
              );

          const activeTickets =
            tickets.filter(
              (
                ticket,
              ) =>
                [
                  "issued",
                  "winner",
                ].includes(
                  ticket.status,
                ),
            );

          return {
            ...order,

            total_amount:
              Number(
                order.total_amount ||
                0,
              ),

            /*
             * payment_status comes directly from lottery_orders
             * AFTER Stripe reconciliation.
             */
            payment_status:
              order.payment_status,

            is_paid:
              order.payment_status ===
              "paid",

            lottery_title:
              lottery?.title ||
              "Unknown lottery",

            lottery_slug:
              lottery?.slug ||
              "",

            ticket_count:
              tickets.length,

            active_ticket_count:
              activeTickets.length,

            winner_count:
              winnerCountByOrder.get(
                order.id,
              ) ||
              0,

            refunded_amount:
              refundedAmount,

            tickets:
              tickets.map(
                (
                  ticket,
                ) => ({
                  id:
                    ticket.id,

                  ticket_number:
                    ticket.ticket_number,

                  status:
                    ticket.status,

                  issued_at:
                    ticket.issued_at,
                }),
              ),

            acceptances:
              acceptances.map(
                (
                  item,
                ) => ({
                  id:
                    item.id,

                  label:
                    item.acceptance_type,

                  status:
                    item.accepted
                      ? "Accepted"
                      : "Not accepted",

                  detail:
                    item.version
                      ? `Version ${item.version}`
                      : null,

                  created_at:
                    item.accepted_at,
                }),
              ),

            refunds:
              refunds.map(
                (
                  item,
                ) => ({
                  id:
                    item.id,

                  label:
                    `${item.currency} ${Number(
                      item.amount ||
                      0,
                    ).toFixed(
                      2,
                    )} refund`,

                  status:
                    item.status,

                  detail:
                    [
                      item.reason,
                      item.provider_reference,
                    ]
                      .filter(
                        Boolean,
                      )
                      .join(
                        " · ",
                      ) ||
                    null,

                  created_at:
                    item.completed_at ||
                    item.requested_at,
                }),
              ),

            notifications:
              notifications.map(
                (
                  item,
                ) => ({
                  id:
                    item.id,

                  label:
                    item.notification_type,

                  status:
                    item.status,

                  detail:
                    item.error_message ||
                    (
                      item.recipient
                        ? `Recipient: ${item.recipient}`
                        : null
                    ),

                  created_at:
                    item.sent_at ||
                    item.failed_at ||
                    item.created_at,
                }),
              ),
          };
        },
      );

    /*
     * =====================================================
     * SUCCESS
     * =====================================================
     */
    return jsonResponse({
      ok: true,

      items,

      stripe_sync: {
        checked:
          stripeSync.checked,

        paid_found:
          stripeSync.paid_found,

        finalised:
          stripeSync.finalised,

        failed:
          stripeSync.failed,

        skipped:
          stripeSync.skipped,
      },
    });
  } catch (
    error
  ) {
    console.error(
      "Lottery orders API error:",
      error,
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "Unable to load lottery orders.",
      },
      500,
    );
  }
}


type ManualPaidAdmin = {
  id: string;
  supabase_user_id: string | null;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  is_main_admin: boolean | null;
};

type ManualPaidOrder = {
  id: string;
  lottery_id: string;
  order_reference: string;
  purchaser_name: string | null;
  purchaser_email: string | null;
  purchaser_phone: string | null;
  quantity: number;
  total_amount: number | string | null;
  currency: string | null;
  payment_status: string | null;
  payment_reference: string | null;
  paid_at: string | null;
  updated_at?: string | null;
};

type ManualPaidLottery = {
  id: string;
  title: string;
  slug: string;
  draw_at: string | null;
  max_tickets: number | null;
};

type ManualPaidTicket = {
  id: string;
  ticket_number: string;
  status: string;
  issued_at: string | null;
};

function escapeHtml(
  value: unknown,
) {
  return String(
    value ?? "",
  )
    .replaceAll(
      "&",
      "&amp;",
    )
    .replaceAll(
      "<",
      "&lt;",
    )
    .replaceAll(
      ">",
      "&gt;",
    )
    .replaceAll(
      '"',
      "&quot;",
    )
    .replaceAll(
      "'",
      "&#039;",
    );
}

function formatManualPaidMoney(
  value: number | string | null,
  currency = "GBP",
) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style:
        "currency",

      currency:
        currency ||
        "GBP",
    },
  ).format(
    Number(
      value ||
      0,
    ),
  );
}

function formatManualPaidDate(
  value: string | null,
) {
  if (!value) {
    return "To be confirmed";
  }

  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return date.toLocaleString(
    "en-GB",
    {
      dateStyle:
        "full",

      timeStyle:
        "short",

      timeZone:
        "Europe/London",
    },
  );
}


function parseNumericTicketNumber(
  value: unknown,
) {
  const text =
    String(
      value ?? "",
    ).trim();

  if (
    !/^[1-9][0-9]*$/.test(
      text,
    )
  ) {
    return null;
  }

  const number =
    Number(
      text,
    );

  return Number.isSafeInteger(
    number,
  )
    ? number
    : null;
}

async function getUsedNumericTicketNumbers(
  lotteryId: string,
) {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "lottery_tickets",
      )
      .select(
        "ticket_number",
      )
      .eq(
        "lottery_id",
        lotteryId,
      );

  if (
    error
  ) {
    throw new Error(
      `Unable to load used lottery numbers: ${error.message}`,
    );
  }

  const used =
    new Set<number>();

  for (
    const row of
    data || []
  ) {
    const number =
      parseNumericTicketNumber(
        row.ticket_number,
      );

    if (
      number !==
      null
    ) {
      used.add(
        number,
      );
    }
  }

  return used;
}

function getRandomUnusedTicketNumber(
  used: Set<number>,
  maxTickets: number,
) {
  const usedNumbers =
    Array.from(
      used,
    )
      .filter(
        (
          number,
        ) =>
          Number.isInteger(
            number,
          ) &&
          number >= 1 &&
          number <= maxTickets,
      )
      .sort(
        (
          first,
          second,
        ) =>
          first - second,
      );

  const availableCount =
    maxTickets -
    usedNumbers.length;

  if (
    availableCount < 1
  ) {
    return null;
  }

  // Pick a uniform random position from every unused number and map
  // it through the gaps between issued numbers. Runtime depends on
  // issued ticket count, not a maximum range that may exceed 2bn.
  let availableIndex =
    randomInt(
      availableCount,
    );

  let previousUsedNumber =
    0;

  for (
    const usedNumber of
    usedNumbers
  ) {
    const gapSize =
      usedNumber -
      previousUsedNumber -
      1;

    if (
      availableIndex <
        gapSize
    ) {
      return (
        previousUsedNumber +
        availableIndex +
        1
      );
    }

    availableIndex -=
      gapSize;

    previousUsedNumber =
      usedNumber;
  }

  return (
    previousUsedNumber +
    availableIndex +
    1
  );
}

function shuffleManualTicketsForDisplay(
  tickets: ManualPaidTicket[],
) {
  const shuffled =
    [
      ...tickets,
    ];

  for (
    let index =
      shuffled.length - 1;
    index > 0;
    index -= 1
  ) {
    const swapIndex =
      randomInt(
        index + 1,
      );

    [
      shuffled[index],
      shuffled[swapIndex],
    ] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }

  const isAscending =
    shuffled.length > 1 &&
    shuffled.every(
      (
        ticket,
        index,
      ) => {
        if (
          index === 0
        ) {
          return true;
        }

        const previousNumber =
          parseNumericTicketNumber(
            shuffled[
              index - 1
            ].ticket_number,
          );

        const currentNumber =
          parseNumericTicketNumber(
            ticket.ticket_number,
          );

        return (
          previousNumber !==
            null &&
          currentNumber !==
            null &&
          previousNumber <
            currentNumber
        );
      },
    );

  if (
    isAscending
  ) {
    [
      shuffled[0],
      shuffled[1],
    ] = [
      shuffled[1],
      shuffled[0],
    ];
  }

  return shuffled;
}


async function getCurrentMainAdminForManualPayment() {
  const authClient =
    await createClient();

  const {
    data: {
      user,
    },
    error:
      authError,
  } =
    await authClient
      .auth
      .getUser();

  if (
    authError ||
    !user ||
    !user.email
  ) {
    return {
      ok:
        false as const,

      status:
        401,

      error:
        "Unauthorized.",
    };
  }

  /*
   * admin_users is linked to Supabase Auth through supabase_user_id.
   * Email is used only as a fallback for older linked admin records.
   */
  let {
    data:
      adminData,
    error:
      adminError,
  } =
    await supabaseAdmin
      .from(
        "admin_users",
      )
      .select(
        "id,supabase_user_id,email,full_name,role,is_active,is_main_admin",
      )
      .eq(
        "supabase_user_id",
        user.id,
      )
      .eq(
        "is_active",
        true,
      )
      .maybeSingle();

  if (
    adminError
  ) {
    console.error(
      "Lottery manual-paid admin lookup by Supabase user ID failed:",
      adminError,
    );
  }

  if (
    !adminData
  ) {
    const fallback =
      await supabaseAdmin
        .from(
          "admin_users",
        )
        .select(
          "id,supabase_user_id,email,full_name,role,is_active,is_main_admin",
        )
        .ilike(
          "email",
          user.email,
        )
        .eq(
          "is_active",
          true,
        )
        .maybeSingle();

    if (
      fallback.error
    ) {
      console.error(
        "Lottery manual-paid admin fallback lookup failed:",
        fallback.error,
      );
    }

    adminData =
      fallback.data;
  }

  if (
    !adminData
  ) {
    return {
      ok:
        false as const,

      status:
        403,

      error:
        "Your administrator account could not be verified.",
    };
  }

  const admin =
    adminData as ManualPaidAdmin;

  const role =
    String(
      admin.role ||
      "",
    )
      .trim()
      .toLowerCase()
      .replace(
        /[\s-]+/g,
        "_",
      );

  const isMainAdmin =
    role ===
      "main_admin" ||
    admin.is_main_admin ===
      true;

  if (
    !isMainAdmin
  ) {
    return {
      ok:
        false as const,

      status:
        403,

      error:
        "Only a main admin can manually mark a lottery order as paid.",
    };
  }

  return {
    ok:
      true as const,

    user,

    admin,
  };
}

async function verifyManualPaymentMainAdminPassword(
  password: string,
) {
  const cleanedPassword =
    String(
      password ||
      "",
    ).trim();

  if (
    !cleanedPassword
  ) {
    return {
      ok:
        false as const,

      status:
        400,

      error:
        "Enter the main admin password.",
    };
  }

  /*
   * This is intentionally the same password record used by
   * /api/admin/settings/delete-password.
   *
   * The password itself is never stored or written to logs.
   */
  const {
    data:
      setting,
    error:
      settingError,
  } =
    await supabaseAdmin
      .from(
        DELETE_SETTINGS_TABLE,
      )
      .select(
        "id,action_key,password_hash,updated_at",
      )
      .eq(
        "action_key",
        MAIN_ADMIN_PASSWORD_ACTION_KEY,
      )
      .maybeSingle();

  if (
    settingError
  ) {
    console.error(
      "Lottery manual-paid delete-password setting lookup failed:",
      settingError,
    );

    return {
      ok:
        false as const,

      status:
        500,

      error:
        "The main admin password setting could not be loaded.",

      code:
        settingError.code,
    };
  }

  if (
    !setting?.password_hash
  ) {
    return {
      ok:
        false as const,

      status:
        400,

      error:
        "No main admin password has been configured yet. Set it in Admin Settings first.",

      code:
        "MAIN_ADMIN_DELETE_PASSWORD_NOT_SET",
    };
  }

  let passwordMatches =
    false;

  try {
    passwordMatches =
      await bcrypt.compare(
        cleanedPassword,
        setting.password_hash,
      );
  } catch (
    error
  ) {
    console.error(
      "Lottery manual-paid bcrypt password verification failed:",
      error,
    );

    return {
      ok:
        false as const,

      status:
        500,

      error:
        "The saved main admin password could not be checked.",

      code:
        "DELETE_PASSWORD_HASH_COMPARE_FAILED",
    };
  }

  if (
    !passwordMatches
  ) {
    return {
      ok:
        false as const,

      status:
        403,

      error:
        "The main admin password is incorrect.",

      code:
        "MAIN_ADMIN_PASSWORD_INCORRECT",
    };
  }

  return {
    ok:
      true as const,

    status:
      200,
  };
}

async function loadManualPaidTickets(
  orderId: string,
) {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "lottery_tickets",
      )
      .select(
        "id,ticket_number,status,issued_at",
      )
      .eq(
        "order_id",
        orderId,
      )
      .order(
        "issued_at",
        {
          ascending:
            true,
        },
      );

  if (
    error
  ) {
    throw new Error(
      `Unable to load existing ticket numbers: ${error.message}`,
    );
  }

  return (
    data ||
    []
  ) as ManualPaidTicket[];
}

async function createMissingManualPaidTickets(
  order: ManualPaidOrder,
  lottery: ManualPaidLottery,
) {
  const tickets =
    await loadManualPaidTickets(
      order.id,
    );

  const createdIds:
    string[] =
    [];

  const required =
    Math.max(
      1,
      Number(
        order.quantity ||
        1,
      ),
    );

  const maxTickets =
    Math.floor(
      Number(
        lottery.max_tickets ||
        0,
      ),
    );

  if (
    !Number.isFinite(
      maxTickets,
    ) ||
    maxTickets < 1
  ) {
    throw new Error(
      "This lottery does not have a valid maximum ticket number.",
    );
  }

  const missing =
    Math.max(
      0,
      required -
        tickets.length,
    );

  if (
    missing ===
    0
  ) {
    return {
      tickets,
      createdIds,
    };
  }

  const used =
    await getUsedNumericTicketNumbers(
      order.lottery_id,
    );

  try {
    for (
      let index = 0;
      index < missing;
      index += 1
    ) {
      let created:
        | ManualPaidTicket
        | null =
        null;

      for (
        let attempt = 0;
        attempt < maxTickets;
        attempt += 1
      ) {
        const nextNumber =
          getRandomUnusedTicketNumber(
            used,
            maxTickets,
          );

        if (
          nextNumber ===
          null
        ) {
          throw new Error(
            "No lottery numbers are available. This lottery is sold out.",
          );
        }

        const ticketNumber =
          String(
            nextNumber,
          );

        const {
          data:
            inserted,
          error:
            insertError,
        } =
          await supabaseAdmin
            .from(
              "lottery_tickets",
            )
            .insert({
              lottery_id:
                order.lottery_id,

              order_id:
                order.id,

              ticket_number:
                ticketNumber,

              status:
                "issued",

              issued_at:
                new Date()
                  .toISOString(),
            })
            .select(
              "id,ticket_number,status,issued_at",
            )
            .single();

        if (
          !insertError &&
          inserted
        ) {
          created =
            inserted as ManualPaidTicket;

          createdIds.push(
            created.id,
          );

          used.add(
            nextNumber,
          );

          break;
        }

        if (
          insertError?.code ===
          "23505"
        ) {
          used.add(
            nextNumber,
          );

          continue;
        }

        throw new Error(
          insertError?.message ||
            "Unable to issue the lottery ticket.",
        );
      }

      if (
        !created
      ) {
        throw new Error(
          "Unable to allocate an available numeric lottery number.",
        );
      }

      tickets.push(
        created,
      );
    }

    return {
      tickets,
      createdIds,
    };
  } catch (
    error
  ) {
    if (
      createdIds.length
    ) {
      const cleanup =
        await supabaseAdmin
          .from(
            "lottery_tickets",
          )
          .delete()
          .in(
            "id",
            createdIds,
          );

      if (
        cleanup.error
      ) {
        console.error(
          "Lottery ticket cleanup failed:",
          cleanup.error,
        );
      }
    }

    throw error;
  }
}

function manualTicketHtml(
  tickets: ManualPaidTicket[],
) {
  return tickets
    .map(
      (
        ticket,
      ) =>
        `<div style="margin:8px 0;padding:13px 15px;border-radius:12px;background:#f3e8ff;color:#581c87;font-size:18px;font-weight:800;letter-spacing:.04em;">${escapeHtml(
          ticket.ticket_number,
        )}</div>`,
    )
    .join(
      "",
    );
}

function manualTicketText(
  tickets: ManualPaidTicket[],
) {
  return tickets
    .map(
      (
        ticket,
      ) =>
        `- ${ticket.ticket_number}`,
    )
    .join(
      "\n",
    );
}

async function recordManualPaymentNotification({
  lotteryId,
  orderId,
  notificationType,
  recipient,
  status,
  errorMessage = null,
}: {
  lotteryId: string;
  orderId: string;
  notificationType: string;
  recipient: string;
  status: "sent" | "failed";
  errorMessage?: string | null;
}) {
  const now =
    new Date()
      .toISOString();

  const {
    error,
  } =
    await supabaseAdmin
      .from(
        "lottery_notifications",
      )
      .insert({
        lottery_id:
          lotteryId,

        order_id:
          orderId,

        notification_type:
          notificationType,

        recipient,

        status,

        sent_at:
          status ===
          "sent"
            ? now
            : null,

        failed_at:
          status ===
          "failed"
            ? now
            : null,

        error_message:
          errorMessage,
      });

  if (
    error
  ) {
    console.warn(
      "Lottery notification history could not be saved:",
      error,
    );
  }
}

async function sendPaidOrderEmails({
  order,
  lottery,
  tickets:
    suppliedTickets,
  source,
}: {
  order: ManualPaidOrder;
  lottery: ManualPaidLottery;
  tickets: ManualPaidTicket[];
  source: "stripe" | "manual" | "ticket_recovery";
}) {
  const tickets =
    shuffleManualTicketsForDisplay(
      suppliedTickets,
    );

  if (
    !process.env.RESEND_API_KEY
  ) {
    throw new Error(
      "RESEND_API_KEY is not configured.",
    );
  }

  if (
    !order.purchaser_email
  ) {
    throw new Error(
      "The order does not have a purchaser email address.",
    );
  }

  const customerNotificationType =
    source === "stripe"
      ? "paid_entry_customer_confirmation"
      : source === "ticket_recovery"
        ? "missing_ticket_customer_confirmation"
        : "paid_entry_manual_confirmation";

  const internalNotificationType =
    source === "stripe"
      ? "paid_entry_internal_notification"
      : source === "ticket_recovery"
        ? "missing_ticket_internal_notification"
        : "paid_entry_manual_internal_notification";

  const internalSubject =
    source === "stripe"
      ? `New paid lottery entry: ${order.order_reference}`
      : source === "ticket_recovery"
        ? `Missing lottery ticket issued: ${order.order_reference}`
        : `Manual paid lottery entry: ${order.order_reference}`;

  const internalHeading =
    source === "stripe"
      ? "A paid lottery entry has been received"
      : source === "ticket_recovery"
        ? "A missing lottery ticket has been issued"
        : "A manual paid lottery entry has been received";

  const internalIntro =
    source === "stripe"
      ? "Stripe has confirmed this lottery payment as paid."
      : source === "ticket_recovery"
        ? "A main admin issued the missing ticket number for this paid order."
        : "A main admin manually confirmed this lottery order as paid.";

  const customerSubject =
    `Your ${lottery.title} lottery number${
      tickets.length ===
      1
        ? ""
        : "s"
    }`;

  const customerHtml =
    `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#172033;">
    <div style="max-width:640px;margin:0 auto;padding:30px 18px;">
      <div style="overflow:hidden;border-radius:22px;background:#ffffff;border:1px solid #e2e8f0;">
        <div style="padding:30px;background:linear-gradient(135deg,#ec4899,#7c3aed,#2563eb);color:#ffffff;text-align:center;">
          <div style="font-size:13px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#fde68a;">Burton Pride Lottery</div>
          <h1 style="margin:10px 0 0;font-size:30px;line-height:1.2;">Your lottery entry is confirmed</h1>
        </div>

        <div style="padding:30px;">
          <p style="margin-top:0;font-size:17px;line-height:1.7;">
            Hello <strong>${escapeHtml(
              order.purchaser_name ||
                "supporter",
            )}</strong>,
          </p>

          <p style="font-size:16px;line-height:1.7;">
            Your payment for
            <strong>${escapeHtml(
              lottery.title,
            )}</strong> has been confirmed.
            Your entry is now marked as paid and your lottery number${
              tickets.length ===
              1
                ? " has"
                : "s have"
            } been issued.
          </p>

          <h2 style="margin:28px 0 10px;font-size:20px;">
            Your lottery number${tickets.length === 1 ? "" : "s"}
          </h2>

          ${manualTicketHtml(
            tickets,
          )}

          <div style="margin-top:28px;padding:18px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0;">
            <p style="margin:0 0 8px;"><strong>Order reference:</strong> ${escapeHtml(
              order.order_reference,
            )}</p>
            <p style="margin:0 0 8px;"><strong>Lottery:</strong> ${escapeHtml(
              lottery.title,
            )}</p>
            <p style="margin:0 0 8px;"><strong>Tickets:</strong> ${escapeHtml(
              order.quantity,
            )}</p>
            <p style="margin:0 0 8px;"><strong>Amount:</strong> ${escapeHtml(
              formatManualPaidMoney(
                order.total_amount,
                order.currency ||
                  "GBP",
              ),
            )}</p>
            <p style="margin:0;"><strong>Draw:</strong> ${escapeHtml(
              formatManualPaidDate(
                lottery.draw_at,
              ),
            )}</p>
          </div>

          <p style="margin:26px 0 0;font-size:15px;line-height:1.7;color:#475569;">
            Please keep this email safe until the draw has taken place. If you purchased more than one
            ticket, every number shown above is one separate entry.
          </p>

          <p style="margin:22px 0 0;font-size:15px;line-height:1.7;color:#475569;">
            Good luck, and thank you for supporting Burton Pride.
          </p>
        </div>
      </div>

      <p style="margin:18px 0 0;text-align:center;font-size:12px;line-height:1.6;color:#64748b;">
        This is an automated lottery confirmation from Burton Pride.
      </p>

      <div style="margin:14px 0 0;padding:18px;border-radius:14px;background:#ffffff;border:1px solid #e2e8f0;color:#475569;font-size:12px;line-height:1.65;">
        <p style="margin:0 0 10px;font-weight:700;color:#172033;">
          This is an official Burton Pride lottery.
        </p>
        <p style="margin:0 0 10px;">
          The promoter of Burton Pride lotteries is <strong>Burton Pride C.I.C.</strong>
        </p>
        <p style="margin:0 0 10px;">
          Burton Pride C.I.C. is a grassroots, community-led Community Interest Company created to support the LGBTQIA+ community and allies in Burton upon Trent and the surrounding area.
        </p>
        <p style="margin:0 0 10px;">
          Where a lottery is operated under Burton Pride C.I.C.'s small society lottery registration, the relevant registration information will be displayed on the individual lottery page or within its Individual Lottery Terms.
        </p>
        <p style="margin:0 0 10px;">
          Where another permission, licence, exemption or lottery category applies, this will also be identified where required.
        </p>
        <p style="margin:0;">
          Burton Pride C.I.C.'s small society lottery registration number is <strong>SL0507</strong>, issued by East Staffordshire Borough Council.
        </p>
      </div>
    </div>
  </body>
</html>`;

  const customerText =
    `BURTON PRIDE LOTTERY

Hello ${order.purchaser_name || "supporter"},

Your payment for ${lottery.title} has been confirmed and your lottery entry is now marked as paid.

Your lottery number${tickets.length === 1 ? "" : "s"}:
${manualTicketText(
  tickets,
)}

Order reference: ${order.order_reference}
Tickets: ${order.quantity}
Amount: ${formatManualPaidMoney(
      order.total_amount,
      order.currency ||
        "GBP",
    )}
Draw: ${formatManualPaidDate(
      lottery.draw_at,
    )}

Please keep this email safe until the draw has taken place. If you purchased more than one ticket, every number shown above is one separate entry.

Good luck, and thank you for supporting Burton Pride.

This is an automated lottery confirmation from Burton Pride.

This is an official Burton Pride lottery.

The promoter of Burton Pride lotteries is Burton Pride C.I.C.

Burton Pride C.I.C. is a grassroots, community-led Community Interest Company created to support the LGBTQIA+ community and allies in Burton upon Trent and the surrounding area.

Where a lottery is operated under Burton Pride C.I.C.'s small society lottery registration, the relevant registration information will be displayed on the individual lottery page or within its Individual Lottery Terms.

Where another permission, licence, exemption or lottery category applies, this will also be identified where required.

Burton Pride C.I.C.'s small society lottery registration number is SL0507, issued by East Staffordshire Borough Council.`;

  const customerResult =
    await resend
      .emails
      .send({
        from:
          LOTTERY_FROM_EMAIL,

        to: [
          order.purchaser_email,
        ],

        replyTo:
          LOTTERY_INFO_EMAIL,

        subject:
          customerSubject,

        html:
          customerHtml,

        text:
          customerText,
      });

  if (
    customerResult.error
  ) {
    await recordManualPaymentNotification({
      lotteryId:
        lottery.id,

      orderId:
        order.id,

      notificationType:
        customerNotificationType,

      recipient:
        order.purchaser_email,

      status:
        "failed",

      errorMessage:
        customerResult.error.message,
    });

    throw new Error(
      customerResult.error.message ||
        "Resend could not send the customer confirmation email.",
    );
  }

  await recordManualPaymentNotification({
    lotteryId:
      lottery.id,

    orderId:
      order.id,

    notificationType:
      customerNotificationType,

    recipient:
      order.purchaser_email,

    status:
      "sent",
  });

  /*
   * Internal notification is best effort.
   * A failure here must not undo the confirmed customer entry.
   */
  try {
    const internalResult =
      await resend
        .emails
        .send({
          from:
            LOTTERY_FROM_EMAIL,

          to: [
            LOTTERY_INFO_EMAIL,
          ],

          replyTo:
            LOTTERY_INFO_EMAIL,

          subject:
            internalSubject,

          html:
            `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#172033;">
    <div style="max-width:680px;margin:0 auto;padding:30px 18px;">
      <div style="overflow:hidden;border-radius:22px;background:#ffffff;border:1px solid #e2e8f0;">
        <div style="padding:26px 30px;background:#1e1b4b;color:#ffffff;">
          <div style="font-size:13px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#fde68a;">Lottery Admin Notification</div>
          <h1 style="margin:9px 0 0;font-size:28px;">${internalHeading}</h1>
        </div>

        <div style="padding:30px;">
          <p><strong>Order:</strong> ${escapeHtml(
            order.order_reference,
          )}</p>
          <p><strong>Entrant:</strong> ${escapeHtml(
            order.purchaser_name ||
              "Not provided",
          )}</p>
          <p><strong>Email:</strong> ${escapeHtml(
            order.purchaser_email,
          )}</p>
          <p><strong>Lottery:</strong> ${escapeHtml(
            lottery.title,
          )}</p>
          <p><strong>Amount:</strong> ${escapeHtml(
            formatManualPaidMoney(
              order.total_amount,
              order.currency ||
                "GBP",
            ),
          )}</p>

          <h2 style="margin:24px 0 10px;">Issued lottery number${tickets.length === 1 ? "" : "s"}</h2>
          ${manualTicketHtml(
            tickets,
          )}
        </div>
      </div>
    </div>
  </body>
</html>`,

          text:
            `${internalIntro}

Order: ${order.order_reference}
Entrant: ${order.purchaser_name || "Not provided"}
Email: ${order.purchaser_email}
Lottery: ${lottery.title}
Amount: ${formatManualPaidMoney(
              order.total_amount,
              order.currency ||
                "GBP",
            )}

Issued lottery number${tickets.length === 1 ? "" : "s"}:
${manualTicketText(
  tickets,
)}`,
        });

    if (
      internalResult.error
    ) {
      throw new Error(
        internalResult.error.message,
      );
    }

    await recordManualPaymentNotification({
      lotteryId:
        lottery.id,

      orderId:
        order.id,

      notificationType:
        internalNotificationType,

      recipient:
        LOTTERY_INFO_EMAIL,

      status:
        "sent",
    });
  } catch (
    error
  ) {
    const message =
      error instanceof
      Error
        ? error.message
        : "Unknown Resend error";

    console.warn(
      "Lottery manual-paid internal email failed:",
      error,
    );

    await recordManualPaymentNotification({
      lotteryId:
        lottery.id,

      orderId:
        order.id,

      notificationType:
        internalNotificationType,

      recipient:
        LOTTERY_INFO_EMAIL,

      status:
        "failed",

      errorMessage:
        message,
    });
  }
}

async function writeManualPaidAudit({
  admin,
  order,
  lottery,
  tickets,
}: {
  admin: ManualPaidAdmin;
  order: ManualPaidOrder;
  lottery: ManualPaidLottery;
  tickets: ManualPaidTicket[];
}) {
  const {
    error,
  } =
    await supabaseAdmin
      .from(
        "admin_audit_logs",
      )
      .insert({
        admin_id:
          admin.id,

        admin_email:
          admin.email,

        action:
          "lottery_order_manually_marked_paid",

        area:
          "lottery_management",

        route:
          "/api/admin/lotterymanagement/orders",

        method:
          "PATCH",

        status:
          "completed",

        target_type:
          "lottery_order",

        target_id:
          order.id,

        target_label:
          order.order_reference,

        metadata: {
          previous_payment_status:
            "pending",

          new_payment_status:
            "paid",

          lottery_id:
            lottery.id,

          lottery_title:
            lottery.title,

          main_admin_verified:
            true,

          password_verified:
            true,

          password_source:
            "admin_delete_settings",

          password_action_key:
            MAIN_ADMIN_PASSWORD_ACTION_KEY,

          password_verification_api:
            "/api/admin/settings/delete-password/",

          ticket_numbers:
            tickets.map(
              (
                ticket,
              ) =>
                ticket.ticket_number,
            ),

          payment_reference:
            order.payment_reference,
        },

        created_at:
          new Date()
            .toISOString(),
      });

  if (
    error
  ) {
    console.warn(
      "Lottery manual-paid audit could not be written:",
      error,
    );
  }
}

async function writeMissingTicketAudit({
  admin,
  order,
  lottery,
  tickets,
  issuedTickets,
}: {
  admin: ManualPaidAdmin;
  order: ManualPaidOrder;
  lottery: ManualPaidLottery;
  tickets: ManualPaidTicket[];
  issuedTickets: ManualPaidTicket[];
}) {
  const { error } = await supabaseAdmin
    .from("admin_audit_logs")
    .insert({
      admin_id: admin.id,
      admin_email: admin.email,
      action: "lottery_order_missing_tickets_issued",
      area: "lottery_management",
      route: "/api/admin/lotterymanagement/orders",
      method: "PATCH",
      status: "completed",
      target_type: "lottery_order",
      target_id: order.id,
      target_label: order.order_reference,
      metadata: {
        payment_status: order.payment_status,
        lottery_id: lottery.id,
        lottery_title: lottery.title,
        ordered_quantity: order.quantity,
        issued_count: issuedTickets.length,
        issued_ticket_numbers: issuedTickets.map(
          (ticket) => ticket.ticket_number,
        ),
        all_ticket_numbers: tickets.map(
          (ticket) => ticket.ticket_number,
        ),
        main_admin_verified: true,
        password_verified: true,
        password_source: "admin_delete_settings",
        password_action_key: MAIN_ADMIN_PASSWORD_ACTION_KEY,
      },
      created_at: new Date().toISOString(),
    });

  if (error) {
    console.warn(
      "Lottery missing-ticket audit could not be written:",
      error,
    );
  }
}

function cleanEditableOrderText(
  value: unknown,
  maxLength: number,
) {
  return String(
    value ?? "",
  )
    .trim()
    .slice(
      0,
      maxLength,
    );
}

function isValidOrderEmail(
  value: string,
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value,
  );
}

async function updateProtectedLotteryOrder({
  auth,
  orderId,
  changes,
}: {
  auth: {
    admin: ManualPaidAdmin;
  };
  orderId: string;
  changes: Record<string, unknown>;
}) {
  const {
    data:
      existingOrder,
    error:
      existingError,
  } =
    await supabaseAdmin
      .from(
        "lottery_orders",
      )
      .select(
        `
        id,
        lottery_id,
        order_reference,
        purchaser_name,
        purchaser_email,
        purchaser_phone,
        quantity,
        total_amount,
        currency,
        payment_status,
        payment_reference,
        eligibility_accepted,
        terms_version,
        privacy_notice_version,
        marketing_opt_in,
        created_at,
        updated_at,
        paid_at
        `,
      )
      .eq(
        "id",
        orderId,
      )
      .single();

  if (
    existingError ||
    !existingOrder
  ) {
    return jsonResponse(
      {
        ok:
          false,

        error:
          "The lottery order could not be found.",
      },
      404,
    );
  }

  const purchaserName =
    cleanEditableOrderText(
      changes.purchaser_name,
      200,
    );

  const purchaserEmail =
    cleanEditableOrderText(
      changes.purchaser_email,
      320,
    )
      .toLowerCase();

  const purchaserPhoneText =
    cleanEditableOrderText(
      changes.purchaser_phone,
      50,
    );

  const purchaserPhone =
    purchaserPhoneText ||
    null;

  const marketingOptIn =
    changes.marketing_opt_in ===
    true;

  if (
    !purchaserName
  ) {
    return jsonResponse(
      {
        ok:
          false,

        error:
          "Purchaser name is required.",
      },
      400,
    );
  }

  if (
    !purchaserEmail ||
    !isValidOrderEmail(
      purchaserEmail,
    )
  ) {
    return jsonResponse(
      {
        ok:
          false,

        error:
          "A valid purchaser email address is required.",
      },
      400,
    );
  }

  const before = {
    purchaser_name:
      existingOrder.purchaser_name,

    purchaser_email:
      existingOrder.purchaser_email,

    purchaser_phone:
      existingOrder.purchaser_phone,

    marketing_opt_in:
      existingOrder.marketing_opt_in,
  };

  const after = {
    purchaser_name:
      purchaserName,

    purchaser_email:
      purchaserEmail,

    purchaser_phone:
      purchaserPhone,

    marketing_opt_in:
      marketingOptIn,
  };

  const changedFields =
    Object.keys(
      after,
    ).filter(
      (
        key,
      ) =>
        String(
          before[
            key as keyof typeof before
          ] ??
          "",
        ) !==
        String(
          after[
            key as keyof typeof after
          ] ??
          "",
        ),
    );

  if (
    changedFields.length ===
    0
  ) {
    return jsonResponse(
      {
        ok:
          false,

        error:
          "No order details have changed.",
      },
      400,
    );
  }

  const updatedAt =
    new Date()
      .toISOString();

  const {
    data:
      updatedOrder,
    error:
      updateError,
  } =
    await supabaseAdmin
      .from(
        "lottery_orders",
      )
      .update({
        ...after,

        updated_at:
          updatedAt,
      })
      .eq(
        "id",
        orderId,
      )
      .select(
        `
        id,
        order_reference,
        purchaser_name,
        purchaser_email,
        purchaser_phone,
        marketing_opt_in,
        updated_at
        `,
      )
      .single();

  if (
    updateError ||
    !updatedOrder
  ) {
    console.error(
      "Lottery protected order edit failed:",
      updateError,
    );

    return jsonResponse(
      {
        ok:
          false,

        error:
          "The order changes could not be saved.",

        code:
          updateError?.code ||
          null,
      },
      500,
    );
  }

  /*
   * Record every protected edit.
   * Password values are NEVER written to audit metadata.
   */
  const {
    error:
      auditError,
  } =
    await supabaseAdmin
      .from(
        "admin_audit_logs",
      )
      .insert({
        admin_id:
          auth.admin.id,

        admin_email:
          auth.admin.email,

        action:
          "lottery_order_edited",

        area:
          "lottery_management",

        route:
          "/api/admin/lotterymanagement/orders",

        method:
          "PATCH",

        status:
          "completed",

        target_type:
          "lottery_order",

        target_id:
          existingOrder.id,

        target_label:
          existingOrder.order_reference,

        metadata: {
          change_type:
            "protected_order_edit",

          changed_fields:
            changedFields,

          before,

          after,

          main_admin_verified:
            true,

          password_verified:
            true,

          password_source:
            "admin_delete_settings",

          password_action_key:
            MAIN_ADMIN_PASSWORD_ACTION_KEY,

          password_verification_api:
            "/api/admin/settings/delete-password/",
        },

        created_at:
          updatedAt,
      });

  if (
    auditError
  ) {
    console.warn(
      "Lottery protected order edit audit could not be written:",
      auditError,
    );
  }

  return jsonResponse({
    ok:
      true,

    message:
      `Order updated successfully. ${changedFields.length} field${
        changedFields.length ===
        1
          ? ""
          : "s"
      } changed.`,

    order:
      updatedOrder,

    changed_fields:
      changedFields,
  });
}


export async function PATCH(
  request: NextRequest,
) {
  try {
    const auth =
      await getCurrentMainAdminForManualPayment();

    if (
      !auth.ok
    ) {
      return jsonResponse(
        {
          ok:
            false,

          error:
            auth.error,
        },
        auth.status,
      );
    }

    let body:
      Record<
        string,
        unknown
      >;

    try {
      body =
        await request.json();
    } catch {
      return jsonResponse(
        {
          ok:
            false,

          error:
            "The payment update request is invalid.",
        },
        400,
      );
    }

    const action =
      String(
        body.action ||
        "",
      )
        .trim()
        .toLowerCase();

    const orderId =
      String(
        body.order_id ||
        "",
      ).trim();

    const password =
      String(
        body.main_admin_password ||
        "",
      );

    if (
      action !==
        "mark_paid" &&
      action !==
        "edit_order" &&
      action !==
        "issue_missing_tickets"
    ) {
      return jsonResponse(
        {
          ok:
            false,

          error:
            "Unsupported order action.",
        },
        400,
      );
    }

    if (
      !orderId
    ) {
      return jsonResponse(
        {
          ok:
            false,

          error:
            "Order ID is required.",
        },
        400,
      );
    }

    if (
      !password.trim()
    ) {
      return jsonResponse(
        {
          ok:
            false,

          error:
            "Enter the main admin settings password before changing this order.",
        },
        400,
      );
    }

    if (
      password.length >
      256
    ) {
      return jsonResponse(
        {
          ok:
            false,

          error:
            "The password could not be accepted.",
        },
        400,
      );
    }

    const passwordVerification =
      await verifyManualPaymentMainAdminPassword(
        password,
      );

    if (
      !passwordVerification.ok
    ) {
      return jsonResponse(
        {
          ok:
            false,

          error:
            passwordVerification.error,

          code:
            "code" in passwordVerification
              ? passwordVerification.code
              : undefined,
        },
        passwordVerification.status,
      );
    }

    if (
      action ===
      "edit_order"
    ) {
      const rawChanges =
        body.changes;

      if (
        !rawChanges ||
        typeof rawChanges !==
          "object" ||
        Array.isArray(
          rawChanges,
        )
      ) {
        return jsonResponse(
          {
            ok:
              false,

            error:
              "Order changes are required.",
          },
          400,
        );
      }

      return updateProtectedLotteryOrder({
        auth,
        orderId,
        changes:
          rawChanges as Record<
            string,
            unknown
          >,
      });
    }

    /*
     * Re-read the order after password verification.
     * Only waiting-payment/pending orders may use this override.
     */
    const {
      data:
        orderData,
      error:
        orderError,
    } =
      await supabaseAdmin
        .from(
          "lottery_orders",
        )
        .select(
          `
          id,
          lottery_id,
          order_reference,
          purchaser_name,
          purchaser_email,
          purchaser_phone,
          quantity,
          total_amount,
          currency,
          payment_status,
          payment_reference,
          paid_at,
          updated_at
          `,
        )
        .eq(
          "id",
          orderId,
        )
        .single();

    if (
      orderError ||
      !orderData
    ) {
      return jsonResponse(
        {
          ok:
            false,

          error:
            "The lottery order could not be found.",
        },
        404,
      );
    }

    const order =
      orderData as ManualPaidOrder;

    if (
      action ===
      "issue_missing_tickets"
    ) {
      if (
        order.payment_status !==
        "paid"
      ) {
        return jsonResponse(
          {
            ok: false,
            error:
              "Missing tickets can only be issued for an order that is already marked as paid.",
          },
          409,
        );
      }

      if (
        !order.purchaser_email
      ) {
        return jsonResponse(
          {
            ok: false,
            error:
              "This order has no purchaser email address. Add an email address before issuing the missing ticket.",
          },
          409,
        );
      }

      const existingTickets =
        await loadManualPaidTickets(
          order.id,
        );

      const requiredTickets =
        Math.max(
          1,
          Number(
            order.quantity ||
            1,
          ),
        );

      if (
        existingTickets.length >=
        requiredTickets
      ) {
        return jsonResponse(
          {
            ok: false,
            error:
              "This order already has all of its ticket numbers. Refresh the page to see them.",
          },
          409,
        );
      }

      const {
        data: lotteryData,
        error: lotteryError,
      } = await supabaseAdmin
        .from("lotteries")
        .select("id,title,slug,draw_at,max_tickets")
        .eq("id", order.lottery_id)
        .single();

      if (
        lotteryError ||
        !lotteryData
      ) {
        return jsonResponse(
          {
            ok: false,
            error:
              "The lottery attached to this order could not be loaded.",
          },
          409,
        );
      }

      /*
       * Claim this order using its last update time. If two admins click
       * the recovery action together, only one request may allocate tickets.
       */
      const issueStartedAt =
        new Date()
          .toISOString();

      let claimQuery =
        supabaseAdmin
          .from("lottery_orders")
          .update({
            updated_at:
              issueStartedAt,
          })
          .eq("id", order.id)
          .eq("payment_status", "paid");

      if (
        order.updated_at
      ) {
        claimQuery =
          claimQuery.eq(
            "updated_at",
            order.updated_at,
          );
      }

      const {
        data: claimedOrder,
        error: claimError,
      } = await claimQuery
        .select("id")
        .maybeSingle();

      if (
        claimError ||
        !claimedOrder
      ) {
        return jsonResponse(
          {
            ok: false,
            error:
              "This order changed while the tickets were being checked. Refresh the page and try again.",
          },
          409,
        );
      }

      const lottery =
        lotteryData as ManualPaidLottery;

      const {
        tickets,
        createdIds,
      } = await createMissingManualPaidTickets(
        order,
        lottery,
      );

      if (
        createdIds.length ===
        0
      ) {
        return jsonResponse(
          {
            ok: false,
            error:
              "No tickets were issued because this order already has the required number.",
          },
          409,
        );
      }

      const createdIdSet =
        new Set(
          createdIds,
        );

      const issuedTickets =
        tickets.filter(
          (ticket) =>
            createdIdSet.has(
              ticket.id,
            ),
        );

      let emailSent =
        false;

      let emailError:
        string |
        null =
        null;

      try {
        await sendPaidOrderEmails({
          order,
          lottery,
          tickets,
          source:
            "ticket_recovery",
        });

        emailSent =
          true;
      } catch (
        error
      ) {
        emailError =
          error instanceof Error
            ? error.message
            : "The confirmation email could not be sent.";

        console.error(
          "Lottery missing-ticket confirmation email failed:",
          error,
        );
      }

      await writeMissingTicketAudit({
        admin:
          auth.admin,
        order,
        lottery,
        tickets,
        issuedTickets,
      });

      return jsonResponse({
        ok: true,
        message:
          emailSent
            ? `${issuedTickets.length} missing ticket${issuedTickets.length === 1 ? "" : "s"} issued and the confirmation email was sent.`
            : `${issuedTickets.length} missing ticket${issuedTickets.length === 1 ? "" : "s"} issued, but the confirmation email could not be sent.`,
        payment_status:
          "paid",
        paid_at:
          order.paid_at,
        order_id:
          order.id,
        order_reference:
          order.order_reference,
        tickets:
          tickets.map(
            (ticket) => ({
              id: ticket.id,
              ticket_number:
                ticket.ticket_number,
              status:
                ticket.status,
              issued_at:
                ticket.issued_at,
            }),
          ),
        issued_count:
          issuedTickets.length,
        email: {
          sent:
            emailSent,
          recipient:
            order.purchaser_email,
          error:
            emailError,
        },
      });
    }

    if (
      order.payment_status !==
      "pending"
    ) {
      return jsonResponse(
        {
          ok:
            false,

          error:
            order.payment_status ===
            "paid"
              ? "This order is already marked as paid."
              : "Only an order waiting for payment can be manually marked as paid.",
        },
        409,
      );
    }

    if (
      !order.purchaser_email
    ) {
      return jsonResponse(
        {
          ok:
            false,

          error:
            "This order has no purchaser email address, so the paid confirmation cannot be sent.",
        },
        409,
      );
    }

    const {
      data:
        lotteryData,
      error:
        lotteryError,
    } =
      await supabaseAdmin
        .from(
          "lotteries",
        )
        .select(
          "id,title,slug,draw_at,max_tickets",
        )
        .eq(
          "id",
          order.lottery_id,
        )
        .single();

    if (
      lotteryError ||
      !lotteryData
    ) {
      return jsonResponse(
        {
          ok:
            false,

          error:
            "The lottery attached to this order could not be loaded.",
        },
        409,
      );
    }

    const lottery =
      lotteryData as ManualPaidLottery;

    /*
     * Create/reuse the ticket numbers first.
     * If the subsequent payment-status update fails, any tickets
     * created by this request are removed again.
     */
    const {
      tickets,
      createdIds,
    } =
      await createMissingManualPaidTickets(
      order,
      lottery,
    );

    const paidAt =
      new Date()
        .toISOString();

    const {
      data:
        updatedOrder,
      error:
        updateError,
    } =
      await supabaseAdmin
        .from(
          "lottery_orders",
        )
        .update({
          payment_status:
            "paid",

          paid_at:
            paidAt,

          updated_at:
            paidAt,
        })
        .eq(
          "id",
          order.id,
        )
        .eq(
          "payment_status",
          "pending",
        )
        .select(
          "id,payment_status,paid_at,updated_at",
        )
        .maybeSingle();

    if (
      updateError ||
      !updatedOrder
    ) {
      if (
        createdIds.length
      ) {
        const cleanup =
          await supabaseAdmin
            .from(
              "lottery_tickets",
            )
            .delete()
            .in(
              "id",
              createdIds,
            );

        if (
          cleanup.error
        ) {
          console.error(
            "Lottery manual-paid rollback could not remove issued tickets:",
            cleanup.error,
          );
        }
      }

      return jsonResponse(
        {
          ok:
            false,

          error:
            "The order changed while you were confirming it. Refresh the page and check the current payment status.",
        },
        409,
      );
    }

    order.payment_status =
      "paid";

    order.paid_at =
      paidAt;

    let emailSent =
      false;

    let emailError:
      string |
      null =
      null;

    try {
      await sendPaidOrderEmails({
        order,
        lottery,
        tickets,
        source:
          "manual",
      });

      emailSent =
        true;
    } catch (
      error
    ) {
      emailError =
        error instanceof
        Error
          ? error.message
          : "The email could not be sent.";

      console.error(
        "Lottery manual-paid confirmation email failed:",
        error,
      );
    }

    await writeManualPaidAudit({
      admin:
        auth.admin,

      order,
      lottery,
      tickets,
    });

    return jsonResponse({
      ok:
        true,

      message:
        emailSent
          ? "The order is now paid, ticket numbers were issued and the confirmation email was sent."
          : "The order is now paid and ticket numbers were issued, but the confirmation email could not be sent.",

      payment_status:
        "paid",

      paid_at:
        paidAt,

      order_id:
        order.id,

      order_reference:
        order.order_reference,

      tickets:
        tickets.map(
          (
            ticket,
          ) => ({
            id:
              ticket.id,

            ticket_number:
              ticket.ticket_number,

            status:
              ticket.status,

            issued_at:
              ticket.issued_at,
          }),
        ),

      email: {
        sent:
          emailSent,

        recipient:
          order.purchaser_email,

        error:
          emailError,
      },
    });
  } catch (
    error
  ) {
    console.error(
      "Lottery protected order action error:",
      error,
    );

    return jsonResponse(
      {
        ok:
          false,

        error:
          "The protected lottery order action could not be completed.",
      },
      500,
    );
  }
}