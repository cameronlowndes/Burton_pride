'use client';

import type { ReactNode } from 'react';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';

type ValueItem = {
  title: string;
  description: ReactNode;
};

const values: ValueItem[] = [
  {
    title: 'Inclusion for All',
    description:
      'We believe that everyone, no matter their background, identity or ability, deserves to feel welcomed and included. Our spaces are built on acceptance and mutual respect.',
  },
  {
    title: 'Celebrating Diversity',
    description:
      'We embrace and celebrate people of all identities, including the LGBTQ+ community, different races, genders, religions and cultures. Diversity makes us stronger and more united.',
  },
  {
    title: 'Supporting Neurodiversity',
    description:
      'We proudly support and uplift neurodivergent people, including those with autism, ADHD, dyslexia and other conditions. We aim to create spaces that understand and support different ways of thinking and communicating.',
  },
  {
    title: 'Respect and Compassion',
    description:
      'We treat everyone with kindness and dignity. Even when there are disagreements, we listen respectfully and aim to understand each other.',
  },
  {
    title: 'Uplifting Local Voices',
    description:
      'Our work is led by the people of Burton. We want local voices to be heard and involved in shaping our events, campaigns and day-to-day decisions.',
  },
  {
    title: 'Integrity and Transparency',
    description:
      'We believe in honesty and openness. We keep our promises, communicate clearly and remain accountable to our community.',
  },
  {
    title: 'Unity and Collaboration',
    description:
      'We work together with other groups, organisations and individuals. We believe that partnership and teamwork can create real, long-term change.',
  },
  {
    title: 'Online Responsibility',
    description:
      'We expect everyone involved with Burton Pride to act respectfully online. We avoid arguments and negativity while protecting our community and its reputation.',
  },
  {
    title: 'Safe and Empowering Spaces',
    description:
      'Our events, meetings and community spaces should be safe for everyone. We do not tolerate bullying, harassment, hate speech or discrimination of any kind.',
  },
  {
    title: 'Ongoing Learning and Growth',
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
              items-center
              justify-center
              rounded-full
              border
              border-current
              px-5
              py-2.5
              font-bold
              transition-all
              duration-300
              hover:scale-105
              hover:opacity-80
              focus:outline-none
              focus-visible:ring-2
              focus-visible:ring-current
              focus-visible:ring-offset-2
              focus-visible:ring-offset-transparent
            "
          >
            Give Feedback
          </Link>
        </div>
      </>
    ),
  },
];

const gridVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const cardVariants = {
  hidden: {
    opacity: 0,
    y: 32,
  },
  visible: {
    opacity: 1,
    y: 0,
  },
};

export default function ValuesContent() {
  return (
    <div
      className="
        flex
        w-full
        max-w-7xl
        flex-col
        items-center
        text-gray-950
        dark:text-white
      "
    >
      {/* Hero */}
      <motion.section
        className="
          flex
          w-full
          flex-col
          items-center
          gap-6
          px-4
          py-12
          text-center
          sm:px-6
        "
        initial={{
          opacity: 0,
          y: 24,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          duration: 0.7,
          ease: 'easeOut',
        }}
      >
        <motion.div
          className="
            relative
            h-[150px]
            w-[150px]
            overflow-hidden
            rounded-full
            border-4
            border-current/20
            shadow-lg
            sm:h-[180px]
            sm:w-[180px]
          "
          initial={{
            scale: 0.9,
            opacity: 0,
          }}
          animate={{
            scale: 1,
            opacity: 1,
          }}
          transition={{
            duration: 0.5,
            delay: 0.15,
          }}
        >
          <Image
            src="/image/Logo.png"
            alt="Burton Pride logo"
            fill
            priority
            sizes="(max-width: 640px) 150px, 180px"
            className="object-cover"
          />
        </motion.div>

        <motion.h1
          className="
            text-4xl
            font-extrabold
            tracking-tight
            sm:text-5xl
            lg:text-6xl
          "
          initial={{
            opacity: 0,
            y: 20,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.5,
            delay: 0.3,
          }}
        >
          Our Core Values
        </motion.h1>

        <motion.p
          className="
            max-w-3xl
            text-base
            leading-relaxed
            opacity-85
            sm:text-lg
            lg:text-xl
          "
          initial={{
            opacity: 0,
            y: 20,
          }}
          animate={{
            opacity: 0.85,
            y: 0,
          }}
          transition={{
            duration: 0.5,
            delay: 0.45,
          }}
        >
          At <strong>Burton Pride C.I.C</strong>, our values shape everything we
          do. We are dedicated to building a diverse, inclusive and supportive
          community where everyone feels safe, respected and empowered.
        </motion.p>
      </motion.section>

      {/* Core values */}
      <motion.section
        className="
          grid
          w-full
          grid-cols-1
          gap-6
          px-4
          py-8
          sm:grid-cols-2
          sm:px-6
          lg:grid-cols-3
        "
        initial="hidden"
        animate="visible"
        variants={gridVariants}
        aria-label="Burton Pride core values"
      >
        {values.map(({ title, description }) => (
          <motion.article
            key={title}
            className="
              flex
              min-h-[220px]
              flex-col
              rounded-2xl
              border
              border-current/20
              p-6
              transition-all
              duration-300
              hover:-translate-y-1
              hover:border-current/40
            "
            variants={cardVariants}
            transition={{
              duration: 0.45,
            }}
          >
            <h2
              className="
                mb-4
                text-2xl
                font-bold
                leading-tight
                sm:text-3xl
              "
            >
              {title}
            </h2>

            <div
              className="
                flex-grow
                text-base
                leading-relaxed
                opacity-85
                sm:text-lg
              "
            >
              {description}
            </div>
          </motion.article>
        ))}
      </motion.section>

      {/* Closing message */}
      <motion.section
        className="
          my-12
          w-[calc(100%-2rem)]
          max-w-4xl
          rounded-2xl
          border
          border-current/20
          px-6
          py-10
          text-center
          sm:w-[calc(100%-3rem)]
          sm:px-10
          sm:py-12
        "
        initial={{
          opacity: 0,
          y: 32,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          duration: 0.7,
          ease: 'easeOut',
          delay: 0.25,
        }}
      >
        <p
          className="
            text-lg
            font-semibold
            leading-relaxed
            sm:text-xl
          "
        >
          By joining <strong>Burton Pride</strong>, you become part of a
          movement committed to <strong>respect</strong>,{' '}
          <strong>equality</strong> and <strong>belonging</strong>. Together, we
          can build a brighter and more inclusive Burton for everyone.
        </p>
      </motion.section>
    </div>
  );
}