import Stripe from "stripe";
import { redirect } from "next/navigation";
import DriveUploader from "./DriveUploader";

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

  // 🔒 Block direct access
  if (!sessionId) redirect("/Competition");

  const session = await stripe.checkout.sessions.retrieve(sessionId);

  // 🔒 Only allow if paid
  if (session.payment_status !== "paid") redirect("/Competition");

  const email = session.customer_email ?? "unknown";

  return (
    <div className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white">
      <div className="mx-auto max-w-4xl px-6 py-10 sm:py-14">
        {/* Header */}
        <div className="text-center pt-10">
          <div className="mx-auto mt-8 mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur shadow-lg">
            <span className="text-4xl">✅</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight drop-shadow">
            Payment successful
          </h1>

          <p className="mt-4 text-white/90 text-base sm:text-lg max-w-2xl mx-auto">
            Thanks for your entry — your payment is confirmed.
            <br className="hidden sm:block" />
            Next step: upload your competition image below.
          </p>
        </div>

        {/* Main Card */}
        <div className="mt-10 grid gap-6">
          <div className="rounded-2xl bg-white/10 border border-white/20 backdrop-blur p-6 sm:p-7 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-sm text-white/70">Paid email</p>
                <p className="text-lg font-semibold">{email}</p>
              </div>

              <div className="flex gap-3">
                <a
                  href="/Competition"
                  className="inline-flex items-center justify-center rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/25 transition"
                >
                  Back to competition
                </a>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-black/10 border border-white/10 p-4">
                <p className="text-sm font-semibold">1) Upload image</p>
                <p className="mt-1 text-sm text-white/70">
                  Add your receipt / entry image.
                </p>
              </div>

              <div className="rounded-xl bg-black/10 border border-white/10 p-4">
                <p className="text-sm font-semibold">2) We verify</p>
                <p className="mt-1 text-sm text-white/70">
                  We match upload to your payment email.
                </p>
              </div>

              <div className="rounded-xl bg-black/10 border border-white/10 p-4">
                <p className="text-sm font-semibold">3) You’re in</p>
                <p className="mt-1 text-sm text-white/70">
                  Your entry is confirmed once uploaded.
                </p>
              </div>
            </div>
          </div>

          {/* Upload Area */}
          <div className="rounded-2xl bg-white text-black shadow-2xl overflow-hidden">
            <div className="p-6 sm:p-7 border-b">
              <h2 className="text-xl sm:text-2xl font-bold">
                Upload your competition image
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Use the same email you paid with. Accepted: JPG / PNG / WebP (max 10MB).
              </p>
            </div>

            <div className="p-6 sm:p-7">
              {/* sessionId is guaranteed here because we redirect if missing */}
              <DriveUploader sessionId={sessionId} email={email} />
            </div>

            <div className="px-6 sm:px-7 py-4 bg-gray-50 text-sm text-gray-600">
              Tip: If you uploaded the wrong image, just upload again and tell us your
              paid email — we’ll use the latest one.
            </div>
          </div>

          <p className="text-center text-sm text-white/70">
            Please upload using the same email used for payment.
          </p>
        </div>
      </div>
    </div>
  );
}
