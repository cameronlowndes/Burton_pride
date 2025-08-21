'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

const sectionVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.3, duration: 0.6, ease: 'easeOut' },
  }),
};

export default function JoinUsContent() {
  return (
    <div className="min-h-screen bg-gradient-to-r  text-white flex flex-col items-center p-8 sm:p-16 pb-24">
      
      {/* Hero Section */}
      <motion.section
        className="text-center flex flex-col items-center gap-6 mt-16 mb-8"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0, y: 30 },
          visible: { opacity: 1, y: 0 },
        }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <div className="rounded-full overflow-hidden w-[180px] h-[180px] shadow-[0_0_35px_rgba(255,255,255,0.7)] border-4 border-white">
          <Image
            src="/image/logo.jpg"
            alt="Burton Pride Logo"
            width={180}
            height={180}
            className="object-cover w-full h-full rounded-full"
          />
        </div>

        <h1 className="text-5xl sm:text-6xl font-extrabold text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.9)]">
          Join the Movement
        </h1>
        <p className="text-lg sm:text-xl text-white max-w-2xl bg-white/10 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-white/20">
          Whether you're volunteering your time, donating, or collaborating, Burton Pride thrives because of people like you! 🌈
        </p>
      </motion.section>

      {/* Volunteer Section */}
      <motion.section
        className="mt-16 text-center w-full max-w-4xl bg-white/10 backdrop-blur-md p-8 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.5)] border border-white/20"
        initial="hidden"
        animate="visible"
        custom={0}
        variants={sectionVariants}
      >
        <h2 className="text-3xl font-bold mb-6 text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]">
          Become a Volunteer
        </h2>
        <p className="text-lg mb-6 text-white">
          Help us make Burton Pride an inclusive event! We’re always looking for passionate individuals to join our volunteer team and contribute to the success of the festival.
        </p>
        <Link
          href="/JoinUS/Volunteer"
          className="bg-gradient-to-r from-yellow-300 via-pink-400 to-purple-500 text-black px-8 py-4 rounded-full font-bold text-lg shadow-lg hover:scale-105 hover:shadow-[0_0_35px_rgba(255,255,255,0.8)] transition-all"
        >
          🌟 Volunteer with Us
        </Link>
      </motion.section>

      {/* Donate Section */}
      <motion.section
        className="mt-16 text-center w-full max-w-4xl bg-white/10 backdrop-blur-md p-8 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.5)] border border-white/20"
        initial="hidden"
        animate="visible"
        custom={1}
        variants={sectionVariants}
      >
        <h2 className="text-3xl font-bold mb-6 text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]">
          Support with a Donation
        </h2>
        <p className="text-lg mb-6 text-white">
          Your donations go directly towards organizing our events, community initiatives, and making Burton Pride an unforgettable experience.
        </p>
        <Link
          href="https://www.gofundme.com/f/raising-funds-for-burton-pride"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-gradient-to-r from-yellow-300 via-pink-400 to-purple-500 text-black px-8 py-4 rounded-full font-bold text-lg shadow-lg hover:scale-105 hover:shadow-[0_0_35px_rgba(255,255,255,0.8)] transition-all"
        >
          💖 Donate Now
        </Link>
      </motion.section>

      {/* Collaborate Section */}
      <motion.section
        className="mt-16 text-center w-full max-w-4xl bg-white/10 backdrop-blur-md p-8 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.5)] border border-white/20"
        initial="hidden"
        animate="visible"
        custom={2}
        variants={sectionVariants}
      >
        <h2 className="text-3xl font-bold mb-6 text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]">
          Collaborate with Us
        </h2>
        <p className="text-lg mb-6 text-white">
          We’re always looking for like-minded businesses, organisations, and individuals who want to support our mission of inclusivity and equality.
        </p>
        <Link
          href="/Collaborate"
          className="bg-gradient-to-r from-yellow-300 via-pink-400 to-purple-500 text-black px-8 py-4 rounded-full font-bold text-lg shadow-lg hover:scale-105 hover:shadow-[0_0_35px_rgba(255,255,255,0.8)] transition-all"
        >
          🤝 About Collaborating
        </Link>
      </motion.section>

      {/* Contact Section */}
      <motion.section
        className="mt-16 text-center w-full max-w-3xl bg-white/10 backdrop-blur-md p-8 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.5)] border border-white/20"
        initial="hidden"
        animate="visible"
        custom={3}
        variants={sectionVariants}
      >
        <h2 className="text-3xl font-bold mb-4 text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.9)]">
          Get in Touch
        </h2>
        <p className="text-lg mb-6 text-white">
          Have questions or want to discuss how you can get involved? We’d love to hear from you!
        </p>
        <div className="pb-10">
          <Link
            href="/ContactUS"
            className="bg-gradient-to-r from-yellow-300 via-pink-400 to-purple-500 text-black px-8 py-4 rounded-full font-bold text-lg shadow-lg hover:scale-105 hover:shadow-[0_0_35px_rgba(255,255,255,0.8)] transition-all"
          >
            📬 Contact Us
          </Link>
        </div>
      </motion.section>
    </div>
  );
}
