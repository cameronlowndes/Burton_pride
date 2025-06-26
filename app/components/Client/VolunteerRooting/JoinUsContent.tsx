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
    <>
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
        <div className="rounded-full overflow-hidden w-[180px] h-[180px]">
          <Image
            src="/image/logo.jpg"
            alt="Burton Pride Logo"
            width={180}
            height={180}
            className="object-cover w-full h-full rounded-full"
          />
        </div>

        <h1 className="text-4xl sm:text-6xl font-bold text-white">Join the Movement</h1>
        <p className="text-lg sm:text-xl text-white max-w-2xl">
          Whether you're volunteering your time, donating, or collaborating Burton Pride thrives because of people like you!
        </p>
      </motion.section>

      {/* Volunteer Section */}
      <motion.section
        className="mt-16 text-center w-full max-w-4xl"
        initial="hidden"
        animate="visible"
        custom={0}
        variants={sectionVariants}
      >
        <h2 className="text-3xl font-semibold mb-6">Become a Volunteer</h2>
        <p className="text-lg mb-6">
          Help us make Burton Pride an inclusive event! We’re always looking for passionate individuals to join our volunteer team and contribute to the success of the festival.
        </p>
        <Link
          href="/JoinUS/Volunteer"
          className="bg-white text-pink-600 px-6 py-3 rounded-full font-semibold text-lg hover:bg-opacity-80 transition"
        >
          Volunteer with Us
        </Link>
      </motion.section>

      {/* Donate Section */}
      <motion.section
        className="mt-16 text-center w-full max-w-4xl"
        initial="hidden"
        animate="visible"
        custom={1}
        variants={sectionVariants}
      >
        <h2 className="text-3xl font-semibold mb-6">Support with a Donation</h2>
        <p className="text-lg mb-6">
          Your donations go directly towards organizing our events, community initiatives, and making Burton Pride an unforgettable experience.
        </p>
        <Link
          href="https://www.gofundme.com/f/raising-funds-for-burton-pride"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-yellow-400 text-black px-6 py-3 rounded-full font-semibold text-lg hover:bg-yellow-300 transition"
        >
          Donate Now
        </Link>
      </motion.section>

      {/* Collaborate Section */}
      <motion.section
        className="mt-16 text-center w-full max-w-4xl"
        initial="hidden"
        animate="visible"
        custom={2}
        variants={sectionVariants}
      >
        <h2 className="text-3xl font-semibold mb-6">Collaborate with Us</h2>
        <p className="text-lg mb-6">
          We’re always looking for like-minded businesses, organisations, and individuals who want to support our mission of inclusivity and equality.
        </p>
        <Link
          href="/Collaborate"
          className="bg-white text-pink-600 px-6 py-3 rounded-full font-semibold text-lg hover:bg-opacity-80 transition"
        >
          About Collaborating
        </Link>
      </motion.section>

      {/* Contact Section */}
      <motion.section
        className="mt-16 text-center w-full max-w-3xl"
        initial="hidden"
        animate="visible"
        custom={3}
        variants={sectionVariants}
      >
        <h2 className="text-3xl font-semibold mb-4">Get in Touch</h2>
        <p className="text-lg mb-6">
          Have questions or want to discuss how you can get involved? We’d love to hear from you!
        </p>
        <div className="pb-10">
          <Link
            href="/ContactUS"
            className="bg-white text-pink-600 px-6 py-3 rounded-full font-semibold text-lg hover:bg-opacity-80 transition"
          >
            Contact Us
          </Link>
        </div>
      </motion.section>
    </>
  );
}
