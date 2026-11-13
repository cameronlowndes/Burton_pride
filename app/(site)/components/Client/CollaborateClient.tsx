"use client";

import Image from "next/image";
import { motion, type Variants } from "framer-motion";
import SponsorForm from "../Forms/SponsorForm";
import CommitteeSection from "../Card/CommitteeSection";

export default function Collaborate() {
  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.25,
      },
    },
  };

  const fadeUpVariant: Variants = {
    hidden: {
      opacity: 0,
      y: 40,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut" as const,
      },
    },
  };

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-r text-white flex flex-col items-center p-8 sm:p-16 pb-24"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <motion.header
        className="text-center flex flex-col items-center gap-6 mt-16 max-w-3xl"
        variants={fadeUpVariant}
      >
        <div className="rounded-full bg-white/20 p-2 shadow-xl backdrop-blur-md">
          <Image
            src="/image/Logo.png"
            alt="Burton Pride Logo"
            width={170}
            height={170}
            className="rounded-full"
          />
        </div>

        <h1 className="text-4xl font-bold drop-shadow-lg sm:text-6xl">
          Collaborate With Us
        </h1>

        <p className="text-lg leading-relaxed text-white/90 sm:text-xl">
          Want to partner with Burton Pride? We’re always open to collaborations
          and ideas that help make Pride in Burton even bigger, better, and more
          inclusive.
        </p>
      </motion.header>

      <motion.section
        className="mt-16 flex w-full max-w-7xl flex-col gap-10 md:flex-row"
        variants={fadeUpVariant}
      >
        <div className="rounded-2xl bg-white/20 p-10 shadow-xl backdrop-blur-md md:w-1/2">
          <h2 className="mb-8 text-3xl font-bold text-yellow-300 sm:text-4xl">
            Why Sponsor Burton Pride C.I.C?
          </h2>

          <div className="space-y-6 text-lg leading-relaxed text-white/95">
            <p>
              Burton Pride C.I.C is a{" "}
              <strong>fully community-led Pride organisation</strong>, created
              by local people Simon, Isaac, Cameron, Olga, Sarah and Stevie O'Neill who care
              deeply about Burton and the people who live here.
            </p>

            <p>
              We are not backed by large corporations, and that is a conscious
              choice. Burton Pride was built from the ground up by the
              community, for the community. We believe Pride belongs at a local
              level, where real people, real stories, and real support matter
              most.
            </p>

            <p>
              Our team works tirelessly behind the scenes to deliver a safe,
              inclusive, and welcoming event for everyone. From planning and
              fundraising to logistics and volunteer coordination, everything we
              do is driven by passion, not profit.
            </p>

            <p>
              There are easier ways to run events — corporate control and
              outside influence. But we choose to stay rooted in Burton because
              we never want to lose what makes Burton Pride special:
            </p>

            <p className="text-xl font-semibold text-yellow-300">
              The people. The heart. The community spirit.
            </p>

            <p>
              When you sponsor Burton Pride, you are investing directly into the
              local community and helping us keep Pride independent, inclusive,
              and full of heart — exactly how Pride should be.
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white/10 p-8 shadow-xl backdrop-blur-md md:w-1/2">
          <h3 className="mb-6 text-center text-2xl font-bold text-yellow-300">
            Apply to be a sponsor of Burton Pride
          </h3>
          <SponsorForm />
        </div>
      </motion.section>

      <div className="mt-24 w-full">
        <CommitteeSection />
      </div>
    </motion.div>
  );
}