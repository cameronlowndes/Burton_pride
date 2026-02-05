'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';

export default function SuccessPage() {
  return (
    <motion.div
      className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex flex-col items-center justify-center p-8 sm:p-24"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
    >
      {/* Celebration Image / Logo */}
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

      {/* Success Title */}
      <motion.h1
        className="text-5xl sm:text-6xl font-extrabold mb-6 text-center drop-shadow-lg"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        🎉 Payment Successful!
      </motion.h1>

      {/* Message */}
      <motion.p
        className="text-lg sm:text-xl text-white/90 text-center mb-8 leading-relaxed"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.2 }}
      >
        Thank you for entering the Windows Of Hope Competition 2026!  
        Your entry has been received, and we can’t wait to see your design.  
        You should receive a confirmation email shortly.
      </motion.p>

      {/* Button back to competition page */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.4, type: 'spring', stiffness: 120 }}
      >
        <Link
          href="/competition"
          className="bg-gradient-to-r from-pink-400 via-purple-500 to-blue-500 text-white font-bold text-xl py-4 px-8 rounded-full shadow-lg shadow-pink-500/50 hover:scale-105 transition transform"
        >
          Back to Competition
        </Link>
      </motion.div>
    </motion.div>
  );
}
