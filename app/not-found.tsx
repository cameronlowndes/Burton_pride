'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-white bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 px-4 py-12 overflow-hidden">
      <motion.div
        className="text-center max-w-2xl"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <motion.h1
          className="text-8xl sm:text-9xl font-extrabold tracking-tight drop-shadow-lg mb-6"
          animate={{ scale: [1, 1.05, 1], opacity: [1, 0.8, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          404
        </motion.h1>

        <motion.h2
          className="text-3xl sm:text-4xl font-bold mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Lost in the Rainbow?
        </motion.h2>

        <motion.p
          className="text-lg sm:text-xl mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          The page you’re looking for doesn’t exist. But your journey doesn't end here.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
        >
          <Link href="/" passHref>
            <span className="inline-block bg-white text-purple-700 font-bold py-3 px-6 rounded-full shadow-lg hover:bg-gray-100 transition duration-300 ease-in-out cursor-pointer">
              🌈 Return to Home
            </span>
          </Link>
        </motion.div>
      </motion.div>

      <motion.div
        className="mt-16 text-center"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <p className="text-lg sm:text-xl font-semibold text-white mb-4">
          Still stuck?
        </p>
        <a
          href="mailto:prideburton@gmail.com"
          className="inline-block bg-yellow-400 text-black font-bold py-2 px-5 rounded-full shadow-lg hover:bg-yellow-300 transition duration-300 ease-in-out mb-3"
        >
          📧 Email us at prideburton@gmail.com
        </a>
        <br />
        <Link
          href="/ContactUS"
          className="inline-block bg-white text-purple-700 font-bold py-2 px-5 rounded-full shadow-lg hover:bg-gray-100 transition duration-300 ease-in-out mt-2"
        >
          📞 Visit Contact Us Page
        </Link>
      </motion.div>
    </main>
  );
}
