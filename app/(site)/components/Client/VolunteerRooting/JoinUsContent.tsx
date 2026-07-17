"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, type Variants } from "framer-motion";

const sectionVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 30,
  },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.3,
      duration: 0.6,
      ease: "easeOut" as const,
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
    <div className="min-h-screen bg-gradient-to-r text-white flex flex-col items-center p-4 sm:p-16 pb-24">
      <motion.section
        className="text-center flex flex-col items-center gap-4 sm:gap-6 mt-12 mb-8"
        initial="hidden"
        animate="visible"
        variants={heroVariants}
        transition={{ duration: 0.8, ease: "easeOut" as const }}
      >
        <div className="rounded-full overflow-hidden w-36 h-36 sm:w-[180px] sm:h-[180px] shadow-[0_0_25px_rgba(255,255,255,0.7)] border-4 border-white">
          <Image
            src="/image/Logo.png"
            alt="Burton Pride Logo"
            width={180}
            height={180}
            className="object-cover w-full h-full rounded-full"
          />
        </div>

        <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.9)]">
          Join the Movement
        </h1>

        <p className="text-base sm:text-lg md:text-xl text-white max-w-xl sm:max-w-2xl bg-white/10 backdrop-blur-md p-3 sm:p-4 rounded-2xl shadow-lg border border-white/20">
          Whether you&apos;re volunteering your time, donating, or
          collaborating, Burton Pride thrives because of people like you! 🌈
        </p>
      </motion.section>

      {[
        {
          title: "Become a Volunteer",
          text: "Help us make Burton Pride an inclusive event! We’re always looking for passionate individuals to join our volunteer team and contribute to the success of the festival.",
          link: "/JoinUS/Volunteer",
          button: "🌟 Volunteer with Us",
        },
        {
          title: "Support with a Donation",
          text: "Your donations go directly towards organizing our events, community initiatives, and making Burton Pride an unforgettable experience.",
          link: "/DonateToUs",
          button: "💖 Please donate to us",
          external: true,
        },
        {
          title: "Collaborate with Us",
          text: "We’re always looking for like-minded businesses, organisations, and individuals who want to support our mission of inclusivity and equality.",
          link: "/Collaborate",
          button: "🤝 About Collaborating",
          maxW: "max-w-lg sm:max-w-4xl",
        },
        {
          title: "Get in Touch",
          text: "Have questions or want to discuss how you can get involved? We’d love to hear from you!",
          link: "/ContactUS",
          button: "📬 Contact Us",
          maxW: "max-w-md",
        },
      ].map((section, i) => (
        <motion.section
          key={i}
          className={`mt-12 sm:mt-16 text-center w-full ${section.maxW || "max-w-4xl"} bg-white/10 backdrop-blur-md p-6 sm:p-8 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.5)] border border-white/20`}
          initial="hidden"
          animate="visible"
          custom={i}
          variants={sectionVariants}
        >
          <h2 className="text-2xl sm:text-3xl md:text-3xl font-bold mb-4 sm:mb-6 text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]">
            {section.title}
          </h2>

          <p className="text-sm sm:text-lg mb-4 sm:mb-6 text-white">
            {section.text}
          </p>

          <Link
            href={section.link}
            target={section.external ? "_blank" : undefined}
            rel={section.external ? "noopener noreferrer" : undefined}
            className="bg-gradient-to-r from-yellow-300 via-pink-400 to-purple-500 text-black px-6 sm:px-8 py-3 sm:py-4 rounded-full font-bold text-base sm:text-lg shadow-lg hover:scale-105 hover:shadow-[0_0_25px_rgba(255,255,255,0.8)] transition-all whitespace-nowrap"
          >
            {section.button}
          </Link>
        </motion.section>
      ))}
    </div>
  );
}