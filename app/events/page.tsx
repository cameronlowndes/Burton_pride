import Countdown from "../components/Countdown";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import Link from "next/link";
import Image from "next/image"; // Import Image component from Next.js
import EventCard from "../components/EventCard";
import MetaHead from "../components/MetaHead"; // Import MetaHead

export const metadata = {
  title: "Burton Pride - Events",
  description: "Learn more about Burton Pride, our mission, and how to get involved.",
};

export default function EventsPage() {
  return (
    <>
      {/* Use the MetaHead component here */}
      <MetaHead
        title="Burton Pride - Events"
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
            Upcoming Events
          </h1>
          <p className="text-lg sm:text-xl max-w-2xl hero-description animate-fadeInUp delay-200">
            Stay updated on all our exciting events, including the Pride Event and community gatherings. We can’t wait to celebrate with you!
          </p>
        </section>

        {/* Countdown Section */}
        <Countdown />

        {/* Events Section */}
        <section>
          <div>
            <EventCard />
          </div>
        </section>

        <Footer />
      </div>
    </>
  );
}