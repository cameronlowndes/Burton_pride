'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface EventCardProps {
  name: string;
  description: string;
  date?: string;
  time?: string;
  details: string;
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
    className={`bg-white text-black p-6 rounded-lg shadow-md w-full max-w-sm transition-transform hover:scale-105 ${
      isEventToday
        ? 'border-4 border-yellow-400 shadow-yellow-300 animate-pulse'
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

    {/* 🎉 FREE EVENT LABEL */}
    {!isEventPassed && (name === "Pride Event" || name === "Pride After Party") && (
      <div className="mt-3 bg-yellow-300 text-black text-base font-bold px-4 py-2 rounded shadow-sm animate-pulse">
        🎉 This event is FREE and open to the public – No tickets required!
      </div>
    )}

    <div className="mt-4">
      <p className="text-sm text-gray-600">{details}</p>
    </div>

    <div className="mt-4">
      {isEventPassed ? (
        <p className="text-red-500 font-semibold">Event Completed</p>
      ) : (
        <>
          {isEventToday && (
            <div className="inline-block bg-yellow-400 text-black font-bold px-3 py-1 rounded-full shadow-sm mb-2 animate-bounce">
              🎉 Happening Today!
            </div>
          )}
          {link && (
            <Link href={link}>
              <span className="text-blue-500 hover:underline cursor-pointer">More Details</span>
            </Link>
          )}
        </>
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

const getNextThursday = (fromDate: Date) => {
  const date = new Date(fromDate);
  const dayOfWeek = date.getDay();
  const daysUntilThursday = (4 - dayOfWeek + 7) % 7 || 7;
  date.setDate(date.getDate() + daysUntilThursday);
  return date;
};

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
    const currentDate = new Date();
    const rainbowDate = getNextThursday(currentDate);
    const rainbowDateStr = rainbowDate.toISOString();

    const baseEvents: EventCardProps[] = [
      {
        name: "Pride Event",
        description: "Join us for a vibrant celebration on Shobnall Fields in Burton at 12.pm! 🏳️‍🌈",
        date: "2025-08-16",
        time: "12:00 PM - 5:00 PM",
        details:
          "The Pride Event is a lively event celebrating diversity and inclusivity. 🆓 This event is free and open to the public – no tickets required!",
        link: "/events/Pride2025",  
        mapLink: "https://www.google.com/maps?q=Shobnall+Fields+Burton",
        isEventPassed: isEventInPast("2025-08-16"),
        isEventToday: isEventToday("2025-08-16"),
        image: "/image/PrideEvent/NewPridePoster.png",
        onImageClick: setModalImage
      },
      {
        name: "Miss Tutu Drag Bingo Night",
        description: "An exciting night of fun and laughter with Miss Tutu!",
        date: "2025-05-26",
        time: "7:00 PM - 11:00 PM",
        details:
          "Join us for an inspiring charity event at Marstons Sports & Social Club. £11.50 entry",
        link: "https://donate.giveasyoulive.com/charity/burtonanddistrictmind/event/miss-tutu-drag-bingo-night",
        mapLink: "https://www.google.com/maps?q=Marstons+Sports+%26+Social+Club+Burton",
        isEventPassed: isEventInPast("2025-05-26"),
        isEventToday: isEventToday("2025-05-26"),
        image: "/image/Drag_Queen_Bingo_Night_Poster.jpeg",
        onImageClick: setModalImage
      },
      {
        name: "Burton Pride Walk in the Park",
        description: "A great outdoor walk at Stapenhill Gardens for all LGBTQ+ and allies! 🌳🏳️‍🌈",
        date: "2025-07-02",
        time: "5:00 PM - 6:00 PM",
        details:
          "Relax in nature, do some light exercise and chat with likeminded people. Simply show up at the entrance off Main Street (by the small parking lot).",
        mapLink: "https://www.google.com/maps?q=Stapenhill+Gardens+Burton",
        isEventPassed: isEventInPast("2025-07-02"),
        isEventToday: isEventToday("2025-07-02"),
        image: "/image/PosterPicture/WalkTheWalk.jpg",
        onImageClick: setModalImage
      },
      {
        name: "Pride After Party",
        description: "Join us for a vibrant celebration At Bridge INN in Burton at 6:30.pm! 🏳️‍🌈",
        date: "2025-08-16",
        time: "6:30 PM - 12:00 AM",
        details:
          "The Pride After Party Event is a lively event celebrating diversity and inclusivity. 🆓 This event is free and open to the public – no tickets required!",
        mapLink: "https://www.google.com/maps/place/Burton+Bridge+Inn/@52.8019424,-1.6258746,16.5z/data=!4m6!3m5!1s0x487a0242f9b9afcb:0xd63b58f898f2a911!8m2!3d52.8067703!4d-1.6255013!16s%2Fg%2F11bzsxx_t2?authuser=0&entry=ttu&g_ep=EgoyMDI1MDcxNi4wIKXMDSoASAFQAw%3D%3D",
        isEventPassed: isEventInPast("2025-08-16"),
        isEventToday: isEventToday("2025-08-16"),
        image: "/image/PrideEvent/PrideAfterParty.png",
        onImageClick: setModalImage
      },
    ];

    const allEvents = [...baseEvents];
    const sorted = allEvents
      .filter(event => !event.isEventPassed)
      .sort((a, b) => new Date(a.date || "").getTime() - new Date(b.date || "").getTime());

    setUpcomingEvents(sorted);
  }, []);

  return (
    <section
      id="events"
      className="mt-8 text-center w-full flex flex-col items-center max-w-6xl mx-auto pb-24"
    >
      <h2 className="text-3xl font-semibold mb-1">Upcoming Events</h2>

      <div
        className={
          upcomingEvents.length === 1
            ? "flex items-center justify-center min-h-[70vh] w-full"
            : "flex flex-wrap justify-center gap-6 w-full"
        }
      >
        {upcomingEvents.length > 0 ? (
          upcomingEvents.map(event => (
            <EventCard key={`${event.name}-${event.date}`} {...event} />
          ))
        ) : (
          <p className="text-lg text-gray-500 w-full">No upcoming events</p>
        )}
      </div>

      {modalImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center cursor-pointer"
          onClick={() => setModalImage(null)}
        >
          <div className="max-w-3xl w-full">
            <img
              src={modalImage}
              alt="Enlarged Event"
              className="rounded-lg shadow-lg w-full object-contain"
            />
            <p className="text-center text-white mt-4 text-sm">Click anywhere to close</p>
          </div>
        </div>
      )}
    </section>
  );
};

export default EventPage;
