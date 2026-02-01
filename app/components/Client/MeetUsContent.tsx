'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { sections, Member } from '@/data/TeamData';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.6, ease: 'easeOut' },
  }),
};

// Member card with modal for desktop and mobile page routing
function MemberCard({ member, index }: { member: Member; index: number }) {
  const [flippedIndex, setFlippedIndex] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleStoryClick = () => {
    if (isMobile) {
      const query = encodeURIComponent(JSON.stringify(member.story));
      router.push(`/team/story/${member.name.replace(/\s+/g, '-').toLowerCase()}?story=${query}`);
    } else {
      setFlippedIndex(index);
    }
  };

  return (
    <div className="relative w-full group">
      {/* Desktop Card */}
      <div className="hidden sm:flex relative">
        <div className="bg-white/10 backdrop-blur-md text-white shadow-[0_8px_30px_rgba(0,0,0,0.5)] border border-white/20 rounded-2xl p-6 flex flex-col items-center hover:scale-105 transition-all duration-300">
          <Image
            src={member.image}
            alt={member.name}
            width={120}
            height={120}
            className="w-28 h-28 rounded-full mb-4 object-cover shadow-[0_0_20px_rgba(255,255,255,0.6)]"
          />
          <h2 className="text-2xl font-semibold">{member.name}</h2>
          <p className="text-sm text-gray-200 mt-2">{member.role}</p>
          {member.story && (
            <button
              onClick={handleStoryClick}
              className="mt-4 inline-block bg-gradient-to-r from-pink-600 via-pink-700 to-pink-800 text-white px-6 py-2 rounded-full font-semibold shadow-lg transition duration-300 focus:outline-none"
            >
              Read Story →
            </button>
          )}
        </div>
      </div>

      {/* Mobile Link */}
      <Link
        href={`/team/${member.name.replace(/\s+/g, '-').toLowerCase()}`}
        className="sm:hidden block"
      >
        <div className="bg-white/10 backdrop-blur-md text-white p-6 rounded-2xl flex flex-col items-center">
          <Image
            src={member.image}
            alt={member.name}
            width={120}
            height={120}
            className="w-28 h-28 rounded-full mb-4 object-cover"
          />
          <h2 className="text-2xl font-semibold">{member.name}</h2>
          <p className="text-sm text-gray-200 mt-2">{member.role}</p>
        </div>
         <button
              onClick={handleStoryClick}
              className="mt-4 inline-block bg-gradient-to-r from-pink-600 via-pink-700 to-pink-800 text-white px-6 py-2 rounded-full font-semibold shadow-lg transition duration-300 focus:outline-none"
            >
              Read Story →
            </button>
      </Link>

      {/* Desktop Modal */}
      {flippedIndex === index && member.story && !isMobile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-pink-900 via-purple-900 to-blue-900 bg-opacity-90 p-6"
          onClick={() => setFlippedIndex(null)}
        >
          <div
            className="relative max-w-3xl max-h-[80vh] overflow-y-auto rounded-3xl p-8 shadow-2xl bg-white/90 text-black border border-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-3xl font-bold text-center mb-6">{member.name}</h2>
            <p className="text-gray-800 text-lg leading-relaxed">{member.role}</p>
            <div className="text-gray-800 text-lg leading-relaxed space-y-6 mt-4">
              {member.story.split('\n').map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
            <button
              onClick={() => setFlippedIndex(null)}
              className="mt-8 block mx-auto text-pink-600 text-lg font-bold hover:underline cursor-pointer"
            >
              ← Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MeetUsContent() {
  return (
    <div className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex flex-col items-center p-8 sm:p-16 pb-24">
      
      {/* Hero */}
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
          transition={{ duration: 0.6, ease: 'easeOut' }}
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
              <MemberCard key={i} member={member} index={i} />
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
