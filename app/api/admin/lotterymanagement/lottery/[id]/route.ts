import {
  NextRequest,
  NextResponse,
} from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

import {
  getAuthenticatedAdmin,
  getAuditServiceClient,
  hasLotteryPermission,
  writeLotteryAuditSafe,
} from "@/lib/lottery/audit-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REQUIRED_MINIMUM_AGE = 18;
const DELETE_PASSWORD_ACTION_KEY = "delete_all_donations";

type LotteryStatus =
  | "draft"
  | "compliance_review"
  | "scheduled"
  | "live"
  | "sales_closed"
  | "draw_ready"
  | "completed"
  | "archived"
  | "paused"
  | "cancelled"
  | "under_review";

type RouteContext = {
  params: Promise<{
    id: string;
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
      "X-Content-Type-Options":
        "nosniff",
    },
  });
}

function createRequestId() {
  return `LOT-${Date.now()}-${crypto
    .randomUUID()
    .slice(0, 8)
    .toUpperCase()}`;
}

function isValidUuid(
  value: string,
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isValidLotteryStatus(
  value: unknown,
): value is LotteryStatus {
  return (
    value === "draft" ||
    value ===
      "compliance_review" ||
    value === "scheduled" ||
    value === "live" ||
    value === "sales_closed" ||
    value === "draw_ready" ||
    value === "completed" ||
    value === "archived" ||
    value === "paused" ||
    value === "cancelled" ||
    value === "under_review"
  );
}

function safeDetails(
  value: unknown,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return undefined;
  }

  return value;
}

function getMainAdminRole(
  admin: unknown,
) {
  if (!admin || typeof admin !== "object") {
    return null;
  }

  const candidate = admin as {
    role?: unknown;
  };

  return typeof candidate.role === "string"
    ? candidate.role
    : null;
}

async function verifyMainAdminDeletePassword(
  password: string,
) {
  const { data: setting, error } = await supabaseAdmin
    .from("admin_delete_settings")
    .select("password_hash")
    .eq("action_key", DELETE_PASSWORD_ACTION_KEY)
    .maybeSingle();

  if (error) {
    console.error(
      "Lottery delete password lookup failed:",
      error,
    );

    return {
      ok: false,
      status: 500,
      code: "LOTTERY_DELETE_PASSWORD_SETTINGS_FAILED",
    };
  }

  if (!setting?.password_hash) {
    return {
      ok: false,
      status: 400,
      code: "LOTTERY_DELETE_PASSWORD_NOT_SET",
    };
  }

  const matches = await bcrypt.compare(
    password,
    setting.password_hash,
  );

  return {
    ok: matches,
    status: matches ? 200 : 403,
    code: matches
      ? null
      : "LOTTERY_DELETE_PASSWORD_INCORRECT",
  };
}

