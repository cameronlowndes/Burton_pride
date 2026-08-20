"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

const fadeUp = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
  },
};

export default function AboutClient() {
  const prefersReducedMotion = useReducedMotion();

  const transition = prefersReducedMotion
    ? { duration: 0 }
    : {
        duration: 0.55,
        ease: "easeOut" as const,
      };

  return (
    <motion.main
      className="
        min-h-screen
        px-4
        pb-20
        pt-28

        text-slate-950
        dark:text-white

        sm:px-6
        sm:pt-32

        lg:px-8
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
      <div className="mx-auto w-full max-w-5xl">
        {/* =====================================================
            INTRO
            ===================================================== */}
        <motion.section
          variants={fadeUp}
          transition={transition}
          className="
            flex
            flex-col
            items-center
            text-center
          "
        >
          <div
            className="
              h-28
              w-28
              overflow-hidden
              rounded-full
              border-4
              border-white
              shadow-2xl
              shadow-pink-500/30

              sm:h-36
              sm:w-36
            "
          >
            <Image
              src="/image/Logo.png"
              alt="Burton Pride logo"
              width={144}
              height={144}
              priority
              className="h-full w-full object-cover"
            />
          </div>

          <p
            className="
              mt-6
              text-sm
              font-black
              uppercase
              tracking-[0.18em]

              text-yellow-700
              dark:text-yellow-300
            "
          >
            Grassroots • Community Led
          </p>

          <h1
            className="
              mt-3
              text-balance
              text-4xl
              font-black
              leading-tight

              text-slate-950
              dark:text-white

              sm:text-5xl

              lg:text-6xl
            "
          >
            About Burton Pride
          </h1>

          <p
            className="
              mx-auto
              mt-5
              max-w-3xl
              text-base
              leading-7

              text-slate-800
              dark:text-white/85

              sm:text-lg
              sm:leading-8
            "
          >
            Burton Pride is a grassroots Pride organisation built by the
            community, for the community. We are here to celebrate LGBTQIA+
            people, support our local community and help create spaces where
            everyone feels welcome.
          </p>
        </motion.section>

        {/* =====================================================
            WHO WE ARE
            ===================================================== */}
        <motion.section
          variants={fadeUp}
          transition={transition}
          className="
            mt-12
            rounded-3xl
            border
            p-6
            shadow-xl
            backdrop-blur-md

            border-white/40
            bg-white/75
            text-slate-950

            sm:p-8

            dark:border-white/10
            dark:bg-[#111827]/85
            dark:text-white
          "
        >
          <h2
            className="
              text-3xl
              font-black

              text-slate-950
              dark:text-white

              sm:text-4xl
            "
          >
            Who we are
          </h2>

          <div
            className="
              mt-6
              space-y-5
              text-base
              leading-7

              text-slate-800
              dark:text-white/85

              sm:text-lg
              sm:leading-8
            "
          >
            <p>
              Burton Pride is proud to be a fully{" "}
              <strong className="text-slate-950 dark:text-white">
                grassroots-led organisation
              </strong>
              , built by the community for the community. We stand alongside
              and support the{" "}
              <strong className="text-slate-950 dark:text-white">
                LGBTQIA+
              </strong>{" "}
              community in Burton and beyond, creating inclusive spaces where
              people can feel safe, valued and respected.
            </p>

            <p>
              Pride is about celebration, but for us it is also about standing
              together. The world can feel uncertain at times, especially when
              conversations around LGBTQIA+ rights and protections are changing.
              We believe it is important that people in our community know they
              are not alone.
            </p>

            <p>
              There are ongoing discussions around rights and protections,
              including the{" "}
              <strong className="text-slate-950 dark:text-white">
                Equality Act 2010
              </strong>
              . Burton Pride believes equality, dignity and respect should never
              be taken for granted.
            </p>

            <p>
              We will continue to speak up when equality is at risk and support
              our community wherever we can. Burton Pride exists to celebrate
              people, bring people together and help make Burton a more
              welcoming place for everyone.
            </p>
          </div>
        </motion.section>

        {/* =====================================================
            OUR MISSION
            ===================================================== */}
        <motion.section
          variants={fadeUp}
          transition={transition}
          className="
            mt-8
            border-l-4
            px-5
            py-4

            border-yellow-500

            sm:px-7

            dark:border-yellow-300
          "
        >
          <h2
            className="
              text-3xl
              font-black

              text-slate-950
              dark:text-white

              sm:text-4xl
            "
          >
            Our Mission
          </h2>

          <div
            className="
              mt-5
              space-y-5
              text-base
              leading-7

              text-slate-800
              dark:text-white/85

              sm:text-lg
              sm:leading-8
            "
          >
            <p>
              Our mission is simple: to stand alongside the LGBTQIA+ community,
              support people when they need it and help create safe, inclusive
              spaces across Burton upon Trent.
            </p>

            <p>
              We are proud to be rooted in our local community. What makes us
              Pride is not just one event or one day of the year. It is the
              people who show up, support each other and keep pushing for a
              fairer and more inclusive community.
            </p>

            <p>
              Burton Pride stands for equality, dignity and unity. We want every
              LGBTQIA+ person to feel seen, respected and welcome.
            </p>
          </div>
        </motion.section>

        {/* =====================================================
            WHAT WE STAND FOR
            ===================================================== */}
        <motion.section
          variants={fadeUp}
          transition={transition}
          className="mt-12"
        >
          <h2
            className="
              text-center
              text-3xl
              font-black

              text-slate-950
              dark:text-white

              sm:text-4xl
            "
          >
            What we stand for
          </h2>

          <div
            className="
              mt-7
              grid
              gap-6

              md:grid-cols-3
            "
          >
            <div
              className="
                rounded-2xl
                bg-white/55
                p-5
                backdrop-blur-sm

                dark:bg-white/[0.04]
              "
            >
              <h3
                className="
                  text-xl
                  font-black

                  text-pink-700
                  dark:text-pink-300
                "
              >
                Equality
              </h3>

              <p
                className="
                  mt-2
                  leading-7

                  text-slate-800
                  dark:text-white/75
                "
              >
                Everyone should be treated fairly and have the same rights,
                protections and opportunities.
              </p>
            </div>

            <div
              className="
                rounded-2xl
                bg-white/55
                p-5
                backdrop-blur-sm

                dark:bg-white/[0.04]
              "
            >
              <h3
                className="
                  text-xl
                  font-black

                  text-purple-700
                  dark:text-purple-300
                "
              >
                Community
              </h3>

              <p
                className="
                  mt-2
                  leading-7

                  text-slate-800
                  dark:text-white/75
                "
              >
                Burton Pride belongs to the people who support it, attend it,
                volunteer and help build it.
              </p>
            </div>

            <div
              className="
                rounded-2xl
                bg-white/55
                p-5
                backdrop-blur-sm

                dark:bg-white/[0.04]
              "
            >
              <h3
                className="
                  text-xl
                  font-black

                  text-blue-700
                  dark:text-blue-300
                "
              >
                Inclusion
              </h3>

              <p
                className="
                  mt-2
                  leading-7

                  text-slate-800
                  dark:text-white/75
                "
              >
                We want people to feel welcome, respected and able to be
                themselves without fear of judgement.
              </p>
            </div>
          </div>
        </motion.section>

        {/* =====================================================
            GET INVOLVED
            ===================================================== */}
        <motion.section
          variants={fadeUp}
          transition={transition}
          className="
            relative
            mt-14
            overflow-hidden
            rounded-3xl
            bg-gradient-to-r
            from-pink-500
            via-purple-600
            to-blue-600
            px-6
            py-10
            text-center
            text-white
            shadow-2xl

            sm:px-10
            sm:py-12
          "
        >
          <div
            aria-hidden="true"
            className="
              pointer-events-none
              absolute
              -left-16
              -top-16
              h-48
              w-48
              rounded-full
              bg-white/15
              blur-3xl
            "
          />

          <div
            aria-hidden="true"
            className="
              pointer-events-none
              absolute
              -bottom-20
              -right-16
              h-56
              w-56
              rounded-full
              bg-blue-300/20
              blur-3xl
            "
          />

          <div className="relative">
            <h2
              className="
                text-3xl
                font-black
                text-white

                sm:text-4xl
              "
            >
              Get Involved
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
              "
            >
              Burton Pride is powered by the community. Whether you follow us
              online, come along to an event, volunteer, donate or simply tell
              someone about us, it all helps.
            </p>

            <p
              className="
                mx-auto
                mt-4
                max-w-3xl
                text-base
                leading-7
                text-white/90

                sm:text-lg
              "
            >
              Every bit of support helps us keep building something positive
              for LGBTQIA+ people in Burton.
            </p>

            <div
              className="
                mt-7
                flex
                flex-col
                justify-center
                gap-3

                sm:flex-row
                sm:flex-wrap
              "
            >
              <Link
                href="/ContactUS"
                className="
                  inline-flex
                  min-h-12
                  items-center
                  justify-center
                  rounded-full
                  bg-yellow-300
                  px-7
                  py-3
                  text-sm
                  font-black
                  text-purple-950
                  shadow-xl
                  transition

                  hover:scale-105
                  hover:bg-white
                "
              >
                🌈 Contact Us
              </Link>

              <Link
                href="/JoinUS/Volunteer"
                className="
                  inline-flex
                  min-h-12
                  items-center
                  justify-center
                  rounded-full
                  border
                  border-white/30
                  bg-white/15
                  px-7
                  py-3
                  text-sm
                  font-black
                  text-white
                  backdrop-blur-md
                  transition

                  hover:bg-white
                  hover:text-purple-700
                "
              >
                Volunteer
              </Link>

              <Link
                href="/DonateToUs"
                className="
                  inline-flex
                  min-h-12
                  items-center
                  justify-center
                  rounded-full
                  border
                  border-white/30
                  bg-white/15
                  px-7
                  py-3
                  text-sm
                  font-black
                  text-white
                  backdrop-blur-md
                  transition

                  hover:bg-white
                  hover:text-pink-600
                "
              >
                Donate
              </Link>
            </div>
          </div>
        </motion.section>
      </div>
    </motion.main>
  );
}