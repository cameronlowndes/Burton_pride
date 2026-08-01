"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, type Variants } from "framer-motion";

type JoinSection = {
  title: string;
  text: string;
  link: string;
  button: string;
  external?: boolean;
  maxW?: string;
};

const sections: JoinSection[] = [
  {
    title: "Become a Volunteer",
    text: "Help us make Burton Pride an inclusive event! We’re always looking for passionate individuals to join our volunteer team and contribute to the success of the festival.",
    link: "/JoinUS/Volunteer",
    button: "🌟 Volunteer with Us",
  },
  {
    title: "Support with a Donation",
    text: "Your donations go directly towards organising our events, community initiatives, and making Burton Pride an unforgettable experience.",
    link: "/DonateToUs",
    button: "💖 Please donate to us",
    external: true,
  },
  {
    title: "Collaborate with Us",
    text: "We’re always looking for like-minded businesses, organisations, and individuals who want to support our mission of inclusivity and equality.",
    link: "/Collaborate",
    button: "🤝 About Collaborating",
    maxW: "max-w-4xl",
  },
  {
    title: "Get in Touch",
    text: "Have questions or want to discuss how you can get involved? We’d love to hear from you!",
    link: "/ContactUS",
    button: "📬 Contact Us",
    maxW: "max-w-md",
  },
];

const sectionVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 30,
  },
  visible: (index: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: index * 0.3,
      duration: 0.6,
      ease: "easeOut",
    },
  }),
};

const heroVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 30,
  },
  visible: {
    opacity: 1,
    y: 0,
  },
};

export default function JoinUsContent() {
  return (
    <div
      className="
        flex
        min-h-screen
        w-full
        flex-col
        items-center
        px-4
        pb-24
        text-inherit
        sm:px-16
      "
    >
      <motion.section
        className="
          mb-8
          mt-12
          flex
          flex-col
          items-center
          gap-4
          text-center
          sm:gap-6
        "
        initial="hidden"
        animate="visible"
        variants={heroVariants}
        transition={{
          duration: 0.8,
          ease: "easeOut",
        }}
      >
        <div
          className="
            h-36
            w-36
            overflow-hidden
            rounded-full
            border-4
            border-current/30
            shadow-[0_0_25px_rgba(255,255,255,0.35)]
            sm:h-[180px]
            sm:w-[180px]
          "
        >
          <Image
            src="/image/Logo.png"
            alt="Burton Pride Logo"
            width={180}
            height={180}
            priority
            className="h-full w-full rounded-full object-cover"
          />
        </div>

        <h1
          className="
            text-3xl
            font-extrabold
            drop-shadow-[0_0_20px_rgba(255,255,255,0.45)]
            sm:text-5xl
            md:text-6xl
          "
        >
          Join the Movement
        </h1>

        <p
          className="
            max-w-2xl
            rounded-2xl
            border
            border-current/20
            p-4
            text-base
            leading-relaxed
            sm:text-lg
            md:text-xl
          "
        >
          Whether you&apos;re volunteering your time, donating, or
          collaborating, Burton Pride thrives because of people like you! 🌈
        </p>
      </motion.section>

      {sections.map((section, index) => (
        <motion.section
          key={section.title}
          className={`
            mt-12
            w-full
            rounded-2xl
            border
            border-current/20
            p-6
            text-center
            transition-all
            duration-300
            hover:-translate-y-1
            hover:border-current/40
            sm:mt-16
            sm:p-8
            ${section.maxW ?? "max-w-4xl"}
          `}
          initial="hidden"
          animate="visible"
          custom={index}
          variants={sectionVariants}
        >
          <h2
            className="
              mb-4
              text-2xl
              font-bold
              drop-shadow-[0_0_15px_rgba(255,255,255,0.35)]
              sm:mb-6
              sm:text-3xl
            "
          >
            {section.title}
          </h2>

          <p
            className="
              mb-6
              text-sm
              leading-relaxed
              opacity-90
              sm:text-lg
            "
          >
            {section.text}
          </p>

          <Link
            href={section.link}
            target={section.external ? "_blank" : undefined}
            rel={section.external ? "noopener noreferrer" : undefined}
            className="
              inline-flex
              items-center
              justify-center
              rounded-full
              border
              border-current/30
              px-6
              py-3
              text-base
              font-bold
              transition-all
              duration-300
              hover:scale-105
              hover:border-current
              hover:opacity-80
              focus:outline-none
              focus-visible:ring-2
              focus-visible:ring-current
              focus-visible:ring-offset-2
              focus-visible:ring-offset-transparent
              sm:px-8
              sm:py-4
              sm:text-lg
            "
          >
            {section.button}
          </Link>
        </motion.section>
      ))}
    </div>
  );
}