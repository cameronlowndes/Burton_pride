"use client";

import { useState } from "react";
import { useMediaQuery } from "react-responsive";
import { motion } from "framer-motion";
import VolunteerForm from "../../components/Forms/VolunteerForm";

export default function BurtonPrideClient2026() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formType, setFormType] = useState<"business" | "charity">("business");

  const isMobile = useMediaQuery({ maxWidth: 767 });

  const openForm = (type: "business" | "charity") => {
    setFormType(type);
    if (isMobile) {
      window.location.href =
        type === "business"
          ? "/join-us/business-form"
          : "/join-us/charity-form";
    } else {
      setIsModalOpen(true);
    }
  };

  const closeModal = () => setIsModalOpen(false);

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
        <h1 className="text-4xl sm:text-6xl font-bold text-white drop-shadow-lg">
          Join us for Burton Pride 2026
        </h1>
        <p className="text-lg sm:text-xl max-w-2xl text-white/90">
          We are inviting local businesses, charities, and community organisations
          to be part of Burton Pride 2026.
        </p>
      </motion.header>

      {/* Message and Buttons Section */}
      <motion.section
        className="mt-12 w-full max-w-6xl flex flex-col md:flex-row gap-10"
        variants={fadeUpVariant}
      >
        {/* Left Info */}
        <div className="md:w-1/2 bg-white/20 p-6 rounded-xl shadow-lg text-white text-lg space-y-4">
          <h2 className="text-2xl font-bold mb-2 text-yellow-300">
            Get Involved with Burton Pride 2026
          </h2>

          <p>
            We are looking for <strong>local businesses, charities, and C.I.C.s</strong>{" "}
            to join us for Burton Pride 2026 and help create a vibrant and inclusive
            celebration for our community.
          </p>

          <p>
            If your organisation believes in the power of local communities and
            bringing people together, we would love to hear from you. Burton Pride
            is a fantastic opportunity to showcase your work, connect with local
            residents, and stand proudly in support of equality and inclusion.
          </p>

          <p>
            <strong>Local Businesses:</strong>  
            Apply using the <strong>Business Form</strong>.
          </p>

          <p>
            <strong>Charities &amp; C.I.C.s:</strong>  
            Apply using the <strong>Charity Form</strong>.
          </p>

          <p>
            Thank you for supporting Burton Pride and helping us bring people
            together for a safe, welcoming, and joyful event.
          </p>

          <p>
            Questions? Contact us at{" "}
            <a
              href="mailto:prideburton@gmail.com"
              className="underline text-yellow-300"
            >
              prideburton@gmail.com
            </a>
            .
          </p>
        </div>

        {/* Right Buttons */}
        <div className="md:w-1/2 flex flex-col justify-center gap-6 items-center">
          <button
            onClick={() => openForm("business")}
            className="w-3/4 sm:w-1/2 bg-yellow-400 text-black px-8 py-4 rounded-full font-bold text-xl hover:bg-yellow-300 shadow-lg transition transform hover:scale-105"
          >
            Business Form
          </button>
          <button
            onClick={() => openForm("charity")}
            className="w-3/4 sm:w-1/2 bg-green-500 text-white px-8 py-4 rounded-full font-bold text-xl hover:bg-green-400 shadow-lg transition transform hover:scale-105"
          >
            Charity Form
          </button>
        </div>
      </motion.section>

      {/* Modal for Desktop */}
      {isModalOpen && !isMobile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            className="bg-white rounded-xl p-6 max-w-lg w-full relative"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
          >
            <button
              onClick={closeModal}
              className="absolute top-3 right-3 text-black font-bold text-xl"
            >
              &times;
            </button>
            <VolunteerForm formType={formType} />
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
