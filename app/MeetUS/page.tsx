import Image from "next/image";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Link from "next/link";
import MetaHead from "../components/MetaHead"; // Import MetaHead for SEO

export default function MeetUs() {
  return (
    <>
      <MetaHead
        title="Burton Pride - Meet Us"
        description="Meet the passionate people behind Burton Pride. Get to know our team members and learn how we work together to create an inclusive and vibrant community!"
        keywords="Burton Pride, Meet the team, LGBTQ+ community, Pride team, volunteers, event planners, social media team, website admin"
      />

      <div className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white flex flex-col items-center p-8 sm:p-16 pb-24">
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
          <h1 className="text-4xl sm:text-6xl font-bold">Meet the Burton Pride Team</h1>
          <p className="text-lg sm:text-xl max-w-2xl">
            Get to know the passionate people behind Burton Pride. We're dedicated to fostering an inclusive and vibrant community!
          </p>
        </header>

        {/* Committed Board */}
        <section className="mt-16 text-center w-full max-w-4xl">
          <h2 className="text-3xl font-semibold mb-6">Committed Board</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="bg-white text-black shadow-md rounded-lg p-6 flex flex-col items-center">
              <Image src="/image/simon.jpg" alt="Simon Whale" width={96} height={96} className="w-24 h-24 rounded-full mb-4" />
              <h2 className="text-xl font-semibold">Simon Whale</h2>
              <p className="text-gray-600">Founder & Organizer | He/Him</p>
            </div>

            <div className="bg-white text-black shadow-md rounded-lg p-6 flex flex-col items-center">
              <Image src="/image/isaac.jpg" alt="Isaac Timmins" width={96} height={96} className="w-24 h-24 rounded-full mb-4" />
              <h2 className="text-xl font-semibold">Isaac Timmins</h2>
              <p className="text-gray-600">Founder & Director | He/Him</p>
            </div>

            <div className="bg-white text-black shadow-md rounded-lg p-6 flex flex-col items-center">
              <Image src="/image/cameron.jpg" alt="Cameron Lowndes" width={96} height={96} className="w-24 h-24 rounded-full mb-4" />
              <h2 className="text-xl font-semibold">Cameron Lowndes</h2>
              <p className="text-gray-600">Board Member | He/Him/His/They</p>
            </div>
            <div className="bg-white text-black shadow-md rounded-lg p-6 flex flex-col items-center">
              <Image src="/image/john.jpg" alt="John" width={96} height={96} className="w-24 h-24 rounded-full mb-4" />
              <h2 className="text-xl font-semibold">John</h2>
              <p className="text-gray-600">Board Member | He/Him</p>
            </div>
          </div>
        </section>

        {/* Social Media Team */}
        <section className="mt-16 text-center w-full max-w-4xl">
          <h2 className="text-3xl font-semibold mb-6">Social Media Team</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="bg-white text-black shadow-md rounded-lg p-6 flex flex-col items-center">
              <Image src="/image/isaac.jpg" alt="Cameron Lowndes" width={96} height={96} className="w-24 h-24 rounded-full mb-4" />
              <h2 className="text-xl font-semibold">Isaac Timmins</h2>
              <p className="text-gray-600">Social Media Director | He/Him</p>
            </div>

            <div className="bg-white text-black shadow-md rounded-lg p-6 flex flex-col items-center">
              <Image src="/image/cameron.jpg" alt="Cameron Lowndes" width={96} height={96} className="w-24 h-24 rounded-full mb-4" />
              <h2 className="text-xl font-semibold">Cameron Lowndes</h2>
              <p className="text-gray-600">Social Media Manager | He/Him/His/They</p>
            </div>
          </div>
        </section>

        {/* Website Admin */}
        <section className="mt-16 text-center w-full max-w-4xl">
          <h2 className="text-3xl font-semibold mb-6">Website Admin</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="bg-white text-black shadow-md rounded-lg p-6 flex flex-col items-center">
              <Image src="/image/cameron.jpg" alt="Cameron Lowndes" width={96} height={96} className="w-24 h-24 rounded-full mb-4" />
              <h2 className="text-xl font-semibold">Cameron Lowndes</h2>
              <p className="text-gray-600">Website Administrator | He/Him/His/They</p>
            </div>
          </div>
        </section>

        {/* Event Planning Team */}
        <section className="mt-16 text-center w-full max-w-4xl">
          <h2 className="text-3xl font-semibold mb-6">Event Planning Team</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* <div className="bg-white text-black shadow-md rounded-lg p-6 flex flex-col items-center">
              <Image src="/images/person4.jpg" alt="Sarah Lee" width={96} height={96} className="w-24 h-24 rounded-full mb-4" />
              <h2 className="text-xl font-semibold">Sarah Lee</h2>
              <p className="text-gray-600">Event Planner</p>
            </div> */}
          </div>
        </section>

        {/* Volunteer Team */}
        <section className="mt-16 text-center w-full max-w-4xl">
          <h2 className="text-3xl font-semibold mb-6">Volunteer Team</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* <div className="bg-white text-black shadow-md rounded-lg p-6 flex flex-col items-center">
              <Image src="/images/person5.jpg" alt="Chris Evans" width={96} height={96} className="w-24 h-24 rounded-full mb-4" />
              <h2 className="text-xl font-semibold">Chris Evans</h2>
              <p className="text-gray-600">Volunteer Coordinator</p>
            </div> */}
          </div>
        </section>

        {/* Contact Section */}
        <section className="mt-16 text-center w-full max-w-3xl">
          <h2 className="text-3xl font-semibold mb-4">Want to Connect?</h2>
          <p className="text-lg mb-6">
            Reach out to us for collaborations, volunteering, or any inquiries. We’d love to hear from you!
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
