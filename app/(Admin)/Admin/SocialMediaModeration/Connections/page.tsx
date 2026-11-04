
import type { Metadata } from "next";

import SocialMediaModerationConnections from "../../components/SocialMediaModeration/client/ConnectionsPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Connections Page For Burton Pride Social Media Moderation App",
  description:
    "Connections page for the Burton Pride Social Media Moderation app.",

  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function SocialMediaModerationConnectionsPage() {
  return <SocialMediaModerationConnections />;
}