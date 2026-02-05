'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

export default function CompetitionPage() {
  const [preview, setPreview] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImagePreview = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) {
      alert('You must agree to the terms before submitting!');
      return;
    }
    alert('Frontend only — entry submitted!');
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
        className="animate-scaleUp rounded-full overflow-hidden shadow-2xl shadow-pink-400/50 border-4 border-white mb-8"
        style={{ width: 180, height: 180 }}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 120 }}
      >
        <Image
          src="/image/Logo.png"
          alt="Burton Pride Logo"
          width={180}
          height={180}
          className="rounded-full object-cover"
        />
      </motion.div>

      {/* Page Title */}
      <motion.h1
        className="text-5xl sm:text-6xl font-extrabold mb-12 text-center drop-shadow-lg"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        🌈 Windows Of Hope Competition 2026
      </motion.h1>

      {/* Form layout */}
      <div className="flex flex-col lg:flex-row items-start gap-12 w-full max-w-6xl">
        <motion.form
          onSubmit={handleSubmit}
          className="flex-1 bg-white/10 backdrop-blur-lg rounded-3xl p-8 flex flex-col gap-4 shadow-2xl border border-white/20"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {/* Fields */}
          <input
            type="text"
            placeholder="Business Name"
            className="p-3 rounded-lg border border-white/30 text-black font-medium"
            required
          />
          <input
            type="text"
            placeholder="Contact Name"
            className="p-3 rounded-lg border border-white/30 text-black font-medium"
            required
          />
          <input
            type="email"
            placeholder="Email Address"
            className="p-3 rounded-lg border border-white/30 text-black font-medium"
            required
          />
          <input
            type="tel"
            placeholder="Phone Number"
            className="p-3 rounded-lg border border-white/30 text-black font-medium"
            required
          />
          <input
            type="text"
            placeholder="Business Address"
            className="p-3 rounded-lg border border-white/30 text-black font-medium"
            required
          />
          <input
            type="text"
            placeholder="Website / Social Media (optional)"
            className="p-3 rounded-lg border border-white/30 text-black font-medium"
          />

          {/* Custom Upload Button */}
          <label className="font-semibold mt-2">Upload Photo / Design</label>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer flex items-center justify-center h-40 border-2 border-dashed border-white/50 rounded-xl bg-white/10 hover:bg-white/20 transition relative overflow-hidden"
          >
            {!preview ? (
              <span className="text-white/80 font-medium">Click to Upload Image</span>
            ) : (
              <img
                src={preview}
                alt="Preview"
                className="w-full h-full object-cover rounded-xl transform hover:scale-105 transition"
              />
            )}
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={(e) => e.target.files && handleImagePreview(e.target.files[0])}
              className="hidden"
              required
            />
          </div>

          {/* Consent Checkbox */}
          <label className="flex items-center gap-3 mt-4">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="w-5 h-5 rounded border-white/50 text-yellow-400 focus:ring-yellow-400"
            />
            <span className="text-white/90 font-medium">I agree to the terms and conditions</span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            className="mt-4 bg-gradient-to-r from-pink-400 via-purple-500 to-blue-500 text-white font-bold text-xl py-4 rounded-full shadow-lg shadow-pink-500/50 hover:scale-105 transition transform"
          >
            Submit Entry
          </button>
        </motion.form>

        {/* Info text */}
        <motion.div
          className="flex-1 flex flex-col justify-center gap-6"
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <p className="text-lg sm:text-xl text-white/90 leading-relaxed">
            Show your creativity and Pride spirit! Enter our competition for a chance to win amazing prizes.
            Upload your design, photo, or artwork and take part in the celebration.
          </p>
          <p className="text-lg sm:text-xl font-bold text-white/90">
            Entry Fee: £2
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
