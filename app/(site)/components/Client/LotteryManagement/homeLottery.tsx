"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Gift,
  Heart,
  Loader2,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trophy,
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

type PublicLottery = {
  id: string;
  title: string;
  slug: string;
  short_summary: string | null;
  hero_image_url: string | null;
  status: LotteryStatus;
  ticket_price_pence: number | null;
  currency: string | null;
  sales_open_at: string | null;
  sales_close_at: string | null;
  draw_at: string | null;
  show_in_public_directory: boolean | null;
  is_featured?: boolean | null;
};

function getStatusLabel(status: LotteryStatus) {
  switch (status) {
    case "scheduled":
      return "Coming soon";
    case "live":
      return "Tickets available";
    case "paused":
      return "Sales paused";
    case "sales_closed":
      return "Sales closed";
    case "draw_ready":
      return "Draw pending";
    case "completed":
      return "Draw complete";
    case "cancelled":
      return "Cancelled";
    case "under_review":
      return "Under review";
    case "archived":
      return "Archived";
    default:
      return "Lottery";
  }
}

function getStatusClasses(status: LotteryStatus) {
  switch (status) {
    case "live":
      return "border-green-600/25 bg-green-100 text-green-800 dark:border-green-300/40 dark:bg-green-400/15 dark:text-green-200";

    case "scheduled":
      return "border-amber-600/25 bg-amber-100 text-amber-900 dark:border-yellow-300/40 dark:bg-yellow-300/15 dark:text-yellow-200";

    case "paused":
    case "under_review":
      return "border-orange-600/25 bg-orange-100 text-orange-900 dark:border-orange-300/40 dark:bg-orange-400/15 dark:text-orange-200";

    case "sales_closed":
    case "draw_ready":
      return "border-blue-600/25 bg-blue-100 text-blue-900 dark:border-blue-300/40 dark:bg-blue-500/15 dark:text-blue-200";

    case "completed":
      return "border-purple-600/25 bg-purple-100 text-purple-900 dark:border-purple-300/40 dark:bg-purple-500/15 dark:text-purple-200";

    case "cancelled":
      return "border-red-600/25 bg-red-100 text-red-900 dark:border-red-300/40 dark:bg-red-500/15 dark:text-red-200";

    default:
      return "border-slate-300 bg-slate-100 text-slate-700 dark:border-white/20 dark:bg-white/10 dark:text-white";
  }
}

function getButtonText(status: LotteryStatus) {
  switch (status) {
    case "live":
      return "Enter lottery";
    case "scheduled":
      return "View lottery";
    case "paused":
      return "View details";
    case "sales_closed":
    case "draw_ready":
      return "View draw details";
    case "completed":
      return "View results";
    case "cancelled":
      return "View update";
    default:
      return "View lottery";
  }
}

function formatMoney(
  pence: number | null,
  currency = "GBP",
) {
  if (
    typeof pence !== "number" ||
    !Number.isFinite(pence)
  ) {
    return null;
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency || "GBP",
  }).format(pence / 100);
}

function formatDate(dateValue: string | null) {
  if (!dateValue) {
    return null;
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  });
}

