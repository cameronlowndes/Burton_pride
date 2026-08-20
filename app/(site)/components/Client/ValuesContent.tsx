"use client";

import type { ReactNode } from "react";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

type ValueItem = {
  title: string;
  description: ReactNode;
  accent: "pink" | "purple" | "blue" | "yellow" | "green";
};

const values: ValueItem[] = [
  {
    title: "Inclusion for All",
    description:
      "We believe that everyone, no matter their background, identity or ability, deserves to feel welcomed and included. Our spaces are built on acceptance and mutual respect.",
    accent: "pink",
  },
  {
    title: "Celebrating Diversity",
    description:
      "We embrace and celebrate people of all identities, including the LGBTQ+ community, different races, genders, religions and cultures. Diversity makes us stronger and more united.",
    accent: "purple",
  },
  {
    title: "Supporting Neurodiversity",
    description:
      "We proudly support and uplift neurodivergent people, including those with autism, ADHD, dyslexia and other conditions. We aim to create spaces that understand and support different ways of thinking and communicating.",
    accent: "blue",
  },
  {
    title: "Respect and Compassion",
    description:
      "We treat everyone with kindness and dignity. Even when there are disagreements, we listen respectfully and aim to understand each other.",
    accent: "yellow",
  },
  {
    title: "Uplifting Local Voices",
    description:
      "Our work is led by the people of Burton. We want local voices to be heard and involved in shaping our events, campaigns and day-to-day decisions.",
    accent: "green",
  },
  {
    title: "Integrity and Transparency",
    description:
      "We believe in honesty and openness. We keep our promises, communicate clearly and remain accountable to our community.",
    accent: "pink",
  },
  {
    title: "Unity and Collaboration",
    description:
      "We work together with other groups, organisations and individuals. We believe that partnership and teamwork can create real, long-term change.",
    accent: "purple",
  },
  {
    title: "Online Responsibility",
    description:
      "We expect everyone involved with Burton Pride to act respectfully online. We avoid arguments and negativity while protecting our community and its reputation.",
    accent: "blue",
  },
  {
    title: "Safe and Empowering Spaces",
    description:
      "Our events, meetings and community spaces should be safe for everyone. We do not tolerate bullying, harassment, hate speech or discrimination of any kind.",
    accent: "yellow",
  },
  {
    title: "Ongoing Learning and Growth",
    description: (
      <>
        <p>
          We are always learning and improving. We welcome feedback and are
          committed to growing as individuals and as a community organisation.
        </p>

        <div className="mt-6">
          <Link
            href="/ContactUS"
            className="
              inline-flex
              min-h-11
              items-center
              justify-center
              rounded-full
              bg-purple-600
              px-5
              py-2.5
              font-bold
              text-white
              shadow-md
              transition
              hover:bg-purple-500
              focus:outline-none
              focus-visible:ring-2
              focus-visible:ring-purple-500
              focus-visible:ring-offset-2

              dark:bg-purple-500
              dark:hover:bg-purple-400
              dark:focus-visible:ring-purple-300
              dark:focus-visible:ring-offset-[#111827]
            "
          >
            Give Feedback
          </Link>
        </div>
      </>
    ),
    accent: "green",
  },
];

const gridVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07,
    },
  },
};

const cardVariants = {
  hidden: {
    opacity: 0,
    y: 24,
  },
  visible: {
    opacity: 1,
    y: 0,
  },
};

function accentClasses(accent: ValueItem["accent"]) {
  switch (accent) {
    case "pink":
      return {
        bar: "bg-pink-500",
        title: "text-pink-700 dark:text-pink-300",
      };

    case "purple":
      return {
        bar: "bg-purple-500",
        title: "text-purple-700 dark:text-purple-300",
      };

    case "blue":
      return {
        bar: "bg-blue-500",
        title: "text-blue-700 dark:text-blue-300",
      };

    case "yellow":
      return {
        bar: "bg-yellow-400",
        title: "text-yellow-700 dark:text-yellow-300",
      };

    case "green":
    default:
      return {
        bar: "bg-emerald-500",
        title: "text-emerald-700 dark:text-emerald-300",
      };
  }
}

