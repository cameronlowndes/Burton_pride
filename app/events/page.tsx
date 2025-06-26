import MetaHead from '../components/MetaHead';
import EventsClient from '../components/Client/EventsClient';

export const metadata = {
  title: 'Burton Pride - Events',
  description: 'Learn more about Burton Pride, our mission, and how to get involved.',
};

export default function EventsPage() {
  return (
    <>
      <MetaHead
        title="Burton Pride - Events"
        description="Stay updated on all the exciting events hosted by Burton Pride, including the Pride Event, community gatherings, and more. Join us to celebrate diversity and inclusivity!"
        keywords="Burton Pride, Pride events, LGBTQ+ events, community events, Pride Parade, inclusivity, diversity"
      />
      <EventsClient />
    </>
  );
}
