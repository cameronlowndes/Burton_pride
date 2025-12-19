'use client';
import React, { useEffect } from "react";
import { useForm, ValidationError } from "@formspree/react";
import { motion } from "framer-motion";

export default function ContactForm() {
  const [state, handleSubmit] = useForm("xyzpqnrq");

  // Redirect to Thank You page on successful submission
  useEffect(() => {
    if (state.succeeded) {
      window.location.href = '/ThankYou'; // <-- your thank you page
    }
  }, [state.succeeded]);

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="max-w-md mx-auto p-8 bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border-4 border-white/30 flex flex-col gap-6 relative overflow-hidden"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {/* Animated Glow Background */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-pink-400 via-purple-500 to-blue-400 opacity-20 blur-3xl animate-pulse -z-10"></div>

      <h2 className="text-2xl font-bold mb-4 text-white drop-shadow-md text-center">Contact Us</h2>

      <label htmlFor="name" className="font-medium text-white">Name</label>
      <input
        id="name"
        type="text"
        name="name"
        placeholder="Your Name"
        required
        className="p-3 border-2 border-white/50 rounded-xl bg-white/20 placeholder-white/70 text-white focus:outline-none focus:ring-2 focus:ring-pink-400"
      />

      <label htmlFor="email" className="font-medium text-white">Email Address</label>
      <input
        id="email"
        type="email"
        name="email"
        placeholder="your@email.com"
        required
        className="p-3 border-2 border-white/50 rounded-xl bg-white/20 placeholder-white/70 text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
      />
      <ValidationError prefix="Email" field="email" errors={state.errors} className="text-yellow-300" />

      <label htmlFor="message" className="font-medium text-white">Message</label>
      <textarea
        id="message"
        name="message"
        placeholder="Write your message here..."
        required
        rows={5}
        className="p-3 border-2 border-white/50 rounded-xl bg-white/20 placeholder-white/70 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <ValidationError prefix="Message" field="message" errors={state.errors} className="text-yellow-300" />

      <motion.button
        type="submit"
        disabled={state.submitting}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {state.submitting ? 'Sending...' : 'Send Message'}
      </motion.button>
    </motion.form>
  );
}
