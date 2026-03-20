'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import React from 'react';
import { Message } from '../Card/message';

interface PrideEventClientProps {
  showPastEventNotice?: boolean;
}

type SponsorItem = {
  name: string;
  type?: string;
  image: string;
  href?: string;
  description?: string;
};

export default function PrideEventClient({
  showPastEventNotice,
}: PrideEventClientProps) {
  const galleryPhotos = [
    'photoOne.png',
    'PhotoTwo.png',
    'PhotoFour.png',
    'PhotoFive.png',
    'PhotoSix.png',
    'PhotoSeven.png',
    'PhotoEghit.png',
    'PhotoNine.png',
    'PhotoTen.png',
    'Photo11.png',
    'Photo12.png',
    'Photo13.png',
    'Photo15.png',
    'Photo16.png',
    'Photo17.png',
  ];

  const sponsors: SponsorItem[] = [
    {
      name: 'Wincanton ',
      type: 'Main Sponsor',
      image: '/image/CompanyLogoPng/WincantonLogo.png',
      href: '#',
      description: 'Proudly supporting Burton Pride 2025.',
    },
    {
      name: 'David Wilson Home',
      type: 'Sponsor',
      image: '/image/CompanyLogoPng/DavidWilson.Png',
      href: '#',
      description: 'Proudly supporting Burton Pride 2025.',
    },
    {
      name: 'Central England Co-Op',
      type: 'Sponsor',
      image: '/image/CompanyLogoPng/Central_Co-op_logo.png',
      href: '#',
      description: 'Proudly supporting Burton Pride 2025.',
    },
    {
      name: 'East Midlands Airport',
      type: 'Sponsor',
      image: '/image/CompanyLogoPng/EastMidland.png',
      href: '#',
      description: 'Proudly supporting Burton Pride 2025.',
    },
      {
      name: 'Been Coffee',
      type: 'Sponsor',
      image: '/image/CompanyLogoPng/BeenCoffee.png',
      href: '#',
      description: 'Proudly supporting Burton Pride 2025.',
    },
  ];

  const preventRightClick = (e: React.MouseEvent<HTMLImageElement>) => {
    e.preventDefault();
  };

  return (
    <motion.main
      className="min-h-screen bg-gradient-to-r animate-gradient text-white flex flex-col items-center px-6 sm:px-10 lg:px-20 py-24 space-y-16"
      initial="hidden"
      animate="visible"
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.25 } } }}
    >
      {showPastEventNotice && (
        <div className="bg-yellow-400 text-black font-bold px-6 py-3 rounded-full text-center text-lg mb-6 shadow-lg">
          This event has already happened. Check out the highlights below!
        </div>
      )}

      <motion.header
        className="text-center flex flex-col items-center gap-6 max-w-4xl"
        variants={{ hidden: { opacity: 0, y: 40 }, visible: { opacity: 1, y: 0 } }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
          className="rounded-full overflow-hidden w-[220px] h-[220px] shadow-xl shadow-pink-300/50"
        >
          <Image
            src="/image/Logo.png"
            alt="Burton Pride Team Logo"
            width={220}
            height={220}
            className="object-cover w-full h-full rounded-full select-none"
            draggable={false}
            onContextMenu={preventRightClick}
          />
        </motion.div>

        <motion.h1
          className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.7)]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          Burton Pride 2025 Highlights
        </motion.h1>
      </motion.header>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="w-full max-w-4xl"
      >
        <Message />
      </motion.div>

      <motion.section
        className="w-full max-w-6xl text-center space-y-12"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <h2 className="text-4xl font-semibold mb-6">Event Gallery</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {galleryPhotos.map((fileName, i) => (
            <motion.div
              key={fileName}
              whileHover={{ scale: 1.05 }}
              className="overflow-hidden rounded-2xl shadow-lg bg-white/10 backdrop-blur-sm"
            >
              <Image
                src={`/image/PrideEventPicturePng/${fileName}`}
                alt={`Burton Pride 2025 photo ${i + 1}`}
                width={500}
                height={500}
                className="object-cover w-full h-60 select-none"
                loading="lazy"
                draggable={false}
                onContextMenu={preventRightClick}
              />
            </motion.div>
          ))}
        </div>
      </motion.section>

      <motion.section
        className="relative mt-16 w-full bg-gradient-to-r p-8 sm:p-12 rounded-3xl shadow-2xl shadow-pink-400/50 flex flex-col items-center text-center overflow-hidden"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
      >
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full blur-3xl animate-pulse bg-pink-400/50" />
        <div className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full blur-3xl animate-pulse bg-blue-400/30" />

        <h2 className="text-4xl sm:text-5xl font-extrabold mb-4 text-white drop-shadow-lg">
          Support Burton Pride 2026 💖
        </h2>

        <p className="text-lg sm:text-xl mb-8 max-w-2xl text-white/90 leading-relaxed">
          Help us make next year even bigger! Your donation supports community
          initiatives, parade organisation, and inclusivity programs.
        </p>

        <Link
          href="https://www.gofundme.com/f/raising-funds-for-burton-pride?qid=63f32d4ac52a110d1d8046124f523f48"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-yellow-400 text-black px-8 py-4 rounded-full font-bold text-xl hover:bg-yellow-300 transition-transform duration-300 hover:scale-105 shadow-lg shadow-yellow-400/50 animate-bounce"
        >
          Donate Now
        </Link>
      </motion.section>

      {!showPastEventNotice && (
        <motion.section
          className="text-center w-full max-w-4xl"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.6 }}
        >
          <h2 className="text-4xl font-semibold mb-6">Get Involved</h2>
          <p className="text-xl text-gray-100 mb-6 leading-relaxed">
            We welcome volunteers to help with the next Pride event. Sign up to
            support and be part of the celebration!
          </p>

          <Link
            href="https://forms.gle/oFteosGZ9sJPQR6T9"
            className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-8 rounded-full transition duration-300 ease-in-out"
            target="_blank"
            rel="noopener noreferrer"
          >
            Volunteer Now
          </Link>
        </motion.section>
      )}

      <motion.section
        className="text-center w-full max-w-6xl"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.8 }}
      >
        <h2 className="text-4xl font-semibold mb-8">Our Proud Sponsors</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {sponsors.map((sponsor, index) => {
            const CardContent = (
              <motion.div
                key={sponsor.name}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.9 + index * 0.1 }}
                whileHover={{ y: -6, scale: 1.02 }}
                className="group h-full rounded-3xl border border-white/20 bg-white/10 backdrop-blur-md shadow-xl overflow-hidden"
              >
                <div className="relative h-52 w-full bg-white/90">
                  <Image
                    src={sponsor.image}
                    alt={sponsor.name}
                    fill
                    className="object-contain p-6"
                    sizes="(max-width: 768px) 100vw, 25vw"
                  />
                </div>

                <div className="p-6 text-left">
                  <div className="inline-flex rounded-full bg-yellow-400 text-black text-xs font-bold px-3 py-1 mb-3">
                    {sponsor.type || 'Sponsor'}
                  </div>

                  <h3 className="text-2xl font-bold text-white mb-2">
                    {sponsor.name}
                  </h3>

                  <p className="text-white/80 text-sm leading-6">
                    {sponsor.description || 'Proud supporter of Burton Pride.'}
                  </p>
                </div>
              </motion.div>
            );

            if (sponsor.href && sponsor.href !== '#') {
              return (
                <Link
                  key={sponsor.name}
                  href={sponsor.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block h-full"
                >
                  {CardContent}
                </Link>
              );
            }

            return (
              <div key={sponsor.name} className="h-full">
                {CardContent}
              </div>
            );
          })}
        </div>
      </motion.section>
    </motion.main>
  );
}