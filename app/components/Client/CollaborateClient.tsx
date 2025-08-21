'use client';

import Image from "next/image";
import Card from "../Card/Card";
import Link from "next/link";
import { motion } from "framer-motion";

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.25 } }
};

const fadeUpVariant = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } }
};

const buttonHover = {
  scale: 1.05,
  boxShadow: "0 0 20px rgba(255,255,255,0.6)",
  transition: { duration: 0.3 }
};

export default function CollaborateClient() {
  return (
    <motion.div
      className="min-h-screen bg-gradient-to-r text-white flex flex-col items-center p-8 sm:p-16 pb-24"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Hero */}
      <motion.header
        className="text-center flex flex-col items-center gap-6 mt-16"
        variants={fadeUpVariant}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="rounded-full overflow-hidden w-[180px] h-[180px] shadow-[0_0_35px_rgba(255,255,255,0.6)] border-4 border-white"
        >
          <Image
            src="/image/logo.jpg"
            alt="Burton Pride Logo"
            width={180}
            height={180}
            className="rounded-full object-cover w-full h-full"
          />
        </motion.div>

        <h1 className="text-4xl sm:text-6xl font-extrabold bg-gradient-to-r from-yellow-300 via-pink-400 to-purple-500 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(255,255,255,0.7)]">
          Collaborate with Us
        </h1>

        <p className="text-lg sm:text-xl max-w-2xl bg-white/10 backdrop-blur-md rounded-2xl p-6 shadow-lg border border-white/20">
          Want to partner with <span className="font-bold text-yellow-300">Burton Pride</span>? We’re always open to new collaborations and ideas to make Burton Pride even better. Let's make it happen together!
        </p>
      </motion.header>

      {/* Sponsorship Cards */}
      <motion.section
        className="mt-16 w-full max-w-5xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        variants={fadeUpVariant}
      >
        {[
          { title: "Standard Sponsorship", price: "£150+", color: "text-pink-400", perks: ["Business logo included in social media", "2 Wristbands to the Pride event"] },
          { title: "Bronze Sponsorship", price: "£350+", color: "text-yellow-400", perks: ["Business logo on social media & main stage screen", "A6 advert in event program", "Opportunity to have a stall"] },
          { title: "Silver Sponsorship", price: "£995+", color: "text-gray-200", perks: ["Stall with other vendors", "5 Free passes for the event", "Social media mentions", "A5 or A6 Advert in program"] },
          { title: "Gold Sponsorship", price: "£1500+", color: "text-yellow-300", perks: ["3x6m gazebo with other vendors", "10 Free passes", "Mentions in social media posts", "A5, A6, or A4 Advert in program", "Feature on main stage screen", "Promotional material in event bags"] }
        ].map(({ title, price, color, perks }) => (
          <Card
            key={title}
            title={title}
            className="bg-white/10 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.5)] border border-white/20 hover:scale-[1.03] hover:shadow-[0_8px_40px_rgba(255,255,255,0.6)] transition-all"
          >
            <p className={`text-lg font-bold ${color}`}>{price}</p>
            <ul className="list-disc ml-4 text-sm mt-2">
              {perks.map((perk, index) => (
                <li key={index}>{perk}</li>
              ))}
            </ul>
          </Card>
        ))}
      </motion.section>

      {/* Buttons */}
      <motion.div
        className="md:w-1/2 w-full flex justify-center mt-10 gap-4"
        variants={fadeUpVariant}
      >
        <motion.a
          href="https://docs.google.com/forms/d/e/1FAIpQLSevaIQw4_HWCfbUgyt1ZNBD0Jy9WCAyE6U6qgq358xCKDW1AQ/viewform"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-gradient-to-r from-yellow-300 via-pink-400 to-purple-500 text-black px-8 py-4 rounded-full font-bold text-lg shadow-lg hover:shadow-[0_0_35px_rgba(255,105,180,0.8)] transition-all"
          whileHover={buttonHover}
        >
          🌈 Fill Out Our Collaboration Form
        </motion.a>
      </motion.div>

      {/* Info Section */}
      <motion.section
        className="mt-16 text-center w-full max-w-3xl bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-[0_8px_30px_rgba(0,0,0,0.5)] border border-white/20"
        variants={fadeUpVariant}
      >
        <h2 className="text-3xl font-bold mb-6 text-yellow-300 drop-shadow-lg">What Burton Pride Can Do for You</h2>
        <ul className="text-lg list-disc list-inside text-white">
          {[
            "Attract visitors to the town.",
            "Increase your Diversity & Inclusion profile.",
            "Amplify your business brand and product impact.",
            "Engage a broad audience beyond the LGBTQ+ community."
          ].map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>

        <h2 className="text-2xl font-semibold mt-8 text-pink-300 drop-shadow-lg">Did You Know?</h2>
        <p className="text-lg mt-2 text-white">1 in 16 people in the UK identify as LGBTQ+.</p>
        <p className="text-lg text-white">3 in 5 LGBTQ+ people prefer businesses that support LGBTQ+ inclusivity.</p>

        <h2 className="text-2xl font-semibold mt-8 text-green-300 drop-shadow-lg">What Does My Sponsorship Support?</h2>
        <ul className="text-lg list-disc list-inside mt-2 text-white">
          {[
            "Event stage hire",
            "Event security & fencing",
            "Radio communication hire",
            "First aid coverage",
            "Flags, poles, signage & branding",
            "Recycling & waste management",
            "Insurance & PPE",
            "PA systems & sanitation"
          ].map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </motion.section>
    </motion.div>
  );
}
