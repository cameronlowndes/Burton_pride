"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Check,
  CircleDollarSign,
  ExternalLink,
  Eye,
  FileText,
  Globe2,
  Heart,
  ImageIcon,
  Info,
  Loader2,
  Save,
  ShieldCheck,
  Ticket,
  Trophy,
  X,
} from "lucide-react";

type LotteryStatus =
  | "draft"
  | "compliance_review"
  | "scheduled"
  | "live"
  | "paused"
  | "sales_closed"
  | "draw_ready"
  | "completed"
  | "archived"
  | "cancelled"
  | "under_review";

type WinnerDisplayMode =
  | "full_name"
  | "first_name"
  | "ticket_number"
  | "none";

type Lottery = {
  id: string;

  title: string;
  slug: string;

  short_summary:
    | string
    | null;

  description:
    | string
    | null;

  fundraising_purpose:
    | string
    | null;

  hero_image_url:
    | string
    | null;

  status:
    LotteryStatus;

  is_active:
    boolean;

  ticket_price:
    | number
    | null;

  ticket_price_pence:
    | number
    | null;

  currency:
    string | null;

  minimum_age:
    number | null;

  max_tickets:
    number | null;

  publication_at:
    | string
    | null;

  sales_open_at:
    | string
    | null;

  sales_close_at:
    | string
    | null;

  draw_at:
    | string
    | null;

  results_publish_at:
    | string
    | null;

  geographic_eligibility:
    | string
    | null;

  terms_version:
    | string
    | null;

  privacy_notice_version:
    | string
    | null;

  responsible_gambling_info:
    | string
    | null;

  show_in_directory:
    boolean | null;

  show_in_public_directory:
    boolean | null;

  allow_page_before_sales:
    boolean | null;

  show_ticket_count:
    boolean | null;

  show_amount_raised:
    boolean | null;

  show_remaining_tickets:
    boolean | null;

  show_prize_values:
    boolean | null;

  countdown_enabled:
    boolean | null;

  winner_display_mode:
    WinnerDisplayMode | null;

  is_featured:
    boolean | null;

  order_count?:
    number;

  paid_order_count?:
    number;

  ticket_count?:
    number;

  prize_count?:
    number;

  winner_count?:
    number;

  revenue?:
    number;

  refund_total?:
    number;

  created_at?:
    string | null;

  updated_at?:
    string | null;
};

type EditForm = {
  title: string;

  shortSummary: string;

  description: string;

  fundraisingPurpose:
    string;

  heroImageUrl: string;

  status:
    LotteryStatus;

  ticketPrice: string;

  currency: string;

  minimumAge: string;

  maxTickets: string;

  publicationAt: string;

  salesOpenAt: string;

  salesCloseAt: string;

  drawAt: string;

  resultsPublishAt: string;

  geographicEligibility:
    string;

  termsVersion: string;

  privacyNoticeVersion:
    string;

  responsibleGamblingInfo:
    string;

  showInDirectory:
    boolean;

  allowPageBeforeSales:
    boolean;

  showTicketCount:
    boolean;

  showAmountRaised:
    boolean;

  showRemainingTickets:
    boolean;

  showPrizeValues:
    boolean;

  countdownEnabled:
    boolean;

  winnerDisplayMode:
    WinnerDisplayMode;

  isFeatured:
    boolean;
};

type ApiResponse = {
  ok?: boolean;

  item?: Lottery;

  error?: string;

  message?: string;

  code?: string;

  request_id?: string;

  details?: unknown;
};

const REQUIRED_MINIMUM_AGE = 18;

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

function toDateTimeLocal(
  value:
    | string
    | null
    | undefined,
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "";
  }

  const pad = (
    number: number,
  ) =>
    String(number)
      .padStart(
        2,
        "0",
      );

  return [
    date.getFullYear(),
    "-",
    pad(
      date.getMonth() +
        1,
    ),
    "-",
    pad(
      date.getDate(),
    ),
    "T",
    pad(
      date.getHours(),
    ),
    ":",
    pad(
      date.getMinutes(),
    ),
  ].join("");
}

