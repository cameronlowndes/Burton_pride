"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

import EventCard from "../Card/EventCard";

const fadeUp = {
  hidden: {
    opacity: 0,
    y: 24,
  },
  visible: {
    opacity: 1,
    y: 0,
  },
};

const primaryButtonClass = `
  inline-flex
  min-h-12
  w-full
  items-center
  justify-center
  rounded-2xl
  px-6
  py-3.5
  text-center
  text-base
  font-black
  shadow-xl
  transition
  duration-200
  focus-visible:outline
  focus-visible:outline-4
  focus-visible:outline-offset-4
  focus-visible:outline-yellow-300
  active:scale-[0.98]
  sm:w-auto
  sm:rounded-full
  sm:px-8
  sm:text-lg
  motion-safe:hover:scale-105
`;

const secondaryButtonClass = `
  inline-flex
  min-h-12
  w-full
  items-center
  justify-center
  rounded-2xl
  px-6
  py-3.5
  text-center
  text-base
  font-bold
  shadow-lg
  transition
  duration-200
  focus-visible:outline
  focus-visible:outline-4
  focus-visible:outline-offset-4
  focus-visible:outline-yellow-300
  active:scale-[0.98]
  sm:w-auto
  sm:rounded-full
  sm:px-8
  sm:text-lg
  motion-safe:hover:scale-105
`;

const glassCardClass = `
  rounded-2xl
  border
  border-white/20
  bg-white/10
  shadow-xl
  backdrop-blur-md
  transition-colors
  duration-300
  sm:rounded-3xl
  dark:border-white/10
  dark:bg-[#333333]/95
  dark:shadow-black/30
`;

