import Link from "next/link";
import Watermark from "../../components/Rooting/Watermark";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Getting Here | Burton Pride 2025",
  description:
    "Plan your journey to Burton Pride 2025. Discover the best travel options including train, bus, taxi, and local directions to the Shobnall Leisure Complex.",
  keywords: [
    "Burton Pride",
    "Pride Event 2026",
    "Getting to Pride",
    "Burton upon Trent travel",
    "Shobnall Leisure Complex",
    "LGBTQ+ event",
    "Pride travel guide",
  ],
  openGraph: {
    title: "Getting Here | Burton Pride 2026",
    description:
      "All your travel options for getting to Burton Pride 2026 at Shobnall Leisure Complex.",
    siteName: "Burton Pride",
    type: "website",
    locale: "en_GB",
    images: [
      {
        url: "/image/logo.jpg",
        width: 1200,
        height: 630,
        alt: "Burton Pride 2026 - Getting Here",
      },
    ],
  },
};

const PlanYourVisitPage = () => {
  const anyDisabled = true;

  return (
    <main className="min-h-screen text-white px-6 pt-28 pb-12 sm:px-16 sm:pt-32">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-bold mb-10 text-center">
          Getting Here – Burton Pride 2026
        </h1>

        <div className="grid gap-8">
          {/* Train */}
          <div className="bg-white text-black p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold mb-4">🚆 By Train</h2>

            <p className="mb-4">
              Burton-on-Trent Station is served by multiple bus routes that take
              you directly to the event site. After your train journey, hop on a
              local bus.
            </p>

            <p className="mb-4">
              Use CrossCountry to search Burton-on-Trent from your home station.
            </p>

            <a
              href="https://www.crosscountrytrains.co.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
            >
              Visit CrossCountry
            </a>
          </div>

          {/* Bus */}
          <div className="bg-white text-black p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold mb-4">🚌 By Bus</h2>

            <p className="mb-4">
              Burton is served by several bus routes. Visit the Diamond Buses
              Journey Planner for more information.
            </p>

            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>
                Routes <strong>7A, 9, 10, 401, 402, 403</strong> stop at
                Shobnall Road &amp; Shobnall Street, nearest to the event.
              </li>

              <li>
                <strong>From Derby:</strong> Take X38, V3, or Villager to the
                town centre, then change buses.
              </li>

              <li>
                <strong>From Uttoxeter:</strong> Use 401, 402, or 403 and alight
                at Shobnall Street/Shell Petrol Station.
              </li>
            </ul>

            <div className="flex gap-4 flex-wrap">
              <a
                href="https://www.diamondbuses.com/bus-tracker/?region=Staffordshire/"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
              >
                Diamond Buses Tracker
              </a>

              <a
                href="https://www.trentbarton.co.uk/services"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
              >
                Trent Barton Tracker
              </a>

              <a
                href="https://www.arrivabus.co.uk"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
              >
                Arriva Bus
              </a>

              <a
                href="https://www.staffordshire.gov.uk/Transport/buses/home.aspx"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
              >
                Council Bus Info
              </a>
            </div>
          </div>

          {/* Taxi */}
          <div className="bg-white text-black p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold mb-4">🚖 By Taxi</h2>

            <p className="mb-4">
              Uber operates locally. You can also use the following taxi
              services:
            </p>

            <div className="flex flex-col gap-6">
              <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
                <h3 className="text-lg font-semibold mb-2">
                  New Street Taxis
                </h3>

                <div className="flex gap-4 flex-wrap">
                  <a
                    href="https://www.newstreettaxis.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded"
                  >
                    Visit Website
                  </a>

                  <a
                    href="tel:01283500500"
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded"
                  >
                    📞 Call 01283 500500
                  </a>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
                <h3 className="text-lg font-semibold mb-2">
                  Stapenhill Taxis
                </h3>

                <div className="flex gap-4 flex-wrap">
                  <a
                    href="https://www.stapenhilltaxis.co.uk/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded"
                  >
                    Visit Website
                  </a>

                  <a
                    href="tel:01283544444"
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded"
                  >
                    📞 Call 01283 544444
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Respect Message */}
          <div className="bg-white text-black p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold mb-4">🙏 Be Considerate</h2>

            <p>
              Please be respectful when arriving or leaving. Keeping noise down
              and treating residents courteously helps preserve a positive
              community relationship.
            </p>
          </div>

          {/* Disabled Travel Help */}
          {anyDisabled && (
            <div className="bg-yellow-100 text-yellow-900 p-6 rounded-lg shadow-lg border-2 border-yellow-500">
              <h2 className="text-2xl font-semibold mb-4">
                🛠️ Need Help Travelling?
              </h2>

              <p className="mb-4">
                If you need assistance travelling to Burton Pride 2026, please{" "}
                <Link
                  href="/contact-us"
                  className="underline cursor-pointer hover:text-yellow-700 font-semibold"
                >
                  contact our support team
                </Link>
                .
              </p>

              <p>
                Or email us directly at{" "}
                <a
                  href="mailto:info@burtonpride.co.uk"
                  className="underline hover:text-yellow-700 font-semibold"
                >
                  info@burtonpride.co.uk
                </a>
              </p>
            </div>
          )}

          {/* Back Link */}
          <div className="text-center mt-6">
            <Link
              href="/BurtonPride2026/MainEvent"
              className="inline-block bg-white text-purple-700 font-bold py-3 px-6 rounded-full shadow-md hover:bg-gray-100 transition duration-300 ease-in-out cursor-pointer"
            >
              ← Back to Main Event Page
            </Link>
          </div>
        </div>
      </div>

      {/* Watermark */}
      <Watermark />
    </main>
  );
};

export default PlanYourVisitPage;