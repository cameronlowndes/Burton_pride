"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Gift,
  Heart,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Ticket,
  Trophy,
  UserRound,
} from "lucide-react";

type Prize = {
  id: string;
  name: string;
  description:
    | string
    | null;

  image_url:
    | string
    | null;

  declared_value:
    | number
    | null;

  quantity: number;

  sponsor_name:
    | string
    | null;
};

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

  status: string;

  ticket_price_pence:
    number;

  currency: string;

  minimum_age:
    number;

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

  responsible_gambling_info:
    | string
    | null;

  terms_version:
    | string
    | null;

  privacy_notice_version:
    | string
    | null;

  show_ticket_count:
    boolean;

  show_remaining_tickets:
    boolean;

  show_amount_raised:
    boolean;

  show_prize_values:
    boolean;

  countdown_enabled:
    boolean;

  tickets_issued:
    number;

  remaining_tickets:
    | number
    | null;

  amount_raised_pence:
    number;

  can_purchase:
    boolean;

  sales_message:
    string;

  prizes: Prize[];
};

type ApiResponse = {
  ok: boolean;

  lottery?: Lottery;

  error?: string;

  code?: string;
};

type FormState = {
  fullName: string;

  email: string;

  phone: string;

  quantity: number;

  ageConfirmed:
    boolean;

  eligibilityConfirmed:
    boolean;

  termsAccepted:
    boolean;

  marketingOptIn:
    boolean;
};

