import Link from 'next/link';
import Watermark from '../../components/Watermark';
import { Metadata } from 'next';


export const metadata: Metadata = {
  title: 'Getting Here | Burton Pride 2025',
  description: 'Plan your journey to Burton Pride 2025. Discover the best travel options including train, bus, taxi, and local directions to the Shobnall Leisure Complex.',
  keywords: [
    'Burton Pride', 'Pride Event 2025', 'Getting to Pride', 'Burton upon Trent travel',
    'Shobnall Leisure Complex', 'LGBTQ+ event', 'Pride travel guide'
  ],
  openGraph: {
    title: 'Getting Here | Burton Pride 2025',
    description: 'All your travel options for getting to Burton Pride 2025 at Shobnall Leisure Complex.',
    url: 'https://yourdomain.com/pride-event-2025/plan-your-visit',
    siteName: 'Burton Pride',
    type: 'website',
    locale: 'en_GB',
    images: [
      {
        url: 'https://yourdomain.com/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Burton Pride 2025 - Getting Here',
      },
    ],
  },
  
};

const PlanYourVisitPage = () => {
  return (
    <main className="min-h-screen bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 text-white px-6 py-12 sm:px-16">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-bold mb-10 text-center">Getting Here – Burton Pride</h1>

        <div className="grid gap-8">

          {/* Train Card */}
          <div className="bg-white text-black p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold mb-4">🚆 By Train</h2>
            <p className="mb-4">
              Burton-on-Trent Station is served by multiple bus routes that take you directly to the event site. After your train journey, hop on a local bus.
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

          {/* Bus Card */}
          <div className="bg-white text-black p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold mb-4">🚌 By Bus</h2>
            <p className="mb-4">
              Burton is served by several bus routes. Visit the Diamond Buses Journey Planner for more information.
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>
                Routes <strong>8, 9, 10, 401, 402, 403</strong> stop at Shobnall Road & Shobnall Street (nearest to the event).
              </li>
              <li>
                <strong>From Derby:</strong> Take X38, V3, or Villager to the town centre, then change buses.
              </li>
              <li>
                <strong>From Uttoxeter:</strong> Use 401, 402, or 403 and alight at Shobnall Street/Shell Petrol Station.
              </li>
            </ul>
            <div className="flex flex-wrap gap-4">
              <a
                href="https://www.diamondbuses.com/journey-planner/"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
              >
                Diamond Buses
              </a>
              <a
                href="https://www.trentbarton.co.uk"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
              >
                Trent Barton
              </a>
            </div>
          </div>

          {/* Taxi Card */}
          <div className="bg-white text-black p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold mb-4">🚖 By Taxi</h2>
            <p className="mb-4">Uber operates locally. You can also use the following taxi services:</p>
            <div className="flex flex-col gap-4">
              <a
                href="https://www.newstreettaxis.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded w-fit"
              >
                New Street Taxis
              </a>
              <a
                href="https://www.icarsltd.com"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded w-fit"
              >
               ICars
              </a>
            </div>
          </div>

          {/* Respect Message Card */}
          <div className="bg-white text-black p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold mb-4">🙏 Be Considerate</h2>
            <p>
              Please be respectful when arriving or leaving. Keeping noise down and treating residents courteously helps preserve a positive community relationship.
            </p>
          </div>

          {/* Back to Main Event Page */}
          <div className="text-center mt-6">
            <Link href="/pride-event-2025">
              <span className="inline-block bg-white text-purple-700 font-bold py-3 px-6 rounded-full shadow-md hover:bg-gray-100 transition duration-300 ease-in-out">
                ← Back to Main Event Page
              </span>
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
