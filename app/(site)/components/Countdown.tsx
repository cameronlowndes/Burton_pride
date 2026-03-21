"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

type CountdownRow = {
  id: string;
  enabled: boolean;
  title: string;
  subtitle: string;
  target_date: string;
  event_message: string | null;
  show_event_message: boolean;
  updated_at: string;
};

export default function Countdown() {
  const [countdown, setCountdown] = useState<CountdownRow | null>(null);
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    let active = true;

    fetch("/api/countdown", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data?.ok && data?.countdown) {
          setCountdown(data.countdown);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!countdown?.target_date) return;

    const targetDate = new Date(countdown.target_date);

    const updateCountdown = () => {
      const now = new Date();
      const distance = targetDate.getTime() - now.getTime();

      if (distance <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000),
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [countdown]);

  if (!countdown || !countdown.enabled) return null;

  return (
    <section
      id="countdown"
      className="mt-16 text-center w-full max-w-4xl mx-auto px-6 py-10 rounded-2xl bg-gradient-to-br from-purple-700 via-pink-600 to-yellow-400 text-white shadow-2xl relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-[conic-gradient(from_180deg,red,orange,yellow,green,blue,indigo,violet,red)] opacity-20 blur-2xl animate-spin-slow" />

      <div className="relative z-10">
        <h2 className="text-4xl sm:text-5xl font-extrabold mb-6 drop-shadow-lg">
          {countdown.title}
        </h2>

        <p className="text-lg mb-8 font-medium text-white/90">
          {countdown.subtitle}
        </p>

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

        {countdown.show_event_message && countdown.event_message ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-8 text-lg font-semibold text-black bg-yellow-300 px-6 py-3 rounded-full shadow-md inline-block animate-pulse"
          >
            {countdown.event_message}
          </motion.div>
        ) : null}
      </div>
    </section>
  );
}