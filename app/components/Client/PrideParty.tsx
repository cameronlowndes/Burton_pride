'use client';
//fixs
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import React, { useState } from 'react';
import { MessageAfterParty } from '../Card/message';

interface MediaItem {
  type: 'image' | 'video';
  file: string; // image file or Streamable video ID
}

interface NightPartyClientProps {
  showPastEventNotice?: boolean;
}

export default function NightPartyClient({ showPastEventNotice }: NightPartyClientProps) {
  const galleryItems: MediaItem[] = [
    { type: 'image', file: 'PartyOne.png' },
    { type: 'image', file: 'PartyTwo.png' },
    { type: 'image', file: 'PartyThree.png' },
    { type: 'video', file: '6nrwr0' },
    { type: 'video', file: 'n8vdt8' },
    { type: 'video', file: '4de1iq' },
    { type: 'video', file: 'pcvg7q' },
    { type: 'video', file: 'fnbegr' },
  ];

  const [playing, setPlaying] = useState<number | null>(null);

  const preventRightClick = (e: React.MouseEvent<HTMLImageElement>) => {
    e.preventDefault();
  };

  return (
    <motion.main
      className="min-h-screen bg-gradient-to-r animate-gradient text-white flex flex-col items-center px-6 sm:px-16 py-24 space-y-16"
      initial="hidden"
      animate="visible"
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.25 } } }}
    >
      {/* Past Event Notice */}
      {showPastEventNotice && (
        <div className="bg-yellow-400 text-black font-bold px-6 py-3 rounded-full text-center text-lg mb-6 shadow-lg">
          This party has already happened. Check out the highlights below!
        </div>
      )}

      {/* Hero Section */}
      <motion.header
        className="text-center flex flex-col items-center gap-6 max-w-4xl"
        variants={{ hidden: { opacity: 0, y: 40 }, visible: { opacity: 1, y: 0 } }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
          className="rounded-full overflow-hidden w-[220px] h-[220px] shadow-xl shadow-purple-400/50"
        >
          <Image
            src="/image/CompanyLogoPng/BridgeInn.png"
            alt="Bridge Inn LGBTQ Logo"
            width={220}
            height={220}
            className="object-cover w-full h-full rounded-full select-none"
            draggable={false}
            onContextMenu={preventRightClick}
          />
        </motion.div>

        <motion.h1
          className="text-6xl sm:text-7xl font-bold text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.7)]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          Night-Time Party at Bridge Inn Highlights
        </motion.h1>
      </motion.header>

      {/* Thank-You Message */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="w-full max-w-4xl"
      >
        <MessageAfterParty />
      </motion.div>

      {/* Event Gallery */}
      <motion.section
        className="w-full max-w-7xl text-center space-y-12"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <h2 className="text-5xl font-extrabold mb-8 drop-shadow-lg">✨ Party Highlights ✨</h2>

        <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
          {galleryItems.map((item, i) => (
            <motion.div
              key={i}
              whileHover={{ scale: 1.02 }}
              className="relative overflow-hidden rounded-2xl shadow-xl break-inside-avoid cursor-pointer group"
            >
              {item.type === 'image' ? (
                <Image
                  src={`/image/PridePartyPng/${item.file}`}
                  alt={`Night Party photo ${i + 1}`}
                  width={800}
                  height={600}
                  className="object-cover w-full rounded-2xl transition-transform duration-500 group-hover:scale-110"
                  draggable={false}
                  onContextMenu={preventRightClick}
                  loading="lazy"
                />
              ) : playing === i ? (
                <iframe
                  src={`https://streamable.com/e/${item.file}`}
                  title={`Night Party video ${i + 1}`}
                  allow="autoplay; fullscreen"
                  allowFullScreen
                  className="w-full aspect-video rounded-2xl"
                />
              ) : (
                <div
                  className="relative w-full aspect-video bg-black/50 flex items-center justify-center rounded-2xl overflow-hidden"
                  onClick={() => setPlaying(i)}
                >
                  <Image
                    src="/image/CompanyLogoPng/BridgeInn.png"
                    alt="Video thumbnail"
                    width={800}
                    height={600}
                    className="object-cover w-full h-full opacity-60"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white text-5xl font-bold drop-shadow-lg">▶</span>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Support Section */}
      <motion.section
        className="relative mt-16 w-full bg-gradient-to-r p-12 rounded-3xl shadow-2xl shadow-purple-400/50 flex flex-col items-center text-center overflow-hidden"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
      >
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full blur-3xl animate-pulse bg-purple-400/50"></div>
        <div className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full blur-3xl animate-pulse bg-blue-400/30"></div>

        <h2 className="text-4xl sm:text-5xl font-extrabold mb-4 text-white drop-shadow-lg">
          Support Our Events 💜
        </h2>
        <p className="text-lg sm:text-xl mb-8 max-w-2xl text-white/90 leading-relaxed">
          Help us continue hosting amazing night events at Bridge Inn! Your support keeps the parties vibrant and inclusive.
        </p>
        <Link
          href="https://www.gofundme.com/f/raising-funds-for-burton-pride"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-yellow-400 text-black px-8 py-4 rounded-full font-bold text-xl hover:bg-yellow-300 transition transform hover:scale-105 shadow-lg shadow-yellow-400/50 animate-bounce"
        >
          Donate Now
        </Link>
      </motion.section>

      {/* Get Involved Section */}
      {!showPastEventNotice && (
        <motion.section
          className="text-center w-full max-w-4xl"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.6 }}
        >
          <h2 className="text-4xl font-semibold mb-6">Get Involved</h2>
          <p className="text-xl text-gray-100 mb-6 leading-relaxed">
            Join our night-time events! Sign up as a volunteer to help organize, manage, and celebrate with the community.
          </p>
          <Link
            href="https://forms.gle/nightpartyvolunteer"
            className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-8 rounded-full transition duration-300 ease-in-out"
            target="_blank"
            rel="noopener noreferrer"
          >
            Volunteer Now
          </Link>
        </motion.section>
      )}
    </motion.main>
  );
}
