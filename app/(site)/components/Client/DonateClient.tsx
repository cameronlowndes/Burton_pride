"use client";

import Image from "next/image";
import { useState } from "react";

const amounts = ["£5", "£10", "£20", "£50", "£100", "Custom"];

export default function DonationsContent() {
  const [selectedAmount, setSelectedAmount] = useState<string>("£10");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [customAmount, setCustomAmount] = useState("10");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleDonate() {
    try {
      setLoading(true);

      const res = await fetch("/api/stripe/donate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          email,
          message,
          selectedAmount,
          customAmount,
        }),
      });

      const text = await res.text();
      console.log("Donate API response:", text);

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("API did not return JSON. Check /api/stripe/donate route.");
      }

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to start donation");
      }

      if (!data.url) {
        throw new Error("Stripe checkout URL was not returned");
      }

      window.location.href = data.url;
    } catch (error) {
      console.error("Donate button error:", error);
      alert(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-r from-pink-600 via-fuchsia-500 to-blue-600 px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 flex flex-col items-center text-center">
          <div className="mb-5 flex h-28 w-28 items-center justify-center rounded-full border-4 border-white/20 bg-white/10 shadow-2xl backdrop-blur-xl">
            <Image
              src="/image/Logo.png"
              alt="Burton Pride"
              width={90}
              height={90}
              className="rounded-full object-cover"
            />
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Donate To Burton Pride
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-white/80">
            Help support Burton Pride and keep building inclusive events, safer
            spaces, and real community support in Burton on Trent.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <section className="rounded-[28px] bg-white/14 p-10 shadow-2xl backdrop-blur-xl">
            <h2 className="text-4xl font-bold leading-tight text-yellow-300">
              Why Donate To Burton Pride C.I.C?
            </h2>

            <div className="mt-7 space-y-6 text-xl leading-10 text-white/90">
              <p>
                Burton Pride C.I.C is a fully community-led, grassroots Pride
                organisation, created by local people who care deeply about
                Burton and the people who live here. It was founded with a clear
                purpose: to build something real, inclusive, and meaningful for
                the local LGBTQIA+ community and its allies.
              </p>

              <p>
                We are not backed by large corporations, and that is a conscious
                choice. Burton Pride was built from the ground up by the
                community, for the community. Every step of our journey has been
                shaped by local voices, volunteers, supporters, and people who
                believe Burton deserves a Pride rooted in authenticity,
                visibility, and belonging.
              </p>

              <p>
                As an ethical Community Interest Company (C.I.C), Burton Pride
                does not use donations for personal gain or private profit. No
                individual benefits personally from the generosity of our
                supporters. Every donation we receive is handled responsibly and
                reinvested directly back into the community to create positive
                impact where it matters most.
              </p>

              <p>
                Being grassroots means we rely on people power, community spirit,
                and genuine support rather than corporate influence. It allows us
                to stay independent, listen to the needs of local people, and
                make decisions that truly reflect our community.
              </p>

              <p>
                Every donation helps us fund safer spaces, accessibility
                improvements, outreach work, wellbeing support, entertainment,
                education, venue costs, safety measures, and welcoming Pride
                events that everyone can enjoy regardless of background or
                circumstance.
              </p>

              <p>
                Our team works tirelessly behind the scenes to deliver inclusive
                and uplifting community events, organising everything from
                planning and fundraising to logistics and volunteer coordination.
                Everything we do is driven by passion, pride, and purpose — not
                profit.
              </p>

              <p>
                When you donate to Burton Pride, you can do so knowing your
                support stays within the community and helps build a stronger,
                safer, and more inclusive future for Burton on Trent.
              </p>

              <p className="font-bold text-yellow-300">
                The people. The heart. The community spirit.
              </p>
            </div>
          </section>

          <section className="rounded-[28px] bg-white/14 p-10 shadow-2xl backdrop-blur-xl">
            <h2 className="text-4xl font-bold leading-tight text-yellow-300">
              Make A Donation
            </h2>

            <div className="mt-7 space-y-5">
              <input
                type="text"
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-lg text-white placeholder:text-white/50 outline-none"
              />

              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-lg text-white placeholder:text-white/50 outline-none"
              />

              <input
                type="number"
                placeholder="Donation Amount (£)"
                value={selectedAmount === "Custom" ? customAmount : selectedAmount.replace("£", "")}
                onChange={(e) => {
                  setSelectedAmount("Custom");
                  setCustomAmount(e.target.value);
                }}
                className="w-full rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-lg text-white placeholder:text-white/50 outline-none"
              />

              <div className="grid grid-cols-3 gap-3">
                {amounts.map((item) => {
                  const active = selectedAmount === item;

                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setSelectedAmount(item);
                        if (item !== "Custom") {
                          setCustomAmount(item.replace("£", ""));
                        } else {
                          setCustomAmount("");
                        }
                      }}
                      className={`rounded-2xl px-4 py-4 text-lg font-semibold transition ${
                        active
                          ? "border border-white bg-white text-fuchsia-700 shadow-xl scale-105"
                          : "border border-white/15 bg-white/10 text-white hover:bg-white/20"
                      }`}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>

              <textarea
                placeholder="Message of support (optional)"
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-lg text-white placeholder:text-white/50 outline-none"
              />

              <button
                type="button"
                onClick={handleDonate}
                disabled={loading}
                className="w-full rounded-2xl bg-white px-5 py-4 text-xl font-bold text-fuchsia-700 transition hover:bg-white/95 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Redirecting..." : "Donate Now"}
              </button>

              <p className="text-center text-sm text-white/70">
                Secure payments powered by Stripe
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}