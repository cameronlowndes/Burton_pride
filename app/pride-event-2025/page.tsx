import Countdown from '../components/Countdown';
import Navbar from '../components/Navbar';  // Import Navbar
import Footer from '../components/Footer';  // Import Footer
import Image from 'next/image';  // Import Next.js Image component

const PrideEventPage = () => {
  return (
    <main className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex flex-col items-center p-8 sm:p-16 pb-45">
      {/* Navbar */}
      <Navbar />
      
      <header className="text-center pt-18">
        <h1 className="text-5xl font-bold text-white mb-4">Pride Event 2025</h1>
        <p className="text-lg text-white max-w-2xl mx-auto">
          Join us for an unforgettable celebration of inclusivity, love, and unity. The Pride Event 2025 is set to be an exciting day of festivities, entertainment, and community spirit.
        </p>
      </header>

      {/* Countdown Section */}
      <Countdown />

      {/* Map Image Section */}
      <section className="mt-16 w-full max-w-3xl text-center">
        <h2 className="text-3xl font-semibold mb-6">Event Location</h2>
        <div className="relative w-full h-80 sm:h-96 mb-8">
          <Image 
            src="/path-to-your-event-map-image.jpg" // Replace with the actual path to your event map image
            alt="Event Location Map"
            layout="fill"
            objectFit="cover"
            className="rounded-lg"
          />
        </div>
      </section>

      {/* Event Highlights Section */}
      <section className="mt-16 text-center w-full max-w-3xl">
        <h2 className="text-3xl font-semibold mb-6">Event Highlights</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="bg-white text-black p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-2">Live Music</h3>
            <p>Enjoy performances from local artists and popular musicians throughout the day!</p>
          </div>

          <div className="bg-white text-black p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-2">Community Booths</h3>
            <p>Explore booths from local businesses, organizations, and advocacy groups.</p>
          </div>
        </div>
      </section>

      {/* Event Schedule Section */}
      <section className="mt-16 text-center w-full max-w-3xl">
        <h2 className="text-3xl font-semibold mb-6">Event Schedule</h2>
        <div className="bg-white text-black p-6 rounded-lg shadow-md">
          <ul className="list-none">
            <li><strong>12:00 PM</strong> - Live music performances</li>
            <li><strong>3:00 PM</strong> - Community booths and activities</li>
            <li><strong>5:00 PM</strong> - Closing ceremony</li>
          </ul>
        </div>
      </section>

      {/* Sponsors Section */}
      <section className="mt-16 text-center w-full max-w-3xl">
        <h2 className="text-3xl font-semibold mb-6">Sponsors</h2>
        <div className="flex flex-col sm:flex-row justify-center space-y-6 sm:space-y-0 sm:space-x-8">
          {/* Sponsor 1 */}
          <div className="bg-gray-200 p-4 rounded-lg">
            <img src="/path-to-sponsor-logo.png" alt="Sponsor 1" className="w-40" />
          </div>
          {/* Sponsor 2 */}
          <div className="bg-gray-200 p-4 rounded-lg">
            <img src="/path-to-sponsor-logo.png" alt="Sponsor 2" className="w-40" />
          </div>
        </div>
      </section>

      {/* Get Involved Section */}
      <section className="mt-16 text-center w-full max-w-3xl">
        <h2 className="text-3xl font-semibold mb-6">Get Involved</h2>
        <p className="text-lg text-gray-100 mb-4">We welcome volunteers to help with the event. Sign up to support and be part of the pride celebration!</p>
        <a
          href="https://forms.gle/oFteosGZ9sJPQR6T9"
          className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-full transition duration-300 ease-in-out"
        >
          Volunteer Now
        </a>
      </section>

      {/* Footer */}
      <Footer />
    </main>
  );
};

export default PrideEventPage;
