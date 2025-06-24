'use client';

import Image from "next/image";
import Card from "../Card/Card";
import Link from "next/link";
import { motion } from "framer-motion";

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.3 }
  }
};

const fadeUpVariant = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } }
};

const buttonHover = {
  scale: 1.05,
  transition: { duration: 0.2 }
};

export default function CollaborateClient() {
  return (
    <motion.div
      className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex flex-col items-center p-8 sm:p-16 pb-24"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Hero */}
      <motion.header
        className="text-center flex flex-col items-center gap-6 mt-16"
        variants={fadeUpVariant}
      >
        <Image
          src="/image/logo.jpg"
          alt="Burton Pride Logo"
          width={180}
          height={180}
          className="hero-logo rounded-full shadow-lg"
        />
        <h1 className="text-4xl sm:text-6xl font-bold">Collaborate with Us</h1>
        <p className="text-lg sm:text-xl max-w-2xl">
          Want to partner with Burton Pride? We’re always open to new collaborations and ideas to make Burton Pride even better. Let's make it happen together!
        </p>
      </motion.header>

      {/* Sponsorship Cards */}
      <motion.section
        className="mt-16 w-full max-w-5xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        variants={fadeUpVariant}
      >
        {[
          { title: "Standard Sponsorship", price: "£150+", color: "text-pink-500", perks: ["Business logo included in social media", "2 Wristbands to the Pride event"] },
          { title: "Bronze Sponsorship", price: "£350+", color: "text-yellow-500", perks: ["Business logo on social media & main stage screen", "A6 advert in event program", "Opportunity to have a stall"] },
          { title: "Silver Sponsorship", price: "£995+", color: "text-gray-500", perks: ["Stall with other vendors", "5 Free passes for the event", "Social media mentions", "A5 or A6 Advert in program"] },
          { title: "Gold Sponsorship", price: "£1500+", color: "text-yellow-700", perks: ["3x6m gazebo with other vendors", "10 Free passes", "Mentions in social media posts", "A5, A6, or A4 Advert in program", "Feature on main stage screen", "Promotional material in event bags"] }
        ].map(({ title, price, color, perks }) => (
          <Card key={title} title={title}>
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
        className="md:w-1/2 w-full flex justify-center mt-10"
        variants={fadeUpVariant}
      >
        <motion.a
          href="https://docs.google.com/forms/d/e/1FAIpQLSevaIQw4_HWCfbUgyt1ZNBD0Jy9WCAyE6U6qgq358xCKDW1AQ/viewform"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white text-pink-500 px-6 py-3 rounded-lg shadow-lg font-semibold hover:bg-gray-200 transition-all"
          whileHover={buttonHover}
        >
          Fill Out Our Collaboration Form
        </motion.a>
      </motion.div>

      <motion.div
        className="md:w-1/2 w-full flex justify-center mt-10"
        variants={fadeUpVariant}
      >
        <motion.a
          href="https://forms.gle/taZ16ioQBXvEX7sE8"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white text-pink-500 px-6 py-3 rounded-lg shadow-lg font-semibold hover:bg-gray-200 transition-all"
          whileHover={buttonHover}
        >
          Vendor & Stallholder Bookings
        </motion.a>
      </motion.div>

      {/* Info Section */}
      <motion.section
        className="mt-16 text-center w-full max-w-3xl bg-white text-black p-8 rounded-xl shadow-lg"
        variants={fadeUpVariant}
      >
        <h2 className="text-3xl font-semibold mb-6">What Burton Pride Can Do for You</h2>
        <ul className="text-lg list-disc list-inside">
          {[
            "Attract visitors to the town.",
            "Increase your Diversity & Inclusion profile.",
            "Amplify your business brand and product impact.",
            "Engage a broad audience beyond the LGBTQ+ community."
          ].map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>

        <h2 className="text-2xl font-semibold mt-8">Did You Know?</h2>
        <p className="text-lg mt-2">1 in 16 people in the UK identify as LGBTQ+.</p>
        <p className="text-lg">3 in 5 LGBTQ+ people prefer businesses that support LGBTQ+ inclusivity.</p>

        <h2 className="text-2xl font-semibold mt-8">What Does My Sponsorship Support?</h2>
        <ul className="text-lg list-disc list-inside mt-2">
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
