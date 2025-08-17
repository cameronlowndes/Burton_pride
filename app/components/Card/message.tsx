'use client';

import React from "react";

const Mesage = () => {
  return (
    <section
      id="countdown"
      className="mt-16 flex justify-center items-center px-4"
    >
      <div className="text-center w-full max-w-4xl">
        <h2 className="text-3xl font-semibold mb-6">Burton Pride 2025</h2>
        <div className="bg-white text-black p-6 rounded-lg shadow-md">
          <p className="text-lg mb-4 leading-relaxed">
            🌈 All of us at <b>Burton Pride</b> want to say a{" "}
            <span className="font-bold">huge thank you</span> to everyone who
            has helped make this event possible. From our amazing volunteers and
            local businesses to community groups, sponsors, and every single
            person who has supported us – we couldn’t have done this without
            you.
          </p>
          <p className="text-lg mb-4 leading-relaxed">
            A special thank you goes to the <b>Burton Pride Committee</b>, whose
            passion, dedication, and countless hours of hard work have brought
            this vision to life. Behind the scenes, the committee has worked
            tirelessly to plan, organise, and create an event that celebrates
            love, diversity, and inclusion for all.
          </p>
          <p className="text-lg mb-4 leading-relaxed">
            Your energy, kindness, and commitment to inclusivity are what make
            Burton Pride so special. Together, we’ve built more than just an
            event – we’ve created a safe space filled with love, unity, and
            celebration for the whole community. 💖
          </p>
          <div className="mt-4 bg-yellow-300 text-black text-base font-bold px-4 py-2 rounded shadow animate-pulse">
            🌟 Each and every one of you – our supporters, volunteers, and
            committee members – is truly amazing. Thank you for standing with
            Pride!
          </div>
        </div>
      </div>
    </section>
  );
};

export default Mesage;
