'use client';

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

const Countdown = () => {
  // 🎯 Target date: 27 June 2026, 12:00 PM UK time (BST = UTC+1)
  const targetDate = new Date("2026-06-27T11:00:00Z"); // 11:00 UTC = 12:00 BST
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const distance = targetDate.getTime() - now.getTime();

      if (distance <= 0) {
        clearInterval(interval);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      } else {
        setTimeLeft({
          days: Math.floor(distance / (1000 * 60 * 60 * 24)),
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000),
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <section
      id="countdown"
      className="mt-16 text-center w-full max-w-4xl mx-auto px-6 py-10 rounded-2xl bg-gradient-to-br from-purple-700 via-pink-600 to-yellow-400 text-white shadow-2xl relative overflow-hidden"
    >
      {/* Rainbow animated background overlay */}
      <div className="absolute inset-0 bg-[conic-gradient(from_180deg,red,orange,yellow,green,blue,indigo,violet,red)] opacity-20 blur-2xl animate-spin-slow"></div>

      <div className="relative z-10">
        <h2 className="text-4xl sm:text-5xl font-extrabold mb-6 drop-shadow-lg">
          🌈 Countdown to <span className="text-yellow-300">Burton Pride 2026</span>
        </h2>

        <p className="text-lg mb-8 font-medium text-white/90">
          Time remaining until the Pride Event kicks off 🎉
        </p>

        {/* Countdown grid */}
        <div className="flex flex-wrap justify-center items-center gap-6">
          {[
            { label: "Days", value: timeLeft.days },
            { label: "Hours", value: timeLeft.hours },
            { label: "Minutes", value: timeLeft.minutes },
            { label: "Seconds", value: timeLeft.seconds },
          ].map((item, index) => (
            <motion.div
              key={index}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="bg-white/20 backdrop-blur-lg p-6 rounded-2xl shadow-lg min-w-[100px]"
            >
              <motion.span
                key={item.value}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="block text-5xl font-bold text-yellow-300"
              >
                {item.value}
              </motion.span>
              <span className="block text-sm font-semibold tracking-wide uppercase text-white">
                {item.label}
              </span>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-8 text-lg font-semibold text-black bg-yellow-300 px-6 py-3 rounded-full shadow-md inline-block animate-pulse"
        >
          🎉 Free Event – Everyone’s Welcome!
        </motion.div>
      </div>
    </section>
  );
};

export default Countdown;