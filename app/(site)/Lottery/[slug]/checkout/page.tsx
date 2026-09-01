import Link from "next/link";
import Stripe from "stripe";
import {
  CheckCircle2,
  Mail,
  ShieldCheck,
  Ticket,
  XCircle,
} from "lucide-react";

type CheckoutPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    payment?: string;
    session_id?: string;
  }>;
};

export const metadata = {
  title: "Lottery Entry Confirmed | Burton Pride",
  description:
    "Confirmation that your Burton Pride lottery entry has been received.",
};

export const dynamic = "force-dynamic";

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY!,
);

export default async function LotteryCheckoutPage({
  params,
  searchParams,
}: CheckoutPageProps) {
  const { slug } = await params;
  const query = await searchParams;

  const sessionId =
    typeof query.session_id === "string"
      ? query.session_id.trim()
      : "";

  let paymentConfirmed = false;

  if (
    query.payment === "success" &&
    sessionId
  ) {
    try {
      const session =
        await stripe.checkout.sessions.retrieve(
          sessionId,
        );

      paymentConfirmed =
        session.payment_status === "paid" &&
        session.metadata?.type ===
          "burton_pride_lottery" &&
        session.metadata?.lottery_slug ===
          slug;
    } catch (error) {
      console.error(
        "Lottery checkout confirmation verification failed:",
        error,
      );
    }
  }

  if (!paymentConfirmed) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center px-4 py-20 sm:px-6">
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
    <main className="mx-auto flex min-h-[75vh] w-full max-w-4xl items-center px-4 py-20 sm:px-6">
      <section className="w-full overflow-hidden rounded-[2.25rem] border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#111827]">
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
          <div className="rounded-2xl border border-purple-200 bg-purple-50 p-5 dark:border-purple-300/20 dark:bg-purple-500/10">
            <Mail className="h-7 w-7 text-purple-700 dark:text-purple-300" />

            <h2 className="mt-4 text-lg font-black text-slate-950 dark:text-white">
              Check your email
            </h2>

            <p className="mt-2 leading-7 text-slate-600 dark:text-white/65">
              We have sent you a confirmation email with your lottery number.
            </p>
          </div>

          <div className="rounded-2xl border border-green-200 bg-green-50 p-5 dark:border-green-300/20 dark:bg-green-500/10">
            <Ticket className="h-7 w-7 text-green-700 dark:text-green-300" />

            <h2 className="mt-4 text-lg font-black text-slate-950 dark:text-white">
              Keep your lottery number safe
            </h2>

            <p className="mt-2 leading-7 text-slate-600 dark:text-white/65">
              Your lottery number is your entry reference. Keep the confirmation
              email until the draw has taken place.
            </p>
          </div>

          <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-purple-700 dark:text-purple-300" />

              <div>
                <h2 className="font-black text-slate-950 dark:text-white">
                  Your entry is complete
                </h2>

                <p className="mt-2 leading-7 text-slate-600 dark:text-white/65">
                  You do not need to make another payment or submit the form
                  again. If your confirmation email does not arrive, please
                  check your spam or junk folder.
                </p>
              </div>
            </div>
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
