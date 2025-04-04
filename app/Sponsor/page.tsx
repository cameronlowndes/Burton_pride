import Image from "next/image";
import Link from "next/link";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Head from "next/head";

export default function Sponsors() {
  return (
    <>
      <Head>
        <title>Burton Pride - Sponsors</title>
        <meta name="description" content="Meet the amazing sponsors who support Burton Pride and help make our events possible." />
      </Head>

      <div className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex flex-col items-center p-8 sm:p-16 pb-24">
        <Navbar />

        <header className="text-center flex flex-col items-center gap-6 mt-16">
          <Image src="/image/logo.jpg" alt="Burton Pride Sponsors" width={180} height={180} className="hero-logo" />
          <h1 className="text-4xl sm:text-6xl font-bold">Our Sponsors</h1>
          <p className="text-lg sm:text-xl max-w-2xl">
            A huge thank you to our sponsors for making Burton Pride possible! Your support helps us celebrate diversity, inclusion, and love.
          </p>
        </header>

        {/* Sponsors Section */}
        <section className="mt-16 text-center w-full max-w-4xl">
          <h2 className="text-3xl font-semibold mb-6">Proudly Supported By</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            
            {/* Sponsor Card with Button */}
            <div className="bg-white text-black shadow-md rounded-lg p-6 flex flex-col items-center transition hover:shadow-lg hover:scale-105">
              <Image src="/image/Social_Roots.jpg" alt="Social Roots & Green Shoots" width={150} height={150} className="w-32 h-32 rounded mb-4" />
              <h2 className="text-xl font-semibold">Social Roots & Green Shoots</h2>
              <p className="text-gray-600 text-center mb-4">Committed to supporting LGBTQ+ communities.</p>
              
              <Link 
                href="https://www.youtube.com/@SocialRootsGreenShoots" 
                target="_blank" 
                className="bg-pink-600 text-white px-4 py-2 rounded-full font-semibold hover:bg-pink-700 transition"
              >
                Visit Sponsor
              </Link>
            </div>

          </div>
        </section>

        {/* Call to Action - Become a Sponsor */}
        <section className="mt-16 text-center w-full max-w-3xl">
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
