"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronRight,
  CreditCard,
  FileText,
  Heart,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Ticket,
  Trophy,
  UserRound,
} from "lucide-react";

type Lottery = {
  id: string;
  title: string;
  slug: string;

  short_summary:
    | string
    | null;

  status: string;

  ticket_price_pence:
    number;

  currency: string;

  minimum_age:
    number;

  geographic_eligibility:
    | string
    | null;

  terms_version:
    | string
    | null;

  privacy_notice_version:
    | string
    | null;

  can_purchase:
    boolean;

  sales_message:
    string;
};

type LotteryApiResponse = {
  ok: boolean;

  lottery?: Lottery;

  error?: string;

  code?: string;
};

type CheckoutForm = {
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

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

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

export default function LotteryCheckoutPage({
  params,
}: PageProps) {
  const [
    slug,
    setSlug,
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
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    form,
    setForm,
  ] =
    useState<CheckoutForm>({
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

  /*
   * =====================================================
   * RESOLVE SLUG
   * =====================================================
   */
  useEffect(() => {
    let active =
      true;

    params.then(
      ({
        slug,
      }) => {
        if (active) {
          setSlug(
            slug,
          );
        }
      },
    );

    return () => {
      active =
        false;
    };
  }, [params]);

  /*
   * =====================================================
   * LOAD LOTTERY
   * =====================================================
   */
  useEffect(() => {
    if (!slug) {
      return;
    }

    let cancelled =
      false;

    async function loadLottery() {
      try {
        setLoading(
          true,
        );

        setError(
          null,
        );

        const response =
          await fetch(
            `/api/lottery/${encodeURIComponent(
              slug,
            )}`,
            {
              cache:
                "no-store",
            },
          );

        const data: LotteryApiResponse =
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
        problem
      ) {
        if (!cancelled) {
          setError(
            problem instanceof
              Error
              ? problem.message
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

    loadLottery();

    return () => {
      cancelled =
        true;
    };
  }, [slug]);

  function updateField<
    K extends keyof CheckoutForm,
  >(
    key: K,
    value: CheckoutForm[K],
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

  /*
   * =====================================================
   * VALIDATION
   * =====================================================
   */
  function validate() {
    if (!lottery) {
      return "Lottery information is not available.";
    }

    if (
      !lottery.can_purchase
    ) {
      return (
        lottery.sales_message ||
        "Ticket sales are not currently available."
      );
    }

    if (
      !form.fullName.trim()
    ) {
      return "Please enter your full name.";
    }

    if (
      !form.email.trim()
    ) {
      return "Please enter your email address.";
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        form.email.trim(),
      )
    ) {
      return "Please enter a valid email address.";
    }

    if (
      !Number.isInteger(
        form.quantity,
      ) ||
      form.quantity <
        1 ||
      form.quantity >
        100
    ) {
      return "Ticket quantity must be between 1 and 100.";
    }

    if (
      !form.ageConfirmed
    ) {
      return `You must confirm that you are at least ${lottery.minimum_age} years old.`;
    }

    if (
      !form.eligibilityConfirmed
    ) {
      return "You must confirm that you meet the lottery eligibility requirements.";
    }

    if (
      !form.termsAccepted
    ) {
      return "You must accept the General Lottery Terms and this lottery's individual terms.";
    }

    return null;
  }

  /*
   * =====================================================
   * SUBMIT TO STRIPE
   * =====================================================
   */
  async function continueToPayment() {
    if (!lottery) {
      return;
    }

    const problem =
      validate();

    if (problem) {
      setError(
        problem,
      );

      return;
    }

    try {
      setSubmitting(
        true,
      );

      setError(
        null,
      );

      const response =
        await fetch(
          `/api/lottery/${encodeURIComponent(
            lottery.slug,
          )}/checkout`,
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
                    form.fullName.trim(),

                  email:
                    form.email
                      .trim()
                      .toLowerCase(),

                  phone:
                    form.phone.trim(),

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
            "Unable to start the secure payment.",
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
      problem
    ) {
      setError(
        problem instanceof
          Error
          ? problem.message
          : "Unable to start payment.",
      );
    } finally {
      setSubmitting(
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
          mx-auto
          flex
          min-h-[70vh]
          w-full
          max-w-7xl
          items-center
          justify-center
          px-4
          pb-20
          pt-28

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
            Loading checkout...
          </p>
        </div>
      </main>
    );
  }

  /*
   * =====================================================
   * LOAD ERROR
   * =====================================================
   */
  if (
    !lottery
  ) {
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
            Checkout unavailable
          </h1>

          <p
            className="
              mt-3
              text-slate-600

              dark:text-white/60
            "
          >
            {error ||
              "This lottery could not be loaded."}
          </p>

          <Link
            href="/lottery"
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
              font-black
              text-purple-950
            "
          >
            <ArrowLeft className="h-4 w-4" />

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
        pb-24
        pt-24

        sm:px-6
        sm:pt-28

        lg:px-8
        lg:pt-32
      "
    >
      {/* =====================================================
          TOP ACTIONS
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
          href={`/lottery/${encodeURIComponent(
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

          Back to lottery
        </Link>

        <Link
          href="/lottery/terms"
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

            dark:border-purple-300/25
            dark:bg-purple-500/10
            dark:text-purple-200
          "
        >
          <ShieldCheck className="h-4 w-4" />

          General Lottery Terms
        </Link>

        <Link
          href={`/lottery/${encodeURIComponent(
            lottery.slug,
          )}/terms`}
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

            dark:border-yellow-300/25
            dark:bg-yellow-300/10
            dark:text-yellow-200
          "
        >
          <FileText className="h-4 w-4" />

          Individual terms
        </Link>
      </div>

      {/* =====================================================
          HEADER
          ===================================================== */}
      <section
        className="
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
          "
        >
          <Ticket className="h-6 w-6" />
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
          Secure Lottery Checkout
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

        {lottery.short_summary && (
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
            {lottery.short_summary}
          </p>
        )}
      </section>

      {/* =====================================================
          MAIN GRID
          ===================================================== */}
      <div
        className="
          mt-8
          grid
          gap-8

          lg:grid-cols-[minmax(0,1fr)_420px]
          lg:items-start
        "
      >
        {/* LEFT: CUSTOMER DETAILS */}
        <section
          className="
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
                bg-purple-100
                text-purple-700

                dark:bg-purple-500/15
                dark:text-purple-300
              "
            >
              <UserRound className="h-5 w-5" />
            </div>

            <div>
              <h2
                className="
                  text-2xl
                  font-black
                  text-slate-950

                  dark:text-white
                "
              >
                Your details
              </h2>

              <p
                className="
                  mt-1
                  text-sm
                  leading-6
                  text-slate-600

                  dark:text-white/50
                "
              >
                We need these details to create your lottery
                order and contact you if necessary.
              </p>
            </div>
          </div>

          <div
            className="
              mt-7
              grid
              gap-5
            "
          >
            <InputField
              label="Full name"
              required
              value={
                form.fullName
              }
              onChange={(
                value,
              ) =>
                updateField(
                  "fullName",
                  value,
                )
              }
            />

            <InputField
              label="Email address"
              type="email"
              required
              value={
                form.email
              }
              onChange={(
                value,
              ) =>
                updateField(
                  "email",
                  value,
                )
              }
            />

            <InputField
              label="Phone number"
              type="tel"
              value={
                form.phone
              }
              onChange={(
                value,
              ) =>
                updateField(
                  "phone",
                  value,
                )
              }
            />
          </div>

          {/* QUANTITY */}
          <div
            className="
              mt-8
              border-t
              border-slate-200
              pt-7

              dark:border-white/10
            "
          >
            <h3
              className="
                text-lg
                font-black
                text-slate-950

                dark:text-white
              "
            >
              Number of tickets
            </h3>

            <p
              className="
                mt-1
                text-sm
                text-slate-600

                dark:text-white/50
              "
            >
              {formatMoney(
                lottery.ticket_price_pence,
                lottery.currency,
              )}{" "}
              per ticket
            </p>

            <div
              className="
                mt-4
                grid
                max-w-sm
                grid-cols-[56px_1fr_56px]
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
                  updateField(
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
                  updateField(
                    "quantity",
                    Math.max(
                      1,
                      Math.min(
                        100,
                        Number(
                          event
                            .target
                            .value,
                        ) ||
                          1,
                      ),
                    ),
                  )
                }
                className="
                  h-14
                  border-x
                  border-slate-300
                  bg-transparent
                  text-center
                  text-lg
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
                  updateField(
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
          </div>

          {/* ELIGIBILITY */}
          <div
            className="
              mt-8
              border-t
              border-slate-200
              pt-7

              dark:border-white/10
            "
          >
            <h3
              className="
                text-lg
                font-black
                text-slate-950

                dark:text-white
              "
            >
              Confirm your eligibility
            </h3>

            {lottery.geographic_eligibility && (
              <div
                className="
                  mt-4
                  rounded-2xl
                  border
                  border-blue-200
                  bg-blue-50
                  p-4
                  text-sm
                  leading-6
                  text-blue-900

                  dark:border-blue-300/20
                  dark:bg-blue-500/10
                  dark:text-blue-100
                "
              >
                <strong>
                  Geographic eligibility:
                </strong>{" "}
                {
                  lottery.geographic_eligibility
                }
              </div>
            )}

            <div className="mt-5 space-y-4">
              <Checkbox
                checked={
                  form.ageConfirmed
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "ageConfirmed",
                    value,
                  )
                }
              >
                I confirm that I am at least{" "}
                <strong>
                  {lottery.minimum_age}
                </strong>{" "}
                years old.
              </Checkbox>

              <Checkbox
                checked={
                  form.eligibilityConfirmed
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "eligibilityConfirmed",
                    value,
                  )
                }
              >
                I confirm that I meet the eligibility
                requirements for this lottery.
              </Checkbox>

              <Checkbox
                checked={
                  form.termsAccepted
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "termsAccepted",
                    value,
                  )
                }
              >
                I have read and accept the{" "}
                <Link
                  href="/lottery/terms"
                  target="_blank"
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
                  href={`/lottery/${encodeURIComponent(
                    lottery.slug,
                  )}/terms`}
                  target="_blank"
                  className="
                    font-black
                    text-purple-700
                    underline
                    underline-offset-2

                    dark:text-purple-300
                  "
                >
                  individual terms for this lottery
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
                  updateField(
                    "marketingOptIn",
                    value,
                  )
                }
              >
                I would like to receive occasional Burton
                Pride news and updates.
              </Checkbox>
            </div>
          </div>
        </section>

        {/* ===================================================
            RIGHT: ORDER SUMMARY
            =================================================== */}
        <aside
          className="
            lg:sticky
            lg:top-6
          "
        >
          <section
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
              <Trophy className="h-7 w-7 text-yellow-300" />

              <h2 className="mt-3 text-2xl font-black">
                Order summary
              </h2>

              <p className="mt-1 text-sm text-white/75">
                Review your lottery ticket order before
                continuing to payment.
              </p>
            </div>

            <div className="p-6">
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
                <p
                  className="
                    text-xs
                    font-black
                    uppercase
                    tracking-wide
                    text-slate-500

                    dark:text-white/40
                  "
                >
                  Lottery
                </p>

                <p
                  className="
                    mt-1
                    text-lg
                    font-black
                    text-slate-950

                    dark:text-white
                  "
                >
                  {lottery.title}
                </p>
              </div>

              <div className="mt-5 space-y-4">
                <SummaryRow
                  label="Ticket price"
                  value={formatMoney(
                    lottery.ticket_price_pence,
                    lottery.currency,
                  )}
                />

                <SummaryRow
                  label="Number of tickets"
                  value={String(
                    form.quantity,
                  )}
                />

                <div
                  className="
                    border-t
                    border-slate-200
                    pt-4

                    dark:border-white/10
                  "
                >
                  <div
                    className="
                      flex
                      items-center
                      justify-between
                      gap-4
                    "
                  >
                    <span
                      className="
                        text-lg
                        font-black
                        text-slate-950

                        dark:text-white
                      "
                    >
                      Total
                    </span>

                    <span
                      className="
                        text-2xl
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
              </div>

              {!lottery.can_purchase && (
                <div
                  className="
                    mt-5
                    rounded-2xl
                    border
                    border-amber-300
                    bg-amber-50
                    p-4
                    text-sm
                    font-semibold
                    leading-6
                    text-amber-900

                    dark:border-yellow-300/20
                    dark:bg-yellow-300/10
                    dark:text-yellow-100
                  "
                >
                  {lottery.sales_message}
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="
                    mt-5
                    rounded-2xl
                    border
                    border-red-200
                    bg-red-50
                    p-4
                    text-sm
                    font-semibold
                    leading-6
                    text-red-800

                    dark:border-red-400/20
                    dark:bg-red-500/10
                    dark:text-red-100
                  "
                >
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={
                  continueToPayment
                }
                disabled={
                  submitting ||
                  !lottery.can_purchase
                }
                className="
                  mt-6
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
                    <CreditCard className="h-5 w-5" />

                    Continue to payment

                    <ChevronRight className="h-5 w-5" />
                  </>
                )}
              </button>

              <div
                className="
                  mt-5
                  flex
                  items-start
                  gap-3
                  rounded-2xl
                  border
                  border-green-200
                  bg-green-50
                  p-4

                  dark:border-green-400/20
                  dark:bg-green-500/10
                "
              >
                <LockKeyhole
                  className="
                    mt-0.5
                    h-5
                    w-5
                    shrink-0
                    text-green-700

                    dark:text-green-300
                  "
                />

                <p
                  className="
                    text-xs
                    leading-5
                    text-green-900

                    dark:text-green-100/80
                  "
                >
                  Card payment is completed securely through
                  Stripe. Burton Pride does not collect your
                  card number on this page.
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

/*
 * =========================================================
 * INPUT
 * =========================================================
 */
function InputField({
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
    <label className="block">
      <span
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
      </span>

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
    </label>
  );
}

/*
 * =========================================================
 * CHECKBOX
 * =========================================================
 */
function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;

  onChange: (
    value: boolean,
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

/*
 * =========================================================
 * SUMMARY ROW
 * =========================================================
 */
function SummaryRow({
  label,
  value,
}: {
  label: string;

  value: string;
}) {
  return (
    <div
      className="
        flex
        items-center
        justify-between
        gap-4
      "
    >
      <span
        className="
          text-sm
          font-semibold
          text-slate-600

          dark:text-white/55
        "
      >
        {label}
      </span>

      <span
        className="
          font-black
          text-slate-950

          dark:text-white
        "
      >
        {value}
      </span>
    </div>
  );
}