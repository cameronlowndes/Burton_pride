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
        <h1 className="text-4xl sm:text-6xl font-bold">Our Sponsors</h1>
        <p className="text-lg sm:text-xl max-w-2xl">
          A huge thank you to our sponsors for making Burton Pride possible! Your support helps us celebrate diversity, inclusion, and love.
        </p>
      </motion.header>

      {/* Sponsors Section */}
      <motion.section
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="mt-20 text-center w-full max-w-4xl"
      >
        <h2 className="text-3xl font-semibold mb-6">Proudly Supported By</h2>
        <SponsorCard />
      </motion.section>

      {/* Call to Action - Become a Sponsor */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.8 }}
        className="mt-20 text-center w-full max-w-3xl mb-8"
      >
        <h2 className="text-3xl font-semibold mb-4">Want to Sponsor Us?</h2>
        <p className="text-lg mb-6">
          Join our amazing sponsors in making a difference! Support Burton Pride and help create an unforgettable event.
        </p>
        <Link
          href="/Collaborate"
          className="bg-white text-pink-600 px-6 py-3 rounded-full font-semibold text-lg hover:bg-opacity-80 transition"
        >
          Become a Sponsor
        </Link>
      </motion.section>
    </motion.div>
  );
}
