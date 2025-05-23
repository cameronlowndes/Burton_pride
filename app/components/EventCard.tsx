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
  <div className="bg-white text-black p-6 rounded-lg shadow-md animate-fadeInUp w-full max-w-sm transition-transform hover:scale-105">
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
        {date && <p className="text-pink-600 font-semibold">{date}</p>}
        {time && <p className="text-pink-600 font-semibold">{time}</p>}
      </div>
    )}
    <div className="mt-4">
      <p className="text-sm text-gray-600">{details}</p>
    </div>
    <div className="mt-4">
      {isEventToday ? (
        <p className="text-yellow-600 font-semibold">Happening Today!</p>
      ) : isEventPassed ? (
        <p className="text-red-500 font-semibold">Event Completed</p>
      ) : (
        link && (
          <Link href={link}>
            <span className="text-blue-500 hover:underline">More Details</span>
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

// Get next Thursday from a date
const getNextThursday = (fromDate: Date) => {
  const date = new Date(fromDate);
  const dayOfWeek = date.getDay();
  const daysUntilThursday = (4 - dayOfWeek + 7) % 7 || 7; // Ensure next Thursday if today is Thursday
  date.setDate(date.getDate() + daysUntilThursday);
  return date;
};

// Check if event is in the past
const isEventInPast = (eventDateStr: string) => {
  const eventDate = new Date(eventDateStr);
  const today = new Date();
  eventDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return eventDate < today;
};

// Check if event is today
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

    // Removed setRainbowRiotDate because it was not declared or used anywhere else.

    const baseEvents: EventCardProps[] = [
      {
        name: "Pride Event",
        description: "Join us for a vibrant celebration on Shobnall Fields in Burton at 12.pm! 🏳️‍🌈",
        date: "2025-08-16",
        time: "12:00 PM - 6:00 PM",
        details: "The Pride Parade is a lively event celebrating diversity and inclusivity. Early Bird £5",
        link: "https://www.eventbrite.com/e/pride-event-tickets-1316358476639?aff=oddtdtcreator",
        mapLink: "https://www.google.com/maps?q=Shobnall+Fields+Burton",
        isEventPassed: isEventInPast("2025-08-16"),
        isEventToday: isEventToday("2025-08-16"),
        image: "/image/PrideEventPoster.png",
        onImageClick: setModalImage
      },
      {
        name: "Miss Tutu Drag Bingo Night",
        description: "An exciting night of fun and laughter with Miss Tutu!",
        date: "2025-05-26",
        time: "7:00 PM - 11:00 PM",
        details: "Join us for an inspiring charity event at Marstons Sports & Social Club. £11.50 entry",
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
        date: "2025-05-14",
        time: "5:00 PM",
        details: "Relax in nature, do some light exercise and chat with likeminded people. Simply show up at the entrance off Main Street (by the small parking lot).",
        mapLink: "https://www.google.com/maps?q=Stapenhill+Gardens+Burton",
        isEventPassed: isEventInPast("2025-05-14"),
        isEventToday: isEventToday("2025-05-14"),
        image: "/image/Burton_Pride_Walk_Poster.png",
        onImageClick: setModalImage
      }
    ];

    const rainbowRiot: EventCardProps = {
      name: "Rainbow R.I.O.T. Every Thursday",
      description: "Need Support? You’re Not Alone. Join Us Every Thursday at Burton Fire Station",
      date: rainbowDate.toISOString().split('T')[0],
      time: "6:30 PM – 7:30 PM",
      details: "Struggling with your sexuality or feeling isolated? Rainbow R.I.O.T. offers support every Thursday at Burton Fire Station.",
      mapLink: "https://www.google.com/maps?q=Burton+Fire+Station",
      isEventPassed: isEventInPast(rainbowDateStr),
      isEventToday: isEventToday(rainbowDateStr),
      image: "/image/RainbowEvent.jpg",
      onImageClick: setModalImage
    };

    const allEvents = [...baseEvents, rainbowRiot];
    const sorted = allEvents
      .filter(event => !event.isEventPassed)
      .sort((a, b) => new Date(a.date || "").getTime() - new Date(b.date || "").getTime());

    setUpcomingEvents(sorted);
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-10 p-10 justify-items-center">
      {upcomingEvents.length > 0 ? (
        upcomingEvents.map(event => (
          <EventCard key={event.name} {...event} />
        ))
      ) : (
        <p className="text-lg text-gray-500 col-span-full text-center">No upcoming events</p>
      )}

      {modalImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
          onClick={() => setModalImage(null)}
        >
          <div className="max-w-3xl w-full px-4">
            <img
              src={modalImage}
              alt="Enlarged Event"
              className="rounded-lg shadow-lg w-full max-h-[90vh] object-contain"
            />
            <p className="text-center text-white mt-4 text-sm">Click anywhere to close</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventPage;
