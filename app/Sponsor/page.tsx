import MetaHead from "../components/MetaHead"; // Adjust the path based on where your MetaHead component is located
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SponsorCard from "../components/SponsorCard"; // Import the refined SponsorCard component
import Link from "next/link";

export default function Sponsors() {
  return (
    <>
      <MetaHead
        title="Burton Pride - Sponsors"
        description="Meet the amazing sponsors who support Burton Pride and help make our events possible."
        keywords="Burton Pride, sponsors, LGBTQ+ support, diversity, inclusion, events"
      />

      <div className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex flex-col items-center p-8 sm:p-16 pb-45">
        <Navbar />

        {/* Hero Section */}
        <header className="text-center flex flex-col items-center gap-6 mt-16">
          <h1 className="text-4xl sm:text-6xl font-bold">Our Sponsors</h1>
          <p className="text-lg sm:text-xl max-w-2xl">
            A huge thank you to our sponsors for making Burton Pride possible! Your support helps us celebrate diversity, inclusion, and love.
          </p>
        </header>

        {/* Sponsors Section */}
        <section className="mt-20 text-center w-full max-w-4xl">
          <h2 className="text-3xl font-semibold mb-6">Proudly Supported By</h2>
          <SponsorCard />
        </section>

    
        {/* Call to Action - Become a Sponsor */}
        <section className="mt-70 text-center w-full max-w-3xl mb-8">
          <h2 className="text-3xl font-semibold mb-4">Want to Sponsor Us?</h2>
          <p className="text-lg mb-6">
            Join our amazing sponsors in making a difference! Support Burton Pride and help create an unforgettable event.
          </p>
          <Link
            href="/Collaborate"
            className="bg-white text-pink-600 px-6 py-3 rounded-full font-semibold text-lg hover:bg-opacity-80 transition"
          >
            Become a Sponsor
          </Link>
        </section>

        <Footer />
      </div>
    </>
  );
}
