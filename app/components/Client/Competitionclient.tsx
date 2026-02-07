"use client";

import { useState } from "react";
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!consent) return alert("You must agree to the terms before submitting!");

    const { businessName, contactName, email, phone, address } = formData;
    if (!businessName || !contactName || !email || !phone || !address) {
      return alert("Please fill out all required fields!");
    }

    try {
      setLoading(true);

      // 1️⃣ Save entry
      const entryRes = await fetch("/api/entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData }),
      });

      const entryData = await entryRes.json();
      if (!entryRes.ok) throw new Error(entryData?.error || "Failed to save entry");

      const entryId = entryData.entryId;

      // 2️⃣ Stripe checkout
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, entryId }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Stripe session failed. Please try again.");
      }
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
      email: "test@example.com",
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
      transition={{ duration: 1 }}
    >
      {/* Logo */}
      <motion.div
        className="rounded-full overflow-hidden shadow-2xl shadow-pink-400/50 border-4 border-white mb-8"
        style={{ width: 180, height: 180 }}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 120 }}
      >
        <Image
          src="/image/Logo.png"
          alt="Burton Pride Logo"
          width={180}
          height={180}
          className="rounded-full object-cover"
        />
      </motion.div>

      <motion.h1
        className="text-5xl sm:text-6xl font-extrabold mb-12 text-center drop-shadow-lg"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        🌈 Windows Of Hope Competition 2026
      </motion.h1>

      <div className="flex flex-col lg:flex-row items-start gap-12 w-full max-w-6xl">
        {/* FORM */}
        <motion.form
          onSubmit={handleSubmit}
          className="flex-1 bg-white/10 backdrop-blur-lg rounded-3xl p-8 flex flex-col gap-4 shadow-2xl border border-white/20"
        >
          <input
            type="text"
            placeholder="Business Name"
            value={formData.businessName}
            onChange={(e) =>
              setFormData({ ...formData, businessName: e.target.value })
            }
            className="p-3 rounded-lg border border-white/30 text-black"
            required
          />

          <input
            type="text"
            placeholder="Contact Name"
            value={formData.contactName}
            onChange={(e) =>
              setFormData({ ...formData, contactName: e.target.value })
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
            className="p-3 rounded-lg border border-white/30 text-black"
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

          <input
            type="text"
            placeholder="Business Address"
            value={formData.address}
            onChange={(e) =>
              setFormData({ ...formData, address: e.target.value })
            }
            className="p-3 rounded-lg border border-white/30 text-black"
            required
          />

          <input
            type="text"
            placeholder="Website / Social Media (optional)"
            value={formData.website}
            onChange={(e) =>
              setFormData({ ...formData, website: e.target.value })
            }
            className="p-3 rounded-lg border border-white/30 text-black"
          />

          {/* 📢 Upload Notice */}
          <div className="bg-white/10 border border-white/30 rounded-xl p-4 mt-2 text-center">
            <p className="font-semibold text-white text-lg">
              📸 Image Upload Notice
            </p>
            <p className="text-white/90 text-sm mt-1">
              You will upload your competition image on the success page after
              payment has been completed.
            </p>
          </div>

          {/* 📄 Terms Button */}
          <div className="flex justify-center mt-4">
            <a
              href="/Competition/Terms"
              rel="noopener noreferrer"
              className="px-6 py-3 rounded-xl font-semibold bg-white text-purple-700 shadow-lg hover:scale-105 hover:shadow-xl transition"
            >
              📄 View Terms & Conditions
            </a>
          </div>

          {/* Consent */}
          <label className="flex items-center gap-3 mt-5 bg-white/10 p-4 rounded-xl border border-white/20">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="w-5 h-5"
            />
            <span className="font-medium">
              I agree to the Terms & Conditions
            </span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="mt-4 bg-gradient-to-r from-pink-400 via-purple-500 to-blue-500 text-white font-bold text-xl py-4 rounded-full shadow-lg hover:scale-105 transition disabled:opacity-50"
          >
            {loading ? "Processing..." : "Submit & Pay £2"}
          </button>

          {/* Test button */}
          <button
            type="button"
            onClick={autoFillForm}
            className="mt-2 bg-yellow-400 text-black font-bold py-2 rounded-lg hover:bg-yellow-300 transition"
          >
            Auto-Fill Form (Test Only)
          </button>
        </motion.form>

        {/* SIDE TEXT */}
        <motion.div className="flex-1 flex flex-col justify-center gap-6">
          <p className="text-lg sm:text-xl text-white/90 leading-relaxed">
            Show your creativity and Pride spirit! Enter our competition for a
            chance to win amazing prizes.
          </p>

          <p className="text-lg sm:text-xl font-bold text-white/90">
            Entry Fee: £2
          </p>

          <div className="bg-white/10 border border-white/20 rounded-2xl p-5">
            <p className="font-semibold">What happens next?</p>
            <p className="text-white/85 text-sm mt-2">
              After payment, you’ll be taken to the success page where you can upload your
              competition image. That upload completes your entry.
            </p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
