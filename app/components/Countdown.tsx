// components/Countdown.tsx
'use client'; // Add this line to mark this as a client component

import React, { useEffect, useState } from "react";

const Countdown = () => {
  const targetDate = new Date("2025-08-16T00:00:00Z"); // Target date for the Pride Event
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const distance = targetDate.getTime() - now.getTime(); // Ensure both are in milliseconds

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

    return () => clearInterval(interval); // Cleanup the interval on component unmount
  }, []);

  return (
    <section id="countdown" className="mt-16 text-center w-full max-w-4xl">
      <h2 className="text-3xl font-semibold mb-6">Countdown to Pride Parade</h2>
      <div className="bg-white text-black p-6 rounded-lg shadow-md">
        <p className="text-lg mb-4">Time remaining until the Pride Parade on August 16, 2025:</p>
        <div className="flex justify-center items-center space-x-6">
          <div className="text-xl font-semibold">
            <span className="block text-3xl">{timeLeft.days}</span>
            <span className="text-sm">Days</span>
          </div>
          <div className="text-xl font-semibold">
            <span className="block text-3xl">{timeLeft.hours}</span>
            <span className="text-sm">Hours</span>
          </div>
          <div className="text-xl font-semibold">
            <span className="block text-3xl">{timeLeft.minutes}</span>
            <span className="text-sm">Minutes</span>
          </div>
          <div className="text-xl font-semibold">
            <span className="block text-3xl">{timeLeft.seconds}</span>
            <span className="text-sm">Seconds</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Countdown;
