"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import SponsorForm from "../Forms/SponsorForm";
import BoardSection from "../Card/BoardSection";

export default function Collaborate() {
  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.25 } },
  };

  const fadeUpVariant = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" },
    },
  };

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex flex-col items-center p-8 sm:p-16 pb-24"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* HERO */}
      <motion.header
        className="text-center flex flex-col items-center gap-6 mt-16 max-w-3xl"
        variants={fadeUpVariant}
      >
        <div className="p-2 rounded-full bg-white/20 backdrop-blur-md shadow-xl">
          <Image
            src="/image/logo.jpg"
            alt="Burton Pride Logo"
            width={170}
            height={170}
            className="rounded-full"
          />
        </div>

        <h1 className="text-4xl sm:text-6xl font-bold drop-shadow-lg">
          Collaborate With Us
        </h1>

        <p className="text-lg sm:text-xl text-white/90 leading-relaxed">
          Want to partner with Burton Pride? We’re always open to collaborations
          and ideas that help make Pride in Burton even bigger, better, and more inclusive.
        </p>
      </motion.header>

      {/* STORY + FORM */}
      <motion.section
        className="mt-16 w-full max-w-7xl flex flex-col md:flex-row gap-10"
        variants={fadeUpVariant}
      >
        {/* LEFT — STORY */}
        <div className="md:w-1/2 bg-white/20 backdrop-blur-md rounded-2xl shadow-xl p-10">
          <h2 className="text-3xl sm:text-4xl font-bold text-yellow-300 mb-8">
            Why Sponsor Burton Pride C.I.C?
          </h2>

          <div className="space-y-6 text-lg leading-relaxed text-white/95">
            <p>
              Burton Pride C.I.C is a <strong>fully community-led Pride organisation</strong>,
              created by local people — Simon, Isaac, Cameron, Olga and Ben —
              who care deeply about Burton and the people who live here.
            </p>

            <p>
              We are not backed by large corporations, and that is a conscious choice.
              Burton Pride was built from the ground up by the community, for the community.
              We believe Pride belongs at a local level, where real people, real stories,
              and real support matter most.
            </p>

            <p>
              Our team works tirelessly behind the scenes to deliver a safe, inclusive,
              and welcoming event for everyone. From planning and fundraising to logistics
              and volunteer coordination, everything we do is driven by passion, not profit.
            </p>

            <p>
              There are easier ways to run events — corporate control and outside influence.
              But we choose to stay rooted in Burton because we never want to lose what makes Burton Pride special:
            </p>

            <p className="font-semibold text-xl text-yellow-300">
              The people. The heart. The community spirit.
            </p>

            <p>
              When you sponsor Burton Pride, you are investing directly into the local
              community and helping us keep Pride independent, inclusive, and full of heart —
              exactly how Pride should be.
            </p>
          </div>
        </div>

        {/* RIGHT — FORM */}
        <div className="md:w-1/2 bg-white/10 backdrop-blur-md rounded-2xl shadow-xl p-8">
          <h3 className="text-2xl font-bold text-yellow-300 mb-6 text-center">
            Apply to be a sponsor of Burton Pride
          </h3>
          <SponsorForm />
        </div>
      </motion.section>

      {/* 👇 MEET THE TEAM ADDED HERE 👇 */}
      <div className="w-full mt-24">
        <BoardSection/>
      </div>
    </motion.div>
  );
}
