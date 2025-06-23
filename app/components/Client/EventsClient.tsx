'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Countdown from '../Card/Countdown';
import EventCard from '../Card/EventCard';

export default function EventsClient() {
  return (
    <motion.div
      className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex flex-col items-center p-8 sm:p-16 pb-24"
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
        className="text-center flex flex-col items-center gap-6 mt-16 flex-grow"
        variants={{
          hidden: { opacity: 0, y: 30 },
          visible: { opacity: 1, y: 0 },
        }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <motion.div
          className="animate-scaleUp"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Image
            src="/image/logo.jpg"
            alt="Burton Pride Logo"
            width={180}
            height={180}
          />
        </motion.div>

        <motion.h1
          className="text-4xl sm:text-6xl font-bold hero-title"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          Upcoming Events
        </motion.h1>

        <motion.p
          className="text-lg sm:text-xl max-w-2xl hero-description"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          Stay updated on all our exciting events, including the Pride Event and community gatherings. We can’t wait to celebrate with you!
        </motion.p>
      </motion.section>

      {/* Countdown Section */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <Countdown />
      </motion.div>

      {/* Events Section */}
      <motion.section
        className="w-full mt-8"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
      >
        <EventCard />
      </motion.section>
    </motion.div>
  );
}
