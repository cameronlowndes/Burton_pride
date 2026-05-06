"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

export default function RaffleContent() {
  const [consent, setConsent] = useState(false);
  const [ageConsent, setAgeConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const formTopRef = useRef<HTMLDivElement | null>(null);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    ticketAmount: "1",
    message: "",
  });

  const resetForm = () => {
    setFormError(null);
    setLoading(false);
    setConsent(false);
    setAgeConsent(false);
    setFormData({
      fullName: "",
      email: "",
      phone: "",
      dateOfBirth: "",
      ticketAmount: "1",
      message: "",
    });

    setTimeout(() => {
      formTopRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  };

  const fillTestForm = () => {
    setFormError(null);
    setConsent(true);
    setAgeConsent(true);
    setFormData({
      fullName: "Burton Pride Test",
      email: "burtonpridetest@gmail.com",
      phone: "01283 000000",
      dateOfBirth: "1990-01-01",
      ticketAmount: "5",
      message: "This is a test raffle ticket purchase.",
    });
  };

  function ticketTotal() {
    const tickets = Number(formData.ticketAmount || 1);
    return tickets * 1;
  }

  function isOver18(dateOfBirth: string) {
    if (!dateOfBirth) return false;

    const dob = new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime())) return false;

    const today = new Date();
    const eighteenthBirthday = new Date(
      dob.getFullYear() + 18,
      dob.getMonth(),
      dob.getDate()
    );

    return today >= eighteenthBirthday;
  }

  function scrollToError() {
    formTopRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!formData.fullName || !formData.email || !formData.phone) {
      setFormError("Please fill out your name, email and phone number.");
      scrollToError();
      return;
    }

    if (!formData.dateOfBirth) {
      setFormError(
        "Please enter your date of birth before buying raffle tickets."
      );
      scrollToError();
      return;
    }

    if (!isOver18(formData.dateOfBirth)) {
      setFormError(
        "You must be aged 18 or over to buy Burton Pride raffle tickets."
      );
      scrollToError();
      return;
    }

    if (!ageConsent) {
      setFormError(
        "You must confirm that you are aged 18 or over, a resident of Great Britain, and buying the tickets for yourself."
      );
      scrollToError();
      return;
    }

    if (!consent) {
      setFormError("You must agree to the raffle terms before buying tickets.");
      scrollToError();
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/raffle/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          ageConfirmed: ageConsent,
          termsAccepted: consent,
        }),
      });

      const text = await res.text();

      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { rawResponse: text };
      }

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to create raffle payment");
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      throw new Error("No Stripe checkout URL returned");
    } catch (err: any) {
      setFormError(err?.message || "Something went wrong. Please try again.");
      scrollToError();
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex flex-col items-center p-8 sm:p-24 pt-24"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      <motion.div
        className="mb-8 flex items-center justify-center rounded-full border-4 border-white bg-white p-2 shadow-2xl shadow-pink-400/50"
        style={{ width: 180, height: 180 }}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 120 }}
      >
        <div className="relative h-full w-full rounded-full overflow-hidden">
          <Image
            src="/image/Logo.png"
            alt="Burton Pride Logo"
            fill
            className="object-contain"
            priority
          />
        </div>
      </motion.div>

      <motion.h1 className="text-5xl sm:text-6xl font-extrabold mb-4 text-center drop-shadow-lg">
        🎟️ Burton Pride Raffle
      </motion.h1>

      <p className="text-white/90 text-center max-w-3xl mb-4">
        Buy raffle tickets for £1 each and help support Burton Pride C.I.C.
        Every ticket helps keep Pride grassroots, community-led and created by
        the community, for the community. Winning tickets will be announced at
        Burton Pride 2026 on 27th June 2026.
      </p>

      <div className="mb-4 max-w-3xl rounded-2xl border border-white/25 bg-black/20 px-5 py-4 text-center text-sm font-semibold text-white/90 shadow-xl backdrop-blur-md">
        The raffle is licensed by East Staffordshire Council under registration
        number <span className="font-extrabold text-white">SL0507</span>.
      </div>

      <div className="mb-8 max-w-3xl rounded-2xl border border-yellow-300/50 bg-yellow-300/20 px-5 py-4 text-center text-sm font-semibold text-white shadow-xl backdrop-blur-md">
        You must be aged 18 or over and be a resident of Great Britain to buy
        raffle tickets. Tickets must not be bought for, or on behalf of, anyone
        under the age of 18.
      </div>

      <div className="flex flex-col sm:flex-row justify-center gap-4 mb-12">
        <a
          href="#raffle-form"
          className="cursor-pointer px-8 py-4 rounded-full font-extrabold text-lg bg-white text-purple-700 shadow-lg hover:scale-105 active:scale-[0.99] transition border border-white/30 text-center"
        >
          🎟️ Buy Raffle Tickets
        </a>

        <Link
          href="/DonateToUs"
          className="cursor-pointer px-8 py-4 rounded-full font-extrabold text-lg bg-black/30 text-white shadow-lg hover:scale-105 active:scale-[0.99] transition border border-white/30 text-center"
        >
          💖 Donate Instead
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row items-start gap-12 w-full max-w-6xl">
        <div className="flex-1 flex flex-col">
          <div ref={formTopRef} />

          {formError && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 w-full bg-red-500/15 border border-red-400/60 text-white rounded-2xl p-5 shadow-2xl backdrop-blur-md"
            >
              <p className="font-extrabold text-lg mb-1">
                ⚠️ We couldn’t continue
              </p>
              <p className="text-white/90 text-sm mb-4">{formError}</p>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="cursor-pointer px-6 py-3 rounded-xl font-bold bg-white text-red-700 hover:scale-[1.02] active:scale-[0.98] transition shadow-lg"
                >
                  Start again
                </button>

                <button
                  type="button"
                  onClick={() => setFormError(null)}
                  className="cursor-pointer px-6 py-3 rounded-xl font-semibold bg-black/30 border border-white/20 hover:bg-black/40 transition"
                >
                  Close message
                </button>
              </div>
            </motion.div>
          )}

          <motion.form
            id="raffle-form"
            onSubmit={handleSubmit}
            className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 flex flex-col gap-4 shadow-2xl border border-white/20"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-extrabold">Buy Raffle Tickets</h2>
                <p className="mt-1 text-sm text-white/80">
                  Tickets are £1 each, or £5 for a book of 5 tickets.
                </p>
              </div>

              <button
                type="button"
                onClick={fillTestForm}
                disabled={loading}
                className="cursor-pointer rounded-xl bg-white/15 px-4 py-2 text-sm font-extrabold text-white border border-white/20 hover:bg-white/25 active:scale-[0.98] transition disabled:opacity-50"
              >
                Test
              </button>
            </div>

            <div className="rounded-2xl border border-white/20 bg-black/20 p-4 text-sm font-semibold text-white/90">
              Licensed by East Staffordshire Council under registration number{" "}
              <span className="font-extrabold text-white">SL0507</span>.
            </div>

            <div className="rounded-2xl border border-yellow-300/40 bg-yellow-300/15 p-4 text-sm font-semibold text-white">
              This raffle is open to residents of Great Britain aged 18 years or
              over only. Burton Pride C.I.C. may request proof of age, identity,
              or eligibility before confirming a winner or releasing a prize.
            </div>

            <input
              type="text"
              placeholder="Full Name"
              value={formData.fullName}
              onChange={(e) =>
                setFormData({ ...formData, fullName: e.target.value })
              }
              className="p-3 rounded-lg border border-white/30 text-black"
              required
            />

            <input
              type="email"
              placeholder="Email Address"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className={`p-3 rounded-lg border text-black ${
                formError ? "border-red-300" : "border-white/30"
              }`}
              required
            />

            <input
              type="tel"
              placeholder="Phone Number"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              className="p-3 rounded-lg border border-white/30 text-black"
              required
            />

            <div>
              <label className="mb-2 block text-sm font-bold text-white">
                Date of birth
              </label>
              <input
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) =>
                  setFormData({ ...formData, dateOfBirth: e.target.value })
                }
                className="w-full p-3 rounded-lg border border-white/30 text-black"
                required
              />
              <p className="mt-2 text-xs text-white/75">
                This is used to help confirm you are aged 18 or over. We do not
                normally ask everyone to upload ID before buying a ticket, but
                we may ask winners for proof of age or identity before releasing
                a prize.
              </p>
            </div>

            <select
              value={formData.ticketAmount}
              onChange={(e) =>
                setFormData({ ...formData, ticketAmount: e.target.value })
              }
              className="p-3 rounded-lg border border-white/30 text-black"
            >
              <option value="1">1 ticket - £1</option>
              <option value="2">2 tickets - £2</option>
              <option value="5">Book of 5 tickets - £5</option>
            </select>

            <div className="rounded-2xl border border-white/20 bg-black/20 p-4">
              <p className="text-sm text-white/80">Total to pay</p>
              <p className="text-3xl font-extrabold">£{ticketTotal()}</p>
            </div>

            <textarea
              placeholder="Message / question / prize donation offer"
              value={formData.message}
              onChange={(e) =>
                setFormData({ ...formData, message: e.target.value })
              }
              rows={5}
              className="p-3 rounded-lg border border-white/30 text-black"
            />

            <div className="flex justify-center mt-2">
              <Link
                href="/Raffle/Terms"
                className="cursor-pointer px-6 py-3 rounded-xl font-semibold bg-white text-purple-700 shadow-lg hover:scale-105 active:scale-95 transition"
              >
                📄 View Raffle Terms
              </Link>
            </div>

            <label className="cursor-pointer flex items-start gap-3 mt-2 bg-white/10 p-4 rounded-xl border border-white/20">
              <input
                type="checkbox"
                checked={ageConsent}
                onChange={(e) => setAgeConsent(e.target.checked)}
                className="w-5 h-5 cursor-pointer mt-1"
              />
              <span className="font-medium">
                I confirm that I am aged 18 or over, I am a resident of Great
                Britain, and I am buying these raffle tickets for myself. I
                understand Burton Pride C.I.C. may ask for proof of age,
                identity, or eligibility before confirming a winner or releasing
                a prize.
              </span>
            </label>

            <label className="cursor-pointer flex items-start gap-3 mt-2 bg-white/10 p-4 rounded-xl border border-white/20">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="w-5 h-5 cursor-pointer mt-1"
              />
              <span className="font-medium">
                I understand I am buying raffle tickets and agree to the Burton
                Pride C.I.C. Raffle Terms and Conditions. Ticket details will be
                confirmed by Burton Pride. Winning tickets will be announced at
                Burton Pride 2026 on 27th June 2026. The raffle is licensed by
                East Staffordshire Council under registration number SL0507.
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 cursor-pointer bg-gradient-to-r from-pink-400 via-purple-500 to-blue-500 text-white font-bold text-xl py-4 rounded-full shadow-lg hover:scale-105 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? "Going to Stripe..."
                : `Pay £${ticketTotal()} with Stripe`}
            </button>
          </motion.form>
        </div>

        <motion.div className="flex-1 flex flex-col justify-center gap-6">
          <div className="bg-white/10 border border-white/20 rounded-3xl p-6 shadow-xl">
            <p className="text-lg sm:text-xl text-white/90 leading-relaxed">
              Our raffle helps raise vital funds for Burton Pride C.I.C. We are
              grassroots, community-led and powered by local people.
            </p>

            <p className="text-lg sm:text-xl font-bold text-white/90 mt-4">
              Tickets: £1 each or £5 for a book of 5 tickets
            </p>

            <p className="text-base sm:text-lg font-bold text-white/90 mt-2">
              Winners announced at Burton Pride 2026 on 27th June 2026.
            </p>

            <p className="mt-4 rounded-2xl border border-white/20 bg-black/20 p-4 text-sm font-semibold text-white/85">
              The raffle is licensed by East Staffordshire Council under
              registration number{" "}
              <span className="font-extrabold text-white">SL0507</span>.
            </p>

            <p className="mt-4 rounded-2xl border border-yellow-300/40 bg-yellow-300/15 p-4 text-sm font-semibold text-white">
              This raffle is open to residents of Great Britain aged 18 years or
              over. Tickets must not be bought by, sold to, or bought on behalf
              of anyone under 18.
            </p>
          </div>

          <div className="bg-white/10 border border-white/20 rounded-3xl p-6 shadow-xl">
            <p className="font-semibold text-xl">What happens next?</p>
            <ol className="list-decimal list-inside text-white/85 mt-3 space-y-2">
              <li>Choose how many raffle tickets you want.</li>
              <li>Confirm you are aged 18 or over and eligible to enter.</li>
              <li>Pay securely through Stripe.</li>
              <li>Burton Pride will confirm your raffle entry.</li>
              <li>
                The winning tickets will be announced at Burton Pride 2026 on
                27th June 2026.
              </li>
            </ol>
          </div>

          <div className="bg-white/10 border border-white/20 rounded-3xl p-6 shadow-xl">
            <p className="font-semibold text-xl">Age and eligibility checks</p>
            <p className="text-white/85 mt-3">
              Burton Pride C.I.C. will not normally ask every person buying a
              ticket to upload ID before purchasing. However, we may request
              proof of age, identity, or eligibility before confirming a winner
              or releasing a prize.
            </p>
            <p className="text-white/85 mt-3">
              Any proof of age or identity provided will only be used for raffle
              verification purposes and will be handled in line with UK data
              protection law.
            </p>
          </div>

          <div className="bg-white/10 border border-white/20 rounded-3xl p-6 shadow-xl">
            <p className="font-semibold text-xl">Why support the raffle?</p>
            <ul className="list-disc list-inside text-white/85 mt-3 space-y-2">
              <li>Supports local LGBTQIA+ community work</li>
              <li>Helps keep Burton Pride grassroots</li>
              <li>Funds inclusive events and safer spaces</li>
              <li>Supports Pride created by the community, for the community</li>
            </ul>
          </div>
        </motion.div>
      </div>

      <div className="w-full max-w-6xl mt-12 flex flex-col gap-12">
        <motion.div
          className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-3xl p-8 sm:p-10 shadow-2xl"
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
            <h2 className="text-4xl sm:text-5xl font-extrabold drop-shadow-lg">
              🎁 Raffle Prizes
            </h2>
          </div>

          <p className="text-white/90 mb-8 max-w-4xl">
            Winners will be announced at Burton Pride 2026 on 27th June 2026.
            Burton Pride C.I.C. may request proof of age, identity, or
            eligibility before confirming a winner or releasing a prize.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="relative overflow-hidden rounded-2xl border border-yellow-300/60 bg-white/10 shadow-2xl p-6 min-h-[240px]">
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-yellow-300/20 blur-2xl" />

              <div className="text-5xl mb-4">🥇</div>

              <h3 className="text-2xl font-extrabold">1st Prize</h3>

              <div className="mt-5 rounded-2xl bg-yellow-300 text-black px-5 py-5 shadow-xl text-center border border-white/50">
                <p className="text-xs sm:text-sm font-black uppercase tracking-[0.2em]">
                  Cash Prize
                </p>
                <p className="mt-2 text-6xl sm:text-7xl font-black leading-none">
                  £100
                </p>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-white/40 bg-white/10 shadow-2xl p-6 min-h-[240px]">
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/20 blur-2xl" />

              <div className="text-5xl mb-4">🥈</div>

              <h3 className="text-2xl font-extrabold">2nd Prize</h3>

              <div className="mt-5 rounded-2xl bg-white text-purple-700 px-5 py-5 shadow-xl text-center border border-white/50">
                <p className="text-xs sm:text-sm font-black uppercase tracking-[0.2em]">
                  Cash Prize
                </p>
                <p className="mt-2 text-6xl sm:text-7xl font-black leading-none">
                  £60
                </p>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-orange-300/60 bg-white/10 shadow-2xl p-6 min-h-[240px]">
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-orange-300/20 blur-2xl" />

              <div className="text-5xl mb-4">🥉</div>

              <h3 className="text-2xl font-extrabold">3rd Prize</h3>

              <div className="mt-5 rounded-2xl bg-orange-300 text-black px-5 py-5 shadow-xl text-center border border-white/50">
                <p className="text-xs sm:text-sm font-black uppercase tracking-[0.2em]">
                  Cash Prize
                </p>
                <p className="mt-2 text-6xl sm:text-7xl font-black leading-none">
                  £30
                </p>
              </div>
            </div>
          </div>

          <p className="mt-8 text-center text-sm font-semibold text-white/75">
            The raffle is licensed by East Staffordshire Council under
            registration number SL0507.
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}