'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import Countdown from '../Countdown';
import EventCard from '../Card/EventCard';
import CompetitionModal from './CompetitionModal';

export default function HomeClient() {
  const [isModalOpen, setIsModalOpen] = useState(false); // <-- state for modal

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
        className="text-center flex flex-col items-center gap-6 mt-16 relative overflow-hidden"
        variants={{
          hidden: { opacity: 0, y: 40 },
          visible: { opacity: 1, y: 0 },
        }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        {/* Background particle circles */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-pink-400/30 blur-3xl animate-pulse mix-blend-overlay"></div>
        <div className="absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full bg-blue-400/30 blur-3xl animate-pulse mix-blend-overlay"></div>

        <motion.div
          className="animate-scaleUp rounded-full overflow-hidden shadow-2xl shadow-pink-400/50 border-4 border-white"
          style={{ width: 180, height: 180 }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 120 }}
        >
          <Image
            src="/image/Logo.png"
            alt="Burton Pride Logo"
            width={180}
            height={180}
            className="rounded-full object-cover"
          />
        </motion.div>

        <motion.h1
          className="text-5xl sm:text-7xl font-extrabold uppercase drop-shadow-[0_0_20px_rgba(255,255,255,0.8)] animate-fadeIn"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          Welcome to Burton Pride
        </motion.h1>

        <motion.p
          className="text-lg sm:text-xl max-w-3xl font-medium animate-fadeIn text-white/90 leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          Celebrating diversity, inclusion, and love in the heart of Burton.
          Together, we create safe, joyful, and unforgettable spaces for everyone 🌈
        </motion.p>
      </motion.section>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="mt-8 w-full max-w-4xl px-4 sm:px-0"
      >
        {/* Button to open Competition Modal */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-yellow-400 text-black px-10 py-4 rounded-full font-bold text-xl hover:bg-yellow-300 transition transform hover:scale-110 shadow-lg shadow-yellow-400/50 mb-6"
        >
          Enter the Pride Competition
        </button>

        {/* Competition Modal */}
        <CompetitionModal open={isModalOpen} onClose={() => setIsModalOpen(false)} />

        {/* Countdown */}
        <Countdown />
      </motion.div>

      {/* Signup Section */}
      <motion.section
        className="mt-16 text-center w-full max-w-3xl px-4 sm:px-0"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.4 }}
      >
        <h2 className="text-3xl sm:text-4xl font-extrabold mb-4 animate-fadeIn">
          Burton Pride 2026 Application Forms
        </h2>
        <p className="text-lg mb-6 animate-fadeIn">
          We are looking for local companies and charities to take part in Burton Pride 2026.
        </p>
        <Link
          href="/BurtronPride2026"
          className="bg-green-500 text-white px-8 py-3 rounded-full font-bold text-lg hover:bg-green-400 transition transform hover:scale-105 shadow-lg"
        >
          Learn More
        </Link>
      </motion.section>

      {/* Feedback Section */}
      <motion.section
        className="mt-16 w-full bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 p-12 rounded-3xl shadow-2xl shadow-pink-500/50 flex flex-col items-center text-center relative overflow-hidden animate-fadeIn"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
      >
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-pink-400/40 rounded-full blur-3xl animate-pulse mix-blend-overlay"></div>
        <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-blue-400/40 rounded-full blur-3xl animate-pulse mix-blend-overlay"></div>

        <h2 className="text-4xl sm:text-5xl font-extrabold mb-4 text-white drop-shadow-lg animate-bounce">
          Give Your FeedBack To Burton Pride 💖
        </h2>
        <p className="text-lg sm:text-xl mb-8 max-w-2xl text-white/90 leading-relaxed animate-fadeIn">
          We would love your help in making next year’s event even better! Please take a moment to share your feedback on this year’s event. 
          Every comment, suggestion, or idea you provide will help us enhance the experience for everyone and ensure future events are more enjoyable,
          exciting, and memorable. Your input truly makes a difference, and we appreciate your time and honesty in helping us grow!
        </p>
        <Link
          href="/FeedBack"
          className="bg-yellow-400 text-black px-10 py-4 rounded-full font-bold text-xl hover:bg-yellow-300 transition transform hover:scale-110 shadow-lg shadow-yellow-400/50 animate-pulse"
        >
          FeedBack
        </Link>
      </motion.section>

      {/* Support Section */}
      <motion.section
        className="mt-16 w-full bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 p-12 rounded-3xl shadow-2xl shadow-pink-500/50 flex flex-col items-center text-center relative overflow-hidden animate-fadeIn"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
      >
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-pink-400/40 rounded-full blur-3xl animate-pulse mix-blend-overlay"></div>
        <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-blue-400/40 rounded-full blur-3xl animate-pulse mix-blend-overlay"></div>

        <h2 className="text-4xl sm:text-5xl font-extrabold mb-4 text-white drop-shadow-lg animate-bounce">
          Support Burton Pride 💖
        </h2>
        <p className="text-lg sm:text-xl mb-8 max-w-2xl text-white/90 leading-relaxed animate-fadeIn">
          Help us bring the best Pride events to Burton! Your donation supports community initiatives, parade organisation, and inclusivity programs. Every contribution makes a difference!
        </p>
        <Link
          href="https://www.gofundme.com/f/raising-funds-for-burton-pride?qid=63f32d4ac52a110d1d8046124f523f48"
          target="_blank"
          className="bg-yellow-400 text-black px-10 py-4 rounded-full font-bold text-xl hover:bg-yellow-300 transition transform hover:scale-110 shadow-lg shadow-yellow-400/50 animate-pulse"
        >
          Donate Now
        </Link>
      </motion.section>

      {/* Social Buttons */}
      <motion.section
        className="mt-12 text-center w-full flex justify-center gap-6 flex-wrap"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
      >
        <Link
          href="https://www.facebook.com/profile.php?id=61556621159422"
          target="_blank"
          className="inline-block bg-blue-600 text-white px-8 py-3 rounded-full text-lg font-semibold shadow-md hover:bg-blue-500 transition transform hover:scale-105"
        >
          Follow us on Facebook
        </Link>
        <Link
          href="https://www.instagram.com/prideburton/"
          target="_blank"
          className="inline-block bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 text-white px-8 py-3 rounded-full text-lg font-semibold shadow-md hover:opacity-90 transition transform hover:scale-105"
        >
          Follow us on Instagram
        </Link>
      </motion.section>

      {/* Collaborate Section */}
      <motion.section
        className="mt-16 text-center w-full max-w-3xl px-4 sm:px-0"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.4 }}
      >
        <h2 className="text-3xl sm:text-4xl font-extrabold mb-4 animate-fadeIn">Collaborate with Us</h2>
        <p className="text-lg mb-6 animate-fadeIn">
          We’re always looking for like-minded businesses, organisations, and
          individuals who want to support our mission of inclusivity and equality.
        </p>
        <Link
          href="/Collaborate"
          className="bg-green-500 text-white px-8 py-3 rounded-full font-bold text-lg hover:bg-green-400 transition transform hover:scale-105 shadow-lg"
        >
          Learn More
        </Link>
      </motion.section>

      {/* Events Section */}
      <motion.div
        className="w-full mt-12"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.6 }}
      >
        <EventCard />
      </motion.div>
    </motion.div>
  );
}
