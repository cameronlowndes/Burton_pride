// app/page.tsx or app/(site)/page.tsx — wherever your home route is
import FeedBack from '../components/Client/FeedBackClient';
import MetaHead from '../components/MetaHead';

export const metadata = {
  title: 'Burton Pride - FeedBack Page',
  description: 'Stay updated on all the exciting events hosted by Burton Pride, including the Pride Event, community gatherings, and more. Join us to celebrate diversity and inclusivity!',
};

export default function Home() {
  return (
    <>
      <MetaHead
        title={metadata.title}
        description={metadata.description}
        keywords="Burton Pride, Pride events, LGBTQ+ events, community events, Pride Parade, inclusivity, diversity"
      />
      <FeedBack />
    </>
  );
}