export default function ValuesContent() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <main
      className="
        w-full
        px-4
        pb-24
        pt-28
        text-slate-950

        sm:px-6
        sm:pt-32

        lg:px-8

        dark:text-white
      "
    >
      <div className="mx-auto w-full max-w-7xl">
        {/* HERO */}
        <motion.section
          initial={
            prefersReducedMotion
              ? false
              : {
                  opacity: 0,
                  y: 20,
                }
          }
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: prefersReducedMotion ? 0 : 0.55,
            ease: "easeOut",
          }}
          className="
            grid
            gap-8
            rounded-[32px]
            border
            border-white/60
            bg-white/85
            p-6
            shadow-xl
            backdrop-blur-md

            sm:p-8

            lg:grid-cols-[0.7fr_1.3fr]
            lg:items-center
            lg:p-10

            dark:border-white/10
            dark:bg-[#111827]/90
            dark:shadow-black/30
          "
        >
          <div className="flex justify-center lg:justify-start">
            <div
              className="
                relative
                h-36
                w-36
                overflow-hidden
                rounded-full
                border-4
                border-white
                shadow-2xl
                ring-8
                ring-pink-100

                sm:h-44
                sm:w-44

                dark:border-[#111827]
                dark:ring-white/10
              "
            >
              <Image
                src="/image/Logo.png"
                alt="Burton Pride logo"
                fill
                priority
                sizes="176px"
                className="object-cover"
              />
            </div>
          </div>

          <div className="text-center lg:text-left">
            <p
              className="
                text-sm
                font-black
                uppercase
                tracking-[0.18em]
                text-purple-700

                dark:text-purple-300
              "
            >
              What guides Burton Pride
            </p>

            <h1
              className="
                mt-3
                text-4xl
                font-black
                leading-tight
                text-slate-950

                sm:text-5xl
                lg:text-6xl

                dark:text-white
              "
            >
              Our Core Values
            </h1>

            <p
              className="
                mt-5
                max-w-3xl
                text-base
                leading-7
                text-slate-700

                sm:text-lg
                sm:leading-8

                dark:text-white/75
              "
            >
              At <strong>Burton Pride C.I.C</strong>, our values shape everything
              we do. We are dedicated to building a diverse, inclusive and supportive
              community where everyone feels safe, respected and empowered.
            </p>
          </div>
        </motion.section>

        {/* VALUES INTRO */}
        <motion.section
          initial={
            prefersReducedMotion
              ? false
              : {
                  opacity: 0,
                  y: 18,
                }
          }
          whileInView={{
            opacity: 1,
            y: 0,
          }}
          viewport={{ once: true }}
          transition={{
            duration: prefersReducedMotion ? 0 : 0.5,
          }}
          className="
            mt-8
            rounded-3xl
            border
            border-white/50
            bg-white/70
            px-6
            py-5
            text-center
            shadow-sm
            backdrop-blur-md

            sm:px-8

            dark:border-white/10
            dark:bg-white/[0.04]
          "
        >
          <p
            className="
              mx-auto
              max-w-4xl
              text-base
              leading-7
              text-slate-700

              sm:text-lg

              dark:text-white/70
            "
          >
            These values help shape how we work, how we make decisions and how we
            want people to feel when they are part of Burton Pride.
          </p>
        </motion.section>

        {/* CORE VALUES */}
        <motion.section
          className="
            mt-10
            grid
            w-full
            grid-cols-1
            gap-5

            sm:grid-cols-2

            xl:grid-cols-3
          "
          initial="hidden"
          animate="visible"
          variants={gridVariants}
          aria-label="Burton Pride core values"
        >
          {values.map(({ title, description, accent }) => {
            const classes = accentClasses(accent);

            return (
              <motion.article
                key={title}
                variants={cardVariants}
                transition={{
                  duration: prefersReducedMotion ? 0 : 0.42,
                }}
                className="
                  relative
                  flex
                  min-h-[250px]
                  flex-col
                  overflow-hidden
                  rounded-[26px]
                  border
                  border-white/60
                  bg-white/90
                  p-6
                  shadow-[0_16px_45px_rgba(15,23,42,0.10)]
                  backdrop-blur-md
                  transition
                  duration-300

                  hover:-translate-y-1
                  hover:shadow-[0_22px_60px_rgba(15,23,42,0.15)]

                  dark:border-white/10
                  dark:bg-[#111827]/90
                  dark:shadow-black/30
                "
              >
                <div
                  className={`
                    absolute
                    left-0
                    top-0
                    h-full
                    w-1.5
                    ${classes.bar}
                  `}
                />

                <h2
                  className={`
                    text-2xl
                    font-black
                    leading-tight

                    sm:text-[1.7rem]

                    ${classes.title}
                  `}
                >
                  {title}
                </h2>

                <div
                  className="
                    mt-4
                    flex-grow
                    text-base
                    leading-7
                    text-slate-700

                    sm:text-[1.05rem]

                    dark:text-white/75
                  "
                >
                  {description}
                </div>
              </motion.article>
            );
          })}
        </motion.section>

        {/* CLOSING MESSAGE */}
        <motion.section
          initial={
            prefersReducedMotion
              ? false
              : {
                  opacity: 0,
                  y: 24,
                }
          }
          whileInView={{
            opacity: 1,
            y: 0,
          }}
          viewport={{ once: true }}
          transition={{
            duration: prefersReducedMotion ? 0 : 0.55,
          }}
          className="
            relative
            mt-14
            overflow-hidden
            rounded-[30px]
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
              -left-20
              -top-20
              h-56
              w-56
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
              -right-20
              h-64
              w-64
              rounded-full
              bg-blue-300/20
              blur-3xl
            "
          />

          <div className="relative">
            <p
              className="
                mx-auto
                max-w-4xl
                text-lg
                font-semibold
                leading-8
                text-white

                sm:text-xl
              "
            >
              By joining <strong>Burton Pride</strong>, you become part of a
              movement committed to <strong>respect</strong>,{" "}
              <strong>equality</strong> and <strong>belonging</strong>. Together, we
              can build a brighter and more inclusive Burton for everyone.
            </p>
          </div>
        </motion.section>
      </div>
    </main>
  );
}