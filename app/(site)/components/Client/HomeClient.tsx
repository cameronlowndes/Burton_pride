"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import EventCard from "../Card/EventCard";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
};

export default function HomeClient() {
  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br  text-white"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.12 } },
      }}
    >
      <div className="px-5 py-10 sm:px-10 sm:py-14 lg:px-16">
        {/* HERO */}
        <motion.section
          className="relative flex flex-col items-center overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 px-5 py-12 text-center shadow-2xl backdrop-blur-md sm:px-10 sm:py-16"
          variants={fadeUp}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <div className="pointer-events-none absolute left-1/2 top-0 h-[360px] w-[360px] -translate-x-1/2 rounded-full bg-pink-300/30 blur-3xl animate-pulse" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-[260px] w-[260px] rounded-full bg-blue-300/30 blur-3xl animate-pulse" />

          <motion.div
            className="relative mb-6 overflow-hidden rounded-full border-4 border-white shadow-2xl shadow-pink-400/50"
            style={{ width: 165, height: 165 }}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 120 }}
          >
            <Image
              src="/image/Logo.png"
              alt="Burton Pride Logo"
              width={165}
              height={165}
              className="rounded-full object-cover"
              priority
            />
          </motion.div>

          <p className="relative mb-4 inline-flex rounded-full bg-yellow-300 px-5 py-2 text-sm font-black uppercase tracking-wide text-purple-950 shadow-xl">
            Grassroots Pride • Community Led • Free To Attend
          </p>

          <h1 className="relative max-w-5xl text-4xl font-black uppercase leading-tight drop-shadow-[0_0_20px_rgba(255,255,255,0.7)] sm:text-7xl">
            Welcome to Burton Pride
          </h1>

          <p className="relative mt-5 max-w-3xl text-base font-medium leading-relaxed text-white/95 sm:text-xl">
            Burton Pride is a grassroots, community-led Pride for Burton upon
            Trent. We celebrate LGBTQIA+ people, inclusion, diversity and
            equality while creating safe and welcoming spaces for everyone.
          </p>

          <div className="relative mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/DonateToUs"
              className="rounded-full bg-yellow-300 px-8 py-4 text-lg font-black text-purple-950 shadow-2xl shadow-yellow-300/50 transition-transform hover:scale-110 hover:bg-white sm:text-xl"
            >
              💖 Donate Now
            </Link>

            <Link
              href="/FeedBack"
              className="rounded-full bg-white px-8 py-4 text-lg font-black text-purple-700 shadow-xl transition-transform hover:scale-105 hover:bg-purple-100 sm:text-xl"
            >
              💬 Give Feedback
            </Link>

            <Link
              href="/about"
              className="rounded-full bg-purple-700 px-8 py-4 text-lg font-bold text-white shadow-xl transition-transform hover:scale-105 hover:bg-purple-600 sm:text-xl"
            >
              About Us
            </Link>
          </div>
        </motion.section>

        <div className="mx-auto mt-10 w-full max-w-6xl space-y-10 sm:mt-14 sm:space-y-14">
          {/* THANK YOU SECTION */}
          <motion.section
            variants={fadeUp}
            transition={{ delay: 0.1, duration: 0.6 }}
          >
            <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 p-8 text-center shadow-2xl sm:p-12">
              <p className="mb-3 inline-flex rounded-full bg-white/20 px-5 py-2 text-sm font-black uppercase tracking-wide text-white shadow-lg backdrop-blur-md">
                Thank you for supporting Burton Pride
              </p>

              <h2 className="mb-4 text-4xl font-black drop-shadow-lg sm:text-6xl">
                🌈 Burton Pride 2026 — Thank You
              </h2>

              <p className="mx-auto mb-6 max-w-3xl text-base leading-relaxed text-white/95 sm:text-xl">
                Thank you to everyone who supported Burton Pride 2026. We are
                now looking ahead to the future and continuing to build a safe,
                inclusive and community-led Pride for Burton upon Trent.
              </p>

              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="/DonateToUs"
                  className="rounded-full bg-yellow-400 px-9 py-3.5 text-lg font-black text-black shadow-xl transition-transform hover:scale-105 hover:bg-yellow-300"
                >
                  💖 Support Burton Pride
                </Link>

                <Link
                  href="/FeedBack"
                  className="rounded-full bg-white px-9 py-3.5 text-lg font-black text-purple-700 shadow-xl transition-transform hover:scale-105 hover:bg-purple-100"
                >
                  Give Feedback
                </Link>
              </div>
            </div>
          </motion.section>

          {/* DONATION SECTION */}
          <motion.section
            variants={fadeUp}
            transition={{ delay: 0.12, duration: 0.6 }}
          >
            <div className="relative overflow-hidden rounded-3xl border-4 border-yellow-300 bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-500 p-5 text-center shadow-2xl shadow-yellow-400/40 sm:p-8">
              <div className="relative rounded-[28px] border border-white/25 bg-purple-950/85 px-5 py-8 shadow-2xl backdrop-blur-md sm:px-10 sm:py-12">
                <p className="mb-4 inline-flex rounded-full bg-yellow-300 px-5 py-2 text-sm font-black uppercase tracking-wide text-purple-950 shadow-xl">
                  Help keep Burton Pride free
                </p>

                <h2 className="mb-5 text-4xl font-black text-white drop-shadow-lg sm:text-6xl">
                  💖 Support Your Local Pride
                </h2>

                <p className="mx-auto mb-7 max-w-3xl text-base font-semibold leading-8 text-white/95 sm:text-xl">
                  Every donation helps us fund event safety, accessibility,
                  entertainment, community support, toilets, first aid and the
                  future of Burton Pride.
                </p>

                <div className="mx-auto mb-8 grid max-w-4xl gap-4 sm:grid-cols-4">
                  <Link
                    href="/DonateToUs?amount=3"
                    className="rounded-2xl border border-white/25 bg-white/15 p-5 shadow-xl backdrop-blur-md transition-transform hover:scale-105 hover:bg-white/25"
                  >
                    <p className="text-4xl font-black">£3</p>
                    <p className="mt-2 text-sm font-bold text-white">
                      Helps community support
                    </p>
                  </Link>

                  <Link
                    href="/DonateToUs?amount=5"
                    className="rounded-2xl border border-white/25 bg-white/15 p-5 shadow-xl backdrop-blur-md transition-transform hover:scale-105 hover:bg-white/25"
                  >
                    <p className="text-4xl font-black">£5</p>
                    <p className="mt-2 text-sm font-bold text-white">
                      Helps Pride resources
                    </p>
                  </Link>

                  <Link
                    href="/DonateToUs?amount=10"
                    className="rounded-2xl border border-white/25 bg-white/15 p-5 shadow-xl backdrop-blur-md transition-transform hover:scale-105 hover:bg-white/25"
                  >
                    <p className="text-4xl font-black">£10</p>
                    <p className="mt-2 text-sm font-bold text-white">
                      Helps event safety
                    </p>
                  </Link>

                  <Link
                    href="/DonateToUs"
                    className="rounded-2xl border border-white/25 bg-white/15 p-5 shadow-xl backdrop-blur-md transition-transform hover:scale-105 hover:bg-white/25"
                  >
                    <p className="text-4xl font-black">Any</p>
                    <p className="mt-2 text-sm font-bold text-white">
                      Give what you can
                    </p>
                  </Link>
                </div>

                <div className="flex flex-wrap justify-center gap-4">
                  <Link
                    href="/DonateToUs"
                    className="rounded-full bg-yellow-300 px-10 py-4 text-xl font-black text-purple-950 shadow-2xl shadow-yellow-300/40 transition-transform hover:scale-110 hover:bg-white"
                  >
                    💖 Donate Now
                  </Link>

                  <Link
                    href="/DonateToUs?type=monthly"
                    className="rounded-full bg-white px-10 py-4 text-xl font-black text-pink-600 shadow-2xl transition-transform hover:scale-110 hover:bg-pink-50"
                  >
                    🌈 Donate Monthly
                  </Link>
                </div>

                <p className="mt-6 text-sm font-bold text-white/85">
                  Burton Pride is community-led. Every donation makes a real
                  difference.
                </p>
              </div>
            </div>
          </motion.section>

          {/* EVENT CARD */}
          <motion.section
            variants={fadeUp}
            transition={{ delay: 0.15, duration: 0.6 }}
          >
            <div className="rounded-3xl border border-white/20 bg-white/10 p-4 shadow-2xl backdrop-blur-md sm:p-6">
              <EventCard />
            </div>
          </motion.section>

          {/* QUICK LINKS */}
          <motion.section
            variants={fadeUp}
            transition={{ delay: 0.18, duration: 0.6 }}
          >
            <div className="grid gap-6 sm:grid-cols-3">
              <Link
                href="/DonateToUs"
                className="rounded-3xl border border-white/20 bg-white/15 p-7 text-center shadow-2xl backdrop-blur-md transition-transform hover:scale-105"
              >
                <p className="text-5xl">💖</p>
                <h2 className="mt-4 text-2xl font-black">Donate</h2>
                <p className="mt-2 text-white/90">
                  Help keep Burton Pride free, safe and community-led.
                </p>
              </Link>

              <Link
                href="/JoinUS/Volunteer"
                className="rounded-3xl border border-white/20 bg-white/15 p-7 text-center shadow-2xl backdrop-blur-md transition-transform hover:scale-105"
              >
                <p className="text-5xl">💚</p>
                <h2 className="mt-4 text-2xl font-black">Volunteer</h2>
                <p className="mt-2 text-white/90">
                  Join the team and help make Pride happen.
                </p>
              </Link>

              <Link
                href="/Sponsor"
                className="rounded-3xl border border-white/20 bg-white/15 p-7 text-center shadow-2xl backdrop-blur-md transition-transform hover:scale-105"
              >
                <p className="text-5xl">⭐</p>
                <h2 className="mt-4 text-2xl font-black">Sponsors</h2>
                <p className="mt-2 text-white/90">
                  See who supports your local grassroots Pride.
                </p>
              </Link>
            </div>
          </motion.section>

          {/* ABOUT / VALUES */}
          <motion.section
            variants={fadeUp}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <div className="rounded-3xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-md sm:p-12">
              <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
                <div>
                  <p className="mb-3 inline-flex rounded-full bg-white/20 px-5 py-2 text-sm font-black uppercase tracking-wide text-white">
                    About Burton Pride
                  </p>

                  <h2 className="text-3xl font-black sm:text-5xl">
                    Built by the community, for the community.
                  </h2>

                  <p className="mt-5 text-base leading-relaxed text-white/90 sm:text-lg">
                    Burton Pride exists to celebrate, support and uplift
                    LGBTQIA+ people across Burton upon Trent and surrounding
                    areas. We believe Pride should be welcoming, visible,
                    inclusive and accessible.
                  </p>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-2xl bg-white/15 p-5">
                    <h3 className="text-xl font-black">🌈 Inclusion</h3>
                    <p className="mt-2 text-white/90">
                      Everyone deserves to feel welcome, safe and respected.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white/15 p-5">
                    <h3 className="text-xl font-black">💬 Community</h3>
                    <p className="mt-2 text-white/90">
                      We work with local people, groups and organisations.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white/15 p-5">
                    <h3 className="text-xl font-black">❤️ Equality</h3>
                    <p className="mt-2 text-white/90">
                      We stand for LGBTQIA+ rights, safety and visibility.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="/about"
                  className="rounded-full bg-white px-8 py-3 text-lg font-bold text-purple-700 shadow-lg transition-transform hover:scale-105 hover:bg-purple-100"
                >
                  Learn More
                </Link>

                <Link
                  href="/about/OurCoreValues"
                  className="rounded-full bg-purple-700 px-8 py-3 text-lg font-bold text-white shadow-lg transition-transform hover:scale-105 hover:bg-purple-600"
                >
                  Our Core Values
                </Link>
              </div>
            </div>
          </motion.section>

          {/* VOLUNTEER */}
          <motion.section
            variants={fadeUp}
            transition={{ delay: 0.24, duration: 0.6 }}
          >
            <div className="rounded-3xl border border-white/20 bg-gradient-to-r from-emerald-500 to-green-600 p-8 text-center shadow-2xl sm:p-10">
              <h2 className="mb-3 text-3xl font-black sm:text-5xl">
                💚 Volunteer With Burton Pride
              </h2>

              <p className="mx-auto mb-6 max-w-3xl text-base leading-relaxed text-white/95 sm:text-xl">
                Volunteers help make Burton Pride possible. Whether you can help
                before the event, on the day, or with future planning, we would
                love to hear from you.
              </p>

              <Link
                href="/JoinUS/Volunteer"
                className="rounded-full bg-yellow-400 px-8 py-3 text-lg font-black text-black shadow-lg shadow-yellow-400/50 transition-transform hover:scale-105 hover:bg-yellow-300"
              >
                Become a Volunteer
              </Link>
            </div>
          </motion.section>

          {/* COLLABORATE */}
          <motion.section
            variants={fadeUp}
            transition={{ delay: 0.26, duration: 0.6 }}
          >
            <div className="flex flex-col rounded-3xl border border-white/20 bg-white/10 p-7 text-center shadow-2xl backdrop-blur-md sm:p-10">
              <h2 className="mb-3 text-2xl font-black sm:text-3xl">
                Collaborate With Us
              </h2>

              <p className="mx-auto mb-6 max-w-3xl text-base leading-relaxed text-white/90 sm:text-lg">
                We welcome local businesses, organisations and individuals who
                want to support inclusion, equality and community Pride.
              </p>

              <Link
                href="/Collaborate"
                className="mx-auto inline-flex w-fit rounded-full bg-green-500 px-7 py-3 text-base font-bold text-white shadow-lg transition-transform hover:scale-105 hover:bg-green-400"
              >
                Collaborate
              </Link>
            </div>
          </motion.section>

          {/* FEEDBACK */}
          <motion.section
            variants={fadeUp}
            transition={{ delay: 0.28, duration: 0.6 }}
          >
            <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 p-7 shadow-2xl shadow-pink-500/40 sm:p-12">
              <h2 className="mb-3 text-3xl font-black drop-shadow-lg sm:text-5xl">
                Give Your Feedback 💖
              </h2>

              <p className="mb-6 max-w-3xl text-base leading-relaxed text-white/90 sm:text-xl">
                Your feedback helps us improve future Burton Pride events.
                Every idea, comment or suggestion helps us make Pride better for
                the whole community.
              </p>

              <Link
                href="/FeedBack"
                className="rounded-full bg-yellow-400 px-8 py-3 text-lg font-black text-black shadow-lg shadow-yellow-400/50 transition-transform hover:scale-105 hover:bg-yellow-300"
              >
                Give Feedback
              </Link>
            </div>
          </motion.section>

          {/* SOCIAL */}
          <motion.section
            variants={fadeUp}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <div className="rounded-3xl border border-white/20 bg-white/10 p-7 text-center shadow-2xl backdrop-blur-md sm:p-10">
              <h2 className="mb-3 text-3xl font-black">Follow Burton Pride</h2>

              <p className="mx-auto mb-6 max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg">
                Keep up to date with announcements, community updates and future
                Pride events.
              </p>

              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="https://www.facebook.com/profile.php?id=61556621159422"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-blue-600 px-7 py-3 text-base font-bold text-white shadow-md transition-transform hover:scale-105 hover:bg-blue-500"
                >
                  Facebook
                </Link>

                <Link
                  href="https://www.instagram.com/prideburton/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 px-7 py-3 text-base font-bold text-white shadow-md transition-transform hover:scale-105 hover:opacity-90"
                >
                  Instagram
                </Link>
              </div>
            </div>
          </motion.section>

          <div className="h-10 sm:h-16" />
        </div>
      </div>
    </motion.div>
  );
}