/*
 * =========================================================
 * GET ONE LOTTERY BY ID
 *
 * GET
 * /api/admin/lotterymanagement/lottery/[id]
 * =========================================================
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  const requestId =
    createRequestId();

  try {
    /*
     * =====================================================
     * AUTHENTICATION
     * =====================================================
     */
    const admin =
      await getAuthenticatedAdmin();

    if (!admin) {
      return response(
        {
          ok: false,
          code:
            "LOTTERY_AUTH_REQUIRED",
          error:
            "You must be signed in to view this lottery.",
          request_id:
            requestId,
        },
        401,
      );
    }

    /*
     * =====================================================
     * PERMISSION
     * =====================================================
     */
    if (
      !hasLotteryPermission(
        admin,
        "lottery:view",
      )
    ) {
      return response(
        {
          ok: false,
          code:
            "LOTTERY_PERMISSION_DENIED",
          error:
            "You do not have permission to view lottery records.",
          request_id:
            requestId,
        },
        403,
      );
    }

    /*
     * =====================================================
     * ID
     * =====================================================
     */
    const {
      id: rawId,
    } =
      await context.params;

    const id =
      decodeURIComponent(
        rawId,
      ).trim();

    if (
      !id ||
      !isValidUuid(id)
    ) {
      return response(
        {
          ok: false,
          code:
            "LOTTERY_INVALID_ID",
          error:
            "The lottery ID is invalid.",
          request_id:
            requestId,
          details: {
            received_id:
              id || null,
          },
        },
        400,
      );
    }

    const db =
      getAuditServiceClient();

    /*
     * =====================================================
     * LOAD LOTTERY
     * =====================================================
     */
    const {
      data: lottery,
      error,
    } = await db
      .from("lotteries")
      .select("*")
      .eq(
        "id",
        id,
      )
      .maybeSingle();

    if (error) {
      console.error(
        `[${requestId}] Lottery ID lookup error:`,
        error,
      );

      return response(
        {
          ok: false,
          code:
            "LOTTERY_DATABASE_READ_FAILED",
          error:
            "Unable to load the lottery.",
          request_id:
            requestId,
          details: {
            database_code:
              error.code ?? null,
            database_message:
              error.message ?? null,
            database_hint:
              error.hint ?? null,
          },
        },
        500,
      );
    }

    if (!lottery) {
      return response(
        {
          ok: false,
          code:
            "LOTTERY_NOT_FOUND",
          error:
            "Lottery not found.",
          request_id:
            requestId,
          details: {
            lottery_id:
              id,
          },
        },
        404,
      );
    }

    /*
     * =====================================================
     * LOAD SUMMARY DATA
     * =====================================================
     */
    const [
      ordersResult,
      ticketsResult,
      prizesResult,
      winnersResult,
      refundsResult,
    ] =
      await Promise.all([
        db
          .from(
            "lottery_orders",
          )
          .select(
            "id, status, amount_total",
          )
          .eq(
            "lottery_id",
            lottery.id,
          ),

        db
          .from(
            "lottery_tickets",
          )
          .select("id")
          .eq(
            "lottery_id",
            lottery.id,
          ),

        db
          .from(
            "lottery_prizes",
          )
          .select("id")
          .eq(
            "lottery_id",
            lottery.id,
          ),

        db
          .from(
            "lottery_winners",
          )
          .select("id")
          .eq(
            "lottery_id",
            lottery.id,
          ),

        db
          .from(
            "lottery_refunds",
          )
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
        : ordersResult.data ??
          [];

    const paidOrders =
      orders.filter(
        (
          order: any,
        ) =>
          order.status ===
          "paid",
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
        : refundsResult.data ??
          [];

    const refundTotal =
      refunds
        .filter(
          (
            refund: any,
          ) =>
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
              refund.amount ??
                0,
            ),
          0,
        );

    return response({
      ok: true,
      request_id:
        requestId,

      item: {
        ...lottery,

        order_count:
          orders.length,

        paid_order_count:
          paidOrders.length,

        ticket_count:
          ticketsResult.error
            ? 0
            : ticketsResult
                .data
                ?.length ?? 0,

        prize_count:
          prizesResult.error
            ? 0
            : prizesResult
                .data
                ?.length ?? 0,

        winner_count:
          winnersResult.error
            ? 0
            : winnersResult
                .data
                ?.length ?? 0,

        revenue,

        refund_total:
          refundTotal,
      },
    });
  } catch (error) {
    console.error(
      `[${requestId}] Lottery GET API error:`,
      error,
    );

    return response(
      {
        ok: false,
        code:
          "LOTTERY_GET_UNEXPECTED_ERROR",
        error:
          "Unable to load the lottery.",
        request_id:
          requestId,
        details: {
          error_name:
            error instanceof Error
              ? error.name
              : "UnknownError",
          error_message:
            error instanceof Error
              ? error.message
              : "Unknown error",
        },
      },
      500,
    );
  }
}

