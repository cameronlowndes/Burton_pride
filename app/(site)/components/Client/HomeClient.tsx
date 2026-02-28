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
      {/* Page padding */}
      <div className="px-5 sm:px-10 lg:px-16 py-10 sm:py-14">
        {/* HERO */}
        <motion.section
          className="relative overflow-hidden text-center flex flex-col items-center gap-4 sm:gap-6 pt-4 sm:pt-10"
          variants={fadeUp}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          {/* Glow blobs */}
          <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[320px] h-[320px] sm:w-[520px] sm:h-[520px] rounded-full bg-pink-400/30 blur-3xl animate-pulse mix-blend-overlay" />
          <div className="pointer-events-none absolute bottom-0 right-0 w-[220px] h-[220px] sm:w-[320px] sm:h-[320px] rounded-full bg-blue-400/30 blur-3xl animate-pulse mix-blend-overlay" />

          <motion.div
            className="relative rounded-full overflow-hidden shadow-2xl shadow-pink-400/50 border-4 border-white"
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
            className="relative text-4xl sm:text-7xl font-extrabold uppercase drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            Welcome to Burton Pride
          </motion.h1>

          <motion.p
            className="relative text-base sm:text-xl max-w-3xl font-medium text-white/90 leading-relaxed"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            At Burton Pride, we believe in the power of community. We are proud to be
            grassroots-led and community-driven. We are here for everyone in the LGBTQIA+
            community, celebrating diversity, inclusion, and equality for all.
          </motion.p>

          <motion.div
            className="relative flex flex-wrap justify-center gap-3 sm:gap-4 pt-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <Link
              href="/about"
              className="bg-white text-purple-700 px-5 sm:px-6 py-2.5 sm:py-3 rounded-full font-bold text-base sm:text-lg hover:bg-purple-100 transition-transform hover:scale-105 shadow-lg"
            >
              About Us
            </Link>

            <Link
              href="/about/OurCoreValues"
              className="bg-purple-700 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-full font-bold text-base sm:text-lg hover:bg-purple-600 transition-transform hover:scale-105 shadow-lg"
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
              <div className="bg-white/10 backdrop-blur-md rounded-3xl p-4 sm:p-6 border border-white/20 shadow-2xl">
                <Countdown />
              </div>
            </motion.section>

            {/* Event Card */}
            <motion.section variants={fadeUp} transition={{ delay: 0.15, duration: 0.6 }}>
              <div className="bg-white/10 backdrop-blur-md rounded-3xl p-4 sm:p-6 border border-white/20 shadow-2xl">
                <EventCard />
              </div>
            </motion.section>

            {/* Competition */}
            <motion.section variants={fadeUp} transition={{ delay: 0.2, duration: 0.6 }}>
              <div className="bg-white/10 backdrop-blur-lg p-8 sm:p-10 rounded-3xl shadow-2xl border border-white/20 text-center">
                <h2 className="text-3xl sm:text-4xl font-extrabold mb-3">
                  🌈 Windows Of Hope Competition 2026
                </h2>

                <p className="text-base sm:text-lg mb-6 text-white/90 leading-relaxed max-w-3xl mx-auto">
                  Show your creativity and Pride spirit! Enter our competition for a chance to win
                  amazing prizes. Upload your design, photo, or artwork and take part in the
                  celebration.
                </p>

                <p className="font-bold text-xl mb-6">Entry Fee: £2</p>

                <Link
                  href="/Competition"
                  className="inline-flex items-center justify-center bg-yellow-400 text-black px-9 sm:px-10 py-3.5 sm:py-4 rounded-full font-bold text-lg sm:text-xl hover:bg-yellow-300 transition-transform hover:scale-105 shadow-lg shadow-yellow-400/50"
                >
                  Enter Competition
                </Link>
              </div>
            </motion.section>

 
            <motion.section variants={fadeUp} transition={{ delay: 0.25, duration: 0.6 }}>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-6 sm:gap-8">
                <div className="bg-white/10 backdrop-blur-md rounded-3xl p-7 sm:p-10 shadow-2xl border border-white/20 flex flex-col">
                  <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">
                    Burton Pride 2026 Application Forms
                  </h2>
                  <p className="text-base sm:text-lg mb-6 text-white/90 leading-relaxed">
                    We are looking for local companies and charities to take part in Burton Pride
                    2026.
                  </p>
                  <div className="mt-auto">
                    <Link
                      href="/BurtronPride2026"
                      className="inline-flex bg-green-500 text-white px-7 py-3 rounded-full font-bold text-base sm:text-lg hover:bg-green-400 transition-transform hover:scale-105 shadow-lg"
                    >
                      Learn More
                    </Link>
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-md rounded-3xl p-7 sm:p-10 shadow-2xl border border-white/20 flex flex-col">
                  <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">Collaborate with Us</h2>
                  <p className="text-base sm:text-lg mb-6 text-white/90 leading-relaxed">
                    We’re always looking for like-minded businesses, organisations, and individuals
                    who want to support our mission of inclusivity and equality.
                  </p>
                  <div className="mt-auto">
                    <Link
                      href="/Collaborate"
                      className="inline-flex bg-green-500 text-white px-7 py-3 rounded-full font-bold text-base sm:text-lg hover:bg-green-400 transition-transform hover:scale-105 shadow-lg"
                    >
                      Learn More
                    </Link>
                  </div>
                </div>
              </div>
            </motion.section>

   
            <motion.section variants={fadeUp} transition={{ delay: 0.3, duration: 0.6 }}>
              <div className="relative overflow-hidden bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 p-7 sm:p-12 rounded-3xl shadow-2xl shadow-pink-500/40 border border-white/10">
                <div className="pointer-events-none absolute -top-24 -left-24 w-60 h-60 sm:w-80 sm:h-80 bg-pink-400/40 rounded-full blur-3xl animate-pulse mix-blend-overlay" />
                <div className="pointer-events-none absolute -bottom-24 -right-24 w-60 h-60 sm:w-80 sm:h-80 bg-blue-400/40 rounded-full blur-3xl animate-pulse mix-blend-overlay" />

                <div className="relative">
                  <h2 className="text-3xl sm:text-5xl font-extrabold mb-3 drop-shadow-lg">
                    Give Your Feedback To Burton Pride 💖
                  </h2>
                  <p className="text-base sm:text-xl mb-6 max-w-3xl text-white/90 leading-relaxed">
                    We would love your help in making next year’s event even better. Every comment,
                    suggestion, or idea helps us improve and make future events even more enjoyable.
                  </p>

                  <Link
                    href="/FeedBack"
                    className="inline-flex bg-yellow-400 text-black px-8 sm:px-10 py-3 sm:py-4 rounded-full font-bold text-lg sm:text-xl hover:bg-yellow-300 transition-transform hover:scale-105 shadow-lg shadow-yellow-400/50"
                  >
                    Feedback
                  </Link>
                </div>
              </div>
            </motion.section>


            <motion.section variants={fadeUp} transition={{ delay: 0.35, duration: 0.6 }}>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-6 sm:gap-8">
                <div className="bg-white/10 backdrop-blur-md rounded-3xl p-7 sm:p-10 shadow-2xl border border-white/20 flex flex-col">
                  <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">
                    Support Burton Pride 💖
                  </h2>
                  <p className="text-base sm:text-lg mb-6 text-white/90 leading-relaxed">
                    Help us bring the best Pride events to Burton. Your donation supports community
                    initiatives, parade organisation, and inclusivity programmes.
                  </p>

                  <div className="mt-auto">
                    <Link
                      href="https://www.gofundme.com/f/raising-funds-for-burton-pride?qid=63f32d4ac52a110d1d8046124f523f48"
                      target="_blank"
                      className="inline-flex bg-yellow-400 text-black px-8 py-3 rounded-full font-bold text-lg hover:bg-yellow-300 transition-transform hover:scale-105 shadow-lg shadow-yellow-400/50"
                    >
                      Donate Now
                    </Link>
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-md rounded-3xl p-7 sm:p-10 shadow-2xl border border-white/20 flex flex-col">
                  <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">Follow Burton Pride</h2>
                  <p className="text-base sm:text-lg mb-6 text-white/90 leading-relaxed">
                    Keep up to date with announcements, events, and community updates.
                  </p>

                  <div className="mt-auto">
                    <div className="flex flex-wrap gap-4">
                      <Link
                        href="https://www.facebook.com/profile.php?id=61556621159422"
                        target="_blank"
                        className="inline-flex bg-blue-600 text-white px-7 py-3 rounded-full text-base font-semibold shadow-md hover:bg-blue-500 transition-transform hover:scale-105"
                      >
                        Facebook
                      </Link>

                      <Link
                        href="https://www.instagram.com/prideburton/"
                        target="_blank"
                        className="inline-flex bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 text-white px-7 py-3 rounded-full text-base font-semibold shadow-md hover:opacity-90 transition-transform hover:scale-105"
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