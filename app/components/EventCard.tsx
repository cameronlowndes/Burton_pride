import Link from 'next/link';

interface EventCardProps {
  name: string;
  description: string;
  date: string;
  details: string;
  link?: string;  // Link is optional for events without a specific page
  mapLink: string;
  isEventPassed: boolean;
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
};

const EventPage: React.FC = () => {
  const currentDate = new Date();
  
  const events = [
    {
      name: "Miss Tutu Drag Bingo Night",
      description: "An exciting night of fun and laughter with Miss Tutu!",
      date: "May 26, 2025",
      details: "Join us for an inspiring and inclusive charity event at Marstons Sports & Social Club, Shobnall Road, Burton, starting at 7:00pm. Book The  Ticket by using the link below £11.50",
      link: "https://donate.giveasyoulive.com/charity/burtonanddistrictmind/event/miss-tutu-drag-bingo-night",
      mapLink: "https://www.google.com/maps?q=Marstons+Sports+%26+Social+Club+Burton",
      isEventPassed: new Date("2025-05-26") < currentDate
    },
    {
      name: "Pride Event",
      description: "Join us for a vibrant celebration on Shobnall Fields of Burton at 12.pm! 🏳️‍🌈",
      date: "August 16, 2025",
      details: "The Pride Parade is a lively event celebrating diversity and inclusivity. It’s an opportunity for the community to unite and show support for the LGBTQ+ community, creating an atmosphere of love and acceptance.",
      mapLink: "https://www.google.com/maps?q=Shobnall+Fields+Burton",
      isEventPassed: new Date("2025-08-16") < currentDate
    }
  ];

  const upcomingEvents = events.filter(event => !event.isEventPassed).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="flex flex-wrap justify-start gap-8 p-6">
      {upcomingEvents.length > 0 ? (
        upcomingEvents.map(event => <EventCard key={event.name} {...event} />)
      ) : (
        <div className="bg-white text-black p-8 rounded-lg shadow-md w-full md:w-2/3 lg:w-1/2 text-center">
          <h3 className="text-2xl font-bold">No Upcoming Events</h3>
          <p className="text-gray-600">Stay tuned for future updates!</p>
        </div>
      )}
    </div>
  );
};

export default EventPage;