export default function LotterySlugClient({
  slug,
}: {
  slug: string;
}) {
  const [
    lottery,
    setLottery,
  ] =
    useState<Lottery | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    formError,
    setFormError,
  ] =
    useState<
      string | null
    >(null);

  const [
    form,
    setForm,
  ] =
    useState<FormState>({
      fullName: "",

      email: "",

      phone: "",

      quantity: 1,

      ageConfirmed:
        false,

      eligibilityConfirmed:
        false,

      termsAccepted:
        false,

      marketingOptIn:
        false,
    });

  useEffect(() => {
    let cancelled =
      false;

    async function load() {
      try {
        setLoading(
          true,
        );

        setError(null);

        const response =
          await fetch(
            `/api/lottery/${encodeURIComponent(slug)}`,
            {
              cache:
                "no-store",
            },
          );

        const data: ApiResponse =
          await response.json();

        if (
          !response.ok ||
          !data.ok ||
          !data.lottery
        ) {
          throw new Error(
            data.error ||
              "Unable to load this lottery.",
          );
        }

        if (!cancelled) {
          setLottery(
            data.lottery,
          );
        }
      } catch (
        error
      ) {
        if (!cancelled) {
          setError(
            error instanceof
              Error
              ? error.message
              : "Unable to load this lottery.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(
            false,
          );
        }
      }
    }

    load();

    return () => {
      cancelled =
        true;
    };
  }, [slug]);

  const totalPrice =
    useMemo(() => {
      if (!lottery) {
        return 0;
      }

      return (
        lottery.ticket_price_pence *
        Math.max(
          1,
          form.quantity,
        )
      );
    }, [
      lottery,
      form.quantity,
    ]);

  function updateForm<
    K extends keyof FormState,
  >(
    key: K,
    value: FormState[K],
  ) {
    setForm(
      (
        current,
      ) => ({
        ...current,

        [key]:
          value,
      }),
    );
  }

  async function submitEntry(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    if (
      !lottery
    ) {
      return;
    }

    setFormError(
      null,
    );

    if (
      !lottery.can_purchase
    ) {
      setFormError(
        lottery.sales_message,
      );

      return;
    }

    if (
      !form.fullName.trim()
    ) {
      setFormError(
        "Please enter your full name.",
      );

      return;
    }

    if (
      !form.email.trim()
    ) {
      setFormError(
        "Please enter your email address.",
      );

      return;
    }

    if (
      form.quantity <
      1
    ) {
      setFormError(
        "Please select at least one ticket.",
      );

      return;
    }

    if (
      !form.ageConfirmed
    ) {
      setFormError(
        `You must confirm that you are at least ${lottery.minimum_age} years old.`,
      );

      return;
    }

    if (
      !form.eligibilityConfirmed
    ) {
      setFormError(
        "Please confirm that you meet the eligibility requirements.",
      );

      return;
    }

    if (
      !form.termsAccepted
    ) {
      setFormError(
        "You must accept the lottery terms before continuing.",
      );

      return;
    }

    try {
      setSubmitting(
        true,
      );

      const response =
        await fetch(
          `/api/lottery/${encodeURIComponent(slug)}/checkout`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  full_name:
                    form.fullName,

                  email:
                    form.email,

                  phone:
                    form.phone,

                  quantity:
                    form.quantity,

                  age_confirmed:
                    form.ageConfirmed,

                  eligibility_confirmed:
                    form.eligibilityConfirmed,

                  terms_accepted:
                    form.termsAccepted,

                  marketing_opt_in:
                    form.marketingOptIn,

                  acceptances: {
                    age_confirmation: {
                      accepted:
                        form.ageConfirmed,

                      version: `${lottery.minimum_age}+`,
                    },

                    eligibility_confirmation: {
                      accepted:
                        form.eligibilityConfirmed,

                      version:
                        lottery.geographic_eligibility,
                    },

                    terms_acceptance: {
                      accepted:
                        form.termsAccepted,

                      version:
                        lottery.terms_version,
                    },

                    marketing_opt_in: {
                      accepted:
                        form.marketingOptIn,

                      version:
                        lottery.privacy_notice_version,
                    },
                  },
                },
              ),
          },
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.ok
      ) {
        throw new Error(
          data.error ||
            "Unable to start payment.",
        );
      }

      if (
        !data.checkout_url
      ) {
        throw new Error(
          "The payment service did not return a checkout page.",
        );
      }

      window.location.href =
        data.checkout_url;
    } catch (
      error
    ) {
      setFormError(
        error instanceof
          Error
          ? error.message
          : "Unable to start payment.",
      );
    } finally {
      setSubmitting(
        false,
      );
    }
  }

  if (loading) {
    return (
      <main
        className="
          mx-auto
          flex
          min-h-[60vh]
          w-full
          max-w-7xl
          items-center
          justify-center
          px-4
          py-16

          sm:px-6
          lg:px-8
        "
      >
        <div className="text-center">
          <Loader2
            className="
              mx-auto
              h-10
              w-10
              animate-spin
              text-purple-600

              dark:text-purple-300
            "
          />

          <p
            className="
              mt-4
              font-bold
              text-slate-700

              dark:text-white/70
            "
          >
            Loading lottery...
          </p>
        </div>
      </main>
    );
  }

  if (
    error ||
    !lottery
  ) {
    return (
      <main
        className="
          mx-auto
          w-full
          max-w-4xl
          px-4
          py-20

          sm:px-6
        "
      >
        <div
          className="
            rounded-[2rem]
            border
            border-red-200
            bg-red-50
            p-8
            text-center

            dark:border-red-400/20
            dark:bg-red-500/10
          "
        >
          <AlertCircle
            className="
              mx-auto
              h-10
              w-10
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
            Lottery unavailable
          </h1>

          <p
            className="
              mt-3
              text-slate-600

              dark:text-white/60
            "
          >
            {error ||
              "This lottery could not be found."}
          </p>

          <Link
            href="/Lottery"
            className="
              mt-6
              inline-flex
              min-h-12
              items-center
              justify-center
              rounded-full
              bg-yellow-300
              px-6
              py-3
              font-black
              text-purple-950
            "
          >
            Back to lotteries
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      className="
        mx-auto
        w-full
        max-w-7xl
        px-4
        pb-10
        pt-24

        sm:px-6
        sm:pb-14
        sm:pt-28

        lg:px-8
        lg:pt-32
      "
    >
      {/* =====================================================
          PAGE ACTIONS
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
          href="/Lottery"
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
            dark:hover:bg-white/10
          "
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
          Back to lotteries
        </Link>

        <Link
          href="/Lottery/Terms"
          target="_blank"
          rel="noopener noreferrer"
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
            dark:hover:bg-purple-500/20
          "
        >
          <ShieldCheck className="h-4 w-4" />
          General Lottery Terms
        </Link>

        <Link
          href={`/Lottery/${encodeURIComponent(lottery.slug)}/Terms`}
          target="_blank"
          rel="noopener noreferrer"
          className="
            inline-flex
            min-h-11
            items-center
            justify-center
            gap-2
            rounded-full
            border
            border-amber-300
            bg-amber-50
            px-5
            py-2.5
            text-sm
            font-black
            text-amber-900
            shadow-sm
            transition

            hover:bg-amber-100

            dark:border-yellow-300/25
            dark:bg-yellow-300/10
            dark:text-yellow-200
            dark:hover:bg-yellow-300/15
          "
        >
          <Ticket className="h-4 w-4" />
          Terms for this lottery
        </Link>
      </div>

      {/* HERO */}
      <section
        className="
          relative
          overflow-hidden
          rounded-[2.25rem]
          border
          border-slate-200
          bg-white/80
          shadow-xl

          dark:border-white/10
          dark:bg-[#111827]/90
        "
      >
        {lottery.hero_image_url ? (
          <div className="relative h-64 sm:h-80 lg:h-[28rem]">
            <img
              src={
                lottery.hero_image_url
              }
              alt=""
              className="h-full w-full object-cover"
            />

            <div
              className="
                absolute
                inset-0
                bg-gradient-to-t
                from-black/85
                via-black/30
                to-transparent
              "
            />

            <div
              className="
                absolute
                inset-x-0
                bottom-0
                p-6

                sm:p-10
              "
            >
              <LotteryHeading
                lottery={
                  lottery
                }
                overImage
              />

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/Lottery/Terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="
                    inline-flex
                    min-h-10
                    items-center
                    justify-center
                    gap-2
                    rounded-full
                    border
                    border-white/25
                    bg-black/30
                    px-4
                    py-2
                    text-xs
                    font-black
                    text-white
                    backdrop-blur-md
                    transition
                    hover:bg-white
                    hover:text-purple-800
                  "
                >
                  <ShieldCheck className="h-4 w-4" />
                  General terms
                </Link>

                <Link
                  href={`/Lottery/${encodeURIComponent(lottery.slug)}/Terms`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="
                    inline-flex
                    min-h-10
                    items-center
                    justify-center
                    gap-2
                    rounded-full
                    bg-yellow-300
                    px-4
                    py-2
                    text-xs
                    font-black
                    text-purple-950
                    shadow-md
                    transition
                    hover:bg-white
                  "
                >
                  <Ticket className="h-4 w-4" />
                  This lottery&apos;s terms
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="
              bg-gradient-to-br
              from-pink-500
              via-purple-600
              to-blue-600
              p-8

              sm:p-12
              lg:p-16
            "
          >
            <Trophy
              className="
                h-12
                w-12
                text-yellow-300
              "
            />

            <LotteryHeading
              lottery={
                lottery
              }
              overImage
            />

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/Lottery/Terms"
                target="_blank"
                rel="noopener noreferrer"
                className="
                  inline-flex
                  min-h-10
                  items-center
                  justify-center
                  gap-2
                  rounded-full
                  border
                  border-white/25
                  bg-black/20
                  px-4
                  py-2
                  text-xs
                  font-black
                  text-white
                  backdrop-blur-md
                  transition
                  hover:bg-white
                  hover:text-purple-800
                "
              >
                <ShieldCheck className="h-4 w-4" />
                General terms
              </Link>

              <Link
                href={`/Lottery/${encodeURIComponent(lottery.slug)}/Terms`}
                target="_blank"
                rel="noopener noreferrer"
                className="
                  inline-flex
                  min-h-10
                  items-center
                  justify-center
                  gap-2
                  rounded-full
                  bg-yellow-300
                  px-4
                  py-2
                  text-xs
                  font-black
                  text-purple-950
                  shadow-md
                  transition
                  hover:bg-white
                "
              >
                <Ticket className="h-4 w-4" />
                This lottery&apos;s terms
              </Link>
            </div>
          </div>
        )}
      </section>

      <section
        aria-label="Burton Pride lottery registration"
        className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 shadow-sm dark:border-blue-300/20 dark:bg-blue-500/10"
      >
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700 dark:text-blue-300" />

          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">
              Lottery registration
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-white/75">
              Burton Pride lottery number: <strong>SL0507</strong>. This lottery
              number was issued by East Staffordshire Borough Council.
            </p>
          </div>
        </div>
      </section>

      <div
        className="
          mt-8
          grid
          gap-8

          lg:grid-cols-[1fr_420px]
          lg:items-start
        "
      >
        {/* LEFT */}
        <div className="space-y-8">
          <section
            className="
              rounded-[2rem]
              border
              border-slate-200
              bg-white/80
              p-6
              shadow-lg

              dark:border-white/10
              dark:bg-white/[0.04]

              sm:p-8
            "
          >
            <p
              className="
                text-xs
                font-black
                uppercase
                tracking-[0.18em]
                text-purple-600

                dark:text-purple-300
              "
            >
              About this lottery
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
              {lottery.title}
            </h2>

            {lottery.description && (
              <p
                className="
                  mt-4
                  whitespace-pre-line
                  leading-7
                  text-slate-600

                  dark:text-white/65
                "
              >
                {
                  lottery.description
                }
              </p>
            )}

            {lottery.fundraising_purpose && (
              <div
                className="
                  mt-6
                  rounded-2xl
                  border
                  border-pink-200
                  bg-pink-50
                  p-5

                  dark:border-pink-300/20
                  dark:bg-pink-500/10
                "
              >
                <div className="flex gap-3">
                  <Heart
                    className="
                      mt-0.5
                      h-5
                      w-5
                      shrink-0
                      text-pink-600

                      dark:text-pink-300
                    "
                  />

                  <div>
                    <p
                      className="
                        font-black
                        text-slate-950

                        dark:text-white
                      "
                    >
                      What your money supports
                    </p>

                    <p
                      className="
                        mt-1
                        leading-6
                        text-slate-600

                        dark:text-white/65
                      "
                    >
                      {
                        lottery.fundraising_purpose
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* DATES */}
          <section
            className="
              grid
              gap-4

              md:grid-cols-3
            "
          >
            <DateCard
              icon={
                <Clock3 />
              }
              label="Ticket sales open"
              value={formatDateTime(
                lottery.sales_open_at,
              )}
            />

            <DateCard
              icon={
                <CalendarDays />
              }
              label="Ticket sales close"
              value={formatDateTime(
                lottery.sales_close_at,
              )}
            />

            <DateCard
              icon={
                <Trophy />
              }
              label="Draw"
              value={formatDateTime(
                lottery.draw_at,
              )}
            />
          </section>

          {/* PRIZES */}
          <section
            className="
              rounded-[2rem]
              border
              border-slate-200
              bg-white/80
              p-6
              shadow-lg

              dark:border-white/10
              dark:bg-white/[0.04]

              sm:p-8
            "
          >
            <div className="flex items-center gap-3">
              <div
                className="
                  flex
                  h-11
                  w-11
                  items-center
                  justify-center
                  rounded-2xl
                  bg-yellow-300
                  text-purple-950
                "
              >
                <Gift className="h-5 w-5" />
              </div>

              <div>
                <p
                  className="
                    text-xs
                    font-black
                    uppercase
                    tracking-[0.16em]
                    text-purple-600

                    dark:text-purple-300
                  "
                >
                  Prizes
                </p>

                <h2
                  className="
                    text-2xl
                    font-black
                    text-slate-950

                    dark:text-white
                  "
                >
                  What you could win
                </h2>
              </div>
            </div>

            {lottery.prizes.length ===
            0 ? (
              <div
                className="
                  mt-6
                  rounded-2xl
                  border
                  border-slate-200
                  bg-slate-50
                  p-6
                  text-center
                  text-slate-500

                  dark:border-white/10
                  dark:bg-white/[0.03]
                  dark:text-white/50
                "
              >
                Prize details will be
                published soon.
              </div>
            ) : (
              <div
                className="
                  mt-6
                  grid
                  gap-4

                  md:grid-cols-2
                "
              >
                {lottery.prizes.map(
                  (
                    prize,
                  ) => (
                    <PrizeCard
                      key={
                        prize.id
                      }
                      prize={
                        prize
                      }
                      showValue={
                        lottery.show_prize_values
                      }
                    />
                  ),
                )}
              </div>
            )}
          </section>

          {/* =====================================================
              TERMS
              ===================================================== */}
          <section
            className="
              rounded-[2rem]
              border
              border-purple-200
              bg-purple-50
              p-6
              shadow-md

              dark:border-purple-300/20
              dark:bg-purple-500/10
            "
          >
            <div className="flex items-start gap-3">
              <ShieldCheck
                className="
                  mt-0.5
                  h-6
                  w-6
                  shrink-0
                  text-purple-700

                  dark:text-purple-300
                "
              />

              <div className="min-w-0 flex-1">
                <h2
                  className="
                    text-xl
                    font-black
                    text-slate-950

                    dark:text-white
                  "
                >
                  Lottery terms
                </h2>

                <p
                  className="
                    mt-2
                    leading-7
                    text-slate-600

                    dark:text-white/65
                  "
                >
                  Burton Pride&apos;s General Lottery Terms apply to all
                  lotteries. This lottery also has its own individual terms
                  covering information such as the ticket price, draw dates,
                  prizes and any lottery-specific conditions.
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href="/Lottery/Terms"
                    target="_blank"
                    rel="noopener noreferrer"
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
                      dark:hover:bg-purple-300
                    "
                  >
                    <ShieldCheck className="h-4 w-4" />
                    General Lottery Terms
                  </Link>

                  <Link
                    href={`/Lottery/${encodeURIComponent(lottery.slug)}/Terms`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="
                      inline-flex
                      min-h-11
                      items-center
                      justify-center
                      gap-2
                      rounded-full
                      bg-yellow-300
                      px-5
                      py-2.5
                      text-sm
                      font-black
                      text-purple-950
                      transition

                      hover:bg-yellow-200
                    "
                  >
                    <Ticket className="h-4 w-4" />
                    Terms for {lottery.title}
                  </Link>
                </div>

                {lottery.terms_version && (
                  <p
                    className="
                      mt-4
                      text-xs
                      font-semibold
                      text-slate-500

                      dark:text-white/45
                    "
                  >
                    Terms version: {lottery.terms_version}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* RESPONSIBLE */}
          <section
            className="
              rounded-[2rem]
              border
              border-green-200
              bg-green-50
              p-6

              dark:border-green-400/20
              dark:bg-green-500/10
            "
          >
            <div className="flex items-start gap-3">
              <ShieldCheck
                className="
                  mt-0.5
                  h-6
                  w-6
                  shrink-0
                  text-green-700

                  dark:text-green-300
                "
              />

              <div>
                <h2
                  className="
                    font-black
                    text-slate-950

                    dark:text-white
                  "
                >
                  Responsible participation
                </h2>

                <p
                  className="
                    mt-2
                    leading-7
                    text-slate-600

                    dark:text-white/65
                  "
                >
                  {lottery.responsible_gambling_info ||
                    "Please only spend what you can afford. Taking part is optional and supports Burton Pride fundraising."}
                </p>

                <p
                  className="
                    mt-3
                    text-sm
                    font-semibold
                    text-slate-600

                    dark:text-white/60
                  "
                >
                  Minimum age:{" "}
                  {
                    lottery.minimum_age
                  }
                  +
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* PAYMENT FORM */}
        <aside
          className="
            lg:sticky
            lg:top-6
          "
        >
          <form
            onSubmit={
              submitEntry
            }
            className="
              overflow-hidden
              rounded-[2rem]
              border
              border-slate-200
              bg-white
              shadow-2xl

              dark:border-white/10
              dark:bg-[#111827]
            "
          >
            <div
              className="
                bg-gradient-to-r
                from-pink-500
                via-purple-600
                to-blue-600
                p-6
                text-white
              "
            >
              <Ticket className="h-7 w-7 text-yellow-300" />

              <h2 className="mt-3 text-2xl font-black">
                Enter the lottery
              </h2>

              <p className="mt-2 text-sm text-white/80">
                {
                  lottery.sales_message
                }
              </p>
            </div>

            <div className="space-y-5 p-6">
              {!lottery.can_purchase && (
                <div
                  className="
                    rounded-2xl
                    border
                    border-amber-200
                    bg-amber-50
                    p-4
                    text-sm
                    font-semibold
                    text-amber-900

                    dark:border-amber-300/20
                    dark:bg-amber-500/10
                    dark:text-amber-100
                  "
                >
                  {
                    lottery.sales_message
                  }
                </div>
              )}

              <FormInput
                label="Full name"
                value={
                  form.fullName
                }
                onChange={(
                  value,
                ) =>
                  updateForm(
                    "fullName",
                    value,
                  )
                }
                required
              />

              <FormInput
                label="Email address"
                type="email"
                value={
                  form.email
                }
                onChange={(
                  value,
                ) =>
                  updateForm(
                    "email",
                    value,
                  )
                }
                required
              />

              <FormInput
                label="Phone number"
                type="tel"
                value={
                  form.phone
                }
                onChange={(
                  value,
                ) =>
                  updateForm(
                    "phone",
                    value,
                  )
                }
              />

              <div>
                <label
                  className="
                    text-sm
                    font-black
                    text-slate-800

                    dark:text-white
                  "
                >
                  Number of tickets
                </label>

                <div
                  className="
                    mt-2
                    grid
                    grid-cols-[48px_1fr_48px]
                    overflow-hidden
                    rounded-2xl
                    border
                    border-slate-300

                    dark:border-white/15
                  "
                >
                  <button
                    type="button"
                    onClick={() =>
                      updateForm(
                        "quantity",
                        Math.max(
                          1,
                          form.quantity -
                            1,
                        ),
                      )
                    }
                    className="
                      text-xl
                      font-black
                      text-slate-700
                      transition
                      hover:bg-slate-100

                      dark:text-white
                      dark:hover:bg-white/10
                    "
                  >
                    −
                  </button>

                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={
                      form.quantity
                    }
                    onChange={(
                      event,
                    ) =>
                      updateForm(
                        "quantity",
                        Math.max(
                          1,
                          Number(
                            event
                              .target
                              .value,
                          ) ||
                            1,
                        ),
                      )
                    }
                    className="
                      h-12
                      border-x
                      border-slate-300
                      bg-transparent
                      text-center
                      font-black
                      text-slate-950
                      outline-none

                      dark:border-white/15
                      dark:text-white
                    "
                  />

                  <button
                    type="button"
                    onClick={() =>
                      updateForm(
                        "quantity",
                        Math.min(
                          100,
                          form.quantity +
                            1,
                        ),
                      )
                    }
                    className="
                      text-xl
                      font-black
                      text-slate-700
                      transition
                      hover:bg-slate-100

                      dark:text-white
                      dark:hover:bg-white/10
                    "
                  >
                    +
                  </button>
                </div>

                <p
                  className="
                    mt-2
                    text-xs
                    text-slate-500

                    dark:text-white/45
                  "
                >
                  {
                    formatMoney(
                      lottery.ticket_price_pence,
                      lottery.currency,
                    )
                  }{" "}
                  per ticket
                </p>
              </div>

              <div
                className="
                  rounded-2xl
                  bg-slate-100
                  p-4

                  dark:bg-white/[0.06]
                "
              >
                <div className="flex items-center justify-between">
                  <span
                    className="
                      text-sm
                      font-semibold
                      text-slate-600

                      dark:text-white/60
                    "
                  >
                    Tickets
                  </span>

                  <span
                    className="
                      font-black
                      text-slate-950

                      dark:text-white
                    "
                  >
                    {
                      form.quantity
                    }
                  </span>
                </div>

                <div
                  className="
                    mt-3
                    flex
                    items-center
                    justify-between
                    border-t
                    border-slate-200
                    pt-3

                    dark:border-white/10
                  "
                >
                  <span
                    className="
                      font-black
                      text-slate-950

                      dark:text-white
                    "
                  >
                    Total
                  </span>

                  <span
                    className="
                      text-xl
                      font-black
                      text-purple-700

                      dark:text-yellow-300
                    "
                  >
                    {formatMoney(
                      totalPrice,
                      lottery.currency,
                    )}
                  </span>
                </div>
              </div>

              {lottery.geographic_eligibility && (
                <div
                  className="
                    rounded-2xl
                    border
                    border-blue-200
                    bg-blue-50
                    p-4
                    text-sm
                    text-blue-900

                    dark:border-blue-300/20
                    dark:bg-blue-500/10
                    dark:text-blue-100
                  "
                >
                  <strong>
                    Eligibility:
                  </strong>{" "}
                  {
                    lottery.geographic_eligibility
                  }
                </div>
              )}

              <Checkbox
                checked={
                  form.ageConfirmed
                }
                onChange={(
                  value,
                ) =>
                  updateForm(
                    "ageConfirmed",
                    value,
                  )
                }
              >
                I confirm that I am
                at least{" "}
                {
                  lottery.minimum_age
                }{" "}
                years old.
              </Checkbox>

              <Checkbox
                checked={
                  form.eligibilityConfirmed
                }
                onChange={(
                  value,
                ) =>
                  updateForm(
                    "eligibilityConfirmed",
                    value,
                  )
                }
              >
                I confirm that I
                meet the eligibility
                requirements for this
                lottery.
              </Checkbox>

              <Checkbox
                checked={
                  form.termsAccepted
                }
                onChange={(
                  value,
                ) =>
                  updateForm(
                    "termsAccepted",
                    value,
                  )
                }
              >
                I have read and accept the{" "}
                <Link
                  href="/Lottery/Terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="
                    font-black
                    text-purple-700
                    underline
                    underline-offset-2

                    dark:text-purple-300
                  "
                >
                  General Lottery Terms
                </Link>{" "}
                and the{" "}
                <Link
                  href={`/Lottery/${encodeURIComponent(lottery.slug)}/Terms`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="
                    font-black
                    text-purple-700
                    underline
                    underline-offset-2

                    dark:text-purple-300
                  "
                >
                  terms for this lottery
                </Link>
                .
              </Checkbox>

              <Checkbox
                checked={
                  form.marketingOptIn
                }
                onChange={(
                  value,
                ) =>
                  updateForm(
                    "marketingOptIn",
                    value,
                  )
                }
              >
                I would like to
                receive occasional
                Burton Pride updates.
              </Checkbox>

              {formError && (
                <div
                  role="alert"
                  className="
                    rounded-2xl
                    border
                    border-red-200
                    bg-red-50
                    p-4
                    text-sm
                    font-semibold
                    text-red-800

                    dark:border-red-400/20
                    dark:bg-red-500/10
                    dark:text-red-100
                  "
                >
                  {
                    formError
                  }
                </div>
              )}

              <button
                type="submit"
                disabled={
                  submitting ||
                  !lottery.can_purchase
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
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Opening secure payment...
                  </>
                ) : (
                  <>
                    <LockKeyhole className="h-5 w-5" />

                    Continue to payment

                    <ChevronRight className="h-5 w-5" />
                  </>
                )}
              </button>

              <div
                className="
                  flex
                  items-start
                  gap-2
                  text-xs
                  leading-5
                  text-slate-500

                  dark:text-white/45
                "
              >
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />

                <p>
                  Payment is completed
                  securely through
                  Stripe. Burton Pride
                  does not collect or
                  store your card
                  details on this form.
                </p>
              </div>
            </div>
          </form>
        </aside>
      </div>
    </main>
  );
}

function formatMoney(
  amountPence: number,
  currency: string,
) {
  const amount =
    amountPence / 100;

  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency,
      minimumFractionDigits:
        2,
    },
  ).format(amount);
}

function formatDateTime(
  value: string | null,
) {
  if (!value) {
    return "TBC";
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "TBC";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(date);
}

function LotteryHeading({
  lottery,
  overImage = false,
}: {
  lottery: Lottery;
  overImage?: boolean;
}) {
  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        <span
          className="
            rounded-full
            bg-yellow-300
            px-3
            py-1.5
            text-xs
            font-black
            uppercase
            tracking-wide
            text-purple-950
          "
        >
          {lottery.status ===
          "live"
            ? "Tickets available"
            : lottery.status.replaceAll(
                "_",
                " ",
              )}
        </span>

        <span
          className={`
            rounded-full
            border
            px-3
            py-1.5
            text-xs
            font-black

            ${
              overImage
                ? "border-white/20 bg-black/30 text-white"
                : "border-slate-200 bg-white text-slate-800"
            }
          `}
        >
          {formatMoney(
            lottery.ticket_price_pence,
            lottery.currency,
          )}{" "}
          per ticket
        </span>
      </div>

      <h1
        className={`
          mt-4
          max-w-4xl
          text-3xl
          font-black
          leading-tight

          sm:text-4xl
          lg:text-5xl

          ${
            overImage
              ? "text-white"
              : "text-slate-950 dark:text-white"
          }
        `}
      >
        {
          lottery.title
        }
      </h1>

      {lottery.short_summary && (
        <p
          className={`
            mt-4
            max-w-3xl
            text-base
            leading-7

            sm:text-lg

            ${
              overImage
                ? "text-white/80"
                : "text-slate-600 dark:text-white/65"
            }
          `}
        >
          {
            lottery.short_summary
          }
        </p>
      )}
    </div>
  );
}

function DateCard({
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
        rounded-[1.5rem]
        border
        border-slate-200
        bg-white/80
        p-5
        shadow-md

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
          text-slate-400

          dark:text-white/35
        "
      >
        {label}
      </p>

      <p
        className="
          mt-1
          font-bold
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

function PrizeCard({
  prize,
  showValue,
}: {
  prize: Prize;

  showValue:
    boolean;
}) {
  return (
    <article
      className="
        overflow-hidden
        rounded-[1.5rem]
        border
        border-slate-200
        bg-slate-50

        dark:border-white/10
        dark:bg-white/[0.03]
      "
    >
      {prize.image_url && (
        <img
          src={
            prize.image_url
          }
          alt=""
          className="h-44 w-full object-cover"
        />
      )}

      <div className="p-5">
        <Trophy
          className="
            h-6
            w-6
            text-yellow-500

            dark:text-yellow-300
          "
        />

        <h3
          className="
            mt-3
            text-lg
            font-black
            text-slate-950

            dark:text-white
          "
        >
          {prize.name}
        </h3>

        {prize.description && (
          <p
            className="
              mt-2
              text-sm
              leading-6
              text-slate-600

              dark:text-white/60
            "
          >
            {
              prize.description
            }
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {prize.quantity >
            1 && (
            <span
              className="
                rounded-full
                bg-purple-100
                px-3
                py-1
                text-xs
                font-black
                text-purple-700

                dark:bg-purple-500/15
                dark:text-purple-200
              "
            >
              {
                prize.quantity
              }{" "}
              available
            </span>
          )}

          {showValue &&
            prize.declared_value !==
              null && (
              <span
                className="
                  rounded-full
                  bg-green-100
                  px-3
                  py-1
                  text-xs
                  font-black
                  text-green-700

                  dark:bg-green-500/15
                  dark:text-green-200
                "
              >
                Value{" "}
                {new Intl.NumberFormat(
                  "en-GB",
                  {
                    style:
                      "currency",

                    currency:
                      "GBP",
                  },
                ).format(
                  Number(
                    prize.declared_value,
                  ),
                )}
              </span>
            )}
        </div>

        {prize.sponsor_name && (
          <p
            className="
              mt-3
              text-xs
              text-slate-500

              dark:text-white/40
            "
          >
            Prize supplied by{" "}
            <strong>
              {
                prize.sponsor_name
              }
            </strong>
          </p>
        )}
      </div>
    </article>
  );
}

function FormInput({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;

  value: string;

  onChange: (
    value: string,
  ) => void;

  type?: string;

  required?: boolean;
}) {
  return (
    <div>
      <label
        className="
          text-sm
          font-black
          text-slate-800

          dark:text-white
        "
      >
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </label>

      <input
        type={type}
        value={value}
        required={
          required
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
          h-12
          w-full
          rounded-2xl
          border
          border-slate-300
          bg-white
          px-4
          font-semibold
          text-slate-950
          outline-none
          transition

          focus:border-purple-500
          focus:ring-4
          focus:ring-purple-500/10

          dark:border-white/15
          dark:bg-white/[0.05]
          dark:text-white
        "
      />
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;

  onChange: (
    checked: boolean,
  ) => void;

  children:
    React.ReactNode;
}) {
  return (
    <label
      className="
        flex
        cursor-pointer
        items-start
        gap-3
      "
    >
      <input
        type="checkbox"
        checked={
          checked
        }
        onChange={(
          event,
        ) =>
          onChange(
            event.target
              .checked,
          )
        }
        className="sr-only"
      />

      <span
        className={`
          mt-0.5
          flex
          h-5
          w-5
          shrink-0
          items-center
          justify-center
          rounded-md
          border
          transition

          ${
            checked
              ? "border-purple-600 bg-purple-600 text-white"
              : "border-slate-300 bg-white dark:border-white/20 dark:bg-white/[0.05]"
          }
        `}
      >
        {checked && (
          <Check className="h-3.5 w-3.5" />
        )}
      </span>

      <span
        className="
          text-sm
          leading-6
          text-slate-600

          dark:text-white/65
        "
      >
        {children}
      </span>
    </label>
  );
}
