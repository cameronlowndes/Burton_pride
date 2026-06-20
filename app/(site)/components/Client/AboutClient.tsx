"use client";


import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

export default function AboutClient() {
  return (
    <motion.div
      className="flex min-h-screen flex-col items-center bg-gradient-to-r px-6 py-12 text-white sm:px-12"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: 0.25 },
        },
      }}
    >
      {/* About Section */}
      <motion.section
        className="mt-10 flex max-w-4xl flex-col items-center gap-8 text-center"
        variants={{
          hidden: { opacity: 0, y: 40 },
          visible: { opacity: 1, y: 0 },
        }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="h-[200px] w-[200px] overflow-hidden rounded-full border-4 border-white shadow-[0_0_35px_rgba(255,255,255,0.6)]"
        >
          <Image
            src="/image/Logo.png"
            alt="Burton Pride Logo"
            width={200}
            height={200}
            className="h-full w-full rounded-full object-cover"
          />
        </motion.div>

        {/* Title */}
        <motion.h1
          className="text-4xl font-extrabold text-white drop-shadow-lg sm:text-6xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          About Burton Pride
        </motion.h1>

        {/* Description */}
        <motion.div
          className="space-y-6 rounded-2xl border border-white/40 bg-white/10 p-6 text-lg leading-relaxed shadow-[0_8px_30px_rgba(0,0,0,0.4)] backdrop-blur-md transition hover:scale-[1.02] hover:shadow-[0_8px_40px_rgba(255,255,255,0.6)] sm:text-xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <p>
            Burton Pride is proud to be a fully{" "}
            <span className="font-semibold">grassroots-led organisation</span>,
            built by the community for the community. We stand alongside and
            support the <span className="font-semibold">LGBTQIA+</span>{" "}
            community in Burton and beyond, creating inclusive spaces where
            everyone feels safe, valued, and respected.
          </p>

          <p>
            In a time when the world feels like it is changing rapidly, and when
            conversations around rights and protections are becoming increasingly
            uncertain, we believe it is more important than ever to stand
            together. There are growing discussions about potential changes to
            the <span className="font-semibold">Equality Act 2010</span>,
            legislation that provides essential protections against
            discrimination for LGBTQIA+ people and many others across the UK.
          </p>

          <p>
            As a grassroots Pride organisation, we believe it is our
            responsibility to speak up when equality is at risk. Burton Pride
            exists not only to celebrate love and diversity, but also to champion
            fairness, dignity, and equal rights for all. We are here to unite our
            community and make it clear that inclusion is not optional — it is
            fundamental.
          </p>
        </motion.div>
      </motion.section>

      {/* Mission Section */}
      <motion.section
        className="mt-20 w-full max-w-4xl rounded-2xl border-2 border-white/40 bg-white/10 p-8 text-center shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur-md transition hover:scale-[1.02] hover:shadow-[0_8px_40px_rgba(255,255,255,0.6)]"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <h2 className="mb-6 text-3xl font-bold text-white drop-shadow-lg sm:text-4xl">
          Our Mission
        </h2>

        <p className="text-lg leading-relaxed sm:text-xl">
          Burton Pride’s mission is to stand firmly alongside the{" "}
          <span className="font-semibold">LGBTQIA+</span> community, especially
          during challenging times. As conversations around rights, policies,
          and protections continue to evolve, we recognise that many people
          within our community may feel uncertain and concerned about their
          future and the safeguards that protect them.
          <br />
          <br />
          We are proud to be a fully{" "}
          <span className="font-semibold">grassroots-led organisation</span>,
          rooted in our local community. What makes us Pride is not just
          celebration — it is solidarity. We exist to support, uplift, and stand
          with the LGBTQIA+ community, ensuring that every individual feels
          seen, valued, and protected.
          <br />
          <br />
          Burton Pride stands for <span className="font-semibold">equality</span>
          , <span className="font-semibold">dignity</span>, and{" "}
          <span className="font-semibold">unity</span>. We will always stand side
          by side with our community, advocating for fairness and creating safe,
          inclusive spaces where everyone belongs.
        </p>
      </motion.section>

      {/* Get Involved Section */}
      <motion.section
        className="mt-20 w-full max-w-4xl rounded-2xl border-2 border-white/40 bg-white/10 p-8 text-center shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur-md transition hover:scale-[1.02] hover:shadow-[0_8px_40px_rgba(255,255,255,0.6)]"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
      >
        <h2 className="mb-6 text-3xl font-bold text-white drop-shadow-lg sm:text-4xl">
          Get Involved
        </h2>

        <p className="mb-8 text-lg leading-relaxed sm:text-xl">
          However you choose to get involved — whether that’s supporting us on
          social media, turning up at our events, standing with us at a protest,
          or making a donation to Burton Pride — every form of support truly
          makes a difference.
          <br />
          <br />
          As a fully grassroots{" "}
          <span className="font-semibold">LGBTQIA+</span> organisation, our
          strength comes from our community. We are incredibly proud of the
          people who stand beside us, raise their voices, give their time, and
          contribute what they can.
          <br />
          <br />
          Every share, every donation, every protest attended, and every act of
          solidarity helps us continue our work and protect what matters most —{" "}
          <span className="font-semibold">equality</span>,{" "}
          <span className="font-semibold">dignity</span>, and{" "}
          <span className="font-semibold">inclusion</span> for all.
        </p>

        <Link
          href="/ContactUS"
          className="inline-block rounded-full bg-white px-8 py-4 text-lg font-bold text-black shadow-lg transition hover:scale-105"
        >
          🌈 Contact Us
        </Link>
      </motion.section>
    </motion.div>
  );
}