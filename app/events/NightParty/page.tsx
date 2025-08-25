import Head from 'next/head';
import NightPartyClient from "../../components/Client/PrideParty";

export const metadata = {
  title: "Bridge Inn Night Party Highlights",
  description: "Relive the unforgettable Night-Time Party at the Bridge Inn! Explore photos, videos, volunteer stories, and sponsor contributions from the event.",
};

export default function NightPartyPage() {
  return (
    <>
      <Head>
        <title>Bridge Inn Night Party - Event Highlights & Gallery</title>
        <meta
          name="description"
          content="Relive the unforgettable Night-Time Party at the Bridge Inn! Explore photos, videos, volunteer stories, and sponsor contributions from the event."
        />
        <meta
          name="keywords"
          content="Night party, Bridge Inn, event highlights, gallery, volunteers, sponsors, music, celebration, photos, past event"
        />
        <meta name="author" content="Bridge Inn Event Organizers" />
        <meta property="og:title" content="Bridge Inn Night Party - Highlights" />
        <meta property="og:description" content="Check out highlights from the Night-Time Party at Bridge Inn! Photos, volunteer stories, and sponsor details." />
      </Head>

      <NightPartyClient showPastEventNotice={true}/>
    </>
  );
}
