'use client';

import { motion } from "framer-motion";
import Link from "next/link";

export default function UpdateClient() {
  return (
    <motion.main
      className="relative min-h-screen bg-gradient-to-br flex flex-col items-center justify-center px-6 py-24 text-center text-white overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
    >
      {/* Glowing Animated Background Circles */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-purple-500/30 blur-3xl animate-pulse"></div>
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-yellow-400/30 blur-3xl animate-pulse"></div>
      <div className="absolute top-1/2 left-1/2 w-72 h-72 rounded-full bg-pink-500/20 blur-2xl animate-spin-slow -translate-x-1/2 -translate-y-1/2"></div>

      {/* Title */}
      <motion.h1
        className="text-5xl sm:text-6xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.7)] animate-pulse"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 1 }}
      >
        🚨 Important Update 🚨
      </motion.h1>

      {/* Message */}
      <motion.p
        className="relative z-10 text-lg sm:text-xl max-w-3xl bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-[0_8px_30px_rgba(0,0,0,0.5)] border border-white/20 animate-fadeIn"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 1 }}
      >
        This page has <span className="font-bold text-yellow-300">moved!</span> 🎉  
        <br />
        Please check back regularly for the latest announcements, news, and event updates from{" "}
        <span className="font-bold text-yellow-400">Burton Pride</span>.
      </motion.p>

      {/* Sparkle Overlay */}
      <div className="pointer-events-none absolute inset-0">
        {Array.from({ length: 30 }).map((_, i) => (
          <span
            key={i}
            className={`absolute w-2 h-2 bg-white rounded-full opacity-70 animate-float`}
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
            }}
          ></span>
        ))}
      </div>

      {/* Button back to Home */}
      <motion.div
        className="mt-12 z-10"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.8 }}
      >
        <Link
          href="/"
          className="relative inline-block bg-gradient-to-r from-yellow-300 via-pink-400 to-purple-500 text-black px-10 py-4 rounded-full font-bold text-lg shadow-lg shadow-white/50 hover:shadow-[0_0_25px_rgba(255,255,255,0.8)] transition transform hover:scale-110 animate-bounce"
        >
          ⬅ Go Back Home
          <span className="absolute top-0 left-0 w-full h-full rounded-full bg-white/20 opacity-0 hover:opacity-30 transition"></span>
        </Link>
      </motion.div>

      <style jsx>{`
        .animate-spin-slow {
          animation: spin 20s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .animate-fadeIn {
          animation: fadeIn 1.2s ease forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite alternate;
        }
        @keyframes float {
          0% { transform: translateY(0); opacity: 0.6; }
          100% { transform: translateY(-20px); opacity: 1; }
        }
      `}</style>
    </motion.main>
  );
}
