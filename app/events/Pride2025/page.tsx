import Head from 'next/head';
import PrideEventClient from '../../components/Client/PrideEventClient';

export const metadata = {
  title: "Burton Pride - Pride Event 2025",
  description: "Join the Pride Event 2025 in Burton upon Trent for a day of inclusivity, love, unity, and community spirit. Find event details, location, FAQs, and how to get involved.",
};

export default function PrideEventPage() {
  return (
    <>
      <Head>
        <title>Pride Event 2025 - Celebration of Inclusivity in Burton upon Trent</title>
        <meta
          name="description"
          content="Join the Pride Event 2025 in Burton upon Trent for a day of inclusivity, love, unity, and community spirit. Find event details, location, FAQs, and how to get involved."
        />
        <meta
          name="keywords"
          content="Pride event, Burton upon Trent, 2025, inclusivity, LGBTQ+, community, festival, parade, music, celebration, volunteer, sponsors, event schedule, FAQs, location"
        />
        <meta name="author" content="Burton Pride Event Organizers" />
        <meta property="og:title" content="Pride Event 2025 - Celebration in Burton upon Trent" />
        <meta property="og:description" content="Celebrate Pride in Burton upon Trent! Details on the 2025 event, location, schedule, and how to participate." />
      </Head>

      <PrideEventClient />
    </>
  );
}
