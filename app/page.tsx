import Image from "next/image";
import Navbar from "./Navbar";
import Footer from "./Footer";
import Link from 'next/link';


export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex flex-col items-center p-8 sm:p-16">

      <Navbar />
      {/* Hero Section */}
      <header className="text-center flex flex-col items-center gap-6 mt-16">
        <Image
          src="/image/logo.jpg"
          alt="Burton Pride Logo"
          width={180}
          height={180}
          className="hero-logo"
        />
        <h1 className="text-4xl sm:text-6xl font-bold hero-title">
          Welcome to Burton Pride
        </h1>
        <p className="text-lg sm:text-xl max-w-2xl hero-description">
          Celebrating diversity, inclusion, and love in the heart of Burton. Join us in making a difference!
        </p>
        <a
          href="events"
          className="bg-white text-pink-600 px-6 py-3 rounded-full font-semibold text-lg hover:bg-opacity-80 transition hero-button"
        >
          Explore Events
        </a>
      </header>

      {/* Events Section */}
      <section id="events" className="mt-16 text-center w-full max-w-4xl">
        <h2 className="text-3xl font-semibold mb-6">Upcoming Events</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="bg-white text-black p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-bold">Pride Parade</h3>
            <p className="text-sm">Join us for a vibrant celebration in the streets of Burton! 🏳️‍🌈</p>
            <span className="text-pink-600 font-semibold">June 15, 2025</span>
          </div>
          <div className="bg-white text-black p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-bold">Community Picnic</h3>
            <p className="text-sm">Enjoy a day of fun, music, and connection with fellow supporters.</p>
            <span className="text-pink-600 font-semibold">July 20, 2025</span>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
