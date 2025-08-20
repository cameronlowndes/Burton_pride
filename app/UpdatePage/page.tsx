'use client';

import { motion } from 'framer-motion';

export default function UpdateContent() {
  return (
    <motion.div
      className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white px-6 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
    >
      <h1 className="text-4xl sm:text-6xl font-extrabold mb-6">
        🚧 Page Under Update 🚧
      </h1>
      <p className="text-lg sm:text-2xl max-w-2xl">
        We’re working hard to improve this page for you. Please check back soon for exciting updates and new content!
      </p>
    </motion.div>
  );
}
