import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Burton Pride - Our Core Values",
  description:
    "Learn about the core values that guide Burton Pride in fostering diversity, inclusion, and community support.",
};

const values = [
  {
    title: "Inclusion for All",
    description:
      "We believe that everyone, no matter their background, identity, or ability, deserves to feel welcomed and included. Our spaces are built on acceptance and mutual respect.",
  },
  {
    title: "Celebrating Diversity",
    description:
      "We embrace and celebrate people of all identities – including the LGBTQ+ community, different races, genders, religions, and cultures. Diversity makes us stronger and more united.",
  },
  {
    title: "Supporting Neurodiversity",
    description:
      "We proudly support and uplift neurodivergent individuals, including those with autism, ADHD, dyslexia, and other conditions. We aim to create spaces that understand and support different ways of thinking and communicating.",
  },
  {
    title: "Respect and Compassion",
    description:
      "We treat everyone with kindness and dignity. Even when there are disagreements, we listen respectfully and aim to understand each other.",
  },
  {
    title: "Uplifting Local Voices",
    description:
      "Our work is led by the people of Burton. We want local voices to be heard and involved in shaping what we do – whether it’s events, campaigns, or day-to-day decisions.",
  },
  {
    title: "Integrity and Transparency",
    description:
      "We believe in honesty and being open about what we do. We keep our promises, communicate clearly, and stay accountable to our community.",
  },
  {
    title: "Unity and Collaboration",
    description:
      "We work together – not against – other groups, organisations, and individuals. We believe in partnership and teamwork to achieve real, long-term change.",
  },
  {
    title: "Online Responsibility",
    description:
      "We expect everyone involved with Burton Pride to act respectfully online. We do not engage in arguments or negativity, and we protect our community’s image with pride.",
  },
  {
    title: "Safe and Empowering Spaces",
    description:
      "All our events, meetings, and spaces are safe for everyone. We do not tolerate bullying, harassment, hate speech, or discrimination of any kind.",
  },
  {
    title: "Ongoing Learning and Growth",
    description: (
      <>
        We are always learning and improving. We welcome feedback and are committed to growing as individuals and as a community organisation.
        <div className="mt-4">
          <Link
            href="/ContactUS"
            className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-full transition duration-300 ease-in-out"
          >
            Feedback
          </Link>
        </div>
      </>
    ),
  },
];

export default function Values() {
  return (
    <>
      <Head>
        <title>Burton Pride - Our Core Values</title>
        <meta
          name="description"
          content="Learn about the core values that guide Burton Pride in fostering diversity, inclusion, and community support."
        />
        <meta
          name="keywords"
          content="Burton Pride, core values, diversity, inclusion, neurodiversity, community, respect, equality"
        />
      </Head>

      <div className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-gray-900 flex flex-col items-center p-8 sm:p-16">
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
          <h1 className="text-4xl sm:text-6xl font-bold text-white">Our Core Values</h1>
          <p className="text-lg sm:text-xl max-w-3xl text-white">
            At <strong>Burton Pride C.I.C</strong>, our values shape everything we do. We are dedicated to building a diverse,
            inclusive, and supportive community where everyone feels safe, respected, and empowered.
          </p>
        </section>

        {/* Values Grid */}
        <section className="mt-12 max-w-6xl w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 animate-fadeInUp duration-1000 ease-out delay-200">
          {values.map(({ title, description }, i) => (
            <div
              key={i}
              className="bg-white rounded-xl p-6 shadow-lg hover:shadow-2xl transition-shadow duration-300 flex flex-col"
            >
              <h2 className="text-purple-700 text-2xl font-semibold mb-3">{title}</h2>
              <div className="text-gray-800 flex-grow">{description}</div>
            </div>
          ))}
        </section>

        {/* Closing Message */}
        <section className="mt-16 text-center max-w-4xl animate-fadeInUp duration-1000 ease-out delay-400">
          <p className="text-lg font-medium text-white">
            By joining Burton Pride, you become part of a movement committed to respect, equality, and belonging. Together, we
            build a brighter, more inclusive Burton for all.
          </p>
        </section>

        <Footer />
      </div>
    </>
  );
}
