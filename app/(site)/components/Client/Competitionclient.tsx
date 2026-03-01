"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function CompetitionPage() {
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const formTopRef = useRef<HTMLDivElement | null>(null);

  const [formData, setFormData] = useState({
    businessName: "",
    contactName: "",
    email: "",
    phone: "",
    address: "",
    website: "",
  });

  // ✅ image upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // ✅ showcase images from DB (approved entries)
  const [showcaseImages, setShowcaseImages] = useState<string[]>([]);
  const [showcaseLoading, setShowcaseLoading] = useState(true);

  useEffect(() => {
    async function loadShowcase() {
      try {
        setShowcaseLoading(true);
        const res = await fetch("/api/windows/showcase", { cache: "no-store" });
        const text = await res.text();

        let json: any;
        try {
          json = JSON.parse(text);
        } catch {
          console.error("Showcase API returned non-JSON:", text);
          setShowcaseImages([]);
          return;
        }

        if (json?.ok) {
          setShowcaseImages(json.images || []);
        } else {
          console.error("Showcase API error:", json?.error);
          setShowcaseImages([]);
        }
      } catch (e) {
        console.error("Failed to load showcase:", e);
        setShowcaseImages([]);
      } finally {
        setShowcaseLoading(false);
      }
    }

    loadShowcase();
  }, []);

  const resetForNewEmail = () => {
    setFormError(null);
    setLoading(false);
    setConsent(false);
    setFormData({
      businessName: "",
      contactName: "",
      email: "",
      phone: "",
      address: "",
      website: "",
    });
    setImageFile(null);
    setImagePreview(null);

    setTimeout(() => {
      formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  async function uploadImageToSupabase(entryId: string, file: File) {
    const supabase = supabaseBrowser();

    const ext = file.name.split(".").pop() || "jpg";
    const path = `entries/${entryId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("windows-of-hope")
      .upload(path, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: "3600",
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("windows-of-hope").getPublicUrl(path);
    return data.publicUrl as string;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!consent) {
      setFormError("You must agree to the Terms & Conditions before submitting.");
      formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const { businessName, contactName, email, phone, address } = formData;
    if (!businessName || !contactName || !email || !phone || !address) {
      setFormError("Please fill out all required fields.");
      formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (!imageFile) {
      setFormError("Please upload a photo of your window to complete your entry.");
      formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (!imageFile.type.startsWith("image/")) {
      setFormError("Please upload an image file (JPG/PNG/WebP).");
      return;
    }
    if (imageFile.size > 8 * 1024 * 1024) {
      setFormError("Image is too large. Please keep it under 8MB.");
      return;
    }

    try {
      setLoading(true);

      // 1) Create entry first (so we get entryId)
      const entryRes = await fetch("/api/entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData }),
      });

      const entryText = await entryRes.text();
      let entryData: any;
      try {
        entryData = JSON.parse(entryText);
      } catch {
        setFormError("Server error: /api/entry did not return JSON.");
        return;
      }

      if (!entryRes.ok) {
        setFormError(
          entryData?.error ||
            "We couldn’t create your entry. Please check your details and try again."
        );
        formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      const entryId = entryData.entryId as string;

      // 2) Upload image to Supabase Storage
      const imageUrl = await uploadImageToSupabase(entryId, imageFile);

      // 3) Save imageUrl into DB row (requires this route)
      const saveRes = await fetch("/api/entry/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId, imageUrl }),
      });

      const saveText = await saveRes.text();
      let saveJson: any;
      try {
        saveJson = JSON.parse(saveText);
      } catch {
        throw new Error("Server error: /api/entry/image did not return JSON.");
      }

      if (!saveRes.ok) {
        throw new Error(saveJson?.error || "Failed to save image to entry.");
      }

      // 4) Create Stripe checkout session
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, entryId }),
      });

      const checkoutText = await res.text();
      let checkoutJson: any;
      try {
        checkoutJson = JSON.parse(checkoutText);
      } catch {
        throw new Error("Server error: /api/checkout did not return JSON.");
      }

      if (checkoutJson?.url) {
        window.location.href = checkoutJson.url;
        return;
      }

      setFormError("Stripe session failed. Please try again.");
      formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err: any) {
      console.error(err);
      setFormError(err?.message || "Something went wrong. Please try again.");
      formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } finally {
      setLoading(false);
    }
  };

  const autoFillForm = () => {
    setFormError(null);
    setFormData({
      businessName: "Test Business Ltd",
      contactName: "John Doe",
      email: "cameronlowndes@gmail.com",
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

      <p className="text-white/90 text-center max-w-3xl mb-6">
        Decorate your window with Pride, colour, and community spirit. Enter for a chance to win prizes,
        be featured, and help make Burton shine.
      </p>

      {/* ✅ Vote + Leaderboard buttons (top) */}
      <div className="flex flex-col sm:flex-row justify-center gap-4 mb-12">
        <Link
          href="/Competition/vote"
          className="cursor-pointer px-8 py-4 rounded-full font-extrabold text-lg bg-white text-purple-700 shadow-lg hover:scale-105 active:scale-[0.99] transition border border-white/30 text-center"
        >
          🗳️ Vote for your favourite window
        </Link>

        <Link
          href="/Competition/leaderboard"
          className="cursor-pointer px-8 py-4 rounded-full font-extrabold text-lg bg-black/30 text-white shadow-lg hover:scale-105 active:scale-[0.99] transition border border-white/30 text-center"
        >
          🏆 View Leaderboard
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
              <p className="font-extrabold text-lg mb-1">⚠️ We couldn’t continue</p>
              <p className="text-white/90 text-sm mb-4">{formError}</p>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={resetForNewEmail}
                  className="cursor-pointer px-6 py-3 rounded-xl font-bold bg-white text-red-700 hover:scale-[1.02] active:scale-[0.98] transition shadow-lg"
                >
                  Try again with a different email
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
              className={`p-3 rounded-lg border text-black ${
                formError ? "border-red-300" : "border-white/30"
              }`}
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

            {/* Image upload */}
            <div className="bg-white/10 border border-white/20 rounded-2xl p-4">
              <div className="font-extrabold text-lg">📸 Upload your window photo</div>
              <p className="text-white/85 text-sm mt-1">
                Please upload a clear photo of your decorated window (max 8MB).
              </p>

              <input
                type="file"
                accept="image/*"
                disabled={loading}
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setImageFile(file);
                  setImagePreview(file ? URL.createObjectURL(file) : null);
                }}
                className="mt-3 block w-full text-sm"
              />

              {imagePreview && (
                <div className="mt-4 rounded-2xl overflow-hidden border border-white/15">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="Preview" className="w-full object-cover" />
                </div>
              )}
            </div>

            <div className="flex justify-center mt-2">
              <a
                href="/Competition/Terms"
                className="cursor-pointer px-6 py-3 rounded-xl font-semibold bg-white text-purple-700 shadow-lg hover:scale-105 active:scale-95 transition"
              >
                📄 View Terms & Conditions
              </a>
            </div>

            <label className="cursor-pointer flex items-center gap-3 mt-2 bg-white/10 p-4 rounded-xl border border-white/20">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="w-5 h-5 cursor-pointer"
              />
              <span className="font-medium">I agree to the Terms & Conditions</span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 cursor-pointer bg-gradient-to-r from-pink-400 via-purple-500 to-blue-500 text-white font-bold text-xl py-4 rounded-full shadow-lg hover:scale-105 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Processing..." : "Submit & Pay £2"}
            </button>

            <button
              type="button"
              onClick={autoFillForm}
              className="mt-2 cursor-pointer bg-yellow-400 text-black font-bold py-2 rounded-lg hover:bg-yellow-300 active:scale-[0.99] transition"
            >
              Auto-Fill Form (Test Only)
            </button>
          </motion.form>
        </div>

        {/* RIGHT */}
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
              <li>Submit your details, upload your photo, and pay the £2 entry fee.</li>
              <li>Your entry will be saved and reviewed by the committee.</li>
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

      {/* Showcase */}
      <div className="w-full max-w-6xl mt-12 flex flex-col gap-12">
        <motion.div
          className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-3xl p-8 sm:p-10 shadow-2xl"
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
            <h2 className="text-4xl sm:text-5xl font-extrabold drop-shadow-lg">🪟 Window Showcase</h2>

            {/* ✅ Vote + Leaderboard buttons (showcase) */}
            <div className="flex gap-3 flex-wrap">
              <Link
                href="/Competition/vote"
                className="cursor-pointer text-sm font-extrabold bg-white text-purple-700 shadow-lg hover:scale-105 active:scale-[0.99] transition border border-white/30 px-4 py-2 rounded-full"
              >
                🗳️ Vote now
              </Link>

              <Link
                href="/Competition/leaderboard"
                className="cursor-pointer text-sm font-extrabold bg-black/30 text-white shadow-lg hover:scale-105 active:scale-[0.99] transition border border-white/30 px-4 py-2 rounded-full"
              >
                🏆 Leaderboard
              </Link>
            </div>
          </div>

          <p className="text-white/90 mb-8 max-w-4xl">
            These are real entries approved by the committee. If none are approved yet, we’ll show the Burton Pride logo.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {showcaseLoading ? (
              <div className="col-span-full rounded-2xl border border-white/20 bg-white/5 p-6 text-white/80">
                Loading showcase...
              </div>
            ) : showcaseImages.length > 0 ? (
              showcaseImages.map((src, index) => (
                <div
                  key={`${src}-${index}`}
                  className="cursor-pointer relative overflow-hidden rounded-2xl border border-white/20 bg-white/5 shadow-lg aspect-[4/3] hover:scale-[1.02] active:scale-[0.99] transition"
                >
                  <Image src={src} alt="Window entry" fill className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                  <div className="absolute bottom-2 left-2 text-xs font-semibold bg-black/35 px-2 py-1 rounded-lg">
                    Entry
                  </div>
                </div>
              ))
            ) : (
              <div className="col">
                <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/5 shadow-lg aspect-[4/3]">
                  <Image
                    src="/image/Logo.png"
                    alt="Burton Pride Logo"
                    fill
                    className="object-contain p-10"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                  <div className="absolute bottom-2 left-2 text-xs font-semibold bg-black/35 px-2 py-1 rounded-lg">
                    No entries yet
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}