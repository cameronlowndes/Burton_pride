"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import Countdown from "../Countdown";
import EventCard from "../Card/EventCard";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
};

export default function HomeClient() {
  return (
    <motion.div
      className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white"
      initial="hidden"
      animate="visible"
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }}
    >
      <div className="px-5 py-10 sm:px-10 sm:py-14 lg:px-16">
        {/* HERO */}
        <motion.section
          className="relative flex flex-col items-center gap-4 overflow-hidden pt-4 text-center sm:gap-6 sm:pt-10"
          variants={fadeUp}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <div className="pointer-events-none absolute left-1/2 top-0 h-[320px] w-[320px] -translate-x-1/2 rounded-full bg-pink-400/30 blur-3xl animate-pulse mix-blend-overlay sm:h-[520px] sm:w-[520px]" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-[220px] w-[220px] rounded-full bg-blue-400/30 blur-3xl animate-pulse mix-blend-overlay sm:h-[320px] sm:w-[320px]" />

          <motion.div
            className="relative overflow-hidden rounded-full border-4 border-white shadow-2xl shadow-pink-400/50"
            style={{ width: 160, height: 160 }}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 120 }}
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
            className="relative text-4xl font-extrabold uppercase drop-shadow-[0_0_20px_rgba(255,255,255,0.8)] sm:text-7xl"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            Welcome to Burton Pride
          </motion.h1>

          <motion.p
            className="relative max-w-3xl text-base font-medium leading-relaxed text-white/90 sm:text-xl"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            At Burton Pride, we believe in the power of community. We are proud to be
            grassroots-led and community-driven. We are here for everyone in the LGBTQIA+
            community, celebrating diversity, inclusion, and equality for all.
          </motion.p>

          <motion.div
            className="relative flex flex-wrap justify-center gap-3 pt-2 sm:gap-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <Link
              href="/about"
              className="rounded-full bg-white px-5 py-2.5 text-base font-bold text-purple-700 shadow-lg transition-transform hover:scale-105 hover:bg-purple-100 sm:px-6 sm:py-3 sm:text-lg"
            >
              About Us
            </Link>

            <Link
              href="/about/OurCoreValues"
              className="rounded-full bg-purple-700 px-5 py-2.5 text-base font-bold text-white shadow-lg transition-transform hover:scale-105 hover:bg-purple-600 sm:px-6 sm:py-3 sm:text-lg"
            >
              Our Core Values
            </Link>
          </motion.div>
        </motion.section>

        {/* MAIN CONTENT */}
        <div className="mt-10 sm:mt-14">
          <div className="mx-auto w-full max-w-6xl space-y-10 sm:space-y-14">
            {/* Countdown */}
            <motion.section variants={fadeUp} transition={{ delay: 0.1, duration: 0.6 }}>
              <div className="rounded-3xl border border-white/20 bg-white/10 p-4 shadow-2xl backdrop-blur-md sm:p-6">
                <Countdown />
              </div>
            </motion.section>

            {/* Event Card */}
            <motion.section variants={fadeUp} transition={{ delay: 0.15, duration: 0.6 }}>
              <div className="rounded-3xl border border-white/20 bg-white/10 p-4 shadow-2xl backdrop-blur-md sm:p-6">
                <EventCard />
              </div>
            </motion.section>

            {/* Volunteer CTA */}
            <motion.section variants={fadeUp} transition={{ delay: 0.18, duration: 0.6 }}>
              <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 p-8 text-center shadow-2xl sm:p-10">
                <div className="pointer-events-none absolute -left-24 -top-24 h-60 w-60 rounded-full bg-green-300/40 blur-3xl animate-pulse mix-blend-overlay sm:h-80 sm:w-80" />
                <div className="pointer-events-none absolute -bottom-24 -right-24 h-60 w-60 rounded-full bg-teal-300/40 blur-3xl animate-pulse mix-blend-overlay sm:h-80 sm:w-80" />

                <div className="relative">
                  <h2 className="mb-3 text-3xl font-extrabold sm:text-5xl">
                    💚 Volunteer With Burton Pride
                  </h2>

                  <p className="mx-auto mb-6 max-w-3xl text-base leading-relaxed text-white/90 sm:text-xl">
                    Want to help make Burton Pride amazing? Join our volunteer team and be
                    part of creating safe, inclusive, and unforgettable Pride events for the
                    whole community.
                  </p>

                  <Link
                    href="/JoinUS/Volunteer"
                    className="inline-flex items-center justify-center rounded-full bg-yellow-400 px-8 py-3 text-lg font-bold text-black shadow-lg shadow-yellow-400/50 transition-transform hover:scale-105 hover:bg-yellow-300 sm:px-10 sm:py-4 sm:text-xl"
                  >
                    Become a Volunteer
                  </Link>
                </div>
              </div>
            </motion.section>

            {/* Competition */}
            <motion.section variants={fadeUp} transition={{ delay: 0.2, duration: 0.6 }}>
              <div className="rounded-3xl border border-white/20 bg-white/10 p-8 text-center shadow-2xl backdrop-blur-lg sm:p-10">
                <h2 className="mb-3 text-3xl font-extrabold sm:text-4xl">
                  🌈 Windows Of Hope Competition 2026
                </h2>

                <p className="mx-auto mb-6 max-w-3xl text-base leading-relaxed text-white/90 sm:text-lg">
                  Show your creativity and Pride spirit! Enter our competition for a chance to win
                  amazing prizes. Upload your design, photo, or artwork and take part in the
                  celebration.
                </p>

                <p className="mb-6 text-xl font-bold">Entry Fee: £2</p>

                <Link
                  href="/Competition"
                  className="inline-flex items-center justify-center rounded-full bg-yellow-400 px-9 py-3.5 text-lg font-bold text-black shadow-lg shadow-yellow-400/50 transition-transform hover:scale-105 hover:bg-yellow-300 sm:px-10 sm:py-4 sm:text-xl"
                >
                  Enter Competition
                </Link>
              </div>
            </motion.section>

            <motion.section variants={fadeUp} transition={{ delay: 0.25, duration: 0.6 }}>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-6 sm:gap-8">
                <div className="flex flex-col rounded-3xl border border-white/20 bg-white/10 p-7 shadow-2xl backdrop-blur-md sm:p-10">
                  <h2 className="mb-3 text-2xl font-extrabold sm:text-3xl">
                    Burton Pride 2026 Application Forms
                  </h2>
                  <p className="mb-6 text-base leading-relaxed text-white/90 sm:text-lg">
                    We are looking for local companies and charities to take part in Burton Pride
                    2026.
                  </p>
                  <div className="mt-auto">
                    <Link
                      href="/BurtronPride2026"
                      className="inline-flex rounded-full bg-green-500 px-7 py-3 text-base font-bold text-white shadow-lg transition-transform hover:scale-105 hover:bg-green-400 sm:text-lg"
                    >
                      Learn More
                    </Link>
                  </div>
                </div>

                <div className="flex flex-col rounded-3xl border border-white/20 bg-white/10 p-7 shadow-2xl backdrop-blur-md sm:p-10">
                  <h2 className="mb-3 text-2xl font-extrabold sm:text-3xl">Collaborate with Us</h2>
                  <p className="mb-6 text-base leading-relaxed text-white/90 sm:text-lg">
                    We’re always looking for like-minded businesses, organisations, and individuals
                    who want to support our mission of inclusivity and equality.
                  </p>
                  <div className="mt-auto">
                    <Link
                      href="/Collaborate"
                      className="inline-flex rounded-full bg-green-500 px-7 py-3 text-base font-bold text-white shadow-lg transition-transform hover:scale-105 hover:bg-green-400 sm:text-lg"
                    >
                      Learn More
                    </Link>
                  </div>
                </div>
              </div>
            </motion.section>

            <motion.section variants={fadeUp} transition={{ delay: 0.3, duration: 0.6 }}>
              <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 p-7 shadow-2xl shadow-pink-500/40 sm:p-12">
                <div className="pointer-events-none absolute -left-24 -top-24 h-60 w-60 rounded-full bg-pink-400/40 blur-3xl animate-pulse mix-blend-overlay sm:h-80 sm:w-80" />
                <div className="pointer-events-none absolute -bottom-24 -right-24 h-60 w-60 rounded-full bg-blue-400/40 blur-3xl animate-pulse mix-blend-overlay sm:h-80 sm:w-80" />

                <div className="relative">
                  <h2 className="mb-3 text-3xl font-extrabold drop-shadow-lg sm:text-5xl">
                    Give Your Feedback To Burton Pride 💖
                  </h2>
                  <p className="mb-6 max-w-3xl text-base leading-relaxed text-white/90 sm:text-xl">
                    We would love your help in making next year’s event even better. Every comment,
                    suggestion, or idea helps us improve and make future events even more enjoyable.
                  </p>

                  <Link
                    href="/FeedBack"
                    className="inline-flex rounded-full bg-yellow-400 px-8 py-3 text-lg font-bold text-black shadow-lg shadow-yellow-400/50 transition-transform hover:scale-105 hover:bg-yellow-300 sm:px-10 sm:py-4 sm:text-xl"
                  >
                    Feedback
                  </Link>
                </div>
              </div>
            </motion.section>

            <motion.section variants={fadeUp} transition={{ delay: 0.35, duration: 0.6 }}>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-6 sm:gap-8">
                <div className="flex flex-col rounded-3xl border border-white/20 bg-white/10 p-7 shadow-2xl backdrop-blur-md sm:p-10">
                  <h2 className="mb-3 text-2xl font-extrabold sm:text-3xl">
                    Support Burton Pride 💖
                  </h2>
                  <p className="mb-6 text-base leading-relaxed text-white/90 sm:text-lg">
                    Help us bring the best Pride events to Burton. Your donation supports community
                    initiatives, parade organisation, and inclusivity programmes.
                  </p>

                  <div className="mt-auto">
                    <Link
                      href="/DonateToUs"
                      className="inline-flex rounded-full bg-yellow-400 px-8 py-3 text-lg font-bold text-black shadow-lg shadow-yellow-400/50 transition-transform hover:scale-105 hover:bg-yellow-300"
                    >
                      Donate Now
                    </Link>
                  </div>
                </div>

                <div className="flex flex-col rounded-3xl border border-white/20 bg-white/10 p-7 shadow-2xl backdrop-blur-md sm:p-10">
                  <h2 className="mb-3 text-2xl font-extrabold sm:text-3xl">Follow Burton Pride</h2>
                  <p className="mb-6 text-base leading-relaxed text-white/90 sm:text-lg">
                    Keep up to date with announcements, events, and community updates.
                  </p>

                  <div className="mt-auto">
                    <div className="flex flex-wrap gap-4">
                      <Link
                        href="https://www.facebook.com/profile.php?id=61556621159422"
                        target="_blank"
                        className="inline-flex rounded-full bg-blue-600 px-7 py-3 text-base font-semibold text-white shadow-md transition-transform hover:scale-105 hover:bg-blue-500"
                      >
                        Facebook
                      </Link>

                      <Link
                        href="https://www.instagram.com/prideburton/"
                        target="_blank"
                        className="inline-flex rounded-full bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 px-7 py-3 text-base font-semibold text-white shadow-md transition-transform hover:scale-105 hover:opacity-90"
                      >
                        Instagram
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>

            <div className="h-10 sm:h-16" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}