/*
 * =========================================================
 * PATCH LOTTERY
 *
 * PATCH
 * /api/admin/lotterymanagement/lottery/[id]
 *
 * Used for:
 *
 * - Go Live
 * - Archive
 * - Pause
 * - Status changes
 * - Public directory settings
 * - Ticket price
 * - Dates
 * - Public settings
 * =========================================================
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  const requestId =
    createRequestId();

  try {
    /*
     * =====================================================
     * AUTHENTICATION
     * =====================================================
     */
    const admin =
      await getAuthenticatedAdmin();

    if (!admin) {
      return response(
        {
          ok: false,
          code:
            "LOTTERY_AUTH_REQUIRED",
          error:
            "You must be signed in to update this lottery.",
          request_id:
            requestId,
        },
        401,
      );
    }

    /*
     * =====================================================
     * PERMISSION
     * =====================================================
     */
    if (
      !hasLotteryPermission(
        admin,
        "lottery:view",
      )
    ) {
      return response(
        {
          ok: false,
          code:
            "LOTTERY_PERMISSION_DENIED",
          error:
            "You do not have permission to update lottery records.",
          request_id:
            requestId,
        },
        403,
      );
    }

    /*
     * =====================================================
     * ID
     * =====================================================
     */
    const {
      id: rawId,
    } =
      await context.params;

    const id =
      decodeURIComponent(
        rawId,
      ).trim();

    if (
      !id ||
      !isValidUuid(id)
    ) {
      return response(
        {
          ok: false,
          code:
            "LOTTERY_INVALID_ID",
          error:
            "The lottery ID is invalid.",
          request_id:
            requestId,
          details: {
            received_id:
              id || null,
          },
        },
        400,
      );
    }

    /*
     * =====================================================
     * BODY
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
            "LOTTERY_INVALID_JSON_BODY",
          error:
            "The request body is not valid JSON.",
          request_id:
            requestId,
        },
        400,
      );
    }

    const db =
      getAuditServiceClient();

    /*
     * =====================================================
     * FIND CURRENT LOTTERY
     * =====================================================
     */
    const {
      data: existing,
      error:
        existingError,
    } = await db
      .from("lotteries")
      .select("*")
      .eq(
        "id",
        id,
      )
      .maybeSingle();

    if (existingError) {
      console.error(
        `[${requestId}] Lottery lookup before PATCH failed:`,
        existingError,
      );

      return response(
        {
          ok: false,
          code:
            "LOTTERY_LOOKUP_FAILED",
          error:
            "Unable to load the lottery before updating it.",
          request_id:
            requestId,
          details: {
            lottery_id:
              id,
            database_code:
              existingError.code ??
              null,
            database_message:
              existingError.message ??
              null,
            database_hint:
              existingError.hint ??
              null,
          },
        },
        500,
      );
    }

    if (!existing) {
      return response(
        {
          ok: false,
          code:
            "LOTTERY_NOT_FOUND",
          error:
            "Lottery not found.",
          request_id:
            requestId,
          details: {
            lottery_id:
              id,
          },
        },
        404,
      );
    }

    /*
     * =====================================================
     * BUILD UPDATE OBJECT
     * =====================================================
     */
    const update: Record<
      string,
      unknown
    > = {};

    /*
     * =====================================================
     * FIXED 18+ AGE REQUIREMENT
     * =====================================================
     *
     * Every Burton Pride lottery is strictly 18+.
     *
     * minimum_age is deliberately NOT read from the request
     * body. Even if a client manually sends minimum_age: 16
     * or another value, this route will always save 18.
     *
     * This also repairs any older lottery record that may
     * currently contain an age below 18 whenever it is
     * updated through this route.
     */
    update.minimum_age =
      REQUIRED_MINIMUM_AGE;

    /*
     * =====================================================
     * STATUS
     * =====================================================
     */
    if (
      body.status !==
      undefined
    ) {
      if (
        !isValidLotteryStatus(
          body.status,
        )
      ) {
        return response(
          {
            ok: false,
            code:
              "LOTTERY_INVALID_STATUS",
            error:
              "The requested lottery status is invalid.",
            request_id:
              requestId,
            details: {
              supplied_status:
                body.status,
              allowed_statuses: [
                "draft",
                "compliance_review",
                "scheduled",
                "live",
                "sales_closed",
                "draw_ready",
                "completed",
                "archived",
                "paused",
                "cancelled",
                "under_review",
              ],
            },
          },
          400,
        );
      }

      update.status =
        body.status;

      /*
       * ===============================================
       * MAKE LIVE
       * ===============================================
       */
      if (
        body.status ===
        "live"
      ) {
        /*
         * Prevent already archived lotteries from being
         * accidentally made live without deliberate action.
         */
        if (
          existing.status ===
          "archived"
        ) {
          return response(
            {
              ok: false,
              code:
                "LOTTERY_ARCHIVED_CANNOT_GO_LIVE",
              error:
                "This lottery is archived and cannot be made live directly.",
              request_id:
                requestId,
              details: {
                current_status:
                  existing.status,
                lottery_id:
                  existing.id,
                lottery_title:
                  existing.title,
              },
            },
            409,
          );
        }

        /*
         * Require core dates.
         */
        if (
          !existing.sales_open_at ||
          !existing.sales_close_at ||
          !existing.draw_at
        ) {
          return response(
            {
              ok: false,
              code:
                "LOTTERY_GO_LIVE_MISSING_DATES",
              error:
                "This lottery cannot go live because one or more required dates are missing.",
              request_id:
                requestId,
              details: {
                sales_open_at:
                  existing.sales_open_at,
                sales_close_at:
                  existing.sales_close_at,
                draw_at:
                  existing.draw_at,
              },
            },
            422,
          );
        }

        /*
         * Require ticket price.
         */
        if (
          Number(
            existing.ticket_price ??
              0,
          ) <= 0
        ) {
          return response(
            {
              ok: false,
              code:
                "LOTTERY_GO_LIVE_INVALID_TICKET_PRICE",
              error:
                "This lottery cannot go live because the ticket price is missing or invalid.",
              request_id:
                requestId,
              details: {
                ticket_price:
                  existing.ticket_price ??
                  null,
              },
            },
            422,
          );
        }

        /*
         * Enforce Burton Pride's fixed 18+ rule.
         *
         * Any historic or incorrectly stored value is
         * corrected to 18 as part of this update before
         * the lottery is made live.
         */
        update.minimum_age =
          REQUIRED_MINIMUM_AGE;

        /*
         * Require public slug.
         */
        if (
          !existing.slug
        ) {
          return response(
            {
              ok: false,
              code:
                "LOTTERY_GO_LIVE_MISSING_SLUG",
              error:
                "This lottery cannot go live because it does not have a public slug.",
              request_id:
                requestId,
            },
            422,
          );
        }

        update.is_active =
          true;

        update.archived_at =
          null;

        if (
          !existing.publication_at
        ) {
          update.publication_at =
            new Date()
              .toISOString();
        }
      }

      /*
       * ===============================================
       * ARCHIVE
       * ===============================================
       */
      if (
        body.status ===
        "archived"
      ) {
        update.is_active =
          false;

        update.archived_at =
          new Date()
            .toISOString();

        /*
         * If the column exists, the public directory will
         * stop listing it.
         */
        update.show_in_public_directory =
          false;
      }

      /*
       * ===============================================
       * CANCELLED
       * ===============================================
       */
      if (
        body.status ===
        "cancelled"
      ) {
        update.is_active =
          false;
      }

      /*
       * ===============================================
       * COMPLETED
       * ===============================================
       */
      if (
        body.status ===
        "completed"
      ) {
        update.is_active =
          false;
      }

      /*
       * ===============================================
       * PAUSED
       * ===============================================
       */
      if (
        body.status ===
        "paused"
      ) {
        update.is_active =
          true;
      }

      /*
       * ===============================================
       * SCHEDULED
       * ===============================================
       */
      if (
        body.status ===
        "scheduled"
      ) {
        update.is_active =
          true;

        update.archived_at =
          null;
      }
    }

    /*
     * =====================================================
     * ACTIVE
     * =====================================================
     */
    if (
      body.is_active !==
      undefined
    ) {
      update.is_active =
        Boolean(
          body.is_active,
        );
    }

    /*
     * =====================================================
     * PUBLIC DIRECTORY
     * =====================================================
     */
    if (
      body.show_in_public_directory !==
      undefined
    ) {
      update.show_in_public_directory =
        Boolean(
          body.show_in_public_directory,
        );
    }

    if (
      body.show_in_directory !==
      undefined
    ) {
      update.show_in_public_directory =
        Boolean(
          body.show_in_directory,
        );
    }

    /*
     * =====================================================
     * FEATURED
     * =====================================================
     */
    if (
      body.is_featured !==
      undefined
    ) {
      update.is_featured =
        Boolean(
          body.is_featured,
        );
    }

    /*
     * =====================================================
     * TITLE
     * =====================================================
     */
    if (
      body.title !==
      undefined
    ) {
      const title =
        String(
          body.title,
        ).trim();

      if (!title) {
        return response(
          {
            ok: false,
            code:
              "LOTTERY_TITLE_REQUIRED",
            error:
              "Lottery title cannot be empty.",
            request_id:
              requestId,
          },
          400,
        );
      }

      update.title =
        title;
    }

    /*
     * =====================================================
     * SHORT SUMMARY
     * =====================================================
     */
    if (
      body.short_summary !==
      undefined
    ) {
      const value =
        String(
          body.short_summary ??
            "",
        ).trim();

      update.short_summary =
        value || null;
    }

    /*
     * =====================================================
     * DESCRIPTION
     * =====================================================
     */
    if (
      body.description !==
      undefined
    ) {
      const value =
        String(
          body.description ??
            "",
        ).trim();

      update.description =
        value || null;
    }

    /*
     * =====================================================
     * FUNDRAISING PURPOSE
     * =====================================================
     */
    if (
      body.fundraising_purpose !==
      undefined
    ) {
      const value =
        String(
          body.fundraising_purpose ??
            "",
        ).trim();

      update.fundraising_purpose =
        value || null;
    }

    /*
     * =====================================================
     * HERO IMAGE
     * =====================================================
     */
    if (
      body.hero_image_url !==
      undefined
    ) {
      const value =
        String(
          body.hero_image_url ??
            "",
        ).trim();

      update.hero_image_url =
        value || null;
    }

    /*
     * =====================================================
     * TICKET PRICE
     * =====================================================
     */
    if (
      body.ticket_price !==
      undefined
    ) {
      const price =
        Number(
          body.ticket_price,
        );

      if (
        !Number.isFinite(
          price,
        ) ||
        price <= 0
      ) {
        return response(
          {
            ok: false,
            code:
              "LOTTERY_INVALID_TICKET_PRICE",
            error:
              "Ticket price must be greater than £0.",
            request_id:
              requestId,
            details: {
              supplied_value:
                body.ticket_price,
            },
          },
          400,
        );
      }

      update.ticket_price =
        price;

      /*
       * Keep public pence field in sync.
       */
      update.ticket_price_pence =
        Math.round(
          price * 100,
        );
    }

    /*
     * =====================================================
     * DIRECT PENCE UPDATE
     * =====================================================
     */
    if (
      body.ticket_price_pence !==
      undefined
    ) {
      const pence =
        Number(
          body.ticket_price_pence,
        );

      if (
        !Number.isFinite(
          pence,
        ) ||
        pence < 0
      ) {
        return response(
          {
            ok: false,
            code:
              "LOTTERY_INVALID_TICKET_PRICE_PENCE",
            error:
              "Ticket price in pence is invalid.",
            request_id:
              requestId,
            details: {
              supplied_value:
                body.ticket_price_pence,
            },
          },
          400,
        );
      }

      const rounded =
        Math.round(pence);

      update.ticket_price_pence =
        rounded;

      update.ticket_price =
        rounded / 100;
    }

    /*
     * =====================================================
     * CURRENCY
     * =====================================================
     */
    if (
      body.currency !==
      undefined
    ) {
      const currency =
        String(
          body.currency,
        )
          .trim()
          .toUpperCase();

      if (!currency) {
        return response(
          {
            ok: false,
            code:
              "LOTTERY_CURRENCY_REQUIRED",
            error:
              "Currency cannot be empty.",
            request_id:
              requestId,
          },
          400,
        );
      }

      update.currency =
        currency;
    }

    /*
     * =====================================================
     * MAX TICKETS
     * =====================================================
     */
    if (
      body.max_tickets !==
      undefined
    ) {
      if (
        body.max_tickets ===
          null ||
        body.max_tickets ===
          ""
      ) {
        update.max_tickets =
          null;
      } else {
        const maxTickets =
          Number(
            body.max_tickets,
          );

        if (
          !Number.isInteger(
            maxTickets,
          ) ||
          maxTickets <= 0
        ) {
          return response(
            {
              ok: false,
              code:
                "LOTTERY_INVALID_MAX_TICKETS",
              error:
                "Maximum tickets must be a positive whole number.",
              request_id:
                requestId,
              details: {
                supplied_value:
                  body.max_tickets,
              },
            },
            400,
          );
        }

        update.max_tickets =
          maxTickets;
      }
    }

    /*
     * =====================================================
     * BOOLEAN PUBLIC SETTINGS
     * =====================================================
     */
    const booleanFields = [
      "allow_page_before_sales",
      "show_ticket_count",
      "show_amount_raised",
      "show_remaining_tickets",
      "show_prize_values",
      "countdown_enabled",
    ] as const;

    for (
      const field of
        booleanFields
    ) {
      if (
        body[field] !==
        undefined
      ) {
        update[field] =
          Boolean(
            body[field],
          );
      }
    }

    /*
     * =====================================================
     * DATE FIELDS
     * =====================================================
     */
    const dateFields = [
      "publication_at",
      "sales_open_at",
      "sales_close_at",
      "draw_at",
      "results_publish_at",
    ] as const;

    for (
      const field of
        dateFields
    ) {
      if (
        body[field] ===
        undefined
      ) {
        continue;
      }

      if (
        body[field] ===
          null ||
        body[field] ===
          ""
      ) {
        update[field] =
          null;

        continue;
      }

      const parsedDate =
        new Date(
          String(
            body[field],
          ),
        );

      if (
        Number.isNaN(
          parsedDate.getTime(),
        )
      ) {
        return response(
          {
            ok: false,
            code:
              "LOTTERY_INVALID_DATE",
            error: `${field} is not a valid date.`,
            request_id:
              requestId,
            details: {
              field,
              supplied_value:
                body[field],
            },
          },
          400,
        );
      }

      update[field] =
        parsedDate
          .toISOString();
    }

    /*
     * =====================================================
     * VALIDATE DATE ORDER
     * =====================================================
     */
    const finalOpen =
      update.sales_open_at !==
      undefined
        ? update.sales_open_at
        : existing.sales_open_at;

    const finalClose =
      update.sales_close_at !==
      undefined
        ? update.sales_close_at
        : existing.sales_close_at;

    const finalDraw =
      update.draw_at !==
      undefined
        ? update.draw_at
        : existing.draw_at;

    if (
      finalOpen &&
      finalClose
    ) {
      const openTime =
        new Date(
          String(finalOpen),
        ).getTime();

      const closeTime =
        new Date(
          String(finalClose),
        ).getTime();

      if (
        closeTime <=
        openTime
      ) {
        return response(
          {
            ok: false,
            code:
              "LOTTERY_INVALID_SALES_DATE_ORDER",
            error:
              "Sales closing time must be after the sales opening time.",
            request_id:
              requestId,
            details: {
              sales_open_at:
                finalOpen,
              sales_close_at:
                finalClose,
            },
          },
          422,
        );
      }
    }

    if (
      finalClose &&
      finalDraw
    ) {
      const closeTime =
        new Date(
          String(finalClose),
        ).getTime();

      const drawTime =
        new Date(
          String(finalDraw),
        ).getTime();

      if (
        drawTime <
        closeTime
      ) {
        return response(
          {
            ok: false,
            code:
              "LOTTERY_INVALID_DRAW_DATE",
            error:
              "The draw must take place on or after ticket sales close.",
            request_id:
              requestId,
            details: {
              sales_close_at:
                finalClose,
              draw_at:
                finalDraw,
            },
          },
          422,
        );
      }
    }

    /*
     * =====================================================
     * NOTHING TO UPDATE
     * =====================================================
     */
    if (
      Object.keys(
        update,
      ).length === 0
    ) {
      return response(
        {
          ok: false,
          code:
            "LOTTERY_NO_CHANGES",
          error:
            "No valid lottery changes were provided.",
          request_id:
            requestId,
        },
        400,
      );
    }

    update.updated_at =
      new Date()
        .toISOString();

    /*
     * =====================================================
     * DATABASE UPDATE
     * =====================================================
     */
    const {
      data: updated,
      error:
        updateError,
    } = await db
      .from("lotteries")
      .update(update)
      .eq(
        "id",
        id,
      )
      .select("*")
      .single();

    if (updateError) {
      console.error(
        `[${requestId}] Lottery PATCH database error:`,
        updateError,
      );

      return response(
        {
          ok: false,
          code:
            "LOTTERY_DATABASE_UPDATE_FAILED",
          error:
            "The lottery could not be updated in the database.",
          request_id:
            requestId,
          details: {
            lottery_id:
              id,
            current_status:
              existing.status,
            requested_status:
              body.status ??
              null,

            database_code:
              updateError.code ??
              null,

            database_message:
              updateError.message ??
              null,

            database_details:
              updateError.details ??
              null,

            database_hint:
              updateError.hint ??
              null,
          },
        },
        500,
      );
    }

    /*
     * =====================================================
     * AUDIT
     * =====================================================
     */
    const oldStatus =
      existing.status;

    const newStatus =
      updated.status;

    const statusChanged =
      oldStatus !==
      newStatus;

    await writeLotteryAuditSafe({
      admin,

      actionCode:
        statusChanged
          ? `lottery.status.${newStatus}`
          : "lottery.updated",

      actionLabel:
        statusChanged
          ? `Lottery status changed to ${newStatus}`
          : "Lottery updated",

      actionGroup:
        statusChanged
          ? "lottery"
          : "lottery",

      riskLevel:
        newStatus === "live"
          ? "high"
          : "medium",

      entityType:
        "lottery",

      entityId:
        updated.id,

      reason:
        statusChanged
          ? `Lottery "${updated.title}" changed from ${oldStatus} to ${newStatus}.`
          : `Lottery "${updated.title}" was updated.`,
    });

    /*
     * =====================================================
     * SUCCESS MESSAGE
     * =====================================================
     */
    let message =
      "Lottery updated successfully.";

    if (
      statusChanged &&
      newStatus ===
        "live"
    ) {
      message =
        "Lottery is now live.";
    }

    if (
      statusChanged &&
      newStatus ===
        "archived"
    ) {
      message =
        "Lottery archived successfully.";
    }

    if (
      statusChanged &&
      newStatus ===
        "paused"
    ) {
      message =
        "Lottery has been paused.";
    }

    if (
      statusChanged &&
      newStatus ===
        "sales_closed"
    ) {
      message =
        "Lottery ticket sales are now closed.";
    }

    return response({
      ok: true,

      request_id:
        requestId,

      message,

      item:
        updated,

      changes: {
        previous_status:
          oldStatus,

        current_status:
          newStatus,
      },
    });
  } catch (error) {
    console.error(
      `[${requestId}] Lottery PATCH API error:`,
      error,
    );

    return response(
      {
        ok: false,

        code:
          "LOTTERY_PATCH_UNEXPECTED_ERROR",

        error:
          "An unexpected error occurred while updating the lottery.",

        request_id:
          requestId,

        details: safeDetails({
          error_name:
            error instanceof Error
              ? error.name
              : "UnknownError",

          error_message:
            error instanceof Error
              ? error.message
              : "Unknown error",
        }),
      },
      500,
    );
  }
}

