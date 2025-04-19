// components/Countdown.tsx
'use client';

import React, { useEffect, useState } from "react";

const Countdown = () => {
  const targetDate = new Date("2025-08-16T11:00:00Z");
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
    <section id="countdown" className="mt-16 text-center w-full max-w-4xl">
      <h2 className="text-3xl font-semibold mb-6">Countdown to Pride Event</h2>
      <div className="bg-white text-black p-6 rounded-lg shadow-md">
        <p className="text-lg mb-4">Time remaining until the Pride Event on August 16, 2025 at 12.pm:</p>
        <div className="flex justify-center items-center space-x-6 mb-6">
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
        {/* Button for tickets */}
        <a
          href="https://www.eventbrite.com/e/pride-event-tickets-1316358476639?aff=oddtdtcreator" 
          className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-full transition duration-300 ease-in-out"
        >
          Get Your Tickets
        </a>
      </div>
    </section>
  );
};

export default Countdown;
