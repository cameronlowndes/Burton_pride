'use client';

import { motion } from 'framer-motion';

export default function ValuesFooter() {
  return (
    <motion.section
      className="mt-16 text-center max-w-4xl w-full px-6 py-12 bg-gradient-to-r from-pink-500 via-purple-600 to-blue-600 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.5)] border border-white/20 backdrop-blur-md hover:scale-[1.02] hover:shadow-[0_8px_40px_rgba(255,255,255,0.6)] transition-all duration-300"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
    >
      <p className="text-lg sm:text-xl font-semibold text-white drop-shadow-lg">
        By joining <span className="font-bold text-yellow-300">Burton Pride</span>, you become part of a movement committed to <span className="font-bold text-pink-300">respect</span>, <span className="font-bold text-green-300">equality</span>, and <span className="font-bold text-blue-300">belonging</span>. Together, we build a brighter, more inclusive Burton for all.
      </p>
    </motion.section>
  );
}
