"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  ArrowRight,
  HandHeart,
  HeartHandshake,
  Mail,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

type JoinSection = {
  title: string;
  text: string;
  link: string;
  button: string;
  external?: boolean;
  accent: "pink" | "yellow" | "blue" | "purple";
  icon: React.ReactNode;
};

const sections: JoinSection[] = [
  {
    title: "Become a Volunteer",
    text: "Help us make Burton Pride an inclusive event! We’re always looking for passionate individuals to join our volunteer team and contribute to the success of the festival.",
    link: "/JoinUS/Volunteer",
    button: "Volunteer with Us",
    accent: "pink",
    icon: <Users className="h-6 w-6" />,
  },
  {
    title: "Support with a Donation",
    text: "Your donations go directly towards organising our events, community initiatives, and making Burton Pride an unforgettable experience.",
    link: "/DonateToUs",
    button: "Donate to Burton Pride",
    accent: "yellow",
    icon: <HandHeart className="h-6 w-6" />,
  },
  {
    title: "Collaborate with Us",
    text: "We’re always looking for like-minded businesses, organisations, and individuals who want to support our mission of inclusivity and equality.",
    link: "/Collaborate",
    button: "About Collaborating",
    accent: "blue",
    icon: <HeartHandshake className="h-6 w-6" />,
  },
  {
    title: "Get in Touch",
    text: "Have questions or want to discuss how you can get involved? We’d love to hear from you!",
    link: "/ContactUS",
    button: "Contact Us",
    accent: "purple",
    icon: <Mail className="h-6 w-6" />,
  },
];

const fadeUp: Variants = {
  hidden: {
    opacity: 0,
    y: 24,
  },
  visible: {
    opacity: 1,
    y: 0,
  },
};

function accentClasses(accent: JoinSection["accent"]) {
  switch (accent) {
    case "pink":
      return {
        icon: `
          bg-pink-100 text-pink-700
          dark:bg-pink-500/15 dark:text-pink-300
        `,
        line: "bg-pink-500",
        button: `
          bg-pink-600 text-white hover:bg-pink-500
          dark:bg-pink-500 dark:hover:bg-pink-400
        `,
      };

    case "yellow":
      return {
        icon: `
          bg-yellow-100 text-yellow-800
          dark:bg-yellow-400/15 dark:text-yellow-300
        `,
        line: "bg-yellow-400",
        button: `
          bg-yellow-300 text-purple-950 hover:bg-yellow-200
          dark:bg-yellow-300 dark:text-purple-950 dark:hover:bg-white
        `,
      };

    case "blue":
      return {
        icon: `
          bg-blue-100 text-blue-700
          dark:bg-blue-500/15 dark:text-blue-300
        `,
        line: "bg-blue-500",
        button: `
          bg-blue-600 text-white hover:bg-blue-500
          dark:bg-blue-500 dark:hover:bg-blue-400
        `,
      };

    case "purple":
    default:
      return {
        icon: `
          bg-purple-100 text-purple-700
          dark:bg-purple-500/15 dark:text-purple-300
        `,
        line: "bg-purple-500",
        button: `
          bg-purple-600 text-white hover:bg-purple-500
          dark:bg-purple-500 dark:hover:bg-purple-400
        `,
      };
  }
}

