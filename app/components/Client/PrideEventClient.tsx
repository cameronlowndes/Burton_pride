'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import Countdown from '../Card/message';
import SponsorCard from '../../components/Card/SponsorCard';
import React from 'react';

export default function PrideEventClient() {
  return (
    <motion.main
      className="min-h-screen bg-gradient-to-r animate-gradient text-white flex flex-col items-center px-10 sm:px-20 py-24 space-y-16"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: 0.25 },
        },
      }}
    >
      {/* Hero Section */}
      <motion.header
        className="text-center flex flex-col items-center gap-6 max-w-4xl"
        variants={{
          hidden: { opacity: 0, y: 40 },
          visible: { opacity: 1, y: 0 },
        }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
          className="rounded-full overflow-hidden w-[220px] h-[220px] shadow-xl shadow-pink-300/50"
        >
          <Image
            src="/image/logo.jpg"
            alt="Burton Pride Team"
            width={220}
            height={220}
            className="object-cover w-full h-full rounded-full"
          />
        </motion.div>

        <motion.h1
          className="text-6xl sm:text-7xl font-bold text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.7)]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          Pride Event 2025
        </motion.h1>
        <motion.p
          className="text-xl sm:text-2xl max-w-3xl text-white/90 leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          Join us for an unforgettable celebration of inclusivity, love, and unity. The Pride Event 2025 is set to be an exciting day of festivities, entertainment, and community spirit in Burton upon Trent.
        </motion.p>
      </motion.header>

      {/* Countdown */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="w-full max-w-5xl flex justify-center"
      >
        <Countdown />
      </motion.div>

      {/* Map Section */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
        className="w-full max-w-6xl"
      >
        {/* <EventMapWithModal /> */}
      </motion.section>

      {/* Support Section */}
      <motion.section
        className="text-center w-full max-w-4xl space-y-6"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
      >
        <h2 className="text-4xl font-semibold text-white drop-shadow mb-2">Support Burton Pride</h2>
        <p className="text-lg sm:text-xl text-white/90 leading-relaxed">
          Help us bring the best Pride event to Burton! Your donation supports community initiatives, parade organisation, and inclusivity programs. Every contribution makes a difference! 🌈
        </p>
        <Link
          href="https://www.gofundme.com/f/raising-funds-for-burton-pride?qid=63f32d4ac52a110d1d8046124f523f48"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-yellow-400 text-black px-8 py-4 rounded-full font-semibold text-xl hover:bg-yellow-300 transition shadow-md hover:shadow-yellow-400/70 inline-block"
        >
          Donate Now
        </Link>
      </motion.section>

      {/* FAQ Section */}
      <motion.section
        className="text-center w-full max-w-5xl mx-auto"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.4 }}
      >
        <h2 className="text-4xl font-semibold text-white mb-10">Frequently Asked Questions</h2>
        <div className="grid gap-8 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2">

          {/* FAQ 1 */}
          <div className="bg-white text-black p-8 rounded-lg shadow-lg transition-transform transform hover:scale-105 hover:shadow-xl">
            <h3 className="text-2xl font-semibold mb-6 text-purple-600">Where is it taking place?</h3>
            <div className="mb-6">
              <Image
                src="/image/PrideEvent/map.png"
                alt="Event Location"
                width={350}
                height={230}
                className="rounded-lg"
              />
            </div>
            <p className="text-gray-800 mb-6 text-lg">
              Shobnall Leisure Complex, playing fields, Shobnall Road, Burton upon Trent, DE14 2BD.
            </p>
            <Link
              href="https://www.google.com/maps/place/Shobnall+playground/@52.8108643,-1.655556,17z/data=!4m6!3m5!1s0x487a030014617b63:0x25121006d076155c!8m2!3d52.8098284!4d-1.656821!16s%2Fg%2F11vxx79hmm?entry=ttu"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-full transition duration-300 ease-in-out"
            >
              View on Map
            </Link>
          </div>

          {/* FAQ 10 */}
          <div className="bg-white text-black p-8 rounded-lg shadow-lg transition-transform transform hover:scale-105 hover:shadow-xl">
            <h3 className="text-2xl font-semibold mb-6 text-purple-600">Are children welcome?</h3>
            <p className="text-gray-800 text-lg leading-relaxed">
              We encourage families to attend Pride. Children under 16 must be accompanied at all times by an adult.

            </p>
          </div>



          {/* FAQ 2 */}
          <div className="bg-white text-black p-8 rounded-lg shadow-lg transition-transform transform hover:scale-105 hover:shadow-xl">
            <h3 className="text-2xl font-semibold mb-6 text-purple-600">Can I bring my dog?</h3>
            <p className="text-gray-800 text-lg leading-relaxed">
              All of my four-legged doggy friends are now welcome at Burton Pride.
              Please ensure you follow our doggy rules, or our steward or security will ask you and your owner to leave. This is so everyone can enjoy the event.
              <br /><br />
              <span className="font-semibold">1. </span> Please keep your dog on the lead and make sure they don't wander off.
              <br />
              <span className="font-semibold">2. </span> Ensure all toilet matter is cleaned and disposed of in the bins around the site.
              <br />
              <span className="font-semibold">3. </span> We cannot provide drinking water around the site, so please ensure you bring water with you to drink.
              <br />
              <span className="font-semibold">4. </span> Please play nicely with other dogs that may attend the event. (Set a good example for the humans.)
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="bg-white text-black p-8 rounded-lg shadow-lg transition-transform transform hover:scale-105 hover:shadow-xl">
            <h3 className="text-2xl font-semibold mb-6 text-purple-600">What can I bring to the event?</h3>
            <p className="text-gray-800 text-lg leading-relaxed">
              Only sealed soft drinks are permitted within the arena. Picnic blankets and camping chairs are welcome. Only food and alcoholic beverages purchased within the arena may be consumed.
              <br /><br />
              <span className="font-semibold">1. </span> Please be prepared for your bags to be searched upon entry to the arena. Security teams are currently conducting searches.
              <br />
              <span className="font-semibold">2. </span> Due to licensing conditions, alcohol and food purchased outside the arena will be confiscated and disposed of.
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="bg-white text-black p-8 rounded-lg shadow-lg transition-transform transform hover:scale-105 hover:shadow-xl">
            <h3 className="text-2xl font-semibold mb-6 text-purple-600">Will alcohol be served?</h3>
            <p className="text-gray-800 text-lg leading-relaxed">
              Yes! Alcohol will be served at Burton Pride, and we operate a Challenge 25 policy. This means that if you appear to be under 25, you may be asked to show ID when purchasing alcohol. Please ensure you have a valid form of identification with you if you wish to buy alcohol.
            </p>
          </div>

          {/* FAQ 5 */}
          <div className="bg-white text-black p-8 rounded-lg shadow-lg transition-transform transform hover:scale-105 hover:shadow-xl">
            <h3 className="text-2xl font-semibold mb-6 text-purple-600">Will food be available?</h3>
            <p className="text-gray-800 text-lg leading-relaxed">
              You bet! We have a wide range of fantastic food vendors offering something for everyone, from delicious street food to tasty treats that will satisfy every craving — so you definitely won’t go hungry. And for those feeling thirsty, there’s plenty of refreshing drinks available to keep you cool and hydrated throughout the day. Whether you’re after a quick snack or a full meal, Burton Pride has you covered!
            </p>
          </div>

          {/* FAQ 6 */}
          <div className="bg-white text-black p-8 rounded-lg shadow-lg transition-transform transform hover:scale-105 hover:shadow-xl">
            <h3 className="text-2xl font-semibold mb-6 text-purple-600">What about Human Pups and Furries?</h3>
            <p className="text-gray-800 text-lg leading-relaxed">
              At Burton Pride, we’re thrilled to welcome everyone in our community. Whether you’re part of a Human pack or a Furry, your presence adds something unique and special to the event. Please be mindful and respectful of other visitors, as this might be their first time encountering Furries or Human Pups.
            </p>
            <div className="mt-4 space-y-2 text-gray-800 text-lg leading-relaxed">
              <p>Keep it covered.</p>
              <p>Keep it clean.</p>
              <p>Keep it family-friendly.</p>
              <p>Rawoo!</p>
            </div>
          </div>

          {/* FAQ 7 */}
          <div className="bg-white text-black p-8 rounded-lg shadow-lg transition-transform transform hover:scale-105 hover:shadow-xl">
            <h3 className="text-2xl font-semibold mb-6 text-purple-600">Do I need to buy a ticket?</h3>
            <p className="text-gray-800 text-lg leading-relaxed">
              No need to worry about tickets — Burton Pride is completely free and open to everyone!
              We’re able to keep it that way thanks to the support of our amazing sponsors and generous public donations.
              If you'd like to help, you can donate via our GoFundMe page.
            </p>
            <Link
              href="https://www.gofundme.com/f/raising-funds-for-burton-pride?qid=63f32d4ac52a110d1d8046124f523f48"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-full transition duration-300 ease-in-out mt-4"
            >
              GoFundMe page
            </Link>
          </div>

          {/* FAQ 8 */}
          <div className="bg-white text-black p-8 rounded-lg shadow-lg transition-transform transform hover:scale-105 hover:shadow-xl">
            <h3 className="text-2xl font-semibold mb-6 text-purple-600">Where can I park?</h3>
            <p className="text-gray-800 mb-6 text-lg leading-relaxed">
              We encourage attendees to walk or use public transportation to the event. Please see our ‘Plan Your Visit’ page for car parking details.
            </p>
            <Link
              href="/PlanYourVist"
              className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-full transition duration-300 ease-in-out"
            >
              Plan Your Visit
            </Link>
          </div>

           {/* FAQ 9 */}
          <div className="bg-white text-black p-8 rounded-lg shadow-lg transition-transform transform hover:scale-105 hover:shadow-xl">
            <h3 className="text-2xl font-semibold mb-6 text-purple-600">How do I make a complaint?</h3>
            <p className="text-gray-800 mb-6 text-lg leading-relaxed">
              If you wish to send a complaint or feedback, please email prideburton@gmail.com We will aim to respond to complaints within 28 days, with a further 28-day extension added if a more in-depth investigation is required. 
              Please note that complaints over social media are not monitored.

            </p>
           <a
                    href="mailto:burtonpride@gmail.com?subject=Inquiry&body=Hello, I would like to inquire about..."
                    className="bg-white text-pink-600 px-8 py-4 rounded-full font-semibold text-lg shadow-lg hover:bg-gray-100 transition duration-300 ease-in-out mb-10 inline-block"
                    aria-label="Send an email to Burton Pride"
                >
                    📧 Send Us an Email
                </a>
          </div>

        </div>
      </motion.section>

      {/* Get Involved Section */}
      <motion.section
        className="text-center w-full max-w-4xl"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.6 }}
      >
        <h2 className="text-4xl font-semibold mb-6">Get Involved</h2>
        <p className="text-xl text-gray-100 mb-6 leading-relaxed">
          We welcome volunteers to help with the event. Sign up to support and be part of the pride celebration!
        </p>
        <Link
          href="https://forms.gle/oFteosGZ9sJPQR6T9"
          className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-8 rounded-full transition duration-300 ease-in-out"
          target="_blank"
          rel="noopener noreferrer"
        >
          Volunteer Now
        </Link>
      </motion.section>

      {/* Sponsors Section */}
      <motion.section
        className="text-center w-full max-w-4xl"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.8 }}
      >
        <h2 className="text-4xl font-semibold mb-6">Our Proud Sponsors</h2>
        <div className="flex flex-col sm:flex-row justify-center space-y-8 sm:space-y-0 sm:space-x-12">
          <SponsorCard />
        </div>
      </motion.section>
    </motion.main>
  );
}
