import Image from "next/image";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Link from "next/link";
import MetaHead from "../components/MetaHead"; // Import MetaHead

export const metadata = {
  title: "Burton Pride - Join Us",
  description: "Learn how you can be a part of Burton Pride by volunteering, donating, or collaborating.",
};

export default function JoinUs() {
  return (
    <>
      {/* Use the MetaHead component here */}
      <MetaHead
        title="Burton Pride - Join Us"
        description="Learn how you can be a part of Burton Pride by volunteering, donating, or collaborating. Join us in creating a more inclusive and diverse community."
        keywords="Burton Pride, volunteer with Burton Pride, donate to Burton Pride, collaborate with Burton Pride, LGBTQ+ community, get involved with Burton Pride"
      />

      <div className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex flex-col items-center p-8 sm:p-16 pb-32"> {/* Increased pb-24 to pb-32 */}
        <Navbar />

        {/* Hero Section */}
        <header className="text-center flex flex-col items-center gap-6 mt-16 w-full">
          <Image
            src="/image/logo.jpg"
            alt="Burton Pride Logo"
            width={180}
            height={180}
            className="hero-logo"
          />
          <h1 className="text-4xl sm:text-6xl font-bold">Join Us at Burton Pride</h1>
          <p className="text-lg sm:text-xl max-w-2xl">
            Whether you're looking to volunteer, donate, or collaborate, there are plenty of ways to support and get involved with Burton Pride.
          </p>
        </header>

        {/* Volunteer Section */}
        <section className="mt-16 text-center w-full max-w-4xl">
          <h2 className="text-3xl font-semibold mb-6">Become a Volunteer</h2>
          <p className="text-lg mb-6">
            Help us make Burton Pride an inclusive event! We’re always looking for passionate individuals to join our volunteer team and contribute to the success of the festival.
          </p>
          <Link
            href="/Volunteer"
            className="bg-white text-pink-600 px-6 py-3 rounded-full font-semibold text-lg hover:bg-opacity-80 transition"
          >
            Volunteer with Us
          </Link>
        </section>

        {/* Donate Section */}
        <section className="mt-16 text-center w-full max-w-4xl">
          <h2 className="text-3xl font-semibold mb-6">Support with a Donation</h2>
          <p className="text-lg mb-6">
            Your donations go directly towards organizing our events, community initiatives, and making Burton Pride an unforgettable experience.
          </p>
          <Link
            href="https://www.gofundme.com/f/raising-funds-for-burton-pride"
            target="_blank"
            className="bg-yellow-400 text-black px-6 py-3 rounded-full font-semibold text-lg hover:bg-yellow-300 transition"
          >
            Donate Now
          </Link>
        </section>

        {/* Collaborate Section */}
        <section className="mt-16 text-center w-full max-w-4xl">
          <h2 className="text-3xl font-semibold mb-6">Collaborate with Us</h2>
          <p className="text-lg mb-6">
            We’re always looking for like-minded businesses, organisations, and individuals who want to support our mission of inclusivity and equality.
          </p>
          <Link
            href="/Collaborate"
            className="bg-white text-pink-600 px-6 py-3 rounded-full font-semibold text-lg hover:bg-opacity-80 transition"
          >
            About Collaborating
          </Link>
        </section>

        {/* Contact Section */}
        <section className="mt-16 text-center w-full max-w-3xl">
          <h2 className="text-3xl font-semibold mb-4">Get in Touch</h2>
          <p className="text-lg mb-6">
            Have questions or want to discuss how you can get involved? We’d love to hear from you!
          </p>
          <Link
            href="/ContactUS"
            className="bg-white text-pink-600 px-6 py-3 rounded-full font-semibold text-lg hover:bg-opacity-80 transition"
          >
            Contact Us
          </Link>
        </section>

        <Footer />
      </div>
    </>
  );
}
