//add olga

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
};

const sections = [
  {
    title: 'Committed Board',
    members: [
      { name: 'Simon Whale', image: '/image/PeoplePicture/simon.jpg', role: 'Founder & Organizer | He/Him' },
      { name: 'Isaac Timmins', image: '/image/PeoplePicture/isaac.jpg', role: 'Founder & Director | He/Him' },
      { name: 'Cameron Lowndes', image: '/image/PeoplePicture/cameron.jpg', role: 'Board Member | He/Him/His/They' },
      { name: 'Olga Niewiadomska', image: '/image/PeoplePicture/Olga.jpg', role: 'Board Member | She/Her' },
    ],
  },
  {
    title: 'Social Media Team',
    members: [
      { name: 'Isaac Timmins', image: '/image/PeoplePicture/isaac.jpg', role: 'Social Media Director | He/Him' },
      { name: 'Cameron Lowndes', image: '/image/PeoplePicture/cameron.jpg', role: 'Social Media Manager | He/Him/His/They' },
    ],
  },
  {
    title: 'Website Admin',
    members: [
      { name: 'Cameron Lowndes', image: '/image/PeoplePicture/cameron.jpg', role: 'Website Administrator | He/Him/His/They' },
    ],
  },
];

export default function MeetUsContent() {
  return (
    <div className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex flex-col items-center p-8 sm:p-16 pb-24">
      {/* Hero Section */}
      <motion.header
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={fadeUp}
        custom={0}
        className="text-center flex flex-col items-center gap-6 mt-16"
      >
        <div className="rounded-full overflow-hidden w-[180px] h-[180px]">
          <Image
            src="/image/logo.jpg"
            alt="Burton Pride Team"
            width={180}
            height={180}
            className="object-cover w-full h-full rounded-full"
          />
        </div>
        <h1 className="text-4xl sm:text-6xl font-bold">Meet the Burton Pride Team</h1>
        <p className="text-lg sm:text-xl max-w-2xl">
          Get to know the passionate people behind Burton Pride. We're dedicated to fostering an inclusive and vibrant community!
        </p>
      </motion.header>

      {/* Sections */}
      {sections.map((section, sIndex) => (
        <section key={sIndex} className="mt-16 text-center w-full max-w-4xl">
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="text-3xl font-semibold mb-6"
          >
            {section.title}
          </motion.h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {section.members.map((member, i) => (
              <motion.div
                key={i}
                className="bg-white text-black shadow-md rounded-lg p-6 flex flex-col items-center"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
              >
                <Image
                  src={member.image}
                  alt={member.name}
                  width={96}
                  height={96}
                  className="w-24 h-24 rounded-full mb-4 object-cover"
                />
                <h2 className="text-xl font-semibold">{member.name}</h2>
                <p className="text-gray-600">{member.role}</p>
              </motion.div>
            ))}
          </div>
        </section>
      ))}

      {/* Placeholder Sections */}
      {['Event Planning Team', 'Volunteer Team'].map((title, idx) => (
        <section key={idx} className="mt-16 text-center w-full max-w-4xl">
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="text-3xl font-semibold mb-6"
          >
            {title}
          </motion.h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"></div>
        </section>
      ))}

      {/* Contact Section */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={fadeUp}
        custom={0}
        className="mt-16 text-center w-full max-w-3xl"
      >
        <h2 className="text-3xl font-semibold mb-4">Want to Connect?</h2>
        <p className="text-lg mb-6">
          Reach out to us for collaborations, volunteering, or any inquiries. We’d love to hear from you!
        </p>
        <Link
          href="/ContactUS"
          className="bg-white text-pink-600 px-6 py-3 rounded-full font-semibold text-lg hover:bg-opacity-80 transition"
        >
          Contact Us
        </Link>
      </motion.section>
    </div>
  );
}
