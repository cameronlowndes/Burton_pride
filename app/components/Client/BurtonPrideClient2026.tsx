"use client";

import { useState } from "react";
import { useMediaQuery } from "react-responsive";
import { motion } from "framer-motion";
import BusinessForm from "../../components/Forms/BussinessForm";
import CharityForm from "../Forms/ChraityForm";
import EntertainmentForm from "../../components/Forms/EntertainmentForm"; 

export default function BurtonPrideClient2026() {
  const [isBusinessModalOpen, setIsBusinessModalOpen] = useState(false);
  const [isCharityModalOpen, setIsCharityModalOpen] = useState(false);
  const [isEntertainmentModalOpen, setIsEntertainmentModalOpen] = useState(false);

  const isMobile = useMediaQuery({ maxWidth: 767 });

  const openBusinessForm = () => {
    if (isMobile) {
      window.location.href = "/BusinessForm";
    } else {
      setIsBusinessModalOpen(true);
    }
  };

  const openCharityForm = () => {
    if (isMobile) {
      window.location.href = "/CharityForm";
    } else {
      setIsCharityModalOpen(true);
    }
  };

  const openEntertainmentForm = () => {
    if (isMobile) {
      window.location.href = "/EntertainmentForm";
    } else {
      setIsEntertainmentModalOpen(true);
    }
  };

  const closeBusinessModal = () => setIsBusinessModalOpen(false);
  const closeCharityModal = () => setIsCharityModalOpen(false);
  const closeEntertainmentModal = () => setIsEntertainmentModalOpen(false);

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.3 } },
  };

  const fadeUpVariant = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" },
    },
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
        <h1 className="text-4xl sm:text-6xl font-bold drop-shadow-lg">
          Join us for Burton Pride 2026
        </h1>
        <p className="text-lg sm:text-xl max-w-2xl text-white/90">
          We are inviting local businesses, charities, and community organisations
          to be part of Burton Pride 2026.
        </p>
      </motion.header>

      {/* Info + Buttons */}
      <motion.section
        className="mt-12 w-full max-w-6xl flex flex-col md:flex-row gap-10"
        variants={fadeUpVariant}
      >
        {/* Left Info */}
        <div className="md:w-1/2 bg-white/20 p-6 rounded-xl shadow-lg space-y-4">
          <h2 className="text-2xl font-bold text-yellow-300">
            Get Involved with Burton Pride 2026
          </h2>

          <p>
            We are looking for <strong>local businesses, charities, and C.I.C.s</strong>{" "}
            to help create a vibrant and inclusive celebration.
          </p>

          <p>
            Burton Pride is a fantastic opportunity to showcase your work,
            connect with the local community, and stand proudly in support of
            equality and inclusion.
          </p>

          <p><strong>Local Businesses:</strong> Apply using the Business Form.</p>
          <p><strong>Charities &amp; C.I.C.s:</strong> Apply using the Charity Form.</p>
          <p><strong>Entertainment:</strong> Apply using the Entertainment Form.</p>

          <p>
            Questions? Contact us at{" "}
            <a
              href="mailto:prideburton@gmail.com"
              className="underline text-yellow-300"
            >
              prideburton@gmail.com
            </a>
          </p>
        </div>

        {/* Right Buttons */}
        <div className="md:w-1/2 flex flex-col justify-center gap-6 items-center">
          <button
            onClick={openBusinessForm}
            className="w-3/4 sm:w-1/2 bg-yellow-400 text-black px-8 py-4 rounded-full font-bold text-xl hover:bg-yellow-300 transition transform hover:scale-105 shadow-lg cursor-pointer"
          >
            Business Form
          </button>
          <button
            onClick={openCharityForm}
            className="w-3/4 sm:w-1/2 bg-purple-400 text-white px-8 py-4 rounded-full font-bold text-xl hover:bg-purple-300 transition transform hover:scale-105 shadow-lg cursor-pointer"
          >
            Charity Form
          </button>
          <button
            onClick={openEntertainmentForm}
            className="w-3/4 sm:w-1/2 bg-pink-500 text-white px-8 py-4 rounded-full font-bold text-xl hover:bg-pink-400 transition transform hover:scale-105 shadow-lg cursor-pointer"
          >
            Entertainment Form
          </button>
        </div>
      </motion.section>

      {/* Pricing Section */}
      <motion.section className="mt-20 w-full max-w-5xl" variants={fadeUpVariant}>
        <div className="bg-white/20 backdrop-blur-md rounded-2xl shadow-xl p-10 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-yellow-300 mb-6">
            Stall Prices for Burton Pride 2026
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full border border-white/30 rounded-xl overflow-hidden">
              <thead className="bg-white/30">
                <tr>
                  <th className="px-6 py-4 text-left text-lg font-bold">Organisation Type</th>
                  <th className="px-6 py-4 text-right text-lg font-bold">Price</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-white/20">
                  <td className="px-6 py-4 text-lg">Businesses</td>
                  <td className="px-6 py-4 text-right text-lg font-bold">£25</td>
                </tr>
                <tr className="border-t border-white/20">
                  <td className="px-6 py-4 text-lg">Food Vendor</td>
                  <td className="px-6 py-4 text-right text-lg font-bold">£95</td>
                </tr>
                <tr className="border-t border-white/20 bg-white/10">
                  <td className="px-6 py-4 text-lg">Charities &amp; C.I.C</td>
                  <td className="px-6 py-4 text-right text-lg font-bold">£10</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-6 text-white/90">
            Prices are per stall. Additional space may be available at an extra cost.
          </p>

          {/* TERMS BUTTON */}
          <div className="mt-8 flex justify-center">
            <a
              href="/BurtronPride2026/Terms"
              className="bg-white text-purple-700 px-8 py-4 rounded-full font-bold text-lg hover:bg-gray-200 transition transform hover:scale-105 shadow-lg"
            >
              View Terms & Conditions
            </a>
          </div>
        </div>
      </motion.section>

      {/* Business Modal */}
      {isBusinessModalOpen && !isMobile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            className="bg-white rounded-xl p-6 max-w-lg w-full relative"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <button
              onClick={closeBusinessModal}
              className="absolute top-3 right-3 text-black text-xl font-bold"
            >
              &times;
            </button>
            <BusinessForm />
          </motion.div>
        </div>
      )}

      {/* Charity Modal */}
      {isCharityModalOpen && !isMobile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            className="bg-white rounded-xl p-6 max-w-lg w-full relative"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <button
              onClick={closeCharityModal}
              className="absolute top-3 right-3 text-black text-xl font-bold"
            >
              &times;
            </button>
            <CharityForm />
          </motion.div>
        </div>
      )}

      {/* Entertainment Modal */}
      {isEntertainmentModalOpen && !isMobile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            className="bg-white rounded-xl p-6 max-w-lg w-full relative"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <button
              onClick={closeEntertainmentModal}
              className="absolute top-3 right-3 text-black text-xl font-bold"
            >
              &times;
            </button>
            <EntertainmentForm />
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
