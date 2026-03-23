'use client';

import { motion } from "framer-motion";
import VolunteerForm from "../../Forms/VolunteerForm";

export default function JoinUsVolunteerContent() {
  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.3 } },
  };

  const fadeUpVariant = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
  };

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex flex-col items-center p-8 sm:p-16 pb-24"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Hero Section */}
      <motion.header
        className="text-center flex flex-col items-center gap-6 mt-16"
        variants={fadeUpVariant}
      >
        <h1 className="text-4xl sm:text-6xl font-bold">Join Our Volunteer Team</h1>
        <p className="text-lg sm:text-xl max-w-2xl">
          Volunteer with us and be part of an inclusive and vibrant community. Together, we can make Burton Pride a truly unforgettable event!
        </p>
      </motion.header>

      {/* Message and Form Section */}
      <motion.section
        className="mt-12 w-full max-w-6xl flex flex-col md:flex-row gap-10"
        variants={fadeUpVariant}
      >
        {/* Informational Message (Left) */}
        <div className="md:w-1/2 bg-white/20 p-6 rounded-xl shadow-lg text-white text-lg space-y-4">
          <h2 className="text-2xl font-bold mb-2 text-yellow-300">Why does Burton Pride C.I.C. need volunteers?</h2>
          <p>Because your involvement can make a real difference. Your information is crucial for us to comply with our legal obligations and ensure the safety of everyone we serve.</p>
          <p>Nearly all tasks that Burton Pride asks its volunteers to take on require interaction with the public, including potential contact with children and vulnerable adults.</p>
          <p>Your trust is important to us. Burton Pride requires this information to comply with legal obligations. Your actions as a volunteer significantly impact our operations and the lives of those we serve.</p>
          <p>Rest assured, Burton Pride C.I.C. values your privacy. We will only share your information if requested by the appropriate authority.</p>
          <p>If you have any questions, please don’t hesitate to contact us at <a href="mailto:Info@burtonpride.co.uk" className="underline text-yellow-300">Info@burtonpride.co.uk</a>. We would love to hear from you.</p>
        </div>

        {/* Volunteer Form (Right) */}
        <div className="md:w-1/2 flex justify-center">
          <VolunteerForm />
        </div>
      </motion.section>
    </motion.div>
  );
}
