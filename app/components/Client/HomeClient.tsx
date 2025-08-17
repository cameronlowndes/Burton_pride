'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import Message from '../Card/message'; // ✅ renamed to match new thank-you component
import EventCard from '../Card/EventCard';

export default function HomeClient() {
  return (
    <motion.div
      className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex flex-col items-center p-8 sm:p-16 pb-32"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: 0.2 },
        },
      }}
    >
      {/* Hero Section */}
      <motion.section
        className="text-center flex flex-col items-center gap-6 mt-16"
        variants={{
          hidden: { opacity: 0, y: 40 },
          visible: { opacity: 1, y: 0 },
        }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <motion.div
          className="animate-scaleUp rounded-full overflow-hidden"
          style={{ width: 180, height: 180 }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Image
            src="/image/logo.jpg"
            alt="Burton Pride Logo"
            width={180}
            height={180}
            className="rounded-full object-cover"
          />
        </motion.div>

        <motion.h1
          className="text-4xl sm:text-6xl font-bold"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          Welcome to Burton Pride
        </motion.h1>

        <motion.p
          className="text-lg sm:text-xl max-w-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          Celebrating diversity, inclusion, and love in the heart of Burton.
          Together, we’re creating safe and joyful spaces for everyone 🌈
        </motion.p>
      </motion.section>

      {/* Thank-You Message Section */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="mt-8 w-full"
      >
        <Message />
      </motion.div>

      {/* Support Section */}
      <motion.section
        className="mt-16 text-center w-full max-w-3xl flex-grow flex flex-col justify-center"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
      >
        <h2 className="text-3xl font-semibold mb-4">Support Burton Pride</h2>
        <p className="text-lg mb-6">
          Help us bring the best Pride event to Burton! Your donation supports
          community initiatives, parade organisation, and inclusivity programs.
          Every contribution makes a difference 💖
        </p>
        <Link
          href="https://www.gofundme.com/f/raising-funds-for-burton-pride?qid=63f32d4ac52a110d1d8046124f523f48"
          target="_blank"
          className="bg-yellow-400 text-black px-6 py-3 rounded-full font-semibold text-lg hover:bg-yellow-300 transition self-center"
        >
          Donate Now
        </Link>
      </motion.section>

      {/* Social Buttons */}
      <motion.section
        className="mt-8 text-center w-full"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
      >
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="https://www.facebook.com/profile.php?id=61556621159422"
            target="_blank"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-full text-lg font-semibold shadow-md hover:bg-blue-500 transition"
          >
            Follow us on Facebook
          </Link>
          <Link
            href="https://www.instagram.com/prideburton/"
            target="_blank"
            className="inline-block bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 text-white px-6 py-3 rounded-full text-lg font-semibold shadow-md hover:opacity-90 transition"
          >
            Follow us on Instagram
          </Link>
        </div>
      </motion.section>

      {/* Collaborate Section */}
      <motion.section
        className="mt-16 text-center w-full max-w-3xl"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.4 }}
      >
        <h2 className="text-3xl font-semibold mb-4">Collaborate with Us</h2>
        <p className="text-lg mb-6">
          We’re always looking for like-minded businesses, organisations, and
          individuals who want to support our mission of inclusivity and
          equality.
        </p>
        <Link
          href="/Collaborate"
          className="bg-green-500 text-white px-6 py-3 rounded-full font-semibold text-lg hover:bg-green-400 transition"
        >
          Learn More
        </Link>

        {/* <div className="mt-8">
          <Link href="https://forms.gle/taZ16ioQBXvEX7sE8" passHref>
            <button className="bg-green-500 text-white px-6 py-3 rounded-full font-semibold text-lg hover:bg-green-400 transition">
              Vendor & Stallholder Bookings
            </button>
          </Link>
        </div> */}
      </motion.section>

      {/* Events Section */}
      <motion.div
        className="mt-16 w-full mb-16"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.6 }}
      >
        <EventCard />
      </motion.div>
    </motion.div>
  );
}
