import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, Home, Ticket, Heart, ShieldCheck } from "lucide-react";

type PageProps = {
  searchParams?: Promise<{
    session_id?: string;
  }>;
};

export const metadata = {
  title: "Raffle Payment Successful | Burton Pride",
  description:
    "Thank you for buying raffle tickets and supporting Burton Pride C.I.C.",
};

export default async function RaffleSuccessPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const sessionId = params?.session_id || "";

  return (
    <main className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 px-4 py-16 text-white sm:px-8">
      <section className="mx-auto flex max-w-5xl flex-col items-center rounded-[2rem] border border-white/20 bg-white/10 p-6 text-center shadow-2xl backdrop-blur-xl sm:p-10">
        <div className="mb-8 flex h-28 w-28 items-center justify-center rounded-full border-4 border-white bg-white p-3 shadow-2xl shadow-pink-400/40 sm:h-36 sm:w-36">
          <div className="relative h-full w-full overflow-hidden rounded-full">
            <Image
              src="/image/Logo.png"
              alt="Burton Pride Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>

        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white text-purple-700 shadow-xl">
          <CheckCircle2 className="h-12 w-12" />
        </div>

        <h1 className="text-4xl font-black drop-shadow-lg sm:text-6xl">
          Thank You For Buying Raffle Tickets
        </h1>

        <p className="mt-5 max-w-3xl text-lg leading-8 text-white/90 sm:text-xl">
          Your raffle payment has been received successfully. Thank you for
          supporting Burton Pride C.I.C and helping us keep Pride grassroots,
          ethical, community-led, and created by the community, for the
          community.
        </p>

        {sessionId && (
          <div className="mt-6 max-w-3xl rounded-2xl border border-white/20 bg-black/20 p-4 text-left">
            <p className="text-sm font-bold text-white/70">
              Stripe checkout reference
            </p>
            <p className="mt-1 break-all text-sm text-white/90">{sessionId}</p>
          </div>
        )}

        <div className="mt-10 grid w-full gap-5 text-left md:grid-cols-3">
          <div className="rounded-3xl border border-white/20 bg-white/10 p-6 shadow-xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
              <Ticket className="h-6 w-6 text-white" />
            </div>

            <h2 className="text-2xl font-black">Your Entry</h2>

            <p className="mt-3 leading-7 text-white/85">
              Your raffle entry will be confirmed once Stripe sends payment
              confirmation to our system. Only paid raffle entries are included
              in the official draw.
            </p>
          </div>

          <div className="rounded-3xl border border-white/20 bg-white/10 p-6 shadow-xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>

            <h2 className="text-2xl font-black">Draw Date</h2>

            <p className="mt-3 leading-7 text-white/85">
              Winning tickets will be announced at Burton Pride 2026 on{" "}
              <strong>27th June 2026</strong>. Winners will be contacted using
              the details provided.
            </p>
          </div>

          <div className="rounded-3xl border border-white/20 bg-white/10 p-6 shadow-xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
              <Heart className="h-6 w-6 text-white" />
            </div>

            <h2 className="text-2xl font-black">Community First</h2>

            <p className="mt-3 leading-7 text-white/85">
              Burton Pride C.I.C does not take raffle money for personal gain.
              Money raised goes back into community benefit and local LGBTQIA+
              support.
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/Raffle"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-lg font-black text-purple-700 shadow-lg transition hover:scale-105 active:scale-[0.98]"
          >
            <Ticket className="h-5 w-5" />
            Back To Raffle
          </Link>

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 bg-black/20 px-8 py-4 text-lg font-black text-white shadow-lg transition hover:scale-105 hover:bg-black/30 active:scale-[0.98]"
          >
            <Home className="h-5 w-5" />
            Back To Home
          </Link>
        </div>

        <p className="mt-8 max-w-2xl text-sm leading-6 text-white/75">
          Please keep your payment confirmation for your records. If you have
          any questions about your raffle entry, contact Burton Pride C.I.C
          through our official contact details.
        </p>
      </section>
    </main>
  );
}