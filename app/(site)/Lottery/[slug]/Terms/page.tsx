import type { Metadata } from "next";

import Link from "next/link";

import {
  ArrowLeft,
  CalendarDays,
  CircleAlert,
  Clock3,
  FileText,
  MapPin,
  ShieldCheck,
  Ticket,
  Trophy,
} from "lucide-react";

import {
  supabaseAdmin,
} from "@/lib/supabase/supabaseAdmin";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

type LotteryRecord = {
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

  status: string;

  ticket_price:
    | number
    | null;

  ticket_price_pence:
    | number
    | null;

  currency:
    | string
    | null;

  minimum_age:
    | number
    | null;

  max_tickets:
    | number
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
    | boolean
    | null;

  show_in_public_directory:
    | boolean
    | null;

  is_active:
    | boolean
    | null;
};

/*
 * =========================================================
 * INDIVIDUAL LOTTERY TERMS
 *
 * These are generated using the information belonging to
 * the lottery itself.
 *
 * The General Burton Pride Lottery Terms still apply.
 *
 * This page adds the specific conditions for this lottery:
 *
 * - lottery name
 * - ticket price
 * - dates
 * - minimum age
 * - eligibility
 * - ticket limits
 * - draw
 * - prizes
 * - fundraising purpose
 * =========================================================
 */

function formatMoney(
  pence: number,
  currency = "GBP",
) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency:
        currency ||
        "GBP",
    },
  ).format(
    pence / 100,
  );
}

function getTicketPricePence(
  lottery: LotteryRecord,
) {
  if (
    typeof lottery.ticket_price_pence ===
      "number" &&
    Number.isFinite(
      lottery.ticket_price_pence,
    )
  ) {
    return lottery.ticket_price_pence;
  }

  const pounds =
    Number(
      lottery.ticket_price ??
        0,
    );

  if (
    !Number.isFinite(
      pounds,
    )
  ) {
    return 0;
  }

  return Math.round(
    pounds * 100,
  );
}

function formatDateTime(
  value:
    | string
    | null,
) {
  if (!value) {
    return "To be confirmed";
  }

  const date =
    new Date(value);

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
      weekday:
        "long",

      day:
        "numeric",

      month:
        "long",

      year:
        "numeric",

      hour:
        "2-digit",

      minute:
        "2-digit",

      timeZone:
        "Europe/London",
    },
  );
}

function formatStatus(
  status: string,
) {
  return String(
    status || "",
  )
    .replaceAll(
      "_",
      " ",
    )
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );
}

