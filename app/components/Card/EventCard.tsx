'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface EventCardProps {
  name: string;
  description: string;
  date?: string;
  time?: string;
  details?: string;
  link?: string;
  mapLink: string;
  isEventPassed: boolean;
  image?: string;
  onImageClick: (src: string) => void;
  isEventToday?: boolean;
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
  });
};

const EventCard: React.FC<EventCardProps> = ({
  name,
  description,
  date,
  time,
  details,
  link,
  mapLink,
  isEventPassed,
  isEventToday,
  image,
  onImageClick
}) => (
  <div
    className={`bg-white text-black p-6 rounded-lg shadow-md w-full max-w-sm transition-transform hover:scale-105 ${isEventToday
        ? 'border-4 border-yellow-400 shadow-yellow-300 animate-fadeInUp'
        : 'animate-fadeInUp'
      }`}
  >
    {image && (
      <div className="mb-4 cursor-pointer" onClick={() => onImageClick(image)}>
        <img
          src={image}
          alt={`${name} image`}
          className="w-full h-48 object-cover rounded-md hover:opacity-90 transition"
        />
      </div>
    )}

    <h3 className="text-xl font-bold">{name}</h3>
    <p className="text-sm">{description}</p>

    {(date || time) && (
      <div className="mt-1">
        {date && <p className="text-pink-600 font-semibold">{formatDate(date)}</p>}
        {time && <p className="text-pink-600 font-semibold">{time}</p>}
      </div>
    )}

    {/* Special Note for Pride Event or Today */}
    {(isEventToday || name === "Pride Event") ? (
      <div className="mt-4 p-3 rounded-lg bg-yellow-100 border-2 border-yellow-400 shadow-lg flex flex-col items-center">
        {isEventToday && (
          <div className="inline-block bg-yellow-400 text-black font-extrabold px-4 py-2 rounded-full shadow-md text-lg animate-bounce mb-2">
            🎉 Happening Today!
          </div>
        )}

        {!isEventPassed && (name === "Pride Event" || name === "Pride After Party") && (
          <div className="bg-yellow-300 text-black text-base font-bold px-4 py-2 rounded shadow-md text-center animate-pulse mb-2">
            🎉 This event is FREE and open to the public – No tickets required!
          </div>
        )}

        {details && (
          <div className="mt-2">
            <p className="text-sm text-gray-700">{details}</p>
          </div>
        )}
      </div>
    ) : (
      details && (
        <div className="mt-4">
          <p className="text-sm text-gray-600">{details}</p>
        </div>
      )
    )}

    <div className="mt-4">
      {isEventPassed ? (
        <p className="text-red-500 font-semibold">Event Completed</p>
      ) : (
        link && (
          <Link href={link}>
            <span className="text-blue-500 hover:underline cursor-pointer">More Details</span>
          </Link>
        )
      )}
    </div>

    <div className="mt-4">
      <a
        href={mapLink}
        target="_blank"
        rel="noopener noreferrer"
        className="text-green-500 hover:underline"
      >
        View on Google Maps
      </a>
    </div>
  </div>
);

const isEventInPast = (eventDateStr: string) => {
  const eventDate = new Date(eventDateStr);
  const today = new Date();
  eventDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return eventDate < today;
};

const isEventToday = (eventDateStr: string) => {
  const eventDate = new Date(eventDateStr);
  const today = new Date();
  return eventDate.toDateString() === today.toDateString();
};

const EventPage: React.FC = () => {
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<EventCardProps[]>([]);

  useEffect(() => {
    const baseEvents: EventCardProps[] = [
      {
        name: "Pride Event",
        description: "Join us for a vibrant celebration on Shobnall Fields in Burton 🏳️‍🌈",
        date: "2026-06-27",
        time: "12:00 PM - 6:00 PM",   // ✅ ADDED
        mapLink: "https://www.google.com/maps?q=Shobnall+Fields+Burton",
        isEventPassed: isEventInPast("2026-06-27"),
        isEventToday: isEventToday("2026-06-27"),
        image: "/image/PosterPicturePng/PridePoste2026.png",
        onImageClick: setModalImage
      },
      {
        name: "Drag Bingo Night",
        description: "We’re hosting a Drag Bingo Night at The Blacksmiths Arms (DE14 3EY)! Join us for an unforgettable evening of fun, laughter, and fabulous entertainment.",
        date: "2026-03-07",
        time: "7:00 PM - 10:00 PM",
        link: "https://www.tickettailor.com/events/burtonpride/1913327",
        mapLink: "https://www.google.com/maps/dir//The+Blacksmiths+Arms+Main+St+Branston+Burton-on-Trent+DE14+3EY/@52.7875072,-1.6704757,16z",
        isEventPassed: isEventInPast("2026-03-07"),
        isEventToday: isEventToday("2026-03-07"),
        image: "/image/PosterPicturePng/DRAGBINGNIGHTWITHQR.png",
        onImageClick: setModalImage
      }
    ];

    const sorted = baseEvents
      .filter(event => !event.isEventPassed)
      .sort((a, b) => new Date(a.date || "").getTime() - new Date(b.date || "").getTime());

    setUpcomingEvents(sorted);
  }, []);

  return (
    <section id="events" className="mt-8 text-center w-full flex flex-col items-center max-w-6xl mx-auto pb-24">
      <h2 className="text-3xl font-semibold mb-6">Upcoming Events</h2>

      {upcomingEvents.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-6 w-full">
          {upcomingEvents.map(event => (
            <EventCard key={`${event.name}-${event.date}`} {...event} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-center py-16 px-6 bg-gradient-to-r from-pink-500 via-purple-500 to-yellow-400 rounded-2xl shadow-lg animate-fadeInUp w-full max-w-4xl">
          <h3 className="text-4xl font-extrabold text-white mb-4">
            🌈 No Upcoming Events Right Now
          </h3>
          <p className="text-lg text-white mb-6 max-w-2xl">
            But don’t worry – Burton Pride is always working behind the scenes to
            bring more exciting celebrations, community events, and nights full of
            love, unity, and inclusivity. 💖
          </p>
          <p className="text-md text-yellow-100 italic mb-4">
            Stay tuned for updates — more events are on the way!
          </p>
          <Link
            href="https://www.facebook.com/profile.php?id=61556621159422"
            target="_blank"
            className="bg-blue-600 text-white px-6 py-3 rounded-full text-lg font-semibold shadow-md hover:bg-blue-500 transition"
          >
            Follow us on Facebook
          </Link>
        </div>
      )}

      {modalImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center cursor-pointer p-4"
          onClick={() => setModalImage(null)}
        >
          <img
            src={modalImage}
            alt="Enlarged Event"
            className="max-h-[95vh] max-w-[95vw] w-auto h-auto rounded-lg object-contain shadow-2xl transition-transform duration-300 hover:scale-105"
          />
          <p className="absolute bottom-4 text-center text-white text-sm w-full">
            Click anywhere to close
          </p>
        </div>
      )}
    </section>
  );
};

export default EventPage;
