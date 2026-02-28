'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';

export default function AboutClient() {
  return (
    <motion.div
      className="min-h-screen bg-gradient-to-r text-white flex flex-col items-center px-6 sm:px-12 py-12"
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
        className="text-center flex flex-col items-center gap-8 mt-10 max-w-4xl"
        variants={{
          hidden: { opacity: 0, y: 40 },
          visible: { opacity: 1, y: 0 },
        }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="rounded-full overflow-hidden w-[200px] h-[200px] shadow-[0_0_35px_rgba(255,255,255,0.6)] border-4 border-white"
        >
          <Image
            src="/image/Logo.png"
            alt="Burton Pride Logo"
            width={200}
            height={200}
            className="rounded-full object-cover w-full h-full"
          />
        </motion.div>

        {/* Title */}
        <motion.h1
          className="text-4xl sm:text-6xl font-extrabold text-white drop-shadow-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          About Burton Pride
        </motion.h1>

        {/* Description */}
        <motion.p
          className="text-lg sm:text-xl leading-relaxed bg-white/10 backdrop-blur-md p-6 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.4)] border border-white/40 hover:scale-[1.02] hover:shadow-[0_8px_40px_rgba(255,255,255,0.6)] transition"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          Burton Pride is proud to be a fully{' '}
          <span className="font-semibold">grassroots-led organisation</span>,
          built by the community for the community. We stand alongside and
          support the <span className="font-semibold">LGBTQIA+</span> community
          in Burton and beyond, creating inclusive spaces where everyone feels
          safe, valued, and respected.

          <br />
          <br />

          In a time when the world feels like it is changing rapidly, and when
          conversations around rights and protections are becoming increasingly
          uncertain, we believe it is more important than ever to stand together.
          Reform UK has stated that it wants to remove or significantly change
          the <span className="font-semibold">Equality Act 2010</span>,
          legislation that provides essential protections against discrimination
          for LGBTQIA+ people and many others across the UK.

          <br />
          <br />

          As a grassroots Pride organisation, we believe it is our
          responsibility to speak up when equality is at risk. Burton Pride
          exists not only to celebrate love and diversity, but also to champion
          fairness, dignity, and equal rights for all. We are here to unite our
          community and make it clear that inclusion is not optional  it is
          fundamental.
        </motion.p>
      </motion.section>

      {/* Mission Section */}
      <motion.section
        className="mt-20 text-center w-full max-w-4xl bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-[0_8px_30px_rgba(0,0,0,0.5)] border-2 border-white/40 hover:scale-[1.02] hover:shadow-[0_8px_40px_rgba(255,255,255,0.6)] transition"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-white drop-shadow-lg">
          Our Mission
        </h2>

        <p className="text-lg sm:text-xl leading-relaxed">
          Burton Pride’s mission is to stand firmly alongside the{' '}
          <span className="font-semibold">LGBTQIA+</span> community,
          especially during challenging times. As conversations grow around
          policies and movements from Reform UK and the rise of far-right
          voices in the UK, we recognise that many people within our
          community feel uncertain and concerned about their rights and
          protections.

          <br />
          <br />

          We are proud to be a fully{' '}
          <span className="font-semibold">grassroots-led organisation</span>,
          rooted in our local community. What makes us Pride is not just
          celebration  it is solidarity. We exist to support, uplift, and
          stand with the LGBTQIA+ community, ensuring that every individual
          feels seen, valued, and protected.

          <br />
          <br />

          Burton Pride stands for{' '}
          <span className="font-semibold">equality</span>,{' '}
          <span className="font-semibold">dignity</span>, and{' '}
          <span className="font-semibold">unity</span>. We will always stand
          side by side with our community, advocating for fairness and
          creating safe, inclusive spaces where everyone belongs.
        </p>
      </motion.section>

      {/* Get Involved Section */}
      <motion.section
        className="mt-20 text-center w-full max-w-4xl bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-[0_8px_30px_rgba(0,0,0,0.5)] border-2 border-white/40 hover:scale-[1.02] hover:shadow-[0_8px_40px_rgba(255,255,255,0.6)] transition"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
      >
        <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-white drop-shadow-lg">
          Get Involved
        </h2>

        <p className="text-lg sm:text-xl mb-8 leading-relaxed">
          However you choose to get involved  whether that’s supporting us
          on social media, turning up at our events, standing with us at a
          protest, or making a donation to Burton Pride  every form of
          support truly makes a difference.

          <br />
          <br />

          As a fully grassroots{' '}
          <span className="font-semibold">LGBTQIA+</span> organisation,
          our strength comes from our community. We are incredibly proud of
          the people who stand beside us, raise their voices, give their
          time, and contribute what they can.

          <br />
          <br />

          Every share, every donation, every protest attended, and every
          act of solidarity helps us continue our work and protect what
          matters most {' '}
          <span className="font-semibold">equality</span>,{' '}
          <span className="font-semibold">dignity</span>, and{' '}
          <span className="font-semibold">inclusion</span> for all.
        </p>

        <Link
          href="/ContactUS"
          className="inline-block bg-white text-black px-8 py-4 rounded-full font-bold text-lg shadow-lg hover:scale-105 transition"
        >
          🌈 Contact Us
        </Link>
      </motion.section>
    </motion.div>
  );
}