import {
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


export async function GET() {
  try {
    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from("lotteries")
        .select(
          `
          id,
          title,
          slug,
          short_summary,
          hero_image_url,
          status,
          ticket_price,
          ticket_price_pence,
          currency,
          sales_open_at,
          sales_close_at,
          draw_at,
          show_in_directory,
          show_in_public_directory,
          is_featured,
          is_active
          `,
        )

        /*
         * ===============================================
         * ACTIVE RECORDS ONLY
         * ===============================================
         */
        .eq(
          "is_active",
          true,
        )

        /*
         * ===============================================
         * PUBLIC DIRECTORY
         *
         * Your older Lottery Management form uses:
         *
         * show_in_directory
         *
         * The newer public system uses:
         *
         * show_in_public_directory
         *
         * Until we remove the old field completely,
         * accept either one.
         * ===============================================
         */
        .or(
          "show_in_public_directory.eq.true,show_in_directory.eq.true",
        )

        /*
         * ===============================================
         * NEVER SHOW DRAFT / COMPLIANCE REVIEW
         * ===============================================
         */
        .not(
          "status",
          "in",
          '("draft","compliance_review","archived")',
        )

        /*
         * Featured lotteries first.
         */
        .order(
          "is_featured",
          {
            ascending: false,
          },
        )

        /*
         * Then sort by draw date.
         */
        .order(
          "draw_at",
          {
            ascending: true,
            nullsFirst: false,
          },
        );

    /*
     * =====================================================
     * DATABASE ERROR
     * =====================================================
     */
    if (error) {
      console.error(
        "Failed to load public lottery directory:",
        {
          code:
            error.code,
          message:
            error.message,
          details:
            error.details,
          hint:
            error.hint,
        },
      );

      return NextResponse.json(
        {
          ok: false,

          code:
            "PUBLIC_LOTTERY_DIRECTORY_DATABASE_ERROR",

          error:
            "Failed to load lotteries.",

          details: {
            database_code:
              error.code ??
              null,

            database_message:
              error.message ??
              null,
          },
        },
        {
          status: 500,

          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate, max-age=0",

            "X-Content-Type-Options":
              "nosniff",
          },
        },
      );
    }

    /*
     * =====================================================
     * NORMALISE DATA
     *
     * This keeps the public page compatible with existing
     * lotteries where ticket_price_pence has not yet been
     * populated.
     * =====================================================
     */
    const lotteries =
      (data ?? []).map(
        (lottery) => {
          const ticketPrice =
            Number(
              lottery.ticket_price ??
                0,
            );

          const ticketPricePence =
            typeof lottery.ticket_price_pence ===
              "number"
              ? lottery.ticket_price_pence
              : Math.round(
                  ticketPrice *
                    100,
                );

          return {
            id:
              lottery.id,

            title:
              lottery.title,

            slug:
              lottery.slug,

            short_summary:
              lottery.short_summary,

            hero_image_url:
              lottery.hero_image_url,

            status:
              lottery.status,

            ticket_price_pence:
              ticketPricePence,

            currency:
              lottery.currency ||
              "GBP",

            sales_open_at:
              lottery.sales_open_at,

            sales_close_at:
              lottery.sales_close_at,

            draw_at:
              lottery.draw_at,

            /*
             * Public API presents one unified value.
             */
            show_in_public_directory:
              lottery.show_in_public_directory ===
                true ||
              lottery.show_in_directory ===
                true,

            is_featured:
              lottery.is_featured ===
              true,
          };
        },
      );

    /*
     * =====================================================
     * SUCCESS
     * =====================================================
     */
    return NextResponse.json(
      {
        ok: true,

        count:
          lotteries.length,

        lotteries,

        generated_at:
          new Date()
            .toISOString(),
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",

          Pragma:
            "no-cache",

          Expires:
            "0",

          "Surrogate-Control":
            "no-store",

          "X-Content-Type-Options":
            "nosniff",
        },
      },
    );
  } catch (error) {
    console.error(
      "Unexpected public lottery directory API error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,

        code:
          "PUBLIC_LOTTERY_DIRECTORY_UNEXPECTED_ERROR",

        error:
          "Failed to load lotteries.",
      },
      {
        status: 500,

        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, max-age=0",

          "X-Content-Type-Options":
            "nosniff",
        },
      },
    );
  }
}