/*
 * =========================================================
 * PERMANENTLY DELETE AN UNUSED LOTTERY
 *
 * DELETE
 * /api/admin/lotterymanagement/lottery/[id]
 *
 * This deliberately permits deletion only for unused drafts.
 * Live, completed, or historic lotteries must be archived so
 * Burton Pride retains its lottery and financial audit history.
 * =========================================================
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext,
) {
  const requestId = createRequestId();

  try {
    const admin = await getAuthenticatedAdmin();

    if (!admin) {
      return response(
        {
          ok: false,
          code: "LOTTERY_DELETE_AUTH_REQUIRED",
          error: "You must be signed in to delete a lottery.",
          request_id: requestId,
        },
        401,
      );
    }

    if (getMainAdminRole(admin) !== "main_admin") {
      return response(
        {
          ok: false,
          code: "LOTTERY_DELETE_MAIN_ADMIN_REQUIRED",
          error: "Only the main administrator can permanently delete a lottery.",
          request_id: requestId,
        },
        403,
      );
    }

    const { id: rawId } = await context.params;
    const id = decodeURIComponent(rawId).trim();

    if (!id || !isValidUuid(id)) {
      return response(
        {
          ok: false,
          code: "LOTTERY_INVALID_ID",
          error: "The lottery ID is invalid.",
          request_id: requestId,
        },
        400,
      );
    }

    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      return response(
        {
          ok: false,
          code: "LOTTERY_DELETE_INVALID_JSON_BODY",
          error: "The request body is not valid JSON.",
          request_id: requestId,
        },
        400,
      );
    }

    const confirmationTitle =
      typeof body.confirmation_title === "string"
        ? body.confirmation_title
        : "";
    const password =
      typeof body.main_admin_password === "string"
        ? body.main_admin_password
        : "";

    if (!confirmationTitle || !password) {
      return response(
        {
          ok: false,
          code: "LOTTERY_DELETE_CONFIRMATION_REQUIRED",
          error: "Enter the exact lottery name and the main administrator password.",
          request_id: requestId,
        },
        400,
      );
    }

    /*
     * Verify the password in this route as well as in the UI's
     * earlier password check. A caller must not be able to bypass
     * password protection by calling DELETE directly.
     */
    const passwordCheck = await verifyMainAdminDeletePassword(password);

    if (!passwordCheck.ok) {
      return response(
        {
          ok: false,
          code:
            passwordCheck.code ??
            (passwordCheck.status === 429
              ? "LOTTERY_DELETE_PASSWORD_RATE_LIMITED"
              : "LOTTERY_DELETE_PASSWORD_INCORRECT"),
          error:
            passwordCheck.status === 429
              ? "Too many password attempts. Please wait and try again."
              : passwordCheck.code ===
                  "LOTTERY_DELETE_PASSWORD_NOT_SET"
                ? "No main administrator delete password has been set yet."
                : passwordCheck.code ===
                    "LOTTERY_DELETE_PASSWORD_SETTINGS_FAILED"
                  ? "The delete-password settings could not be read."
                  : "The main administrator password could not be verified.",
          request_id: requestId,
        },
        passwordCheck.status,
      );
    }

    const db = getAuditServiceClient();
    const { data: lottery, error: lotteryError } = await db
      .from("lotteries")
      .select("id, title, slug, status, is_active")
      .eq("id", id)
      .maybeSingle();

    if (lotteryError) {
      console.error(
        `[${requestId}] Lottery lookup before DELETE failed:`,
        lotteryError,
      );

      return response(
        {
          ok: false,
          code: "LOTTERY_DELETE_LOOKUP_FAILED",
          error: "Unable to load the lottery before deleting it.",
          request_id: requestId,
          details: {
            database_code: lotteryError.code ?? null,
            database_message: lotteryError.message ?? null,
          },
        },
        500,
      );
    }

    if (!lottery) {
      return response(
        {
          ok: false,
          code: "LOTTERY_DELETE_NOT_FOUND",
          error: "Lottery not found or it has already been deleted.",
          request_id: requestId,
        },
        404,
      );
    }

    if (confirmationTitle !== lottery.title) {
      return response(
        {
          ok: false,
          code: "LOTTERY_DELETE_TITLE_MISMATCH",
          error: "The lottery name does not exactly match the lottery being deleted.",
          request_id: requestId,
        },
        400,
      );
    }

    if (lottery.status !== "draft" || lottery.is_active) {
      return response(
        {
          ok: false,
          code: "LOTTERY_DELETE_ARCHIVE_REQUIRED",
          error:
            "Only inactive draft lotteries can be permanently deleted. Archive any live, completed, cancelled or historic lottery instead.",
          request_id: requestId,
          details: {
            current_status: lottery.status,
            is_active: lottery.is_active,
          },
        },
        409,
      );
    }

    const [
      ordersResult,
      ticketsResult,
      prizesResult,
      winnersResult,
      refundsResult,
    ] = await Promise.all([
      db.from("lottery_orders").select("id", { count: "exact", head: true }).eq("lottery_id", id),
      db.from("lottery_tickets").select("id", { count: "exact", head: true }).eq("lottery_id", id),
      db.from("lottery_prizes").select("id", { count: "exact", head: true }).eq("lottery_id", id),
      db.from("lottery_winners").select("id", { count: "exact", head: true }).eq("lottery_id", id),
      db.from("lottery_refunds").select("id", { count: "exact", head: true }).eq("lottery_id", id),
    ]);

    const dependencyResults = [
      ["orders", ordersResult],
      ["tickets", ticketsResult],
      ["prizes", prizesResult],
      ["winners", winnersResult],
      ["refunds", refundsResult],
    ] as const;

    const dependencyError = dependencyResults.find(
      ([, result]) => result.error,
    );

    if (dependencyError) {
      const [table, result] = dependencyError;

      console.error(
        `[${requestId}] Lottery DELETE dependency check failed for ${table}:`,
        result.error,
      );

      return response(
        {
          ok: false,
          code: "LOTTERY_DELETE_DEPENDENCY_CHECK_FAILED",
          error: "The lottery could not be checked for related records, so it was not deleted.",
          request_id: requestId,
        },
        500,
      );
    }

    const dependencies = Object.fromEntries(
      dependencyResults.map(([table, result]) => [
        table,
        result.count ?? 0,
      ]),
    );
    const hasDependencies = Object.values(dependencies).some(
      (count) => Number(count) > 0,
    );

    if (hasDependencies) {
      return response(
        {
          ok: false,
          code: "LOTTERY_DELETE_BLOCKED",
          error:
            "This lottery has related records and cannot be permanently deleted. Archive it to retain its history.",
          request_id: requestId,
          details: { dependencies },
        },
        409,
      );
    }

    const { error: deleteError } = await db
      .from("lotteries")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error(
        `[${requestId}] Lottery DELETE database error:`,
        deleteError,
      );

      return response(
        {
          ok: false,
          code: "LOTTERY_DELETE_DATABASE_FAILED",
          error: "The lottery could not be permanently deleted.",
          request_id: requestId,
          details: {
            database_code: deleteError.code ?? null,
            database_message: deleteError.message ?? null,
          },
        },
        500,
      );
    }

    await writeLotteryAuditSafe({
      admin,
      actionCode: "lottery.permanently_deleted",
      actionLabel: "Lottery permanently deleted",
      actionGroup: "lottery",
      riskLevel: "critical",
      entityType: "lottery",
      entityId: lottery.id,
      reason: `Unused draft lottery "${lottery.title}" was permanently deleted by the main administrator.`,
    });

    return response({
      ok: true,
      message: "Lottery permanently deleted.",
      request_id: requestId,
      deleted: {
        id: lottery.id,
        title: lottery.title,
      },
    });
  } catch (error) {
    console.error(
      `[${requestId}] Lottery DELETE API error:`,
      error,
    );

    return response(
      {
        ok: false,
        code: "LOTTERY_DELETE_UNEXPECTED_ERROR",
        error: "An unexpected error occurred while deleting the lottery.",
        request_id: requestId,
      },
      500,
    );
  }
}
