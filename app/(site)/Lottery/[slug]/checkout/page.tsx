import Link from "next/link";
import {
  headers,
} from "next/headers";
import Stripe from "stripe";
import {
  CheckCircle2,
  Mail,
  ReceiptText,
  ShieldCheck,
  Ticket,
  XCircle,
} from "lucide-react";

import {
  supabaseAdmin,
} from "@/lib/supabase/supabaseAdmin";

type CheckoutPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    payment?: string;
    session_id?: string;
  }>;
};

type ConfirmedOrder = {
  order_reference: string;
};

type CheckoutCompletion = {
  ok: boolean;
  order_reference?: string;
  ticket_count?: number;
  email_status?: "sent" | "failed";
  error?: unknown;
  code?: string;
};

export const metadata = {
  title:
    "Lottery Entry Confirmed | Burton Pride",
  description:
    "Confirmation that your Burton Pride lottery entry has been received.",
};

export const dynamic =
  "force-dynamic";

const stripe =
  new Stripe(
    process.env.STRIPE_SECRET_KEY!,
  );

function normaliseOrigin(
  value: string,
) {
  try {
    const url =
      new URL(
        value,
      );

    if (
      url.protocol !==
        "https:" &&
      url.protocol !==
        "http:"
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

async function getRequestOrigin() {
  const requestHeaders =
    await headers();

  const forwardedHost =
    requestHeaders
      .get(
        "x-forwarded-host",
      )
      ?.split(
        ",",
      )[0]
      ?.trim();

  const requestHost =
    forwardedHost ||
    requestHeaders
      .get(
        "host",
      )
      ?.trim();

  if (
    requestHost
  ) {
    const forwardedProtocol =
      requestHeaders
        .get(
          "x-forwarded-proto",
        )
        ?.split(
          ",",
        )[0]
        ?.trim()
        .toLowerCase();

    const protocol =
      forwardedProtocol ===
        "http"
        ? "http"
        : "https";

    const requestOrigin =
      normaliseOrigin(
        `${protocol}://${requestHost}`,
      );

    if (
      requestOrigin
    ) {
      return requestOrigin;
    }
  }

  // Only use these when this request does not include a usable host. A
  // configured URL can point at a previous Vercel deployment after a release.
  const configuredOrigin =
    process.env.NEXT_PUBLIC_SITE_URL
      ?.trim();

  if (
    configuredOrigin
  ) {
    const normalised =
      normaliseOrigin(
        configuredOrigin,
      );

    if (
      normalised
    ) {
      return normalised;
    }
  }

  const vercelHost =
    process.env.VERCEL_URL
      ?.trim();

  return vercelHost
    ? normaliseOrigin(
        `https://${vercelHost}`,
      )
    : null;
}

function checkoutErrorMessage(
  error: unknown,
) {
  if (
    typeof error ===
    "string"
  ) {
    return error.trim() || null;
  }

  if (
    error &&
    typeof error ===
      "object" &&
    "message" in error &&
    typeof error.message ===
      "string"
  ) {
    return error.message.trim() || null;
  }

  return null;
}

async function completeCheckoutAndSendEmail({
  origin,
  slug,
  sessionId,
}: {
  origin: string;
  slug: string;
  sessionId: string;
}) {
  const completionUrl =
    new URL(
      `/api/lottery/${encodeURIComponent(
        slug,
      )}/checkout`,
      origin,
    );

  completionUrl.searchParams.set(
    "payment",
    "success",
  );

  completionUrl.searchParams.set(
    "session_id",
    sessionId,
  );

  completionUrl.searchParams.set(
    "response",
    "json",
  );

  const response =
    await fetch(
      completionUrl,
      {
        method:
          "GET",

        cache:
          "no-store",

        headers: {
          Accept:
            "application/json",
        },
      },
    );

  const responseBody =
    await response.text();

  let data: CheckoutCompletion;

  try {
    data =
      JSON.parse(
        responseBody,
      ) as CheckoutCompletion;
  } catch {
    console.error(
      "Lottery checkout completion returned a non-JSON response:",
      {
        status: response.status,
        contentType:
          response.headers.get(
            "content-type",
          ),
        bodyPreview:
          responseBody.slice(
            0,
            500,
          ),
      },
    );

    throw new Error(
      "We could not finalise your lottery entry yet. Your payment is safe; please contact us if your confirmation does not arrive shortly.",
    );
  }

  if (
    !response.ok ||
    !data.ok
  ) {
    console.error(
      "Lottery checkout completion API returned an error:",
      {
        status: response.status,
        code: data.code,
        error: data.error,
      },
    );

    throw new Error(
      checkoutErrorMessage(
        data.error,
      ) ||
        "We could not finalise your lottery entry yet. Your payment is safe; please contact us if your confirmation does not arrive shortly.",
    );
  }

  return data;
}

async function loadConfirmedOrder(
  session: Stripe.Checkout.Session,
) {
  const orderId =
    session.metadata?.order_id
      ?.trim();

  const lotteryId =
    session.metadata?.lottery_id
      ?.trim();

  let query =
    supabaseAdmin
      .from(
        "lottery_orders",
      )
      .select(
        "order_reference",
      );

  if (
    orderId
  ) {
    query =
      query.eq(
        "id",
        orderId,
      );

    if (
      lotteryId
    ) {
      query =
        query.eq(
          "lottery_id",
          lotteryId,
        );
    }
  } else {
    query =
      query.eq(
        "payment_reference",
        session.id,
      );
  }

  const {
    data,
    error,
  } =
    await query
      .limit(
        1,
      )
      .maybeSingle();

  if (
    error
  ) {
    console.error(
      "Lottery checkout order lookup failed:",
      error,
    );

    return null;
  }

  return (
    data ||
    null
  ) as ConfirmedOrder | null;
}

export default async function LotteryCheckoutPage({
  params,
  searchParams,
}: CheckoutPageProps) {
  const {
    slug,
  } =
    await params;

  const query =
    await searchParams;

  const sessionId =
    typeof query.session_id ===
      "string"
      ? query.session_id.trim()
      : "";

  let paymentConfirmed =
    false;

  let orderReference =
    "";

  let emailStatus:
    | "sent"
    | "failed"
    | "unknown" =
    "unknown";

  if (
    query.payment ===
      "success" &&
    sessionId
  ) {
    try {
      const session =
        await stripe.checkout.sessions.retrieve(
          sessionId,
        );

      paymentConfirmed =
        session.payment_status ===
          "paid" &&
        session.metadata?.type ===
          "burton_pride_lottery" &&
        session.metadata?.lottery_slug ===
          slug;

      if (
        paymentConfirmed
      ) {
        const origin =
          await getRequestOrigin();

        if (
          origin
        ) {
          try {
            const completion =
              await completeCheckoutAndSendEmail({
                origin,
                slug,
                sessionId,
              });

            orderReference =
              completion.order_reference
                ?.trim() ||
              "";

            emailStatus =
              completion.email_status ||
              "unknown";
          } catch (
            completionError
          ) {
            console.error(
              "Lottery checkout finalisation failed:",
              completionError,
            );
          }
        }

        const order =
          await loadConfirmedOrder(
            session,
          );

        orderReference =
          orderReference ||
          order?.order_reference ||
          session.metadata?.order_reference
            ?.trim() ||
          "";
      }
    } catch (
      error
    ) {
      console.error(
        "Lottery checkout confirmation verification failed:",
        error,
      );
    }
  }

  if (
    !paymentConfirmed
  ) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-3xl items-center justify-center px-4 pb-20 pt-28 sm:px-6 sm:pt-32">
        <section className="w-full rounded-[2rem] border border-red-200 bg-white p-8 text-center shadow-xl dark:border-red-300/20 dark:bg-[#111827] sm:p-10">
          <XCircle className="mx-auto h-12 w-12 text-red-500" />

          <h1 className="mt-5 text-3xl font-black text-slate-950 dark:text-white">
            We could not confirm your payment
          </h1>

          <p className="mx-auto mt-4 max-w-xl leading-7 text-slate-600 dark:text-white/65">
            Your lottery entry has not been shown as completed on this page.
            If you cancelled the payment, you can return to the lottery and
            try again.
          </p>

          <Link
            href={`/Lottery/${encodeURIComponent(
              slug,
            )}`}
            className="mt-7 inline-flex min-h-12 items-center justify-center rounded-full bg-yellow-300 px-6 py-3 font-black text-purple-950 transition hover:bg-yellow-200"
          >
            Return to lottery
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-4xl items-center justify-center px-4 pb-20 pt-28 sm:px-6 sm:pt-32">
      <section className="w-full overflow-hidden rounded-[2.25rem] border border-slate-200 bg-white text-center shadow-2xl dark:border-white/10 dark:bg-[#111827]">
        <div className="bg-gradient-to-r from-pink-500 via-purple-600 to-blue-600 px-6 py-10 text-center text-white sm:px-10">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/15 backdrop-blur">
            <CheckCircle2 className="h-12 w-12 text-yellow-300" />
          </div>

          <p className="mt-5 text-sm font-black uppercase tracking-[0.18em] text-yellow-200">
            Payment successful
          </p>

          <h1 className="mt-2 text-3xl font-black sm:text-4xl">
            You have been entered into the lottery
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/85 sm:text-lg">
            Thank you for supporting Burton Pride. Your payment has been
            confirmed and your lottery entry has been received.
          </p>
        </div>

        <div className="grid gap-5 p-6 sm:p-10 md:grid-cols-2">
          <div className="md:col-span-2 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-center dark:border-blue-300/20 dark:bg-blue-500/10">
            <ReceiptText className="mx-auto h-7 w-7 text-blue-700 dark:text-blue-300" />

            <h2 className="mt-4 text-lg font-black text-slate-950 dark:text-white">
              Your order number
            </h2>

            {orderReference ? (
              <p className="mx-auto mt-3 w-fit rounded-xl border border-blue-200 bg-white px-5 py-3 font-mono text-lg font-black tracking-wide text-blue-950 dark:border-blue-300/20 dark:bg-white/10 dark:text-blue-100">
                {orderReference}
              </p>
            ) : (
              <p className="mt-2 leading-7 text-slate-600 dark:text-white/65">
                Your order number is included in your confirmation email.
              </p>
            )}

            <p className="mt-3 leading-7 text-slate-600 dark:text-white/65">
              Keep this order number safe. It is also included in your
              confirmation email with your lottery ticket number
              or numbers.
            </p>
          </div>

          <div className="rounded-2xl border border-purple-200 bg-purple-50 p-5 text-center dark:border-purple-300/20 dark:bg-purple-500/10">
            <Mail className="mx-auto h-7 w-7 text-purple-700 dark:text-purple-300" />

            <h2 className="mt-4 text-lg font-black text-slate-950 dark:text-white">
              Check your email
            </h2>

            <p className="mt-2 leading-7 text-slate-600 dark:text-white/65">
              {emailStatus ===
              "failed"
                ? "Your entry is complete, but we could not confirm that the email was sent. Please use the contact information below."
                : emailStatus ===
                    "sent"
                  ? "We have sent one confirmation email containing your order number and all your lottery ticket numbers."
                  : "Your confirmation email is being prepared. It will contain your order number and all your lottery ticket numbers."}
            </p>
          </div>

          <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center dark:border-green-300/20 dark:bg-green-500/10">
            <Ticket className="mx-auto h-7 w-7 text-green-700 dark:text-green-300" />

            <h2 className="mt-4 text-lg font-black text-slate-950 dark:text-white">
              Keep your lottery numbers safe
            </h2>

            <p className="mt-2 leading-7 text-slate-600 dark:text-white/65">
              Each lottery number is one separate entry. Keep the confirmation
              email until the draw has taken place.
            </p>
          </div>

          <div className="md:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center dark:border-amber-300/20 dark:bg-amber-500/10">
            <Mail className="mx-auto h-7 w-7 text-amber-700 dark:text-amber-300" />

            <h2 className="mt-4 text-lg font-black text-slate-950 dark:text-white">
              Have you not received your lottery ticket email?
            </h2>

            <p className="mx-auto mt-2 max-w-2xl leading-7 text-slate-600 dark:text-white/65">
              Please check your spam or junk folder first. If the email has
              still not arrived, contact Burton Pride at{" "}
              <a
                href="mailto:info@burtonpride.co.uk"
                className="font-black text-purple-700 underline decoration-2 underline-offset-4 hover:text-purple-900 dark:text-purple-300 dark:hover:text-purple-200"
              >
                info@burtonpride.co.uk
              </a>
              . Include your order number so the team can help you quickly.
            </p>
          </div>

          <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center dark:border-white/10 dark:bg-white/[0.04]">
            <ShieldCheck className="mx-auto h-6 w-6 text-purple-700 dark:text-purple-300" />

            <h2 className="mt-3 font-black text-slate-950 dark:text-white">
              Your entry is complete
            </h2>

            <p className="mx-auto mt-2 max-w-2xl leading-7 text-slate-600 dark:text-white/65">
              You do not need to make another payment or submit the form
              again. Your existing checkout process securely issues the ticket
              numbers and sends the confirmation email once.
            </p>
          </div>

          <div className="md:col-span-2 flex flex-wrap justify-center gap-3 pt-2">
            <Link
              href={`/Lottery/${encodeURIComponent(
                slug,
              )}`}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-yellow-300 px-6 py-3 font-black text-purple-950 transition hover:bg-yellow-200"
            >
              Back to this lottery
            </Link>

            <Link
              href="/Lottery"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-purple-200 bg-purple-50 px-6 py-3 font-black text-purple-800 transition hover:bg-purple-100 dark:border-purple-300/20 dark:bg-purple-500/10 dark:text-purple-200"
            >
              View all lotteries
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
