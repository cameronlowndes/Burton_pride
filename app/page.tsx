import Image from "next/image";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Link from "next/link";
import EventCard from "./components/EventCard"; 
import Countdown from "./components/Countdown";
import Head from "next/head";

export default function Home() {
  return (
    <>
      <Head>
        <title>Burton Pride | Home</title>
        <meta
          name="description"
          content="Join Burton Pride and celebrate diversity, inclusion, and love in the heart of Burton."
        />
        <meta name="keywords" content="Burton Pride, LGBTQ+, diversity, events, inclusivity" />
        <meta name="author" content="Burton Pride" />
      </Head>
      
      <div className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex flex-col items-center p-8 sm:p-16 pb-24">
        
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
          <h1 className="text-4xl sm:text-6xl font-bold">Welcome to Burton Pride</h1>
          <p className="text-lg sm:text-xl max-w-2xl">
            Celebrating diversity, inclusion, and love in the heart of Burton. Join us in making a difference!
          </p>
          <Link 
            href="/events" 
            className="bg-white text-pink-600 px-6 py-3 rounded-full font-semibold text-lg hover:bg-opacity-80 transition"
          >
            Explore Events
          </Link>
        </header>

        <Countdown />

        {/* GoFundMe Section */}
        <section className="mt-16 text-center w-full max-w-3xl">
          <h2 className="text-3xl font-semibold mb-4">Support Burton Pride</h2>
          <p className="text-lg mb-6">
            Help us bring the best Pride event to Burton! Your donation supports community initiatives, parade organization, and inclusivity programs. 
            Every contribution makes a difference! 🌈
          </p>
          <Link 
            href="https://www.gofundme.com/f/raising-funds-for-burton-pride?qid=63f32d4ac52a110d1d8046124f523f48" 
            target="_blank"
            className="bg-yellow-400 text-black px-6 py-3 rounded-full font-semibold text-lg hover:bg-yellow-300 transition"
          >
            Donate Now
          </Link>
        </section>

        {/* Events Section */}
        <section id="events" className="mt-16 text-center w-full max-w-4xl">
          <h2 className="text-3xl font-semibold mb-6">Upcoming Events</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <EventCard />
          </div>
        </section>

        <Footer />
      </div>
    </>
  );
}
