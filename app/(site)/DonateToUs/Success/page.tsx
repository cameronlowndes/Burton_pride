"use client";

import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, Heart, ArrowLeft } from "lucide-react";

export default function DonateSuccessPage() {
  return (
    <main className="min-h-screen bg-gradient-to-r from-pink-600 via-fuchsia-500 to-blue-600 px-6 py-16 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-[32px] border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur-xl sm:p-12">
          <div className="flex flex-col items-center text-center">
            <div className="mb-6 flex h-28 w-28 items-center justify-center rounded-full border-4 border-white/20 bg-white/10 shadow-2xl">
              <Image
                src="/image/Logo.png"
                alt="Burton Pride"
                width={90}
                height={90}
                className="rounded-full object-cover"
              />
            </div>

            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-white text-fuchsia-700 shadow-xl">
              <CheckCircle2 className="h-10 w-10" />
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
              Thank You For Your Donation
            </h1>

            <p className="mt-4 max-w-2xl text-lg text-white/85 sm:text-xl">
              Your donation has been received successfully. Thank you for
              supporting Burton Pride C.I.C and helping us build inclusive
              events, safer spaces, and real community support in Burton on
              Trent.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="rounded-[24px] border border-white/15 bg-white/10 p-6 shadow-lg">
              <div className="mb-4 flex items-center gap-3">
                <Heart className="h-6 w-6 text-yellow-300" />
                <h2 className="text-2xl font-bold text-yellow-300">
                  Your Support Matters
                </h2>
              </div>

              <div className="space-y-4 text-base leading-7 text-white/90">
                <p>
                  Burton Pride is a grassroots, community-led organisation built
                  by local people, for local people.
                </p>

                <p>
                  Every donation helps us invest back into the community through
                  accessibility, outreach, wellbeing support, safer spaces,
                  entertainment, education, and inclusive Pride events.
                </p>

                <p>
                  As a Community Interest Company, our focus is community impact.
                  Your support helps us continue creating something meaningful,
                  welcoming, and rooted in genuine community spirit.
                </p>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/15 bg-white/10 p-6 shadow-lg">
              <h2 className="text-2xl font-bold text-yellow-300">
                What Happens Next
              </h2>

              <div className="mt-4 space-y-4 text-base leading-7 text-white/90">
                <p>
                  You should receive a thank-you email shortly confirming your
                  donation.
                </p>

                <p>
                  Our team will also receive a notification so we can keep a
                  clear record of all support coming into Burton Pride.
                </p>

                <p>
                  Thank you for being part of something special for the Burton
                  on Trent community.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/DonateToUs"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-lg font-bold text-fuchsia-700 transition hover:bg-white/95"
            >
              <ArrowLeft className="h-5 w-5" />
              Back To Donate Page
            </Link>

            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-6 py-4 text-lg font-semibold text-white transition hover:bg-white/20"
            >
              Back To Home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}