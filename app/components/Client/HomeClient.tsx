'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import Countdown from '../Countdown';
import EventCard from '../Card/EventCard';
import { useState } from 'react';

export default function HomeClient() {
  const [showCompetition, setShowCompetition] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleImagePreview = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Frontend demo only — form submitted!');
  };

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex flex-col items-center p-8 sm:p-16 pb-32"
      initial="hidden"
      animate="visible"
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.2 } } }}
    >

      {/* HERO */}
      <motion.section className="text-center flex flex-col items-center gap-6 mt-16">
        <Image src="/image/Logo.png" alt="Burton Pride Logo" width={180} height={180} className="rounded-full border-4 border-white shadow-2xl"/>
        <h1 className="text-5xl sm:text-7xl font-extrabold">Welcome to Burton Pride 🌈</h1>
        <p className="text-lg sm:text-xl max-w-3xl text-white/90">
          Celebrating diversity, inclusion, and love in the heart of Burton.
        </p>
      </motion.section>

      {/* COUNTDOWN */}
      <div className="mt-12 w-full max-w-4xl px-4">
        <Countdown />
      </div>

      {/* 🌈 COMPETITION BUTTON SECTION */}
      <motion.section className="mt-16 w-full max-w-3xl text-center bg-white/10 backdrop-blur-lg p-10 rounded-3xl shadow-2xl border border-white/20">
        <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">🌈 Pride Competition 2026</h2>
        <p className="text-lg mb-6 text-white/90">Upload your photo, design, or artwork and show your Pride spirit!</p>
        <p className="font-bold text-xl mb-6">Entry Fee: £2</p>

        <button
          onClick={() => setShowCompetition(true)}
          className="bg-yellow-400 text-black px-10 py-4 rounded-full font-bold text-xl hover:bg-yellow-300 transition transform hover:scale-110 shadow-lg"
        >
          Enter the Competition
        </button>
      </motion.section>

      {/* EVENTS */}
      <div className="w-full mt-12">
        <EventCard />
      </div>

      {/* 🪟 MODAL */}
      {showCompetition && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white text-black w-full max-w-lg rounded-2xl p-8 relative shadow-2xl"
          >
            <button
              onClick={() => setShowCompetition(false)}
              className="absolute top-3 right-4 text-2xl font-bold text-gray-500 hover:text-black"
            >
              ✕
            </button>

            <h2 className="text-2xl font-bold mb-2 text-center">🌈 Pride Competition Entry</h2>
            <p className="text-center mb-4 font-semibold">Entry Fee: £2</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input placeholder="Your Name" className="p-2 border rounded" required />
              <input type="email" placeholder="Your Email" className="p-2 border rounded" required />
              <textarea placeholder="Tell us about your entry..." className="p-2 border rounded" required />

              <label className="font-semibold">Upload Photo / Design</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files && handleImagePreview(e.target.files[0])}
                required
              />

              {preview && (
                <img src={preview} className="rounded-lg max-h-40 object-cover mt-2 border" />
              )}

              <button
                type="submit"
                className="bg-purple-600 text-white py-2 rounded-lg font-bold hover:bg-purple-500"
              >
                Submit Entry
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
