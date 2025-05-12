import Image from "next/image";
import Link from "next/link";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import EventCard from "./components/EventCard";
import Countdown from "./components/Countdown";
import MetaHead from "./components/MetaHead";

export const metadata = {
  title: "Burton Pride - Events",
  description: "Learn more about Burton Pride, our mission, and how to get involved.",
};

export default function Home() {
  return (
    <>
      {/* MetaHead Component for SEO */}
      <MetaHead
        title="Burton Pride - Home"
        description="Stay updated on all the exciting events hosted by Burton Pride, including the Pride Event, community gatherings, and more. Join us to celebrate diversity and inclusivity!"
        keywords="Burton Pride, Pride events, LGBTQ+ events, community events, Pride Parade, inclusivity, diversity"
      />

      <div className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex flex-col items-center p-8 sm:p-16 pb-24">
        <Navbar />

        {/* Hero Section */}
        <section className="text-center flex flex-col items-center gap-6 mt-16 animate-fadeInUp flex-grow">
          <Image
            src="/image/logo.jpg"
            alt="Burton Pride Logo"
            width={180}
            height={180}
            className="hero-logo animate-scaleUp"
          />
          <h1 className="text-4xl sm:text-6xl font-bold hero-title animate-fadeInUp delay-100">
            Welcome to Burton Pride
          </h1>
          <p className="text-lg sm:text-xl max-w-2xl hero-description animate-fadeInUp delay-200">
            Celebrating diversity, inclusion, and love in the heart of Burton. Join us in making a difference!
          </p>
        </section>

        {/* Countdown Section */}
        <Countdown />

        {/* Support Section */}
        <section className="mt-16 text-center w-full max-w-3xl">
          <h2 className="text-3xl font-semibold mb-4">Support Burton Pride</h2>
          <p className="text-lg mb-6">
            Help us bring the best Pride event to Burton! Your donation supports
            community initiatives, parade organisation, and inclusivity programs.
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

        {/* Social Buttons Section */}
        <section className="mt-8 text-center w-full">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {/* Facebook Button */}
            <Link
              href="https://www.facebook.com/profile.php?id=61556621159422"
              target="_blank"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-full text-lg font-semibold shadow-md hover:bg-blue-500 transition"
            >
              Follow us on Facebook
            </Link>

            {/* Instagram Button */}
            <Link
              href="https://www.instagram.com/prideburton/"
              target="_blank"
              className="inline-block bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 text-white px-6 py-3 rounded-full text-lg font-semibold shadow-md hover:opacity-90 transition"
            >
              Follow us on Instagram
            </Link>
          </div>
        </section>

        {/* Collaborate Section */}
        <section className="mt-16 text-center w-full max-w-3xl flex-grow">
          <h2 className="text-3xl font-semibold mb-4">Collaborate with Us</h2>
          <p className="text-lg mb-6">
            We’re always looking for like-minded businesses, organizations, and
            individuals who want to support our mission of inclusivity and
            equality.
          </p>
          <Link
            href="/Collaborate"
            className="bg-green-500 text-white px-6 py-3 rounded-full font-semibold text-lg hover:bg-green-400 transition"
          >
            Learn More
          </Link>
      
        <div  className="mt-16 text-center w-full max-w-3xl flex-grow">
          <Link href="https://forms.gle/taZ16ioQBXvEX7sE8" passHref>
            <button className="bg-green-500 text-white px-6 py-3 rounded-full font-semibold text-lg hover:bg-green-400 transition">
              Vendor Booking
            </button>
          </Link>
        </div>
        </section>


        {/* Events Section */}
        <section id="events" className="mt-16 text-center w-full flex flex-col items-center max-w-6xl">
          <h2 className="text-3xl font-semibold mb-6">Upcoming Events</h2>
          <div className="flex flex-wrap justify-center gap-6">
            {/* EventCard components */}
            <EventCard />
            {/* More EventCard components can be added here */}
          </div>
        </section>

        {/* Footer */}
        <Footer />
      </div>
    </>
  );
}
