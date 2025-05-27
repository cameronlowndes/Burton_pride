'use client';

import { useState } from 'react';
import Image from 'next/image';
import Head from 'next/head'; 
import Link from 'next/link';
import Countdown from '../components/Countdown';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SponsorCard from '../components/SponsorCard';



const PrideEventPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');

  const openModal = (imageSrc: string) => {
    setSelectedImage(imageSrc);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      <Head>
        <title>Pride Event 2025 - Celebration of Inclusivity in Burton upon Trent</title>
        <meta
          name="description"
          content="Join the Pride Event 2025 in Burton upon Trent for a day of inclusivity, love, unity, and community spirit. Find event details, location, FAQs, and how to get involved."
        />
        <meta
          name="keywords"
          content="Pride event, Burton upon Trent, 2025, inclusivity, LGBTQ+, community, festival, parade, music, celebration, volunteer, sponsors, event schedule, FAQs, location"
        />
        <meta name="author" content="Burton Pride Event Organizers" />
        <meta property="og:title" content="Pride Event 2025 - Celebration in Burton upon Trent" />
        <meta property="og:description" content="Celebrate Pride in Burton upon Trent! Details on the 2025 event, location, schedule, and how to participate." />
      </Head>
      <main className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex flex-col items-center p-8 sm:p-16 pb-45">
        {/* Navbar */}
        <Navbar />

        {/* Hero Section */}
        <header className="text-center flex flex-col items-center gap-6 mt-16">
          <Image
            src="/image/logo.jpg"
            alt="Burton Pride Team"
            width={180}
            height={180}
            className="hero-logo"
          />
          <h1 className="text-4xl sm:text-6xl font-bold">Pride Event 2025</h1>
          <p className="text-lg sm:text-xl max-w-2xl">
          Join us for an unforgettable celebration of inclusivity, love, and unity. The Pride Event 2025 is set to be an exciting day of festivities, entertainment, and community spirit in Burton upon Trent.
          </p>
        </header>

        {/* Countdown Section */}
        <Countdown />

        {/* Map Image Section */}
        <section className="mt-15 w-full max-w-3xl text-center">
          <h2 className="text-3xl font-semibold mb-6">Event Location</h2>
          <p className="text-gray-100 mb-2">Shobnall Leisure Complex, Burton upon Trent</p>
          <div className="relative w-full h-80 sm:h-96 mb-8">
            <Image
              src="/image/PrideEventMaps.png"
              alt="Event Location Map"
              layout="fill"
              objectFit="contain"
              className="rounded-lg cursor-pointer"
              onClick={() => openModal('/image/PrideEventMaps.png')}
            />
          </div>
        </section>

        {/* Modal for Full Image View */}
        {isModalOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50"
            onClick={closeModal}
          >
            <div className="relative">
              <Image
                src={selectedImage}
                alt="Full Screen Event Map"
                width={800}
                height={600}
                objectFit="contain"
                className="rounded-lg"
              />
              <button
                className="absolute top-0 right-0 p-4 text-white bg-black rounded-full"
                onClick={closeModal}
              >
                X
              </button>
            </div>
          </div>
        )}

        {/* Frequently Asked Questions  */}
        <section className="mt-16 text-center w-full max-w-3xl mx-auto">
          <h2 className="text-3xl font-semibold text-white mb-8">Frequently Asked Questions</h2>
          <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2">
            {/* FAQ Content */}

            {/* FAQ 1 */}
            <div className="bg-white text-black p-6 rounded-lg shadow-lg transition-transform transform hover:scale-105 hover:shadow-xl">
              <h3 className="text-xl font-semibold mb-4 text-purple-600">Where is it taking place?</h3>

              {/* Add Image here */}
              <div className="mb-4">
                <Image
                  src="/image/map.png"
                  alt="Event Location"
                  width={300}
                  height={200}
                  className="rounded-lg"
                />
              </div>

              <p className="text-gray-800 mb-4">
                Shobnall Leisure Complex, playing fields, Shobnall Road, Burton upon Trent, DE14 2BD.
              </p>

              <Link
                href="https://www.google.com/maps/place/Shobnall+playground/@52.8108643,-1.655556,17z/data=!4m6!3m5!1s0x487a030014617b63:0x25121006d076155c!8m2!3d52.8098284!4d-1.656821!16s%2Fg%2F11vxx79hmm?entry=ttu&g_ep=EgoyMDI1MDUxMi4wIKXMDSoJLDEwMjExNDUzSAFQAw%3D%3D" // Replace with actual Google Maps link
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-full transition duration-300 ease-in-out"
              >
                View on Map
              </Link>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white text-black p-6 rounded-lg shadow-lg transition-transform transform hover:scale-105 hover:shadow-xl">
              <h3 className="text-xl font-semibold mb-4 text-purple-600">Can I bring my dog?</h3>
              <p className="text-gray-800">
                All of my four-legged doggy friends are now welcome at Burton Pride.
                Please ensure you follow our doggy rules, or our steward or surety will ask you and your owner to leave. This is so everyone can enjoy the event.
                <br />
                <br />
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
            <div className="bg-white text-black p-6 rounded-lg shadow-lg transition-transform transform hover:scale-105 hover:shadow-xl">
              <h3 className="text-xl font-semibold mb-4 text-purple-600">What can I bring to the event?</h3>
              <p className="text-gray-800">
                Only sealed soft drinks are permitted within the arena. Picnic blankets and camping chairs are welcome. Only food and alcoholic beverages purchased within the arena may be consumed.
                <br />
                <br />
                <span className="font-semibold">1. </span> Please be prepared for your bags to be searched upon entry to the arena. Security teams are currently conducting searches.
                <br />
                <span className="font-semibold">2. </span> Due to licensing conditions, alcohol and food purchased outside the arena will be confiscated and disposed of.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white text-black p-6 rounded-lg shadow-lg transition-transform transform hover:scale-105 hover:shadow-xl">
              <h3 className="text-xl font-semibold mb-4 text-purple-600">Will alcohol be served?</h3>
              <p className="text-gray-800">Yes! Alcohol will be served at Burton Pride, and we operate a Challenge 25 policy. This means that if you appear to be under 25, you may be asked to show ID when purchasing alcohol. Please ensure you have a valid form of identification with you if you wish to buy alcohol.</p>
            </div>

            {/* FAQ 5 */}
            <div className="bg-white text-black p-6 rounded-lg shadow-lg transition-transform transform hover:scale-105 hover:shadow-xl">
              <h3 className="text-xl font-semibold mb-4 text-purple-600">Will food be available?</h3>
              <p className="text-gray-800">You bet! We have a wide range of fantastic food vendors, ensuring you won’t go hungry. And for those who are thirsty, we've got you covered too!</p>
            </div>

            {/* FAQ 6 */}
            <div className="bg-white text-black p-6 rounded-lg shadow-lg transition-transform transform hover:scale-105 hover:shadow-xl">
              <h3 className="text-xl font-semibold mb-4 text-purple-600">Where can I park?</h3>
              <p className="text-gray-800 mb-4">
                We encourage attendees to walk or use public transportation to the event. Please see our ‘Plan Your Visit’ page for car parking details.
              </p>

              <Link
                href="/Pride2025/PlanForYourVist"
                className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-full transition duration-300 ease-in-out"
              >
                Plan Your Visit
              </Link>
            </div>

            {/* FAQ 7 */}
            <div className="bg-white text-black p-6 rounded-lg shadow-lg transition-transform transform hover:scale-105 hover:shadow-xl">
              <h3 className="text-xl font-semibold mb-4 text-purple-600">Will Security and medical staff be present?</h3>
              <p className="text-gray-800">SIA-trained security professionals and medically trained staff will be present all day to ensure the safety of all attendees. Should you need to speak with somebody, you can speak to a steward in hi-visibility who will be connected to all staff via radio or at the Security and medical point.</p>
            </div>
          </div>
        </section>

        {/* Get Involved Section */}
        <section className="mt-16 text-center w-full max-w-3xl">
          <h2 className="text-3xl font-semibold mb-6">Get Involved</h2>
          <p className="text-lg text-gray-100 mb-4">We welcome volunteers to help with the event. Sign up to support and be part of the pride celebration!</p>
          <Link
            href="https://forms.gle/oFteosGZ9sJPQR6T9"
            className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-full transition duration-300 ease-in-out"
            target="_blank"
            rel="noopener noreferrer"
          >
            Volunteer Now
          </Link>
        </section>



        {/* Sponsors Section */}
        <section className="mt-16 text-center w-full max-w-3xl">
          <h2 className="text-3xl font-semibold mb-6">Our Proud Sponsors</h2>
          <div className="flex flex-col sm:flex-row justify-center space-y-6 sm:space-y-0 sm:space-x-8">
            {/* Just Importing SponsorCard here */}
            <SponsorCard />
          </div>
        </section>

        {/* Footer */}
        <Footer />
      </main>
    </>
  );
};

export default PrideEventPage;