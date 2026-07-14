"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import React from "react";

interface PrideEventClientProps {
  showPastEventNotice?: boolean;
}

type GalleryPhoto = {
  src: string;
  alt: string;
  position?: string;
};

type HighlightItem = {
  icon: string;
  title: string;
  text: string;
};

type ThankYouItem = {
  icon: string;
  title: string;
  text: string;
};

const fadeUp = {
  hidden: { opacity: 0, y: 36 },
  visible: { opacity: 1, y: 0 },
};

export default function PrideEventClient({
  showPastEventNotice = true,
}: PrideEventClientProps) {
  /*
   * Add or remove photographs here.
   * Save the images inside:
   * public/image/PrideEventPicturePng/2026/
   */
  const galleryPhotos: GalleryPhoto[] = [
    {
      src: "/image/PrideEventPicturePng/2026/1.jpg",
      alt: "The Burton Pride 2026 event at Shobnall Leisure Complex",
    },
    {
      src: "/image/PrideEventPicturePng/2026/2.jpg",
      alt: "Visitors celebrating together at Burton Pride 2026",
    },
    {
      src: "/image/PrideEventPicturePng/2026/3.jpg",
      alt: "A live performance on the Burton Pride 2026 stage",
    },
    {
      src: "/image/PrideEventPicturePng/2026/4.jpg",
      alt: "Community organisations attending Burton Pride 2026",
    },
    {
      src: "/image/PrideEventPicturePng/2026/5.jpg",
      alt: "Colourful stalls at Burton Pride 2026",
    },
    {
      src: "/image/PrideEventPicturePng/2026/6.jpg",
      alt: "Volunteers helping at Burton Pride 2026",
    },
    {
      src: "/image/PrideEventPicturePng/2026/7.jpg",
      alt: "Pride flags and decorations at Burton Pride 2026",
    },
    {
      src: "/image/PrideEventPicturePng/2026/8.jpg",
      alt: "Friends enjoying Burton Pride 2026 together",
    },
    {
      src: "/image/PrideEventPicturePng/2026/9.jpg",
      alt: "Local performers entertaining the Burton Pride community",
    },
    {
      src: "/image/PrideEventPicturePng/2026/10.jpg",
      alt: "The Burton Pride community celebrating love and inclusion",
    },
    {
      src: "/image/PrideEventPicturePng/2026/11.jpg",
      alt: "A community group at Burton Pride 2026",
    },
    {
      src: "/image/PrideEventPicturePng/2026/12.jpg",
      alt: "Burton Pride 2026 event highlights",
    },
  ];

  const eventHighlights: HighlightItem[] = [
    {
      icon: "📅",
      title: "Saturday 27 June 2026",
      text: "Our main Pride celebration took place at Shobnall Leisure Complex in Burton upon Trent.",
    },
    {
      icon: "🌈",
      title: "Community-Led Pride",
      text: "Burton Pride was created by the community, for the community, and that remained at the heart of the whole event.",
    },
    {
      icon: "💖",
      title: "Free for Everyone",
      text: "The main event remained free to attend so that cost was not a barrier to joining the celebration.",
    },
    {
      icon: "🎤",
      title: "Live Entertainment",
      text: "Our stage brought together performers, hosts, music, drag, and community talent throughout the day.",
    },
    {
      icon: "🏳️‍🌈",
      title: "A Place to Belong",
      text: "People came together to celebrate identity, visibility, equality, love, and the right to be themselves.",
    },
    {
      icon: "🎉",
      title: "After Party",
      text: "The celebration continued at The Bridge Inn with drag bingo, karaoke, music, and a free community after party.",
    },
  ];

  const thankYouItems: ThankYouItem[] = [
    {
      icon: "🙌",
      title: "Our Volunteers",
      text: "Thank you to every volunteer who gave their time, energy, and care before, during, and after the event.",
    },
    {
      icon: "🏪",
      title: "Local Businesses",
      text: "Thank you to the businesses, stallholders, food vendors, and suppliers who helped bring the event to life.",
    },
    {
      icon: "🤝",
      title: "Community Groups",
      text: "Thank you to every charity, organisation, campaign, and community group that stood alongside Burton Pride.",
    },
    {
      icon: "⭐",
      title: "Sponsors and Supporters",
      text: "Thank you to everyone who donated, sponsored, shared our work, provided resources, or supported us in another way.",
    },
  ];

  const preventRightClick = (event: React.MouseEvent<HTMLImageElement>) => {
    event.preventDefault();
  };

  return (
    <motion.main
      className="min-h-screen bg-gradient-to-r animate-gradient px-5 pb-24 pt-32 text-white sm:px-10 lg:px-20"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.14 } },
      }}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-16">
        {showPastEventNotice && (
          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.6 }}
            className="w-full max-w-4xl rounded-full border-2 border-yellow-200 bg-yellow-400 px-6 py-3 text-center text-base font-black text-black shadow-xl sm:text-lg"
          >
            Burton Pride 2026 has now taken place. Explore the story and
            highlights from the day below.
          </motion.div>
        )}

        <motion.header
          className="flex max-w-5xl flex-col items-center gap-6 text-center"
          variants={fadeUp}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            className="h-56 w-56 overflow-hidden rounded-full bg-white shadow-xl shadow-pink-300/50"
          >
            <Image
              src="/image/Logo.png"
              alt="Burton Pride logo"
              width={220}
              height={220}
              className="h-full w-full select-none rounded-full object-cover"
              draggable={false}
              onContextMenu={preventRightClick}
              priority
            />
          </motion.div>

          <p className="inline-flex items-center rounded-full bg-yellow-400 px-5 py-2 text-base font-black text-black shadow-lg sm:text-lg">
            Saturday 27 June 2026
          </p>

          <h1 className="text-5xl font-black text-white drop-shadow-lg sm:text-6xl lg:text-7xl">
            Burton Pride 2026 Highlights
          </h1>

          <p className="max-w-3xl text-xl leading-relaxed text-white/90 sm:text-2xl">
            A grassroots Pride made possible by local people, community groups,
            volunteers, performers, businesses, supporters, and everyone who
            came together to celebrate.
          </p>

          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <a
              href="#gallery"
              className="rounded-full bg-white px-8 py-4 text-lg font-black text-purple-700 shadow-lg transition hover:scale-105 hover:bg-gray-100"
            >
              View Event Gallery
            </a>

            <Link
              href="/DonateToUs"
              className="rounded-full bg-yellow-400 px-8 py-4 text-lg font-black text-black shadow-lg shadow-yellow-400/40 transition hover:scale-105 hover:bg-yellow-300"
            >
              Support Burton Pride
            </Link>
          </div>
        </motion.header>

        <motion.section
          variants={fadeUp}
          transition={{ duration: 0.7 }}
          className="relative w-full max-w-6xl overflow-hidden rounded-3xl border border-white/25 bg-white/10 p-8 shadow-2xl backdrop-blur-md sm:p-12"
        >
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-pink-400/30 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-blue-400/25 blur-3xl" />

          <div className="relative z-10 mx-auto max-w-4xl text-center">
            <p className="mb-4 text-sm font-black uppercase tracking-widest text-yellow-300">
              A message from the committee
            </p>

            <h2 className="mb-8 text-4xl font-black sm:text-5xl">
              Thank You for Making Burton Pride 2026 Possible 🌈
            </h2>

            <div className="space-y-6 text-left text-lg leading-8 text-white/90 sm:text-xl sm:leading-9">
              <p>
                All of us at Burton Pride want to say a huge thank you to
                everyone who helped make Burton Pride 2026 possible. From our
                amazing volunteers and local businesses to community groups,
                sponsors, performers, stallholders, suppliers, and every person
                who supported or attended the event, we could not have done it
                without you.
              </p>

              <p>
                Burton Pride is a grassroots Pride created by the community,
                for the community. The event was built through local people
                giving their time, skills, ideas, kindness, and support. Every
                contribution, whether large or small, helped us create a day
                that celebrated love, diversity, inclusion, visibility, and
                equality across Burton upon Trent.
              </p>

              <p>
                A special thank you goes to the Burton Pride Committee, whose
                passion, dedication, and countless hours of work brought the
                2026 event together. Behind the scenes, the committee worked
                throughout the year to organise the venue, entertainment,
                safety, accessibility, stalls, volunteers, suppliers, and all
                the practical details needed to make Pride happen.
              </p>

              <p>
                Your energy, kindness, and commitment are what make Burton
                Pride so special. Together, we created more than a one-day
                event. We created a welcoming community space filled with love,
                unity, protest, celebration, and the freedom for people to be
                themselves.
              </p>

              <p className="font-bold text-white">
                To every supporter, volunteer, committee member, performer,
                organisation, business, and visitor: thank you for standing
                with Pride and for showing what our community can achieve when
                we come together. 💖
              </p>
            </div>
          </div>
        </motion.section>

        <motion.section
          variants={fadeUp}
          transition={{ duration: 0.7 }}
          className="w-full max-w-6xl"
        >
          <div className="mb-10 text-center">
            <p className="mb-3 text-sm font-black uppercase tracking-widest text-yellow-300">
              The day at a glance
            </p>
            <h2 className="text-4xl font-black sm:text-5xl">
              Burton Pride 2026
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {eventHighlights.map((highlight, index) => (
              <motion.article
                key={highlight.title}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + index * 0.07 }}
                whileHover={{ y: -7, scale: 1.015 }}
                className="h-full rounded-3xl border border-white/20 bg-white/10 p-7 shadow-xl backdrop-blur-md"
              >
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-yellow-400 text-3xl shadow-lg">
                  {highlight.icon}
                </div>
                <h3 className="mb-3 text-2xl font-black">{highlight.title}</h3>
                <p className="leading-7 text-white/80">{highlight.text}</p>
              </motion.article>
            ))}
          </div>
        </motion.section>

        <motion.section
          variants={fadeUp}
          transition={{ duration: 0.7 }}
          className="w-full max-w-6xl rounded-3xl bg-white p-8 text-black shadow-2xl sm:p-12"
        >
          <div className="mx-auto max-w-4xl text-center">
            <p className="mb-3 text-sm font-black uppercase tracking-widest text-purple-700">
              What happened
            </p>
            <h2 className="mb-6 text-4xl font-black sm:text-5xl">
              A Day of Pride, Community and Celebration
            </h2>

            <div className="space-y-5 text-left text-lg leading-8 text-gray-700 sm:text-xl sm:leading-9">
              <p>
                On Saturday 27 June 2026, people from across Burton upon Trent
                and beyond came together at Shobnall Leisure Complex for Burton
                Pride. The event welcomed the community for an afternoon of
                live entertainment, local stalls, food and drink, community
                organisations, activities, and Pride celebration.
              </p>

              <p>
                The day was about being visible, standing together, supporting
                local LGBTQIA+ people, and creating a place where everyone
                could feel welcomed and valued. Burton Pride remained free to
                attend because we believe Pride should be open and accessible
                to the whole community.
              </p>

              <p>
                After the main event, the celebration continued at The Bridge
                Inn with drag bingo, drag karaoke, music, and our community
                after party. It was a joyful end to a day built through local
                teamwork and community spirit.
              </p>
            </div>
          </div>
        </motion.section>

        <motion.section
          id="gallery"
          variants={fadeUp}
          transition={{ duration: 0.7 }}
          className="w-full max-w-7xl scroll-mt-28"
        >
          <div className="mb-10 text-center">
            <p className="mb-3 text-sm font-black uppercase tracking-widest text-yellow-300">
              Memories from the day
            </p>
            <h2 className="text-4xl font-black sm:text-5xl">Event Gallery</h2>
            <p className="mx-auto mt-4 max-w-3xl text-lg leading-relaxed text-white/85">
              A look back at the people, performances, organisations, colours,
              and community moments that made Burton Pride 2026 special.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {galleryPhotos.map((photo, index) => (
              <motion.figure
                key={photo.src}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + index * 0.05 }}
                whileHover={{ scale: 1.025, y: -5 }}
                className="group overflow-hidden rounded-3xl border border-white/20 bg-white/10 shadow-xl backdrop-blur-sm"
              >
                <div className="relative h-72 w-full overflow-hidden bg-black/20">
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className={`select-none object-cover transition duration-500 group-hover:scale-105 ${
                      photo.position ?? "object-center"
                    }`}
                    loading="lazy"
                    draggable={false}
                    onContextMenu={preventRightClick}
                  />
                </div>
                <figcaption className="sr-only">{photo.alt}</figcaption>
              </motion.figure>
            ))}
          </div>
        </motion.section>

        <motion.section
          variants={fadeUp}
          transition={{ duration: 0.7 }}
          className="w-full max-w-6xl"
        >
          <div className="mb-10 text-center">
            <p className="mb-3 text-sm font-black uppercase tracking-widest text-yellow-300">
              Pride takes a community
            </p>
            <h2 className="text-4xl font-black sm:text-5xl">
              Thank You to Everyone Who Helped
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {thankYouItems.map((item, index) => (
              <motion.article
                key={item.title}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + index * 0.08 }}
                whileHover={{ y: -6 }}
                className="flex gap-5 rounded-3xl border border-white/20 bg-white/10 p-7 shadow-xl backdrop-blur-md"
              >
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white text-3xl shadow-lg">
                  {item.icon}
                </div>
                <div>
                  <h3 className="mb-2 text-2xl font-black">{item.title}</h3>
                  <p className="leading-7 text-white/80">{item.text}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </motion.section>

        <motion.section
          variants={fadeUp}
          transition={{ duration: 0.7 }}
          className="relative w-full max-w-6xl overflow-hidden rounded-3xl border-4 border-yellow-300 bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-500 p-2 shadow-2xl shadow-pink-400/40"
        >
          <div className="relative overflow-hidden rounded-3xl bg-purple-950/90 px-7 py-12 text-center backdrop-blur-md sm:px-12 sm:py-16">
            <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-pink-400/30 blur-3xl" />
            <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-blue-400/25 blur-3xl" />

            <div className="relative z-10 mx-auto max-w-3xl">
              <p className="mb-4 inline-flex rounded-full bg-yellow-300 px-5 py-2 text-sm font-black uppercase tracking-wide text-purple-950 shadow-xl">
                Help our grassroots Pride continue
              </p>

              <h2 className="mb-5 text-4xl font-black sm:text-5xl">
                Support the Future of Burton Pride 💖
              </h2>

              <p className="mb-8 text-lg leading-8 text-white/90 sm:text-xl">
                Burton Pride is created by the community, for the community.
                Donations help us remain independent, keep Pride accessible,
                support year-round community work, and prepare for future
                events.
              </p>

              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="/DonateToUs"
                  className="rounded-full bg-yellow-400 px-8 py-4 text-xl font-black text-black shadow-lg shadow-yellow-400/40 transition hover:scale-105 hover:bg-yellow-300"
                >
                  Donate to Burton Pride
                </Link>

                <Link
                  href="/JoinUS/Volunteer"
                  className="rounded-full bg-white px-8 py-4 text-xl font-black text-purple-700 shadow-lg transition hover:scale-105 hover:bg-gray-100"
                >
                  Volunteer With Us
                </Link>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section
          variants={fadeUp}
          transition={{ duration: 0.7 }}
          className="w-full max-w-5xl rounded-3xl border border-white/20 bg-white/10 p-8 text-center shadow-2xl backdrop-blur-md sm:p-12"
        >
          <p className="mb-3 text-sm font-black uppercase tracking-widest text-yellow-300">
            Our community. Our Pride.
          </p>
          <h2 className="mb-5 text-4xl font-black sm:text-5xl">
            Pride Is More Than One Day
          </h2>
          <p className="mx-auto mb-8 max-w-3xl text-lg leading-8 text-white/90 sm:text-xl">
            Burton Pride will continue working to create visibility, connection,
            support, and safer community spaces throughout the year. Thank you
            for being part of our story and for helping us keep Pride rooted in
            the people of Burton upon Trent.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/"
              className="rounded-full bg-white px-8 py-4 text-lg font-black text-purple-700 shadow-lg transition hover:scale-105 hover:bg-gray-100"
            >
              Return to Home
            </Link>

            <Link
              href="/ContactUS"
              className="rounded-full bg-purple-600 px-8 py-4 text-lg font-black text-white shadow-lg transition hover:scale-105 hover:bg-purple-700"
            >
              Contact Burton Pride
            </Link>
          </div>
        </motion.section>
      </div>
    </motion.main>
  );
}
