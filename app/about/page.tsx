import Image from "next/image";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import MetaHead from "../components/MetaHead";  // Import MetaHead component

export default function About() {
  return (
    <>
      <MetaHead 
        title="Burton Pride - About"
        description="Learn more about Burton Pride, our mission, and how to get involved. Burton Pride is dedicated to fostering a welcoming and inclusive environment for the LGBTQ+ community in Burton."
        keywords="Burton Pride, LGBTQ+, diversity, inclusion, community, Burton, Pride events, equality"
      />

      <div className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex flex-col items-center p-8 sm:p-16">
        <Navbar />

        {/* About Section */}
        <section className="text-center flex flex-col items-center gap-6 mt-16 max-w-3xl animate-fadeInUp duration-1000 ease-out">
          <Image src="/image/logo.jpg" alt="Burton Pride Logo" width={180} height={180} className="hero-logo" />
          <h1 className="text-4xl sm:text-6xl font-bold hero-title">About Burton Pride</h1>
          <p className="text-lg sm:text-xl hero-description">
            Burton Pride is a vibrant celebration of diversity, inclusion, and love. Our mission is to foster a welcoming space for the LGBTQ+ community and allies in Burton, creating events that inspire unity and joy.
          </p>
        </section>

        {/* Mission Section */}
        <section className="mt-16 text-center w-full max-w-4xl animate-fadeInUp duration-1000 ease-out delay-200">
          <h2 className="text-3xl font-semibold mb-6">Our Mission</h2>
          <p className="text-lg">
            We strive to uplift voices, promote equality, and create safe spaces where everyone feels valued and supported. Through community events, outreach programs, and advocacy, Burton Pride is committed to making a lasting impact.
          </p>
        </section>

        {/* Get Involved Section */}
        <section className="mt-16 text-center w-full max-w-4xl animate-fadeInUp duration-1000 ease-out delay-400">
          <h2 className="text-3xl font-semibold mb-6">Get Involved</h2>
          <p className="text-lg mb-6">
            Whether you want to volunteer, sponsor, or simply show your support, there are many ways to be part of Burton Pride. Together, we can create a future filled with love, acceptance, and celebration.
          </p>
          <a
            href="/ContactUS"
            className="bg-white text-pink-600 px-6 py-3 rounded-full font-semibold text-lg hover:bg-opacity-80 transition hero-button animate-scaleUp duration-1000 ease-out delay-600"
          >
            Contact Us
          </a>
        </section>

        <Footer />
      </div>
    </>
  );
}