export default function LotteryHomePage() {
  const [lotteries, setLotteries] =
    useState<PublicLottery[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLotteries() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          "/api/lottery",
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const json = await response
          .json()
          .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            json?.error ||
              "Failed to load lotteries.",
          );
        }

        if (!cancelled) {
          setLotteries(
            Array.isArray(json?.lotteries)
              ? json.lotteries
              : [],
          );
        }
      } catch (error) {
        if (!cancelled) {
          setError(
            error instanceof Error
              ? error.message
              : "Failed to load lotteries.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadLotteries();

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleLotteries = useMemo(() => {
    return lotteries
      .filter(
        (lottery) =>
          lottery.show_in_public_directory !== false,
      )
      .filter(
        (lottery) =>
          lottery.status !== "draft" &&
          lottery.status !==
            "compliance_review",
      )
      .sort((a, b) => {
        if (
          a.is_featured &&
          !b.is_featured
        ) {
          return -1;
        }

        if (
          !a.is_featured &&
          b.is_featured
        ) {
          return 1;
        }

        const aDate =
          new Date(
            a.draw_at ||
              a.sales_close_at ||
              a.sales_open_at ||
              0,
          ).getTime();

        const bDate =
          new Date(
            b.draw_at ||
              b.sales_close_at ||
              b.sales_open_at ||
              0,
          ).getTime();

        return aDate - bDate;
      });
  }, [lotteries]);

  return (
    <main
      className="
        min-h-screen
        overflow-hidden
        text-slate-950
        dark:text-white
      "
    >
      {/* HERO */}
      <section
        className="
          relative
          overflow-hidden
          border-b
          border-black/10
          dark:border-white/10
        "
      >
        <div
          className="
            relative
            mx-auto
            flex
            w-full
            max-w-7xl
            flex-col
            items-center
            px-4
            py-16
            text-center
            sm:px-6
            sm:py-20
            lg:px-8
            lg:py-24
          "
        >
          <div
            className="
              inline-flex
              items-center
              gap-2
              rounded-full
              border
              border-amber-500/30
              bg-white
              px-4
              py-2
              text-sm
              font-black
              text-amber-900
              shadow-lg
              dark:border-yellow-300/30
              dark:bg-yellow-300/10
              dark:text-yellow-200
            "
          >
            <Sparkles className="h-4 w-4" />
            Burton Pride Fundraising
          </div>

          <h1
            className="
              mt-7
              max-w-5xl
              text-balance
              text-4xl
              font-black
              leading-tight
              text-slate-950
              sm:text-5xl
              lg:text-7xl
              dark:text-white
            "
          >
            Burton Pride

            <span
              className="
                mt-1
                block
                bg-gradient-to-r
                from-pink-700
                via-fuchsia-700
                to-blue-700
                bg-clip-text
                text-transparent
                dark:from-pink-300
                dark:via-purple-300
                dark:to-blue-300
              "
            >
              Lotteries &amp; Raffles
            </span>
          </h1>

          <p
            className="
              mt-6
              max-w-3xl
              text-base
              font-semibold
              leading-8
              text-slate-800
              sm:text-lg
              lg:text-xl
              dark:text-white/75
            "
          >
            Take part in Burton Pride fundraising
            lotteries and raffles while helping us
            continue supporting our community, events
            and future projects.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#lotteries"
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
                shadow-xl
                transition
                hover:scale-[1.03]
                hover:bg-yellow-200
                dark:hover:bg-white
              "
            >
              <Ticket className="h-4 w-4" />
              View lotteries
            </a>

            <a
              href="#how-it-helps"
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
                shadow-lg
                transition
                hover:border-purple-300
                hover:text-purple-800
                dark:border-white/15
                dark:bg-white/10
                dark:text-white
                dark:hover:bg-white
                dark:hover:text-purple-700
              "
            >
              <Heart className="h-4 w-4" />
              How it helps
            </a>

            <Link
              href="/Lottery/Terms"
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
                shadow-lg
                transition
                hover:border-purple-300
                hover:text-purple-800
                dark:border-white/15
                dark:bg-white/10
                dark:text-white
                dark:hover:bg-white
                dark:hover:text-purple-700
              "
            >
              <ShieldCheck className="h-4 w-4" />
              Lottery Terms
            </Link>
          </div>
        </div>
      </section>

      {/* INTRO */}
      <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          <InfoCard
            icon={<Heart className="h-6 w-6" />}
            title="Support our work"
            text="Money raised helps Burton Pride continue delivering community projects, activities and events."
          />

          <InfoCard
            icon={<Gift className="h-6 w-6" />}
            title="Win prizes"
            text="Each lottery has its own prizes, ticket information, closing date and draw details."
          />

          <InfoCard
            icon={<ShieldCheck className="h-6 w-6" />}
            title="Clear & responsible"
            text="Each lottery page clearly explains eligibility, ticket pricing, draw information and important terms."
          />
        </div>
      </section>

      {/* LOTTERY REGISTRATION */}
      <section className="mx-auto w-full max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
        <div
          className="
            rounded-[2rem]
            border
            border-purple-200
            bg-purple-50
            p-6
            shadow-[0_16px_40px_rgba(15,23,42,0.10)]
            sm:p-8
            dark:border-purple-300/20
            dark:bg-purple-500/10
            dark:shadow-xl
          "
        >
          <div className="flex items-start gap-4">
            <div
              className="
                flex
                h-12
                w-12
                shrink-0
                items-center
                justify-center
                rounded-2xl
                bg-purple-700
                text-white
                dark:bg-purple-400/20
                dark:text-purple-200
              "
            >
              <ShieldCheck className="h-6 w-6" />
            </div>

            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-purple-700 dark:text-purple-300">
                Lottery registration
              </p>

              <h2 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl dark:text-white">
                Burton Pride lottery number: SL0507
              </h2>

              <p className="mt-3 max-w-3xl font-semibold leading-7 text-slate-700 dark:text-white/70">
                This lottery number was issued by East Staffordshire Borough Council.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* LIVE LOTTERY DIRECTORY */}
      <section
        id="lotteries"
        className="
          mx-auto
          w-full
          max-w-7xl
          scroll-mt-8
          px-4
          py-10
          sm:px-6
          sm:py-14
          lg:px-8
        "
      >
        <div
          className="
            rounded-[2rem]
            border
            border-slate-200
            bg-white
            p-5
            shadow-[0_18px_50px_rgba(15,23,42,0.12)]
            sm:p-7
            dark:border-white/10
            dark:bg-white/[0.04]
            dark:shadow-none
          "
        >
          <div
            className="
              flex
              flex-col
              gap-4
              md:flex-row
              md:items-end
              md:justify-between
            "
          >
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-amber-800 dark:text-yellow-300">
                Fundraising
              </p>

              <h2 className="mt-2 text-3xl font-black text-slate-950 sm:text-4xl dark:text-white">
                Our Lotteries
              </h2>

              <p className="mt-3 max-w-2xl font-semibold leading-7 text-slate-700 dark:text-white/65">
                This list is updated automatically from
                the Burton Pride Lottery Management
                System.
              </p>
            </div>

            {!loading && !error && (
              <div
                className="
                  w-fit
                  rounded-2xl
                  border
                  border-slate-200
                  bg-slate-50
                  px-4
                  py-3
                  text-sm
                  font-bold
                  text-slate-700
                  dark:border-white/10
                  dark:bg-white/[0.05]
                  dark:text-white/60
                "
              >
                {visibleLotteries.length}{" "}
                {visibleLotteries.length === 1
                  ? "lottery"
                  : "lotteries"}{" "}
                listed
              </div>
            )}
          </div>

          {loading && (
            <div
              className="
                mt-8
                flex
                min-h-56
                items-center
                justify-center
                rounded-3xl
                border
                border-slate-200
                bg-slate-50
                text-center
                dark:border-white/10
                dark:bg-white/[0.04]
              "
            >
              <div>
                <Loader2 className="mx-auto h-9 w-9 animate-spin text-purple-700 dark:text-purple-300" />

                <p className="mt-4 font-black text-slate-900 dark:text-white">
                  Loading lotteries...
                </p>
              </div>
            </div>
          )}

          {!loading && error && (
            <div
              role="alert"
              className="
                mt-8
                rounded-3xl
                border
                border-red-300
                bg-red-50
                p-6
                text-red-900
                dark:border-red-400/30
                dark:bg-red-500/10
                dark:text-red-100
              "
            >
              <p className="font-black">
                We couldn&apos;t load the lottery list
              </p>

              <p className="mt-2 text-sm">
                {error}
              </p>
            </div>
          )}

          {!loading &&
            !error &&
            visibleLotteries.length > 0 && (
              <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {visibleLotteries.map(
                  (lottery) => (
                    <LotteryCardComponent
                      key={lottery.id}
                      lottery={lottery}
                    />
                  ),
                )}
              </div>
            )}

          {!loading &&
            !error &&
            visibleLotteries.length === 0 && (
              <div
                className="
                  mt-8
                  rounded-3xl
                  border
                  border-slate-200
                  bg-slate-50
                  px-6
                  py-14
                  text-center
                  dark:border-white/10
                  dark:bg-white/[0.04]
                "
              >
                <Trophy className="mx-auto h-10 w-10 text-purple-700 dark:text-yellow-300" />

                <h3 className="mt-4 text-2xl font-black text-slate-950 dark:text-white">
                  No public lotteries right now
                </h3>

                <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-600 dark:text-white/60">
                  There are currently no lotteries
                  published in the public directory.
                  Please check back soon.
                </p>
              </div>
            )}
        </div>
      </section>

      {/* HOW IT HELPS */}
      <section
        id="how-it-helps"
        className="
          mx-auto
          w-full
          max-w-7xl
          scroll-mt-8
          px-4
          py-16
          sm:px-6
          lg:px-8
        "
      >
        <div
          className="
            rounded-[2rem]
            border
            border-slate-200
            bg-white
            p-6
            shadow-[0_20px_60px_rgba(15,23,42,0.14)]
            sm:p-10
            lg:p-14
            dark:border-white/10
            dark:bg-white/[0.06]
            dark:shadow-2xl
          "
        >
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <div
                className="
                  flex
                  h-12
                  w-12
                  items-center
                  justify-center
                  rounded-2xl
                  bg-pink-100
                  text-pink-700
                  dark:bg-pink-500/20
                  dark:text-pink-200
                "
              >
                <Heart className="h-6 w-6" />
              </div>

              <h2 className="mt-5 text-3xl font-black text-slate-950 sm:text-4xl dark:text-white">
                Your support helps our community
              </h2>

              <p className="mt-4 max-w-3xl text-base font-semibold leading-8 text-slate-700 sm:text-lg dark:text-white/70">
                Burton Pride fundraising helps support
                our work throughout the year, including
                community activities, events and
                projects that bring people together.
              </p>

              <p className="mt-4 max-w-3xl font-medium leading-7 text-slate-600 dark:text-white/60">
                Each individual lottery page explains
                the specific fundraising purpose for
                that campaign.
              </p>
            </div>

            <div className="grid gap-3">
              <SupportItem>
                Community activities
              </SupportItem>

              <SupportItem>
                Burton Pride events
              </SupportItem>

              <SupportItem>
                Future community projects
              </SupportItem>

              <SupportItem>
                Supporting Burton Pride&apos;s work
              </SupportItem>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function LotteryCardComponent({
  lottery,
}: {
  lottery: PublicLottery;
}) {
  const ticketPrice =
    formatMoney(
      lottery.ticket_price_pence,
      lottery.currency || "GBP",
    );

  const drawDate =
    formatDate(lottery.draw_at);

  return (
    <article
      className={`
        group
        relative
        flex
        h-full
        flex-col
        overflow-hidden
        rounded-[2rem]
        border
        bg-white
        shadow-[0_20px_60px_rgba(15,23,42,0.16)]
        transition
        duration-300
        hover:-translate-y-1
        hover:border-purple-400/50
        hover:shadow-[0_30px_80px_rgba(91,33,182,0.22)]
        dark:bg-[#111827]/95
        dark:shadow-2xl

        ${
          lottery.is_featured
            ? "border-amber-400 dark:border-yellow-300/30"
            : "border-slate-200 dark:border-white/10"
        }
      `}
    >
      {lottery.is_featured && (
        <div
          className="
            flex
            items-center
            justify-center
            gap-2
            bg-yellow-300
            px-4
            py-2.5
            text-xs
            font-black
            uppercase
            tracking-[0.15em]
            text-purple-950
          "
        >
          <Sparkles className="h-4 w-4" />
          Featured Lottery
        </div>
      )}

      <div
        aria-hidden="true"
        className="
          h-1.5
          w-full
          bg-gradient-to-r
          from-pink-500
          via-purple-500
          to-blue-500
        "
      />

      {lottery.hero_image_url ? (
        <div className="relative h-56 overflow-hidden">
          <img
            src={lottery.hero_image_url}
            alt={`${lottery.title} lottery`}
            className="
              h-full
              w-full
              object-cover
              transition
              duration-500
              group-hover:scale-105
            "
          />

          <div
            className="
              absolute
              inset-0
              bg-gradient-to-t
              from-black/65
              via-transparent
              to-transparent
            "
          />
        </div>
      ) : (
        <div
          className="
            relative
            flex
            h-56
            items-center
            justify-center
            overflow-hidden
            bg-gradient-to-br
            from-pink-500
            via-purple-600
            to-blue-600
          "
        >
          <div className="relative text-center">
            <Trophy className="mx-auto h-12 w-12 text-yellow-300" />

            <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-white">
              Burton Pride Lottery
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`
              inline-flex
              rounded-full
              border
              px-3
              py-1.5
              text-xs
              font-black
              uppercase
              tracking-wide
              ${getStatusClasses(
                lottery.status,
              )}
            `}
          >
            {getStatusLabel(
              lottery.status,
            )}
          </span>

          {ticketPrice && (
            <span
              className="
                rounded-full
                border
                border-slate-200
                bg-slate-100
                px-3
                py-1.5
                text-xs
                font-black
                text-slate-700
                dark:border-white/10
                dark:bg-white/[0.06]
                dark:text-white/80
              "
            >
              {ticketPrice} per ticket
            </span>
          )}
        </div>

        <h3 className="mt-5 text-2xl font-black leading-tight text-slate-950 dark:text-white">
          {lottery.title}
        </h3>

        {lottery.short_summary && (
          <p className="mt-3 flex-1 text-sm font-semibold leading-6 text-slate-600 sm:text-base dark:text-white/65">
            {lottery.short_summary}
          </p>
        )}

        {drawDate && (
          <div
            className="
              mt-5
              flex
              items-start
              gap-3
              rounded-2xl
              border
              border-slate-200
              bg-slate-50
              p-4
              dark:border-white/10
              dark:bg-white/[0.05]
            "
          >
            <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-pink-600 dark:text-pink-300" />

            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-white/40">
                Draw
              </p>

              <p className="mt-1 font-black text-slate-900 dark:text-white">
                {drawDate}
              </p>
            </div>
          </div>
        )}

        <Link
          href={`/Lottery/${lottery.slug}`}
          className="
            mt-6
            inline-flex
            min-h-12
            w-full
            items-center
            justify-center
            gap-2
            rounded-full
            bg-yellow-300
            px-5
            py-3
            text-sm
            font-black
            text-purple-950
            shadow-lg
            transition
            hover:scale-[1.02]
            hover:bg-yellow-200
            dark:hover:bg-white
          "
        >
          {getButtonText(
            lottery.status,
          )}

          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}

function InfoCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div
      className="
        rounded-[1.75rem]
        border
        border-slate-200
        bg-white
        p-6
        shadow-[0_16px_40px_rgba(15,23,42,0.12)]
        dark:border-white/10
        dark:bg-white/[0.06]
        dark:shadow-xl
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
          bg-purple-100
          text-purple-700
          dark:bg-purple-500/15
          dark:text-purple-200
        "
      >
        {icon}
      </div>

      <h3 className="mt-4 text-lg font-black text-slate-950 dark:text-white">
        {title}
      </h3>

      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 dark:text-white/60">
        {text}
      </p>
    </div>
  );
}

function SupportItem({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="
        flex
        items-center
        gap-3
        rounded-2xl
        border
        border-slate-200
        bg-slate-50
        px-4
        py-4
        shadow-sm
        dark:border-white/10
        dark:bg-black/20
      "
    >
      <div
        className="
          flex
          h-9
          w-9
          shrink-0
          items-center
          justify-center
          rounded-full
          bg-yellow-300
          text-purple-950
        "
      >
        <Heart className="h-4 w-4" />
      </div>

      <span className="font-black text-slate-900 dark:text-white">
        {children}
      </span>
    </div>
  );
}
