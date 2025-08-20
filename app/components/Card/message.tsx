'use client';

import React from "react";

const Message = () => {
  return (
    <section
      id="message"
      className="mt-10 px-4 sm:px-6"
    >
      {/* Heading */}
      <h2 className="text-center text-3xl sm:text-5xl font-extrabold mb-8 bg-gradient-to-r text-white bg-clip-text text-transparent drop-shadow-md">
        Burton Pride 2025
      </h2>

      {/* Main container */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-6xl mx-auto w-full">
        {/* Block 1 */}
        <div className="bg-white/90 backdrop-blur-md text-black p-6 sm:p-10 rounded-2xl shadow-xl border-l-4 border-pink-500">
          <p className="text-lg sm:text-xl leading-relaxed">
            🌈 All of us at <b>Burton Pride</b> want to say a{" "}
            <span className="font-bold text-pink-600">huge thank you</span> to everyone who
            has helped make this event possible. From our amazing volunteers and
            local businesses to community groups, sponsors, and every single
            person who has supported us – we couldn’t have done this without
            you.
          </p>
        </div>

        {/* Block 2 */}
        <div className="bg-white/90 backdrop-blur-md text-black p-6 sm:p-10 rounded-2xl shadow-xl border-l-4 border-yellow-400">
          <p className="text-lg sm:text-xl leading-relaxed">
            A special thank you goes to the <b>Burton Pride Committee</b>, whose
            passion, dedication, and countless hours of hard work have brought
            this vision to life. Behind the scenes, the committee has worked
            tirelessly to plan, organise, and create an event that celebrates
            love, diversity, and inclusion for all.
          </p>
        </div>

        {/* Block 3 (full row) */}
        <div className="bg-white/90 backdrop-blur-md text-black p-6 sm:p-10 rounded-2xl shadow-xl border-l-4 border-indigo-500 sm:col-span-2">
          <p className="text-lg sm:text-xl leading-relaxed">
            Your energy, kindness, and commitment to inclusivity are what make
            Burton Pride so special. Together, we’ve built more than just an
            event – we’ve created a safe space filled with love, unity, and
            celebration for the whole community. 💖
          </p>
        </div>
      </div>

      {/* Full-width highlight banner */}
      <div className="mt-10 max-w-6xl mx-auto w-full bg-yellow-300 text-black text-lg sm:text-2xl font-bold px-6 sm:px-10 py-6 rounded-2xl shadow-lg text-center animate-pulse">
        🌟 Each and every one of you – our supporters, volunteers, and
        committee members – is truly amazing. Thank you for standing with
        Pride!
      </div>
    </section>
  );
};

export default Message;
