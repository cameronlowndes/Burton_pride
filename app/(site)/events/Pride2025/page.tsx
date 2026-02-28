import Head from 'next/head';
import PrideEventClient from '../../components/Client/PrideEventClient';

export const metadata = {
  title: "Burton Pride 2025 Highlights",
  description: "Relive the amazing Pride Event 2025 in Burton upon Trent! Explore event highlights, photos, volunteer stories, and sponsor contributions from the celebration.",
};

export default function PrideEventPage() {
  return (
    <>
      <Head>
        <title>Burton Pride 2025 - Event Highlights & Gallery</title>
        <meta
          name="description"
          content="Relive the amazing Pride Event 2025 in Burton upon Trent! Explore event highlights, photos, volunteer stories, and sponsor contributions from the celebration."
        />
        <meta
          name="keywords"
          content="Pride event, Burton upon Trent, 2025, highlights, gallery, volunteers, sponsors, photos, past event, community celebration"
        />
        <meta name="author" content="Burton Pride Event Organizers" />
        <meta property="og:title" content="Burton Pride 2025 - Event Highlights" />
        <meta property="og:description" content="Check out highlights from Pride Event 2025 in Burton upon Trent! Photos, volunteer stories, and sponsor details." />
      </Head>

      <PrideEventClient showPastEventNotice={true} />
    </>
  );
}
