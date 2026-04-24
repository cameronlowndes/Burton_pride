"use client";

import Image from "next/image";
import { useState } from "react";
import CommitteeSection from "../Card/CommitteeSection";

type DonationType = "one_time" | "monthly";

const oneTimeAmounts = ["£5", "£10", "£20", "£50", "£100", "Custom"];
const monthlyAmounts = ["£3", "£5", "£10", "£20", "£50", "Custom"];

export default function DonationsContent() {
  const [donationType, setDonationType] = useState<DonationType>("one_time");
  const [selectedAmount, setSelectedAmount] = useState<string>("£10");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [customAmount, setCustomAmount] = useState("10");
  const [message, setMessage] = useState("");
  const [supporterStory, setSupporterStory] = useState("");
  const [supporterImage, setSupporterImage] = useState<File | null>(null);
  const [supporterImagePreview, setSupporterImagePreview] = useState("");
  const [loading, setLoading] = useState(false);

  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [amountError, setAmountError] = useState("");
  const [serverError, setServerError] = useState("");

  const amounts = donationType === "monthly" ? monthlyAmounts : oneTimeAmounts;

  function switchDonationType(type: DonationType) {
    setDonationType(type);
    setServerError("");
    setAmountError("");

    if (type === "monthly") {
      setSelectedAmount("£5");
      setCustomAmount("5");
    } else {
      setSelectedAmount("£10");
      setCustomAmount("10");
      setSupporterStory("");
      setSupporterImage(null);
      setSupporterImagePreview("");
    }
  }

  function handleSupporterImage(file: File | null) {
    setSupporterImage(file);

    if (!file) {
      setSupporterImagePreview("");
      return;
    }

    const reader = new FileReader();

    reader.onloadend = () => {
      setSupporterImagePreview(String(reader.result || ""));
    };

    reader.readAsDataURL(file);
  }

  function fillTestDetails() {
    setFullName("Burton Pride Test");
    setEmail("burtonpridetest@gmail.com");
    setMessage("This is a Stripe donation test.");
    setSupporterStory(
      "I support Burton Pride because everyone deserves to feel safe, seen, celebrated, and included."
    );
    setDonationType("monthly");
    setSelectedAmount("£5");
    setCustomAmount("5");
    setNameError("");
    setEmailError("");
    setAmountError("");
    setServerError("");
  }

  async function handleDonate() {
    try {
      let hasError = false;

      setNameError("");
      setEmailError("");
      setAmountError("");
      setServerError("");

      const amount =
        selectedAmount === "Custom"
          ? Number(customAmount)
          : Number(selectedAmount.replace("£", ""));

      if (!fullName.trim()) {
        setNameError("Please enter your full name");
        hasError = true;
      }

      if (!email.trim()) {
        setEmailError("Please enter your email address");
        hasError = true;
      }

      if (!amount || amount < 1) {
        setAmountError("Please enter a donation amount of at least £1");
        hasError = true;
      }

      if (hasError) return;

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
          supporterStory,
          supporterImagePreview,
          supporterImageName: supporterImage?.name || "",
          selectedAmount,
          customAmount,
          donationType,
        }),
      });

      const text = await res.text();
      console.log("Donate API response:", text);

      let data;

      try {
        data = JSON.parse(text);
      } catch {
        setServerError(
          "API did not return JSON. Check /api/stripe/donate route."
        );
        return;
      }

      if (!res.ok || !data.ok) {
        setServerError(data.error || "Failed to start donation");
        return;
      }

      if (!data.url) {
        setServerError("Stripe checkout URL was not returned");
        return;
      }

      window.location.href = data.url;
    } catch (error) {
      console.error("Donate button error:", error);
      setServerError(
        error instanceof Error ? error.message : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br py-16 text-white">
      <div className="mx-auto max-w-6xl px-5">
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
            {donationType === "monthly" ? (
              <>
                <h2 className="text-4xl font-bold leading-tight text-yellow-300">
                  Become A Monthly Pride Supporter
                </h2>

                <div className="mt-7 space-y-6 text-xl leading-10 text-white/90">
                  <p>
                    Monthly support gives Burton Pride C.I.C something
                    incredibly valuable: stability, strength, and the ability to
                    plan for the future with confidence. Instead of relying only
                    on short-term fundraising close to event season, regular
                    monthly donations help us build a stronger year-round
                    foundation for the community we serve.
                  </p>

                  <p>
                    Burton Pride is a fully community-led, grassroots Pride
                    organisation, created by local people who care deeply about
                    Burton on Trent and the people who live here. We are proud
                    to be created by the community, for the community. We are
                    not backed by large corporations, and that is a conscious
                    choice. It allows us to remain independent, authentic, and
                    focused on the real needs of our local LGBTQIA+ community
                    and its allies.
                  </p>

                  <p>
                    Every monthly donation helps fund safer spaces,
                    accessibility improvements, outreach work, wellbeing
                    support, community events, education, entertainment,
                    insurance, venue costs, equipment, and the practical
                    essentials needed to deliver Pride successfully.
                  </p>

                  <p>
                    Regular monthly support gives us the confidence to organise
                    bigger and better events, improve inclusion, invest in
                    long-term community projects, and continue building
                    something meaningful that lasts beyond a single day of
                    celebration.
                  </p>

                  <p>
                    Even a small monthly donation can make a real difference.
                    Just a few pounds each month helps create lasting impact,
                    supports ongoing community work, and keeps Pride accessible,
                    welcoming, and powered by local people.
                  </p>

                  <p>
                    As an ethical Community Interest Company (C.I.C), Burton
                    Pride does not use donations for personal gain or private
                    profit. No individual benefits personally from the
                    generosity of supporters. Every pound is handled responsibly
                    and reinvested directly back into the community where it
                    matters most.
                  </p>

                  <p>
                    By becoming a monthly supporter, you become part of the
                    heartbeat of Burton Pride. Your support helps create a
                    stronger, safer, and more inclusive future for Burton on
                    Trent.
                  </p>

                  <p className="font-bold text-yellow-300">
                    Small monthly support. Big community impact.
                  </p>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-4xl font-bold leading-tight text-yellow-300">
                  Why Donate To Burton Pride C.I.C?
                </h2>

                <div className="mt-7 space-y-6 text-xl leading-10 text-white/90">
                  <p>
                    Burton Pride C.I.C is a fully community-led, grassroots
                    Pride organisation, created by local people who care deeply
                    about Burton and the people who live here. It was founded
                    with a clear purpose: to build something real, inclusive,
                    and meaningful for the local LGBTQIA+ community and its
                    allies.
                  </p>

                  <p>
                    We are not backed by large corporations, and that is a
                    conscious choice. Burton Pride was built from the ground up
                    by the community, for the community. Every step of our
                    journey has been shaped by local voices, volunteers,
                    supporters, and people who believe Burton deserves a Pride
                    rooted in authenticity, visibility, and belonging.
                  </p>

                  <p>
                    As an ethical Community Interest Company (C.I.C), Burton
                    Pride does not use donations for personal gain or private
                    profit. No individual benefits personally from the
                    generosity of our supporters. Every donation we receive is
                    handled responsibly and reinvested directly back into the
                    community to create positive impact where it matters most.
                  </p>

                  <p>
                    Being grassroots means we rely on people power, community
                    spirit, and genuine support rather than corporate influence.
                    It allows us to stay independent, listen to the needs of
                    local people, and make decisions that truly reflect our
                    community.
                  </p>

                  <p>
                    Every donation helps us fund safer spaces, accessibility
                    improvements, outreach work, wellbeing support,
                    entertainment, education, venue costs, safety measures, and
                    welcoming Pride events that everyone can enjoy regardless of
                    background or circumstance.
                  </p>

                  <p>
                    Our team works tirelessly behind the scenes to deliver
                    inclusive and uplifting community events, organising
                    everything from planning and fundraising to logistics and
                    volunteer coordination. Everything we do is driven by
                    passion, pride, and purpose — not profit.
                  </p>

                  <p>
                    When you donate to Burton Pride, you can do so knowing your
                    support stays within the community and helps build a
                    stronger, safer, and more inclusive future for Burton on
                    Trent.
                  </p>

                  <p className="font-bold text-yellow-300">
                    The people. The heart. The community spirit.
                  </p>
                </div>
              </>
            )}
          </section>

          <section className="rounded-[28px] bg-white/14 p-10 shadow-2xl backdrop-blur-xl">
            <h2 className="text-4xl font-bold leading-tight text-yellow-300">
              Make A Donation
            </h2>

            <div className="mt-7 space-y-5">
              <button
                type="button"
                onClick={fillTestDetails}
                className="w-full rounded-2xl border border-yellow-300 bg-yellow-300 px-5 py-4 text-lg font-bold text-black transition hover:opacity-90"
              >
                Fill Test Details
              </button>

              <div className="grid grid-cols-2 gap-3 rounded-2xl bg-white/10 p-2">
                <button
                  type="button"
                  onClick={() => switchDonationType("one_time")}
                  className={`rounded-xl px-4 py-4 text-lg font-bold transition ${
                    donationType === "one_time"
                      ? "bg-white text-fuchsia-700 shadow-lg"
                      : "text-white hover:bg-white/10"
                  }`}
                >
                  One-Time
                </button>

                <button
                  type="button"
                  onClick={() => switchDonationType("monthly")}
                  className={`rounded-xl px-4 py-4 text-lg font-bold transition ${
                    donationType === "monthly"
                      ? "bg-yellow-300 text-black shadow-lg"
                      : "text-white hover:bg-white/10"
                  }`}
                >
                  Monthly
                </button>
              </div>

              {donationType === "monthly" && (
                <div className="rounded-2xl border border-yellow-300/40 bg-yellow-300/10 px-5 py-4 text-sm font-semibold text-yellow-100">
                  You are setting up a monthly donation to support Burton Pride
                  every month.
                </div>
              )}

              <div>
                <input
                  type="text"
                  placeholder="Full Name *"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    setNameError("");
                  }}
                  className={`w-full rounded-2xl border px-5 py-4 text-lg text-white placeholder:text-white/50 outline-none ${
                    nameError
                      ? "border-red-400 bg-red-500/10"
                      : "border-white/15 bg-white/10"
                  }`}
                />

                {nameError && (
                  <p className="mt-2 text-sm text-red-200">{nameError}</p>
                )}
              </div>

              <div>
                <input
                  type="email"
                  placeholder="Email Address *"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError("");
                  }}
                  className={`w-full rounded-2xl border px-5 py-4 text-lg text-white placeholder:text-white/50 outline-none ${
                    emailError
                      ? "border-red-400 bg-red-500/10"
                      : "border-white/15 bg-white/10"
                  }`}
                />

                {emailError && (
                  <p className="mt-2 text-sm text-red-200">{emailError}</p>
                )}
              </div>

              <div>
                <input
                  type="number"
                  min="1"
                  placeholder={
                    donationType === "monthly"
                      ? "Monthly Donation Amount (£)"
                      : "Donation Amount (£)"
                  }
                  value={
                    selectedAmount === "Custom"
                      ? customAmount
                      : selectedAmount.replace("£", "")
                  }
                  onChange={(e) => {
                    setSelectedAmount("Custom");
                    setCustomAmount(e.target.value);
                    setAmountError("");
                  }}
                  className={`w-full rounded-2xl border px-5 py-4 text-lg text-white placeholder:text-white/50 outline-none ${
                    amountError
                      ? "border-red-400 bg-red-500/10"
                      : "border-white/15 bg-white/10"
                  }`}
                />

                {amountError && (
                  <p className="mt-2 text-sm text-red-200">{amountError}</p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                {amounts.map((item) => {
                  const active = selectedAmount === item;

                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setSelectedAmount(item);
                        setAmountError("");

                        if (item !== "Custom") {
                          setCustomAmount(item.replace("£", ""));
                        } else {
                          setCustomAmount("");
                        }
                      }}
                      className={`rounded-2xl px-4 py-4 text-lg font-semibold transition ${
                        active
                          ? "scale-105 border border-white bg-white text-fuchsia-700 shadow-xl"
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

              {donationType === "monthly" && (
                <div className="space-y-4">
                  <textarea
                    placeholder="Your supporter story (optional) — why do you support Burton Pride?"
                    rows={5}
                    value={supporterStory}
                    onChange={(e) => setSupporterStory(e.target.value)}
                    className="w-full rounded-2xl border border-yellow-300/40 bg-white/10 px-5 py-4 text-lg text-white placeholder:text-white/50 outline-none"
                  />

                  <div className="rounded-2xl border border-yellow-300/40 bg-white/10 p-5">
                    <label className="block text-sm font-bold text-white/80">
                      Upload a picture of yourself optional
                    </label>

                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        handleSupporterImage(e.target.files?.[0] || null)
                      }
                      className="mt-3 block w-full cursor-pointer rounded-xl border border-white/15 bg-white/10 p-3 text-sm text-white file:mr-4 file:rounded-xl file:border-0 file:bg-yellow-300 file:px-4 file:py-2 file:font-bold file:text-black"
                    />

                    <p className="mt-3 text-sm text-white/70">
                      Your picture will only show publicly after Burton Pride
                      approval.
                    </p>
                  </div>

                  <p className="text-sm text-white/70">
                    If approved, your story may appear on the Monthly Supporter
                    Wall.
                  </p>
                </div>
              )}

              {serverError && (
                <div className="rounded-2xl border border-red-300 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {serverError}
                </div>
              )}

              <button
                type="button"
                onClick={handleDonate}
                disabled={loading}
                className="w-full rounded-2xl bg-white px-5 py-4 text-xl font-bold text-fuchsia-700 transition hover:bg-white/95 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading
                  ? "Redirecting..."
                  : donationType === "monthly"
                    ? "Donate Monthly"
                    : "Donate Now"}
              </button>

              <p className="text-center text-sm text-white/70">
                Secure payments powered by Stripe
              </p>
            </div>
          </section>
        </div>

        <section className="mt-16 pb-24">
          <h2 className="mb-8 text-center text-4xl font-black text-black">
            Monthly Supporter Wall Preview
          </h2>

          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            <div className="overflow-hidden rounded-[30px] border border-white/20 bg-white/10 shadow-[0_18px_45px_rgba(0,0,0,0.18)] backdrop-blur-md">
              <div className="relative h-[300px] w-full overflow-hidden bg-purple-900/40">
                {supporterImagePreview ? (
                  <Image
                    src={supporterImagePreview}
                    alt="Supporter preview"
                    fill
                    className="object-cover"
                  />
                ) : (
                  <Image
                    src="/image/Logo.png"
                    alt="Burton Pride supporter"
                    fill
                    className="object-contain p-12"
                  />
                )}
              </div>

              <div className="space-y-4 p-5 text-white">
                <div>
                  <h3 className="text-2xl font-bold">
                    {fullName || "Your Name"}
                  </h3>

                  <p className="mt-1 text-base font-semibold text-white/90">
                    Monthly Pride Supporter
                  </p>
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full border border-white/60 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    View Profile
                  </button>

                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full bg-pink-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-pink-700"
                  >
                    Your Story Preview
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-[30px] border border-white/20 bg-white/10 shadow-[0_18px_45px_rgba(0,0,0,0.18)] backdrop-blur-md">
              <div className="relative h-[300px] w-full overflow-hidden bg-purple-900/40">
                <Image
                  src="/image/Logo.png"
                  alt="Community Ally"
                  fill
                  className="object-contain p-12"
                />
              </div>

              <div className="space-y-4 p-5 text-white">
                <div>
                  <h3 className="text-2xl font-bold">Community Ally</h3>

                  <p className="mt-1 text-base font-semibold text-white/90">
                    Monthly Pride Supporter
                  </p>
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full border border-white/60 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    View Profile
                  </button>

                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full bg-pink-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-pink-700"
                  >
                    Example Story
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-[30px] border border-white/20 bg-white/10 shadow-[0_18px_45px_rgba(0,0,0,0.18)] backdrop-blur-md">
              <div className="relative h-[300px] w-full overflow-hidden bg-purple-900/40">
                <Image
                  src="/image/Logo.png"
                  alt="Local Supporter"
                  fill
                  className="object-contain p-12"
                />
              </div>

              <div className="space-y-4 p-5 text-white">
                <div>
                  <h3 className="text-2xl font-bold">Local Supporter</h3>

                  <p className="mt-1 text-base font-semibold text-white/90">
                    Monthly Pride Supporter
                  </p>
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full border border-white/60 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    View Profile
                  </button>

                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full bg-pink-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-pink-700"
                  >
                    Example Story
                  </button>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-6 text-center text-sm font-semibold text-white/80">
            Supporter stories are optional and only go live after Burton Pride
            approval.
          </p>
        </section>

        <section className="pt-16">
          <CommitteeSection />
        </section>
      </div>
    </main>
  );
}