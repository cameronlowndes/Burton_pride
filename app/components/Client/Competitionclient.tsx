"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";

export default function CompetitionPage() {
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    businessName: "",
    contactName: "",
    email: "",
    phone: "",
    address: "",
    website: "",
  });

  const gallery = useMemo(
    () => [
      { src: "/competition/window-1.jpg", alt: "Decorated window example 1" },
      { src: "/competition/window-2.jpg", alt: "Decorated window example 2" },
      { src: "/competition/window-3.jpg", alt: "Decorated window example 3" },
      { src: "/competition/window-4.jpg", alt: "Decorated window example 4" },
      { src: "/competition/window-5.jpg", alt: "Decorated window example 5" },
      { src: "/competition/window-6.jpg", alt: "Decorated window example 6" },
    ],
    []
  );

  const winners = useMemo(
    () => ({
      first: {
        name: "To be announced",
        image: "/competition/winner-1.jpg",
        detail: "Winner will be featured here once judging is complete.",
      },
      second: {
        name: "To be announced",
        image: "/competition/winner-2.jpg",
        detail: "Winner will be featured here once judging is complete.",
      },
      third: {
        name: "To be announced",
        image: "/competition/winner-3.jpg",
        detail: "Winner will be featured here once judging is complete.",
      },
    }),
    []
  );

  const hasWinners = false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!consent) return alert("You must agree to the terms before submitting!");

    const { businessName, contactName, email, phone, address } = formData;
    if (!businessName || !contactName || !email || !phone || !address) {
      return alert("Please fill out all required fields!");
    }

    try {
      setLoading(true);

      // 1) Save entry
      const entryRes = await fetch("/api/entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData }),
      });

      const entryData = await entryRes.json();
      if (!entryRes.ok) throw new Error(entryData?.error || "Failed to save entry");

      const entryId = entryData.entryId;

      // ✅ No email here anymore.
      // Email is sent ONLY after payment in /api/webhook

      // 2) Create Stripe checkout session
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, entryId }),
      });

      const data = await res.json();

      if (data.url) window.location.href = data.url;
      else alert("Stripe session failed. Please try again.");
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const autoFillForm = () => {
    setFormData({
      businessName: "Test Business Ltd",
      contactName: "John Doe",
      email: "soical.roots.green.shoots@gmail.com",
      phone: "0123456789",
      address: "123 Test Street, Burton",
      website: "https://example.com",
    });
    setConsent(true);
  };

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex flex-col items-center p-8 sm:p-24 pt-24"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      {/* Logo */}
      <motion.div
        className="rounded-full overflow-hidden shadow-2xl shadow-pink-400/50 border-4 border-white mb-8"
        style={{ width: 180, height: 180 }}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 120 }}
      >
        <Image
          src="/image/Logo.png"
          alt="Burton Pride Logo"
          width={180}
          height={180}
          className="rounded-full object-cover"
        />
      </motion.div>

      <motion.h1 className="text-5xl sm:text-6xl font-extrabold mb-4 text-center drop-shadow-lg">
        🌈 Windows Of Hope Competition 2026
      </motion.h1>

      <p className="text-white/90 text-center max-w-3xl mb-12">
        Decorate your window with Pride, colour, and community spirit. Enter for a chance to win prizes,
        be featured, and help make Burton shine.
      </p>

      {/* TOP SECTION */}
      <div className="flex flex-col lg:flex-row items-start gap-12 w-full max-w-6xl">
        {/* LEFT */}
        <div className="flex-1 flex flex-col">
          <motion.form
            onSubmit={handleSubmit}
            className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 flex flex-col gap-4 shadow-2xl border border-white/20"
          >
            <input
              type="text"
              placeholder="Business Name"
              value={formData.businessName}
              onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
              className="p-3 rounded-lg border border-white/30 text-black"
              required
            />

            <input
              type="text"
              placeholder="Contact Name"
              value={formData.contactName}
              onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
              className="p-3 rounded-lg border border-white/30 text-black"
              required
            />

            <input
              type="email"
              placeholder="Email Address"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="p-3 rounded-lg border border-white/30 text-black"
              required
            />

            <input
              type="tel"
              placeholder="Phone Number"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="p-3 rounded-lg border border-white/30 text-black"
              required
            />

            <input
              type="text"
              placeholder="Business Address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="p-3 rounded-lg border border-white/30 text-black"
              required
            />

            <input
              type="text"
              placeholder="Website / Social Media (optional)"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              className="p-3 rounded-lg border border-white/30 text-black"
            />

            <div className="bg-white/10 border border-white/30 rounded-xl p-4 mt-2 text-center">
              <p className="font-semibold text-white text-lg">📸 Image Upload Notice</p>
              <p className="text-white/90 text-sm mt-1">
                You will upload your competition image on the success page after payment.
              </p>
            </div>

            <div className="flex justify-center mt-4">
              <a
                href="/Competition/Terms"
                className="px-6 py-3 rounded-xl font-semibold bg-white text-purple-700 shadow-lg hover:scale-105 transition"
              >
                📄 View Terms & Conditions
              </a>
            </div>

            <label className="flex items-center gap-3 mt-5 bg-white/10 p-4 rounded-xl border border-white/20">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="w-5 h-5"
              />
              <span className="font-medium">I agree to the Terms & Conditions</span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="mt-4 bg-gradient-to-r from-pink-400 via-purple-500 to-blue-500 text-white font-bold text-xl py-4 rounded-full shadow-lg hover:scale-105 transition disabled:opacity-50"
            >
              {loading ? "Processing..." : "Submit & Pay £2"}
            </button>

            <button
              type="button"
              onClick={autoFillForm}
              className="mt-2 bg-yellow-400 text-black font-bold py-2 rounded-lg hover:bg-yellow-300 transition"
            >
              Auto-Fill Form (Test Only)
            </button>
          </motion.form>
        </div>

        <motion.div className="flex-1 flex flex-col justify-center gap-6">
          <div className="bg-white/10 border border-white/20 rounded-3xl p-6 shadow-xl">
            <p className="text-lg sm:text-xl text-white/90 leading-relaxed">
              Show your creativity and Pride spirit! Enter our competition for a chance to win amazing prizes.
            </p>
            <p className="text-lg sm:text-xl font-bold text-white/90 mt-4">Entry Fee: £2</p>
          </div>

          <div className="bg-white/10 border border-white/20 rounded-3xl p-6 shadow-xl">
            <p className="font-semibold text-xl">What happens next?</p>
            <ol className="list-decimal list-inside text-white/85 mt-3 space-y-2">
              <li>Submit your details and pay the £2 entry fee.</li>
              <li>You’ll be taken to the success page.</li>
              <li>Upload your window image to complete your entry.</li>
              <li>Judging takes place and winners are announced.</li>
            </ol>
          </div>

          <div className="bg-white/10 border border-white/20 rounded-3xl p-6 shadow-xl">
            <p className="font-semibold text-xl">Judging criteria</p>
            <ul className="list-disc list-inside text-white/85 mt-3 space-y-2">
              <li>Creativity & effort</li>
              <li>Pride theme & inclusivity</li>
              <li>Overall impact / “wow” factor</li>
              <li>Presentation and neatness</li>
            </ul>
          </div>
        </motion.div>
      </div>

      {/* Rest of your page stays the same... */}
      <div className="w-full max-w-6xl mt-12 flex flex-col gap-12">
        {/* Prizes */}
        <motion.div
          className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-3xl p-8 sm:p-10 shadow-2xl"
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="text-center mb-8">
            <h2 className="text-4xl sm:text-5xl font-extrabold drop-shadow-lg">🏆 Prizes</h2>
            <p className="text-white/90 mt-3 max-w-3xl mx-auto">
              The top windows will win prizes and be featured across Burton Pride channels.
            </p>
          </div>

          <div className="flex flex-col gap-6">
            <div className="bg-yellow-400 text-black rounded-2xl p-6 shadow-lg">
              <p className="text-2xl font-extrabold mb-2">🥇 1st Place</p>
              <p className="font-semibold">
                Trophy + Winner Certificate + Featured on Burton Pride website & social media
              </p>
            </div>

            <div className="bg-gray-200 text-black rounded-2xl p-6 shadow-lg">
              <p className="text-2xl font-extrabold mb-2">🥈 2nd Place</p>
              <p className="font-semibold">Certificate + Social media feature</p>
            </div>

            <div className="bg-orange-300 text-black rounded-2xl p-6 shadow-lg">
              <p className="text-2xl font-extrabold mb-2">🥉 3rd Place</p>
              <p className="font-semibold">Certificate of achievement</p>
            </div>
          </div>
        </motion.div>

        {/* Showcase */}
        <motion.div
          className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-3xl p-8 sm:p-10 shadow-2xl"
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
            <h2 className="text-4xl sm:text-5xl font-extrabold drop-shadow-lg">🪟 Window Showcase</h2>
            <span className="text-sm bg-white/15 border border-white/20 px-3 py-2 rounded-full">
              Photos: /public/competition/
            </span>
          </div>

          <p className="text-white/90 mb-8 max-w-4xl">
            Show off your window here! These can be examples or real entries.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {gallery.map((img) => (
              <div
                key={img.src}
                className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/5 shadow-lg aspect-[4/3]"
              >
                <Image src={img.src} alt={img.alt} fill className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                <div className="absolute bottom-2 left-2 text-xs font-semibold bg-black/35 px-2 py-1 rounded-lg">
                  Showcase
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Winners (disabled until you set hasWinners = true) */}
        {hasWinners && (
          <motion.div className="rounded-3xl p-8 sm:p-10 shadow-2xl border border-white/25 bg-gradient-to-r from-yellow-400/20 via-white/10 to-purple-500/15">
            {/* unchanged winners UI */}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