export default function JoinUsContent() {
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
        pb-24
        pt-28
        text-slate-950

        sm:px-6
        sm:pt-32

        lg:px-8

        dark:text-white
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
      <div className="mx-auto w-full max-w-6xl">
        {/* HERO */}
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
            Be part of Burton Pride
          </p>

          <h1
            className="
              mt-3
              text-balance
              text-4xl
              font-black
              leading-tight
              text-slate-950

              sm:text-5xl
              lg:text-6xl

              dark:text-white
            "
          >
            Join the Movement
          </h1>

          <p
            className="
              mx-auto
              mt-5
              max-w-3xl
              text-base
              leading-7
              text-slate-800

              sm:text-lg
              sm:leading-8

              dark:text-white/85
            "
          >
            Burton Pride grows because people choose to get involved. Whether
            that means giving your time, supporting us financially, working with
            us or simply getting in touch, every bit of support makes a
            difference.
          </p>
        </motion.section>
  

        {/* WAYS TO GET INVOLVED */}
        <motion.section
          variants={fadeUp}
          transition={transition}
          className="mt-12"
        >
          <div className="mb-7">
            <h2
              className="
                text-3xl
                font-black
                text-slate-950

                sm:text-4xl

                dark:text-white
              "
            >
              Ways to get involved
            </h2>

            <p
              className="
                mt-2
                max-w-2xl
                text-base
                leading-7
                text-slate-700

                dark:text-white/70
              "
            >
              Pick the option that feels right for you.
            </p>
          </div>

          <div
            className="
              grid
              gap-5

              md:grid-cols-2
            "
          >
            {sections.map((section) => {
              const accent = accentClasses(section.accent);

              return (
                <article
                  key={section.title}
                  className="
                    relative
                    overflow-hidden
                    rounded-3xl
                    border
                    border-white/50
                    bg-white/85
                    p-6
                    text-slate-950
                    shadow-xl
                    backdrop-blur-md
                    transition
                    duration-300

                    hover:-translate-y-1
                    hover:shadow-2xl

                    sm:p-7

                    dark:border-white/10
                    dark:bg-[#111827]/90
                    dark:text-white
                    dark:shadow-black/30
                  "
                >
                  <div
                    className={`absolute left-0 top-0 h-full w-1.5 ${accent.line}`}
                  />

                  <div
                    className={`
                      flex
                      h-12
                      w-12
                      items-center
                      justify-center
                      rounded-2xl
                      ${accent.icon}
                    `}
                  >
                    {section.icon}
                  </div>

                  <h3
                    className="
                      mt-5
                      text-2xl
                      font-black
                      text-slate-950

                      dark:text-white
                    "
                  >
                    {section.title}
                  </h3>

                  <p
                    className="
                      mt-3
                      text-base
                      leading-7
                      text-slate-700

                      dark:text-white/75
                    "
                  >
                    {section.text}
                  </p>

                  <Link
                    href={section.link}
                    target={section.external ? "_blank" : undefined}
                    rel={
                      section.external ? "noopener noreferrer" : undefined
                    }
                    className={`
                      mt-6
                      inline-flex
                      min-h-12
                      items-center
                      justify-center
                      gap-2
                      rounded-full
                      px-6
                      py-3
                      text-sm
                      font-black
                      shadow-lg
                      transition

                      hover:scale-[1.02]

                      focus-visible:outline
                      focus-visible:outline-4
                      focus-visible:outline-offset-4
                      focus-visible:outline-white/70

                      ${accent.button}
                    `}
                  >
                    {section.button}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </article>
              );
            })}
          </div>
        </motion.section>

        {/* COMMUNITY MESSAGE */}
        <motion.section
          variants={fadeUp}
          transition={transition}
          className="
            mt-12
            rounded-3xl
            border
            border-white/50
            bg-white/75
            px-6
            py-7
            shadow-lg
            backdrop-blur-md

            sm:px-8

            dark:border-white/10
            dark:bg-[#111827]/80
          "
        >
          <div
            className="
              border-l-4
              border-yellow-500
              pl-5

              dark:border-yellow-300
            "
          >
            <h2
              className="
                text-2xl
                font-black
                text-slate-950

                sm:text-3xl

                dark:text-white
              "
            >
              You&apos;re welcome here
            </h2>

            <p
              className="
                mt-3
                max-w-4xl
                text-base
                leading-7
                text-slate-800

                sm:text-lg

                dark:text-white/80
              "
            >
              You don&apos;t need previous experience with Pride organisations
              to support us. If you care about equality, inclusion and helping
              the local LGBTQIA+ community, there is a place for you at Burton
              Pride.
            </p>
          </div>
        </motion.section>

        {/* FINAL CTA */}
        <motion.section
          variants={fadeUp}
          transition={transition}
          className="
            relative
            mt-12
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
            <h2
              className="
                text-3xl
                font-black
                text-white

                sm:text-4xl
              "
            >
              Not sure where to start?
            </h2>

            <p
              className="
                mx-auto
                mt-4
                max-w-2xl
                text-base
                leading-7
                text-white/95

                sm:text-lg
              "
            >
              Send us a message and tell us how you&apos;d like to get involved.
              We&apos;re always happy to have a chat.
            </p>

            <Link
              href="/ContactUS"
              className="
                mt-7
                inline-flex
                min-h-12
                items-center
                justify-center
                gap-2
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
              Contact Burton Pride
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </motion.section>
      </div>
    </motion.main>
  );
}