import Stripe from "stripe";
import { redirect } from "next/navigation";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-08-16" as any,
});

type SearchParams = { session_id?: string };

export default async function SuccessPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const sessionId = sp?.session_id;

  if (!sessionId) redirect("/Competition");

  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== "paid") redirect("/Competition");

  const email = session.customer_email ?? "unknown";

  return (
    <div className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex items-center justify-center px-4">

      <div className="w-full max-w-5xl animate-fadeIn">

        <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-white/10 backdrop-blur-2xl shadow-[0_25px_60px_rgba(0,0,0,0.4)]">

          {/* Soft glow background */}
          <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-black/20 blur-3xl" />

          <div className="relative p-8 sm:p-12">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">

              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur shadow-xl ring-1 ring-white/30">
                  <span className="text-4xl">🎉</span>
                </div>

                <div>
                  <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight drop-shadow-lg">
                    Payment Confirmed
                  </h1>
                  <p className="mt-1 text-white/85 text-sm sm:text-base">
                    Your Windows of Hope Competition entry has been successfully submitted.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <a
                  href="/Competition"
                  className="rounded-xl bg-white/15 px-5 py-2.5 text-sm font-semibold hover:bg-white/25 transition shadow-lg"
                >
                  Back to competition
                </a>

                <a
                  href="/"
                  className="rounded-xl bg-black/20 px-5 py-2.5 text-sm font-semibold hover:bg-black/30 transition border border-white/10"
                >
                  Go to home
                </a>
              </div>
            </div>

            {/* Info Row */}
            <div className="mt-10 grid gap-5 sm:grid-cols-3">

              <InfoCard title="Payment email" value={email} />
              <InfoCard title="Status" value="Paid ✅" />
              <InfoCard title="Next stage" value="Committee review" />

            </div>

            {/* Next Steps */}
            <div className="mt-10 rounded-3xl border border-white/20 bg-white/5 p-8">

              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-2xl font-bold">What happens next</h2>
                <span className="text-xs bg-white/15 border border-white/20 px-3 py-1.5 rounded-full text-white/80">
                  Burton Pride C.I.C
                </span>
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-3">

                <StepCard
                  title="1) Entry Received"
                  desc="Your entry is securely stored and linked to your payment."
                />

                <StepCard
                  title="2) Committee Review"
                  desc="Our team will review your submission and approve it."
                />

                <StepCard
                  title="3) Showcase"
                  desc="Approved entries may appear in the public Window Showcase."
                />

              </div>
            </div>

            {/* Footer Help */}
            <div className="mt-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-white/15 bg-black/15 p-5">
              <div>
                <div className="font-semibold">Need help?</div>
                <div className="text-sm text-white/75">
                  Reply to your confirmation email or contact the committee.
                </div>
              </div>

              <div className="text-sm text-white/85">
                Tip: Save this page as proof of payment if needed.
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-black/15 p-5 backdrop-blur">
      <div className="text-xs text-white/70">{title}</div>
      <div className="mt-1 font-semibold break-all">{value}</div>
    </div>
  );
}

function StepCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-black/10 p-5">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-2 text-sm text-white/75">{desc}</div>
    </div>
  );
}