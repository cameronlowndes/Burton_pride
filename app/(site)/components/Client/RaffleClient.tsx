"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

export default function RaffleContent() {
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const formTopRef = useRef<HTMLDivElement | null>(null);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    ticketAmount: "1",
    message: "",
  });

  const resetForm = () => {
    setFormError(null);
    setLoading(false);
    setConsent(false);
    setFormData({
      fullName: "",
      email: "",
      phone: "",
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
    setFormData({
      fullName: "Burton Pride Test",
      email: "burtonpridetest@gmail.com",
      phone: "01283 000000",
      ticketAmount: "5",
      message: "This is a test raffle ticket purchase.",
    });
  };

  function ticketTotal() {
    const tickets = Number(formData.ticketAmount || 1);
    return tickets * 1;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!consent) {
      setFormError("You must agree before buying raffle tickets.");
      formTopRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }

    if (!formData.fullName || !formData.email || !formData.phone) {
      setFormError("Please fill out your name, email and phone number.");
      formTopRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/raffle/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
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
      formTopRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
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

      <p className="text-white/90 text-center max-w-3xl mb-6">
        Buy raffle tickets for £1 each and help support Burton Pride C.I.C.
        Every ticket helps keep Pride grassroots, community-led and created by
        the community, for the community. Winning tickets will be announced at
        Burton Pride 2026 on 27th June 2026.
      </p>

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
                  Tickets are £1 each.
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

            <select
              value={formData.ticketAmount}
              onChange={(e) =>
                setFormData({ ...formData, ticketAmount: e.target.value })
              }
              className="p-3 rounded-lg border border-white/30 text-black"
            >
              <option value="1">1 ticket - £1</option>
              <option value="2">2 tickets - £2</option>
              <option value="5">5 tickets - £5</option>
              <option value="10">10 tickets - £10</option>
              <option value="20">20 tickets - £20</option>
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

            <label className="cursor-pointer flex items-center gap-3 mt-2 bg-white/10 p-4 rounded-xl border border-white/20">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="w-5 h-5 cursor-pointer"
              />
              <span className="font-medium">
                I understand I am buying raffle tickets and that ticket/details
                will be confirmed by Burton Pride. Winning tickets will be
                announced at Burton Pride 2026 on 27th June 2026.
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
              Tickets: £1 each
            </p>
            <p className="text-base sm:text-lg font-bold text-white/90 mt-2">
              Winners announced at Burton Pride 2026 on 27th June 2026.
            </p>
          </div>

          <div className="bg-white/10 border border-white/20 rounded-3xl p-6 shadow-xl">
            <p className="font-semibold text-xl">What happens next?</p>
            <ol className="list-decimal list-inside text-white/85 mt-3 space-y-2">
              <li>Choose how many raffle tickets you want.</li>
              <li>Pay securely through Stripe.</li>
              <li>Burton Pride will confirm your raffle entry.</li>
              <li>
                The winning tickets will be announced at Burton Pride 2026 on
                27th June 2026.
              </li>
            </ol>
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
            Prize information will be added here as soon as it is confirmed. If
            you are a local business and would like to donate a raffle prize,
            please get in touch. Winners will be announced at Burton Pride 2026
            on 27th June 2026.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/5 shadow-lg p-6 min-h-[180px]">
              <div className="text-4xl mb-4">🥇</div>
              <h3 className="text-2xl font-extrabold">1st Prize</h3>
              <p className="text-white/75 mt-2">
                Main prize to be announced soon.
              </p>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/5 shadow-lg p-6 min-h-[180px]">
              <div className="text-4xl mb-4">🥈</div>
              <h3 className="text-2xl font-extrabold">2nd Prize</h3>
              <p className="text-white/75 mt-2">
                Community prize to be announced soon.
              </p>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/5 shadow-lg p-6 min-h-[180px]">
              <div className="text-4xl mb-4">🥉</div>
              <h3 className="text-2xl font-extrabold">3rd Prize</h3>
              <p className="text-white/75 mt-2">
                Supporter prize to be announced soon.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}