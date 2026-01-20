'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.6, ease: 'easeOut' },
  }),
};

const sections = [
  {
    title: 'Committed Board',
    members: [
      { name: 'Simon Whale', image: '/image/PeoplePicturePng/simon.png', role: 'Founder & Organizer | He/Him' },
      { name: 'Isaac Timmins', image: '/image/PeoplePicturePng/isaac.png', role: 'Founder & Director | He/Him' },
      { name: 'Olga Niewiadomska', image: '/image/PeoplePicturePng/Olga.png', role: 'Director | She/Her' },
      { name: 'Cameron Lowndes', image: '/image/PeoplePicturePng/cameron.png', role: 'Board Member | He/Him/His/They' },
      { name: 'Citrine Stone', image: '/image/PeoplePicturePng/citrine.png', role: 'Board Member | they/them' },
    ],
  },
  {
    title: 'Social Media Team',
    members: [
      { name: 'Isaac Timmins', image: '/image/PeoplePicturePng/isaac.png', role: 'Social Media Director | He/Him' },
      { name: 'Cameron Lowndes', image: '/image/PeoplePicturePng/cameron.png', role: 'Social Media Manager | He/Him/His/They' },
    ],
  },
  {
    title: 'Website Admin',
    members: [
      { name: 'Cameron Lowndes', image: '/image/PeoplePicturePng/cameron.png', role: 'Website Administrator | He/Him/His/They' },
    ],
  },
  {
    title: 'Volunteer Team',
    members: [
      { name: 'Olga Niewiadomska', image: '/image/PeoplePicturePng/Olga.png', role: 'Volunteer Team Manager | She/Her' },
    ],
  },
];

export default function MeetUsContent() {
  return (
    <div className="min-h-screen bg-gradient-to-r  text-white flex flex-col items-center p-8 sm:p-16 pb-24">
      
      {/* Hero Section */}
      <motion.header
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={fadeUp}
        custom={0}
        className="text-center flex flex-col items-center gap-6 mt-16"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="rounded-full overflow-hidden w-[180px] h-[180px] shadow-[0_0_45px_rgba(255,255,255,0.7)] border-4 border-white"
        >
          <Image
            src="/image/Logo.png"
            alt="Burton Pride Team"
            width={180}
            height={180}
            className="object-cover w-full h-full rounded-full"
          />
        </motion.div>

        {/* Hero Heading now white with glow */}
        <h1 className="text-5xl sm:text-6xl font-extrabold text-white drop-shadow-[0_0_25px_rgba(255,255,255,1)]">
          Meet the Burton Pride Team
        </h1>
        <p className="text-lg sm:text-xl max-w-2xl bg-white/10 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-white/20">
          Get to know the passionate people behind <span className="font-bold text-yellow-300">Burton Pride</span>.  
          We’re dedicated to fostering an inclusive and vibrant community! 🌈
        </p>
      </motion.header>

      {/* Sections */}
      {sections.map((section, sIndex) => (
        <section key={sIndex} className="mt-20 text-center w-full max-w-5xl">
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="text-4xl font-bold mb-10 text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.8)]"
          >
            {section.title}
          </motion.h2>
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {section.members.map((member, i) => (
              <motion.div
                key={i}
                className="bg-white/10 backdrop-blur-md text-white shadow-[0_8px_30px_rgba(0,0,0,0.5)] border border-white/20 rounded-2xl p-6 flex flex-col items-center hover:scale-105 hover:shadow-[0_8px_45px_rgba(255,255,255,0.7)] transition-all"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
              >
                <Image
                  src={member.image}
                  alt={member.name}
                  width={120}
                  height={120}
                  className="w-28 h-28 rounded-full mb-4 object-cover shadow-[0_0_20px_rgba(255,255,255,0.6)]"
                />
                <h2 className="text-2xl font-semibold">{member.name}</h2>
                <p className="text-sm text-gray-200 mt-2">{member.role}</p>
              </motion.div>
            ))}
          </div>
        </section>
      ))}

      {/* Contact Section */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={fadeUp}
        custom={0}
        className="mt-24 text-center w-full max-w-3xl bg-white/10 backdrop-blur-md p-10 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.6)] border border-white/20"
      >
        <h2 className="text-4xl font-bold mb-4 text-white drop-shadow-[0_0_25px_rgba(255,255,255,1)]">
          Want to Connect?
        </h2>
        <p className="text-lg mb-8">
          Reach out to us for collaborations, volunteering, or any inquiries.  
          We’d love to hear from you and welcome you to the Pride family!
        </p>
        <Link
          href="/ContactUS"
          className="bg-gradient-to-r from-yellow-300 via-pink-400 to-purple-500 text-black px-8 py-4 rounded-full font-bold text-lg shadow-lg hover:scale-105 hover:shadow-[0_0_35px_rgba(255,255,255,0.8)] transition-all"
        >
          🌟 Contact Us
        </Link>
      </motion.section>
    </div>
  );
}