async function getLottery(
  slug: string,
): Promise<LotteryRecord | null> {
  const cleanSlug =
    decodeURIComponent(
      slug,
    )
      .trim()
      .toLowerCase();

  if (
    !cleanSlug ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
      cleanSlug,
    )
  ) {
    return null;
  }

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
        description,
        fundraising_purpose,
        status,
        ticket_price,
        ticket_price_pence,
        currency,
        minimum_age,
        max_tickets,
        sales_open_at,
        sales_close_at,
        draw_at,
        geographic_eligibility,
        terms_version,
        privacy_notice_version,
        responsible_gambling_info,
        show_in_directory,
        show_in_public_directory,
        is_active
        `,
      )
      .eq(
        "slug",
        cleanSlug,
      )
      .maybeSingle();

  if (error) {
    console.error(
      "Individual lottery terms lookup failed:",
      {
        code:
          error.code,

        message:
          error.message,

        details:
          error.details,

        hint:
          error.hint,

        slug:
          cleanSlug,
      },
    );

    return null;
  }

  if (!data) {
    return null;
  }

  return data as LotteryRecord;
}

/*
 * =========================================================
 * SEO
 * =========================================================
 */
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const {
    slug,
  } =
    await params;

  const lottery =
    await getLottery(
      slug,
    );

  if (!lottery) {
    return {
      title:
        "Lottery Terms | Burton Pride",

      description:
        "Individual Burton Pride lottery terms and conditions.",

      robots: {
        index:
          false,

        follow:
          false,
      },
    };
  }

  return {
    title:
      `${lottery.title} Terms & Conditions | Burton Pride`,

    description:
      `Read the individual terms and conditions for ${lottery.title}, including ticket price, eligibility, sales dates and draw information.`,
  };
}

/*
 * =========================================================
 * PAGE
 * =========================================================
 */
export default async function IndividualLotteryTermsPage({
  params,
}: PageProps) {
  const {
    slug,
  } =
    await params;

  const lottery =
    await getLottery(
      slug,
    );

  /*
   * =======================================================
   * NOT FOUND
   * =======================================================
   */
  if (!lottery) {
    return (
      <main
        className="
          mx-auto
          min-h-[70vh]
          w-full
          max-w-4xl
          px-4
          pb-20
          pt-28

          sm:px-6
          sm:pt-32

          lg:px-8
        "
      >
        <div
          className="
            rounded-[2rem]
            border
            border-red-200
            bg-white
            p-8
            text-center
            shadow-xl

            dark:border-red-400/20
            dark:bg-[#111827]
          "
        >
          <CircleAlert
            className="
              mx-auto
              h-11
              w-11
              text-red-600

              dark:text-red-300
            "
          />

          <h1
            className="
              mt-4
              text-2xl
              font-black
              text-slate-950

              dark:text-white
            "
          >
            Lottery terms unavailable
          </h1>

          <p
            className="
              mx-auto
              mt-3
              max-w-xl
              leading-7
              text-slate-600

              dark:text-white/60
            "
          >
            We could not find the lottery associated with
            this terms page.
          </p>

          <Link
            href="/Lottery"
            className="
              mt-6
              inline-flex
              min-h-12
              items-center
              justify-center
              gap-2
              rounded-full
              bg-yellow-300
              px-6
              py-3
              text-sm
              font-black
              text-purple-950
              transition

              hover:bg-yellow-200
            "
          >
            <ArrowLeft className="h-4 w-4" />

            Back to lotteries
          </Link>
        </div>
      </main>
    );
  }

  const publicVisible =
    lottery.show_in_public_directory ===
      true ||
    lottery.show_in_directory ===
      true;

  const ticketPricePence =
    getTicketPricePence(
      lottery,
    );

  const minimumAge =
    lottery.minimum_age ??
    16;

  return (
    <main
      className="
        mx-auto
        w-full
        max-w-6xl
        px-4
        pb-24
        pt-24

        sm:px-6
        sm:pt-28

        lg:px-8
        lg:pt-32
      "
    >
      {/* =====================================================
          NAVIGATION
          ===================================================== */}
      <div
        className="
          mb-6
          flex
          flex-wrap
          items-center
          gap-3
        "
      >
        <Link
          href={`/Lottery/${encodeURIComponent(
            lottery.slug,
          )}`}
          className="
            inline-flex
            min-h-11
            items-center
            justify-center
            gap-2
            rounded-full
            border
            border-slate-200
            bg-white
            px-5
            py-2.5
            text-sm
            font-black
            text-slate-800
            shadow-sm
            transition

            hover:border-purple-300
            hover:text-purple-800

            dark:border-white/15
            dark:bg-white/[0.06]
            dark:text-white
          "
        >
          <ArrowLeft className="h-4 w-4" />

          Back to {lottery.title}
        </Link>

        <Link
          href="/Lottery/Terms"
          className="
            inline-flex
            min-h-11
            items-center
            justify-center
            gap-2
            rounded-full
            border
            border-purple-200
            bg-purple-50
            px-5
            py-2.5
            text-sm
            font-black
            text-purple-800
            shadow-sm
            transition

            hover:bg-purple-100

            dark:border-purple-300/25
            dark:bg-purple-500/10
            dark:text-purple-200
          "
        >
          <ShieldCheck className="h-4 w-4" />

          General Lottery Terms
        </Link>
      </div>

      {/* =====================================================
          HERO
          ===================================================== */}
      <section
        className="
          relative
          overflow-hidden
          rounded-[2.25rem]
          bg-gradient-to-br
          from-pink-500
          via-purple-600
          to-blue-600
          p-6
          text-white
          shadow-2xl

          sm:p-10
          lg:p-12
        "
      >
        <div
          className="
            flex
            h-12
            w-12
            items-center
            justify-center
            rounded-2xl
            bg-yellow-300
            text-purple-950
            shadow-lg
          "
        >
          <FileText className="h-6 w-6" />
        </div>

        <p
          className="
            mt-6
            text-sm
            font-black
            uppercase
            tracking-[0.18em]
            text-yellow-200
          "
        >
          Individual Lottery Terms
        </p>

        <h1
          className="
            mt-2
            max-w-4xl
            text-3xl
            font-black
            leading-tight

            sm:text-4xl
            lg:text-5xl
          "
        >
          {lottery.title}
        </h1>

        <p
          className="
            mt-4
            max-w-3xl
            text-base
            leading-7
            text-white/85

            sm:text-lg
          "
        >
          These individual terms apply specifically to{" "}
          <strong>
            {lottery.title}
          </strong>
          . They should be read together with Burton
          Pride&apos;s General Lottery Terms.
        </p>

        {lottery.terms_version && (
          <div
            className="
              mt-6
              inline-flex
              rounded-full
              border
              border-white/20
              bg-black/20
              px-4
              py-2
              text-xs
              font-black
              backdrop-blur-md
            "
          >
            Terms version:{" "}
            {lottery.terms_version}
          </div>
        )}
      </section>

      {/* =====================================================
          IMPORTANT NOTICE
          ===================================================== */}
      <section
        className="
          mt-8
          rounded-[2rem]
          border
          border-amber-300
          bg-amber-50
          p-6
          shadow-lg

          dark:border-yellow-300/25
          dark:bg-yellow-300/10

          sm:p-8
        "
      >
        <div className="flex items-start gap-4">
          <CircleAlert
            className="
              mt-0.5
              h-6
              w-6
              shrink-0
              text-amber-700

              dark:text-yellow-300
            "
          />

          <div>
            <h2
              className="
                text-lg
                font-black
                text-slate-950

                dark:text-white
              "
            >
              These terms do not replace the General
              Lottery Terms
            </h2>

            <p
              className="
                mt-2
                max-w-4xl
                leading-7
                text-slate-700

                dark:text-white/70
              "
            >
              Burton Pride&apos;s General Lottery Terms
              apply to all Burton Pride lotteries and
              raffles. The information on this page adds
              the specific conditions for this particular
              lottery.
            </p>

            <Link
              href="/Lottery/Terms"
              className="
                mt-4
                inline-flex
                items-center
                gap-2
                font-black
                text-purple-700
                underline
                underline-offset-4

                dark:text-purple-300
              "
            >
              <ShieldCheck className="h-4 w-4" />

              Read the General Lottery Terms
            </Link>
          </div>
        </div>
      </section>

      {/* =====================================================
          KEY DETAILS
          ===================================================== */}
      <section
        className="
          mt-8
          rounded-[2rem]
          border
          border-slate-200
          bg-white
          p-6
          shadow-xl

          dark:border-white/10
          dark:bg-[#111827]

          sm:p-8
        "
      >
        <p
          className="
            text-sm
            font-black
            uppercase
            tracking-[0.18em]
            text-purple-700

            dark:text-purple-300
          "
        >
          Lottery details
        </p>

        <h2
          className="
            mt-2
            text-2xl
            font-black
            text-slate-950

            dark:text-white
          "
        >
          Important information
        </h2>

        <div
          className="
            mt-6
            grid
            gap-4

            sm:grid-cols-2
            lg:grid-cols-3
          "
        >
          <TermsDetail
            icon={
              <Ticket />
            }
            label="Ticket price"
            value={
              ticketPricePence >
              0
                ? `${formatMoney(
                    ticketPricePence,
                    lottery.currency ||
                      "GBP",
                  )} per ticket`
                : "To be confirmed"
            }
          />

          <TermsDetail
            icon={
              <Clock3 />
            }
            label="Ticket sales open"
            value={formatDateTime(
              lottery.sales_open_at,
            )}
          />

          <TermsDetail
            icon={
              <CalendarDays />
            }
            label="Ticket sales close"
            value={formatDateTime(
              lottery.sales_close_at,
            )}
          />

          <TermsDetail
            icon={
              <Trophy />
            }
            label="Draw"
            value={formatDateTime(
              lottery.draw_at,
            )}
          />

          <TermsDetail
            icon={
              <ShieldCheck />
            }
            label="Minimum age"
            value={`${minimumAge}+`}
          />

          <TermsDetail
            icon={
              <MapPin />
            }
            label="Eligibility"
            value={
              lottery.geographic_eligibility ||
              "See General Lottery Terms"
            }
          />
        </div>
      </section>

      {/* =====================================================
          TERMS CONTENT
          ===================================================== */}
      <div
        className="
          mt-8
          space-y-5
        "
      >
        <TermSection
          number="1"
          title="The Lottery"
        >
          <p>
            These individual terms apply to{" "}
            <strong>
              {lottery.title}
            </strong>
            , organised by Burton Pride.
          </p>

          {lottery.short_summary && (
            <p>
              {lottery.short_summary}
            </p>
          )}

          {lottery.description && (
            <p>
              {lottery.description}
            </p>
          )}
        </TermSection>

        <TermSection
          number="2"
          title="Ticket Price"
        >
          {ticketPricePence >
          0 ? (
            <>
              <p>
                Each ticket costs{" "}
                <strong>
                  {formatMoney(
                    ticketPricePence,
                    lottery.currency ||
                      "GBP",
                  )}
                </strong>
                .
              </p>

              <p>
                The price applies to each individual ticket
                purchased. The total amount payable depends
                on the number of tickets selected.
              </p>
            </>
          ) : (
            <p>
              The ticket price has not yet been confirmed.
            </p>
          )}
        </TermSection>

        <TermSection
          number="3"
          title="Ticket Sales Period"
        >
          <p>
            Ticket sales are scheduled to open:
          </p>

          <StrongValue>
            {formatDateTime(
              lottery.sales_open_at,
            )}
          </StrongValue>

          <p>
            Ticket sales are scheduled to close:
          </p>

          <StrongValue>
            {formatDateTime(
              lottery.sales_close_at,
            )}
          </StrongValue>

          <p>
            Burton Pride may suspend or close ticket sales
            where permitted under the General Lottery Terms
            and applicable requirements.
          </p>
        </TermSection>

        <TermSection
          number="4"
          title="Draw Date"
        >
          <p>
            The draw is currently scheduled for:
          </p>

          <StrongValue>
            {formatDateTime(
              lottery.draw_at,
            )}
          </StrongValue>

          <p>
            If the draw date needs to change, Burton Pride
            will update the public lottery page and provide
            appropriate information where required.
          </p>
        </TermSection>

        <TermSection
          number="5"
          title="Minimum Age"
        >
          <p>
            Participants must be at least{" "}
            <strong>
              {minimumAge}
            </strong>{" "}
            years old, or meet any higher age requirement
            stated within the applicable legal or
            regulatory requirements.
          </p>

          <p>
            Participants are required to confirm that they
            meet the minimum age requirement before
            continuing to payment.
          </p>
        </TermSection>

        <TermSection
          number="6"
          title="Geographical Eligibility"
        >
          <p>
            The geographical eligibility for this lottery
            is:
          </p>

          <StrongValue>
            {lottery.geographic_eligibility ||
              "As set out within the General Lottery Terms."}
          </StrongValue>

          <p>
            A participant must meet the stated eligibility
            requirements at the time they purchase a
            ticket.
          </p>
        </TermSection>

        <TermSection
          number="7"
          title="Ticket Availability"
        >
          {typeof lottery.max_tickets ===
          "number" ? (
            <p>
              A maximum of{" "}
              <strong>
                {lottery.max_tickets.toLocaleString(
                  "en-GB",
                )}
              </strong>{" "}
              tickets may be issued for this lottery.
            </p>
          ) : (
            <p>
              No public maximum ticket quantity is
              currently specified for this lottery.
            </p>
          )}

          <p>
            A ticket is not treated as valid merely because
            a checkout session has been started. Payment
            must be successfully confirmed before a valid
            ticket can be issued.
          </p>
        </TermSection>

        <TermSection
          number="8"
          title="Payment and Ticket Issue"
        >
          <p>
            Tickets purchased online must be paid for using
            the payment method provided through the Burton
            Pride lottery checkout.
          </p>

          <p>
            Payment confirmation is processed securely.
            Tickets are only issued after the system has
            received confirmation that payment was
            successful.
          </p>

          <p>
            Each successfully issued ticket will receive a
            unique ticket number.
          </p>
        </TermSection>

        <TermSection
          number="9"
          title="Prizes"
        >
          <p>
            Prize information is shown on the main public
            page for this lottery.
          </p>

          <Link
            href={`/Lottery/${encodeURIComponent(
              lottery.slug,
            )}`}
            className="
              inline-flex
              items-center
              gap-2
              font-black
              text-purple-700
              underline
              underline-offset-4

              dark:text-purple-300
            "
          >
            <Trophy className="h-4 w-4" />

            View {lottery.title} prizes
          </Link>

          <p>
            Where necessary, Burton Pride may make changes
            to a prize where permitted by the General
            Lottery Terms and will provide appropriate
            information about any material change.
          </p>
        </TermSection>

        <TermSection
          number="10"
          title="Fundraising Purpose"
        >
          {lottery.fundraising_purpose ? (
            <p>
              {lottery.fundraising_purpose}
            </p>
          ) : (
            <p>
              Money raised through this lottery supports
              Burton Pride&apos;s charitable and community
              fundraising work.
            </p>
          )}
        </TermSection>

        <TermSection
          number="11"
          title="Responsible Participation"
        >
          <p>
            {lottery.responsible_gambling_info ||
              "Please only spend what you can afford. Participation is optional and supports Burton Pride fundraising."}
          </p>
        </TermSection>

        <TermSection
          number="12"
          title="Acceptance of Terms"
        >
          <p>
            Before completing a ticket purchase,
            participants must confirm that they have read
            and accepted:
          </p>

          <ul
            className="
              list-disc
              space-y-2
              pl-5
            "
          >
            <li>
              Burton Pride&apos;s General Lottery Terms;
            </li>

            <li>
              these individual terms for{" "}
              {lottery.title};
            </li>

            <li>
              the applicable privacy information; and
            </li>

            <li>
              the eligibility and age declarations shown
              during checkout.
            </li>
          </ul>

          {lottery.terms_version && (
            <p>
              Individual terms version:{" "}
              <strong>
                {lottery.terms_version}
              </strong>
              .
            </p>
          )}

          {lottery.privacy_notice_version && (
            <p>
              Privacy notice version:{" "}
              <strong>
                {lottery.privacy_notice_version}
              </strong>
              .
            </p>
          )}
        </TermSection>

        <TermSection
          number="13"
          title="General Lottery Terms"
        >
          <p>
            These individual terms should always be read
            together with Burton Pride&apos;s General
            Lottery Terms.
          </p>

          <p>
            If a matter is not specifically covered by
            these individual terms, the General Lottery
            Terms continue to apply.
          </p>

          <Link
            href="/Lottery/Terms"
            className="
              inline-flex
              min-h-11
              items-center
              justify-center
              gap-2
              rounded-full
              bg-purple-700
              px-5
              py-2.5
              text-sm
              font-black
              text-white
              transition

              hover:bg-purple-800

              dark:bg-purple-400
              dark:text-purple-950
            "
          >
            <ShieldCheck className="h-4 w-4" />

            Read General Lottery Terms
          </Link>
        </TermSection>
      </div>

      {/* =====================================================
          CURRENT STATUS
          ===================================================== */}
      <section
        className="
          mt-8
          rounded-[2rem]
          border
          border-slate-200
          bg-white
          p-6
          shadow-lg

          dark:border-white/10
          dark:bg-[#111827]

          sm:p-8
        "
      >
        <p
          className="
            text-xs
            font-black
            uppercase
            tracking-[0.16em]
            text-slate-500

            dark:text-white/40
          "
        >
          Current lottery status
        </p>

        <div
          className="
            mt-3
            flex
            flex-wrap
            items-center
            gap-3
          "
        >
          <span
            className="
              rounded-full
              bg-yellow-300
              px-4
              py-2
              text-sm
              font-black
              text-purple-950
            "
          >
            {formatStatus(
              lottery.status,
            )}
          </span>

          {!publicVisible && (
            <span
              className="
                rounded-full
                bg-red-100
                px-4
                py-2
                text-sm
                font-black
                text-red-800

                dark:bg-red-500/15
                dark:text-red-200
              "
            >
              Not currently listed in public directory
            </span>
          )}
        </div>
      </section>

      {/* =====================================================
          FOOTER ACTIONS
          ===================================================== */}
      <div
        className="
          mt-8
          flex
          flex-col
          gap-3

          sm:flex-row
        "
      >
        <Link
          href={`/Lottery/${encodeURIComponent(
            lottery.slug,
          )}`}
          className="
            inline-flex
            min-h-12
            items-center
            justify-center
            gap-2
            rounded-full
            bg-yellow-300
            px-6
            py-3
            text-sm
            font-black
            text-purple-950
            transition

            hover:bg-yellow-200
          "
        >
          <ArrowLeft className="h-4 w-4" />

          Back to {lottery.title}
        </Link>

        <Link
          href="/Lottery/tTerms"
          className="
            inline-flex
            min-h-12
            items-center
            justify-center
            gap-2
            rounded-full
            border
            border-slate-200
            bg-white
            px-6
            py-3
            text-sm
            font-black
            text-slate-900
            transition

            hover:border-purple-300
            hover:text-purple-800

            dark:border-white/15
            dark:bg-white/[0.06]
            dark:text-white
          "
        >
          <ShieldCheck className="h-4 w-4" />

          General Lottery Terms
        </Link>
      </div>
    </main>
  );
}

/*
 * =========================================================
 * TERMS DETAIL CARD
 * =========================================================
 */
function TermsDetail({
  icon,
  label,
  value,
}: {
  icon:
    React.ReactNode;

  label: string;

  value: string;
}) {
  return (
    <div
      className="
        rounded-2xl
        border
        border-slate-200
        bg-slate-50
        p-5

        dark:border-white/10
        dark:bg-white/[0.04]
      "
    >
      <div
        className="
          flex
          h-10
          w-10
          items-center
          justify-center
          rounded-xl
          bg-purple-100
          text-purple-700

          dark:bg-purple-500/15
          dark:text-purple-300

          [&>svg]:h-5
          [&>svg]:w-5
        "
      >
        {icon}
      </div>

      <p
        className="
          mt-4
          text-xs
          font-black
          uppercase
          tracking-wide
          text-slate-500

          dark:text-white/40
        "
      >
        {label}
      </p>

      <p
        className="
          mt-1
          font-black
          leading-6
          text-slate-950

          dark:text-white
        "
      >
        {value}
      </p>
    </div>
  );
}

/*
 * =========================================================
 * TERMS SECTION
 * =========================================================
 */
function TermSection({
  number,
  title,
  children,
}: {
  number: string;

  title: string;

  children:
    React.ReactNode;
}) {
  return (
    <section
      className="
        rounded-[2rem]
        border
        border-slate-200
        bg-white
        p-6
        shadow-md

        dark:border-white/10
        dark:bg-[#111827]

        sm:p-8
      "
    >
      <div
        className="
          flex
          items-start
          gap-4
        "
      >
        <div
          className="
            flex
            h-10
            w-10
            shrink-0
            items-center
            justify-center
            rounded-xl
            bg-purple-100
            text-sm
            font-black
            text-purple-800

            dark:bg-purple-500/15
            dark:text-purple-200
          "
        >
          {number}
        </div>

        <div
          className="
            min-w-0
            flex-1
          "
        >
          <h2
            className="
              text-xl
              font-black
              text-slate-950

              dark:text-white
            "
          >
            {title}
          </h2>

          <div
            className="
              mt-4
              space-y-4
              leading-7
              text-slate-700

              dark:text-white/70
            "
          >
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

/*
 * =========================================================
 * STRONG VALUE
 * =========================================================
 */
function StrongValue({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <div
      className="
        rounded-2xl
        border
        border-purple-200
        bg-purple-50
        px-4
        py-3
        font-black
        text-purple-900

        dark:border-purple-300/20
        dark:bg-purple-500/10
        dark:text-purple-100
      "
    >
      {children}
    </div>
  );
}