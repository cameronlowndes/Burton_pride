'use client';

import { motion } from 'framer-motion';
import SponsorCard from "../Card/SponsorCard";
import Link from "next/link";

export default function SponsorsContent() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex flex-col items-center p-8 sm:p-16 pb-44"
    >
      {/* Hero Section */}
      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.8 }}
        className="text-center flex flex-col items-center gap-6 mt-16"
      >
        <h1 className="text-5xl sm:text-6xl font-extrabold text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.8)]">
          Our Sponsors
        </h1>
        <p className="text-lg sm:text-xl max-w-2xl bg-white/10 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-white/20">
          A huge thank you to our sponsors for making <span className="font-bold text-yellow-300">Burton Pride</span> possible! Your support helps us celebrate diversity, inclusion, and love.
        </p>
      </motion.header>

      {/* Sponsors Section */}
      <motion.section
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="mt-20 text-center w-full max-w-5xl bg-white/10 backdrop-blur-md p-8 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.5)] border border-white/20"
      >
        <h2 className="text-3xl font-bold mb-8 text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]">
          Proudly Supported By
        </h2>
        <SponsorCard />
      </motion.section>

      {/* Call to Action - Become a Sponsor */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.8 }}
        className="mt-20 text-center w-full max-w-3xl"
      >
        <h2 className="text-3xl font-bold mb-4 text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]">
          Want to Sponsor Us?
        </h2>
        <p className="text-lg mb-6 text-white">
          Join our amazing sponsors in making a difference! Support <span className="font-bold text-yellow-300">Burton Pride</span> and help create an unforgettable event.
        </p>
        <Link
          href="/Collaborate"
          className="bg-gradient-to-r from-yellow-300 via-pink-400 to-purple-500 text-black px-8 py-4 rounded-full font-bold text-lg shadow-lg hover:scale-105 hover:shadow-[0_0_35px_rgba(255,255,255,0.8)] transition-all"
        >
          🤝 Become a Sponsor
        </Link>
      </motion.section>
    </motion.div>
  );
}