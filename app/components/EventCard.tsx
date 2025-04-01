import Link from 'next/link';

interface EventCardProps {
  name: string;
  description: string;
  date: string;
  details: string;
  link: string;
  mapLink: string;  // Added mapLink prop
  isEventPassed: boolean; // Added new prop for checking if event has passed
}

const EventCard: React.FC<EventCardProps> = ({ 
  name, 
  description, 
  date, 
  details, 
  link, 
  mapLink, 
  isEventPassed 
}) => {
  return (
    <div className="bg-white text-black p-6 rounded-lg shadow-md animate-fadeInUp">
      <h3 className="text-xl font-bold">{name}</h3>
      <p className="text-sm">{description}</p>
      <span className="text-pink-600 font-semibold">{date}</span>
      <div className="mt-4">
        <p className="text-sm text-gray-600">{details}</p>
      </div>
      <div className="mt-4">
        {isEventPassed ? (
          <p className="text-red-500 font-semibold">Event Completed</p>
        ) : (
          <Link href={link}>
            <span className="text-blue-500 hover:underline"></span>
          </Link>
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
};

const EventPage: React.FC = () => {
  const eventDate = new Date("2025-08-16");  // The event date
  const currentDate = new Date();  // Current date

  // Check if the event date has passed
  const isEventPassed = currentDate > eventDate;

  const event = {
    name: "Pride Parade",
    description: "Join us for a vibrant celebration on Shobnall Fields of Burton! 🏳️‍🌈",
    date: "August 16, 2025",
    details: "The Pride Parade is a lively event celebrating diversity and inclusivity. It’s an opportunity for the community to unite and show support for the LGBTQ+ community, creating an atmosphere of love and acceptance.",
    link: "/events/pride-parade",
    mapLink: "https://www.google.com/maps?q=Shobnall+Fields+Burton",  // Google Map link for the event location
    isEventPassed // Pass this as a prop
  };

  return <EventCard {...event} isEventPassed={isEventPassed} />;
};

export default EventPage;
