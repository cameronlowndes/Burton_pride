'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

export default function ValuesHero() {
  return (
    <motion.section
      className="text-center flex flex-col items-center gap-6 mt-16 flex-grow px-6 py-12 bg-gradient-to-r"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    >
      {/* Logo */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="rounded-full overflow-hidden w-[180px] h-[180px] shadow-[0_0_30px_rgba(255,255,255,0.7)] border-4 border-white"
      >
        <Image
          src="/image/logo.jpg"
          alt="Burton Pride Logo"
          width={180}
          height={180}
          className="rounded-full object-cover w-full h-full"
        />
      </motion.div>

      {/* Heading */}
      <motion.h1
        className="text-4xl sm:text-6xl font-extrabold bg-gradient-to-r  text-white bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(0,0,0,0.5)]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        Our Core Values
      </motion.h1>

      {/* Description */}
      <motion.p
        className="text-lg sm:text-xl max-w-3xl text-white bg-white/10 backdrop-blur-md p-6 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.4)] border border-white/20 hover:scale-[1.02] hover:shadow-[0_8px_40px_rgba(255,255,255,0.6)] transition-all duration-300"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        At <strong>Burton Pride C.I.C</strong>, our values shape everything we do. We are dedicated to building a diverse,
        inclusive, and supportive community where everyone feels safe, respected, and empowered.
      </motion.p>
    </motion.section>
  );
}
