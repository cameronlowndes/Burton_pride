"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import React from "react";

interface PrideEventClientProps {
  showPastEventNotice?: boolean;
}

export default function PrideEventClient({
  showPastEventNotice = false,
}: PrideEventClientProps) {
  const preventRightClick = (e: React.MouseEvent<HTMLImageElement>) => {
    e.preventDefault();
  };

  const eventTerms = [
    {
      title: "Dogs & Pets",
      icon: "🐶",
      text: "Dogs are welcome but must be kept on a lead at all times. Owners must clean up after their pets and bring their own dog waste bags.",
    },
    {
      title: "Keep Pride Clean",
      icon: "🗑️",
      text: "Please use the bins provided and take responsibility for your own rubbish to help keep the event clean, safe, and enjoyable.",
    },
    {
      title: "No Outside Alcohol",
      icon: "🍺",
      text: "Outside alcohol is not permitted on site. Alcohol may only be consumed if purchased from licensed vendors at the event.",
    },
    {
      title: "Weather Policy",
      icon: "☀️",
      text: "Due to warm weather, visitors may bring water and soft drinks into the event. Drinks must be in plastic bottles only. No glass bottles are permitted.",
    },
    {
      title: "Sun Safety",
      icon: "🧴",
      text: "Please wear plenty of sun cream, stay hydrated, take breaks where needed, and look after yourself and others throughout the day.",
    },
    {
      title: "Food & Drink",
      icon: "🥤",
      text: "Water and soft drinks are allowed under the Weather Policy. Outside food is not permitted, except for special dietary requirements.",
    },
    {
      title: "Respect Everyone",
      icon: "🌈",
      text: "All visitors must behave responsibly and respectfully. Dangerous, abusive, or disruptive behaviour may result in removal from the event.",
    },
    {
      title: "Accessibility Support",
      icon: "♿",
      text: "Burton Pride aims to be inclusive and accessible. Visitors with accessibility needs are encouraged to contact us in advance.",
    },
    {
      title: "Stage Access",
      icon: "🎤",
      text: "No one is allowed on stage without approval. Only scheduled performers, staff, and authorised volunteers may access the stage.",
    },
    {
      title: "Political Party Policy",
      icon: "📢",
      text: "Only political parties formally invited by the Burton Pride Committee may represent their party, display branding, or distribute materials.",
    },
  ];

  return (
    <motion.main
      className="min-h-screen bg-gradient-to-r animate-gradient text-white flex flex-col items-center px-6 sm:px-10 lg:px-20 pt-32 pb-24 space-y-16"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.25 } },
      }}
    >
      {showPastEventNotice && (
        <div className="bg-yellow-400 text-black font-bold px-6 py-3 rounded-full text-center text-lg mb-6 shadow-lg">
          Burton Pride 2026 is coming soon. More information will be announced
          shortly!
        </div>
      )}

      <motion.header
        className="text-center flex flex-col items-center gap-6 max-w-5xl"
        variants={{
          hidden: { opacity: 0, y: 40 },
          visible: { opacity: 1, y: 0 },
        }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          className="rounded-full overflow-hidden w-[220px] h-[220px] shadow-xl shadow-pink-300/50 bg-white"
        >
          <Image
            src="/image/Logo.png"
            alt="Burton Pride Logo"
            width={220}
            height={220}
            className="object-cover w-full h-full rounded-full select-none"
            draggable={false}
            onContextMenu={preventRightClick}
            priority
          />
        </motion.div>

        <motion.p
          className="inline-flex items-center rounded-full bg-yellow-400 text-black px-5 py-2 text-base sm:text-lg font-bold shadow-lg"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          Saturday 27th June 2026
        </motion.p>

        <motion.h1
          className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.7)]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          Burton Pride 2026
        </motion.h1>

        <motion.p
          className="text-xl sm:text-2xl text-white/90 leading-relaxed max-w-3xl"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
        >
          Burton Pride is back for 2026. A community-led, grassroots Pride
          created by the community, for the community.
        </motion.p>

        <motion.div
          className="flex flex-wrap justify-center gap-4 pt-4"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Link
            href="/DonateToUs"
            className="inline-block bg-yellow-400 text-black px-8 py-4 rounded-full font-bold text-lg hover:bg-yellow-300 transition duration-300 hover:scale-105 shadow-lg shadow-yellow-400/40"
          >
            Donate to Burton Pride
          </Link>

          <Link
            href="/BurtonPride2026/PlanYourJourney"
            className="inline-block bg-green-500 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-green-600 transition duration-300 hover:scale-105 shadow-lg"
          >
            Plan Your Journey
          </Link>

          <Link
            href="/BurtonPride2026/Terms"
            className="inline-block bg-orange-400 text-black px-8 py-4 rounded-full font-bold text-lg hover:bg-orange-500 transition duration-300 hover:scale-105 shadow-lg"
          >
            Event Terms & Conditions
          </Link>

        
          <Link
            href="/ContactUS"
            className="inline-block bg-white text-purple-700 px-8 py-4 rounded-full font-bold text-lg hover:bg-gray-100 transition duration-300 hover:scale-105 shadow-lg"
          >
            Contact Us
          </Link>
        </motion.div>
      </motion.header>

      <motion.section
        className="w-full max-w-6xl rounded-3xl bg-yellow-100 text-black p-8 sm:p-12 text-center shadow-2xl border-4 border-yellow-400"
        initial={{ opacity: 0, y: 35 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <h2 className="text-4xl font-extrabold mb-4">
          Weather Policy Update ☀️
        </h2>

        <p className="text-lg sm:text-xl leading-relaxed mb-4">
          Due to the warm weather expected during Burton Pride 2026, visitors
          may bring water and soft drinks into the event.
        </p>

        <p className="text-lg sm:text-xl leading-relaxed mb-6">
          Drinks must be in plastic bottles only. Glass bottles and outside
          alcohol are not permitted. Please wear sun cream, stay hydrated, and
          look after yourself and others.
        </p>

      </motion.section>

      <motion.section
        className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-6"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.85 }}
      >
        <div className="rounded-3xl bg-white text-black p-6 shadow-2xl">
          <h2 className="text-2xl font-bold mb-3">📅 Date</h2>
          <p className="text-lg leading-relaxed">
            Burton Pride 2026 will take place on{" "}
            <strong>Saturday 27th June 2026</strong>.
          </p>
        </div>

        <div className="rounded-3xl bg-white text-black p-6 shadow-2xl">
          <h2 className="text-2xl font-bold mb-3">🌈 Community Pride</h2>
          <p className="text-lg leading-relaxed">
            We are a grassroots Pride built on people power, inclusion, and
            community support.
          </p>
        </div>

        <div className="rounded-3xl bg-white text-black p-6 shadow-2xl">
          <h2 className="text-2xl font-bold mb-3">💖 Free & Open</h2>
          <p className="text-lg leading-relaxed">
            Our aim is to keep Burton Pride free and open to the public, with
            funds going back into the community.
          </p>
        </div>
      </motion.section>

      <motion.section
        className="w-full max-w-5xl rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 p-8 sm:p-12 text-center shadow-2xl"
        initial={{ opacity: 0, y: 35 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
      >
        <h2 className="text-4xl sm:text-5xl font-extrabold mb-6">
          What to Expect
        </h2>

        <p className="text-lg sm:text-xl text-white/90 leading-relaxed mb-6">
          Burton Pride 2026 is a grassroots Pride created by the community, for
          the community. We believe in celebrating diversity, fostering
          inclusion, and building a stronger community together.
        </p>

        <p className="text-lg sm:text-xl text-white/90 leading-relaxed mb-6">
          Expect a day filled with vibrant entertainment, local stalls,
          family-friendly activities, and a welcoming atmosphere where everyone
          can be themselves.
        </p>

        <p className="text-lg sm:text-xl text-white/90 leading-relaxed">
          Come and join us for a day of celebration, connection, and community
          spirit. Whether you are here to enjoy the entertainment, support local
          businesses, or simply soak up the positive vibes, there is something
          for everyone at Burton Pride 2026.
        </p>
      </motion.section>

      <motion.section
        className="w-full max-w-6xl rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 p-8 sm:p-12 shadow-2xl"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.05 }}
      >
        <div className="text-center mb-10">
          <h2 className="text-4xl sm:text-5xl font-extrabold mb-4">
            Top 10 Event Terms & Conditions
          </h2>

          <p className="text-lg sm:text-xl text-white/90 max-w-3xl mx-auto leading-relaxed">
            Please read the key event rules before attending Burton Pride 2026.
            These help us keep the event safe, welcoming, inclusive, and
            enjoyable for everyone.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {eventTerms.map((term, index) => (
            <motion.div
              key={term.title}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1 + index * 0.06 }}
              whileHover={{ y: -6, scale: 1.02 }}
              className="rounded-3xl bg-white text-black p-6 shadow-xl border border-white/40"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-yellow-400 text-3xl shadow-md">
                  {term.icon}
                </div>

                <div>
                  <div className="mb-2 inline-flex rounded-full bg-black text-white text-xs font-bold px-3 py-1">
                    Rule {index + 1}
                  </div>

                  <h3 className="text-2xl font-extrabold mb-3">
                    {term.title}
                  </h3>

                  <p className="text-gray-700 leading-relaxed">{term.text}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
          <Link
            href="/BurtonPride2026/Terms"
            className="inline-block bg-orange-400 text-black px-8 py-4 rounded-full font-bold text-lg hover:bg-orange-500 transition duration-300 hover:scale-105 shadow-lg"
          >
            Read Full Terms & Conditions
          </Link>

        </div>
      </motion.section>

      <motion.section
        className="w-full max-w-5xl rounded-3xl bg-white text-black p-8 sm:p-12 text-center shadow-2xl"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.08 }}
      >
        <h2 className="text-4xl font-extrabold mb-4">Plan Your Journey 🚆</h2>

        <p className="text-lg sm:text-xl leading-relaxed mb-6">
          Need help getting to Burton Pride 2026? View travel information for
          train, bus, taxi, and local journey support.
        </p>

        <Link
          href="/BurtonPride2026/PlanYourJourney"
          className="inline-block bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-8 rounded-full transition duration-300 hover:scale-105 shadow-lg"
        >
          Plan Your Journey
        </Link>
      </motion.section>

      <motion.section
        className="w-full max-w-5xl rounded-3xl bg-yellow-100 text-black p-8 sm:p-12 text-center shadow-2xl border-4 border-yellow-400"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.12 }}
      >
        <h2 className="text-4xl font-extrabold mb-4">
          Event Terms & Conditions 📄
        </h2>

        <p className="text-lg sm:text-xl leading-relaxed mb-6">
          Please read our event terms and conditions before attending Burton
          Pride 2026. This helps everyone understand event guidance, safety
          expectations, and how we keep Pride welcoming for all.
        </p>

        <Link
          href="/BurtonPride2026/Terms"
          className="inline-block bg-black hover:bg-gray-800 text-white font-bold py-4 px-8 rounded-full transition duration-300 hover:scale-105 shadow-lg"
        >
          View Terms & Conditions
        </Link>
      </motion.section>

      <motion.section
        className="relative w-full max-w-6xl bg-gradient-to-r p-8 sm:p-12 rounded-3xl shadow-2xl shadow-pink-400/50 flex flex-col items-center text-center overflow-hidden"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.15 }}
      >
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full blur-3xl animate-pulse bg-pink-400/50" />
        <div className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full blur-3xl animate-pulse bg-blue-400/30" />

        <div className="relative z-10">
          <h2 className="text-4xl sm:text-5xl font-extrabold mb-4 text-white drop-shadow-lg">
            Support Burton Pride 2026 💖
          </h2>

          <p className="text-lg sm:text-xl mb-8 max-w-2xl text-white/90 leading-relaxed">
            Help us keep Burton Pride community-led, ethical, and accessible.
            Every donation helps us pay for event costs, safety, equipment,
            entertainment, and community support.
          </p>

          <Link
            href="/DonateToUs"
            className="bg-yellow-400 text-black px-8 py-4 rounded-full font-bold text-xl hover:bg-yellow-300 transition-transform duration-300 hover:scale-105 shadow-lg shadow-yellow-400/50"
          >
            Donate Now
          </Link>
        </div>
      </motion.section>

      <motion.section
        className="text-center w-full max-w-5xl"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.3 }}
      >
        <h2 className="text-4xl font-semibold mb-6">Get Involved</h2>

        <p className="text-xl text-gray-100 mb-8 leading-relaxed">
          Burton Pride is powered by people. We welcome volunteers, community
          groups, stallholders, performers, and supporters who want to help make
          Pride happen.
        </p>

        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/JoinUS/Volunteer"
            className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-8 rounded-full transition duration-300 ease-in-out"
          >
            Volunteer With Us
          </Link>

          <Link
            href="/ContactUS"
            className="inline-block bg-white text-purple-700 hover:bg-gray-100 font-bold py-4 px-8 rounded-full transition duration-300 ease-in-out"
          >
            Contact Burton Pride
          </Link>
        </div>
      </motion.section>

      <motion.section
        className="w-full max-w-5xl rounded-3xl bg-white text-black p-8 sm:p-12 text-center shadow-2xl"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.45 }}
      >
        <h2 className="text-4xl font-extrabold mb-4">
          Burton Pride After Party 🎉
        </h2>

        <p className="text-lg sm:text-xl leading-relaxed mb-4">
          The Burton Pride 2026 After Party will be held at{" "}
          <strong>The Bridge Inn</strong> on{" "}
          <strong>Saturday 27th June 2026</strong>.
        </p>

        <p className="text-lg sm:text-xl leading-relaxed mb-6">
          Time: <strong>6:00pm to 11:30pm</strong>. Entry is{" "}
          <strong>free</strong>.
        </p>

        <Link
          href="/events"
          className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-7 rounded-full transition duration-300"
        >
          View Events
        </Link>
      </motion.section>

      <motion.section
        className="text-center w-full max-w-4xl pb-6"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.6 }}
      >
        <h2 className="text-4xl font-bold mb-4">
          Pride belongs to the community
        </h2>

        <p className="text-xl text-white/90 leading-relaxed mb-8">
          Burton Pride C.I.C is built by the community, for the community. Your
          support helps us keep Pride rooted in people power.
        </p>

        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/DonateToUs"
            className="inline-block bg-yellow-400 text-black px-8 py-4 rounded-full font-bold text-xl hover:bg-yellow-300 transition duration-300 hover:scale-105 shadow-lg"
          >
            Help Keep Pride Free
          </Link>

          <Link
            href="/BurtonPride2026/PlanYourJourney"
            className="inline-block bg-green-500 text-white px-8 py-4 rounded-full font-bold text-xl hover:bg-green-600 transition duration-300 hover:scale-105 shadow-lg"
          >
            Plan Your Journey
          </Link>

          <Link
            href="/BurtonPride2026/Terms"
            className="inline-block bg-orange-400 text-black px-8 py-4 rounded-full font-bold text-xl hover:bg-orange-500 transition duration-300 hover:scale-105 shadow-lg"
          >
            Event Terms & Conditions
          </Link>
        </div>
      </motion.section>
    </motion.main>
  );
}