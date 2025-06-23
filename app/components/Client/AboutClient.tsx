'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';

export default function AboutClient() {
  return (
    <motion.div
      className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex flex-col items-center p-8 sm:p-16"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: 0.2,
          },
        },
      }}
    >
      {/* About Section */}
      <motion.section
        className="text-center flex flex-col items-center gap-6 mt-16 max-w-3xl"
        variants={{
          hidden: { opacity: 0, y: 40 },
          visible: { opacity: 1, y: 0 },
        }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Image src="/image/logo.jpg" alt="Burton Pride Logo" width={180} height={180} />
        </motion.div>

        <motion.h1
          className="text-4xl sm:text-6xl font-bold"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          About Burton Pride
        </motion.h1>

        <motion.p
          className="text-lg sm:text-xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          Burton Pride is a vibrant celebration of diversity, inclusion, and love. Our mission is to foster a welcoming space for the LGBTQ+ community and allies in Burton, creating events that inspire unity and joy.
        </motion.p>
      </motion.section>

      {/* Mission Section */}
      <motion.section
        className="mt-16 text-center w-full max-w-4xl"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <h2 className="text-3xl font-semibold mb-6">Our Mission</h2>
        <p className="text-lg">
          We strive to uplift voices, promote equality, and create safe spaces where everyone feels valued and supported. Through community events, outreach programs, and advocacy, Burton Pride is committed to making a lasting impact.
        </p>
      </motion.section>

      {/* Get Involved Section */}
      <motion.section
        className="mt-16 text-center w-full max-w-4xl"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
      >
        <h2 className="text-3xl font-semibold mb-6">Get Involved</h2>
        <p className="text-lg mb-6">
          Whether you want to volunteer, sponsor, or simply show your support, there are many ways to be part of Burton Pride. Together, we can create a future filled with love, acceptance, and celebration.
        </p>
        <Link
          href="/ContactUS"
          className="inline-block bg-white text-pink-600 px-6 py-3 rounded-full font-semibold text-lg hover:bg-opacity-80 transition"
        >
          Contact Us
        </Link>
      </motion.section>
    </motion.div>
  );
}
