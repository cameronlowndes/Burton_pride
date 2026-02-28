'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import Countdown from '../Countdown';
import EventCard from '../Card/EventCard';

export default function HomeClient() {
  return (
    <motion.div
      className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white px-5 sm:px-12 lg:px-20 py-10 sm:py-16 pb-24 sm:pb-32"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: 0.2 },
        },
      }}
    >
      {/* HERO (centered, looks best) */}
      <motion.section
        className="text-center flex flex-col items-center gap-4 sm:gap-6 mt-6 sm:mt-12 relative overflow-hidden w-full"
        variants={{
          hidden: { opacity: 0, y: 40 },
          visible: { opacity: 1, y: 0 },
        }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[320px] h-[320px] sm:w-[520px] sm:h-[520px] rounded-full bg-pink-400/30 blur-3xl animate-pulse mix-blend-overlay" />
        <div className="absolute bottom-0 right-0 w-[220px] h-[220px] sm:w-[320px] sm:h-[320px] rounded-full bg-blue-400/30 blur-3xl animate-pulse mix-blend-overlay" />

        <motion.div
          className="rounded-full overflow-hidden shadow-2xl shadow-pink-400/50 border-4 border-white"
          style={{ width: 160, height: 160 }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 120 }}
        >
          <Image
            src="/image/Logo.png"
            alt="Burton Pride Logo"
            width={160}
            height={160}
            className="rounded-full object-cover"
            priority
          />
        </motion.div>

        <motion.h1
          className="text-4xl sm:text-7xl font-extrabold uppercase drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          Welcome to Burton Pride
        </motion.h1>

        <motion.p
          className="text-base sm:text-xl max-w-3xl font-medium text-white/90 leading-relaxed px-2 sm:px-0"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          At Burton Pride, we believe in the power of community. We are proud to be
          grassroots-led and community-driven. We are here for everyone in the LGBTQIA+
          community, celebrating diversity, inclusion, and equality for all.
        </motion.p>

        <motion.div
          className="flex flex-wrap justify-center gap-3 sm:gap-4 mt-2 sm:mt-6 px-2"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}
        >
          <Link
            href="/about"
            className="bg-white text-purple-700 px-5 sm:px-6 py-2.5 sm:py-3 rounded-full font-bold text-base sm:text-lg hover:bg-purple-100 transition transform hover:scale-105 shadow-lg"
          >
            About Us
          </Link>

          <Link
            href="/about/OurCoreValues"
            className="bg-purple-700 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-full font-bold text-base sm:text-lg hover:bg-purple-600 transition transform hover:scale-105 shadow-lg"
          >
            Our Core Values
          </Link>
        </motion.div>
      </motion.section>

      {/* CONTENT WRAPPER (full width, not centered) */}
      <div className="w-full mt-10 sm:mt-12">
        {/* Countdown (full width section) */}
        <motion.section
          className="w-full"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <div className="w-full max-w-6xl mx-auto">
            <Countdown />
          </div>
        </motion.section>

        {/* EVENTS MOVED UP (full width) */}
        <motion.section
          className="w-full mt-10 sm:mt-12"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.05 }}
        >
          <div className="w-full max-w-6xl mx-auto">
            <EventCard />
          </div>
        </motion.section>

        {/* 2-column blocks on desktop */}
        <div className="w-full max-w-6xl mx-auto mt-10 sm:mt-14 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Application */}
          <motion.section
            className="bg-white/10 backdrop-blur-md rounded-3xl p-7 sm:p-10 shadow-2xl border border-white/30"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
          >
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">
              Burton Pride 2026 Application Forms
            </h2>
            <p className="text-base sm:text-lg mb-6 text-white/90 leading-relaxed">
              We are looking for local companies and charities to take part in Burton Pride
              2026.
            </p>
            <Link
              href="/BurtronPride2026"
              className="inline-block bg-green-500 text-white px-7 py-3 rounded-full font-bold text-base sm:text-lg hover:bg-green-400 transition transform hover:scale-105 shadow-lg"
            >
              Learn More
            </Link>
          </motion.section>

          {/* Collaborate */}
          <motion.section
            className="bg-white/10 backdrop-blur-md rounded-3xl p-7 sm:p-10 shadow-2xl border border-white/30"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.25 }}
          >
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">
              Collaborate with Us
            </h2>
            <p className="text-base sm:text-lg mb-6 text-white/90 leading-relaxed">
              We’re always looking for like-minded businesses, organisations, and individuals
              who want to support our mission of inclusivity and equality.
            </p>
            <Link
              href="/Collaborate"
              className="inline-block bg-green-500 text-white px-7 py-3 rounded-full font-bold text-base sm:text-lg hover:bg-green-400 transition transform hover:scale-105 shadow-lg"
            >
              Learn More
            </Link>
          </motion.section>
        </div>

        {/* Feedback (full width highlight) */}
        <motion.section
          className="w-full mt-10 sm:mt-14"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.35 }}
        >
          <div className="w-full max-w-6xl mx-auto bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 p-7 sm:p-12 rounded-3xl shadow-2xl shadow-pink-500/50 relative overflow-hidden">
            <div className="absolute -top-24 -left-24 w-56 h-56 sm:w-72 sm:h-72 bg-pink-400/40 rounded-full blur-3xl animate-pulse mix-blend-overlay" />
            <div className="absolute -bottom-24 -right-24 w-56 h-56 sm:w-72 sm:h-72 bg-blue-400/40 rounded-full blur-3xl animate-pulse mix-blend-overlay" />

            <div className="relative text-left sm:text-center">
              <h2 className="text-3xl sm:text-5xl font-extrabold mb-3 drop-shadow-lg">
                Give Your Feedback To Burton Pride 💖
              </h2>
              <p className="text-base sm:text-xl mb-6 max-w-3xl sm:mx-auto text-white/90 leading-relaxed">
                We would love your help in making next year’s event even better. Every comment,
                suggestion, or idea helps us improve and make future events even more enjoyable
                and memorable.
              </p>

              <div className="flex sm:justify-center">
                <Link
                  href="/FeedBack"
                  className="bg-yellow-400 text-black px-8 sm:px-10 py-3 sm:py-4 rounded-full font-bold text-lg sm:text-xl hover:bg-yellow-300 transition transform hover:scale-110 shadow-lg shadow-yellow-400/50"
                >
                  Feedback
                </Link>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Donate + Social (two columns on desktop) */}
        <div className="w-full max-w-6xl mx-auto mt-10 sm:mt-14 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Donate */}
          <motion.section
            className="bg-white/10 backdrop-blur-md rounded-3xl p-7 sm:p-10 shadow-2xl border border-white/30"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5 }}
          >
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">
              Support Burton Pride 💖
            </h2>
            <p className="text-base sm:text-lg mb-6 text-white/90 leading-relaxed">
              Help us bring the best Pride events to Burton. Your donation supports community
              initiatives, parade organisation, and inclusivity programmes.
            </p>
            <Link
              href="https://www.gofundme.com/f/raising-funds-for-burton-pride?qid=63f32d4ac52a110d1d8046124f523f48"
              target="_blank"
              className="inline-block bg-yellow-400 text-black px-8 py-3 rounded-full font-bold text-lg hover:bg-yellow-300 transition transform hover:scale-105 shadow-lg shadow-yellow-400/50"
            >
              Donate Now
            </Link>
          </motion.section>

          {/* Social */}
          <motion.section
            className="bg-white/10 backdrop-blur-md rounded-3xl p-7 sm:p-10 shadow-2xl border border-white/30"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.55 }}
          >
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">
              Follow Burton Pride
            </h2>
            <p className="text-base sm:text-lg mb-6 text-white/90 leading-relaxed">
              Keep up to date with announcements, events, and community updates.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link
                href="https://www.facebook.com/profile.php?id=61556621159422"
                target="_blank"
                className="inline-block bg-blue-600 text-white px-7 py-3 rounded-full text-base font-semibold shadow-md hover:bg-blue-500 transition transform hover:scale-105"
              >
                Facebook
              </Link>

              <Link
                href="https://www.instagram.com/prideburton/"
                target="_blank"
                className="inline-block bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 text-white px-7 py-3 rounded-full text-base font-semibold shadow-md hover:opacity-90 transition transform hover:scale-105"
              >
                Instagram
              </Link>
            </div>
          </motion.section>
        </div>
      </div>
    </motion.div>
  );
}