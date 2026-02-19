'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

const values = [
  {
    title: 'Inclusion for All',
    description:
      'We believe that everyone, no matter their background, identity, or ability, deserves to feel welcomed and included. Our spaces are built on acceptance and mutual respect.',
  },
  {
    title: 'Celebrating Diversity',
    description:
      'We embrace and celebrate people of all identities – including the LGBTQ+ community, different races, genders, religions, and cultures. Diversity makes us stronger and more united.',
  },
  {
    title: 'Supporting Neurodiversity',
    description:
      'We proudly support and uplift neurodivergent individuals, including those with autism, ADHD, dyslexia, and other conditions. We aim to create spaces that understand and support different ways of thinking and communicating.',
  },
  {
    title: 'Respect and Compassion',
    description:
      'We treat everyone with kindness and dignity. Even when there are disagreements, we listen respectfully and aim to understand each other.',
  },
  {
    title: 'Uplifting Local Voices',
    description:
      'Our work is led by the people of Burton. We want local voices to be heard and involved in shaping what we do – whether it’s events, campaigns, or day-to-day decisions.',
  },
  {
    title: 'Integrity and Transparency',
    description:
      'We believe in honesty and being open about what we do. We keep our promises, communicate clearly, and stay accountable to our community.',
  },
  {
    title: 'Unity and Collaboration',
    description:
      'We work together – not against – other groups, organisations, and individuals. We believe in partnership and teamwork to achieve real, long-term change.',
  },
  {
    title: 'Online Responsibility',
    description:
      'We expect everyone involved with Burton Pride to act respectfully online. We do not engage in arguments or negativity, and we protect our community’s image with pride.',
  },
  {
    title: 'Safe and Empowering Spaces',
    description:
      'All our events, meetings, and spaces are safe for everyone. We do not tolerate bullying, harassment, hate speech, or discrimination of any kind.',
  },
  {
    title: 'Ongoing Learning and Growth',
    description: (
      <>
        We are always learning and improving. We welcome feedback and are committed to growing as individuals and as a community organisation.
        <div className="mt-4">
          <Link
            href="/ContactUS"
            className="inline-block bg-gradient-to-r from-purple-600 to-pink-500 hover:from-pink-500 hover:to-purple-600 text-white font-bold py-2 px-5 rounded-full shadow-lg transition-all duration-300"
          >
            Give Feedback
          </Link>
        </div>
      </>
    ),
  },
];

export default function ValuesGrid() {
  return (
    <motion.section
      className="mt-12 max-w-7xl w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 px-4 sm:px-0"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.1 } },
      }}
    >
      {values.map(({ title, description }, i) => (
        <motion.div
          key={i}
          className="bg-gradient-to-tr from-purple-600 via-pink-500 to-orange-400 text-white rounded-2xl p-6 shadow-[0_10px_20px_rgba(0,0,0,0.3)] hover:shadow-[0_15px_30px_rgba(0,0,0,0.5)] transform hover:scale-105 transition-all duration-300 flex flex-col"
          variants={{
            hidden: { opacity: 0, y: 40 },
            visible: { opacity: 1, y: 0 },
          }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl sm:text-3xl font-bold mb-4 drop-shadow-md">{title}</h2>
          <div className="text-white text-base sm:text-lg flex-grow leading-relaxed">{description}</div>
        </motion.div>
      ))}
    </motion.section>
  );
}
