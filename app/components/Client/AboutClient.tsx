'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';

export default function AboutClient() {
  return (
    <motion.div
      className="min-h-screen bg-gradient-to-r text-white flex flex-col items-center px-6 sm:px-12 py-12"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.25 } },
      }}
    >
      {/* About Section */}
      <motion.section
        className="text-center flex flex-col items-center gap-8 mt-10 max-w-4xl"
        variants={{ hidden: { opacity: 0, y: 40 }, visible: { opacity: 1, y: 0 } }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="rounded-full overflow-hidden w-[200px] h-[200px] shadow-[0_0_35px_rgba(255,255,255,0.6)] border-4 border-white"
        >
          <Image
            src="/image/Logo.png"
            alt="Burton Pride Logo"
            width={200}
            height={200}
            className="rounded-full object-cover w-full h-full"
          />
        </motion.div>

        {/* Title */}
        <motion.h1
          className="text-4xl sm:text-6xl font-extrabold text-white drop-shadow-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          About Burton Pride
        </motion.h1>

        {/* Description */}
        <motion.p
          className="text-lg sm:text-xl leading-relaxed bg-white/10 backdrop-blur-md p-6 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.4)] border border-white/40 hover:scale-[1.02] hover:shadow-[0_8px_40px_rgba(255,255,255,0.6)] transition"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          Burton Pride is a vibrant celebration of{" "}
          <span className="font-semibold">diversity</span>,{" "}
          <span className="font-semibold">inclusion</span>, and{" "}
          <span className="font-semibold">love</span>. Our mission is to foster a welcoming space for the LGBTQ+ community and allies in Burton, creating events that inspire unity and joy.
        </motion.p>
      </motion.section>

      {/* Mission Section */}
      <motion.section
        className="mt-20 text-center w-full max-w-4xl bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-[0_8px_30px_rgba(0,0,0,0.5)] border-2 border-white/40 hover:scale-[1.02] hover:shadow-[0_8px_40px_rgba(255,255,255,0.6)] transition"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-white drop-shadow-lg">
          Our Mission
        </h2>
        <p className="text-lg sm:text-xl leading-relaxed">
          We strive to uplift voices, promote equality, and create{" "}
          <span className="font-semibold">safe spaces</span> where everyone feels valued and supported. Through community events, outreach programs, and advocacy, Burton Pride is committed to making a lasting impact.
        </p>
      </motion.section>

      {/* Get Involved Section */}
      <motion.section
        className="mt-20 text-center w-full max-w-4xl bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-[0_8px_30px_rgba(0,0,0,0.5)] border-2 border-white/40 hover:scale-[1.02] hover:shadow-[0_8px_40px_rgba(255,255,255,0.6)] transition"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
      >
        <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-white drop-shadow-lg">
          Get Involved
        </h2>
        <p className="text-lg sm:text-xl mb-8 leading-relaxed">
          Whether you want to <span className="font-semibold">volunteer</span>, <span className="font-semibold">sponsor</span>, or simply show your <span className="font-semibold">support</span>, there are many ways to be part of Burton Pride. Together, we can create a future filled with love, acceptance, and celebration.
        </p>
        <Link
          href="/ContactUS"
          className="inline-block bg-white text-black px-8 py-4 rounded-full font-bold text-lg shadow-lg hover:scale-105 transition"
        >
          🌈 Contact Us
        </Link>
      </motion.section>
    </motion.div>
  );
}
