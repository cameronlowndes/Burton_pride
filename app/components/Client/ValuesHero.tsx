'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

export default function ValuesHero() {
  return (
    <motion.section
      className="text-center flex flex-col items-center gap-6 mt-16 flex-grow"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <Image
          src="/image/logo.jpg"
          alt="Burton Pride Logo"
          width={180}
          height={180}
          className="hero-logo"
        />
      </motion.div>
      <motion.h1
        className="text-4xl sm:text-6xl font-bold text-white"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        Our Core Values
      </motion.h1>
      <motion.p
        className="text-lg sm:text-xl max-w-3xl text-white"
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