export default function HomeClient() {
  const prefersReducedMotion = useReducedMotion();

  const sectionTransition = prefersReducedMotion
    ? { duration: 0 }
    : {
        duration: 0.55,
        ease: "easeOut" as const,
      };

  return (
    <motion.main
      className="
        min-h-dvh
        overflow-x-hidden
        bg-transparent
        text-white
      "
      initial={prefersReducedMotion ? false : "hidden"}
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: prefersReducedMotion
            ? {}
            : {
                staggerChildren: 0.08,
              },
        },
      }}
    >
      <div
        className="
          mx-auto
          w-full
          max-w-[1600px]
          px-3
          py-4
          sm:px-6
          sm:py-8
          lg:px-10
          lg:py-10
          xl:px-14
        "
      >
        {/* =====================================================
            HERO
            ===================================================== */}
        <motion.section
          className="
            relative
            mt-16
            flex
            min-h-[calc(100dvh-7rem)]
            flex-col
            items-center
            justify-center
            overflow-hidden
            rounded-2xl
            border
            border-white/20
            bg-white/10
            px-4
            py-10
            text-center
            shadow-2xl
            backdrop-blur-md
            transition-colors
            duration-300
            sm:mt-0
            sm:min-h-0
            sm:rounded-[2rem]
            sm:px-8
            sm:py-14
            lg:px-12
            lg:py-16
            dark:border-white/10
            dark:bg-[#333333]/95
            dark:shadow-black/40
          "
          variants={fadeUp}
          transition={sectionTransition}
          aria-labelledby="home-page-title"
        >
          <div
            className="
              pointer-events-none
              absolute
              left-1/2
              top-0
              h-56
              w-56
              -translate-x-1/2
              rounded-full
              bg-pink-300/30
              blur-3xl
              sm:h-[360px]
              sm:w-[360px]
              dark:bg-pink-500/10
            "
          />

          <div
            className="
              pointer-events-none
              absolute
              bottom-0
              right-0
              h-48
              w-48
              rounded-full
              bg-blue-300/30
              blur-3xl
              sm:h-[260px]
              sm:w-[260px]
              dark:bg-blue-500/10
            "
          />

          <motion.div
            className="
              relative
              mb-5
              h-28
              w-28
              overflow-hidden
              rounded-full
              border-4
              border-white
              shadow-2xl
              shadow-pink-400/40
              sm:mb-6
              sm:h-40
              sm:w-40
            "
            initial={
              prefersReducedMotion
                ? false
                : {
                    scale: 0.88,
                    opacity: 0,
                  }
            }
            animate={{
              scale: 1,
              opacity: 1,
            }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : {
                    delay: 0.1,
                    type: "spring",
                    stiffness: 120,
                  }
            }
          >
            <Image
              src="/image/Logo.png"
              alt="Burton Pride logo"
              fill
              sizes="(max-width: 640px) 112px, 160px"
              className="object-cover"
              priority
            />
          </motion.div>

          <p
            className="
              relative
              mb-4
              inline-flex
              max-w-full
              rounded-full
              bg-yellow-300
              px-4
              py-2
              text-center
              text-xs
              font-black
              uppercase
              leading-5
              tracking-wide
              text-purple-950
              shadow-xl
              sm:px-5
              sm:text-sm
            "
          >
            Grassroots Pride • Community Led • Free To Attend
          </p>

          <h1
            id="home-page-title"
            className="
              relative
              max-w-5xl
              text-balance
              text-4xl
              font-black
              uppercase
              leading-[1.05]
              tracking-tight
              drop-shadow-[0_0_18px_rgba(255,255,255,0.45)]
              sm:text-6xl
              lg:text-7xl
            "
          >
            Welcome to Burton Pride
          </h1>

          <p
            className="
              relative
              mt-5
              max-w-3xl
              text-pretty
              text-base
              font-medium
              leading-7
              text-white/95
              sm:text-lg
              sm:leading-8
              lg:text-xl
            "
          >
            Burton Pride is a grassroots, community-led Pride for Burton upon
            Trent. We celebrate LGBTQIA+ people, inclusion, diversity and
            equality while creating safe and welcoming spaces for everyone.
          </p>

          <div
            className="
              relative
              mt-7
              grid
              w-full
              max-w-3xl
              gap-3
              sm:flex
              sm:flex-wrap
              sm:justify-center
              sm:gap-4
            "
          >
            <Link
              href="/DonateToUs"
              className={`
                ${primaryButtonClass}
                bg-yellow-300
                text-purple-950
                shadow-yellow-300/30
                hover:bg-white
              `}
            >
              <span aria-hidden="true">💖</span>
              <span className="ml-2">Donate Now</span>
            </Link>

            <Link
              href="/FeedBack"
              className={`
                ${primaryButtonClass}
                bg-white
                text-purple-700
                hover:bg-purple-100
                dark:bg-zinc-100
                dark:text-purple-800
                dark:hover:bg-white
              `}
            >
              <span aria-hidden="true">💬</span>
              <span className="ml-2">Give Feedback</span>
            </Link>

            <Link
              href="/about"
              className={`
                ${secondaryButtonClass}
                bg-purple-700
                text-white
                hover:bg-purple-600
              `}
            >
              About Us
            </Link>
          </div>
        </motion.section>

        <div
          className="
            mx-auto
            mt-6
            w-full
            max-w-7xl
            space-y-6
            sm:mt-10
            sm:space-y-10
            lg:mt-12
            lg:space-y-12
          "
        >
          {/* =====================================================
              MAIN QUICK ACTIONS
              ===================================================== */}
          <motion.section
            variants={fadeUp}
            transition={sectionTransition}
            aria-labelledby="quick-actions-heading"
          >
            <h2 id="quick-actions-heading" className="sr-only">
              Quick actions
            </h2>

            <div className="grid gap-3 sm:grid-cols-3 sm:gap-5">
              <Link
                href="/DonateToUs"
                className={`
                  ${glassCardClass}
                  group
                  flex
                  min-h-40
                  flex-col
                  items-center
                  justify-center
                  p-5
                  text-center
                  transition-transform
                  duration-200
                  focus-visible:outline
                  focus-visible:outline-4
                  focus-visible:outline-offset-4
                  focus-visible:outline-yellow-300
                  active:scale-[0.98]
                  motion-safe:hover:-translate-y-1
                  motion-safe:hover:bg-white/20
                  dark:hover:bg-[#3d3d3d]
                `}
              >
                <span className="text-4xl sm:text-5xl" aria-hidden="true">
                  💖
                </span>

                <h3 className="mt-3 text-xl font-black sm:text-2xl">
                  Donate
                </h3>

                <p className="mt-2 max-w-sm text-sm leading-6 text-white/90 sm:text-base">
                  Help keep Burton Pride free, safe and community-led.
                </p>
              </Link>

              <Link
                href="/JoinUS/Volunteer"
                className={`
                  ${glassCardClass}
                  group
                  flex
                  min-h-40
                  flex-col
                  items-center
                  justify-center
                  p-5
                  text-center
                  transition-transform
                  duration-200
                  focus-visible:outline
                  focus-visible:outline-4
                  focus-visible:outline-offset-4
                  focus-visible:outline-yellow-300
                  active:scale-[0.98]
                  motion-safe:hover:-translate-y-1
                  motion-safe:hover:bg-white/20
                  dark:hover:bg-[#3d3d3d]
                `}
              >
                <span className="text-4xl sm:text-5xl" aria-hidden="true">
                  💚
                </span>

                <h3 className="mt-3 text-xl font-black sm:text-2xl">
                  Volunteer
                </h3>

                <p className="mt-2 max-w-sm text-sm leading-6 text-white/90 sm:text-base">
                  Join the team and help make Pride happen.
                </p>
              </Link>

              <Link
                href="/Sponsor"
                className={`
                  ${glassCardClass}
                  group
                  flex
                  min-h-40
                  flex-col
                  items-center
                  justify-center
                  p-5
                  text-center
                  transition-transform
                  duration-200
                  focus-visible:outline
                  focus-visible:outline-4
                  focus-visible:outline-offset-4
                  focus-visible:outline-yellow-300
                  active:scale-[0.98]
                  motion-safe:hover:-translate-y-1
                  motion-safe:hover:bg-white/20
                  dark:hover:bg-[#3d3d3d]
                `}
              >
                <span className="text-4xl sm:text-5xl" aria-hidden="true">
                  ⭐
                </span>

                <h3 className="mt-3 text-xl font-black sm:text-2xl">
                  Sponsors
                </h3>

                <p className="mt-2 max-w-sm text-sm leading-6 text-white/90 sm:text-base">
                  See who supports your local grassroots Pride.
                </p>
              </Link>
            </div>
          </motion.section>

          {/* =====================================================
              THANK YOU
              ===================================================== */}
          <motion.section
            variants={fadeUp}
            transition={sectionTransition}
            aria-labelledby="thank-you-heading"
          >
            <div
              className="
                relative
                overflow-hidden
                rounded-2xl
                border
                border-white/20
                bg-gradient-to-r
                from-pink-500
                via-purple-500
                to-blue-500
                px-5
                py-8
                text-center
                shadow-2xl
                transition-colors
                duration-300
                sm:rounded-3xl
                sm:px-10
                sm:py-12
                dark:border-white/10
                dark:bg-[#333333]
                dark:bg-none
                dark:shadow-black/40
              "
            >
              <p
                className="
                  mb-3
                  inline-flex
                  rounded-full
                  bg-white/20
                  px-4
                  py-2
                  text-xs
                  font-black
                  uppercase
                  leading-5
                  tracking-wide
                  text-white
                  shadow-lg
                  backdrop-blur-md
                  sm:px-5
                  sm:text-sm
                "
              >
                Thank you for supporting Burton Pride
              </p>

              <h2
                id="thank-you-heading"
                className="
                  text-balance
                  text-3xl
                  font-black
                  leading-tight
                  drop-shadow-lg
                  sm:text-5xl
                  lg:text-6xl
                "
              >
                <span aria-hidden="true">🌈</span> Burton Pride 2026 — Thank You
              </h2>

              <p
                className="
                  mx-auto
                  mt-4
                  max-w-3xl
                  text-base
                  leading-7
                  text-white/95
                  sm:text-lg
                  sm:leading-8
                  lg:text-xl
                "
              >
                Thank you to everyone who supported Burton Pride 2026. We are
                now looking ahead to the future and continuing to build a safe,
                inclusive and community-led Pride for Burton upon Trent.
              </p>

              <div
                className="
                  mx-auto
                  mt-6
                  grid
                  max-w-2xl
                  gap-3
                  sm:flex
                  sm:flex-wrap
                  sm:justify-center
                  sm:gap-4
                "
              >
                <Link
                  href="/DonateToUs"
                  className={`
                    ${primaryButtonClass}
                    bg-yellow-400
                    text-black
                    hover:bg-yellow-300
                  `}
                >
                  <span aria-hidden="true">💖</span>
                  <span className="ml-2">Support Burton Pride</span>
                </Link>

                <Link
                  href="/FeedBack"
                  className={`
                    ${primaryButtonClass}
                    bg-white
                    text-purple-700
                    hover:bg-purple-100
                    dark:bg-zinc-100
                    dark:text-purple-800
                    dark:hover:bg-white
                  `}
                >
                  Give Feedback
                </Link>
              </div>
            </div>
          </motion.section>

          {/* =====================================================
              EVENT
              ===================================================== */}
          <motion.section
            variants={fadeUp}
            transition={sectionTransition}
            aria-label="Burton Pride event information"
          >
            <div className={`${glassCardClass} p-3 sm:p-5 lg:p-6`}>
              <EventCard />
            </div>
          </motion.section>

          {/* =====================================================
              DONATION
              ===================================================== */}
          <motion.section
            variants={fadeUp}
            transition={sectionTransition}
            aria-labelledby="donation-heading"
          >
            <div
              className="
                relative
                overflow-hidden
                rounded-2xl
                border-2
                border-yellow-300
                bg-gradient-to-r
                from-yellow-400
                via-orange-400
                to-pink-500
                p-2
                shadow-2xl
                shadow-yellow-400/20
                transition-colors
                duration-300
                sm:rounded-3xl
                sm:border-4
                sm:p-4
                dark:border-white/10
                dark:bg-[#333333]
                dark:bg-none
                dark:shadow-black/40
              "
            >
              <div
                className="
                  relative
                  rounded-xl
                  border
                  border-white/20
                  bg-purple-950/90
                  px-4
                  py-8
                  text-center
                  shadow-2xl
                  backdrop-blur-md
                  sm:rounded-[1.4rem]
                  sm:px-8
                  sm:py-12
                  dark:border-white/10
                  dark:bg-[#292929]
                "
              >
                <p
                  className="
                    mb-4
                    inline-flex
                    rounded-full
                    bg-yellow-300
                    px-4
                    py-2
                    text-xs
                    font-black
                    uppercase
                    leading-5
                    tracking-wide
                    text-purple-950
                    shadow-xl
                    sm:px-5
                    sm:text-sm
                  "
                >
                  Help keep Burton Pride free
                </p>

                <h2
                  id="donation-heading"
                  className="
                    text-balance
                    text-3xl
                    font-black
                    leading-tight
                    text-white
                    drop-shadow-lg
                    sm:text-5xl
                    lg:text-6xl
                  "
                >
                  <span aria-hidden="true">💖</span> Support Your Local Pride
                </h2>

                <p
                  className="
                    mx-auto
                    mt-5
                    max-w-3xl
                    text-base
                    font-medium
                    leading-7
                    text-white/95
                    sm:text-lg
                    sm:leading-8
                    lg:text-xl
                  "
                >
                  Help us keep Burton Pride free for everyone. Every donation
                  helps us provide local support, celebrate community art, share
                  Pride resources and keep our events safe and welcoming.
                </p>

                <div
                  className="
                    mx-auto
                    mt-7
                    grid
                    max-w-5xl
                    grid-cols-2
                    gap-3
                    lg:grid-cols-4
                    lg:gap-4
                  "
                >
                  <Link
                    href="/DonateToUs?amount=3"
                    className="
                      flex
                      min-h-32
                      flex-col
                      items-center
                      justify-center
                      rounded-xl
                      border
                      border-white/25
                      bg-white/10
                      p-4
                      text-center
                      shadow-lg
                      backdrop-blur-md
                      transition
                      focus-visible:outline
                      focus-visible:outline-4
                      focus-visible:outline-offset-4
                      focus-visible:outline-yellow-300
                      active:scale-[0.98]
                      sm:rounded-2xl
                      sm:p-5
                      motion-safe:hover:-translate-y-1
                      motion-safe:hover:bg-white/20
                    "
                  >
                    <span className="text-3xl font-black sm:text-4xl">£3</span>
                    <span className="mt-2 text-sm font-bold leading-5">
                      Helps community support
                    </span>
                  </Link>

                  <Link
                    href="/DonateToUs?amount=5"
                    className="
                      flex
                      min-h-32
                      flex-col
                      items-center
                      justify-center
                      rounded-xl
                      border
                      border-white/25
                      bg-white/10
                      p-4
                      text-center
                      shadow-lg
                      backdrop-blur-md
                      transition
                      focus-visible:outline
                      focus-visible:outline-4
                      focus-visible:outline-offset-4
                      focus-visible:outline-yellow-300
                      active:scale-[0.98]
                      sm:rounded-2xl
                      sm:p-5
                      motion-safe:hover:-translate-y-1
                      motion-safe:hover:bg-white/20
                    "
                  >
                    <span className="text-3xl font-black sm:text-4xl">£5</span>
                    <span className="mt-2 text-sm font-bold leading-5">
                      Helps Pride resources
                    </span>
                  </Link>

                  <Link
                    href="/DonateToUs?amount=10"
                    className="
                      flex
                      min-h-32
                      flex-col
                      items-center
                      justify-center
                      rounded-xl
                      border
                      border-white/25
                      bg-white/10
                      p-4
                      text-center
                      shadow-lg
                      backdrop-blur-md
                      transition
                      focus-visible:outline
                      focus-visible:outline-4
                      focus-visible:outline-offset-4
                      focus-visible:outline-yellow-300
                      active:scale-[0.98]
                      sm:rounded-2xl
                      sm:p-5
                      motion-safe:hover:-translate-y-1
                      motion-safe:hover:bg-white/20
                    "
                  >
                    <span className="text-3xl font-black sm:text-4xl">£10</span>
                    <span className="mt-2 text-sm font-bold leading-5">
                      Helps event safety
                    </span>
                  </Link>

                  <Link
                    href="/DonateToUs"
                    className="
                      flex
                      min-h-32
                      flex-col
                      items-center
                      justify-center
                      rounded-xl
                      border
                      border-white/25
                      bg-white/10
                      p-4
                      text-center
                      shadow-lg
                      backdrop-blur-md
                      transition
                      focus-visible:outline
                      focus-visible:outline-4
                      focus-visible:outline-offset-4
                      focus-visible:outline-yellow-300
                      active:scale-[0.98]
                      sm:rounded-2xl
                      sm:p-5
                      motion-safe:hover:-translate-y-1
                      motion-safe:hover:bg-white/20
                    "
                  >
                    <span className="text-3xl font-black sm:text-4xl">Any</span>
                    <span className="mt-2 text-sm font-bold leading-5">
                      Give what you can
                    </span>
                  </Link>
                </div>

                <div
                  className="
                    mx-auto
                    mt-7
                    grid
                    max-w-3xl
                    gap-3
                    sm:flex
                    sm:flex-wrap
                    sm:justify-center
                    sm:gap-4
                  "
                >
                  <Link
                    href="/DonateToUs"
                    className={`
                      ${primaryButtonClass}
                      bg-yellow-300
                      text-purple-950
                      shadow-yellow-300/30
                      hover:bg-white
                    `}
                  >
                    <span aria-hidden="true">💖</span>
                    <span className="ml-2">Please Consider Donating</span>
                  </Link>

                  <Link
                    href="/DonateToUs?type=monthly"
                    className={`
                      ${primaryButtonClass}
                      bg-white
                      text-pink-600
                      hover:bg-pink-50
                      dark:bg-zinc-100
                      dark:text-pink-700
                      dark:hover:bg-white
                    `}
                  >
                    <span aria-hidden="true">🌈</span>
                    <span className="ml-2">Donate Monthly</span>
                  </Link>
                </div>

                <p className="mt-6 text-sm font-bold leading-6 text-white/80">
                  Burton Pride is community-led. Every donation makes a real
                  difference.
                </p>
              </div>
            </div>
          </motion.section>

          {/* =====================================================
              COMMUNITY ART
              ===================================================== */}
          <motion.section
            variants={fadeUp}
            transition={sectionTransition}
            aria-labelledby="community-art-heading"
          >
            <div
              className="
                relative
                overflow-hidden
                rounded-2xl
                border
                border-white/20
                bg-gradient-to-br
                from-fuchsia-600
                via-purple-600
                to-blue-600
                p-1
                shadow-2xl
                shadow-purple-500/20
                sm:rounded-3xl
                dark:border-white/10
                dark:bg-[#333333]
                dark:bg-none
                dark:shadow-black/40
              "
            >
              <div
                className="
                  relative
                  overflow-hidden
                  rounded-[0.8rem]
                  bg-purple-950/85
                  px-5
                  py-8
                  backdrop-blur-md
                  sm:rounded-[1.3rem]
                  sm:px-9
                  sm:py-11
                  dark:bg-[#292929]
                "
              >
                <div
                  className="
                    pointer-events-none
                    absolute
                    -left-16
                    -top-16
                    h-52
                    w-52
                    rounded-full
                    bg-pink-400/25
                    blur-3xl
                  "
                />

                <div
                  className="
                    pointer-events-none
                    absolute
                    -bottom-20
                    -right-16
                    h-64
                    w-64
                    rounded-full
                    bg-blue-400/25
                    blur-3xl
                  "
                />

                <div
                  className="
                    relative
                    grid
                    gap-8
                    lg:grid-cols-[1.15fr_0.85fr]
                    lg:items-center
                    lg:gap-10
                  "
                >
                  <div>
                    <p
                      className="
                        mb-4
                        inline-flex
                        rounded-full
                        bg-yellow-300
                        px-4
                        py-2
                        text-xs
                        font-black
                        uppercase
                        leading-5
                        tracking-wide
                        text-purple-950
                        shadow-xl
                        sm:px-5
                        sm:text-sm
                      "
                    >
                      Created by our community
                    </p>

                    <h2
                      id="community-art-heading"
                      className="
                        text-balance
                        text-3xl
                        font-black
                        leading-tight
                        text-white
                        drop-shadow-lg
                        sm:text-5xl
                        lg:text-6xl
                      "
                    >
                      <span aria-hidden="true">🎨</span> Burton Pride Community
                      Art
                    </h2>

                    <p
                      className="
                        mt-5
                        max-w-3xl
                        text-base
                        font-medium
                        leading-7
                        text-white/95
                        sm:text-lg
                        sm:leading-8
                      "
                    >
                      Our Community Art page is a welcoming space for local
                      LGBTQIA+ people, allies and community members to share
                      their creativity, stories and experiences through art.
                    </p>

                    <p
                      className="
                        mt-4
                        max-w-3xl
                        text-base
                        leading-7
                        text-white/85
                        sm:text-lg
                      "
                    >
                      Explore artwork created by the community, discover the
                      meaning behind each piece and learn how to submit your own
                      work for review and display.
                    </p>

                    <div className="mt-7">
                      <Link
                        href="/CommunityArt"
                        className={`
                          ${primaryButtonClass}
                          bg-yellow-300
                          text-purple-950
                          shadow-yellow-300/20
                          hover:bg-white
                        `}
                      >
                        View Community Art
                      </Link>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                    <div
                      className="
                        rounded-xl
                        border
                        border-white/15
                        bg-white/10
                        p-5
                        shadow-lg
                        backdrop-blur-md
                        sm:rounded-2xl
                        dark:border-white/10
                        dark:bg-white/[0.06]
                      "
                    >
                      <p className="text-3xl" aria-hidden="true">
                        🖼️
                      </p>

                      <h3 className="mt-3 text-xl font-black text-white">
                        Share Creativity
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-white/80">
                        Give local artists and community members a place to be
                        seen and celebrated.
                      </p>
                    </div>

                    <div
                      className="
                        rounded-xl
                        border
                        border-white/15
                        bg-white/10
                        p-5
                        shadow-lg
                        backdrop-blur-md
                        sm:rounded-2xl
                        dark:border-white/10
                        dark:bg-white/[0.06]
                      "
                    >
                      <p className="text-3xl" aria-hidden="true">
                        💬
                      </p>

                      <h3 className="mt-3 text-xl font-black text-white">
                        Tell Our Stories
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-white/80">
                        Use art to share experiences, identity, Pride and hope
                        in your own way.
                      </p>
                    </div>

                    <div
                      className="
                        rounded-xl
                        border
                        border-white/15
                        bg-white/10
                        p-5
                        shadow-lg
                        backdrop-blur-md
                        sm:rounded-2xl
                        dark:border-white/10
                        dark:bg-white/[0.06]
                      "
                    >
                      <p className="text-3xl" aria-hidden="true">
                        🌈
                      </p>

                      <h3 className="mt-3 text-xl font-black text-white">
                        Build Community
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-white/80">
                        Connect people through creativity, inclusion and shared
                        community pride.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          {/* =====================================================
              ABOUT AND VALUES
              ===================================================== */}
          <motion.section
            variants={fadeUp}
            transition={sectionTransition}
            aria-labelledby="about-heading"
          >
            <div className={`${glassCardClass} p-5 sm:p-8 lg:p-10`}>
              <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-12">
                <div>
                  <p
                    className="
                      mb-3
                      inline-flex
                      rounded-full
                      bg-white/20
                      px-4
                      py-2
                      text-xs
                      font-black
                      uppercase
                      tracking-wide
                      text-white
                      sm:px-5
                      sm:text-sm
                    "
                  >
                    About Burton Pride
                  </p>

                  <h2
                    id="about-heading"
                    className="
                      text-balance
                      text-3xl
                      font-black
                      leading-tight
                      sm:text-5xl
                    "
                  >
                    Built by the community, for the community.
                  </h2>

                  <p
                    className="
                      mt-5
                      text-base
                      leading-7
                      text-white/90
                      sm:text-lg
                      sm:leading-8
                    "
                  >
                    Burton Pride exists to celebrate, support and uplift
                    LGBTQIA+ people across Burton upon Trent and surrounding
                    areas. We believe Pride should be welcoming, visible,
                    inclusive and accessible.
                  </p>

                  <div
                    className="
                      mt-7
                      grid
                      gap-3
                      sm:flex
                      sm:flex-wrap
                      sm:gap-4
                    "
                  >
                    <Link
                      href="/about"
                      className={`
                        ${secondaryButtonClass}
                        bg-white
                        text-purple-700
                        hover:bg-purple-100
                        dark:bg-zinc-100
                        dark:text-purple-800
                        dark:hover:bg-white
                      `}
                    >
                      Learn More
                    </Link>

                    <Link
                      href="/about/OurCoreValues"
                      className={`
                        ${secondaryButtonClass}
                        bg-purple-700
                        text-white
                        hover:bg-purple-600
                      `}
                    >
                      Our Core Values
                    </Link>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div
                    className="
                      rounded-xl
                      border
                      border-white/10
                      bg-white/10
                      p-5
                      sm:rounded-2xl
                      dark:bg-white/[0.06]
                    "
                  >
                    <h3 className="text-xl font-black">
                      <span aria-hidden="true">🌈</span> Inclusion
                    </h3>

                    <p className="mt-2 leading-7 text-white/90">
                      Everyone deserves to feel welcome, safe and respected.
                    </p>
                  </div>

                  <div
                    className="
                      rounded-xl
                      border
                      border-white/10
                      bg-white/10
                      p-5
                      sm:rounded-2xl
                      dark:bg-white/[0.06]
                    "
                  >
                    <h3 className="text-xl font-black">
                      <span aria-hidden="true">💬</span> Community
                    </h3>

                    <p className="mt-2 leading-7 text-white/90">
                      We work with local people, groups and organisations.
                    </p>
                  </div>

                  <div
                    className="
                      rounded-xl
                      border
                      border-white/10
                      bg-white/10
                      p-5
                      sm:rounded-2xl
                      dark:bg-white/[0.06]
                    "
                  >
                    <h3 className="text-xl font-black">
                      <span aria-hidden="true">❤️</span> Equality
                    </h3>

                    <p className="mt-2 leading-7 text-white/90">
                      We stand for LGBTQIA+ rights, safety and visibility.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          {/* =====================================================
              VOLUNTEER AND COLLABORATE
              ===================================================== */}
          <div className="grid gap-6 lg:grid-cols-2">
            <motion.section
              variants={fadeUp}
              transition={sectionTransition}
              aria-labelledby="volunteer-heading"
            >
              <div
                className="
                  flex
                  h-full
                  flex-col
                  justify-center
                  rounded-2xl
                  border
                  border-white/20
                  bg-gradient-to-br
                  from-emerald-500
                  to-green-600
                  p-6
                  text-center
                  shadow-2xl
                  sm:rounded-3xl
                  sm:p-9
                  dark:border-white/10
                  dark:bg-[#333333]
                  dark:bg-none
                  dark:shadow-black/40
                "
              >
                <h2
                  id="volunteer-heading"
                  className="text-balance text-3xl font-black sm:text-4xl"
                >
                  <span aria-hidden="true">💚</span> Volunteer With Burton Pride
                </h2>

                <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/95 sm:text-lg">
                  Volunteers help make Burton Pride possible. Help before the
                  event, on the day or with future planning.
                </p>

                <div className="mt-6">
                  <Link
                    href="/JoinUS/Volunteer"
                    className={`
                      ${primaryButtonClass}
                      bg-yellow-400
                      text-black
                      hover:bg-yellow-300
                    `}
                  >
                    Become a Volunteer
                  </Link>
                </div>
              </div>
            </motion.section>

            <motion.section
              variants={fadeUp}
              transition={sectionTransition}
              aria-labelledby="collaborate-heading"
            >
              <div
                className={`
                  ${glassCardClass}
                  flex
                  h-full
                  flex-col
                  justify-center
                  p-6
                  text-center
                  sm:p-9
                `}
              >
                <h2
                  id="collaborate-heading"
                  className="text-balance text-3xl font-black sm:text-4xl"
                >
                  Collaborate With Us
                </h2>

                <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/90 sm:text-lg">
                  We welcome local businesses, organisations and individuals
                  who want to support inclusion, equality and community Pride.
                </p>

                <div className="mt-6">
                  <Link
                    href="/Collaborate"
                    className={`
                      ${primaryButtonClass}
                      bg-green-500
                      text-white
                      hover:bg-green-400
                    `}
                  >
                    Collaborate
                  </Link>
                </div>
              </div>
            </motion.section>
          </div>

          {/* =====================================================
              FEEDBACK
              ===================================================== */}
          <motion.section
            variants={fadeUp}
            transition={sectionTransition}
            aria-labelledby="feedback-heading"
          >
            <div
              className="
                rounded-2xl
                border
                border-white/10
                bg-gradient-to-r
                from-pink-600
                via-purple-600
                to-blue-600
                p-6
                text-center
                shadow-2xl
                shadow-pink-500/20
                sm:rounded-3xl
                sm:p-10
                lg:text-left
                dark:bg-[#333333]
                dark:bg-none
                dark:shadow-black/40
              "
            >
              <div
                className="
                  grid
                  items-center
                  gap-6
                  lg:grid-cols-[1fr_auto]
                  lg:gap-10
                "
              >
                <div>
                  <h2
                    id="feedback-heading"
                    className="
                      text-balance
                      text-3xl
                      font-black
                      leading-tight
                      drop-shadow-lg
                      sm:text-5xl
                    "
                  >
                    Give Your Feedback <span aria-hidden="true">💖</span>
                  </h2>

                  <p
                    className="
                      mx-auto
                      mt-4
                      max-w-3xl
                      text-base
                      leading-7
                      text-white/90
                      sm:text-lg
                      lg:mx-0
                    "
                  >
                    Your feedback helps us improve future Burton Pride events.
                    Every idea, comment or suggestion helps us make Pride better
                    for the whole community.
                  </p>
                </div>

                <Link
                  href="/FeedBack"
                  className={`
                    ${primaryButtonClass}
                    bg-yellow-400
                    text-black
                    hover:bg-yellow-300
                  `}
                >
                  Give Feedback
                </Link>
              </div>
            </div>
          </motion.section>

          {/* =====================================================
              SOCIAL LINKS
              ===================================================== */}
          <motion.section
            variants={fadeUp}
            transition={sectionTransition}
            aria-labelledby="social-heading"
          >
            <div className={`${glassCardClass} p-6 text-center sm:p-9`}>
              <h2
                id="social-heading"
                className="text-balance text-3xl font-black sm:text-4xl"
              >
                Follow Burton Pride
              </h2>

              <p
                className="
                  mx-auto
                  mt-3
                  max-w-2xl
                  text-base
                  leading-7
                  text-white/90
                  sm:text-lg
                "
              >
                Keep up to date with announcements, community updates and future
                Pride events.
              </p>

              <div
                className="
                  mx-auto
                  mt-6
                  grid
                  max-w-xl
                  gap-3
                  sm:grid-cols-2
                  sm:gap-4
                "
              >
                <a
                  href="https://www.facebook.com/profile.php?id=61556621159422"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`
                    ${primaryButtonClass}
                    bg-blue-600
                    text-white
                    hover:bg-blue-500
                  `}
                  aria-label="Visit Burton Pride on Facebook in a new tab"
                >
                  Facebook
                  <span className="sr-only">, opens in a new tab</span>
                </a>

                <a
                  href="https://www.instagram.com/prideburton/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`
                    ${primaryButtonClass}
                    bg-gradient-to-r
                    from-pink-500
                    via-red-500
                    to-yellow-500
                    text-white
                    hover:opacity-90
                  `}
                  aria-label="Visit Burton Pride on Instagram in a new tab"
                >
                  Instagram
                  <span className="sr-only">, opens in a new tab</span>
                </a>
              </div>
            </div>
          </motion.section>

          <div className="h-4 sm:h-8" aria-hidden="true" />
        </div>
      </div>
    </motion.main>
  );
}