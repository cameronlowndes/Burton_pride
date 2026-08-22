"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";

import EventCard from "../Card/EventCard";

export default function EventsClient() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <main
      className="
        min-h-screen
        overflow-hidden
        px-4
        pb-20
        pt-28
        text-white

        sm:px-6
        sm:pt-32

        lg:px-8

        dark:text-white
      "
    >
      <div className="mx-auto w-full max-w-7xl">
        <motion.section
          initial={
            prefersReducedMotion
              ? false
              : {
                  opacity: 0,
                  y: 24,
                }
          }
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: prefersReducedMotion ? 0 : 0.6,
          }}
          className="
            relative
            overflow-hidden
            rounded-[2rem]
            border
            border-white/20
            bg-white/10
            px-5
            py-10
            text-center
            shadow-2xl
            backdrop-blur-xl

            sm:px-8
            sm:py-14

            lg:px-12
            lg:py-16

            dark:border-white/10
            dark:bg-[#111827]/85
            dark:shadow-black/40
          "
        >

          <div
            aria-hidden="true"
            className="
              pointer-events-none
              absolute
              -left-20
              -top-20
              h-72
              w-72
              rounded-full
              bg-pink-400/30
              blur-3xl

              dark:bg-pink-500/10
            "
          />

          <div
            aria-hidden="true"
            className="
              pointer-events-none
              absolute
              -bottom-24
              -right-20
              h-80
              w-80
              rounded-full
              bg-blue-400/30
              blur-3xl

              dark:bg-blue-500/10
            "
          />

          <div className="relative">
            <motion.div
              initial={
                prefersReducedMotion
                  ? false
                  : {
                      scale: 0.9,
                      opacity: 0,
                    }
              }
              animate={{
                scale: 1,
                opacity: 1,
              }}
              transition={{
                delay: prefersReducedMotion ? 0 : 0.1,
              }}
              className="
                mx-auto
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
            </motion.div>

            <p
              className="
                mx-auto
                mt-6
                inline-flex
                rounded-full
                bg-yellow-300
                px-4
                py-2
                text-xs
                font-black
                uppercase
                tracking-[0.16em]
                text-purple-950
                shadow-lg

                sm:text-sm
              "
            >
              🌈 Burton Pride Events
            </p>

            <h1
              className="
                mt-5
                text-balance
                text-4xl
                font-black
                leading-tight

                sm:text-5xl

                lg:text-6xl
              "
            >
              What&apos;s Happening at Burton Pride?
            </h1>

            <p
              className="
                mx-auto
                mt-5
                max-w-3xl
                text-base
                leading-7
                text-white/90

                sm:text-lg
                sm:leading-8
              "
            >
              Discover upcoming Burton Pride events, community gatherings,
              fundraising days and ways to come together with our local
              LGBTQIA+ community.
            </p>
          </div>
        </motion.section>
        <motion.section
          initial={
            prefersReducedMotion
              ? false
              : {
                  opacity: 0,
                  y: 30,
                }
          }
          whileInView={{
            opacity: 1,
            y: 0,
          }}
          viewport={{
            once: true,
            amount: 0.15,
          }}
          transition={{
            duration: prefersReducedMotion ? 0 : 0.6,
          }}
          className="mt-8 sm:mt-10"
        >
          <div className="mb-6">
            <p
              className="
                text-sm
                font-black
                uppercase
                tracking-[0.18em]
                text-yellow-300
              "
            >
              Upcoming
            </p>

            <h2
              className="
                mt-2
                text-3xl
                font-black

                sm:text-4xl
              "
            >
              Burton Pride Events
            </h2>

            <p
              className="
                mt-2
                max-w-2xl
                text-base
                leading-7
                text-white/80
              "
            >
              Everything you need to know about what&apos;s coming up.
            </p>
          </div>

          <EventCard />
        </motion.section>
      </div>
    </main>
  );
}