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
            className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-full transition duration-300 ease-in-out"
          >
            Feedback
          </Link>
        </div>
      </>
    ),
  },
];

export default function ValuesGrid() {
  return (
    <motion.section
      className="mt-12 max-w-6xl w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: 0.1,
          },
        },
      }}
    >
      {values.map(({ title, description }, i) => (
        <motion.div
          key={i}
          className="bg-white rounded-xl p-6 shadow-lg hover:shadow-2xl transition-shadow duration-300 flex flex-col"
          variants={{
            hidden: { opacity: 0, y: 30 },
            visible: { opacity: 1, y: 0 },
          }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-purple-700 text-2xl font-semibold mb-3">{title}</h2>
          <div className="text-gray-800 flex-grow">{description}</div>
        </motion.div>
      ))}
    </motion.section>
  );
}
