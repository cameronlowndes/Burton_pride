"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import CommitteeSection from "../Card/CommitteeSection";

type DonationType = "one_time" | "monthly";

type SupporterWallItem = {
  id: string;
  full_name: string | null;
  supporter_story: string | null;
  supporter_image_url: string | null;
  pronouns: string | null;
  identity_label: string | null;
};

const oneTimeAmounts = ["£5", "£10", "£20", "£50", "£100", "Custom"];
const monthlyAmounts = ["£3", "£5", "£10", "£20", "£50", "Custom"];

function makeSupporterSlug(name: string | null, id: string) {
  const safeName = (name || "supporter")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `${safeName}-${id}`;
}

export default function DonationsContent() {
  const searchParams = useSearchParams();
  const startMonthly = searchParams.get("type") === "monthly";

  const [donationType, setDonationType] = useState<DonationType>(
    startMonthly ? "monthly" : "one_time"
  );
  const [selectedAmount, setSelectedAmount] = useState<string>(
    startMonthly ? "£3" : "£10"
  );
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [customAmount, setCustomAmount] = useState(startMonthly ? "3" : "10");
  const [message, setMessage] = useState("");
  const [supporterStory, setSupporterStory] = useState("");
  const [supporterImage, setSupporterImage] = useState<File | null>(null);
  const [supporterImagePreview, setSupporterImagePreview] = useState("");

  const [pronouns, setPronouns] = useState("");
  const [identityLabel, setIdentityLabel] = useState("");

  const [supporters, setSupporters] = useState<SupporterWallItem[]>([]);
  const [supportersLoading, setSupportersLoading] = useState(true);

  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [amountError, setAmountError] = useState("");
  const [serverError, setServerError] = useState("");

  const amounts = donationType === "monthly" ? monthlyAmounts : oneTimeAmounts;

  useEffect(() => {
    async function loadSupporters() {
      try {
        setSupportersLoading(true);

        const res = await fetch("/api/donations/supporter-wall", {
          cache: "no-store",
        });

        const data = await res.json();

        if (data.ok) {
          setSupporters(data.supporters || []);
        }
      } catch (error) {
        console.error("Failed to load supporter wall:", error);
      } finally {
        setSupportersLoading(false);
      }
    }

    loadSupporters();
  }, []);

  function switchDonationType(type: DonationType) {
    setDonationType(type);
    setServerError("");
    setAmountError("");

    if (type === "monthly") {
      setSelectedAmount("£3");
      setCustomAmount("3");
    } else {
      setSelectedAmount("£10");
      setCustomAmount("10");
      setSupporterStory("");
      setSupporterImage(null);
      setSupporterImagePreview("");
      setPronouns("");
      setIdentityLabel("");
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
          pronouns,
          identityLabel,
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
    <main className="min-h-screen px-4 pb-24 pt-28 text-slate-950 sm:px-6 sm:pt-32 lg:px-8 dark:text-white">
      <div className="mx-auto w-full max-w-7xl">
        {/* Hero */}
        <section className="mx-auto max-w-4xl text-center">
          <div className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-white shadow-xl sm:h-32 sm:w-32">
            <Image
              src="/image/Logo.png"
              alt="Burton Pride"
              width={128}
              height={128}
              priority
              className="h-full w-full object-cover"
            />
          </div>

          <p className="mt-6 text-sm font-black uppercase tracking-[0.18em] text-yellow-700 dark:text-yellow-300">
            Community funded • Grassroots led
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl dark:text-white">
            Support Burton Pride
          </h1>

          <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-slate-800 sm:text-lg sm:leading-8 dark:text-white/80">
            Every donation helps us keep Pride local, welcoming and community-led.
            Your support helps fund events, accessibility, outreach and the practical
            things that make Burton Pride possible.
          </p>
        </section>

        {/* Donation type switch */}
        <section className="mx-auto mt-10 max-w-3xl rounded-3xl border border-white/60 bg-white/85 p-2 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-[#111827]/90">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => switchDonationType("one_time")}
              className={`rounded-2xl px-4 py-4 text-sm font-black transition sm:text-base ${
                donationType === "one_time"
                  ? "bg-pink-600 text-white shadow-lg"
                  : "text-slate-700 hover:bg-slate-100 dark:text-white/75 dark:hover:bg-white/10"
              }`}
            >
              One-time donation
            </button>

            <button
              type="button"
              onClick={() => switchDonationType("monthly")}
              className={`rounded-2xl px-4 py-4 text-sm font-black transition sm:text-base ${
                donationType === "monthly"
                  ? "bg-yellow-300 text-purple-950 shadow-lg"
                  : "text-slate-700 hover:bg-slate-100 dark:text-white/75 dark:hover:bg-white/10"
              }`}
            >
              Monthly supporter
            </button>
          </div>
        </section>

        {/* Main content */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          {/* Why support us */}
          <section className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur-md sm:p-8 dark:border-white/10 dark:bg-[#111827]/85">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-purple-700 dark:text-purple-300">
              {donationType === "monthly" ? "Why monthly support matters" : "Why your donation matters"}
            </p>

            <h2 className="mt-3 text-3xl font-black text-slate-950 sm:text-4xl dark:text-white">
              {donationType === "monthly"
                ? "Become a Monthly Pride Supporter"
                : "Why donate to Burton Pride C.I.C?"}
            </h2>

            <div className="mt-6 space-y-5 text-base leading-7 text-slate-700 sm:text-lg sm:leading-8 dark:text-white/75">
              {donationType === "monthly" ? (
                <>
                  <p>
                    Monthly support gives Burton Pride something incredibly valuable:
                    stability. Regular donations help us plan ahead instead of relying
                    only on short-term fundraising close to event season.
                  </p>

                  <p>
                    Burton Pride is a fully community-led, grassroots Pride organisation.
                    We are proud to be built by local people for local people, and monthly
                    support helps us stay independent and focused on the needs of our
                    LGBTQIA+ community.
                  </p>

                  <p>
                    Your support can help with accessibility, outreach, community events,
                    education, entertainment, insurance, venue costs, equipment and the
                    practical essentials needed to deliver Pride safely.
                  </p>

                  <p>
                    Even a few pounds each month can make a real difference and give us
                    more confidence to build long-term projects that last beyond one day
                    of celebration.
                  </p>

                  <div className="rounded-2xl border border-yellow-300/50 bg-yellow-100/80 p-5 text-slate-900 dark:border-yellow-300/30 dark:bg-yellow-300/10 dark:text-yellow-100">
                    <p className="font-black">Small monthly support. Big community impact.</p>
                  </div>
                </>
              ) : (
                <>
                  <p>
                    Burton Pride C.I.C is a community-led, grassroots Pride organisation
                    created by local people who care deeply about Burton and the people who
                    live here.
                  </p>

                  <p>
                    We are not built around private profit. Donations are reinvested back
                    into the community and help us create events, safer spaces, outreach,
                    accessibility improvements and support that people can actually feel.
                  </p>

                  <p>
                    Being grassroots means people power matters. It allows us to stay close
                    to the community, listen to local voices and make decisions based on
                    what our community needs.
                  </p>

                  <p>
                    When you donate, you are helping Burton Pride stay visible, inclusive
                    and welcoming while giving us the resources to keep building for the
                    future.
                  </p>

                  <div className="rounded-2xl border border-pink-200 bg-pink-50 p-5 text-pink-900 dark:border-pink-400/20 dark:bg-pink-500/10 dark:text-pink-100">
                    <p className="font-black">The people. The heart. The community spirit.</p>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Donation form */}
          <section className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-2xl backdrop-blur-md sm:p-8 dark:border-white/10 dark:bg-[#111827]/95">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em] text-pink-700 dark:text-pink-300">
                  Secure donation
                </p>
                <h2 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
                  {donationType === "monthly" ? "Set up monthly support" : "Make a donation"}
                </h2>
              </div>

              <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 dark:bg-white/10 dark:text-white/70">
                Powered by Stripe
              </span>
            </div>

            <div className="mt-7 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-white/75">
                  Full name
                </label>
                <input
                  type="text"
                  placeholder="Your full name"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    setNameError("");
                  }}
                  className={`w-full rounded-2xl border bg-white px-4 py-3.5 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:ring-4 focus:ring-purple-200 dark:bg-white/[0.06] dark:text-white dark:placeholder:text-white/40 dark:focus:ring-purple-500/20 ${
                    nameError ? "border-red-400" : "border-slate-200 dark:border-white/10"
                  }`}
                />
                {nameError && <p className="mt-2 text-sm font-semibold text-red-600 dark:text-red-300">{nameError}</p>}
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-white/75">
                  Email address
                </label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError("");
                  }}
                  className={`w-full rounded-2xl border bg-white px-4 py-3.5 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:ring-4 focus:ring-purple-200 dark:bg-white/[0.06] dark:text-white dark:placeholder:text-white/40 dark:focus:ring-purple-500/20 ${
                    emailError ? "border-red-400" : "border-slate-200 dark:border-white/10"
                  }`}
                />
                {emailError && <p className="mt-2 text-sm font-semibold text-red-600 dark:text-red-300">{emailError}</p>}
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-white/75">
                  {donationType === "monthly" ? "Monthly amount" : "Donation amount"}
                </label>

                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-slate-500 dark:text-white/50">£</span>
                  <input
                    type="number"
                    min="1"
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
                    className={`w-full rounded-2xl border bg-white py-3.5 pl-10 pr-4 text-base font-bold text-slate-950 outline-none transition focus:ring-4 focus:ring-purple-200 dark:bg-white/[0.06] dark:text-white dark:focus:ring-purple-500/20 ${
                      amountError ? "border-red-400" : "border-slate-200 dark:border-white/10"
                    }`}
                  />
                </div>

                {amountError && <p className="mt-2 text-sm font-semibold text-red-600 dark:text-red-300">{amountError}</p>}
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-3">
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
                      className={`rounded-2xl border px-3 py-3 text-sm font-black transition sm:px-4 sm:py-4 sm:text-base ${
                        active
                          ? "border-purple-600 bg-purple-600 text-white shadow-lg"
                          : "border-slate-200 bg-white text-slate-700 hover:border-purple-300 hover:bg-purple-50 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/75 dark:hover:bg-white/10"
                      }`}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-white/75">
                  Message of support <span className="font-medium text-slate-400">optional</span>
                </label>
                <textarea
                  rows={4}
                  placeholder="Leave a message if you would like"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:ring-4 focus:ring-purple-200 dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:placeholder:text-white/40 dark:focus:ring-purple-500/20"
                />
              </div>

              {donationType === "monthly" && (
                <div className="rounded-3xl border border-yellow-300/60 bg-yellow-50 p-5 dark:border-yellow-300/20 dark:bg-yellow-300/[0.07]">
                  <h3 className="text-lg font-black text-slate-950 dark:text-white">
                    Optional supporter profile
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-white/65">
                    Monthly supporters can choose to share a story on our supporter wall.
                    Nothing goes public until Burton Pride approves it.
                  </p>

                  <div className="mt-5 space-y-4">
                    <input
                      type="text"
                      placeholder="Pronouns, e.g. he/him, she/her, they/them"
                      value={pronouns}
                      onChange={(e) => setPronouns(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-950 outline-none placeholder:text-slate-400 dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:placeholder:text-white/40"
                    />

                    <input
                      type="text"
                      placeholder="Identity, e.g. Gay, Trans, Non-binary, Ally"
                      value={identityLabel}
                      onChange={(e) => setIdentityLabel(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-950 outline-none placeholder:text-slate-400 dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:placeholder:text-white/40"
                    />

                    <textarea
                      placeholder="Why do you support Burton Pride?"
                      rows={4}
                      value={supporterStory}
                      onChange={(e) => setSupporterStory(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-950 outline-none placeholder:text-slate-400 dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:placeholder:text-white/40"
                    />

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.05]">
                      <label className="block text-sm font-bold text-slate-700 dark:text-white/75">
                        Photo <span className="font-medium text-slate-400">optional</span>
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleSupporterImage(e.target.files?.[0] || null)}
                        className="mt-3 block w-full cursor-pointer text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-purple-600 file:px-4 file:py-2 file:font-bold file:text-white dark:text-white/65"
                      />
                    </div>
                  </div>
                </div>
              )}

              {serverError && (
                <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200">
                  {serverError}
                </div>
              )}

              <button
                type="button"
                onClick={handleDonate}
                disabled={loading}
                className="w-full rounded-2xl bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 px-5 py-4 text-lg font-black text-white shadow-xl transition hover:scale-[1.01] hover:shadow-2xl disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Redirecting..."
                  : donationType === "monthly"
                    ? "Start Monthly Support"
                    : "Donate Now"}
              </button>

              <p className="text-center text-xs font-semibold text-slate-500 dark:text-white/55">
                Secure payments powered by Stripe
              </p>
            </div>
          </section>
        </div>

        {/* Supporter wall */}
        <section className="mt-16">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-purple-700 dark:text-purple-300">
              Our community
            </p>
            <h2 className="mt-2 text-3xl font-black text-slate-950 sm:text-4xl dark:text-white">
              Monthly Supporter Wall
            </h2>
            <p className="mt-3 text-base leading-7 text-slate-700 dark:text-white/70">
              Some monthly supporters choose to share why Burton Pride matters to them.
            </p>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {(donationType === "monthly" || fullName || supporterStory || supporterImagePreview) && (
              <article className="overflow-hidden rounded-3xl border border-yellow-300/60 bg-white/85 shadow-xl backdrop-blur-md dark:border-yellow-300/20 dark:bg-[#111827]/90">
                <div className="relative h-[260px] w-full overflow-hidden bg-slate-100 dark:bg-[#0d111a]">
                  {supporterImagePreview ? (
                    <Image src={supporterImagePreview} alt="Supporter preview" fill className="object-cover" />
                  ) : (
                    <Image src="/image/Logo.png" alt="Burton Pride supporter" fill className="object-contain p-12" />
                  )}
                </div>

                <div className="p-5">
                  <span className="rounded-full bg-yellow-200 px-3 py-1 text-xs font-black text-yellow-900">
                    Preview
                  </span>
                  <h3 className="mt-3 text-2xl font-black text-slate-950 dark:text-white">
                    {fullName || "Your Name"}
                  </h3>
                  <p className="mt-1 text-sm font-bold text-purple-700 dark:text-purple-300">
                    Monthly Pride Supporter
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {pronouns && (
                      <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 dark:bg-white/10 dark:text-white/75">
                        {pronouns}
                      </span>
                    )}
                    {identityLabel && (
                      <span className="rounded-full bg-purple-100 px-3 py-1.5 text-xs font-bold text-purple-700 dark:bg-purple-500/15 dark:text-purple-200">
                        {identityLabel}
                      </span>
                    )}
                  </div>

                  <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-white/65">
                    {supporterStory || "Your supporter story preview will appear here if you choose to share one."}
                  </p>
                </div>
              </article>
            )}

            {supportersLoading && (
              <div className="rounded-3xl border border-white/60 bg-white/80 p-8 text-center text-slate-700 shadow-lg backdrop-blur-md md:col-span-2 xl:col-span-3 dark:border-white/10 dark:bg-[#111827]/80 dark:text-white/70">
                Loading supporter wall...
              </div>
            )}

            {!supportersLoading && supporters.length === 0 && (
              <div className="rounded-3xl border border-white/60 bg-white/80 p-8 text-center text-slate-700 shadow-lg backdrop-blur-md md:col-span-2 xl:col-span-3 dark:border-white/10 dark:bg-[#111827]/80 dark:text-white/70">
                No approved monthly supporters are showing yet.
              </div>
            )}

            {!supportersLoading &&
              supporters.map((supporter) => (
                <article
                  key={supporter.id}
                  className="overflow-hidden rounded-3xl border border-white/60 bg-white/85 shadow-xl backdrop-blur-md transition hover:-translate-y-1 hover:shadow-2xl dark:border-white/10 dark:bg-[#111827]/90"
                >
                  <div className="relative h-[260px] w-full overflow-hidden bg-slate-100 dark:bg-[#0d111a]">
                    <Image
                      src={supporter.supporter_image_url || "/image/Logo.png"}
                      alt={supporter.full_name || "Burton Pride supporter"}
                      fill
                      className={supporter.supporter_image_url ? "object-cover" : "object-contain p-12"}
                    />
                  </div>

                  <div className="p-5">
                    <h3 className="text-2xl font-black text-slate-950 dark:text-white">
                      {supporter.full_name || "Community Supporter"}
                    </h3>
                    <p className="mt-1 text-sm font-bold text-purple-700 dark:text-purple-300">
                      Monthly Pride Supporter
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {supporter.pronouns && (
                        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 dark:bg-white/10 dark:text-white/75">
                          {supporter.pronouns}
                        </span>
                      )}
                      {supporter.identity_label && (
                        <span className="rounded-full bg-purple-100 px-3 py-1.5 text-xs font-bold text-purple-700 dark:bg-purple-500/15 dark:text-purple-200">
                          {supporter.identity_label}
                        </span>
                      )}
                    </div>

                    <Link
                      href={`/DonateToUs/${makeSupporterSlug(supporter.full_name, supporter.id)}`}
                      className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-pink-600 px-5 py-3 text-sm font-black text-white transition hover:bg-pink-500"
                    >
                      View Story
                    </Link>
                  </div>
                </article>
              ))}
          </div>

          <p className="mt-6 text-center text-sm font-semibold text-slate-600 dark:text-white/60">
            Supporter stories are optional and only go live after Burton Pride approval.
          </p>
        </section>

        <section className="mt-16 border-t border-white/50 pt-14 dark:border-white/10">
          <CommitteeSection />
        </section>
      </div>
    </main>
  );
}
