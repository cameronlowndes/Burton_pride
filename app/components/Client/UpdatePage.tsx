'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';

export default function UpdatePage() {
  return (
    <motion.div
      className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-br from-purple-600 via-pink-500 to-yellow-400 text-white px-6 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
    >
      {/* Logo */}
      <motion.div
        className="w-36 h-36 mb-8 rounded-full overflow-hidden shadow-[0_0_35px_rgba(255,255,255,0.5)]"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <Image
          src="/image/logo.jpg"
          alt="Logo"
          width={144}
          height={144}
          className="rounded-full object-cover"
        />
      </motion.div>

      {/* Heading */}
      <motion.h1
        className="text-4xl sm:text-5xl font-bold mb-4 drop-shadow-lg"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        Site Update in Progress
      </motion.h1>

      {/* Description */}
      <motion.p
        className="text-lg sm:text-xl max-w-xl mb-8 bg-white/20 backdrop-blur-md p-4 rounded-lg shadow-md"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        We're currently making improvements to provide you with a better experience. Please check back shortly!
      </motion.p>

      {/* Optional Home Button */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <Link
          href="/"
          className="inline-block bg-white text-purple-600 font-bold px-6 py-3 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all"
        >
          Go Back Home
        </Link>
      </motion.div>
    </motion.div>
  );
}