function localDateToIso(
  value: string,
) {
  if (!value) {
    return null;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  return date.toISOString();
}

async function readJson(
  response: Response,
): Promise<ApiResponse> {
  const text =
    await response.text();

  if (!text) {
    return {
      ok: false,

      code:
        "API_EMPTY_RESPONSE",

      error:
        "The API returned an empty response.",
    };
  }

  try {
    return JSON.parse(
      text,
    );
  } catch {
    return {
      ok: false,

      code:
        "API_INVALID_JSON",

      error:
        "The API returned an invalid response.",

      details: {
        preview:
          text.slice(
            0,
            500,
          ),
      },
    };
  }
}

export default function EditLotteryPage({
  params,
}: PageProps) {
  const [
    id,
    setId,
  ] =
    useState("");

  const [
    lottery,
    setLottery,
  ] =
    useState<Lottery | null>(
      null,
    );

  const [
    form,
    setForm,
  ] =
    useState<EditForm | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<
      ApiResponse | null
    >(null);

  const [
    success,
    setSuccess,
  ] =
    useState<
      string | null
    >(null);

  const [
    confirmSave,
    setConfirmSave,
  ] =
    useState(false);

  /*
   * =====================================================
   * RESOLVE ID
   * =====================================================
   */
  useEffect(() => {
    let active = true;

    params.then(
      (result) => {
        if (active) {
          setId(
            result.id,
          );
        }
      },
    );

    return () => {
      active = false;
    };
  }, [params]);

  /*
   * =====================================================
   * LOAD LOTTERY
   * =====================================================
   */
  useEffect(() => {
    if (!id) {
      return;
    }

    let cancelled =
      false;

    async function loadLottery() {
      try {
        setLoading(true);

        setError(null);

        const route =
          `/api/admin/lotterymanagement/lottery/${encodeURIComponent(
            id,
          )}`;

        const response =
          await fetch(
            route,
            {
              method:
                "GET",

              credentials:
                "include",

              cache:
                "no-store",
            },
          );

        const data =
          await readJson(
            response,
          );

        if (
          !response.ok ||
          !data.ok ||
          !data.item
        ) {
          throw {
            ...data,

            error:
              data.error ||
              "Unable to load this lottery.",

            code:
              data.code ||
              "LOTTERY_EDIT_LOAD_FAILED",
          };
        }

        if (cancelled) {
          return;
        }

        const item =
          data.item;

        setLottery(
          item,
        );

        setForm({
          title:
            item.title ||
            "",

          shortSummary:
            item.short_summary ||
            "",

          description:
            item.description ||
            "",

          fundraisingPurpose:
            item.fundraising_purpose ||
            "",

          heroImageUrl:
            item.hero_image_url ||
            "",

          status:
            item.status,

          ticketPrice:
            typeof item.ticket_price ===
            "number"
              ? item.ticket_price.toFixed(
                  2,
                )
              : typeof item.ticket_price_pence ===
                    "number"
                ? (
                    item.ticket_price_pence /
                    100
                  ).toFixed(
                    2,
                  )
                : "",

          currency:
            item.currency ||
            "GBP",

          minimumAge:
            String(
              REQUIRED_MINIMUM_AGE,
            ),

          maxTickets:
            item.max_tickets !==
            null
              ? String(
                  item.max_tickets,
                )
              : "",

          publicationAt:
            toDateTimeLocal(
              item.publication_at,
            ),

          salesOpenAt:
            toDateTimeLocal(
              item.sales_open_at,
            ),

          salesCloseAt:
            toDateTimeLocal(
              item.sales_close_at,
            ),

          drawAt:
            toDateTimeLocal(
              item.draw_at,
            ),

          resultsPublishAt:
            toDateTimeLocal(
              item.results_publish_at,
            ),

          geographicEligibility:
            item.geographic_eligibility ||
            "",

          termsVersion:
            item.terms_version ||
            "",

          privacyNoticeVersion:
            item.privacy_notice_version ||
            "",

          responsibleGamblingInfo:
            item.responsible_gambling_info ||
            "",

          showInDirectory:
            item.show_in_public_directory ===
              true ||
            item.show_in_directory ===
              true,

          allowPageBeforeSales:
            item.allow_page_before_sales ===
            true,

          showTicketCount:
            item.show_ticket_count ===
            true,

          showAmountRaised:
            item.show_amount_raised ===
            true,

          showRemainingTickets:
            item.show_remaining_tickets ===
            true,

          showPrizeValues:
            item.show_prize_values ===
            true,

          countdownEnabled:
            item.countdown_enabled ===
            true,

          winnerDisplayMode:
            item.winner_display_mode ||
            "ticket_number",

          isFeatured:
            item.is_featured ===
            true,
        });
      } catch (
        problem: any
      ) {
        if (
          !cancelled
        ) {
          setError({
            ok:
              false,

            code:
              problem?.code ||
              "LOTTERY_EDIT_LOAD_FAILED",

            error:
              problem?.error ||
              problem?.message ||
              "Unable to load this lottery.",

            request_id:
              problem?.request_id,

            details:
              problem?.details,
          });
        }
      } finally {
        if (
          !cancelled
        ) {
          setLoading(
            false,
          );
        }
      }
    }

    loadLottery();

    return () => {
      cancelled =
        true;
    };
  }, [id]);

  function updateField<
    K extends keyof EditForm,
  >(
    key: K,
    value: EditForm[K],
  ) {
    setForm(
      (current) =>
        current
          ? {
              ...current,

              [key]:
                value,
            }
          : current,
    );

    setSuccess(null);
  }

  /*
   * =====================================================
   * DIRTY CHECK
   * =====================================================
   */
  const hasChanges =
    useMemo(() => {
      if (
        !form ||
        !lottery
      ) {
        return false;
      }

      const price =
        Number(
          form.ticketPrice,
        );

      return (
        form.title !==
          lottery.title ||
        form.shortSummary !==
          (
            lottery.short_summary ||
            ""
          ) ||
        form.description !==
          (
            lottery.description ||
            ""
          ) ||
        form.fundraisingPurpose !==
          (
            lottery.fundraising_purpose ||
            ""
          ) ||
        form.heroImageUrl !==
          (
            lottery.hero_image_url ||
            ""
          ) ||
        form.status !==
          lottery.status ||
        (
          Number.isFinite(
            price,
          )
            ? price
            : 0
        ) !==
          Number(
            lottery.ticket_price ??
              (
                lottery.ticket_price_pence ??
                0
              ) /
                100,
          ) ||
        form.showInDirectory !==
          (
            lottery.show_in_public_directory ===
              true ||
            lottery.show_in_directory ===
              true
          ) ||
        form.isFeatured !==
          (
            lottery.is_featured ===
            true
          )
      );
    }, [
      form,
      lottery,
    ]);

  /*
   * =====================================================
   * VALIDATE BEFORE SAVE
   * =====================================================
   */
  function validate() {
    if (!form) {
      return "The edit form is not available.";
    }

    if (
      !form.title.trim()
    ) {
      return "Lottery title is required.";
    }

    const price =
      Number(
        form.ticketPrice,
      );

    if (
      !Number.isFinite(
        price,
      ) ||
      price <= 0
    ) {
      return "Ticket price must be greater than £0.";
    }

    const age =
      Number(
        form.minimumAge,
      );

    if (
      age !==
      REQUIRED_MINIMUM_AGE
    ) {
      return "All Burton Pride lotteries must be 18+.";
    }

    if (
      form.maxTickets
    ) {
      const max =
        Number(
          form.maxTickets,
        );

      if (
        !Number.isInteger(
          max,
        ) ||
        max <= 0
      ) {
        return "Maximum tickets must be a positive whole number.";
      }
    }

    if (
      form.salesOpenAt &&
      form.salesCloseAt
    ) {
      if (
        new Date(
          form.salesCloseAt,
        ).getTime() <=
        new Date(
          form.salesOpenAt,
        ).getTime()
      ) {
        return "Ticket sales must close after they open.";
      }
    }

    if (
      form.salesCloseAt &&
      form.drawAt
    ) {
      if (
        new Date(
          form.drawAt,
        ).getTime() <
        new Date(
          form.salesCloseAt,
        ).getTime()
      ) {
        return "The draw date must be on or after ticket sales close.";
      }
    }

    return null;
  }

  function requestSave() {
    const problem =
      validate();

    if (problem) {
      setError({
        ok:
          false,

        code:
          "LOTTERY_EDIT_VALIDATION_FAILED",

        error:
          problem,
      });

      return;
    }

    setError(null);

    setConfirmSave(
      true,
    );
  }

  /*
   * =====================================================
   * SAVE
   * =====================================================
   */
  async function saveChanges() {
    if (
      !form ||
      !lottery
    ) {
      return;
    }

    setConfirmSave(
      false,
    );

    setSaving(true);

    setError(null);

    setSuccess(null);

    const route =
      `/api/admin/lotterymanagement/lottery/${encodeURIComponent(
        lottery.id,
      )}`;

    try {
      const body = {
        title:
          form.title.trim(),

        short_summary:
          form.shortSummary.trim() ||
          null,

        description:
          form.description.trim() ||
          null,

        fundraising_purpose:
          form.fundraisingPurpose.trim() ||
          null,

        hero_image_url:
          form.heroImageUrl.trim() ||
          null,

        status:
          form.status,

        ticket_price:
          Number(
            form.ticketPrice,
          ),

        currency:
          form.currency
            .trim()
            .toUpperCase(),

        minimum_age:
          REQUIRED_MINIMUM_AGE,

        max_tickets:
          form.maxTickets
            ? Number(
                form.maxTickets,
              )
            : null,

        publication_at:
          localDateToIso(
            form.publicationAt,
          ),

        sales_open_at:
          localDateToIso(
            form.salesOpenAt,
          ),

        sales_close_at:
          localDateToIso(
            form.salesCloseAt,
          ),

        draw_at:
          localDateToIso(
            form.drawAt,
          ),

        results_publish_at:
          localDateToIso(
            form.resultsPublishAt,
          ),

        geographic_eligibility:
          form.geographicEligibility.trim() ||
          null,

        terms_version:
          form.termsVersion.trim() ||
          null,

        privacy_notice_version:
          form.privacyNoticeVersion.trim() ||
          null,

        responsible_gambling_info:
          form.responsibleGamblingInfo.trim() ||
          null,

        /*
         * Keep old and new names synced.
         */
        show_in_directory:
          form.showInDirectory,

        show_in_public_directory:
          form.showInDirectory,

        allow_page_before_sales:
          form.allowPageBeforeSales,

        show_ticket_count:
          form.showTicketCount,

        show_amount_raised:
          form.showAmountRaised,

        show_remaining_tickets:
          form.showRemainingTickets,

        show_prize_values:
          form.showPrizeValues,

        countdown_enabled:
          form.countdownEnabled,

        winner_display_mode:
          form.winnerDisplayMode,

        is_featured:
          form.isFeatured,
      };

      const response =
        await fetch(
          route,
          {
            method:
              "PATCH",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                body,
              ),
          },
        );

      const data =
        await readJson(
          response,
        );

      if (
        !response.ok ||
        !data.ok
      ) {
        setError({
          ...data,

          code:
            data.code ||
            `LOTTERY_EDIT_HTTP_${response.status}`,

          error:
            data.error ||
            data.message ||
            "Unable to save the lottery.",

          details:
            data.details || {
              http_status:
                response.status,

              http_status_text:
                response.statusText,

              method:
                "PATCH",

              route,
            },
        });

        return;
      }

      if (
        data.item
      ) {
        setLottery(
          data.item,
        );
      }

      setSuccess(
        data.message ||
          "Lottery updated successfully.",
      );

      /*
       * Reload to ensure all values shown on screen match
       * what Supabase actually stored.
       */
      const refresh =
        await fetch(
          route,
          {
            method:
              "GET",

            credentials:
              "include",

            cache:
              "no-store",
          },
        );

      const refreshed =
        await readJson(
          refresh,
        );

      if (
        refresh.ok &&
        refreshed.ok &&
        refreshed.item
      ) {
        const item =
          refreshed.item;

        setLottery(
          item,
        );

        setForm({
          title:
            item.title ||
            "",

          shortSummary:
            item.short_summary ||
            "",

          description:
            item.description ||
            "",

          fundraisingPurpose:
            item.fundraising_purpose ||
            "",

          heroImageUrl:
            item.hero_image_url ||
            "",

          status:
            item.status,

          ticketPrice:
            Number(
              item.ticket_price ??
                (
                  item.ticket_price_pence ??
                  0
                ) /
                  100,
            ).toFixed(
              2,
            ),

          currency:
            item.currency ||
            "GBP",

          minimumAge:
            String(
              REQUIRED_MINIMUM_AGE,
            ),

          maxTickets:
            item.max_tickets !==
            null
              ? String(
                  item.max_tickets,
                )
              : "",

          publicationAt:
            toDateTimeLocal(
              item.publication_at,
            ),

          salesOpenAt:
            toDateTimeLocal(
              item.sales_open_at,
            ),

          salesCloseAt:
            toDateTimeLocal(
              item.sales_close_at,
            ),

          drawAt:
            toDateTimeLocal(
              item.draw_at,
            ),

          resultsPublishAt:
            toDateTimeLocal(
              item.results_publish_at,
            ),

          geographicEligibility:
            item.geographic_eligibility ||
            "",

          termsVersion:
            item.terms_version ||
            "",

          privacyNoticeVersion:
            item.privacy_notice_version ||
            "",

          responsibleGamblingInfo:
            item.responsible_gambling_info ||
            "",

          showInDirectory:
            item.show_in_public_directory ===
              true ||
            item.show_in_directory ===
              true,

          allowPageBeforeSales:
            item.allow_page_before_sales ===
            true,

          showTicketCount:
            item.show_ticket_count ===
            true,

          showAmountRaised:
            item.show_amount_raised ===
            true,

          showRemainingTickets:
            item.show_remaining_tickets ===
            true,

          showPrizeValues:
            item.show_prize_values ===
            true,

          countdownEnabled:
            item.countdown_enabled ===
            true,

          winnerDisplayMode:
            item.winner_display_mode ||
            "ticket_number",

          isFeatured:
            item.is_featured ===
            true,
        });
      }
    } catch (
      problem: any
    ) {
      setError({
        ok:
          false,

        code:
          "LOTTERY_EDIT_NETWORK_ERROR",

        error:
          problem?.message ||
          "An unexpected error occurred while saving the lottery.",

        details: {
          method:
            "PATCH",

          route,

          lottery_id:
            lottery.id,

          error_name:
            problem?.name ||
            "Error",
        },
      });
    } finally {
      setSaving(
        false,
      );
    }
  }

  /*
   * =====================================================
   * LOADING
   * =====================================================
   */
  if (loading) {
    return (
      <main
        className="
          flex
          min-h-[70vh]
          items-center
          justify-center
          p-6
        "
      >
        <div className="text-center">
          <Loader2
            className="
              mx-auto
              h-10
              w-10
              animate-spin
              text-purple-300
            "
          />

          <p
            className="
              mt-4
              font-bold
              text-white/70
            "
          >
            Loading lottery...
          </p>
        </div>
      </main>
    );
  }

  if (
    !form ||
    !lottery
  ) {
    return (
      <main className="p-6">
        <div
          className="
            rounded-3xl
            border
            border-red-400/30
            bg-red-500/10
            p-6
            text-red-100
          "
        >
          Unable to load the lottery edit form.
        </div>
      </main>
    );
  }

  return (
    <main
      className="
        w-full
        px-4
        pb-24
        pt-6

        sm:px-6

        lg:px-8
      "
    >
      {/* =====================================================
          HEADER
          ===================================================== */}
      <div
        className="
          flex
          flex-col
          gap-5

          xl:flex-row
          xl:items-start
          xl:justify-between
        "
      >
        <div>
          <div
            className="
              flex
              flex-wrap
              items-center
              gap-2
            "
          >
            <Link
              href="/Admin/LotteryManagement/Lotteries"
              className="
                inline-flex
                min-h-10
                items-center
                gap-2
                rounded-xl
                border
                border-white/15
                px-4
                py-2
                text-sm
                font-bold
                text-white/75
                transition

                hover:bg-white/10
                hover:text-white
              "
            >
              <ArrowLeft className="h-4 w-4" />

              Lottery list
            </Link>

            <Link
              href={`/Admin/LotteryManagement/Lotteries/${lottery.id}`}
              className="
                inline-flex
                min-h-10
                items-center
                gap-2
                rounded-xl
                border
                border-white/15
                px-4
                py-2
                text-sm
                font-bold
                text-white/75
                transition

                hover:bg-white/10
                hover:text-white
              "
            >
              <Eye className="h-4 w-4" />

              View lottery
            </Link>

            <Link
              href={`/lottery/${lottery.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="
                inline-flex
                min-h-10
                items-center
                gap-2
                rounded-xl
                border
                border-purple-300/20
                bg-purple-500/10
                px-4
                py-2
                text-sm
                font-bold
                text-purple-200
                transition

                hover:bg-purple-500/20
              "
            >
              <ExternalLink className="h-4 w-4" />

              Public page
            </Link>
          </div>

          <p
            className="
              mt-6
              text-xs
              font-black
              uppercase
              tracking-[0.18em]
              text-purple-300
            "
          >
            Lottery Management
          </p>

          <h1
            className="
              mt-2
              text-3xl
              font-black
              text-white

              sm:text-4xl
            "
          >
            Edit {lottery.title}
          </h1>

          <p
            className="
              mt-3
              max-w-3xl
              leading-7
              text-white/55
            "
          >
            Update the lottery&apos;s public information,
            sales dates, pricing, eligibility, terms and
            visibility settings.
          </p>

          <div
            className="
              mt-4
              flex
              flex-wrap
              gap-2
            "
          >
            <Badge>
              ID: {lottery.id}
            </Badge>

            <Badge>
              /lottery/{lottery.slug}
            </Badge>

            <StatusBadge
              status={
                lottery.status
              }
            />
          </div>
        </div>

        <div
          className="
            flex
            flex-wrap
            items-center
            gap-3
          "
        >
          {hasChanges && (
            <span
              className="
                rounded-full
                border
                border-amber-300/20
                bg-amber-500/10
                px-4
                py-2
                text-xs
                font-black
                text-amber-200
              "
            >
              Unsaved changes
            </span>
          )}

          <button
            type="button"
            onClick={
              requestSave
            }
            disabled={
              saving ||
              !hasChanges
            }
            className="
              inline-flex
              min-h-12
              items-center
              justify-center
              gap-2
              rounded-2xl
              bg-yellow-300
              px-6
              py-3
              text-sm
              font-black
              text-purple-950
              shadow-lg
              transition

              hover:bg-yellow-200

              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}

            {saving
              ? "Saving..."
              : "Save changes"}
          </button>
        </div>
      </div>

      {/* =====================================================
          SUCCESS
          ===================================================== */}
      {success && (
        <div
          role="status"
          className="
            mt-6
            flex
            items-start
            justify-between
            gap-4
            rounded-2xl
            border
            border-emerald-400/30
            bg-emerald-500/10
            p-5
            text-emerald-100
          "
        >
          <div className="flex gap-3">
            <Check className="mt-0.5 h-5 w-5 shrink-0" />

            <div>
              <p className="font-black">
                Lottery updated
              </p>

              <p className="mt-1 text-sm text-emerald-100/70">
                {success}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setSuccess(
                null,
              )
            }
            className="text-emerald-100/60 hover:text-white"
            aria-label="Dismiss success message"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* =====================================================
          ERROR
          ===================================================== */}
      {error && (
        <DetailedErrorPanel
          error={error}
          onDismiss={() =>
            setError(
              null,
            )
          }
        />
      )}

      {/* =====================================================
          MAIN FORM
          ===================================================== */}
      <div
        className="
          mt-8
          grid
          gap-6

          xl:grid-cols-[minmax(0,1fr)_420px]
        "
      >
        <div className="space-y-6">
          {/* BASIC INFORMATION */}
          <FormCard
            icon={
              <Info />
            }
            title="Basic information"
            description="Core information shown across the Admin Portal and public lottery page."
          >
            <div className="grid gap-5">
              <TextField
                label="Lottery title"
                required
                value={
                  form.title
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "title",
                    value,
                  )
                }
              />

              <TextArea
                label="Short summary"
                value={
                  form.shortSummary
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "shortSummary",
                    value,
                  )
                }
                rows={3}
                help="Used on the public lottery directory and near the top of the lottery page."
              />

              <TextArea
                label="Full description"
                value={
                  form.description
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "description",
                    value,
                  )
                }
                rows={6}
              />

              <TextArea
                label="Fundraising purpose"
                value={
                  form.fundraisingPurpose
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "fundraisingPurpose",
                    value,
                  )
                }
                rows={4}
                help="Explains publicly how money raised by this lottery will support Burton Pride."
              />
            </div>
          </FormCard>

          {/* IMAGE */}
          <FormCard
            icon={
              <ImageIcon />
            }
            title="Public image"
            description="Image displayed on the public lottery page and directory."
          >
            <TextField
              label="Hero image URL"
              type="url"
              value={
                form.heroImageUrl
              }
              onChange={(
                value,
              ) =>
                updateField(
                  "heroImageUrl",
                  value,
                )
              }
              placeholder="https://..."
            />

            {form.heroImageUrl && (
              <div
                className="
                  mt-5
                  overflow-hidden
                  rounded-2xl
                  border
                  border-white/10
                "
              >
                <img
                  src={
                    form.heroImageUrl
                  }
                  alt=""
                  className="max-h-80 w-full object-cover"
                />
              </div>
            )}
          </FormCard>

          {/* PRICING */}
          <FormCard
            icon={
              <CircleDollarSign />
            }
            title="Ticket pricing & limits"
            description="Configure the individual ticket price and ticket availability."
          >
            <div
              className="
                grid
                gap-5

                md:grid-cols-3
              "
            >
              <TextField
                label="Ticket price"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={
                  form.ticketPrice
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "ticketPrice",
                    value,
                  )
                }
                prefix="£"
              />

              <SelectField
                label="Currency"
                value={
                  form.currency
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "currency",
                    value,
                  )
                }
                options={[
                  {
                    value:
                      "GBP",
                    label:
                      "GBP — Pound sterling",
                  },
                ]}
              />

              <TextField
                label="Maximum tickets"
                type="number"
                min="1"
                value={
                  form.maxTickets
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "maxTickets",
                    value,
                  )
                }
                placeholder="No maximum"
              />
            </div>
          </FormCard>

          {/* DATES */}
          <FormCard
            icon={
              <CalendarDays />
            }
            title="Lottery dates"
            description="Control publication, ticket sales, draw and result dates."
          >
            <div
              className="
                grid
                gap-5

                md:grid-cols-2
              "
            >
              <DateField
                label="Publication date"
                value={
                  form.publicationAt
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "publicationAt",
                    value,
                  )
                }
              />

              <DateField
                label="Ticket sales open"
                value={
                  form.salesOpenAt
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "salesOpenAt",
                    value,
                  )
                }
              />

              <DateField
                label="Ticket sales close"
                value={
                  form.salesCloseAt
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "salesCloseAt",
                    value,
                  )
                }
              />

              <DateField
                label="Draw date"
                value={
                  form.drawAt
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "drawAt",
                    value,
                  )
                }
              />

              <DateField
                label="Results publish date"
                value={
                  form.resultsPublishAt
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "resultsPublishAt",
                    value,
                  )
                }
              />
            </div>
          </FormCard>

          {/* ELIGIBILITY */}
          <FormCard
            icon={
              <ShieldCheck />
            }
            title="Eligibility & compliance information"
            description="Entry is strictly 18+ for every Burton Pride lottery. Other eligibility information is shown to entrants before purchase."
          >
            <div
              className="
                grid
                gap-5

                md:grid-cols-2
              "
            >
              <div>
                <div className="mb-2 text-sm font-bold text-white/80">
                  Minimum age
                </div>

                <div
                  className="
                    flex
                    min-h-12
                    items-center
                    justify-between
                    gap-3
                    rounded-2xl
                    border
                    border-emerald-400/25
                    bg-emerald-500/10
                    px-4
                    py-3
                    text-emerald-100
                  "
                >
                  <div>
                    <div className="text-base font-extrabold">
                      18+ only
                    </div>

                    <div className="mt-1 text-xs font-medium text-emerald-100/65">
                      Fixed for every Burton Pride lottery and cannot be changed.
                    </div>
                  </div>

                  <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-200" />
                </div>
              </div>

              <TextField
                label="Geographical eligibility"
                value={
                  form.geographicEligibility
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "geographicEligibility",
                    value,
                  )
                }
                placeholder="Great Britain"
              />
            </div>

            <div className="mt-5">
              <TextArea
                label="Responsible participation information"
                value={
                  form.responsibleGamblingInfo
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "responsibleGamblingInfo",
                    value,
                  )
                }
                rows={5}
                placeholder="Please only spend what you can afford..."
              />
            </div>
          </FormCard>

          {/* TERMS */}
          <FormCard
            icon={
              <FileText />
            }
            title="Terms & privacy versions"
            description="These version references are stored with the lottery and can be recorded against purchases."
          >
            <div
              className="
                grid
                gap-5

                md:grid-cols-2
              "
            >
              <TextField
                label="Lottery terms version"
                value={
                  form.termsVersion
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "termsVersion",
                    value,
                  )
                }
                placeholder="2026-08-v1"
              />

              <TextField
                label="Privacy notice version"
                value={
                  form.privacyNoticeVersion
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "privacyNoticeVersion",
                    value,
                  )
                }
                placeholder="2026-08-v1"
              />
            </div>

            <div
              className="
                mt-5
                flex
                flex-wrap
                gap-3
              "
            >
              <Link
                href="/lottery/terms"
                target="_blank"
                className="
                  inline-flex
                  items-center
                  gap-2
                  rounded-xl
                  border
                  border-white/15
                  px-4
                  py-2
                  text-sm
                  font-bold
                  text-white/75
                  hover:bg-white/10
                "
              >
                General terms
                <ExternalLink className="h-4 w-4" />
              </Link>

              <Link
                href={`/lottery/${lottery.slug}/terms`}
                target="_blank"
                className="
                  inline-flex
                  items-center
                  gap-2
                  rounded-xl
                  border
                  border-purple-300/20
                  bg-purple-500/10
                  px-4
                  py-2
                  text-sm
                  font-bold
                  text-purple-200
                  hover:bg-purple-500/20
                "
              >
                Individual terms
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          </FormCard>
        </div>

        {/* ===================================================
            RIGHT COLUMN
            =================================================== */}
        <aside
          className="
            space-y-6

            xl:sticky
            xl:top-6
          "
        >
          {/* STATUS */}
          <FormCard
            icon={
              <Trophy />
            }
            title="Lottery status"
            description="Control the lifecycle status of this lottery."
          >
            <SelectField
              label="Status"
              value={
                form.status
              }
              onChange={(
                value,
              ) =>
                updateField(
                  "status",
                  value as LotteryStatus,
                )
              }
              options={[
                {
                  value:
                    "draft",
                  label:
                    "Draft",
                },

                {
                  value:
                    "compliance_review",
                  label:
                    "Compliance review",
                },

                {
                  value:
                    "scheduled",
                  label:
                    "Scheduled",
                },

                {
                  value:
                    "live",
                  label:
                    "Live",
                },

                {
                  value:
                    "paused",
                  label:
                    "Paused",
                },

                {
                  value:
                    "sales_closed",
                  label:
                    "Sales closed",
                },

                {
                  value:
                    "draw_ready",
                  label:
                    "Draw ready",
                },

                {
                  value:
                    "completed",
                  label:
                    "Completed",
                },

                {
                  value:
                    "under_review",
                  label:
                    "Under review",
                },

                {
                  value:
                    "cancelled",
                  label:
                    "Cancelled",
                },

                {
                  value:
                    "archived",
                  label:
                    "Archived",
                },
              ]}
            />

            {form.status ===
              "live" && (
              <div
                className="
                  mt-4
                  rounded-2xl
                  border
                  border-emerald-400/20
                  bg-emerald-500/10
                  p-4
                  text-sm
                  leading-6
                  text-emerald-100
                "
              >
                A live lottery can accept ticket purchases
                when its configured sales period is open.
              </div>
            )}
          </FormCard>

          {/* PUBLIC SETTINGS */}
          <FormCard
            icon={
              <Globe2 />
            }
            title="Public website"
            description="Control what visitors can see on the public lottery website."
          >
            <div className="space-y-3">
              <Toggle
                label="Show in public lottery directory"
                description="Display this lottery on /lottery."
                checked={
                  form.showInDirectory
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "showInDirectory",
                    value,
                  )
                }
              />

              <Toggle
                label="Featured lottery"
                description="Give this lottery priority in the public directory."
                checked={
                  form.isFeatured
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "isFeatured",
                    value,
                  )
                }
              />

              <Toggle
                label="Allow page before sales open"
                description="Visitors can view the lottery before ticket sales start."
                checked={
                  form.allowPageBeforeSales
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "allowPageBeforeSales",
                    value,
                  )
                }
              />

              <Toggle
                label="Show ticket count"
                checked={
                  form.showTicketCount
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "showTicketCount",
                    value,
                  )
                }
              />

              <Toggle
                label="Show amount raised"
                checked={
                  form.showAmountRaised
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "showAmountRaised",
                    value,
                  )
                }
              />

              <Toggle
                label="Show remaining tickets"
                checked={
                  form.showRemainingTickets
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "showRemainingTickets",
                    value,
                  )
                }
              />

              <Toggle
                label="Show prize values"
                checked={
                  form.showPrizeValues
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "showPrizeValues",
                    value,
                  )
                }
              />

              <Toggle
                label="Show countdown"
                checked={
                  form.countdownEnabled
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "countdownEnabled",
                    value,
                  )
                }
              />
            </div>
          </FormCard>

          {/* WINNER DISPLAY */}
          <FormCard
            icon={
              <Heart />
            }
            title="Winner visibility"
            description="Choose how winner information may be shown publicly."
          >
            <SelectField
              label="Public winner display"
              value={
                form.winnerDisplayMode
              }
              onChange={(
                value,
              ) =>
                updateField(
                  "winnerDisplayMode",
                  value as WinnerDisplayMode,
                )
              }
              options={[
                {
                  value:
                    "ticket_number",
                  label:
                    "Ticket number only",
                },

                {
                  value:
                    "first_name",
                  label:
                    "First name",
                },

                {
                  value:
                    "full_name",
                  label:
                    "Full name",
                },

                {
                  value:
                    "none",
                  label:
                    "Do not display identity",
                },
              ]}
            />
          </FormCard>

          {/* SUMMARY */}
          <FormCard
            icon={
              <Ticket />
            }
            title="Current summary"
          >
            <div className="grid grid-cols-2 gap-3">
              <SummaryItem
                label="Orders"
                value={
                  lottery.order_count ??
                  0
                }
              />

              <SummaryItem
                label="Paid orders"
                value={
                  lottery.paid_order_count ??
                  0
                }
              />

              <SummaryItem
                label="Tickets"
                value={
                  lottery.ticket_count ??
                  0
                }
              />

              <SummaryItem
                label="Prizes"
                value={
                  lottery.prize_count ??
                  0
                }
              />

              <SummaryItem
                label="Winners"
                value={
                  lottery.winner_count ??
                  0
                }
              />

              <SummaryItem
                label="Revenue"
                value={`£${Number(
                  lottery.revenue ??
                    0,
                ).toFixed(
                  2,
                )}`}
              />
            </div>
          </FormCard>

          <button
            type="button"
            onClick={
              requestSave
            }
            disabled={
              saving ||
              !hasChanges
            }
            className="
              inline-flex
              min-h-14
              w-full
              items-center
              justify-center
              gap-2
              rounded-2xl
              bg-yellow-300
              px-5
              py-3
              font-black
              text-purple-950
              shadow-lg
              transition

              hover:bg-yellow-200

              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}

            Save changes
          </button>
        </aside>
      </div>

      {/* =====================================================
          CONFIRM SAVE MODAL
          ===================================================== */}
      {confirmSave && (
        <div
          className="
            fixed
            inset-0
            z-[99999]
            flex
            items-center
            justify-center
            bg-black/80
            p-4
            backdrop-blur-sm
          "
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-save-title"
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setConfirmSave(
                false,
              );
            }
          }}
        >
          <div
            className="
              w-full
              max-w-lg
              overflow-hidden
              rounded-3xl
              border
              border-white/10
              bg-[#15172a]
              shadow-2xl
            "
          >
            <div
              className="
                flex
                items-start
                justify-between
                gap-4
                border-b
                border-white/10
                p-6
              "
            >
              <div className="flex gap-3">
                <div
                  className="
                    flex
                    h-11
                    w-11
                    shrink-0
                    items-center
                    justify-center
                    rounded-2xl
                    bg-purple-500/15
                    text-purple-200
                  "
                >
                  <Save className="h-5 w-5" />
                </div>

                <div>
                  <h2
                    id="confirm-save-title"
                    className="text-xl font-black text-white"
                  >
                    Save lottery changes?
                  </h2>

                  <p className="mt-1 text-sm text-white/50">
                    {lottery.title}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setConfirmSave(
                    false,
                  )
                }
                className="rounded-xl p-2 text-white/50 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm leading-7 text-white/70">
                These changes can affect the public lottery
                page, ticket availability, pricing and
                lottery terms.
              </p>

              {form.status ===
                "live" && (
                <div
                  className="
                    mt-4
                    rounded-2xl
                    border
                    border-amber-300/20
                    bg-amber-500/10
                    p-4
                    text-sm
                    leading-6
                    text-amber-100
                  "
                >
                  <div className="flex gap-2">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />

                    <span>
                      This lottery is set to Live. Changes
                      may immediately affect information
                      shown to the public.
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div
              className="
                flex
                flex-col-reverse
                gap-3
                border-t
                border-white/10
                p-6

                sm:flex-row
                sm:justify-end
              "
            >
              <button
                type="button"
                onClick={() =>
                  setConfirmSave(
                    false,
                  )
                }
                className="
                  min-h-11
                  rounded-2xl
                  border
                  border-white/15
                  px-5
                  py-3
                  text-sm
                  font-bold
                  text-white/75
                  hover:bg-white/10
                "
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={
                  saveChanges
                }
                className="
                  inline-flex
                  min-h-11
                  items-center
                  justify-center
                  gap-2
                  rounded-2xl
                  bg-yellow-300
                  px-5
                  py-3
                  text-sm
                  font-black
                  text-purple-950
                  hover:bg-yellow-200
                "
              >
                <Check className="h-4 w-4" />

                Save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/*
 * =========================================================
 * COMPONENTS
 * =========================================================
 */

function FormCard({
  icon,
  title,
  description,
  children,
}: {
  icon:
    React.ReactNode;

  title: string;

  description?: string;

  children:
    React.ReactNode;
}) {
  return (
    <section
      className="
        rounded-3xl
        border
        border-white/10
        bg-[#151b29]/90
        p-5
        shadow-xl

        sm:p-6
      "
    >
      <div className="flex items-start gap-3">
        <div
          className="
            flex
            h-11
            w-11
            shrink-0
            items-center
            justify-center
            rounded-2xl
            bg-purple-500/15
            text-purple-200

            [&>svg]:h-5
            [&>svg]:w-5
          "
        >
          {icon}
        </div>

        <div>
          <h2 className="text-lg font-black text-white">
            {title}
          </h2>

          {description && (
            <p className="mt-1 text-sm leading-6 text-white/45">
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6">
        {children}
      </div>
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  min,
  step,
  prefix,
}: {
  label: string;

  value: string;

  onChange: (
    value: string,
  ) => void;

  type?: string;

  required?: boolean;

  placeholder?: string;

  min?: string;

  step?: string;

  prefix?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-white/80">
        {label}

        {required && (
          <span className="ml-1 text-red-300">
            *
          </span>
        )}
      </span>

      <div className="relative mt-2">
        {prefix && (
          <span
            className="
              pointer-events-none
              absolute
              left-4
              top-1/2
              -translate-y-1/2
              font-bold
              text-white/45
            "
          >
            {prefix}
          </span>
        )}

        <input
          type={type}
          value={value}
          required={required}
          placeholder={
            placeholder
          }
          min={min}
          step={step}
          onChange={(
            event,
          ) =>
            onChange(
              event.target
                .value,
            )
          }
          className={`
            h-12
            w-full
            rounded-2xl
            border
            border-white/15
            bg-black/20
            pr-4
            font-semibold
            text-white
            outline-none
            transition
            placeholder:text-white/25

            focus:border-purple-400
            focus:ring-4
            focus:ring-purple-500/10

            ${
              prefix
                ? "pl-9"
                : "pl-4"
            }
          `}
        />
      </div>
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 4,
  help,
  placeholder,
}: {
  label: string;

  value: string;

  onChange: (
    value: string,
  ) => void;

  rows?: number;

  help?: string;

  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-white/80">
        {label}
      </span>

      <textarea
        value={value}
        rows={rows}
        placeholder={
          placeholder
        }
        onChange={(
          event,
        ) =>
          onChange(
            event.target
              .value,
          )
        }
        className="
          mt-2
          w-full
          resize-y
          rounded-2xl
          border
          border-white/15
          bg-black/20
          px-4
          py-3
          font-medium
          leading-6
          text-white
          outline-none
          transition
          placeholder:text-white/25

          focus:border-purple-400
          focus:ring-4
          focus:ring-purple-500/10
        "
      />

      {help && (
        <span className="mt-2 block text-xs leading-5 text-white/35">
          {help}
        </span>
      )}
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;

  value: string;

  onChange: (
    value: string,
  ) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-white/80">
        {label}
      </span>

      <input
        type="datetime-local"
        value={value}
        onChange={(
          event,
        ) =>
          onChange(
            event.target
              .value,
          )
        }
        className="
          mt-2
          h-12
          w-full
          rounded-2xl
          border
          border-white/15
          bg-black/20
          px-4
          font-semibold
          text-white
          outline-none

          focus:border-purple-400
          focus:ring-4
          focus:ring-purple-500/10

          [color-scheme:dark]
        "
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;

  value: string;

  onChange: (
    value: string,
  ) => void;

  options: Array<{
    value: string;

    label: string;
  }>;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-white/80">
        {label}
      </span>

      <select
        value={value}
        onChange={(
          event,
        ) =>
          onChange(
            event.target
              .value,
          )
        }
        className="
          mt-2
          h-12
          w-full
          rounded-2xl
          border
          border-white/15
          bg-[#101521]
          px-4
          font-bold
          text-white
          outline-none

          focus:border-purple-400
          focus:ring-4
          focus:ring-purple-500/10
        "
      >
        {options.map(
          (option) => (
            <option
              key={
                option.value
              }
              value={
                option.value
              }
            >
              {
                option.label
              }
            </option>
          ),
        )}
      </select>
    </label>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;

  description?: string;

  checked: boolean;

  onChange: (
    value: boolean,
  ) => void;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        onChange(
          !checked,
        )
      }
      className="
        flex
        w-full
        items-center
        justify-between
        gap-4
        rounded-2xl
        border
        border-white/10
        bg-black/15
        p-4
        text-left
        transition

        hover:bg-white/[0.05]
      "
    >
      <div>
        <p className="text-sm font-bold text-white">
          {label}
        </p>

        {description && (
          <p className="mt-1 text-xs leading-5 text-white/40">
            {description}
          </p>
        )}
      </div>

      <span
        className={`
          relative
          h-7
          w-12
          shrink-0
          rounded-full
          transition

          ${
            checked
              ? "bg-purple-500"
              : "bg-white/15"
          }
        `}
      >
        <span
          className={`
            absolute
            top-1
            h-5
            w-5
            rounded-full
            bg-white
            shadow-md
            transition

            ${
              checked
                ? "left-6"
                : "left-1"
            }
          `}
        />
      </span>
    </button>
  );
}

function Badge({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <span
      className="
        rounded-full
        border
        border-white/10
        bg-white/[0.05]
        px-3
        py-1.5
        text-xs
        font-bold
        text-white/50
      "
    >
      {children}
    </span>
  );
}

function StatusBadge({
  status,
}: {
  status:
    LotteryStatus;
}) {
  const classes =
    status === "live"
      ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
      : status ===
          "draft"
        ? "border-slate-400/20 bg-slate-500/10 text-slate-200"
        : status ===
            "cancelled"
          ? "border-red-400/25 bg-red-500/10 text-red-200"
          : "border-purple-400/25 bg-purple-500/10 text-purple-200";

  return (
    <span
      className={`
        rounded-full
        border
        px-3
        py-1.5
        text-xs
        font-black
        uppercase
        tracking-wide

        ${classes}
      `}
    >
      {status.replaceAll(
        "_",
        " ",
      )}
    </span>
  );
}

function SummaryItem({
  label,
  value,
}: {
  label: string;

  value:
    React.ReactNode;
}) {
  return (
    <div
      className="
        rounded-2xl
        border
        border-white/10
        bg-black/20
        p-4
      "
    >
      <p className="text-[11px] font-black uppercase tracking-wide text-white/35">
        {label}
      </p>

      <p className="mt-1 text-lg font-black text-white">
        {value}
      </p>
    </div>
  );
}

function DetailedErrorPanel({
  error,
  onDismiss,
}: {
  error:
    ApiResponse;

  onDismiss:
    () => void;
}) {
  return (
    <div
      role="alert"
      className="
        mt-6
        overflow-hidden
        rounded-3xl
        border
        border-red-400/30
        bg-red-500/10
      "
    >
      <div
        className="
          flex
          items-start
          justify-between
          gap-4
          border-b
          border-red-400/20
          p-5
        "
      >
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-red-300" />

          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-red-200/60">
              Lottery Management Error
            </p>

            <h2 className="mt-1 text-lg font-black text-red-100">
              Unable to save lottery
            </h2>

            <p className="mt-2 max-w-4xl text-sm leading-6 text-red-100/75">
              {error.error ||
                error.message ||
                "An unexpected error occurred."}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={
            onDismiss
          }
          className="
            rounded-xl
            border
            border-red-300/20
            p-2
            text-red-100/60
            hover:bg-red-400/10
            hover:text-white
          "
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        className="
          grid
          gap-3
          p-5

          sm:grid-cols-2
          xl:grid-cols-3
        "
      >
        <ErrorValue
          label="Error code"
          value={
            error.code ||
            "UNKNOWN_ERROR"
          }
        />

        <ErrorValue
          label="Request ID"
          value={
            error.request_id ||
            "Not supplied"
          }
        />

        <ErrorValue
          label="Message"
          value={
            error.error ||
            error.message ||
            "Unknown error"
          }
        />
      </div>

      {error.details !==
        undefined && (
        <div
          className="
            border-t
            border-red-400/20
            p-5
          "
        >
          <p className="text-xs font-black uppercase tracking-wide text-red-200/50">
            Technical details
          </p>

          <pre
            className="
              mt-3
              max-h-80
              overflow-auto
              rounded-2xl
              bg-black/30
              p-4
              text-xs
              leading-6
              text-red-50
            "
          >
            {JSON.stringify(
              error.details,
              null,
              2,
            )}
          </pre>
        </div>
      )}
    </div>
  );
}

function ErrorValue({
  label,
  value,
}: {
  label: string;

  value: string;
}) {
  return (
    <div
      className="
        rounded-2xl
        border
        border-red-300/15
        bg-black/20
        p-4
      "
    >
      <p className="text-[11px] font-black uppercase tracking-wide text-red-200/40">
        {label}
      </p>

      <p className="mt-1 break-words font-mono text-xs font-bold text-red-50">
        {value}
      </p>
    </div>
  );
}