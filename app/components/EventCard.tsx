"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface EventCardProps {
  name: string;
  description: string;
  date?: string;
  details: string;
  link?: string;
  mapLink: string;
  isEventPassed: boolean;
  image?: string;
  onImageClick: (src: string) => void;
}

const EventCard: React.FC<EventCardProps> = ({
  name,
  description,
  date,
  details,
  link,
  mapLink,
  isEventPassed,
  image,
  onImageClick
}) => (
  <div className="bg-white text-black p-6 rounded-lg shadow-md animate-fadeInUp max-w-md w-full">
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
    {date && <span className="text-pink-600 font-semibold">{date}</span>}
    <div className="mt-4">
      <p className="text-sm text-gray-600">{details}</p>
    </div>
    <div className="mt-4">
      {isEventPassed ? (
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

const getNextThursday = (fromDate: Date) => {
  const date = new Date(fromDate);
  const dayOfWeek = date.getDay();
  const daysUntilThursday = (4 - dayOfWeek + 7) % 7;
  date.setDate(date.getDate() + daysUntilThursday);
  return date;
};

const EventPage: React.FC = () => {
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<EventCardProps[]>([]);
  const [rainbowRiotDate, setRainbowRiotDate] = useState<string>("");

  useEffect(() => {
    const currentDate = new Date();

    const rainbowDate = getNextThursday(currentDate);
    setRainbowRiotDate(rainbowDate.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }));

    const baseEvents: EventCardProps[] = [
      {
        name: "Pride Event",
        description: "Join us for a vibrant celebration on Shobnall Fields in Burton at 12.pm! 🏳️‍🌈",
        date: "August 16, 2025",
        details: "The Pride Parade is a lively event celebrating diversity and inclusivity. Tickets coming SOON",
        mapLink: "https://www.google.com/maps?q=Shobnall+Fields+Burton",
        isEventPassed: new Date("2025-08-16") < currentDate,
        image: "/image/Pride_event_soon.png",
        onImageClick: setModalImage
      },
      {
        name: "Miss Tutu Drag Bingo Night",
        description: "An exciting night of fun and laughter with Miss Tutu!",
        date: "May 26, 2025",
        details: "Join us for an inspiring charity event at Marstons Sports & Social Club, 7:00pm. £11.50 entry",
        link: "https://donate.giveasyoulive.com/charity/burtonanddistrictmind/event/miss-tutu-drag-bingo-night",
        mapLink: "https://www.google.com/maps?q=Marstons+Sports+%26+Social+Club+Burton",
        isEventPassed: new Date("2025-05-26") < currentDate,
        image: "/image/Drag_Queen_Bingo_Night_Poster.jpeg",
        onImageClick: setModalImage
      }
    ];

    const rainbowRiot: EventCardProps = {
      name: "Rainbow R.I.O.T. Every Thursday",
      description: "Need Support? You’re Not Alone. Join Us Every Thursday  at Burton Fire Station",
      details: `Struggling with your sexuality or feeling isolated? Rainbow R.I.O.T. offers support every Thursday 6:30–7:30pm at Burton Fire Station.`,
      mapLink: "https://www.google.com/maps?q=Burton+Fire+Station",
      isEventPassed: rainbowDate < currentDate,
      image: "/image/RainbowEvent.jpg",
      onImageClick: setModalImage,
      date: rainbowDate.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    };

    const allEvents = [...baseEvents, rainbowRiot];
    const sorted = allEvents
      .filter(event => !event.isEventPassed)
      .sort((a, b) => new Date(a.date || "").getTime() - new Date(b.date || "").getTime());

    setUpcomingEvents(sorted);
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 p-6 relative">
      {/* Upcoming Events */}
      {upcomingEvents.length > 0 ? (
        upcomingEvents.map(event => (
          <EventCard key={event.name} {...event} />
        ))
      ) : (
        <p className="text-lg text-gray-500">No upcoming events</p>
      )}

      {/* Modal */}
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
